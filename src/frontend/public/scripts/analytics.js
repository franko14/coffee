/* global api, esc */

const SHOP_COLORS = {}
const SHOP_COLOR_PALETTE = ['#c49b66', '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#8b5cf6']
let scatterProducts = []
let historySelectedIds = []
let allProductsList = []

function getShopColor(shopName) {
  if (!SHOP_COLORS[shopName]) {
    const idx = Object.keys(SHOP_COLORS).length
    SHOP_COLORS[shopName] = SHOP_COLOR_PALETTE[idx % SHOP_COLOR_PALETTE.length]
  }
  return SHOP_COLORS[shopName]
}

async function loadAnalytics() {
  loadScatterChart()
  loadProductList()
}

async function loadScatterChart() {
  const container = document.getElementById('scatter-container')
  try {
    const result = await api.get('/api/price-history/scatter')
    scatterProducts = result.data
    drawScatter(scatterProducts)
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`
  }
}

function drawScatter(products) {
  const canvas = document.getElementById('scatter-chart')
  const ctx = canvas.getContext('2d')

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = rect.height
  const padding = { top: 30, right: 30, bottom: 50, left: 70 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const prices = products.map((p) => p.pricePerKg).sort((a, b) => a - b)
  if (prices.length === 0) return

  const minPrice = Math.floor(prices[0] / 10) * 10
  const maxPrice = Math.ceil(prices[prices.length - 1] / 10) * 10
  const priceRange = maxPrice - minPrice || 1

  // Price range zones
  const zones = [
    { label: 'Budget', max: 20, color: 'rgba(34, 197, 94, 0.06)' },
    { label: 'Mid-range', max: 35, color: 'rgba(245, 158, 11, 0.06)' },
    { label: 'Premium', max: 55, color: 'rgba(168, 85, 247, 0.06)' },
    { label: 'Ultra-premium', max: Infinity, color: 'rgba(239, 68, 68, 0.06)' }
  ]

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  // Clear
  ctx.fillStyle = cssVar('--surface')
  ctx.fillRect(0, 0, width, height)

  // Draw price zones
  let zoneStart = minPrice
  for (const zone of zones) {
    const zoneEnd = Math.min(zone.max, maxPrice)
    if (zoneStart >= maxPrice) break
    const y1 = padding.top + chartH - ((Math.min(zoneEnd, maxPrice) - minPrice) / priceRange) * chartH
    const y2 = padding.top + chartH - ((zoneStart - minPrice) / priceRange) * chartH
    ctx.fillStyle = zone.color
    ctx.fillRect(padding.left, y1, chartW, y2 - y1)

    // Zone label
    if (zoneEnd > minPrice && zoneStart < maxPrice) {
      ctx.fillStyle = cssVar('--text-muted')
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      const labelY = (y1 + y2) / 2
      ctx.fillText(zone.label, width - 8, labelY + 4)
    }
    zoneStart = zoneEnd
  }

  // Grid
  ctx.strokeStyle = cssVar('--border')
  ctx.lineWidth = 0.5
  const priceSteps = 6
  for (let i = 0; i <= priceSteps; i++) {
    const price = minPrice + (priceRange / priceSteps) * i
    const y = padding.top + chartH - ((price - minPrice) / priceRange) * chartH
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()

    ctx.fillStyle = cssVar('--text-muted')
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(price)} \u20ac`, padding.left - 8, y + 4)
  }

  // Group by shop for x-axis distribution
  const shops = [...new Set(products.map((p) => p.shopName))]
  const shopWidth = chartW / (shops.length || 1)

  // Assign x positions with jitter within shop bands
  const positioned = products.map((p) => {
    const shopIdx = shops.indexOf(p.shopName)
    const bandCenter = padding.left + shopIdx * shopWidth + shopWidth / 2
    const jitter = (Math.random() - 0.5) * shopWidth * 0.7
    const x = bandCenter + jitter
    const y = padding.top + chartH - ((p.pricePerKg - minPrice) / priceRange) * chartH
    return { ...p, x, y }
  })

  // Shop labels at bottom
  ctx.textAlign = 'center'
  ctx.font = '12px sans-serif'
  for (let i = 0; i < shops.length; i++) {
    const x = padding.left + i * shopWidth + shopWidth / 2
    ctx.fillStyle = getShopColor(shops[i])
    ctx.fillText(shops[i], x, height - 10)
  }

  // Y axis label
  ctx.save()
  ctx.translate(14, height / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = cssVar('--text-muted')
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('\u20ac / kg', 0, 0)
  ctx.restore()

  // Draw dots
  for (const pt of positioned) {
    ctx.fillStyle = getShopColor(pt.shopName)
    ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Tooltip on hover
  canvas.onmousemove = (e) => {
    const canvasRect = canvas.getBoundingClientRect()
    const mx = e.clientX - canvasRect.left
    const my = e.clientY - canvasRect.top

    let found = null
    for (const pt of positioned) {
      const dx = mx - pt.x
      const dy = my - pt.y
      if (dx * dx + dy * dy < 64) {
        found = pt
        break
      }
    }

    let tooltip = document.getElementById('scatter-tooltip')
    if (!found) {
      if (tooltip) tooltip.style.display = 'none'
      canvas.style.cursor = 'default'
      return
    }

    canvas.style.cursor = 'pointer'
    if (!tooltip) {
      tooltip = document.createElement('div')
      tooltip.id = 'scatter-tooltip'
      tooltip.className = 'scatter-tooltip'
      canvas.parentElement.appendChild(tooltip)
    }

    tooltip.innerHTML = `<strong>${esc(found.name)}</strong><br>${esc(found.shopName)}<br><span style="color: var(--primary)">${found.pricePerKg.toFixed(2)} \u20ac/kg</span>${found.origin ? `<br>${esc(found.origin)}` : ''}`
    tooltip.style.display = 'block'
    tooltip.style.left = `${mx + 12}px`
    tooltip.style.top = `${my - 10}px`
  }

  canvas.onclick = (e) => {
    const canvasRect = canvas.getBoundingClientRect()
    const mx = e.clientX - canvasRect.left
    const my = e.clientY - canvasRect.top
    for (const pt of positioned) {
      const dx = mx - pt.x
      const dy = my - pt.y
      if (dx * dx + dy * dy < 64) {
        if (typeof navigateTo === 'function') {
          navigateTo('product-detail', pt.id)
        }
        break
      }
    }
  }
}

async function loadProductList() {
  try {
    const result = await api.get('/api/products')
    allProductsList = result.data
  } catch {
    allProductsList = []
  }
}

function renderHistoryChips() {
  const container = document.getElementById('history-selected')
  container.innerHTML = historySelectedIds.map((id) => {
    const p = allProductsList.find((pr) => pr.id === id)
    const name = p ? p.name : `#${id}`
    return `<span class="history-chip">${esc(name)} <button class="chip-remove" data-remove-id="${id}">&times;</button></span>`
  }).join('')

  container.querySelectorAll('.chip-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      historySelectedIds = historySelectedIds.filter((i) => i !== parseInt(btn.dataset.removeId, 10))
      renderHistoryChips()
      loadHistoryComparison()
    })
  })
}

