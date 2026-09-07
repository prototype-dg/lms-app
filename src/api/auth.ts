/**
 * auth.ts — Portal authentication API
 *
 * Routes (all under /api/v1/auth):
 *   POST /login   { login, password } → { token, user }
 *   POST /logout  (clears server session)
 *   GET  /me      token from Authorization: Bearer header → { user }
 *
 * Token stored in localStorage on the client — no cookies, no CORS issues.
 */

import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now } from '../lib/db'

const app = new Hono<{ Bindings: NodeBindings }>()

const SESSION_HOURS = 8

// Ensure tables exist — runs once on first request, idempotent thereafter
let _tablesReady = false
async function ensureTables(db: any) {
  if (_tablesReady) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS portal_users (
    id TEXT PRIMARY KEY, login TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL, role TEXT NOT NULL, portal_access TEXT NOT NULL,
    allowed_sections TEXT DEFAULT '[]', status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')), last_login TEXT
  )`).run().catch(() => {})
  await db.prepare(`CREATE TABLE IF NOT EXISTS portal_sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL, login TEXT NOT NULL,
    role TEXT NOT NULL, portal_access TEXT NOT NULL, allowed_sections TEXT DEFAULT '[]',
    expires_at TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  )`).run().catch(() => {})
  // Seed default users if table is empty
  const count = await db.prepare('SELECT COUNT(*) as n FROM portal_users').first() as any
  if (!count || count.n === 0) {
    const H = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8' // "password"
    const users = [
      ['pu001','customer01',H,'Salim Al-Harthy','customer','customer','[]'],
      ['pu002','pm01',H,'Fatima Al-Rashdi','product_manager','backoffice','["products","applications","rules","workflows","users","ai_studio"]'],
      ['pu003','compliance01',H,'Aisha Al-Balushi','compliance_officer','backoffice','["compliance"]'],
      ['pu004','rm01',H,'Omar Al-Mantheri','risk_officer','backoffice','["risk"]'],
      ['pu005','admin',H,'System Administrator','admin','all','[]'],
      ['pu006','developer01',H,'Ahmed Al-Hinai','developer','developer','[]'],
    ]
    for (const [id,login,hash,name,role,access,secs] of users) {
      await db.prepare(`INSERT OR IGNORE INTO portal_users (id,login,password_hash,display_name,role,portal_access,allowed_sections,status,created_at)
        VALUES (?,?,?,?,?,?,?,'active','2024-01-01')`).bind(id,login,hash,name,role,access,secs).run().catch(() => {})
    }
  }
  _tablesReady = true
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getTokenFromRequest(c: any): string | null {
  // Authorization: Bearer <token>
  const auth = c.req.header('Authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
  return null
}

// POST /login
app.post('/login', async (c) => {
  await ensureTables(c.env.DB)
  const { login, password } = await c.req.json().catch(() => ({})) as any
  if (!login || !password) return c.json({ error: 'login and password required' }, 400)

  const hash = await sha256(password)
  const user = await c.env.DB.prepare(
    `SELECT * FROM portal_users WHERE login = ? AND password_hash = ? AND status = 'active'`
  ).bind(login, hash).first() as any

  if (!user) return c.json({ error: 'Invalid credentials' }, 401)

  const token     = generateId('tok')
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString()
  const ts        = now()

  await c.env.DB.prepare(`
    INSERT INTO portal_sessions (token, user_id, login, role, portal_access, allowed_sections, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(token, user.id, user.login, user.role, user.portal_access, user.allowed_sections || '[]', expiresAt, ts).run()

  await c.env.DB.prepare(`UPDATE portal_users SET last_login = ? WHERE id = ?`).bind(ts, user.id).run()

  return c.json({
    success:  true,
    token,
    user: {
      id:               user.id,
      login:            user.login,
      display_name:     user.display_name,
      role:             user.role,
      portal_access:    user.portal_access,
      allowed_sections: JSON.parse(user.allowed_sections || '[]'),
    }
  })
})

// POST /logout
app.post('/logout', async (c) => {
  const token = getTokenFromRequest(c)
  if (token) {
    await c.env.DB.prepare(`DELETE FROM portal_sessions WHERE token = ?`).bind(token).run().catch(() => {})
  }
  return c.json({ success: true })
})

// GET /me
app.get('/me', async (c) => {
  await ensureTables(c.env.DB)
  const token = getTokenFromRequest(c)
  if (!token) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const session = await c.env.DB.prepare(
      `SELECT * FROM portal_sessions WHERE token = ? AND expires_at > datetime('now')`
    ).bind(token).first() as any

    if (!session) return c.json({ error: 'Session expired' }, 401)

    return c.json({
      user: {
        id:               session.user_id,
        login:            session.login,
        role:             session.role,
        portal_access:    session.portal_access,
        allowed_sections: JSON.parse(session.allowed_sections || '[]'),
      }
    })
  } catch (e: any) {
    console.error('[auth/me] DB error:', e.message)
    return c.json({ error: 'DB error: ' + e.message }, 503)
  }
})

export { app as authApi }
