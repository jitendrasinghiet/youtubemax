# MASTER PROMPT — Fork Baseline Repo Into New Product

Status: DRAFT FOR HANDOFF — no design or code has been produced under this
prompt yet. This document is the complete brief; it does not itself
authorize implementation.

Product codename: **PENDING** (referred to below as `[NEW_PRODUCT]`)
Baseline repo: current state of the YouTubeMax project (this repo) — see
"Baseline & What Carries Over" below for exactly what that means.

---

## 0. How to use this prompt

If you are an AI picking this up: **do not create or write any design,
UI, schema, or code until explicitly requested**, even though this
document is detailed. That instruction came directly from the product
owner as a standing rule and applies to this fork the same way it applied
to the discussion that produced this brief. Your first output, when asked
to start, should be an **Architecture Delta + Action Plan** (see section 8)
— not implementation.

Read in this order before responding to anything else:
1. This document, in full.
2. `ARCHITECTURE.md` (baseline repo's current architecture).
3. `docs/FILTER_ROADMAP.md` (baseline repo's taxonomy/filter delta log —
   useful as a *pattern* reference, not because `[NEW_PRODUCT]` keeps
   YouTube-specific content).
4. `src/lib/filterTaxonomy.ts` and `src/lib/searchFilters.ts` (the
   taxonomy + contextual-eligibility engine — the most directly reusable
   code in the baseline).

---

## 1. Baseline & what carries over

`[NEW_PRODUCT]` is a **fork**, not a rewrite from zero. The current repo
(YouTubeMax) is the technical baseline. What genuinely carries over:

- **Taxonomy engine pattern**: flat dimensions (Language, Audience,
  Channel-equivalent) + one grouped dimension (Category, with sub-groups)
  + a special "Evergreen" group with cross-dimension `impliedFilters` for
  contextual eligibility/auto-fill (`isEvergreenEligible`,
  `applyEvergreenSelection` in `searchFilters.ts`). This pattern —
  selection narrows what's shown, selection back-fills untouched
  dimensions — is exactly the "icon/symbol taxonomy minimizing clicks"
  mechanism `[NEW_PRODUCT]` needs, just generalized past YouTube-only
  categories.
- **Filter UI shell**: `FilterMenu.tsx` / `SelectedFiltersBar.tsx` chip +
  rail pattern.
- **Node.js serverless backend precedent**: already proven on Vercel,
  host-agnostic by design — directly reusable as the collation/enrichment
  backend `[NEW_PRODUCT]` needs (see section 6).
- **Query-based, not hardcoded-ID, discovery pattern**: baseline already
  treats search as text-in/results-out rather than a fixed content
  database — same principle `[NEW_PRODUCT]` needs generalized to
  non-video content and non-YouTube sources.

What does **not** carry over: YouTube-specific taxonomy content (Bollywood,
Bhajan, cricket, etc.), the YouTube-only search endpoint, and any
video-specific UI (player embedding assumptions stay scoped to sources
that actually offer a sanctioned embed, per section 5).

---

## 2. Product identity

**Idea summary:** A web app providing curated/indexed/organized
interactive navigation of *existing* web content, driven by a generic
taxonomy tailored to user preference and context continuity.

**Goal/objective:** Dynamically, custom-organized, interactive, engaging,
playful, educative, context-rich multimedia web content navigation, from
within the app.

---

## 3. Laws (zero-compromise — carried verbatim, non-negotiable)

1. The idea/concept must be viable in the real world today and into the
   future; it must be worth building with a good risk-reward ratio.
2. Do not own, claim, violate, or circumvent the terms, norms, ToC, T&C,
   or fair-usage policy of any content owner or host.
3. Concise documentation must always be persisted, reflecting current
   status with latest context, plus version history for deltas.
4. Minimal, simplistic, clean, rich UX with zero/no ads or distractions,
   targeting the maximum possible layman audience.
5. Do not allow piracy, plagiarism, or duplication of external content —
   nor of this app's own UI/content via bot crawling or extraction.
6. UX should resemble normal web navigation **without** implying the app
   is the origin of external content — see section 5 for exactly what
   this means in practice post-resolution; the original phrasing ("VM/VDI
   in browser," hiding source URLs) was evaluated and superseded, not
   simply deleted — read section 5 before implementing anything
   content-rendering-related.

---

## 4. Rules

- Do not create/write any design until explicitly requested — keep
  building context first.
- Leverage first; do not reinvent the wheel — reuse existing technology,
  data, and content sources rather than building equivalents from
  scratch.
- Allow the user to navigate external content link/chain, n-levels deep,
  seamlessly from within the app.
- ~~Allow user to cache/save selective content locally for replay/revisit
  without piracy~~ — **removed** (see section 5, decision B). Only
  result-reference caching (IDs/metadata/query state, not content) is in
  scope.
- Allow content/view state to be shareable as self/app links (encoded),
  via web, mobile, and tablet only.

---

## 5. Session decisions & conflict resolutions (read before designing)

Everything in this section was actively debated and resolved in the
session that produced this prompt. Treat these as settled unless a human
explicitly reopens them — do not re-litigate from first principles.

### A. In-app framing of arbitrary external content is a hard blocker

Rendering third-party pages inside the app's own document (iframe/VM-style
embedding) is blocked on two independent, unavoidable grounds:
- **Technical**: `X-Frame-Options` / CSP `frame-ancestors`, set by most
  high-value sites, make the browser refuse to render the frame — no
  implementation choice changes this.
- **Legal**: for sites without that header, many ToS still prohibit
  framing — proceeding anyway would violate Law 2 directly.

The only technical workaround (server-side fetch-and-rehost, stripping the
blocking headers) is itself a Law-2 violation. There is no legitimate path
through framing for general web content.

**Resolution — the pattern to build instead:**
1. Server-side collation/reconciliation of search results into `
   [NEW_PRODUCT]`'s **own** synthesized results page (metadata: titles,
   snippets, thumbnails — sourced via oEmbed/Open Graph/an official search
   API's own thumbnails, never by scraping destination pages for images).
2. Breadcrumb/context/navigation state lives entirely in `[NEW_PRODUCT]`,
   on that synthesized page — never in the destination's document.
3. Click on a thumbnail/result → **new tab/window**, full normal
   navigation to the real external site. No iframe, nothing to block,
   nothing to circumvent.
4. The `Referer` header naming `[NEW_PRODUCT]` as the origin happens
   automatically via normal linking — this is default browser behavior,
   not an engineered workaround, and needs no special handling.
5. **Exception**: sanctioned official embeds (e.g. YouTube's IFrame Player
   API, or any host that explicitly offers an embeddable player/widget)
   remain fine — framing is only blocked where it's unauthorized. The
   `[NEW_PRODUCT]` content model should distinguish "sources with a real
   embed API" (embed directly, audio/video via the host's own player) from
   "general web content" (new-tab handoff only).

This is the same aggregator pattern Google News, Flipboard, and Pocket
already use at scale — real-world-proven, satisfies Law 1.

### B. "Cache for replay" removed; result-reference caching only

Local replay/revisit caching of actual content was removed from the Rules
(section 4) because it conflicted with Law 5 (no duplication) — the line
between "personal-use cache with TTL + live re-fetch" and "a duplicated
copy" was judged too easy to cross accidentally if stated as a user-facing
feature.

**What remains legitimate and in-scope**, carried over from the earlier
YouTube-specific caching design and fully compatible with all Laws:
- IndexedDB caching of **result references** — IDs, minimal metadata,
  query fingerprints, freshness timestamps — purely to avoid redundant
  search-provider calls. This is the same pattern as query
  deduplication, not a "save for replay" feature, and should never be
  marketed as one.
- Freshness/TTL tiers per query type (time-sensitive queries get short
  TTLs; evergreen queries get long ones) — same design as the earlier
  `intentCache` / `videoCache` structures discussed for the YouTube
  baseline, generalized to non-video content.
- Treat any cached content reference (video ID, article URL, etc.) as
  **resolvable, not permanent** — store a fallback search-hint alongside
  any ID/URL, detect dead links/errors, and re-resolve rather than
  treating the reference as a stable primary key. This directly reuses
  the "don't hardcode videoIds" anti-pattern lesson from the earlier
  YouTube-specific discussion, generalized to any external content type.

### C. Search provider: not raw scraping, and not Bing

- **Direct HTTP scraping of Google Search results is excluded.** Google's
  ToS explicitly prohibits automated querying of Search; this is a direct
  Law-2 violation, not a grey area. It's also now under active litigation
  (Google v. SerpApi against a major scraping-reseller), which raises the
  practical risk further, and operationally fragile regardless (IP
  blocks, CAPTCHA, undocumented HTML changes) — independently fails
  Law 1.
- **Bing is not a fallback for scraping either.** The Bing Search API was
  fully retired August 11, 2025 — no new signups, existing keys dead, no
  lightweight replacement. The only official path (Azure AI Foundry
  "Grounding with Bing Search") is an enterprise Azure platform
  commitment, which fails Law 4 (max-audience, minimal-friction) even if
  it were pursued. Scraping Bing directly carries the same Law-2 problem
  as scraping Google.
- **Third-party SERP resellers (SerpApi, Serper, DataForSEO, etc.) are
  explicitly excluded**, despite being commercially common. They
  typically scrape Google/Bing on the developer's behalf; routing through
  them doesn't change what's happening underneath, and the active
  litigation against this category means treating them as safe would
  itself fail the zero-compromise standard in Law 1/2.

**Resolution — approved search providers:**
1. **Google Custom Search JSON API** (official, ToS-compliant). Scoped to
   a configured Programmable Search Engine, not full open-web organic
   results — a real constraint to design around, not a loophole.
2. **Brave Search API** (independent index, not a Google/Bing reseller,
   real developer free tier, purpose-built for this use case). Likely the
   stronger default given fewer configuration steps and no dependency on
   Google's ecosystem.

### D. BYOK applies, mapped per provider

BYOK changes *who holds the credential and quota*, not *whether the
access method is legitimate*. It only helps where a real, key-gated
official API already exists:

- **Google Custom Search JSON API — yes.** Same dual-mode pattern as the
  YouTube BYOK design already specified for the baseline: user supplies
  their own API key + Search Engine ID, browser calls the official
  endpoint directly, no backend proxying required for that call. Real
  benefit: each user gets their own quota instead of sharing one pool.
- **Brave Search API — yes**, same pattern, simpler setup (no CSE
  configuration step).
- **Bing — not applicable.** No suitable key-gated path exists for a
  layman audience (Azure AI Foundry is not that path — see decision C).
- **Raw scraping — not applicable.** There's no authorized channel to
  attach a user's key to in the first place; BYOK doesn't apply to an
  access method that isn't sanctioned at all.
- **Third-party SERP resellers — do not use BYOK to "launder" this
  category.** If the reseller itself scrapes Google, routing it through
  the user's own account moves *exposure*, not the underlying ToS
  violation. This does not resolve decision C's exclusion.

### E. A Node.js backend is required, not optional

The original architecture-context document explored a "pure frontend"
MVP for the YouTube-specific product. That framing does **not** fully
carry over to `[NEW_PRODUCT]`: server-side search-result
collation/reconciliation (decision A, step 1) genuinely requires a
backend — CORS, hidden provider API keys for the Managed mode, and
cross-provider aggregation aren't achievable purely client-side. This is
the same class of exception already identified for AI-enrichment in the
baseline's architecture discussion (a "legitimate first reason to add a
backend"), just arriving earlier for `[NEW_PRODUCT]` because collation is
core to the product, not an add-on.

The backend's job stays deliberately narrow:
1. Collate/reconcile results from the approved search provider(s) into a
   synthesized results page (Managed mode).
2. Optionally proxy AI enrichment calls if/when that layer is built —
   never embed an AI provider key client-side (same rule as the baseline's
   BYOK-AI discussion: browser-embedded commercial keys are extractable).
3. **Not** persist third-party content itself — only structured metadata
   and reference IDs, consistent with decision B.

---

## 6. Architecture directives

- **Frontend**: PWA/SPA, responsive across phone/tablet/laptop, zero/no
  page-scroll UI with multi-touch/gesture navigation, taxonomy-driven
  discovery generalizing the baseline's Language / Category(grouped,
  with Evergreen) / Audience / Source-Channel pattern to non-YouTube
  content domains.
