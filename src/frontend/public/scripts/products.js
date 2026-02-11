/* global api, esc, navigateTo */

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
      const price = p.cheapestPrice ? `${p.cheapestPrice.toFixed(2)} \u20ac` : 'N/A'
      const per100g = p.cheapestPricePer100g ? `${p.cheapestPricePer100g.toFixed(2)} \u20ac/100g` : ''
      const weight = p.cheapestWeight ? `${p.cheapestWeight}g` : ''

      const tags = []
      if (p.origin_country) tags.push(`<span class="tag origin">${esc(p.origin_country)}</span>`)
      if (p.process) tags.push(`<span class="tag process">${esc(p.process)}</span>`)

      return `
        <div class="product-card" data-section="product-detail" data-id="${p.id}">
          <div class="card-header">
            <div class="card-name">${esc(p.name)}</div>
          </div>
          <div class="card-shop">${esc(p.shop_name)}</div>
          <div class="card-price">${price} / ${weight}</div>
          <div class="card-price-detail">${per100g}</div>
          <div class="card-meta">${tags.join('')}</div>
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
