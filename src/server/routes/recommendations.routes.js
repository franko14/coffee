import { Router } from 'express'
import { createTierCalculator } from '../../scoring/tier-calculator.js'

export function createRecommendationRoutes(productRepo, variantRepo, ratingRepo, badgeRepo, blogReviewRepo, config) {
  const router = Router()
  const calculator = createTierCalculator(config)

  router.get('/', (req, res) => {
    const { top = '20', tier, budget } = req.query

    const products = productRepo.findAll()
    const allPrices = []
    const contextMap = new Map()

    for (const product of products) {
      const variants = variantRepo.findByProduct(product.id)
      const rating = ratingRepo.findLatestByProduct(product.id)
      const badges = badgeRepo.findByProduct(product.id)
      const blogMatches = blogReviewRepo.findMatchesByProduct(product.id)
      const blogReview = blogMatches.length > 0 ? blogMatches[0] : null

      for (const v of variants) {
        if (v.price_per_100g) allPrices.push(v.price_per_100g)
      }

      contextMap.set(product.id, { variants, rating, badges, blogReview, allPricesInTier: [] })
    }

    for (const [, ctx] of contextMap) {
      ctx.allPricesInTier = allPrices
    }

    let scored = calculator.scoreAll(products, contextMap)

    if (tier) {
      scored = scored.filter((r) => r.priceTierKey === tier)
    }

    if (budget) {
      const maxBudget = parseFloat(budget)
      scored = scored.filter(
        (r) => r.bestVariant?.pricePer100g && r.bestVariant.pricePer100g <= maxBudget
      )
    }

    const results = scored.slice(0, parseInt(top, 10))

    res.json({
      success: true,
      data: results,
      meta: { total: results.length, allCount: scored.length }
    })
  })

  return router
}
