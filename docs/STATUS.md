# YouTubeMax — Status

Running log of real, verified work on this project — what changed, why,
and how it was checked. New entries go at the top. See
`docs/DELTA_REQUIREMENTS.md` for the filter/taxonomy-specific delta
tracker (a separate, narrower living document); this file is the general
one, in the same spirit as the sibling `dekho` project's own
`docs/STATUS.md`.

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
