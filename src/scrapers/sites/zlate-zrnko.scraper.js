import * as cheerio from 'cheerio'
import { WooCommerceScraper } from '../woocommerce-scraper.js'
import { parseWeight } from '../parsers/price.parser.js'
import { parseAttributeTable } from '../parsers/attribute-table.parser.js'
import { DEFAULT_WEIGHT_GRAMS } from '../constants.js'

export class ZlateZrnkoScraper extends WooCommerceScraper {
  async parseListingPage(html, _url) {
    const $ = cheerio.load(html)
    const urls = []

    // Zlaté Zrnko uses Woodmart theme with product-element-top
    $('a.product-image-link, .product-element-top a').each((_, el) => {
      const href = $(el).attr('href')
      if (href && this.isProductUrl(href)) {
        urls.push(href)
      }
    })

    // Also try WooCommerce standard loop link
    $('a.woocommerce-LoopProduct-link').each((_, el) => {
      const href = $(el).attr('href')
      if (href && this.isProductUrl(href)) {
        urls.push(href)
      }
    })

    return [...new Set(urls)]
  }

  extractDetailAttributes($) {
    const baseAttrs = super.extractDetailAttributes($)

    // Woodmart theme may use special attribute display
    const woodmartAttrs = parseAttributeTable(
      $,
      '.woodmart-tab-wrapper .woocommerce-product-attributes tr, .shop_attributes tr'
    )

    return { ...woodmartAttrs, ...baseAttrs }
  }

  extractWeightFromPage($) {
    const title = $('h1').first().text()
    const weight = parseWeight(title)
    if (weight) return weight

    const desc = $('.woocommerce-product-details__short-description').text()
    const descWeight = parseWeight(desc)
    if (descWeight) return descWeight

    let attrWeight = null
    $('.shop_attributes tr').each((_, el) => {
      const label = $(el).find('th').text().toLowerCase().trim()
      if (/hmotnost|weight|grams|gramy/.test(label)) {
        attrWeight = parseWeight($(el).find('td').text())
      }
    })

    return attrWeight || DEFAULT_WEIGHT_GRAMS
  }

  isExcludedUrl(href) {
    if (super.isExcludedUrl(href)) return true
    if (href.includes('/moj-ucet')) return true
    return false
  }

  isProductPath(href) {
    return href.includes('/obchod/')
  }
}
