import { Router } from 'express'

export function createProductRoutes(productRepo, variantRepo, ratingRepo, badgeRepo, blogReviewRepo, priceHistoryRepo, shopRepo) {
  const router = Router()

  // Build a map of shop discounts for quick lookup
  function getShopDiscounts() {
    const shops = shopRepo.findAll()
    const discountMap = new Map()
    for (const shop of shops) {
      if (shop.user_discount_enabled && shop.user_discount_percent > 0) {
        discountMap.set(shop.id, {
          percent: shop.user_discount_percent,
          code: shop.user_discount_code
        })
      }
    }
    return discountMap
  }

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

    const shopDiscounts = getShopDiscounts()

    const enriched = products.map((p) => {
      const variants = variantRepo.findByProduct(p.id)
      const badges = badgeRepo.findByProduct(p.id)

      // Prefer in-stock variants, fall back to out-of-stock if none available
      const variantsWithPrice = variants.filter((v) => v.price_per_100g)
      const inStockVariants = variantsWithPrice.filter((v) => v.in_stock)
      const cheapest = inStockVariants.length > 0
        ? inStockVariants.sort((a, b) => a.price_per_100g - b.price_per_100g)[0]
        : variantsWithPrice.sort((a, b) => a.price_per_100g - b.price_per_100g)[0]

      const discount = computeDiscount(cheapest, priceHistoryRepo)
      const userDiscount = shopDiscounts.get(p.shop_id) || null

      return {
        ...p,
        cheapestPrice: cheapest?.current_price || null,
        cheapestPricePer100g: cheapest?.price_per_100g || null,
        cheapestWeight: cheapest?.weight_grams || null,
        pricePerKg: cheapest?.price_per_100g ? Math.round(cheapest.price_per_100g * 10 * 100) / 100 : null,
        variants: variants.map((v) => ({
          weightGrams: v.weight_grams,
          price: v.current_price,
          pricePer100g: v.price_per_100g,
          pricePerKg: v.price_per_100g ? Math.round(v.price_per_100g * 10 * 100) / 100 : null,
          inStock: v.in_stock,
          grind: v.grind,
          label: v.label,
          originalPrice: v.original_price
        })),
        variantCount: variants.length,
        badges: (badges || []).map((b) => ({ type: b.badge_type, label: b.label })),
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
    const product = productRepo.findById(parseInt(req.params.id, 10))
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

function computeDiscount(cheapestVariant, priceHistoryRepo) {
  if (!cheapestVariant) return null

  const currentPrice = cheapestVariant.current_price
  if (!currentPrice) return null

  // Check original price from shop (WooCommerce sale price vs regular price)
  const originalPrice = cheapestVariant.original_price
  if (originalPrice && originalPrice > currentPrice) {
    const percentage = Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    if (percentage >= 3) {
      return { percentage, oldPrice: originalPrice, newPrice: currentPrice, type: 'sale' }
    }
  }

  // Check price history drops
  if (priceHistoryRepo) {
    try {
      const history = priceHistoryRepo.findByVariant(cheapestVariant.id)
      if (history.length >= 2) {
        const oldest = history[history.length - 1]
        const oldPrice = oldest.price

        if (oldPrice && oldPrice > currentPrice) {
          const percentage = Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
          if (percentage >= 3) {
            return { percentage, oldPrice, newPrice: currentPrice, type: 'price_drop' }
          }
        }
      }
    } catch {
      // continue to subscription check
    }
  }

  // Check subscription savings
  const subPrice = cheapestVariant.current_subscription_price
  if (subPrice && subPrice < currentPrice) {
    const percentage = Math.round(((currentPrice - subPrice) / currentPrice) * 100)
    if (percentage >= 3) {
      return { percentage, oldPrice: currentPrice, newPrice: subPrice, type: 'subscription' }
    }
  }

  return null
}
