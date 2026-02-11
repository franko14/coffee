export function createBadgeRepository(db) {
  const stmts = {
    upsert: db.prepare(`
      INSERT INTO product_badges (product_id, badge_type, label)
      VALUES (@productId, @badgeType, @label)
      ON CONFLICT(product_id, badge_type) DO UPDATE SET
        label = excluded.label
    `),
    findByProduct: db.prepare(`
      SELECT * FROM product_badges WHERE product_id = ?
    `),
    findByProducts: db.prepare(`
      SELECT * FROM product_badges WHERE product_id IN (SELECT value FROM json_each(?))
    `),
    deleteByProduct: db.prepare(`
      DELETE FROM product_badges WHERE product_id = ?
    `)
  }

  return {
    upsert(badge) {
      stmts.upsert.run(badge)
    },

    findByProduct(productId) {
      return stmts.findByProduct.all(productId)
    },

    findByProducts(productIds) {
      if (productIds.length === 0) return []
      return stmts.findByProducts.all(JSON.stringify(productIds))
    },

    replaceForProduct(productId, badges) {
      db.transaction(() => {
        stmts.deleteByProduct.run(productId)
        for (const badge of badges) {
          stmts.upsert.run({ ...badge, productId })
        }
      })()
    }
  }
}
