CREATE TABLE IF NOT EXISTS blog_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  roastery_name TEXT,
  coffee_name TEXT,
  cupping_score REAL,
  agtron REAL,
  tasting_notes TEXT,
  verdict TEXT,
  published_at TEXT,
  scraped_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_product_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blog_review_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'auto',
  confidence REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (blog_review_id) REFERENCES blog_reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(blog_review_id, product_id)
);

CREATE TABLE IF NOT EXISTS discount_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_slug TEXT,
  code TEXT NOT NULL,
  discount_percent REAL,
  discount_fixed REAL,
  description TEXT,
  source_url TEXT,
  valid_from TEXT,
  valid_until TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
