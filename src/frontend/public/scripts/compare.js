/* global api, esc */

let compareData = []
let compareSortCol = 'pricePerKg'
let compareSortDir = 'asc'

async function loadCompare() {
  const container = document.getElementById('compare-table-container')
  container.innerHTML = '<div class="loading">Loading comparison data...</div>'

  try {
    const result = await api.get('/api/products')
    compareData = result.data
    populateCompareShopFilter(compareData)
    renderCompareTable()
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`
  }
}

function populateCompareShopFilter(products) {
  const select = document.getElementById('compare-shop-filter')
  if (!select || select.options.length > 1) return
  const shops = [...new Set(products.map((p) => p.shop_name).filter(Boolean))]
  for (const shop of shops.sort()) {
    const opt = document.createElement('option')
    opt.value = shop
    opt.textContent = shop
    select.appendChild(opt)
  }
}

function getFilteredCompareData() {
  const shopFilter = document.getElementById('compare-shop-filter')?.value || ''
  const searchVal = (document.getElementById('compare-search')?.value || '').toLowerCase()
  const inStockOnly = document.getElementById('compare-in-stock')?.checked

  return compareData.filter((p) => {
    if (shopFilter && p.shop_name !== shopFilter) return false
    if (searchVal && !p.name.toLowerCase().includes(searchVal) &&
        !(p.origin_country || '').toLowerCase().includes(searchVal) &&
        !(p.variety || '').toLowerCase().includes(searchVal)) return false
    if (inStockOnly && !p.cheapestPrice) return false
    return true
  })
}

function sortCompareData(data) {
  const dir = compareSortDir === 'asc' ? 1 : -1

  return [...data].sort((a, b) => {
    let va = getCompareValue(a, compareSortCol)
    let vb = getCompareValue(b, compareSortCol)

    if (va === null || va === undefined) va = compareSortDir === 'asc' ? Infinity : -Infinity
    if (vb === null || vb === undefined) vb = compareSortDir === 'asc' ? Infinity : -Infinity

    if (typeof va === 'string') return dir * va.localeCompare(vb)
    return dir * (va - vb)
  })
}

function getCompareValue(product, col) {
  const map = {
    name: product.name,
    shop: product.shop_name,
    origin: product.origin_country,
    process: product.process,
    variety: product.variety,
    roast: product.roast_level,
    altitude: parseAltitudeNum(product.altitude),
    brewing: product.brewing_method,
    arabica: product.arabica_percentage,
    tasting: product.tasting_notes,
    price250g: findVariantPrice(product, 250),
    price1kg: findVariantPrice(product, 1000),
    pricePerKg: product.pricePerKg,
    cheapestPrice: product.cheapestPrice
  }
  return map[col] ?? null
}

function parseAltitudeNum(alt) {
  if (!alt) return null
  const match = alt.match(/(\d[\d\s.,]*)/);
  return match ? parseFloat(match[1].replace(/\s/g, '').replace(',', '.')) : null
}

function findVariantPrice(product, targetWeight) {
  if (!product.variants) return null
  const v = product.variants.find((v) => v.weightGrams === targetWeight && v.inStock)
  return v ? v.price : null
}

function renderCompareTable() {
  const container = document.getElementById('compare-table-container')
  const filtered = getFilteredCompareData()
  const sorted = sortCompareData(filtered)

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state">No coffees match your filters.</div>'
    return
  }

  const arrow = (col) => {
    if (compareSortCol !== col) return ''
    return compareSortDir === 'asc' ? ' \u25B2' : ' \u25BC'
  }

  const th = (col, label) =>
    `<th class="sortable${compareSortCol === col ? ' active' : ''}" data-sort="${col}">${label}${arrow(col)}</th>`

  const rows = sorted.map((p) => {
    const price250 = findVariantPrice(p, 250)
    const price1kg = findVariantPrice(p, 1000)
    const perKg = p.pricePerKg

    return `<tr class="compare-row" data-section="product-detail" data-id="${p.id}">
      <td class="col-name">${esc(p.name)}</td>
      <td class="col-shop">${esc(p.shop_name || '')}</td>
      <td>${esc(p.origin_country || '-')}</td>
      <td>${esc(p.process || '-')}</td>
      <td>${esc(p.variety || '-')}</td>
      <td>${esc(p.roast_level || '-')}</td>
      <td>${esc(p.altitude || '-')}</td>
      <td>${esc(p.brewing_method || '-')}</td>
      <td>${esc(p.tasting_notes || '-')}</td>
      <td class="col-num">${price250 ? price250.toFixed(2) + ' \u20ac' : '-'}</td>
      <td class="col-num">${price1kg ? price1kg.toFixed(2) + ' \u20ac' : '-'}</td>
      <td class="col-num col-highlight">${perKg ? perKg.toFixed(2) + ' \u20ac' : '-'}</td>
    </tr>`
  }).join('')

  container.innerHTML = `
    <div class="compare-scroll">
      <table class="compare-table">
        <thead>
          <tr>
            ${th('name', 'Name')}
            ${th('shop', 'Shop')}
            ${th('origin', 'Origin')}
            ${th('process', 'Process')}
            ${th('variety', 'Variety')}
            ${th('roast', 'Roast')}
            ${th('altitude', 'Altitude')}
            ${th('brewing', 'Brewing')}
            ${th('tasting', 'Tasting Notes')}
            ${th('price250g', '250g')}
            ${th('price1kg', '1kg')}
            ${th('pricePerKg', 'Price/kg')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="compare-count">${sorted.length} coffees</div>
  `

  container.querySelectorAll('th.sortable').forEach((el) => {
    el.addEventListener('click', () => {
      const col = el.dataset.sort
      if (compareSortCol === col) {
        compareSortDir = compareSortDir === 'asc' ? 'desc' : 'asc'
      } else {
        compareSortCol = col
        compareSortDir = 'asc'
      }
      renderCompareTable()
    })
  })

  container.querySelectorAll('.compare-row').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.id
      if (id) {
        document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'))
        document.getElementById('product-detail').classList.add('active')
        document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'))
        if (typeof loadProductDetail === 'function') loadProductDetail(id)
      }
    })
  })
}

document.addEventListener('DOMContentLoaded', () => {
  const shopFilter = document.getElementById('compare-shop-filter')
  const searchInput = document.getElementById('compare-search')
  const stockCheck = document.getElementById('compare-in-stock')

  if (shopFilter) shopFilter.addEventListener('change', renderCompareTable)
  if (searchInput) searchInput.addEventListener('input', renderCompareTable)
  if (stockCheck) stockCheck.addEventListener('change', renderCompareTable)
})
