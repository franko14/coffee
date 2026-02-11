import { Router } from 'express'

export function createProductRoutes(productRepo, variantRepo, ratingRepo, badgeRepo, blogReviewRepo) {
  const router = Router()

  router.get('/', (req, res) => {
    const { shop, origin, sort } = req.query
    let products = shop
      ? productRepo.findByShop(shop)
      : productRepo.findAll()

    if (origin) {
      products = products.filter((p) =>
        p.origin_country?.toLowerCase().includes(origin.toLowerCase())
      )
    }

    const enriched = products.map((p) => {
      const variants = variantRepo.findByProduct(p.id)
      const cheapest = variants
        .filter((v) => v.price_per_100g && v.in_stock)
        .sort((a, b) => a.price_per_100g - b.price_per_100g)[0]

      return {
        ...p,
        cheapestPrice: cheapest?.current_price || null,
        cheapestPricePer100g: cheapest?.price_per_100g || null,
        cheapestWeight: cheapest?.weight_grams || null,
        variantCount: variants.length
      }
    })

    if (sort === 'price') {
      enriched.sort((a, b) => (a.cheapestPricePer100g || 999) - (b.cheapestPricePer100g || 999))
    } else if (sort === 'name') {
      enriched.sort((a, b) => a.name.localeCompare(b.name))
    }

    res.json({ success: true, data: enriched, meta: { total: enriched.length } })
  })

  router.get('/:id', (req, res) => {
    const product = productRepo.findById(parseInt(req.params.id, 10))
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }

    const variants = variantRepo.findByProduct(product.id)
    const rating = ratingRepo.findLatestByProduct(product.id)
    const badges = badgeRepo.findByProduct(product.id)
    const blogMatches = blogReviewRepo.findMatchesByProduct(product.id)

    res.json({
      success: true,
      data: {
        ...product,
        variants,
        rating,
        badges,
        blogReviews: blogMatches
      }
    })
  })

  return router
}
