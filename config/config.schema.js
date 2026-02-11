import { z } from 'zod'

const shopSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  scraperKey: z.string().min(1),
  listingPath: z.string().min(1),
  hasRatings: z.boolean(),
  hasSubscriptions: z.boolean(),
  isBlog: z.boolean().optional().default(false)
})

const scrapingSchema = z.object({
  rateLimitMs: z.number().int().min(500).max(10000),
  retryAttempts: z.number().int().min(1).max(10),
  retryBackoffMs: z.number().int().min(100).max(10000),
  userAgent: z.string().min(1),
  timeoutMs: z.number().int().min(5000).max(60000)
})

const scoringWeightsSchema = z.object({
  priceValue: z.number().min(0).max(1),
  rating: z.number().min(0).max(1),
  originQuality: z.number().min(0).max(1),
  blogScore: z.number().min(0).max(1),
  freshness: z.number().min(0).max(1),
  awards: z.number().min(0).max(1),
  subscriptionSavings: z.number().min(0).max(1),
  specialBadges: z.number().min(0).max(1)
}).refine(
  (w) => {
    const sum = Object.values(w).reduce((a, b) => a + b, 0)
    return Math.abs(sum - 1.0) < 0.001
  },
  { message: 'Scoring weights must sum to 1.0' }
)

const priceTierSchema = z.object({
  maxPerKg: z.number().positive(),
  label: z.string().min(1)
})

const originTierSchema = z.object({
  score: z.number().int().min(0).max(100),
  countries: z.array(z.string().min(1))
})

const scoringSchema = z.object({
  weights: scoringWeightsSchema,
  priceTiers: z.object({
    budget: priceTierSchema,
    midRange: priceTierSchema,
    premium: priceTierSchema,
    ultraPremium: priceTierSchema
  }),
  freshnessWindowDays: z.number().int().min(1).max(365),
  originTiers: z.record(z.string(), originTierSchema)
})

const alertConfigSchema = z.object({
  minPercentage: z.number().min(0).max(100).optional(),
  severity: z.enum(['critical', 'high', 'info', 'low'])
})

const alertsSchema = z.object({
  priceDrop: alertConfigSchema,
  newProduct: alertConfigSchema,
  stockChange: alertConfigSchema,
  discountCode: alertConfigSchema
})

const serverSchema = z.object({
  port: z.number().int().min(1024).max(65535),
  host: z.string().min(1)
})

const databaseSchema = z.object({
  path: z.string().min(1)
})

const loggingSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
})

export const configSchema = z.object({
  scraping: scrapingSchema,
  shops: z.array(shopSchema).min(1),
  scoring: scoringSchema,
  alerts: alertsSchema,
  server: serverSchema,
  database: databaseSchema,
  logging: loggingSchema
})
