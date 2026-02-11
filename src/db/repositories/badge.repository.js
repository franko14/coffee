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
