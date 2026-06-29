import { formatViewCount } from '../lib/api'
import type { SearchSortType } from '../lib/searchSort'
import type { SearchResultItem } from '../types'

const SORT_OPTIONS: { type: SearchSortType; label: string }[] = [
  { type: 'relevance', label: 'Relevance' },
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
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {sortedResults.map((video) => (
          <button
            key={video.videoId}
            type="button"
            onClick={() => onSelect(video.videoId)}
            className="group rounded-lg border border-white/10 bg-black/20 overflow-hidden transition hover:border-red-500/30 hover:bg-white/5"
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
        ))}
      </div>
    </div>
  )
}
