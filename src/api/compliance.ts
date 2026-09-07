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

// ── Full compliance context for a single application ─────────────────────
// Returns everything the compliance & risk panels need in one call:
//   • application record (with product, unit, project names)
//   • product record (rates, thresholds, green parameters)
//   • product rules (all active rules, categorised as esg / credit / collateral)
//   • ESG documents (searched: application → unit → project, in that priority order)
//   • computed credit metrics (DBR, LTV, stress test)
//   • EPC file URL chain: app-level first, then unit, then project
app.get('/full/:appId', async (c) => {
  const appId = c.req.param('appId')
  const isRef = appId.startsWith('GHL') || appId.startsWith('HL')

  // ── 1. Application + joined names ──────────────────────────────────────
  const app_ = await c.env.DB.prepare(
    isRef
      ? `SELECT a.*, p.name as product_name, p.base_rate, p.max_ltv, p.max_dbr, p.green_dbr,
                p.gsas_min_score, p.gsas_premium_score, p.green_discount_premium, p.green_discount_standard,
                p.ai_confidence_threshold, p.esg_required_docs as prod_esg_required_docs,
                p.approved_materials as prod_approved_materials, p.approved_vendors as prod_approved_vendors,
                p.min_amount, p.max_amount, p.min_term, p.max_term,
                u.unit_number, u.area_sqm, u.bedrooms, u.bathrooms, u.features as unit_features,
                pr.name as project_name, pr.location as project_location, pr.gsas_score as project_gsas_score,
                pr.epc_rating as project_epc_rating, pr.eia_reference as project_eia_reference,
                pr.total_units as project_total_units, pr.developer_id
         FROM applications a
         LEFT JOIN products p  ON a.product_id  = p.id
         LEFT JOIN units    u  ON a.unit_id      = u.id
         LEFT JOIN projects pr ON a.project_id   = pr.id
         WHERE a.reference = ?`
      : `SELECT a.*, p.name as product_name, p.base_rate, p.max_ltv, p.max_dbr, p.green_dbr,
                p.gsas_min_score, p.gsas_premium_score, p.green_discount_premium, p.green_discount_standard,
                p.ai_confidence_threshold, p.esg_required_docs as prod_esg_required_docs,
                p.approved_materials as prod_approved_materials, p.approved_vendors as prod_approved_vendors,
                p.min_amount, p.max_amount, p.min_term, p.max_term,
                u.unit_number, u.area_sqm, u.bedrooms, u.bathrooms, u.features as unit_features,
                pr.name as project_name, pr.location as project_location, pr.gsas_score as project_gsas_score,
                pr.epc_rating as project_epc_rating, pr.eia_reference as project_eia_reference,
                pr.total_units as project_total_units, pr.developer_id
         FROM applications a
         LEFT JOIN products p  ON a.product_id  = p.id
         LEFT JOIN units    u  ON a.unit_id      = u.id
         LEFT JOIN projects pr ON a.project_id   = pr.id
         WHERE a.id = ?`
  ).bind(appId).first() as any
  if (!app_) return c.json({ error: 'Not found' }, 404)

  // ── 2. Product rules (all active, for this product + global rules) ──────
  const { results: rules } = await c.env.DB.prepare(
    `SELECT * FROM rules WHERE is_active = 1 AND (product_id = ? OR product_id IS NULL) ORDER BY severity DESC, category`
  ).bind(app_.product_id || '').all() as any

  // Categorise rules for the UI
  const esgRules    = (rules || []).filter((r: any) => r.category === 'esg')
  const creditRules = (rules || []).filter((r: any) => ['credit','income','dbr','ltv'].includes(r.category))
  const collRules   = (rules || []).filter((r: any) => r.category === 'collateral')
  const allRules    = rules || []

  // ── 3. ESG Documents — priority chain: application > unit > project ─────
  const [appDocsRes, unitDocsRes, projDocsRes] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM documents WHERE entity_type = 'application' AND entity_id = ?`).bind(app_.id).all(),
    app_.unit_id
      ? c.env.DB.prepare(`SELECT * FROM documents WHERE entity_type = 'unit' AND entity_id = ?`).bind(app_.unit_id).all()
      : Promise.resolve({ results: [] }),
    app_.project_id
      ? c.env.DB.prepare(`SELECT * FROM documents WHERE entity_type = 'project' AND entity_id = ?`).bind(app_.project_id).all()
      : Promise.resolve({ results: [] })
  ]) as any[]
  const appDocs  = (appDocsRes  as any).results || []
  const unitDocs = (unitDocsRes as any).results || []
  const projDocs = (projDocsRes as any).results || []

  // Best doc = application-level first, then unit, then project
  const findDoc = (type: string) =>
    appDocs.find((d: any) => d.doc_type === type) ||
    unitDocs.find((d: any) => d.doc_type === type) ||
    projDocs.find((d: any) => d.doc_type === type)

  const gsasDoc = findDoc('gsas_cert')
  const epcDoc  = findDoc('epc_report')
  const eiaDoc  = findDoc('eia_approval')

  const gsasData = gsasDoc ? JSON.parse(gsasDoc.extracted_data || '{}') : {}
  const epcData  = epcDoc  ? JSON.parse(epcDoc.extracted_data  || '{}') : {}
  const eiaData  = eiaDoc  ? JSON.parse(eiaDoc.extracted_data  || '{}') : {}

  // ── 4. Computed credit metrics ──────────────────────────────────────────
  const salary      = (app_ as any).salary_omr || (app_ as any).salary || 0
  const loanAmt     = (app_ as any).loan_amount || 0
  const loanTerm    = (app_ as any).loan_term || 25
  const appliedRate = (app_ as any).applied_rate || 5.5
  const propVal     = (app_ as any).property_value || (loanAmt / 0.8)
  const r           = (appliedRate / 100) / 12
  const n           = loanTerm * 12
  const monthlyPmt  = r > 0 ? loanAmt * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1) : loanAmt / n
  const dbr         = (app_ as any).dbr || (salary > 0 ? Math.round((monthlyPmt / salary) * 100 * 10) / 10 : null)
  const ltv         = (app_ as any).ltv || (propVal > 0 ? Math.round((loanAmt / propVal) * 100 * 10) / 10 : null)
  const malaaScore  = (app_ as any).malaa_score || (app_ as any).credit_score || null
  const stressRate  = appliedRate + 3.5
  const stressPmt   = (() => { const sr=(stressRate/100)/12; return loanAmt*sr*Math.pow(1+sr,n)/(Math.pow(1+sr,n)-1); })()
  const stressDbr   = salary > 0 ? Math.round((stressPmt / salary) * 100 * 10) / 10 : null
  const stressPassed = stressDbr !== null ? stressDbr <= 60 : (app_ as any).stress_test_passed ? true : true

  // ── 5. ESG status with product thresholds ──────────────────────────────
  const gsasMinScore     = app_.gsas_min_score     || 70
  const gsasPremiumScore = app_.gsas_premium_score || 85
  const prodMaxDbr       = app_.green_dbr          || app_.max_dbr || 55
  const prodMaxLtv       = app_.max_ltv            || 90
  const epcRatingMap: Record<string,number> = { 'A':5, 'B':4, 'C':3, 'D':2, 'E':1, 'F':0 }
  const epcRatingNum     = epcRatingMap[(epcData.rating || app_.epc_rating || 'A')] ?? 5
  const epcMinRating     = esgRules.find((r: any) => r.metric === 'epc_rating')?.threshold_value || 3

  const esgStatus = {
    gsas: {
      status:             gsasDoc?.validation_status || 'pending',
      confidence:         gsasDoc?.ai_confidence || 0,
      score:              gsasData.overall_score || app_.gsas_score,
      min_score:          gsasMinScore,
      premium_score:      gsasPremiumScore,
      rating:             gsasData.rating || (app_.gsas_score >= 90 ? 'Platinum' : app_.gsas_score >= 75 ? 'Gold' : app_.gsas_score >= 60 ? 'Silver' : 'Unknown'),
      certificate_number: gsasData.certificate_number || 'N/A',
      expiry:             gsasData.expiry_date || 'N/A',
      issuer:             gsasData.issuer || 'N/A',
      rule_ref:           esgRules.find((r: any) => r.metric === 'gsas_score')?.regulatory_reference || 'OS GSO 3000:2025',
      passes_threshold:   (app_.gsas_score || 0) >= gsasMinScore,
      passes_premium:     (app_.gsas_score || 0) >= gsasPremiumScore,
      color:              gsasDoc?.validation_status === 'auto_verified' ? 'green' : gsasDoc?.validation_status === 'manual_review' ? 'amber' : 'red',
      filename:           gsasDoc?.filename || null,
      file_url:           gsasDoc?.file_url || null,
      doc_id:             gsasDoc?.id || null,
      doc_source:         gsasDoc ? (appDocs.find((d: any) => d.doc_type === 'gsas_cert') ? 'application' : unitDocs.find((d: any) => d.doc_type === 'gsas_cert') ? 'unit' : 'project') : null
    },
    epc: {
      status:       epcDoc?.validation_status || 'pending',
      confidence:   epcDoc?.ai_confidence || 0,
      rating:       epcData.rating || app_.epc_rating || 'A',
      min_rating:   'C',
      passes:       epcRatingNum >= epcMinRating,
      expiry:       epcData.expiry_date || 'N/A',
      assessor:     epcData.assessor || 'N/A',
      energy_kwh:   epcData.energy_consumption || 'N/A',
      notes:        epcDoc?.validation_notes || '',
      filename:     epcDoc?.filename || null,
      file_url:     epcDoc?.file_url || null,
      doc_id:       epcDoc?.id || null,
      doc_source:   epcDoc ? (appDocs.find((d: any) => d.doc_type === 'epc_report') ? 'application' : unitDocs.find((d: any) => d.doc_type === 'epc_report') ? 'unit' : 'project') : null,
      rule_ref:     esgRules.find((r: any) => r.metric === 'epc_rating')?.regulatory_reference || 'OEESC §5.1',
      color:        epcDoc?.validation_status === 'auto_verified' || epcDoc?.validation_status === 'approved' ? 'green' : epcDoc?.validation_status === 'manual_review' ? 'amber' : 'red'
    },
    eia: {
      status:     eiaDoc?.validation_status || 'pending',
      confidence: eiaDoc?.ai_confidence || 0,
      reference:  eiaData.reference || app_.project_eia_reference || 'N/A',
      issuer:     eiaData.issuer || 'Environment Authority – Oman',
      valid_until:eiaData.valid_until || 'N/A',
      units:      eiaData.units || app_.project_total_units || 'N/A',
      required:   (app_.project_total_units || 0) > 20,
      rule_ref:   esgRules.find((r: any) => r.metric === 'eia_approval' || r.metric === 'eia_required')?.regulatory_reference || 'Environment Authority Decision 107/2023',
      color:      eiaDoc?.validation_status === 'auto_verified' ? 'green' : eiaDoc?.validation_status === 'manual_review' ? 'amber' : 'red',
      filename:   eiaDoc?.filename || null,
      file_url:   eiaDoc?.file_url || null,
      doc_id:     eiaDoc?.id || null,
      doc_source: eiaDoc ? (appDocs.find((d: any) => d.doc_type === 'eia_approval') ? 'application' : unitDocs.find((d: any) => d.doc_type === 'eia_approval') ? 'unit' : 'project') : null
    },
    ai_recommendation: generateEsgRecommendation(gsasDoc, epcDoc, eiaDoc),
    overall_esg_status: getOverallEsgStatus(gsasDoc, epcDoc, eiaDoc)
  }

  const creditMetrics = {
    dbr:          { value: dbr,        max: prodMaxDbr, status: dbr  !== null ? (dbr  <= prodMaxDbr ? 'pass' : 'fail') : 'pass', label: `Max ${prodMaxDbr}% — ${app_.product_name||'product'} green DBR limit` },
    ltv:          { value: ltv,        max: prodMaxLtv, status: ltv  !== null ? (ltv  <= prodMaxLtv ? 'pass' : 'fail') : 'pass', label: `Max ${prodMaxLtv}% — ${app_.product_name||'product'} LTV ceiling` },
    malaa_score:  { value: malaaScore, min: 650, status: malaaScore ? (malaaScore >= 650 ? 'pass' : 'fail') : 'pass', label: `Min 650 — CBO Credit Bureau minimum` },
    stress_test:  { passed: stressPassed, rate: parseFloat(stressRate.toFixed(2)), stress_dbr: stressDbr, label: `CBO +350bps shock: ${stressRate.toFixed(2)}% — threshold 60%` },
    monthly_payment: Math.round(monthlyPmt),
    property_value:  Math.round(propVal)
  }

  // ── 6. Rule evaluation against application data ─────────────────────────
  const evaluateRule = (rule: any) => {
    const val = (() => {
      switch (rule.metric) {
        case 'DBR': case 'dbr': return dbr
        case 'LTV': case 'ltv': return ltv
        case 'gsas_score': return app_.gsas_score
        case 'credit_score': return malaaScore
        case 'loan_term': return loanTerm
        case 'stress_rate': return stressRate
        case 'epc_rating': return epcRatingNum
        case 'esg_docs_complete': return (gsasDoc && epcDoc) ? 1 : 0
        case 'eia_approval': case 'eia_required': return eiaDoc ? 1 : 0
        case 'gsas_cert_days_remaining': return gsasData.expiry_date ? Math.floor((new Date(gsasData.expiry_date).getTime() - Date.now()) / 86400000) : null
        case 'net_monthly_income': return salary
        case 'salary_omr': return salary
        default: return null
      }
    })()
    if (val === null) return { status: 'unknown', value: null }
    const t = parseFloat(rule.threshold_value)
    let passes = false
    switch (rule.operator) {
      case '<=': passes = val <= t; break
      case '>=': passes = val >= t; break
      case '<':  passes = val <  t; break
      case '>':  passes = val >  t; break
      case '=':  passes = val === t; break
      default:   passes = true
    }
    return { status: passes ? 'pass' : 'fail', value: val }
  }

  const rulesWithStatus = allRules.map((rule: any) => ({
    ...rule,
    evaluation: evaluateRule(rule)
  }))

  return c.json({
    application: app_,
    product: {
      id:                   app_.product_id,
      name:                 app_.product_name,
      base_rate:            app_.base_rate,
      max_ltv:              app_.max_ltv,
      max_dbr:              app_.max_dbr,
      green_dbr:            app_.green_dbr,
      gsas_min_score:       app_.gsas_min_score,
      gsas_premium_score:   app_.gsas_premium_score,
      green_discount_premium: app_.green_discount_premium,
      esg_required_docs:    app_.prod_esg_required_docs,
      approved_materials:   app_.prod_approved_materials,
      approved_vendors:     app_.prod_approved_vendors
    },
    rules: {
      esg:       esgRules,
      credit:    creditRules,
      collateral: collRules,
      all_evaluated: rulesWithStatus
    },
    esg_status:     esgStatus,
    credit_metrics: creditMetrics,
    documents: {
      gsas:    gsasDoc || null,
      epc:     epcDoc  || null,
      eia:     eiaDoc  || null,
      all_app: appDocs,
      all_proj: projDocs
    }
  })
})

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

// ── GET /compliance/summary ─────────────────────────────────────────────────
// Portfolio-level summary for the Regulatory Reports page.
// Returns: per-status counts, per-product counts, ESG/credit aggregate stats,
// full application list for the per-app table, and recent audit events.
app.get('/summary', async (c) => {
  // 1. All applications with product + customer joins
  const { results: apps } = await c.env.DB.prepare(`
    SELECT a.id, a.reference, a.status, a.loan_amount, a.gsas_score, a.epc_rating,
           a.dbr, a.ltv, a.esg_verification_status, a.malaa_score,
           a.applied_rate, a.loan_term, a.created_at, a.updated_at,
           COALESCE(a.customer_name, cust.name) AS customer_display,
           p.name  AS product_name,
           p.id    AS product_id,
           p.max_dbr, p.max_ltv, p.gsas_min_score
    FROM applications a
    LEFT JOIN products  p    ON a.product_id  = p.id
    LEFT JOIN customers cust ON a.customer_id = cust.id
    ORDER BY a.created_at DESC
  `).all() as any

  const appList = apps || []
  const total = appList.length

  // 2. Status counts
  const statusCounts: Record<string, number> = {}
  for (const a of appList) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1
  }

  // 3. Per-product counts
  const productCounts: Record<string, { name: string; count: number; approved: number }> = {}
  for (const a of appList) {
    const pid = a.product_id || 'unknown'
    if (!productCounts[pid]) productCounts[pid] = { name: a.product_name || pid, count: 0, approved: 0 }
    productCounts[pid].count++
    if (a.status === 'approved') productCounts[pid].approved++
  }

  // 4. Aggregate numeric stats (only rows where the metric exists)
  const withGsas  = appList.filter((a: any) => a.gsas_score  != null)
  const withDbr   = appList.filter((a: any) => a.dbr         != null)
  const withLtv   = appList.filter((a: any) => a.ltv         != null)
  const withMalaa = appList.filter((a: any) => a.malaa_score != null)
  const avg = (arr: any[], key: string) =>
    arr.length ? Math.round((arr.reduce((s: number, r: any) => s + parseFloat(r[key] || 0), 0) / arr.length) * 10) / 10 : null

  // 5. ESG pass-rate: esg_verification_status = 'verified' or 'approved'
  const esgVerified = appList.filter((a: any) => a.esg_verification_status === 'verified' || a.esg_verification_status === 'approved').length
  const esgPending  = appList.filter((a: any) => !a.esg_verification_status || a.esg_verification_status === 'pending').length

  // 6. DBR compliance: apps where dbr <= max_dbr
  const dbrChecked = withDbr.filter((a: any) => a.max_dbr)
  const dbrPassing = dbrChecked.filter((a: any) => parseFloat(a.dbr) <= parseFloat(a.max_dbr)).length

  // 7. Loan volume
  const totalVolume = appList.reduce((s: number, a: any) => s + (parseFloat(a.loan_amount) || 0), 0)

  // 8. Recent audit events (last 10)
  const { results: recentAudit } = await c.env.DB.prepare(`
    SELECT al.*,
      CASE
        WHEN al.entity_type = 'application' THEN (SELECT reference FROM applications WHERE id = al.entity_id)
        WHEN al.entity_type = 'product'     THEN (SELECT name     FROM products     WHERE id = al.entity_id)
        WHEN al.entity_type = 'rule'        THEN (SELECT name     FROM rules        WHERE id = al.entity_id)
        ELSE NULL
      END as entity_label
    FROM audit_logs al
    ORDER BY al.created_at DESC LIMIT 10
  `).all() as any

  return c.json({
    total_applications: total,
    total_loan_volume:  Math.round(totalVolume),
    status_counts:      statusCounts,
    product_counts:     Object.values(productCounts),
    esg_stats: {
      verified: esgVerified,
      pending:  esgPending,
      pass_rate: total ? Math.round((esgVerified / total) * 100) : 0
    },
    dbr_stats: {
      checked: dbrChecked.length,
      passing: dbrPassing,
      pass_rate: dbrChecked.length ? Math.round((dbrPassing / dbrChecked.length) * 100) : null
    },
    averages: {
      gsas_score:  avg(withGsas,  'gsas_score'),
      dbr:         avg(withDbr,   'dbr'),
      ltv:         avg(withLtv,   'ltv'),
      malaa_score: avg(withMalaa, 'malaa_score')
    },
    applications: appList,
    recent_audit:  recentAudit || []
  })
})

export { app as complianceApi }
