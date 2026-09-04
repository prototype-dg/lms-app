import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'

const app = new Hono<{ Bindings: NodeBindings }>()

// ── List matrices (optionally filtered by product) ───────────────────────────
app.get('/', async (c) => {
  const productId = c.req.query('product_id')
  const marketId  = c.req.query('market_id')

  let sql = 'SELECT * FROM rule_matrices WHERE 1=1'
  const params: any[] = []

  if (productId) { sql += ' AND product_id = ?'; params.push(productId) }
  if (marketId)  { sql += ' AND market_id = ?';  params.push(marketId) }
  sql += ' ORDER BY name ASC'

  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql)
  const { results } = await stmt.all()
  return c.json({ matrices: results, total: results.length })
})

// ── Get single matrix ────────────────────────────────────────────────────────
app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const matrix = await c.env.DB.prepare('SELECT * FROM rule_matrices WHERE id = ?').bind(id).first()
  if (!matrix) return c.json({ error: 'Matrix not found' }, 404)
  return c.json({ matrix })
})

// ── Create matrix ────────────────────────────────────────────────────────────
app.post('/', async (c) => {
  const body = await c.req.json() as any
  const id = generateId('rm')
  const ts = now()

  await c.env.DB.prepare(`
    INSERT INTO rule_matrices (
      id, product_id, market_id, name, name_ar, description, description_ar,
      row_dimension, row_dimension_label, row_dimension_ar,
      col_dimension, col_dimension_label, col_dimension_ar,
      grid_data, output_metric, output_unit,
      is_active, regulatory_reference, source, ai_confidence,
      created_by, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id,
    body.product_id || null, body.market_id || null,
    body.name, body.name_ar || null,
    body.description || null, body.description_ar || null,
    body.row_dimension, body.row_dimension_label || body.row_dimension,
    body.row_dimension_ar || null,
    body.col_dimension || null, body.col_dimension_label || null,
    body.col_dimension_ar || null,
    JSON.stringify(body.grid_data || []),
    body.output_metric, body.output_unit || null,
    body.is_active !== false ? 1 : 0,
    body.regulatory_reference || null,
    body.source || 'manual',
    body.ai_confidence || null,
    body.created_by || 'u001', ts, ts
  ).run()

  await logAudit(c.env.DB, {
    userId: body.created_by || 'u001',
    userName: body.user_name || 'System',
    userRole: body.user_role || 'product_manager',
    action: 'RULE_MATRIX_CREATED',
    entityType: 'rule_matrix',
    entityId: id,
    details: { name: body.name, product_id: body.product_id }
  })

  return c.json({ id, success: true })
})

// ── Update matrix (including grid_data) ─────────────────────────────────────
app.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json() as any
  const ts = now()

  const matrix = await c.env.DB.prepare('SELECT * FROM rule_matrices WHERE id = ?').bind(id).first()
  if (!matrix) return c.json({ error: 'Matrix not found' }, 404)

  const fields: string[] = []
  const params: any[] = []

  const updateField = (col: string, val: any) => {
    if (val !== undefined) { fields.push(`${col} = ?`); params.push(val) }
  }

  updateField('name', body.name)
  updateField('name_ar', body.name_ar)
  updateField('description', body.description)
  updateField('description_ar', body.description_ar)
  updateField('row_dimension', body.row_dimension)
  updateField('row_dimension_label', body.row_dimension_label)
  updateField('row_dimension_ar', body.row_dimension_ar)
  updateField('col_dimension', body.col_dimension)
  updateField('col_dimension_label', body.col_dimension_label)
  updateField('col_dimension_ar', body.col_dimension_ar)
  updateField('output_metric', body.output_metric)
  updateField('output_unit', body.output_unit)
  updateField('regulatory_reference', body.regulatory_reference)
  updateField('is_active', body.is_active !== undefined ? (body.is_active ? 1 : 0) : undefined)
  if (body.grid_data !== undefined) {
    fields.push('grid_data = ?')
    params.push(JSON.stringify(body.grid_data))
  }

  if (fields.length === 0) return c.json({ success: true, message: 'No changes' })

  fields.push('updated_at = ?'); params.push(ts)
  params.push(id)

  await c.env.DB.prepare(
    `UPDATE rule_matrices SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...params).run()

  await logAudit(c.env.DB, {
    userId: body.user_id || 'u001',
    userName: body.user_name || 'System',
    userRole: body.user_role || 'product_manager',
    action: 'RULE_MATRIX_UPDATED',
    entityType: 'rule_matrix',
    entityId: id,
    details: { name: body.name || (matrix as any).name }
  })

  return c.json({ success: true })
})

// ── Delete matrix ─────────────────────────────────────────────────────────────
app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({})) as any

  const matrix = await c.env.DB.prepare('SELECT * FROM rule_matrices WHERE id = ?').bind(id).first() as any
  if (!matrix) return c.json({ error: 'Matrix not found' }, 404)

  await c.env.DB.prepare('DELETE FROM rule_matrices WHERE id = ?').bind(id).run()

  await logAudit(c.env.DB, {
    userId: body.user_id || 'u001',
    userName: body.user_name || 'System',
    userRole: body.user_role || 'product_manager',
    action: 'RULE_MATRIX_DELETED',
    entityType: 'rule_matrix',
    entityId: id,
    details: { name: matrix.name }
  })

  return c.json({ success: true })
})

// ── Evaluate a matrix against input values ────────────────────────────────────
// Used by the Rule Sandbox to test a matrix with mock data
app.post('/:id/evaluate', async (c) => {
  const id = c.req.param('id')
  const { inputs } = await c.req.json() as any

  const matrix = await c.env.DB.prepare('SELECT * FROM rule_matrices WHERE id = ?').bind(id).first() as any
  if (!matrix) return c.json({ error: 'Matrix not found' }, 404)

  let grid: any[] = []
  try { grid = JSON.parse(matrix.grid_data || '[]') } catch { grid = [] }

  const rowVal = inputs?.[matrix.row_dimension]
  const colVal = matrix.col_dimension ? inputs?.[matrix.col_dimension] : null

  // Find matching cell
  const match = grid.find((cell: any) => {
    const rowMatch = cell.row_key === rowVal ||
      (cell.row_min !== undefined && cell.row_max !== undefined &&
        Number(rowVal) >= Number(cell.row_min) && Number(rowVal) <= Number(cell.row_max))
    if (!matrix.col_dimension) return rowMatch
    const colMatch = cell.col_key === colVal ||
      (cell.col_min !== undefined && cell.col_max !== undefined &&
        Number(colVal) >= Number(cell.col_min) && Number(colVal) <= Number(cell.col_max))
    return rowMatch && colMatch
  })

  return c.json({
    matched: !!match,
    result: match ? match.value : null,
    result_label: match ? match.label : null,
    output_metric: matrix.output_metric,
    output_unit: matrix.output_unit,
    inputs,
    message: match
      ? `Match found: ${matrix.output_metric} = ${match.value}${matrix.output_unit || ''}`
      : 'No matching cell for the provided inputs'
  })
})

export { app as ruleMatricesApi }
