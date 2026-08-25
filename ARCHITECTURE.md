# YouTubeMax Architecture

## Status Snapshot (2026-08-25)

- Discovery search defaults to `25` results and server clamps to `1..25`.
- Main UX is discovery-first with a floating, draggable, resizable viewer.
- Search-result click opens viewer centered in the viewport.
- `Pop` opens a centered separate window (desktop) or new tab fallback (mobile).
- Runtime transcript strategy selector (`jdepoix/direct/proxy`) is not currently surfaced in UI.
- Analyze-by-URL preserves `&list=` playlist context end-to-end (parsed client-side in `src/lib/youtubeUrl.ts`, threaded into `VideoPlayer`'s native `list=` embed param — no custom queue logic). Curated static playlists are wired end-to-end (`/api/playlist` → official Data API `playlistItems.list`, pinned sections above the search grid, selection order preserved), but `src/lib/curatedPlaylists.ts` ships intentionally empty — two entries with fabricated/placeholder data (`channel: 'Some Official Label'`, copied verbatim from the file's own "do not use as-is" example comment) briefly landed on `main` and were reverted; real ones still need editorial sourcing per that file's header comment.
- **New this iteration (repo health pass):**
  - Fixed a real Rules-of-Hooks violation in `App.tsx` — a `useMemo` and three `useEffect` calls were physically placed after the `isPopoutMode` early return, so popout-mode renders and normal renders called a different number of hooks. Moved above the early return with `isPopoutMode` guards added inside each effect body, preserving prior behavior (those effects never ran in popout windows).
  - `server/localPlaylistStore.ts`'s `createLocalPlaylist` now rejects (409) loading the same `sourcePlaylistId` twice, naming the existing slug — loading a playlist by URL and then by ID no longer silently creates a duplicate local file.
  - Added `fetchPlaylistMeta` (`playlists.list`) to `server/youtubePlaylists.ts` plus a dev-only `/api/dev/playlist-meta` route; the Playlist Manager panel now best-effort fetches the real title/channel on an ID/URL load instead of defaulting to `Playlist <id>` / `Local` (silently falls back if the API key/quota is unavailable — never blocks the load).
  - Added `.github/workflows/ci.yml` — lint + test + build now run on every push/PR to `main`.
  - Added dev-only bulk add-to-playlist: `SearchResultsGrid` renders a per-card checkbox (`import.meta.env.DEV` only) and a new `src/dev/AddToPlaylistBar.tsx` appears above the grid once one or more results are selected, letting you bulk-add them into an existing local playlist or a newly-created one via the same `localPlaylistStore.ts`/`/api/dev/playlists` path the Playlist Manager already uses. A per-item 409 ("already in this playlist") is treated as an expected skip in a batch add, not a failure. This is purely additive to the existing dev-only local-playlist workspace — no new persistence, nothing prod-facing.
  - Added a 5th filter dimension, **Vibe** (`filterTaxonomy.ts`), leading the dimension rail: two small always-open groups, **Mood** (Happy/Calm/Excited/Comfort/Sleepy/Wow/Funny/Focused) and **Context** (Study/Cooking/Travel/Family/Workout/Play/Party/Bedtime), rendered as large emoji-first tap targets (`VibeChip` in `FilterMenu.tsx`) — no reading or typing required, built for users who can't describe what they want in words. Selection is uncapped in the UI (tap as many as you like, same as every other dimension), but `buildEffectiveQuery` (`searchFilters.ts`) treats vibe specially: its terms are soft/generic (`'feel good'`, not `'Happy'`), capped at 2 regardless of selection count, and always appended *last*, after topical filters and the typed query — so it can only ever nudge results, never dominate or over-narrow them the way the prior uncapped concatenation (still true for every other dimension) risked. Covered by `src/lib/searchFilters.test.ts`. Live-verified: selecting 3 mood/context chips and searching produced `q=<typed> <2 capped vibe terms>`, confirming both the cap and the ordering.
- Notes below include historical design context; this section is the source of truth for current runtime behavior.

## Overview

