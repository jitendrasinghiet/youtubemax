import { useCallback, useEffect, useState } from 'react'
import { addDevPlaylistItem, createDevPlaylist, listDevPlaylists, type LocalPlaylist } from '../lib/devPlaylistApi'
import type { SearchResultItem } from '../types'

const NEW_PLAYLIST_VALUE = '__new__'

interface AddToPlaylistBarProps {
  selectedItems: SearchResultItem[]
  onClear: () => void
}

/** Dev-only: bulk-add multi-selected search results into a local playlist
 * (the fs-backed store managed by the 🛠 Playlist Manager). Not wired to
 * anything production-facing — see PlaylistManagerPanel for why. */
export function AddToPlaylistBar({ selectedItems, onClear }: AddToPlaylistBarProps) {
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>([])
  const [targetSlug, setTargetSlug] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listDevPlaylists()
      .then((list) => {
        if (!active) return
        setPlaylists(list)
        setTargetSlug((current) => current || list[0]?.slug || NEW_PLAYLIST_VALUE)
      })
      .catch(() => {
        if (active) setTargetSlug(NEW_PLAYLIST_VALUE)
      })
    return () => {
      active = false
    }
  }, [])

  const handleAdd = useCallback(async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      let slug = targetSlug
      if (slug === NEW_PLAYLIST_VALUE || !slug) {
        const label = window.prompt('New playlist name')?.trim()
        if (!label) {
          setBusy(false)
          return
        }
        const created = await createDevPlaylist({ label, loadedVia: 'manual' })
        slug = created.slug
      }

      let added = 0
      let skipped = 0
      for (const item of selectedItems) {
        try {
          await addDevPlaylistItem(slug, {
            videoId: item.videoId,
            title: item.title,
            channel: item.channel,
            thumbnail: item.thumbnail,
          })
          added += 1
        } catch (err) {
          // "<id> is already in this playlist" (409) is an expected skip
          // for a batch add, not a failure — anything else should surface.
          if (err instanceof Error && /already in this playlist/.test(err.message)) {
            skipped += 1
          } else {
            throw err
          }
        }
      }

      setResult(`Added ${added}${skipped ? `, skipped ${skipped} already there` : ''}.`)
      setTargetSlug(slug)
      setPlaylists(await listDevPlaylists())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to playlist')
    } finally {
      setBusy(false)
    }
  }, [selectedItems, targetSlug])

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2">
      <span className="text-xs font-medium text-red-100">{selectedItems.length} selected</span>

      <select
        value={targetSlug}
        onChange={(e) => {
          setTargetSlug(e.target.value)
          setResult(null)
          setError(null)
        }}
        className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
      >
        {playlists.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.icon} {p.label} ({p.items.length})
          </option>
        ))}
        <option value={NEW_PLAYLIST_VALUE}>+ New playlist…</option>
      </select>

      <button
        type="button"
        onClick={() => void handleAdd()}
        disabled={busy || selectedItems.length === 0}
        className="rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-200 disabled:opacity-40"
      >
        {busy ? 'Adding…' : 'Add to playlist'}
      </button>

      {result && <span className="text-xs text-emerald-300">{result}</span>}
      {error && <span className="text-xs text-red-300">{error}</span>}

      <button type="button" onClick={onClear} className="ml-auto text-xs text-zinc-400 hover:text-white">
        Clear selection
      </button>
    </div>
  )
}
