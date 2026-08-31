import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const status = c.req.query('status')
  const customerId = c.req.query('customer_id')
  let query = `SELECT a.*, c.name as customer_display_name, c.salary_omr, c.credit_score, 
    p.name as product_name, u.name as unit_name, pr.name as project_name
    FROM applications a
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN products p ON a.product_id = p.id
    LEFT JOIN units u ON a.unit_id = u.id
    LEFT JOIN projects pr ON a.project_id = pr.id`
  const conditions: string[] = []
  const params: any[] = []
  if (status) { conditions.push('a.status = ?'); params.push(status) }
  if (customerId) { conditions.push('a.customer_id = ?'); params.push(customerId) }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
  query += ' ORDER BY a.created_at DESC'
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ applications: results })
})

app.get('/:id', async (c) => {
  const id = c.req.param('id')
  const isRef = id.startsWith('GHL') || id.startsWith('HL')
  const app_ = await c.env.DB.prepare(
    isRef
      ? `SELECT a.*, c.name as customer_display_name, c.salary_omr, c.credit_score, c.employer, c.phone, c.email, c.civil_id, c.nationality,
          p.name as product_name, p.gsas_min_score, p.gsas_premium_score, p.green_discount_premium,
          p.approved_materials, p.approved_vendors, p.ai_confidence_threshold, p.esg_required_docs,
          u.unit_number, u.area_sqm, u.bedrooms, u.bathrooms, u.features,
          pr.name as project_name, pr.developer_id, pr.gsas_score as project_gsas_score
         FROM applications a
         LEFT JOIN customers c ON a.customer_id = c.id
         LEFT JOIN products p ON a.product_id = p.id
         LEFT JOIN units u ON a.unit_id = u.id
         LEFT JOIN projects pr ON a.project_id = pr.id
         WHERE a.reference = ?`
      : `SELECT a.*, c.name as customer_display_name, c.salary_omr, c.credit_score, c.employer, c.phone, c.email, c.civil_id, c.nationality,
          p.name as product_name, p.gsas_min_score, p.gsas_premium_score, p.green_discount_premium,
          p.approved_materials, p.approved_vendors, p.ai_confidence_threshold, p.esg_required_docs,
          u.unit_number, u.area_sqm, u.bedrooms, u.bathrooms, u.features,
          pr.name as project_name, pr.developer_id, pr.gsas_score as project_gsas_score
         FROM applications a
         LEFT JOIN customers c ON a.customer_id = c.id
         LEFT JOIN products p ON a.product_id = p.id
         LEFT JOIN units u ON a.unit_id = u.id
         LEFT JOIN projects pr ON a.project_id = pr.id
         WHERE a.id = ?`
  ).bind(id).first()
  if (!app_) return c.json({ error: 'Not found' }, 404)
  
  // Get documents
  const { results: docs } = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE entity_type = ? AND entity_id = ?'
  ).bind('application', (app_ as any).id).all()
  
  // Get stages
  const { results: stages } = await c.env.DB.prepare(
    'SELECT * FROM construction_stages WHERE application_id = ? ORDER BY stage_number'
  ).bind((app_ as any).id).all()
  
  return c.json({ application: app_, documents: docs, stages })
})