YouTubeMax is a **React + TypeScript frontend** with **Node.js serverless backend** architecture designed for maximum portability and zero infrastructure overhead.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (React)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ App.tsx (state orchestration)                        │   │
│  │ ├─ Components: VideoPlayer, ChapterList,            │   │
│  │ │   DiscoverySearchBar, SearchResultsGrid, etc      │   │
│  │ ├─ Hooks: useKeywordMasterList, useClipMode,        │   │
│  │ │   useVoiceSearch                                  │   │
│  │ └─ State: result, searchQuery, activeTab, etc       │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↕ JSON                             │
└─────────────────────────────────────────────────────────────┘
              ↕ (Vercel / Netlify / Express)
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Serverless                        │
│  /api/analyze                  /api/search                  │
│  ├─ server/analyze.ts          ├─ server/search.ts         │
│  ├─ server/keywords.ts         └─ Dynamic filtering        │
│  ├─ server/chapters.ts                                     │
│  ├─ server/summary.ts          server/constants.ts         │
│  └─ server/youtube.ts          (shared scraping config)    │
└─────────────────────────────────────────────────────────────┘
              ↕ (HTTP / oEmbed / Caption API)
┌─────────────────────────────────────────────────────────────┐
│                    External APIs (No Keys)                   │
│  ├─ YouTube oEmbed (metadata)                              │
│  ├─ youtube-caption-extractor (transcripts)                │
│  └─ YouTube search page scraping                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### State Management

State is split between **App.tsx** (orchestration) and focused **custom hooks**:

```typescript
// App.tsx — top-level orchestration state
const [result, setResult] = useState<AnalyzeResult | null>(null)
const [loading, setLoading] = useState(false)

// Search & Discovery
const [searchQuery, setSearchQuery] = useState('')
const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
const [searchLoading, setSearchLoading] = useState(false)
const [searchSortType, setSearchSortType] = useState<SearchSortType>('relevance')

// UI
const [activeTab, setActiveTab] = useState<'discovery' | 'viewer'>('discovery')
const [showFilteredChapters, setShowFilteredChapters] = useState(false)
const [showSummary, setShowSummary] = useState(true)

// Player & clip mode (encapsulated in useClipMode)
const { playStart, setPlayStart, clipMode, clipIndex, startClips, stopClips, selectChapter } =
  useClipMode(displayedChapters)

// Voice dictation (encapsulated in useVoiceSearch)
const { isListening, toggle } = useVoiceSearch(handleVoiceTranscript)

// Master keywords (from hook)
const { keywords, ingestFromAnalysis, removeKeyword, clearKeywords } = useKeywordMasterList()
```

**Custom hooks** keep `App.tsx` lean and the logic testable in isolation:

| Hook | Responsibility |
|------|----------------|
| `useKeywordMasterList` | Aggregates + prunes keywords across analyses |
| `useClipMode` | Playback position, clip timer, sequential auto-advance |
| `useVoiceSearch` | Typed Web Speech API wrapper for voice dictation |

**Why not Redux/Zustand?**
- App is relatively small (single analysis + search result)
- Props drilling minimal with focused components
- Easier to understand without middleware layer
- Faster to modify without boilerplate

### Component Hierarchy

```
App
├─ Header
│  ├─ Logo
│  └─ SearchBar (URL input)
├─ Main
│  ├─ DiscoverySearchBar (search query input + voice)
│  ├─ Master List (floating overlay, always visible)
│  ├─ Tabs Navigation
│  └─ Tab Content
│     ├─ Discovery Tab
│     │  └─ SearchResultsGrid (4-column responsive + sort controls)
│     └─ Viewer Tab
│        ├─ VideoPlayer
│        ├─ ChapterList (with filtering)
│        └─ ClipMode Indicator
└─ Footer
   ├─ Summary (collapsible)
   └─ Transcript (collapsible)
```

### Data Flow

#### **1. Video Analysis Flow**

```
User Input (URL/ID)
    ↓
SearchBar.onSearch()
    ↓
App.runAnalysis()
    ├─ setLoading(true)
    ├─ fetch /api/analyze
    └─ setLoading(false), setResult(data), ingestFromAnalysis(data)
    ↓
Master list updates → keywords memoized from pruneNoise()
    ↓
UI re-renders (activeTab auto-switches to 'viewer')
```

#### **2. Keyword Selection Flow**

```
User clicks keyword pill
    ↓
KeywordMasterList.onSelect(term)
    ↓
App.handleKeywordSelect()
    ├─ parseSearchTerms(searchQuery) → array
    ├─ toggleTerm (add if missing, remove if present)
    └─ setSearchQuery(newQuery)
    ↓
Computed filteredChapters re-runs (useMemo dependency)
    ↓
ChapterList re-renders with highlighted matches
```

