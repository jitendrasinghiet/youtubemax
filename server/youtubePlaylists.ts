import type { SearchResultItem } from './types.js'

const PLAYLIST_ITEMS_URL = 'https://www.googleapis.com/youtube/v3/playlistItems'
const PLAYLISTS_URL = 'https://www.googleapis.com/youtube/v3/playlists'
const MAX_RESULTS_CAP = 50

interface YouTubePlaylistsResponse {
  items?: Array<{
    snippet?: {
      title?: string
      channelTitle?: string
      thumbnails?: Record<string, { url?: string; width?: number }>
    }
  }>
  error?: { message?: string }
}

interface YouTubePlaylistItemsResponse {
  items?: Array<{
    snippet?: {
      title?: string
      description?: string
      channelTitle?: string
      videoOwnerChannelTitle?: string
      publishedAt?: string
      thumbnails?: Record<string, { url?: string; width?: number }>
      resourceId?: { videoId?: string }
    }
    contentDetails?: {
      videoId?: string
    }
  }>
  error?: { message?: string }
}

function bestThumbnail(
  thumbnails: Record<string, { url?: string; width?: number }> | undefined,
  videoId: string,
): string {
  if (!thumbnails) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  const values = Object.values(thumbnails).filter((t): t is { url: string; width?: number } => Boolean(t?.url))
  if (values.length === 0) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  return [...values].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url
}

export class PlaylistFetchError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 502) {
    super(message)
    this.name = 'PlaylistFetchError'
    this.statusCode = statusCode
  }
}

/**
 * Fetches real items from a YouTube playlist via the official Data API
 * (playlistItems.list — ~1 quota unit/call). No scraping fallback: if the
 * key is missing or the API errors, this throws rather than silently
 * degrading to a scraped result, so a misconfigured deployment fails
 * loudly instead of quietly reintroducing the ToS problem this exists to
 * avoid.
 */
export async function fetchPlaylistItems(
  playlistId: string,
  maxResults: number,
  fetchFn: typeof fetch = fetch,
): Promise<SearchResultItem[]> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim()
  if (!apiKey) {
    throw new PlaylistFetchError(
      'YOUTUBE_DATA_API_KEY is not configured — curated playlists require the official YouTube Data API key.',
      500,
    )
  }

  const clampedMax = Math.min(Math.max(1, Math.floor(maxResults) || 25), MAX_RESULTS_CAP)

  const url = new URL(PLAYLIST_ITEMS_URL)
  url.searchParams.set('part', 'snippet,contentDetails')
  url.searchParams.set('playlistId', playlistId)
  url.searchParams.set('maxResults', String(clampedMax))
  url.searchParams.set('key', apiKey)

  let res: Response
  try {
    res = await fetchFn(url.toString(), { headers: { Accept: 'application/json' } })
  } catch (err) {
    throw new PlaylistFetchError(
      err instanceof Error ? `Playlist request failed: ${err.message}` : 'Playlist request failed',
    )
  }

  const data = (await res.json()) as YouTubePlaylistItemsResponse

  if (!res.ok) {
    throw new PlaylistFetchError(
      data.error?.message ?? `YouTube Data API playlistItems request failed (${res.status})`,
      res.status === 404 ? 404 : 502,
    )
  }

  const items = Array.isArray(data.items) ? data.items : []

  return items
    .map((item): SearchResultItem | null => {
      const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId
      const title = item.snippet?.title
      // Deleted/private videos still appear as playlist entries with
      // placeholder titles like "Private video" — skip rather than show
      // a broken card.
      if (!videoId || !title || title === 'Private video' || title === 'Deleted video') return null

      return {
        videoId,
        title,
        channel: item.snippet?.videoOwnerChannelTitle ?? item.snippet?.channelTitle ?? 'Unknown channel',
        thumbnail: bestThumbnail(item.snippet?.thumbnails, videoId),
        publishedAt: item.snippet?.publishedAt ?? '',
        description: item.snippet?.description ?? '',
      }
    })
    .filter((item): item is SearchResultItem => item !== null)
}

export interface PlaylistMeta {
  title: string
  channel: string
}

/**
 * Fetches a playlist's real title/channel via the official Data API
 * (playlists.list — ~1 quota unit/call). Best-effort by design: callers
 * should treat a thrown error as "metadata unavailable" and fall back to a
 * placeholder label rather than blocking the load entirely.
 */
export async function fetchPlaylistMeta(
  playlistId: string,
  fetchFn: typeof fetch = fetch,
): Promise<PlaylistMeta> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim()
  if (!apiKey) {
    throw new PlaylistFetchError('YOUTUBE_DATA_API_KEY is not configured.', 500)
  }

  const url = new URL(PLAYLISTS_URL)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('id', playlistId)
  url.searchParams.set('key', apiKey)

  let res: Response
  try {
    res = await fetchFn(url.toString(), { headers: { Accept: 'application/json' } })
  } catch (err) {
    throw new PlaylistFetchError(
      err instanceof Error ? `Playlist metadata request failed: ${err.message}` : 'Playlist metadata request failed',
    )
  }

  const data = (await res.json()) as YouTubePlaylistsResponse

  if (!res.ok) {
    throw new PlaylistFetchError(
      data.error?.message ?? `YouTube Data API playlists request failed (${res.status})`,
      res.status === 404 ? 404 : 502,
    )
  }

  const snippet = data.items?.[0]?.snippet
  if (!snippet?.title) {
    throw new PlaylistFetchError(`No playlist found for id "${playlistId}"`, 404)
  }

  return {
    title: snippet.title,
    channel: snippet.channelTitle ?? 'Unknown channel',
  }
}
