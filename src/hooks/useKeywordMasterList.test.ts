import { describe, expect, it } from 'vitest'
import { mergeKeyword, pruneNoise } from './useKeywordMasterList'
import type { MasterKeyword } from '../types'

function kw(overrides: Partial<MasterKeyword> = {}): MasterKeyword {
  return {
    term: 'react',
    score: 1,
    source: 'transcript',
    fromVideoId: 'v1',
    fromTitle: 'Video 1',
    ...overrides,
  }
}

describe('mergeKeyword', () => {
  it('returns incoming unchanged when there is no existing keyword', () => {
    const incoming = kw()
    expect(mergeKeyword(undefined, incoming)).toBe(incoming)
  })

  it('keeps the higher score of the two', () => {
    expect(mergeKeyword(kw({ score: 5 }), kw({ score: 2 })).score).toBe(5)
    expect(mergeKeyword(kw({ score: 2 }), kw({ score: 9 })).score).toBe(9)
  })

  it('prefers source priority title > chapter > summary > transcript', () => {
    expect(mergeKeyword(kw({ source: 'transcript' }), kw({ source: 'title' })).source).toBe('title')
    expect(mergeKeyword(kw({ source: 'title' }), kw({ source: 'transcript' })).source).toBe('title')
    expect(mergeKeyword(kw({ source: 'summary' }), kw({ source: 'chapter' })).source).toBe('chapter')
    expect(mergeKeyword(kw({ source: 'transcript' }), kw({ source: 'summary' })).source).toBe('summary')
    expect(mergeKeyword(kw({ source: 'transcript' }), kw({ source: 'transcript' })).source).toBe('transcript')
  })

  it('always takes fromVideoId/fromTitle from the incoming keyword', () => {
    const existing = kw({ fromVideoId: 'v1', fromTitle: 'First video' })
    const incoming = kw({ fromVideoId: 'v2', fromTitle: 'Second video' })
    const merged = mergeKeyword(existing, incoming)
    expect(merged.fromVideoId).toBe('v2')
    expect(merged.fromTitle).toBe('Second video')
  })

  it('keeps the existing term as the merge identity, ignoring incoming.term', () => {
    const existing = kw({ term: 'React' })
    const incoming = kw({ term: 'react' })
    expect(mergeKeyword(existing, incoming).term).toBe('React')
  })
})

describe('pruneNoise', () => {
  it('returns keywords unchanged when there are fewer than 3', () => {
    const list = [kw({ term: 'a' }), kw({ term: 'b' })]
    expect(pruneNoise(list)).toEqual(list)
  })

  it('returns keywords unchanged when fewer than 2 have a frequency value', () => {
    const list = [kw({ term: 'a', frequency: 5 }), kw({ term: 'b' }), kw({ term: 'c' })]
    expect(pruneNoise(list)).toEqual(list)
  })

  it('keeps everything when nothing looks like noise', () => {
    const list = [
      kw({ term: 'alpha', score: 3, frequency: 2 }),
      kw({ term: 'bravo', score: 2, frequency: 3 }),
      kw({ term: 'charlie', score: 1, frequency: 2 }),
    ]
    expect(pruneNoise(list)).toHaveLength(3)
  })

  it('drops a term whose frequency is a statistical outlier (stage 1)', () => {
    const normal = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india'].map((term) =>
      kw({ term, frequency: 1 }),
    )
    const outlier = kw({ term: 'outlierterm', frequency: 50 })
    const result = pruneNoise([...normal, outlier])
    expect(result.map((k) => k.term)).not.toContain('outlierterm')
    expect(result).toHaveLength(9)
  })

  it('drops a term that appears in an overwhelming share of chapters (stage 2)', () => {
    const specific = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'].map((term) =>
      kw({ term, frequency: 1, chapterSpread: 1 }),
    )
    const generic = kw({ term: 'genericterm', chapterSpread: 10 })
    const result = pruneNoise([...specific, generic])
    expect(result.map((k) => k.term)).not.toContain('genericterm')
  })

  it('drops a short term when a higher-scoring keyword contains it (stage 3, superstring)', () => {
    const list = [
      kw({ term: 'react', score: 1, frequency: 1 }),
      kw({ term: 'react hooks', score: 5, frequency: 1 }),
      kw({ term: 'unrelated', score: 1, frequency: 1 }),
    ]
    const result = pruneNoise(list)
    expect(result.map((k) => k.term)).toEqual(['react hooks', 'unrelated'])
  })

  it('drops a short term that is a substring of most other keywords (stage 4)', () => {
    const list = [
      kw({ term: 'react', score: 1, frequency: 1 }),
      kw({ term: 'reactdom', score: 1, frequency: 1 }),
      kw({ term: 'reactrouter', score: 1, frequency: 1 }),
      kw({ term: 'reacthooks', score: 1, frequency: 1 }),
    ]
    const result = pruneNoise(list)
    expect(result.map((k) => k.term)).not.toContain('react')
    expect(result).toHaveLength(3)
  })
})
