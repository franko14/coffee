import { TripleFiveScraper } from './sites/triple-five.scraper.js'
import { BlackScraper } from './sites/black.scraper.js'
import { GoriffeeScraper } from './sites/goriffee.scraper.js'
import { ZlateZrnkoScraper } from './sites/zlate-zrnko.scraper.js'
import { BlogOKaveScraper } from './sites/blog-okave.scraper.js'

const SCRAPER_MAP = {
  'triple-five': TripleFiveScraper,
  'black-sk': BlackScraper,
  'goriffee': GoriffeeScraper,
  'zlate-zrnko': ZlateZrnkoScraper,
  'blog-okave': BlogOKaveScraper
}

export function createScraper(shop, config) {
  const ScraperClass = SCRAPER_MAP[shop.scraperKey]

  if (!ScraperClass) {
    throw new Error(`No scraper found for key: ${shop.scraperKey}`)
  }

  return new ScraperClass(shop, config)
}

export function getAvailableScraperKeys() {
  return Object.keys(SCRAPER_MAP)
}
