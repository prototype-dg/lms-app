import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { now } from '../lib/db'

const app = new Hono<{ Bindings: NodeBindings }>()

// ── GET /api/v1/campaigns
// Returns all campaigns. Optional ?status=active filter.
// Customer portal calls this with ?status=active to get live discounts.
app.get('/', async (c) => {
  const status = c.req.query('status')
  const today  = now().slice(0, 10) // YYYY-MM-DD

  let query: string
  let params: string[]

  if (status === 'active') {
    // Active campaigns: status='active' AND today is within [start_date, end_date]
    query  = `SELECT * FROM sales_campaigns WHERE status = 'active' AND start_date <= ? AND end_date >= ? ORDER BY created_at DESC`
    params = [today, today]
  } else if (status) {
    query  = 'SELECT * FROM sales_campaigns WHERE status = ? ORDER BY created_at DESC'
    params = [status]
  } else {
    query  = 'SELECT * FROM sales_campaigns ORDER BY created_at DESC'
    params = []
  }

  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ campaigns: results })
})

// ── POST /api/v1/campaigns
// Create a new campaign (called from developer portal saveCampaign).
app.post('/', async (c) => {
  const body = await c.req.json()

  const name    = (body.name || '').trim()
  if (!name)             return c.json({ error: 'name is required' }, 400)
  if (!body.start_date)  return c.json({ error: 'start_date is required' }, 400)
  if (!body.end_date)    return c.json({ error: 'end_date is required' }, 400)

  const ts = now()
  const result = await c.env.DB.prepare(`
    INSERT INTO sales_campaigns
      (name, project_id, unit_type, discount, velocity_boost, commission,
       budget, target_units, notes, start_date, end_date, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    name,
    body.project_id    || 'all',
    body.unit_type     || 'all',
    parseFloat(body.discount)       || 0,
    parseFloat(body.velocity_boost) || 0,
    parseFloat(body.commission)     || 0,
    parseFloat(body.budget)         || 0,
    parseInt(body.target_units)     || 0,
    body.notes   || '',
    body.start_date,
    body.end_date,
    body.status  || 'scheduled',
    ts, ts
  ).run()

  return c.json({ id: result.meta.last_row_id, success: true }, 201)
})

// ── DELETE /api/v1/campaigns/:id
app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM sales_campaigns WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ── PATCH /api/v1/campaigns/:id  (status update — e.g. activate/end)
app.patch('/:id', async (c) => {
  const id   = c.req.param('id')
  const body = await c.req.json()
  const ts   = now()
  const allowed = ['status', 'name', 'discount', 'start_date', 'end_date',
                   'velocity_boost', 'commission', 'budget', 'notes']
  const fields: string[] = []
  const vals: any[]      = []
  for (const k of allowed) {
    if (body[k] !== undefined) { fields.push(`${k}=?`); vals.push(body[k]) }
  }
  if (!fields.length) return c.json({ success: true })
  vals.push(ts, id)
  await c.env.DB.prepare(
    `UPDATE sales_campaigns SET ${fields.join(',')}, updated_at=? WHERE id=?`
  ).bind(...vals).run()
  return c.json({ success: true })
})

export { app as campaignsApi }
