import { getDb } from './connection.js'
import { runMigrations } from './migrator.js'
import { createShopRepository } from './repositories/shop.repository.js'
import { createProductRepository } from './repositories/product.repository.js'
import { createVariantRepository } from './repositories/variant.repository.js'
import { createPriceHistoryRepository } from './repositories/price-history.repository.js'
import { createRatingRepository } from './repositories/rating.repository.js'
import { createBadgeRepository } from './repositories/badge.repository.js'
import { createBlogReviewRepository } from './repositories/blog-review.repository.js'
import { createDiscountCodeRepository } from './repositories/discount-code.repository.js'
import { createScrapeRunRepository } from './repositories/scrape-run.repository.js'
import { createAlertRepository } from './repositories/alert.repository.js'
import { createStockChangeRepository } from './repositories/stock-change.repository.js'
import { createProductChangeRepository } from './repositories/product-change.repository.js'

export function bootstrapDb(config, { seedShops = false } = {}) {
  const db = getDb(config.database.path)
  runMigrations(db)

  const shopRepo = createShopRepository(db)

  if (seedShops) {
    shopRepo.seedFromConfig(config.shops)
  }

  const stockChangeRepo = createStockChangeRepository(db)
  const productChangeRepo = createProductChangeRepository(db)

  return {
    db,
    repos: {
      shopRepo,
      productRepo: createProductRepository(db, { productChangeRepo }),
      variantRepo: createVariantRepository(db, { stockChangeRepo }),
      priceHistoryRepo: createPriceHistoryRepository(db),
      ratingRepo: createRatingRepository(db),
      badgeRepo: createBadgeRepository(db),
      blogReviewRepo: createBlogReviewRepository(db),
      discountCodeRepo: createDiscountCodeRepository(db),
      scrapeRunRepo: createScrapeRunRepository(db),
      alertRepo: createAlertRepository(db),
      stockChangeRepo,
      productChangeRepo
    }
  }
}
