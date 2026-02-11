import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        'data/',
        'vitest.config.js',
        'src/frontend/**',
        'src/cli/**',
        'src/scrapers/sites/**',
        'src/scrapers/base-scraper.js',
        'src/scrapers/woocommerce-scraper.js',
        'src/scrapers/scraper-factory.js',
        'src/server/app.js'
      ]
    }
  }
})
