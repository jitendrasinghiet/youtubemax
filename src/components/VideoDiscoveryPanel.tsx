import { type FormEvent } from 'react'
import type { SearchResultItem } from '../types'
import { parseSearchTerms, youtubeSearchUrl, formatViewCount } from '../lib/api'

interface VideoDiscoveryPanelProps {
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onSearch: (query: string) => void
  onSelectVideo: (videoId: string) => void
  results: SearchResultItem[]
  loading: boolean
  error: string | null
  searchUrl: string | null
  softWarning: string | null
}

export function VideoDiscoveryPanel({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onSelectVideo,
  results,
  loading,
  error,
  searchUrl,
  softWarning,
}: VideoDiscoveryPanelProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim() || loading) return
    onSearch(searchQuery.trim())
  }

  const activeTerms = parseSearchTerms(searchQuery)
  const externalUrl = searchUrl ?? (searchQuery.trim() ? youtubeSearchUrl(searchQuery) : '')

  return (
    <section className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Discover videos
        </h2>
        <p className="text-xs text-zinc-500">
          Build a query from keyword crumbs — searches YouTube results URL (no API key)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Type or click keywords to build your search…"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
            disabled={loading}
          />
          {activeTerms.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {activeTerms.map((term) => (
                <span
                  key={term}
                  className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-zinc-400"
                >
                  {term}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="rounded-xl bg-zinc-800 px-5 py-3 font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-red-500/30 hover:text-white"
            >
              Open on YouTube ↗
            </a>
          )}
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {softWarning && results.length === 0 && !loading && (
        <p className="mt-3 text-sm text-zinc-400">{softWarning}</p>
      )}

      {results.length > 0 && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((video) => (
            <li key={video.videoId}>
              <button
                type="button"
                onClick={() => onSelectVideo(video.videoId)}
                className="group flex w-full gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-red-500/30 hover:bg-white/5"
              >
                <img
                  src={video.thumbnail}
                  alt=""
                  className="h-20 w-36 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-white group-hover:text-red-200">
                    {video.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{video.channel}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-zinc-600">
                    {video.viewCount && <span>{formatViewCount(video.viewCount)}</span>}
                    {video.duration && <span>·</span>}
                    {video.duration && <span>{video.duration}</span>}
                    {video.publishedAt && <span>·</span>}
                    {video.publishedAt && <span>{video.publishedAt}</span>}
                  </div>

                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
