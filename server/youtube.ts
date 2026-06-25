import type { Chapter } from './types'

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/

export function parseVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (VIDEO_ID_RE.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const host = url.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0]
      return VIDEO_ID_RE.test(id) ? id : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v')
        return id && VIDEO_ID_RE.test(id) ? id : null
      }
      const embedMatch = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/)
      if (embedMatch) return embedMatch[1]
      const shortsMatch = url.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/)
      if (shortsMatch) return shortsMatch[1]
    }
  } catch {
    return null
  }

  return null
}

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function parseTimestamp(text: string): number | null {
  const parts = text.split(':').map((p) => Number(p))
  if (parts.some((n) => Number.isNaN(n))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

export function parseDescriptionChapters(description: string): Chapter[] {
  const chapters: Chapter[] = []
  const lineRe = /^\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s*[-–—:]?\s*(.+)\s*$/gm

  for (const match of description.matchAll(lineRe)) {
    const start = parseTimestamp(match[1])
    const title = match[2].trim()
    if (start !== null && title.length > 0) {
      chapters.push({ start, title, source: 'description' })
    }
  }

  return chapters.sort((a, b) => a.start - b.start)
}

interface OEmbedResponse {
  title: string
  author_name: string
  thumbnail_url: string
}

export async function fetchOEmbed(
  videoId: string,
  customFetch?: typeof fetch,
): Promise<{ title: string; author: string; thumbnail: string }> {
  const fetchFn = customFetch ?? fetch
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  const res = await fetchFn(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch video metadata (${res.status})`)
  }
  const data = (await res.json()) as OEmbedResponse
  return {
    title: data.title,
    author: data.author_name,
    thumbnail: data.thumbnail_url,
  }
}
