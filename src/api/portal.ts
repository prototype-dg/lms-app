import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'
const app = new Hono<{ Bindings: NodeBindings }>()


// ── Consumer Portal: Single product detail ────────────────────────────────
app.get('/products/:id', async (c) => {
  const id = c.req.param('id')
  const product = await c.env.DB.prepare(
    `SELECT p.*, 
     (SELECT COUNT(*) FROM applications a WHERE a.product_id = p.id) as total_applications
     FROM products p WHERE p.id = ? AND p.portal_visible = 1`
  ).bind(id).first()
  if (!product) return c.json({ error: 'Not found' }, 404)

  // Get product-specific rules summary for display
  const { results: rules } = await c.env.DB.prepare(
    `SELECT name, category, metric, operator, threshold_value, threshold_condition, severity, description, regulatory_reference
     FROM rules WHERE (product_id = ? OR product_id IS NULL) AND is_active = 1
     ORDER BY category, severity DESC`
  ).bind(id).all()

  return c.json({ product, rules })
})

// ── Consumer Portal: Calculator ───────────────────────────────────────────
app.get('/calculator', async (c) => {
  const productId = c.req.query('product_id')
  const amount = parseFloat(c.req.query('amount') || '0')
  const term = parseInt(c.req.query('term') || '25')
  const gsasScore = parseInt(c.req.query('gsas_score') || '0')
  const salary = parseFloat(c.req.query('salary') || '0')

  if (!productId || !amount || !term) {
    return c.json({ error: 'product_id, amount, and term are required' }, 400)
  }

  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first() as any
  if (!product) return c.json({ error: 'Product not found' }, 404)

  // Determine applicable rate based on GSAS score
  let rateDiscount = 0
  if (gsasScore >= (product.gsas_premium_score || 85)) {
    rateDiscount = product.green_discount_premium || 0
  } else if (gsasScore >= (product.gsas_min_score || 70)) {
    rateDiscount = product.green_discount_standard || 0
  }

  const appliedRate = parseFloat((product.base_rate - rateDiscount).toFixed(3))
  const standardRate = product.base_rate
  const annualRate = appliedRate / 100
  const monthlyRate = annualRate / 12
  const months = term * 12

  // Monthly payment formula (reducing balance)
  const monthlyPayment = monthlyRate > 0
    ? amount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
    : amount / months

  const standardMonthlyRate = standardRate / 100 / 12
  const standardMonthly = standardMonthlyRate > 0
    ? amount * (standardMonthlyRate * Math.pow(1 + standardMonthlyRate, months)) / (Math.pow(1 + standardMonthlyRate, months) - 1)
    : amount / months

  const lifetimeSaving = Math.round((standardMonthly - monthlyPayment) * months)
  const dbr = salary > 0 ? parseFloat(((monthlyPayment / salary) * 100).toFixed(1)) : null
  const ltv = null // requires property value

  return c.json({
    product_name: product.name,
    loan_amount: amount,
    term_years: term,
    base_rate: standardRate,
    rate_discount: rateDiscount,
    applied_rate: appliedRate,
    monthly_payment: Math.round(monthlyPayment * 100) / 100,
    standard_monthly_payment: Math.round(standardMonthly * 100) / 100,
    lifetime_saving: Math.max(0, lifetimeSaving),
    dbr,
    gsas_score: gsasScore || null,
    green_eligible: gsasScore >= (product.gsas_min_score || 70),
    premium_tier: gsasScore >= (product.gsas_premium_score || 85),
  })
})

