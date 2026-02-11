import { describe, it, expect } from 'vitest'
import {
  calculatePricePer100g,
  formatPrice,
  formatPricePer100g,
  pricePerKg,
  getPriceTierLabel
} from '../../src/utils/price-utils.js'

describe('calculatePricePer100g', () => {
  it('calculates price per 100g correctly', () => {
    expect(calculatePricePer100g(15, 250)).toBe(6)
    expect(calculatePricePer100g(30, 1000)).toBe(3)
  })

  it('returns null for invalid inputs', () => {
    expect(calculatePricePer100g(0, 250)).toBeNull()
    expect(calculatePricePer100g(15, 0)).toBeNull()
    expect(calculatePricePer100g(null, 250)).toBeNull()
    expect(calculatePricePer100g(-5, 250)).toBeNull()
  })
})

describe('formatPrice', () => {
  it('formats price with EUR symbol', () => {
    expect(formatPrice(15.5)).toBe('15.50 \u20ac')
    expect(formatPrice(0.99)).toBe('0.99 \u20ac')
  })

  it('returns N/A for null', () => {
    expect(formatPrice(null)).toBe('N/A')
  })
})

describe('formatPricePer100g', () => {
  it('formats price per 100g', () => {
    expect(formatPricePer100g(6)).toBe('6.00 \u20ac/100g')
  })

  it('returns N/A for null', () => {
    expect(formatPricePer100g(null)).toBe('N/A')
  })
})

describe('pricePerKg', () => {
  it('converts 100g price to kg price', () => {
    expect(pricePerKg(3)).toBe(30)
    expect(pricePerKg(6)).toBe(60)
  })

  it('returns null for null input', () => {
    expect(pricePerKg(null)).toBeNull()
  })
})

describe('getPriceTierLabel', () => {
  const tiers = {
    budget: { maxPerKg: 15, label: 'Budget' },
    midRange: { maxPerKg: 30, label: 'Mid-range' },
    premium: { maxPerKg: 50, label: 'Premium' },
    ultraPremium: { maxPerKg: 999, label: 'Ultra-premium' }
  }

  it('returns correct tier labels', () => {
    expect(getPriceTierLabel(1, tiers)).toBe('Budget')
    expect(getPriceTierLabel(2, tiers)).toBe('Mid-range')
    expect(getPriceTierLabel(4, tiers)).toBe('Premium')
    expect(getPriceTierLabel(7, tiers)).toBe('Ultra-premium')
  })

  it('returns Unknown for null', () => {
    expect(getPriceTierLabel(null, tiers)).toBe('Unknown')
  })
})
