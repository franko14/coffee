import express from 'express'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDb } from '../db/connection.js'
import { runMigrations } from '../db/migrator.js'
import { createShopRepository } from '../db/repositories/shop.repository.js'
import { createProductRepository } from '../db/repositories/product.repository.js'
import { createVariantRepository } from '../db/repositories/variant.repository.js'
import { createPriceHistoryRepository } from '../db/repositories/price-history.repository.js'
import { createRatingRepository } from '../db/repositories/rating.repository.js'
import { createBadgeRepository } from '../db/repositories/badge.repository.js'
import { createBlogReviewRepository } from '../db/repositories/blog-review.repository.js'
import { createAlertRepository } from '../db/repositories/alert.repository.js'
import { createProductRoutes } from './routes/products.routes.js'
import { createShopRoutes } from './routes/shops.routes.js'
import { createRecommendationRoutes } from './routes/recommendations.routes.js'
import { createAlertRoutes } from './routes/alerts.routes.js'
import { createPriceHistoryRoutes } from './routes/price-history.routes.js'
import { errorHandler } from './middleware/error-handler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createApp(config) {
  const app = express()

  const db = getDb(config.database.path)
  runMigrations(db)

  const shopRepo = createShopRepository(db)
  shopRepo.seedFromConfig(config.shops)

  const productRepo = createProductRepository(db)
  const variantRepo = createVariantRepository(db)
  const priceHistoryRepo = createPriceHistoryRepository(db)
  const ratingRepo = createRatingRepository(db)
  const badgeRepo = createBadgeRepository(db)
  const blogReviewRepo = createBlogReviewRepository(db)
  const alertRepo = createAlertRepository(db)

  app.use(express.json())

  // Serve static frontend
  const publicDir = resolve(__dirname, '../frontend/public')
  app.use(express.static(publicDir))

  // API routes
  app.use('/api/products', createProductRoutes(productRepo, variantRepo, ratingRepo, badgeRepo, blogReviewRepo, priceHistoryRepo, shopRepo))
  app.use('/api/shops', createShopRoutes(shopRepo, productRepo))
  app.use('/api/recommendations', createRecommendationRoutes(productRepo, variantRepo, ratingRepo, badgeRepo, blogReviewRepo, config, shopRepo))
  app.use('/api/alerts', createAlertRoutes(alertRepo))
  app.use('/api/price-history', createPriceHistoryRoutes(priceHistoryRepo, productRepo, variantRepo))

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(resolve(publicDir, 'index.html'))
  })

  app.use(errorHandler)

  return app
}
