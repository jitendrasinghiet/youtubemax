import type { SearchResultItem } from './types.js'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const INNERTUBE_CLIENT_VERSION = '2.20241218.01.00'

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
  }
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
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "*/*",
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
}

async function searchViaResultsUrl(
  query: string,
  maxResults: number,
  fetchFn: typeof fetch,
): Promise<SearchResultItem[]> {
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

  return collectFromInitialData(initialData, maxResults)
}

async function searchViaInnertube(
  query: string,
  maxResults: number,
  fetchFn: typeof fetch,
): Promise<SearchResultItem[]> {
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

  const data = await res.json()
  return collectFromInitialData(data, maxResults)
}

export async function searchYouTubeVideos(
  query: string,
  maxResults = 12,
): Promise<{ results: SearchResultItem[]; searchUrl: string; warning?: string }> {
  const trimmed = query.trim()
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
        return { results, searchUrl }
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
