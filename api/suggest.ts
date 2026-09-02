import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchYouTubeSuggestions } from '../server/suggest.js'
import { checkRateLimit, clientIp } from '../server/rateLimit.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(`suggest:${clientIp(req)}`, 30, 60_000)
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({ error: 'Too many requests, slow down' })
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!query) {
    return res.status(200).json({ suggestions: [] })
  }

  const maxResults =
    typeof req.query.maxResults === 'string' ? Number(req.query.maxResults) : 8

  try {
    const suggestions = await fetchYouTubeSuggestions(query, maxResults)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ suggestions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Suggestion lookup failed'
    return res.status(500).json({ error: message })
  }
}
