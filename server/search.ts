import { INNERTUBE_CLIENT_VERSION, MAX_QUERY_LENGTH, PRIMARY_USER_AGENT } from './constants.js'
import {
  enrichSearchResults,
  type YouTubeChannelItem,
  type YouTubeVideoItem,
} from './search-metadata.js'
import type { PlaylistSearchResultItem, SearchResultItem } from './types.js'

export function buildYouTubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`
}

function extractText(field: unknown): string {
  if (!field || typeof field !== 'object') return ''
  const record = field as Record<string, unknown>
  if (typeof record.simpleText === 'string') return record.simpleText
  if (Array.isArray(record.runs)) {
    return record.runs
      .map((run) => (run as { text?: string }).text ?? '')
      .join('')
  }
  return ''
}

function extractThumbnail(renderer: Record<string, unknown>, videoId: string): string {
  const thumb = renderer.thumbnail as { thumbnails?: { url?: string; width?: number }[] } | undefined
  const thumbs = thumb?.thumbnails
  if (!thumbs?.length) {
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  }
  const best = [...thumbs].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
  return best.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

function extractChannelId(renderer: Record<string, unknown>): string | undefined {
  for (const key of ['ownerText', 'shortBylineText', 'longBylineText']) {
    const field = renderer[key]
    if (!field || typeof field !== 'object') continue

    const runs = (field as { runs?: Array<Record<string, unknown>> }).runs
    if (!Array.isArray(runs)) continue

    for (const run of runs) {
      const browseId = (run.navigationEndpoint as { browseEndpoint?: { browseId?: string } } | undefined)
        ?.browseEndpoint?.browseId
      if (typeof browseId === 'string' && browseId.startsWith('UC')) {
        return browseId
      }
    }
  }

  return undefined
}

function rendererToResult(renderer: Record<string, unknown>): SearchResultItem | null {
  const videoId = typeof renderer.videoId === 'string' ? renderer.videoId : null
  if (!videoId || videoId.length !== 11) return null

  const title = extractText(renderer.title)
  if (!title) return null

  return {
    videoId,
    title,
    channel: extractText(renderer.ownerText) || extractText(renderer.shortBylineText) || 'Unknown channel',
    thumbnail: extractThumbnail(renderer, videoId),
    publishedAt: extractText(renderer.publishedTimeText),
    description: extractText(renderer.descriptionSnippet),
    viewCount: extractText(renderer.viewCountText),
    duration: extractText(renderer.lengthText),
    channelId: extractChannelId(renderer),
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function fetchYouTubeDataApiItems<T>(
  endpoint: 'videos' | 'channels',
  part: string,
  ids: string[],
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<T[]> {
  if (ids.length === 0) return []

  const items: T[] = []
  for (const batch of chunk(ids, 50)) {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`)
    url.searchParams.set('part', part)
    url.searchParams.set('id', batch.join(','))
    url.searchParams.set('key', apiKey)

    const res = await fetchFn(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`YouTube Data API ${endpoint} request failed (${res.status})`)
    }

    const data = (await res.json()) as { items?: T[] }
    if (Array.isArray(data.items)) items.push(...data.items)
  }

  return items
}

async function enrichResultsWithYouTubeDataApi(
  results: SearchResultItem[],
  fetchFn: typeof fetch,
): Promise<SearchResultItem[]> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim()
  if (!apiKey || results.length === 0) return results

  const videos = await fetchYouTubeDataApiItems<YouTubeVideoItem>(
    'videos',
    'snippet,statistics,contentDetails,status,topicDetails',
    [...new Set(results.map((result) => result.videoId))],
    apiKey,
    fetchFn,
  )

  const channelIds = [...new Set(videos.map((video) => video.snippet?.channelId).filter(Boolean))] as string[]
  const channels = await fetchYouTubeDataApiItems<YouTubeChannelItem>(
    'channels',
    'snippet,statistics',
    channelIds,
    apiKey,
    fetchFn,
  )

  return enrichSearchResults(results, videos, channels)
}

function collectFromInitialData(data: unknown, maxResults: number): SearchResultItem[] {
  const results: SearchResultItem[] = []
  const seen = new Set<string>()

  const tryAdd = (renderer: Record<string, unknown>) => {
    if (results.length >= maxResults) return
    const item = rendererToResult(renderer)
    if (!item || seen.has(item.videoId)) return
    seen.add(item.videoId)
    results.push(item)
  }

  const walk = (node: unknown) => {
    if (!node || results.length >= maxResults) return

    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }

    if (typeof node !== 'object') return
    const record = node as Record<string, unknown>

    if (record.videoRenderer && typeof record.videoRenderer === 'object') {
      tryAdd(record.videoRenderer as Record<string, unknown>)
    }

    if (record.richItemRenderer && typeof record.richItemRenderer === 'object') {
      const content = (record.richItemRenderer as Record<string, unknown>).content
      walk(content)
    }

    if (record.compactVideoRenderer && typeof record.compactVideoRenderer === 'object') {
      tryAdd(record.compactVideoRenderer as Record<string, unknown>)
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') walk(value)
    }
  }

  walk(data)
  return results
}

