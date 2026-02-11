/* global loadRecommendations, loadProducts, loadShops, loadAlerts, showProductDetail, loadSpecialOffers, loadSale, loadCompare, loadAnalytics, loadSettings */

const api = {
  async get(path) {
    const resp = await fetch(path)
    if (!resp.ok) throw new Error(`API error: ${resp.status}`)
    return resp.json()
  },
  async put(path, data) {
    const resp = await fetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!resp.ok) throw new Error(`API error: ${resp.status}`)
    return resp.json()
  }
}

function navigateTo(section, param) {
  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'))
  document.querySelectorAll('.nav-link').forEach((a) => a.classList.remove('active'))

  const target = document.getElementById(section)
  if (target) target.classList.add('active')

  const navLink = document.querySelector(`.nav-link[data-section="${section}"]`)
  if (navLink) navLink.classList.add('active')

  // Update URL hash for refresh persistence
  const hash = param ? `${section}/${param}` : section
  if (window.location.hash !== `#${hash}`) {
    history.replaceState(null, '', `#${hash}`)
  }

  if (section === 'recommendations') loadRecommendations()
  if (section === 'special-offers') loadSpecialOffers()
  if (section === 'sale') loadSale()
  if (section === 'compare') loadCompare()
  if (section === 'products') loadProducts()
  if (section === 'analytics') loadAnalytics()
  if (section === 'alerts') loadAlerts()
  if (section === 'settings') loadSettings()
  if (section === 'product-detail' && param) showProductDetail(param)
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-section]')
  if (link) {
    e.preventDefault()
    navigateTo(link.dataset.section, link.dataset.id)
  }
})

function navigateFromHash() {
  const hash = window.location.hash.slice(1)
  if (!hash) return false
  const parts = hash.split('/')
  const section = parts[0]
  const param = parts[1] || null
  const target = document.getElementById(section)
  if (target) {
    navigateTo(section, param)
    return true
  }
  return false
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  loadShops()
  loadAlertBadge()
  if (!navigateFromHash()) {
    loadRecommendations()
  }
})

window.addEventListener('hashchange', () => {
  navigateFromHash()
})

async function loadAlertBadge() {
  try {
    const result = await api.get('/api/alerts?limit=1')
    const badge = document.getElementById('alert-badge')
    if (result.meta.unreadCount > 0) {
      badge.textContent = result.meta.unreadCount
      badge.classList.remove('hidden')
    }
  } catch {
    // ignore
  }
}
