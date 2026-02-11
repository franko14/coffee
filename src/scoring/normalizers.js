import { daysSince } from '../utils/date-utils.js'

export function normalizeRating(averageRating, outOf) {
  if (averageRating == null || outOf == null || outOf <= 0) return null
  return Math.min(100, Math.max(0, (averageRating / outOf) * 100))
}

export function normalizeFreshness(firstSeenAt, windowDays) {
  if (!firstSeenAt) return null

  const age = daysSince(firstSeenAt)
  if (age == null || age < 0) return null

  if (age <= windowDays) {
    return Math.round((1 - age / windowDays) * 100)
  }

  return 0
}

export function normalizeSubscriptionSavings(price, subscriptionPrice) {
  if (!price || !subscriptionPrice || price <= 0) return null
  if (subscriptionPrice >= price) return 0

  const savingsPercent = ((price - subscriptionPrice) / price) * 100
  return Math.min(100, Math.round(savingsPercent * 5))
}

export function normalizeBadges(badges) {
  if (!badges || badges.length === 0) return 0

  let score = 0
  for (const badge of badges) {
    const type = badge.badge_type || badge.badgeType
    if (type === 'limited') score += 40
    if (type === 'price_friendly') score += 30
    if (type === 'new') score += 20
    if (type === 'award') score += 50
  }

  return Math.min(100, score)
}

export function normalizeAwards(badges) {
  if (!badges || badges.length === 0) return 0

  const hasAward = badges.some((b) => {
    const type = b.badge_type || b.badgeType
    return type === 'award'
  })

  return hasAward ? 100 : 0
}

export function normalizeBlogScore(cuppingScore) {
  if (cuppingScore == null) return null
  // SCA cupping scale: 0-100, but typical specialty is 80-95
  return Math.min(100, Math.max(0, cuppingScore))
}
