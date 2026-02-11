import * as cheerio from 'cheerio'
import { BaseScraper } from '../base-scraper.js'
import { mapRoasteryToSlug } from '../roastery-map.js'

export class BlogOKaveScraper extends BaseScraper {
  async scrape() {
    this.log.info('Starting blog scrape')
    const reviews = []
    const discountCodes = []

    try {
      // Scrape review articles
      const reviewUrls = await this.getReviewUrls()
      this.log.info({ count: reviewUrls.length }, 'Found review article URLs')

      for (const url of reviewUrls) {
        try {
          const html = await this.fetch(url)
          const review = this.parseReviewArticle(html, url)
          if (review) {
            reviews.push(review)
          }
        } catch (error) {
          this.log.error({ url, error: error.message }, 'Failed to parse review')
        }
      }

      // Scrape discount codes page
      try {
        const discountPage = await this.findDiscountPage()
        if (discountPage) {
          const html = await this.fetch(discountPage)
          const codes = this.parseDiscountCodes(html, discountPage)
          discountCodes.push(...codes)
        }
      } catch (error) {
        this.log.warn({ error: error.message }, 'Failed to scrape discount codes')
      }
    } catch (error) {
      this.log.error({ error: error.message }, 'Blog scrape failed')
      throw error
    }

    this.log.info({ reviews: reviews.length, codes: discountCodes.length }, 'Blog scrape complete')
    return { reviews, discountCodes }
  }

