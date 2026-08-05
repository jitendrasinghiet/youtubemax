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
  it('parses immediate relative dates', () => {
    expect(parseRelativeDateToDays('just now')).toBe(0)
    expect(parseRelativeDateToDays('today')).toBe(0)
    expect(parseRelativeDateToDays('yesterday')).toBe(1)
  })
  it('returns Infinity when unparseable', () => {
    expect(parseRelativeDateToDays(undefined)).toBe(Infinity)
    expect(parseRelativeDateToDays('sometime recently')).toBe(Infinity)
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
  it('sorts by recommended score using query match, popularity, and recency', () => {
    const recommendedResults = [
      make({
        videoId: 'd',
        title: 'Solar system for kids',
        description: 'Learn planets and space basics',
        viewCount: '250K',
        publishedAt: '2 days ago',
      }),
      make({
        videoId: 'e',
        title: 'Space documentary',
        description: 'Solar system explained for beginners',
        viewCount: '5M',
        publishedAt: '3 years ago',
      }),
      make({
        videoId: 'f',
        title: 'Animals for kids',
        description: 'Wildlife facts',
        viewCount: '8M',
        publishedAt: '1 day ago',
      }),
    ]

    expect(sortSearchResults(recommendedResults, 'recommended', 'solar system kids').map((r) => r.videoId)).toEqual([
      'd',
      'e',
      'f',
    ])
  })
  it('uses popularity and recency when no query is provided for recommended sort', () => {
    const fallbackResults = [
      make({ videoId: 'g', viewCount: '300K', publishedAt: '2 days ago' }),
      make({ videoId: 'h', viewCount: '5M', publishedAt: '5 years ago' }),
      make({ videoId: 'i', viewCount: '1M', publishedAt: '1 day ago' }),
    ]

    expect(sortSearchResults(fallbackResults, 'recommended').map((r) => r.videoId)).toEqual([
      'i',
      'g',
      'h',
    ])
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
  it('sorts by channel trust descending when metadata is available', () => {
    const trustedResults = [
      make({ videoId: 'trust-low', channelTrustScore: 0.2 }),
      make({ videoId: 'trust-high', channelTrustScore: 0.9 }),
      make({ videoId: 'trust-mid', channelTrustScore: 0.6 }),
    ]

    expect(sortSearchResults(trustedResults, 'channelTrust').map((r) => r.videoId)).toEqual([
      'trust-high',
      'trust-mid',
      'trust-low',
    ])
  })
  it('sorts by safety descending when metadata is available', () => {
    const safeResults = [
      make({ videoId: 'safe-low', safetyScore: 0.1 }),
      make({ videoId: 'safe-high', safetyScore: 0.95 }),
      make({ videoId: 'safe-mid', safetyScore: 0.55 }),
    ]

    expect(sortSearchResults(safeResults, 'safety').map((r) => r.videoId)).toEqual([
      'safe-high',
      'safe-mid',
      'safe-low',
    ])
  })
  it('does not mutate the input array', () => {
    const original = [...results]
    sortSearchResults(results, 'recommended', 'test query')
    expect(results).toEqual(original)
  })
})