#### **3. Clip Mode Flow**

```
User clicks "Play Clips"
    ↓
ChapterList.onPlayClips() → useClipMode.startClips()
    ├─ setClipMode(true)
    └─ setClipIndex(0)
    ↓
useClipMode effect watches clipMode & calculates duration
    ├─ Find next filtered chapter
    ├─ Duration = nextChapter.start - currentChapter.start
    └─ setTimeout(() => setClipIndex(i+1))
    ↓
VideoPlayer changes startAt prop (via playStart)
    ↓
Repeat until user clicks "Stop" or reaches last chapter
```

### Performance Optimizations

1. **useMemo for computed values:**
   ```typescript
   const filteredChapters = useMemo(() => {
     if (!result) return []
     const terms = parseSearchTerms(searchQuery)
     if (terms.length === 0) return result.chapters
     return result.chapters.filter(ch =>
       terms.some(term => ch.title.toLowerCase().includes(term))
     )
   }, [result, searchQuery])

   // displayedChapters is also memoized so it stays referentially stable,
   // preventing useClipMode's timer effect from restarting every render.
   const displayedChapters = useMemo(
     () => (showFilteredChapters ? filteredChapters : result?.chapters ?? []),
     [showFilteredChapters, filteredChapters, result],
   )
   ```

2. **useCallback for event handlers:**
   ```typescript
   const handleKeywordSelect = useCallback((term: string) => {
     setSearchQuery((prev) => {
       const terms = parseSearchTerms(prev)
       if (terms.includes(term.toLowerCase())) {
         return removeSearchTerm(prev, term)
       }
       return appendSearchTerm(prev, term)
     })
   }, [])
   ```

3. **Memoized keyword pruning:**
   ```typescript
   const keywords = useMemo(() => pruneNoise(rawKeywords), [rawKeywords])
   ```

---

## Backend Architecture

### API Endpoints

#### **POST/GET /api/analyze**

**Input:** `videoId` (URL or 11-char ID)

**Process:**
```typescript
// server/analyze.ts
export async function analyzeVideo(videoId: string) {
  // 1. Normalize & validate ID
  const normalized = normalizeVideoId(videoId)
  
  // 2. Fetch metadata (YouTube oEmbed)
  const meta = await fetchVideoMetadata(normalized)
  
  // 3. Fetch transcript (caption-extractor)
  const transcript = await fetchTranscript(normalized)
  
  // 4. Parse chapters (description or auto-generate)
  const chapters = await parseChapters(normalized, meta.description, transcript)
  
  // 5. Extract keywords (4-source weighted)
  const keywords = extractKeywords(meta, chapters, transcript)
  
  // 6. Generate summary (extractive)
  const summary = generateSummary(transcript)
  
  // 7. Return result
  return { meta, chapters, transcript, keywords, summary, warnings }
}
```

**Output:** `AnalyzeResult` (JSON)

#### **GET /api/search**

**Input:** `q` (search query), `maxResults` (1-25, default 25)

**Process:**
```typescript
// server/search.ts
export async function searchVideos(query: string, maxResults: number) {
  // 1. Fetch YouTube search results (no API key)
  const results = await fetchYouTubeResults(query, maxResults)
  
  // 2. Extract video data from HTML
  const parsed = results.map(video => ({
    videoId: video.id,
    title: video.title,
    channel: video.channel,
    thumbnail: video.thumbnail,
    publishedAt: video.publishedAt,
    viewCount: video.viewCount,
    duration: video.duration
  }))
  
  // 3. Return results + warnings
  return { results: parsed, warning: null }
}
```

**Output:** `SearchResponse` (JSON)

---

### Keyword Extraction Algorithm

**4-Source Weighted Scoring:**

```
final_score = 
  (title_frequency × 4.0) +
  (chapter_frequency × 0.7) +
  (summary_frequency × 3.0) +
  (transcript_frequency × 1.0)
```

**Noise Pruning (4-stage filter):**

```typescript
// Stage 1: Frequency anomaly detection
if (frequency > mean + 2 * stdDev) return false  // Too repetitive

// Stage 2: Genericity detection
if (chapterSpread > maxSpread * 0.8) return false  // Too generic

// Stage 3: Superstring elimination
if (higherScoringKeyword.includes(term)) return false  // Less specific

// Stage 4: Substring bloat elimination
if (substrCount >= keywords.length * 0.5) return false  // Too many substrings

return true  // Keep
```

