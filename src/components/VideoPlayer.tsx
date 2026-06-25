import { useEffect, useRef } from 'react'

interface VideoPlayerProps {
  videoId: string
  startAt?: number
}

export function VideoPlayer({ videoId, startAt = 0 }: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lastStart = useRef(startAt)

  useEffect(() => {
    if (startAt === lastStart.current) return
    lastStart.current = startAt

    const iframe = iframeRef.current
    if (!iframe) return

    const start = Math.floor(startAt)
    iframe.src = `https://www.youtube.com/embed/${videoId}?start=${start}&autoplay=1&rel=0`
  }, [videoId, startAt])

  const initialStart = Math.floor(startAt)

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl shadow-red-950/20 ring-1 ring-white/10">
      <iframe
        ref={iframeRef}
        className="h-full w-full"
        src={`https://www.youtube.com/embed/${videoId}?start=${initialStart}&rel=0`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  )
}
