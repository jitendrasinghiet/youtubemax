import type { VercelRequest, VercelResponse } from '@vercel/node'
import { analyzeVideo } from '../server/analyze.js'
import { parseVideoId } from '../server/youtube.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const raw = typeof req.query.videoId === 'string' ? req.query.videoId : ''
  const videoId = parseVideoId(raw)

  if (!videoId) {
    return res.status(400).json({ error: 'Invalid YouTube URL or video ID' })
  }

  try {
    const result = await analyzeVideo(videoId)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return res.status(500).json({ error: message })
  }
}

