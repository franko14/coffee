export function now() {
  return new Date().toISOString()
}

export function daysSince(isoDateString) {
  if (!isoDateString) {
    return null
  }
  const then = new Date(isoDateString)
  const diff = Date.now() - then.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function formatDate(isoDateString) {
  if (!isoDateString) {
    return 'N/A'
  }
  return new Date(isoDateString).toLocaleDateString('sk-SK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

export function formatRelative(isoDateString) {
  if (!isoDateString) {
    return 'N/A'
  }
  const days = daysSince(isoDateString)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)} years ago`
}
