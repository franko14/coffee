import { now } from '../../utils/date-utils.js'

const TRACKED_FIELDS = [
  ['origin_country', 'originCountry'],
  ['origin_region', 'originRegion'],
  ['process', 'process'],
  ['roast_level', 'roastLevel'],
  ['variety', 'variety'],
  ['tasting_notes', 'tastingNotes'],
  ['altitude', 'altitude'],
  ['brewing_method', 'brewingMethod']
]

export function createProductRepository(db, { productChangeRepo } = {}) {
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
    findByIds: db.prepare(`
      SELECT p.*, s.name as shop_name, s.slug as shop_slug, s.url as shop_url
      FROM products p
      JOIN shops s ON p.shop_id = s.id
      WHERE p.id IN (SELECT value FROM json_each(?))
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
        altitude, brewing_method, arabica_percentage, is_blend, is_decaf, first_seen_at, last_seen_at)
      VALUES (@shopId, @externalId, @slug, @name, @url, @imageUrl, @description,
        @originCountry, @originRegion, @process, @roastLevel, @variety, @tastingNotes,
        @altitude, @brewingMethod, @arabicaPercentage, @isBlend, @isDecaf, @firstSeenAt, @lastSeenAt)
    `),
    update: db.prepare(`
      UPDATE products SET
        name = @name, url = @url, image_url = @imageUrl, description = @description,
        origin_country = @originCountry, origin_region = @originRegion, process = @process,
        roast_level = @roastLevel, variety = @variety, tasting_notes = @tastingNotes,
        altitude = @altitude, brewing_method = @brewingMethod, arabica_percentage = @arabicaPercentage,
        is_blend = @isBlend, is_decaf = @isDecaf,
        last_seen_at = @lastSeenAt, is_active = 1, deactivated_at = NULL, updated_at = datetime('now')
      WHERE id = @id
    `),
    markInactive: db.prepare(`
      UPDATE products SET is_active = 0, deactivated_at = datetime('now'), updated_at = datetime('now')
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

    findByIds(ids) {
      if (ids.length === 0) return []
      return stmts.findByIds.all(JSON.stringify(ids))
    },

    findByShop(shopSlug) {
      return stmts.findByShop.all(shopSlug)
    },

    findBySlug(shopId, slug) {
      return stmts.findBySlug.get(shopId, slug) || null
    },

    upsert(product) {
      const data = { brewingMethod: null, arabicaPercentage: null, ...product }
      const existing = stmts.findBySlug.get(data.shopId, data.slug)
      const timestamp = now()

      if (existing) {
        if (productChangeRepo) {
          for (const [dbCol, dataKey] of TRACKED_FIELDS) {
            const oldVal = existing[dbCol] || null
            const newVal = data[dataKey] || null
            if (oldVal !== newVal) {
              productChangeRepo.record({
                productId: existing.id,
                fieldName: dbCol,
                oldValue: oldVal,
                newValue: newVal
              })
            }
          }
        }

        stmts.update.run({
          ...data,
          id: existing.id,
          lastSeenAt: timestamp
        })
        return { id: existing.id, isNew: false }
      }

      const info = stmts.insert.run({
        ...data,
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
