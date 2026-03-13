import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper.js'
import { parsePrice, parseWeight, parseCount } from './parsers/price.parser.js'
import { parseProductAttributes } from './parsers/product-attributes.parser.js'
import { DEFAULT_WEIGHT_GRAMS, MAX_DESCRIPTION_LENGTH } from './constants.js'

const SHOPTET_NON_PRODUCT_PATHS = new Set([
  'login', 'registracia', 'kosik', 'cookies-settings',
  'action', 'vop', 'obchodne-podmienky', 'ochrana-osobnych-udajov',
  'gdpr', 'reklamacny-poriadok', 'kontakty', 'kontakt',
  'velkoobchod', 'b2b', 'blog', 'menu'
])

export class ShoptetScraper extends BaseScraper {
  get listingPaths() {
    return [this.shop.listingPath]
  }

  get nonProductPaths() {
    return SHOPTET_NON_PRODUCT_PATHS
  }

  async scrape() {
    this.log.info({ shop: this.shop.name }, 'Starting scrape')
    const products = []

    try {
      const { pages: listingUrls, firstPageHtml } = await this.getListingPages()
      const seenUrls = new Set()

      for (const url of listingUrls) {
        const html = url === listingUrls[0] && firstPageHtml
          ? firstPageHtml
          : await this.fetch(url)
        const productUrls = await this.parseListingPage(html, url)
        this.log.info({ url, count: productUrls.length }, 'Found product links')

        for (const productUrl of productUrls) {
          if (seenUrls.has(productUrl)) continue
          seenUrls.add(productUrl)

          try {
            const productHtml = await this.fetch(productUrl)
            const product = await this.parseProductDetail(productHtml, productUrl)
            if (product) products.push(this.normalizeProduct(product, productUrl))
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

  async getListingPages() {
    const allPages = []
    let firstPageHtml = null

    for (const listingPath of this.listingPaths) {
      const baseUrl = `${this.shop.url}${listingPath}`
      const html = await this.fetch(baseUrl)

      if (!firstPageHtml) firstPageHtml = html

      const pages = [baseUrl]
      const $ = cheerio.load(html)

      $('nav.pagination a[href], .pagination a[href]').each((_, el) => {
        const href = $(el).attr('href')
        if (!href || href === '#') return
        const fullUrl = href.startsWith('http') ? href : `${this.shop.url}${href}`
        if (!pages.includes(fullUrl)) pages.push(fullUrl)
      })

      allPages.push(...pages)
    }

    return { pages: [...new Set(allPages)], firstPageHtml }
  }

  async parseListingPage(html, _url) {
    const $ = cheerio.load(html)
    const urls = []

    $('div.p[data-micro="product"] a.name[data-micro="url"]').each((_, el) => {
      const href = $(el).attr('href')
      if (!href) return
      const fullUrl = href.startsWith('http') ? href : `${this.shop.url}${href}`
      if (this.isProductUrl(fullUrl)) urls.push(fullUrl)
    })

    return [...new Set(urls)]
  }

  async parseProductDetail(html, url) {
    const $ = cheerio.load(html)

    const name = $('h1').first().text().trim()
    if (!name) return null

    const imageUrl = $('.p-image img, .p-main-image img').first().attr('src') || null

    const description = this.extractDescription($)
    const attrs = this.extractAttributes($, name, description)

    const variants = this.extractShoptetVariants($, html, name)
    if (variants.length === 0) return null

    const badges = this.extractBadges($)

    return {
      name,
      imageUrl: imageUrl && imageUrl.startsWith('http') ? imageUrl : null,
      description: description ? description.slice(0, MAX_DESCRIPTION_LENGTH) : null,
      originCountry: attrs.originCountry,
      originRegion: attrs.originRegion,
      process: attrs.process,
      roastLevel: attrs.roastLevel,
      variety: attrs.variety,
      tastingNotes: attrs.tastingNotes,
      altitude: attrs.altitude,
      brewingMethod: attrs.brewingMethod,
      arabicaPercentage: attrs.arabicaPercentage,
      isBlend: attrs.isBlend,
      isDecaf: attrs.isDecaf,
      variants,
      rating: null,
      badges
    }
  }

  extractDescription($) {
    const shortDesc = $('.p-short-description').first().text().trim()
    const longDesc = $('.basic-description').first().text().trim()
    return shortDesc || longDesc || null
  }

  extractAttributes($, name, description) {
    const text = this.getAttributeText($, name, description)
    const parsed = parseProductAttributes(text)

    const structured = this.parseStructuredAttributes($)

    return {
      originCountry: structured.country || parsed.origin.country,
      originRegion: structured.region || parsed.origin.region,
      process: structured.process || parsed.process,
      roastLevel: structured.roastLevel || parsed.roastLevel,
      variety: structured.variety || null,
      tastingNotes: structured.tastingNotes || parsed.tastingNotes,
      altitude: structured.altitude || null,
      brewingMethod: parsed.brewingMethod,
      arabicaPercentage: parsed.arabicaPercentage,
      isBlend: parsed.isBlend,
      isDecaf: parsed.isDecaf
    }
  }

  getAttributeText($, name, description) {
    return `${name} ${description || ''}`
  }

  get attributeSelectors() {
    return ['.p-short-description', '.basic-description']
  }

  get farmLabelPattern() {
    return /farma|farm|estate|finca/
  }

  parseStructuredAttributes($) {
    let html = ''
    for (const selector of this.attributeSelectors) {
      html = $(selector).html() || ''
      if (html) break
    }
    if (!html) return {}

    const lines = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    const attrs = {}

    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.+)$/)
      if (!match) continue

      const label = match[1].toLowerCase().trim()
      const value = match[2].trim()

      if (/krajina|country|p[ôo]vod|origin/.test(label)) {
        attrs.country = value
      } else if (/regi[óo]n|oblasť|oblast|area/.test(label)) {
        attrs.region = value
      } else if (this.farmLabelPattern.test(label) && !attrs.region) {
        attrs.region = value
      } else if (/spracovanie|process/.test(label)) {
        attrs.process = value
      } else if (/pra[žz]enie|roast/.test(label)) {
        attrs.roastLevel = value
      } else if (/varieta|variety|odroda|odrody/.test(label)) {
        attrs.variety = value
      } else if (/profil|tasting|chu[tť]|notes/.test(label)) {
        attrs.tastingNotes = value
      } else if (/nadmorsk|altitude|elevation|výška/.test(label)) {
        attrs.altitude = value
      }
    }

    return attrs
  }

  extractShoptetVariants($, html, name) {
    const parameterMap = this.parseParameterSelects($)
    const variantData = this.parseVariantsSplit(html)

    if (Object.keys(variantData).length === 0) {
      return this.extractFallbackVariant($, name)
    }

    const variants = []

    for (const [key, data] of Object.entries(variantData)) {
      const price = data.priceUnformatted
      if (!price || price <= 0) continue

      const decoded = this.decodeVariantKey(key, parameterMap)
      const weight = decoded.weightGrams || parseWeight(name) || DEFAULT_WEIGHT_GRAMS
      const isInStock = data.isNotSoldOut !== false

      const originalPrice = data.actionPriceActive === 1 && data.standardPrice
        ? parsePrice(String(data.standardPrice))
        : null

      variants.push({
        weightGrams: weight,
        grind: decoded.grind,
        label: decoded.label,
        price,
        originalPrice: originalPrice && originalPrice > price ? originalPrice : null,
        subscriptionPrice: null,
        inStock: isInStock,
        sku: data.code || null
      })
    }

    return variants
  }

  parseParameterSelects($) {
    const params = {}

    $('[data-parameter-id]').each((_, el) => {
      const paramId = $(el).attr('data-parameter-id')
      const paramName = $(el).attr('data-parameter-name') || ''
      const values = {}

      // Select-based parameters
      $(el).find('option').each((__, opt) => {
        const valueId = $(opt).val()
        const label = $(opt).text().trim()
        if (valueId && !$(opt).data('choose')) {
          values[valueId] = label
        }
      })

      // Radio button parameters (advanced-parameter labels)
      $(el).find('label.advanced-parameter').each((__, lbl) => {
        const radio = $(lbl).find('input[type="radio"]')
        const valueId = radio.val()
        const label = $(lbl).find('.parameter-value').text().trim()
          || $(lbl).find('.advanced-parameter-inner').attr('title') || ''
        if (valueId && label) {
          values[valueId] = label
        }
      })

      if (Object.keys(values).length > 0) {
        params[paramId] = { name: paramName, values }
      }
    })

    return params
  }

  parseVariantsSplit(html) {
    const startPattern = 'shoptet.variantsSplit.necessaryVariantData'
    const idx = html.indexOf(startPattern)
    if (idx === -1) return {}

    const eqIdx = html.indexOf('{', idx + startPattern.length)
    if (eqIdx === -1) return {}

    let depth = 0
    let end = eqIdx
    for (let i = eqIdx; i < html.length; i++) {
      if (html[i] === '{') depth++
      else if (html[i] === '}') depth--
      if (depth === 0) { end = i + 1; break }
    }

    try {
      return JSON.parse(html.slice(eqIdx, end))
    } catch {
      return {}
    }
  }

  decodeVariantKey(key, parameterMap) {
    const parts = key.split('-')
    let weightGrams = null
    let grind = null
    const labelParts = []

    for (let i = 0; i < parts.length - 1; i += 2) {
      const paramId = parts[i]
      const valueId = parts[i + 1]
      const param = parameterMap[paramId]
      if (!param) continue

      const valueLabel = param.values[valueId] || ''
      const paramNameLower = param.name.toLowerCase()

      if (/hmotnos[tť]|weight|ve[ľl]kos[tť]|grams|v[áa]ha/.test(paramNameLower)) {
        weightGrams = parseWeight(valueLabel)
      } else if (/pra[žz]enie|roast|mletie|grind/.test(paramNameLower)) {
        const lower = valueLabel.toLowerCase()
        if (/filter/.test(lower)) grind = 'filter'
        else if (/espresso/.test(lower)) grind = 'espresso'
        else if (/omni/.test(lower)) grind = 'omni'
        else grind = lower

        labelParts.push(valueLabel)
      } else {
        // Try to extract weight or count from the label to differentiate variants
        if (!weightGrams) {
          weightGrams = parseWeight(valueLabel) || parseCount(valueLabel)
        }
        labelParts.push(valueLabel)
      }
    }

    const label = labelParts.length > 0
      ? `${labelParts.join(' ')}${weightGrams ? ` ${weightGrams}g` : ''}`
      : weightGrams ? `${weightGrams}g` : null

    return { weightGrams, grind, label }
  }

  extractFallbackVariant($, name) {
    const priceEl = $('strong.price-final, .price-final').first()
    const price = parsePrice(priceEl.text())
    if (!price) return []

    const weight = parseWeight(name) || DEFAULT_WEIGHT_GRAMS
    const isInStock = !$('.availability-label').text().match(/vypredané|nedostupn/i)

    return [{
      weightGrams: weight,
      grind: null,
      label: null,
      price,
      originalPrice: null,
      subscriptionPrice: null,
      inStock: isInStock !== false,
      sku: null
    }]
  }

  extractBadges($) {
    const badges = []
    $('.flag').each((_, el) => {
      const text = $(el).text().trim()
      if (!text) return
      if (/sale|z[lľ]ava|akci/i.test(text)) {
        badges.push({ badgeType: 'price_friendly', label: text })
      } else if (/novin|new/i.test(text)) {
        badges.push({ badgeType: 'new', label: text })
      } else if (/limited|limitovan/i.test(text)) {
        badges.push({ badgeType: 'limited', label: text })
      }
    })
    return badges
  }

  isProductUrl(href) {
    if (!href) return false
    const rawPath = href.replace(this.shop.url, '').replace(/^https?:\/\/[^/]+/, '')
    const path = rawPath.split('?')[0].split('#')[0]
    if (!path || path === '/') return false
    if (path.includes('/action/')) return false
    if (/\.(jpg|png|svg|pdf|css|js)$/i.test(path)) return false

    const slug = path.replace(/^\/|\/$/g, '').split('/')[0].toLowerCase()
    if (this.nonProductPaths.has(slug)) return false

    for (const listingPath of this.listingPaths) {
      const categorySlug = listingPath.replace(/^\/|\/$/g, '').split('/')[0]
      if (slug === categorySlug) return false
    }

    return this.matchesDomain(href)
  }
}
