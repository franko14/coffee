import * as cheerio from 'cheerio'

export function extractJsonLd(htmlOrCheerio) {
  const $ = typeof htmlOrCheerio === 'string' ? cheerio.load(htmlOrCheerio) : htmlOrCheerio
  const results = []

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html())
      if (Array.isArray(data)) {
        results.push(...data)
      } else {
        results.push(data)
      }
    } catch {
      // skip malformed JSON-LD blocks
    }
  })

  return results
}

export function extractProductJsonLd(htmlOrCheerio) {
  const allLd = extractJsonLd(htmlOrCheerio)

  for (const item of allLd) {
    if (item['@type'] === 'Product') {
      return item
    }
    if (item['@graph']) {
      const product = item['@graph'].find((g) => g['@type'] === 'Product')
      if (product) {
        return product
      }
    }
  }

  return null
}

export function parseProductFromJsonLd(jsonLd) {
  if (!jsonLd) {
    return null
  }

  const offers = normalizeOffers(jsonLd.offers)

  return {
    name: jsonLd.name || null,
    description: jsonLd.description || null,
    image: extractImage(jsonLd.image),
    sku: jsonLd.sku || null,
    url: jsonLd.url || null,
    rating: extractRating(jsonLd.aggregateRating),
    offers
  }
}

function normalizeOffers(offers) {
  if (!offers) {
    return []
  }

  if (Array.isArray(offers)) {
    return offers.map(parseOffer)
  }

  if (offers['@type'] === 'AggregateOffer') {
    return [{
      price: parseFloat(offers.lowPrice) || null,
      highPrice: parseFloat(offers.highPrice) || null,
      currency: offers.priceCurrency || 'EUR',
      availability: offers.availability || null
    }]
  }

  return [parseOffer(offers)]
}

function parseOffer(offer) {
  // Try direct price first, then check priceSpecification array
  let price = parseFloat(offer.price) || null
  let currency = offer.priceCurrency || 'EUR'

  // Some sites use priceSpecification instead of direct price
  if (!price && offer.priceSpecification) {
    const specs = Array.isArray(offer.priceSpecification)
      ? offer.priceSpecification
      : [offer.priceSpecification]
    for (const spec of specs) {
      if (spec.price) {
        price = parseFloat(spec.price) || null
        currency = spec.priceCurrency || currency
        break
      }
    }
  }

  return {
    price,
    currency,
    availability: offer.availability || null,
    url: offer.url || null,
    sku: offer.sku || null
  }
}

function extractImage(image) {
  if (!image) return null
  if (typeof image === 'string') return image
  if (Array.isArray(image)) return image[0]?.url || image[0] || null
  return image.url || image['@id'] || null
}

function extractRating(rating) {
  if (!rating) return null
  return {
    value: parseFloat(rating.ratingValue) || null,
    count: parseInt(rating.reviewCount || rating.ratingCount, 10) || 0,
    bestRating: parseFloat(rating.bestRating) || 5
  }
}
