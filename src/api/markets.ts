import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'

const app = new Hono<{ Bindings: NodeBindings }>()

// ── List all markets ──────────────────────────────────────────────────────────
app.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM markets ORDER BY is_default DESC, name ASC'
  ).all()
  return c.json({ markets: results })
})

// ── Get single market ─────────────────────────────────────────────────────────
app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const market = await c.env.DB.prepare('SELECT * FROM markets WHERE id = ?').bind(id).first()
  if (!market) return c.json({ error: 'Market not found' }, 404)
  return c.json({ market })
})

// ── Get default market ────────────────────────────────────────────────────────
app.get('/default/current', async (c) => {
  const market = await c.env.DB.prepare(
    "SELECT * FROM markets WHERE is_default = 1 AND status = 'active' LIMIT 1"
  ).first()
  if (!market) return c.json({ error: 'No default market configured' }, 404)
  return c.json({ market })
})

// ── Get regulatory profile via LLM ───────────────────────────────────────────
// Given a country name, returns currency, regulator, and hidden regulatory defaults
app.post('/regulatory-profile', async (c) => {
  const { country } = await c.req.json() as any
  if (!country) return c.json({ error: 'country is required' }, 400)

  const apiKey = c.env.OPENAI_API_KEY
  if (!apiKey) return c.json({ error: 'OpenAI API key not configured' }, 500)

  const prompt = `You are a banking regulatory expert. For the country "${country}", provide a complete regulatory profile for retail banking / mortgage lending.

Return ONLY a valid JSON object with exactly this structure (no markdown, no code blocks):
{
  "country": "full official country name",
  "country_code": "ISO 3166-1 alpha-2 code (2 letters, uppercase)",
  "currency_code": "ISO 4217 code (3 letters, uppercase)",
  "currency_name": "full currency name in English",
  "currency_name_ar": "currency name in Arabic (or null if not applicable)",
  "currency_symbol": "currency symbol (e.g. $, £, ر.ع.)",
  "regulator_name": "short regulator abbreviation (e.g. CBO, CBUAE, CBB, SAMA)",
  "regulator_name_ar": "regulator name in Arabic",
  "regulator_full_name": "full regulator name in English",
  "regulator_full_name_ar": "full regulator name in Arabic",
  "locale": "primary locale code (e.g. en, ar)",
  "rtl_supported": true or false,
  "regulatory_defaults": {
    "default_max_dbr": number (percentage, e.g. 50),
    "default_green_dbr": number (percentage, usually 5% lower than max_dbr),
    "default_max_ltv": number (percentage, e.g. 80),
    "default_max_ltv_expat": number (percentage, usually lower),
    "default_max_term_years": number (e.g. 25),
    "default_min_term_years": number (e.g. 1),
    "default_base_rate": number (approximate current benchmark rate),
    "default_ai_confidence_threshold": 90,
    "gsas_standard_threshold": number or null,
    "gsas_premium_threshold": number or null,
    "green_discount_standard_pct": number or null,
    "green_discount_premium_pct": number or null,
    "stress_test_rate": number (stress test rate, e.g. 9.0),
    "min_malaa_score": number or null,
    "regulatory_framework": "primary regulatory framework name",
    "esg_framework": "ESG/green building framework if applicable, or null",
    "date_format": "DD/MM/YYYY or MM/DD/YYYY",
    "number_format": "1,234.56",
    "max_finance_amount": number (typical maximum mortgage in local currency),
    "min_finance_amount": number (typical minimum in local currency)
  }
}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 800
      })
    })

    const data = await res.json() as any
    const raw = data.choices?.[0]?.message?.content || ''
    const profile = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim())
    return c.json({ profile, source: 'llm' })
  } catch (e: any) {
    return c.json({ error: 'Failed to fetch regulatory profile: ' + e.message }, 500)
  }
})

// ── Create market ─────────────────────────────────────────────────────────────
app.post('/', async (c) => {
  const body = await c.req.json() as any
  const id = generateId('mkt')
  const ts = now()

  // If this is set as default, unset all others first
  if (body.is_default) {
    await c.env.DB.prepare('UPDATE markets SET is_default = 0').run()
  }

  await c.env.DB.prepare(`
    INSERT INTO markets (
      id, name, name_ar, code, country, country_code,
      currency_code, currency_name, currency_name_ar, currency_symbol,
      regulator_name, regulator_name_ar, regulator_full_name, regulator_full_name_ar,
      locale, rtl_supported, regulatory_defaults, status, is_default, created_by, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id,
    body.name, body.name_ar || null,
    body.code?.toUpperCase() || id,
    body.country, body.country_code?.toUpperCase() || '',
    body.currency_code?.toUpperCase() || '',
    body.currency_name || '', body.currency_name_ar || null, body.currency_symbol || '',
    body.regulator_name || '', body.regulator_name_ar || null,
    body.regulator_full_name || '', body.regulator_full_name_ar || null,
    body.locale || 'en', body.rtl_supported ? 1 : 0,
    JSON.stringify(body.regulatory_defaults || {}),
    body.status || 'active',
    body.is_default ? 1 : 0,
    body.created_by || 'u001', ts, ts
  ).run()

  await logAudit(c.env.DB, {
    userId: body.created_by || 'u001',
    userName: body.user_name || 'System',
    userRole: 'admin',
    action: 'MARKET_CREATED',
    entityType: 'market',
    entityId: id,
    details: { name: body.name, country: body.country }
  })

  return c.json({ id, success: true })
})

// ── Update market ─────────────────────────────────────────────────────────────
app.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json() as any
  const ts = now()

  const market = await c.env.DB.prepare('SELECT * FROM markets WHERE id = ?').bind(id).first() as any
  if (!market) return c.json({ error: 'Market not found' }, 404)

  if (body.is_default) {
    await c.env.DB.prepare('UPDATE markets SET is_default = 0 WHERE id != ?').bind(id).run()
  }

  const fields: string[] = []
  const params: any[] = []

  const updateField = (col: string, val: any) => {
    if (val !== undefined) { fields.push(`${col} = ?`); params.push(val) }
  }

  updateField('name', body.name)
  updateField('name_ar', body.name_ar)
  updateField('currency_code', body.currency_code)
  updateField('currency_name', body.currency_name)
  updateField('currency_name_ar', body.currency_name_ar)
  updateField('currency_symbol', body.currency_symbol)
  updateField('regulator_name', body.regulator_name)
  updateField('regulator_name_ar', body.regulator_name_ar)
  updateField('regulator_full_name', body.regulator_full_name)
  updateField('regulator_full_name_ar', body.regulator_full_name_ar)
  updateField('locale', body.locale)
  updateField('status', body.status)
  if (body.is_default !== undefined) { fields.push('is_default = ?'); params.push(body.is_default ? 1 : 0) }
  if (body.regulatory_defaults !== undefined) {
    fields.push('regulatory_defaults = ?')
    params.push(JSON.stringify(body.regulatory_defaults))
  }

  if (fields.length === 0) return c.json({ success: true, message: 'No changes' })

  fields.push('updated_at = ?'); params.push(ts)
  params.push(id)

  await c.env.DB.prepare(
    `UPDATE markets SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...params).run()

  await logAudit(c.env.DB, {
    userId: body.user_id || 'u001',
    userName: body.user_name || 'System',
    userRole: 'admin',
    action: 'MARKET_UPDATED',
    entityType: 'market',
    entityId: id,
    details: { updated_fields: fields }
  })

  return c.json({ success: true })
})

export { app as marketsApi }
