import { describe, it, expect } from 'vitest'
import { extractJsonLd, extractProductJsonLd, parseProductFromJsonLd } from '../../src/scrapers/parsers/json-ld.parser.js'

const SAMPLE_HTML = `
<html>
<head>
  <script type="application/ld+json">
  {
    "@type": "Product",
    "name": "Ethiopia Yirgacheffe",
    "description": "Specialty coffee from Ethiopia",
    "image": "https://example.com/coffee.jpg",
    "sku": "ETH-001",
    "offers": {
      "@type": "Offer",
      "price": "15.00",
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock"
    },
    "aggregateRating": {
      "ratingValue": "4.8",
      "reviewCount": "25",
      "bestRating": "5"
    }
  }
  </script>
</head>
<body></body>
</html>
`

describe('extractJsonLd', () => {
  it('extracts JSON-LD from HTML', () => {
    const results = extractJsonLd(SAMPLE_HTML)
    expect(results).toHaveLength(1)
    expect(results[0]['@type']).toBe('Product')
  })

  it('handles HTML with no JSON-LD', () => {
    expect(extractJsonLd('<html><body>No JSON-LD</body></html>')).toEqual([])
  })
})

describe('extractProductJsonLd', () => {
  it('extracts Product type JSON-LD', () => {
    const product = extractProductJsonLd(SAMPLE_HTML)
    expect(product).not.toBeNull()
    expect(product.name).toBe('Ethiopia Yirgacheffe')
  })
})

describe('parseProductFromJsonLd', () => {
  it('parses product data from JSON-LD', () => {
    const jsonLd = extractProductJsonLd(SAMPLE_HTML)
    const product = parseProductFromJsonLd(jsonLd)

    expect(product.name).toBe('Ethiopia Yirgacheffe')
    expect(product.description).toBe('Specialty coffee from Ethiopia')
    expect(product.image).toBe('https://example.com/coffee.jpg')
    expect(product.offers).toHaveLength(1)
    expect(product.offers[0].price).toBe(15)
    expect(product.rating.value).toBe(4.8)
    expect(product.rating.count).toBe(25)
  })

  it('returns null for null input', () => {
    expect(parseProductFromJsonLd(null)).toBeNull()
  })
})
