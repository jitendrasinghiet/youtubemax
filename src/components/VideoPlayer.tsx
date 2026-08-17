import { useEffect, useRef } from 'react'

interface VideoPlayerProps {
  videoId: string
  /**
   * Optional playlist context (from a pasted &list= URL or a curated
   * playlist selection). Uses YouTube's own list= embed param — plays this
   * specific video within the playlist and auto-advances natively. No
   * custom "next video" queue logic lives here on purpose.
   */
  playlistId?: string | null
  startAt?: number
  captionsEnabled?: boolean
  playbackRate?: number
  pauseSignal?: number
  onCurrentTimeChange?: (seconds: number) => void
}

function buildEmbedUrl(
  videoId: string,
  startAt: number,
  captionsEnabled: boolean,
  playlistId?: string | null,
): string {
  const params = new URLSearchParams({
    start: String(Math.floor(startAt)),
    autoplay: '1',
    rel: '0',
    enablejsapi: '1',
  })

  if (captionsEnabled) {
    params.set('cc_load_policy', '1')
  }

  if (playlistId) {
    params.set('list', playlistId)
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

function sendPlayerCommand(iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  if (!iframe?.contentWindow) return
  iframe.contentWindow.postMessage(
    JSON.stringify({
      event: 'command',
      func,
      args,
    }),
    '*',
  )
}

export function VideoPlayer({
  videoId,
  playlistId = null,
  startAt = 0,
  captionsEnabled = false,
  playbackRate = 1,
  pauseSignal = 0,
  onCurrentTimeChange,
}: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lastStart = useRef(startAt)
  const syncTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearSyncTimeouts = () => {
    for (const timeoutId of syncTimeoutsRef.current) {
      clearTimeout(timeoutId)
    }
    syncTimeoutsRef.current = []
  }

  const syncPlayerState = () => {
    const iframe = iframeRef.current
    if (!iframe) return

    if (captionsEnabled) {
      sendPlayerCommand(iframe, 'loadModule', ['captions'])
      sendPlayerCommand(iframe, 'setOption', ['captions', 'track', { languageCode: 'en' }])
    } else {
      sendPlayerCommand(iframe, 'unloadModule', ['captions'])
    }

    sendPlayerCommand(iframe, 'setPlaybackRate', [playbackRate])
  }

  const schedulePlayerSync = () => {
    clearSyncTimeouts()
    // Re-try after load because YouTube may ignore early commands while initializing.
    syncTimeoutsRef.current = [0, 180, 500, 1000].map((delayMs) =>
      setTimeout(() => {
        syncPlayerState()
      }, delayMs),
    )
  }

  useEffect(() => {
    if (startAt === lastStart.current) return
    lastStart.current = startAt

    const iframe = iframeRef.current
    if (!iframe) return

    iframe.src = buildEmbedUrl(videoId, startAt, captionsEnabled, playlistId)
  }, [videoId, startAt, captionsEnabled, playlistId])

  useEffect(() => {
    schedulePlayerSync()
    return clearSyncTimeouts
  }, [captionsEnabled, playbackRate, videoId, startAt])

  useEffect(() => {
    if (pauseSignal <= 0) return
    sendPlayerCommand(iframeRef.current, 'pauseVideo')
  }, [pauseSignal])

  useEffect(() => {
    if (!onCurrentTimeChange) return

    const emitCurrentTime = (value: unknown) => {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return
      onCurrentTimeChange(value)
    }

    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin.toLowerCase()
      const trustedYoutubeOrigin =
        origin.includes('youtube.com') || origin.includes('youtube-nocookie.com')
      if (!trustedYoutubeOrigin) return

      let payload: unknown = event.data
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {
          return
        }
      }

      if (!payload || typeof payload !== 'object') return
      const record = payload as { event?: string; info?: { currentTime?: unknown } }
      if (record.event !== 'infoDelivery') return

      emitCurrentTime(record.info?.currentTime)
    }

    const requestCurrentTime = () => {
      sendPlayerCommand(iframeRef.current, 'getCurrentTime')
    }

    window.addEventListener('message', handleMessage)
    onCurrentTimeChange(Math.max(0, startAt))
    requestCurrentTime()
    const intervalId = setInterval(requestCurrentTime, 1000)

    return () => {
      window.removeEventListener('message', handleMessage)
      clearInterval(intervalId)
    }
  }, [onCurrentTimeChange, startAt, videoId])

  useEffect(() => clearSyncTimeouts, [])

  const initialStart = Math.floor(startAt)

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl shadow-red-950/20 ring-1 ring-white/10">
      <iframe
        ref={iframeRef}
        className="h-full w-full"
        src={buildEmbedUrl(videoId, initialStart, captionsEnabled, playlistId)}
        onLoad={schedulePlayerSync}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  )
}