// ── Consumer Portal: List published projects ──────────────────────────────
app.get('/projects', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.name, p.code, p.location, p.governorate, p.type,
     p.total_units, p.available_units, p.reserved_units, p.sold_units,
     p.gsas_score, p.gsas_rating, p.epc_rating, p.status, p.green_eligible,
     p.premium_tier, p.geo_json,
     p.listing_visible, p.marketing_tagline, p.price_from, p.price_to,
     p.completion_date, p.amenities, p.created_at,
     d.company_name as developer_name
     FROM projects p
     LEFT JOIN developers d ON p.developer_id = d.id
     WHERE p.listing_visible = 1 AND p.status = 'active'
     ORDER BY p.premium_tier DESC, p.created_at DESC`
  ).all()
  return c.json({ projects: results, total: results.length })
})

// ── Consumer Portal: Project detail + units ───────────────────────────────
app.get('/projects/:id', async (c) => {
  const id = c.req.param('id')
  const project = await c.env.DB.prepare(
    `SELECT p.*, d.company_name as developer_name, d.contact_name
     FROM projects p LEFT JOIN developers d ON p.developer_id = d.id
     WHERE p.id = ? AND p.listing_visible = 1`
  ).bind(id).first()
  if (!project) return c.json({ error: 'Not found' }, 404)

  const { results: units } = await c.env.DB.prepare(
    'SELECT * FROM units WHERE project_id = ? ORDER BY unit_number'
  ).bind(id).all()

  return c.json({ project, units })
})

// ── Consumer Portal: Submit application ───────────────────────────────────
app.post('/applications', async (c) => {
  const body = await c.req.json()
  const { product_id, customer_name, unit_id, project_id, loan_amount, loan_term,
    property_address, property_source, gsas_score, epc_rating, salary, civil_id } = body

  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ? AND status = ?')
    .bind(product_id, 'active').first() as any
  if (!product) return c.json({ error: 'Product not found or not active' }, 404)

  // Calculate rate and payments
  let rateDiscount = 0
  if (gsas_score >= (product.gsas_premium_score || 85)) rateDiscount = product.green_discount_premium || 0
  else if (gsas_score >= (product.gsas_min_score || 70)) rateDiscount = product.green_discount_standard || 0
  const appliedRate = parseFloat((product.base_rate - rateDiscount).toFixed(3))
  const months = loan_term * 12
  const monthlyRate = appliedRate / 100 / 12
  const monthlyPayment = monthlyRate > 0
    ? loan_amount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
    : loan_amount / months
  const stdMonthlyRate = product.base_rate / 100 / 12
  const stdMonthly = stdMonthlyRate > 0
    ? loan_amount * (stdMonthlyRate * Math.pow(1 + stdMonthlyRate, months)) / (Math.pow(1 + stdMonthlyRate, months) - 1)
    : loan_amount / months
  const lifetimeSaving = Math.max(0, Math.round((stdMonthly - monthlyPayment) * months))
  const dbr = salary ? parseFloat(((monthlyPayment / salary) * 100).toFixed(1)) : null

  const id = generateId('app')
  const ts = now()
  const refNum = 'GHL-' + Date.now().toString().slice(-6)

  // Try to find existing customer by civil_id
  let customerId = null
  if (civil_id) {
    const existing = await c.env.DB.prepare('SELECT id FROM customers WHERE civil_id = ?').bind(civil_id).first() as any
    if (existing) customerId = existing.id
  }

  await c.env.DB.prepare(`
    INSERT INTO applications (id,reference,product_id,customer_id,customer_name,unit_id,project_id,
    loan_amount,loan_term,property_address,property_source,gsas_score,epc_rating,
    applied_rate,standard_rate,monthly_payment,standard_monthly_payment,lifetime_saving,dbr,
    escrow_amount,status,esg_verification_status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(id, refNum, product_id, customerId || null, customer_name, unit_id || null,
    project_id || null, loan_amount, loan_term, property_address || null,
    property_source || 'partner', gsas_score || null, epc_rating || null,
    appliedRate, product.base_rate, Math.round(monthlyPayment * 100) / 100,
    Math.round(stdMonthly * 100) / 100, lifetimeSaving, dbr,
    loan_amount, 'submitted', gsas_score ? 'pending' : 'not_applicable', ts, ts
  ).run()

  // Auto-create construction stages for green home loan
  if (product.esg_required_docs && JSON.parse(product.esg_required_docs || '[]').length > 0) {
    const stages = [
      { num: 1, name: 'Foundation & Groundwork', desc: 'Complete foundation, groundwork, and underground utilities', pct: 25, mat: 'Green Concrete – C30 Grade', status: 'active' },
      { num: 2, name: 'Roof & Envelope', desc: 'Roof structure, external walls, and thermal envelope', pct: 30, mat: 'Thermal Insulation (R-30+)', status: 'locked' },
      { num: 3, name: 'MEP & Solar Installation', desc: 'Mechanical, electrical, plumbing, and solar installation', pct: 25, mat: 'Solar Panels (min 5kWp)', status: 'locked' },
      { num: 4, name: 'Finishing & Handover', desc: 'Interior finishing, energy-efficient appliances, and final handover', pct: 20, mat: 'Energy-Efficient Appliances', status: 'locked' },
    ]
    for (const s of stages) {
      const tranche = Math.round(loan_amount * s.pct / 100)
      await c.env.DB.prepare(`
        INSERT INTO construction_stages (id,application_id,stage_number,stage_name,description,tranche_amount,tranche_percentage,required_material,status,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).bind(generateId('st'), id, s.num, s.name, s.desc, tranche, s.pct, s.mat, s.status, ts).run()
    }
  }

  await logAudit(c.env.DB, {
    userId: customerId || 'portal',
    userName: customer_name,
    userRole: 'customer',
    action: 'APPLICATION_SUBMITTED',
    entityType: 'application',
    entityId: id,
    details: { reference: refNum, product_id, loan_amount, applied_rate: appliedRate },
  })

  return c.json({
    success: true,
    application_id: id,
    reference: refNum,
    applied_rate: appliedRate,
    monthly_payment: Math.round(monthlyPayment * 100) / 100,
    lifetime_saving: lifetimeSaving,
    status: 'submitted',
  })
})

// ── Consumer Portal: Track application status ─────────────────────────────
app.get('/applications/:ref/status', async (c) => {
  const ref = c.req.param('ref')
  const app = await c.env.DB.prepare(
    `SELECT a.*, p.name as product_name, p.portal_hero_title
     FROM applications a LEFT JOIN products p ON a.product_id = p.id
     WHERE a.reference = ?`
  ).bind(ref).first() as any
  if (!app) return c.json({ error: 'Application not found' }, 404)

  const { results: stages } = await c.env.DB.prepare(
    'SELECT * FROM construction_stages WHERE application_id = ? ORDER BY stage_number'
  ).bind(app.id).all()

  const { results: docs } = await c.env.DB.prepare(
    'SELECT doc_type, filename, validation_status, ai_confidence, created_at FROM documents WHERE entity_type = ? AND entity_id = ?'
  ).bind('application', app.id).all()

  const statusLabels: Record<string, string> = {
    submitted: 'Application Received',
    credit_scoring: 'Credit Assessment',
    esg_review: 'ESG Verification',
    credit_review: 'Final Credit Review',
    approved: 'Approved',
    disbursed: 'Funds Disbursed',
    completed: 'Completed',
    rejected: 'Rejected',
  }

  const timeline = [
    { key: 'submitted', label: 'Application Submitted', done: true },
    { key: 'credit_scoring', label: 'Credit Scoring (MALA\'A)', done: ['credit_scoring','esg_review','credit_review','approved','disbursed','completed'].includes(app.status) },
    { key: 'esg_review', label: 'ESG Document Verification', done: ['esg_review','credit_review','approved','disbursed','completed'].includes(app.status) },
    { key: 'credit_review', label: 'Maker-Checker Approval', done: ['credit_review','approved','disbursed','completed'].includes(app.status) },
    { key: 'approved', label: 'Loan Approved', done: ['approved','disbursed','completed'].includes(app.status) },
    { key: 'disbursed', label: 'Funds Disbursed', done: ['disbursed','completed'].includes(app.status) },
  ]

  return c.json({
    reference: app.reference,
    status: app.status,
    status_label: statusLabels[app.status] || app.status,
    product_name: app.product_name,
    loan_amount: app.loan_amount,
    applied_rate: app.applied_rate,
    monthly_payment: app.monthly_payment,
    lifetime_saving: app.lifetime_saving,
    esg_verification_status: app.esg_verification_status,
    compliance_approved_at: app.compliance_approved_at,
    risk_approved_at: app.risk_approved_at,
    timeline,
    construction_stages: stages,
    documents: docs,
    created_at: app.created_at,
  })
})

// ── Developer Portal: List products accepting developer inventory ──────────
app.get('/developer/products', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, code, description, category, base_rate, max_ltv, max_dbr, green_dbr,
     min_term, max_term, min_amount, max_amount,
     gsas_min_score, gsas_premium_score, green_discount_premium, green_discount_standard,
     allow_partner_inventory, required_docs, esg_required_docs,
     approved_materials, approved_vendors, ai_confidence_threshold,
     portal_hero_title, developer_requirements, published_at
     FROM products WHERE developer_portal_visible = 1 AND status = 'active'
     ORDER BY published_at ASC`
  ).all()

  // For each product, attach its ESG rules
  const productsWithRules = await Promise.all(results.map(async (p: any) => {
    const { results: rules } = await c.env.DB.prepare(
      `SELECT name, category, metric, operator, threshold_value, threshold_condition, severity, description, regulatory_reference
       FROM rules WHERE (product_id = ? OR (product_id IS NULL AND category IN ('esg','compliance'))) AND is_active = 1
       ORDER BY category`
    ).bind(p.id).all()
    return { ...p, rules }
  }))

  return c.json({ products: productsWithRules, total: productsWithRules.length })
})

// ── Developer Portal: Register new project ────────────────────────────────
app.post('/developer/projects', async (c) => {
  const body = await c.req.json()
  const id = generateId('proj')
  const code = body.code || `PROJ-${Date.now().toString(36).toUpperCase()}`
  const ts = now()

  await c.env.DB.prepare(`
    INSERT INTO projects (id, developer_id, name, code, location, governorate, type,
    total_units, available_units, geo_json, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(id, body.developer_id || 'd001', body.name, code,
    body.location, body.governorate || 'Muscat', body.type || 'villa',
    body.total_units || 0, body.total_units || 0,
    JSON.stringify(body.geo_json || {}), 'draft', ts, ts
  ).run()

  await logAudit(c.env.DB, {
    userId: body.user_id || 'u010', userName: 'Ahmed Al-Hinai', userRole: 'developer',
    action: 'PROJECT_CREATED', entityType: 'project', entityId: id,
    details: { name: body.name, location: body.location, units: body.total_units },
  })

  return c.json({ id, code, success: true })
})

// ── Developer Portal: Upload project documents (simulate AI validation) ───
app.post('/developer/projects/:id/documents', async (c) => {
  const projectId = c.req.param('id')
  const body = await c.req.json()
  const { doc_type, filename, user_id = 'u010' } = body

  // Return pre-configured AI validation results per doc type
  const validations: Record<string, any> = {
    gsas_cert: {
      extracted_data: { certificate_number: 'GSAS-2026-078', issuer: 'GORD', issue_date: '2026-02-15', expiry_date: '2028-12-31', overall_score: 89, rating: 'Gold', property: 'EcoVillage Muscat' },
      ai_confidence: 96, validation_status: 'auto_verified',
      validation_notes: 'Auto-verified: All fields validated. Score 89 meets minimum threshold (70). Premium tier (≥85): 0.75% discount applies.',
    },
    epc_report: {
      extracted_data: { rating: 'A', expiry_date: '2027-05-01', energy_consumption: '85 kWh/m²/year', assessor: 'Green Build Oman' },
      ai_confidence: 88, validation_status: 'manual_review',
      validation_notes: 'Manual review required: Slight image skew reduced confidence below 90% threshold. Rating A confirmed; visual verification recommended.',
    },
    eia_approval: {
      extracted_data: { reference: 'EIA/2026/442', issuer: 'Environment Authority', approval_date: '2026-03-10', valid_until: '2029-03-10', units: 24, status: 'Approved' },
      ai_confidence: 95, validation_status: 'auto_verified',
      validation_notes: 'Auto-verified: EIA clearance confirmed for 24 units. Issuer accredited.',
    },
  }

  const result = validations[doc_type] || {
    extracted_data: {}, ai_confidence: 80, validation_status: 'pending',
    validation_notes: 'Awaiting manual review.',
  }

  const docId = generateId('doc')
  const ts = now()
  await c.env.DB.prepare(`
    INSERT INTO documents (id, entity_type, entity_id, doc_type, filename,
    extracted_data, ai_confidence, validation_status, validation_notes, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(docId, 'project', projectId, doc_type, filename || `${doc_type}.pdf`,
    JSON.stringify(result.extracted_data), result.ai_confidence,
    result.validation_status, result.validation_notes, ts
  ).run()

  // Update project's ESG scores from GSAS cert
  if (doc_type === 'gsas_cert' && result.extracted_data.overall_score) {
    await c.env.DB.prepare(
      'UPDATE projects SET gsas_score = ?, gsas_rating = ?, updated_at = ? WHERE id = ?'
    ).bind(result.extracted_data.overall_score, result.extracted_data.rating, ts, projectId).run()
  }
  if (doc_type === 'epc_report' && result.extracted_data.rating) {
    await c.env.DB.prepare('UPDATE projects SET epc_rating = ?, updated_at = ? WHERE id = ?')
      .bind(result.extracted_data.rating, ts, projectId).run()
  }
  if (doc_type === 'eia_approval' && result.extracted_data.reference) {
    await c.env.DB.prepare('UPDATE projects SET eia_reference = ?, updated_at = ? WHERE id = ?')
      .bind(result.extracted_data.reference, ts, projectId).run()
  }

  await logAudit(c.env.DB, {
    userId: user_id, userName: 'Ahmed Al-Hinai', userRole: 'developer',
    action: result.validation_status === 'auto_verified' ? 'DOCUMENT_AUTO_VERIFIED' : 'DOCUMENT_FLAGGED_REVIEW',
    entityType: 'document', entityId: docId,
    details: { doc_type, confidence: result.ai_confidence, project_id: projectId },
    source: 'ai_generated', aiConfidence: result.ai_confidence,
  })

  return c.json({ doc_id: docId, success: true, ...result })
})

// ── Developer Portal: Upload unit inventory ───────────────────────────────
// GET units for a project (used by Site Map + Inventory)
app.get('/developer/projects/:id/units', async (c) => {
  const projectId = c.req.param('id')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM units WHERE project_id = ? ORDER BY unit_number'
  ).bind(projectId).all()
  return c.json({ units: results })
})

app.post('/developer/projects/:id/units', async (c) => {
  const projectId = c.req.param('id')
  const body = await c.req.json()
  const ts = now()

  // Accept both: single unit body OR { units: [...] } array
  const unitList: any[] = Array.isArray(body.units) ? body.units : [body]

  let inserted = 0
  for (const u of unitList) {
    const unitId = generateId('unit')
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO units (id, project_id, unit_number, floor_number, type, area_sqm,
      bedrooms, bathrooms, price, lat, lng, status, features, image_url, gsas_score, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      unitId, projectId, u.unit_number, u.floor_number || 1,
      u.type || 'villa', u.area_sqm || 0, u.bedrooms || 4, u.bathrooms || 3,
      u.price || 0, u.lat || null, u.lng || null,
      u.status || 'available',
      typeof u.features === 'string' ? u.features : JSON.stringify(u.features || []),
      u.image_url || null, u.gsas_score || null, ts
    ).run()
    inserted++
  }

  // Recount actual DB totals
  const counts = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) as avail
    FROM units WHERE project_id = ?
  `).bind(projectId).first() as any
  await c.env.DB.prepare(
    'UPDATE projects SET total_units = ?, available_units = ?, updated_at = ? WHERE id = ?'
  ).bind(counts?.total || inserted, counts?.avail || inserted, ts, projectId).run()

  return c.json({ id: unitList.length === 1 ? undefined : undefined, success: true, units_created: inserted })
})

// ── Developer Portal: Publish project ─────────────────────────────────────
app.post('/developer/projects/:id/publish', async (c) => {
  const projectId = c.req.param('id')
  const body = await c.req.json().catch(() => ({})) as any
  const ts = now()

  // Enrich project with marketing info
  await c.env.DB.prepare(`
    UPDATE projects SET status = 'active', listing_visible = 1, green_eligible = 1, premium_tier = 1,
    marketing_tagline = ?, price_from = ?, price_to = ?, amenities = ?,
    completion_date = ?, updated_at = ? WHERE id = ?
  `).bind(
    body.marketing_tagline || 'Certified green living — GSAS Gold, EPC A-rated, energy-efficient villas in Seeb',
    body.price_from || 178000,
    body.price_to || 198000,
    JSON.stringify(body.amenities || ['GSAS Gold Certified', 'Solar Panels', 'Smart Home', 'EV Charging', 'Private Pool Available']),
    body.completion_date || '2027-Q4',
    ts, projectId
  ).run()

  await logAudit(c.env.DB, {
    userId: body.user_id || 'u010', userName: 'Ahmed Al-Hinai', userRole: 'developer',
    action: 'PROJECT_PUBLISHED', entityType: 'project', entityId: projectId,
    details: { listing_visible: true, green_eligible: true },
  })

  return c.json({ success: true, listing_visible: true })
})

// ── Developer Portal: PATCH project meta (hero_image_url etc.) ────────────
app.patch('/developer/projects/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}) as any)
  const ts = now()
  const allowed = ['hero_image_url','marketing_tagline','price_from','price_to',
    'completion_date','amenities','gsas_score','gsas_rating','epc_rating',
    'eia_reference','green_eligible','premium_tier','listing_visible','name','location','governorate']
  const fields: string[] = []
  const vals: any[] = []
  for (const k of allowed) {
    if (body[k] !== undefined) { fields.push(`${k}=?`); vals.push(body[k]) }
  }
  if (!fields.length) return c.json({ success: true })
  vals.push(ts, id)
  await c.env.DB.prepare(`UPDATE projects SET ${fields.join(',')}, updated_at=? WHERE id=?`).bind(...vals).run()
  return c.json({ success: true })
})

// ── Developer Portal: PATCH single unit (status, price, etc.) ────────────
app.patch('/developer/projects/:pid/units/:uid', async (c) => {
  const projectId = c.req.param('pid')
  const unitId = c.req.param('uid')
  const body = await c.req.json().catch(() => ({}) as any)
  const ts = now()

  const allowed = ['status', 'price', 'unit_number', 'type', 'area_sqm',
    'bedrooms', 'bathrooms', 'image_url', 'gsas_score', 'features', 'floor_number']
  const fields: string[] = []
  const vals: any[] = []
  for (const k of allowed) {
    if (body[k] !== undefined) { fields.push(`${k}=?`); vals.push(body[k]) }
  }
  if (!fields.length) return c.json({ success: true, message: 'No fields to update' })
  vals.push(unitId, projectId)

  await c.env.DB.prepare(
    `UPDATE units SET ${fields.join(',')} WHERE id=? AND project_id=?`
  ).bind(...vals).run()

  // Recount project unit stats after status change
  if (body.status !== undefined) {
    const counts = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) as avail,
        SUM(CASE WHEN status='reserved' THEN 1 ELSE 0 END) as res,
        SUM(CASE WHEN status='sold' THEN 1 ELSE 0 END) as sold
      FROM units WHERE project_id = ?
    `).bind(projectId).first() as any
    await c.env.DB.prepare(
      `UPDATE projects SET total_units=?, available_units=?, reserved_units=?, sold_units=?, updated_at=? WHERE id=?`
    ).bind(
      counts?.total || 0, counts?.avail || 0, counts?.res || 0, counts?.sold || 0, ts, projectId
    ).run()
  }

  return c.json({ success: true })
})

// ── Developer Portal: Get developer's projects ────────────────────────────
app.get('/developer/projects', async (c) => {
  const developerId = c.req.query('developer_id') || 'd001'
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, d.company_name as developer_name,
     (SELECT COUNT(*) FROM units u WHERE u.project_id = p.id AND u.status = 'available') as units_available,
     (SELECT COUNT(*) FROM applications a WHERE a.project_id = p.id) as total_applications
     FROM projects p LEFT JOIN developers d ON p.developer_id = d.id
     WHERE p.developer_id = ? ORDER BY p.created_at DESC`
  ).bind(developerId).all()

  return c.json({ projects: results, total: results.length })
})

export { app as portalApi }
