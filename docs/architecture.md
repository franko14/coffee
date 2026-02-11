# Architecture

## Overview

Coffee Price Monitor is a Node.js application that scrapes specialty coffee product data from Slovak e-commerce shops, scores products using a multi-factor algorithm, and presents results through a web dashboard.

## Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Database**: SQLite via `better-sqlite3`
- **Web Framework**: Express.js
- **HTML Parsing**: Cheerio
- **Validation**: Zod
- **Logging**: Pino
- **CLI**: Commander.js
- **Testing**: Vitest

## Directory Structure

```
src/
  alerts/          # Alert engine, types, formatters (console, JSON log)
  cli/             # Commander.js CLI with commands: scrape, monitor, list, recommend, alerts
  db/
    bootstrap.js   # Factory: creates DB connection + all repositories
    connection.js  # SQLite connection manager
    migrator.js    # Sequential SQL migration runner
    migrations/    # 001-008 SQL migration files
    product-saver.js  # Unified product/blog save logic with callbacks
    repositories/  # Repository pattern: one file per table
  frontend/        # Static SPA (vanilla JS + CSS)
  scoring/         # Tier calculator, scoring algorithm
  scrapers/
    base-scraper.js       # Abstract base with scrape loop
    woocommerce-scraper.js  # WooCommerce template (extends base)
    sites/                # Site-specific scrapers (extend WooCommerce or base)
    parsers/              # Shared parsers: JSON-LD, price, weight, attributes, country map
    constants.js          # Shared scraper constants
    roastery-map.js       # Name-to-slug mapping
    scraper-factory.js    # Factory: config -> scraper instance
  server/
    app.js         # Express app factory
    middleware/    # Error handler
    routes/        # API route handlers
    validation/   # Shared Zod schemas
  utils/           # Price utils, date utils, logger, slugify, HTTP client, group-by, etc.
config/
  loader.js        # YAML config loader
  default.yml      # Default configuration
tests/
  unit/            # Unit tests
  integration/     # API + DB integration tests
```

## Data Flow

```
1. SCRAPE    Config → Scraper Factory → Site Scraper → Raw HTML
2. PARSE     Raw HTML → Cheerio + JSON-LD → Normalized Product
3. NORMALIZE Product Attributes Parser → Country/Origin/Process extraction
4. SAVE      Product Saver → Repositories → SQLite (products, variants, prices, ratings, badges)
5. SCORE     Tier Calculator → Multi-factor scoring → Ranked recommendations
6. DISPLAY   Express API → Frontend SPA
```

## Layered Architecture

```
┌─────────────────────────────────────────┐
│          Frontend (Static SPA)          │
├─────────────────────────────────────────┤
│        Express API (routes/)            │
├─────────────────────────────────────────┤
│     Business Logic (scoring, alerts)    │
├─────────────────────────────────────────┤
│   Data Access (repositories, saver)     │
├─────────────────────────────────────────┤
│     Database (SQLite + migrations)      │
└─────────────────────────────────────────┘
```

## Key Patterns

- **Repository Pattern**: Each table has a dedicated repository with prepared statements
- **Factory Pattern**: `bootstrapDb()` creates all repos, `createScraper()` creates scrapers
- **Template Method**: `WooCommerceScraper` defines the scraping flow; site scrapers override specific extraction methods
- **Callback Hooks**: `saveScrapedProducts()` accepts `onNewProduct`, `onPriceChange`, `onStockChange` for alert integration
- **Batch Queries**: `findByProducts(ids)` uses `json_each()` to avoid N+1 query patterns
