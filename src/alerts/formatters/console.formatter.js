import chalk from 'chalk'
import { ALERT_TYPES, SEVERITY } from '../alert-types.js'

const SEVERITY_COLORS = {
  [SEVERITY.CRITICAL]: chalk.bgRed.white,
  [SEVERITY.HIGH]: chalk.red,
  [SEVERITY.INFO]: chalk.blue,
  [SEVERITY.LOW]: chalk.gray
}

const TYPE_ICONS = {
  [ALERT_TYPES.PRICE_DROP]: '↓',
  [ALERT_TYPES.PRICE_INCREASE]: '↑',
  [ALERT_TYPES.NEW_PRODUCT]: '+',
  [ALERT_TYPES.STOCK_CHANGE]: '~',
  [ALERT_TYPES.DISCOUNT_CODE]: '%',
  [ALERT_TYPES.PRODUCT_REMOVED]: '-'
}

export function formatAlertForConsole(alert) {
  const colorFn = SEVERITY_COLORS[alert.severity] || chalk.white
  const icon = TYPE_ICONS[alert.alert_type || alert.alertType] || '!'
  const date = alert.created_at
    ? new Date(alert.created_at).toLocaleString('sk-SK')
    : ''

  return `${colorFn(`[${icon}]`)} ${chalk.bold(alert.title)}\n    ${alert.message}${date ? chalk.gray(`  (${date})`) : ''}`
}

export function formatAlertsForConsole(alerts) {
  if (alerts.length === 0) {
    return chalk.gray('No alerts.')
  }

  return alerts.map(formatAlertForConsole).join('\n')
}
