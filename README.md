# YouTubeMax

A standalone SPA for browsing YouTube videos with **auto-generated chapters** and **transcript-based summaries**. Deploy for free on Vercel, Netlify, or any static host with serverless functions.

## Features

- Paste any YouTube URL or 11-character video ID
- **Chapters** from description timestamps (when present) or auto-generated from caption timing
- **Quick summary** via extractive summarization — no OpenAI or paid AI API required
- **Keyword master list** — transcript/summary terms as clickable crumbs that build an editable search query
- **Video discovery** — search via YouTube results URL (no API key); open on YouTube anytime
- Embedded player with clickable chapter navigation
- Full transcript viewer
- Works locally with Vite dev server API middleware
- Production API route for Vercel serverless

## Quick start

```bash
cd c:/dev/youtubemax
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and paste a YouTube link.

## Deploy to Vercel

```bash
npm i -g vercel   # or use the Vercel dashboard
vercel
```

Or connect the repo in the Vercel dashboard. No extra configuration needed — `vercel.json` handles SPA routing and `/api/analyze` is auto-detected.

### Transcript fetching on cloud hosts

YouTube often **blocks transcript requests from datacenter IPs** (Vercel, AWS Lambda, etc.). Metadata (title, thumbnail) usually works; captions may fail in production without a proxy.

If transcripts fail after deploy:

1. Set `YOUTUBE_PROXY_URL` in Vercel environment variables to a **residential** proxy URL.
2. Install `undici` (optional dependency for proxy support):

   ```bash
   npm install undici
   ```

Local development on a home network typically works without a proxy.

## How it works

| Step | Source |
|------|--------|
| Video title, author, thumbnail | YouTube oEmbed API (no key) |
| Description & captions | `youtube-caption-extractor` (no official API key) |
| Chapters | Description `0:00` lines, else caption clustering (~90s segments + pause detection) |
| Summary | Extractive scoring over transcript sentences |
| Keywords | TF-weighted terms + phrases from title, summary, and transcript |
| Video search | YouTube `/results?search_query=` page + innertube fallback (no API key) |

## API

```
GET /api/analyze?videoId=<url-or-id>
GET /api/search?q=<query>&maxResults=12
```

Returns JSON: `meta`, `chapters`, `summary`, `transcript`, `warnings`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with API middleware |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |

## License

MIT
