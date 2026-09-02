import type { AnalyzeResult, SearchResponse, SearchResultItem } from '../types'

interface AnalyzeOptions {
  includeTranscript?: boolean
  includeSummary?: boolean
  includeChapters?: boolean
}

export async function analyzeVideo(input: string, options: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const params = new URLSearchParams({ videoId: input.trim() })
  if (typeof options.includeTranscript === 'boolean') {
    params.set('includeTranscript', String(options.includeTranscript))
  }
  if (typeof options.includeSummary === 'boolean') {
    params.set('includeSummary', String(options.includeSummary))
  }
  if (typeof options.includeChapters === 'boolean') {
    params.set('includeChapters', String(options.includeChapters))
  }
  const res = await fetch(`/api/analyze?${params}`)
  const data = await res.json()

  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Failed to analyze video',
    )
  }

  return data as AnalyzeResult
}

export async function searchVideos(
  query: string,
  maxResults = 25,
  locale?: { hl: string; gl: string },
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query.trim(), maxResults: String(maxResults) })
  if (locale) {
    params.set('hl', locale.hl)
    params.set('gl', locale.gl)
  }
  const res = await fetch(`/api/search?${params}`)
  const data = await res.json()

  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Failed to search videos',
    )
  }

  return data as SearchResponse
}

export interface BrowseCachePage {
  results: SearchResultItem[]
  total: number
}

/** Pages through the *entire* local search-result cache -- no live YouTube
 *  fetch. `keywords` (filter chips) and `query` (the typed Discovery search
 *  box) each narrow the result set independently, on top of each other;
 *  both omitted browses everything. This is what backs the default
 *  discovery feed (infinite scroll on first load), what a selected filter
 *  re-pages against, and what typing in the search box re-pages against
 *  before any online search runs -- see server/searchCache.ts's
 *  browseCache(). */
export async function browseCachedResults(
  { keywords = [], query = '', offset = 0, limit = 24 }: {
    keywords?: string[]
    query?: string
    offset?: number
    limit?: number
  } = {},
): Promise<BrowseCachePage> {
  const params = new URLSearchParams({ offset: String(offset), maxResults: String(limit) })
  const terms = keywords.map((k) => k.trim()).filter(Boolean)
  if (terms.length > 0) params.set('keywords', terms.join(','))
  if (query.trim()) params.set('query', query.trim())
  const res = await fetch(`/api/search-cache?${params}`)
  if (!res.ok) return { results: [], total: 0 }
  const data = await res.json()
  return {
    results: Array.isArray(data.results) ? (data.results as SearchResultItem[]) : [],
    total: typeof data.total === 'number' ? data.total : 0,
  }
}

/** How many cached videos match each of the given filter terms -- one
 *  round trip for the whole taxonomy (~275 terms) rather than one per
 *  chip. Terms are joined with `|` (a term itself is very unlikely to
 *  contain a pipe, unlike a comma). See server/searchCache.ts's
 *  getFacetCounts() -- literal-substring counts, not fuzzy, matching what
 *  selecting that single chip would actually filter to. */
export async function fetchFacetCounts(terms: string[]): Promise<Record<string, number>> {
  const unique = Array.from(new Set(terms.map((t) => t.trim()).filter(Boolean)))
  if (unique.length === 0) return {}
  const params = new URLSearchParams({ terms: unique.join('|') })
  const res = await fetch(`/api/search-cache-facet-counts?${params}`)
  if (!res.ok) return {}
  const data = await res.json()
  return data && typeof data.counts === 'object' ? (data.counts as Record<string, number>) : {}
}

export async function fetchPlaylistResults(
  playlistId: string,
  maxResults = 25,
): Promise<{ results: SearchResultItem[]; warning?: string }> {
  const params = new URLSearchParams({ playlistId, maxResults: String(maxResults) })
  const res = await fetch(`/api/playlist?${params}`)
  const data = await res.json()

  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Failed to load playlist',
    )
  }

  return data as { results: SearchResultItem[]; warning?: string }
}

export async function fetchSearchSuggestions(query: string, maxResults = 8): Promise<string[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const params = new URLSearchParams({ q: trimmed, maxResults: String(maxResults) })
  const res = await fetch(`/api/suggest?${params}`)
  const data = await res.json()

  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Failed to load suggestions',
    )
  }

  if (!Array.isArray(data.suggestions)) return []
  return data.suggestions.filter((value: unknown): value is string => typeof value === 'string')
}

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatChapterRange(
  start: number,
  endOrDuration?: number,
  isEnd: boolean = false,
): string {
  const startStr = formatTimestamp(start)
  if (!endOrDuration) return startStr
  const duration = isEnd ? endOrDuration - start : endOrDuration
  if (duration <= 0) return startStr
  const durationStr = formatTimestamp(duration)
  return `${startStr} – ${formatTimestamp(isEnd ? endOrDuration : start + endOrDuration)} (${durationStr})`
}

export function formatViewCount(count: string | undefined): string {
  if (!count) return ''
  const match = count.match(/^([\d.]+)\s*([KMB])/i)
  if (match) return count
  const num = parseInt(count.replace(/\D/g, ''), 10)
  if (Number.isNaN(num)) return count
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`
  return String(num)
}

export function parseSearchTerms(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase())
}

export function appendSearchTerm(query: string, term: string): string {
  const trimmed = query.trim()
  const normalized = term.trim()
  if (!normalized) return trimmed

  const existing = parseSearchTerms(trimmed)
  if (existing.includes(normalized.toLowerCase())) return trimmed

  return trimmed ? `${trimmed} ${normalized}` : normalized
}

export function removeSearchTerm(query: string, term: string): string {
  const target = term.trim().toLowerCase()
  return query
    .trim()
    .split(/\s+/)
    .filter((t) => t.toLowerCase() !== target)
    .join(' ')
}

export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`
}
