/* global loadProducts, renderEmptyState */

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
    const spinner = document.getElementById('search-spinner')
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout)
      if (spinner) spinner.classList.add('active')
      searchTimeout = setTimeout(() => {
        if (spinner) spinner.classList.remove('active')
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
    const result = await api.get('/api/alerts?limit=100')
    const alerts = result.data

    if (alerts.length === 0) {
      container.innerHTML = renderEmptyState('🔔', 'No alerts yet', 'Price drops, new arrivals, and stock changes will appear here after running the monitor.')
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

    // Group alerts by day
    const groupedByDay = new Map()
    for (const a of alerts) {
      const dayKey = a.created_at ? a.created_at.slice(0, 10) : 'unknown'
      if (!groupedByDay.has(dayKey)) {
        groupedByDay.set(dayKey, [])
      }
      groupedByDay.get(dayKey).push(a)
    }

    // Format day header
    function formatDayHeader(dayKey) {
      const today = new Date().toISOString().slice(0, 10)
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      if (dayKey === today) return 'Today'
      if (dayKey === yesterday) return 'Yesterday'
      return new Date(dayKey).toLocaleDateString('sk-SK', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    }

    let html = ''
    for (const [dayKey, dayAlerts] of groupedByDay) {
      html += `<div class="alert-day-group">
        <div class="alert-day-header">${formatDayHeader(dayKey)}</div>
        <div class="alert-day-items alert-timeline">`

      for (const a of dayAlerts) {
        const icon = typeIcons[a.alert_type] || '!'
        const iconClass = a.alert_type.replace(/_/g, '-')
        const time = a.created_at
          ? new Date(a.created_at).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
          : ''

        const shopName = a.shop_name || a.shop_slug || ''
        const imageUrl = a.product_image || ''
        const isClickable = a.product_id != null

        html += `
          <div class="alert-item ${iconClass}-item ${isClickable ? 'clickable' : ''}" ${isClickable ? `data-section="product-detail" data-id="${a.product_id}"` : ''}>
            ${imageUrl
    ? `<img src="${esc(imageUrl)}" alt="" class="alert-image" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : ''
}
            <div class="alert-icon ${iconClass}" ${imageUrl ? 'style="display:none"' : ''}>${icon}</div>
            <div class="alert-content">
              <div class="alert-title">${esc(a.title)}</div>
              <div class="alert-message">${esc(a.message)}</div>
              ${shopName ? `<div class="alert-shop">${esc(shopName)}</div>` : ''}
            </div>
            <div class="alert-time">${time}</div>
          </div>
        `
      }
      html += '</div></div>'
    }

    container.innerHTML = html
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`
  }
}
