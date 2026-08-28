import { describe, expect, it } from 'vitest'
import { browseCache, wordsAreSimilar } from './searchCache'

describe('wordsAreSimilar', () => {
  it('matches identical words', () => {
    expect(wordsAreSimilar('amritwani', 'amritwani')).toBe(true)
  })

  it('matches a prefix (partial typing)', () => {
    expect(wordsAreSimilar('kahani', 'kahaniyan')).toBe(true)
  })

  it('matches a one-letter typo on a longer word', () => {
    expect(wordsAreSimilar('kahaani', 'kahani')).toBe(true) // extra 'a'
    expect(wordsAreSimilar('aashiqi', 'aashiqui')).toBe(true) // dropped 'u'
  })

  it('matches a two-letter difference on a long word', () => {
    expect(wordsAreSimilar('nursary', 'nursery')).toBe(true)
  })

  it('does not fuzzy-match short words -- too easy to false-positive', () => {
    expect(wordsAreSimilar('cat', 'car')).toBe(false)
    expect(wordsAreSimilar('dog', 'dot')).toBe(false)
  })

  it('a single-character word does not spuriously prefix-match a long unrelated term', () => {
    // "z" is trivially a startsWith() prefix of any z-word -- caught a real
    // bug where a nonsense 23-char query matched cache entries containing
    // a lone "z" token (from "Z for Zebra").
    expect(wordsAreSimilar('qxvbjklnonexistentquery', 'z')).toBe(false)
    expect(wordsAreSimilar('a', 'aashiqui')).toBe(false)
  })

  it('does not match genuinely unrelated words', () => {
    expect(wordsAreSimilar('yamuna', 'ganga')).toBe(false)
    expect(wordsAreSimilar('rhyme', 'rhythm')).toBe(false)
  })
})

describe('browseCache', () => {
  // Runs against the real committed data/search-cache/ -- deterministic,
  // same data every run, and exercises the actual file-reading path
  // rather than a mocked one.
  // Reading all 531+ committed cache files from disk on every call takes
  // ~1-1.5s at this cache size (pre-existing cost, unrelated to the
  // fuzzy-matching logic under test here -- see docs/STATUS.md's note on
  // browseCache's per-call file-read cost) -- past vitest's 5s default
  // for two sequential calls in one test.
  it(
    'finds a cached result via a typo the old literal-substring check would have missed',
    async () => {
      const typoQuery = await browseCache({ query: 'kahaani' })
      const exactQuery = await browseCache({ query: 'kahani' })
      // A typo shouldn't return a wildly different result set than the
      // correctly-spelled word -- it's finding the same underlying content.
      expect(typoQuery.total).toBeGreaterThan(0)
      expect(exactQuery.total).toBeGreaterThan(0)
    },
    15000,
  )

  it(
    'still returns nothing for words that share no real similarity',
    async () => {
      const result = await browseCache({ query: 'qxvbjklnonexistentquery' })
      expect(result.total).toBe(0)
    },
    15000,
  )
})
