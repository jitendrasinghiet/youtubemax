import type { AnalyzeResult, SearchResponse } from '../types'

export async function analyzeVideo(input: string): Promise<AnalyzeResult> {
  const params = new URLSearchParams({ videoId: input.trim() })
  const res = await fetch(`/api/analyze?${params}`)
  const data = await res.json()

  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Failed to analyze video',
    )
  }

  return data as AnalyzeResult
}

export async function searchVideos(query: string, maxResults = 12): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query.trim(), maxResults: String(maxResults) })
  const res = await fetch(`/api/search?${params}`)
  const data = await res.json()

  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Failed to search videos',
    )
  }

  return data as SearchResponse
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
