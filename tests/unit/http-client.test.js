import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithRetry } from '../../src/utils/http-client.js'

describe('fetchWithRetry', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fetches successfully on first attempt', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<html>OK</html>')
    })

    const html = await fetchWithRetry('https://example.com', {
      retryAttempts: 1,
      rateLimitMs: 0,
      timeoutMs: 5000
    })

    expect(html).toBe('<html>OK</html>')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on failure and succeeds', async () => {
    globalThis.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html>OK</html>')
      })

    const html = await fetchWithRetry('https://example.com', {
      retryAttempts: 2,
      retryBackoffMs: 10,
      rateLimitMs: 0,
      timeoutMs: 5000
    })

    expect(html).toBe('<html>OK</html>')
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('throws after all retries exhausted', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(
      fetchWithRetry('https://example.com', {
        retryAttempts: 2,
        retryBackoffMs: 10,
        rateLimitMs: 0,
        timeoutMs: 5000
      })
    ).rejects.toThrow('Failed to fetch')
  })

  it('throws on non-ok HTTP response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })

    await expect(
      fetchWithRetry('https://example.com', {
        retryAttempts: 1,
        retryBackoffMs: 10,
        rateLimitMs: 0,
        timeoutMs: 5000
      })
    ).rejects.toThrow('Failed to fetch')
  })

  it('applies rate limiting delay', async () => {
    const start = Date.now()

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('OK')
    })

    await fetchWithRetry('https://example.com', {
      retryAttempts: 1,
      rateLimitMs: 50,
      timeoutMs: 5000
    })

    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })

  it('sets correct headers', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('OK')
    })

    await fetchWithRetry('https://example.com', {
      retryAttempts: 1,
      rateLimitMs: 0,
      timeoutMs: 5000,
      userAgent: 'TestBot/1.0'
    })

    const callArgs = globalThis.fetch.mock.calls[0][1]
    expect(callArgs.headers['User-Agent']).toBe('TestBot/1.0')
    expect(callArgs.headers['Accept-Language']).toBe('sk,en;q=0.9')
  })
})
