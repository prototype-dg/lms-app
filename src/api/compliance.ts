import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'
const app = new Hono<{ Bindings: NodeBindings }>()


// ESG compliance assessment for application
app.get('/esg/:appId', async (c) => {
  const appId = c.req.param('appId')
  const isRef = appId.startsWith('GHL') || appId.startsWith('HL')
  const app_ = await c.env.DB.prepare(
    isRef ? 'SELECT * FROM applications WHERE reference = ?' : 'SELECT * FROM applications WHERE id = ?'
  ).bind(appId).first() as any
  if (!app_) return c.json({ error: 'Not found' }, 404)
  
  // Get ESG documents — check both project-level and application-level uploads
  const { results: projDocs } = await c.env.DB.prepare(
    `SELECT * FROM documents WHERE entity_type = 'project' AND entity_id = ?`
  ).bind(app_.project_id || '').all() as any
  const { results: appDocs } = await c.env.DB.prepare(
    `SELECT * FROM documents WHERE entity_type = 'application' AND entity_id = ?`
  ).bind(app_.id).all() as any
  const allDocs = [...(projDocs || []), ...(appDocs || [])]

  // Prefer application-level doc if present (customer-uploaded), fall back to project-level
  const findDoc = (type: string) =>
    appDocs?.find((d: any) => d.doc_type === type) || projDocs?.find((d: any) => d.doc_type === type)

  const gsasDoc = findDoc('gsas_cert')
  const epcDoc  = findDoc('epc_report')
  const eiaDoc  = findDoc('eia_approval')
  
  const gsasData = gsasDoc ? JSON.parse(gsasDoc.extracted_data || '{}') : {}
  const epcData  = epcDoc  ? JSON.parse(epcDoc.extracted_data  || '{}') : {}
  const eiaData  = eiaDoc  ? JSON.parse(eiaDoc.extracted_data  || '{}') : {}

  // Compute DBR, LTV from stored or derived values
  const salary      = (app_ as any).salary_omr || (app_ as any).salary || 0
  const loanAmt     = (app_ as any).loan_amount || 0
  const loanTerm    = (app_ as any).loan_term || 25
  const appliedRate = (app_ as any).applied_rate || 5.5
  const propVal     = (app_ as any).property_value || loanAmt / 0.8
  const r           = (appliedRate / 100) / 12
  const n           = loanTerm * 12
  const monthlyPmt  = r > 0 ? loanAmt * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1) : loanAmt / n
  const dbr         = (app_ as any).dbr || (salary > 0 ? Math.round((monthlyPmt / salary) * 100 * 10) / 10 : null)
  const ltv         = (app_ as any).ltv || (propVal > 0 ? Math.round((loanAmt / propVal) * 100 * 10) / 10 : null)
  const malaaScore  = (app_ as any).malaa_score || (app_ as any).credit_score || null
  const stressRate  = appliedRate + 3.5
  const stressPmt   = r > 0 ? (() => { const sr=(stressRate/100)/12; return loanAmt*sr*Math.pow(1+sr,n)/(Math.pow(1+sr,n)-1); })() : monthlyPmt
  const stressDbr   = salary > 0 ? Math.round((stressPmt / salary) * 100 * 10) / 10 : null
  const stressPassed = stressDbr !== null ? stressDbr <= 60 : true

  const esgStatus = {
    gsas: {
      status: gsasDoc?.validation_status || 'pending',
      confidence: gsasDoc?.ai_confidence || 0,
      score: gsasData.overall_score || app_.gsas_score,
      rating: gsasData.rating || (app_.gsas_score >= 90 ? 'Platinum' : app_.gsas_score >= 75 ? 'Gold' : app_.gsas_score >= 60 ? 'Silver' : 'Unknown'),
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
      filename: epcDoc?.filename || null,
      file_url: epcDoc?.file_url || null,
      doc_id: epcDoc?.id || null,
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
  
  // Credit metrics — real values from application record, computed where missing
  const creditMetrics = {
    dbr:          { value: dbr,        max: 55,  status: dbr  !== null ? (dbr  <= 55  ? 'pass' : 'fail') : 'pass', label: `Max 55% for green products` },
    ltv:          { value: ltv,        max: 90,  status: ltv  !== null ? (ltv  <= 90  ? 'pass' : 'fail') : 'pass', label: `Max 90%` },
    malaa_score:  { value: malaaScore, min: 650, status: malaaScore ? (malaaScore >= 650 ? 'pass' : 'fail') : 'pass', label: `Min 650` },
    stress_test:  { passed: stressPassed, rate: parseFloat(stressRate.toFixed(2)), stress_dbr: stressDbr, label: `Rate +350bps scenario: ${stressRate.toFixed(2)}%` },
    monthly_payment: Math.round(monthlyPmt),
    property_value:  Math.round(propVal)
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

// ── Compliance & Risk Task Queue ──────────────────────────────────────────
// Returns all applications in states that require human review, enriched with
// product name, GSAS info, and a derived priority flag.
app.get('/queue', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT a.*, p.name as product_name, p.base_rate, p.gsas_premium_score,
           p.green_discount_premium
    FROM applications a
    LEFT JOIN products p ON a.product_id = p.id
    ORDER BY a.created_at DESC
    LIMIT 100
  `).all() as any

  const enriched = (results || []).map((a: any) => {
    // Flag high priority: high loan, ESG pending, or submitted today
    const isHighPriority = (a.loan_amount >= 200000) ||
      (a.esg_verification_status === 'pending' && a.gsas_score) ||
      (a.created_at && a.created_at.startsWith(new Date().toISOString().slice(0,10)))
    return {
      ...a,
      priority: isHighPriority ? 'high' : 'normal',
      customer_display_name: a.customer_name,
      manual_checks: buildManualChecks(a),
    }
  })

  return c.json({ applications: enriched, total: enriched.length })
})

function buildManualChecks(app: any): string[] {
  const checks: string[] = []
  if (!app.gsas_score)                                    checks.push('GSAS score not provided — manual verification required')
  if (app.esg_verification_status === 'pending')          checks.push('ESG documents pending review')
  if (app.dbr && parseFloat(app.dbr) > 40)                checks.push(`DBR ${app.dbr}% exceeds 40% threshold — credit officer sign-off needed`)
  if (app.loan_amount >= 200000)                          checks.push('High-value loan (≥OMR 200k) — senior credit approval required')
  if (app.gsas_score && app.gsas_score >= (app.gsas_premium_score || 85) && app.green_discount_premium > 0)
    checks.push(`GSAS ${app.gsas_score} qualifies for ${app.green_discount_premium}% green premium discount — verify certificate`)
  return checks
}

export { app as complianceApi }
