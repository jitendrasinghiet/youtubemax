# Filter/Discovery Roadmap — Delta Requirements

Last updated: 2026-08-29

## Purpose

This document tracks the gap between the current filter/search implementation
(`src/lib/filterTaxonomy.ts`, `src/lib/searchFilters.ts`,
`src/components/FilterMenu.tsx`, `src/components/SelectedFiltersBar.tsx`) and
two design references that were reviewed but are **not** wholesale specs to
implement — they were mined for concrete, scoped deltas. See "Source
material" below.

Each item states: what's missing, why it matters, effort, and status.
Status values: `DONE`, `IN PROGRESS`, `PLANNED`, `DEFERRED`, `NEEDS DECISION`.

## Source material

1. A full "YouTubeMax" product/BYOK/architecture spec (codename-only,
   `[PRODUCT_BRAND]` pending) — supplied for context, not an implementation
   order. Covers managed vs. local-BYOK API modes, quota management,
   free/trial/paid entitlement, and a 14-priority engineering roadmap.
2. A topic/intent taxonomy proposal (Audience → Category → Topic → Intent →
   Format → Language funnel, global Intent Library, dynamic
   "Trending Now" layer, pre-built popular query combos).

Neither source's structure was adopted wholesale. The taxonomy already in
this repo (Language / Category-grouped / Audience / Channel, flat search
queries with no server-side normalization) is the baseline; items below are
the specific deltas worth pulling out of those two documents.

---

## Action items, in priority order

### 1. Evergreen combo group with contextual eligibility + auto-fill — `DONE`

**Gap:** No one-tap shortcuts existed for genuinely popular, evergreen
(non-time-sensitive) searches. Building them as plain hardcoded query
strings would have bypassed the taxonomy entirely and not responded to
filters already selected.

**What shipped:** A new `evergreen` group inside the `category` dimension
(rendered first in the group rail). Each item carries an optional
`impliedFilters` map (language / category-item / audience / channel tags)
in addition to its own literal search `value`. Two behaviors:

- **Downstream filtering:** with any filter already selected in a
  dimension, an Evergreen item is hidden unless it's tag-agnostic in that
  dimension or its tags overlap the current selection. Implemented in
  `isEvergreenEligible()` in `searchFilters.ts`.
- **Upstream auto-fill:** selecting an Evergreen item adds its own chip
  *and*, for any dimension the user hasn't touched yet, all of that item's
  implied tags as normal, independently removable chips. Implemented in
  `applyEvergreenSelection()`. No cascade-delete — removing an auto-filled
  chip afterward does not remove the Evergreen combo chip, and vice versa.
- Audience acts as a **hard** eligibility filter inside Evergreen
  specifically (deliberate asymmetry — see decision log below). Everywhere
  else in the app, Audience remains informational only (it's folded into
  the query text like any other filter, not used to hide taxonomy items).

27 combos seeded, sourced from Google's *India Year in Search 2025* and
YouTube's *2025 India trends* reports, evergreen-only (time-sensitive ones
like IPL/Gemini/Saiyaara were deliberately excluded — see item 8).

**Decision log (confirmed):**
- Fill-all, not fill-first, when an item has multiple tags in one empty
  dimension (e.g. Ramayan → Audience: Family *and* Old Retro both get
  added).
- No cascade-delete between a combo chip and the chips it auto-filled.
- Music was **not** merged into Entertainment. This was proposed once, a
  concern was raised (Music/Entertainment are different user intents —
  watch vs. listen — and both reference docs kept them separate), and the
  follow-up instruction only reconfirmed the Evergreen-group ask without
  re-raising the merge. Treated as not-approved. **Flag this explicitly if
  the merge was actually still wanted** — it was left as an open question,
  not a "no."

---

### 2. Audience-first dimension order — `DONE`

**Gap:** The dimension rail was `Language → Category → Audience → Channel`,
four equal-weight tabs. Every funnel-style reference (both source docs)
leads with "who," not "what."

**What shipped:** Reordered to `Audience → Category → Language → Channel` in
`FilterMenu.tsx`. Zero data-model changes — this is presentation order
only. Category still opens by default (most-used tab); only the tab
*order* changed, not which tab is active on open.

---

### 3. Global Intent vocabulary as a 5th filter dimension — `PLANNED`

