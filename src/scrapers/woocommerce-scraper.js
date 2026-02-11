import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper.js'
import { extractProductJsonLd, parseProductFromJsonLd } from './parsers/json-ld.parser.js'
import { parsePrice, parseWeight } from './parsers/price.parser.js'
import { parseProductAttributes } from './parsers/product-attributes.parser.js'

export class WooCommerceScraper extends BaseScraper {
  async getListingPages() {
    const baseUrl = `${this.shop.url}${this.shop.listingPath}`
    const html = await this.fetch(baseUrl)
    const $ = cheerio.load(html)
    const pages = [baseUrl]

    const pagination = $('a.page-numbers, nav.woocommerce-pagination a')
    const pageNumbers = []

    pagination.each((_, el) => {
      const href = $(el).attr('href')
      const pageMatch = href?.match(/page\/(\d+)/)
      if (pageMatch) {
        pageNumbers.push(parseInt(pageMatch[1], 10))
      }
    })

    if (pageNumbers.length > 0) {
      const maxPage = Math.max(...pageNumbers)
      for (let i = 2; i <= maxPage; i++) {
        pages.push(`${baseUrl}page/${i}/`)
      }
    }

    return pages
  }

  async parseListingPage(html, _url) {
    const $ = cheerio.load(html)
    const urls = []

    $('a.woocommerce-LoopProduct-link, .product a[href], .products .product a').each((_, el) => {
      const href = $(el).attr('href')
      if (href && !urls.includes(href) && this.isProductUrl(href)) {
        urls.push(href)
      }
    })

    return [...new Set(urls)]
  }

  async parseProductDetail(html, url) {
    const jsonLd = extractProductJsonLd(html)
    const ldData = parseProductFromJsonLd(jsonLd)
    const $ = cheerio.load(html)

    const name = ldData?.name || this.extractName($)
    if (!name) return null

    const description = this.extractDescription($)
    const fullText = `${name} ${description || ''}`
    const attrs = parseProductAttributes(fullText)
    const detailAttrs = this.extractDetailAttributes($)

    const variants = this.extractVariants($, ldData)

    return {
      name,
      externalId: this.extractExternalId($),
      imageUrl: ldData?.image || this.extractImage($),
      description: this.truncateDescription(description),
      originCountry: detailAttrs.country || attrs.origin.country,
      originRegion: detailAttrs.region || attrs.origin.region,
      process: detailAttrs.process || attrs.process,
      roastLevel: detailAttrs.roastLevel || attrs.roastLevel,
      variety: detailAttrs.variety || null,
      tastingNotes: detailAttrs.tastingNotes || attrs.tastingNotes,
      altitude: detailAttrs.altitude || null,
      isBlend: attrs.isBlend,
      isDecaf: attrs.isDecaf,
      variants,
      rating: ldData?.rating || null,
      badges: this.extractBadges($)
    }
  }

  extractName($) {
    return $('.product_title, h1.entry-title').first().text().trim() || null
  }

  extractDescription($) {
    return $('.woocommerce-product-details__short-description, .product-short-description')
      .first().text().trim() || null
  }

  extractImage($) {
    return $('.woocommerce-product-gallery__image img, .product-image img')
      .first().attr('src') || null
  }

  extractExternalId($) {
    const postClass = $('body').attr('class') || ''
    const match = postClass.match(/postid-(\d+)/)
    return match ? match[1] : null
  }

  extractDetailAttributes($) {
    const attrs = {}
    const attrRows = $('.woocommerce-product-attributes tr, .product_meta span, .product-attributes li')

    attrRows.each((_, el) => {
      const label = $(el).find('th, .label').text().toLowerCase().trim()
      const value = $(el).find('td, .value').text().trim()

      if (!label || !value) return

      if (/origin|p[ôo]vod|country|krajina/.test(label)) {
        const parts = value.split(/[,/]/)
        attrs.country = parts[0]?.trim()
        attrs.region = parts[1]?.trim() || null
      }
      if (/process|spracovanie|processing/.test(label)) {
        attrs.process = value
      }
      if (/roast|pra[žz]enie/.test(label)) {
        attrs.roastLevel = value
      }
      if (/varieta|variety|odroda/.test(label)) {
        attrs.variety = value
      }
      if (/tasting|notes|chu[tť]|profil/.test(label)) {
        attrs.tastingNotes = value
      }
      if (/altitude|nadmorsk|elevation/.test(label)) {
        attrs.altitude = value
      }
    })

    return attrs
  }

