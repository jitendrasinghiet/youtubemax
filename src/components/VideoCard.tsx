import { useRef, useState } from 'react'
import { formatViewCount } from '../lib/api'
import type { SearchResultItem } from '../types'

// A quick mouse pass across the grid shouldn't spin up a real embed for
// every card it crosses -- this is the same "hover intent" delay
// YouTube's own homepage uses before a thumbnail starts playing.
const HOVER_INTENT_MS = 500

interface VideoCardProps {
  video: SearchResultItem
  selected: boolean
  onToggleSelected: (video: SearchResultItem) => void
  onSelect: (videoId: string) => void
  showSelectCheckbox: boolean
}

export function VideoCard({ video, selected, onToggleSelected, onSelect, showSelectCheckbox }: VideoCardProps) {
  const [showPreview, setShowPreview] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  const handleEnter = () => {
    timerRef.current = window.setTimeout(() => setShowPreview(true), HOVER_INTENT_MS)
  }

  const handleLeave = () => {
    window.clearTimeout(timerRef.current)
    setShowPreview(false)
  }

  return (
    <div className="group relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {showSelectCheckbox && (
        <label
          className="absolute left-2 top-2 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-white/30 bg-black/70 backdrop-blur"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelected(video)}
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
        <div className="relative w-full h-32 bg-black">
          <img src={video.thumbnail} alt="" className="w-full h-32 object-cover" />
          {/* Muted autoplay is required, not cosmetic: browsers block
             unmuted iframe autoplay without a prior user gesture, so a
             silent hover-preview like this only actually plays if muted.
             Mounted only once the hover-intent delay fires, and unmounted
             (not just hidden) on mouse-leave so playback actually stops. */}
          {showPreview && (
            <iframe
              key={video.videoId}
              src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0`}
              title={video.title}
              allow="autoplay; encrypted-media"
              frameBorder={0}
              className="absolute inset-0 h-full w-full"
            />
          )}
        </div>
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
  )
}
