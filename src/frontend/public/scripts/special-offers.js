/* global api, esc, renderProductCard, renderSkeleton */

async function loadSpecialOffers() {
  const container = document.getElementById('special-offers-list')
  container.innerHTML = renderSkeleton(4)

  try {
    const result = await api.get('/api/products', true)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const specials = result.data.filter((p) => {
      const nameLower = (p.name || '').toLowerCase()
      if (/darček|gift|krabičk|balíček|sada|set\b|box|luxusn.*krabičk|degustačn/i.test(nameLower)) return false
      if (/balík.*zadarmo|výhodný balík/i.test(nameLower)) return false

      const hasSpecialBadge = (p.badges || []).some((b) => {
        const label = (b.label || '').toLowerCase()
        return label.includes('new') || label.includes('novinka') || label.includes('limited') || label.includes('edition') || label.includes('special')
      })

      return hasSpecialBadge || (p.first_seen_at && p.first_seen_at >= thirtyDaysAgo)
    })

    if (specials.length === 0) {
      container.innerHTML = renderEmptyState('✨', 'No special offers right now', 'New arrivals and limited editions will appear here. Check back soon!', { label: 'Browse all products', section: 'products', href: '#products' })
      return
    }

    container.innerHTML = specials.map((p) => {
      const badgeTags = (p.badges || []).map((b) => `<span class="tag special">${esc(b.label)}</span>`).join('')
      return renderProductCard(p, { extraMetaHtml: badgeTags })
    }).join('')
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`
  }
}
