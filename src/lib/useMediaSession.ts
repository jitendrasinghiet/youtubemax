import { useEffect, useRef } from 'react'
import type { VideoMeta } from '../types'

export interface MediaSessionHandlers {
  onPlay: () => void
  onPause: () => void
  onPrevious: () => void
  onNext: () => void
  onStop: () => void
}

/** Wires the Web Media Session API (`navigator.mediaSession`) to the main
 *  viewer -- ported from the sibling DEKHO project's own useMediaSession.ts
 *  (which youtubemax had no equivalent of at all before this). Gives the OS
 *  its own now-playing UI (Android's lock-screen/notification media widget)
 *  wherever the browser supports it, so play/pause/prev/next work without
 *  switching back to the tab/app.
 *
 *  Reported directly ("background audio only playback on android mobile/
 *  tablet even with app minimized or screen locked be better"): this is
 *  also part of what keeps a backgrounded tab exempted from suspension in
 *  Chrome on Android -- a tab with an active media session that's actually
 *  producing audio gets a persistent media notification (functioning like
 *  a foreground service) instead of being frozen/killed. It cannot make
 *  more than that true, though: the audio itself plays inside a
 *  cross-origin YouTube iframe this app's JS can't reach into, and there is
 *  no legitimate way to extract a raw audio-only stream from YouTube
 *  without violating its Terms of Service (same constraint already called
 *  out in lib/cast.ts's own docblock) -- so this is additive, best-effort
 *  metadata/controls on top of whatever background behavior YouTube's own
 *  embedded player already implements, not a guarantee or a replacement
 *  for it. */
export function useMediaSession(
  active: boolean,
  meta: VideoMeta | null,
  handlers: MediaSessionHandlers,
) {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!active || !meta || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    const ms = navigator.mediaSession

    ms.metadata = new MediaMetadata({
      title: meta.title,
      artist: meta.author,
      album: 'YouTubeMax',
      artwork: meta.thumbnail ? [{ src: meta.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : [],
    })
    ms.playbackState = 'playing'

    ms.setActionHandler('play', () => handlersRef.current.onPlay())
    ms.setActionHandler('pause', () => handlersRef.current.onPause())
    ms.setActionHandler('previoustrack', () => handlersRef.current.onPrevious())
    ms.setActionHandler('nexttrack', () => handlersRef.current.onNext())
    ms.setActionHandler('stop', () => handlersRef.current.onStop())

    return () => {
      ms.setActionHandler('play', null)
      ms.setActionHandler('pause', null)
      ms.setActionHandler('previoustrack', null)
      ms.setActionHandler('nexttrack', null)
      ms.setActionHandler('stop', null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, meta?.videoId])
}
