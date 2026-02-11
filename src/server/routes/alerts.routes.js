import { Router } from 'express'
import { z } from 'zod'
import { positiveIntParam } from '../validation/schemas.js'

export function createAlertRoutes(alertRepo) {
  const router = Router()

  const alertsQuerySchema = z.object({
    type: z.string().optional(),
    unread: z.enum(['true', 'false']).optional(),
    limit: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1).max(500)).optional()
  })

  router.get('/', (req, res) => {
    const validation = alertsQuerySchema.safeParse(req.query)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors
      })
    }

    const { type, unread, limit = 50 } = validation.data

    let alerts
    if (unread === 'true') {
      alerts = alertRepo.findUnread()
    } else if (type) {
      alerts = alertRepo.findByType(type, limit)
    } else {
      alerts = alertRepo.findAll(limit)
    }

    const unreadCount = alertRepo.countUnread()

    res.json({
      success: true,
      data: alerts,
      meta: { total: alerts.length, unreadCount }
    })
  })

  router.post('/:id/read', (req, res) => {
    const validation = positiveIntParam.safeParse(req.params.id)
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert ID',
        details: validation.error.errors
      })
    }

    alertRepo.markRead(validation.data)
    res.json({ success: true })
  })

  return router
}
