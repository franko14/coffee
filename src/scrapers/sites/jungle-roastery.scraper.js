import { ShoptetScraper } from '../shoptet-scraper.js'

const NON_PRODUCT_PATHS = new Set([
  'kava', 'b2b', 'menu', 'kontakty', 'blog', 'vop'
])

export class JungleRoasteryScraper extends ShoptetScraper {
  get nonProductPaths() {
    return NON_PRODUCT_PATHS
  }

  get attributeSelectors() {
    return ['.p-short-description']
  }
}
