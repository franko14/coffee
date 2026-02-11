import { Router } from 'express'

export function createAlertRoutes(alertRepo) {
  const router = Router()

  router.get('/', (req, res) => {
    const { type, unread, limit = '50' } = req.query

    let alerts
    if (unread === 'true') {
      alerts = alertRepo.findUnread()
    } else if (type) {
      alerts = alertRepo.findByType(type, parseInt(limit, 10))
    } else {
      alerts = alertRepo.findAll(parseInt(limit, 10))
    }

    const unreadCount = alertRepo.countUnread()

    res.json({
      success: true,
      data: alerts,
      meta: { total: alerts.length, unreadCount }
    })
  })

  router.post('/:id/read', (req, res) => {
    alertRepo.markRead(parseInt(req.params.id, 10))
    res.json({ success: true })
  })

  return router
}
