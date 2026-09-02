import type { VercelRequest, VercelResponse } from '@vercel/node'
import { searchYouTubeVideos } from '../server/search.js'
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

  try {
    const { results, searchUrl, warning } = await searchYouTubeVideos(query, maxResults, locale)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ results, searchUrl, warning })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed'
    return res.status(500).json({ error: message })
  }
}