function extractYtInitialData(html: string): unknown | null {
  const marker = 'ytInitialData'
  const idx = html.indexOf(marker)
  if (idx === -1) return null

  const start = html.indexOf('{', idx)
  if (start === -1) return null

  let depth = 0
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }

  return null
}

async function fetchWithHeaders(
  fetchFn: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  return fetchFn(url, {
    ...init,
    headers: {
      "User-Agent": PRIMARY_USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "*/*",
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
}

async function isEmbeddableVideo(videoId: string, fetchFn: typeof fetch): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4500)

  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    const res = await fetchWithHeaders(fetchFn, url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (res.ok) return true

    // These statuses usually indicate unavailable/unembeddable content.
    if ([401, 403, 404, 410].includes(res.status)) return false

    // Fail open on transient statuses so temporary network issues do not hide results.
    return true
  } catch {
    // Fail open on network/timeout errors.
    return true
  } finally {
    clearTimeout(timeoutId)
  }
}

async function filterEmbeddableResults(
  results: SearchResultItem[],
  fetchFn: typeof fetch,
): Promise<{ filtered: SearchResultItem[]; removed: number }> {
  if (results.length === 0) return { filtered: [], removed: 0 }

  const checks = await Promise.all(
    results.map(async (item) => ({
      item,
      embeddable: await isEmbeddableVideo(item.videoId, fetchFn),
    })),
  )

  const filtered = checks.filter((entry) => entry.embeddable).map((entry) => entry.item)
  return { filtered, removed: results.length - filtered.length }
}

async function fetchResultsPageInitialData(query: string, fetchFn: typeof fetch): Promise<unknown> {
  const url = buildYouTubeSearchUrl(query)
  const res = await fetchWithHeaders(fetchFn, url, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
  })

  if (!res.ok) {
    throw new Error(`YouTube search page returned ${res.status}`)
  }

  const html = await res.text()
  const initialData = extractYtInitialData(html)
  if (!initialData) {
    throw new Error('Could not parse YouTube search page')
  }

  return initialData
}

async function searchViaResultsUrl(
  query: string,
  maxResults: number,
  fetchFn: typeof fetch,
): Promise<SearchResultItem[]> {
  const initialData = await fetchResultsPageInitialData(query, fetchFn)
  return collectFromInitialData(initialData, maxResults)
}

async function fetchInnertubeSearchData(query: string, fetchFn: typeof fetch): Promise<unknown> {
  const res = await fetchWithHeaders(
    fetchFn,
    'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://www.youtube.com',
        Referer: buildYouTubeSearchUrl(query),
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: INNERTUBE_CLIENT_VERSION,
            hl: 'en',
            gl: 'US',
          },
        },
        query,
      }),
    },
  )

  if (!res.ok) {
    throw new Error(`YouTube search API returned ${res.status}`)
  }

  return res.json()
}

async function searchViaInnertube(
  query: string,
  maxResults: number,
  fetchFn: typeof fetch,
): Promise<SearchResultItem[]> {
  const data = await fetchInnertubeSearchData(query, fetchFn)
  return collectFromInitialData(data, maxResults)
}

function extractPlaylistThumbnail(renderer: Record<string, unknown>): string | null {
  // playlistRenderer's thumbnail shape (community-documented, not an
  // official schema — YouTube's internal JSON isn't published, so this is
  // a best-effort match against the commonly-observed structure, not
  // something verifiable without a live request):
  //   thumbnails: [ { thumbnails: [ { url, width, height }, ... ] } ]
  const outer = renderer.thumbnails
  if (Array.isArray(outer) && outer.length > 0) {
    const inner = (outer[0] as { thumbnails?: { url?: string; width?: number }[] } | undefined)?.thumbnails
    if (Array.isArray(inner) && inner.length > 0) {
      const best = [...inner].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
      if (best?.url) return best.url
    }
  }
  return null
}

function playlistRendererToResult(renderer: Record<string, unknown>): PlaylistSearchResultItem | null {
  const playlistId = typeof renderer.playlistId === 'string' ? renderer.playlistId : null
  if (!playlistId) return null

  const title = extractText(renderer.title)
  if (!title) return null

  return {
    playlistId,
    title,
    channel: extractText(renderer.shortBylineText) || extractText(renderer.longBylineText) || 'Unknown channel',
    thumbnail: extractPlaylistThumbnail(renderer),
  }
}

