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
typing a query and hitting Search — `handleSearchFromDiscovery`), instead
of the usual default "trending" load. This is what the sibling DEKHO
project's detail pane links to for a title with no confirmed videoId yet,
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

## Cache-first filter lookup, and merged (not replaced) results

`server/searchCache.ts`'s `searchCachedByKeywords()` scans **every**
committed cache file (not just one query's own results) for items whose
title/channel/tags match given keywords — deduped by videoId, sorted by
view count. Exposed at `GET /api/dev/search-cache?keywords=a,b,c` and
`src/lib/api.ts`'s `searchCachedLocally()`.

`src/App.tsx` calls this the moment a filter chip is toggled — before,
and regardless of whether, an actual search ever runs. Toggling "Romance"
or "Hindi" shows whatever's already cached across every prior search,
instantly, with no YouTube fetch. A live search submitted afterward
**merges** its results onto whatever's already showing
(`mergeUniqueResults()`, deduped by videoId) instead of replacing the
list — filters and search augment the same local listing, they don't
each reset it.

Verified live: toggling the "Hanuman Chalisa" evergreen filter (5 chips:
category/language/era/audience/vibe) took the default trending view from
23 → 48 videos purely from cache, no fetch; submitting "Sai Baba" as a
live search afterward took it to 67 — the live results added onto the
cache-derived 48, not replacing them.

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
