import { useCallback, useEffect, useState } from 'react'
import { analyzeVideo, fetchPlaylistResults } from '../lib/api'
import { parsePlaylistId } from '../lib/youtubeUrl'
import {
  addDevPlaylistItem,
  createDevPlaylist,
  deleteDevPlaylist,
  fetchDevPlaylistMeta,
  listDevPlaylists,
  removeDevPlaylistItem,
  searchYouTubePlaylists,
  updateDevPlaylistMeta,
  type LocalPlaylist,
} from '../lib/devPlaylistApi'
import type { PlaylistSearchResultItem } from '../types'

interface PlaylistManagerPanelProps {
  onClose: () => void
}

type LoadTab = 'id' | 'url' | 'search'

export function PlaylistManagerPanel({ onClose }: PlaylistManagerPanelProps) {
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)

  const [loadTab, setLoadTab] = useState<LoadTab>('id')
  const [idInput, setIdInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PlaylistSearchResultItem[]>([])
  const [labelInput, setLabelInput] = useState('')
  const [loadingAction, setLoadingAction] = useState(false)

  const [addItemInput, setAddItemInput] = useState('')
  const [addItemBusy, setAddItemBusy] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setPlaylists(await listDevPlaylists())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load local playlists')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const seedFromPlaylistId = useCallback(
    async (playlistId: string, loadedVia: LocalPlaylist['loadedVia'], defaultLabel: string) => {
      setLoadingAction(true)
      setError(null)
      try {
        const { results } = await fetchPlaylistResults(playlistId, 50)

        // Best-effort: an ID/URL load has no real title/channel to go on
        // (search loads already pass the real title as defaultLabel). If
        // this fails — no API key, quota, bad ID — fall back to the
        // generic "Playlist <id>" label rather than blocking the load.
        let meta: { title: string; channel: string } | undefined
        if (loadedVia === 'id' || loadedVia === 'url') {
          meta = await fetchDevPlaylistMeta(playlistId).catch(() => undefined)
        }

        const label = labelInput.trim() || meta?.title || defaultLabel
        await createDevPlaylist({
          label,
          channel: meta?.channel,
          loadedVia,
          sourcePlaylistId: playlistId,
          seedResults: results,
        })
        setLabelInput('')
        setIdInput('')
        setUrlInput('')
        setSearchResults([])
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load playlist')
      } finally {
        setLoadingAction(false)
      }
    },
    [labelInput, refresh],
  )

  const handleLoadById = useCallback(() => {
    const id = idInput.trim()
    if (!id) return
    void seedFromPlaylistId(id, 'id', `Playlist ${id}`)
  }, [idInput, seedFromPlaylistId])

  const handleLoadByUrl = useCallback(() => {
    const playlistId = parsePlaylistId(urlInput)
    if (!playlistId) {
      setError('No &list= playlist ID found in that URL')
      return
    }
    void seedFromPlaylistId(playlistId, 'url', `Playlist ${playlistId}`)
  }, [urlInput, seedFromPlaylistId])

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim()
    if (!q) return
    setLoadingAction(true)
    setError(null)
    try {
      setSearchResults(await searchYouTubePlaylists(q))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Playlist search failed')
    } finally {
      setLoadingAction(false)
    }
  }, [searchQuery])

  const handleCreateEmpty = useCallback(async () => {
    const label = labelInput.trim()
    if (!label) return
    setLoadingAction(true)
    setError(null)
    try {
      await createDevPlaylist({ label, loadedVia: 'manual' })
      setLabelInput('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playlist')
    } finally {
      setLoadingAction(false)
    }
  }, [labelInput, refresh])

  const handleDelete = useCallback(
    async (slug: string) => {
      if (
        !window.confirm(
          `Delete local playlist "${slug}"? This only removes the local file, not anything on YouTube.`,
        )
      ) {
        return
      }
      try {
        await deleteDevPlaylist(slug)
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete playlist')
      }
    },
    [refresh],
  )

  const handleRemoveItem = useCallback(async (slug: string, videoId: string) => {
    try {
      const updated = await removeDevPlaylistItem(slug, videoId)
      setPlaylists((current) => current.map((p) => (p.slug === slug ? updated : p)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item')
    }
  }, [])

  const handleAddItem = useCallback(
    async (slug: string) => {
      const input = addItemInput.trim()
      if (!input) return
      setAddItemBusy(true)
      setError(null)
      try {
        const data = await analyzeVideo(input)
        const updated = await addDevPlaylistItem(slug, {
          videoId: data.meta.videoId,
          title: data.meta.title,
          channel: data.meta.author,
          thumbnail: data.meta.thumbnail,
        })
        setPlaylists((current) => current.map((p) => (p.slug === slug ? updated : p)))
        setAddItemInput('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add item')
      } finally {
        setAddItemBusy(false)
      }
    },
    [addItemInput],
  )

  const handleRename = useCallback(async (slug: string, currentLabel: string) => {
    const next = window.prompt('Rename local playlist entry', currentLabel)
    if (!next || next.trim() === currentLabel) return
    try {
      const updated = await updateDevPlaylistMeta(slug, { label: next.trim() })
      setPlaylists((current) => current.map((p) => (p.slug === slug ? updated : p)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename playlist')
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10">
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-zinc-950 p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            🛠 Playlist Manager <span className="text-zinc-500">(local dev only)</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:text-white"
          >
            Close
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</p>
        )}

        <div className="mb-4 rounded-lg border border-white/10 p-3">
          <div className="mb-2 flex gap-1">
            {(['id', 'url', 'search'] as LoadTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setLoadTab(tab)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                  loadTab === tab ? 'bg-red-500/20 text-red-200' : 'text-zinc-400 hover:text-white'
                }`}
              >
                By {tab === 'id' ? 'ID' : tab === 'url' ? 'URL' : 'Search'}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Label for this playlist (optional — required for manual create)"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            className="mb-2 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600"
          />

          {loadTab === 'id' && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Playlist ID (PL...)"
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600"
              />
              <button
                type="button"
                onClick={handleLoadById}
                disabled={loadingAction || !idInput.trim()}
                className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 disabled:opacity-40"
              >
                Load
              </button>
            </div>
          )}

          {loadTab === 'url' && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://youtube.com/watch?v=...&list=..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600"
              />
              <button
                type="button"
                onClick={handleLoadByUrl}
                disabled={loadingAction || !urlInput.trim()}
                className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 disabled:opacity-40"
              >
                Load
              </button>
            </div>
          )}

          {loadTab === 'search' && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search YouTube playlists…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => void handleSearch()}
                  disabled={loadingAction || !searchQuery.trim()}
                  className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 disabled:opacity-40"
                >
                  Search
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="flex flex-col gap-1">
                  {searchResults.map((r) => (
                    <button
                      key={r.playlistId}
                      type="button"
                      onClick={() => {
                        setLabelInput((current) => current || r.title)
                        void seedFromPlaylistId(r.playlistId, 'search', r.title)
                      }}
                      className="flex items-center gap-2 rounded-md border border-white/5 bg-black/20 p-1.5 text-left hover:border-white/20"
                    >
                      {r.thumbnail && <img src={r.thumbnail} alt="" className="h-8 w-14 rounded object-cover" />}
                      <div className="min-w-0">
                        <p className="truncate text-[11px] text-white">{r.title}</p>
                        <p className="truncate text-[10px] text-zinc-500">{r.channel}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => void handleCreateEmpty()}
              disabled={loadingAction || !labelInput.trim()}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
            >
              or create an empty playlist with this label
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-zinc-500">Loading local playlists…</p>
        ) : playlists.length === 0 ? (
          <p className="text-xs text-zinc-500">No local playlists yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {playlists.map((p) => (
              <div key={p.slug} className="rounded-lg border border-white/10 p-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedSlug((current) => (current === p.slug ? null : p.slug))}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span>{p.icon}</span>
                    <span className="truncate text-xs font-medium text-white">{p.label}</span>
                    <span className="text-[10px] text-zinc-500">
                      {p.items.length} item{p.items.length === 1 ? '' : 's'} · {p.loadedVia}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRename(p.slug, p.label)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(p.slug)}
                    className="text-[10px] text-red-400/70 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>

                {expandedSlug === p.slug && (
                  <div className="mt-2 flex flex-col gap-2 border-t border-white/5 pt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add video by URL or ID…"
                        value={addItemInput}
                        onChange={(e) => setAddItemInput(e.target.value)}
                        className="flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white placeholder:text-zinc-600"
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddItem(p.slug)}
                        disabled={addItemBusy || !addItemInput.trim()}
                        className="rounded-md bg-red-500/20 px-2 py-1 text-[11px] font-medium text-red-200 disabled:opacity-40"
                      >
                        Add
                      </button>
                    </div>

                    {p.items.length === 0 ? (
                      <p className="text-[11px] text-zinc-600">No items yet.</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {p.items
                          .slice()
                          .sort((a, b) => a.position - b.position)
                          .map((item) => (
                            <div key={item.videoId} className="flex items-center gap-2 rounded-md bg-black/20 p-1.5">
                              <img src={item.thumbnail} alt="" className="h-8 w-14 rounded object-cover" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] text-white">{item.title}</p>
                                <p className="truncate text-[10px] text-zinc-500">{item.channel}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleRemoveItem(p.slug, item.videoId)}
                                className="text-[10px] text-red-400/70 hover:text-red-300"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
