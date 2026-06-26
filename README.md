# YouTubeMax

A powerful, standalone **React + TypeScript** SPA for intelligent YouTube video analysis with auto-generated chapters, transcript summarization, and smart keyword extraction. Deploy instantly to Vercel, Netlify, or any static host—no backend required.

**Live Features:**
- 🎬 **Auto-Generated Chapters** — Extract from video descriptions or generate from captions
- 📝 **Smart Summaries** — Extractive summarization (no paid AI APIs required)
- 🏷️ **Keyword Master List** — Extract context-aware keywords from title, chapters, summary, and transcript with dynamic noise pruning
- 🔍 **Video Discovery** — Search YouTube and analyze results in-context
- ▶️ **Smart Clip Mode** — Filter chapters by keywords and auto-play sequential clips
- 🎯 **Real-time Filtering** — Click keywords to filter chapters instantly
- 📊 **Full Transcript Viewer** — Browse complete captions with searchable text
- ⚡ **Zero Configuration Deploy** — Works on Vercel, Netlify, GitHub Pages with serverless functions

---

## Quick Start

### Local Development

```bash
# Clone and install
git clone <repo-url>
cd youtubemax
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and paste any YouTube URL or video ID.

### Build

```bash
npm run build
npm run preview
```

### Deploy to Vercel

```bash
npm i -g vercel
vercel
```

---

## Table of Contents

- [Features in Detail](#features-in-detail)
- [Architecture](#architecture)
- [Use Cases](#use-cases)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

---

## Features in Detail

### 1. **Video Analysis**
Paste a YouTube URL or 11-character video ID to extract:
- Video metadata (title, author, thumbnail, description)
- Captions/transcript with timestamps
- Description-based chapter timestamps (if present)
- Extractive summary
- Context-aware keywords from 4 sources

### 2. **Intelligent Keyword Extraction**
Keywords extracted from **four sources** with weighted scoring:

| Source | Weight | Use Case |
|--------|--------|----------|
| **Title** | 4.0x | Core topic indicators |
| **Chapter Titles** | 0.7x | Section-specific topics |
| **Summary** | 3.0x | Main themes |
| **Transcript** | 1.0x | Full context |

**Dynamic Noise Pruning** removes:
- Terms appearing >2σ above mean frequency (repetitive filler)
- Terms in >80% of chapters (overly generic)
- Substring duplicates (keeps more specific variants)

### 3. **Real-Time Chapter Filtering**
Select keywords → Auto-filter chapters to matches. Active keywords highlighted in emerald; search terms highlighted in filtered chapter titles.

### 4. **Clip Mode Auto-Advance**
Select "Play Clips" to auto-advance through filtered chapters with duration = next filtered chapter start time.

### 5. **Video Discovery Search**
Search YouTube videos by keyword (4-column responsive grid). Shows title, channel, view count, upload date, duration.

### 6. **Compact UI**
- Collapsible Master List (header + 1 line, expands on hover)
- Tabbed Navigation (Discovery | Viewer)
- Collapsible Summary & Transcript sections
- Floating overlays (no layout shifting)

---

## Architecture

### Tech Stack

```
Frontend: React 19 + TypeScript + Tailwind CSS
Build: Vite (dev server with API middleware)
Backend: Node.js serverless (Vercel Functions)
Data: YouTube oEmbed, Caption Extractor, Description Parsing
```

### Project Structure

```
youtubemax/
├── src/
│   ├── components/            # React UI components
│   ├── hooks/
│   │   └── useKeywordMasterList.ts  # Keyword state + pruning
│   ├── lib/api.ts             # API calls & formatting
│   ├── types.ts               # Shared interfaces
│   └── App.tsx                # Main layout
├── server/
│   ├── analyze.ts             # Video analysis logic
│   ├── search.ts              # YouTube search logic
│   ├── keywords.ts            # Keyword extraction
│   ├── summary.ts             # Summarization
│   ├── chapters.ts            # Chapter parsing
│   └── youtube.ts             # YouTube API wrapper
├── api/                       # Vercel serverless functions
├── vite.config.ts
├── vercel.json
└── package.json
```

### Key Flows

**Video Analysis:**
```
User Input → fetch /api/analyze → server processes → returns AnalyzeResult
```

**Keyword Filtering:**
```
Click keyword → toggle in searchQuery → recompute filteredChapters → display
```

**Clip Mode:**
```
"Play Clips" → setClipMode(true) → setTimeout on each clip → auto-advance through filtered chapters
```

---

## Use Cases

### Educational Content
Extract key topics from lectures. Create study guides by filtering keywords. Share specific clips.

### Podcast Discovery
Find specific segments in long episodes. Cross-reference topics. Build searchable keyword database.

### Content Curation
Aggregate keywords from multiple videos. Identify overlapping topics. Create comparison docs.

### Research & Transcripts
Search caption text. Identify speaker's arguments. Build quote database by chapter.

### Video Accessibility
Read auto-generated summaries. Scan keywords for relevant sections. Watch filtered clips instead of full video.

### SEO & Competition Analysis
Analyze competitor video keywords. Identify untapped topics. Optimize your content strategy.

---

## API Reference

### `GET /api/analyze?videoId=<id>`

**Analyze a YouTube video.**

Returns: `{ meta, chapters, summary, keywords, transcript, warnings }`

**Example:**
```bash
curl "http://localhost:5173/api/analyze?videoId=dQw4w9WgXcQ"
```

---

### `GET /api/search?q=<query>&maxResults=12`

**Search YouTube videos.**

Returns: `{ results: SearchResultItem[], warning?: string }`

---

## Deployment

### Vercel (Recommended)

```bash
vercel
```

Auto-configures via `vercel.json`. Free tier includes serverless functions and 100GB bandwidth.

### Netlify

```bash
npm run build
netlify deploy --prod --dir=dist
```

### Environment Variables

**For transcript proxying (if captions fail in production):**

```bash
YOUTUBE_PROXY_URL=http://proxy-provider.com:8080
npm install undici  # Optional proxy support
```

---

## Development

### Local Setup

```bash
npm install
npm run dev    # Starts dev server with API middleware
npm run build  # Production build
npm run lint   # TypeScript & linting
```

### Code Style

- **TypeScript** strict mode
- **Tailwind CSS** for styling
- **React hooks** (no class components)
- **Descriptive names** + comments for complex logic

### Adding Features

```typescript
// Example: Export transcript
import { useState } from 'react'

