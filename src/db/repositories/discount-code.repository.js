export function createDiscountCodeRepository(db) {
  const stmts = {
    findAll: db.prepare('SELECT * FROM discount_codes WHERE is_active = 1 ORDER BY created_at DESC'),
    findByShop: db.prepare('SELECT * FROM discount_codes WHERE shop_slug = ? AND is_active = 1'),
    findByCode: db.prepare('SELECT * FROM discount_codes WHERE code = ? AND shop_slug = ?'),
    upsert: db.prepare(`
      INSERT INTO discount_codes (shop_slug, code, discount_percent, discount_fixed,
        description, source_url, valid_from, valid_until)
      VALUES (@shopSlug, @code, @discountPercent, @discountFixed,
        @description, @sourceUrl, @validFrom, @validUntil)
      ON CONFLICT DO NOTHING
    `),
    deactivateExpired: db.prepare(`
      UPDATE discount_codes SET is_active = 0
      WHERE valid_until IS NOT NULL AND valid_until < datetime('now') AND is_active = 1
    `)
  }

  return {
    findAll() {
      return stmts.findAll.all()
    },

    findByShop(shopSlug) {
      return stmts.findByShop.all(shopSlug)
    },

    upsert(code) {
      stmts.upsert.run(code)
    },

    deactivateExpired() {
      return stmts.deactivateExpired.run()
    }
  }
}
