import chalk from 'chalk'
import { loadConfig } from '../../../config/loader.js'
import { createApp } from '../../server/app.js'
import { createChildLogger } from '../../utils/logger.js'

const log = createChildLogger('serve-cmd')

export function registerServeCommand(program) {
  program
    .command('serve')
    .description('Start the web server')
    .option('-p, --port <port>', 'Port number')
    .action(async (options) => {
      try {
        const config = loadConfig()
        const port = parseInt(options.port || config.server.port, 10)
        const host = config.server.host

        const app = createApp(config)

        app.listen(port, host, () => {
          process.stdout.write(chalk.green(`\nCoffee Monitor running at http://${host}:${port}\n`))
          process.stdout.write(chalk.gray('Press Ctrl+C to stop\n\n'))
          log.info({ port, host }, 'Server started')
        })
      } catch (error) {
        process.stdout.write(chalk.red(`Server failed: ${error.message}\n`))
        log.error({ error: error.message }, 'Serve command failed')
        process.exit(1)
      }
    })
}
