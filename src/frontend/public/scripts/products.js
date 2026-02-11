/* global api, esc, renderProductCard, renderSkeleton */

async function loadProducts() {
  const container = document.getElementById('products-list')
  container.innerHTML = renderSkeleton(6)

  try {
    const shop = document.getElementById('shop-filter').value
    const sort = document.getElementById('sort-filter').value
    const search = document.getElementById('search-input').value

    const params = new URLSearchParams({ sort })
    if (shop) params.set('shop', shop)

    const result = await api.get(`/api/products?${params}`, true)
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
      container.innerHTML = renderEmptyState('☕', 'No products found', 'Try adjusting your search or filters to find what you\'re looking for.')
      return
    }

    container.innerHTML = items.map((p) => renderProductCard(p)).join('')
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`
  }
}

async function loadShops() {
  try {
    const result = await api.get('/api/shops', true)
    const selects = [document.getElementById('shop-filter'), document.getElementById('compare-shop-filter')]
    for (const select of selects) {
      if (!select || select.options.length > 1) continue
      for (const shop of result.data) {
        const opt = document.createElement('option')
        opt.value = shop.slug
        opt.textContent = `${shop.name} (${shop.productCount})`
        select.appendChild(opt)
      }
    }
  } catch {
    // Non-critical
  }
}