async function loadHistoryComparison() {
  const canvas = document.getElementById('history-compare-chart')
  if (historySelectedIds.length === 0) {
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Search and select coffees above to compare price history', rect.width / 2, rect.height / 2)
    return
  }

  try {
    const result = await api.get(`/api/price-history/compare?ids=${historySelectedIds.join(',')}`)
    drawHistoryComparison(result.data)
  } catch {
    // ignore
  }
}

function drawHistoryComparison(datasets) {
  const canvas = document.getElementById('history-compare-chart')
  const ctx = canvas.getContext('2d')

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = rect.height
  const padding = { top: 20, right: 160, bottom: 40, left: 60 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  ctx.fillStyle = cssVar('--surface')
  ctx.fillRect(0, 0, width, height)

  const allPoints = datasets.flatMap((d) =>
    d.history.map((h) => ({
      date: new Date(h.observed_at),
      price: h.price_per_100g || h.price
    }))
  ).filter((p) => p.price)

  if (allPoints.length === 0) {
    ctx.fillStyle = cssVar('--text-muted')
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('No price history data yet for selected coffees', width / 2, height / 2)
    return
  }

  const minDate = Math.min(...allPoints.map((p) => p.date.getTime()))
  const maxDate = Math.max(...allPoints.map((p) => p.date.getTime()))
  const minPrice = Math.min(...allPoints.map((p) => p.price)) * 0.9
  const maxPrice = Math.max(...allPoints.map((p) => p.price)) * 1.1
  const dateRange = maxDate - minDate || 1
  const priceRange = maxPrice - minPrice || 1

  const xScale = (d) => padding.left + ((d.getTime() - minDate) / dateRange) * chartW
  const yScale = (p) => padding.top + chartH - ((p - minPrice) / priceRange) * chartH

  // Grid
  ctx.strokeStyle = cssVar('--border')
  ctx.lineWidth = 0.5
  const steps = 5
  for (let i = 0; i <= steps; i++) {
    const price = minPrice + (priceRange / steps) * i
    const y = yScale(price)
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(padding.left + chartW, y)
    ctx.stroke()
    ctx.fillStyle = cssVar('--text-muted')
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${price.toFixed(2)}`, padding.left - 8, y + 4)
  }

  // X axis dates
  const dateSteps = Math.min(6, allPoints.length)
  for (let i = 0; i < dateSteps; i++) {
    const t = minDate + (dateRange / (dateSteps - 1 || 1)) * i
    const d = new Date(t)
    ctx.fillStyle = cssVar('--text-muted')
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(d.toLocaleDateString('sk-SK', { month: 'short', day: 'numeric' }), xScale(d), height - 10)
  }

  // Collect all positioned points for hover detection
  const positionedPoints = []
  const colors = SHOP_COLOR_PALETTE

  // Draw lines for each product
  datasets.forEach((dataset, idx) => {
    const color = colors[idx % colors.length]
    const grouped = new Map()

    for (const h of dataset.history) {
      const key = h.variant_id
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push({
        date: new Date(h.observed_at),
        price: h.price_per_100g || h.price,
        weightGrams: h.weight_grams
      })
    }

    for (const [, points] of grouped) {
      const sorted = [...points].filter((p) => p.price).sort((a, b) => a.date - b.date)
      if (sorted.length === 0) continue

      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < sorted.length; i++) {
        const x = xScale(sorted[i].date)
        const y = yScale(sorted[i].price)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      for (const pt of sorted) {
        const x = xScale(pt.date)
        const y = yScale(pt.price)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fill()

        // Store for hover detection
        positionedPoints.push({
          x,
          y,
          name: dataset.name,
          shopName: dataset.shopName,
          price: pt.price,
          date: pt.date,
          weightGrams: pt.weightGrams,
          color
        })
      }
    }

    // Legend with colored box
    const legendY = padding.top + 16 + idx * 22
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(padding.left + chartW + 18, legendY, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = cssVar('--text')
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    const label = dataset.name.length > 20 ? dataset.name.slice(0, 18) + '...' : dataset.name
    ctx.fillText(label, padding.left + chartW + 28, legendY + 4)
  })

  // Y axis label
  ctx.save()
  ctx.translate(14, height / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = cssVar('--text-muted')
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('\u20ac / 100g', 0, 0)
  ctx.restore()

  // Hover tooltip
  canvas.onmousemove = (e) => {
    const canvasRect = canvas.getBoundingClientRect()
    const mx = e.clientX - canvasRect.left
    const my = e.clientY - canvasRect.top

    let found = null
    let minDist = 100
    for (const pt of positionedPoints) {
      const dx = mx - pt.x
      const dy = my - pt.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < minDist && dist < 15) {
        minDist = dist
        found = pt
      }
    }

    let tooltip = document.getElementById('history-tooltip')
    if (!found) {
      if (tooltip) tooltip.style.display = 'none'
      canvas.style.cursor = 'default'
      return
    }

    canvas.style.cursor = 'pointer'
    if (!tooltip) {
      tooltip = document.createElement('div')
      tooltip.id = 'history-tooltip'
      tooltip.className = 'scatter-tooltip'
      canvas.parentElement.appendChild(tooltip)
    }

    const dateStr = found.date.toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' })
    const weightLabel = found.weightGrams ? (found.weightGrams >= 1000 ? `${found.weightGrams / 1000}kg` : `${found.weightGrams}g`) : ''

    tooltip.innerHTML = `
      <strong style="color: ${found.color}">${esc(found.name)}</strong><br>
      <span style="color: var(--text-muted)">${esc(found.shopName || '')}</span><br>
      <span style="color: var(--primary); font-size: 1.1em">${found.price.toFixed(2)} \u20ac/100g</span>
      ${weightLabel ? `<span style="color: var(--text-muted); margin-left: 6px">(${weightLabel})</span>` : ''}<br>
      <span style="color: var(--text-muted); font-size: 0.9em">${dateStr}</span>
    `
    tooltip.style.display = 'block'

    // Position tooltip, keeping it within canvas bounds
    let left = mx + 12
    let top = my - 10
    if (left + 180 > rect.width) left = mx - 180
    if (top < 10) top = my + 20

    tooltip.style.left = `${left}px`
    tooltip.style.top = `${top}px`
  }

  canvas.onmouseleave = () => {
    const tooltip = document.getElementById('history-tooltip')
    if (tooltip) tooltip.style.display = 'none'
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('history-search')
  const suggestionsBox = document.getElementById('history-suggestions')
  if (!searchInput || !suggestionsBox) return

  let debounceTimer
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const q = searchInput.value.toLowerCase().trim()
      if (q.length < 2) {
        suggestionsBox.classList.add('hidden')
        return
      }

      const matches = allProductsList
        .filter((p) => !historySelectedIds.includes(p.id))
        .filter((p) =>
          p.name.toLowerCase().includes(q) ||
          (p.shop_name || '').toLowerCase().includes(q)
        )
        .slice(0, 8)

      if (matches.length === 0) {
        suggestionsBox.classList.add('hidden')
        return
      }

      suggestionsBox.innerHTML = matches.map((p) =>
        `<div class="history-suggestion" data-id="${p.id}">
          <span>${esc(p.name)}</span>
          <span class="suggestion-shop">${esc(p.shop_name)}</span>
        </div>`
      ).join('')
      suggestionsBox.classList.remove('hidden')

      suggestionsBox.querySelectorAll('.history-suggestion').forEach((el) => {
        el.addEventListener('click', () => {
          const id = parseInt(el.dataset.id, 10)
          if (!historySelectedIds.includes(id)) {
            historySelectedIds = [...historySelectedIds, id]
            renderHistoryChips()
            loadHistoryComparison()
          }
          searchInput.value = ''
          suggestionsBox.classList.add('hidden')
        })
      })
    }, 200)
  })

  searchInput.addEventListener('blur', () => {
    setTimeout(() => suggestionsBox.classList.add('hidden'), 200)
  })

  loadHistoryComparison()
})
