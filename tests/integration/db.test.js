import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../src/db/migrator.js'
import { createShopRepository } from '../../src/db/repositories/shop.repository.js'
import { createProductRepository } from '../../src/db/repositories/product.repository.js'
import { createVariantRepository } from '../../src/db/repositories/variant.repository.js'
import { createPriceHistoryRepository } from '../../src/db/repositories/price-history.repository.js'
import { createAlertRepository } from '../../src/db/repositories/alert.repository.js'

let db

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
})

afterEach(() => {
  db.close()
})

describe('shop repository', () => {
  it('upserts and finds shops', () => {
    const repo = createShopRepository(db)
    repo.upsert({
      slug: 'test-shop',
      name: 'Test Shop',
      url: 'https://test.com',
      scraperKey: 'test',
      listingPath: '/shop',
      hasRatings: true,
      hasSubscriptions: false,
      isBlog: false
    })

    const shop = repo.findBySlug('test-shop')
    expect(shop).not.toBeNull()
    expect(shop.name).toBe('Test Shop')
    expect(shop.has_ratings).toBe(1)
  })

  it('lists all shops', () => {
    const repo = createShopRepository(db)
    repo.upsert({ slug: 'a', name: 'A', url: 'https://a.com', scraperKey: 'a', listingPath: '/', hasRatings: false, hasSubscriptions: false, isBlog: false })
    repo.upsert({ slug: 'b', name: 'B', url: 'https://b.com', scraperKey: 'b', listingPath: '/', hasRatings: false, hasSubscriptions: false, isBlog: false })

    const all = repo.findAll()
    expect(all).toHaveLength(2)
  })
})

describe('product repository', () => {
  let shopId

  beforeEach(() => {
    const shopRepo = createShopRepository(db)
    shopRepo.upsert({ slug: 'shop1', name: 'Shop 1', url: 'https://shop1.com', scraperKey: 's1', listingPath: '/', hasRatings: false, hasSubscriptions: false, isBlog: false })
    shopId = shopRepo.findBySlug('shop1').id
  })

  it('upserts products', () => {
    const repo = createProductRepository(db)
    const { id, isNew } = repo.upsert({
      shopId,
      externalId: null,
      slug: 'ethiopia-yirg',
      name: 'Ethiopia Yirgacheffe',
      url: 'https://shop1.com/eth',
      imageUrl: null,
      description: 'A fine coffee',
      originCountry: 'Ethiopia',
      originRegion: 'Yirgacheffe',
      process: 'washed',
      roastLevel: 'light',
      variety: null,
      tastingNotes: null,
      altitude: null,
      isBlend: 0,
      isDecaf: 0
    })

    expect(id).toBeGreaterThan(0)
    expect(isNew).toBe(true)

    const product = repo.findById(id)
    expect(product.name).toBe('Ethiopia Yirgacheffe')
    expect(product.origin_country).toBe('Ethiopia')
  })

  it('updates existing products on upsert', () => {
    const repo = createProductRepository(db)
    const first = repo.upsert({ shopId, slug: 'test', name: 'Test', url: 'https://x.com', imageUrl: null, description: null, originCountry: null, originRegion: null, process: null, roastLevel: null, variety: null, tastingNotes: null, altitude: null, isBlend: 0, isDecaf: 0, externalId: null })
    const second = repo.upsert({ shopId, slug: 'test', name: 'Test Updated', url: 'https://x.com', imageUrl: null, description: null, originCountry: 'Brazil', originRegion: null, process: null, roastLevel: null, variety: null, tastingNotes: null, altitude: null, isBlend: 0, isDecaf: 0, externalId: null })

    expect(first.isNew).toBe(true)
    expect(second.isNew).toBe(false)
    expect(second.id).toBe(first.id)
  })
})

describe('variant repository', () => {
  let productId

  beforeEach(() => {
    const shopRepo = createShopRepository(db)
    shopRepo.upsert({ slug: 's', name: 'S', url: 'https://s.com', scraperKey: 's', listingPath: '/', hasRatings: false, hasSubscriptions: false, isBlog: false })
    const shopId = shopRepo.findBySlug('s').id

    const productRepo = createProductRepository(db)
    const result = productRepo.upsert({ shopId, slug: 'coffee', name: 'Coffee', url: 'https://s.com/c', imageUrl: null, description: null, originCountry: null, originRegion: null, process: null, roastLevel: null, variety: null, tastingNotes: null, altitude: null, isBlend: 0, isDecaf: 0, externalId: null })
    productId = result.id
  })

  it('upserts variants and detects price changes', () => {
    const repo = createVariantRepository(db)

    const first = repo.upsert({ productId, weightGrams: 250, grind: null, label: null, currentPrice: 15, currentSubscriptionPrice: null, pricePer100g: 6, inStock: 1, sku: null })
    expect(first.isNew).toBe(true)

    const second = repo.upsert({ productId, weightGrams: 250, grind: null, label: null, currentPrice: 12, currentSubscriptionPrice: null, pricePer100g: 4.8, inStock: 1, sku: null })
    expect(second.isNew).toBe(false)
    expect(second.priceChanged).toBe(true)
    expect(second.previousPrice).toBe(15)
  })
})

describe('alert repository', () => {
  it('creates and retrieves alerts', () => {
    const repo = createAlertRepository(db)

    repo.create({
      alertType: 'price_drop',
      severity: 'info',
      shopSlug: 'test',
      productId: null,
      title: 'Price Drop!',
      message: '15 EUR -> 12 EUR',
      data: { old: 15, new: 12 }
    })

    const all = repo.findAll()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('Price Drop!')

    expect(repo.countUnread()).toBe(1)

    repo.markAllRead()
    expect(repo.countUnread()).toBe(0)
  })
})
