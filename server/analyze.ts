import { getVideoDetails } from 'youtube-caption-extractor'
import { resolveChapters } from './chapters.js'
import { extractKeywords } from './keywords.js'
import { createProxyFetch } from './proxy.js'
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

export async function analyzeVideo(videoId: string): Promise<AnalyzeResult> {
  const warnings: string[] = []
  const customFetch = await createProxyFetch()

  let title = ''
  let author = ''
  let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  let description = ''
  let transcript: TranscriptSegment[] = []

  try {
    const oembed = await fetchOEmbed(videoId, customFetch)
    title = oembed.title
    author = oembed.author
    thumbnail = oembed.thumbnail
  } catch (err) {
    warnings.push(
      `Could not load oEmbed metadata: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }

  // --- START OF MODIFICATION ---
  let transcriptFetched = false;
  try {
    const details = await getVideoDetails({
      videoID: videoId,
      lang: 'en',
      fetch: customFetch, // Use customFetch (proxy) if available
    })
    title = details.title || title
    description = details.description ?? ''
    transcript = details.subtitles.map((s) => ({
      start: parseSubtitleStart(s.start),
      duration: parseSubtitleDuration(s.dur),
      text: s.text,
    }))
    transcriptFetched = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    warnings.push(`Transcript fetch failed: ${message}`)
    if (customFetch === undefined && process.env.NODE_ENV === 'production') {
      warnings.push(
        'YouTube often blocks transcript requests from cloud hosts. Set YOUTUBE_PROXY_URL to a residential proxy for production.',
      )
    } else if (customFetch !== undefined) {
      warnings.push(
        'Transcript fetch failed even with proxy. The proxy might be misconfigured or blocked.',
      );
    }
  }

  if (!transcriptFetched) {
    // Fallback if transcript fetching failed
    warnings.push('Transcript is unavailable. Chapters and summary might be incomplete.');
    // We can also set default/empty values for chapters, summary, keywords if needed
    // based on whether they can still be derived meaningfully without a transcript.
    // For now, we'll let the subsequent logic run with an empty transcript.
  }
  // --- END OF MODIFICATION ---

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

