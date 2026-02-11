import { createChildLogger } from './logger.js'

const log = createChildLogger('http-client')

export async function fetchWithRetry(url, options = {}) {
  const {
    retryAttempts = 3,
    retryBackoffMs = 1000,
    timeoutMs = 15000,
    userAgent = 'CoffeeMonitor/1.0 (personal-use)',
    rateLimitMs = 0,
    ...fetchOptions
  } = options

  const headers = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'sk,en;q=0.9',
    ...fetchOptions.headers
  }

  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      if (rateLimitMs > 0 && attempt === 1) {
        await sleep(rateLimitMs)
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()
      log.debug({ url, status: response.status }, 'Fetched successfully')
      return html
    } catch (error) {
      const isLastAttempt = attempt === retryAttempts
      const backoff = retryBackoffMs * Math.pow(2, attempt - 1)

      if (isLastAttempt) {
        log.error({ url, attempt, error: error.message }, 'All retry attempts exhausted')
        throw new Error(`Failed to fetch ${url} after ${retryAttempts} attempts: ${error.message}`)
      }

      log.warn({ url, attempt, backoff, error: error.message }, 'Retrying after failure')
      await sleep(backoff)
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
