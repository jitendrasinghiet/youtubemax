import { useState } from 'react'
import { AddToPlaylistBar } from '../dev/AddToPlaylistBar'
import { VideoCard } from './VideoCard'
import type { SearchSortType } from '../lib/searchSort'
import type { SearchResultItem } from '../types'

// Trusted channels / Safer picks / Longest hidden from the sort row --
// reported directly as clutter. The underlying sort logic (searchSort.ts)
// is untouched, so re-adding any of these later is just uncommenting a row.
const SORT_OPTIONS: { type: SearchSortType; label: string }[] = [
  { type: 'recommended', label: 'Recommended' },
  { type: 'relevance', label: 'Relevance' },
  { type: 'publishDate', label: 'Newest' },
  { type: 'viewCount', label: 'Most viewed' },
]

interface SearchResultsGridProps {
  results: SearchResultItem[]
  sortedResults: SearchResultItem[]
  sortType: SearchSortType
  onSortChange: (type: SearchSortType) => void
  onSelect: (videoId: string) => void
  hasQuery: boolean
  /** Section heading, e.g. "Search results for “Sai Baba”" or "From your
   *  library" -- lets one grid component serve both the pinned live-search
   *  section and the cache-backed feed below it with visibly different
   *  identities. Omit for no heading. */
  title?: string
  /** Clicking this next to the title dismisses the whole section -- used by
   *  the live-search results, which the cache-backed feed doesn't need. */
  onDismiss?: () => void
  /** Overrides the built-in "No videos found" / "Enter a search query"
   *  copy for a section with different empty-state semantics (e.g. an
   *  empty local cache isn't the same situation as a live search with no
   *  matches). */
  emptyMessage?: string
  /** Hides the per-grid sort button row -- used on the live-search section
   *  so there's exactly one sort control on screen (the cache feed's),
   *  rather than two that could visibly disagree. */
  hideSortControls?: boolean
  /** Overrides the default "Found N videos" line, e.g. to show "N of Total"
   *  once the cache feed knows how many more pages exist. */
  countLabel?: string
  /** Rendered below the grid -- the cache feed's infinite-scroll sentinel
   *  and "Load more" fallback button live here. */
  footer?: React.ReactNode
}

export function SearchResultsGrid({
  results,
  sortedResults,
  sortType,
  onSortChange,
  onSelect,
  hasQuery,
  title,
  onDismiss,
  emptyMessage,
  hideSortControls,
  countLabel,
  footer,
}: SearchResultsGridProps) {
  // Dev-only multi-select for bulk-adding results to a local playlist (see
  // AddToPlaylistBar). Keyed by videoId but stores the full item since the
  // add-to-playlist call needs title/channel/thumbnail, not just the id.
  const [selected, setSelected] = useState<Map<string, SearchResultItem>>(new Map())

  const toggleSelected = (video: SearchResultItem) => {
    setSelected((current) => {
      const next = new Map(current)
      if (next.has(video.videoId)) {
        next.delete(video.videoId)
      } else {
        next.set(video.videoId, video)
      }
      return next
    })
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {title && (
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
        )}
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-sm text-zinc-400">
            {emptyMessage ??
              (hasQuery
                ? 'No videos found. Try a different search.'
                : 'Enter a search query above to discover videos.')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {title && (
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
          )}
          <p className="text-xs text-zinc-500">
            {countLabel ?? `Found ${results.length} video${results.length !== 1 ? 's' : ''}`}
          </p>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-zinc-500 transition hover:text-white"
            >
              ✕ Clear
            </button>
          )}
        </div>
        {!hideSortControls && (
          <div className="flex gap-1 flex-wrap justify-end">
            {SORT_OPTIONS.map(({ type, label }) => (
              <button
                key={type}
                onClick={() => onSortChange(type)}
                className={`px-2 py-1 text-xs font-medium rounded transition whitespace-nowrap ${
                  sortType === type
                    ? 'bg-red-500/20 border border-red-500 text-red-300'
                    : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {import.meta.env.DEV && selected.size > 0 && (
        <AddToPlaylistBar
          selectedItems={[...selected.values()]}
          onClear={() => setSelected(new Map())}
        />
      )}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {sortedResults.map((video) => (
          <VideoCard
            key={video.videoId}
            video={video}
            selected={selected.has(video.videoId)}
            onToggleSelected={toggleSelected}
            onSelect={onSelect}
            showSelectCheckbox={import.meta.env.DEV}
          />
        ))}
      </div>
      {footer}
    </div>
  )
}
