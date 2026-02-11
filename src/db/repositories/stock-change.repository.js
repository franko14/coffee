export function createStockChangeRepository(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO stock_changes (variant_id, previous_stock, new_stock)
      VALUES (@variantId, @previousStock, @newStock)
    `),
    findByVariant: db.prepare(`
      SELECT * FROM stock_changes
      WHERE variant_id = ?
      ORDER BY changed_at DESC
      LIMIT ?
    `)
  }

  return {
    record({ variantId, previousStock, newStock }) {
      stmts.insert.run({ variantId, previousStock, newStock })
    },

    findByVariant(variantId, limit = 50) {
      return stmts.findByVariant.all(variantId, limit)
    }
  }
}
