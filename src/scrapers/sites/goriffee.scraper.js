import * as cheerio from 'cheerio'
import { WooCommerceScraper } from '../woocommerce-scraper.js'
import { parsePrice } from '../parsers/price.parser.js'

export class GoriffeeScraper extends WooCommerceScraper {
  async parseListingPage(html, _url) {
    const $ = cheerio.load(html)
    const urls = []

    // Goriffee uses WooCommerce product listing with Minimog theme
    $('a.woocommerce-LoopProduct-link').each((_, el) => {
      const href = $(el).attr('href')
      if (href && this.isProductUrl(href)) {
        urls.push(href)
      }
    })

    // Also check product-info links
    $('.grid-item.product .product-info a[href*="/shop/kava/"]').each((_, el) => {
      const href = $(el).attr('href')
      if (href && this.isProductUrl(href)) {
        urls.push(href)
      }
    })

    return [...new Set(urls)]
  }

  extractVariants($, ldData) {
    const variants = super.extractVariants($, ldData)

    const subscriptionPrice = this.extractSubscriptionPrice($)

    if (subscriptionPrice) {
      return variants.map((v) => ({
        ...v,
        subscriptionPrice
      }))
    }

    return variants
  }

  extractSubscriptionPrice($) {
    const subEl = $('[class*="subscription"], .subscribe-price, .predplatne')
    if (subEl.length > 0) {
      return parsePrice(subEl.text())
    }
    return null
  }

  isProductPath(href) {
    return href.includes('/shop/kava/') || href.includes('/shop/vyhodne-baliky/')
  }
}
