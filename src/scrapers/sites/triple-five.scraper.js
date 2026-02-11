import * as cheerio from 'cheerio'
import { WooCommerceScraper } from '../woocommerce-scraper.js'

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

    // Product links under product grids
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

    const descText = $(
      '.product-description, .woocommerce-product-details__short-description, .entry-content'
    ).text()

    if (!attrs.country) {
      const countryMatch = descText.match(
        /(?:Country|Origin|Krajina)[:\s]*([A-Za-zÀ-ž\s]+?)(?:\n|,|$)/i
      )
      if (countryMatch) {
        attrs.country = countryMatch[1].trim()
      }
    }

    if (!attrs.process) {
      const processMatch = descText.match(
        /(?:Process|Spracovanie)[:\s]*([A-Za-zÀ-ž\s]+?)(?:\n|,|$)/i
      )
      if (processMatch) {
        attrs.process = processMatch[1].trim()
      }
    }

    return attrs
  }

  isProductUrl(href) {
    if (!href) return false
    if (href.includes('/cart') || href.includes('/checkout')) return false
    if (href.includes('/my-account')) return false
    if (href.includes('/product-category/') || href.includes('/kategoria/')) return false
    if (href.includes('add-to-cart')) return false
    if (href.endsWith('.jpg') || href.endsWith('.png')) return false
    // Skip the listing page itself
    const listingPath = this.shop.listingPath.replace(/\/$/, '')
    const hrefPath = href.replace(this.shop.url, '').replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '')
    if (hrefPath === listingPath) return false
    return this.matchesDomain(href)
  }
}
