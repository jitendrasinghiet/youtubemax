# YouTubeMax — Status

Running log of real, verified work on this project — what changed, why,
and how it was checked. New entries go at the top. See
`docs/DELTA_REQUIREMENTS.md` for the filter/taxonomy-specific delta
tracker (a separate, narrower living document); this file is the general
one, in the same spirit as the sibling `dekho` project's own
`docs/STATUS.md`.

## Added: Media Session wiring for lock-screen controls and better Android background/locked-screen playback

User-reported directly: "check for audio only play from viewer in both
dekho/ytmax with background audio only playback on android mobile/
tablet even with app minimized or screen locked be better." Checked
both apps' actual state before changing anything:

- Neither app extracts or plays a raw audio-only stream, and neither
  should -- there is no legitimate way to pull a bare audio stream out
  of a YouTube video without violating YouTube's Terms of Service (the
  same constraint DEKHO's `lib/cast.ts` already documents for a
  different reason). Both apps only ever play back through YouTube's
  own iframe embed, which is the ToS-compliant surface.
- DEKHO already had real infrastructure for the "keeps playing in the
  background" half of this ask -- `lib/useMediaSession.ts` (wires
  `navigator.mediaSession` to give the OS a real now-playing surface)
  plus `FloatingPlayer.tsx` (a tray player that stays mounted and never
  pauses itself just because the tab loses focus). Its own docblock is
  already honest about the ceiling: actual background/lock-screen
  survival is governed by the browser/OS and by YouTube's own embedded
  player, which DEKHO's JS can't reach into (cross-origin iframe) or
  override.
- youtubemax had **none of this** -- no Media Session wiring at all,
  so Android's lock screen/notification showed no title, artwork, or
  play/pause/prev/next controls for whatever was playing, and the tab
  lacked the one concrete signal (an active media session on an
  audibly-playing tab) that Chrome uses to grant a persistent media
  notification and exempt a background tab from being frozen/killed.

Ported DEKHO's hook as `src/lib/useMediaSession.ts`, wired into the
main viewer in `App.tsx`: sets real metadata (title/channel/thumbnail)
from the already-fetched `AnalyzeResult`, and wires `previoustrack`/
`nexttrack` to the same `activePlaybackList` navigation the new
autoplay-next feature (below) uses, `stop` to closing the viewer.
`play`/`pause` needed one small addition to `VideoPlayer.tsx` --it
already had a one-way `pauseSignal` prop (an increment-to-fire counter
sending YouTube's `pauseVideo` postMessage command, originally built
for cross-window pause sync when popping into PiP) but nothing
symmetric for resuming; added a matching `playSignal` prop sending
`playVideo`, so the Media Session's `play` handler actually works
instead of only `pause` being wired.

youtubemax is already served as an installable standalone-display PWA
(`public/manifest.webmanifest`), which is the other prerequisite
commonly needed for Chrome on Android to treat backgrounded/locked-
screen audio playback as a first-class case rather than a plain
throttled tab -- no change needed there, it was already in place.

