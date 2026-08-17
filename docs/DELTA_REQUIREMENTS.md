# Discovery Taxonomy — Delta Requirements & Action Items

Status: living document. Source of truth for the gap between the current
filter system (`src/lib/filterTaxonomy.ts`, `src/lib/searchFilters.ts`,
`src/components/FilterMenu.tsx`) and the structured-discovery product
direction described in the YouTubeMax architecture spec and the
topic/intent catalog proposal. Update this file whenever an item below is
implemented, deferred, or re-scoped — it should always reflect the current
delta, not a historical log.

Each item has a status tag:

- `[ ] TODO` — not started
- `[~] IN PROGRESS`
- `[x] DONE` — implemented, dated
- `[!] BLOCKED` — needs a decision before work can start
- `[»] DEFERRED` — intentionally not being built yet, with a reason

---

## Priority 1 — Evergreen combos (one-tap pre-built searches)

**[x] DONE (2026-08-13).** The single highest-ROI item identified across
the whole delta review. Implemented as a new `evergreen` group inside the
`category` dimension, functionally different from every other group:

- Selecting an Evergreen item back-fills any **currently empty** filter
  dimensions with that item's tagged values (language / category / audience
  / channel), plus adds the item's own literal search phrase as a chip.
  Dimensions the user has already filled are left alone — their explicit
  choice is authoritative and is never overwritten.
- The Evergreen grid itself is filtered by whatever is already
  selected elsewhere: an item is eligible only if, for every dimension it
  carries a tag in, that tag is either absent (agnostic) or overlaps the
  current selection. A conflicting tag makes the item disappear from the
  grid rather than showing a dead/disabled card.
- Removing the auto-added chips afterward does **not** cascade back to
  deselect the originating Evergreen item — the combo chip and its
  back-filled chips are independent once created, so partial edits are
  possible ("keep the combo but swap the language").
- This makes Audience a **hard eligibility filter inside Evergreen only**
  — an intentional, documented exception to Audience being a soft ranking
  signal everywhere else in the product (see Priority 5). If that
  everywhere-else behavior changes, Evergreen's eligibility rule should be
  re-reviewed alongside it.
- Item set is sourced from Google's *India Year in Search 2025* and
  *YouTube India 2025 Trends* reports, evergreen tier only (trending/
  time-sensitive items like IPL, Gemini, Saiyaara were explicitly excluded
  — see Priority 8).
- Two combos from the original research ("KL Bro Biju Rithvik",
  "MrBeast Hindi") were dropped rather than added with no tags, because
  neither exists in the Channel list yet — an untagged combo can never
  surface contextually in a tag-overlap system, so it would be dead
  weight. Revisit if/when those channels are added (see Priority 9).

Files: `src/lib/filterTaxonomy.ts` (new `evergreen` group + tag metadata),
`src/lib/searchFilters.ts` (eligibility + back-fill logic).

---

## Priority 2 — Audience-first dimension ordering

**[x] DONE (2026-08-13).** Trivial reorder of the dimension rail from
`[language, category, audience, channel]` to
`[audience, category, language, channel]`. No logic change — just makes
the UI read "who → what" instead of four equal-weight tabs, closer to the
funnel model the architecture spec describes (Audience → Category → Topic
→ Intent → Format → Language) without requiring the funnel itself to be
built yet.

File: `src/components/FilterMenu.tsx` (`DIMENSION_ORDER` constant).

---

## Priority 3 — Global Intent dimension

**[ ] TODO.** Doesn't exist today. Both source documents call this out as
a major differentiator (query modifiers like Latest / Trending / Learn /
How-to / Best / Live / Explained, applied across every category rather
than duplicated per-topic).

Proposed shape: a 5th flat dimension, ~12–15 items, same
`FilterItem { label, value?, icon }` pattern already used everywhere else.
No taxonomy restructuring required — purely additive.

Blocked on: nothing technically. Sequencing decision only (do this before
or after Priority 4).

---

## Priority 4 — Cap visible items per step / progressive disclosure

**[ ] TODO.** Education alone renders 31 items in one grid; several other
groups are already large after the Entertainment/Lifestyle merges. Both
source documents recommend showing ~8–20 relevant choices per step, not
the full set.

