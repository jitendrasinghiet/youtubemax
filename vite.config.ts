import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { analyzeVideo } from './server/analyze.ts'
import { buildYouTubeSearchUrl, searchYouTubeVideos } from './server/search.ts'
import { browseCache, getCachedSearch, getFacetCounts, recordSearch } from './server/searchCache.ts'
import { fetchYouTubeSuggestions } from './server/suggest.ts'
import { fetchPlaylistItems, fetchPlaylistMeta, PlaylistFetchError } from './server/youtubePlaylists.ts'
import { searchPlaylists, PlaylistSearchError } from './server/youtubePlaylistSearch.ts'
import {
  listLocalPlaylists,
  readLocalPlaylist,
  createLocalPlaylist,
  updateLocalPlaylistMeta,
  addLocalPlaylistItem,
  removeLocalPlaylistItem,
  reorderLocalPlaylistItems,
  deleteLocalPlaylist,
  LocalPlaylistError,
} from './server/localPlaylistStore.ts'
import { parseVideoId } from './server/youtube.ts'
import type { IncomingMessage } from 'node:http'

// Only the new dev-only local-playlist write routes need a JSON body —
// every other route in this middleware is GET/query-string only.
async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf-8')
  return raw ? (JSON.parse(raw) as T) : ({} as T)
}

