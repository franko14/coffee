/* global loadRecommendations, loadProducts, loadShops, loadAlerts, showProductDetail */

const api = {
  async get(path) {
    const resp = await fetch(path)
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

  if (section === 'recommendations') loadRecommendations()
  if (section === 'products') loadProducts()
  if (section === 'alerts') loadAlerts()
  if (section === 'product-detail' && param) showProductDetail(param)
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-section]')
  if (link) {
    e.preventDefault()
    navigateTo(link.dataset.section, link.dataset.id)
  }
})

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  loadRecommendations()
  loadShops()
  loadAlertBadge()
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
