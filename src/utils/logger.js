import pino from 'pino'
import { loadConfig } from '../../config/loader.js'

let logger = null

export function getLogger() {
  if (logger) {
    return logger
  }

  try {
    const config = loadConfig()
    logger = pino({
      level: config.logging.level,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    })
  } catch {
    logger = pino({
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    })
  }

  return logger
}

export function createChildLogger(name) {
  return getLogger().child({ module: name })
}
