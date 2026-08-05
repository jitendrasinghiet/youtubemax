import type { VercelRequest, VercelResponse } from '@vercel/node'
import { analyzeVideo } from '../server/analyze.js'
import { parseVideoId } from '../server/youtube.js'

function readBool(value: unknown, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback
  if (value.toLowerCase() === 'true') return true
  if (value.toLowerCase() === 'false') return false
  return fallback
}

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

  const includeTranscript = readBool(req.query.includeTranscript, true)
  const includeSummary = readBool(req.query.includeSummary, true)
  const includeChapters = readBool(req.query.includeChapters, true)

  try {
    const result = await analyzeVideo(videoId, {
      includeTranscript,
      includeSummary,
      includeChapters,
    })
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return res.status(500).json({ error: message })
  }
}

