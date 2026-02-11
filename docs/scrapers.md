# Scrapers

## Class Hierarchy

```
BaseScraper
  ├── WooCommerceScraper (template for WooCommerce shops)
  │     ├── TripleFiveScraper
  │     ├── ZlateZrnkoScraper
  │     └── GoriffeeScraper
  ├── BlackScraper (Shoptet-based, extends BaseScraper directly)
  └── BlogOKaveScraper (blog scraper, extends BaseScraper directly)
```

## Parser Pipeline

```
HTML → Cheerio ($) → JSON-LD extraction → Product normalization
                   → Attribute table parsing → Origin/process/roast extraction
                   → Price/weight parsing → Variant construction
                   → Badge extraction → Badge list
```

### Shared Parsers (`src/scrapers/parsers/`)
- **json-ld.parser.js**: Extracts `@type: Product` from `<script type="application/ld+json">`. Accepts HTML string or Cheerio instance.
- **price.parser.js**: `parsePrice(text)` and `parseWeight(text)` — extracts EUR prices and gram/kg weights from text.
- **product-attributes.parser.js**: `parseProductAttributes(text)` — regex-based extraction of origin, process, roast level, tasting notes from free text.
- **attribute-table.parser.js**: `parseAttributeTable($, selector)` — parses HTML table rows for structured coffee attributes.
- **country-map.js**: `COUNTRY_NAME_MAP` — normalizes country names (e.g., "colombia" -> "Colombia").
- **rating.parser.js**: Extracts rating data from JSON-LD.

### Shared Constants (`src/scrapers/constants.js`)
- `DEFAULT_WEIGHT_GRAMS = 250`
- `MAX_DESCRIPTION_LENGTH = 500`

### Roastery Map (`src/scrapers/roastery-map.js`)
Maps roastery display names to URL slugs for blog-to-shop matching.

## Adding a New Shop

1. **Create scraper file** in `src/scrapers/sites/`:
   - Extend `WooCommerceScraper` for WooCommerce shops
   - Extend `BaseScraper` for other platforms
   - Override `parseListingPage()` and `parseProductDetail()` at minimum

2. **Override URL filtering** (WooCommerce only):
   - Override `isProductPath(href)` to match product URL patterns
   - Override `isExcludedUrl(href)` only if the shop has additional exclusions beyond the defaults

3. **Register in scraper factory** (`src/scrapers/scraper-factory.js`):
   ```js
   import { NewShopScraper } from './sites/new-shop.scraper.js'
   // Add to SCRAPER_MAP
   ```

4. **Add shop config** in `config/default.yml`:
   ```yaml
   shops:
     - slug: new-shop
       name: New Shop
       url: https://newshop.sk
       scraperKey: new-shop
       listingPath: /products/
   ```

5. **Run**: `node src/cli/index.js scrape --shop new-shop`

## Template Method Pattern (WooCommerce)

The `WooCommerceScraper` provides the scraping flow. Site scrapers override specific hooks:

| Method | Default | Override for |
|--------|---------|-------------|
| `isProductPath(href)` | `return true` | Filter product URLs by path pattern |
| `isExcludedUrl(href)` | Excludes cart, checkout, categories, images | Add shop-specific exclusions |
| `extractDetailAttributes($, ldData)` | Uses shared `parseAttributeTable` | Add extra attribute sources |
| `extractVariants($, ldData)` | WooCommerce variations JSON + JSON-LD + DOM fallback | Custom variant extraction |
| `extractWeightFromPage($)` | Title + description + fallback to 250g | Custom weight extraction |

## Rate Limiting

Configured in `config/default.yml` under `scraping`:
- `rateLimitMs`: Delay between requests (default: 1000ms)
- `retryAttempts`: Number of retries on failure (default: 2)
- `retryBackoffMs`: Backoff between retries (default: 2000ms)
- `timeoutMs`: Request timeout (default: 15000ms)

## Known Limitations

- Scrapers rely on DOM structure which can change without notice
- JSON-LD data varies in completeness across shops
- Some WooCommerce discount plugins apply prices at render time (not in JSON), requiring DOM-based sale price extraction
- Blog scraper uses heuristic matching for roastery-to-product linking
