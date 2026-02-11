export function computeDiscount(cheapestVariant, priceHistoryRepo) {
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
