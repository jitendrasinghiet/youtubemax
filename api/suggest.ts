import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchYouTubeSuggestions } from '../server/suggest.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
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
