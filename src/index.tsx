import { Hono } from 'hono'
import { cors } from 'hono/cors'

// API route handlers
import { productsApi } from './api/products'
import { applicationsApi } from './api/applications'
import { aiApi } from './api/ai'
import { complianceApi } from './api/compliance'
import { projectsApi } from './api/projects'
import { documentsApi } from './api/documents'
import { escrowApi } from './api/escrow'
import { auditApi } from './api/audit'
import { usersApi } from './api/users'
import { seedApi } from './api/seed'
import { portalApi } from './api/portal'

type Bindings = {
  DB: D1Database
  ASSETS: Fetcher
  OPENAI_API_KEY: string
  GOOGLE_VISION_API_KEY: string
  VPS_URL: string
  DEMO_MODE: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// Mount API routes
app.route('/api/v1/products', productsApi)
app.route('/api/v1/applications', applicationsApi)
app.route('/api/v1/ai', aiApi)
app.route('/api/v1/compliance', complianceApi)
app.route('/api/v1/projects', projectsApi)
app.route('/api/v1/documents', documentsApi)
app.route('/api/v1/escrow', escrowApi)
app.route('/api/v1/audit', auditApi)
app.route('/api/v1/users', usersApi)
app.route('/api/v1/seed', seedApi)
app.route('/api/v1/portal', portalApi)

// Standalone rules endpoint (all rules, or filter by product)
app.get('/api/v1/rules', async (c) => {
  const productId = c.req.query('product_id')
  const category = c.req.query('category')
  let sql = 'SELECT * FROM rules WHERE 1=1'
  const params: string[] = []
  if (productId) { sql += ' AND (product_id = ? OR product_id IS NULL)'; params.push(productId) }
  if (category) { sql += ' AND category = ?'; params.push(category) }
  sql += ' ORDER BY category, name'
  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql)
  const { results } = await stmt.all()
  return c.json({ rules: results, total: results.length })
})

// Standalone customers endpoint
app.get('/api/v1/customers', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM customers ORDER BY name').all()
  return c.json({ customers: results, total: results.length })
})
app.get('/api/v1/customers/:id', async (c) => {
  const id = c.req.param('id')
  const customer = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first()
  if (!customer) return c.json({ error: 'Not found' }, 404)
  return c.json({ customer })
})

// All non-API routes: serve via Cloudflare ASSETS binding.
// This handles /, /index.html, /portals/*, /static/*, etc.
// The ASSETS binding serves index.html for / automatically (no redirect needed).
app.all('*', async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw)
  return response
})

export default app
