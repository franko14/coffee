# Database Schema

## Overview

SQLite database with 12 tables, managed via sequential SQL migrations (`src/db/migrations/001-008`).

## Entity Relationship

```
shops 1──N products 1──N product_variants 1──N price_history
                    1──N product_badges
                    1──N ratings
                    1──N product_change_log
                         product_variants 1──N stock_changes

blog_reviews 1──N blog_product_matches N──1 products

discount_codes (shop_slug FK to shops.slug)
scrape_runs (shop_slug FK to shops.slug)
alerts (product_id FK to products.id)
```

## Tables

### shops
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| slug | TEXT UNIQUE | URL-safe identifier |
| name | TEXT | Display name |
| url | TEXT | Base URL |
| scraper_key | TEXT | Maps to scraper class |
| listing_path | TEXT | Product listing URL path |
| has_ratings | INTEGER | 0/1 flag |
| has_subscriptions | INTEGER | 0/1 flag |
| is_blog | INTEGER | 0/1 flag |
| user_discount_percent | REAL | User-configured discount % |
| user_discount_code | TEXT | Discount code string |
| user_discount_enabled | INTEGER | 0/1 flag |
| last_scraped_at | TEXT | Timestamp of last scrape |

### products
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| shop_id | INTEGER FK | References shops(id) |
| slug | TEXT | URL-safe name (UNIQUE with shop_id) |
| name, url, image_url, description | TEXT | Product metadata |
| origin_country, origin_region | TEXT | Coffee origin |
| process, roast_level, variety | TEXT | Coffee attributes |
| tasting_notes, altitude, brewing_method | TEXT | Additional attributes |
| arabica_percentage | REAL | Arabica % (nullable) |
| is_blend, is_decaf, is_active | INTEGER | 0/1 flags |
| deactivated_at | TEXT | When product was marked inactive |
| first_seen_at, last_seen_at | TEXT | Temporal tracking |

### product_variants
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| product_id | INTEGER FK | References products(id) CASCADE |
| weight_grams | INTEGER | Package weight |
| grind | TEXT | whole-bean, ground, espresso |
| label | TEXT | Display label |
| current_price | REAL | Current price in EUR |
| original_price | REAL | Pre-sale price (nullable) |
| current_subscription_price | REAL | Subscription price |
| price_per_100g | REAL | Calculated price per 100g |
| in_stock | INTEGER | 0/1 flag |
| sku | TEXT | Shop SKU |

### price_history
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| variant_id | INTEGER FK | References product_variants(id) CASCADE |
| price | REAL | Observed price |
| subscription_price | REAL | Observed subscription price |
| price_per_100g | REAL | Calculated |
| weight_grams | INTEGER | Weight at time of observation |
| observed_at | TEXT | Timestamp |

### stock_changes
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| variant_id | INTEGER FK | References product_variants(id) CASCADE |
| previous_stock | INTEGER | 0 or 1 |
| new_stock | INTEGER | 0 or 1 |
| changed_at | TEXT | Timestamp |

### product_change_log
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| product_id | INTEGER FK | References products(id) CASCADE |
| field_name | TEXT | Column name that changed |
| old_value | TEXT | Previous value |
| new_value | TEXT | New value |
| changed_at | TEXT | Timestamp |

### Other Tables
- **product_badges**: product_id, badge_type (UNIQUE pair), label
- **ratings**: product_id, source, average_rating, out_of, review_count, observed_at
- **blog_reviews**: source_url (UNIQUE), title, roastery_name, cupping_score, etc.
- **blog_product_matches**: blog_review_id + product_id (UNIQUE), confidence, match_type
- **discount_codes**: shop_slug, code (UNIQUE pair), discount_percent, valid dates
- **scrape_runs**: shop_slug, status, product counts, timing
- **alerts**: alert_type, severity, shop_slug, product_id, title, message, data (JSON), is_read

## Migration History

| # | File | Description |
|---|------|-------------|
| 001 | initial-schema.sql | Core tables: shops, products, variants, price_history, badges, ratings, scrape_runs |
| 002 | blog-reviews.sql | blog_reviews, blog_product_matches, discount_codes |
| 003 | alerts.sql | alerts table |
| 004 | original-price.sql | original_price column on product_variants |
| 005 | coffee-metrics.sql | brewing_method, arabica_percentage on products |
| 006 | shop-discounts.sql | user_discount columns on shops |
| 007 | performance-indexes.sql | Indexes for common query patterns |
| 008 | temporal-tracking.sql | stock_changes, product_change_log, deactivated_at, last_scraped_at, weight_grams on price_history |

## Index Strategy

Performance-critical indexes:
- `idx_products_shop_active(shop_id, is_active)` — product listing by shop
- `idx_variants_product_stock(product_id, in_stock)` — variant lookup
- `idx_price_history_variant_time(variant_id, observed_at DESC)` — price history timeline
- `idx_stock_changes_variant(variant_id, changed_at DESC)` — stock change lookup
- `idx_product_changes_product(product_id, changed_at DESC)` — attribute change lookup
- `idx_ratings_product_time(product_id, observed_at DESC)` — latest rating lookup
- `idx_scrape_runs_shop_time(shop_slug, started_at DESC)` — scrape run history

## Querying Temporal Data

**Stock changes for a variant:**
```sql
SELECT * FROM stock_changes WHERE variant_id = ? ORDER BY changed_at DESC LIMIT 50
```

**Attribute changes for a product:**
```sql
SELECT * FROM product_change_log WHERE product_id = ? ORDER BY changed_at DESC LIMIT 100
```

**Price history for multiple products (batch):**
```sql
SELECT ph.*, pv.product_id FROM price_history ph
JOIN product_variants pv ON ph.variant_id = pv.id
WHERE pv.product_id IN (SELECT value FROM json_each(?))
ORDER BY ph.observed_at DESC LIMIT 500
```
