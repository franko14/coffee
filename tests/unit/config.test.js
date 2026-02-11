import { describe, it, expect, beforeEach } from 'vitest'
import { loadConfig, validateConfig, clearConfigCache } from '../../config/loader.js'

describe('config', () => {
  beforeEach(() => {
    clearConfigCache()
  })

  it('loads and validates default config', () => {
    const config = loadConfig()
    expect(config.scraping.rateLimitMs).toBe(1500)
    expect(config.shops).toHaveLength(5)
    expect(config.scoring.weights.priceValue).toBe(0.3)
  })

  it('validates config schema', () => {
    const result = validateConfig()
    expect(result.success).toBe(true)
  })

  it('weights sum to 1.0', () => {
    const config = loadConfig()
    const sum = Object.values(config.scoring.weights).reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001)
  })

  it('all shops have required fields', () => {
    const config = loadConfig()
    for (const shop of config.shops) {
      expect(shop.slug).toBeTruthy()
      expect(shop.name).toBeTruthy()
      expect(shop.url).toBeTruthy()
      expect(shop.scraperKey).toBeTruthy()
    }
  })
})
