import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createChildLogger } from '../../utils/logger.js'

const log = createChildLogger('json-log')

export function writeAlertsToJsonLog(alerts, outputDir = 'data') {
  if (alerts.length === 0) return null

  mkdirSync(outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `alerts-${timestamp}.json`
  const filepath = resolve(outputDir, filename)

  const logEntry = {
    timestamp: new Date().toISOString(),
    alertCount: alerts.length,
    alerts: alerts.map((a) => ({
      type: a.alert_type || a.alertType,
      severity: a.severity,
      title: a.title,
      message: a.message,
      shop: a.shop_slug || a.shopSlug,
      productId: a.product_id || a.productId,
      data: typeof a.data === 'string' ? JSON.parse(a.data) : a.data,
      createdAt: a.created_at || new Date().toISOString()
    }))
  }

  writeFileSync(filepath, JSON.stringify(logEntry, null, 2))
  log.info({ filepath, count: alerts.length }, 'Alerts written to JSON log')

  return filepath
}
