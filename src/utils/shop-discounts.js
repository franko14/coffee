const CACHE_TTL_MS = 60_000

let cachedMap = null
let cachedAt = 0

export function buildShopDiscountMap(shopRepo) {
  const now = Date.now()
  if (cachedMap && now - cachedAt < CACHE_TTL_MS) {
    return cachedMap
  }

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

  cachedMap = discountMap
  cachedAt = now
  return discountMap
}

export function invalidateShopDiscountCache() {
  cachedMap = null
  cachedAt = 0
}
