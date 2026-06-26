# Strategy Toggle Implementation

## Feature Overview

Users can now choose their preferred **transcript fetching strategy** at runtime directly in the UI without redeploying. Three strategies available:

1. **youtube-transcript (jdepoix)** - Recommended
   - HTML scraping approach
   - No API keys needed
   - No proxy required
   - Fastest for most videos
   - **Installation required:** `npm install youtube-transcript`

2. **Direct (InnerTube)** 
   - YouTube's official API
   - Browser headers with anti-bot detection
   - Faster than proxy if it works
   - No external dependencies

3. **Proxy (InnerTube)**
   - InnerTube API through residential proxy
   - Most reliable for datacenter deployments
   - Requires `YOUTUBE_PROXY_URL` environment variable
   - Can bypass IP-level YouTube blocks

## UI Components

### StrategySelector Component
**Location:** `src/components/StrategySelector.tsx`

```typescript
<StrategySelector
  value={transcriptStrategy}
  onChange={setTranscriptStrategy}
  disabled={loading}
  usedStrategy={result.transcriptStrategy}
/>
```

Features:
- Radio button selection (3 strategies)
- Shows currently used strategy in green badge
- Disabled during analysis
- Descriptive help text for each option
- Dark mode support

## Backend Changes

### server/analyze.ts
- New function: `fetchTranscriptWithStrategy(videoId, browserFetch, preferredStrategy, maxRetries)`
- Supports all three strategies with intelligent fallback
- Logs which strategy succeeded
- Enhanced error messages with strategy context

### server/types.ts
- Added `transcriptStrategy?: 'jdepoix' | 'direct' | 'proxy'` to `AnalyzeResult`
- Tracks which strategy was used for each analysis

### api/analyze.ts
- Accepts new query parameter: `?strategy=jdepoix|direct|proxy`
- Defaults to `'jdepoix'` for best user experience

## Frontend Changes

### src/App.tsx
- New state: `transcriptStrategy` (defaults to 'jdepoix')
- Passes strategy to `analyzeVideo()` call
- Includes `StrategySelector` component in Viewer tab

### src/lib/api.ts
- Updated `analyzeVideo(input, strategy?)` function
- Passes strategy as URL parameter to backend

### src/types.ts
- Updated `AnalyzeResult` interface to include strategy used

## Installation & Deployment

### Local Development
```bash
npm install youtube-transcript
npm run build
npm run preview
```

### Vercel Deployment
```bash
npm install youtube-transcript
git add .
git commit -m "Add transcript strategy toggle"
git push
vercel deploy --prod
```

The `youtube-transcript` dependency is already in `package.json`, so Vercel will install it automatically.

## Runtime Behavior

1. User selects strategy via UI toggle
2. On next analysis, selected strategy is passed to API
3. Backend tries strategies in order:
   - Primary: User's selected strategy
   - Fallback 1: youtube-transcript (if primary failed)
   - Fallback 2: direct InnerTube
   - Fallback 3: proxy InnerTube (if configured)
4. Result shows which strategy succeeded
5. User sees green badge: "Using: jdepoix"

## Testing Checklist

- [x] Build compiles without errors
- [ ] youtube-transcript installs successfully
- [ ] All three strategies can be selected in UI
- [ ] jdepoix strategy fetches transcripts
- [ ] direct strategy works with browser headers
- [ ] proxy strategy works with YOUTUBE_PROXY_URL
- [ ] Fallback chain works correctly
- [ ] Error messages are helpful
- [ ] Dark mode styling applied correctly
- [ ] Mobile responsive (tested on sm, md, lg breakpoints)

## Known Limitations

1. **youtube-transcript not installed by default** - Users must run `npm install youtube-transcript` locally or wait for Vercel to install during deployment
2. **Strategy persists in state** - Resets to 'jdepoix' on page reload (can add localStorage for persistence later)
3. **No analytics** - Can't see which strategy succeeds most often yet (future enhancement)

## Future Enhancements

1. Persist strategy choice in localStorage
2. Add analytics to track strategy success rates
3. Auto-select best strategy based on previous attempts
4. Add strategy recommendation based on video characteristics
5. Implement strategy timeout/fallback timing controls
