import chalk from 'chalk'
import { loadConfig } from '../../../config/loader.js'
import { bootstrapDb } from '../../db/bootstrap.js'
import { formatAlertsForConsole } from '../../alerts/formatters/console.formatter.js'

export function registerAlertsCommand(program) {
  program
    .command('alerts')
    .description('View and manage alerts')
    .option('--type <type>', 'Filter by alert type')
    .option('--unread', 'Show only unread alerts')
    .option('--mark-read', 'Mark all alerts as read')
    .option('--limit <n>', 'Number of alerts to show', '20')
    .action(async (options) => {
      try {
        const config = loadConfig()
        const { repos } = bootstrapDb(config)
        const { alertRepo } = repos

        if (options.markRead) {
          alertRepo.markAllRead()
          process.stdout.write(chalk.green('All alerts marked as read.\n'))
          return
        }

        let alerts
        if (options.unread) {
          alerts = alertRepo.findUnread()
        } else if (options.type) {
          alerts = alertRepo.findByType(options.type, parseInt(options.limit, 10))
        } else {
          alerts = alertRepo.findAll(parseInt(options.limit, 10))
        }

        const unreadCount = alertRepo.countUnread()
        process.stdout.write(chalk.bold(`Alerts (${unreadCount} unread):\n\n`))
        process.stdout.write(formatAlertsForConsole(alerts) + '\n')
      } catch (error) {
        process.stdout.write(chalk.red(`Alerts failed: ${error.message}\n`))
        process.exit(1)
      }
    })
}