app.post('/', async (c) => {
  const body = await c.req.json()
  const id = generateId('app')
  const ts = now()
  
  // Calculate financial metrics
  const loanAmount = body.loan_amount || 200000
  const loanTerm = body.loan_term || 25
  const gsasScore = body.gsas_score || 0
  const baseRate = 5.5
  
  let appliedRate = baseRate
  let discount = 0
  if (gsasScore >= 85) { appliedRate = baseRate - 0.75; discount = 0.75 }
  else if (gsasScore >= 70) { appliedRate = baseRate - 0.5; discount = 0.5 }
  
  const monthlyRate = appliedRate / 100 / 12
  const n = loanTerm * 12
  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
  
  const standardMonthlyRate = baseRate / 100 / 12
  const standardMonthly = loanAmount * (standardMonthlyRate * Math.pow(1 + standardMonthlyRate, n)) / (Math.pow(1 + standardMonthlyRate, n) - 1)
  const lifetimeSaving = (standardMonthly - monthlyPayment) * n
  
  // Get customer salary for DBR
  const customer = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(body.customer_id).first() as any
  const salary = customer?.salary_omr || 3200
  const dbr = Math.round((monthlyPayment / salary) * 100)
  const propertyValue = body.property_value || loanAmount * 1.25
  const ltv = Math.round((loanAmount / propertyValue) * 100)
  
  // Generate reference
  const prefix = body.product_id === 'p009' ? 'GHL' : 'HL'
  const refNum = Math.floor(Math.random() * 900000) + 100000
  const reference = `${prefix}-${refNum}`

  await c.env.DB.prepare(`
    INSERT INTO applications (id, reference, product_id, customer_id, customer_name, unit_id, project_id,
    loan_amount, loan_term, property_address, property_source, property_area_sqm, gsas_score, epc_rating,
    applied_rate, standard_rate, monthly_payment, standard_monthly_payment, lifetime_saving,
    dbr, ltv, stress_test_rate, stress_test_passed, malaa_score, status, esg_verification_status,
    escrow_amount, tracking_url, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, reference, body.product_id, body.customer_id, customer?.name || body.customer_name,
    body.unit_id || null, body.project_id || null, loanAmount, loanTerm,
    body.property_address || '', body.property_source || 'partner',
    body.property_area_sqm || null, gsasScore, body.epc_rating || null,
    appliedRate, baseRate, Math.round(monthlyPayment * 100) / 100,
    Math.round(standardMonthly * 100) / 100, Math.round(lifetimeSaving * 100) / 100,
    dbr, ltv, 9.0, 1, customer?.credit_score || 750,
    'submitted', 'pending', loanAmount,
    `https://sib.om/track/${reference}`, ts, ts
  ).run()

  // Create construction stages if green product
  if (body.product_id === 'p009') {
    const stages = [
      { num: 1, name: 'Foundation & Groundwork', desc: 'Foundation, groundwork, and underground utilities', pct: 25, material: 'Green Concrete – C30 Grade' },
      { num: 2, name: 'Roof & Envelope', desc: 'Roof structure, external walls, thermal envelope', pct: 30, material: 'Thermal Insulation (R-30+)' },
      { num: 3, name: 'MEP & Solar Installation', desc: 'Mechanical, electrical, plumbing, solar installation', pct: 25, material: 'Solar Panels (min 5kWp)' },
      { num: 4, name: 'Finishing & Handover', desc: 'Interior finishing and final handover', pct: 20, material: 'Energy-Efficient Appliances' }
    ]
    for (const s of stages) {
      await c.env.DB.prepare(`
        INSERT INTO construction_stages (id, application_id, stage_number, stage_name, description, tranche_amount, tranche_percentage, required_material, status, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).bind(generateId('st'), id, s.num, s.name, s.desc, Math.round(loanAmount * s.pct / 100), s.pct, s.material, s.num === 1 ? 'active' : 'locked', ts).run()
    }
  }

  await logAudit(c.env.DB, {
    userId: body.customer_id || 'u020', userName: customer?.name || 'Customer', userRole: 'customer',
    action: 'APPLICATION_SUBMITTED', entityType: 'application', entityId: id,
    details: { reference, amount: loanAmount, rate: appliedRate, gsas_score: gsasScore }
  })

  return c.json({
    id, reference, applied_rate: appliedRate, monthly_payment: Math.round(monthlyPayment * 100) / 100,
    standard_monthly_payment: Math.round(standardMonthly * 100) / 100,
    lifetime_saving: Math.round(lifetimeSaving * 100) / 100, dbr, ltv,
    tracking_url: `https://sib.om/track/${reference}`, success: true
  })
})

app.patch('/:id/status', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const ts = now()
  let updateFields = 'status = ?, updated_at = ?'
  const params: any[] = [body.status, ts]
  
  if (body.status === 'approved' && body.compliance) {
    updateFields += ', compliance_approved_by = ?, compliance_approved_at = ?'
    params.push(body.user_id, ts)
  }
  if (body.status === 'approved' && body.risk) {
    updateFields += ', risk_approved_by = ?, risk_approved_at = ?'
    params.push(body.user_id, ts)
  }
  if (body.esg_verification_status) {
    updateFields += ', esg_verification_status = ?'
    params.push(body.esg_verification_status)
  }
  params.push(id)
  
  await c.env.DB.prepare(`UPDATE applications SET ${updateFields} WHERE id = ?`).bind(...params).run()
  await logAudit(c.env.DB, {
    userId: body.user_id || 'system', userName: body.user_name || 'System',
    userRole: body.user_role || 'system', action: 'APPLICATION_STATUS_UPDATED',
    entityType: 'application', entityId: id, details: { new_status: body.status }
  })
  return c.json({ success: true })
})

// Calculate pricing dynamically
app.post('/calculate', async (c) => {
  const body = await c.req.json()
  const { loan_amount, loan_term, gsas_score, product_id } = body
  
  const product = product_id ? await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(product_id).first() as any : null
  const baseRate = product?.base_rate || 5.5
  
  let appliedRate = baseRate
  let discountLabel = 'Standard Rate'
  if (gsas_score >= 85) { appliedRate = baseRate - 0.75; discountLabel = 'Green Premium (0.75% discount)' }
  else if (gsas_score >= 70) { appliedRate = baseRate - 0.5; discountLabel = 'Green Standard (0.5% discount)' }
  
  const monthlyRate = appliedRate / 100 / 12
  const n = loan_term * 12
  const monthly = loan_amount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
  const standardMonthlyRate = baseRate / 100 / 12
  const standardMonthly = loan_amount * (standardMonthlyRate * Math.pow(1 + standardMonthlyRate, n)) / (Math.pow(1 + standardMonthlyRate, n) - 1)
  
  return c.json({
    base_rate: baseRate,
    applied_rate: appliedRate,
    discount_label: discountLabel,
    monthly_payment: Math.round(monthly * 100) / 100,
    standard_monthly_payment: Math.round(standardMonthly * 100) / 100,
    monthly_saving: Math.round((standardMonthly - monthly) * 100) / 100,
    lifetime_saving: Math.round((standardMonthly - monthly) * n * 100) / 100
  })
})

export { app as applicationsApi }
