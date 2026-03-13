import { ShoptetScraper } from '../shoptet-scraper.js'

const NON_PRODUCT_PATHS = new Set([
  'filter', 'espresso', 'caj', 'doplnky',
  'nase-prevadzky', 'velkoobchod'
])

export class ConceptCoffeeScraper extends ShoptetScraper {
  get listingPaths() {
    return ['/filter/', '/espresso/']
  }

  get nonProductPaths() {
    return NON_PRODUCT_PATHS
  }

  get attributeSelectors() {
    return ['.basic-description']
  }

  get farmLabelPattern() {
    return /farma|farm|estate|finca|producent/
  }

  getAttributeText($, name, description) {
    const longDesc = $('.basic-description').html() || ''
    const cleaned = longDesc
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .trim()

    return `${name} ${cleaned} ${description || ''}`
  }
}
