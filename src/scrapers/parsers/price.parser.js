const PRICE_PATTERNS = [
  /(\d+[.,]\d{2})\s*€/,
  /(\d+[.,]\d{2})\s*EUR/i,
  /€\s*(\d+[.,]\d{2})/,
  /EUR\s*(\d+[.,]\d{2})/i,
  /(\d+[.,]\d{2})\s*eur/i,
  /(\d+[.,]\d{2})/
]

export function parsePrice(text) {
  if (!text || typeof text !== 'string') {
    return null
  }

  const cleaned = text.trim().replace(/\s+/g, ' ')

  for (const pattern of PRICE_PATTERNS) {
    const match = cleaned.match(pattern)
    if (match) {
      const normalized = match[1].replace(',', '.')
      const price = parseFloat(normalized)
      if (!isNaN(price) && price > 0) {
        return price
      }
    }
  }

  return null
}

const WEIGHT_PATTERNS = [
  /(\d+)\s*g(?:r(?:am)?s?)?/i,
  /(\d+[.,]\d+)\s*kg/i,
  /(\d+)\s*kg/i
]

export function parseWeight(text) {
  if (!text || typeof text !== 'string') {
    return null
  }

  for (const pattern of WEIGHT_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      const value = parseFloat(match[1].replace(',', '.'))
      if (text.toLowerCase().includes('kg')) {
        return Math.round(value * 1000)
      }
      return Math.round(value)
    }
  }

  return null
}
