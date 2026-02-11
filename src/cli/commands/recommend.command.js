import chalk from 'chalk'
import { loadConfig } from '../../../config/loader.js'
import { getDb } from '../../db/connection.js'
import { runMigrations } from '../../db/migrator.js'
import { createProductRepository } from '../../db/repositories/product.repository.js'
import { createVariantRepository } from '../../db/repositories/variant.repository.js'
import { createRatingRepository } from '../../db/repositories/rating.repository.js'
import { createBadgeRepository } from '../../db/repositories/badge.repository.js'
import { createBlogReviewRepository } from '../../db/repositories/blog-review.repository.js'
import { createTierCalculator } from '../../scoring/tier-calculator.js'
import { formatPrice, formatPricePer100g } from '../../utils/price-utils.js'

export function registerRecommendCommand(program) {
  program
    .command('recommend')
    .description('Show scored coffee recommendations')
    .option('--budget <maxEur>', 'Maximum price per 100g')
    .option('--top <n>', 'Show top N recommendations', '10')
    .action(async (options) => {
      try {
        const config = loadConfig()
        const db = getDb(config.database.path)
        runMigrations(db)

        const productRepo = createProductRepository(db)
        const variantRepo = createVariantRepository(db)
        const ratingRepo = createRatingRepository(db)
        const badgeRepo = createBadgeRepository(db)
        const blogReviewRepo = createBlogReviewRepository(db)

        const calculator = createTierCalculator(config)
        const products = productRepo.findAll()

        // Build context map for scoring
        const allPrices = []
        const contextMap = new Map()

        for (const product of products) {
          const variants = variantRepo.findByProduct(product.id)
          const rating = ratingRepo.findLatestByProduct(product.id)
          const badges = badgeRepo.findByProduct(product.id)
          const blogMatches = blogReviewRepo.findMatchesByProduct(product.id)
          const blogReview = blogMatches.length > 0 ? blogMatches[0] : null

          for (const v of variants) {
            if (v.price_per_100g) allPrices.push(v.price_per_100g)
          }

          contextMap.set(product.id, {
            variants,
            rating,
            badges,
            blogReview,
            allPricesInTier: [] // populated after collecting all prices
          })
        }

        // Set allPricesInTier for each product
        for (const [, ctx] of contextMap) {
          ctx.allPricesInTier = allPrices
        }

        const scored = calculator.scoreAll(products, contextMap)
        const top = parseInt(options.top, 10)
        const maxBudget = options.budget ? parseFloat(options.budget) : null

        let filtered = scored
        if (maxBudget) {
          filtered = scored.filter(
            (r) => r.bestVariant?.pricePer100g && r.bestVariant.pricePer100g <= maxBudget
          )
        }

        const results = filtered.slice(0, top)

        if (results.length === 0) {
          process.stdout.write(chalk.yellow('No recommendations found. Try scraping first.\n'))
          return
        }

        process.stdout.write(chalk.bold(`\nTop ${results.length} Coffee Recommendations\n`))
        process.stdout.write(chalk.gray('─'.repeat(60) + '\n\n'))

        for (let i = 0; i < results.length; i++) {
          const r = results[i]
          const rank = chalk.bold(`#${i + 1}`)
          const score = chalk.green(`${r.score}/100`)
          const tier = chalk.cyan(`[${r.priceTier}]`)
          const confidence = chalk.gray(`(${Math.round(r.confidence * 100)}% confident)`)

          process.stdout.write(`${rank} ${chalk.bold(r.name)} ${score} ${tier} ${confidence}\n`)
          process.stdout.write(`   ${chalk.gray(r.shopName)} | `)

          if (r.bestVariant) {
            process.stdout.write(`${formatPrice(r.bestVariant.price)} / ${r.bestVariant.weightGrams}g`)
            process.stdout.write(` (${formatPricePer100g(r.bestVariant.pricePer100g)})`)
          }
          process.stdout.write('\n')

          if (r.originCountry) {
            process.stdout.write(`   Origin: ${r.originCountry}`)
            if (r.process) process.stdout.write(` | ${r.process}`)
            if (r.roastLevel) process.stdout.write(` | ${r.roastLevel}`)
            process.stdout.write('\n')
          }

          if (r.url) {
            process.stdout.write(chalk.blue(`   ${r.url}\n`))
          }

          // Score breakdown
          const breakdownParts = Object.entries(r.breakdown)
            .map(([k, v]) => `${k}: ${v.score}`)
            .join(', ')
          if (breakdownParts) {
            process.stdout.write(chalk.gray(`   [${breakdownParts}]\n`))
          }

          process.stdout.write('\n')
        }
      } catch (error) {
        process.stdout.write(chalk.red(`Recommend failed: ${error.message}\n`))
        process.exit(1)
      }
    })
}
