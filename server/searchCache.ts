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

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = new Array(n + 1)
  for (let j = 0; j <= n; j++) dp[j] = j
  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, dp[j], dp[j - 1])
      prevDiag = tmp
    }
  }
  return dp[n]
}

// A typed filter/query word should still match a close variant of what's
// actually in the cache -- a typo ("aashiqi" vs "aashiqui"), a plural or
// suffix difference ("rhyme" vs "rhymes"), a partial word still being
// typed ("kahani" vs "kahaniyan") -- not just a literal substring. The
// distance threshold scales with word length so short words (where any
// edit is a large relative change, and false-positive risk is highest --
// "cat" vs "car") stay strict rather than fuzzy-matching everything.
export function wordsAreSimilar(a: string, b: string): boolean {
  if (a === b) return true
  // A single- or double-character word (e.g. "z" from "Z for Zebra", "3d")
  // is a trivial startsWith() prefix of almost anything sharing its first
  // letter -- too short for "partial word" or "typo" to mean anything, so
  // gate both checks below on a minimum length instead of just the longer
  // word (a length-23 nonsense term still spuriously "starts with" a
  // real 1-char token otherwise).
  const minLen = Math.min(a.length, b.length)
  if (minLen < 3) return false
  // A real typo/plural/partial-typing variant overwhelmingly keeps the
  // first letter -- this is what makes the full O(n*m) Levenshtein scan
  // below affordable at cache-wide scale (thousands of results, tens of
  // words each, every query keystroke): almost every comparison exits
  // here instead of running the DP.
  if (a[0] !== b[0]) return false
  if (a.startsWith(b) || b.startsWith(a)) return true
  const maxLen = Math.max(a.length, b.length)
  if (maxLen < 4) return false
  const threshold = maxLen <= 6 ? 1 : 2
  return levenshtein(a, b) <= threshold
}

export interface BrowseCacheOptions {
  /** Filter-chip values -- OR'd together (any one matching is enough), same
   *  as picking "Romance" or "Hindi" has always meant. Empty/omitted means
   *  "no filter constraint," not "match nothing." Matched as a literal
   *  phrase only, the same rule `getFacetCounts` uses -- these are curated
   *  taxonomy terms, not typed text, so the chip's displayed count and
   *  what selecting it actually returns can never disagree. No
   *  `wordsAreSimilar` fuzzy fallback here (see the note in `query` below
   *  for why that matters: a multi-word term like "Hindi Songs" checked
   *  word-by-word against wordsAreSimilar previously matched almost
   *  anything merely containing "Hindi"). */
  keywords?: string[]
  /** The Discovery search box's typed text, matched independently of
   *  `keywords` and AND'd against it (both constraints must hold) -- every
   *  whitespace-separated word must appear somewhere in the item, same as
   *  a normal "search within a list" box, not a single literal phrase. A
   *  word that isn't a literal substring can still match a close variant
   *  (typo, plural, partial word) via `wordsAreSimilar` -- appropriate
   *  here since this is genuinely user-typed text, unlike `keywords`.
   *  A result reached only through this fuzzy fallback is ranked below
   *  every literal match (see `browseCache`'s tiered sort), not mixed in
   *  by view count alone. */
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
// Shared by browseCache and getFacetCounts -- both need "every unique
// cached item, across every committed file" as their starting point; this
// is the ~1-1.5s-at-current-cache-size file-read cost documented on
// browseCache below, factored out so it isn't duplicated.
let allResultsCache: { items: SearchResultItem[]; loadedAt: number } | null = null
const ALL_RESULTS_TTL_MS = 60_000

async function loadAllUniqueResults(): Promise<SearchResultItem[]> {
  if (allResultsCache && Date.now() - allResultsCache.loadedAt < ALL_RESULTS_TTL_MS) {
    return allResultsCache.items
  }
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
      seen.add(item.videoId)
      all.push(item)
    }
  }
  allResultsCache = { items: all, loadedAt: Date.now() }
  return all
}

