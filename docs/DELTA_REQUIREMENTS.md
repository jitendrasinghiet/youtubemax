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

## Quick reference: what shipped this pass

| Item | Status |
|---|---|
| Evergreen combos (data + eligibility + back-fill) | ✅ Done |
| Audience-first dimension ordering | ✅ Done |
| Intent dimension | Todo, next |
| Progressive disclosure / item caps | Todo |
| Audience soft-vs-hard (general case) | Blocked — needs decision |
| Format dimension | Blocked — needs decision |
| Topic/Subtopic tree | Deferred |
| Trending Now panel | Deferred |
| Dynamic entity layer | Deferred |
| Query deduplication | Todo, not started |
| Managed/BYOK API split | Todo, not started |
