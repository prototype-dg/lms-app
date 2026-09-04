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

// ── Build version token — injected into every HTML page to bust stale cache ───
// DEPLOY_VERSION is replaced at build time by vite define; falls back to timestamp.
// Every new deploy produces a new token → URL ?v=<token> changes → browser cannot
// serve the old cached copy (different URL = cache miss).
const DEPLOY_VERSION = (typeof __DEPLOY_VERSION__ !== 'undefined')
  ? __DEPLOY_VERSION__
  : Date.now().toString(36)

// Cache-bust redirect script injected before </head> in every HTML response.
// If the page URL doesn't already carry ?v=<token>, we redirect to the versioned
// URL immediately — this forces a fresh fetch even on machines with deeply stale
// disk cache from before no-store was deployed.
const CACHE_BUST_SCRIPT = `
<script>
(function(){
  var V='${DEPLOY_VERSION}';
  var u=new URL(location.href);
  if(u.searchParams.get('v')!==V){
    u.searchParams.set('v',V);
    location.replace(u.toString());
  }
})();
</script>`

// ── HTML file handler — serves HTML with no-store headers + cache-bust redirect ─
import fs from 'node:fs'
import path from 'node:path'

app.use('*', async (c, next) => {
  const reqPath = c.req.path
  const isHtml = reqPath.endsWith('.html') || reqPath === '/' || reqPath === ''

  if (!isHtml) { await next(); return }

  // Map request path → dist file path
  const filePath = reqPath === '/' || reqPath === ''
    ? path.join(process.cwd(), 'dist', 'index.html')
    : path.join(process.cwd(), 'dist', reqPath)

  if (!fs.existsSync(filePath)) { await next(); return }

  let html = fs.readFileSync(filePath, 'utf-8')

  // Inject cache-bust redirect before </head>
  html = html.replace('</head>', CACHE_BUST_SCRIPT + '</head>')

  return c.html(html, 200, {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  })
})

// ── Static file serving — non-HTML assets (JS, CSS, images, fonts) ────────────
app.use('/*', serveStatic({ root: './dist' }))

// Export the Hono app — server startup is handled by server.js (not bundled)
// This keeps process.env.PORT readable at true runtime, not baked into the bundle
export default app
