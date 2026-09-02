import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchPlaylistItems, PlaylistFetchError } from '../server/youtubePlaylists.js'
import { checkRateLimit, clientIp } from '../server/rateLimit.js'

const PLAYLIST_ID_RE = /^[a-zA-Z0-9_-]{2,64}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(`playlist:${clientIp(req)}`, 20, 60_000)
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({ error: 'Too many requests, slow down' })
  }

  const playlistId = typeof req.query.playlistId === 'string' ? req.query.playlistId.trim() : ''
  if (!playlistId || !PLAYLIST_ID_RE.test(playlistId)) {
    return res.status(400).json({ error: 'A valid playlistId is required' })
  }

  const maxResults =
    typeof req.query.maxResults === 'string' ? Number(req.query.maxResults) : 25

  try {
    const results = await fetchPlaylistItems(playlistId, maxResults)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ results })
  } catch (err) {
    if (err instanceof PlaylistFetchError) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    const message = err instanceof Error ? err.message : 'Failed to load playlist'
    return res.status(500).json({ error: message })
  }
}