**Result:** Only semantically significant, specific keywords survive.

---

### Chapter Parsing

**Priority order:**

```typescript
// 1. Try description timestamps (HH:MM or MM:SS format)
const descChapters = parseDescriptionChapters(description)
if (descChapters.length > 0) return descChapters

// 2. Auto-generate from captions (~90s segments + pause detection)
const autoChapters = generateChaptersFromTranscript(transcript)
return autoChapters

// 3. Fallback: single "Full Video" chapter
return [{ start: 0, title: 'Full Video', source: 'api' }]
```

---

### Summary Generation

**Extractive algorithm** (no generative AI):

```typescript
// 1. Split transcript into sentences
const sentences = splitIntoSentences(transcript)

// 2. Score each sentence by TF-IDF (keyword relevance)
const scored = sentences.map(s => ({
  text: s,
  score: calculateTFIDF(s, keywords)
}))

// 3. Select top 3 sentences in order
const topSentences = scored
  .sort((a, b) => b.score - a.score)
  .slice(0, 3)
  .sort((a, b) => transcript.indexOf(a.text) - transcript.indexOf(b.text))

// 4. Join into summary
return topSentences.map(s => s.text).join(' ')
```

**Benefit:** Fast, no API costs, no dependency on external services.

### Request Routing Strategy with Resilience

**YouTube has different anti-bot protection levels:**

| Request Type | Protection | Solution |
|--------------|-----------|----------|
| **oEmbed (metadata)** | Moderate | Direct fetch with browser headers + 10s timeout |
| **Captions/Transcripts** | Strict (InnerTube API) | Browser headers + retry logic (optional: residential proxy fallback) |
| **Search** | Moderate | Direct fetch with browser headers |

**Multi-Tier Fetch Strategy:**

1. **Primary:** Browser-like headers (User-Agent rotation, Accept-Language, DNT, etc.)
2. **Fallback:** Residential proxy (if configured) - only for 5xx errors
3. **Last resort:** Throw error with helpful message

**Browser Identity Approach:**

YouTubeMax uses rotating realistic User-Agent strings and comprehensive browser headers to simulate genuine browser requests. The scraping constants (user-agent pool, InnerTube client version, query length cap) are centralized in **`server/constants.ts`** so they can be updated in one place when YouTube changes its behavior:

```typescript
// server/constants.ts - shared scraping configuration
export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Firefox/121.0',
]
export const INNERTUBE_CLIENT_VERSION = '2.20241218.01.00'
export const MAX_QUERY_LENGTH = 200
export function getRandomUserAgent(): string { /* ... */ }

// server/proxy.ts consumes the shared pool
function getBrowserHeaders(init?: RequestInit): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
  }
}

export async function createBrowserFetch(): Promise<typeof fetch> {
  return async (input, init) => {
    try {
      // Try direct browser fetch first with headers
      const res = await fetch(url, {
        ...init,
        headers: getBrowserHeaders(init),
      })
      if (res.ok || isPermanentError(res.status)) {
        return res
      }
      // If 5xx and proxy available, fall through
      if (res.status >= 500 && proxyUrl) {
        // Try proxy
      } else {
        return res
      }
    } catch (error) {
      if (!proxyUrl) throw error
    }
    
    // Fallback to proxy if configured and browser fetch failed
    if (proxyUrl) {
      return proxyFetch(url, init)
    }
  }
}
```

**Multi-Strategy Fetch with Retry:**

`server/analyze.ts` tries transcript strategies in order (`jdepoix` \u2192 `direct` \u2192
`proxy`), with exponential backoff on transient failures. The `youtube-transcript`
package is loaded via an ESM-safe **dynamic `import()`** (cached) rather than
`require`, since the project is ESM (`"type": "module"`):