**Gap:** Neither doc's "Intent" concept (Latest, Trending, Learn, How-to,
Best, Live, Explained, …) exists anywhere in the current taxonomy. Intent
words currently only appear indirectly, baked into a few Evergreen combo
query strings (e.g. "explained," "how to").

**Why it matters:** Both reference docs call this out as a major
discovery differentiator, and it's the natural next filter dimension —
same flat-list pattern as Language/Audience, no restructuring required.

**Effort:** Medium. ~12–15 item flat dimension, same shape as `audience`.
Main design question: does Intent get folded into `buildEffectiveQuery`
like every other dimension (simple), or does it change *which* Evergreen
combos are eligible too (more powerful, more scope)? Recommend starting
with the simple version.

---

### 4. Cap visible items per step (progressive disclosure) — `DONE` (superseded by single-view accordion)

**Original gap:** Groups like Education (31 items) and Entertainment (22
items) rendered their full item grid at once.

**What actually shipped instead:** Rather than curating a "top N with
show-all," Category was restructured entirely — every group (including
Evergreen) now renders as an expand/collapse accordion section in one
scrollable view (`FilterMenu.tsx`), replacing the old switchable-tabs
group rail. Within each expanded section, items are split into small
editorial clusters (`FilterGroup.clusters` in `filterTaxonomy.ts`) so a
15–23 item group reads as 2–4 labeled cards instead of one flat grid.
Cluster coverage (every item in exactly one cluster) is checked by
`validateClusterCoverage()`. This addresses the "8–20 choices per step"
concern from the source docs without needing a popularity/relevance data
source — see the ranking note below.

**Ranking/relevance note:** A numeric popularity score was explicitly
**not** built. Assigning real popularity numbers to 150+ items would need
either sourced data (same rigor as the 27 Evergreen combos, which were
grounded in actual trend reports) or an honestly-labeled editorial
opinion — neither was worth doing for a first pass. Clustering by plain
semantic similarity was judged the right minimal version: it improves
scanability without asserting a measurement that doesn't exist. Revisit
with real usage data if/when available.

### 4b. Full-taxonomy contextual eligibility (all groups, not just Evergreen) — `DEFERRED`

Evergreen's `isEvergreenEligible`/`impliedFilters` mechanism could
generalize to every group (Sports/Music/Education/etc. items hiding when
they conflict with selected filters), but that requires authoring
cross-dimension tags for ~150 items across 9 groups, not new logic — the
engine already exists. Explicitly not started; revisit after the
single-view accordion (item 4) has been used enough to know if it's
actually needed.

### 4c. Era and Grade sliders — `DONE`

Two new slider-type controls, single-select per group (`toggleSliderFilter`
in `searchFilters.ts` — picking a new value replaces the previous one in
that group rather than adding alongside it):
- **Era**: new standalone Category group, 1940s→2020s in decade steps
  (`FilterGroup.sliderItems`, no plain `items`). Explicitly **excluded**
  from Evergreen's contextual eligibility in both directions — an Era
  selection never hides/shows an Evergreen combo, and no combo carries an
  Era tag. This was a deliberate scope decision, not an oversight: Era is
  not a filter-criteria dimension.
- **Grade**: Education's existing Nursery→Class 12 items moved out of the
  item grid into `sliderItems`. Unlike Era, Grade *does* still participate
  in normal category eligibility/backfill — no scope change there, only
  the UI presentation moved from a 15-chip grid to a slider.

### 4d. Evergreen combo updates — `DONE`

- "Old Hindi Songs (90s)" renamed to "Hindi Songs" (dropped the era-coupled
  framing now that Era is its own independent slider).
- Added "English Songs" and "Upcoming Movie Trailers" (the latter
  introduced a new "Trailer" item to the Entertainment group's item grid,
  since no existing item covered it).

---

### 5. Audience: hard filter vs. soft ranking signal (outside Evergreen) — `NEEDS DECISION`

