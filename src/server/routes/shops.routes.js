import { Router } from 'express'

export function createShopRoutes(shopRepo, productRepo) {
  const router = Router()

  router.get('/', (_req, res) => {
    const shops = shopRepo.findAll().filter((s) => !s.is_blog)
    const counts = productRepo.countByShop()
    const countMap = new Map(counts.map((c) => [c.slug, c.product_count]))

    const enriched = shops.map((s) => ({
      ...s,
      productCount: countMap.get(s.slug) || 0
    }))

    res.json({ success: true, data: enriched })
  })

  router.put('/:slug/discount', (req, res) => {
    const { slug } = req.params
    const { discountPercent, discountCode, enabled } = req.body

    const shop = shopRepo.findBySlug(slug)
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' })
    }

    shopRepo.updateDiscount(slug, {
      discountPercent: discountPercent != null ? parseFloat(discountPercent) : null,
      discountCode: discountCode || null,
      enabled: Boolean(enabled)
    })

    res.json({ success: true })
  })

  return router
}
