import { Router } from 'express'
import { z } from 'zod'
import { createTierCalculator } from '../../scoring/tier-calculator.js'
import { getPriceTier } from '../../scoring/price-tiers.js'
import { classifyFlavor, getFlavorCategories, extractCleanTastingNotes } from '../../scoring/flavor-classifier.js'
import { groupByKey } from '../../utils/group-by.js'
import { mapVariantToDto } from '../../utils/variant-mapper.js'
import { buildShopDiscountMap } from '../../utils/shop-discounts.js'

export function createRecommendationRoutes(productRepo, variantRepo, ratingRepo, badgeRepo, blogReviewRepo, config, shopRepo) {
  const router = Router()
  const calculator = createTierCalculator(config)
  const { priceTiers } = config.scoring

  const recommendationsQuerySchema = z.object({
    top: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(100)).optional(),
    tier: z.enum(['budget', 'midRange', 'premium', 'ultraPremium']).optional(),
    budget: z.string().transform((val) => parseFloat(val)).pipe(z.number().positive()).optional(),
    flavor: z.enum(['chocolate', 'fruity', 'floral', 'nutty', 'sweet', 'spicy']).optional()
  })

  router.get('/flavors', (_req, res) => {
    res.json({ success: true, data: getFlavorCategories() })
  })

  router.get('/', (req, res) => {
    const validation = recommendationsQuerySchema.safeParse(req.query)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors
      })
    }

    const { top = 20, tier, budget, flavor } = validation.data

    let products = productRepo.findAll()

    if (flavor) {
      products = products.filter((p) => {
        const categories = classifyFlavor(p)
        return categories.includes(flavor)
      })
    }

    const tierPricesMap = { budget: [], midRange: [], premium: [], ultraPremium: [], all: [] }
    const contextMap = new Map()
    const ratingMap = new Map()
    const badgeMap = new Map()
    const shopDiscounts = buildShopDiscountMap(shopRepo)

    // Batch fetch all data
    const productIds = products.map((p) => p.id)
    const allVariants = variantRepo.findByProducts(productIds)
    const allRatings = ratingRepo.findLatestByProducts(productIds)
    const allBadges = badgeRepo.findByProducts(productIds)
    const allBlogMatches = blogReviewRepo.findMatchesByProducts(productIds)

    // Build maps for quick lookup
    const variantsMap = groupByKey(allVariants, (v) => v.product_id)
    const ratingsMapById = new Map(allRatings.map((r) => [r.product_id, r]))
    const badgesMapById = groupByKey(allBadges, (b) => b.product_id)
    const blogMatchesMap = groupByKey(allBlogMatches, (m) => m.product_id)

    for (const product of products) {
      const variants = variantsMap.get(product.id) || []
      const rating = ratingsMapById.get(product.id) || null
      const badges = badgesMapById.get(product.id) || []
      const blogMatches = blogMatchesMap.get(product.id) || []
      const blogReview = blogMatches.length > 0 ? blogMatches[0] : null
      const userDiscount = shopDiscounts.get(product.shop_id) || null

      const inStockVariants = variants.filter((v) => v.in_stock && v.price_per_100g)
      const cheapest = [...inStockVariants].sort((a, b) => a.price_per_100g - b.price_per_100g)[0]

      if (cheapest) {
        // Use effective price (with discount) for tier classification
        const discountMultiplier = userDiscount?.percent ? (1 - userDiscount.percent / 100) : 1
        const effectivePrice = cheapest.price_per_100g * discountMultiplier
        const pt = getPriceTier(effectivePrice, priceTiers)
        const tierKey = pt?.key || 'midRange'
        tierPricesMap[tierKey].push(effectivePrice)
        tierPricesMap.all.push(effectivePrice)
      }

      if (rating) ratingMap.set(product.id, rating)
      if (badges.length > 0) badgeMap.set(product.id, badges)

      contextMap.set(product.id, { variants, rating, badges, blogReview, tierPrices: null, userDiscount })
    }

    const enrichedContextMap = new Map()
    for (const [id, ctx] of contextMap) {
      enrichedContextMap.set(id, { ...ctx, tierPrices: tierPricesMap })
    }

    let scored = calculator.scoreAllDiverse(products, enrichedContextMap, 3)

    if (tier) {
      scored = scored.filter((r) => r.priceTierKey === tier)
    }

    if (budget) {
      scored = scored.filter(
        (r) => r.bestVariant?.pricePer100g && r.bestVariant.pricePer100g <= budget
      )
    }

    const results = scored.slice(0, top).map((r) => {
      const rating = ratingMap.get(r.productId)
      const badges = badgeMap.get(r.productId) || []
      const ctx = enrichedContextMap.get(r.productId)
      const variants = (ctx?.variants || []).map(mapVariantToDto)

      const product = products.find((p) => p.id === r.productId)
      const flavorCategories = classifyFlavor(product)
      const cleanNotes = extractCleanTastingNotes(product)
      const reasoning = generateReasoning(r, product, rating, badges, cleanNotes, flavorCategories)
      const userDiscount = shopDiscounts.get(product?.shop_id) || null

      // Check if any in-stock variant is on sale
      const saleVariant = variants.find((v) => v.inStock && v.originalPrice && v.originalPrice > v.price)
      const saleInfo = saleVariant ? {
        percentage: Math.round(((saleVariant.originalPrice - saleVariant.price) / saleVariant.originalPrice) * 100),
        originalPrice: saleVariant.originalPrice,
        salePrice: saleVariant.price
      } : null

      return {
        ...r,
        variants,
        reasoning,
        flavorCategories,
        cleanTastingNotes: cleanNotes,
        saleInfo,
        ratingDetails: rating
          ? {
            averageRating: rating.average_rating,
            outOf: rating.out_of,
            reviewCount: rating.review_count
          }
          : null,
        badges: badges.map((b) => ({ type: b.badge_type, label: b.label })),
        userDiscount
      }
    })

    res.json({
      success: true,
      data: results,
      meta: { total: results.length, allCount: scored.length }
    })
  })

  return router
}

