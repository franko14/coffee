import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper.js'
import { extractProductJsonLd, parseProductFromJsonLd } from './parsers/json-ld.parser.js'
import { parsePrice, parseWeight } from './parsers/price.parser.js'
import { parseProductAttributes } from './parsers/product-attributes.parser.js'
import { parseAttributeTable } from './parsers/attribute-table.parser.js'
import { DEFAULT_WEIGHT_GRAMS, MAX_DESCRIPTION_LENGTH } from './constants.js'

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
    const $ = cheerio.load(html)
    const jsonLd = extractProductJsonLd($)
    const ldData = parseProductFromJsonLd(jsonLd)

    const name = ldData?.name || this.extractName($)
    if (!name) return null

    const description = this.extractDescription($)
    const fullText = `${name} ${description || ''}`
    const attrs = parseProductAttributes(fullText)
    const detailAttrs = this.extractDetailAttributes($, ldData)

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
      brewingMethod: detailAttrs.brewingMethod || attrs.brewingMethod || null,
      arabicaPercentage: attrs.arabicaPercentage,
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
    return parseAttributeTable($, '.woocommerce-product-attributes tr, .product_meta span, .product-attributes li')
  }

  extractVariants($, ldData) {
    const variants = []

    // Check if entire product is out of stock at page level
    const pageOutOfStock = this.isPageOutOfStock($)

    // Check for DOM-based sale prices (some plugins apply discounts at render time)
    const domSalePrice = this.extractSalePriceFromDom($)
    const domOriginalPrice = this.extractOriginalPriceFromDom($)

    const variationForms = $('form.variations_form')
    if (variationForms.length > 0) {
      const variationsData = variationForms.attr('data-product_variations')
      if (variationsData) {
        try {
          const variations = JSON.parse(variationsData)
          for (const v of variations) {
            const label = Object.values(v.attributes || {}).join(' ')
            const weight = parseWeight(label) || parseWeight(v.weight_html || '')
            const jsonPrice = parseFloat(v.display_price) || null
            const regularPrice = parseFloat(v.display_regular_price) || null
            const isOnSaleInJson = regularPrice && jsonPrice && regularPrice > jsonPrice

            // Use DOM sale price if JSON shows no sale but DOM does
            // (common with discount plugins that apply at render time)
            let price = jsonPrice
            let originalPrice = isOnSaleInJson ? regularPrice : null
            if (!isOnSaleInJson && domSalePrice && domOriginalPrice && domOriginalPrice > domSalePrice) {
              // Only apply if the DOM original matches the JSON price (sanity check)
              if (Math.abs(domOriginalPrice - jsonPrice) < 0.5) {
                price = domSalePrice
                originalPrice = domOriginalPrice
              }
            }

            variants.push({
              weightGrams: weight,
              grind: this.extractGrindFromLabel(label),
              label,
              price,
              originalPrice,
              subscriptionPrice: null,
              inStock: pageOutOfStock ? false : v.is_in_stock !== false,
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
          originalPrice: null,
          subscriptionPrice: null,
          inStock: pageOutOfStock ? false : !offer.availability?.includes('OutOfStock'),
          sku: offer.sku || null
        })
      }
    }

    if (variants.length === 0) {
      const price = this.extractPriceFromDom($)
      const originalPrice = this.extractOriginalPriceFromDom($)
      if (price) {
        variants.push({
          weightGrams: this.extractWeightFromPage($),
          grind: null,
          label: null,
          price,
          originalPrice: originalPrice && originalPrice > price ? originalPrice : null,
          subscriptionPrice: null,
          inStock: !pageOutOfStock,
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

  extractSalePriceFromDom($) {
    // WooCommerce shows sale price in <ins> tag when product is on sale
    const insEl = $('p.price ins .amount, .summary .price ins .amount').first()
    return parsePrice(insEl.text())
  }

  extractOriginalPriceFromDom($) {
    // WooCommerce shows original price in <del> when product is on sale
    const delEl = $('p.price del .amount, .summary .price del .amount').first()
    return parsePrice(delEl.text())
  }

  extractWeightFromPage($) {
    const title = $('h1').first().text()
    const weight = parseWeight(title)
    if (weight) return weight

    const infoText = $('.product-short-description, .woocommerce-product-details__short-description').text()
    return parseWeight(infoText) || DEFAULT_WEIGHT_GRAMS
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
    if (this.isExcludedUrl(href)) return false
    if (!this.matchesDomain(href)) return false
    return this.isProductPath(href)
  }

  isExcludedUrl(href) {
    if (href.includes('/cart') || href.includes('/checkout')) return true
    if (href.includes('/my-account')) return true
    if (href.includes('/kategoria/') || href.includes('/product-category/')) return true
    if (href.includes('/kategorie-produktov/')) return true
    if (href.endsWith('.jpg') || href.endsWith('.png')) return true
    if (href.includes('add-to-cart')) return true
    return false
  }

  isProductPath(_href) {
    return true
  }

  isPageOutOfStock($) {
    // Check body class for WooCommerce out-of-stock indicator
    const bodyClass = $('body').attr('class') || ''
    if (bodyClass.includes('outofstock')) {
      return true
    }

    // Check product container class (WooCommerce adds outofstock class here)
    const productClass = $('.product, .entry-product, [class*="type-product"]').attr('class') || ''
    if (productClass.includes('outofstock')) {
      return true
    }

    // Check for "Vypredané" badge or text (Slovak for "Sold out")
    const outOfStockIndicators = [
      'vypredané',
      'vypredane',
      'out of stock',
      'sold out',
      'niet na sklade'
    ]

    // Check stock status element specifically
    const stockStatus = $('.stock, .availability, .product-stock-status, .out-of-stock').text().toLowerCase()
    for (const indicator of outOfStockIndicators) {
      if (stockStatus.includes(indicator)) {
        return true
      }
    }

    // Check product badges for out-of-stock badge
    const badgeText = $('.product-badges, .entry-product-badges').text().toLowerCase()
    for (const indicator of outOfStockIndicators) {
      if (badgeText.includes(indicator)) {
        return true
      }
    }

    // Check if add to cart button is disabled or shows out of stock
    const addToCartText = $('.single_add_to_cart_button, .add-to-cart-button').text().toLowerCase()
    if (addToCartText.includes('vypredané') || addToCartText.includes('out of stock')) {
      return true
    }

    return false
  }

  truncateDescription(text) {
    if (!text) return null
    return text.length > MAX_DESCRIPTION_LENGTH ? text.slice(0, MAX_DESCRIPTION_LENGTH - 3) + '...' : text
  }
}
