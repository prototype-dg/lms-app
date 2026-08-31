import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const entityType = c.req.query('entity_type')
  const entityId = c.req.query('entity_id')
  const limit = parseInt(c.req.query('limit') || '50')
  let query = 'SELECT * FROM audit_logs'
  const params: any[] = []
  const conditions: string[] = []
  if (entityType) { conditions.push('entity_type = ?'); params.push(entityType) }
  if (entityId) { conditions.push('entity_id = ?'); params.push(entityId) }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
  query += ` ORDER BY created_at DESC LIMIT ${limit}`
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ audit_logs: results })
})

export { app as auditApi }
