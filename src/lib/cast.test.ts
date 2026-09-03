import { describe, expect, it } from 'vitest'
import { youtubeCastPlaylistUrl } from './cast'
import type { SearchResultItem } from '../types'

const make = (videoId: string): SearchResultItem => ({
  videoId,
  title: `title ${videoId}`,
  channel: 'c',
  thumbnail: '',
  publishedAt: '',
  description: '',
})

describe('youtubeCastPlaylistUrl', () => {
  const list = [make('a'), make('b'), make('c'), make('d')]

  it('builds a watch_videos URL starting at the given video, in list order', () => {
    const url = youtubeCastPlaylistUrl(list, 'a')
    expect(url).toBe('https://www.youtube.com/watch_videos?video_ids=a%2Cb%2Cc%2Cd')
  })

  it('wraps around back to the start once, starting from a middle item', () => {
    const url = youtubeCastPlaylistUrl(list, 'c')
    const ids = new URL(url!).searchParams.get('video_ids')
    expect(ids).toBe('c,d,a,b')
  })

  it('caps the sequence at maxItems', () => {
    const longList = Array.from({ length: 60 }, (_, i) => make(`v${i}`))
    const url = youtubeCastPlaylistUrl(longList, 'v0', 5)
    const ids = new URL(url!).searchParams.get('video_ids')!.split(',')
    expect(ids).toHaveLength(5)
    expect(ids).toEqual(['v0', 'v1', 'v2', 'v3', 'v4'])
  })

  it('returns null when the starting video is not in the list', () => {
    expect(youtubeCastPlaylistUrl(list, 'not-in-list')).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(youtubeCastPlaylistUrl([], 'a')).toBeNull()
  })
})
