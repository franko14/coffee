/* global loadProducts */

document.addEventListener('DOMContentLoaded', () => {
  const shopFilter = document.getElementById('shop-filter')
  const sortFilter = document.getElementById('sort-filter')
  const searchInput = document.getElementById('search-input')

  if (shopFilter) {
    shopFilter.addEventListener('change', () => {
      if (document.getElementById('products').classList.contains('active')) {
        loadProducts()
      }
    })
  }

  if (sortFilter) {
    sortFilter.addEventListener('change', () => {
      if (document.getElementById('products').classList.contains('active')) {
        loadProducts()
      }
    })
  }

  let searchTimeout
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => {
        if (document.getElementById('products').classList.contains('active')) {
          loadProducts()
        }
      }, 300)
    })
  }
})

async function loadAlerts() {
  const container = document.getElementById('alerts-list')
  container.innerHTML = '<div class="loading">Loading alerts...</div>'

  try {
    const result = await api.get('/api/alerts?limit=50')
    const alerts = result.data

    if (alerts.length === 0) {
      container.innerHTML = '<div class="empty-state">No alerts yet. Run <code>coffee monitor</code> to detect changes.</div>'
      return
    }

    const typeIcons = {
      price_drop: '\u2193',
      price_increase: '\u2191',
      new_product: '+',
      stock_change: '~',
      discount_code: '%',
      product_removed: '-'
    }

    container.innerHTML = alerts.map((a) => {
      const icon = typeIcons[a.alert_type] || '!'
      const iconClass = a.alert_type.replace(/_/g, '-')
      const date = a.created_at
        ? new Date(a.created_at).toLocaleDateString('sk-SK', {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        })
        : ''

      return `
        <div class="alert-item">
          <div class="alert-icon ${iconClass}">${icon}</div>
          <div class="alert-content">
            <div class="alert-title">${esc(a.title)}</div>
            <div class="alert-message">${esc(a.message)}</div>
          </div>
          <div class="alert-date">${date}</div>
        </div>
      `
    }).join('')
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`
  }
}
