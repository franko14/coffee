import chalk from 'chalk'
import { loadConfig } from '../../../config/loader.js'
import { bootstrapDb } from '../../db/bootstrap.js'
import { formatPrice, formatPricePer100g, getPriceTierLabel } from '../../utils/price-utils.js'
import { groupByKey } from '../../utils/group-by.js'
import { selectCheapestVariant } from '../../utils/price-utils.js'

export function registerListCommand(program) {
  program
    .command('list')
    .description('List all tracked coffee products')
    .option('-s, --shop <slug>', 'Filter by shop')
    .option('--sort <field>', 'Sort by field (price, name, shop)', 'name')
    .option('--tier <tier>', 'Filter by price tier (budget, mid-range, premium, ultra-premium)')
    .action(async (options) => {
      try {
        const config = loadConfig()
        const { repos } = bootstrapDb(config)
        const { productRepo, variantRepo } = repos

        const products = options.shop
          ? productRepo.findByShop(options.shop)
          : productRepo.findAll()

        // Batch-fetch all variants (eliminates N+1)
        const productIds = products.map((p) => p.id)
        const allVariants = variantRepo.findByProducts(productIds)
        const variantsMap = groupByKey(allVariants, (v) => v.product_id)

        const enriched = products.map((p) => {
          const variants = variantsMap.get(p.id) || []
          const cheapest = selectCheapestVariant(variants)

          return {
            ...p,
            variants,
            cheapestPrice: cheapest?.current_price,
            cheapestPricePer100g: cheapest?.price_per_100g,
            cheapestWeight: cheapest?.weight_grams,
            priceTier: cheapest?.price_per_100g
              ? getPriceTierLabel(cheapest.price_per_100g, config.scoring.priceTiers)
              : 'Unknown'
          }
        })

        // Filter by tier
        let filtered = enriched
        if (options.tier) {
          filtered = enriched.filter(
            (p) => p.priceTier.toLowerCase() === options.tier.toLowerCase()
          )
        }

        // Sort
        const sortFn = {
          price: (a, b) => (a.cheapestPricePer100g || 999) - (b.cheapestPricePer100g || 999),
          name: (a, b) => a.name.localeCompare(b.name),
          shop: (a, b) => a.shop_name.localeCompare(b.shop_name) || a.name.localeCompare(b.name)
        }
        filtered.sort(sortFn[options.sort] || sortFn.name)

        if (filtered.length === 0) {
          process.stdout.write(chalk.yellow('No products found. Try scraping first.\n'))
          return
        }

        // Group by shop
        const counts = productRepo.countByShop()
        process.stdout.write(chalk.bold(`\n${filtered.length} coffees tracked\n`))
        for (const c of counts) {
          process.stdout.write(chalk.gray(`  ${c.name}: ${c.product_count}\n`))
        }
        process.stdout.write(chalk.gray('─'.repeat(60) + '\n\n'))

        for (const p of filtered) {
          const price = p.cheapestPrice
            ? `${formatPrice(p.cheapestPrice)} / ${p.cheapestWeight}g`
            : 'N/A'
          const per100g = p.cheapestPricePer100g
            ? formatPricePer100g(p.cheapestPricePer100g)
            : ''
          const tier = chalk.cyan(`[${p.priceTier}]`)

          process.stdout.write(`${chalk.bold(p.name)} ${tier}\n`)
          process.stdout.write(`  ${chalk.gray(p.shop_name)} | ${price} ${per100g}`)
          if (p.origin_country) {
            process.stdout.write(` | ${p.origin_country}`)
          }
          process.stdout.write('\n')
        }
      } catch (error) {
        process.stdout.write(chalk.red(`List failed: ${error.message}\n`))
        process.exit(1)
      }
    })
}
