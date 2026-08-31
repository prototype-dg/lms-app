import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'

type Bindings = { DB: D1Database; OPENAI_API_KEY: string }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM products ORDER BY status, name'
  ).all()
  return c.json({ products: results })
})

app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ error: 'Not found' }, 404)
  const { results: rules } = await c.env.DB.prepare(
    'SELECT * FROM rules WHERE product_id = ? OR product_id IS NULL ORDER BY category, name'
  ).bind(id).all()
  return c.json({ product, rules })
})

app.post('/', async (c) => {
  const body = await c.req.json()
  const id = generateId('p')
  const ts = now()
  await c.env.DB.prepare(`
    INSERT INTO products (id, name, code, description, category, status, base_rate, max_ltv, max_dbr, 
    green_dbr, min_term, max_term, gsas_min_score, gsas_premium_score, green_discount_premium,
    green_discount_standard, ai_confidence_threshold, allow_byop, allow_partner_inventory,
    required_docs, esg_required_docs, approved_materials, approved_vendors, configuration, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, body.name, body.code || null, body.description || null, body.category || 'home_loan',
    body.status || 'draft', body.base_rate || 5.5, body.max_ltv || 90, body.max_dbr || 60,
    body.green_dbr || 55, body.min_term || 5, body.max_term || 25,
    body.gsas_min_score || 70, body.gsas_premium_score || 85,
    body.green_discount_premium || 0.75, body.green_discount_standard || 0.5,
    body.ai_confidence_threshold || 90, body.allow_byop ? 1 : 1, body.allow_partner_inventory ? 1 : 1,
    JSON.stringify(body.required_docs || []), JSON.stringify(body.esg_required_docs || []),
    JSON.stringify(body.approved_materials || []), JSON.stringify(body.approved_vendors || []),
    JSON.stringify(body.configuration || {}), body.created_by || 'u001', ts, ts
  ).run()
  await logAudit(c.env.DB, { userId: body.created_by || 'u001', userName: 'Fatima Al-Rashdi', userRole: 'product_manager', action: 'PRODUCT_CREATED', entityType: 'product', entityId: id, details: { name: body.name } })
  return c.json({ id, success: true })
})

app.post('/clone/:id', async (c) => {
  const sourceId = c.req.param('id')
  const body = await c.req.json()
  const source = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(sourceId).first() as any
  if (!source) return c.json({ error: 'Source not found' }, 404)
  const id = generateId('p')
  const ts = now()
  await c.env.DB.prepare(`
    INSERT INTO products (id, name, code, description, category, status, base_rate, max_ltv, max_dbr,
    green_dbr, min_term, max_term, min_amount, max_amount, gsas_min_score, gsas_premium_score, 
    green_discount_premium, green_discount_standard, ai_confidence_threshold, allow_byop, allow_partner_inventory,
    required_docs, esg_required_docs, approved_materials, approved_vendors, configuration, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, body.name || source.name + ' (Copy)', null, source.description, source.category,
    'draft', source.base_rate, source.max_ltv, source.max_dbr, source.green_dbr,
    source.min_term, source.max_term, source.min_amount, source.max_amount,
    source.gsas_min_score, source.gsas_premium_score, source.green_discount_premium,
    source.green_discount_standard, source.ai_confidence_threshold,
    source.allow_byop, source.allow_partner_inventory,
    source.required_docs, source.esg_required_docs, source.approved_materials,
    source.approved_vendors, source.configuration, body.user_id || 'u001', ts, ts
  ).run()
  await logAudit(c.env.DB, { userId: body.user_id || 'u001', userName: 'Fatima Al-Rashdi', userRole: 'product_manager', action: 'PRODUCT_CLONED', entityType: 'product', entityId: id, details: { from_id: sourceId, from_name: source.name, to_name: body.name } })
  return c.json({ id, success: true })
})

app.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const ts = now()
  const fields = Object.entries(body)
    .filter(([k]) => k !== 'user_id' && k !== 'user_name')
    .map(([k, v]) => `${k} = ?`)
    .join(', ')
  const values = Object.entries(body)
    .filter(([k]) => k !== 'user_id' && k !== 'user_name')
    .map(([, v]) => typeof v === 'object' ? JSON.stringify(v) : v)
  if (!fields) return c.json({ success: true })
  await c.env.DB.prepare(`UPDATE products SET ${fields}, updated_at = ? WHERE id = ?`)
    .bind(...values, ts, id).run()
  await logAudit(c.env.DB, { userId: body.user_id || 'u001', userName: body.user_name || 'Fatima Al-Rashdi', userRole: 'product_manager', action: 'PRODUCT_CONFIG_UPDATED', entityType: 'product', entityId: id, details: body })
  return c.json({ success: true })
})

app.post('/:id/publish', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  await c.env.DB.prepare('UPDATE products SET status = ?, updated_at = ? WHERE id = ?')
    .bind('active', now(), id).run()
  await logAudit(c.env.DB, { userId: body.user_id || 'u001', userName: body.user_name || 'Fatima Al-Rashdi', userRole: 'product_manager', action: 'PRODUCT_PUBLISHED', entityType: 'product', entityId: id, details: { status: 'active' } })
  return c.json({ success: true, status: 'active' })
})

app.get('/:id/rules', async (c) => {
  const id = c.req.param('id')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM rules WHERE product_id = ? OR product_id IS NULL ORDER BY category, name'
  ).bind(id).all()
  return c.json({ rules: results })
})

app.post('/:id/rules', async (c) => {
  const productId = c.req.param('id')
  const body = await c.req.json()
  const id = generateId('r')
  await c.env.DB.prepare(`
    INSERT INTO rules (id, product_id, name, category, metric, operator, threshold_value, 
    threshold_condition, action_on_breach, severity, regulatory_reference, source, ai_confidence,
    description, is_active, created_by, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, productId, body.name, body.category || 'general', body.metric,
    body.operator || '<=', body.threshold_value || null, body.threshold_condition || null,
    body.action_on_breach || 'reject', body.severity || 'hard',
    body.regulatory_reference || null, body.source || 'manual', body.ai_confidence || null,
    body.description || null, 1, body.user_id || 'u001', now()
  ).run()
  await logAudit(c.env.DB, { userId: body.user_id || 'u001', userName: 'Fatima Al-Rashdi', userRole: 'product_manager', action: 'RULE_CREATED', entityType: 'rule', entityId: id, details: body, source: body.source || 'manual', aiConfidence: body.ai_confidence })
  return c.json({ id, success: true })
})

export { app as productsApi }
