import type { SearchResultItem } from '../types'

export type SearchSortType =
  | 'recommended'
  | 'relevance'
  | 'publishDate'
  | 'viewCount'
  | 'duration'
  | 'channelTrust'
  | 'safety'

const SORT_TYPE_KEY = 'youtubemax.searchSortType'
const VALID_SORT_TYPES: SearchSortType[] = [
  'recommended', 'relevance', 'publishDate', 'viewCount', 'duration', 'channelTrust', 'safety',
]

// Reported directly wanting user prefs/filters to survive a refresh --
// selectedFilters already did (searchFilters.ts's own loadStoredFilters/
// persistFilters), sort type didn't, same gap. Same localStorage pattern.
export function loadStoredSortType(): SearchSortType {
  if (typeof window === 'undefined') return 'recommended'
  try {
    const raw = localStorage.getItem(SORT_TYPE_KEY)
    if (raw && (VALID_SORT_TYPES as string[]).includes(raw)) return raw as SearchSortType
  } catch {
    // ignored -- falls through to the default
  }
  return 'recommended'
}

export function persistSortType(sortType: SearchSortType): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SORT_TYPE_KEY, sortType)
  } catch {
    // storage full/unavailable -- preference just won't persist
  }
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function parseSearchTerms(query: string | undefined): string[] {
  if (!query) return []

  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function computeTermMatchScore(result: SearchResultItem, query: string | undefined): number {
  const terms = parseSearchTerms(query)
  if (terms.length === 0) return 0.5

  const haystack = `${result.title} ${result.description} ${result.channel}`.toLowerCase()
  let matches = 0

  for (const term of terms) {
    if (haystack.includes(term)) matches += 1
  }

  const baseScore = matches / terms.length
  const exactPhraseBonus = haystack.includes(query!.trim().toLowerCase()) ? 0.15 : 0
  return clamp(baseScore + exactPhraseBonus)
}

function computeRecencyScore(daysAgo: number, maxDaysAgo: number): number {
  if (!Number.isFinite(daysAgo)) return 0
  if (maxDaysAgo <= 0) return 1

  const normalized = Math.log10(daysAgo + 1) / Math.log10(maxDaysAgo + 1)
  return clamp(1 - normalized)
}

function computePopularityScore(viewCount: number, maxViewCount: number): number {
  if (viewCount <= 0 || maxViewCount <= 0) return 0

  return clamp(Math.log10(viewCount + 1) / Math.log10(maxViewCount + 1))
}

function computeRecommendedScore(
  result: SearchResultItem,
  query: string | undefined,
  maxViewCount: number,
  maxDaysAgo: number,
): number {
  const termScore = computeTermMatchScore(result, query)
  const popularityScore = computePopularityScore(
    parseViewCountToNumber(result.viewCount),
    maxViewCount,
  )
  const recencyScore = computeRecencyScore(
    parseRelativeDateToDays(result.publishedAt),
    maxDaysAgo,
  )

  return termScore * 0.55 + popularityScore * 0.3 + recencyScore * 0.15
}

/** Parse a "H:MM:SS" / "M:SS" duration string into total seconds. */
export function parseDurationToSeconds(durationStr: string | undefined): number {
  if (!durationStr) return 0
  const parts = durationStr.split(':').map(Number)
  if (parts.some((n) => Number.isNaN(n))) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || 0
}

/** Parse a view-count string ("1.2M views", "12,345") into a number. */
export function parseViewCountToNumber(viewCountStr: string | undefined): number {
  if (!viewCountStr) return 0
  const match = viewCountStr.match(/(\d+(?:\.\d+)?)\s*([KMB])/i)
  if (match) {
    const num = parseFloat(match[1])
    const unit = match[2].toUpperCase()
    if (unit === 'K') return num * 1_000
    if (unit === 'M') return num * 1_000_000
    if (unit === 'B') return num * 1_000_000_000
    return num
  }
  return parseInt(viewCountStr.replace(/\D/g, ''), 10) || 0
}

/** Parse a relative date ("3 days ago") into an approximate number of days ago. */
export function parseRelativeDateToDays(dateStr: string | undefined): number {
  if (!dateStr) return Infinity
  const normalized = dateStr.trim().toLowerCase()
  if (!normalized) return Infinity
  if (normalized === 'just now' || normalized === 'today') return 0
  if (normalized === 'yesterday') return 1
  const match = dateStr.match(/(\d+)\s*(second|minute|hour|day|week|month|year)/i)
  if (!match) return Infinity
  const n = parseInt(match[1], 10)
  const u = match[2].toLowerCase()
  if (u.startsWith('second')) return n / (24 * 3600)
  if (u.startsWith('minute')) return n / (24 * 60)
  if (u.startsWith('hour')) return n / 24
  if (u.startsWith('day')) return n
  if (u.startsWith('week')) return n * 7
  if (u.startsWith('month')) return n * 30
  if (u.startsWith('year')) return n * 365
  return Infinity
}

/**
 * Return a sorted copy of search results for the given sort type.
 * 'relevance' preserves the original (YouTube-provided) order.
 */
export function sortSearchResults(
  results: SearchResultItem[],
  sortType: SearchSortType,
  query?: string,
): SearchResultItem[] {
  if (sortType === 'relevance') return results

  if (sortType === 'recommended') {
    const maxViewCount = results.reduce(
      (max, result) => Math.max(max, parseViewCountToNumber(result.viewCount)),
      0,
    )
    const maxDaysAgo = results.reduce((max, result) => {
      const daysAgo = parseRelativeDateToDays(result.publishedAt)
      return Number.isFinite(daysAgo) ? Math.max(max, daysAgo) : max
    }, 0)

    return [...results]
      .map((result, index) => ({
        result,
        index,
        score: computeRecommendedScore(result, query, maxViewCount, maxDaysAgo),
        viewCount: parseViewCountToNumber(result.viewCount),
        daysAgo: parseRelativeDateToDays(result.publishedAt),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (b.viewCount !== a.viewCount) return b.viewCount - a.viewCount
        if (a.daysAgo !== b.daysAgo) return a.daysAgo - b.daysAgo
        return a.index - b.index
      })
      .map(({ result }) => result)
  }

  const sorted = [...results]
  if (sortType === 'viewCount') {
    sorted.sort((a, b) => parseViewCountToNumber(b.viewCount) - parseViewCountToNumber(a.viewCount))
  } else if (sortType === 'duration') {
    sorted.sort((a, b) => parseDurationToSeconds(b.duration) - parseDurationToSeconds(a.duration))
  } else if (sortType === 'publishDate') {
    sorted.sort((a, b) => parseRelativeDateToDays(a.publishedAt) - parseRelativeDateToDays(b.publishedAt))
  } else if (sortType === 'channelTrust') {
    sorted.sort((a, b) => (b.channelTrustScore ?? -1) - (a.channelTrustScore ?? -1))
  } else if (sortType === 'safety') {
    sorted.sort((a, b) => (b.safetyScore ?? -1) - (a.safetyScore ?? -1))
  }
  return sorted
}

// Kids content (YouTube's own `status.madeForKids` flag, server/search-
// metadata.ts) tends to have outsized view counts -- nursery rhyme
// channels routinely hit billions -- so any view/popularity-weighted sort
// (viewCount, and 'recommended's own popularity term) piles it up at the
// front of general/mixed results. Reported directly as Kids content
// "flooding" results outside its own audience. Spreads it to at most one
// in every KIDS_SPACING slots instead of removing it -- nothing is hidden,
// same approach as DEKHO's own declutterKids (lib/filtering.ts there).
// A no-op whenever the caller has explicitly asked for Kids/Rhymes content
// (see hasKidsFilterActive below), since flooding *toward* Kids content is
// exactly the point once that's an explicit choice.
const KIDS_SPACING = 12

export function declutterMadeForKids(results: SearchResultItem[]): SearchResultItem[] {
  const kids = results.filter((r) => r.madeForKids === true)
  if (kids.length === 0) return results
  const rest = results.filter((r) => r.madeForKids !== true)
  const merged: SearchResultItem[] = []
  let ki = 0
  let sinceLastKid = KIDS_SPACING
  for (const item of rest) {
    merged.push(item)
    sinceLastKid++
    if (sinceLastKid >= KIDS_SPACING && ki < kids.length) {
      merged.push(kids[ki++])
      sinceLastKid = 0
    }
  }
  while (ki < kids.length) merged.push(kids[ki++])
  return merged
}

/** True when the user has explicitly asked for Kids/Rhymes content via the
 *  filter chips (audience: Kids, or a Kids/Rhyme category) -- in which case
 *  declutterMadeForKids should be skipped entirely rather than spreading
 *  out the very content that was asked for. */
export function hasKidsFilterActive(selectedFilterLabels: string[]): boolean {
  return selectedFilterLabels.some((label) => /kids|rhyme/i.test(label))
}
