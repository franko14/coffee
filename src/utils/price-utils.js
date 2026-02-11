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

export function pricePerKgRounded(pricePer100g) {
  if (pricePer100g == null) {
    return null
  }
  return Math.round(pricePer100g * 10 * 100) / 100
}

export function selectCheapestVariant(variants, { preferInStock = true } = {}) {
  const withPrice = variants.filter((v) => v.price_per_100g)
  if (withPrice.length === 0) return null

  if (preferInStock) {
    const inStock = withPrice.filter((v) => v.in_stock)
    if (inStock.length > 0) {
      return [...inStock].sort((a, b) => a.price_per_100g - b.price_per_100g)[0]
    }
  }

  return [...withPrice].sort((a, b) => a.price_per_100g - b.price_per_100g)[0]
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
