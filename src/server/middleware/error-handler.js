import { createChildLogger } from '../../utils/logger.js'

const log = createChildLogger('error-handler')

export function errorHandler(err, _req, res, _next) {
  log.error({ error: err.message, stack: err.stack }, 'Unhandled error')

  const status = err.status || 500
  const message = status < 500 ? err.message : 'Internal server error'

  res.status(status).json({
    success: false,
    error: message
  })
}
