const ORIGIN_PATTERNS = [
  /(?:origin|p[ôo]vod|krajina)[:\s]*([A-Za-zÀ-ž\s,]+)/i,
  /(?:country|region)[:\s]*([A-Za-zÀ-ž\s,]+)/i
]

const PROCESS_TYPES = [
  'washed', 'natural', 'honey', 'anaerobic', 'semi-washed',
  'wet hulled', 'carbonic maceration', 'double fermentation',
  'umývaná', 'prírodná', 'medová', 'anaeróbna'
]

const ROAST_LEVELS = [
  { pattern: /light|svetl[áé]/i, level: 'light' },
  { pattern: /medium[- ]light|stredne svetl/i, level: 'medium-light' },
  { pattern: /medium|stred/i, level: 'medium' },
  { pattern: /medium[- ]dark|stredne tmav/i, level: 'medium-dark' },
  { pattern: /dark|tmav/i, level: 'dark' },
  { pattern: /filter|filtrov/i, level: 'light' },
  { pattern: /espresso/i, level: 'medium-dark' },
  { pattern: /omni/i, level: 'medium' }
]

export function parseOrigin(text) {
  if (!text) return { country: null, region: null }

  for (const pattern of ORIGIN_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      const parts = match[1].trim().split(/[,/]/)
      return {
        country: parts[0]?.trim() || null,
        region: parts[1]?.trim() || null
      }
    }
  }

  return { country: null, region: null }
}

export function parseProcess(text) {
  if (!text) return null

  const lower = text.toLowerCase()
  for (const process of PROCESS_TYPES) {
    if (lower.includes(process.toLowerCase())) {
      return process
    }
  }

  return null
}

export function parseRoastLevel(text) {
  if (!text) return null

  for (const { pattern, level } of ROAST_LEVELS) {
    if (pattern.test(text)) {
      return level
    }
  }

  return null
}

export function parseTastingNotes(text) {
  if (!text) return null

  const cleaned = text
    .replace(/(?:tasting notes|chuťov[éý] profil|chu[tť]|notes)[:\s]*/i, '')
    .trim()

  if (!cleaned) return null

  const notes = cleaned
    .split(/[,;|·•]/)
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && n.length < 50)

  return notes.length > 0 ? JSON.stringify(notes) : null
}

export function detectBlend(text) {
  if (!text) return false
  return /blend|zmes|mix/i.test(text)
}

export function detectDecaf(text) {
  if (!text) return false
  return /decaf|bezkofe[ií]nov/i.test(text)
}

export function parseProductAttributes(text) {
  return {
    origin: parseOrigin(text),
    process: parseProcess(text),
    roastLevel: parseRoastLevel(text),
    tastingNotes: parseTastingNotes(text),
    isBlend: detectBlend(text),
    isDecaf: detectDecaf(text)
  }
}
