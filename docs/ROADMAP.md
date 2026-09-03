# YouTubeMax — Roadmap

Where things stand and what's next, in the same spirit as the sibling
`dekho` project's own `docs/ROADMAP.md`. `docs/STATUS.md` is the
detailed running log (newest entries at top, one per real change); this
file is the shorter, persistent "what's next" view that a fast-growing
log isn't a good home for. `docs/DELTA_REQUIREMENTS.md` and
`docs/FILTER_ROADMAP.md` remain the narrower filter/taxonomy-specific
trackers.

## Where things stand

The viewer (docked-top or floating, drag-to-detach, position/mode
persisted across a session and now across a reload too), the discovery
feed (a local search-result cache backing an instant "From your
library" browse, merged with live search rather than replaced by it),
and the filter taxonomy (Language/Category/Audience/Channel/Vibe) are
all working and verified — see `docs/STATUS.md` for the detailed
history. Rate limiting, a Kids-content declutter pass, and a real
language-aware search signal (`hl`/`gl` passed through to YouTube's
search, not just folded into the query text) were added this pass.

## Next up

Ordered roughly by how bounded/ready-to-start each is, not by
importance — full detail on each is in the matching `docs/STATUS.md`
entry.

1. **Core search scrapes YouTube's HTML/InnerTube endpoints, not the
   official Data API.** Flagged as a genuine ToS risk at real public
   scale, not a cosmetic gap — `server/search.ts`'s two fallback
   strategies (`searchViaResultsUrl`, `searchViaInnertube`) both go
   through `server/proxy.ts`'s browser-header spoofing specifically
   built to evade YouTube's own anti-bot detection.
   Enrichment (`enrichResultsWithYouTubeDataApi`) and playlist fetching
   already use the official API when `YOUTUBE_DATA_API_KEY` is set — it's
   specifically primary search-discovery that doesn't. Migrating is a
   real cost tradeoff, not a drop-in swap: `search.list` costs 100
   quota units per call against a default 10,000/day free quota
   (~100 searches/day before paying or requesting a quota increase), a
   very different constraint than today's unlimited scraping-based
   search. A product/cost decision for whoever owns this app's
   direction — not something to change unilaterally.
2. **Rate limiting is best-effort, in-memory, not a hard guarantee.**
   `server/rateLimit.ts`'s per-IP counters live in one warm serverless
   instance's memory — a cold start clears them, and concurrent
   regions/instances each keep their own. Meaningfully throttles a
   single naive script; not a guarantee against a determined or
   distributed abuser. Real hardening needs shared state (Vercel KV /
   Upstash Redis or similar) — a new paid dependency/infra decision,
   not added unilaterally.
3. ~~**7 of the 11 playlist URLs given directly this pass came back
   404.**~~ **Resolved on the sibling DEKHO project's side.** Rechecked
   directly (`playlists.list` against the channel itself, since the
   original 7 URLs were never recoverable — a 404 has no metadata to
   log) and found the channel had gone public again, plus grown to 13
   playlists total. 218 new real items added to DEKHO's catalog; see
   its own `docs/STATUS.md`. Not yet mirrored into this app's own
   `data/playlists/`/`data/search-cache/` the way the original 4 were —
   scope decision, not an oversight, left for a follow-up if wanted.
4. **The Kids-content declutter (`declutterMadeForKids`,
   `searchSort.ts`) only spaces out results already returned by a
   search** — it can't add non-Kids content that a query genuinely has
   none of. Works as designed for a mixed result set; a query that's
   overwhelmingly Kids content to begin with will still look
   Kids-heavy, which is correct, not a bug, but worth stating plainly
   given how the feature is named.
5. **Filter menu UX flagged as complex** ("check filters layout seems
   too complicated, make Ux better suggest") — asked to check and
   suggest, not to redesign blind. `docs/FILTER_ROADMAP.md` already
   documents real, deliberate reasoning behind the current shape (5
   dimensions, accordion + editorial clustering chosen *over* a worse
   flat-list alternative, per-chip counts) — see that doc's new item 12
   for concrete, lower-risk directions that don't just re-litigate
   decisions already made there, plus what's *not* recommended and why.
6. **No CI/test-suite parity check on the sibling DEKHO project** —
   this app has both (GitHub Actions, 100 passing tests); DEKHO has
   neither. Not this project's code to change, but worth linking:
   DEKHO's own `docs/ROADMAP.md` "Next up" now tracks it from that
   side.
