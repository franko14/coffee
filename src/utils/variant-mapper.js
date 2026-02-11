import { pricePerKgRounded } from './price-utils.js'

export function mapVariantToDto(v) {
  return {
    weightGrams: v.weight_grams,
    price: v.current_price,
    pricePer100g: v.price_per_100g,
    pricePerKg: pricePerKgRounded(v.price_per_100g),
    inStock: v.in_stock,
    grind: v.grind,
    label: v.label,
    originalPrice: v.original_price,
    subscriptionPrice: v.current_subscription_price
  }
}
