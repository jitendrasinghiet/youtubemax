export async function createProxyFetch(): Promise<typeof fetch> {
  const proxyUrl = process.env.YOUTUBE_PROXY_URL?.trim()

  if (!proxyUrl) return fetch

  return async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    return fetch(input, init)
  }
}