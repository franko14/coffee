import chalk from 'chalk'
import { loadConfig } from '../../../config/loader.js'
import { getDb } from '../../db/connection.js'
import { runMigrations } from '../../db/migrator.js'
import { createShopRepository } from '../../db/repositories/shop.repository.js'
import { createProductRepository } from '../../db/repositories/product.repository.js'
import { createVariantRepository } from '../../db/repositories/variant.repository.js'
import { createPriceHistoryRepository } from '../../db/repositories/price-history.repository.js'
import { createRatingRepository } from '../../db/repositories/rating.repository.js'
import { createBadgeRepository } from '../../db/repositories/badge.repository.js'
import { createBlogReviewRepository } from '../../db/repositories/blog-review.repository.js'
import { createDiscountCodeRepository } from '../../db/repositories/discount-code.repository.js'
import { createScrapeRunRepository } from '../../db/repositories/scrape-run.repository.js'
import { createAlertRepository } from '../../db/repositories/alert.repository.js'
import { createScraper } from '../../scrapers/scraper-factory.js'
import { createAlertEngine } from '../../alerts/alert-engine.js'
import { formatAlertsForConsole } from '../../alerts/formatters/console.formatter.js'
import { writeAlertsToJsonLog } from '../../alerts/formatters/json-log.formatter.js'
import { createChildLogger } from '../../utils/logger.js'

const log = createChildLogger('monitor-cmd')

export function registerMonitorCommand(program) {
  program
    .command('monitor')
    .description('Run scrape and detect changes (price drops, new products)')
    .option('--since <date>', 'Compare against prices since date')
    .action(async (options) => {
      try {
        const config = loadConfig()
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
        const discountCodeRepo = createDiscountCodeRepository(db)
        const scrapeRunRepo = createScrapeRunRepository(db)
        const alertRepo = createAlertRepository(db)

        const alertEngine = createAlertEngine(alertRepo, config)
        const allAlerts = []

        for (const shopConfig of config.shops) {
          const runId = scrapeRunRepo.start(shopConfig.slug)
          const stats = { productsFound: 0, productsNew: 0, priceChanges: 0, errors: 0, errorMessages: [] }

          try {
            process.stdout.write(chalk.blue(`\nMonitoring ${shopConfig.name}...\n`))

            const scraper = createScraper(shopConfig, config)
            const shop = shopRepo.findBySlug(shopConfig.slug)

            if (shopConfig.isBlog) {
              const result = await scraper.scrape()
              for (const review of result.reviews) {
                try { blogReviewRepo.upsert(review); stats.productsFound++ } catch { stats.errors++ }
              }
              for (const code of result.discountCodes) {
                try {
                  discountCodeRepo.upsert(code)
                  const alert = alertEngine.detectDiscountCode(code)
                  alertEngine.saveAlert(alert)
                  allAlerts.push(alert)
                } catch { stats.errors++ }
              }
            } else {
              const products = await scraper.scrape()
              stats.productsFound = products.length

              for (const product of products) {
                try {
                  const { id: productId, isNew } = productRepo.upsert({
                    ...product,
                    shopId: shop.id
                  })

                  if (isNew) {
                    stats.productsNew++
                    const alert = alertEngine.detectNewProduct(
                      { ...product, id: productId },
                      shopConfig.slug
                    )
                    alertEngine.saveAlert(alert)
                    allAlerts.push(alert)
                  }

                  for (const variant of product.variants) {
                    const result = variantRepo.upsert({ ...variant, productId })

                    priceHistoryRepo.record({
                      variantId: result.id,
                      price: variant.currentPrice,
                      subscriptionPrice: variant.currentSubscriptionPrice,
                      pricePer100g: variant.pricePer100g
                    })

                    if (result.priceChanged) {
                      stats.priceChanges++
                      const priceAlerts = alertEngine.detectPriceChanges(
                        result,
                        variant,
                        { ...product, id: productId },
                        shopConfig.slug
                      )
                      alertEngine.saveAlerts(priceAlerts)
                      allAlerts.push(...priceAlerts)
                    }
                  }

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
                }
              }
            }

            scrapeRunRepo.finish({
              id: runId,
              status: 'success',
              ...stats,
              errorMessages: stats.errorMessages.length > 0 ? stats.errorMessages : null
            })

            process.stdout.write(chalk.green(`  ${shopConfig.name}: `))
            process.stdout.write(`${stats.productsFound} products, `)
            process.stdout.write(`${stats.productsNew} new, `)
            process.stdout.write(`${stats.priceChanges} price changes\n`)
          } catch (error) {
            stats.errors++
            stats.errorMessages.push(error.message)
            scrapeRunRepo.finish({
              id: runId,
              status: 'error',
              ...stats,
              errorMessages: stats.errorMessages
            })
            process.stdout.write(chalk.red(`  Error: ${shopConfig.name}: ${error.message}\n`))
          }
        }

        process.stdout.write(`\n${chalk.bold('Alerts:')}\n`)
        process.stdout.write(formatAlertsForConsole(allAlerts) + '\n')

        if (allAlerts.length > 0) {
          const logFile = writeAlertsToJsonLog(allAlerts)
          process.stdout.write(chalk.gray(`\nAlerts saved to ${logFile}\n`))
        }

        process.stdout.write(chalk.green('\nMonitoring complete.\n'))
      } catch (error) {
        process.stdout.write(chalk.red(`Monitor failed: ${error.message}\n`))
        log.error({ error: error.message }, 'Monitor command failed')
        process.exit(1)
      }
    })
}
