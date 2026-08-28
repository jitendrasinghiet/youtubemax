// fs-backed cache of YouTube search results, keyed by normalized query.
// Deliberately Node-only (uses node:fs) -- same discipline as
// localPlaylistStore.ts: reading a committed JSON file is safe anywhere,
// including api/*.ts in production (the file ships with the deployment),
// but WRITING a fresh result to disk only makes sense in local dev, where
// the filesystem is actually writable and the result is what a human then
// commits. Vercel's serverless functions run against a read-only checkout
// at runtime, so persisting a cache entry is wired exclusively through
// vite.config.ts's dev-only middleware -- never called from api/*.ts.
//
// Why cache at all: every search here (server/search.ts) works by
// fetching youtube.com's results page (or its internal Innertube
// endpoint) and parsing it -- there's no official, rate-published search
// endpoint in play. Re-running the same query on every request is both
// slower and more of that traffic than necessary. A query that's already
// been searched and committed should never need to hit YouTube again.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { SearchResultItem } from './types.js'

const CACHE_DIR = path.resolve(process.cwd(), 'data', 'search-cache')

export interface SearchCacheEntry {
  query: string
  searchedAt: string
  results: SearchResultItem[]
}

// Mirrors scripts/yt_search_cache.py's norm_key() in the sibling DEKHO
// repo, so a query normalizes to "the same idea" of a cache key in both
// places even though the two are independent implementations.
export function normalizeQueryKey(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function filePathFor(query: string): string {
  const key = normalizeQueryKey(query)
  // The normalize step above already strips everything but [a-z0-9 ], so
  // swapping spaces for underscores can't produce '..' or '/' -- path.resolve
  // is cheap insurance on top of that, same reasoning as localPlaylistStore.ts.
  const filename = (key || 'empty').replace(/ /g, '_').slice(0, 150)
  return path.resolve(CACHE_DIR, `${filename}.json`)
}

/** Safe to call from anywhere, including api/*.ts in production -- pure read
 *  of a file that either doesn't exist or was committed with the deployment. */
export async function getCachedSearch(query: string): Promise<SearchCacheEntry | null> {
  try {
    const raw = await fs.readFile(filePathFor(query), 'utf-8')
    return JSON.parse(raw) as SearchCacheEntry
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/** Dev-only -- see the file header. Never import this from api/*.ts. */
export async function recordSearch(query: string, results: SearchResultItem[]): Promise<SearchCacheEntry> {
  await fs.mkdir(CACHE_DIR, { recursive: true })
  const entry: SearchCacheEntry = {
    query,
    searchedAt: new Date().toISOString(),
    results,
  }
  await fs.writeFile(filePathFor(query), JSON.stringify(entry, null, 2) + '\n', 'utf-8')
  return entry
}

/** One JSON file per query (not one big index) so committing a new batch of
 *  searches is a set of small, individually-reviewable diffs -- same
 *  reasoning as localPlaylistStore.ts using one file per playlist. */
export async function listCachedQueries(): Promise<string[]> {
  try {
    const files = await fs.readdir(CACHE_DIR)
    return files.filter((f) => f.endsWith('.json'))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}

function parseViewCount(raw: string | undefined): number {
  if (!raw) return 0
  const n = Number(raw.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * Scans every committed cache file (not just one query's own results) for
 * items whose title/channel/tags match any of the given keywords -- this is
 * "search into the cache first" as a real capability, not just "was this
 * exact query searched before": a taxonomy keyword like "Romance" or
 * "Hindi" may show up across dozens of different queries' cached results,
 * and this is what makes those all groupable without re-searching.
 *
 * Deduped by videoId (the same video legitimately turns up under several
 * different queries) and sorted by view count -- pure local read, safe
 * anywhere including api/*.ts in production, same as getCachedSearch.
 */
export async function searchCachedByKeywords(
  keywords: string[],
  limit = 25,
): Promise<SearchResultItem[]> {
  const terms = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean)
  if (terms.length === 0) return []

  const files = await listCachedQueries()
  const seen = new Set<string>()
  const matches: SearchResultItem[] = []

  for (const file of files) {
    let entry: SearchCacheEntry
    try {
      const raw = await fs.readFile(path.join(CACHE_DIR, file), 'utf-8')
      entry = JSON.parse(raw) as SearchCacheEntry
    } catch {
      continue
    }
    for (const item of entry.results ?? []) {
      if (!item.videoId || seen.has(item.videoId)) continue
      const haystack = [item.title, item.channel, ...(item.tags ?? [])].join(' ').toLowerCase()
      if (terms.some((t) => haystack.includes(t))) {
        seen.add(item.videoId)
        matches.push(item)
      }
    }
  }

  return matches.sort((a, b) => parseViewCount(b.viewCount) - parseViewCount(a.viewCount)).slice(0, limit)
}
