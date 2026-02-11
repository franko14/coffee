/* global api, esc */

async function loadSettings() {
  const container = document.getElementById('shop-discounts-list')
  container.innerHTML = '<div class="loading">Loading shops...</div>'

  try {
    const result = await api.get('/api/shops')
    const shops = result.data

    container.innerHTML = shops.map((shop) => {
      const hasDiscount = shop.user_discount_percent > 0
      const isEnabled = shop.user_discount_enabled === 1

      return `
        <div class="shop-discount-row" data-slug="${esc(shop.slug)}">
          <div class="shop-discount-info">
            <span class="shop-discount-name">${esc(shop.name)}</span>
            <span class="shop-discount-count">${shop.productCount} products</span>
          </div>
          <div class="shop-discount-controls">
            <input type="number"
              class="discount-input"
              data-field="percent"
              placeholder="%"
              min="0"
              max="100"
              step="1"
              value="${hasDiscount ? shop.user_discount_percent : ''}"
            >
            <input type="text"
              class="discount-code-input"
              data-field="code"
              placeholder="Coupon code (optional)"
              value="${shop.user_discount_code || ''}"
            >
            <label class="discount-toggle">
              <input type="checkbox"
                data-field="enabled"
                ${isEnabled ? 'checked' : ''}
              >
              <span class="toggle-label">${isEnabled ? 'Enabled' : 'Disabled'}</span>
            </label>
            <button class="discount-save-btn" onclick="saveShopDiscount('${esc(shop.slug)}')">Save</button>
          </div>
        </div>
      `
    }).join('')

    // Add change handlers for toggle labels
    container.querySelectorAll('input[data-field="enabled"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const label = e.target.nextElementSibling
        label.textContent = e.target.checked ? 'Enabled' : 'Disabled'
      })
    })
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`
  }
}

async function saveShopDiscount(slug) {
  const row = document.querySelector(`.shop-discount-row[data-slug="${slug}"]`)
  if (!row) return

  const percentInput = row.querySelector('input[data-field="percent"]')
  const codeInput = row.querySelector('input[data-field="code"]')
  const enabledInput = row.querySelector('input[data-field="enabled"]')
  const saveBtn = row.querySelector('.discount-save-btn')

  const discountPercent = percentInput.value ? parseFloat(percentInput.value) : null
  const discountCode = codeInput.value.trim() || null
  const enabled = enabledInput.checked

  saveBtn.textContent = 'Saving...'
  saveBtn.disabled = true

  try {
    await api.put(`/api/shops/${slug}/discount`, {
      discountPercent,
      discountCode,
      enabled
    })

    saveBtn.textContent = 'Saved!'
    setTimeout(() => {
      saveBtn.textContent = 'Save'
      saveBtn.disabled = false
    }, 1500)
  } catch (err) {
    saveBtn.textContent = 'Error'
    setTimeout(() => {
      saveBtn.textContent = 'Save'
      saveBtn.disabled = false
    }, 1500)
  }
}
