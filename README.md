# Coffee Price Monitor

Track and compare specialty coffee prices from Slovak roasteries. Scrapes product data, scores recommendations using a multi-factor algorithm, and presents results through a web dashboard.

## Quick Start

```bash
npm install
npm start
```

Open http://localhost:3000

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start web server on port 3000 |
| `npm run scrape` | Scrape all shops once |
| `npm run monitor` | Scrape + detect price/stock changes + generate alerts |
| `npm test` | Run tests |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | Coverage report |

### CLI Options

```bash
# Scrape specific shop
node src/cli/index.js scrape --shop triple-five

# Start on custom port
node src/cli/index.js serve --port 8080

# List all products
node src/cli/index.js list

# Get recommendations
node src/cli/index.js recommend --budget 30

# View alerts
node src/cli/index.js alerts
```

## Shops Tracked

| Shop | Platform | Features |
|------|----------|----------|
| [Triple Five Coffee](https://triplefivecoffee.com) | WooCommerce | Products |
| [Black.sk](https://black.sk) | Shoptet | Products |
| [Goriffee](https://goriffee.com) | WooCommerce | Products, ratings, subscriptions |
| [Zlate Zrnko](https://www.zlatezrnko.sk) | WooCommerce | Products, ratings |
| [Blog o Kave](https://blogokave.sk) | Blog | Reviews, discount codes |

## Tech Stack

- **Runtime**: Node.js >= 20 (ES Modules)
- **Database**: SQLite via better-sqlite3
- **Server**: Express.js (Helmet, CORS, rate limiting)
- **Scraping**: Cheerio + JSON-LD extraction
- **Validation**: Zod
- **Logging**: Pino
- **CLI**: Commander.js
- **Testing**: Vitest

## Architecture

```
Config -> Scraper Factory -> Site Scraper -> Raw HTML
Raw HTML -> Cheerio + JSON-LD -> Normalized Product
Product -> Repositories -> SQLite
Scoring Engine -> Ranked Recommendations
Express API -> Frontend SPA
```

Key patterns: repository pattern with prepared statements, template method for WooCommerce scrapers, factory pattern for DB bootstrap and scraper creation, batch queries with `json_each()` to avoid N+1.

See [docs/architecture.md](docs/architecture.md) for full details.

## Scoring Algorithm

Products are scored across weighted factors:

| Factor | Weight |
|--------|--------|
| Price value | 30% |
| Ratings | 20% |
| Origin quality | 15% |
| Blog mentions | 10% |
| Freshness | 10% |
| Awards | 5% |
| Subscription savings | 5% |
| Special badges | 5% |

## Alerts

The monitor command detects and logs:

| Type | Trigger |
|------|---------|
| Price drop | Price decreased by configured % |
| Price increase | Price increased by 5%+ |
| New product | New product discovered |
| Stock change | Product went in/out of stock |
| Product removed | Product marked inactive |
| Discount code | New discount code found from blog |

## Project Structure

```
src/
  alerts/          Alert engine + formatters
  cli/             CLI commands (scrape, monitor, list, recommend, alerts)
  db/              SQLite connection, migrations (001-008), repositories
  frontend/        Static SPA (vanilla JS + CSS)
  scoring/         Recommendation scoring
  scrapers/        Base + WooCommerce + site scrapers, shared parsers
  server/          Express API routes + middleware + validation
  utils/           Price, date, HTTP, logging utilities
config/            YAML configuration
docs/              Architecture, database, scrapers, API reference
tests/             Unit + integration tests
```

## Documentation

- [Architecture](docs/architecture.md) — system overview, data flow, patterns
- [Database](docs/database.md) — schema, migrations, indexes, temporal tracking
- [Scrapers](docs/scrapers.md) — class hierarchy, adding new shops
- [API Reference](docs/api.md) — endpoints, response format, error codes

## Adding a New Shop

1. Create scraper in `src/scrapers/sites/` (extend `WooCommerceScraper` or `BaseScraper`)
2. Register in `src/scrapers/scraper-factory.js`
3. Add shop config in `config/default.yml`
4. Run: `node src/cli/index.js scrape --shop new-shop`

See [docs/scrapers.md](docs/scrapers.md) for details.

## License

Private
