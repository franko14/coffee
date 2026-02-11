const ROASTERY_SLUG_MAP = {
  'triple five': 'triple-five',
  'black': 'black-sk',
  'goriffee': 'goriffee',
  'zlaté zrnko': 'zlate-zrnko',
  'zlate zrnko': 'zlate-zrnko'
}

export function mapRoasteryToSlug(name) {
  if (!name) return null
  return ROASTERY_SLUG_MAP[name.toLowerCase()] || null
}
