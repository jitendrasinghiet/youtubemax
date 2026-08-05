import { MAX_QUERY_LENGTH, PRIMARY_USER_AGENT } from './constants.js'

export async function fetchYouTubeSuggestions(query: string, maxResults = 8): Promise<string[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH)
  if (!trimmed) return []

  const url = new URL('https://suggestqueries.google.com/complete/search')
  url.searchParams.set('client', 'firefox')
  url.searchParams.set('ds', 'yt')
  url.searchParams.set('q', trimmed)

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': PRIMARY_USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`Suggestion request failed (${res.status})`)
  }

  const data = (await res.json()) as unknown
  if (!Array.isArray(data) || !Array.isArray(data[1])) return []

  const suggestions = data[1]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)

  const unique = [...new Set(suggestions)]
  return unique.slice(0, Math.max(1, Math.min(maxResults, 10)))
}
