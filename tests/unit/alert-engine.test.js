import { describe, it, expect, vi } from 'vitest'
import { createAlertEngine } from '../../src/alerts/alert-engine.js'
import { ALERT_TYPES, SEVERITY } from '../../src/alerts/alert-types.js'

const config = {
  alerts: {
    priceDrop: { severity: 'info', minPercentage: 5 },
    newProduct: { severity: 'info' },
    discountCode: { severity: 'info' }
  }
}

const mockAlertRepo = {
  create: vi.fn()
}

describe('createAlertEngine', () => {
  const engine = createAlertEngine(mockAlertRepo, config)

  describe('detectPriceChanges', () => {
    it('detects a price drop', () => {
      const variantResult = { priceChanged: true, previousPrice: 20 }
      const variant = { currentPrice: 15, weightGrams: 250 }
      const product = { id: 1, name: 'Test Coffee' }

      const alerts = engine.detectPriceChanges(variantResult, variant, product, 'test-shop')

      expect(alerts).toHaveLength(1)
      expect(alerts[0].alertType).toBe(ALERT_TYPES.PRICE_DROP)
      expect(alerts[0].data.previousPrice).toBe(20)
      expect(alerts[0].data.newPrice).toBe(15)
    })

    it('sets HIGH severity for drops >= 20%', () => {
      const variantResult = { priceChanged: true, previousPrice: 20 }
      const variant = { currentPrice: 14, weightGrams: 250 }
      const product = { id: 1, name: 'Test Coffee' }

      const alerts = engine.detectPriceChanges(variantResult, variant, product, 'test-shop')

      expect(alerts[0].severity).toBe(SEVERITY.HIGH)
    })

    it('detects a price increase', () => {
      const variantResult = { priceChanged: true, previousPrice: 15 }
      const variant = { currentPrice: 20, weightGrams: 250 }
      const product = { id: 1, name: 'Test Coffee' }

      const alerts = engine.detectPriceChanges(variantResult, variant, product, 'test-shop')

      expect(alerts).toHaveLength(1)
      expect(alerts[0].alertType).toBe(ALERT_TYPES.PRICE_INCREASE)
      expect(alerts[0].severity).toBe(SEVERITY.LOW)
    })

    it('returns empty for no price change', () => {
      const variantResult = { priceChanged: false, previousPrice: null }
      const variant = { currentPrice: 15, weightGrams: 250 }
      const product = { id: 1, name: 'Test Coffee' }

      const alerts = engine.detectPriceChanges(variantResult, variant, product, 'test-shop')

      expect(alerts).toHaveLength(0)
    })

    it('ignores small price changes below threshold', () => {
      const variantResult = { priceChanged: true, previousPrice: 100 }
      const variant = { currentPrice: 97, weightGrams: 250 }
      const product = { id: 1, name: 'Test Coffee' }

      const alerts = engine.detectPriceChanges(variantResult, variant, product, 'test-shop')

      expect(alerts).toHaveLength(0)
    })
  })

  describe('detectNewProduct', () => {
    it('creates a new product alert', () => {
      const product = { id: 1, name: 'New Coffee', url: 'https://test.com', originCountry: 'Ethiopia' }

      const alert = engine.detectNewProduct(product, 'test-shop')

      expect(alert.alertType).toBe(ALERT_TYPES.NEW_PRODUCT)
      expect(alert.title).toContain('New Coffee')
      expect(alert.shopSlug).toBe('test-shop')
    })
  })

  describe('detectDiscountCode', () => {
    it('creates discount code alert with percent', () => {
      const code = { code: 'SAVE10', discountPercent: 10, discountFixed: null, shopSlug: 'test', sourceUrl: 'https://blog.com' }

      const alert = engine.detectDiscountCode(code)

      expect(alert.alertType).toBe(ALERT_TYPES.DISCOUNT_CODE)
      expect(alert.message).toContain('10% off')
    })

    it('creates discount code alert with fixed amount', () => {
      const code = { code: 'FLAT5', discountPercent: null, discountFixed: 5, shopSlug: null, sourceUrl: 'https://blog.com' }

      const alert = engine.detectDiscountCode(code)

      expect(alert.message).toContain('5')
    })

    it('handles generic discount code', () => {
      const code = { code: 'MYSTERY', discountPercent: null, discountFixed: null, shopSlug: null, sourceUrl: 'https://blog.com' }

      const alert = engine.detectDiscountCode(code)

      expect(alert.message).toContain('discount')
    })
  })

  describe('saveAlert', () => {
    it('saves alert via repository', () => {
      mockAlertRepo.create.mockClear()
      const alert = { alertType: 'test', title: 'Test Alert' }

      engine.saveAlert(alert)

      expect(mockAlertRepo.create).toHaveBeenCalledWith(alert)
    })

    it('handles save errors gracefully', () => {
      mockAlertRepo.create.mockImplementationOnce(() => { throw new Error('DB error') })

      expect(() => engine.saveAlert({ alertType: 'test', title: 'Fail' })).not.toThrow()
    })
  })

  describe('saveAlerts', () => {
    it('saves multiple alerts and returns count', () => {
      mockAlertRepo.create.mockClear()
      const alerts = [
        { alertType: 'test', title: 'A' },
        { alertType: 'test', title: 'B' }
      ]

      const count = engine.saveAlerts(alerts)

      expect(count).toBe(2)
      expect(mockAlertRepo.create).toHaveBeenCalledTimes(2)
    })
  })
})
