export function getOriginScore(country, originTiers) {
  if (!country) return null

  const normalizedCountry = country.trim().toLowerCase()

  for (const [, tier] of Object.entries(originTiers)) {
    const match = tier.countries.find(
      (c) => c.toLowerCase() === normalizedCountry
    )
    if (match) {
      return tier.score
    }
  }

  // Default to C tier for unknown origins
  return 55
}
