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

    findAllByProduct(productId) {
      return stmts.findAllByProduct.all(productId)
    }
  }
}
