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
  const padding = { top: 20, right: 160, bottom: 40, left: 60 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  // Helper to get date key (YYYY-MM-DD) for deduplication
  function toDateKey(date) {
    return date.toISOString().slice(0, 10)
  }

  // Group by variant
  const groups = new Map()
  for (const entry of historyData) {
    const key = entry.variant_id
    if (!groups.has(key)) {
      const weightGrams = entry.weight_grams || 0
      const weightLabel = weightGrams >= 1000 ? `${weightGrams / 1000}kg` : `${weightGrams}g`
      // Always show weight first, optionally add grind/label in parentheses
      const grindInfo = entry.grind && entry.grind !== 'whole bean' ? ` (${entry.grind})` : ''
      groups.set(key, {
        label: weightLabel + grindInfo,
        weightGrams,
        pointsByDay: new Map()
      })
    }
    const entryDate = new Date(entry.observed_at)
    const dayKey = toDateKey(entryDate)
    const price = entry.price_per_100g || entry.price

    // Keep latest entry for each day (or update if newer)
    const existing = groups.get(key).pointsByDay.get(dayKey)
    if (!existing || entryDate > existing.date) {
      groups.get(key).pointsByDay.set(dayKey, { date: entryDate, price, dayKey })
    }
  }

  // Sort groups by weight (smallest first) and convert to points array
  const sortedGroups = [...groups.entries()].sort((a, b) => a[1].weightGrams - b[1].weightGrams)
  for (const [, group] of sortedGroups) {
    group.points = [...group.pointsByDay.values()].sort((a, b) => a.date - b.date)
    delete group.pointsByDay
  }

  const allPoints = sortedGroups.flatMap(([, g]) => g.points)
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

  function xToDate(x) {
    const t = minDate + ((x - padding.left) / chartW) * dateRange
    return new Date(t)
  }

  // Clear
  ctx.fillStyle = cssVar('--surface')
  ctx.fillRect(0, 0, width, height)

  // Grid lines
  ctx.strokeStyle = cssVar('--border')
  ctx.lineWidth = 0.5

  const priceSteps = 5
  for (let i = 0; i <= priceSteps; i++) {
    const price = minPrice + (priceRange / priceSteps) * i
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

  // Colors for variants
  const colors = ['#c49b66', '#6366f1', '#22c55e', '#f59e0b', '#ef4444']
  const variantData = []

  // Draw lines for each variant
  sortedGroups.forEach(([variantId, group], idx) => {
    const color = colors[idx % colors.length]
    variantData.push({ variantId, label: group.label, color, points: group.points })

    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
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
      ctx.arc(xScale(point.date), yScale(point.price), 4, 0, Math.PI * 2)
      ctx.fill()
    }
  })

  // Legend (right side)
  ctx.textAlign = 'left'
  sortedGroups.forEach(([, group], idx) => {
    const color = colors[idx % colors.length]
    const legendY = padding.top + 16 + idx * 22

    // Colored circle
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(padding.left + chartW + 16, legendY, 6, 0, Math.PI * 2)
    ctx.fill()

    // Label
    ctx.fillStyle = cssVar('--text')
    ctx.font = '12px sans-serif'
    ctx.fillText(group.label, padding.left + chartW + 28, legendY + 4)
  })

  // X-axis dates - show unique days
  ctx.fillStyle = cssVar('--text-muted')
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'

  // Get unique days from all points
  const uniqueDays = [...new Set(allPoints.map((p) => p.dayKey))].sort()
  const maxLabels = Math.min(7, uniqueDays.length)
  const step = Math.max(1, Math.floor(uniqueDays.length / maxLabels))

  for (let i = 0; i < uniqueDays.length; i += step) {
    const dayKey = uniqueDays[i]
    const d = new Date(dayKey + 'T12:00:00')
    const x = xScale(d)
    ctx.fillText(d.toLocaleDateString('sk-SK', { month: 'short', day: 'numeric' }), x, height - 10)
  }
  // Always show the last day if not already shown
  if (uniqueDays.length > 1 && (uniqueDays.length - 1) % step !== 0) {
    const lastDay = uniqueDays[uniqueDays.length - 1]
    const d = new Date(lastDay + 'T12:00:00')
    const x = xScale(d)
    ctx.fillText(d.toLocaleDateString('sk-SK', { month: 'short', day: 'numeric' }), x, height - 10)
  }

  // Y-axis label
  ctx.save()
  ctx.translate(12, height / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = cssVar('--text-muted')
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('\u20ac / 100g', 0, 0)
  ctx.restore()

  // Store state for hover redraw
  const chartState = {
    width, height, padding, chartW, chartH,
    minDate, maxDate, minPrice, maxPrice,
    dateRange, priceRange,
    xScale, yScale, xToDate,
    variantData, colors, cssVar, uniqueDays
  }

  // Hover interaction
  canvas.onmousemove = (e) => {
    const canvasRect = canvas.getBoundingClientRect()
    const mx = e.clientX - canvasRect.left
    const my = e.clientY - canvasRect.top

    // Only interact within chart area
    if (mx < padding.left || mx > padding.left + chartW || my < padding.top || my > padding.top + chartH) {
      hideChartTooltip(canvas)
      redrawChart(ctx, chartState, null)
      return
    }

    canvas.style.cursor = 'crosshair'
    redrawChart(ctx, chartState, mx)
    showChartTooltip(canvas, chartState, mx)
  }

  canvas.onmouseleave = () => {
    hideChartTooltip(canvas)
    redrawChart(ctx, chartState, null)
  }
}

function redrawChart(ctx, state, hoverX) {
  const { width, height, padding, chartW, chartH, minPrice, priceRange, xScale, yScale, variantData, colors, cssVar, uniqueDays } = state

  // Clear
  ctx.fillStyle = cssVar('--surface')
  ctx.fillRect(0, 0, width, height)

  // Grid lines
  ctx.strokeStyle = cssVar('--border')
  ctx.lineWidth = 0.5
  const priceSteps = 5
  for (let i = 0; i <= priceSteps; i++) {
    const price = minPrice + (priceRange / priceSteps) * i
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

  // Draw lines for each variant
  variantData.forEach((variant, idx) => {
    const color = colors[idx % colors.length]

    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.beginPath()

    for (let i = 0; i < variant.points.length; i++) {
      const x = xScale(variant.points[i].date)
      const y = yScale(variant.points[i].price)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Points
    for (const point of variant.points) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(xScale(point.date), yScale(point.price), 4, 0, Math.PI * 2)
      ctx.fill()
    }
  })

  // Legend
  ctx.textAlign = 'left'
  variantData.forEach((variant, idx) => {
    const color = colors[idx % colors.length]
    const legendY = padding.top + 16 + idx * 22

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(padding.left + chartW + 16, legendY, 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = cssVar('--text')
    ctx.font = '12px sans-serif'
    ctx.fillText(variant.label, padding.left + chartW + 28, legendY + 4)
  })

  // X-axis dates - show unique days
  ctx.fillStyle = cssVar('--text-muted')
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  const maxLabels = Math.min(7, uniqueDays.length)
  const step = Math.max(1, Math.floor(uniqueDays.length / maxLabels))

  for (let i = 0; i < uniqueDays.length; i += step) {
    const dayKey = uniqueDays[i]
    const d = new Date(dayKey + 'T12:00:00')
    const x = xScale(d)
    ctx.fillText(d.toLocaleDateString('sk-SK', { month: 'short', day: 'numeric' }), x, height - 10)
  }
  if (uniqueDays.length > 1 && (uniqueDays.length - 1) % step !== 0) {
    const lastDay = uniqueDays[uniqueDays.length - 1]
    const d = new Date(lastDay + 'T12:00:00')
    const x = xScale(d)
    ctx.fillText(d.toLocaleDateString('sk-SK', { month: 'short', day: 'numeric' }), x, height - 10)
  }

  // Y-axis label
  ctx.save()
  ctx.translate(12, height / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = cssVar('--text-muted')
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('\u20ac / 100g', 0, 0)
  ctx.restore()

  // Draw vertical hover line
  if (hoverX !== null) {
    ctx.strokeStyle = cssVar('--text-muted')
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(hoverX, padding.top)
    ctx.lineTo(hoverX, padding.top + chartH)
    ctx.stroke()
    ctx.setLineDash([])

    // Highlight nearest points on each line
    const hoverDate = state.xToDate(hoverX)
    for (const variant of variantData) {
      const nearest = findNearestPoint(variant.points, hoverDate)
      if (nearest) {
        const x = xScale(nearest.date)
        const y = yScale(nearest.price)

        // Larger highlighted point
        ctx.fillStyle = variant.color
        ctx.beginPath()
        ctx.arc(x, y, 7, 0, Math.PI * 2)
        ctx.fill()

        // White inner circle
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

function findNearestPoint(points, targetDate) {
  if (points.length === 0) return null
  let nearest = points[0]
  let minDiff = Math.abs(points[0].date.getTime() - targetDate.getTime())

  for (const pt of points) {
    const diff = Math.abs(pt.date.getTime() - targetDate.getTime())
    if (diff < minDiff) {
      minDiff = diff
      nearest = pt
    }
  }
  return nearest
}

function showChartTooltip(canvas, state, mx) {
  const { padding, xToDate, variantData } = state
  const hoverDate = xToDate(mx)

  let tooltip = document.getElementById('price-chart-tooltip')
  if (!tooltip) {
    tooltip = document.createElement('div')
    tooltip.id = 'price-chart-tooltip'
    tooltip.className = 'chart-tooltip'
    canvas.parentElement.style.position = 'relative'
    canvas.parentElement.appendChild(tooltip)
  }

  const dateStr = hoverDate.toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' })

  let html = `<div style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 6px;">${dateStr}</div>`

  for (const variant of variantData) {
    const nearest = findNearestPoint(variant.points, hoverDate)
    if (nearest) {
      html += `
        <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${variant.color};"></span>
          <span style="font-weight: 600;">${variant.label}</span>
          <span style="color: var(--primary); margin-left: auto;">${nearest.price.toFixed(2)} \u20ac/100g</span>
        </div>
      `
    }
  }

  tooltip.innerHTML = html
  tooltip.style.display = 'block'

  // Position tooltip
  const rect = canvas.getBoundingClientRect()
  let left = mx + 16
  if (left + 180 > rect.width) left = mx - 190

  tooltip.style.left = `${left}px`
  tooltip.style.top = `${padding.top + 10}px`
}

function hideChartTooltip(canvas) {
  const tooltip = document.getElementById('price-chart-tooltip')
  if (tooltip) tooltip.style.display = 'none'
  canvas.style.cursor = 'default'
}
