# YouTubeMax Architecture

## Overview

YouTubeMax is a **React + TypeScript frontend** with **Node.js serverless backend** architecture designed for maximum portability and zero infrastructure overhead.

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (React)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ App.tsx (state orchestration)                        │   │
│  │ ├─ Components: VideoPlayer, ChapterList, etc        │   │
│  │ ├─ Hooks: useKeywordMasterList                      │   │
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
│  ├─ server/summary.ts                                      │
│  └─ server/youtube.ts                                      │
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

All state lives in **App.tsx** and custom hooks:

```typescript
// Video & Analysis
const [result, setResult] = useState<AnalyzeResult | null>(null)
const [loading, setLoading] = useState(false)

// Search & Discovery
const [searchQuery, setSearchQuery] = useState('')
const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
const [searchLoading, setSearchLoading] = useState(false)

// Player
const [playStart, setPlayStart] = useState(0)
const [clipMode, setClipMode] = useState(false)
const [clipIndex, setClipIndex] = useState(0)

// UI
const [activeTab, setActiveTab] = useState<'discovery' | 'viewer'>('discovery')
const [showFilteredChapters, setShowFilteredChapters] = useState(false)
const [showSummary, setShowSummary] = useState(true)

// Master Keywords (from hook)
const { keywords, ingestFromAnalysis, removeKeyword, clearKeywords } = useKeywordMasterList()
```

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
│  ├─ Discovery Search Bar (search query input)
│  ├─ Master List (floating overlay, always visible)
│  ├─ Tabs Navigation
│  └─ Tab Content
│     ├─ Discovery Tab
│     │  └─ Grid of video cards (4-column responsive)
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
ChapterList.onPlayClips()
    ├─ setClipMode(true)
    ├─ setClipIndex(0)
    └─ setPlayStart(displayedChapters[0].start)
    ↓
useEffect watches clipMode & calculates duration
    ├─ Find next filtered chapter
    ├─ Duration = nextChapter.start - currentChapter.start
    └─ setTimeout(() => setClipIndex(i+1))
    ↓
VideoPlayer changes startAt prop
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

**Input:** `q` (search query), `maxResults` (1-50, default 12)

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

---

## Build & Deployment

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

### Unit Tests

```typescript
// src/__tests__/keywords.test.ts
import { pruneNoise } from '../hooks/useKeywordMasterList'

describe('pruneNoise', () => {
  it('removes substrings of higher-scoring keywords', () => {
    const keywords = [
      { term: 'react', score: 10 },
      { term: 'react hooks', score: 15 }
    ]
    const result = pruneNoise(keywords)
    expect(result).toHaveLength(1)
    expect(result[0].term).toBe('react hooks')
  })
})
```

### Integration Tests

```typescript
// src/__tests__/api.test.ts
describe('analyzeVideo', () => {
  it('fetches and analyzes video', async () => {
    const result = await analyzeVideo('dQw4w9WgXcQ')
    expect(result.meta.videoId).toBe('dQw4w9WgXcQ')
    expect(result.chapters.length).toBeGreaterThan(0)
    expect(result.keywords.length).toBeGreaterThan(0)
  })
})
```

### E2E Tests

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

1. **No API keys stored** — All APIs are public (oEmbed, caption extraction)
2. **User input validation** — VideoID validated before API calls
3. **HTTPS only** — Vercel auto-enforces TLS
4. **CORS headers** — API functions should set appropriate CORS headers
5. **Rate limiting** — Implement on Vercel to prevent abuse

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
- [ ] Playlist analysis
- [ ] Custom chapter creation
- [ ] Keyword export (CSV/JSON)
- [ ] Clip download
- [ ] Browser extension
- [ ] Multi-language support
