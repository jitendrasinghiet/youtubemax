# Search results cache

`server/searchCache.ts` persists every `/api/search` result to
`data/search-cache/<normalized-query>.json` — one file per query, committed
to the repo, so a query that's already been searched never needs to hit
YouTube again.

## Why

`server/search.ts` doesn't call an official, rate-published search
endpoint — it fetches `youtube.com/results` and parses the embedded
`ytInitialData` JSON, with a fallback to YouTube's internal Innertube
endpoint. There's no sanctioned bulk-search API to lean on, so the fewer
times a given query actually needs to be searched, the better — both for
reliability (scraping is inherently more fragile than an API) and for
being a considerate, low-volume caller of a surface that isn't built for
heavy automated use.

## How it's wired

Only `vite.config.ts`'s dev-only middleware touches the cache — same
isolation rule `server/localPlaylistStore.ts` already follows, for the
same reason: Vercel's deployed serverless functions (`api/*.ts`) run
against a **read-only** checkout at runtime, so writing a fresh cache
entry only makes sense in local dev, where a human is present to review
and commit the result.

- `getCachedSearch(query)` — pure read, safe to call from anywhere
  (including `api/*.ts` in production, since a committed JSON file ships
  with the deployment). **Not currently wired into `api/search.ts`** — the
  deployed endpoint still searches live every time. Wiring it in is a
  reasonable next step, but needs `vercel.json`'s `includeFiles` checked
  against a real deployment first, not assumed to work from local
  behavior alone.
- `recordSearch(query, results)` — writes a new cache file. **Dev-only.**
  Called from `vite.config.ts`'s `/api/search` handler after a live
  search, never from `api/*.ts`.

In dev, hitting `/api/search?q=...` checks the cache first and returns
`{ ..., fromCache: true, cachedAt }` on a hit, skipping the live fetch
entirely. Pass `&refresh=1` to force a live re-search (e.g. to refresh
stale view counts) — it overwrites the existing cache file rather than
leaving a stale duplicate.

## Verified

A real batch of 7 searches (`Chandrakanta 1994`, `Masha and the Bear`,
`Kota Factory`, `Finding Nemo 2003 official trailer`, `Ice Age 2002
official trailer`, `Batameez Dil`, `Sam Tinnesz Legends Are Made`) — run
for the sibling DEKHO project, which uses this repo for YouTube discovery
— all returned real results on the first call (`fromCache: false`), wrote
one JSON file each to `data/search-cache/`, and repeating the same query
afterward correctly returned `fromCache: true` with no new fetch. `npm run
test` (86 tests) still passes.

## `?discover=<query>` entry point

`src/App.tsx` reads a `discover` query param on mount and, if present,
pre-fills and auto-runs a Discovery search with it (same code path as
typing a query and hitting Search — `handleSearchFromDiscovery`), shown
in its own pinned section above the cache-backed feed that's always
loading underneath regardless (see "The default feed is the cache"
below). This is what the sibling DEKHO project's detail pane links to
for a title with no confirmed videoId yet,
so "search on YouTube" opens youtubemax's own richer results (trusted-
channel sorting, filters) instead of a plain `youtube.com/results` page.

```
http://localhost:5180/?discover=Aawarapan
```

Verified: navigating to that URL loads the app and shows "Found 6 videos"
for the query with no further interaction — confirmed against a real
ambiguous case from DEKHO's second search batch (`docs/STATUS.md` in that
repo), where multiple same-named tracks made an automatic pick unsafe;
this is exactly the manual-browse path for cases like that one. `npm run
test` (86 tests) still passes.

**Combines with `?videoId=` on the same URL.** `App.tsx`'s `popoutVideoId`
state was renamed `requestedVideoId` and made dual-purpose: when the
`popout` param is also set it still opens a separate window/tab exactly
as before, but a bare `?videoId=<id>` (no `popout`) now triggers inline
`runAnalysis()` playback on mount. Both mount effects — `discover`'s
search and `requestedVideoId`'s inline playback — are consolidated to run
together, so `?discover=<query>&videoId=<id>` searches *and* plays a
specific result inline from one link, rather than needing two separate
visits.

## The default feed is the cache, browsable and paginated

