import { getOriginScore } from './origin-tiers.js'
import { getPriceTier, getPriceValueScore } from './price-tiers.js'
import {
  normalizeRating,
  normalizeFreshness,
  normalizeSubscriptionSavings,
  normalizeBadges,
  normalizeAwards,
  normalizeBlogScore
} from './normalizers.js'

export function createTierCalculator(config) {
  const { weights, priceTiers, freshnessWindowDays, originTiers } = config.scoring

  return {
    score(product, context) {
      const { variants, rating, badges, blogReview, allPricesInTier } = context

      const bestVariant = selectBestVariant(variants)
      if (!bestVariant) {
        return createEmptyResult(product)
      }

      const priceTier = getPriceTier(bestVariant.price_per_100g, priceTiers)

      const factors = {
        priceValue: {
          score: getPriceValueScore(bestVariant.price_per_100g, allPricesInTier || []),
          weight: weights.priceValue,
          available: true
        },
        rating: {
          score: rating
            ? normalizeRating(rating.average_rating, rating.out_of)
            : null,
          weight: weights.rating,
          available: rating?.average_rating != null
        },
        originQuality: {
          score: getOriginScore(product.origin_country, originTiers),
          weight: weights.originQuality,
          available: product.origin_country != null
        },
        blogScore: {
          score: blogReview?.cupping_score
            ? normalizeBlogScore(blogReview.cupping_score)
            : null,
          weight: weights.blogScore,
          available: blogReview?.cupping_score != null
        },
        freshness: {
          score: normalizeFreshness(product.first_seen_at, freshnessWindowDays),
          weight: weights.freshness,
          available: product.first_seen_at != null
        },
        awards: {
          score: normalizeAwards(badges || []),
          weight: weights.awards,
          available: true
        },
        subscriptionSavings: {
          score: normalizeSubscriptionSavings(
            bestVariant.current_price,
            bestVariant.current_subscription_price
          ),
          weight: weights.subscriptionSavings,
          available: bestVariant.current_subscription_price != null
        },
        specialBadges: {
          score: normalizeBadges(badges || []),
          weight: weights.specialBadges,
          available: true
        }
      }

      const availableFactors = Object.entries(factors)
        .filter(([, f]) => f.available && f.score != null)

      const totalAvailableWeight = availableFactors
        .reduce((sum, [, f]) => sum + f.weight, 0)

      let totalScore = 0
      const breakdown = {}

      for (const [name, factor] of availableFactors) {
        const normalizedWeight = totalAvailableWeight > 0
          ? factor.weight / totalAvailableWeight
          : 0
        const contribution = factor.score * normalizedWeight

        totalScore += contribution
        breakdown[name] = {
          score: Math.round(factor.score),
          weight: Math.round(normalizedWeight * 100),
          contribution: Math.round(contribution)
        }
      }

      const confidence = totalAvailableWeight

      return {
        productId: product.id,
        name: product.name,
        shopSlug: product.shop_slug,
        shopName: product.shop_name,
        url: product.url,
        imageUrl: product.image_url,
        score: Math.round(totalScore),
        confidence: Math.round(confidence * 100) / 100,
        priceTier: priceTier?.label || 'Unknown',
        priceTierKey: priceTier?.key || null,
        breakdown,
        bestVariant: {
          id: bestVariant.id,
          weightGrams: bestVariant.weight_grams,
          price: bestVariant.current_price,
          subscriptionPrice: bestVariant.current_subscription_price,
          pricePer100g: bestVariant.price_per_100g,
          inStock: bestVariant.in_stock
        },
        originCountry: product.origin_country,
        process: product.process,
        roastLevel: product.roast_level,
        tastingNotes: product.tasting_notes
      }
    },

    scoreAll(products, contextMap) {
      return products
        .map((p) => {
          const ctx = contextMap.get(p.id) || {}
          return this.score(p, ctx)
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
    }
  }
}

function selectBestVariant(variants) {
  if (!variants || variants.length === 0) return null

  const inStock = variants.filter((v) => v.in_stock)
  const candidates = inStock.length > 0 ? inStock : variants

  return candidates.reduce((best, v) => {
    if (!best) return v
    if (v.price_per_100g && (!best.price_per_100g || v.price_per_100g < best.price_per_100g)) {
      return v
    }
    return best
  }, null)
}

function createEmptyResult(product) {
  return {
    productId: product.id,
    name: product.name,
    shopSlug: product.shop_slug,
    shopName: product.shop_name,
    url: product.url,
    score: 0,
    confidence: 0,
    priceTier: 'Unknown',
    breakdown: {},
    bestVariant: null
  }
}
