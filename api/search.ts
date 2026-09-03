import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildYouTubeSearchUrl, searchYouTubeVideos } from '../server/search.js'
import { getCachedSearch } from '../server/searchCache.js'
import { checkRateLimit, clientIp } from '../server/rateLimit.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(`search:${clientIp(req)}`, 30, 60_000)
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({ error: 'Too many requests, slow down' })
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' })
  }

  const maxResults =
    typeof req.query.maxResults === 'string' ? Number(req.query.maxResults) : 25

  // Only ever a short language/region code (locale-building lives
  // client-side, src/lib/searchLocale.ts) -- validated here regardless
  // before it reaches an outbound URL/POST body.
  const LOCALE_CODE_RE = /^[a-zA-Z-]{2,10}$/
  const hl = typeof req.query.hl === 'string' && LOCALE_CODE_RE.test(req.query.hl) ? req.query.hl : undefined
  const gl = typeof req.query.gl === 'string' && LOCALE_CODE_RE.test(req.query.gl) ? req.query.gl : undefined
  const locale = hl && gl ? { hl, gl } : undefined

  // Reported directly ("check/use existing cache first before search"):
  // this handler used to go straight to a live YouTube fetch every time,
  // even for a query already sitting in the committed search-cache.
  // vite.config.ts's dev-only middleware already checked the cache first
  // (see server/searchCache.ts's own docstring) -- it just never applied
  // here, in the path a real deployment actually serves. Reading the
  // cache is a plain file read of something shipped with the deployment,
  // safe on Vercel's read-only filesystem; only *writing* a fresh result
  // back needs a writable disk, which is why that half stays dev-only
  // (getCachedSearch's own docstring: "safe to call from anywhere,
  // including api/*.ts in production").
  const bypassCache = req.query.refresh === '1'

  try {
    if (!bypassCache) {
      const cached = await getCachedSearch(query)
      if (cached) {
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
        return res.status(200).json({
          results: cached.results,
          searchUrl: buildYouTubeSearchUrl(query, locale),
          warning: undefined,
          fromCache: true,
          cachedAt: cached.searchedAt,
        })
      }
    }

    const { results, searchUrl, warning } = await searchYouTubeVideos(query, maxResults, locale)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ results, searchUrl, warning, fromCache: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed'
    return res.status(500).json({ error: message })
  }
}
