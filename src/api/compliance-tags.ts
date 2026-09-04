import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'

const app = new Hono<{ Bindings: NodeBindings }>()

// ── List tags (filterable by market, category) ────────────────────────────────
app.get('/', async (c) => {
  const marketId = c.req.query('market_id')
  const category = c.req.query('category')
  const productCategory = c.req.query('product_category')

  let sql = 'SELECT * FROM compliance_tags WHERE 1=1'
  const params: any[] = []

  if (marketId)  { sql += ' AND (market_id = ? OR market_id IS NULL)'; params.push(marketId) }
  if (category)  { sql += ' AND category = ?'; params.push(category) }
  sql += ' ORDER BY category, name ASC'

  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql)
  let { results } = await stmt.all() as any

  // Filter by product category if requested
  if (productCategory) {
    results = results.filter((t: any) => {
      try {
        const applies = JSON.parse(t.applies_to || '[]')
        return applies.length === 0 || applies.includes(productCategory)
      } catch { return true }
    })
  }

  return c.json({ tags: results, total: results.length })
})

// ── Get tags for a specific product ──────────────────────────────────────────
app.get('/product/:productId', async (c) => {
  const productId = c.req.param('productId')
  const { results } = await c.env.DB.prepare(`
    SELECT ct.*, pct.mapped_at, pct.mapped_by
    FROM compliance_tags ct
    JOIN product_compliance_tags pct ON pct.tag_id = ct.id
    WHERE pct.product_id = ?
    ORDER BY ct.category, ct.name
  `).bind(productId).all()
  return c.json({ tags: results, total: results.length })
})

// ── Get gap analysis for a product ───────────────────────────────────────────
// Returns tags that SHOULD apply based on product category but are NOT mapped
app.get('/product/:productId/gap-analysis', async (c) => {
  const productId = c.req.param('productId')

  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first() as any
  if (!product) return c.json({ error: 'Product not found' }, 404)

  // All mandatory tags for this market + product category
  const { results: allTags } = await c.env.DB.prepare(`
    SELECT * FROM compliance_tags
    WHERE (market_id = ? OR market_id IS NULL)
    AND severity = 'mandatory'
    AND is_active = 1
  `).bind(product.market_id || 'mkt001').all() as any

  // Currently mapped tags
  const { results: mappedTags } = await c.env.DB.prepare(`
    SELECT tag_id FROM product_compliance_tags WHERE product_id = ?
  `).bind(productId).all() as any
  const mappedIds = new Set(mappedTags.map((t: any) => t.tag_id))

  // Filter to applicable + unmapped
  const gaps = allTags.filter((tag: any) => {
    if (mappedIds.has(tag.id)) return false
    try {
      const applies = JSON.parse(tag.applies_to || '[]')
      return applies.length === 0 || applies.includes(product.category)
    } catch { return false }
  })

  const coverage = allTags.filter((tag: any) => {
    try {
      const applies = JSON.parse(tag.applies_to || '[]')
      return applies.length === 0 || applies.includes(product.category)
    } catch { return false }
  })

  const coveredCount = coverage.filter((t: any) => mappedIds.has(t.id)).length

  return c.json({
    gaps,
    gaps_count: gaps.length,
    covered_count: coveredCount,
    total_applicable: coverage.length,
    coverage_pct: coverage.length > 0 ? Math.round((coveredCount / coverage.length) * 100) : 100
  })
})

// ── Map a tag to a product ────────────────────────────────────────────────────
app.post('/product/:productId/map', async (c) => {
  const productId = c.req.param('productId')
  const body = await c.req.json() as any
  const { tag_ids, user_id, user_name } = body

  if (!tag_ids?.length) return c.json({ error: 'tag_ids array is required' }, 400)

  for (const tagId of tag_ids) {
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO product_compliance_tags (product_id, tag_id, mapped_by, mapped_at)
      VALUES (?,?,?,?)
    `).bind(productId, tagId, user_id || 'u001', now()).run()
  }

  await logAudit(c.env.DB, {
    userId: user_id || 'u001',
    userName: user_name || 'System',
    userRole: 'product_manager',
    action: 'COMPLIANCE_TAGS_MAPPED',
    entityType: 'product',
    entityId: productId,
    details: { tag_ids }
  })

  return c.json({ success: true, mapped_count: tag_ids.length })
})

// ── Unmap a tag from a product ────────────────────────────────────────────────
app.delete('/product/:productId/map/:tagId', async (c) => {
  const { productId, tagId } = c.req.param()
  const body = await c.req.json().catch(() => ({})) as any

  await c.env.DB.prepare(
    'DELETE FROM product_compliance_tags WHERE product_id = ? AND tag_id = ?'
  ).bind(productId, tagId).run()

  await logAudit(c.env.DB, {
    userId: body.user_id || 'u001',
    userName: body.user_name || 'System',
    userRole: 'product_manager',
    action: 'COMPLIANCE_TAG_UNMAPPED',
    entityType: 'product',
    entityId: productId,
    details: { tag_id: tagId }
  })

  return c.json({ success: true })
})

// ── CRUD for tag library ──────────────────────────────────────────────────────
app.post('/', async (c) => {
  const body = await c.req.json() as any
  const id = generateId('ct')
  const ts = now()

  await c.env.DB.prepare(`
    INSERT INTO compliance_tags (
      id, market_id, code, name, name_ar, description, description_ar,
      category, regulatory_reference, severity, applies_to, is_active, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, body.market_id || 'mkt001',
    body.code?.toUpperCase() || id,
    body.name, body.name_ar || null,
    body.description || null, body.description_ar || null,
    body.category || 'general',
    body.regulatory_reference || null,
    body.severity || 'mandatory',
    JSON.stringify(body.applies_to || []),
    1, ts
  ).run()

  return c.json({ id, success: true })
})

app.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json() as any

  const fields: string[] = []
  const params: any[] = []
  const u = (col: string, val: any) => { if (val !== undefined) { fields.push(`${col} = ?`); params.push(val) } }

  u('name', body.name); u('name_ar', body.name_ar)
  u('description', body.description); u('description_ar', body.description_ar)
  u('category', body.category); u('regulatory_reference', body.regulatory_reference)
  u('severity', body.severity)
  if (body.applies_to !== undefined) { fields.push('applies_to = ?'); params.push(JSON.stringify(body.applies_to)) }
  if (body.is_active !== undefined) { fields.push('is_active = ?'); params.push(body.is_active ? 1 : 0) }

  if (!fields.length) return c.json({ success: true })
  params.push(id)
  await c.env.DB.prepare(`UPDATE compliance_tags SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run()
  return c.json({ success: true })
})

app.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM compliance_tags WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

export { app as complianceTagsApi }
