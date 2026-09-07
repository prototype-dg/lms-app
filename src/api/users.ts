import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now } from '../lib/db'
const app = new Hono<{ Bindings: NodeBindings }>()

// List all users (for backoffice role-switcher user registry)
app.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, name_ar, email, role, department, avatar_initials, status
     FROM users WHERE status != 'inactive' ORDER BY id`
  ).all()
  return c.json({ users: results })
})

app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json({ user })
})

// Get customer data
app.get('/customer/:customerId', async (c) => {
  const id = c.req.param('customerId')
  const customer = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first()
  if (!customer) return c.json({ error: 'Not found' }, 404)
  const { results: apps } = await c.env.DB.prepare(
    `SELECT a.*, p.name as product_name FROM applications a LEFT JOIN products p ON a.product_id = p.id WHERE a.customer_id = ? ORDER BY a.created_at DESC`
  ).bind(id).all()
  return c.json({ customer, applications: apps })
})

// ── Portal Users (authentication accounts) CRUD ───────────────────────────
app.get('/portal', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, login, display_name, role, portal_access, allowed_sections, status, created_at, last_login
     FROM portal_users ORDER BY role, login`
  ).all()
  return c.json({ users: results || [] })
})

app.post('/portal', async (c) => {
  const body = await c.req.json() as any
  const { login, password, display_name, role, portal_access, allowed_sections } = body
  if (!login || !password || !role) return c.json({ error: 'login, password, role required' }, 400)

  const hash = await sha256(password)
  const id = generateId('pu')
  await c.env.DB.prepare(`
    INSERT INTO portal_users (id, login, password_hash, display_name, role, portal_access, allowed_sections, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).bind(id, login, hash, display_name || login, role, portal_access || 'backoffice', JSON.stringify(allowed_sections || []), now()).run()
  return c.json({ success: true, id })
})

app.patch('/portal/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json() as any
  const { display_name, role, portal_access, allowed_sections, status, password } = body

  if (password) {
    const hash = await sha256(password)
    await c.env.DB.prepare(`UPDATE portal_users SET password_hash = ? WHERE id = ?`).bind(hash, id).run()
  }
  if (display_name !== undefined) await c.env.DB.prepare(`UPDATE portal_users SET display_name = ? WHERE id = ?`).bind(display_name, id).run()
  if (role !== undefined) await c.env.DB.prepare(`UPDATE portal_users SET role = ? WHERE id = ?`).bind(role, id).run()
  if (portal_access !== undefined) await c.env.DB.prepare(`UPDATE portal_users SET portal_access = ? WHERE id = ?`).bind(portal_access, id).run()
  if (allowed_sections !== undefined) await c.env.DB.prepare(`UPDATE portal_users SET allowed_sections = ? WHERE id = ?`).bind(JSON.stringify(allowed_sections), id).run()
  if (status !== undefined) await c.env.DB.prepare(`UPDATE portal_users SET status = ? WHERE id = ?`).bind(status, id).run()

  return c.json({ success: true })
})

app.delete('/portal/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare(`UPDATE portal_users SET status = 'inactive' WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export { app as usersApi }
