import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'

type Bindings = { DB: D1Database; OPENAI_API_KEY: string }
const app = new Hono<{ Bindings: Bindings }>()

const OPENAI_KEY = 'REDACTED_OPENAI_KEY'

async function callOpenAI(prompt: string, systemPrompt: string, apiKey: string, model = 'gpt-4o-mini'): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })
  })
  const data = await response.json() as any
  if (!response.ok) throw new Error(data.error?.message || 'OpenAI error')
  return data.choices[0].message.content
}

// AI-powered regulatory rule generation
app.post('/rules/generate', async (c) => {
  const body = await c.req.json()
  const { text, product_id, user_id = 'u001', user_name = 'Fatima Al-Rashdi' } = body
  const apiKey = c.env.OPENAI_API_KEY || OPENAI_KEY

  const systemPrompt = `You are a banking regulatory compliance AI for Sohar International Bank in Oman. 
You extract regulatory rules from regulatory text and convert them to structured JSON rule definitions.
Return ONLY valid JSON matching this schema:
{
  "rules": [{
    "name": "string",
    "category": "creditworthiness|collateral|product|esg|compliance|stress_test|eligibility",
    "metric": "string (e.g. DBR, LTV, credit_score, gsas_score)",
    "operator": "<=|>=|=|in|between",
    "threshold_value": number or null,
    "threshold_condition": "string or null (for conditional rules)",
    "action_on_breach": "reject|flag|warning",
    "severity": "hard|soft",
    "description": "string",
    "regulatory_reference": "string",
    "ai_confidence": number (0-100)
  }],
  "related_regulations": [{"title": "string", "reference": "string", "relevance": "string"}],
  "analysis_summary": "string"
}`

  try {
    const response = await callOpenAI(text, systemPrompt, apiKey, 'gpt-4o')
    let parsed
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response)
    } catch {
      parsed = { rules: [], related_regulations: [], analysis_summary: response }
    }

    // Save generated rules to DB
    if (parsed.rules && product_id) {
      for (const rule of parsed.rules) {
        const id = generateId('r')
        await c.env.DB.prepare(`
          INSERT INTO rules (id, product_id, name, category, metric, operator, threshold_value, threshold_condition,
          action_on_breach, severity, regulatory_reference, source, ai_confidence, description, is_active, created_by, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(id, product_id, rule.name, rule.category, rule.metric, rule.operator,
          rule.threshold_value || null, rule.threshold_condition || null,
          rule.action_on_breach, rule.severity, rule.regulatory_reference, 'ai_generated',
          rule.ai_confidence, rule.description, 0, user_id, now()).run()
      }
    }

    await logAudit(c.env.DB, {
      userId: user_id, userName: user_name, userRole: 'product_manager',
      action: 'AI_RULE_GENERATED', entityType: 'rule', entityId: product_id,
      details: { prompt: text.substring(0, 200), rules_count: parsed.rules?.length || 0 },
      source: 'ai_generated', aiConfidence: parsed.rules?.[0]?.ai_confidence
    })

    return c.json(parsed)
  } catch (e: any) {
    // Fallback demo response if OpenAI fails
    return c.json(getDemoRuleResponse(text))
  }
})

// AI document validation
app.post('/documents/validate', async (c) => {
  const body = await c.req.json()
  const { doc_type, extracted_text, entity_id, entity_type = 'project', user_id = 'system' } = body
  const apiKey = c.env.OPENAI_API_KEY || OPENAI_KEY

  const systemPrompt = `You are an AI document validation system for Sohar International Bank's Green Home Loan program.
Validate the provided document against Oman banking and ESG regulatory standards.
Return ONLY valid JSON:
{
  "doc_type": "gsas_cert|epc_report|eia_approval|civil_id|salary_cert|invoice",
  "extracted_fields": {},
  "validation_results": [{"field": "string", "value": "string", "status": "pass|fail|warning", "message": "string"}],
  "overall_status": "auto_verified|manual_review|rejected",
  "ai_confidence": number (0-100),
  "confidence_reason": "string",
  "recommendation": "string"
}`

  const demoResponses = getDemoDocumentValidation(doc_type)
  
  try {
    const prompt = `Document type: ${doc_type}\nExtracted text: ${extracted_text || 'N/A (using demo mode)'}`
    const response = await callOpenAI(prompt, systemPrompt, apiKey, 'gpt-4o')
    let parsed
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response)
    } catch {
      parsed = demoResponses
    }
    return c.json(parsed)
  } catch {
    return c.json(demoResponses)
  }
})

// AI report generation
app.post('/reports/generate', async (c) => {
  const body = await c.req.json()
  const { prompt, data, report_type = 'compliance', user_id = 'u002' } = body
  const apiKey = c.env.OPENAI_API_KEY || OPENAI_KEY

  // Get real data from DB for context
  const { results: apps } = await c.env.DB.prepare(
    `SELECT a.*, c.name as customer_name, c.credit_score FROM applications a
     LEFT JOIN customers c ON a.customer_id = c.id
     WHERE a.product_id = 'p009' ORDER BY a.created_at DESC LIMIT 20`
  ).all()

  const systemPrompt = `You are a compliance reporting AI for Sohar International Bank.
Generate a professional compliance report in JSON format:
{
  "title": "string",
  "period": "string",
  "summary": {"total_applications": number, "approved": number, "rejected": number, "pending": number, "avg_gsas_score": number, "approval_rate": "string"},
  "sections": [{"heading": "string", "content": "string"}],
  "flagged_items": [{"application_ref": "string", "issue": "string", "recommendation": "string"}],
  "metrics": [{"label": "string", "value": "string", "status": "green|amber|red"}]
}`

  try {
    const dataContext = JSON.stringify({ applications: apps.slice(0, 5), prompt })
    const response = await callOpenAI(dataContext, systemPrompt, apiKey, 'gpt-4o')
    let parsed
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response)
    } catch {
      parsed = getDemoReport(apps)
    }
    return c.json(parsed)
  } catch {
    return c.json(getDemoReport(apps))
  }
})

// AI invoice validation  
app.post('/invoice/validate', async (c) => {
  const body = await c.req.json()
  const { filename, application_id } = body
  
  // Get approved materials list
  const app = await c.env.DB.prepare('SELECT p.approved_materials, p.approved_vendors FROM applications a JOIN products p ON a.product_id = p.id WHERE a.id = ?').bind(application_id).first() as any
  const approvedMaterials = app ? JSON.parse(app.approved_materials || '[]') : ['Green Concrete', 'Thermal Insulation', 'Solar Panels']
  const approvedVendors = app ? JSON.parse(app.approved_vendors || '[]') : ['Oman Readymix LLC', 'Gulf Insulation Group']

  // Return demo validation for the demo invoice
  return c.json({
    ocr_extracted: {
      material: 'Green Concrete – C30 Grade',
      total_amount: 'OMR 12,000',
      supplier: 'Oman Readymix LLC',
      invoice_date: '2026-08-28',
      invoice_number: 'INV-2026-08-4471'
    },
    validation_results: [
      { check: 'Material Classification', result: 'Green Concrete – C30 Grade', status: 'pass', icon: '✅', detail: 'Approved green material' },
      { check: 'Supplier Verification', result: 'Oman Readymix LLC', status: 'pass', icon: '✅', detail: 'Pre-approved vendor' },
      { check: 'Amount Validation', result: 'OMR 12,000', status: 'pass', icon: '✅', detail: 'Within expected range' },
      { check: 'Invoice Date', result: '2026-08-28', status: 'pass', icon: '✅', detail: 'Valid invoice date' }
    ],
    overall_status: 'auto_verified',
    ai_confidence: 94,
    recommendation: 'Stage 1 completion verified. Green material confirmed. Payment authorised.'
  })
})

// GSAS schema generation demo
app.post('/schema/generate', async (c) => {
  const body = await c.req.json()
  return c.json({
    schema_type: 'gsas_certificate_validation',
    fields: [
      { name: 'Certificate Number', type: 'String', validation: '^GSAS-\\d{4}-\\d{3}$', error_message: 'Invalid certificate number format' },
      { name: 'Issuer', type: 'String', validation: 'Must be "GORD" or accredited body', error_message: 'Issuer not accredited' },
      { name: 'Issue Date', type: 'Date', validation: 'Must be ≤ today', error_message: 'Certificate not yet issued' },
      { name: 'Expiry Date', type: 'Date', validation: 'Must be ≥ today + 90 days', error_message: 'Certificate expires within 90 days' },
      { name: 'Overall Score', type: 'Integer', validation: '0-100, min 70 for eligibility', error_message: 'Score below minimum threshold (70)' },
      { name: 'Rating', type: 'String', validation: 'Must be Silver/Gold/Platinum (Bronze rejected)', error_message: 'Rating does not meet minimum' }
    ],
    ai_confidence: 96,
    regulatory_reference: 'OS GSO 3000:2025, Section 4.2'
  })
})

function getDemoRuleResponse(text: string) {
  const isDBR = text.toLowerCase().includes('dbr') || text.toLowerCase().includes('debt burden')
  const isGSAS = text.toLowerCase().includes('gsas') || text.toLowerCase().includes('green')
  
  if (isDBR) {
    return {
      rules: [
        {
          name: 'Green DBR Buffer Rule',
          category: 'creditworthiness',
          metric: 'DBR',
          operator: '<=',
          threshold_value: 55,
          threshold_condition: 'loan_amount > 100000',
          action_on_breach: 'reject',
          severity: 'hard',
          description: 'For green financing with loan >OMR 100,000: DBR ≤ 55%. For ≤OMR 100,000: DBR ≤ 60%.',
          regulatory_reference: 'CBO Circular 2026-12, Section 3.2',
          ai_confidence: 94
        }
      ],
      related_regulations: [
        { title: 'GSAS Certification Required', reference: 'OS GSO 3000:2025, Section 4.2', relevance: 'GSAS certificate required for green products' },
        { title: 'EPC Rating Minimum', reference: 'OEESC, Section 5.1', relevance: 'EPC rating minimum C for energy efficiency incentives' },
        { title: 'EIA Clearance', reference: 'Environment Authority Decision 107/2023', relevance: 'EIA clearance required for >20 residential units' }
      ],
      analysis_summary: 'Extracted DBR threshold of 55% for green products (60% minus 5% buffer). Identified 3 related ESG regulations.'
    }
  }
  return {
    rules: [
      {
        name: 'GSAS Score Minimum Threshold',
        category: 'esg',
        metric: 'gsas_score',
        operator: '>=',
        threshold_value: 70,
        action_on_breach: 'reject',
        severity: 'hard',
        description: 'Property must achieve minimum GSAS score of 70 for Green Home Loan eligibility.',
        regulatory_reference: 'OS GSO 3000:2025, Section 4.2',
        ai_confidence: 96
      }
    ],
    related_regulations: [],
    analysis_summary: 'Extracted GSAS score threshold and certification requirements.'
  }
}

function getDemoDocumentValidation(docType: string) {
  const responses: Record<string, any> = {
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
        { field: 'Certificate Number', value: 'GSAS-2026-078', status: 'pass', message: 'Valid format' },
        { field: 'Issuer', value: 'GORD', status: 'pass', message: 'Accredited issuer' },
        { field: 'Expiry Date', value: '2028-12-31', status: 'pass', message: 'Valid for 2+ years' },
        { field: 'Overall Score', value: '89', status: 'pass', message: 'Exceeds minimum (70). Premium tier (≥85): 0.75% discount applies' },
        { field: 'Rating', value: 'Gold', status: 'pass', message: 'Gold rating meets requirements' }
      ],
      overall_status: 'auto_verified',
      ai_confidence: 96,
      confidence_reason: 'High-quality document scan, all required fields clearly visible',
      recommendation: 'Auto-Verified. GSAS score 89 qualifies for premium Green discount (0.75%).'
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
        { field: 'EPC Rating', value: 'A', status: 'pass', message: 'Exceeds minimum (C required)' },
        { field: 'Expiry Date', value: '2027-05-01', status: 'pass', message: 'Valid until May 2027' },
        { field: 'Assessor', value: 'Green Build Oman', status: 'pass', message: 'OEESC accredited assessor' },
        { field: 'Document Quality', value: '88%', status: 'warning', message: 'Slight image skew detected' }
      ],
      overall_status: 'manual_review',
      ai_confidence: 88,
      confidence_reason: 'Slight image skew reduced extraction confidence below 90% threshold',
      recommendation: 'Manual Review Recommended. Rating A confirmed; expiry 2027 acceptable. Quick visual verification advised.'
    },
    eia_approval: {
      doc_type: 'eia_approval',
      extracted_fields: {
        reference: 'EIA/2026/442',
        issuer: 'Environment Authority',
        approval_date: '2026-03-10',
        valid_until: '2029-03-10',
        project: 'EcoVillage Muscat',
        units: 24,
        status: 'Approved'
      },
      validation_results: [
        { field: 'Reference Number', value: 'EIA/2026/442', status: 'pass', message: 'Valid EIA reference format' },
        { field: 'Issuer', value: 'Environment Authority', status: 'pass', message: 'Official issuing body' },
        { field: 'Validity', value: '2029-03-10', status: 'pass', message: 'Valid for 3+ years' },
        { field: 'Units Coverage', value: '24 units', status: 'pass', message: 'Covers all 24 project units' }
      ],
      overall_status: 'auto_verified',
      ai_confidence: 95,
      confidence_reason: 'Clear document, all required fields extracted with high confidence',
      recommendation: 'Auto-Verified. EIA clearance confirmed for all 24 units.'
    }
  }
  return responses[docType] || responses.gsas_cert
}

function getDemoReport(apps: any[]) {
  return {
    title: 'Green Home Loan – ESG Compliance Report',
    period: 'August 2026',
    summary: {
      total_applications: apps.length || 3,
      approved: 1,
      rejected: 0,
      pending: 2,
      avg_gsas_score: 89,
      approval_rate: '33%'
    },
    sections: [
      { heading: 'Executive Summary', content: 'Green Home Loan program launched 31 August 2026. Current pipeline shows strong ESG compliance with average GSAS score of 89 across active applications.' },
      { heading: 'ESG Verification Summary', content: 'All submitted applications include valid GSAS certificates. One EPC document required manual override due to image quality (88% AI confidence). All EIA clearances auto-verified.' },
      { heading: 'Credit Risk Analysis', content: 'Average DBR across approved applications: 48% (CBO limit: 55% for green products). All applications passed CBO stress test at simulated 9% rate.' }
    ],
    flagged_items: [
      { application_ref: 'GHL-250001', issue: 'EPC confidence below threshold (88%)', recommendation: 'Manual verification completed by Aisha Al-Balushi. Approved.' }
    ],
    metrics: [
      { label: 'Average GSAS Score', value: '89', status: 'green' },
      { label: 'Average DBR', value: '48%', status: 'green' },
      { label: 'Average LTV', value: '80%', status: 'green' },
      { label: 'ESG Auto-Verification Rate', value: '67%', status: 'amber' },
      { label: 'CBO Stress Test Pass Rate', value: '100%', status: 'green' }
    ]
  }
}

export { app as aiApi }
