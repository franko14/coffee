export function createRatingRepository(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO ratings (product_id, source, average_rating, out_of, review_count, observed_at)
      VALUES (@productId, @source, @averageRating, @outOf, @reviewCount, datetime('now'))
    `),
    findLatestByProduct: db.prepare(`
      SELECT * FROM ratings
      WHERE product_id = ?
      ORDER BY observed_at DESC
      LIMIT 1
    `),
    findLatestByProducts: db.prepare(`
      SELECT r.* FROM ratings r
      INNER JOIN (
        SELECT product_id, MAX(observed_at) as max_at FROM ratings GROUP BY product_id
      ) latest ON r.product_id = latest.product_id AND r.observed_at = latest.max_at
      WHERE r.product_id IN (SELECT value FROM json_each(?))
    `),
    findAllByProduct: db.prepare(`
      SELECT * FROM ratings
      WHERE product_id = ?
      ORDER BY observed_at DESC
    `)
  }

  return {
    record(rating) {
      stmts.insert.run(rating)
    },

    findLatestByProduct(productId) {
      return stmts.findLatestByProduct.get(productId) || null
    },

    findLatestByProducts(productIds) {
      if (productIds.length === 0) return []
      return stmts.findLatestByProducts.all(JSON.stringify(productIds))
    },

    findAllByProduct(productId) {
      return stmts.findAllByProduct.all(productId)
    }
  }
}
