import { createChildLogger } from '../utils/logger.js'

const log = createChildLogger('product-saver')

export function saveScrapedProducts(products, shop, repos, callbacks = {}) {
  const { productRepo, variantRepo, priceHistoryRepo, ratingRepo, badgeRepo } = repos
  const { onNewProduct, onPriceChange, onStockChange } = callbacks
  const stats = { productsNew: 0, priceChanges: 0, errors: 0, errorMessages: [] }

  for (const product of products) {
    try {
      const { id: productId, isNew } = productRepo.upsert({
        ...product,
        shopId: shop.id
      })

      if (isNew) {
        stats.productsNew++
        if (onNewProduct) {
          onNewProduct({ ...product, id: productId })
        }
      }

      const foundVariantIds = []
      for (const variant of product.variants) {
        const result = variantRepo.upsert({ ...variant, productId })
        foundVariantIds.push(result.id)

        if (variant.currentPrice != null) {
          priceHistoryRepo.record({
            variantId: result.id,
            price: variant.currentPrice,
            subscriptionPrice: variant.currentSubscriptionPrice,
            pricePer100g: variant.pricePer100g
          })
        }

        if (result.priceChanged) {
          stats.priceChanges++
          if (onPriceChange) {
            onPriceChange(result, variant, { ...product, id: productId })
          }
        }

        if (result.stockChanged && onStockChange) {
          onStockChange(result, variant, { ...product, id: productId })
        }
      }

      variantRepo.markMissingAsOutOfStock(productId, foundVariantIds)

      if (product.rating) {
        ratingRepo.record({
          productId,
          source: shop.slug,
          averageRating: product.rating.value,
          outOf: product.rating.bestRating || 5,
          reviewCount: product.rating.count || 0
        })
      }

      if (product.badges.length > 0) {
        badgeRepo.replaceForProduct(productId, product.badges)
      }
    } catch (error) {
      stats.errors++
      stats.errorMessages.push(`${product.name}: ${error.message}`)
      log.error({ product: product.name, error: error.message }, 'Failed to save product')
    }
  }

  return stats
}

export function saveBlogResults(result, repos, callbacks = {}) {
  const { blogReviewRepo, discountCodeRepo } = repos
  const { onDiscountCode } = callbacks
  const stats = { productsFound: 0, errors: 0, errorMessages: [] }

  for (const review of result.reviews) {
    try {
      blogReviewRepo.upsert(review)
      stats.productsFound++
    } catch (error) {
      stats.errors++
      stats.errorMessages.push(`Review: ${error.message}`)
    }
  }

  for (const code of result.discountCodes) {
    try {
      discountCodeRepo.upsert(code)
      if (onDiscountCode) {
        onDiscountCode(code)
      }
    } catch (error) {
      stats.errors++
      stats.errorMessages.push(`Code: ${error.message}`)
    }
  }

  return stats
}
