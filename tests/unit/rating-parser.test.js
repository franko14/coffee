import { describe, it, expect } from 'vitest'
import { normalizeRating, parseRatingFromText } from '../../src/scrapers/parsers/rating.parser.js'

describe('normalizeRating', () => {
  it('normalizes rating to 0-100 scale', () => {
    expect(normalizeRating(5, 5)).toBe(100)
    expect(normalizeRating(4.5, 5)).toBe(90)
    expect(normalizeRating(4.93, 5)).toBeCloseTo(98.6, 0)
    expect(normalizeRating(3, 5)).toBe(60)
  })

  it('clamps to 0-100', () => {
    expect(normalizeRating(6, 5)).toBe(100)
    expect(normalizeRating(0, 5)).toBe(0)
  })

  it('returns null for invalid input', () => {
    expect(normalizeRating(null, 5)).toBeNull()
    expect(normalizeRating(5, 0)).toBeNull()
  })
})

describe('parseRatingFromText', () => {
  it('parses rating from text', () => {
    const result = parseRatingFromText('4.5 / 5')
    expect(result).toEqual({ value: 4.5, outOf: 5 })
  })

  it('parses rating with stars', () => {
    const result = parseRatingFromText('4.93 stars')
    expect(result.value).toBe(4.93)
  })

  it('returns null for no match', () => {
    expect(parseRatingFromText(null)).toBeNull()
    expect(parseRatingFromText('no rating')).toBeNull()
  })
})
