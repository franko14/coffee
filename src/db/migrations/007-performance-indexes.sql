-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_products_shop_active ON products(shop_id, is_active);
CREATE INDEX IF NOT EXISTS idx_variants_product_stock ON product_variants(product_id, in_stock);
CREATE INDEX IF NOT EXISTS idx_price_history_variant_time ON price_history(variant_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_shop_created ON alerts(shop_slug, created_at);
