const FLAVOR_CATEGORIES = {
  chocolate: {
    label: 'Chocolate / Dark',
    keywords: [
      'chocolate', 'cocoa', 'cacao', 'dark', 'bitter', 'caramel',
      'čokolád', 'kakao', 'kakaov', 'karamel', 'horká', 'horkast', 'tmav',
      'molasses', 'brown sugar', 'toffee', 'fudge', 'brownie'
    ]
  },
  fruity: {
    label: 'Fruity',
    keywords: [
      'fruity', 'fruit', 'berry', 'citrus', 'tropical', 'peach', 'apple', 'cherry',
      'plum', 'grape', 'mango', 'pineapple', 'lemon', 'orange', 'lime', 'grapefruit',
      'ovocn', 'citrus', 'bobuľ', 'brusn', 'čern', 'malín', 'jahod', 'slivk',
      'broskyn', 'hrozn', 'mango', 'ananás', 'citrón', 'pomaranč', 'fig',
      'red fruit', 'stone fruit', 'dried fruit'
    ]
  },
  floral: {
    label: 'Floral',
    keywords: [
      'floral', 'flower', 'jasmine', 'rose', 'lavender', 'hibiscus',
      'florál', 'kvetin', 'jazmín', 'ruža', 'levanduľ'
    ]
  },
  nutty: {
    label: 'Nutty',
    keywords: [
      'nutty', 'nut', 'almond', 'hazelnut', 'walnut', 'peanut', 'pistachio',
      'orech', 'mandľ', 'lieskový', 'vlašský', 'marcipán', 'marzipan'
    ]
  },
  sweet: {
    label: 'Sweet / Honey',
    keywords: [
      'sweet', 'honey', 'sugar', 'cane', 'syrup', 'vanilla', 'cream',
      'sladk', 'med', 'cukor', 'vanilk', 'krém', 'lahodn', 'jemn'
    ]
  },
  spicy: {
    label: 'Spicy / Herbal',
    keywords: [
      'spicy', 'spice', 'cinnamon', 'pepper', 'clove', 'cardamom', 'ginger',
      'korenist', 'škorica', 'pepř', 'klinček', 'zázvor', 'bylink'
    ]
  }
}

export function classifyFlavor(product) {
  const searchText = buildSearchText(product).toLowerCase()
  const scores = {}

  for (const [category, { keywords }] of Object.entries(FLAVOR_CATEGORIES)) {
    let count = 0
    for (const kw of keywords) {
      if (searchText.includes(kw.toLowerCase())) count++
    }
    if (count > 0) scores[category] = count
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  return sorted.map(([category]) => category)
}

export function getFlavorLabel(category) {
  return FLAVOR_CATEGORIES[category]?.label || category
}

export function getFlavorCategories() {
  return Object.entries(FLAVOR_CATEGORIES).map(([key, { label }]) => ({ key, label }))
}

export function matchesFlavorFilter(product, flavorFilter) {
  if (!flavorFilter) return true
  const categories = classifyFlavor(product)
  return categories.includes(flavorFilter)
}

function buildSearchText(product) {
  const parts = [
    product.name || '',
    product.tasting_notes || '',
    product.description || '',
    product.roast_level || '',
    product.variety || '',
    product.process || ''
  ]
  return parts.join(' ')
}

export function extractCleanTastingNotes(product) {
  const raw = product.tasting_notes
  if (!raw) return null

  let notes
  try {
    notes = JSON.parse(raw)
    if (Array.isArray(notes)) {
      notes = notes
        .filter((n) => typeof n === 'string')
        .filter((n) => !isJunkNote(n, product))
        .join(', ')
    }
  } catch {
    notes = raw
  }

  if (!notes || notes.length < 3) return null

  // If still looks like junk, try extracting from product name
  if (isJunkNote(notes, product)) {
    return extractFlavorFromName(product.name)
  }

  return notes
}

function isJunkNote(text, product) {
  if (!text || text.length < 3) return true
  const lower = text.toLowerCase()
  const shopName = (product.shop_name || '').toLowerCase()
  const productName = (product.name || '').toLowerCase()

  if (lower === shopName) return true
  if (lower.startsWith(productName.slice(0, 20))) return true
  if (/^(zlaté zrnko|goriffee|triple five|black)/i.test(text)) return true
  return false
}

function extractFlavorFromName(name) {
  if (!name) return null
  const quotes = name.match(/"([^"]+)"/g)
  if (quotes) {
    return quotes.map((q) => q.replace(/"/g, '').trim()).join(', ')
  }
  return null
}
