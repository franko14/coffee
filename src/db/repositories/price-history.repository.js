export function createPriceHistoryRepository(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO price_history (variant_id, price, subscription_price, price_per_100g, weight_grams, observed_at)
      VALUES (@variantId, @price, @subscriptionPrice, @pricePer100g, @weightGrams, datetime('now'))
    `),
    findByVariant: db.prepare(`
      SELECT * FROM price_history
      WHERE variant_id = ?
      ORDER BY observed_at DESC
      LIMIT ?
    `),
    findByProduct: db.prepare(`
      SELECT ph.*, pv.weight_grams, pv.grind, pv.label
      FROM price_history ph
      JOIN product_variants pv ON ph.variant_id = pv.id
      WHERE pv.product_id = ?
      ORDER BY ph.observed_at DESC
      LIMIT ?
    `),
    findByProducts: db.prepare(`
      SELECT ph.*, pv.weight_grams, pv.grind, pv.label, pv.product_id
      FROM price_history ph
      JOIN product_variants pv ON ph.variant_id = pv.id
      WHERE pv.product_id IN (SELECT value FROM json_each(?))
      ORDER BY ph.observed_at DESC
      LIMIT ?
    `),
    findRecent: db.prepare(`
      SELECT ph.*, pv.weight_grams, pv.grind, pv.label, p.name as product_name, s.slug as shop_slug
      FROM price_history ph
      JOIN product_variants pv ON ph.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN shops s ON p.shop_id = s.id
      ORDER BY ph.observed_at DESC
      LIMIT ?
    `)
  }

  return {
    record(entry) {
      stmts.insert.run({ weightGrams: null, ...entry })
    },

    findByVariant(variantId, limit = 500) {
      return stmts.findByVariant.all(variantId, limit)
    },

    findByProduct(productId, limit = 500) {
      return stmts.findByProduct.all(productId, limit)
    },

    findByProducts(productIds, limit = 500) {
      if (productIds.length === 0) return []
      return stmts.findByProducts.all(JSON.stringify(productIds), limit)
    },

    findRecent(limit = 100) {
      return stmts.findRecent.all(limit)
    }
  }
}
