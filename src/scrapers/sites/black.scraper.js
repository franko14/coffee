import * as cheerio from 'cheerio'
import { BaseScraper } from '../base-scraper.js'
import { parsePrice, parseWeight } from '../parsers/price.parser.js'
import { parseProductAttributes } from '../parsers/product-attributes.parser.js'

export class BlackScraper extends BaseScraper {
  async getListingPages() {
    const baseUrl = `${this.shop.url}${this.shop.listingPath}`
    const html = await this.fetch(baseUrl)
    const $ = cheerio.load(html)
    const pages = [baseUrl]

    // Check for pagination
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

    // Black.sk uses semantic HTML with product cards
    $('a[href*="/kava/"], .product-card a, .product-item a, article a').each((_, el) => {
      const href = $(el).attr('href')
      if (href && this.isProductUrl(href)) {
        const fullUrl = href.startsWith('http') ? href : `${this.shop.url}${href}`
        urls.push(fullUrl)
      }
    })

    // Also try links within the e-shop section
    $('a[href*="/e-shop/"]').each((_, el) => {
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

    const name = $('h1, .product-title, .product-name').first().text().trim()
    if (!name) return null

    const description = $('.product-description, .product-detail, .description, article p').first().text().trim()
    const fullText = `${name} ${description || ''}`
    const attrs = parseProductAttributes(fullText)

    // Extract structured attributes from the page
    const detailAttrs = this.extractAttributes($)

    // Parse price from the page
    const priceText = $('.price, .product-price, [class*="price"]').first().text()
    const price = parsePrice(priceText)

    // Parse weight from title or description
    const weight = parseWeight(name) || parseWeight(description || '') || 250

    const imageUrl = $('img.product-image, .product-gallery img, .product img').first().attr('src')

    const variants = [{
      weightGrams: weight,
      grind: null,
      label: null,
      price,
      subscriptionPrice: null,
      inStock: !$('.out-of-stock, .sold-out').length,
      sku: null
    }]

    return {
      name,
      imageUrl: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${this.shop.url}${imageUrl}`) : null,
      description: description ? description.slice(0, 500) : null,
      originCountry: detailAttrs.country || attrs.origin.country,
      originRegion: detailAttrs.region || attrs.origin.region,
      process: detailAttrs.process || attrs.process,
      roastLevel: detailAttrs.roastLevel || attrs.roastLevel,
      variety: detailAttrs.variety || null,
      tastingNotes: detailAttrs.tastingNotes || attrs.tastingNotes,
      altitude: null,
      isBlend: attrs.isBlend,
      isDecaf: attrs.isDecaf,
      variants,
      rating: null,
      badges: []
    }
  }

  extractAttributes($) {
    const attrs = {}

    // Black.sk may use various table/list formats for attributes
    $('table tr, .product-attributes li, .product-info li, dl dt').each((_, el) => {
      const label = $(el).find('td:first-child, .attr-label, dt').text().toLowerCase().trim()
        || $(el).text().toLowerCase().trim()
      const value = $(el).find('td:last-child, .attr-value, dd').text().trim()
        || $(el).next('dd').text().trim()

      if (!value) return

      if (/origin|p[ôo]vod|country|krajina/.test(label)) {
        const parts = value.split(/[,/]/)
        attrs.country = parts[0]?.trim()
        attrs.region = parts[1]?.trim()
      }
      if (/process|spracovanie/.test(label)) attrs.process = value
      if (/roast|pra[žz]enie/.test(label)) attrs.roastLevel = value
      if (/varieta|variety|odroda/.test(label)) attrs.variety = value
      if (/tasting|notes|chu[tť]/.test(label)) attrs.tastingNotes = value
    })

    return attrs
  }

  isProductUrl(href) {
    if (!href) return false
    const path = href.replace(this.shop.url, '')
    if (path === '/sk/e-shop/kava' || path === '/sk/e-shop/kava/') return false
    if (path.includes('/cart') || path.includes('/checkout')) return false
    if (!path.includes('/e-shop/') && !path.includes('/kava/')) return false
    return true
  }
}
