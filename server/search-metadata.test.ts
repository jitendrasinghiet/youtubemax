import { describe, expect, it, vi } from 'vitest'
import {
  computeChannelTrustScore,
  computeSafetyScore,
  enrichSearchResults,
  parseIso8601DurationToSeconds,
} from './search-metadata'
import type { SearchResultItem } from './types'

describe('parseIso8601DurationToSeconds', () => {
  it('parses ISO-8601 durations', () => {
    expect(parseIso8601DurationToSeconds('PT1H2M3S')).toBe(3723)
    expect(parseIso8601DurationToSeconds('PT8M')).toBe(480)
  })

  it('returns undefined for invalid input', () => {
    expect(parseIso8601DurationToSeconds(undefined)).toBeUndefined()
    expect(parseIso8601DurationToSeconds('8:00')).toBeUndefined()
  })
})

describe('computeChannelTrustScore', () => {
  it('rewards older, established channels', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T00:00:00Z'))

    const trusted = computeChannelTrustScore({
      snippet: { publishedAt: '2015-01-01T00:00:00Z' },
      statistics: { subscriberCount: '1200000', videoCount: '850' },
    })

    const newChannel = computeChannelTrustScore({
      snippet: { publishedAt: '2026-01-01T00:00:00Z' },
      statistics: { subscriberCount: '1200', videoCount: '8' },
    })

    expect(trusted).toBeGreaterThan(newChannel)
    vi.useRealTimers()
  })
})

describe('computeSafetyScore', () => {
  it('prefers public, embeddable, kid-friendly metadata', () => {
    const safe = computeSafetyScore({
      channelTrustScore: 0.9,
      viewCount: '100000',
      likeCount: '6000',
      commentCount: '80',
      durationSec: 420,
      captioned: true,
      embeddable: true,
      madeForKids: true,
      privacyStatus: 'public',
    })

    const risky = computeSafetyScore({
      channelTrustScore: 0.1,
      viewCount: '100000',
      likeCount: '500',
      commentCount: '8000',
      durationSec: 5400,
      captioned: false,
      embeddable: false,
      madeForKids: false,
      privacyStatus: 'public',
    })

    expect(safe).toBeGreaterThan(risky)
  })

  it('returns zero for non-public videos', () => {
    expect(computeSafetyScore({ privacyStatus: 'private' })).toBe(0)
  })
})

describe('enrichSearchResults', () => {
  it('merges video and channel metadata into search results', () => {
    const results: SearchResultItem[] = [
      {
        videoId: 'abcdefghijk',
        title: 'Solar System for Kids',
        channel: 'Space Lab',
        thumbnail: 'thumb.jpg',
        publishedAt: '2 days ago',
        description: 'Planets and orbits',
        viewCount: '250K',
        duration: '8:00',
      },
    ]

    const [enriched] = enrichSearchResults(
      results,
      [
        {
          id: 'abcdefghijk',
          snippet: { channelId: 'UC123', tags: ['space', 'science'] },
          statistics: {
            viewCount: '250000',
            likeCount: '12000',
            commentCount: '120',
          },
          contentDetails: { duration: 'PT8M', caption: 'true' },
          status: { embeddable: true, madeForKids: true, privacyStatus: 'public' },
          topicDetails: { topicCategories: ['https://en.wikipedia.org/wiki/Science'] },
        },
      ],
      [
        {
          id: 'UC123',
          snippet: { publishedAt: '2012-01-01T00:00:00Z' },
          statistics: {
            subscriberCount: '500000',
            videoCount: '320',
            viewCount: '80000000',
          },
        },
      ],
    )

    expect(enriched.channelId).toBe('UC123')
    expect(enriched.durationSec).toBe(480)
    expect(enriched.captioned).toBe(true)
    expect(enriched.embeddable).toBe(true)
    expect(enriched.madeForKids).toBe(true)
    expect(enriched.tags).toEqual(['space', 'science'])
    expect(enriched.topicCategories).toEqual(['https://en.wikipedia.org/wiki/Science'])
    expect(enriched.channelTrustScore).toBeGreaterThan(0)
    expect(enriched.safetyScore).toBeGreaterThan(0)
  })
})