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
import { createScraper } from '../../scrapers/scraper-factory.js'
import { createChildLogger } from '../../utils/logger.js'

const log = createChildLogger('scrape-cmd')

export function registerScrapeCommand(program) {
  program
    .command('scrape')
    .description('Scrape coffee products from shops')
    .option('-s, --shop <slug>', 'Scrape specific shop only')
    .option('--dry-run', 'Preview what would be scraped without saving')
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

        const shopsToScrape = options.shop
          ? config.shops.filter((s) => s.slug === options.shop)
          : config.shops

        if (shopsToScrape.length === 0) {
          process.stdout.write(chalk.red(`Shop "${options.shop}" not found in config.\n`))
          process.exit(1)
        }

        for (const shopConfig of shopsToScrape) {
          const runId = scrapeRunRepo.start(shopConfig.slug)
          const stats = { productsFound: 0, productsNew: 0, priceChanges: 0, errors: 0, errorMessages: [] }

          try {
            process.stdout.write(chalk.blue(`\nScraping ${shopConfig.name}...\n`))

            const scraper = createScraper(shopConfig, config)
            const shop = shopRepo.findBySlug(shopConfig.slug)

            if (shopConfig.isBlog) {
              const result = await scraper.scrape()
              await saveBlogResults(result, blogReviewRepo, discountCodeRepo, stats)
            } else {
              const products = await scraper.scrape()
              stats.productsFound = products.length

              if (options.dryRun) {
                printDryRun(products)
              } else {
                saveProducts(products, shop, productRepo, variantRepo, priceHistoryRepo, ratingRepo, badgeRepo, stats)
              }
            }

            scrapeRunRepo.finish({
              id: runId,
              status: 'success',
              ...stats,
              errorMessages: stats.errorMessages.length > 0 ? stats.errorMessages : null
            })

            printStats(shopConfig.name, stats)
          } catch (error) {
            stats.errors++
            stats.errorMessages.push(error.message)
            scrapeRunRepo.finish({
              id: runId,
              status: 'error',
              ...stats,
              errorMessages: stats.errorMessages
            })
            process.stdout.write(chalk.red(`  Error scraping ${shopConfig.name}: ${error.message}\n`))
            log.error({ shop: shopConfig.slug, error: error.message }, 'Scrape failed')
          }
        }

        process.stdout.write(chalk.green('\nScrape complete.\n'))
      } catch (error) {
        process.stdout.write(chalk.red(`Scrape failed: ${error.message}\n`))
        log.error({ error: error.message }, 'Scrape command failed')
        process.exit(1)
      }
    })
}

function saveProducts(products, shop, productRepo, variantRepo, priceHistoryRepo, ratingRepo, badgeRepo, stats) {
  for (const product of products) {
    try {
      const { id: productId, isNew } = productRepo.upsert({
        ...product,
        shopId: shop.id
      })

      if (isNew) {
        stats.productsNew++
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
      log.error({ product: product.name, error: error.message }, 'Failed to save product')
    }
  }
}

async function saveBlogResults(result, blogReviewRepo, discountCodeRepo, stats) {
  for (const review of result.reviews) {
    try {
      blogReviewRepo.upsert(review)
      stats.productsFound++
    } catch (error) {
      stats.errors++
      stats.errorMessages.push(`Review: ${error.message}`)
    }
  }

  for (const code of result.discountCodes) {
    try {
      discountCodeRepo.upsert(code)
    } catch (error) {
      stats.errors++
      stats.errorMessages.push(`Code: ${error.message}`)
    }
  }
}

function printDryRun(products) {
  for (const product of products) {
    process.stdout.write(`  ${product.name}\n`)
    for (const v of product.variants) {
      const price = v.currentPrice ? `${v.currentPrice.toFixed(2)} €` : 'N/A'
      const weight = v.weightGrams ? `${v.weightGrams}g` : '?g'
      process.stdout.write(`    ${weight} - ${price}\n`)
    }
  }
}

function printStats(shopName, stats) {
  process.stdout.write(chalk.green(`  ${shopName}: `))
  process.stdout.write(`${stats.productsFound} products found, `)
  process.stdout.write(`${stats.productsNew} new, `)
  process.stdout.write(`${stats.priceChanges} price changes`)
  if (stats.errors > 0) {
    process.stdout.write(chalk.yellow(`, ${stats.errors} errors`))
  }
  process.stdout.write('\n')
}
