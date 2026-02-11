-- Add user discount settings per shop
ALTER TABLE shops ADD COLUMN user_discount_percent REAL DEFAULT NULL;
ALTER TABLE shops ADD COLUMN user_discount_code TEXT DEFAULT NULL;
ALTER TABLE shops ADD COLUMN user_discount_enabled INTEGER NOT NULL DEFAULT 0;
