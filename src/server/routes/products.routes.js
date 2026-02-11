import { Router } from 'express'
import { z } from 'zod'
import { positiveIntParam } from '../validation/schemas.js'
import { groupByKey } from '../../utils/group-by.js'
import { mapVariantToDto } from '../../utils/variant-mapper.js'
import { computeDiscount } from '../../utils/discount-calculator.js'
import { selectCheapestVariant, pricePerKgRounded } from '../../utils/price-utils.js'
import { buildShopDiscountMap } from '../../utils/shop-discounts.js'

export function createProductRoutes(productRepo, variantRepo, ratingRepo, badgeRepo, blogReviewRepo, priceHistoryRepo, shopRepo) {
  const router = Router()

  const productsQuerySchema = z.object({
    shop: z.string().optional(),
    origin: z.string().max(100).optional(),
    sort: z.enum(['name', 'price']).optional()
  })

  router.get('/', (req, res) => {
    const validation = productsQuerySchema.safeParse(req.query)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors
      })
    }

    const { shop, origin, sort } = validation.data
    let products = shop
      ? productRepo.findByShop(shop)
      : productRepo.findAll()

    if (origin) {
      products = products.filter((p) =>
        p.origin_country?.toLowerCase().includes(origin.toLowerCase())
      )
    }

    const shopDiscounts = buildShopDiscountMap(shopRepo)

    // Batch fetch all variants and badges
    const productIds = products.map((p) => p.id)
    const allVariants = variantRepo.findByProducts(productIds)
    const allBadges = badgeRepo.findByProducts(productIds)

    const variantsMap = groupByKey(allVariants, (v) => v.product_id)
    const badgesMap = groupByKey(allBadges, (b) => b.product_id)

    const enriched = products.map((p) => {
      const variants = variantsMap.get(p.id) || []
      const badges = badgesMap.get(p.id) || []

      const cheapest = selectCheapestVariant(variants)
      const discount = computeDiscount(cheapest, priceHistoryRepo)
      const userDiscount = shopDiscounts.get(p.shop_id) || null

      return {
        ...p,
        cheapestPrice: cheapest?.current_price || null,
        cheapestPricePer100g: cheapest?.price_per_100g || null,
        cheapestWeight: cheapest?.weight_grams || null,
        pricePerKg: pricePerKgRounded(cheapest?.price_per_100g),
        variants: variants.map(mapVariantToDto),
        variantCount: variants.length,
        badges: badges.map((b) => ({ type: b.badge_type, label: b.label })),
        discount,
        userDiscount
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
    const validation = positiveIntParam.safeParse(req.params.id)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID',
        details: validation.error.errors
      })
    }

    const product = productRepo.findById(validation.data)
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }

    const variants = variantRepo.findByProduct(product.id)
    const rating = ratingRepo.findLatestByProduct(product.id)
    const badges = badgeRepo.findByProduct(product.id)
    const blogMatches = blogReviewRepo.findMatchesByProduct(product.id)

    // Get user discount for this shop
    const shop = shopRepo.findById(product.shop_id)
    const userDiscount = shop && shop.user_discount_enabled && shop.user_discount_percent > 0
      ? { percent: shop.user_discount_percent, code: shop.user_discount_code }
      : null

    res.json({
      success: true,
      data: {
        ...product,
        variants,
        rating,
        badges,
        blogReviews: blogMatches,
        userDiscount
      }
    })
  })

  return router
}
