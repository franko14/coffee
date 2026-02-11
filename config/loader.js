import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { configSchema } from './config.schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_CONFIG_PATH = resolve(__dirname, 'default.yaml')

let cachedConfig = null

export function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  if (cachedConfig) {
    return cachedConfig
  }

  const raw = readFileSync(configPath, 'utf8')
  const parsed = yaml.load(raw)
  const result = configSchema.safeParse(parsed)

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
    )
    throw new Error(`Config validation failed:\n${errors.join('\n')}`)
  }

  cachedConfig = result.data
  return cachedConfig
}

export function validateConfig(configPath = DEFAULT_CONFIG_PATH) {
  const raw = readFileSync(configPath, 'utf8')
  const parsed = yaml.load(raw)
  return configSchema.safeParse(parsed)
}

export function clearConfigCache() {
  cachedConfig = null
}