```typescript
// server/analyze.ts
let youtubeTranscriptPromise: Promise<any> | null = null
function loadYoutubeTranscript(): Promise<any> {
  if (youtubeTranscriptPromise === null) {
    youtubeTranscriptPromise = import('youtube-transcript')
      .then((mod) => mod.YoutubeTranscript ?? null)
      .catch(() => null)
  }
  return youtubeTranscriptPromise
}

async function fetchTranscriptWithStrategy(
  videoId: string,
  browserFetch: typeof fetch,
  preferredStrategy: 'jdepoix' | 'direct' | 'proxy' = 'jdepoix',
  maxRetries = 2  // Exponential backoff: 1s, 2s
): Promise<{ transcript, title?, description?, strategy }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const details = await getVideoDetails({
        videoID: videoId,
        fetch: browserFetch  // Now uses browser headers
      })
      return { transcript: details.subtitles, title: details.title }
    } catch (err) {
      // Don't retry on permanent errors
      if (isPermanentError(err)) throw err
      
      // Retry with exponential backoff on transient errors
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000)
      } else {
        throw err
      }
    }
  }
}
```

**Why This Works Better:**

- **Browser headers alone often sufficient** for most YouTube requests
- **Zero cost** - no proxy fees for many use cases
- **Faster** - direct browser requests beat proxy routing
- **Residential proxy optional** - only needed if browser headers insufficient
- **Backward compatible** - existing YOUTUBE_PROXY_URL configs still work
- **Smart fallback** - uses proxy only when browser approach fails with 5xx errors



### Vite Build Pipeline

```typescript
// vite.config.ts
export default {
  plugins: [react(), tailwindPlugin()],
  server: {
    middlewareMode: true,
    middleware: [
      // Route /api/* to server/*.ts
      (req, res, next) => {
        if (req.url.startsWith('/api/')) {
          const endpoint = req.url.split('/')[2]  // 'analyze' or 'search'
          const handler = dynamicImport(`./server/${endpoint}.ts`)
          handler(req, res)
        } else {
          next()
        }
      }
    ]
  },
  build: {
    target: 'ES2020',
    outDir: 'dist',
    emptyOutDir: true
  }
}
```

### Vercel Deployment

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "serverless": {
    "region": "iad1",
    "timeout": 30,
    "memory": 1024
  },
  "env": {
    "YOUTUBE_PROXY_URL": {
      "description": "Optional residential proxy for transcript fetching"
    }
  }
}
```

**Auto-detected:**
- `/api/analyze.ts` → Vercel Function at `/api/analyze`
- `/api/search.ts` → Vercel Function at `/api/search`

---

## Error Handling

### Frontend Error Handling

```typescript
// In App.tsx
const runAnalysis = useCallback(async (input: string) => {
  setLoading(true)
  setError(null)
  
  try {
    const data = await analyzeVideo(input)
    setResult(data)
    ingestFromAnalysis(data)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Something went wrong')
  } finally {
    setLoading(false)
  }
}, [ingestFromAnalysis])
```

### Backend Error Handling

```typescript
// In server/analyze.ts
export async function analyzeVideo(videoId: string) {
  try {
    const normalized = normalizeVideoId(videoId)
    if (!normalized) throw new Error('Invalid video ID')
    
    const meta = await fetchVideoMetadata(normalized)
    if (!meta) throw new Error('Video not found or restricted')
    
    const transcript = await fetchTranscript(normalized)
    // Warning if transcript unavailable, but continue
    
    return { meta, chapters, transcript, keywords, summary, warnings: [] }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 400
    }
  }
}
```

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Initial load | <1s | ~0.8s (Vite) |
| Video analysis | <3s | ~2-3s (depends on transcript size) |
| Search | <2s | ~1-2s (YouTube scraping) |
| Keyword filtering | <100ms | ~50ms (useMemo) |
| UI interactions | <50ms | ~10-30ms (React re-renders) |

---

## Testing Strategy

Tests run with **Vitest** (`npm test` / `npm run test:watch`). The current suite
covers the pure, framework-agnostic functions where bugs are most costly:

```
src/lib/searchSort.test.ts   # duration/view/date parsing + sort ordering
src/lib/api.test.ts          # search-term parse/append/remove helpers
server/youtube.test.ts       # parseVideoId, formatTimestamp, description chapters
```

### Example

```typescript
// server/youtube.test.ts
import { parseVideoId } from './youtube'

