import { getVideoDetails } from 'youtube-caption-extractor'
import { resolveChapters } from './chapters.js'
import { extractKeywords } from './keywords.js'
import { createBrowserFetch } from './proxy.js'
import { generateSummary } from './summary.js'
import type { AnalyzeResult, Keyword, TranscriptSegment } from './types.js'
import { fetchOEmbed } from './youtube.js'

function parseSubtitleStart(start: string): number {
  const n = Number(start)
  return Number.isFinite(n) ? n : 0
}

function parseSubtitleDuration(dur: string): number {
  const n = Number(dur)
  return Number.isFinite(n) ? n : 0
}

/**
 * Fetches transcript with exponential backoff retry logic.
 * YouTube's InnerTube API sometimes returns transient errors (522, 500).
 * Retry helps with intermittent failures.
 */
async function fetchTranscriptWithRetry(
  videoId: string,
  customFetch: typeof fetch,
  maxRetries = 2,
): Promise<{
  transcript: TranscriptSegment[]
  title?: string
  description?: string
}> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const details = await getVideoDetails({
        videoID: videoId,
        lang: 'en',
        fetch: customFetch,
      })

      return {
        transcript: details.subtitles.map((s) => ({
          start: parseSubtitleStart(s.start),
          duration: parseSubtitleDuration(s.dur),
          text: s.text,
        })),
        title: details.title,
        description: details.description,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      
      // Don't retry on certain errors
      if (message.includes('not found') || message.includes('does not have caption') || 
          message.includes('age-restricted')) {
        throw err
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        throw err
      }

      // Wait before retrying (exponential backoff: 1s, 2s)
      const delayMs = Math.pow(2, attempt) * 1000
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return { transcript: [] }
}

export async function analyzeVideo(videoId: string): Promise<AnalyzeResult> {
  const warnings: string[] = []
  // Use browser-like fetch (tries direct with headers first, proxy as fallback)
  const browserFetch = await createBrowserFetch()

  let title = ''
  let author = ''
  let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  let description = ''
  let transcript: TranscriptSegment[] = []

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
  let transcriptFetched = false;
  try {
    const result = await fetchTranscriptWithRetry(videoId, browserFetch)
    transcript = result.transcript
    // Update title and description from transcript fetch if available
    if (result.title) title = result.title
    if (result.description) description = result.description
    transcriptFetched = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    warnings.push(`Transcript fetch failed: ${message}`)
    
    // Provide helpful context about why transcripts fail
    if (message.includes('InnerTube')) {
      warnings.push(
        'YouTube\'s anti-bot protection is strict. If browser identity headers didn\'t work, try a residential proxy service (Oxylabs, BrightData).',
      );
    } else if (process.env.NODE_ENV === 'production') {
      warnings.push(
        'If using browser headers doesn\'t work, set YOUTUBE_PROXY_URL to a residential proxy for production.',
      )
    }
  }

  if (!transcriptFetched) {
    // Fallback if transcript fetching failed
    warnings.push('Transcript is unavailable. Chapters and summary might be incomplete.');
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
  }
}

