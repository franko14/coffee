import * as cheerio from 'cheerio'
import { BaseScraper } from '../base-scraper.js'
import { parsePrice, parseWeight } from '../parsers/price.parser.js'
import { parseProductAttributes } from '../parsers/product-attributes.parser.js'
import { COUNTRY_NAME_MAP } from '../parsers/country-map.js'
import { parseAttributeTable } from '../parsers/attribute-table.parser.js'
import { DEFAULT_WEIGHT_GRAMS, MAX_DESCRIPTION_LENGTH } from '../constants.js'

const NON_PRODUCT_SLUGS = new Set([
  'kava', 'merch', 'doplnky', 'kurzy',
  'ochrana-osobnych-udajov', 'reklamacny-poriadok',
  'nase-kaviarne', 'pracujte-s-kavou-black',
  'kontakt', 'o-nas', 'blog', 'velkoobchod',
  'obchodne-podmienky', 'gdpr', 'home'
])

export class BlackScraper extends BaseScraper {
  async getListingPages() {
    const baseUrl = `${this.shop.url}${this.shop.listingPath}`
    const html = await this.fetch(baseUrl)
    const $ = cheerio.load(html)
    const pages = [baseUrl]

    $('a.pagination-link, .pagination a, a[href*="page="]').each((_, el) => {
      const href = $(el).attr('href')
      if (href && !pages.includes(href)) {
        const fullUrl = href.startsWith('http') ? href : `${this.shop.url}${href}`
        pages.push(fullUrl)
      }
    })

    return [...new Set(pages)]
  }

