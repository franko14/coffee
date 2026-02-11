export function createVariantRepository(db, { stockChangeRepo } = {}) {
  const stmts = {
    findByProduct: db.prepare(`
      SELECT * FROM product_variants WHERE product_id = ? ORDER BY weight_grams, grind
    `),
    findByProducts: db.prepare(`
      SELECT * FROM product_variants WHERE product_id IN (SELECT value FROM json_each(?)) ORDER BY product_id, weight_grams, grind
    `),
    findById: db.prepare('SELECT * FROM product_variants WHERE id = ?'),
    findByProductAndLabel: db.prepare(`
      SELECT * FROM product_variants
      WHERE product_id = ? AND weight_grams = ? AND COALESCE(grind, '') = COALESCE(?, '')
    `),
    insert: db.prepare(`
      INSERT INTO product_variants (product_id, weight_grams, grind, label, current_price,
        original_price, current_subscription_price, price_per_100g, in_stock, sku)
      VALUES (@productId, @weightGrams, @grind, @label, @currentPrice,
        @originalPrice, @currentSubscriptionPrice, @pricePer100g, @inStock, @sku)
    `),
    update: db.prepare(`
      UPDATE product_variants SET
        current_price = @currentPrice,
        original_price = @originalPrice,
        current_subscription_price = @currentSubscriptionPrice,
        price_per_100g = @pricePer100g,
        in_stock = @inStock,
        label = @label,
        sku = @sku,
        updated_at = datetime('now')
      WHERE id = @id
    `),
    markOutOfStock: db.prepare(`
      UPDATE product_variants SET
        in_stock = 0,
        updated_at = datetime('now')
      WHERE product_id = ? AND id NOT IN (SELECT value FROM json_each(?))
    `),
    markStaleOutOfStock: db.prepare(`
      UPDATE product_variants SET
        in_stock = 0,
        updated_at = datetime('now')
      WHERE in_stock = 1 AND product_id IN (
        SELECT id FROM products WHERE shop_id = ? AND last_seen_at < ?
      )
    `)
  }

  return {
    findByProduct(productId) {
      return stmts.findByProduct.all(productId)
    },

    findByProducts(productIds) {
      if (productIds.length === 0) return []
      return stmts.findByProducts.all(JSON.stringify(productIds))
    },

    findById(id) {
      return stmts.findById.get(id) || null
    },

    upsert(variant) {
      const data = { originalPrice: null, ...variant }

      const existing = stmts.findByProductAndLabel.get(
        data.productId,
        data.weightGrams,
        data.grind || ''
      )

      if (existing) {
        if (stockChangeRepo && existing.in_stock !== data.inStock) {
          stockChangeRepo.record({
            variantId: existing.id,
            previousStock: existing.in_stock,
            newStock: data.inStock
          })
        }

        stmts.update.run({ ...data, id: existing.id })
        return {
          id: existing.id,
          isNew: false,
          previousPrice: existing.current_price,
          previousStock: existing.in_stock,
          priceChanged: existing.current_price !== data.currentPrice,
          stockChanged: existing.in_stock !== data.inStock
        }
      }

      const info = stmts.insert.run(data)
      return {
        id: Number(info.lastInsertRowid),
        isNew: true,
        previousPrice: null,
        priceChanged: false
      }
    },

    markMissingAsOutOfStock(productId, foundVariantIds) {
      // Mark all variants for this product as out of stock if they weren't found in the current scrape
      // When foundVariantIds is empty, mark ALL variants as out of stock
      stmts.markOutOfStock.run(productId, JSON.stringify(foundVariantIds))
    },

    markStaleProductsOutOfStock(shopId, beforeTimestamp) {
      // Mark all variants of products not seen since beforeTimestamp as out of stock
      return stmts.markStaleOutOfStock.run(shopId, beforeTimestamp)
    }
  }
}
