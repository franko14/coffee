import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createChildLogger } from '../utils/logger.js'

const log = createChildLogger('db')

let db = null

export function getDb(dbPath) {
  if (db) {
    return db
  }

  const resolvedPath = resolve(dbPath)
  mkdirSync(dirname(resolvedPath), { recursive: true })

  db = new Database(resolvedPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  log.info({ path: resolvedPath }, 'Database connected')
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
    log.info('Database closed')
  }
}

export function resetDbInstance() {
  db = null
}
