import { describe, it, expect } from 'vitest'
import { parsePrice, parseWeight } from '../../src/scrapers/parsers/price.parser.js'

describe('parsePrice', () => {
  it('parses standard EUR prices', () => {
    expect(parsePrice('15.00 €')).toBe(15)
    expect(parsePrice('25,50 €')).toBe(25.5)
    expect(parsePrice('€ 12.99')).toBe(12.99)
    expect(parsePrice('15.00 EUR')).toBe(15)
  })

  it('parses price from text with other content', () => {
    expect(parsePrice('Cena: 25.00 € s DPH')).toBe(25)
    expect(parsePrice('Od 15,90 EUR')).toBe(15.9)
  })

  it('returns null for invalid input', () => {
    expect(parsePrice(null)).toBeNull()
    expect(parsePrice('')).toBeNull()
    expect(parsePrice('no price here')).toBeNull()
  })
})

describe('parseWeight', () => {
  it('parses gram values', () => {
    expect(parseWeight('250g')).toBe(250)
    expect(parseWeight('250 g')).toBe(250)
    expect(parseWeight('1000 grams')).toBe(1000)
  })

  it('parses kg values', () => {
    expect(parseWeight('1 kg')).toBe(1000)
    expect(parseWeight('0.5 kg')).toBe(500)
  })

  it('parses weight from product titles', () => {
    expect(parseWeight('Ethiopia 250g')).toBe(250)
    expect(parseWeight('Coffee blend 1kg')).toBe(1000)
  })

  it('returns null for invalid input', () => {
    expect(parseWeight(null)).toBeNull()
    expect(parseWeight('')).toBeNull()
    expect(parseWeight('no weight')).toBeNull()
  })
})