Proposed approach: show a curated "top N" per group by default (already
partially true via group tabs) with an explicit "show all" expand,
rather than a further audience/intent-based narrowing (which would
require Priority 3 to exist first for Intent-based narrowing to make
sense).

---

## Priority 5 — Audience: hard filter vs. soft ranking signal (general case)

**[!] BLOCKED — partially resolved.** The topic/intent catalog document
explicitly argues Audience/Gender should be a **soft ranking signal**, not
a hard filter — "someone selecting 'female' should still see cricket."

Resolved scope: **Evergreen eligibility** now treats Audience as a hard
filter by design (see Priority 1) — this was an explicit, confirmed
decision for that one sub-system.

Still open: everywhere else in the app, Audience continues to be injected
as a literal term into the search query string via
`buildEffectiveQuery` (`src/lib/searchFilters.ts`), which is neither a
hard filter nor a pure ranking signal — it's a third behavior (literal
query augmentation) that doesn't match either option originally proposed.
Needs an explicit decision: keep literal query injection, switch to a
non-literal ranking/re-order signal, or something else. Do not change
silently.

---

## Priority 6 — Format dimension

**[!] BLOCKED — conflicting instructions across sessions.** Format
(Shorts / Live / Full video / Playlist / Podcast) was explicitly **removed**
from the taxonomy earlier ("YouTube search doesn't filter shorts/live/
playlists, so it added menu weight without adding filtering power"). The
later architecture spec puts Format back as a core funnel stage.

Not re-adding without explicit confirmation — flagging the conflict
instead of silently picking a side.

---

## Priority 7 — Topic → Subtopic restructuring

**[»] DEFERRED.** The architecture spec's real ambition is a Topic/Subtopic
tree under each Category (e.g. Music → Bollywood → Romantic Songs), not
today's flat item lists. This is a genuine data-modeling project — every
one of the ~180+ current leaf items would need to move down a level and
get real subtopics. Correctly sequenced *after* Priorities 1–4 prove the
funnel/combo pattern is worth the investment; not a quick win.

---

## Priority 8 — "Trending Now" dynamic panel

**[»] DEFERRED.** Needs a live-refreshed data source above the static
taxonomy (this year's IPL teams, current #1 trending movie, current AI
tool names, etc.) — explicitly the architecture spec's own Priority 13
("Advanced Discovery"), not a Priority 1 taxonomy concern. The
trending/time-sensitive combos identified during the Evergreen research
(IPL Highlights, Gemini AI, Saiyaara Songs, Maha Kumbh, Air Quality Near
Me, Coolie/Kantara, Nano Banana AI-art trend) are the seed content for
this panel once it's built — do not hardcode them as permanent Evergreen
items, they will go stale.

---

## Priority 9 — Dynamic entity layer

**[»] DEFERRED.** Sits *underneath* Intent (e.g. Sports → Cricket → IPL →
*this season's teams/players*) and needs its own curation/refresh
pipeline separate from the evergreen taxonomy. Lowest-priority discovery
item per the architecture spec; nothing to build until Priority 8 exists.
Also the blocker for re-adding "KL Bro Biju Rithvik" / "MrBeast Hindi" as
Evergreen combos (Priority 1) if those channels get added to the Channel
list later.

---

## Priority 10 — Query deduplication

**[ ] TODO — not yet started, flagged as a gap.** The architecture spec
marks this as one of the highest-ROI engineering features (section 17):
normalize the completed filter selection into a `query_id`, check for an
eligible recent result before hitting `search.list` again. The current
implementation already avoids firing a search on every filter toggle
(search only fires on explicit user action — typed submit, suggestion/
history click, or the Search button), which is a related but distinct
win. True dedup (a cache/eligibility check keyed on normalized query)
does not exist yet.

---

## Priority 11 — Managed vs. Local BYOK API split

**[ ] TODO — not started.** `src/lib/api.ts` calls `/api/search`
unconditionally today. No distinction between managed-mode proxying and a
local-key direct-to-YouTube path exists. Per the architecture spec this is
Priority 6 in its own roadmap (behind Taxonomy MVP, Query Builder,
Responsive PWA, Managed API, Query Dedup) — noting it here for
completeness, not proposing to start it now.

---

## Priority — Playlist support (URL-analyze + curated static playlists)

**[x] DONE (2026-08-16).** Two previously-separate bugs/gaps, resolved together:

- Analyze-by-URL now preserves `&list=` playlist context end-to-end.
  `src/lib/youtubeUrl.ts` (`parsePlaylistId`) parses it client-side —
  deliberately not reusing `server/youtube.ts`'s `parseVideoId`, since that
  module also pulls in scraping-adjacent `fetchOEmbed` we don't want in the
  client bundle. `VideoPlayer.tsx` threads it into the embed URL via
  YouTube's native `list=` param (auto-advance, playlist context) — no
  custom "next video" queue was built.
- Curated static playlists are a new, deliberately separate flow, not an
  Evergreen-style filter chip: `selectedPlaylists`/`playlistSections` state
  in `App.tsx` is independent of `SelectedFilter[]` and never feeds
  `buildEffectiveQuery` — selecting a playlist fetches its real items and
  renders a pinned section (`PlaylistSections.tsx`) above the keyword-search
  grid, in selection order, per the "pinned, not replacing" decision.
- New `/api/playlist` endpoint backed by `server/youtubePlaylists.ts`, which
  calls the official `playlistItems.list` Data API directly — no scraping
  fallback, and deliberately does **not** import `server/proxy.ts`'s
  UA-rotation/anti-bot layer, so this stays the one compliant path in the
  codebase by construction. Requires `YOUTUBE_DATA_API_KEY` (see
  `.env.example`); throws a clear 500 if unset rather than silently
  degrading.

**[!] BLOCKED — `src/lib/curatedPlaylists.ts` ships empty.** No playlist
IDs were fabricated. Filling this in is an editorial task requiring the
same sourcing discipline as the 27 Evergreen combos (real official-channel
playlists, verified via one real `playlists.list` call before committing —
see the file's header comment for the exact steps). The playlist feature
is fully wired but shows nothing until this is done.

**[»] DEFERRED — migrate `/api/search` off scraping onto the Data API.**
This is the actual fix for the ToS-compliance gap noted in
`ARCHITECTURE.md`'s Security section — `/api/playlist` only avoids
extending it, it doesn't retire it. Scoped separately: larger surface
(`server/search.ts`'s HTML-parsing logic), and needs a decision on whether
`YOUTUBE_DATA_API_KEY`'s existing (optional, enrichment-only) usage and
the new (required) playlist usage stay on one key or split.

---

## Priority — Local Playlist Manager (dev-only, load + local CRUD)

**[x] DONE.** A local-first playlist curation tool, dev-only end to end —
gated on `import.meta.env.DEV`, so it's compiled out of any production
build and never reachable on the deployed app regardless of runtime state.
No YouTube *write* calls anywhere in this feature; everything here is
either read (scraped or official API) or a local file operation.

**Load a playlist into local storage, three ways:**
- By ID — `playlistItems.list` (existing, ~1 unit/call, unchanged — Data
  API only, no scraping fallback, still throws if unconfigured)
- By URL — reuses `parsePlaylistId` from the earlier analyze-by-URL work,
  then same as above
- By search — **reversed from the original design**: now scrapes first
  (`server/search.ts`'s new `playlistRenderer` parsing — the exact gap
  named in this thread's very first message), falling back to
  `search.list&type=playlist` (~100 units/call) only if scraping returns
  nothing and a key happens to be configured. Deliberate trade-off, made
  explicitly: this extends the scraping surface (previously contained to
  video search only) specifically for playlist search, in exchange for
  working with zero Data API dependency for the common case. The
  `playlistRenderer` JSON shape is undocumented and unverified against a
  live request in this environment — treat it as first-pass, not
  proven-correct the way video parsing is.

**Bug fix, same pass:** local dev (`npm run dev`) never actually loaded
`.env` into `process.env` — Vite's automatic `.env` handling only
populates `import.meta.env` for client code; nothing bridged that to
`process.env` for `server/*.ts`/this file's own middleware, so
`YOUTUBE_DATA_API_KEY` (and any other server-side env var) was silently
`undefined` locally regardless of `.env`'s contents. This wasn't a
regression from this feature — it's a pre-existing gap that only became
visible because the playlist paths throw loudly on a missing key instead
of silently degrading, unlike the older enrichment path. Fixed in
`vite.config.ts` via `loadEnv()` + explicit assignment onto `process.env`;
no new dependency added. Vercel was never affected — its env-var injection
is a separate, already-correct mechanism.

**Local CRUD, fully implemented:** `server/localPlaylistStore.ts` is a
Node-`fs`-backed store, one JSON file per playlist under
`data/playlists/*.json`, git-trackable. Create (from a load above, or
empty), read/list, update (rename, add/remove/reorder items), delete —
all local-file operations, all synchronous with the UI, no YouTube writes
triggered by any of them. Wired through `vite.config.ts`'s existing
dev-only middleware pattern (new `/api/dev/playlists*` routes) — same
guarantee as everything else here: this code path doesn't exist for
Vercel (functions only come from `api/*.ts`) and doesn't exist in a
built bundle (`configureServer` middleware is dev-server-only).

**Frontend:** `src/dev/PlaylistManagerPanel.tsx`, opened via a 🛠 button
next to the settings gear — button and panel both gated on
`import.meta.env.DEV`. Covers all of the above: load tabs (ID/URL/search),
list of local playlists, expand-to-edit (add item by URL/ID via the
existing `analyzeVideo`, remove item, rename entry, delete playlist with
a confirm prompt).

**Explicitly deferred — phase 2, not built:** anything that writes to the
*actual* YouTube playlist (`playlists.insert/update/delete`,
`playlistItems.insert/update/delete`). The local store's schema was
designed with this in mind — each item carries `position` explicitly, and
each playlist carries `sourcePlaylistId` + `lastPulledAt` distinct from
`lastEditedAt` — specifically so a future sync tool can diff local state
against a live pull without a schema migration. This is the same
boundary discussed at length earlier in this doc's history (OAuth
write-capable credentials stay local-only, never near the deployed app)
— phase 2 needs that OAuth flow; this phase deliberately doesn't.

**Supersedes, not adds to, the original curated-playlist design:**
`PlaylistSections.tsx`'s boxed "pinned section per playlist" component is
superseded — playlist items now render as normal result cards rather than
inside a bordered section. The grouping/ordering requirement itself is
**not** walked back, though: playlist-sourced cards still need to stay
grouped and in that playlist's order within the results view, just without
the box/header around them. **Not yet implemented in `SearchResultsGrid`** —
today it still only renders the flat keyword-search grid; threading
grouped-without-a-box playlist cards through it (and retiring
`PlaylistSections.tsx`'s usage in `App.tsx` accordingly) is tracked below,
not done in this pass.

**Still not built, tracked but not scoped in detail yet:** the multiline
search-bar toggle (loop the existing single query over newline-delimited
input, results stacking with multi-select → bulk add-to-playlist(s)) —
agreed to ship as a runtime toggle (not build-time gated), which means,
unlike everything else in this section, it *is* reachable in production
regardless of default state. Search-side throttling for that path was
flagged as necessary and explicitly deferred given this project's current
personal-incubation stage — revisit before this gets more than personal
use.

---

## Quick reference: what shipped this pass

| Item | Status |
|---|---|
| Evergreen combos (data + eligibility + back-fill) | ✅ Done |
| Audience-first dimension ordering | ✅ Done |
| Playlist URL-analyze (`&list=` preserved end-to-end) | ✅ Done |
| Curated playlist selection + pinned sections + `/api/playlist` | ✅ Done (wiring) |
| Local Playlist Manager (load by ID/URL/search + local CRUD, dev-only) | ✅ Done |
| Playlist cards grouped-without-box in `SearchResultsGrid` (retire `PlaylistSections.tsx`) | Todo — not built |
| Curated playlist ID sourcing (real IDs) | Blocked — editorial task |
| Multiline search toggle + multi-select add-to-playlist | Todo — not built, throttle deferred |
| YouTube-side playlist sync (write API, OAuth) | Deferred — phase 2 |
| `/api/search` migration off scraping | Deferred — separate follow-up |
| Intent dimension | Todo, next |
| Progressive disclosure / item caps | Todo |
| Audience soft-vs-hard (general case) | Blocked — needs decision |
| Format dimension | Blocked — needs decision |
| Topic/Subtopic tree | Deferred |
| Trending Now panel | Deferred |
| Dynamic entity layer | Deferred |
| Query deduplication | Todo, not started |
| Managed/BYOK API split | Todo, not started |
