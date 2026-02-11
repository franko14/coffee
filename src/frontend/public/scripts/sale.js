/* global api, esc, renderProductCard, renderSkeleton */

async function loadSale() {
  const container = document.getElementById('sale-list')
  container.innerHTML = renderSkeleton(4)

  try {
    const result = await api.get('/api/products', true)
    const onSale = result.data
      .filter((p) => p.discount && p.discount.percentage >= 3)
      .sort((a, b) => b.discount.percentage - a.discount.percentage)

    if (onSale.length === 0) {
      container.innerHTML = renderEmptyState('🏷️', 'No sales at the moment', 'Price drops and subscription deals will show up here when available.', { label: 'View recommendations', section: 'recommendations', href: '#recommendations' })
      return
    }

    container.innerHTML = onSale.map((p) => {
      const d = p.discount
      const savings = (d.oldPrice - d.newPrice).toFixed(2)
      const typeLabels = { sale: '', subscription: 'Sub ', price_drop: '' }
      const prefix = typeLabels[d.type] || ''
      const badgeLabel = `${prefix}-${d.percentage}%`

      const extraMeta = d.type === 'subscription' ? '<span class="tag special">Subscription</span>' : ''
      const discountBadge = `<div class="discount-badge">${badgeLabel}</div>`

      return renderProductCard(p, {
        showDiscount: true,
        discountBadgeHtml: discountBadge,
        extraMetaHtml: `${extraMeta}<span class="sale-savings">Save ${savings} \u20ac</span>`
      })
    }).join('')
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`
  }
}
