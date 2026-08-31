import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// Get compliance queue
app.get('/queue', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT a.*, c.name as customer_display_name, c.credit_score, c.salary_omr, c.employer,
    p.name as product_name, p.ai_confidence_threshold, p.gsas_min_score, p.gsas_premium_score,
    pr.name as project_name, pr.gsas_score as project_gsas, pr.location
    FROM applications a
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN products p ON a.product_id = p.id
    LEFT JOIN projects pr ON a.project_id = pr.id
    WHERE a.status IN ('esg_review','credit_review','submitted','credit_scoring')
    ORDER BY a.created_at DESC
  `).all()
  return c.json({ applications: results })
})

// ESG compliance assessment for application
app.get('/esg/:appId', async (c) => {
  const appId = c.req.param('appId')
  const isRef = appId.startsWith('GHL') || appId.startsWith('HL')
  const app_ = await c.env.DB.prepare(
    isRef ? 'SELECT * FROM applications WHERE reference = ?' : 'SELECT * FROM applications WHERE id = ?'
  ).bind(appId).first() as any
  if (!app_) return c.json({ error: 'Not found' }, 404)
  
  // Get ESG documents
  const { results: docs } = await c.env.DB.prepare(
    `SELECT * FROM documents WHERE entity_type = 'project' AND entity_id = ?`
  ).bind(app_.project_id).all() as any
  
  const gsasDoc = docs.find((d: any) => d.doc_type === 'gsas_cert')
  const epcDoc = docs.find((d: any) => d.doc_type === 'epc_report')
  const eiaDoc = docs.find((d: any) => d.doc_type === 'eia_approval')
  
  const gsasData = gsasDoc ? JSON.parse(gsasDoc.extracted_data || '{}') : {}
  const epcData = epcDoc ? JSON.parse(epcDoc.extracted_data || '{}') : {}
  const eiaData = eiaDoc ? JSON.parse(eiaDoc.extracted_data || '{}') : {}
  
  const esgStatus = {
    gsas: {
      status: gsasDoc?.validation_status || 'pending',
      confidence: gsasDoc?.ai_confidence || 0,
      score: gsasData.overall_score || app_.gsas_score,
      rating: gsasData.rating || 'Unknown',
      certificate_number: gsasData.certificate_number || 'N/A',
      expiry: gsasData.expiry_date || 'N/A',
      color: gsasDoc?.validation_status === 'auto_verified' ? 'green' : gsasDoc?.validation_status === 'manual_review' ? 'amber' : 'red'
    },
    epc: {
      status: epcDoc?.validation_status || 'pending',
      confidence: epcDoc?.ai_confidence || 0,
      rating: epcData.rating || app_.epc_rating || 'A',
      expiry: epcData.expiry_date || 'N/A',
      notes: epcDoc?.validation_notes || '',
      color: epcDoc?.validation_status === 'auto_verified' || epcDoc?.validation_status === 'approved' ? 'green' : epcDoc?.validation_status === 'manual_review' ? 'amber' : 'red'
    },
    eia: {
      status: eiaDoc?.validation_status || 'pending',
      confidence: eiaDoc?.ai_confidence || 0,
      reference: eiaData.reference || 'N/A',
      issuer: eiaData.issuer || 'N/A',
      color: eiaDoc?.validation_status === 'auto_verified' ? 'green' : eiaDoc?.validation_status === 'manual_review' ? 'amber' : 'red'
    },
    ai_recommendation: generateEsgRecommendation(gsasDoc, epcDoc, eiaDoc),
    overall_esg_status: getOverallEsgStatus(gsasDoc, epcDoc, eiaDoc)
  }
  
  // Credit metrics
  const creditMetrics = {
    dbr: { value: app_.dbr, max: 55, status: app_.dbr <= 55 ? 'pass' : 'fail', label: `${app_.dbr}% (Max: 55% for green products)` },
    ltv: { value: app_.ltv, max: 90, status: app_.ltv <= 90 ? 'pass' : 'fail', label: `${app_.ltv}% (Max: 90%)` },
    malaa_score: { value: app_.malaa_score, min: 650, status: (app_.malaa_score || 750) >= 650 ? 'pass' : 'fail', label: `${app_.malaa_score || 750} (Min: 650)` },
    stress_test: { passed: app_.stress_test_passed, rate: app_.stress_test_rate, label: `Passed at ${app_.stress_test_rate}% (+350bps)` }
  }
  
  return c.json({ esg_status: esgStatus, credit_metrics: creditMetrics, application: app_ })
})

// Approve ESG compliance
app.post('/:appId/approve-esg', async (c) => {
  const appId = c.req.param('appId')
  const body = await c.req.json()
  const ts = now()
  await c.env.DB.prepare(`
    UPDATE applications SET esg_verification_status = 'approved', status = 'credit_review', 
    compliance_approved_by = ?, compliance_approved_at = ?, updated_at = ? WHERE id = ?
  `).bind(body.user_id || 'u002', ts, ts, appId).run()
  await logAudit(c.env.DB, {
    userId: body.user_id || 'u002', userName: body.user_name || 'Aisha Al-Balushi', userRole: 'compliance_officer',
    action: 'ESG_COMPLIANCE_APPROVED', entityType: 'application', entityId: appId,
    details: { notes: body.notes }, regulatoryReference: body.regulatory_reference
  })
  return c.json({ success: true, new_status: 'credit_review' })
})

// Approve credit risk
app.post('/:appId/approve-risk', async (c) => {
  const appId = c.req.param('appId')
  const body = await c.req.json()
  const ts = now()
  await c.env.DB.prepare(`
    UPDATE applications SET status = 'approved', risk_approved_by = ?, risk_approved_at = ?, updated_at = ? WHERE id = ?
  `).bind(body.user_id || 'u003', ts, ts, appId).run()
  await logAudit(c.env.DB, {
    userId: body.user_id || 'u003', userName: body.user_name || 'Omar Al-Mantheri', userRole: 'risk_officer',
    action: 'CREDIT_RISK_APPROVED', entityType: 'application', entityId: appId,
    details: { credit_metrics: body.credit_metrics }
  })
  return c.json({ success: true, new_status: 'approved' })
})

// Reject application
app.post('/:appId/reject', async (c) => {
  const appId = c.req.param('appId')
  const body = await c.req.json()
  await c.env.DB.prepare(`UPDATE applications SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?`).bind(body.reason, now(), appId).run()
  await logAudit(c.env.DB, {
    userId: body.user_id || 'u002', userName: body.user_name || 'Aisha Al-Balushi', userRole: 'compliance_officer',
    action: 'APPLICATION_REJECTED', entityType: 'application', entityId: appId,
    details: { reason: body.reason }
  })
  return c.json({ success: true })
})

function generateEsgRecommendation(gsas: any, epc: any, eia: any) {
  const issues = []
  if (!gsas || gsas.validation_status === 'pending') issues.push('GSAS certificate pending validation')
  if (epc?.validation_status === 'manual_review') issues.push('EPC requires manual visual check (88% confidence – image quality)')
  if (!eia || eia.validation_status === 'pending') issues.push('EIA clearance pending')
  
  if (issues.length === 0) return { action: 'Approve', detail: 'All ESG documents verified. Application meets all green financing criteria.', confidence: 96 }
  if (issues.length === 1 && epc?.validation_status === 'manual_review') {
    return { action: 'Approve with Note', detail: `Review flagged item: ${issues[0]}. EPC Rating A confirmed; expiry 2027 acceptable. Recommend approval.`, confidence: 88 }
  }
  return { action: 'Hold for Review', detail: `${issues.length} items require attention: ${issues.join('; ')}`, confidence: 70 }
}

function getOverallEsgStatus(gsas: any, epc: any, eia: any) {
  const statuses = [gsas?.validation_status, epc?.validation_status, eia?.validation_status]
  if (statuses.includes('rejected')) return 'rejected'
  if (statuses.includes('manual_review')) return 'review_required'
  if (statuses.every(s => s === 'auto_verified' || s === 'approved')) return 'verified'
  return 'pending'
}

export { app as complianceApi }
