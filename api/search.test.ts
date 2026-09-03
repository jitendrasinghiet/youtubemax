import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const { searchYouTubeVideos, buildYouTubeSearchUrl, getCachedSearch } = vi.hoisted(() => ({
  searchYouTubeVideos: vi.fn(),
  buildYouTubeSearchUrl: vi.fn(() => 'https://youtube.com/results?search_query=mock'),
  getCachedSearch: vi.fn(),
}))
vi.mock('../server/search.js', () => ({ searchYouTubeVideos, buildYouTubeSearchUrl }))
// The handler checks the committed search-cache first (getCachedSearch)
// before ever calling searchYouTubeVideos -- unmocked, this hit the real
// data/search-cache/ on disk, so a query that happens to already be
// cached there (e.g. "lofi") silently took the cache-hit branch and
// never called the mock at all, breaking every assertion below in a
// confusing way (0 calls, or a stray "buildYouTubeSearchUrl is not
// mocked" error). Defaulted to a cache miss so every test exercises the
// same live-search path it did before that cache-check-first change.
vi.mock('../server/searchCache.js', () => ({ getCachedSearch }))

const { default: handler } = await import('./search')

function mockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return { method: 'GET', query: {}, ...overrides } as VercelRequest
}

function mockRes() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      res.headers[name] = value
      return res
    },
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(data: unknown) {
      res.body = data
      return res
    },
  }
  return res as unknown as VercelResponse & typeof res
}

describe('api/search handler', () => {
  beforeEach(() => {
    searchYouTubeVideos.mockReset()
    getCachedSearch.mockReset().mockResolvedValue(null)
  })

  it('rejects non-GET methods', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'POST' }), res)
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('GET')
    expect(searchYouTubeVideos).not.toHaveBeenCalled()
  })

  it('rejects an empty query', async () => {
    const res = mockRes()
    await handler(mockReq({ query: { q: '   ' } }), res)
    expect(res.statusCode).toBe(400)
    expect(searchYouTubeVideos).not.toHaveBeenCalled()
  })

  it('defaults maxResults to 25 when not provided', async () => {
    searchYouTubeVideos.mockResolvedValue({ results: [], searchUrl: 'https://x', warning: undefined })
    const res = mockRes()
    await handler(mockReq({ query: { q: 'lofi' } }), res)
    expect(searchYouTubeVideos).toHaveBeenCalledWith('lofi', 25, undefined)
    expect(res.statusCode).toBe(200)
    expect(res.headers['Cache-Control']).toContain('s-maxage')
  })

  it('parses a numeric maxResults from the query string', async () => {
    searchYouTubeVideos.mockResolvedValue({ results: [], searchUrl: 'https://x', warning: undefined })
    const res = mockRes()
    await handler(mockReq({ query: { q: 'lofi', maxResults: '10' } }), res)
    expect(searchYouTubeVideos).toHaveBeenCalledWith('lofi', 10, undefined)
  })

  it('trims the query before validating and searching', async () => {
    searchYouTubeVideos.mockResolvedValue({ results: [], searchUrl: 'https://x', warning: undefined })
    const res = mockRes()
    await handler(mockReq({ query: { q: '  lofi  ' } }), res)
    expect(searchYouTubeVideos).toHaveBeenCalledWith('lofi', 25, undefined)
  })

  it('passes hl/gl through as a locale when both are valid codes', async () => {
    searchYouTubeVideos.mockResolvedValue({ results: [], searchUrl: 'https://x', warning: undefined })
    const res = mockRes()
    await handler(mockReq({ query: { q: 'bhajan', hl: 'hi', gl: 'IN' } }), res)
    expect(searchYouTubeVideos).toHaveBeenCalledWith('bhajan', 25, { hl: 'hi', gl: 'IN' })
  })

  it('ignores hl/gl when either is missing or malformed', async () => {
    searchYouTubeVideos.mockResolvedValue({ results: [], searchUrl: 'https://x', warning: undefined })
    const res = mockRes()
    await handler(mockReq({ query: { q: 'bhajan', hl: 'not a code!', gl: 'IN' } }), res)
    expect(searchYouTubeVideos).toHaveBeenCalledWith('bhajan', 25, undefined)
  })

  it('maps a thrown error to a 500 with its message', async () => {
    searchYouTubeVideos.mockRejectedValue(new Error('scrape blocked'))
    const res = mockRes()
    await handler(mockReq({ query: { q: 'lofi' } }), res)
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'scrape blocked' })
  })
})
