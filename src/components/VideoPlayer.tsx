import { useEffect, useRef } from 'react'

interface VideoPlayerProps {
  videoId: string
  startAt?: number
  captionsEnabled?: boolean
  playbackRate?: number
  pauseSignal?: number
}

function buildEmbedUrl(videoId: string, startAt: number, captionsEnabled: boolean): string {
  const params = new URLSearchParams({
    start: String(Math.floor(startAt)),
    autoplay: '1',
    rel: '0',
    enablejsapi: '1',
  })

  if (captionsEnabled) {
    params.set('cc_load_policy', '1')
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
  startAt = 0,
  captionsEnabled = false,
  playbackRate = 1,
  pauseSignal = 0,
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

    iframe.src = buildEmbedUrl(videoId, startAt, captionsEnabled)
  }, [videoId, startAt, captionsEnabled])

  useEffect(() => {
    schedulePlayerSync()
    return clearSyncTimeouts
  }, [captionsEnabled, playbackRate, videoId, startAt])

  useEffect(() => {
    if (pauseSignal <= 0) return
    sendPlayerCommand(iframeRef.current, 'pauseVideo')
  }, [pauseSignal])

  useEffect(() => clearSyncTimeouts, [])

  const initialStart = Math.floor(startAt)

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl shadow-red-950/20 ring-1 ring-white/10">
      <iframe
        ref={iframeRef}
        className="h-full w-full"
        src={buildEmbedUrl(videoId, initialStart, captionsEnabled)}
        onLoad={schedulePlayerSync}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  )
}
