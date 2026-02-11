export function createShopRepository(db) {
  const stmts = {
    findAll: db.prepare('SELECT * FROM shops ORDER BY name'),
    findBySlug: db.prepare('SELECT * FROM shops WHERE slug = ?'),
    findById: db.prepare('SELECT * FROM shops WHERE id = ?'),
    upsert: db.prepare(`
      INSERT INTO shops (slug, name, url, scraper_key, listing_path, has_ratings, has_subscriptions, is_blog)
      VALUES (@slug, @name, @url, @scraperKey, @listingPath, @hasRatings, @hasSubscriptions, @isBlog)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        url = excluded.url,
        scraper_key = excluded.scraper_key,
        listing_path = excluded.listing_path,
        has_ratings = excluded.has_ratings,
        has_subscriptions = excluded.has_subscriptions,
        is_blog = excluded.is_blog,
        updated_at = datetime('now')
    `)
  }

  return {
    findAll() {
      return stmts.findAll.all()
    },

    findBySlug(slug) {
      return stmts.findBySlug.get(slug) || null
    },

    findById(id) {
      return stmts.findById.get(id) || null
    },

    upsert(shop) {
      const info = stmts.upsert.run({
        slug: shop.slug,
        name: shop.name,
        url: shop.url,
        scraperKey: shop.scraperKey,
        listingPath: shop.listingPath,
        hasRatings: shop.hasRatings ? 1 : 0,
        hasSubscriptions: shop.hasSubscriptions ? 1 : 0,
        isBlog: shop.isBlog ? 1 : 0
      })
      return info.lastInsertRowid || stmts.findBySlug.get(shop.slug).id
    },

    seedFromConfig(shops) {
      const upsertMany = db.transaction((shopList) => {
        for (const shop of shopList) {
          stmts.upsert.run({
            slug: shop.slug,
            name: shop.name,
            url: shop.url,
            scraperKey: shop.scraperKey,
            listingPath: shop.listingPath,
            hasRatings: shop.hasRatings ? 1 : 0,
            hasSubscriptions: shop.hasSubscriptions ? 1 : 0,
            isBlog: shop.isBlog ? 1 : 0
          })
        }
      })
      upsertMany(shops)
    }
  }
}
