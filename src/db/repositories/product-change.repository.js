export function createProductChangeRepository(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO product_change_log (product_id, field_name, old_value, new_value)
      VALUES (@productId, @fieldName, @oldValue, @newValue)
    `),
    findByProduct: db.prepare(`
      SELECT * FROM product_change_log
      WHERE product_id = ?
      ORDER BY changed_at DESC
      LIMIT ?
    `)
  }

  return {
    record({ productId, fieldName, oldValue, newValue }) {
      stmts.insert.run({ productId, fieldName, oldValue, newValue })
    },

    findByProduct(productId, limit = 100) {
      return stmts.findByProduct.all(productId, limit)
    }
  }
}