function collectPlaylistsFromInitialData(data: unknown, maxResults: number): PlaylistSearchResultItem[] {
  const results: PlaylistSearchResultItem[] = []
  const seen = new Set<string>()

  const tryAdd = (renderer: Record<string, unknown>) => {
    if (results.length >= maxResults) return
    const item = playlistRendererToResult(renderer)
    if (!item || seen.has(item.playlistId)) return
    seen.add(item.playlistId)
    results.push(item)
  }

  const walk = (node: unknown) => {
    if (!node || results.length >= maxResults) return

    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }

    if (typeof node !== 'object') return
    const record = node as Record<string, unknown>

    if (record.playlistRenderer && typeof record.playlistRenderer === 'object') {
      tryAdd(record.playlistRenderer as Record<string, unknown>)
    }

    if (record.richItemRenderer && typeof record.richItemRenderer === 'object') {
      const content = (record.richItemRenderer as Record<string, unknown>).content
      walk(content)
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') walk(value)
    }
  }

  walk(data)
  return results
}

/**
 * Scrapes YouTube's search results for playlists — the exact gap named at
 * the very start of this project's playlist work (`server/search.ts` never
 * parsed `playlistRenderer`, only `videoRenderer`). Deliberately mirrors
 * `searchYouTubeVideos`'s two-attempt structure (results page, then
 * innertube) and its fetch mechanism — same direct-fetch, no `proxy.ts`
 * coupling, same as video search already does. No embeddable-check or
 * Data API enrichment here; playlists don't need either.
 *
 * NOTE: `playlistRenderer`'s JSON shape isn't an official, documented
 * schema (same caveat as everything else this file parses) — this was
 * written against commonly-observed structure and has not been verified
 * against a live request in this environment (no network access here).
 * Treat this as a first pass to validate against real results, not as
 * proven-correct the way the video parsing already is (that one has been
 * running in production).
 */
export async function searchYouTubePlaylistsScraped(
  query: string,
  maxResults = 10,
): Promise<PlaylistSearchResultItem[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH)
  if (!trimmed) return []

  const limit = Math.min(Math.max(maxResults, 1), 25)
  const fetchFn = fetch

  const attempts: Array<() => Promise<PlaylistSearchResultItem[]>> = [
    () => fetchResultsPageInitialData(trimmed, fetchFn).then((data) => collectPlaylistsFromInitialData(data, limit)),
    () => fetchInnertubeSearchData(trimmed, fetchFn).then((data) => collectPlaylistsFromInitialData(data, limit)),
  ]

  for (const attempt of attempts) {
    try {
      const results = await attempt()
      if (results.length > 0) return results
    } catch {
      // Try next method.
    }
  }

  return []
}

export async function searchYouTubeVideos(
  query: string,
  maxResults = 25,
): Promise<{ results: SearchResultItem[]; searchUrl: string; warning?: string }> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH)
  const searchUrl = buildYouTubeSearchUrl(trimmed)
  if (!trimmed) {
    return { results: [], searchUrl }
  }

  const limit = Math.min(Math.max(maxResults, 1), 25)
  // Use direct fetch for search (don't apply proxy - search works fine on Vercel)
  // Proxy is only needed for transcripts, which have stricter anti-bot protection
  const fetchFn = fetch

  const attempts: Array<{ name: string; run: () => Promise<SearchResultItem[]> }> = [
    { name: 'results page', run: () => searchViaResultsUrl(trimmed, limit, fetchFn) },
    { name: 'innertube', run: () => searchViaInnertube(trimmed, limit, fetchFn) },
  ]

  for (const attempt of attempts) {
    try {
      const results = await attempt.run()
      if (results.length > 0) {
        const warnings: string[] = []

        const { filtered: embeddableResults, removed } = await filterEmbeddableResults(
          results,
          fetchFn,
        )

        if (removed > 0) {
          warnings.push(`Filtered ${removed} non-embeddable video${removed > 1 ? 's' : ''}.`)
        }

        if (embeddableResults.length === 0) {
          return {
            results: [],
            searchUrl,
            warning:
              warnings[0] ??
              'No embeddable results available for this query. Try another search term.',
          }
        }

        try {
          const enrichedResults = await enrichResultsWithYouTubeDataApi(embeddableResults, fetchFn)
          const finalResults = enrichedResults.filter((item) => item.embeddable !== false)

          if (finalResults.length !== enrichedResults.length) {
            const filteredByMetadata = enrichedResults.length - finalResults.length
            warnings.push(
              `Filtered ${filteredByMetadata} video${filteredByMetadata > 1 ? 's' : ''} blocked for external playback.`,
            )
          }

          return {
            results: finalResults,
            searchUrl,
            warning: warnings.length > 0 ? warnings.join(' ') : undefined,
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'unknown error'
          warnings.push(
            `Discovery metadata unavailable; using base YouTube results. ${message}`,
          )
          return {
            results: embeddableResults,
            searchUrl,
            warning: warnings.join(' '),
          }
        }
      }
    } catch {
      // Try next method
    }
  }

  return {
    results: [],
    searchUrl,
    warning:
      'In-app results unavailable from this network. Open the search on YouTube to browse videos.',
  }
}
