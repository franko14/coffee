export function normalizeRating(value, outOf = 5) {
  if (value == null || outOf <= 0) {
    return null
  }

  const normalized = (value / outOf) * 100
  return Math.min(100, Math.max(0, Math.round(normalized * 100) / 100))
}

export function parseRatingFromText(text) {
  if (!text) {
    return null
  }

  const patterns = [
    /(\d+[.,]\d+)\s*\/\s*(\d+)/,
    /(\d+[.,]\d+)\s*(?:out of|z|zo)\s*(\d+)/i,
    /(\d+[.,]\d+)\s*(?:stars?|hviezdič)/i
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const value = parseFloat(match[1].replace(',', '.'))
      const outOf = match[2] ? parseFloat(match[2]) : 5
      return { value, outOf }
    }
  }

  return null
}
