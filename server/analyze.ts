import { getVideoDetails } from 'youtube-caption-extractor'
import { resolveChapters } from './chapters'
import { extractKeywords } from './keywords'
import { createProxyFetch } from './proxy'
import { generateSummary } from './summary'
import type { AnalyzeResult, TranscriptSegment } from './types'
import { fetchOEmbed } from './youtube'

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

  try {
    const details = await getVideoDetails({
      videoID: videoId,
      lang: 'en',
      fetch: customFetch,
    })
    title = details.title || title
    description = details.description ?? ''
    transcript = details.subtitles.map((s) => ({
      start: parseSubtitleStart(s.start),
      duration: parseSubtitleDuration(s.dur),
      text: s.text,
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    warnings.push(`Transcript fetch failed: ${message}`)
    if (!customFetch && process.env.NODE_ENV === 'production') {
      warnings.push(
        'YouTube often blocks transcript requests from cloud hosts. Set YOUTUBE_PROXY_URL to a residential proxy for production.',
      )
    }
  }

  const chapters = resolveChapters(description, transcript)
  const summary = generateSummary(transcript)
  const resolvedTitle = title || 'Unknown video'
  const keywords = extractKeywords(transcript, summary, resolvedTitle, description)

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
