/* global api, esc, shopInitials, renderVariantChips, renderSkeleton, renderEmptyState */

let currentTier = ''
let currentFlavor = ''

const BREAKDOWN_LABELS = {
  priceValue: 'Price Value',
  rating: 'Rating',
  originQuality: 'Origin',
  blogScore: 'Blog Score',
  freshness: 'Freshness',
  awards: 'Awards',
  subscriptionSavings: 'Sub Savings',
  specialBadges: 'Badges'
}

function renderStars(score, maxScore) {
  const normalized = maxScore > 0 ? (score / maxScore) * 5 : 0
  const full = Math.floor(normalized)
  const half = normalized - full >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return '\u2605'.repeat(full) + (half ? '\u2606' : '') + '\u2606'.repeat(empty)
}

async function loadRecommendations(tier, flavor) {
  if (tier !== undefined) currentTier = tier
  if (flavor !== undefined) currentFlavor = flavor
  const container = document.getElementById('recommendations-list')
  container.innerHTML = renderSkeleton(3)

  try {
    const params = new URLSearchParams({ top: '10' })
    if (currentTier) params.set('tier', currentTier)
    if (currentFlavor) params.set('flavor', currentFlavor)

    const result = await api.get(`/api/recommendations?${params}`)
    const items = result.data

    if (items.length === 0) {
      container.innerHTML = renderEmptyState('🫘', 'No recommendations yet', 'Run coffee scrape to start tracking prices and get personalized recommendations.')
      return
    }

    container.innerHTML = items.map((r, i) => {
      const scoreClass = r.score >= 70 ? 'high' : r.score >= 50 ? 'medium' : 'low'
      const perKg = r.bestVariant?.pricePer100g ? (r.bestVariant.pricePer100g * 10).toFixed(2) : null
      const imgSrc = r.imageUrl || '/images/placeholder-coffee.svg'

      const rd = r.ratingDetails
      const ratingHtml = rd && rd.averageRating != null
        ? `<div class="rating-display">
            <span class="stars">${renderStars(rd.averageRating, rd.outOf)}</span>
            <span class="rating-number">${rd.averageRating.toFixed(1)}</span>
            <span class="rating-count">(${rd.reviewCount} reviews)</span>
          </div>`
        : ''

      const breakdown = Object.entries(r.breakdown || {})
        .map(([k, v]) => {
          const label = BREAKDOWN_LABELS[k] || k
          return `<span class="breakdown-tag" title="${label}: score ${v.score}, weight ${v.weight}%, contribution ${v.contribution}">${label}: ${v.score}</span>`
        })
        .join('')

      const tags = []
      if (r.originCountry) tags.push(`<span class="tag origin">${esc(r.originCountry)}</span>`)
      if (r.priceTier) tags.push(`<span class="tag tier-${tierClass(r.priceTierKey)}">${esc(r.priceTier)}</span>`)

      // Calculate effective price with user's coupon
      const ud = r.userDiscount
      let priceHtml = perKg ? perKg + ' \u20ac/kg' : 'N/A'
      if (ud && perKg) {
        const effectivePerKg = (parseFloat(perKg) * (1 - ud.percent / 100)).toFixed(2)
        priceHtml = `<span class="effective-price">${effectivePerKg} \u20ac/kg</span> <span class="original-price-small">${perKg} \u20ac/kg</span>`
      }

      const variantChips = renderVariantChips(r.variants, ud)

      // Check if product is out of stock (no in-stock variants)
      const hasInStockVariants = (r.variants || []).some((v) => v.inStock)
      const outOfStockBadge = !hasInStockVariants ? '<div class="out-of-stock-badge">OUT OF STOCK</div>' : ''

      // Stacked badges: OUT OF STOCK or SALE on top, coupon below
      const saleBadge = hasInStockVariants && r.saleInfo ? `<div class="sale-badge" title="On sale!">SALE -${r.saleInfo.percentage}%</div>` : ''
      const couponBadge = hasInStockVariants && ud ? `<div class="coupon-badge ${r.saleInfo ? 'with-sale' : ''}" title="Code: ${esc(ud.code || 'N/A')}">-${ud.percent}%</div>` : ''

      return `
        <div class="rec-card ${!hasInStockVariants ? 'out-of-stock' : ''}" data-product-id="${r.productId}">
          <div class="rec-image-container rec-clickable" data-section="product-detail" data-id="${r.productId}">
            <img src="${esc(imgSrc)}" alt="${esc(r.name)}" class="rec-image" onerror="this.src='/images/placeholder-coffee.svg'">
            <div class="shop-badge">${esc(shopInitials(r.shopName))}</div>
            <div class="rec-rank">#${i + 1}</div>
            ${outOfStockBadge}
            ${saleBadge}
            ${couponBadge}
          </div>
          <div class="rec-content">
            <div class="rec-name rec-clickable" data-section="product-detail" data-id="${r.productId}">${esc(r.name)}</div>
            <div class="rec-shop">${esc(r.shopName)}</div>
            ${ratingHtml}
            <div class="rec-score">
              <div class="score-bar">
                <div class="score-fill ${scoreClass}" style="width: ${r.score}%"></div>
              </div>
              <span class="score-number">${r.score}</span>
            </div>
            <div class="rec-price">${priceHtml}</div>
            ${variantChips ? `<div class="variant-chips">${variantChips}</div>` : ''}
            <div class="card-meta">${tags.join('')}</div>
            ${r.reasoning ? `<div class="rec-reasoning">${esc(r.reasoning)}</div>` : ''}
            <div class="rec-breakdown">${breakdown}</div>
            ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="rec-link">Buy here &rarr;</a>` : ''}
          </div>
        </div>
      `
    }).join('')
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error loading recommendations: ${esc(err.message)}</div>`
  }
}

function tierClass(key) {
  const map = { budget: 'budget', midRange: 'mid-range', premium: 'premium', ultraPremium: 'ultra-premium' }
  return map[key] || ''
}

document.addEventListener('click', (e) => {
  const tierBtn = e.target.closest('.tier-btn')
  if (tierBtn) {
    document.querySelectorAll('.tier-btn').forEach((b) => b.classList.remove('active'))
    tierBtn.classList.add('active')
    loadRecommendations(tierBtn.dataset.tier, undefined)
  }

  const flavorBtn = e.target.closest('.flavor-btn')
  if (flavorBtn) {
    document.querySelectorAll('.flavor-btn').forEach((b) => b.classList.remove('active'))
    flavorBtn.classList.add('active')
    loadRecommendations(undefined, flavorBtn.dataset.flavor)
  }

  const toggle = e.target.closest('.scoring-toggle')
  if (toggle) {
    const panel = document.getElementById('scoring-details')
    if (panel) {
      panel.classList.toggle('expanded')
      toggle.textContent = panel.classList.contains('expanded')
        ? 'How we score coffees \u25B2'
        : 'How we score coffees \u25BC'
    }
  }
})
