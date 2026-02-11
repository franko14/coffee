/* global api */

let currentTier = ''

async function loadRecommendations(tier) {
  if (tier !== undefined) currentTier = tier
  const container = document.getElementById('recommendations-list')
  container.innerHTML = '<div class="loading">Loading recommendations...</div>'

  try {
    const params = new URLSearchParams({ top: '30' })
    if (currentTier) params.set('tier', currentTier)

    const result = await api.get(`/api/recommendations?${params}`)
    const items = result.data

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state">No recommendations yet. Run <code>coffee scrape</code> first.</div>'
      return
    }

    container.innerHTML = items.map((r, i) => {
      const scoreClass = r.score >= 70 ? 'high' : r.score >= 50 ? 'medium' : 'low'
      const price = r.bestVariant?.price ? `${r.bestVariant.price.toFixed(2)} \u20ac` : 'N/A'
      const per100g = r.bestVariant?.pricePer100g ? `${r.bestVariant.pricePer100g.toFixed(2)} \u20ac/100g` : ''
      const weight = r.bestVariant?.weightGrams ? `${r.bestVariant.weightGrams}g` : ''

      const breakdown = Object.entries(r.breakdown || {})
        .map(([k, v]) => `<span class="breakdown-tag">${k}: ${v.score}</span>`)
        .join('')

      const tags = []
      if (r.originCountry) tags.push(`<span class="tag origin">${r.originCountry}</span>`)
      if (r.priceTier) tags.push(`<span class="tag tier-${tierClass(r.priceTierKey)}">${r.priceTier}</span>`)

      return `
        <div class="rec-card">
          <div class="rec-rank">#${i + 1}</div>
          <div class="rec-name">${esc(r.name)}</div>
          <div class="rec-shop">${esc(r.shopName)}</div>
          <div class="rec-score">
            <div class="score-bar">
              <div class="score-fill ${scoreClass}" style="width: ${r.score}%"></div>
            </div>
            <span class="score-number">${r.score}</span>
          </div>
          <div class="rec-price">${price} / ${weight}</div>
          <div class="rec-price-detail">${per100g}</div>
          <div class="card-meta">${tags.join('')}</div>
          <div class="rec-breakdown">${breakdown}</div>
          ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="rec-link">Buy here &rarr;</a>` : ''}
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
  const btn = e.target.closest('.tier-btn')
  if (btn) {
    document.querySelectorAll('.tier-btn').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    loadRecommendations(btn.dataset.tier)
  }
})

function esc(str) {
  if (!str) return ''
  const d = document.createElement('div')
  d.textContent = str
  return d.innerHTML
}
