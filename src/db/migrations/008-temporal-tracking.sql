-- Unique constraint for discount_codes so ON CONFLICT DO NOTHING works
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_codes_shop_code ON discount_codes(shop_slug, code);

-- Missing indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scrape_runs_shop_time ON scrape_runs(shop_slug, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_matches_product ON blog_product_matches(product_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_shop ON discount_codes(shop_slug);
CREATE INDEX IF NOT EXISTS idx_ratings_product_time ON ratings(product_id, observed_at DESC);

-- Temporal tracking columns
ALTER TABLE products ADD COLUMN deactivated_at TEXT DEFAULT NULL;
ALTER TABLE shops ADD COLUMN last_scraped_at TEXT DEFAULT NULL;
ALTER TABLE price_history ADD COLUMN weight_grams INTEGER DEFAULT NULL;

-- Stock change history
CREATE TABLE IF NOT EXISTS stock_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stock_changes_variant ON stock_changes(variant_id, changed_at DESC);

-- Product attribute change log
CREATE TABLE IF NOT EXISTS product_change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_product_changes_product ON product_change_log(product_id, changed_at DESC);
