import * as cheerio from 'cheerio'
import { WooCommerceScraper } from '../woocommerce-scraper.js'
import { extractProductJsonLd, parseProductFromJsonLd } from '../parsers/json-ld.parser.js'

const STRUCTURED_FIELDS = [
  { pattern: /^krajina/i, key: 'country' },
  { pattern: /^oblas[tť]/i, key: 'region' },
  { pattern: /^varieta/i, key: 'variety' },
  { pattern: /^spracovanie/i, key: 'process' },
  { pattern: /^nadmorsk/i, key: 'altitude' },
  { pattern: /^chu[tť]ov[ýé]\s*profil/i, key: 'tastingNotes' },
  { pattern: /^profil\s*pra[žz]enia/i, key: 'roastLevel' },
  { pattern: /^sp[ôo]sob\s*pr[ií]pravy/i, key: 'brewingMethod' },
  { pattern: /^zber/i, key: 'harvest' }
]

export class TripleFiveScraper extends WooCommerceScraper {
  async parseListingPage(html, _url) {
    const $ = cheerio.load(html)
    const urls = []

    $('a.woocommerce-LoopProduct-link, li.product a').each((_, el) => {
      const href = $(el).attr('href')
      if (href && this.isProductUrl(href)) {
        urls.push(href)
      }
    })

    $('.products .product a[href], a[href*="/product/"]').each((_, el) => {
      const href = $(el).attr('href')
      if (href && this.isProductUrl(href)) {
        urls.push(href)
      }
    })

    return [...new Set(urls)]
  }

  extractDetailAttributes($) {
    const attrs = super.extractDetailAttributes($)
    const html = $.html()

    // Parse structured data from JSON-LD description
    const jsonLd = extractProductJsonLd(html)
    const ldData = parseProductFromJsonLd(jsonLd)
    const structured = this.parseStructuredDescription(ldData?.description)

    if (structured.country && !attrs.country) attrs.country = structured.country
    if (structured.region && !attrs.region) attrs.region = structured.region
    if (structured.variety && !attrs.variety) attrs.variety = structured.variety
    if (structured.process && !attrs.process) attrs.process = structured.process
    if (structured.altitude && !attrs.altitude) attrs.altitude = structured.altitude
    if (structured.tastingNotes && !attrs.tastingNotes) attrs.tastingNotes = structured.tastingNotes
    if (structured.roastLevel && !attrs.roastLevel) attrs.roastLevel = structured.roastLevel
    if (structured.brewingMethod) attrs.brewingMethod = structured.brewingMethod

    // Fallback: parse from DOM description text
    if (!attrs.country || !attrs.process) {
      const descText = $(
        'div[itemprop="description"], .woocommerce-product-details__short-description, .entry-content'
      ).text()
      this.parseDescriptionFallback(descText, attrs)
    }

    return attrs
  }

  parseStructuredDescription(description) {
    const result = {}
    if (!description) return result

    const lines = description.split(/[\r\n]+/).filter((l) => l.trim())
    for (const line of lines) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue

      const label = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()
      if (!value) continue

      for (const field of STRUCTURED_FIELDS) {
        if (field.pattern.test(label)) {
          result[field.key] = value
          break
        }
      }
    }

    return result
  }

  parseDescriptionFallback(text, attrs) {
    if (!text) return

    if (!attrs.country) {
      const match = text.match(/(?:Krajina|Country|Origin)[:\s]*([A-Za-zÀ-ž\s]+?)(?:\n|<|,|$)/i)
      if (match) attrs.country = match[1].trim()
    }

    if (!attrs.process) {
      const match = text.match(/(?:Spracovanie|Process)[:\s]*([A-Za-zÀ-ž\s]+?)(?:\n|<|,|$)/i)
      if (match) attrs.process = match[1].trim()
    }

    if (!attrs.variety) {
      const match = text.match(/(?:Varieta|Variety)[:\s]*([A-Za-zÀ-ž\s,]+?)(?:\n|<|$)/i)
      if (match) attrs.variety = match[1].trim()
    }

    if (!attrs.altitude) {
      const match = text.match(/(?:Nadmorská výška|Altitude)[:\s]*([0-9.,\s\-–]+\s*(?:m\.?a\.?s\.?l\.?|m\s*n\.?\s*m\.?))/i)
      if (match) attrs.altitude = match[1].trim()
    }

    if (!attrs.tastingNotes) {
      const match = text.match(/(?:Chuťový profil|Tasting)[:\s]*([A-Za-zÀ-ž\s,]+?)(?:\n|<|$)/i)
      if (match) attrs.tastingNotes = match[1].trim()
    }
  }

  isProductUrl(href) {
    if (!href) return false
    if (href.includes('/cart') || href.includes('/checkout')) return false
    if (href.includes('/my-account')) return false
    if (href.includes('/product-category/') || href.includes('/kategoria/')) return false
    if (href.includes('add-to-cart')) return false
    if (href.endsWith('.jpg') || href.endsWith('.png')) return false
    const hrefPath = href.replace(this.shop.url, '').replace(/^https?:\/\/[^/]+/, '')
    if (!hrefPath.includes('/product/')) return false
    return this.matchesDomain(href)
  }
}
