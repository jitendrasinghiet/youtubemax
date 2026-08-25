import { useCallback, useEffect, useRef, useState } from 'react'
import type { Chapter } from '../types'

const MIN_CLIP_DURATION_MS = 3000

export interface ClipStep {
  /** clipIndex clamped into bounds — differs from the requested index only
   * when the chapter list shrank (e.g. a filter removed chapters) out from
   * under an in-progress clip run. */
  validIndex: number
  /** Where playback should seek to for this step. */
  playStart: number
  /** ms until auto-advancing to the next chapter, or null on the last
   * chapter (play it out rather than looping/stopping). */
  advanceAfterMs: number | null
}

/**
 * Pure decision logic for one clip-mode step, extracted out of the effect
 * below so it's unit-testable without a React render harness — see
 * useClipMode.test.ts. Returns null when clip mode has nothing to play
 * (chapter list is empty), which the caller treats as "turn clip mode off".
 */
export function computeClipStep(clipIndex: number, displayedChapters: Chapter[]): ClipStep | null {
  if (displayedChapters.length === 0) return null

  const validIndex = Math.min(clipIndex, displayedChapters.length - 1)
  const current = displayedChapters[validIndex]
  const next = displayedChapters[validIndex + 1]

  const advanceAfterMs = next ? Math.max((next.start - current.start) * 1000, MIN_CLIP_DURATION_MS) : null

  return { validIndex, playStart: current.start, advanceAfterMs }
}

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

    const step = computeClipStep(clipIndex, displayedChapters)
    if (!step) {
      setClipMode(false)
      return
    }

    if (step.validIndex !== clipIndex) {
      setClipIndex(step.validIndex)
      return
    }

    if (clipTimerRef.current) clearTimeout(clipTimerRef.current)
    setPlayStart(step.playStart)

    if (step.advanceAfterMs == null) {
      // Last clip - continue playing it indefinitely until user stops
      return
    }

    clipTimerRef.current = setTimeout(() => {
      setClipIndex((i) => i + 1)
    }, step.advanceAfterMs)

    return () => {
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current)
    }
  }, [clipMode, clipIndex, displayedChapters])

  return { playStart, setPlayStart, clipMode, clipIndex, startClips, stopClips, selectChapter }
}
