import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const developerId = c.req.query('developer_id')
  let query = `SELECT p.*, d.company_name as developer_name FROM projects p LEFT JOIN developers d ON p.developer_id = d.id`
  const params: any[] = []
  if (developerId) { query += ' WHERE p.developer_id = ?'; params.push(developerId) }
  query += ' ORDER BY p.created_at DESC'
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ projects: results })
})

app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const project = await c.env.DB.prepare(
    `SELECT p.*, d.company_name as developer_name, d.contact_name, d.email as developer_email 
     FROM projects p LEFT JOIN developers d ON p.developer_id = d.id WHERE p.id = ?`
  ).bind(id).first()
  if (!project) return c.json({ error: 'Not found' }, 404)
  const { results: units } = await c.env.DB.prepare('SELECT * FROM units WHERE project_id = ? ORDER BY unit_number').bind(id).all()
  const { results: docs } = await c.env.DB.prepare('SELECT * FROM documents WHERE entity_type = ? AND entity_id = ?').bind('project', id).all()
  return c.json({ project, units, documents: docs })
})

app.post('/', async (c) => {
  const body = await c.req.json()
  const id = generateId('proj')
  const code = body.code || `PROJ-${Date.now().toString(36).toUpperCase()}`
  const ts = now()
  await c.env.DB.prepare(`
    INSERT INTO projects (id, developer_id, name, code, location, governorate, type, total_units, available_units, geo_json, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(id, body.developer_id || 'd001', body.name, code, body.location, body.governorate || 'Muscat', body.type || 'villa', body.total_units || 0, body.total_units || 0, body.geo_json || '{}', 'draft', ts, ts).run()
  await logAudit(c.env.DB, { userId: body.user_id || 'u010', userName: 'Ahmed Al-Hinai', userRole: 'developer', action: 'PROJECT_CREATED', entityType: 'project', entityId: id, details: { name: body.name, units: body.total_units } })
  return c.json({ id, code, success: true })
})

app.post('/:id/publish', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  await c.env.DB.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').bind('active', now(), id).run()
  await logAudit(c.env.DB, { userId: (body as any).user_id || 'u010', userName: 'Ahmed Al-Hinai', userRole: 'developer', action: 'PROJECT_PUBLISHED', entityType: 'project', entityId: id })
  return c.json({ success: true })
})

app.get('/:id/units', async (c) => {
  const id = c.req.param('id')
  const { results } = await c.env.DB.prepare('SELECT * FROM units WHERE project_id = ? ORDER BY unit_number').bind(id).all()
  return c.json({ units: results })
})

app.get('/units/:unitId', async (c) => {
  const unitId = c.req.param('unitId')
  const unit = await c.env.DB.prepare(
    `SELECT u.*, p.name as project_name, p.gsas_score, p.gsas_rating, p.location, p.eia_reference,
     d.company_name as developer_name FROM units u 
     LEFT JOIN projects p ON u.project_id = p.id 
     LEFT JOIN developers d ON p.developer_id = d.id WHERE u.id = ?`
  ).bind(unitId).first()
  return unit ? c.json({ unit }) : c.json({ error: 'Not found' }, 404)
})

export { app as projectsApi }