export async function browseCache(options: BrowseCacheOptions = {}): Promise<BrowseCacheResult> {
  const keywordTerms = (options.keywords ?? []).map((k) => k.toLowerCase().trim()).filter(Boolean)
  const queryWords = (options.query ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean)
  const offset = Math.max(0, options.offset ?? 0)
  const limit = Math.max(1, options.limit ?? 24)

  const items = await loadAllUniqueResults()
  // { item, tier }: tier 0 = every matched term was a literal substring,
  // tier 1 = at least one query word only matched via wordsAreSimilar's
  // typo/plural tolerance. Sorted tier-first so a perfect match always
  // outranks a merely-similar one, view count only breaking ties within
  // the same tier -- previously a popular fuzzy near-miss could outrank
  // an exact but less-viewed match.
  const scored: { item: SearchResultItem; tier: number }[] = []

  for (const item of items) {
    let tier = 0
    if (keywordTerms.length > 0 || queryWords.length > 0) {
      const haystack = [item.title, item.channel, ...(item.tags ?? [])].join(' ').toLowerCase()
      // Filter-chip values are curated taxonomy terms (src/lib/
      // filterTaxonomy.ts), not typed text -- matched as a literal
      // phrase only, deliberately the same rule getFacetCounts uses, so
      // a chip's displayed count and what selecting it actually returns
      // can never disagree (verified: "Hindi Songs" previously showed
      // 859 but returned 2,569 -- wordsAreSimilar comparing the whole
      // phrase against a single haystack word let it match anything
      // merely containing "Hindi"). No fuzzy fallback here.
      if (keywordTerms.length > 0 && !keywordTerms.some((t) => haystack.includes(t))) continue

      if (queryWords.length > 0) {
        const haystackWords = haystack.split(/\s+/).filter(Boolean)
        let matchedAll = true
        for (const w of queryWords) {
          if (haystack.includes(w)) continue
          if (haystackWords.some((hw) => wordsAreSimilar(w, hw))) {
            tier = 1
            continue
          }
          matchedAll = false
          break
        }
        if (!matchedAll) continue
      }
    }
    scored.push({ item, tier })
  }

  scored.sort((a, b) => a.tier - b.tier || parseViewCount(b.item.viewCount) - parseViewCount(a.item.viewCount))
  const all = scored.map((s) => s.item)
  return { results: all.slice(offset, offset + limit), total: all.length }
}

// Facet counts: "how many cached videos actually match each filter chip,"
// so the FilterMenu can show "Romance (23)" instead of a chip that might
// filter down to zero. Deliberately literal-substring matching only, not
// wordsAreSimilar's typo/fuzzy tolerance -- these are curated taxonomy
// terms (server/../src/lib/filterTaxonomy.ts), not user-typed text, and a
// literal count is both faster (no per-term word-by-word fallback across
// ~7,600 cached items) and less surprising (a chip count shouldn't include
// a fuzzy near-miss the user never gets to see explained). Memoized
// alongside loadAllUniqueResults's own TTL, keyed by the exact term list,
// so re-opening the filter menu without new cache data is instant.
let facetCountsCache: { key: string; counts: Record<string, number>; loadedAt: number } | null = null

export async function getFacetCounts(terms: string[]): Promise<Record<string, number>> {
  const uniqueTerms = Array.from(new Set(terms.map((t) => t.trim()).filter(Boolean)))
  const key = uniqueTerms.slice().sort().join(' ')
  if (facetCountsCache && facetCountsCache.key === key && Date.now() - facetCountsCache.loadedAt < ALL_RESULTS_TTL_MS) {
    return facetCountsCache.counts
  }

  const items = await loadAllUniqueResults()
  const lowerTerms = uniqueTerms.map((t) => t.toLowerCase())
  const counts: Record<string, number> = {}
  for (const term of uniqueTerms) counts[term] = 0

  for (const item of items) {
    const haystack = [item.title, item.channel, ...(item.tags ?? [])].join(' ').toLowerCase()
    for (let i = 0; i < lowerTerms.length; i++) {
      if (haystack.includes(lowerTerms[i])) counts[uniqueTerms[i]]++
    }
  }

  facetCountsCache = { key, counts, loadedAt: Date.now() }
  return counts
}
