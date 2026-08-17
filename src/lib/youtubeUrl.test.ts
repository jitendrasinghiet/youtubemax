import { describe, expect, it } from 'vitest'
import { parsePlaylistId } from './youtubeUrl'

describe('parsePlaylistId', () => {
  it('extracts list= from a watch URL with both v and list', () => {
    expect(
      parsePlaylistId('https://www.youtube.com/watch?v=9ix7TUGVYIo&list=PLe4WWWHGaYWY'),
    ).toBe('PLe4WWWHGaYWY')
  })

  it('extracts list= regardless of param order', () => {
    expect(
      parsePlaylistId('https://youtube.com/watch?list=PLe4WWWHGaYWY&v=9ix7TUGVYIo'),
    ).toBe('PLe4WWWHGaYWY')
  })

  it('returns null when there is no list param', () => {
    expect(parsePlaylistId('https://www.youtube.com/watch?v=9ix7TUGVYIo')).toBeNull()
  })

  it('returns null for a bare video ID', () => {
    expect(parsePlaylistId('9ix7TUGVYIo')).toBeNull()
  })

  it('returns null for non-YouTube hosts', () => {
    expect(parsePlaylistId('https://example.com/watch?v=x&list=PLe4WWWHGaYWY')).toBeNull()
  })

  it('works on youtu.be short links', () => {
    expect(parsePlaylistId('https://youtu.be/9ix7TUGVYIo?list=PLe4WWWHGaYWY')).toBe(
      'PLe4WWWHGaYWY',
    )
  })
})
