/**
 * auth.ts — Portal authentication API
 *
 * Routes (all under /api/v1/auth):
 *   POST /login          { login, password } → { token, user }
 *   POST /logout         Cookie-clear
 *   GET  /me             Returns session user from cookie token
 *
 * Storage: portal_users + portal_sessions tables (SQLite via D1)
 * Password hashing: SHA-256 (Web Crypto API — works in both Node & CF Workers)
 * Session: HttpOnly cookie "ps_token", 8h expiry
 */

import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now } from '../lib/db'

const app = new Hono<{ Bindings: NodeBindings }>()

const COOKIE_NAME = 'ps_token'
const SESSION_HOURS = 8

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function setSessionCookie(c: any, token: string, expiresAt: string) {
  const expires = new Date(expiresAt).toUTCString()
  c.header('Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires}`)
}

function clearSessionCookie(c: any) {
  c.header('Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`)
}

function getTokenFromRequest(c: any): string | null {
  const cookieHeader = c.req.header('Cookie') || ''
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
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

  setSessionCookie(c, token, expiresAt)

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
  clearSessionCookie(c)
  return c.json({ success: true })
})

// GET /me — returns current user from session token
app.get('/me', async (c) => {
  const token = getTokenFromRequest(c)
  if (!token) return c.json({ error: 'Not authenticated' }, 401)

  const session = await c.env.DB.prepare(
    `SELECT * FROM portal_sessions WHERE token = ? AND expires_at > datetime('now')`
  ).bind(token).first() as any

  if (!session) {
    clearSessionCookie(c)
    return c.json({ error: 'Session expired' }, 401)
  }

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
