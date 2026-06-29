/**
 * Browser-like fetch implementation for YouTube requests.
 * Uses realistic user agent, headers, and request patterns to avoid anti-bot detection.
 * Proxy is optional - browser identity often works without it.
 */

import { getRandomUserAgent } from './constants.js'

/**
 * Creates browser-like headers to avoid YouTube anti-bot detection.
 * Includes realistic user agent rotation, accept headers, language, etc.
 */
function getBrowserHeaders(init?: RequestInit): Record<string, string> {
  const baseHeaders: Record<string, string> = {
    'User-Agent': getRandomUserAgent(),
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
  }
  
  // Merge with custom headers from original request
  if (init?.headers && typeof init.headers === 'object' && !Array.isArray(init.headers)) {
    const customHeaders = init.headers as Record<string, string>
    Object.assign(baseHeaders, customHeaders)
  }
  
  return baseHeaders
}

/**
 * Browser fetch with realistic headers.
 * Tries direct fetch first, falls back to proxy if configured.
 */
export async function createBrowserFetch(): Promise<typeof fetch> {
  const proxyUrl = process.env.YOUTUBE_PROXY_URL?.trim()

  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    
    // First, try direct browser fetch (usually works now with proper headers)
    try {
      const res = await fetch(url, {
        ...init,
        headers: getBrowserHeaders(init),
      })
      
      // If successful or permanent error, return immediately
      if (res.ok || res.status === 404 || res.status === 403) {
        return res
      }
      
      // If temporary error (5xx) and proxy available, try proxy
      if (res.status >= 500 && proxyUrl) {
        console.log(`[Browser Fetch] Got ${res.status}, trying proxy...`)
        // Fall through to proxy attempt
      } else {
        return res
      }
    } catch (error) {
      // Network error - try proxy if available
      if (!proxyUrl) {
        throw error
      }
      console.log('[Browser Fetch] Direct fetch failed, trying proxy...', error instanceof Error ? error.message : error)
    }

    // Fallback to proxy if configured
    if (proxyUrl && (proxyUrl.includes('?url=') || proxyUrl.endsWith('?'))) {
      try {
        const encoded = encodeURIComponent(url)
        const proxyApiUrl = proxyUrl.includes('?url=')
          ? `${proxyUrl}${encoded}`
          : `${proxyUrl}url=${encoded}`

        return fetch(proxyApiUrl, {
          ...init,
          headers: getBrowserHeaders(init),
        })
      } catch (proxyError) {
        console.error('[Proxy Fallback] Failed:', proxyError instanceof Error ? proxyError.message : proxyError)
        throw proxyError
      }
    }

    // No proxy configured and direct fetch failed
    throw new Error(`Failed to fetch ${url} (no proxy configured)`)
  }
}
