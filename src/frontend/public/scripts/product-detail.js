/* global api, esc, drawPriceChart, renderEmptyState */

async function showProductDetail(productId) {
  const container = document.getElementById('detail-content')
  container.innerHTML = '<div class="loading">Loading...</div>'

  try {
    const result = await api.get(`/api/products/${productId}`)
    const p = result.data

    const attrs = [
      { label: 'Origin', value: [p.origin_country, p.origin_region].filter(Boolean).join(', ') },
      { label: 'Process', value: p.process },
      { label: 'Roast', value: p.roast_level },
      { label: 'Variety', value: p.variety },
      { label: 'Altitude', value: p.altitude }
    ].filter((a) => a.value)

    const tastingNotes = parseTastingNotes(p.tasting_notes)
    const ud = p.userDiscount

    // Coupon banner if user has a discount for this shop
    const couponBannerHtml = ud ? `
      <div class="coupon-banner">
        <span class="coupon-icon">\uD83C\uDFF7\uFE0F</span>
        Your coupon: <strong>-${ud.percent}%</strong>
        ${ud.code ? ` (code: <code>${esc(ud.code)}</code>)` : ''}
      </div>
    ` : ''

    const variantsHtml = p.variants.length > 0 ? `
      <table class="variants-table">
        <thead>
          <tr>
            <th>Weight</th>
            <th>Grind</th>
            <th>Price</th>
            ${ud ? '<th>Your Price</th>' : ''}
            <th>Per 100g</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          ${p.variants.map((v) => {
    const isOnSale = v.original_price && v.original_price > v.current_price
    const priceHtml = v.current_price
      ? (isOnSale
        ? `<span class="original-price">${v.original_price.toFixed(2)} \u20ac</span> <span class="sale-price">${v.current_price.toFixed(2)} \u20ac</span>`
        : `${v.current_price.toFixed(2)} \u20ac`)
      : '-'
    const subscriptionHtml = v.current_subscription_price
      ? `<br><small>${v.current_subscription_price.toFixed(2)} \u20ac sub</small>`
      : ''

    // Calculate effective price with user's coupon
    const effectivePrice = ud && v.current_price
      ? (v.current_price * (1 - ud.percent / 100)).toFixed(2) + ' \u20ac'
      : null
    const effectivePer100g = ud && v.price_per_100g
      ? (v.price_per_100g * (1 - ud.percent / 100)).toFixed(2) + ' \u20ac'
      : null

    return `
            <tr class="${isOnSale ? 'on-sale' : ''}">
              <td>${v.weight_grams ? v.weight_grams + 'g' : '-'}</td>
              <td>${esc(v.grind || 'whole bean')}</td>
              <td>${priceHtml}${subscriptionHtml}</td>
              ${ud ? `<td class="effective-price-cell">${effectivePrice || '-'}</td>` : ''}
              <td>${v.price_per_100g ? v.price_per_100g.toFixed(2) + ' \u20ac' : '-'}${effectivePer100g ? `<br><span class="effective-price-small">${effectivePer100g}</span>` : ''}</td>
              <td>${v.in_stock ? '\u2705' : '\u274c'}</td>
            </tr>
          `
  }).join('')}
        </tbody>
      </table>
    ` : ''

    const ratingHtml = p.rating ? `
      <div class="attr-item">
        <div class="attr-label">Rating</div>
        <div class="attr-value">${p.rating.average_rating} / ${p.rating.out_of} (${p.rating.review_count} reviews)</div>
      </div>
    ` : ''

    const breadcrumbName = document.getElementById('breadcrumb-product-name')
    if (breadcrumbName) breadcrumbName.textContent = p.name

    container.innerHTML = `
      ${couponBannerHtml}
      <div class="detail-header">
        ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" class="detail-image">` : ''}
        <div class="detail-info">
          <h2>${esc(p.name)}</h2>
          <div class="detail-shop">${esc(p.shop_name)}</div>
          ${p.description ? `<p>${esc(p.description)}</p>` : ''}
          ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" class="detail-link">Buy at ${esc(p.shop_name)} &rarr;</a>` : ''}
        </div>
      </div>

      <div class="detail-attributes">
        ${attrs.map((a) => `
          <div class="attr-item">
            <div class="attr-label">${esc(a.label)}</div>
            <div class="attr-value">${esc(a.value)}</div>
          </div>
        `).join('')}
        ${ratingHtml}
        ${tastingNotes.length > 0 ? `
          <div class="attr-item">
            <div class="attr-label">Tasting Notes</div>
            <div class="attr-value">${tastingNotes.map((n) => esc(n)).join(', ')}</div>
          </div>
        ` : ''}
      </div>

      ${variantsHtml}

      ${p.blogReviews?.length > 0 ? `
        <div style="margin-top: 16px">
          <h3>Blog Reviews</h3>
          ${p.blogReviews.map((r) => `
            <div class="attr-item">
              <div class="attr-label">${esc(r.title)}</div>
              <div class="attr-value">
                ${r.cupping_score ? `Cupping: ${r.cupping_score}/100` : ''}
                ${r.source_url ? `<br><a href="${esc(r.source_url)}" target="_blank" rel="noopener" style="color: var(--primary)">Read review</a>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `

    // Load price history chart
    loadPriceHistory(productId)
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`
  }
}

function parseTastingNotes(notes) {
  if (!notes) return []
  try {
    return JSON.parse(notes)
  } catch {
    return notes.split(',').map((n) => n.trim()).filter(Boolean)
  }
}

async function loadPriceHistory(productId) {
  try {
    const result = await api.get(`/api/price-history/product/${productId}`)
    if (result.data.length > 0) {
      document.getElementById('price-chart-container').style.display = 'block'
      drawPriceChart(result.data)
    } else {
      document.getElementById('price-chart-container').style.display = 'none'
    }
  } catch {
    document.getElementById('price-chart-container').style.display = 'none'
  }
}