export function TranscriptExport({ segments }) {
  const handleExport = () => {
    const text = segments.map(s => s.text).join(' ')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transcript.txt'
    a.click()
  }

  return <button onClick={handleExport}>Export</button>
}
```

---

## Troubleshooting

### "Video not found or restricted"
Video doesn't exist, is private, or age-restricted. Verify on YouTube directly.

### "Captions not available"
Video has no captions. Enable auto-generated captions in YouTube settings.

### "Failed to fetch transcript (production)"
YouTube blocks datacenter IPs. Set up residential proxy (see Environment Variables).

### "Build fails with TypeScript errors"
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## Contributing

**Report Issues:**
- Use GitHub Issues with clear reproduction steps
- Include environment info (browser, OS, Node version)

**Submit PRs:**
```bash
git checkout -b feature/my-feature
git commit -m "feat: description"
git push origin feature/my-feature
```

Update documentation for new features. Test before submitting.

---

## License

MIT — Free to use, modify, distribute.

---

## How It Works

| Component | Data Source |
|-----------|-------------|
| Video metadata | YouTube oEmbed API (no key) |
| Captions | youtube-caption-extractor |
| Chapters | Description timestamps or caption clustering |
| Summary | Extractive scoring on transcript |
| Keywords | TF-weighted terms from title, summary, transcript |
| Search | YouTube results page scraping |

---

**Happy analyzing! 🎬**
