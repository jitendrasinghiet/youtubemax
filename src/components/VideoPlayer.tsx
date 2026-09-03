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
  /** Same shape as `pauseSignal` (any increment sends the command once) --
   *  added so the Media Session API's `play` handler (App.tsx) has a way
   *  to actually resume playback, since this embed otherwise only exposes
   *  YouTube's own on-iframe play button. */
  playSignal?: number
  onCurrentTimeChange?: (seconds: number) => void
  /** Fires once when the current video reaches YouTube's own "ended"
   *  player state (postMessage `onStateChange` info `0`) -- reported
   *  directly ("ytmax also should autoplay next items from list"). Not
   *  meaningful/never called while `playlistId` is set: YouTube's own
   *  `list=` embed param already drives sequential playback for that
   *  case (see this component's own docblock on why there's no custom
   *  queue logic here), so App.tsx only wires this up outside of a
   *  playlist context. */
  onEnded?: () => void
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

// YouTube's own postMessage player-state numbers (undocumented officially,
// but stable/widely relied on -- same values the real IFrame Player API's
// YT.PlayerState enum exposes, this embed just never loads that JS API).
const YT_STATE_ENDED = 0

export function VideoPlayer({
  videoId,
  playlistId = null,
  startAt = 0,
  captionsEnabled = false,
  playbackRate = 1,
  pauseSignal = 0,
  playSignal = 0,
  onCurrentTimeChange,
  onEnded,
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
    if (playSignal <= 0) return
    sendPlayerCommand(iframeRef.current, 'playVideo')
  }, [playSignal])

  useEffect(() => {
    if (!onEnded || playlistId) return

    // Guards against the same "ended" state re-firing this callback twice
    // for one video (observed in practice: YouTube's postMessage stream
    // can repeat an onStateChange event) -- resets per videoId change via
    // this effect's own dependency array, not a plain module-level flag.
    let firedForThisVideo = false

    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin.toLowerCase()
      const trustedYoutubeOrigin = origin.includes('youtube.com') || origin.includes('youtube-nocookie.com')
      if (!trustedYoutubeOrigin || firedForThisVideo) return

      let payload: unknown = event.data
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {
          return
        }
      }

      if (!payload || typeof payload !== 'object') return
      const record = payload as { event?: string; info?: unknown }
      if (record.event !== 'onStateChange' || record.info !== YT_STATE_ENDED) return

      firedForThisVideo = true
      onEnded()
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onEnded, playlistId, videoId])

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
