import { Router } from 'express'
import { z } from 'zod'
import { invalidateShopDiscountCache } from '../../utils/shop-discounts.js'

export function createShopRoutes(shopRepo, productRepo) {
  const router = Router()

  const discountSchema = z.object({
    discountPercent: z.number().min(0).max(100).nullable().optional(),
    discountCode: z.string().max(50).nullable().optional(),
    enabled: z.boolean()
  })

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

    const validation = discountSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors
      })
    }

    const { discountPercent, discountCode, enabled } = validation.data

    const shop = shopRepo.findBySlug(slug)
    if (!shop) {
      return res.status(404).json({ success: false, error: 'Shop not found' })
    }

    shopRepo.updateDiscount(slug, {
      discountPercent: discountPercent != null ? parseFloat(discountPercent) : null,
      discountCode: discountCode || null,
      enabled: Boolean(enabled)
    })

    invalidateShopDiscountCache()
    res.json({ success: true })
  })

  return router
}
