import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
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

export { app as usersApi }
