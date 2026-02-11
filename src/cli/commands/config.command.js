import chalk from 'chalk'
import { validateConfig, loadConfig } from '../../../config/loader.js'
import { getDb } from '../../db/connection.js'
import { runMigrations } from '../../db/migrator.js'
import { createShopRepository } from '../../db/repositories/shop.repository.js'

export function registerConfigCommand(program) {
  const cmd = program
    .command('config')
    .description('Configuration management')

  cmd
    .command('validate')
    .description('Validate configuration file')
    .action(() => {
      const result = validateConfig()

      if (result.success) {
        const config = result.data
        const shopCount = config.shops.filter((s) => !s.isBlog).length
        const blogCount = config.shops.filter((s) => s.isBlog).length

        process.stdout.write(chalk.green('Config is valid!\n'))
        process.stdout.write(`  Shops: ${shopCount}\n`)
        process.stdout.write(`  Blogs: ${blogCount}\n`)
        process.stdout.write(`  Rate limit: ${config.scraping.rateLimitMs}ms\n`)
        process.stdout.write(`  DB path: ${config.database.path}\n`)
      } else {
        process.stdout.write(chalk.red('Config validation failed:\n'))
        for (const issue of result.error.issues) {
          process.stdout.write(chalk.red(`  - ${issue.path.join('.')}: ${issue.message}\n`))
        }
        process.exit(1)
      }
    })

  cmd
    .command('db-migrate')
    .description('Run database migrations')
    .action(() => {
      try {
        const config = loadConfig()
        const db = getDb(config.database.path)
        const applied = runMigrations(db)
        process.stdout.write(chalk.green(`Migrations complete. ${applied} new migration(s) applied.\n`))

        const shopRepo = createShopRepository(db)
        shopRepo.seedFromConfig(config.shops)
        process.stdout.write(chalk.green(`Shops seeded from config.\n`))
      } catch (error) {
        process.stdout.write(chalk.red(`Migration failed: ${error.message}\n`))
        process.exit(1)
      }
    })
}
