import { describe, it, expect } from 'vitest'
import { createTierCalculator } from '../../src/scoring/tier-calculator.js'

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
      A: { score: 85, countries: ['Brazil', 'Honduras'] },
      B: { score: 70, countries: ['Indonesia'] },
      C: { score: 55, countries: ['India'] },
      D: { score: 40, countries: ['Vietnam'] }
    }
  }
}

const baseProduct = {
  id: 1,
  name: 'Test Coffee',
  shop_slug: 'test',
  shop_name: 'Test Shop',
  url: 'https://test.com/coffee',
  image_url: null,
  origin_country: 'Ethiopia',
  process: 'washed',
  roast_level: 'light',
  tasting_notes: null,
  first_seen_at: new Date().toISOString()
}

const baseVariant = {
  id: 1,
  weight_grams: 250,
  current_price: 12,
  current_subscription_price: null,
  price_per_100g: 4.8,
  in_stock: 1
}

describe('createTierCalculator', () => {
  const calculator = createTierCalculator(config)

  it('scores a product with all factors', () => {
    const context = {
      variants: [baseVariant],
      rating: { average_rating: 4.5, out_of: 5 },
      badges: [{ badgeType: 'limited' }],
      blogReview: { cupping_score: 85 },
      allPricesInTier: [3, 4.8, 6, 8]
    }

    const result = calculator.score(baseProduct, context)

    expect(result.productId).toBe(1)
    expect(result.name).toBe('Test Coffee')
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.priceTier).toBe('Premium')
    expect(result.bestVariant.price).toBe(12)
    expect(result.breakdown).toHaveProperty('priceValue')
    expect(result.breakdown).toHaveProperty('rating')
    expect(result.breakdown).toHaveProperty('originQuality')
  })

  it('returns empty result when no variants', () => {
    const result = calculator.score(baseProduct, { variants: [] })

    expect(result.score).toBe(0)
    expect(result.confidence).toBe(0)
    expect(result.bestVariant).toBeNull()
  })

  it('returns empty result when variants is null', () => {
    const result = calculator.score(baseProduct, { variants: null })

    expect(result.score).toBe(0)
    expect(result.bestVariant).toBeNull()
  })

  it('selects in-stock variant with lowest pricePer100g', () => {
    const variants = [
      { ...baseVariant, id: 1, price_per_100g: 6, in_stock: 1 },
      { ...baseVariant, id: 2, price_per_100g: 4, in_stock: 1 },
      { ...baseVariant, id: 3, price_per_100g: 3, in_stock: 0 }
    ]

    const result = calculator.score(baseProduct, {
      variants,
      allPricesInTier: [3, 4, 6]
    })

    expect(result.bestVariant.id).toBe(2)
  })

  it('falls back to out-of-stock variants when none in stock', () => {
    const variants = [
      { ...baseVariant, id: 1, price_per_100g: 6, in_stock: 0 },
      { ...baseVariant, id: 2, price_per_100g: 4, in_stock: 0 }
    ]

    const result = calculator.score(baseProduct, {
      variants,
      allPricesInTier: [4, 6]
    })

    expect(result.bestVariant.id).toBe(2)
  })

  it('handles missing optional factors gracefully', () => {
    const context = {
      variants: [baseVariant],
      rating: null,
      badges: [],
      blogReview: null,
      allPricesInTier: [4.8]
    }

    const product = { ...baseProduct, origin_country: null, first_seen_at: null }
    const result = calculator.score(product, context)

    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThan(1)
  })

  it('includes subscription savings when available', () => {
    const variantWithSub = {
      ...baseVariant,
      current_subscription_price: 10
    }

    const result = calculator.score(baseProduct, {
      variants: [variantWithSub],
      allPricesInTier: [4.8]
    })

    expect(result.breakdown).toHaveProperty('subscriptionSavings')
    expect(result.bestVariant.subscriptionPrice).toBe(10)
  })

  describe('scoreAll', () => {
    it('scores and sorts multiple products', () => {
      const products = [
        { ...baseProduct, id: 1, name: 'Coffee A', origin_country: 'Vietnam' },
        { ...baseProduct, id: 2, name: 'Coffee B', origin_country: 'Ethiopia' }
      ]

      const contextMap = new Map()
      contextMap.set(1, { variants: [{ ...baseVariant, id: 1, price_per_100g: 6 }], allPricesInTier: [4.8, 6] })
      contextMap.set(2, { variants: [{ ...baseVariant, id: 2, price_per_100g: 4.8 }], allPricesInTier: [4.8, 6] })

      const results = calculator.scoreAll(products, contextMap)

      expect(results).toHaveLength(2)
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
    })

    it('filters out zero-score products', () => {
      const products = [
        { ...baseProduct, id: 1 },
        { ...baseProduct, id: 2 }
      ]

      const contextMap = new Map()
      contextMap.set(1, { variants: [baseVariant], allPricesInTier: [4.8] })
      contextMap.set(2, { variants: [] })

      const results = calculator.scoreAll(products, contextMap)

      expect(results).toHaveLength(1)
      expect(results[0].productId).toBe(1)
    })

    it('handles missing context for a product', () => {
      const products = [{ ...baseProduct, id: 99 }]
      const contextMap = new Map()

      const results = calculator.scoreAll(products, contextMap)

      expect(results).toHaveLength(0)
    })
  })
})
