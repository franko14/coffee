import { ALERT_TYPES, SEVERITY } from './alert-types.js'
import { createChildLogger } from '../utils/logger.js'
import { formatPrice, formatPricePer100g } from '../utils/price-utils.js'

const log = createChildLogger('alert-engine')

export function createAlertEngine(alertRepo, config) {
  const alertConfig = config.alerts

  return {
    detectPriceChanges(variantResult, variant, product, shopSlug) {
      const alerts = []

      if (!variantResult.priceChanged || !variantResult.previousPrice) {
        return alerts
      }

      const priceDiff = variant.currentPrice - variantResult.previousPrice
      const percentChange = Math.abs(priceDiff / variantResult.previousPrice) * 100

      if (priceDiff < 0 && percentChange >= (alertConfig.priceDrop.minPercentage || 5)) {
        const alert = {
          alertType: ALERT_TYPES.PRICE_DROP,
          severity: percentChange >= 20 ? SEVERITY.HIGH : alertConfig.priceDrop.severity,
          shopSlug,
          productId: product.id,
          title: `Price drop: ${product.name}`,
          message: `${formatPrice(variantResult.previousPrice)} → ${formatPrice(variant.currentPrice)} (-${percentChange.toFixed(1)}%)`,
          data: {
            previousPrice: variantResult.previousPrice,
            newPrice: variant.currentPrice,
            percentChange: -percentChange,
            weightGrams: variant.weightGrams
          }
        }
        alerts.push(alert)
      }

      if (priceDiff > 0 && percentChange >= 5) {
        const alert = {
          alertType: ALERT_TYPES.PRICE_INCREASE,
          severity: SEVERITY.LOW,
          shopSlug,
          productId: product.id,
          title: `Price increase: ${product.name}`,
          message: `${formatPrice(variantResult.previousPrice)} → ${formatPrice(variant.currentPrice)} (+${percentChange.toFixed(1)}%)`,
          data: {
            previousPrice: variantResult.previousPrice,
            newPrice: variant.currentPrice,
            percentChange,
            weightGrams: variant.weightGrams
          }
        }
        alerts.push(alert)
      }

      return alerts
    },

    detectNewProduct(product, shopSlug) {
      return {
        alertType: ALERT_TYPES.NEW_PRODUCT,
        severity: alertConfig.newProduct.severity,
        shopSlug,
        productId: product.id,
        title: `New product: ${product.name}`,
        message: `${product.name} now available at ${shopSlug}`,
        data: {
          url: product.url,
          originCountry: product.originCountry
        }
      }
    },

    detectDiscountCode(code) {
      const discountText = code.discountPercent
        ? `${code.discountPercent}% off`
        : code.discountFixed
          ? `${formatPrice(code.discountFixed)} off`
          : 'discount'

      return {
        alertType: ALERT_TYPES.DISCOUNT_CODE,
        severity: alertConfig.discountCode.severity,
        shopSlug: code.shopSlug,
        productId: null,
        title: `Discount code: ${code.code}`,
        message: `${code.code} - ${discountText}${code.shopSlug ? ` at ${code.shopSlug}` : ''}`,
        data: {
          code: code.code,
          discountPercent: code.discountPercent,
          discountFixed: code.discountFixed,
          sourceUrl: code.sourceUrl
        }
      }
    },

    detectStockChange(variantResult, variant, product, shopSlug) {
      if (!variantResult.stockChanged) return null

      const wentOutOfStock = variantResult.previousStock === 1 && variant.inStock === 0
      const backInStock = variantResult.previousStock === 0 && variant.inStock === 1

      if (!wentOutOfStock && !backInStock) return null

      return {
        alertType: ALERT_TYPES.STOCK_CHANGE,
        severity: backInStock ? SEVERITY.INFO : SEVERITY.LOW,
        shopSlug,
        productId: product.id,
        title: backInStock ? `Back in stock: ${product.name}` : `Out of stock: ${product.name}`,
        message: backInStock
          ? `${product.name} is available again at ${shopSlug}`
          : `${product.name} is now out of stock at ${shopSlug}`,
        data: {
          previousStock: variantResult.previousStock,
          newStock: variant.inStock,
          weightGrams: variant.weightGrams
        }
      }
    },

    detectProductRemoved(product, shopSlug) {
      return {
        alertType: ALERT_TYPES.PRODUCT_REMOVED,
        severity: SEVERITY.LOW,
        shopSlug,
        productId: product.id,
        title: `Product removed: ${product.name}`,
        message: `${product.name} is no longer available at ${shopSlug}`,
        data: {
          url: product.url
        }
      }
    },

    saveAlert(alert) {
      try {
        alertRepo.create(alert)
        log.info({ type: alert.alertType, title: alert.title }, 'Alert created')
      } catch (error) {
        log.error({ error: error.message, alert: alert.title }, 'Failed to save alert')
      }
    },

    saveAlerts(alerts) {
      for (const alert of alerts) {
        this.saveAlert(alert)
      }
      return alerts.length
    }
  }
}