Verified live (Playwright): opened a video, confirmed
`navigator.mediaSession.metadata.title` matches the real video title
and `playbackState` is `'playing'`. Actual lock-screen behavior on a
physical Android device isn't something a headless browser can verify
directly -- this closes the gap that's actually under the app's
control (Media Session wiring, matching DEKHO), the remaining ceiling
(YouTube's own iframe backgrounding behavior) isn't something either
app can change.

## Added: autoplay-next and a cast/watch_videos link in the viewer, mirroring DEKHO

User-reported directly: "ytmax also should autoplay next items from
list, also give feature/option for cast/view similar to dekho." Neither
existed before -- the viewer only ever played one video and stopped
(outside of a `list=` playlist context, where YouTube's own embed
already auto-advances), and there was no way to send a sequence to a
TV/Chromecast.

**Autoplay next**: `VideoPlayer.tsx` now listens for YouTube's own
"ended" player state over its existing postMessage channel (`event:
'onStateChange', info: 0` -- the same undocumented-but-stable numeric
states the real IFrame Player API's `YT.PlayerState` enum exposes; this
embed never loads that JS API, so the ended-state check is duplicated
here rather than exposed by the SDK) and fires a new `onEnded` prop
once per video. Deliberately gated on `!playlistId`: when a `list=`
playlist is already driving playback, YouTube's own queue handles
advancing and a second, competing "next" trigger would race it.
`App.tsx` wires this to a new `playNextFromList()` that finds whichever
of `liveResults`/`cacheResults` the currently-playing video actually
came from (`activePlaybackList`, checking the pinned live section
first) and calls the existing `runAnalysis()` on the following item's
videoId (`lib/autoplay.ts`'s `nextResultVideoId`, forward-only -- no
wraparound, since these are loaded pages of search/cache results, not
a stable whole-library ordering like DEKHO's catalog). New "Autoplay
next" toggle in the settings dropdown, off by default (it changes what
plays without an explicit click), persisted to
`localStorage['youtubemax.autoplayNext']` (same pattern as
`VideoCard.tsx`'s existing mute preference and `searchSort.ts`'s sort
type).

**Cast/view**: ported DEKHO's `lib/cast.ts` almost directly --
`youtubeCastPlaylistUrl()` builds a `youtube.com/watch_videos?video_ids=...`
link (YouTube's own ad-hoc-playlist mechanism, no account needed)
starting at the current video and walking forward through the same
`activePlaybackList`, wrapping once. Same reasoning as DEKHO's version:
a single video already casts to a Chromecast/Android TV for free via
the iframe embed's native Cast icon, but nothing lets a third-party
sender command an active Cast receiver to advance to a *next* item, so
handing the whole sequence to YouTube's own site/app up front is the
only way sequential playback survives a cast session. Unlike DEKHO's
version there's no `hasConfirmedVideo`/`videoIdFor` translation step --
every `SearchResultItem` here is already a real, resolved video, so the
list is used as-is. New "Cast" link in the viewer header next to the
existing S/M/L/PiP/CC/speed/fullscreen controls, shown only when the
current video is actually part of a loaded list.

Verified live (Playwright): opened a video from the cache feed,
confirmed the new "Autoplay next" toggle appears in settings and its
on/off state persists to localStorage across the click, and confirmed
the new "Cast" link renders with a `watch_videos` URL listing 23 real
video ids starting from the one playing.

## Fixed: combining filters from different dimensions broadened results instead of narrowing them

User-reported: "check ytmax filters content relevance with matching
criterias behavior from dekho, seems relevance for content in ytmax
needs fix" -- asked to check the local cache-feed filter matching
against the sibling DEKHO project's own model, which is explicit:
`lib/filtering.ts`'s `applyFilters` there does "OR within a field, AND
across fields" (selecting Language:Hindi + Category:Comedy shows Hindi
Comedy, not everything that's either).

`browseCache()` (`server/searchCache.ts`) never had that distinction --
every selected filter chip, across every dimension, flattened into one
list and OR'd together regardless of where it came from (its own
docblock even said so explicitly: "OR'd together... same as picking
'Romance' or 'Hindi' has always meant"). Confirmed live before touching
anything: Language:"English" alone matched 1075 cached items,
Category:"Bhajan" alone matched 1109, and selecting *both together*
returned 2155 -- essentially their union, not a narrower "English-
language Bhajans" intersection. A filter UI combining two criteria is
expected to narrow, not broaden.

Changed `BrowseCacheOptions.keywords: string[]` to
`keywordGroups: string[][]` -- filter values grouped by dimension (two
Language chips stay OR'd with each other, but AND against a selected
Category chip), matching DEKHO's own semantics exactly. Added
`groupFilterValuesByDimension()` (`src/lib/searchFilters.ts`) to build
these groups from `selectedFilters` at both `App.tsx` call sites, a
shared `parseKeywordGroupsParam()` so the `|`-between-groups/`,`-
within-group wire encoding only has one parser (used by both
`api/search-cache.ts` production and `vite.config.ts`'s dev middleware,
kept in sync automatically instead of by hand). `getFacetCounts` (each
chip's own standalone "how many total" label) was already independent
of other selections and needed no change.

Verified at every layer: the same English/Bhajan combination now
returns 29 (a real intersection, not a sum) via direct curl, via the
production `api/search-cache.ts` handler invoked directly, and via the
dev middleware; added a dedicated regression test
(`searchCache.test.ts`, 12 tests now, all passing) asserting the
combined count can never exceed the smaller of the two individual
counts. Also confirmed live in the browser: selecting Language:English
correctly narrows the Category picker's own Evergreen combo list to
only English-compatible options (a separate, pre-existing feature that
was already working correctly and stayed unaffected by this fix).

## Production /api/search now checks the cache first; write path dedupes by videoId

User-reported: "keep ytmax cache updated with all those contents &
check/use existing cache first before search & post-search dedupe &
update back to cache too."

The "keep cache updated" and "write back" halves were already true for
local dev -- `vite.config.ts`'s dev-only middleware already checks
`getCachedSearch()` before ever hitting YouTube live, and writes a
fresh result back via `recordSearch()` on a miss (confirmed directly:
this session's own DEKHO-side work landed ~170 real cache files this
way, committed alongside this). What was missing: **`api/search.ts`,
the actual deployed Vercel function**, skipped the cache check entirely
and went straight to a live fetch on every single request, regardless
of whether the query was already sitting in the committed cache.

Reading the cache is a plain file read of something that ships with
the deployment -- safe on Vercel's read-only filesystem, unlike
writing a fresh entry (`server/searchCache.ts`'s own docstring already
says so: "safe to call from anywhere, including api/*.ts in
production"). Added the same cache-check-first logic the dev
middleware already had to the production handler; the write-back half
correctly stays dev-only, since Vercel's runtime filesystem genuinely
can't persist a new file. Verified directly (ran the handler function
itself against a real request/response pair): a previously-cached
query now returns in-process with `fromCache: true`, 20 results,
`cachedAt` set to the original search time -- no live fetch; a novel
query still correctly falls through to a real search.

**Post-search dedupe:** `recordSearch()` wrote whatever
`searchYouTubeVideos()` returned verbatim, with no de-duplication --
YouTube's own results page can legitimately list the same videoId
twice (a Short plus the regular listing, or a result matching more
than one of the page's internal sections), which could ride straight
into a committed cache file. Added a `dedupeByVideoId()` pass before
every write (keeps the first/highest-ranked occurrence). Existing
`searchCache.test.ts` suite (11 tests) still passes unchanged.

## Fixed floating viewer rendering off-screen on a fresh mobile load

User-reported: "ytmax mobile preview pane check visibility position for
fresh new load seems need fix."

Root cause: the viewer panel's initial `viewerPosition` (`App.tsx`)
computed `window.innerWidth - MID_VIEWER_WIDTH - VIEWER_MARGIN` with no
clamping -- `MID_VIEWER_WIDTH` is a fixed 432px, so on any viewport
narrower than ~448px (i.e. essentially every phone) this goes negative,
rendering the panel partly off-screen to the left. `clampViewerSize`/
`clampViewerPosition` already exist and are applied on every later
resize/drag/window-resize, just never to this initial computation --
so nothing corrected it until the panel was manually dragged, or a
prior session had already saved a (viewport-appropriate) position to
`sessionStorage`. A genuinely fresh visitor -- no saved session state --
hit the broken default every time.

Fixed by applying both existing clamp functions to the initial
`viewerSize`/`viewerPosition` state. Verified live (Playwright, iPhone
13 profile, fresh context with no storage): the viewer panel now
renders at `x: 16, width: 358` inside a 390px-wide viewport -- fully
on-screen on both axes, vs. the un-clamped `x: -58` it would have
computed before.

## 36 real stand-up comedy search-cache entries persisted (DEKHO's new Comedy content)

DEKHO added 36 new Comedy-type entries (stand-up specials/clips) from a
user-supplied list, after verifying every videoId against YouTube's
oEmbed first (22 of the original 61 supplied were dead links -- see
DEKHO's own `docs/STATUS.md` for the full verification writeup). For
the 36 that verified real, ran each through this app's own live
`/api/search` (not just oEmbed) to get real view counts/channels/tags
for DEKHO's catalog -- the dev server's existing write-on-miss caching
(`server/searchCache.ts`, wired through `vite.config.ts`'s dev-only
middleware) persisted the full result set for each query as a normal
side effect, no separate script needed. Committed those 36
`data/search-cache/*.json` files (plus 4 unrelated ones already sitting
uncommitted from earlier session work: Kota Factory/Mirzapur trailer
re-resolution for DEKHO's own dead-link fix, and two other queries from
earlier search-behavior testing). All are genuine, unedited `/api/search`
responses.

## 4 real YouTube playlists ingested (111 items) -- 7 of 11 given URLs came back 404

Given 11 real YouTube playlist URLs directly, asked to pull their
content into this app's own data (and the sibling DEKHO project's, see
its own `docs/STATUS.md`).

Fetched via the official Data API (`YOUTUBE_DATA_API_KEY`, already
configured) -- `playlists.list` for real names/channel, `playlistItems.list`
for items, `videos.list` for real view counts/durations. Of 11 URLs: 4
resolved (Bhakti/34 items, Energy/24, Old is Gold/27, Language of
Nothing/30 -- all one channel, "Wise Mind"), 7 returned 404. Most likely
private/unlisted playlists from the same account, not reachable by a
public API key without the owner's own OAuth login -- flagged plainly
rather than silently dropped.

Written to two places, matching how this app actually surfaces content:
- `data/playlists/*.json` (the dev-only local playlist manager, see
  `server/localPlaylistStore.ts`) -- one entry existed already under a
  placeholder label (`"Playlist PLaR8WFbIbbojeT3lPvQ66_7c_mOcjb7gH"`,
  pulled 2026-08-18 before this session ever ran) for what turned out to
  be "Energy" -- updated in place with the real name/channel instead of
  creating a duplicate. The other 3 written fresh, real names throughout
  ("use playlist names from YT response" was the explicit ask).
- `data/search-cache/*.json` (the production-facing default "From your
  library" feed, `server/searchCache.ts`) -- one file per playlist,
  keyed by its real title as the query. This is what actually makes the
  content discoverable in the deployed app, not just the dev tool.
  Verified live: `/api/search-cache?query=Hansraj%20Raghuwanshi` returns
  the new "Radhe Radhe" item alongside pre-existing Hansraj Raghuwanshi
  content, confirming it merged into the shared pool rather than sitting
  inert in its own file.

`npm test` (97/97) still passes.

## YouTube ToS notice added; a real compliance gap found and flagged, not silently patched

Asked to check YouTube/TMDb ToS and add required handling/credits ahead
of going public-facing. Added a straightforward piece (a ToS/Privacy
Policy notice + attribution in the settings dropdown, linking to
YouTube's actual Terms and Google's Privacy Policy, as required
wherever an app is built on YouTube data) -- but checked the actual data
sourcing first rather than treating this as just "add a footer," and
found something more serious that needs a real product decision, not a
code patch.

**`server/search.ts` -- the core search this whole app is built around --
does not use the official YouTube Data API.** It scrapes YouTube's own
search-results HTML page (`extractYtInitialData`/`collectFromInitialData`
parse the embedded `ytInitialData` JSON), and `server/constants.ts`'s own
comment says exactly what it's for: *"Shared constants for YouTube
scraping requests... update when YouTube changes its anti-bot behavior"*
-- rotating realistic browser user agents specifically to evade YouTube's
own bot detection (`proxy.ts`, `getBrowserHeaders`). YouTube's Terms of
Service prohibit accessing the service by automated means other than
its provided interfaces, and circumventing technical protections --
this is a genuine ToS risk if operated publicly at real scale, not a
cosmetic gap a credits notice fixes.

**Not everything is like this, checked precisely rather than assumed
uniform:** `enrichResultsWithYouTubeDataApi` (search.ts) and
`youtubePlaylists.ts` (playlist fetching) both already use the *official*
`googleapis.com/youtube/v3/*` endpoints with a real API key when
`YOUTUBE_DATA_API_KEY` is set -- fully compliant. It's specifically the
primary search-discovery path that scrapes.

**Deliberately not "fixed" here** -- migrating core search to the
official Data API is a real product/cost tradeoff, not a drop-in swap:
YouTube's `search.list` costs 100 quota units per call against a default
10,000 units/day free quota (roughly 100 searches/day before paying or
requesting a quota increase), a very different constraint than the
current unlimited scraping-based search. That's a decision for whoever
owns this product's direction, not something to silently rip out and
replace. Flagging it plainly is the actual deliverable here.

## Sort order now survives a refresh too

Reported directly, alongside DEKHO's own filters-not-persisting fix
(see its `docs/STATUS.md`): `selectedFilters` already persisted here
(`searchFilters.ts`'s `loadStoredFilters`/`persistFilters`), but
`searchSortType` didn't -- reloading always reset back to
"Recommended" regardless of what was picked. Same `localStorage`
pattern, colocated with the type definition (`searchSort.ts`'s new
`loadStoredSortType`/`persistSortType`) the same way the filters helpers
sit next to `SelectedFilter`. Verified live: picked "Newest," reloaded,
button still shows selected. `npx tsc --noEmit && npm run build` clean;
`npm test` 97/97.

## Search: a selected language filter now reaches YouTube as a real locale signal, and category chips carry their parent group as extra disambiguating context

Asked directly for two related improvements: pass the selected language
filter into search (not just as one of several free-text keywords), and
use more context from the taxonomy ("master data") for disambiguation.

**Language filter -> real `hl`/`gl` signal.** Checked first: a selected
language chip's own value (e.g. "Hindi") was already being folded into
the search query text (`searchFilters.ts`'s `buildEffectiveQuery`,
pre-existing), but the actual search functions
(`server/search.ts`'s `searchViaResultsUrl`/`searchViaInnertube`)
hardcoded `hl: 'en', gl: 'US'` on every request regardless -- a real,
concrete gap, not something already covered by the keyword. Threaded an
optional `SearchLocale { hl, gl }` through the whole chain: `server/
search.ts`'s functions -> `api/search.ts` (production) and
`vite.config.ts`'s dev middleware (both validate `hl`/`gl` as short
alnum-only codes before they reach an outbound request) -> `src/lib/
api.ts`'s `searchVideos` -> `App.tsx`'s search handler. New `src/lib/
searchLocale.ts` maps each of the 15 language filter labels to a real
`(hl, gl)` pair (`gl: 'IN'` for every Indian-language entry; Haryanvi/
Bhojpuri have no YouTube-recognized `hl` code of their own, so they fall
back to Hindi's -- `gl: 'IN'` is the stronger, always-applicable half of
the signal regardless). Backward compatible: omitted when no language
filter is selected, verified live both ways (`hl=hi&gl=IN` present with
Hindi selected, absent without).

**Category chips now also carry their parent group's own label.**
Selecting a Category item under a group (e.g. "Bhajan" under
"Devotional & Family") previously only contributed that one leaf term;
`buildEffectiveQuery` now also includes the group's own display label
(deduped across multiple chips sharing a group) -- extra taxonomy
context for disambiguation, pulled from the same structured data driving
the filter menu itself, not guessed. Deliberately *not* extended to the
separate local-cache-browsing keyword path (`App.tsx`'s two
`browseCachedResults` call sites) -- that mechanism has an explicit,
documented invariant that a filter chip's displayed count must never
disagree with what selecting it actually returns, and widening its
keyword set without also touching the parallel facet-count computation
would risk breaking that.

Caught a real test regression from the `searchYouTubeVideos` signature
change (now takes an optional third `locale` argument) -- three existing
`api/search.test.ts` assertions expected the old 2-argument call
exactly; updated them to match the real new contract instead of
suppressing the argument, and added two new tests covering locale
passthrough (valid `hl`/`gl` accepted) and validation (malformed codes
ignored). `npx tsc --noEmit && npm run build` clean; `npm test` 99/99
(97 before, +2 new).

## Default viewer changed from docked-top to a floating M-size panel, bottom-right

Reported directly. Previously the *first* video played in a session
opened as a full-width panel docked to the top of the page (the
original "like YouTube's own mobile watch page" design, see the viewer-
redesign entry below); asked to change the default to the existing
floating window instead -- M size, bottom-right corner -- while keeping
top/dock fully available as something the user picks, not the default.

`viewerMode`'s initial state changed `'top' -> 'floating'`; nothing else
needed touching, since `viewerPosition`'s and `viewerSizePreset`'s own
existing defaults already computed a bottom-right, M-size window (they
just weren't being *used* on a fresh session because mode defaulted to
`'top'` first). The dock button and drag-to-top gesture both still work
exactly as before. Also closed a real gap while in this code: the
existing `sessionStorage`-backed "remember what the user set" restore
only ever handled `mode === 'floating'` -- a user who explicitly docked
to top had that choice silently dropped on the next reload in the same
session. Now restores `'top'` the same way, so "stays as per user pref"
holds for both states symmetrically, not just floating position.

Verified live: fresh session, played a video, got a 432x312 (M) panel
at the viewport's bottom-right corner with results still visible behind
it -- not the old full-width top bar. `npx tsc --noEmit && npm run
build` clean; `npm test` 97/97.

## Rate limiting added to the public API routes -- crawler/abuse protection parity with DEKHO

Asked directly to check whether the sibling DEKHO project's crawler/
scraping defenses apply here too. Checked DEKHO's own mechanism first
(its `docs/STATUS.md`): it obfuscates YouTube video ids inside a static
`entities.json` file it ships to every visitor, so a script can't just
fetch that one URL and bulk-harvest thousands of real ids. That specific
technique doesn't translate here -- youtubemax has no equivalent static
bulk-data file to protect; it proxies live, per-query YouTube requests
instead (`api/search.ts`, `api/suggest.ts`, `api/analyze.ts`,
`api/playlist.ts`). Checked those directly rather than assuming parity
was unnecessary: zero auth, zero rate limiting, callable by anything
directly, not just this app's own UI -- the real equivalent risk is
someone using this deployment as a free, anonymous YouTube-scraping
proxy at unlimited volume, `api/analyze.ts` especially (fetches a
transcript, generates a summary, and builds chapters, all per call).

New `server/rateLimit.ts`: a per-IP fixed-window limiter (`x-forwarded-
for`, Vercel sets this), wired into all four live-YouTube-touching
routes -- 30 req/60s for search and suggest, 20/60s for playlist, a
stricter 10/60s for analyze given its real cost per call.
`api/search-cache.ts` deliberately left alone -- it's a pure read of
data already committed to the deployment, not a live YouTube fetch, so
it doesn't carry the same abuse cost.

Stated plainly rather than glossed over: this is in-memory, best-effort.
Vercel serverless functions don't guarantee one persistent warm
instance -- a cold start clears the counters, and concurrent
regions/instances each keep their own. It meaningfully throttles a
single naive script hammering one warm instance; it is not a hard
guarantee against a determined or distributed abuser. Real hardening
would need shared state (Vercel KV / Upstash Redis or similar) -- not
added here since that's a new paid dependency/infra decision, not one to
make unilaterally.

Caught a real bug via the existing test suite before shipping: the first
version's `clientIp()` read `req.headers['x-forwarded-for']`
unconditionally, which crashed every `api/search.test.ts`/
`api/analyze.test.ts` case (their handler mocks construct a bare
`{ method, query }` object with no `headers`/`socket` at all) --
`npm test` went from 9 failing to all 97 passing after guarding both
reads with `?.`. Also verified the limiter's own logic directly (not
just via the mocked route tests): 35 calls against a 30/60s limit
allowed exactly 30 and blocked 5. The local dev server (`npm run dev`)
uses a separate `configureServer` middleware implementation for these
same routes (`vite.config.ts`, its own dev-only equivalent of the
`api/*.ts` Vercel functions) -- rate limiting only takes effect in the
actual deployed app, not local dev, which is why a live `curl` loop
against the dev server doesn't show 429s; that's the existing dev/prod
split, not a gap in this change. `npx tsc --noEmit && npm run build`
clean.

## Sort row decluttered (Trusted channels/Safer picks/Longest hidden); Kids content no longer floods general results

Two small reports, both scoped to a single file each.

**Three sort options hidden from the results sort row.** Reported
directly: "Longest", "Safer picks", "Trusted channels" were clutter.
`SearchResultsGrid.tsx`'s `SORT_OPTIONS` trimmed to Recommended /
Relevance / Newest / Most viewed; the underlying sort logic
(`searchSort.ts`'s `channelTrust`/`safety`/`duration` cases) is untouched,
so restoring any of them later is a one-line uncomment, not new work.

**Kids content (YouTube's own `status.madeForKids` flag) was flooding
general/mixed results.** Same underlying shape as DEKHO's own Kids-flood
report (see its `docs/STATUS.md`): Kids channels routinely post huge view
counts (nursery rhymes in the billions), so any popularity-weighted sort
piles them at the front. New `declutterMadeForKids()` (`lib/searchSort.ts`)
spreads Kids-flagged results to at most one in every 12 slots instead of
letting them cluster -- nothing removed, same approach as DEKHO's
`declucterKids`. Skipped entirely via `hasKidsFilterActive()` once the
user has explicitly picked a Kids/Rhymes filter chip (checks selected
filter labels for `/kids|rhyme/i`), since spreading out the very content
someone asked for would defeat the point. Wired into both the cached
("From your library") and live-search result lists in `App.tsx`.
`npx tsc --noEmit && npm run build` clean.

## Docked top panel's dead black space trimmed to fit the video; settings dropdown no longer hidden behind the search bar on mobile

Two follow-up reports on the viewer redesign below, both root-caused and
verified live across desktop/tablet/mobile viewports.

**Docked top panel left growing unused black space below the video as
the viewport narrowed** -- reported directly, with tablet and mobile
both called out. `TOP_PANEL_HEIGHT` was a fixed `min(58vh, 620px)`,
disconnected from the video's own real rendered height: the video is
100%-width/16:9, so its actual height shrinks a lot faster than `58vh`
does as the viewport narrows. Measured live before fixing: 115px of
dead space at tablet width (820px), 226px at mobile width (390px).
Replaced with `min(calc(100vw * 9 / 16 + 64px), 70vh)` -- `100vw * 9 /
16` is the video's real rendered height at any width, `+64px` covers
the header row and the scrollable body's own small padding, and the
`min(..., 70vh)` cap still applies on a short/desktop-ish window where
the calc() value would otherwise exceed the viewport (the video
scrolls internally there, same as before). Verified live: dead space
now 21px on tablet, 20px on mobile -- both just residual layout
padding, not a regression.

**Settings dropdown rendered behind the search bar and result cards on
mobile.** Reported directly. Confirmed live with a screenshot taken
*before* any video was playing (to separate this from the viewer
panel): the dropdown was there, but the sticky search/filter bar and
the video cards below it painted on top of it. Root cause: the
dropdown (`z-30`) and the sticky search bar (`z-30`, `App.tsx`) are
siblings in the same stacking context, and CSS breaks z-index ties by
DOM order -- the search bar comes later in the tree, so it always won
regardless of which element the user had actually just opened. Fixed
by bumping the dropdown to `z-50`, strictly above every other layered
element on the page (sticky bar and scroll-top button at `z-30`/`z-40`,
the docked/floating viewer panel at `z-40`). Verified live both with no
video playing and with a video docked at top -- the full dropdown now
paints cleanly on top in both cases.

## Viewer redesign: docked top panel (initial view) → drag-to-detach floating window, position persists across plays

Asked directly to make the in-page video viewer's UX closer to real
YouTube's own mobile pattern: the *first* time a video plays it should
be a full-width panel docked to the top of the page (search results
scrollable beneath it, not hidden behind a floating overlay), and
dragging it down should detach it into the existing small draggable
window — which should then **stay** wherever the user left it (mode and
position both) across every subsequent video picked from the results
grid, not reset every time, until the user explicitly drags/swipes it
back up to the top edge (or clicks a new explicit dock button).

**Root cause of the reported "opens at a fixed position every time" complaint**:
`handleSelectSearchResult` recomputed a bottom-right `viewerPosition`
unconditionally on every single video selection, discarding whatever
position the user had actually dragged the window to. Removed entirely —
selecting a new video now leaves `viewerMode`/`viewerPosition` exactly as
they were.

**New `viewerMode: 'top' | 'floating'` state**, defaulting to `'top'` —
with nothing in `sessionStorage` yet (a session's first video), that
default alone delivers "top panel wide when user plays for first time"
with no extra bookkeeping. Only changes via:
- Dragging the viewer's own header down past a threshold (`TOP_TO_FLOAT_DRAG_THRESHOLD`,
  56px) — detaches from directly under the pointer's *current* position
  (not the drag's start), so the window doesn't visually jump the instant
  it crosses the threshold.
- Dragging a floating window's header back up until release happens
  within `FLOAT_TO_TOP_DROP_ZONE` (64px) of the top edge — redocks it.
- A new explicit "⤒ Dock to top" button (visible only while floating) —
  the click-instead-of-gesture equivalent, for anyone who wouldn't
  discover the drag-up affordance on their own.
- Clicking any of the existing S/M/L size presets while docked — a
  specific pixel size is a floating-window concept, so picking one while
  docked undocks it there instead of doing nothing useful.

Both the docked top panel (`position: fixed; inset-x-0; top-0`, height
`min(58vh, 620px)`) and the existing floating window share the exact
same header/drag-handle/`<VideoPlayer>` JSX — only the outer container's
class/style branch on `viewerMode`, so none of the existing
resize/PiP/captions/playback-rate/fullscreen logic needed touching. The
main content column gets `paddingTop: TOP_PANEL_HEIGHT` while docked, so
the header and results grid are actually pushed down out from under the
fixed top panel rather than hidden behind it — this is what makes "list
below to scroll" literally true instead of the grid just happening to be
visible around the edges of an overlay.

`sessionStorage`'s existing `VIEWER_PREFS_KEY` blob (already used for
size preset / captions / playback rate) now also carries `mode` and
(only while floating) `position`, so a reload mid-session restores
whichever state the user was last in, not just the size preset.

**Verified live**, `npm run dev` + a scripted Chromium pass: opening the
first video confirmed a full-width (1280px in a 1280px viewport),
top-pinned (`y≈0`) panel with the results grid visible beneath it;
dragging the header down 300px+ detached it into the floating window at
the drop position; selecting a *second, different* video from the grid
while floating left the window at the exact same `{x, y}` coordinates
(the specific bug being fixed); clicking "Dock to top" returned it to
the full-width top panel. `npx tsc -b` and `npm run build` both clean.

## Google Cast — investigated, not built as a custom integration

Asked (from the sibling `dekho` project, which embeds this same kind of
YouTube iframe) for a "cast to another device" option matching real
YouTube's own cast button, and whether the same could extend here.

**What's actually available, and why nothing new was built**: a YouTube
iframe embed (`<VideoPlayer>` here, DEKHO's own embed the same way)
already shows YouTube's own native Cast icon in its player chrome when
the browser/network environment supports it — this is Google's own,
already-built solution, not something a parent page enables or needs to
add code for. What a *third-party* site cannot legitimately do is
independently trigger a cast session to the dedicated "YouTube" receiver
app on a Chromecast/Google TV device from its own code — that pairing is
Google's own private integration between youtube.com and its Cast
receiver, not a documented, supported capability of the public Cast Web
Sender SDK for arbitrary senders. The SDK's actual supported path (the
default media receiver, or a custom receiver you host) requires a direct
media URL to cast, which doesn't exist here — extracting one from a
YouTube video id would mean scraping/downloading YouTube's actual media
streams, directly against this project's own "no unofficial scraping of
YouTube's non-public surfaces" stance.

Reasonable fallback that already works today, zero code changes: Chrome's
own browser-level "Cast…" (right-click, or the toolbar/menu Cast icon)
casts the whole tab, video included — less elegant than YouTube's own
native per-video cast (mirrors the tab rather than streaming just the
video efficiently), but genuinely available on any page, this one
included, with nothing to build or maintain.

Not revisited unless a real, documented, supported path for third-party
YouTube-video casting surfaces later.
