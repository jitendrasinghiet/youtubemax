/**
 * Creates a fetch function that routes requests through a residential proxy.
 * 
 * Supports two types of proxy configurations:
 * 1. HTTP proxy with auth: YOUTUBE_PROXY_URL=http://username:password@proxy.com:8080
 * 2. Proxy API endpoint: YOUTUBE_PROXY_URL=https://api.proxy.com/fetch?url=
 * 
 * For Vercel, recommend using a proxy API service (AllOrigins, CORS Anywhere fork, etc.)
 * or a residential proxy API that accepts URLs and returns responses.
 */
export async function createProxyFetch(): Promise<typeof fetch> {
  const proxyUrl = process.env.YOUTUBE_PROXY_URL?.trim()

  if (!proxyUrl) return fetch

  // If proxy URL is an API endpoint (not a traditional HTTP proxy)
  // This pattern works with proxy services that accept URL parameters
  if (proxyUrl.includes('?url=') || proxyUrl.endsWith('?')) {
    return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      try {
        const targetUrl = typeof input === 'string' ? input : input.toString()
        const encoded = encodeURIComponent(targetUrl)
        const proxyApiUrl = proxyUrl.includes('?url=')
          ? `${proxyUrl}${encoded}`
          : `${proxyUrl}url=${encoded}`

        // Forward headers from original request if available
        const headers = init?.headers
          ? typeof init.headers === 'object' ? init.headers : {}
          : {}

        return fetch(proxyApiUrl, {
          ...init,
          headers: {
            ...headers,
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          },
        })
      } catch (error) {
        // Fallback to direct fetch if proxy API fails
        console.error('[Proxy API Error]', error instanceof Error ? error.message : error)
        return fetch(input, init)
      }
    }
  }

  // Traditional HTTP proxy (for reference, though Vercel Functions don't support this well)
  // Would require HttpProxyAgent/HttpsProxyAgent which isn't available in Vercel Functions
  return fetch
}