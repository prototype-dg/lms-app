import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'

const app = new Hono<{ Bindings: NodeBindings }>()

// ── List templates ─────────────────────────────────────────────────────────────
app.get('/', async (c) => {
  const marketId = c.req.query('market_id')
  const category = c.req.query('category')

  let sql = 'SELECT id, market_id, name, name_ar, description, description_ar, category, is_system, is_active, created_by, created_at FROM workflow_templates WHERE 1=1'
  const params: any[] = []
  if (marketId) { sql += ' AND (market_id = ? OR market_id IS NULL)'; params.push(marketId) }
  if (category) { sql += ' AND category = ?'; params.push(category) }
  sql += ' ORDER BY is_system DESC, name ASC'

  const stmt = params.length ? c.env.DB.prepare(sql).bind(...params) : c.env.DB.prepare(sql)
  const { results } = await stmt.all()
  return c.json({ templates: results, total: results.length })
})

// ── Get single template (with full nodes/edges) ────────────────────────────────
app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const template = await c.env.DB.prepare('SELECT * FROM workflow_templates WHERE id = ?').bind(id).first()
  if (!template) return c.json({ error: 'Template not found' }, 404)
  return c.json({ template })
})

// ── Create template ────────────────────────────────────────────────────────────
app.post('/', async (c) => {
  const body = await c.req.json() as any
  const id = generateId('wft')
  const ts = now()

  await c.env.DB.prepare(`
    INSERT INTO workflow_templates (
      id, market_id, name, name_ar, description, description_ar, category,
      nodes, edges, is_system, is_active, created_by, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id,
    body.market_id || 'mkt001',
    body.name, body.name_ar || null,
    body.description || null, body.description_ar || null,
    body.category || 'general',
    JSON.stringify(body.nodes || []),
    JSON.stringify(body.edges || []),
    0,  // user-created templates are never system templates
    1,
    body.created_by || 'u001', ts, ts
  ).run()

  await logAudit(c.env.DB, {
    userId: body.created_by || 'u001',
    userName: body.user_name || 'System',
    userRole: body.user_role || 'product_manager',
    action: 'WORKFLOW_TEMPLATE_CREATED',
    entityType: 'workflow_template',
    entityId: id,
    details: { name: body.name }
  })

  return c.json({ id, success: true })
})

// ── Update template ────────────────────────────────────────────────────────────
app.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json() as any
  const ts = now()

  const template = await c.env.DB.prepare('SELECT * FROM workflow_templates WHERE id = ?').bind(id).first() as any
  if (!template) return c.json({ error: 'Template not found' }, 404)
  if (template.is_system) return c.json({ error: 'System templates cannot be modified' }, 403)

  const fields: string[] = []
  const params: any[] = []
  const u = (col: string, val: any) => { if (val !== undefined) { fields.push(`${col} = ?`); params.push(val) } }

  u('name', body.name); u('name_ar', body.name_ar)
  u('description', body.description); u('description_ar', body.description_ar)
  u('category', body.category)
  if (body.nodes !== undefined) { fields.push('nodes = ?'); params.push(JSON.stringify(body.nodes)) }
  if (body.edges !== undefined) { fields.push('edges = ?'); params.push(JSON.stringify(body.edges)) }
  if (body.is_active !== undefined) { fields.push('is_active = ?'); params.push(body.is_active ? 1 : 0) }

  if (!fields.length) return c.json({ success: true })
  fields.push('updated_at = ?'); params.push(ts)
  params.push(id)
  await c.env.DB.prepare(`UPDATE workflow_templates SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run()

  return c.json({ success: true })
})

// ── Delete template ────────────────────────────────────────────────────────────
app.delete('/:id', async (c) => {
  const template = await c.env.DB.prepare('SELECT * FROM workflow_templates WHERE id = ?').bind(c.req.param('id')).first() as any
  if (!template) return c.json({ error: 'Not found' }, 404)
  if (template.is_system) return c.json({ error: 'System templates cannot be deleted' }, 403)
  await c.env.DB.prepare('DELETE FROM workflow_templates WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ── Validate workflow (linter) ─────────────────────────────────────────────────
// Checks for: orphan nodes, missing start/end, unassigned tasks, dead ends
app.post('/:id/validate', async (c) => {
  const id = c.req.param('id')
  const template = await c.env.DB.prepare('SELECT * FROM workflow_templates WHERE id = ?').bind(id).first() as any
  if (!template) return c.json({ error: 'Template not found' }, 404)

  let nodes: any[] = []; let edges: any[] = []
  try { nodes = JSON.parse(template.nodes || '[]') } catch {}
  try { edges = JSON.parse(template.edges || '[]') } catch {}

  return c.json(validateWorkflow(nodes, edges))
})

// ── Validate inline workflow (without saving) ──────────────────────────────────
app.post('/validate/inline', async (c) => {
  const { nodes, edges } = await c.req.json() as any
  return c.json(validateWorkflow(nodes || [], edges || []))
})

function validateWorkflow(nodes: any[], edges: any[]) {
  const issues: { type: string; message: string; message_ar: string; node_id?: string; severity: string }[] = []
  const warnings: typeof issues = []

  const nodeIds = new Set(nodes.map((n: any) => n.id))
  const connectedFrom = new Set(edges.map((e: any) => e.from))
  const connectedTo   = new Set(edges.map((e: any) => e.to))

  const startNodes = nodes.filter((n: any) => n.type === 'start')
  const endNodes   = nodes.filter((n: any) => n.type === 'end')

  if (startNodes.length === 0) {
    issues.push({ type: 'missing_start', severity: 'error',
      message: 'Workflow must have a Start node',
      message_ar: 'يجب أن يحتوي سير العمل على عقدة بداية' })
  }
  if (startNodes.length > 1) {
    issues.push({ type: 'multiple_start', severity: 'error',
      message: 'Workflow can only have one Start node',
      message_ar: 'لا يمكن أن يحتوي سير العمل على أكثر من عقدة بداية واحدة' })
  }
  if (endNodes.length === 0) {
    issues.push({ type: 'missing_end', severity: 'error',
      message: 'Workflow must have an End node',
      message_ar: 'يجب أن يحتوي سير العمل على عقدة نهاية' })
  }

  // Orphan nodes (no edges in or out)
  for (const node of nodes) {
    if (node.type === 'start') continue
    const hasIn  = connectedTo.has(node.id)
    const hasOut = connectedFrom.has(node.id)
    if (!hasIn && !hasOut) {
      issues.push({ type: 'orphan_node', severity: 'error', node_id: node.id,
        message: `Node "${node.label}" is not connected to any other node`,
        message_ar: `العقدة "${node.label_ar || node.label}" غير متصلة بأي عقدة أخرى` })
    }
  }

  // Tasks without assigned roles
  for (const node of nodes) {
    if (node.type === 'task' && !node.auto && !node.role) {
      warnings.push({ type: 'unassigned_task', severity: 'warning', node_id: node.id,
        message: `Task "${node.label}" has no assigned role`,
        message_ar: `المهمة "${node.label_ar || node.label}" ليس لها دور مُعيَّن` })
    }
  }

  // Dead ends (non-end nodes with no outgoing edges)
  for (const node of nodes) {
    if (node.type === 'end') continue
    if (!connectedFrom.has(node.id)) {
      issues.push({ type: 'dead_end', severity: 'error', node_id: node.id,
        message: `Node "${node.label}" has no outgoing connections`,
        message_ar: `العقدة "${node.label_ar || node.label}" ليس لها اتصالات صادرة` })
    }
  }

  // Edges pointing to non-existent nodes
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) {
      issues.push({ type: 'broken_edge', severity: 'error',
        message: `Edge references non-existent source node: ${edge.from}`,
        message_ar: `الحافة تشير إلى عقدة مصدر غير موجودة: ${edge.from}` })
    }
    if (!nodeIds.has(edge.to)) {
      issues.push({ type: 'broken_edge', severity: 'error',
        message: `Edge references non-existent target node: ${edge.to}`,
        message_ar: `الحافة تشير إلى عقدة هدف غير موجودة: ${edge.to}` })
    }
  }

  const isValid = issues.length === 0
  return {
    valid: isValid,
    issues,
    warnings,
    summary: isValid
      ? (warnings.length > 0 ? `Valid with ${warnings.length} warning(s)` : 'Workflow is valid')
      : `${issues.length} error(s) found`
  }
}

export { app as workflowTemplatesApi }
