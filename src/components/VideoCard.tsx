import { useEffect, useRef, useState } from 'react'
import { formatViewCount } from '../lib/api'
import { useSupportsHover } from '../hooks/useSupportsHover'
import type { SearchResultItem } from '../types'

// A quick mouse pass across the grid shouldn't spin up a real embed for
// every card it crosses -- this is the same "hover intent" delay
// YouTube's own homepage uses before a thumbnail starts playing.
const HOVER_INTENT_MS = 500
// The IFrame Player API has no "mute changed" event, only a pollable
// isMuted() -- this is how a manual unmute via the embed's own controls
// gets noticed and remembered.
const MUTE_POLL_MS = 500
const MUTE_PREF_KEY = 'youtubemax.previewMuted'

function loadMutePreference(): boolean {
  try {
    const raw = localStorage.getItem(MUTE_PREF_KEY)
    return raw === null ? true : JSON.parse(raw)
  } catch {
    return true
  }
}

function saveMutePreference(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_PREF_KEY, JSON.stringify(muted))
  } catch {
    // storage full/unavailable -- preference just won't persist this session
  }
}

interface YTPlayer {
  isMuted(): boolean
  destroy(): void
}
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement | string, options: Record<string, unknown>) => YTPlayer }
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiLoadPromise: Promise<void> | null = null

/** Loads YouTube's IFrame Player API script once (idempotent), resolving
 *  once `window.YT.Player` is available. Only needed to read back
 *  whether the user muted/unmuted the embed -- the preview itself plays
 *  via the plain <iframe src> regardless of whether this ever resolves. */
function loadYouTubeIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (apiLoadPromise) return apiLoadPromise
  apiLoadPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve()
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })
  return apiLoadPromise
}

interface VideoCardProps {
  video: SearchResultItem
  selected: boolean
  onToggleSelected: (video: SearchResultItem) => void
  onSelect: (videoId: string) => void
  showSelectCheckbox: boolean
}

export function VideoCard({ video, selected, onToggleSelected, onSelect, showSelectCheckbox }: VideoCardProps) {
  const supportsHover = useSupportsHover()
  const [showPreview, setShowPreview] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)
  const iframeElRef = useRef<HTMLIFrameElement | null>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const pollRef = useRef<number | undefined>(undefined)
  // Read fresh on each preview start rather than kept in React state --
  // another card may have updated the shared preference since this one
  // last rendered, and this is the only place that needs the value.
  const preferMutedRef = useRef(true)

  const handleEnter = () => {
    if (!supportsHover) return
    timerRef.current = window.setTimeout(() => {
      preferMutedRef.current = loadMutePreference()
      setShowPreview(true)
    }, HOVER_INTENT_MS)
  }

  const handleLeave = () => {
    if (!supportsHover) return
    window.clearTimeout(timerRef.current)
    setShowPreview(false)
  }

  useEffect(() => {
    if (!showPreview) return
    let cancelled = false

    loadYouTubeIframeApi().then(() => {
      if (cancelled || !iframeElRef.current || !window.YT) return
      playerRef.current = new window.YT.Player(iframeElRef.current, {
        events: {
          onReady: () => {
            pollRef.current = window.setInterval(() => {
              const player = playerRef.current
              if (!player) return
              saveMutePreference(player.isMuted())
            }, MUTE_POLL_MS)
          },
        },
      })
    })

    return () => {
      cancelled = true
      window.clearInterval(pollRef.current)
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [showPreview, video.videoId])

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
          {/* Muted-by-default autoplay is required, not cosmetic: browsers
             block unmuted iframe autoplay without a prior user gesture.
             The starting mute state instead follows whatever the user
             last set via the embed's own controls (preferMutedRef, read
             fresh at hover-open time) -- unmute once and later previews
             stay unmuted until muted again, on this device. Mounted only
             once the hover-intent delay fires, and unmounted (not just
             hidden) on mouse-leave so playback actually stops. */}
          {showPreview && (
            <iframe
              key={video.videoId}
              ref={iframeElRef}
              src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1&mute=${preferMutedRef.current ? 1 : 0}&controls=1&modestbranding=1&rel=0&enablejsapi=1&playsinline=1`}
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