  extractVariants($, ldData) {
    const variants = []

    const variationForms = $('form.variations_form')
    if (variationForms.length > 0) {
      const variationsData = variationForms.attr('data-product_variations')
      if (variationsData) {
        try {
          const variations = JSON.parse(variationsData)
          for (const v of variations) {
            const label = Object.values(v.attributes || {}).join(' ')
            const weight = parseWeight(label) || parseWeight(v.weight_html || '')
            variants.push({
              weightGrams: weight,
              grind: this.extractGrindFromLabel(label),
              label,
              price: parseFloat(v.display_price) || null,
              subscriptionPrice: null,
              inStock: v.is_in_stock !== false,
              sku: v.sku || null
            })
          }
        } catch {
          this.log.warn('Failed to parse WooCommerce variations JSON')
        }
      }
    }

    if (variants.length === 0 && ldData?.offers?.length > 0) {
      for (const offer of ldData.offers) {
        variants.push({
          weightGrams: this.extractWeightFromPage($),
          grind: null,
          label: null,
          price: offer.price,
          subscriptionPrice: null,
          inStock: !offer.availability?.includes('OutOfStock'),
          sku: offer.sku || null
        })
      }
    }

    if (variants.length === 0) {
      const price = this.extractPriceFromDom($)
      if (price) {
        variants.push({
          weightGrams: this.extractWeightFromPage($),
          grind: null,
          label: null,
          price,
          subscriptionPrice: null,
          inStock: true,
          sku: null
        })
      }
    }

    return variants
  }

  extractPriceFromDom($) {
    const priceEl = $('p.price ins .amount, p.price .amount, .summary .price .amount').first()
    return parsePrice(priceEl.text())
  }

  extractWeightFromPage($) {
    const title = $('h1').first().text()
    const weight = parseWeight(title)
    if (weight) return weight

    const infoText = $('.product-short-description, .woocommerce-product-details__short-description').text()
    return parseWeight(infoText) || 250
  }

  extractGrindFromLabel(label) {
    if (!label) return null
    const lower = label.toLowerCase()
    if (/zrnkov|whole|beans?/i.test(lower)) return 'whole-bean'
    if (/mlet|ground|filter/i.test(lower)) return 'ground'
    if (/espresso/i.test(lower)) return 'espresso'
    return null
  }

  extractBadges($) {
    const badges = []
    const badgeEls = $('.badge, .onsale, .product-label, .product-badge')

    badgeEls.each((_, el) => {
      const text = $(el).text().trim().toLowerCase()
      if (/sale|z[lľ]ava|akci/i.test(text)) {
        badges.push({ badgeType: 'price_friendly', label: text })
      }
      if (/new|nov[áéý]/i.test(text)) {
        badges.push({ badgeType: 'new', label: text })
      }
      if (/limited|limitovan/i.test(text)) {
        badges.push({ badgeType: 'limited', label: text })
      }
    })

    return badges
  }

  isProductUrl(href) {
    if (!href) return false
    if (href.includes('/cart') || href.includes('/checkout')) return false
    if (href.includes('/my-account') || href.includes('/category')) return false
    if (href.includes('/kategoria/') || href.includes('/product-category/')) return false
    if (href.includes('/kategorie-produktov/')) return false
    if (href.endsWith('.jpg') || href.endsWith('.png')) return false
    if (href.includes('add-to-cart')) return false
    return this.matchesDomain(href)
  }

  truncateDescription(text) {
    if (!text) return null
    return text.length > 500 ? text.slice(0, 497) + '...' : text
  }
}
