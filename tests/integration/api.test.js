import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { loadConfig, clearConfigCache } from '../../config/loader.js'
import { runMigrations } from '../../src/db/migrator.js'
import { createShopRepository } from '../../src/db/repositories/shop.repository.js'
import { createProductRepository } from '../../src/db/repositories/product.repository.js'
import { createVariantRepository } from '../../src/db/repositories/variant.repository.js'
import { createPriceHistoryRepository } from '../../src/db/repositories/price-history.repository.js'
import { createRatingRepository } from '../../src/db/repositories/rating.repository.js'
import { createBadgeRepository } from '../../src/db/repositories/badge.repository.js'
import { createBlogReviewRepository } from '../../src/db/repositories/blog-review.repository.js'
import { createAlertRepository } from '../../src/db/repositories/alert.repository.js'
import { resetDbInstance } from '../../src/db/connection.js'
import express from 'express'
import { createProductRoutes } from '../../src/server/routes/products.routes.js'
import { createShopRoutes } from '../../src/server/routes/shops.routes.js'
import { createAlertRoutes } from '../../src/server/routes/alerts.routes.js'

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

  const ratingRepo = createRatingRepository(db)
  const badgeRepo = createBadgeRepository(db)
  const blogReviewRepo = createBlogReviewRepository(db)
  const alertRepo = createAlertRepository(db)
  const priceHistoryRepo = createPriceHistoryRepository(db)

  const app = express()
  app.use(express.json())
  app.use('/api/products', createProductRoutes(productRepo, variantRepo, ratingRepo, badgeRepo, blogReviewRepo))
  app.use('/api/shops', createShopRoutes(shopRepo, productRepo))
  app.use('/api/alerts', createAlertRoutes(alertRepo))

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

describe('Products API', () => {
  it('GET /api/products returns products', async () => {
    const resp = await fetch(`${baseUrl}/api/products`)
    const data = await resp.json()
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(1)
    expect(data.data[0].name).toBe('Ethiopia Test')
  })

  it('GET /api/products/:id returns product detail', async () => {
    const resp = await fetch(`${baseUrl}/api/products/1`)
    const data = await resp.json()
    expect(data.success).toBe(true)
    expect(data.data.name).toBe('Ethiopia Test')
    expect(data.data.variants).toHaveLength(1)
  })

  it('GET /api/products/999 returns 404', async () => {
    const resp = await fetch(`${baseUrl}/api/products/999`)
    expect(resp.status).toBe(404)
  })
})

describe('Shops API', () => {
  it('GET /api/shops returns shops', async () => {
    const resp = await fetch(`${baseUrl}/api/shops`)
    const data = await resp.json()
    expect(data.success).toBe(true)
    expect(data.data.length).toBeGreaterThan(0)
  })
})

describe('Alerts API', () => {
  it('GET /api/alerts returns empty list', async () => {
    const resp = await fetch(`${baseUrl}/api/alerts`)
    const data = await resp.json()
    expect(data.success).toBe(true)
    expect(data.data).toEqual([])
    expect(data.meta.unreadCount).toBe(0)
  })
})
