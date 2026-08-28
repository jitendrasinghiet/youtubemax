import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getFacetCounts } from '../server/searchCache.js'

// Same read-only-safe shape as api/search-cache.ts -- see that file's
// header. Backs FilterMenu's per-chip "how many cached videos actually
// match this" counts in production.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const terms = (typeof req.query.terms === 'string' ? req.query.terms : '')
    .split('|')
    .map((t) => t.trim())
    .filter(Boolean)

  try {
    const counts = await getFacetCounts(terms)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ counts })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Facet count computation failed'
    return res.status(500).json({ error: message })
  }
}
