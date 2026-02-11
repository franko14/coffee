import { now } from '../../utils/date-utils.js'

export function createProductRepository(db) {
  const stmts = {
    findAll: db.prepare(`
      SELECT p.*, s.name as shop_name, s.slug as shop_slug, s.url as shop_url
      FROM products p
      JOIN shops s ON p.shop_id = s.id
      WHERE p.is_active = 1
      ORDER BY p.name
    `),
    findById: db.prepare(`
      SELECT p.*, s.name as shop_name, s.slug as shop_slug, s.url as shop_url
      FROM products p
      JOIN shops s ON p.shop_id = s.id
      WHERE p.id = ?
    `),
    findByShop: db.prepare(`
      SELECT p.*, s.name as shop_name, s.slug as shop_slug, s.url as shop_url
      FROM products p
      JOIN shops s ON p.shop_id = s.id
      WHERE s.slug = ? AND p.is_active = 1
      ORDER BY p.name
    `),
    findBySlug: db.prepare(`
      SELECT * FROM products WHERE shop_id = ? AND slug = ?
    `),
    insert: db.prepare(`
      INSERT INTO products (shop_id, external_id, slug, name, url, image_url, description,
        origin_country, origin_region, process, roast_level, variety, tasting_notes,
        altitude, is_blend, is_decaf, first_seen_at, last_seen_at)
      VALUES (@shopId, @externalId, @slug, @name, @url, @imageUrl, @description,
        @originCountry, @originRegion, @process, @roastLevel, @variety, @tastingNotes,
        @altitude, @isBlend, @isDecaf, @firstSeenAt, @lastSeenAt)
    `),
    update: db.prepare(`
      UPDATE products SET
        name = @name, url = @url, image_url = @imageUrl, description = @description,
        origin_country = @originCountry, origin_region = @originRegion, process = @process,
        roast_level = @roastLevel, variety = @variety, tasting_notes = @tastingNotes,
        altitude = @altitude, is_blend = @isBlend, is_decaf = @isDecaf,
        last_seen_at = @lastSeenAt, is_active = 1, updated_at = datetime('now')
      WHERE id = @id
    `),
    markInactive: db.prepare(`
      UPDATE products SET is_active = 0, updated_at = datetime('now')
      WHERE shop_id = ? AND last_seen_at < ? AND is_active = 1
    `),
    countByShop: db.prepare(`
      SELECT s.slug, s.name, COUNT(p.id) as product_count
      FROM shops s
      LEFT JOIN products p ON p.shop_id = s.id AND p.is_active = 1
      WHERE s.is_blog = 0
      GROUP BY s.id
    `)
  }

  return {
    findAll() {
      return stmts.findAll.all()
    },

    findById(id) {
      return stmts.findById.get(id) || null
    },

    findByShop(shopSlug) {
      return stmts.findByShop.all(shopSlug)
    },

    findBySlug(shopId, slug) {
      return stmts.findBySlug.get(shopId, slug) || null
    },

    upsert(product) {
      const existing = stmts.findBySlug.get(product.shopId, product.slug)
      const timestamp = now()

      if (existing) {
        stmts.update.run({
          ...product,
          id: existing.id,
          lastSeenAt: timestamp
        })
        return { id: existing.id, isNew: false }
      }

      const info = stmts.insert.run({
        ...product,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp
      })
      return { id: Number(info.lastInsertRowid), isNew: true }
    },

    markStaleInactive(shopId, beforeDate) {
      return stmts.markInactive.run(shopId, beforeDate)
    },

    countByShop() {
      return stmts.countByShop.all()
    }
  }
}
