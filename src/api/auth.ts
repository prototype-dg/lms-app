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
  const token = getTokenFromRequest(c)
  if (!token) return c.json({ error: 'Not authenticated' }, 401)

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
})

export { app as authApi }