describe('parseVideoId', () => {
  it('parses a youtu.be short link', () => {
    expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('rejects foreign hosts', () => {
    expect(parseVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
  })
})
```

Test files are excluded from the production build (`tsconfig.app.json`) and matched
by `vitest.config.ts` (`src/**/*.test.ts`, `server/**/*.test.ts`).

### Not yet covered (good next candidates)

- `server/keywords.ts` 4-source scoring + `pruneNoise` filtering
- `server/summary.ts` extractive summary scoring
- `server/chapters.ts` auto-chapter generation
- `useClipMode` / `useVoiceSearch` hooks (would need a DOM test environment)

### E2E (future)

```typescript
// e2e/search-to-analysis.test.ts
describe('Search to Analysis Flow', () => {
  it('searches videos and analyzes selected one', async () => {
    // 1. Go to app
    // 2. Search for "React hooks"
    // 3. Click first result
    // 4. Wait for analysis
    // 5. Assert chapters displayed
  })
})
```

---

## Security Considerations

1. **API keys** — `YOUTUBE_DATA_API_KEY` (optional today, required for curated playlists) is read server-side only via `process.env` in `server/*.ts` — never bundled into the client (no `VITE_`-prefixed equivalent exists anywhere in `src/`). Locally it comes from a gitignored `.env`; on Vercel from a dashboard env var, same pattern as `YOUTUBE_PROXY_URL`. See `.env.example`.
2. **User input validation** — VideoID validated against a strict regex before any API call; playlist IDs validated against `/^[a-zA-Z0-9_-]{2,64}$/` before being forwarded to Google's API.
3. **Query length cap** — Search queries are truncated to `MAX_QUERY_LENGTH` (200) in `server/constants.ts` before reaching outbound fetches.
4. **HTTPS only** — Vercel auto-enforces TLS.
5. **CORS headers** — API functions should set appropriate CORS headers.
6. **Rate limiting** — Not yet implemented; recommended on Vercel/edge to prevent scraping abuse.
7. **Quota monitoring (new)** — Unlike scraping, `/api/playlist`'s Data API calls are metered against a daily quota. `playlistItems.list` is ~1 unit/call, so this is cheap at normal traffic, but a runaway client (or a curated-playlist list that grows large) could exhaust it — worth dashboard monitoring once this sees real traffic.

**Known compliance gap, not yet resolved:** `/api/search` (video search), the new scraped playlist-search path (`server/search.ts`'s `playlistRenderer` parsing, used by the local dev playlist tool), and the transcript-fetch path all work by rotating User-Agent strings and browser headers (`server/proxy.ts` for transcripts; `server/search.ts` uses a fixed browser User-Agent directly for search, not `proxy.ts`'s rotation) specifically to get past YouTube's anti-bot protection. This is scraping designed to evade detection, not incidental page-reading, and it sits in tension with not circumventing a content host's ToS. `/api/playlist` and playlist load-by-ID/URL (`playlistItems.list`) deliberately do not share that code path — see `server/youtubePlaylists.ts`'s header comment — so those stay clean by construction; playlist *search* specifically was a deliberate exception, made explicitly, trading Data API quota cost for scraping exposure. Migrating `/api/search` itself onto the official Data API is scoped as a separate, larger follow-up (see `docs/DELTA_REQUIREMENTS.md`).

---

## Scalability Notes

**Current bottlenecks:**
- YouTube transcript API latency (~1-2s)
- YouTube search scraping latency (~1-2s)
- Large transcript processing (~1s for 100k+ tokens)

**Solutions if needed:**
- Add caching layer (Redis) for frequently analyzed videos
- Batch process transcripts with workers
- Implement pagination for search results
- Add CDN for static assets

---

## Monitoring & Debugging

### Local Development

```bash
# Enable verbose logging
DEBUG=* npm run dev

# Check API responses
curl http://localhost:5173/api/analyze?videoId=dQw4w9WgXcQ | jq

# Profile React components
npm run dev -- --profile
```

### Production (Vercel)

- Check function logs in Vercel dashboard
- Monitor performance in Vercel analytics
- Use error tracking (Sentry, Rollbar)
- Track API call latencies

---

## Future Improvements

- [ ] Cache analyzed videos (localStorage + sync)
- [ ] Offline mode support
- [ ] Custom chapter creation
- [ ] Keyword export (CSV/JSON)
- [ ] Clip download
- [ ] Browser extension
- [ ] Multi-language support
- [ ] Source real curated playlist IDs into `src/lib/curatedPlaylists.ts` (editorial, blocks the playlist feature from actually showing anything)
- [ ] Migrate `/api/search` off HTML scraping onto the official Data API (retires the remaining ToS exposure)
