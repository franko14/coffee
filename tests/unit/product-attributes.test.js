import { describe, it, expect } from 'vitest'
import {
  parseOrigin,
  parseProcess,
  parseRoastLevel,
  parseTastingNotes,
  detectBlend,
  detectDecaf
} from '../../src/scrapers/parsers/product-attributes.parser.js'

describe('parseProcess', () => {
  it('detects processing methods', () => {
    expect(parseProcess('washed process')).toBe('washed')
    expect(parseProcess('Natural processing')).toBe('natural')
    expect(parseProcess('honey processed')).toBe('honey')
    expect(parseProcess('anaerobic fermentation')).toBe('anaerobic')
  })

  it('returns null for unknown', () => {
    expect(parseProcess(null)).toBeNull()
    expect(parseProcess('unknown process')).toBeNull()
  })
})

describe('parseRoastLevel', () => {
  it('detects roast levels', () => {
    expect(parseRoastLevel('light roast')).toBe('light')
    expect(parseRoastLevel('medium roast')).toBe('medium')
    expect(parseRoastLevel('dark roast')).toBe('dark')
    expect(parseRoastLevel('filter roast')).toBe('light')
    expect(parseRoastLevel('espresso roast')).toBe('medium-dark')
  })

  it('returns null for unknown', () => {
    expect(parseRoastLevel(null)).toBeNull()
  })
})

describe('parseTastingNotes', () => {
  it('parses comma-separated notes', () => {
    const result = JSON.parse(parseTastingNotes('chocolate, caramel, nuts'))
    expect(result).toEqual(['chocolate', 'caramel', 'nuts'])
  })

  it('strips prefix labels', () => {
    const result = JSON.parse(parseTastingNotes('Tasting notes: cherry, berry'))
    expect(result).toEqual(['cherry', 'berry'])
  })

  it('returns null for empty input', () => {
    expect(parseTastingNotes(null)).toBeNull()
    expect(parseTastingNotes('')).toBeNull()
  })
})

describe('detectBlend', () => {
  it('detects blends', () => {
    expect(detectBlend('Espresso blend')).toBe(true)
    expect(detectBlend('Brewing blend mix')).toBe(true)
    expect(detectBlend('Ethiopia single origin')).toBe(false)
  })
})

describe('detectDecaf', () => {
  it('detects decaf', () => {
    expect(detectDecaf('Decaf Colombia')).toBe(true)
    expect(detectDecaf('Bezkofeínová káva')).toBe(true)
    expect(detectDecaf('Ethiopia natural')).toBe(false)
  })
})
