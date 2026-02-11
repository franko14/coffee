import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootstrapDb } from '../db/bootstrap.js'
import { createProductRoutes } from './routes/products.routes.js'
import { createShopRoutes } from './routes/shops.routes.js'
import { createRecommendationRoutes } from './routes/recommendations.routes.js'
import { createAlertRoutes } from './routes/alerts.routes.js'
import { createPriceHistoryRoutes } from './routes/price-history.routes.js'
import { errorHandler } from './middleware/error-handler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createApp(config) {
  const app = express()

  const { repos } = bootstrapDb(config, { seedShops: true })
  const { shopRepo, productRepo, variantRepo, priceHistoryRepo, ratingRepo, badgeRepo, blogReviewRepo, alertRepo } = repos

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
        objectSrc: ["'none'"]
      }
    }
  }))

  app.use(cors({
    origin: config.server?.allowedOrigins || true,
    credentials: true
  }))

  app.use('/api/', rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { success: false, error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false
  }))

  app.use(express.json({ limit: '100kb' }))

  // Serve static frontend
  const publicDir = resolve(__dirname, '../frontend/public')
  app.use(express.static(publicDir))

  // API routes
  app.use('/api/products', createProductRoutes(productRepo, variantRepo, ratingRepo, badgeRepo, blogReviewRepo, priceHistoryRepo, shopRepo))
  app.use('/api/shops', createShopRoutes(shopRepo, productRepo))
  app.use('/api/recommendations', createRecommendationRoutes(productRepo, variantRepo, ratingRepo, badgeRepo, blogReviewRepo, config, shopRepo))
  app.use('/api/alerts', createAlertRoutes(alertRepo))
  app.use('/api/price-history', createPriceHistoryRoutes(priceHistoryRepo, productRepo, variantRepo))

  // 404 handler for API routes - prevents SPA fallback returning HTML for missing API endpoints
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found' })
  })

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(resolve(publicDir, 'index.html'))
  })

  app.use(errorHandler)

  return app
}
