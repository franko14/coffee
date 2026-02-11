/* global api, esc, navigateTo */

function shopInitials(name) {
  if (!name) return '?'
  return name.split(/[\s.]+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

async function loadProducts() {
  const container = document.getElementById('products-list')
  container.innerHTML = '<div class="loading">Loading products...</div>'

  try {
    const shop = document.getElementById('shop-filter').value
    const sort = document.getElementById('sort-filter').value
    const search = document.getElementById('search-input').value

    const params = new URLSearchParams({ sort })
    if (shop) params.set('shop', shop)

    const result = await api.get(`/api/products?${params}`)
    let items = result.data

    if (search) {
      const q = search.toLowerCase()
      items = items.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.origin_country || '').toLowerCase().includes(q) ||
        (p.shop_name || '').toLowerCase().includes(q)
      )
    }

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state">No products found.</div>'
      return
    }

    container.innerHTML = items.map((p) => {
      const perKg = p.pricePerKg ? `${p.pricePerKg.toFixed(2)} \u20ac/kg` : 'N/A'
      const imgSrc = p.image_url || '/images/placeholder-coffee.svg'

      const tags = []
      if (p.origin_country) tags.push(`<span class="tag origin">${esc(p.origin_country)}</span>`)
      if (p.process) tags.push(`<span class="tag process">${esc(p.process)}</span>`)

      // Check if product is out of stock (no in-stock variants)
      const hasInStockVariants = (p.variants || []).some((v) => v.inStock)
      const outOfStockBadge = !hasInStockVariants ? '<div class="out-of-stock-badge">OUT OF STOCK</div>' : ''

      // Stacked badges: OUT OF STOCK or SALE on top (red), coupon below (green)
      const saleBadge = hasInStockVariants && p.discount
        ? `<div class="sale-badge">SALE -${p.discount.percentage}%</div>`
        : ''

      // Calculate effective price with user's coupon
      const ud = p.userDiscount
      let priceHtml = perKg
      if (ud && p.pricePerKg) {
        const effectivePerKg = p.pricePerKg * (1 - ud.percent / 100)
        priceHtml = `<span class="effective-price">${effectivePerKg.toFixed(2)} \u20ac/kg</span> <span class="original-price-small">${perKg}</span>`
      }

      const variantChips = (p.variants || [])
        .filter((v) => v.inStock && v.weightGrams)
        .map((v) => {
          const label = v.weightGrams >= 1000 ? `${v.weightGrams / 1000}kg` : `${v.weightGrams}g`
          if (ud && v.price) {
            const effectivePrice = v.price * (1 - ud.percent / 100)
            return `<span class="variant-chip">${label} <span class="effective-price">${effectivePrice.toFixed(2)} \u20ac</span></span>`
          }
          return `<span class="variant-chip">${label} ${v.price ? v.price.toFixed(2) + ' \u20ac' : ''}</span>`
        })
        .join('')

      const couponBadge = hasInStockVariants && ud ? `<div class="coupon-badge ${p.discount ? 'with-sale' : ''}" title="Code: ${esc(ud.code || 'N/A')}">-${ud.percent}%</div>` : ''

      return `
        <div class="product-card ${!hasInStockVariants ? 'out-of-stock' : ''}" data-section="product-detail" data-id="${p.id}">
          <div class="card-image-container">
            <img src="${esc(imgSrc)}" alt="${esc(p.name)}" class="card-image" onerror="this.src='/images/placeholder-coffee.svg'">
            <div class="shop-badge">${esc(shopInitials(p.shop_name))}</div>
            ${outOfStockBadge}
            ${saleBadge}
            ${couponBadge}
          </div>
          <div class="card-body">
            <div class="card-header">
              <div class="card-name">${esc(p.name)}</div>
            </div>
            <div class="card-shop">${esc(p.shop_name)}</div>
            <div class="card-price">${priceHtml}</div>
            ${variantChips ? `<div class="variant-chips">${variantChips}</div>` : ''}
            <div class="card-meta">${tags.join('')}</div>
          </div>
        </div>
      `
    }).join('')
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`
  }
}

async function loadShops() {
  try {
    const result = await api.get('/api/shops')
    const select = document.getElementById('shop-filter')
    for (const shop of result.data) {
      const opt = document.createElement('option')
      opt.value = shop.slug
      opt.textContent = `${shop.name} (${shop.productCount})`
      select.appendChild(opt)
    }
  } catch {
    // ignore
  }
}
