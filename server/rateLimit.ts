import type { VercelRequest } from '@vercel/node'

/**
 * Best-effort per-IP rate limiting for the public API routes -- checked
 * directly (asked to apply the same crawler/abuse protection DEKHO has,
 * the sibling project) and found these endpoints had none at all: no
 * auth, no rate limit, callable directly by anything, not just this
 * app's own UI. DEKHO's own protection (obfuscating video ids in a
 * static JSON file, see its docs/STATUS.md) doesn't translate directly --
 * youtubemax has no equivalent static bulk-data file to protect, it
 * proxies live per-query YouTube requests instead. The equivalent risk
 * here is different: these routes call through to real YouTube requests
 * on every miss (search.ts, suggest.ts, analyze.ts, playlist.ts), so an
 * unthrottled caller can use this deployment as a free, anonymous
 * YouTube-scraping proxy at whatever volume it wants.
 *
 * Honest limitation, stated plainly rather than glossed over: this is an
 * in-memory counter, and Vercel serverless functions don't guarantee one
 * persistent warm instance -- a cold start clears it, and concurrent
 * regions/instances each keep their own counts. It meaningfully throttles
 * a single naive script hammering one warm instance; it is NOT a hard
 * guarantee against a determined or distributed abuser. Real hardening
 * would need shared state (Vercel KV / Upstash Redis or similar) -- not
 * added here since it's a new paid dependency/infra decision, not
 * something to introduce unilaterally.
 */

interface Bucket {
  count: number
  windowStart: number
}

const buckets = new Map<string, Bucket>()

// Unbounded growth guard -- an attacker cycling through many fake/spoofed
// IPs could otherwise grow this Map forever within one warm instance's
// lifetime. Simple eviction of the oldest entries once it gets large,
// not a real LRU -- good enough for a best-effort limiter.
const MAX_BUCKETS = 5000

export function clientIp(req: VercelRequest): string {
  // Defensive against req.headers/req.socket being absent -- real Vercel
  // requests always have both, but the test suite's handler mocks (found
  // live, api/search.test.ts et al.) construct a bare { method, query }
  // object with neither.
  const forwarded = req.headers?.['x-forwarded-for']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (value) return value.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

/** Fixed-window limiter. Returns whether this call is allowed, and (when
 *  not) how many seconds until the window resets. `key` should combine
 *  the route name and the caller's IP, so one route's limit doesn't
 *  count against another's. */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || now - existing.windowStart >= windowMs) {
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value
      if (oldestKey !== undefined) buckets.delete(oldestKey)
    }
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.ceil((existing.windowStart + windowMs - now) / 1000)
    return { allowed: false, retryAfterSeconds }
  }

  existing.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}
