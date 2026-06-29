import { useCallback, useEffect, useRef, useState } from 'react'
import type { Chapter } from '../types'

/**
 * Encapsulates playback position and "clip mode" — sequentially auto-advancing
 * through a list of chapters. `displayedChapters` should be a stable (memoized)
 * reference to avoid restarting the timer on every render.
 */
export function useClipMode(displayedChapters: Chapter[]) {
  const [playStart, setPlayStart] = useState(0)
  const [clipMode, setClipMode] = useState(false)
  const [clipIndex, setClipIndex] = useState(0)
  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startClips = useCallback(() => {
    if (displayedChapters.length === 0) return
    setClipMode(true)
    setClipIndex(0)
  }, [displayedChapters.length])

  const stopClips = useCallback(() => {
    setClipMode(false)
    if (clipTimerRef.current) clearTimeout(clipTimerRef.current)
  }, [])

  const selectChapter = useCallback(
    (start: number) => {
      if (clipMode) {
        const idx = displayedChapters.findIndex((ch) => ch.start === start)
        if (idx !== -1) {
          setClipIndex(idx)
          return
        }
      }
      setPlayStart(start)
    },
    [clipMode, displayedChapters],
  )

  useEffect(() => {
    if (!clipMode) return
    if (displayedChapters.length === 0) {
      setClipMode(false)
      return
    }

    const validIndex = Math.min(clipIndex, displayedChapters.length - 1)
    if (validIndex !== clipIndex) {
      setClipIndex(validIndex)
      return
    }

    if (clipTimerRef.current) clearTimeout(clipTimerRef.current)

    const current = displayedChapters[validIndex]
    setPlayStart(current.start)

    const next = displayedChapters[validIndex + 1]
    if (!next) {
      // Last clip - continue playing it indefinitely until user stops
      return
    }

    // Calculate duration until next filtered clip starts
    const duration = Math.max((next.start - current.start) * 1000, 3000)
    clipTimerRef.current = setTimeout(() => {
      setClipIndex((i) => i + 1)
    }, duration)

    return () => {
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current)
    }
  }, [clipMode, clipIndex, displayedChapters])

  return { playStart, setPlayStart, clipMode, clipIndex, startClips, stopClips, selectChapter }
}