  async parseListingPage(html, _url) {
    const $ = cheerio.load(html)
    const urls = []

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (href && this.isProductUrl(href)) {
        const fullUrl = href.startsWith('http') ? href : `${this.shop.url}${href}`
        urls.push(fullUrl)
      }
    })

    return [...new Set(urls)]
  }

  async parseProductDetail(html, url) {
    const $ = cheerio.load(html)

    const name = $('.ps-product__title, h2.ps-product__title').first().text().trim()
    if (!name) return null

    const description = $('.ps-product__desc, .ps-product__content').first().text().trim()
    const tableAttrs = parseAttributeTable($, '.ps-table--product-info tr, table.ps-table tr')

    // Parse origin country from name pattern "country • product-name"
    const nameOrigin = this.parseOriginFromName(name)

    const priceText = $('.ps-product__price .price, .ps-product__price').first().text()
    const price = this.parseLowestPrice(priceText)
    if (!price) return null

    const fullText = `${name} ${description || ''}`
    const attrs = parseProductAttributes(fullText)

    const weight = parseWeight(name) || parseWeight(description || '') || DEFAULT_WEIGHT_GRAMS

    const imageUrl = $('.ps-product__gallery img, .ps-product__thumbnail img')
      .first().attr('src')

    const variants = this.extractShoptetVariants($, price, weight)
    const roastTypes = this.extractRoastTypes($)

    return {
      name,
      imageUrl: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${this.shop.url}${imageUrl}`) : null,
      description: description ? description.slice(0, MAX_DESCRIPTION_LENGTH) : null,
      originCountry: nameOrigin.country || tableAttrs.country || attrs.origin.country,
      originRegion: tableAttrs.region || nameOrigin.region || attrs.origin.region,
      process: tableAttrs.process || attrs.process,
      roastLevel: tableAttrs.roastLevel || attrs.roastLevel,
      variety: tableAttrs.variety || null,
      tastingNotes: tableAttrs.tastingNotes || null,
      altitude: tableAttrs.altitude || null,
      isBlend: attrs.isBlend || /^blend\s*[•·]/i.test(name),
      isDecaf: attrs.isDecaf,
      brewingMethod: roastTypes.length > 0 ? roastTypes.join(', ') : null,
      variants,
      rating: null,
      badges: this.extractBadges($)
    }
  }

  parseOriginFromName(name) {
    const bulletMatch = name.match(/^(.+?)\s*[•·]\s*(.+)$/)
    if (!bulletMatch) return { country: null, region: null }

    const prefix = bulletMatch[1].trim().toLowerCase()

    if (prefix === 'blend' || prefix === 'kapsule' || prefix === 'drippin') {
      const rest = bulletMatch[2].trim().toLowerCase()
      for (const [key, value] of Object.entries(COUNTRY_NAME_MAP)) {
        if (rest.startsWith(key)) return { country: value, region: null }
      }
      return { country: null, region: null }
    }

    if (prefix === 'cascara') {
      const rest = bulletMatch[2].trim().toLowerCase()
      for (const [key, value] of Object.entries(COUNTRY_NAME_MAP)) {
        if (rest.startsWith(key)) return { country: value, region: null }
      }
    }

    const country = COUNTRY_NAME_MAP[prefix]
    return { country: country || null, region: null }
  }

  parseLowestPrice(text) {
    if (!text) return null
    const prices = []
    const matches = text.match(/(\d+[.,]\d{2})/g)
    if (matches) {
      for (const m of matches) {
        const p = parseFloat(m.replace(',', '.'))
        if (p > 0) prices.push(p)
      }
    }
    if (prices.length === 0) return parsePrice(text)
    return Math.min(...prices)
  }

  extractShoptetVariants($, basePrice, baseWeight) {
    const variants = []
    const sizeOptions = []

    $('.ps-variant--size .ps-variant__size').each((_, el) => {
      const text = $(el).text().trim()
      const weight = parseWeight(text)
      if (weight) sizeOptions.push({ weight, label: text })
    })

    if (sizeOptions.length === 0) {
      $('select option').each((_, el) => {
        const text = $(el).text().trim()
        const weight = parseWeight(text)
        if (weight) sizeOptions.push({ weight, label: text })
      })
    }

    const isInStock = !$('.out-of-stock, .sold-out, .ps-product__unavailable').length

    // Extract original (strikethrough) price for sale tracking
    const originalPrice = this.extractOriginalPrice($, basePrice)

    if (sizeOptions.length > 0) {
      for (const opt of sizeOptions) {
        variants.push({
          weightGrams: opt.weight,
          grind: null,
          label: opt.label,
          price: basePrice,
          originalPrice,
          subscriptionPrice: null,
          inStock: isInStock,
          sku: null
        })
      }
    }

    if (variants.length === 0 && basePrice) {
      variants.push({
        weightGrams: baseWeight,
        grind: null,
        label: null,
        price: basePrice,
        originalPrice,
        subscriptionPrice: null,
        inStock: isInStock,
        sku: null
      })
    }

    return variants
  }

  extractOriginalPrice($, currentPrice) {
    // Shoptet shows original price in strikethrough (<del>, <s>, or .ps-product__price--original)
    const delEl = $(
      '.ps-product__price del, .ps-product__price s, .ps-product__price--original, .ps-product__price .before-discount'
    ).first()
    const origPrice = parsePrice(delEl.text())
    if (origPrice && currentPrice && origPrice > currentPrice) {
      return origPrice
    }
    return null
  }

  extractRoastTypes($) {
    const types = []
    $('.ps-variant--image .tip span').each((_, el) => {
      const text = $(el).text().trim().toLowerCase()
      if (text.includes('filter')) types.push('filter')
      if (text.includes('espresso')) types.push('espresso')
      if (text.includes('omni')) types.push('omni')
    })
    return [...new Set(types)]
  }

  extractBadges($) {
    const badges = []
    $('.ps-badge, .badge, .onsale, .product-label').each((_, el) => {
      const text = $(el).text().trim()
      if (!text) return
      if (/sale|z[lľ]ava|akci/i.test(text)) {
        badges.push({ badgeType: 'price_friendly', label: text })
      } else if (/nov[áéý]|novin|new/i.test(text)) {
        badges.push({ badgeType: 'new', label: text })
      } else if (/limited|limitovan/i.test(text)) {
        badges.push({ badgeType: 'limited', label: text })
      }
    })
    return badges
  }

  isProductUrl(href) {
    if (!href) return false
    const path = href.replace(this.shop.url, '').replace(/^https?:\/\/[^/]+/, '')
    if (path.includes('/e-shop')) return false
    if (path.includes('/cart') || path.includes('/checkout')) return false
    if (path === '/' || path === '/sk' || path === '/sk/') return false
    if (path.endsWith('.jpg') || path.endsWith('.png') || path.endsWith('.svg')) return false
    if (path.includes('#')) return false

    const match = path.match(/^\/sk\/([^/]+)\/?$/)
    if (!match) return false

    const slug = match[1].toLowerCase()
    if (NON_PRODUCT_SLUGS.has(slug)) return false

    return this.matchesDomain(href)
  }
}
