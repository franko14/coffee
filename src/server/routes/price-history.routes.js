import { Router } from 'express'

export function createPriceHistoryRoutes(priceHistoryRepo, productRepo, variantRepo) {
  const router = Router()

  router.get('/product/:productId', (req, res) => {
    const history = priceHistoryRepo.findByProduct(parseInt(req.params.productId, 10))
    res.json({ success: true, data: history })
  })

  router.get('/recent', (req, res) => {
    const { limit = '100' } = req.query
    const history = priceHistoryRepo.findRecent(parseInt(limit, 10))
    res.json({ success: true, data: history })
  })

  router.get('/compare', (req, res) => {
    const ids = (req.query.ids || '').split(',').map((id) => parseInt(id, 10)).filter(Boolean)
    if (ids.length === 0) {
      return res.json({ success: true, data: [] })
    }
    const results = ids.map((id) => {
      const product = productRepo ? productRepo.findById(id) : null
      const history = priceHistoryRepo.findByProduct(id)
      return {
        productId: id,
        name: product?.name || `Product ${id}`,
        shopName: product?.shop_name || '',
        history
      }
    })
    res.json({ success: true, data: results })
  })

  router.get('/scatter', (_req, res) => {
    if (!productRepo || !variantRepo) {
      return res.json({ success: true, data: [] })
    }
    const products = productRepo.findAll()
    const points = products.map((p) => {
      const variants = variantRepo.findByProduct(p.id)
      const cheapest = variants
        .filter((v) => v.price_per_100g && v.in_stock)
        .sort((a, b) => a.price_per_100g - b.price_per_100g)[0]

      if (!cheapest) return null
      return {
        id: p.id,
        name: p.name,
        shopName: p.shop_name,
        shopSlug: p.shop_slug,
        origin: p.origin_country,
        pricePerKg: Math.round(cheapest.price_per_100g * 10 * 100) / 100,
        roastLevel: p.roast_level
      }
    }).filter(Boolean)

    res.json({ success: true, data: points })
  })

  return router
}
