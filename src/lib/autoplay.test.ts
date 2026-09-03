import { describe, expect, it } from 'vitest'
import { loadAutoplayNextPreference, nextResultVideoId, previousResultVideoId } from './autoplay'
import type { SearchResultItem } from '../types'

const make = (videoId: string): SearchResultItem => ({
  videoId,
  title: `title ${videoId}`,
  channel: 'c',
  thumbnail: '',
  publishedAt: '',
  description: '',
})

describe('nextResultVideoId', () => {
  const list = [make('a'), make('b'), make('c')]

  it('returns the following item in the list', () => {
    expect(nextResultVideoId(list, 'a')).toBe('b')
    expect(nextResultVideoId(list, 'b')).toBe('c')
  })

  it('returns null at the end of the list (no wraparound)', () => {
    expect(nextResultVideoId(list, 'c')).toBeNull()
  })

  it('returns null when the current video is not in the list', () => {
    expect(nextResultVideoId(list, 'not-in-list')).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(nextResultVideoId([], 'a')).toBeNull()
  })
})

describe('previousResultVideoId', () => {
  const list = [make('a'), make('b'), make('c')]

  it('returns the preceding item in the list', () => {
    expect(previousResultVideoId(list, 'c')).toBe('b')
    expect(previousResultVideoId(list, 'b')).toBe('a')
  })

  it('returns null at the start of the list (no wraparound)', () => {
    expect(previousResultVideoId(list, 'a')).toBeNull()
  })

  it('returns null when the current video is not in the list', () => {
    expect(previousResultVideoId(list, 'not-in-list')).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(previousResultVideoId([], 'a')).toBeNull()
  })
})

describe('loadAutoplayNextPreference', () => {
  // vitest.config.ts runs this suite under environment: 'node' (no
  // window/localStorage) -- the same reason the sibling searchSort.ts's
  // load/persist functions aren't unit-tested either. What IS worth
  // covering here: the function's own explicit `typeof window ===
  // 'undefined'` guard, which exists specifically so this never throws
  // in a non-browser context (SSR, a build step, this very test file).
  it('defaults to false when window is unavailable, without throwing', () => {
    expect(loadAutoplayNextPreference()).toBe(false)
  })
})
