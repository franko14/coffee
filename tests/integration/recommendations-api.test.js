import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../src/db/migrator.js'
import { createShopRepository } from '../../src/db/repositories/shop.repository.js'
import { createProductRepository } from '../../src/db/repositories/product.repository.js'
import { createVariantRepository } from '../../src/db/repositories/variant.repository.js'
import { createRatingRepository } from '../../src/db/repositories/rating.repository.js'
import { createBadgeRepository } from '../../src/db/repositories/badge.repository.js'
import { createBlogReviewRepository } from '../../src/db/repositories/blog-review.repository.js'
import { createPriceHistoryRepository } from '../../src/db/repositories/price-history.repository.js'
import { createAlertRepository } from '../../src/db/repositories/alert.repository.js'
import { clearConfigCache } from '../../config/loader.js'
import { resetDbInstance } from '../../src/db/connection.js'
import express from 'express'
import { createRecommendationRoutes } from '../../src/server/routes/recommendations.routes.js'
import { createPriceHistoryRoutes } from '../../src/server/routes/price-history.routes.js'

const config = {
  scoring: {
    weights: {
      priceValue: 0.3,
      rating: 0.2,
      originQuality: 0.15,
      blogScore: 0.1,
      freshness: 0.1,
      awards: 0.05,
      subscriptionSavings: 0.05,
      specialBadges: 0.05
    },
    priceTiers: {
      budget: { maxPerKg: 15, label: 'Budget' },
      midRange: { maxPerKg: 30, label: 'Mid-range' },
      premium: { maxPerKg: 50, label: 'Premium' },
      ultraPremium: { maxPerKg: 999, label: 'Ultra-premium' }
    },
    freshnessWindowDays: 90,
    originTiers: {
      S: { score: 100, countries: ['Ethiopia', 'Kenya'] },
      A: { score: 85, countries: ['Brazil'] }
    }
  }
}

let db, server, baseUrl

beforeAll(() => {
  clearConfigCache()
  resetDbInstance()

  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)

  const shopRepo = createShopRepository(db)
  shopRepo.upsert({ slug: 'test', name: 'Test Shop', url: 'https://test.com', scraperKey: 't', listingPath: '/', hasRatings: false, hasSubscriptions: false, isBlog: false })
  const shop = shopRepo.findBySlug('test')

  const productRepo = createProductRepository(db)
  const { id: pid } = productRepo.upsert({
    shopId: shop.id, slug: 'eth', name: 'Ethiopia Test', url: 'https://test.com/eth',
    imageUrl: null, description: 'Test coffee', originCountry: 'Ethiopia',
    originRegion: null, process: 'washed', roastLevel: 'light', variety: null,
    tastingNotes: null, altitude: null, isBlend: 0, isDecaf: 0, externalId: null
  })

  const variantRepo = createVariantRepository(db)
  variantRepo.upsert({ productId: pid, weightGrams: 250, grind: null, label: null, currentPrice: 15, currentSubscriptionPrice: null, pricePer100g: 6, inStock: 1, sku: null })

  const priceHistoryRepo = createPriceHistoryRepository(db)
  priceHistoryRepo.record({ variantId: 1, price: 15, subscriptionPrice: null, pricePer100g: 6 })

  const ratingRepo = createRatingRepository(db)
  const badgeRepo = createBadgeRepository(db)
  const blogReviewRepo = createBlogReviewRepository(db)

  const app = express()
  app.use(express.json())
  app.use('/api/recommendations', createRecommendationRoutes(productRepo, variantRepo, ratingRepo, badgeRepo, blogReviewRepo, config, shopRepo))
  app.use('/api/price-history', createPriceHistoryRoutes(priceHistoryRepo))

  return new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`
      resolve()
    })
  })
})

afterAll(() => {
  server?.close()
  db?.close()
})

describe('Recommendations API', () => {
  it('GET /api/recommendations returns scored products', async () => {
    const resp = await fetch(`${baseUrl}/api/recommendations`)
    const data = await resp.json()
    expect(data.success).toBe(true)
    expect(data.data.length).toBeGreaterThan(0)
    expect(data.data[0]).toHaveProperty('score')
    expect(data.data[0]).toHaveProperty('priceTier')
    expect(data.data[0]).toHaveProperty('breakdown')
  })

  it('GET /api/recommendations?top=1 limits results', async () => {
    const resp = await fetch(`${baseUrl}/api/recommendations?top=1`)
    const data = await resp.json()
    expect(data.data.length).toBeLessThanOrEqual(1)
  })
})

describe('Price History API', () => {
  it('GET /api/price-history/product/1 returns history', async () => {
    const resp = await fetch(`${baseUrl}/api/price-history/product/1`)
    const data = await resp.json()
    expect(data.success).toBe(true)
    expect(data.data.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /api/price-history/recent returns recent entries', async () => {
    const resp = await fetch(`${baseUrl}/api/price-history/recent`)
    const data = await resp.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.data)).toBe(true)
  })
})
