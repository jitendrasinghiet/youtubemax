import { describe, it, expect } from 'vitest'
import { parseVideoId, formatTimestamp, parseDescriptionChapters } from './youtube'

describe('parseVideoId', () => {
  it('accepts a bare 11-char id', () => {
    expect(parseVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('parses a standard watch URL', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('parses a youtu.be short link', () => {
    expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('parses an embed URL', () => {
    expect(parseVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('parses a shorts URL', () => {
    expect(parseVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('accepts URLs without a protocol', () => {
    expect(parseVideoId('youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('rejects invalid input', () => {
    expect(parseVideoId('')).toBeNull()
    expect(parseVideoId('not a url')).toBeNull()
    expect(parseVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseVideoId('https://www.youtube.com/watch?v=short')).toBeNull()
  })
})

describe('formatTimestamp', () => {
  it('formats sub-hour durations as M:SS', () => {
    expect(formatTimestamp(0)).toBe('0:00')
    expect(formatTimestamp(65)).toBe('1:05')
  })
  it('formats hour+ durations as H:MM:SS', () => {
    expect(formatTimestamp(3661)).toBe('1:01:01')
  })
  it('clamps negative input to zero', () => {
    expect(formatTimestamp(-10)).toBe('0:00')
  })
})

describe('parseDescriptionChapters', () => {
  it('extracts and sorts timestamped chapter lines', () => {
    const description = [
      '0:00 Intro',
      '2:30 - First topic',
      '10:05 — Wrap up',
    ].join('\n')
    expect(parseDescriptionChapters(description)).toEqual([
      { start: 0, title: 'Intro', source: 'description' },
      { start: 150, title: 'First topic', source: 'description' },
      { start: 605, title: 'Wrap up', source: 'description' },
    ])
  })
  it('returns an empty array when no timestamps are present', () => {
    expect(parseDescriptionChapters('Just some text with no times')).toEqual([])
  })
})