`server/searchCache.ts`'s `browseCache()` is the superset this app is
actually built on: given no `keywords`/`query`, it pages through
**every** cached result across every committed cache file (deduped by
videoId, sorted by view count); `keywords` (filter chips, OR'd together)
and `query` (the typed Discovery search box, AND'd word-by-word) each
narrow that same scan independently, on top of each other. Exposed at
`GET /api/search-cache`, accepting `keywords`, `query`, `offset`, and
`maxResults` — the response carries `{ results, total }` so the client
always knows whether there's more to page in. `src/lib/api.ts`'s
`browseCachedResults()` is the typed client wrapper.

**This is a real Vercel function** (`api/search-cache.ts`), not a
dev-only route — `browseCache()` only ever reads the committed
`data/search-cache/*.json` files, which ship with the deployment, so
it's exactly as safe in Vercel's read-only production functions as
`getCachedSearch()` already was. `vite.config.ts`'s dev middleware
handles the identical path (`/api/search-cache`) locally with the same
underlying call, so behavior doesn't diverge between `npm run dev` and
production. (This used to live at `/api/dev/search-cache`, dev-only by
convention — since the default discovery feed depends on it entirely,
that meant the feed silently rendered empty on Vercel until this was
moved to a real endpoint.)

`src/App.tsx` opens on this feed directly — **no live "trending" fetch on
mount anymore**. `cacheResults` pages in on load ("From your library"),
an `IntersectionObserver` sentinel past the last row calls
`loadMoreCache()` as the user scrolls near the bottom (a "Load more"
button is the no-JS/no-observer fallback in the same spot), and the
grid's own sort controls re-order whatever's been paged in so far — the
same infinite-scroll feel as opening YouTube itself, built entirely from
what's already local.

**Filters narrow this same feed — they don't bolt a lookup onto it.**
Toggling a filter chip re-fetches page 0 of `browseCache` with that
filter's keywords folded in (the heading switches to "Matching your
filters" and both the count and total shrink accordingly); clearing
filters re-fetches page 0 with no keywords, back to "From your library"
and the full total. A `cacheGenerationRef` counter discards any in-flight
fetch a newer filter change or page-load has since superseded, so a slow
response can't clobber a more recent one.

**A live search's results are shown separately, pinned above the cache
feed, not merged into it.** Submitting a search renders its own "Search
results for '<query>'" section with a "✕ Clear" dismiss control; the
cache feed underneath is untouched by it either way. This replaced an
earlier version of this behavior where a live search merged onto the
cache-derived listing (`mergeUniqueResults()`) — kept today only for
deduping pages *within* the cache feed as more of it loads in, not for
combining live and cached results into one list.

Verified live: default load showed "From your library — Showing 24 of
1297"; scrolling loaded more ("Showing 48 of 1297") with no duplicates;
toggling the "Hanuman Chalisa" evergreen filter narrowed it to "Matching
your filters — Showing 24 of 501"; clearing filters restored "From your
library — Showing 24 of 1297" (a fresh page 0, not the stale 48);
searching "Kesariya Brahmastra" opened a distinct "Search results for…"
section above the still-unchanged library feed, and "✕ Clear" removed
just that section.

## `dekho-*` playlists in `data/playlists/`

The sibling DEKHO project also writes real, native playlists here —
`dekho-movies.json`, `dekho-music.json`, etc., one per DEKHO content
bucket — via its own `scripts/sync_youtubemax_playlists.py`. These are
ordinary entries in `server/localPlaylistStore.ts`'s store (same shape as
anything created through this app's own UI), so `GET /api/dev/playlists`
lists them, they're editable/playable the same way, and this app doesn't
need DEKHO running at all to use them — the sync is one-way and
happens on DEKHO's side, on its own schedule. Don't hand-edit a `dekho-*`
playlist expecting the change to stick; DEKHO's next sync overwrites it
completely (see that project's `docs/STATUS.md`).

## Reused by DEKHO

The result shape matches `SearchResultItem` (`server/types.ts`)
field-for-field on purpose. The sibling `dekho` repo reads these committed
files directly (see its `docs/INGESTION.md`) to pick a confirmed videoId
per seed item — this repo doesn't know anything about DEKHO's entities,
it just makes its own search results reusable to anyone reading the
committed cache.

## What this doesn't do

- Doesn't expire or refresh entries automatically — a cached result is
  exactly what was true when it was searched (view counts drift; the
  video itself could be taken down). `&refresh=1` is manual, on purpose.
- Doesn't cache in production yet (see `getCachedSearch`'s note above).
- Doesn't dedupe near-identical queries (`"Ice Age"` and `"Ice Age 2002"`
  are two different cache files) — this mirrors normal search behavior
  (different queries can validly return different result sets), not a
  gap to fix.
