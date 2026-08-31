import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

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

type Bindings = {
  DB: D1Database
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

// Serve static files
app.use('/assets/*', serveStatic({ root: './' }))

// Root redirect to index.html (static file served by Pages)
app.get('/', (c) => c.redirect('/index.html', 302))

// All other non-API routes redirect to index.html
app.get('*', (c) => c.redirect('/index.html', 302))

export default app
