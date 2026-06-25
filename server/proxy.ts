export async function createProxyFetch(): Promise<typeof fetch | undefined> {
  const proxyUrl = process.env.YOUTUBE_PROXY_URL?.trim()
  if (!proxyUrl) return undefined

  try {
    const undici = await import('undici')
    const agent = new undici.ProxyAgent(proxyUrl)
    const proxyFetch = (input: string | URL, init?: RequestInit) =>
      undici.fetch(input, { ...init, dispatcher: agent } as Parameters<typeof undici.fetch>[1])
    return proxyFetch as typeof fetch
  } catch {
    console.warn(
      'YOUTUBE_PROXY_URL is set but undici is not installed. Run: npm install undici',
    )
    return undefined
  }
}
