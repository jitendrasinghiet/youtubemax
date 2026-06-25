import type { VercelRequest, VercelResponse } from '@vercel/node'
import { searchYouTubeVideos } from '../server/search'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' })
  }

  const maxResults =
    typeof req.query.maxResults === 'string' ? Number(req.query.maxResults) : 12

  try {
    const { results, searchUrl, warning } = await searchYouTubeVideos(query, maxResults)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ results, searchUrl, warning })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed'
    return res.status(500).json({ error: message })
  }
}
