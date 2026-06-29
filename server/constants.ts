/**
 * Shared constants for YouTube scraping requests.
 * Centralized here so user agents and client versions can be updated in one place
 * when YouTube changes its anti-bot behavior.
 */

/** InnerTube web client version sent in search API requests. Update when YouTube rotates it. */
export const INNERTUBE_CLIENT_VERSION = '2.20241218.01.00'

/** Primary desktop Chrome user agent used for simple (non-rotating) requests. */
export const PRIMARY_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Pool of realistic user agents to rotate through for transcript/browser fetches. */
export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
] as const

/** Return a random user agent from the rotation pool. */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/** Maximum accepted length of a user-supplied search query (defense against abuse). */
export const MAX_QUERY_LENGTH = 200
