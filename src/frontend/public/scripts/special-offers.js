/* global api, esc, shopInitials */

async function loadSpecialOffers() {
  const container = document.getElementById('special-offers-list')
  container.innerHTML = '<div class="loading">Loading special offers...</div>'

  try {
    const result = await api.get('/api/products')
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const specials = result.data.filter((p) => {
      // Exclude gift packages, bundles, and accessories
      const nameLower = (p.name || '').toLowerCase()
      if (/darček|gift|krabičk|balíček|sada|set\b|box|luxusn.*krabičk|degustačn/i.test(nameLower)) return false
      if (/balík.*zadarmo|výhodný balík/i.test(nameLower)) return false

      const hasSpecialBadge = (p.badges || []).some((b) => {
        const label = (b.label || '').toLowerCase()
        return label.includes('new') ||
          label.includes('novinka') ||
          label.includes('limited') ||
          label.includes('edition') ||
          label.includes('special')
      })

      const isRecent = p.first_seen_at && p.first_seen_at >= thirtyDaysAgo

      return hasSpecialBadge || isRecent
    })

    if (specials.length === 0) {
      container.innerHTML = '<div class="empty-state">No special offers at the moment.</div>'
      return
    }

    container.innerHTML = specials.map((p) => {
      const perKg = p.pricePerKg ? `${p.pricePerKg.toFixed(2)} \u20ac/kg` : 'N/A'
      const imgSrc = p.image_url || '/images/placeholder-coffee.svg'
      const initials = typeof shopInitials === 'function' ? shopInitials(p.shop_name) : (p.shop_name || '?').slice(0, 2).toUpperCase()

      const tags = []
      if (p.origin_country) tags.push(`<span class="tag origin">${esc(p.origin_country)}</span>`)

      const badgeTags = (p.badges || []).map((b) =>
        `<span class="tag special">${esc(b.label)}</span>`
      ).join('')

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
          </div>
          <div class="card-body">
            <div class="card-header">
              <div class="card-name">${esc(p.name)}</div>
            </div>
            <div class="card-shop">${esc(p.shop_name)}</div>
            <div class="card-price">${perKg}</div>
            ${variantChips ? `<div class="variant-chips">${variantChips}</div>` : ''}
            <div class="card-meta">${tags.join('')}${badgeTags}</div>
          </div>
        </div>
      `
    }).join('')
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`
  }
}
