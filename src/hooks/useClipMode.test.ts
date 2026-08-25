import { describe, expect, it } from 'vitest'
import { computeClipStep } from './useClipMode'
import type { Chapter } from '../types'

function chapter(start: number, title = `Chapter at ${start}`): Chapter {
  return { start, title, source: 'description' }
}

describe('computeClipStep', () => {
  it('returns null when there are no chapters to play', () => {
    expect(computeClipStep(0, [])).toBeNull()
  })

  it('clamps an out-of-range index to the last chapter', () => {
    const chapters = [chapter(0), chapter(10), chapter(20)]
    const step = computeClipStep(5, chapters)
    expect(step?.validIndex).toBe(2)
  })

  it('plays from the current chapter start and schedules the next chapter', () => {
    const chapters = [chapter(0), chapter(10), chapter(20)]
    const step = computeClipStep(0, chapters)
    expect(step).toEqual({ validIndex: 0, playStart: 0, advanceAfterMs: 10_000 })
  })

  it('does not schedule an advance on the last chapter', () => {
    const chapters = [chapter(0), chapter(10), chapter(20)]
    const step = computeClipStep(2, chapters)
    expect(step).toEqual({ validIndex: 2, playStart: 20, advanceAfterMs: null })
  })

  it('floors the advance duration at 3 seconds for closely-spaced chapters', () => {
    const chapters = [chapter(0), chapter(1)]
    const step = computeClipStep(0, chapters)
    expect(step?.advanceAfterMs).toBe(3000)
  })

  it('uses the exact gap in ms when it exceeds the 3 second floor', () => {
    const chapters = [chapter(5), chapter(12)]
    const step = computeClipStep(0, chapters)
    expect(step?.advanceAfterMs).toBe(7000)
  })
})
