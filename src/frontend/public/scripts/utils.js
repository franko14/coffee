/* Shared utilities */

function esc(str) {
  if (!str) return ''
  const d = document.createElement('div')
  d.textContent = str
  return d.innerHTML
}

function shopInitials(name) {
  if (!name) return '?'
  return name.split(/[\s.]+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatPrice(price) {
  if (price == null) return 'N/A'
  return price.toFixed(2) + ' \u20ac'
}

function formatPricePerKg(pricePer100g) {
  if (!pricePer100g) return 'N/A'
  return (pricePer100g * 10).toFixed(2) + ' \u20ac/kg'
}

function formatWeight(grams) {
  if (!grams) return ''
  return grams >= 1000 ? `${grams / 1000}kg` : `${grams}g`
}

function renderVariantChips(variants, userDiscount) {
  return (variants || [])
    .filter((v) => v.inStock && v.weightGrams)
    .map((v) => {
      const label = formatWeight(v.weightGrams)
      if (userDiscount && v.price) {
        const effectivePrice = (v.price * (1 - userDiscount.percent / 100)).toFixed(2)
        return `<span class="variant-chip">${label} <span class="effective-price">${effectivePrice} \u20ac</span></span>`
      }
      return `<span class="variant-chip">${label} ${v.price ? v.price.toFixed(2) + ' \u20ac' : ''}</span>`
    })
    .join('')
}

function renderProductCard(p, options = {}) {
  const { showDiscount = false, discountBadgeHtml = '', extraMetaHtml = '' } = options
  const perKg = p.pricePerKg ? `${p.pricePerKg.toFixed(2)} \u20ac/kg` : 'N/A'
  const imgSrc = p.image_url || '/images/placeholder-coffee.svg'

  const tags = []
  if (p.origin_country) tags.push(`<span class="tag origin">${esc(p.origin_country)}</span>`)
  if (p.process) tags.push(`<span class="tag process">${esc(p.process)}</span>`)

  const hasInStockVariants = (p.variants || []).some((v) => v.inStock)
  const outOfStockBadge = !hasInStockVariants ? '<div class="out-of-stock-badge">OUT OF STOCK</div>' : ''

  const saleBadge = hasInStockVariants && p.discount
    ? `<div class="sale-badge">-${p.discount.percentage}%</div>`
    : ''

  const ud = p.userDiscount
  let priceHtml = perKg
  if (ud && p.pricePerKg) {
    const effectivePerKg = p.pricePerKg * (1 - ud.percent / 100)
    priceHtml = `<span class="effective-price">${effectivePerKg.toFixed(2)} \u20ac/kg</span> <span class="original-price-small">${perKg}</span>`
  }

  const variantChips = renderVariantChips(p.variants, ud)
  const couponBadge = hasInStockVariants && ud ? `<div class="coupon-badge ${p.discount ? 'with-sale' : ''}" title="Code: ${esc(ud.code || 'N/A')}">-${ud.percent}%</div>` : ''

  return `
    <div class="product-card ${!hasInStockVariants ? 'out-of-stock' : ''}" data-section="product-detail" data-id="${p.id}">
      <div class="card-image-container">
        <img src="${esc(imgSrc)}" alt="${esc(p.name)}" class="card-image" loading="lazy" onerror="this.src='/images/placeholder-coffee.svg'">
        <div class="shop-badge">${esc(shopInitials(p.shop_name))}</div>
        ${outOfStockBadge}
        ${saleBadge}
        ${couponBadge}
        ${discountBadgeHtml}
      </div>
      <div class="card-body">
        <div class="card-name">${esc(p.name)}</div>
        <div class="card-shop">${esc(p.shop_name)}</div>
        <div class="card-price">${showDiscount && p.discount ? `<span class="price-old">${p.discount.oldPrice.toFixed(2)} \u20ac</span> ` : ''}${priceHtml}</div>
        ${variantChips ? `<div class="variant-chips">${variantChips}</div>` : ''}
        <div class="card-meta">${tags.join('')}${extraMetaHtml}</div>
        ${p.tasting_notes ? `<div class="card-tasting-peek">${esc(typeof p.tasting_notes === 'string' ? p.tasting_notes.replace(/[\[\]"]/g, '') : '')}</div>` : ''}
      </div>
    </div>
  `
}

// Simple API response cache
const _apiCache = new Map()
const API_CACHE_TTL = 30000 // 30 seconds

const api = {
  async get(path, useCache = false) {
    if (useCache && _apiCache.has(path)) {
      const cached = _apiCache.get(path)
      if (Date.now() - cached.ts < API_CACHE_TTL) return cached.data
    }
    const resp = await fetch(path)
    if (!resp.ok) throw new Error(`API error: ${resp.status}`)
    const data = await resp.json()
    if (useCache) {
      _apiCache.set(path, { data, ts: Date.now() })
    }
    return data
  },
  async put(path, body) {
    const resp = await fetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!resp.ok) throw new Error(`API error: ${resp.status}`)
    _apiCache.clear() // invalidate cache on writes
    return resp.json()
  },
  invalidateCache() {
    _apiCache.clear()
  }
}

function renderSkeleton(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-image"></div>
      <div class="skeleton-body">
        <div class="skeleton-line wide"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line narrow"></div>
      </div>
    </div>
  `).join('')
}

/* Toast notification system */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container')
  if (!container) return
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  container.appendChild(toast)
  setTimeout(() => {
    toast.classList.add('toast-exit')
    toast.addEventListener('animationend', () => toast.remove())
  }, 3000)
}

/* Scroll to top button */
function initScrollToTop() {
  const btn = document.getElementById('scroll-top-btn')
  if (!btn) return
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400)
  }, { passive: true })
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
}

/* Enhanced empty state renderer */
function renderEmptyState(icon, title, text, cta) {
  return `
    <div class="empty-state">
      <span class="empty-state-icon">${icon}</span>
      <div class="empty-state-title">${esc(title)}</div>
      <div class="empty-state-text">${esc(text)}</div>
      ${cta ? `<a href="${cta.href || '#'}" class="empty-state-cta" ${cta.section ? `data-section="${cta.section}"` : ''}>${esc(cta.label)}</a>` : ''}
    </div>
  `
}
