import type { Chapter, TranscriptSegment } from './types'
import { parseDescriptionChapters } from './youtube'

const TARGET_CHAPTER_SECONDS = 90
const MIN_CHAPTER_SECONDS = 45
const PAUSE_GAP_SECONDS = 2.5

function cleanChapterTitle(text: string, maxLen = 72): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLen) return cleaned
  return `${cleaned.slice(0, maxLen - 1).trimEnd()}…`
}

export function generateChaptersFromTranscript(
  segments: TranscriptSegment[],
): Chapter[] {
  if (segments.length === 0) return []

  const chapters: Chapter[] = []
  let clusterStart = segments[0].start
  let clusterText = segments[0].text
  let clusterEnd = segments[0].start + segments[0].duration
  let lastEnd = clusterEnd

  const pushChapter = () => {
    const title = cleanChapterTitle(clusterText)
    if (title) {
      chapters.push({ start: clusterStart, title, source: 'transcript' })
    }
  }

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]
    const gap = seg.start - lastEnd
    const chapterDuration = clusterEnd - clusterStart
    const pauseBreak = gap >= PAUSE_GAP_SECONDS
    const timeBreak = chapterDuration >= TARGET_CHAPTER_SECONDS

    if (pauseBreak || timeBreak) {
      if (chapterDuration >= MIN_CHAPTER_SECONDS || pauseBreak) {
        pushChapter()
        clusterStart = seg.start
        clusterText = seg.text
      } else {
        clusterText += ` ${seg.text}`
      }
    } else {
      clusterText += ` ${seg.text}`
    }

    clusterEnd = seg.start + seg.duration
    lastEnd = clusterEnd
  }

  if (chapters.length === 0 || chapters[chapters.length - 1].start !== clusterStart) {
    pushChapter()
  }

  return chapters
}

export function resolveChapters(
  description: string,
  segments: TranscriptSegment[],
): Chapter[] {
  const fromDescription = parseDescriptionChapters(description)
  if (fromDescription.length >= 2) {
    return fromDescription.map((c: Chapter) => ({ ...c, source: 'description' as const }))
  }

  const fromTranscript = generateChaptersFromTranscript(segments)
  if (fromTranscript.length > 0) return fromTranscript

  if (segments.length > 0) {
    return [
      {
        start: segments[0].start,
        title: 'Start',
        source: 'transcript',
      },
    ]
  }

  return []
}