**Gap:** Both reference docs argue Audience/gender should be a soft
ranking/personalization signal generally ("someone selecting 'female'
should still see cricket"), not a hard filter. Today, outside of
Evergreen, Audience behaves exactly like every other dimension — its
value is literally appended to the search query text, which is a *soft*
behavior already (it doesn't hide anything, just biases the keyword
string). Evergreen is the one place Audience now hard-filters (item 1).

**Status:** No further change made. Current behavior (soft, text-append,
everywhere except Evergreen) is consistent with the docs' recommendation.
Documenting this as intentionally resolved, not left open — but flagging
in case "soft" should mean something more sophisticated than string
concatenation (e.g. actual result re-ranking), which would require
backend changes this repo doesn't have.

---

### 6. Format as a filter dimension — `NOT PLANNED` (explicit conflict)

**Gap:** The topic/intent proposal reintroduces Format (Shorts, Live,
Playlist, …) as a core funnel stage. This directly conflicts with an
earlier, explicit product decision in this same project to **remove**
Format ("YouTube search doesn't expose shorts/live/playlists as a real
filter").

**Resolution:** Not silently re-added. If Format is wanted back, it needs
an explicit new instruction that acknowledges overriding the earlier
removal — this doc will not resolve the conflict on its own.

---

### 7. Topic → Subtopic tree under each Category group — `DEFERRED`

**Gap:** The topic/intent doc's real structural ambition is a Topic/
Subtopic layer under each Category (e.g. Music → Bollywood → Romantic
Songs), replacing today's flat per-group item lists.

**Why deferred:** Large data-modeling project — every one of the ~150+
current leaf items would move down a level and need real subtopics
authored. Only worth starting once items 1–4 have proven the
lower-effort funnel/shortcut changes are actually used.

---

### 8. "Trending Now" dynamic panel (time-sensitive shortcuts) — `DEFERRED`

**Gap:** The 12 time-sensitive combos identified during research (IPL
Highlights, Gemini AI, Saiyaara Songs, Maha Kumbh, Asia Cup, etc.) were
deliberately **excluded** from the Evergreen group (item 1) because they
go stale. They need their own refreshed data source, not a hardcoded
array that silently rots.

**Why deferred:** No refresh mechanism exists in this repo (no CMS, no
scheduled job, no admin panel). This is explicitly a lower-priority
"Advanced Discovery" item in the architecture spec (source doc 1,
Priority 13), not a taxonomy item — don't build until there's a real
answer for *where the current list comes from* (manual curation cadence?
API-driven? admin-editable?).

---

### 9. Dynamic entity layer (e.g. current IPL teams, live AI tool names) — `DEFERRED`

**Gap:** A layer beneath Intent that would auto-refresh specific entities
(this season's IPL teams, this month's trending AI tools) without
touching the evergreen taxonomy above it.

**Why deferred:** Same blocker as item 8, one level more complex (needs
per-entity refresh, not just a swappable list). Correctly the
architecture doc's lowest-priority discovery item (source doc 1,
section 45, explicitly listed under "Defer"). Nothing to build until
items 3, 4, and 8 exist.

---

### 10. Vibe dimension (Mood + Context) — `DONE`

**Gap:** Not from either source doc — a direct product ask, outside their
scope. The taxonomy's other four dimensions all assume the user can read
labels and type a query; there was no path for someone who can't (a child,
someone not fluent in the app's language, anyone who just doesn't have the
words for what they want) beyond tapping a pre-authored Evergreen combo.

**What shipped:** A 5th dimension, `vibe`, leading the dimension rail
ahead of Audience. Two small always-open groups — Mood (Happy, Calm,
Excited, Comfort, Sleepy, Wow, Funny, Focused) and Context (Study,
Cooking, Travel, Family, Workout, Play, Party, Bedtime) — rendered as
large emoji-first tap targets (`VibeChip`, ~64px hit area) with no
accordion, no eligibility logic, and no reading required beyond
recognizing an emoji.

**Query-building change (applies structurally, not just to Vibe):**
`buildEffectiveQuery` previously concatenated every selected filter's
value with no cap, filters-then-typed-query. That was flagged as a real
risk specifically for Vibe — someone tapping several mood/context icons
at once is normal there, and literally appending every term would
over-narrow the search and quietly drop good results. Fix: Vibe terms use
soft/generic values (`'feel good'`, not `'Happy'`), are capped at 2
regardless of how many are selected, and are always appended *last*, after
topical filters and the typed query. The UI itself places no cap on
selection — tap as many as you like, same interaction model as every
other dimension — only the query-building step caps Vibe's contribution.
Covered by `src/lib/searchFilters.test.ts`.

