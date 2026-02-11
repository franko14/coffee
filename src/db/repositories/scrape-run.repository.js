export function createScrapeRunRepository(db) {
  const stmts = {
    insert: db.prepare(`
      INSERT INTO scrape_runs (shop_slug, status)
      VALUES (@shopSlug, 'running')
    `),
    finish: db.prepare(`
      UPDATE scrape_runs SET
        status = @status,
        products_found = @productsFound,
        products_new = @productsNew,
        price_changes = @priceChanges,
        errors = @errors,
        error_messages = @errorMessages,
        finished_at = datetime('now')
      WHERE id = @id
    `),
    findRecent: db.prepare(`
      SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT ?
    `),
    findByShop: db.prepare(`
      SELECT * FROM scrape_runs WHERE shop_slug = ? ORDER BY started_at DESC LIMIT ?
    `)
  }

  return {
    start(shopSlug) {
      const info = stmts.insert.run({ shopSlug })
      return Number(info.lastInsertRowid)
    },

    finish(run) {
      stmts.finish.run({
        ...run,
        errorMessages: run.errorMessages ? JSON.stringify(run.errorMessages) : null
      })
    },

    findRecent(limit = 20) {
      return stmts.findRecent.all(limit)
    },

    findByShop(shopSlug, limit = 10) {
      return stmts.findByShop.all(shopSlug, limit)
    }
  }
}
