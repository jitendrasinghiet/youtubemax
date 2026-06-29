import { describe, it, expect } from 'vitest'
import {
  parseDurationToSeconds,
  parseViewCountToNumber,
  parseRelativeDateToDays,
  sortSearchResults,
} from './searchSort'
import type { SearchResultItem } from '../types'

describe('parseDurationToSeconds', () => {
  it('parses H:MM:SS', () => {
    expect(parseDurationToSeconds('1:02:03')).toBe(3723)
  })
  it('parses M:SS', () => {
    expect(parseDurationToSeconds('4:05')).toBe(245)
  })
  it('parses bare seconds', () => {
    expect(parseDurationToSeconds('42')).toBe(42)
  })
  it('returns 0 for undefined or invalid input', () => {
    expect(parseDurationToSeconds(undefined)).toBe(0)
    expect(parseDurationToSeconds('abc')).toBe(0)
  })
})

describe('parseViewCountToNumber', () => {
  it('parses K/M/B suffixes', () => {
    expect(parseViewCountToNumber('1.2K views')).toBe(1200)
    expect(parseViewCountToNumber('3.5M')).toBe(3_500_000)
    expect(parseViewCountToNumber('2B')).toBe(2_000_000_000)
  })
  it('parses plain numbers with separators', () => {
    expect(parseViewCountToNumber('12,345 views')).toBe(12345)
  })
  it('returns 0 for undefined or non-numeric', () => {
    expect(parseViewCountToNumber(undefined)).toBe(0)
    expect(parseViewCountToNumber('no views')).toBe(0)
  })
})

describe('parseRelativeDateToDays', () => {
  it('parses common units to days', () => {
    expect(parseRelativeDateToDays('3 days ago')).toBe(3)
    expect(parseRelativeDateToDays('2 weeks ago')).toBe(14)
    expect(parseRelativeDateToDays('1 year ago')).toBe(365)
  })
  it('parses sub-day units as fractions', () => {
    expect(parseRelativeDateToDays('12 hours ago')).toBeCloseTo(0.5)
  })
  it('returns Infinity when unparseable', () => {
    expect(parseRelativeDateToDays(undefined)).toBe(Infinity)
    expect(parseRelativeDateToDays('just now')).toBe(Infinity)
  })
})

describe('sortSearchResults', () => {
  const make = (over: Partial<SearchResultItem>): SearchResultItem => ({
    videoId: 'aaaaaaaaaaa',
    title: 't',
    channel: 'c',
    thumbnail: '',
    publishedAt: '',
    description: '',
    ...over,
  })

  const results = [
    make({ videoId: 'a', viewCount: '1K', duration: '1:00', publishedAt: '2 days ago' }),
    make({ videoId: 'b', viewCount: '3M', duration: '10:00', publishedAt: '1 week ago' }),
    make({ videoId: 'c', viewCount: '500', duration: '0:30', publishedAt: '1 hour ago' }),
  ]

  it('preserves order for relevance', () => {
    expect(sortSearchResults(results, 'relevance')).toBe(results)
  })
  it('sorts by view count descending', () => {
    expect(sortSearchResults(results, 'viewCount').map((r) => r.videoId)).toEqual(['b', 'a', 'c'])
  })
  it('sorts by duration descending', () => {
    expect(sortSearchResults(results, 'duration').map((r) => r.videoId)).toEqual(['b', 'a', 'c'])
  })
  it('sorts by publish date newest first', () => {
    expect(sortSearchResults(results, 'publishDate').map((r) => r.videoId)).toEqual(['c', 'a', 'b'])
  })
  it('does not mutate the input array', () => {
    const original = [...results]
    sortSearchResults(results, 'viewCount')
    expect(results).toEqual(original)
  })
})
