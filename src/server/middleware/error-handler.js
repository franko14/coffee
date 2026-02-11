import { createChildLogger } from '../../utils/logger.js'

const log = createChildLogger('error-handler')

export function errorHandler(err, _req, res, _next) {
  log.error({ error: err.message, stack: err.stack }, 'Unhandled error')

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  })
}
