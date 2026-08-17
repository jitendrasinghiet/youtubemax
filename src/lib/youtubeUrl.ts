// Deliberately separate from server/youtube.ts's parseVideoId: that module
// also exports fetchOEmbed (outbound fetch, browser-header spoofing deps),
// which has no business in the client bundle. This file stays pure
// string/URL parsing so it's safe to import directly into App.tsx.

/**
 * Extracts the `list=` playlist ID from a pasted YouTube URL, if present.
 * Returns null for bare video IDs, non-YouTube URLs, or URLs with no
 * playlist context — analyze-by-URL should treat that as "no playlist"
 * rather than an error.
 */
export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed || !trimmed.includes('list=')) return null

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const host = url.hostname.replace(/^www\./, '')
    if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtu.be') return null

    const listId = url.searchParams.get('list')
    if (!listId || !/^[a-zA-Z0-9_-]+$/.test(listId)) return null
    return listId
  } catch {
    return null
  }
}
