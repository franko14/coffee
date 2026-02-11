import { Router } from 'express'
import { z } from 'zod'
import { positiveIntParam } from '../validation/schemas.js'
import { groupByKey } from '../../utils/group-by.js'
import { selectCheapestVariant, pricePerKgRounded } from '../../utils/price-utils.js'

export function createPriceHistoryRoutes(priceHistoryRepo, productRepo, variantRepo) {
  const router = Router()

  const limitSchema = z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(500))
  const idsSchema = z.string().transform((val) =>
    val.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id) && id > 0)
  )

  router.get('/product/:productId', (req, res) => {
    const validation = positiveIntParam.safeParse(req.params.productId)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID',
        details: validation.error.errors
      })
    }

    const history = priceHistoryRepo.findByProduct(validation.data)
    res.json({ success: true, data: history })
  })

  router.get('/recent', (req, res) => {
    const validation = limitSchema.safeParse(req.query.limit || '100')
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit parameter',
        details: validation.error.errors
      })
    }

    const history = priceHistoryRepo.findRecent(validation.data)
    res.json({ success: true, data: history })
  })

  router.get('/compare', (req, res) => {
    if (!req.query.ids) {
      return res.json({ success: true, data: [] })
    }

    const validation = idsSchema.safeParse(req.query.ids)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IDs parameter',
        details: validation.error.errors
      })
    }

    const ids = validation.data
    if (ids.length === 0) {
      return res.json({ success: true, data: [] })
    }

    // Batch-fetch products and history (eliminates N+1)
    const products = productRepo ? productRepo.findByIds(ids) : []
    const productMap = new Map(products.map((p) => [p.id, p]))
    const allHistory = priceHistoryRepo.findByProducts(ids)
    const historyMap = groupByKey(allHistory, (h) => h.product_id)

    const results = ids.map((id) => {
      const product = productMap.get(id) || null
      return {
        productId: id,
        name: product?.name || `Product ${id}`,
        shopName: product?.shop_name || '',
        history: historyMap.get(id) || []
      }
    })
    res.json({ success: true, data: results })
  })

  router.get('/scatter', (_req, res) => {
    if (!productRepo || !variantRepo) {
      return res.json({ success: true, data: [] })
    }
    const products = productRepo.findAll()
    const productIds = products.map((p) => p.id)
    const allVariants = variantRepo.findByProducts(productIds)
    const variantsMap = groupByKey(allVariants, (v) => v.product_id)

    const points = products.map((p) => {
      const variants = variantsMap.get(p.id) || []
      const cheapest = selectCheapestVariant(variants)
      if (!cheapest) return null
      return {
        id: p.id,
        name: p.name,
        shopName: p.shop_name,
        shopSlug: p.shop_slug,
        origin: p.origin_country,
        pricePerKg: pricePerKgRounded(cheapest.price_per_100g),
        roastLevel: p.roast_level
      }
    }).filter(Boolean)

    res.json({ success: true, data: points })
  })

  return router
}
