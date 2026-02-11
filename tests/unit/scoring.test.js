import { describe, it, expect } from 'vitest'
import { getOriginScore } from '../../src/scoring/origin-tiers.js'
import { getPriceTier, getPriceValueScore } from '../../src/scoring/price-tiers.js'
import {
  normalizeRating,
  normalizeFreshness,
  normalizeSubscriptionSavings,
  normalizeBadges,
  normalizeAwards,
  normalizeBlogScore
} from '../../src/scoring/normalizers.js'

const originTiers = {
  S: { score: 100, countries: ['Ethiopia', 'Kenya', 'Panama', 'Colombia'] },
  A: { score: 85, countries: ['Brazil', 'Honduras'] },
  B: { score: 70, countries: ['Indonesia', 'Mexico'] },
  C: { score: 55, countries: ['India'] },
  D: { score: 40, countries: ['Vietnam'] }
}

const priceTiers = {
  budget: { maxPerKg: 15, label: 'Budget' },
  midRange: { maxPerKg: 30, label: 'Mid-range' },
  premium: { maxPerKg: 50, label: 'Premium' },
  ultraPremium: { maxPerKg: 999, label: 'Ultra-premium' }
}

describe('getOriginScore', () => {
  it('returns correct score for known countries', () => {
    expect(getOriginScore('Ethiopia', originTiers)).toBe(100)
    expect(getOriginScore('Brazil', originTiers)).toBe(85)
    expect(getOriginScore('Indonesia', originTiers)).toBe(70)
    expect(getOriginScore('India', originTiers)).toBe(55)
    expect(getOriginScore('Vietnam', originTiers)).toBe(40)
  })

  it('is case-insensitive', () => {
    expect(getOriginScore('ethiopia', originTiers)).toBe(100)
    expect(getOriginScore('BRAZIL', originTiers)).toBe(85)
  })

  it('returns default for unknown countries', () => {
    expect(getOriginScore('Atlantis', originTiers)).toBe(55)
  })

  it('returns null for null input', () => {
    expect(getOriginScore(null, originTiers)).toBeNull()
  })
})

describe('getPriceTier', () => {
  it('returns correct tier', () => {
    expect(getPriceTier(1, priceTiers).key).toBe('budget')
    expect(getPriceTier(2, priceTiers).key).toBe('midRange')
    expect(getPriceTier(4, priceTiers).key).toBe('premium')
    expect(getPriceTier(7, priceTiers).key).toBe('ultraPremium')
  })

  it('returns null for null input', () => {
    expect(getPriceTier(null, priceTiers)).toBeNull()
  })
})

describe('getPriceValueScore', () => {
  it('scores lower prices higher', () => {
    const prices = [2, 3, 4, 5, 6]
    expect(getPriceValueScore(2, prices)).toBe(100) // cheapest
    expect(getPriceValueScore(6, prices)).toBe(20)  // most expensive
  })

  it('returns null for null input', () => {
    expect(getPriceValueScore(null, [1, 2, 3])).toBeNull()
    expect(getPriceValueScore(5, [])).toBeNull()
  })
})

describe('normalizers', () => {
  it('normalizeRating converts to 0-100', () => {
    expect(normalizeRating(5, 5)).toBe(100)
    expect(normalizeRating(4, 5)).toBe(80)
    expect(normalizeRating(null, 5)).toBeNull()
  })

  it('normalizeFreshness scores recent products higher', () => {
    const today = new Date().toISOString()
    expect(normalizeFreshness(today, 90)).toBe(100)
    expect(normalizeFreshness(null, 90)).toBeNull()
  })

  it('normalizeSubscriptionSavings', () => {
    expect(normalizeSubscriptionSavings(10, 8)).toBeGreaterThan(0)
    expect(normalizeSubscriptionSavings(10, 10)).toBe(0)
    expect(normalizeSubscriptionSavings(null, null)).toBeNull()
  })

  it('normalizeBadges scores badges', () => {
    expect(normalizeBadges([])).toBe(0)
    expect(normalizeBadges([{ badgeType: 'limited' }])).toBe(40)
    expect(normalizeBadges([{ badgeType: 'limited' }, { badgeType: 'new' }])).toBe(60)
  })

  it('normalizeAwards', () => {
    expect(normalizeAwards([])).toBe(0)
    expect(normalizeAwards([{ badgeType: 'award' }])).toBe(100)
    expect(normalizeAwards([{ badgeType: 'new' }])).toBe(0)
  })

  it('normalizeBlogScore', () => {
    expect(normalizeBlogScore(85)).toBe(85)
    expect(normalizeBlogScore(null)).toBeNull()
    expect(normalizeBlogScore(105)).toBe(100)
  })
})
