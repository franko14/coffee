export function createBlogReviewRepository(db) {
  const stmts = {
    findAll: db.prepare('SELECT * FROM blog_reviews ORDER BY scraped_at DESC'),
    findByUrl: db.prepare('SELECT * FROM blog_reviews WHERE source_url = ?'),
    upsert: db.prepare(`
      INSERT INTO blog_reviews (source_url, title, roastery_name, coffee_name,
        cupping_score, agtron, tasting_notes, verdict, published_at)
      VALUES (@sourceUrl, @title, @roasteryName, @coffeeName,
        @cuppingScore, @agtron, @tastingNotes, @verdict, @publishedAt)
      ON CONFLICT(source_url) DO UPDATE SET
        title = excluded.title,
        roastery_name = excluded.roastery_name,
        coffee_name = excluded.coffee_name,
        cupping_score = excluded.cupping_score,
        agtron = excluded.agtron,
        tasting_notes = excluded.tasting_notes,
        verdict = excluded.verdict,
        scraped_at = datetime('now')
    `),
    findMatchesByProduct: db.prepare(`
      SELECT br.*, bpm.confidence, bpm.match_type
      FROM blog_reviews br
      JOIN blog_product_matches bpm ON bpm.blog_review_id = br.id
      WHERE bpm.product_id = ?
      ORDER BY bpm.confidence DESC
    `),
    insertMatch: db.prepare(`
      INSERT INTO blog_product_matches (blog_review_id, product_id, match_type, confidence)
      VALUES (@blogReviewId, @productId, @matchType, @confidence)
      ON CONFLICT(blog_review_id, product_id) DO UPDATE SET
        confidence = excluded.confidence,
        match_type = excluded.match_type
    `)
  }

  return {
    findAll() {
      return stmts.findAll.all()
    },

    findByUrl(url) {
      return stmts.findByUrl.get(url) || null
    },

    upsert(review) {
      const info = stmts.upsert.run(review)
      return info.lastInsertRowid || stmts.findByUrl.get(review.sourceUrl)?.id
    },

    findMatchesByProduct(productId) {
      return stmts.findMatchesByProduct.all(productId)
    },

    insertMatch(match) {
      stmts.insertMatch.run(match)
    }
  }
}
