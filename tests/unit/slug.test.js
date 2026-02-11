import { describe, it, expect } from 'vitest'
import { slugify } from '../../src/utils/slug.js'

describe('slugify', () => {
  it('converts to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('handles diacritics', () => {
    expect(slugify('Zlaté Zrnko')).toBe('zlate-zrnko')
    expect(slugify('Etiópia')).toBe('etiopia')
    expect(slugify('Výberová káva')).toBe('vyberova-kava')
  })

  it('removes special characters', () => {
    expect(slugify('Coffee (250g)')).toBe('coffee-250g')
    expect(slugify('Price: 15€')).toBe('price-15')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('hello   world')).toBe('hello-world')
    expect(slugify('a--b--c')).toBe('a-b-c')
  })

  it('returns empty string for null/undefined', () => {
    expect(slugify(null)).toBe('')
    expect(slugify(undefined)).toBe('')
    expect(slugify('')).toBe('')
  })
})
