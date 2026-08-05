import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { analyzeVideo } from './server/analyze.ts'
import { searchYouTubeVideos } from './server/search.ts'
import { fetchYouTubeSuggestions } from './server/suggest.ts'
import { parseVideoId } from './server/youtube.ts'

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

          try {
            const { results, searchUrl, warning } = await searchYouTubeVideos(query, maxResults)
            res.statusCode = 200
            res.end(JSON.stringify({ results, searchUrl, warning }))
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Search failed'
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

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin()],
  server: {
    host: '0.0.0.0',
  },
  preview: {
    host: '0.0.0.0',
  },
})
