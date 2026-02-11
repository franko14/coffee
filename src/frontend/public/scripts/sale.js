/* global api, esc, shopInitials */

async function loadSale() {
  const container = document.getElementById('sale-list')
  container.innerHTML = '<div class="loading">Loading sale items...</div>'

  try {
    const result = await api.get('/api/products')

    const onSale = result.data
      .filter((p) => p.discount && p.discount.percentage >= 3)
      .sort((a, b) => b.discount.percentage - a.discount.percentage)

    if (onSale.length === 0) {
      container.innerHTML = '<div class="empty-state">No sale items at the moment. Sales will appear here when shops reduce their prices.</div>'
      return
    }

    container.innerHTML = onSale.map((p) => {
      const d = p.discount
      const perKg = p.pricePerKg ? `${p.pricePerKg.toFixed(2)} \u20ac/kg` : 'N/A'
      const imgSrc = p.image_url || '/images/placeholder-coffee.svg'
      const initials = typeof shopInitials === 'function' ? shopInitials(p.shop_name) : (p.shop_name || '?').slice(0, 2).toUpperCase()
      const savings = (d.oldPrice - d.newPrice).toFixed(2)

      const typeLabels = { sale: '', subscription: 'Sub ', price_drop: '' }
      const prefix = typeLabels[d.type] || ''
      const badgeLabel = `${prefix}-${d.percentage}%`

      const tags = []
      if (p.origin_country) tags.push(`<span class="tag origin">${esc(p.origin_country)}</span>`)
      if (d.type === 'subscription') tags.push(`<span class="tag special">Subscription</span>`)

      // Check if product is out of stock (no in-stock variants)
      const hasInStockVariants = (p.variants || []).some((v) => v.inStock)
      const outOfStockBadge = !hasInStockVariants ? '<div class="out-of-stock-badge">OUT OF STOCK</div>' : ''

      const variantChips = (p.variants || [])
        .filter((v) => v.inStock && v.weightGrams)
        .map((v) => {
          const label = v.weightGrams >= 1000 ? `${v.weightGrams / 1000}kg` : `${v.weightGrams}g`
          return `<span class="variant-chip">${label} ${v.price ? v.price.toFixed(2) + ' \u20ac' : ''}</span>`
        })
        .join('')

      return `
        <div class="product-card ${!hasInStockVariants ? 'out-of-stock' : ''}" data-section="product-detail" data-id="${p.id}">
          <div class="card-image-container">
            <img src="${esc(imgSrc)}" alt="${esc(p.name)}" class="card-image" onerror="this.src='/images/placeholder-coffee.svg'">
            <div class="shop-badge">${esc(initials)}</div>
            ${outOfStockBadge}
            <div class="discount-badge">${badgeLabel}</div>
          </div>
          <div class="card-body">
            <div class="card-header">
              <div class="card-name">${esc(p.name)}</div>
            </div>
            <div class="card-shop">${esc(p.shop_name)}</div>
            <div class="card-price">
              <span class="price-old">${d.oldPrice.toFixed(2)} \u20ac</span>
              <span class="price-new">${perKg}</span>
            </div>
            ${variantChips ? `<div class="variant-chips">${variantChips}</div>` : ''}
            <div class="sale-savings">Save ${savings} \u20ac</div>
            <div class="card-meta">${tags.join('')}</div>
          </div>
        </div>
      `
    }).join('')
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`
  }
}
