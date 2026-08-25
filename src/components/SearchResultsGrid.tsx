import { useState } from 'react'
import { AddToPlaylistBar } from '../dev/AddToPlaylistBar'
import { formatViewCount } from '../lib/api'
import type { SearchSortType } from '../lib/searchSort'
import type { SearchResultItem } from '../types'

const SORT_OPTIONS: { type: SearchSortType; label: string }[] = [
  { type: 'recommended', label: 'Recommended' },
  { type: 'relevance', label: 'Relevance' },
  { type: 'channelTrust', label: 'Trusted channels' },
  { type: 'safety', label: 'Safer picks' },
  { type: 'publishDate', label: 'Newest' },
  { type: 'viewCount', label: 'Most viewed' },
  { type: 'duration', label: 'Longest' },
]

interface SearchResultsGridProps {
  results: SearchResultItem[]
  sortedResults: SearchResultItem[]
  sortType: SearchSortType
  onSortChange: (type: SearchSortType) => void
  onSelect: (videoId: string) => void
  hasQuery: boolean
}

export function SearchResultsGrid({
  results,
  sortedResults,
  sortType,
  onSortChange,
  onSelect,
  hasQuery,
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
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-sm text-zinc-400">
          {hasQuery
            ? 'No videos found. Try a different search.'
            : 'Enter a search query above to discover videos.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          Found {results.length} video{results.length !== 1 ? 's' : ''}
        </p>
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
      </div>
      {import.meta.env.DEV && selected.size > 0 && (
        <AddToPlaylistBar
          selectedItems={[...selected.values()]}
          onClear={() => setSelected(new Map())}
        />
      )}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {sortedResults.map((video) => (
          <div key={video.videoId} className="group relative">
            {import.meta.env.DEV && (
              <label
                className="absolute left-2 top-2 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-white/30 bg-black/70 backdrop-blur"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selected.has(video.videoId)}
                  onChange={() => toggleSelected(video)}
                  className="h-3.5 w-3.5 accent-red-500"
                  aria-label={`Select ${video.title}`}
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => onSelect(video.videoId)}
              className="w-full rounded-lg border border-white/10 bg-black/20 overflow-hidden text-left transition hover:border-red-500/30 hover:bg-white/5"
            >
              <img src={video.thumbnail} alt="" className="w-full h-32 object-cover" />
              <div className="p-3">
                <p className="line-clamp-2 text-xs font-medium text-white group-hover:text-red-200">
                  {video.title}
                </p>
                <p className="mt-1 text-[10px] text-zinc-500">{video.channel}</p>
                <div className="mt-1.5 flex flex-wrap gap-1 text-sm text-zinc-600">
                  {video.viewCount && <span>{formatViewCount(video.viewCount)}</span>}
                  {video.duration && <span>·</span>}
                  {video.duration && <span>{video.duration}</span>}
                  {video.publishedAt && <span>·</span>}
                  {video.publishedAt && <span>{video.publishedAt}</span>}
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
