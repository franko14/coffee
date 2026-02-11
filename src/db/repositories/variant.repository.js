export function createVariantRepository(db) {
  const stmts = {
    findByProduct: db.prepare(`
      SELECT * FROM product_variants WHERE product_id = ? ORDER BY weight_grams, grind
    `),
    findById: db.prepare('SELECT * FROM product_variants WHERE id = ?'),
    findByProductAndLabel: db.prepare(`
      SELECT * FROM product_variants
      WHERE product_id = ? AND weight_grams = ? AND COALESCE(grind, '') = COALESCE(?, '')
    `),
    insert: db.prepare(`
      INSERT INTO product_variants (product_id, weight_grams, grind, label, current_price,
        current_subscription_price, price_per_100g, in_stock, sku)
      VALUES (@productId, @weightGrams, @grind, @label, @currentPrice,
        @currentSubscriptionPrice, @pricePer100g, @inStock, @sku)
    `),
    update: db.prepare(`
      UPDATE product_variants SET
        current_price = @currentPrice,
        current_subscription_price = @currentSubscriptionPrice,
        price_per_100g = @pricePer100g,
        in_stock = @inStock,
        label = @label,
        sku = @sku,
        updated_at = datetime('now')
      WHERE id = @id
    `)
  }

  return {
    findByProduct(productId) {
      return stmts.findByProduct.all(productId)
    },

    findById(id) {
      return stmts.findById.get(id) || null
    },

    upsert(variant) {
      const existing = stmts.findByProductAndLabel.get(
        variant.productId,
        variant.weightGrams,
        variant.grind || ''
      )

      if (existing) {
        stmts.update.run({ ...variant, id: existing.id })
        return {
          id: existing.id,
          isNew: false,
          previousPrice: existing.current_price,
          priceChanged: existing.current_price !== variant.currentPrice
        }
      }

      const info = stmts.insert.run(variant)
      return {
        id: Number(info.lastInsertRowid),
        isNew: true,
        previousPrice: null,
        priceChanged: false
      }
    }
  }
}
