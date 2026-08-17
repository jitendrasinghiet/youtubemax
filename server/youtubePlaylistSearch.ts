// Scrapes first (via server/search.ts's playlist collector — same direct
// fetch mechanism the existing video search already uses, no proxy.ts
// coupling there either), falls back to the official search.list Data API
// only if scraping finds nothing AND a key is configured. This means most
// playlist searches cost zero quota; search.list (~100 units/call, vs
// playlistItems.list's ~1) is now a fallback, not the primary path — still
// worth keeping out of any batch/loop path if it does fire.
import type { PlaylistSearchResultItem } from './types.js'
import { searchYouTubePlaylistsScraped } from './search.js'

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search'

interface YouTubeSearchResponse {
  items?: Array<{
    id?: { playlistId?: string }
    snippet?: {
      title?: string
      channelTitle?: string
      description?: string
      thumbnails?: Record<string, { url?: string; width?: number }>
    }
  }>
  error?: { message?: string }
}

function bestThumbnail(
  thumbnails: Record<string, { url?: string; width?: number }> | undefined,
): string | null {
  if (!thumbnails) return null
  const values = Object.values(thumbnails).filter((t): t is { url: string; width?: number } => Boolean(t?.url))
  if (values.length === 0) return null
  return [...values].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url
}

export class PlaylistSearchError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 502) {
    super(message)
    this.name = 'PlaylistSearchError'
    this.statusCode = statusCode
  }
}

export async function searchPlaylists(
  query: string,
  maxResults = 10,
  fetchFn: typeof fetch = fetch,
): Promise<PlaylistSearchResultItem[]> {
  // 1. Scraping first — matches how video search already works, zero quota
  // cost. A failure here (network, parsing) falls through silently to the
  // Data API attempt below rather than surfacing yet.
  try {
    const scraped = await searchYouTubePlaylistsScraped(query, maxResults)
    if (scraped.length > 0) return scraped
  } catch {
    // Fall through to the Data API attempt.
  }

  // 2. Data API fallback — only attempted if configured. If it's not, and
  // scraping already came back empty above, there's nothing left to try:
  // return no results rather than erroring, same as how video search
  // degrades to "no results" rather than a hard failure.
  const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim()
  if (!apiKey) return []

  const url = new URL(SEARCH_URL)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'playlist')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', String(Math.min(Math.max(1, Math.floor(maxResults) || 10), 25)))
  url.searchParams.set('key', apiKey)

  let res: Response
  try {
    res = await fetchFn(url.toString(), { headers: { Accept: 'application/json' } })
  } catch (err) {
    throw new PlaylistSearchError(
      err instanceof Error ? `Playlist search failed: ${err.message}` : 'Playlist search failed',
    )
  }

  const data = (await res.json()) as YouTubeSearchResponse

  if (!res.ok) {
    throw new PlaylistSearchError(
      data.error?.message ?? `YouTube Data API search failed (${res.status})`,
      res.status === 404 ? 404 : 502,
    )
  }

  const items = Array.isArray(data.items) ? data.items : []

  return items
    .map((item): PlaylistSearchResultItem | null => {
      const playlistId = item.id?.playlistId
      const title = item.snippet?.title
      if (!playlistId || !title) return null
      return {
        playlistId,
        title,
        channel: item.snippet?.channelTitle ?? 'Unknown channel',
        thumbnail: bestThumbnail(item.snippet?.thumbnails),
      }
    })
    .filter((item): item is PlaylistSearchResultItem => item !== null)
}
