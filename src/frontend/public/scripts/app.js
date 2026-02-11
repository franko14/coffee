/* global loadRecommendations, loadProducts, loadShops, loadAlerts, showProductDetail, loadSpecialOffers, loadSale, loadCompare, loadAnalytics, loadSettings, api, renderSkeleton, initScrollToTop, showToast, renderEmptyState */

const _sectionCache = new Set()
const _navLinks = []
const _sections = []

function navigateTo(section, param) {
  if (_sections.length === 0) {
    document.querySelectorAll('.section').forEach((s) => _sections.push(s))
    document.querySelectorAll('.nav-link').forEach((a) => _navLinks.push(a))
  }

  _sections.forEach((s) => s.classList.remove('active'))
  _navLinks.forEach((a) => a.classList.remove('active'))

  const target = document.getElementById(section)
  if (target) target.classList.add('active')
  window.scrollTo({ top: 0, behavior: 'smooth' })

  const navLink = document.querySelector(`.nav-link[data-section="${section}"]`)
  if (navLink) navLink.classList.add('active')

  const hash = param ? `${section}/${param}` : section
  if (window.location.hash !== `#${hash}`) {
    history.replaceState(null, '', `#${hash}`)
  }

  const loaders = {
    recommendations: loadRecommendations,
    'special-offers': loadSpecialOffers,
    sale: loadSale,
    compare: loadCompare,
    products: loadProducts,
    analytics: loadAnalytics,
    alerts: loadAlerts,
    settings: loadSettings
  }

  if (loaders[section]) loaders[section]()
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

document.addEventListener('DOMContentLoaded', () => {
  loadShops()
  loadAlertBadge()
  initScrollToTop()
  loadNavCounts()
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
    // Badge is non-critical
  }
}

async function loadNavCounts() {
  try {
    const result = await api.get('/api/products', true)
    const items = result.data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const specialCount = items.filter((p) => {
      const nameLower = (p.name || '').toLowerCase()
      if (/darček|gift|krabičk|balíček|sada|set\b|box/i.test(nameLower)) return false
      const hasSpecialBadge = (p.badges || []).some((b) => {
        const label = (b.label || '').toLowerCase()
        return label.includes('new') || label.includes('novinka') || label.includes('limited') || label.includes('edition') || label.includes('special')
      })
      return hasSpecialBadge || (p.first_seen_at && p.first_seen_at >= thirtyDaysAgo)
    }).length

    const saleCount = items.filter((p) => p.discount && p.discount.percentage >= 3).length

    const specialLink = document.querySelector('.nav-link[data-section="special-offers"]')
    const saleLink = document.querySelector('.nav-link[data-section="sale"]')
    const productsLink = document.querySelector('.nav-link[data-section="products"]')

    if (specialLink && specialCount > 0) specialLink.innerHTML = `Special Offers <span class="nav-count">${specialCount}</span>`
    if (saleLink && saleCount > 0) saleLink.innerHTML = `Sale <span class="nav-count">${saleCount}</span>`
    if (productsLink) productsLink.innerHTML = `Products <span class="nav-count">${items.length}</span>`
  } catch {
    // Non-critical
  }
}
