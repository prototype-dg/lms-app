import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'

type Bindings = { DB: D1Database; VPS_URL: string }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const entityType = c.req.query('entity_type')
  const entityId = c.req.query('entity_id')
  let query = 'SELECT * FROM documents'
  const params: any[] = []
  if (entityType && entityId) {
    query += ' WHERE entity_type = ? AND entity_id = ?'
    params.push(entityType, entityId)
  }
  query += ' ORDER BY created_at DESC'
  const { results } = await c.env.DB.prepare(query).bind(...params).all()
  return c.json({ documents: results })
})

// Simulate document upload and AI analysis
app.post('/analyze', async (c) => {
  const body = await c.req.json()
  const { doc_type, filename, entity_id, entity_type = 'project', user_id = 'system' } = body

  // Demo: Return pre-defined analysis results based on doc type
  const demoData = getDemoAnalysis(doc_type, filename)
  const id = generateId('doc')
  const ts = now()

  await c.env.DB.prepare(`
    INSERT INTO documents (id, entity_type, entity_id, doc_type, filename, extracted_data, ai_confidence, validation_status, validation_notes, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, entity_type, entity_id, doc_type, filename,
    JSON.stringify(demoData.extracted_fields), demoData.ai_confidence,
    demoData.overall_status,
    demoData.recommendation, ts
  ).run()

  await logAudit(c.env.DB, {
    userId: 'system', userName: 'System AI', userRole: 'system',
    action: demoData.overall_status === 'auto_verified' ? 'DOCUMENT_AUTO_VERIFIED' : 'DOCUMENT_FLAGGED_REVIEW',
    entityType: 'document', entityId: id,
    details: { doc_type, confidence: demoData.ai_confidence, status: demoData.overall_status },
    source: 'ai_generated', aiConfidence: demoData.ai_confidence
  })

  return c.json({ ...demoData, document_id: id })
})

app.patch('/:id/override', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const ts = now()
  await c.env.DB.prepare(`
    UPDATE documents SET validation_status = 'approved', validation_notes = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?
  `).bind(`Manual override: ${body.reason}`, body.user_id, ts, id).run()
  await logAudit(c.env.DB, {
    userId: body.user_id || 'u002', userName: body.user_name || 'Aisha Al-Balushi', userRole: 'compliance_officer',
    action: 'DOCUMENT_OVERRIDE', entityType: 'document', entityId: id,
    details: { action: 'Override AI Confidence', reason: body.reason },
    regulatoryReference: body.regulatory_reference
  })
  return c.json({ success: true })
})

function getDemoAnalysis(docType: string, filename?: string) {
  const map: Record<string, any> = {
    gsas_cert: {
      doc_type: 'gsas_cert',
      extracted_fields: {
        certificate_number: 'GSAS-2026-078',
        issuer: 'GORD (Gulf Organisation for Research & Development)',
        issue_date: '2026-02-15',
        expiry_date: '2028-12-31',
        overall_score: 89,
        rating: 'Gold',
        property: 'EcoVillage Muscat'
      },
      validation_results: [
        { field: 'Certificate Number', value: 'GSAS-2026-078', status: 'pass', message: 'Valid format ✓' },
        { field: 'Issuer', value: 'GORD', status: 'pass', message: 'Accredited issuer ✓' },
        { field: 'Valid Until', value: '31 Dec 2028', status: 'pass', message: '28 months remaining ✓' },
        { field: 'GSAS Score', value: '89 / 100', status: 'pass', message: 'Exceeds minimum (70). Premium tier qualifies for 0.75% discount ✓' },
        { field: 'Rating', value: 'Gold', status: 'pass', message: 'Gold rating accepted ✓' }
      ],
      overall_status: 'auto_verified',
      ai_confidence: 96,
      confidence_reason: 'High-quality PDF scan. All mandatory fields clearly extracted.',
      recommendation: '✅ Auto-Verified. GSAS score 89 qualifies for Premium Green Discount (0.75%). No manual review required.'
    },
    epc_report: {
      doc_type: 'epc_report',
      extracted_fields: {
        rating: 'A',
        expiry_date: '2027-05-01',
        property_ref: 'EVM-B1',
        energy_consumption: '85 kWh/m²/year',
        co2_rating: 'A',
        assessor: 'Green Build Oman'
      },
      validation_results: [
        { field: 'EPC Rating', value: 'A (Excellent)', status: 'pass', message: 'Exceeds minimum requirement (C) ✓' },
        { field: 'Expiry Date', value: 'May 2027', status: 'pass', message: '8+ months remaining ✓' },
        { field: 'Assessor', value: 'Green Build Oman', status: 'pass', message: 'OEESC accredited ✓' },
        { field: 'Image Quality', value: 'Slightly skewed', status: 'warning', message: '⚠ Confidence reduced to 88% due to image quality' }
      ],
      overall_status: 'manual_review',
      ai_confidence: 88,
      confidence_reason: 'Slight image skew reduced field extraction confidence below 90% auto-verify threshold.',
      recommendation: '⚠️ Manual Review Recommended. Confidence: 88%. Rating A confirmed; expiry 2027 acceptable. Quick visual check advised.'
    },
    eia_approval: {
      doc_type: 'eia_approval',
      extracted_fields: {
        reference: 'EIA/2026/442',
        issuer: 'Environment Authority – Oman',
        approval_date: '2026-03-10',
        valid_until: '2029-03-10',
        project: 'EcoVillage Muscat',
        units: 24,
        status: 'Approved'
      },
      validation_results: [
        { field: 'Reference Number', value: 'EIA/2026/442', status: 'pass', message: 'Valid EIA reference format ✓' },
        { field: 'Issuer Authority', value: 'Environment Authority', status: 'pass', message: 'Official Oman issuing body ✓' },
        { field: 'Validity', value: '2029-03-10', status: 'pass', message: '31 months remaining ✓' },
        { field: 'Units Coverage', value: '24 units (all covered)', status: 'pass', message: 'All project units included ✓' }
      ],
      overall_status: 'auto_verified',
      ai_confidence: 95,
      confidence_reason: 'Clear document. All required fields extracted with high confidence.',
      recommendation: '✅ Auto-Verified. EIA clearance confirmed for all 24 units. Issued by Environment Authority.'
    },
    invoice: {
      doc_type: 'invoice',
      extracted_fields: {
        material: 'Green Concrete – C30 Grade',
        total_amount: 'OMR 12,000',
        supplier: 'Oman Readymix LLC',
        invoice_date: '2026-08-28',
        invoice_number: 'INV-2026-08-4471'
      },
      validation_results: [
        { field: 'Material', value: 'Green Concrete – C30 Grade', status: 'pass', message: 'Approved green material ✓' },
        { field: 'Supplier', value: 'Oman Readymix LLC', status: 'pass', message: 'Pre-approved vendor ✓' },
        { field: 'Amount', value: 'OMR 12,000', status: 'pass', message: 'Within expected range ✓' },
        { field: 'Invoice Date', value: '2026-08-28', status: 'pass', message: 'Valid date ✓' }
      ],
      overall_status: 'auto_verified',
      ai_confidence: 94,
      confidence_reason: 'All OCR fields extracted clearly. Material and vendor match approved lists.',
      recommendation: '✅ Invoice Auto-Verified. Green material confirmed. Stage 1 completion payment authorised.'
    },
    civil_id: {
      doc_type: 'civil_id',
      extracted_fields: {
        name: 'Salim Hassan Al-Harthy',
        civil_id_number: '84521789',
        dob: '1989-03-15',
        nationality: 'Omani',
        expiry: '2029-03-14'
      },
      validation_results: [
        { field: 'Name', value: 'Salim Hassan Al-Harthy', status: 'pass', message: 'Matches profile ✓' },
        { field: 'Civil ID', value: '84521789', status: 'pass', message: 'Valid format ✓' },
        { field: 'Nationality', value: 'Omani', status: 'pass', message: 'Eligible for home financing ✓' },
        { field: 'Expiry', value: '2029-03-14', status: 'pass', message: '30+ months remaining ✓' }
      ],
      overall_status: 'auto_verified',
      ai_confidence: 98,
      confidence_reason: 'High resolution scan. MRZ line verified.',
      recommendation: '✅ Civil ID Auto-Verified. Identity confirmed.'
    }
  }
  return map[docType] || map.civil_id
}

export { app as documentsApi }
