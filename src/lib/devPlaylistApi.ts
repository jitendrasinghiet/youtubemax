import type { PlaylistSearchResultItem, SearchResultItem } from '../types'

export interface LocalPlaylistItem {
  videoId: string
  title: string
  channel: string
  thumbnail: string
  position: number
}

export interface LocalPlaylist {
  slug: string
  label: string
  icon: string
  channel: string
  loadedVia: 'id' | 'url' | 'search' | 'manual'
  sourcePlaylistId: string | null
  lastPulledAt: string | null
  lastEditedAt: string
  items: LocalPlaylistItem[]
}

async function asJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${res.status})`)
  }
  return data as T
}

export async function searchYouTubePlaylists(query: string): Promise<PlaylistSearchResultItem[]> {
  const res = await fetch(`/api/dev/playlist-search?q=${encodeURIComponent(query)}`)
  const data = await asJson<{ results: PlaylistSearchResultItem[] }>(res)
  return data.results
}

export async function listDevPlaylists(): Promise<LocalPlaylist[]> {
  const res = await fetch('/api/dev/playlists')
  const data = await asJson<{ playlists: LocalPlaylist[] }>(res)
  return data.playlists
}

export async function createDevPlaylist(input: {
  label: string
  icon?: string
  channel?: string
  loadedVia: LocalPlaylist['loadedVia']
  sourcePlaylistId?: string | null
  seedResults?: SearchResultItem[]
}): Promise<LocalPlaylist> {
  const res = await fetch('/api/dev/playlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await asJson<{ playlist: LocalPlaylist }>(res)
  return data.playlist
}

export async function updateDevPlaylistMeta(
  slug: string,
  patch: Partial<Pick<LocalPlaylist, 'label' | 'icon' | 'channel'>>,
): Promise<LocalPlaylist> {
  const res = await fetch(`/api/dev/playlists/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = await asJson<{ playlist: LocalPlaylist }>(res)
  return data.playlist
}

export async function deleteDevPlaylist(slug: string): Promise<void> {
  const res = await fetch(`/api/dev/playlists/${encodeURIComponent(slug)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${res.status})`)
  }
}

export async function addDevPlaylistItem(
  slug: string,
  item: { videoId: string; title: string; channel: string; thumbnail: string },
): Promise<LocalPlaylist> {
  const res = await fetch(`/api/dev/playlists/${encodeURIComponent(slug)}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  })
  const data = await asJson<{ playlist: LocalPlaylist }>(res)
  return data.playlist
}

export async function removeDevPlaylistItem(slug: string, videoId: string): Promise<LocalPlaylist> {
  const res = await fetch(`/api/dev/playlists/${encodeURIComponent(slug)}/items/${encodeURIComponent(videoId)}`, {
    method: 'DELETE',
  })
  const data = await asJson<{ playlist: LocalPlaylist }>(res)
  return data.playlist
}

export async function reorderDevPlaylistItems(slug: string, orderedVideoIds: string[]): Promise<LocalPlaylist> {
  const res = await fetch(`/api/dev/playlists/${encodeURIComponent(slug)}/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedVideoIds }),
  })
  const data = await asJson<{ playlist: LocalPlaylist }>(res)
  return data.playlist
}