**Decision log:** Deliberately not built as an AI/NLP intent-detection
layer (interpreting typed or spoken text into mood/context) — icon-only
tap selection was the explicit choice, both for zero ongoing cost and
because the target users (can't type/describe well) are better served by
recognition than by generation. Revisit only if icon-only proves
insufficient in practice.

---

### 11. Per-chip match counts — `DONE`

**Gap:** A filter chip gave no indication of how many cached videos it
would actually match — a plausible-looking chip could narrow to zero
results, discovered only after tapping it.

**What shipped:** `server/searchCache.ts`'s `getFacetCounts()` computes
a literal-substring match count per taxonomy term across the whole local
cache, in one batched call for all ~275 terms (`src/lib/api.ts`'s
`fetchFacetCounts()`, `src/lib/filterTaxonomy.ts`'s
`allFilterItemValues()`), fetched once on load and passed down through
`FilterMenu` to every `ItemChip`/`VibeChip`/`SliderRow` as a small
`"(N)"` badge — omitted (not shown as `"(0)"`) while the count hasn't
loaded yet, so "not fetched" and "zero matches" don't look the same.
See the sibling repo's `docs/SEARCH_CACHE.md` for the caching/
performance detail (memoized alongside the same 60s TTL `browseCache()`
now uses).

**Bug found after shipping, now fixed**: a multi-word chip value like
"Hindi Songs" showed a count (859) that disagreed with what selecting it
actually returned (2,569) — `browseCache()`'s `keywords` matching used
the same fuzzy `wordsAreSimilar` fallback as the typed search box, and
checking a whole two-word phrase against single haystack words let
`"Hindi Songs"` match any video merely containing "Hindi." Fixed by
making `keywords` match as a literal phrase only, the same rule
`getFacetCounts` already used — a chip's count and its results can no
longer disagree. Full detail in `docs/SEARCH_CACHE.md`.

---

## Explicitly out of scope right now (from source doc 1)

Carried over from the architecture-context review, unchanged — these are
BYOK/managed-API/quota/billing concerns, not filter-taxonomy concerns, and
none of this session's work touched them:

- Local BYOK mode (user-supplied YouTube API key, client-only, no backend
  transmission)
- Managed API quota manager / rate limiter
- Query deduplication (`query_id` normalization + eligible-recent-result
  check before calling `/api/search`) — flagged previously as a real gap
  versus source doc 1 section 17; still unaddressed. Note this is a
  **different** "reduce API calls" mechanism than the filter-toggle
  no-auto-search change already shipped earlier in this project — that
  fix stops *filter changes* from firing searches; true dedup would also
  stop *repeated identical searches* (e.g. two users, or one user
  re-running the same query) from double-hitting the API.
- Free/trial/paid entitlement system
- Admin dashboard, taxonomy versioning, feature flags

These remain accurately scoped as future architecture work per the
existing `50. REQUIRED AGENT BEHAVIOR` review checklist in source doc 1 —
each would need its own BUILD/DEFER/REVIEW pass before implementation.

---

## Summary table

| # | Item | Effort | Status |
|---|---|---|---|
| 1 | Evergreen combos + contextual eligibility/auto-fill | Medium | **DONE** |
| 2 | Audience-first dimension order | Trivial | **DONE** |
| 3 | Global Intent dimension | Medium | Planned |
| 4 | Single-view accordion + editorial clustering (supersedes item cap) | Medium | **DONE** |
| 4b | Full-taxonomy contextual eligibility (beyond Evergreen) | Large | Deferred |
| 4c | Era slider (excluded from eligibility) + Grade slider | Medium | **DONE** |
| 4d | Evergreen renames/additions (Hindi Songs, English Songs, Upcoming Movie Trailers) | Trivial | **DONE** |
| 5 | Audience hard vs. soft filter | — | Resolved (soft, as-is) |
| 6 | Format dimension | — | Not planned (conflicts with prior removal) |
| 7 | Topic/Subtopic tree | Large | Deferred |
| 8 | Trending Now dynamic panel | Large | Deferred |
| 9 | Dynamic entity layer | Large | Deferred |
| 10 | Vibe dimension (Mood + Context, icon-only) | Medium | **DONE** |
| 11 | Per-chip match counts | Medium | **DONE** |
| — | BYOK / quota / query dedup / entitlements | Large | Out of scope this session |
