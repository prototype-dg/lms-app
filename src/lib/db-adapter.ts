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
