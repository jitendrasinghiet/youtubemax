import type { VercelRequest, VercelResponse } from '@vercel/node'
import { browseCache, parseKeywordGroupsParam } from '../server/searchCache.js'

// Pure read of committed data/search-cache/*.json files, which ship with
// the deployment -- unlike /api/search (which writes a fresh cache entry
// on a miss, only safe against a writable local-dev filesystem), this is
// safe to run in Vercel's read-only production functions. Backs the
// default discovery feed and the filter-chip/search-box local narrowing
// (src/App.tsx) in production the same way vite.config.ts's dev-only
// middleware does locally -- see docs/SEARCH_CACHE.md.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const keywordGroups = parseKeywordGroupsParam(typeof req.query.keywords === 'string' ? req.query.keywords : '')
  const query = typeof req.query.query === 'string' ? req.query.query : ''
  const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0
  const limit = typeof req.query.maxResults === 'string' ? Number(req.query.maxResults) : 25

  try {
    const { results, total } = await browseCache({ keywordGroups, query, offset, limit })
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ results, total })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Local cache search failed'
    return res.status(500).json({ error: message })
  }
}
