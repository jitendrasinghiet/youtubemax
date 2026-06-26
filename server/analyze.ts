import { getVideoDetails } from 'youtube-caption-extractor'
import { resolveChapters } from './chapters.js'
import { extractKeywords } from './keywords.js'
import { createBrowserFetch } from './proxy.js'
import { generateSummary } from './summary.js'
import type { AnalyzeResult, Keyword, TranscriptSegment } from './types.js'
import { fetchOEmbed } from './youtube.js'

// Conditionally import youtube-transcript (may not be installed yet)
let YoutubeTranscript: any = null
try {
  YoutubeTranscript = require('youtube-transcript').YoutubeTranscript
} catch (err) {
  console.warn('[warn] youtube-transcript not installed, will use InnerTube API only')
}

function parseSubtitleStart(start: string): number {
  const n = Number(start)
  return Number.isFinite(n) ? n : 0
}

function parseSubtitleDuration(dur: string): number {
  const n = Number(dur)
  return Number.isFinite(n) ? n : 0
}

/**
 * Fetches transcript using configurable strategy:
 * - 'jdepoix': youtube-transcript package (HTML scraping, no proxy needed)
 * - 'direct': youtube-caption-extractor with direct browser fetch
 * - 'proxy': youtube-caption-extractor with residential proxy
 */
async function fetchTranscriptWithStrategy(
  videoId: string,
  browserFetch: typeof fetch,
  preferredStrategy: 'jdepoix' | 'direct' | 'proxy' = 'jdepoix',
  maxRetries = 2,
): Promise<{
  transcript: TranscriptSegment[]
  title?: string
  description?: string
  strategy: 'jdepoix' | 'direct' | 'proxy'
}> {
  const strategies: Array<'jdepoix' | 'direct' | 'proxy'> = [preferredStrategy]
  
  // Add fallback strategies
  if (preferredStrategy !== 'jdepoix') strategies.push('jdepoix')
  if (preferredStrategy !== 'direct') strategies.push('direct')
  if (preferredStrategy !== 'proxy' && process.env.YOUTUBE_PROXY_URL) strategies.push('proxy')

  for (const strategy of strategies) {
    try {
      console.log(`[${strategy}] Attempting transcript fetch for ${videoId}...`)

      if (strategy === 'jdepoix') {
        // Strategy 1: youtube-transcript (HTML scraping)
        if (!YoutubeTranscript) {
          throw new Error('youtube-transcript not available - run: npm install youtube-transcript')
        }
        const transcript = await YoutubeTranscript.fetchTranscript(videoId)
        console.log(`[${strategy}] Success: ${transcript.length} items`)
        return {
          transcript: transcript.map((item: any) => ({
            start: item.offset || 0,
            duration: item.duration || 0,
            text: item.text,
          })),
          strategy: 'jdepoix',
        }
      } else {
        // Strategies 2 & 3: youtube-caption-extractor (InnerTube API)
        // Both use same backend, just different fetch strategies (direct vs proxy)
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const details = await getVideoDetails({
              videoID: videoId,
              lang: 'en',
              fetch: browserFetch,
            })

            console.log(`[${strategy}] Success on attempt ${attempt + 1}`)
            return {
              transcript: details.subtitles.map((s) => ({
                start: parseSubtitleStart(s.start),
                duration: parseSubtitleDuration(s.dur),
                text: s.text,
              })),
              title: details.title,
              description: details.description,
              strategy: strategy as 'direct' | 'proxy',
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'unknown error'

            // Don't retry on permanent errors
            if (
              message.includes('not found') ||
              message.includes('does not have caption') ||
              message.includes('age-restricted')
            ) {
              throw err
            }

            if (attempt === maxRetries) {
              throw new Error(`${message} (${strategy})`)
            }

            const delayMs = Math.pow(2, attempt) * 1000
            console.log(`[${strategy}] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`)
            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error'
      console.log(`[${strategy}] Failed: ${msg}`)
      // Continue to next strategy
    }
  }

  // All strategies failed
  throw new Error(
    'All transcript strategies failed. Try: (1) youtube-transcript, (2) browser headers, (3) set YOUTUBE_PROXY_URL.',
  )
}

export async function analyzeVideo(
  videoId: string,
  transcriptStrategy: 'jdepoix' | 'direct' | 'proxy' = 'jdepoix',
): Promise<AnalyzeResult> {
  const warnings: string[] = []
  // Use browser-like fetch (tries direct with headers first, proxy as fallback)
  const browserFetch = await createBrowserFetch()

  let title = ''
  let author = ''
  let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  let description = ''
  let transcript: TranscriptSegment[] = []
  let usedStrategy: 'jdepoix' | 'direct' | 'proxy' = 'jdepoix'

  try {
    // oEmbed (metadata) - use browser fetch with headers
    const oembed = await fetchOEmbed(videoId, browserFetch)
    title = oembed.title
    author = oembed.author
    thumbnail = oembed.thumbnail
  } catch (err) {
    warnings.push(
      `Could not load oEmbed metadata: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }

  // --- START OF TRANSCRIPT FETCH ---
  let transcriptFetched = false
  try {
    const result = await fetchTranscriptWithStrategy(
      videoId,
      browserFetch,
      transcriptStrategy,
    )
    transcript = result.transcript
    usedStrategy = result.strategy
    // Update title and description from transcript fetch if available
    if (result.title) title = result.title
    if (result.description) description = result.description
    transcriptFetched = true
    console.log(`✓ Transcript fetched using "${usedStrategy}" strategy`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    warnings.push(`Transcript fetch failed: ${message}`)

    // Provide helpful context about why transcripts fail
    if (message.includes('InnerTube') || message.includes('proxy')) {
      warnings.push(
        'Try switching to a different strategy using the UI toggle (youtube-transcript, direct, or proxy)',
      )
    }
  }

  if (!transcriptFetched) {
    // Fallback if transcript fetching failed
    warnings.push('Transcript is unavailable. Chapters and summary might be incomplete.')
  }
  // --- END OF TRANSCRIPT FETCH ---

  const chapters = resolveChapters(description, transcript)
  const summary = generateSummary(transcript)
  const resolvedTitle = title || 'Unknown video'
  const baseKeywords = extractKeywords(transcript, summary, resolvedTitle, description)
  const seenTerms = new Set(baseKeywords.map((k) => k.term.toLowerCase()))
  const chapterKeywords: Keyword[] = chapters
    .filter((c) => c.source === 'description')
    .map((c) => ({ term: c.title, score: 0.7, source: 'chapter' as const }))
    .filter((ck) => !seenTerms.has(ck.term.toLowerCase()))
  const keywords = [...baseKeywords, ...chapterKeywords]

  return {
    meta: {
      videoId,
      title: resolvedTitle,
      author: author || 'Unknown channel',
      thumbnail,
      description,
    },
    chapters,
    summary,
    keywords,
    transcript,
    warnings,
    transcriptStrategy: usedStrategy,
  }
}

