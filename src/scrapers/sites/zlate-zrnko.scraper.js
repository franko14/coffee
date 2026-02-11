import * as cheerio from 'cheerio'
import { WooCommerceScraper } from '../woocommerce-scraper.js'
import { parseWeight } from '../parsers/price.parser.js'

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
    const attrs = super.extractDetailAttributes($)

    // Woodmart theme may use special attribute display
    $('.woodmart-tab-wrapper .woocommerce-product-attributes tr, .shop_attributes tr').each((_, el) => {
      const label = $(el).find('th').text().toLowerCase().trim()
      const value = $(el).find('td p, td').text().trim()

      if (!value) return

      if (/origin|p[ôo]vod|country|krajina/.test(label)) {
        const parts = value.split(/[,/]/)
        attrs.country = parts[0]?.trim()
        attrs.region = parts[1]?.trim()
      }
      if (/process|spracovanie/.test(label)) attrs.process = value
      if (/roast|pra[žz]enie/.test(label)) attrs.roastLevel = value
      if (/varieta|variety|odroda/.test(label)) attrs.variety = value
      if (/tasting|chu[tť]|profil/.test(label)) attrs.tastingNotes = value
      if (/altitude|nadmorsk/.test(label)) attrs.altitude = value
    })

    return attrs
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

    return attrWeight || 250
  }

  isProductUrl(href) {
    if (!href) return false
    if (href.includes('/cart') || href.includes('/checkout')) return false
    if (href.includes('/my-account') || href.includes('/moj-ucet')) return false
    if (href.includes('/kategoria/') || href.includes('/product-category/')) return false
    if (href.includes('add-to-cart')) return false
    if (href.endsWith('.jpg') || href.endsWith('.png')) return false
    // Must contain /obchod/ to be a product
    if (!href.includes('/obchod/')) return false
    return this.matchesDomain(href)
  }
}