function apiPlugin(): Plugin {
  return {
    name: 'youtubemax-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          next()
          return
        }

        const url = new URL(req.url, 'http://localhost')
        res.setHeader('Content-Type', 'application/json')

        if (url.pathname === '/api/analyze') {
          const raw = url.searchParams.get('videoId') ?? ''
          const videoId = parseVideoId(raw)

          if (!videoId) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid YouTube URL or video ID' }))
            return
          }

          try {
            const result = await analyzeVideo(videoId)
            res.statusCode = 200
            res.end(JSON.stringify(result))
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Analysis failed'
            res.statusCode = 500
            res.end(JSON.stringify({ error: message }))
          }
          return
        }

        if (url.pathname === '/api/search') {
          const query = url.searchParams.get('q')?.trim() ?? ''
          if (!query) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Search query is required' }))
            return
          }

          const maxResults = Number(url.searchParams.get('maxResults') ?? 12)
          const bypassCache = url.searchParams.get('refresh') === '1'

          try {
            if (!bypassCache) {
              const cached = await getCachedSearch(query)
              if (cached) {
                res.statusCode = 200
                res.end(
                  JSON.stringify({
                    results: cached.results,
                    searchUrl: buildYouTubeSearchUrl(query),
                    warning: undefined,
                    fromCache: true,
                    cachedAt: cached.searchedAt,
                  }),
                )
                return
              }
            }

            const { results, searchUrl, warning } = await searchYouTubeVideos(query, maxResults)
            // Dev-only write (see server/searchCache.ts's header) -- this
            // middleware only exists in configureServer, never in the
            // deployed api/*.ts path, so this can't run against a
            // read-only production filesystem.
            if (results.length > 0) {
              await recordSearch(query, results)
            }
            res.statusCode = 200
            res.end(JSON.stringify({ results, searchUrl, warning, fromCache: false }))
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Search failed'
            res.statusCode = 500
            res.end(JSON.stringify({ error: message }))
          }
          return
        }

        // Local-cache-first browse/lookup -- scans every committed
        // search-cache file instead of hitting YouTube. `keywords` (from a
        // toggled filter chip) and `query` (the typed Discovery search box)
        // each narrow the result set independently, on top of each other;
        // both omitted browses the *entire* cache (paginated via
        // `offset`/`maxResults`) -- this is the default discovery feed on
        // first load, see App.tsx. Read-only, so unlike every other
        // handler in this block it's NOT under /api/dev/ -- api/search-
        // cache.ts is the real Vercel function for production; this dev
        // middleware handler is just the local-dev equivalent of it, same
        // path, same underlying browseCache() call.
        if (url.pathname === '/api/search-cache') {
          const keywords = (url.searchParams.get('keywords') ?? '')
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean)
          const query = url.searchParams.get('query') ?? ''
          const limit = Number(url.searchParams.get('maxResults') ?? 25)
          const offset = Number(url.searchParams.get('offset') ?? 0)

          try {
            const { results, total } = await browseCache({ keywords, query, offset, limit })
            res.statusCode = 200
            res.end(JSON.stringify({ results, total }))
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Local cache search failed'
            res.statusCode = 500
            res.end(JSON.stringify({ error: message }))
          }
          return
        }

        // Same shape as /api/search-cache above, local-dev equivalent of
        // api/search-cache-facet-counts.ts -- see that file's header.
        if (url.pathname === '/api/search-cache-facet-counts') {
          const terms = (url.searchParams.get('terms') ?? '')
            .split('|')
            .map((t) => t.trim())
            .filter(Boolean)

          try {
            const counts = await getFacetCounts(terms)
            res.statusCode = 200
            res.end(JSON.stringify({ counts }))
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Facet count computation failed'
            res.statusCode = 500
            res.end(JSON.stringify({ error: message }))
          }
          return
        }

        // --- Dev-only local playlist manager (never in production: this
        // middleware only exists in configureServer, and Vercel functions
        // only come from api/*.ts, not this file). ---

        if (url.pathname === '/api/dev/playlist-search') {
          const q = url.searchParams.get('q')?.trim() ?? ''
          if (!q) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'A search query (q) is required' }))
            return
          }
          try {
            const results = await searchPlaylists(q)
            res.statusCode = 200
            res.end(JSON.stringify({ results }))
          } catch (err) {
            if (err instanceof PlaylistSearchError) {
              res.statusCode = err.statusCode
              res.end(JSON.stringify({ error: err.message }))
              return
            }
            res.statusCode = 500
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Playlist search failed' }))
          }
          return
        }

        if (url.pathname === '/api/dev/playlist-meta') {
          const playlistId = url.searchParams.get('playlistId')?.trim() ?? ''
          if (!playlistId) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'A playlistId is required' }))
            return
          }
          try {
            const meta = await fetchPlaylistMeta(playlistId)
            res.statusCode = 200
            res.end(JSON.stringify({ meta }))
          } catch (err) {
            const statusCode = err instanceof PlaylistFetchError ? err.statusCode : 500
            res.statusCode = statusCode
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to fetch playlist metadata' }))
          }
          return
        }

        if (url.pathname === '/api/dev/playlists' && req.method === 'GET') {
          const playlists = await listLocalPlaylists()
          res.statusCode = 200
          res.end(JSON.stringify({ playlists }))
          return
        }

        if (url.pathname === '/api/dev/playlists' && req.method === 'POST') {
          try {
            const body = await readJsonBody<{
              label: string
              icon?: string
              channel?: string
              loadedVia: 'id' | 'url' | 'search' | 'manual'
              sourcePlaylistId?: string | null
              seedResults?: Parameters<typeof createLocalPlaylist>[0]['seedResults']
            }>(req)
            if (!body.label?.trim()) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'label is required' }))
              return
            }
            const playlist = await createLocalPlaylist(body)
            res.statusCode = 201
            res.end(JSON.stringify({ playlist }))
          } catch (err) {
            const statusCode = err instanceof LocalPlaylistError ? err.statusCode : 500
            res.statusCode = statusCode
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to create playlist' }))
          }
          return
        }

        const localPlaylistMatch = url.pathname.match(/^\/api\/dev\/playlists\/([^/]+)$/)
        if (localPlaylistMatch && req.method === 'GET') {
          try {
            const playlist = await readLocalPlaylist(localPlaylistMatch[1])
            res.statusCode = 200
            res.end(JSON.stringify({ playlist }))
          } catch (err) {
            const statusCode = err instanceof LocalPlaylistError ? err.statusCode : 500
            res.statusCode = statusCode
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to read playlist' }))
          }
          return
        }

        if (localPlaylistMatch && req.method === 'PUT') {
          try {
            const body = await readJsonBody<{ label?: string; icon?: string; channel?: string }>(req)
            const playlist = await updateLocalPlaylistMeta(localPlaylistMatch[1], body)
            res.statusCode = 200
            res.end(JSON.stringify({ playlist }))
          } catch (err) {
            const statusCode = err instanceof LocalPlaylistError ? err.statusCode : 500
            res.statusCode = statusCode
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to update playlist' }))
          }
          return
        }

        if (localPlaylistMatch && req.method === 'DELETE') {
          try {
            await deleteLocalPlaylist(localPlaylistMatch[1])
            res.statusCode = 204
            res.end()
          } catch (err) {
            const statusCode = err instanceof LocalPlaylistError ? err.statusCode : 500
            res.statusCode = statusCode
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to delete playlist' }))
          }
          return
        }

        const localPlaylistItemsMatch = url.pathname.match(/^\/api\/dev\/playlists\/([^/]+)\/items$/)
        if (localPlaylistItemsMatch && req.method === 'POST') {
          try {
            const body = await readJsonBody<{
              videoId: string
              title: string
              channel: string
              thumbnail: string
            }>(req)
            if (!body.videoId) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'videoId is required' }))
              return
            }
            const playlist = await addLocalPlaylistItem(localPlaylistItemsMatch[1], body)
            res.statusCode = 200
            res.end(JSON.stringify({ playlist }))
          } catch (err) {
            const statusCode = err instanceof LocalPlaylistError ? err.statusCode : 500
            res.statusCode = statusCode
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to add item' }))
          }
          return
        }

        if (localPlaylistItemsMatch && req.method === 'PUT') {
          try {
            const body = await readJsonBody<{ orderedVideoIds: string[] }>(req)
            const playlist = await reorderLocalPlaylistItems(localPlaylistItemsMatch[1], body.orderedVideoIds ?? [])
            res.statusCode = 200
            res.end(JSON.stringify({ playlist }))
          } catch (err) {
            const statusCode = err instanceof LocalPlaylistError ? err.statusCode : 500
            res.statusCode = statusCode
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to reorder items' }))
          }
          return
        }

        const localPlaylistItemMatch = url.pathname.match(/^\/api\/dev\/playlists\/([^/]+)\/items\/([^/]+)$/)
        if (localPlaylistItemMatch && req.method === 'DELETE') {
          try {
            const playlist = await removeLocalPlaylistItem(localPlaylistItemMatch[1], localPlaylistItemMatch[2])
            res.statusCode = 200
            res.end(JSON.stringify({ playlist }))
          } catch (err) {
            const statusCode = err instanceof LocalPlaylistError ? err.statusCode : 500
            res.statusCode = statusCode
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to remove item' }))
          }
          return
        }

        if (url.pathname === '/api/playlist') {
          const playlistId = url.searchParams.get('playlistId')?.trim() ?? ''
          if (!playlistId || !/^[a-zA-Z0-9_-]{2,64}$/.test(playlistId)) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'A valid playlistId is required' }))
            return
          }

          const maxResults = Number(url.searchParams.get('maxResults') ?? 25)

          try {
            const results = await fetchPlaylistItems(playlistId, maxResults)
            res.statusCode = 200
            res.end(JSON.stringify({ results }))
          } catch (err) {
            if (err instanceof PlaylistFetchError) {
              res.statusCode = err.statusCode
              res.end(JSON.stringify({ error: err.message }))
              return
            }
            const message = err instanceof Error ? err.message : 'Failed to load playlist'
            res.statusCode = 500
            res.end(JSON.stringify({ error: message }))
          }
          return
        }

        if (url.pathname === '/api/suggest') {
          const query = url.searchParams.get('q')?.trim() ?? ''
          const maxResults = Number(url.searchParams.get('maxResults') ?? 8)

          if (!query) {
            res.statusCode = 200
            res.end(JSON.stringify({ suggestions: [] }))
            return
          }

          try {
            const suggestions = await fetchYouTubeSuggestions(query, maxResults)
            res.statusCode = 200
            res.end(JSON.stringify({ suggestions }))
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Suggestion lookup failed'
            res.statusCode = 500
            res.end(JSON.stringify({ error: message }))
          }
          return
        }

        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // BUG FIX: server/*.ts (this file's dev middleware, and by extension
  // every route above) reads process.env.YOUTUBE_DATA_API_KEY directly.
  // Vite's automatic .env handling only ever populates import.meta.env for
  // client code — it does NOT touch process.env for Node-side code like
  // this config file, and nothing here was previously bridging the two.
  // Result: .env's value was silently never visible to any server/*.ts
  // call under plain `npm run dev`, regardless of what was in the file.
  // loadEnv() reads .env/.env.local/.env.[mode] the same way Vite always
  // has; the explicit assignment loop below is the part that was missing.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value
  }

  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    server: {
      host: '0.0.0.0',
    },
    preview: {
      host: '0.0.0.0',
    },
  }
})
