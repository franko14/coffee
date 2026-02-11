export function calculatePricePer100g(priceEur, weightGrams) {
  if (!priceEur || priceEur <= 0 || !weightGrams || weightGrams <= 0) {
    return null
  }
  return Math.round((priceEur / weightGrams) * 100 * 100) / 100
}

export function formatPrice(priceEur) {
  if (priceEur == null) {
    return 'N/A'
  }
  return `${priceEur.toFixed(2)} €`
}

export function formatPricePer100g(pricePer100g) {
  if (pricePer100g == null) {
    return 'N/A'
  }
  return `${pricePer100g.toFixed(2)} €/100g`
}

export function pricePerKg(pricePer100g) {
  if (pricePer100g == null) {
    return null
  }
  return pricePer100g * 10
}

export function getPriceTierLabel(pricePer100g, priceTiers) {
  const perKg = pricePerKg(pricePer100g)
  if (perKg == null) {
    return 'Unknown'
  }

  if (perKg <= priceTiers.budget.maxPerKg) return priceTiers.budget.label
  if (perKg <= priceTiers.midRange.maxPerKg) return priceTiers.midRange.label
  if (perKg <= priceTiers.premium.maxPerKg) return priceTiers.premium.label
  return priceTiers.ultraPremium.label
}
