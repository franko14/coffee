import { describe, it, expect } from 'vitest'
import { daysSince, formatDate, formatRelative } from '../../src/utils/date-utils.js'

describe('daysSince', () => {
  it('returns 0 for today', () => {
    expect(daysSince(new Date().toISOString())).toBe(0)
  })

  it('returns correct number of days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(daysSince(threeDaysAgo)).toBe(3)
  })

  it('returns null for null input', () => {
    expect(daysSince(null)).toBeNull()
  })
})

describe('formatDate', () => {
  it('formats date in sk-SK locale', () => {
    const result = formatDate('2024-06-15T10:00:00Z')
    expect(result).toMatch(/15/)
    expect(result).toMatch(/06/)
    expect(result).toMatch(/2024/)
  })

  it('returns N/A for null', () => {
    expect(formatDate(null)).toBe('N/A')
  })
})

describe('formatRelative', () => {
  it('returns Today for today', () => {
    expect(formatRelative(new Date().toISOString())).toBe('Today')
  })

  it('returns Yesterday', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelative(yesterday)).toBe('Yesterday')
  })

  it('returns N days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelative(threeDaysAgo)).toBe('3 days ago')
  })

  it('returns N/A for null', () => {
    expect(formatRelative(null)).toBe('N/A')
  })
})
