import * as cheerio from 'cheerio'
import { BaseScraper } from '../base-scraper.js'
import { parsePrice, parseWeight } from '../parsers/price.parser.js'
import { parseProductAttributes } from '../parsers/product-attributes.parser.js'

const COUNTRY_NAME_MAP = {
  colombia: 'Colombia',
  brazil: 'Brazil',
  ethiopia: 'Ethiopia',
  'east java': 'Indonesia',
  rwanda: 'Rwanda',
  'costa rica': 'Costa Rica',
  kenya: 'Kenya',
  guatemala: 'Guatemala',
  'el salvador': 'El Salvador',
  peru: 'Peru',
  honduras: 'Honduras',
  india: 'India',
  indonesia: 'Indonesia',
  mexico: 'Mexico',
  burundi: 'Burundi',
  tanzania: 'Tanzania',
  panama: 'Panama',
  nicaragua: 'Nicaragua',
  bolivia: 'Bolivia',
  vietnam: 'Vietnam',
  uganda: 'Uganda',
  congo: 'Congo'
}

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
    const tableAttrs = this.extractTableAttributes($)

    // Parse origin country from name pattern "country • product-name"
    const nameOrigin = this.parseOriginFromName(name)

    const priceText = $('.ps-product__price .price, .ps-product__price').first().text()
    const price = this.parseLowestPrice(priceText)
    if (!price) return null

    const fullText = `${name} ${description || ''}`
    const attrs = parseProductAttributes(fullText)

    const weight = parseWeight(name) || parseWeight(description || '') || 250

    const imageUrl = $('.ps-product__gallery img, .ps-product__thumbnail img')
      .first().attr('src')

    const variants = this.extractShoptetVariants($, price, weight)
    const roastTypes = this.extractRoastTypes($)

    return {
      name,
      imageUrl: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${this.shop.url}${imageUrl}`) : null,
      description: description ? description.slice(0, 500) : null,
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

    if (sizeOptions.length > 0) {
      for (const opt of sizeOptions) {
        variants.push({
          weightGrams: opt.weight,
          grind: null,
          label: opt.label,
          price: basePrice,
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
        subscriptionPrice: null,
        inStock: isInStock,
        sku: null
      })
    }

    return variants
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

  extractTableAttributes($) {
    const attrs = {}

    $('.ps-table--product-info tr, table.ps-table tr').each((_, el) => {
      const label = $(el).find('td:first-child').text().toLowerCase().trim()
      const value = $(el).find('td:last-child').text().trim()
      if (!label || !value || label === value) return

      if (/varieta|variety|odroda/.test(label)) attrs.variety = value
      if (/spracovanie|process/.test(label)) attrs.process = value
      if (/pra[žz]enie|roast/.test(label)) attrs.roastLevel = value
      if (/region|regi[óo]n|oblast|oblasť/.test(label)) attrs.region = value
      if (/nadmorsk|altitude|elevation/.test(label)) attrs.altitude = value
      if (/origin|p[ôo]vod|country|krajina/.test(label)) {
        const parts = value.split(/[,/]/)
        attrs.country = parts[0]?.trim()
        if (parts[1]) attrs.region = attrs.region || parts[1].trim()
      }
      if (/chu[tť]|tasting|notes|profil/.test(label)) attrs.tastingNotes = value
    })

    return attrs
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
