import pino from 'pino'
import { loadConfig } from '../../config/loader.js'

const isProduction = process.env.NODE_ENV === 'production'

let logger = null

export function getLogger() {
  if (logger) {
    return logger
  }

  const prettyTransport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }

  try {
    const config = loadConfig()
    logger = pino({
      level: config.logging.level,
      ...(isProduction ? {} : { transport: prettyTransport })
    })
  } catch {
    logger = pino({
      level: 'info',
      ...(isProduction ? {} : { transport: prettyTransport })
    })
  }

  return logger
}

export function createChildLogger(name) {
  return getLogger().child({ module: name })
}
