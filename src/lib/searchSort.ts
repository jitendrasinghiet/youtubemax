import type { SearchResultItem } from '../types'

export type SearchSortType = 'relevance' | 'publishDate' | 'viewCount' | 'duration'

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
): SearchResultItem[] {
  if (sortType === 'relevance') return results

  const sorted = [...results]
  if (sortType === 'viewCount') {
    sorted.sort((a, b) => parseViewCountToNumber(b.viewCount) - parseViewCountToNumber(a.viewCount))
  } else if (sortType === 'duration') {
    sorted.sort((a, b) => parseDurationToSeconds(b.duration) - parseDurationToSeconds(a.duration))
  } else if (sortType === 'publishDate') {
    sorted.sort((a, b) => parseRelativeDateToDays(a.publishedAt) - parseRelativeDateToDays(b.publishedAt))
  }
  return sorted
}
