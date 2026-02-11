export function getPriceTier(pricePer100g, priceTiers) {
  if (pricePer100g == null) return null

  const perKg = pricePer100g * 10

  if (perKg <= priceTiers.budget.maxPerKg) return { key: 'budget', ...priceTiers.budget }
  if (perKg <= priceTiers.midRange.maxPerKg) return { key: 'midRange', ...priceTiers.midRange }
  if (perKg <= priceTiers.premium.maxPerKg) return { key: 'premium', ...priceTiers.premium }
  return { key: 'ultraPremium', ...priceTiers.ultraPremium }
}

export function getPriceValueScore(pricePer100g, allPricesInTier) {
  if (pricePer100g == null || allPricesInTier.length === 0) return null

  const sorted = [...allPricesInTier].sort((a, b) => a - b)
  const rank = sorted.findIndex((p) => p >= pricePer100g)
  const percentile = rank / sorted.length

  // Lower price = higher score (inverse percentile)
  return Math.round((1 - percentile) * 100)
}
