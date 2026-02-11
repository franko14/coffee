/* eslint-disable no-unused-vars */

function drawPriceChart(historyData) {
  const canvas = document.getElementById('price-chart')
  const ctx = canvas.getContext('2d')

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = rect.height
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  // Group by variant
  const groups = new Map()
  for (const entry of historyData) {
    const key = entry.variant_id
    if (!groups.has(key)) {
      groups.set(key, {
        label: entry.label || `${entry.weight_grams || '?'}g`,
        points: []
      })
    }
    groups.get(key).points.push({
      date: new Date(entry.observed_at),
      price: entry.price_per_100g || entry.price
    })
  }

  // Sort points by date
  for (const [, group] of groups) {
    group.points.sort((a, b) => a.date - b.date)
  }

  const allPoints = [...groups.values()].flatMap((g) => g.points)
  if (allPoints.length === 0) return

  const minDate = Math.min(...allPoints.map((p) => p.date.getTime()))
  const maxDate = Math.max(...allPoints.map((p) => p.date.getTime()))
  const minPrice = Math.min(...allPoints.map((p) => p.price)) * 0.9
  const maxPrice = Math.max(...allPoints.map((p) => p.price)) * 1.1

  const dateRange = maxDate - minDate || 1
  const priceRange = maxPrice - minPrice || 1

  function xScale(date) {
    return padding.left + ((date.getTime() - minDate) / dateRange) * chartW
  }

  function yScale(price) {
    return padding.top + chartH - ((price - minPrice) / priceRange) * chartH
  }

  // Clear
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()
  ctx.fillRect(0, 0, width, height)

  // Grid lines
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim()
  ctx.lineWidth = 0.5

  const priceSteps = 5
  for (let i = 0; i <= priceSteps; i++) {
    const price = minPrice + (priceRange / priceSteps) * i
    const y = yScale(price)
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${price.toFixed(2)}`, padding.left - 8, y + 4)
  }

  // Draw lines for each variant
  const colors = ['#c49b66', '#6366f1', '#22c55e', '#f59e0b', '#ef4444']
  let colorIdx = 0

  for (const [, group] of groups) {
    const color = colors[colorIdx % colors.length]
    colorIdx++

    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()

    for (let i = 0; i < group.points.length; i++) {
      const x = xScale(group.points[i].date)
      const y = yScale(group.points[i].price)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Points
    for (const point of group.points) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(xScale(point.date), yScale(point.price), 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // X-axis dates
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'

  const dateSteps = Math.min(6, allPoints.length)
  for (let i = 0; i < dateSteps; i++) {
    const t = minDate + (dateRange / (dateSteps - 1 || 1)) * i
    const d = new Date(t)
    const x = xScale(d)
    ctx.fillText(d.toLocaleDateString('sk-SK', { month: 'short', day: 'numeric' }), x, height - 10)
  }

  // Y-axis label
  ctx.save()
  ctx.translate(12, height / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim()
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('\u20ac / 100g', 0, 0)
  ctx.restore()
}
