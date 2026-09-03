/**
 * Azure/Node.js DB adapter — exposes the exact same interface as Cloudflare D1
 * (.prepare().bind().all() / .first() / .run()) so all 119 call sites in the
 * API layer are completely unchanged.
 */
import BetterSqlite3 from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

// Ensure the data directory exists (Azure /home persists across restarts)
const dbPath = process.env.DB_PATH || './data/app.db'
const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const sqlite = new BetterSqlite3(dbPath)

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

// Auto-apply migrations on startup — tracked via schema_migrations table
// so each file runs exactly once, even on a pre-existing /home/data/app.db
const MIGRATION_FILES = [
  './migrations/0001_initial.sql',
  './migrations/0002_seed.sql',
  './migrations/0003_portal_columns.sql',
  './migrations/0004_project_images.sql',
]

function runMigrations() {
  const migrationsDir = path.resolve('./migrations')
  if (!fs.existsSync(migrationsDir)) {
    console.log('[db-adapter] migrations/ directory not found — skipping auto-migration')
    return
  }

  // Create a migration-tracking table if it doesn't exist yet
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Adopt a pre-existing database: if schema_migrations is empty but the
  // products table already exists, the DB was migrated before tracking was
  // introduced. Mark all migrations whose side-effects are already present
  // as applied so they don't re-run against the evolved schema.
  const tracked = sqlite.prepare('SELECT COUNT(*) as n FROM schema_migrations').get() as { n: number }
  if (tracked.n === 0) {
    const productsExists = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='products'"
    ).get()
    if (productsExists) {
      // Check how many columns products already has
      const cols = sqlite.prepare("PRAGMA table_info(products)").all() as Array<{name: string}>
      const colCount = cols.length
      console.log(`[db-adapter] Adopting pre-existing DB (products has ${colCount} columns) — marking migrations as applied`)
      // Always mark 0001 (schema) and 0002 (seed) as done since the table exists
      sqlite.prepare('INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)').run('0001_initial.sql')
      sqlite.prepare('INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)').run('0002_seed.sql')
      // Mark 0003 (portal columns) as done if those columns are already present
      const hasPortalCol = cols.some(c => c.name === 'portal_visible')
      if (hasPortalCol) {
        sqlite.prepare('INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)').run('0003_portal_columns.sql')
      }
      // Mark 0004 (project_images) as done if that table/column exists
      const hasImagesTable = sqlite.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='project_images'"
      ).get()
      const projectCols = sqlite.prepare("PRAGMA table_info(projects)").all() as Array<{name: string}>
      const hasImageUrlCol = projectCols.some(c => c.name === 'image_urls')
      if (hasImagesTable || hasImageUrlCol) {
        sqlite.prepare('INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)').run('0004_project_images.sql')
      }
    }
  }

  console.log('[db-adapter] Running auto-migrations...')
  for (const file of MIGRATION_FILES) {
    const filePath = path.resolve(file)
    if (!fs.existsSync(filePath)) {
      console.log(`[db-adapter] Migration not found, skipping: ${file}`)
      continue
    }

    // Skip if already applied
    const filename = path.basename(file)
    const already = sqlite.prepare('SELECT 1 FROM schema_migrations WHERE filename = ?').get(filename)
    if (already) {
      console.log(`[db-adapter] Already applied, skipping: ${file}`)
      continue
    }

    try {
      const sql = fs.readFileSync(filePath, 'utf8')
      sqlite.exec(sql)
      sqlite.prepare('INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)').run(filename)
      console.log(`[db-adapter] Applied: ${file}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      // Swallow DDL-only "already exists" errors (e.g. CREATE TABLE on re-run without tracking)
      if (msg.includes('already exists') || msg.includes('duplicate column')) {
        sqlite.prepare('INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)').run(filename)
        console.log(`[db-adapter] Already applied (idempotent): ${file}`)
      } else {
        console.error(`[db-adapter] Error applying ${file}:`, msg)
        throw e
      }
    }
  }
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{name: string}>
  console.log('[db-adapter] Tables:', tables.map(t => t.name).join(', '))
}

runMigrations()

type Row = Record<string, unknown>

interface D1Result {
  results: Row[]
  success: boolean
  meta: { last_row_id: number; changes: number }
}

interface BoundStatement {
  all: () => Promise<D1Result>
  first: () => Promise<Row | null>
  run: () => Promise<D1Result>
}

interface PreparedStatement {
  bind: (...params: unknown[]) => BoundStatement
  all: () => Promise<D1Result>
  first: () => Promise<Row | null>
  run: () => Promise<D1Result>
}

function makeResult(stmt: BetterSqlite3.Statement, params: unknown[]): D1Result {
  try {
    const info = stmt.run(...params)
    return {
      results: [],
      success: true,
      meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes }
    }
  } catch (e) {
    throw e
  }
}

function makeStatement(sql: string, params: unknown[] = []): BoundStatement {
  return {
    all: async (): Promise<D1Result> => {
      const stmt = sqlite.prepare(sql)
      const results = stmt.all(...params) as Row[]
      return { results, success: true, meta: { last_row_id: 0, changes: 0 } }
    },
    first: async (): Promise<Row | null> => {
      const stmt = sqlite.prepare(sql)
      const row = stmt.get(...params) as Row | undefined
      return row ?? null
    },
    run: async (): Promise<D1Result> => {
      const stmt = sqlite.prepare(sql)
      return makeResult(stmt, params)
    }
  }
}

// The DB object — drop-in replacement for c.env.DB (Cloudflare D1Database)
export const DB = {
  prepare: (sql: string): PreparedStatement => ({
    bind: (...params: unknown[]): BoundStatement => makeStatement(sql, params),
    all:   () => makeStatement(sql, []).all(),
    first: () => makeStatement(sql, []).first(),
    run:   () => makeStatement(sql, []).run(),
  })
}

export type { D1Result }
export { sqlite }
