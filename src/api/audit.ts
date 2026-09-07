import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now } from '../lib/db'
const app = new Hono<{ Bindings: NodeBindings }>()

// GET /api/v1/audit — list audit log entries, newest first
app.get('/', async (c) => {
  const limit  = parseInt(c.req.query('limit')  || '50')
  const offset = parseInt(c.req.query('offset') || '0')
  const action = c.req.query('action') || ''
  const entity = c.req.query('entity_type') || ''
  const userId = c.req.query('user_id') || ''

  let sql = `SELECT al.*,
    CASE
      WHEN al.entity_type = 'application' THEN (SELECT reference FROM applications WHERE id = al.entity_id)
      WHEN al.entity_type = 'product'     THEN (SELECT name     FROM products     WHERE id = al.entity_id)
      WHEN al.entity_type = 'rule'        THEN (SELECT name     FROM rules        WHERE id = al.entity_id)
      ELSE NULL
    END as entity_label
  FROM audit_logs al WHERE 1=1`
  const params: any[] = []

  if (action) { sql += ' AND al.action LIKE ?'; params.push(`%${action}%`) }
  if (entity) { sql += ' AND al.entity_type = ?'; params.push(entity) }
  if (userId) { sql += ' AND al.user_id = ?'; params.push(userId) }

  sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`
  params.push(Math.min(limit, 200), offset)

  const { results: logs } = await c.env.DB.prepare(sql).bind(...params).all() as any
  const countSql = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1`
  const countRow = await c.env.DB.prepare(countSql).first() as any

  return c.json({ audit_logs: logs || [], total: countRow?.total || 0 })
})

// POST /api/v1/audit — write a manual audit entry (from frontend actions)
app.post('/', async (c) => {
  const body = await c.req.json()
  const id = generateId('al')
  const ts = now()
  await c.env.DB.prepare(`
    INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, details, source, ai_confidence, regulatory_reference, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.user_id || 'system',
    body.user_name || 'System',
    body.user_role || 'system',
    body.action || 'MANUAL_ENTRY',
    body.entity_type || null,
    body.entity_id || null,
    JSON.stringify(body.details || {}),
    body.source || 'manual',
    body.ai_confidence || null,
    body.regulatory_reference || null,
    ts
  ).run()
  return c.json({ success: true, id })
})

export { app as auditApi }
