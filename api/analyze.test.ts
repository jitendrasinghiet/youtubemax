import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const { analyzeVideo } = vi.hoisted(() => ({ analyzeVideo: vi.fn() }))
vi.mock('../server/analyze.js', () => ({ analyzeVideo }))

const { default: handler } = await import('./analyze')

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

describe('api/analyze handler', () => {
  beforeEach(() => {
    analyzeVideo.mockReset()
  })

  it('rejects non-GET methods', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'POST' }), res)
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('GET')
    expect(analyzeVideo).not.toHaveBeenCalled()
  })

  it('rejects a videoId that does not parse', async () => {
    const res = mockRes()
    await handler(mockReq({ query: { videoId: 'not a url' } }), res)
    expect(res.statusCode).toBe(400)
    expect(analyzeVideo).not.toHaveBeenCalled()
  })

  it('defaults includeTranscript/includeSummary/includeChapters to true', async () => {
    analyzeVideo.mockResolvedValue({ meta: { videoId: 'dQw4w9WgXcQ' } })
    const res = mockRes()
    await handler(mockReq({ query: { videoId: 'dQw4w9WgXcQ' } }), res)

    expect(analyzeVideo).toHaveBeenCalledWith('dQw4w9WgXcQ', {
      includeTranscript: true,
      includeSummary: true,
      includeChapters: true,
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['Cache-Control']).toContain('s-maxage')
  })

  it('parses includeTranscript=false from the query string', async () => {
    analyzeVideo.mockResolvedValue({ meta: { videoId: 'dQw4w9WgXcQ' } })
    const res = mockRes()
    await handler(
      mockReq({ query: { videoId: 'dQw4w9WgXcQ', includeTranscript: 'false' } }),
      res,
    )
    expect(analyzeVideo).toHaveBeenCalledWith(
      'dQw4w9WgXcQ',
      expect.objectContaining({ includeTranscript: false }),
    )
  })

  it('maps a thrown error to a 500 with its message', async () => {
    analyzeVideo.mockRejectedValue(new Error('caption fetch failed'))
    const res = mockRes()
    await handler(mockReq({ query: { videoId: 'dQw4w9WgXcQ' } }), res)
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'caption fetch failed' })
  })
})
