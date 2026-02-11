#!/usr/bin/env node

import { Command } from 'commander'
import { registerScrapeCommand } from './commands/scrape.command.js'
import { registerMonitorCommand } from './commands/monitor.command.js'
import { registerListCommand } from './commands/list.command.js'
import { registerRecommendCommand } from './commands/recommend.command.js'
import { registerAlertsCommand } from './commands/alerts.command.js'
import { registerServeCommand } from './commands/serve.command.js'
import { registerConfigCommand } from './commands/config.command.js'

const program = new Command()

program
  .name('coffee')
  .description('Coffee price monitoring system for Slovak specialty roasteries')
  .version('1.0.0')

registerConfigCommand(program)
registerScrapeCommand(program)
registerMonitorCommand(program)
registerListCommand(program)
registerRecommendCommand(program)
registerAlertsCommand(program)
registerServeCommand(program)

program.parse()
