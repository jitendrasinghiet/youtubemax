export interface Keyword {
  term: string
  score: number
  source: 'title' | 'chapter' | 'summary' | 'transcript'
  frequency?: number // occurrences in transcript
  chapterSpread?: number // count of unique chapters containing term
}

export interface SearchResultItem {
  videoId: string
  title: string
  channel: string
  thumbnail: string
  publishedAt: string
  description: string
  viewCount?: string
  duration?: string
}

export interface TranscriptSegment {
  start: number
  duration: number
  text: string
}

export interface Chapter {
  start: number
  title: string
  source: 'description' | 'transcript' | 'api'
}

export interface VideoMeta {
  videoId: string
  title: string
  author: string
  thumbnail: string
  description: string
}

export interface AnalyzeResult {
  meta: VideoMeta
  chapters: Chapter[]
  summary: string
  keywords: Keyword[]
  transcript: TranscriptSegment[]
  warnings: string[]
}

export interface MasterKeyword {
  term: string
  score: number
  source: Keyword['source']
  fromVideoId: string
  fromTitle: string
  frequency?: number
  chapterSpread?: number
}

export interface SearchResponse {
  results: SearchResultItem[]
  searchUrl: string
  warning?: string
}
