import { fetchWithRetry } from '../utils/http-client.js'
import { createChildLogger } from '../utils/logger.js'
import { slugify } from '../utils/slug.js'
import { calculatePricePer100g } from '../utils/price-utils.js'

export class BaseScraper {
  constructor(shop, config) {
    this.shop = shop
    this.config = config
    this.log = createChildLogger(`scraper:${shop.slug}`)
    this.scrapingConfig = config.scraping
    this.shopDomain = shop.url.replace(/^https?:\/\//, '').replace(/^www\./, '')
  }

  async scrape() {
    this.log.info({ shop: this.shop.name }, 'Starting scrape')
    const products = []

    try {
      const { pages: listingUrls, firstPageHtml } = await this.getListingPages()

      for (const url of listingUrls) {
        const html = url === listingUrls[0] && firstPageHtml
          ? firstPageHtml
          : await this.fetch(url)
        const productUrls = await this.parseListingPage(html, url)
        this.log.info({ url, count: productUrls.length }, 'Found product links')

        for (const productUrl of productUrls) {
          try {
            const productHtml = await this.fetch(productUrl)
            const product = await this.parseProductDetail(productHtml, productUrl)

            if (product) {
              products.push(this.normalizeProduct(product, productUrl))
            }
          } catch (error) {
            this.log.error({ url: productUrl, error: error.message }, 'Failed to parse product')
          }
        }
      }
    } catch (error) {
      this.log.error({ error: error.message }, 'Scrape failed')
      throw error
    }

    this.log.info({ shop: this.shop.name, count: products.length }, 'Scrape complete')
    return products
  }

  async fetch(url) {
    return fetchWithRetry(url, {
      rateLimitMs: this.scrapingConfig.rateLimitMs,
      retryAttempts: this.scrapingConfig.retryAttempts,
      retryBackoffMs: this.scrapingConfig.retryBackoffMs,
      timeoutMs: this.scrapingConfig.timeoutMs,
      userAgent: this.scrapingConfig.userAgent
    })
  }

  async getListingPages() {
    const url = `${this.shop.url}${this.shop.listingPath}`
    return { pages: [url], firstPageHtml: null }
  }

  async parseListingPage(_html, _url) {
    throw new Error('parseListingPage must be implemented by subclass')
  }

  async parseProductDetail(_html, _url) {
    throw new Error('parseProductDetail must be implemented by subclass')
  }

  matchesDomain(href) {
    const hrefDomain = href.replace(/^https?:\/\//, '').replace(/^www\./, '')
    return hrefDomain.startsWith(this.shopDomain)
  }

  normalizeProduct(rawProduct, url) {
    const variants = (rawProduct.variants || []).map((v) => ({
      weightGrams: v.weightGrams || null,
      grind: v.grind || null,
      label: v.label || null,
      currentPrice: v.price || null,
      originalPrice: v.originalPrice || null,
      currentSubscriptionPrice: v.subscriptionPrice || null,
      pricePer100g: calculatePricePer100g(v.price, v.weightGrams),
      inStock: v.inStock !== false ? 1 : 0,
      sku: v.sku || null
    }))

    return {
      shopId: null,
      externalId: rawProduct.externalId || null,
      slug: slugify(rawProduct.name),
      name: rawProduct.name,
      url,
      imageUrl: rawProduct.imageUrl || null,
      description: rawProduct.description || null,
      originCountry: rawProduct.originCountry || null,
      originRegion: rawProduct.originRegion || null,
      process: rawProduct.process || null,
      roastLevel: rawProduct.roastLevel || null,
      variety: rawProduct.variety || null,
      tastingNotes: rawProduct.tastingNotes || null,
      altitude: rawProduct.altitude || null,
      brewingMethod: rawProduct.brewingMethod || null,
      arabicaPercentage: rawProduct.arabicaPercentage ?? null,
      isBlend: rawProduct.isBlend ? 1 : 0,
      isDecaf: rawProduct.isDecaf ? 1 : 0,
      variants,
      rating: rawProduct.rating || null,
      badges: rawProduct.badges || []
    }
  }
}
