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

export interface BrowseCacheOptions {
  /** Filter-chip values -- OR'd together (any one matching is enough), same
   *  as picking "Romance" or "Hindi" has always meant. Empty/omitted means
   *  "no filter constraint," not "match nothing." */
  keywords?: string[]
  /** The Discovery search box's typed text, matched independently of
   *  `keywords` and AND'd against it (both constraints must hold) -- every
   *  whitespace-separated word must appear somewhere in the item, same as
   *  a normal "search within a list" box, not a single literal phrase. */
  query?: string
  offset?: number
  limit?: number
}

export interface BrowseCacheResult {
  results: SearchResultItem[]
  /** Total matches available (pre-pagination) -- lets the client know
   *  whether there's more to page in without a second round-trip. */
  total: number
}

/**
 * The default-view feed: every cached result across every committed
 * search-cache file, deduped by videoId, sorted by view count desc,
 * paginated via offset/limit for infinite scroll. `keywords` (filter
 * chips) and `query` (the typed search box) each narrow it further, on
 * top of each other -- this is what lets the app open on a YouTube-
 * homepage-style feed built entirely from what's already local, no live
 * fetch, with both filters and typing narrowing the *same* feed rather
 * than replacing it with a different code path -- see App.tsx's
 * cache-feed effect.
 */
export async function browseCache(options: BrowseCacheOptions = {}): Promise<BrowseCacheResult> {
  const keywordTerms = (options.keywords ?? []).map((k) => k.toLowerCase().trim()).filter(Boolean)
  const queryWords = (options.query ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean)
  const offset = Math.max(0, options.offset ?? 0)
  const limit = Math.max(1, options.limit ?? 24)

  const files = await listCachedQueries()
  const seen = new Set<string>()
  const all: SearchResultItem[] = []

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
      if (keywordTerms.length > 0 || queryWords.length > 0) {
        const haystack = [item.title, item.channel, ...(item.tags ?? [])].join(' ').toLowerCase()
        if (keywordTerms.length > 0 && !keywordTerms.some((t) => haystack.includes(t))) continue
        if (queryWords.length > 0 && !queryWords.every((w) => haystack.includes(w))) continue
      }
      seen.add(item.videoId)
      all.push(item)
    }
  }

  all.sort((a, b) => parseViewCount(b.viewCount) - parseViewCount(a.viewCount))
  return { results: all.slice(offset, offset + limit), total: all.length }
}
