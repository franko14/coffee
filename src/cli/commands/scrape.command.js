import chalk from 'chalk'
import { loadConfig } from '../../../config/loader.js'
import { bootstrapDb } from '../../db/bootstrap.js'
import { saveScrapedProducts, saveBlogResults } from '../../db/product-saver.js'
import { createScraper } from '../../scrapers/scraper-factory.js'
import { createChildLogger } from '../../utils/logger.js'
import { now } from '../../utils/date-utils.js'

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
        const { repos } = bootstrapDb(config, { seedShops: true })

        const shopsToScrape = options.shop
          ? config.shops.filter((s) => s.slug === options.shop)
          : config.shops

        if (shopsToScrape.length === 0) {
          process.stdout.write(chalk.red(`Shop "${options.shop}" not found in config.\n`))
          process.exit(1)
        }

        for (const shopConfig of shopsToScrape) {
          const runId = repos.scrapeRunRepo.start(shopConfig.slug)
          const stats = { productsFound: 0, productsNew: 0, priceChanges: 0, errors: 0, errorMessages: [] }

          try {
            process.stdout.write(chalk.blue(`\nScraping ${shopConfig.name}...\n`))

            const scraper = createScraper(shopConfig, config)
            const shop = repos.shopRepo.findBySlug(shopConfig.slug)

            if (shopConfig.isBlog) {
              const result = await scraper.scrape()
              const blogStats = saveBlogResults(result, repos)
              stats.productsFound = blogStats.productsFound
              stats.errors += blogStats.errors
              stats.errorMessages.push(...blogStats.errorMessages)
            } else {
              const scrapeStartTimestamp = now()
              const products = await scraper.scrape()
              stats.productsFound = products.length

              if (options.dryRun) {
                printDryRun(products)
              } else {
                const saveStats = saveScrapedProducts(products, shop, repos)
                stats.productsNew = saveStats.productsNew
                stats.priceChanges = saveStats.priceChanges
                stats.errors += saveStats.errors
                stats.errorMessages.push(...saveStats.errorMessages)
                repos.variantRepo.markStaleProductsOutOfStock(shop.id, scrapeStartTimestamp)
              }
            }

            repos.scrapeRunRepo.finish({
              id: runId,
              status: 'success',
              ...stats,
              errorMessages: stats.errorMessages.length > 0 ? stats.errorMessages : null
            })

            printStats(shopConfig.name, stats)
          } catch (error) {
            stats.errors++
            stats.errorMessages.push(error.message)
            repos.scrapeRunRepo.finish({
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