  async getReviewUrls() {
    const baseUrl = this.shop.url
    const html = await this.fetch(baseUrl)
    const $ = cheerio.load(html)
    const urls = []

    // WordPress blog post links
    $('article a[href], .post a[href], .entry-title a[href], h2 a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (href && href.includes(baseUrl) && this.isReviewUrl(href)) {
        urls.push(href)
      }
    })

    // Also look for category pages with reviews
    const categoryUrls = []
    $('a[href*="recenz"], a[href*="review"], a[href*="test"]').each((_, el) => {
      const href = $(el).attr('href')
      if (href && href.includes(baseUrl)) {
        categoryUrls.push(href)
      }
    })

    for (const catUrl of [...new Set(categoryUrls)].slice(0, 3)) {
      try {
        const catHtml = await this.fetch(catUrl)
        const $cat = cheerio.load(catHtml)
        $cat('article a[href], .post a[href], h2 a[href]').each((_, el) => {
          const href = $cat(el).attr('href')
          if (href && href.includes(baseUrl) && this.isReviewUrl(href)) {
            urls.push(href)
          }
        })
      } catch {
        // skip category page errors
      }
    }

    return [...new Set(urls)].slice(0, 50)
  }

  parseReviewArticle(html, url) {
    const $ = cheerio.load(html)

    const title = $('h1, .entry-title').first().text().trim()
    if (!title) return null

    const content = $('article, .entry-content, .post-content').first().text()

    const cuppingScore = this.extractCuppingScore(content)
    const agtron = this.extractAgtron(content)
    const tastingNotes = this.extractTastingNotes(content)
    const verdict = this.extractVerdict($)
    const { roasteryName, coffeeName } = this.extractCoffeeIdentity(title, content)

    const publishedAt = $('time[datetime]').first().attr('datetime')
      || $('meta[property="article:published_time"]').attr('content')
      || null

    return {
      sourceUrl: url,
      title,
      roasteryName,
      coffeeName,
      cuppingScore,
      agtron,
      tastingNotes,
      verdict,
      publishedAt
    }
  }

  extractCuppingScore(text) {
    const patterns = [
      /cupping[:\s]*(\d+(?:\.\d+)?)\s*(?:\/\s*100|bodov|points)/i,
      /sk[oó]re[:\s]*(\d+(?:\.\d+)?)\s*(?:\/\s*100)?/i,
      /(\d+(?:\.\d+)?)\s*(?:\/\s*100)\s*(?:bodov|points|cupping)/i,
      /hodnotenie[:\s]*(\d+(?:\.\d+)?)/i
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        const score = parseFloat(match[1])
        if (score >= 60 && score <= 100) return score
      }
    }

    return null
  }

  extractAgtron(text) {
    const match = text.match(/agtron[:\s]*(\d+(?:\.\d+)?)/i)
    return match ? parseFloat(match[1]) : null
  }

  extractTastingNotes(text) {
    const patterns = [
      /(?:chu[tť]|tasting|profil)[:\s]*([^.]+)/i,
      /(?:aróma|aroma|v[ôo][ňn]a)[:\s]*([^.]+)/i
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        return match[1].trim().slice(0, 200)
      }
    }

    return null
  }

  extractVerdict($) {
    const verdictEl = $('[class*="verdict"], [class*="summary"], [class*="conclusion"], .verdict')
    if (verdictEl.length > 0) {
      return verdictEl.first().text().trim().slice(0, 500)
    }

    // Look for the last paragraph as it often contains a summary
    const lastP = $('article p, .entry-content p').last().text().trim()
    if (lastP && lastP.length > 30) {
      return lastP.slice(0, 500)
    }

    return null
  }

  extractCoffeeIdentity(title, content) {
    // Try to extract roastery and coffee name from the title
    const roasteryPatterns = [
      /(?:od|from|by)\s+([A-Za-zÀ-ž\s]+?)(?:\s*[-–—:|])/i,
      /(Triple Five|Black|Goriffee|Zlat[ée] Zrnko|Rebelbean|Coffee[A-Za-z]*|[A-Za-z]+ Coffee)/i
    ]

    let roasteryName = null
    for (const pattern of roasteryPatterns) {
      const match = title.match(pattern) || content.slice(0, 500).match(pattern)
      if (match) {
        roasteryName = match[1].trim()
        break
      }
    }

    // Coffee name is typically the main subject of the title
    const coffeeName = title
      .replace(/recenz[ia]e?|review|test|hodnotenie/gi, '')
      .replace(roasteryName || '', '')
      .replace(/[-–—:|]/g, ' ')
      .trim() || null

    return { roasteryName, coffeeName }
  }

  async findDiscountPage() {
    // Common URLs for discount code pages on Slovak coffee blogs
    const candidates = [
      `${this.shop.url}/zlavove-kody/`,
      `${this.shop.url}/zlavy/`,
      `${this.shop.url}/kupony/`,
      `${this.shop.url}/discount-codes/`
    ]

    for (const url of candidates) {
      try {
        await this.fetch(url)
        return url
      } catch {
        // not found, try next
      }
    }

    return null
  }

  parseDiscountCodes(html, sourceUrl) {
    const $ = cheerio.load(html)
    const codes = []

    // Look for discount code patterns
    $('[class*="code"], [class*="coupon"], [class*="discount"], code, .wp-block-table td').each((_, el) => {
      const text = $(el).text().trim()
      // Discount codes are typically short uppercase strings
      const codeMatch = text.match(/([A-Z0-9]{3,20})/g)
      if (codeMatch) {
        for (const code of codeMatch) {
          if (code.length >= 3 && code.length <= 20) {
            // Try to find associated discount percentage
            const parent = $(el).parent().text()
            const percentMatch = parent.match(/(\d+)\s*%/)
            const shopMatch = parent.match(/(Triple Five|Black|Goriffee|Zlat[ée] Zrnko)/i)

            codes.push({
              code,
              shopSlug: shopMatch ? mapRoasteryToSlug(shopMatch[1]) : null,
              discountPercent: percentMatch ? parseInt(percentMatch[1], 10) : null,
              discountFixed: null,
              description: parent.slice(0, 200),
              sourceUrl,
              validFrom: null,
              validUntil: null
            })
          }
        }
      }
    })

    return codes
  }

  isReviewUrl(href) {
    if (!href) return false
    // Skip category, tag, and page URLs
    if (/\/(category|tag|page|author|wp-content|wp-admin)\//.test(href)) return false
    if (href.endsWith('/') && href.split('/').filter(Boolean).length <= 3) return false
    return true
  }

  // Override - blog doesn't return products
  async parseListingPage() {
    return []
  }

  async parseProductDetail() {
    return null
  }
}
