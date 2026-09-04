import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'

// DB adapter — replaces Cloudflare D1 binding
import { DB } from './lib/db-adapter'

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
import { marketsApi } from './api/markets'
import { ruleMatricesApi } from './api/rule-matrices'
import { productVersionsApi } from './api/product-versions'
import { complianceTagsApi } from './api/compliance-tags'
import { workflowTemplatesApi } from './api/workflow-templates'

// Node.js env — replaces Cloudflare Bindings
export const env = {
  DB,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GOOGLE_VISION_API_KEY: process.env.GOOGLE_VISION_API_KEY || '',
  DEMO_MODE: process.env.DEMO_MODE || 'true',
}

const app = new Hono()

app.use('/api/*', cors())

// Inject env into every request context so existing API handlers work unchanged
app.use('*', async (c, next) => {
  c.set('env', env)
  // Attach as c.env for backward compat with handlers that use c.env.DB etc.
  Object.assign(c, { env })
  await next()
})

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
app.route('/api/v1/markets', marketsApi)
app.route('/api/v1/rule-matrices', ruleMatricesApi)
app.route('/api/v1/compliance-tags', complianceTagsApi)
app.route('/api/v1/workflow-templates', workflowTemplatesApi)
// Product versions are nested under products path
app.route('/api/v1', productVersionsApi)

// ── Image proxy ──────────────────────────────────────────────────────────────
app.get('/api/v1/img-proxy', async (c) => {
  const url = c.req.query('url')
  if (!url || !url.startsWith('https://www.genspark.ai/')) {
    return c.text('Invalid URL', 400)
  }
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return c.text('Image fetch failed', 502)
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buf = await res.arrayBuffer()
    return new Response(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch {
    return c.text('Proxy error', 502)
  }
})

// ── Standalone rules endpoint ─────────────────────────────────────────────────
app.get('/api/v1/rules', async (c) => {
  const productId = c.req.query('product_id')
  const category = c.req.query('category')
  let sql = 'SELECT * FROM rules WHERE 1=1'
  const params: string[] = []
  if (productId) { sql += ' AND (product_id = ? OR product_id IS NULL)'; params.push(productId) }
  if (category) { sql += ' AND category = ?'; params.push(category) }
  sql += ' ORDER BY category, name'
  const stmt = params.length ? DB.prepare(sql).bind(...params) : DB.prepare(sql)
  const { results } = await stmt.all()
  return c.json({ rules: results, total: results.length })
})

// ── Standalone customers endpoint ─────────────────────────────────────────────
app.get('/api/v1/customers', async (c) => {
  const { results } = await DB.prepare('SELECT * FROM customers ORDER BY name').all()
  return c.json({ customers: results, total: results.length })
})
app.get('/api/v1/customers/:id', async (c) => {
  const id = c.req.param('id')
  const customer = await DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first()
  if (!customer) return c.json({ error: 'Not found' }, 404)
  return c.json({ customer })
})

// ── Build version token — baked in at build time by vite define ──────────────
// Every new deploy produces a new token. The server redirects bare HTML URLs
// to ?v=<token> so the browser always fetches a URL it has never cached before.
const DEPLOY_VERSION = (typeof __DEPLOY_VERSION__ !== 'undefined')
  ? __DEPLOY_VERSION__
  : Date.now().toString(36)

// ── HTML file handler — server-side 302 redirect for cache busting ────────────
// Strategy:
//   1. Request arrives without ?v= or with a stale ?v= → server issues a 302
//      to the same path with ?v=<DEPLOY_VERSION>. The browser follows the
//      redirect to a URL it has never seen → guaranteed cache miss → fresh file.
//   2. Request arrives with the correct ?v= → serve the file with no-store so
//      it is never written to disk cache again.
//
// This is 100% server-side — no client script injection, no Vite interference.
import fs from 'node:fs'
import nodePath from 'node:path'

app.use('*', async (c, next) => {
  const reqPath = c.req.path
  // Only redirect versioned cache-bust for portal HTML files — not root or API
  const isPortalHtml = reqPath.endsWith('.html') && reqPath.startsWith('/portals/')
  if (!isPortalHtml) { await next(); return }

  // Map request path → dist file on disk
  const filePath = nodePath.join(process.cwd(), 'dist', reqPath)

  if (!fs.existsSync(filePath)) { await next(); return }

  const v = c.req.query('v')

  // Wrong / missing version → redirect to versioned URL (cache miss guaranteed)
  if (v !== DEPLOY_VERSION) {
    // Build redirect URL safely — c.req.url may be a relative path on Node.js
    const base = c.req.url.startsWith('http') ? c.req.url : `http://localhost${c.req.url}`
    const url = new URL(base)
    url.searchParams.set('v', DEPLOY_VERSION)
    // Return just path+search (no host) so it works behind any domain / proxy
    // Clear-Site-Data wipes the entire browser cache for this origin on the
    // redirect response itself — covers Chrome, Safari, Edge, Firefox.
    return c.newResponse(null, 302, {
      'Location': url.pathname + url.search,
      'Clear-Site-Data': '"cache", "cookies", "storage"',
      'Cache-Control': 'no-store',
    })
  }

  // Correct version → serve with no-store (never cache again)
  const html = fs.readFileSync(filePath, 'utf-8')
  return c.html(html, 200, {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Clear-Site-Data': '"cache"',
  })
})

// ── Static file serving — non-HTML assets (JS, CSS, images, fonts) ────────────
app.use('/*', serveStatic({ root: './dist' }))

// Export the Hono app — server startup is handled by server.js (not bundled)
// This keeps process.env.PORT readable at true runtime, not baked into the bundle
export default app
