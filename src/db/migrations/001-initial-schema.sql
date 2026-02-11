CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  scraper_key TEXT NOT NULL,
  listing_path TEXT NOT NULL,
  has_ratings INTEGER NOT NULL DEFAULT 0,
  has_subscriptions INTEGER NOT NULL DEFAULT 0,
  is_blog INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL,
  external_id TEXT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  image_url TEXT,
  description TEXT,
  origin_country TEXT,
  origin_region TEXT,
  process TEXT,
  roast_level TEXT,
  variety TEXT,
  tasting_notes TEXT,
  altitude TEXT,
  is_blend INTEGER NOT NULL DEFAULT 0,
  is_decaf INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  UNIQUE(shop_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_origin_country ON products(origin_country);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  weight_grams INTEGER,
  grind TEXT,
  label TEXT,
  current_price REAL,
  current_subscription_price REAL,
  price_per_100g REAL,
  in_stock INTEGER NOT NULL DEFAULT 1,
  sku TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_price_per_100g ON product_variants(price_per_100g);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id INTEGER NOT NULL,
  price REAL NOT NULL,
  subscription_price REAL,
  price_per_100g REAL,
  observed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_price_history_variant_id ON price_history(variant_id);
CREATE INDEX IF NOT EXISTS idx_price_history_observed_at ON price_history(observed_at);

CREATE TABLE IF NOT EXISTS product_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  badge_type TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(product_id, badge_type)
);

CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  average_rating REAL,
  out_of REAL NOT NULL DEFAULT 5.0,
  review_count INTEGER DEFAULT 0,
  observed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ratings_product_id ON ratings(product_id);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  products_found INTEGER DEFAULT 0,
  products_new INTEGER DEFAULT 0,
  price_changes INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  error_messages TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);