function generateReasoning(scored, product, rating, badges, cleanNotes, flavorCategories) {
  const parts = []
  const bd = scored.breakdown || {}

  // Flavor profile first - this is what people care most about
  if (cleanNotes) {
    parts.push(`Flavor: ${cleanNotes}`)
  } else if (flavorCategories.length > 0) {
    const LABELS = { chocolate: 'chocolate/dark', fruity: 'fruity', floral: 'floral', nutty: 'nutty', sweet: 'sweet/honey', spicy: 'spicy' }
    const labels = flavorCategories.slice(0, 2).map((c) => LABELS[c] || c)
    parts.push(`Profile: ${labels.join(', ')}`)
  }

  // Price with context
  const perKg = scored.bestVariant?.pricePer100g
    ? Math.round(scored.bestVariant.pricePer100g * 10 * 100) / 100
    : null
  if (perKg && bd.priceValue) {
    if (bd.priceValue.score >= 80) {
      parts.push(`Great price at ${perKg} \u20ac/kg for ${scored.priceTier} tier`)
    } else if (bd.priceValue.score >= 50) {
      parts.push(`${perKg} \u20ac/kg (${scored.priceTier})`)
    } else {
      parts.push(`${perKg} \u20ac/kg`)
    }
  }

  // Rating
  if (rating?.average_rating) {
    const stars = rating.average_rating
    const count = rating.review_count
    if (stars >= 4.5 && count >= 5) {
      parts.push(`Highly rated ${stars}/${rating.out_of} (${count} reviews)`)
    } else if (count > 0) {
      parts.push(`${stars}/${rating.out_of} (${count} reviews)`)
    }
  }

  // Origin with character
  if (product?.origin_country) {
    const originScore = bd.originQuality?.score
    const region = product.origin_region ? `, ${product.origin_region}` : ''
    if (originScore >= 90) {
      parts.push(`From ${product.origin_country}${region} \u2013 top-tier specialty origin`)
    } else if (originScore >= 70) {
      parts.push(`Origin: ${product.origin_country}${region}`)
    }
  }

  // Process, variety, altitude - only if interesting
  const details = []
  if (product?.process && !/washed/i.test(product.process)) {
    details.push(product.process + ' processed')
  }
  if (product?.variety) details.push(product.variety)
  if (product?.altitude) details.push(product.altitude)
  if (details.length > 0) {
    parts.push(details.join(', '))
  }

  // Brewing method
  if (product?.brewing_method) {
    parts.push(`Suited for ${product.brewing_method}`)
  }

  // Roast
  if (product?.roast_level) {
    parts.push(`${product.roast_level} roast`)
  }

  if (parts.length === 0) {
    parts.push(`Score ${scored.score}/100 from ${scored.shopName}`)
  }

  return parts.join('. ') + '.'
}
