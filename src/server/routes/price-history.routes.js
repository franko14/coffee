import { Router } from 'express'

export function createPriceHistoryRoutes(priceHistoryRepo) {
  const router = Router()

  router.get('/product/:productId', (req, res) => {
    const history = priceHistoryRepo.findByProduct(parseInt(req.params.productId, 10))
    res.json({ success: true, data: history })
  })

  router.get('/recent', (req, res) => {
    const { limit = '100' } = req.query
    const history = priceHistoryRepo.findRecent(parseInt(limit, 10))
    res.json({ success: true, data: history })
  })

  return router
}
