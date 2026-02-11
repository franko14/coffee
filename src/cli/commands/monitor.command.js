import chalk from 'chalk'
import { loadConfig } from '../../../config/loader.js'
import { bootstrapDb } from '../../db/bootstrap.js'
import { saveScrapedProducts, saveBlogResults } from '../../db/product-saver.js'
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
        const { repos } = bootstrapDb(config, { seedShops: true })

        const alertEngine = createAlertEngine(repos.alertRepo, config)
        const allAlerts = []

        for (const shopConfig of config.shops) {
          const runId = repos.scrapeRunRepo.start(shopConfig.slug)
          const stats = { productsFound: 0, productsNew: 0, priceChanges: 0, errors: 0, errorMessages: [] }

          try {
            process.stdout.write(chalk.blue(`\nMonitoring ${shopConfig.name}...\n`))

            const scraper = createScraper(shopConfig, config)
            const shop = repos.shopRepo.findBySlug(shopConfig.slug)

            if (shopConfig.isBlog) {
              const result = await scraper.scrape()
              const blogStats = saveBlogResults(result, repos, {
                onDiscountCode(code) {
                  const alert = alertEngine.detectDiscountCode(code)
                  alertEngine.saveAlert(alert)
                  allAlerts.push(alert)
                }
              })
              stats.productsFound = blogStats.productsFound
              stats.errors += blogStats.errors
              stats.errorMessages.push(...blogStats.errorMessages)
            } else {
              const products = await scraper.scrape()
              stats.productsFound = products.length

              const saveStats = saveScrapedProducts(products, shop, repos, {
                onNewProduct(product) {
                  const alert = alertEngine.detectNewProduct(product, shopConfig.slug)
                  alertEngine.saveAlert(alert)
                  allAlerts.push(alert)
                },
                onPriceChange(result, variant, product) {
                  const priceAlerts = alertEngine.detectPriceChanges(
                    result, variant, product, shopConfig.slug
                  )
                  alertEngine.saveAlerts(priceAlerts)
                  allAlerts.push(...priceAlerts)
                },
                onStockChange(result, variant, product) {
                  const stockAlert = alertEngine.detectStockChange(
                    result, variant, product, shopConfig.slug
                  )
                  if (stockAlert) {
                    alertEngine.saveAlert(stockAlert)
                    allAlerts.push(stockAlert)
                  }
                }
              })
              stats.productsNew = saveStats.productsNew
              stats.priceChanges = saveStats.priceChanges
              stats.errors += saveStats.errors
              stats.errorMessages.push(...saveStats.errorMessages)
            }

            repos.scrapeRunRepo.finish({
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
            repos.scrapeRunRepo.finish({
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
