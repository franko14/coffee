import { readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createChildLogger } from '../utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = resolve(__dirname, 'migrations')

const log = createChildLogger('migrator')

export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r) => r.name)
  )

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const insertMigration = db.prepare('INSERT INTO _migrations (name) VALUES (?)')

  for (const file of files) {
    if (applied.has(file)) {
      log.debug({ file }, 'Migration already applied')
      continue
    }

    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8')

    db.transaction(() => {
      db.exec(sql)
      insertMigration.run(file)
    })()

    log.info({ file }, 'Migration applied')
  }

  return files.length - applied.size
}