- **Backend**: minimal Node.js service, host-agnostic (Vercel for demo,
  deployable anywhere per the design choices), scoped exactly as in
  decision E — collation + optional AI proxy, nothing else.
- **Content access pattern**: new-tab handoff for general web content
  (decision A); direct sanctioned embed only for sources offering one
  (audio/video via the host's own official player, same as the baseline's
  YouTube IFrame Player usage).
- **Caching**: IndexedDB, reference-and-metadata only, per-query-type TTL,
  dead-reference detection + re-resolution (decision B). Reuse the
  `intentCache` / `videoCache`-style structure already scoped for the
  YouTube baseline, generalized to arbitrary content types.
- **Search providers**: Google Custom Search JSON API and/or Brave Search
  API (decision C), each with Managed + Local BYOK modes (decision D),
  mirroring the baseline's existing YouTube BYOK architecture pattern
  exactly — same UX copy pattern ("stays on this device," test
  connection, clear key, no cloud sync of credentials).
- **Multi-language**: leverage the browser's native translation
  capability first (per the Rules' "leverage first" principle); build
  custom i18n only where browser translation is genuinely insufficient.
- **Dictionary/encyclopedia layer**: voice search, speech-to-text,
  text-to-speech, and transliteration should leverage the Web Speech API
  and other browser-native capabilities first, same "leverage first"
  principle, before any custom/backend implementation.
- **Sharing**: encoded self/app links representing navigation/context
  state (taxonomy selections, query state) — never encoded copies of
  third-party content, consistent with decision B.

---

## 7. UX user flows (carried over, content-source-agnostic)

1. First-time user sees a YouTube-style search bar plus default content
   thumbnails.
2. Taxonomy navigation generates a dynamic search query against the
   approved provider(s) (decision C); top results are presented as
   thumbnails.
3. Thumbnail click → per decision A: general content opens in a new
   window/tab; sanctioned-embed content (e.g. video via an official
   player) renders in-app via that host's own embed mechanism.
4. Where content is genuinely rendered in-app (only the sanctioned-embed
   case), text/hypertext may be selectable for dictionary features;
   audio/video renders in the host's proprietary player.
5. Selected content contributes to context for the next auto-triggered
   related search (language-preference-aware), reusing the baseline's
   Content Continuity Engine concept (Same / Similar / Context tiers)
   generalized past video-only content.

---

## 8. Additional features (carried over)

- Dictionary-cum-encyclopedia layer.
- Physical textual/image dictionary-style index-based navigation.
- Word selection: pronunciation, spelling, multi-language (from/to).
- Images/icons per word, with etymology/synonym/antonym options.
- User UI localization with secondary/tertiary language support.
- Voice search across supported languages.
- Speech-to-text, transliteration, translation, and reverse
  text-to-speech.

---

## 9. Explicit non-goals / do not build yet

- No raw scraping of Google, Bing, or any search engine (decision C).
- No iframe/VM-style embedding of arbitrary third-party pages (decision A)
  — new-tab handoff only, except sanctioned embeds.
- No content-replay caching feature (decision B) — reference/metadata
  caching only.
- No third-party SERP reseller integration (decision C/D).
- No Bing integration unless a human separately approves an Azure AI
  Foundry platform commitment (decision C) — not assumed by default.
- No AI-enrichment layer until the core taxonomy → search → results →
  continuity loop is proven, matching the baseline's own phased approach
  (structured filters first, metadata-driven continuity second, AI
  enrichment only where metadata is insufficient).

---

## 10. Required first response from the AI implementing this

Per section 0: do not start designing or coding. First produce an
**Architecture Delta + Action Plan** covering:

A. What carries over from the baseline as-is vs. what needs generalizing
   (start from `filterTaxonomy.ts` / `searchFilters.ts` — identify exactly
   which parts are YouTube-specific vs. structurally reusable).
B. Proposed generic taxonomy shape (replacing Language/Category/Audience/
   Channel with whatever `[NEW_PRODUCT]`'s actual dimensions should be).
C. Search provider integration plan (Google Custom Search JSON API vs.
   Brave Search API vs. both — with a recommendation and why).
D. Collation-backend design (the new Node.js service's exact
   responsibilities, kept narrow per decision E).
E. Content-access/new-tab-handoff UI design at a high level (no
   implementation yet).
F. Caching/IndexedDB schema proposal (reference-only, per decision B).
G. Any new Law/Rule conflicts this surfaces that weren't already resolved
   in section 5 — flag explicitly, do not resolve unilaterally.
H. A quick-wins-first priority order, same style as
   `docs/FILTER_ROADMAP.md` in the baseline.

Then wait for approval before implementing anything.
