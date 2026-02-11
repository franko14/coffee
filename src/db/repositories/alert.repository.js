export function createAlertRepository(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO alerts (alert_type, severity, shop_slug, product_id, title, message, data)
      VALUES (@alertType, @severity, @shopSlug, @productId, @title, @message, @data)
    `),
    findAll: db.prepare(`
      SELECT a.*, p.name as product_name, p.image_url as product_image, s.name as shop_name, s.slug as shop_slug_join
      FROM alerts a
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN shops s ON p.shop_id = s.id
      ORDER BY a.created_at DESC
      LIMIT ?
    `),
    findUnread: db.prepare(`
      SELECT a.*, p.name as product_name, p.image_url as product_image, s.name as shop_name, s.slug as shop_slug_join
      FROM alerts a
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN shops s ON p.shop_id = s.id
      WHERE a.is_read = 0
      ORDER BY a.created_at DESC
    `),
    findByType: db.prepare(`
      SELECT a.*, p.name as product_name, p.image_url as product_image, s.name as shop_name, s.slug as shop_slug_join
      FROM alerts a
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN shops s ON p.shop_id = s.id
      WHERE a.alert_type = ?
      ORDER BY a.created_at DESC
      LIMIT ?
    `),
    markRead: db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?'),
    markAllRead: db.prepare('UPDATE alerts SET is_read = 1 WHERE is_read = 0'),
    countUnread: db.prepare('SELECT COUNT(*) as count FROM alerts WHERE is_read = 0')
  }

  return {
    create(alert) {
      const info = stmts.insert.run({
        ...alert,
        data: alert.data ? JSON.stringify(alert.data) : null
      })
      return Number(info.lastInsertRowid)
    },

    findAll(limit = 50) {
      return stmts.findAll.all(limit)
    },

    findUnread() {
      return stmts.findUnread.all()
    },

    findByType(type, limit = 50) {
      return stmts.findByType.all(type, limit)
    },

    markRead(id) {
      stmts.markRead.run(id)
    },

    markAllRead() {
      stmts.markAllRead.run()
    },

    countUnread() {
      return stmts.countUnread.get().count
    }
  }
}
