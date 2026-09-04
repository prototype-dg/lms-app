import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'
const app = new Hono<{ Bindings: NodeBindings }>()


// ── Multi-turn AI Product Studio ─────────────────────────────────────────
// Handles the full product creation conversation: understand requirements,
// suggest configurations, generate rules, generate GSAS schema, confirm.
app.post('/products/chat', async (c) => {
  const body = await c.req.json()
  const { thread_id, message, context = {}, user_id = 'u001', user_name = 'Fatima Al-Rashdi' } = body as any
  const apiKey = c.env.OPENAI_API_KEY

  // Load or create thread
  let thread: any = null
  let messages: any[] = []
  let threadId = thread_id

  if (threadId) {
    thread = await c.env.DB.prepare('SELECT * FROM ai_threads WHERE id = ?').bind(threadId).first() as any
    if (thread) messages = JSON.parse(thread.messages || '[]')
  }

  if (!threadId || !thread) {
    threadId = generateId('thr')
    messages = []
  }

  // Load regulatory knowledge base for system context
  const { results: kb } = await c.env.DB.prepare(
    'SELECT title, content, source FROM knowledge_base ORDER BY category'
  ).all() as any

  const kbContext = kb.map((k: any) => `[${k.source}] ${k.title}: ${k.content}`).join('\n\n')

  // Load existing products for clone reference
  const { results: existingProducts } = await c.env.DB.prepare(
    "SELECT id, name, code, base_rate, max_ltv, max_dbr, max_term FROM products WHERE status = 'active' ORDER BY name"
  ).all() as any

  const systemPrompt = `You are an AI Product Specialist at Sohar International Bank.
You help Product Managers create new financial products through a structured 6-stage process driven by free conversation.
The system is configured for jurisdiction: Oman, currency: OMR, regulator: Central Bank of Oman (CBO).

REGULATORY KNOWLEDGE BASE:
${kbContext}

EXISTING PRODUCTS (for cloning):
${existingProducts.map((p: any) => `- ${p.name} (${p.id}): rate ${p.base_rate}%, LTV ${p.max_ltv}%, DBR ${p.max_dbr}%, term ${p.max_term}yr`).join('\n')}

THE 6 STAGES:
Stage 1 – Product Model: identify archetype, name, clone source, core attributes
Stage 2 – Core Configuration: rate, term, LTV, DBR, amounts
Stage 3 – Rule Builder: eligibility rules, pricing rules, ESG thresholds (cite regulations)
Stage 4 – Workflow: approval nodes, roles, SLA
Stage 5 – Compliance: regulatory tags, risk weights, gap analysis
Stage 6 – Simulation & Approval: financial projections, approval matrix, publish

PROTOCOL — CRITICAL RULES:
- Turn 1: Classify intent (NEW_PRODUCT | CLONE_PRODUCT | REGULATORY_QUERY). If product type is identifiable, set current_stage=1 and emit show_roadmap=true.
- Advance ONE stage per user confirmation. Never skip stages.
- Ask ONE focused question per turn within a stage. 
- When a stage is complete emit the relevant ui_events so the main UI updates live.
- When ready_to_confirm set current_stage=6 and include full product_draft + rules_draft + schema_draft.

UI EVENTS — emit these when the AI configures something so the main panel updates live:
- { type: "set_tab", tab: "general"|"pricing"|"eligibility"|"workflow"|"ai_config" }
- { type: "set_field", field: "base_rate"|"max_ltv"|"max_dbr"|"max_term"|"min_amount"|"max_amount"|"name"|"description", value: any }
- { type: "add_rule", rule: { name, category, metric, operator, threshold_value, severity, regulatory_reference } }
- { type: "set_workflow", nodes: [...] }
- { type: "highlight_field", field: string }  (flashes a field yellow for 2s)

RESPONSE FORMAT — always output ONLY this JSON, no markdown:
{
  "message": "conversational reply (may use <br> and <strong> for formatting)",
  "current_stage": 1-6,
  "show_roadmap": true|false,
  "action": "none|ready_to_confirm",
  "ui_events": [],
  "product_draft": null or { name, description, category, base_rate, max_ltv, max_dbr, green_dbr, min_term, max_term, min_amount, max_amount, gsas_min_score, gsas_premium_score, green_discount_premium, green_discount_standard, esg_required_docs, approved_materials, approved_vendors, clone_from_id },
  "rules_draft": null or [{ name, category, metric, operator, threshold_value, threshold_condition, action_on_breach, severity, regulatory_reference, ai_confidence, description }],
  "schema_draft": null or { schema_type, fields: [{name, type, validation, error_message}], regulatory_reference, ai_confidence }
}
Only output JSON. No markdown, no code blocks. No explanation outside the JSON.`

  // Append user message
  const userMsg = { role: 'user', content: message, timestamp: now() }
  messages.push(userMsg)

  let aiReply: any = { message: "I'll help you configure this product.", current_stage: 1, show_roadmap: false, action: 'none', ui_events: [], product_draft: null, rules_draft: null, schema_draft: null }

  if (apiKey) {
    try {
      const openAiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role, content: m.content })),
      ]
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', messages: openAiMessages, temperature: 0.3, max_tokens: 1500 }),
      })
      const data = await resp.json() as any
      if (resp.ok) {
        const text = data.choices[0].message.content
        const match = text.match(/\{[\s\S]*\}/)
        if (match) aiReply = JSON.parse(match[0])
        else aiReply.message = text
      }
    } catch (e: any) {
      aiReply = getFallbackChatResponse(message, messages.length)
    }
  } else {
    aiReply = getFallbackChatResponse(message, messages.length)
  }

  // Append assistant message
  const assistantMsg = { role: 'assistant', content: aiReply.message, timestamp: now(), metadata: { action: aiReply.action } }
  messages.push(assistantMsg)

  // Save/update thread — MERGE result so earlier drafts are never overwritten.
  // If this turn's AI reply doesn't include a draft (e.g. step 3+ follow-up turns),
  // we keep whatever was already saved in the thread's result field.
  const ts = now()

  // Load existing result so we can merge into it
  let savedResult: any = {}
  if (thread?.result) {
    try { savedResult = JSON.parse(thread.result) } catch { savedResult = {} }
  }
  // Only overwrite a field when this turn explicitly provides a new value
  if (aiReply.product_draft) savedResult.product_draft = aiReply.product_draft
  if (aiReply.rules_draft)   savedResult.rules_draft   = aiReply.rules_draft
  if (aiReply.schema_draft)  savedResult.schema_draft  = aiReply.schema_draft

  await c.env.DB.prepare(`
    INSERT INTO ai_threads (id, user_id, purpose, messages, context, status, result, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET messages=excluded.messages, result=excluded.result, updated_at=excluded.updated_at
  `).bind(threadId, user_id, context.purpose || 'product_creation',
    JSON.stringify(messages), JSON.stringify(context),
    'active', JSON.stringify(savedResult), ts, ts
  ).run()

  return c.json({
    thread_id: threadId,
    reply: aiReply.message,
    current_stage: aiReply.current_stage || 1,
    show_roadmap: aiReply.show_roadmap || false,
    action: aiReply.action || 'none',
    ui_events: aiReply.ui_events || [],
    product_draft: aiReply.product_draft || null,
    rules_draft: aiReply.rules_draft || null,
    schema_draft: aiReply.schema_draft || null,
  })
})

// ── Confirm product draft — saves to DB ──────────────────────────────────
app.post('/products/confirm', async (c) => {
  const body = await c.req.json() as any
  let { thread_id, product_draft, rules_draft, schema_draft, user_id = 'u001', user_name = 'Fatima Al-Rashdi' } = body

  // If drafts not passed in body, load from saved thread result
  if (thread_id && !product_draft) {
    const thread = await c.env.DB.prepare('SELECT result FROM ai_threads WHERE id = ?').bind(thread_id).first() as any
    if (thread?.result) {
      try {
        const saved = JSON.parse(thread.result)
        if (saved.product_draft) product_draft = saved.product_draft
        if (saved.rules_draft && !rules_draft) rules_draft = saved.rules_draft
        if (saved.schema_draft && !schema_draft) schema_draft = saved.schema_draft
      } catch {}
    }
  }

  if (!product_draft) return c.json({ success: false, error: 'No product draft found. Please complete the AI conversation first.' }, 400)

  const id = generateId('p')
  const ts = now()

  // Build configuration with GSAS schema if provided
  const config: any = {}
  if (schema_draft) config.gsas_schema = schema_draft
  const cloneSource = product_draft.clone_from_id
    ? await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(product_draft.clone_from_id).first() as any
    : null

  const name = product_draft.name || 'Green Home Loan – ESG'
  const code = `GHL-${Date.now().toString(36).toUpperCase()}`

  await c.env.DB.prepare(`
    INSERT INTO products (id, name, code, description, category, status, base_rate, max_ltv, max_dbr,
    green_dbr, min_term, max_term, min_amount, max_amount,
    gsas_min_score, gsas_premium_score, green_discount_premium, green_discount_standard,
    ai_confidence_threshold, allow_byop, allow_partner_inventory,
    required_docs, esg_required_docs, approved_materials, approved_vendors,
    configuration, portal_visible, developer_portal_visible, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, name, code,
    product_draft.description || (cloneSource?.description) || '',
    product_draft.category || 'home_loan', 'draft',
    product_draft.base_rate || (cloneSource?.base_rate) || 5.5,
    product_draft.max_ltv || (cloneSource?.max_ltv) || 90,
    product_draft.max_dbr || (cloneSource?.max_dbr) || 60,
    product_draft.green_dbr || 55,
    product_draft.min_term || (cloneSource?.min_term) || 5,
    product_draft.max_term || (cloneSource?.max_term) || 25,
    product_draft.min_amount || (cloneSource?.min_amount) || 10000,
    product_draft.max_amount || (cloneSource?.max_amount) || 500000,
    product_draft.gsas_min_score || 70,
    product_draft.gsas_premium_score || 85,
    product_draft.green_discount_premium || 0.75,
    product_draft.green_discount_standard || 0.5,
    90, 1, 1,
    JSON.stringify(product_draft.required_docs || (cloneSource ? JSON.parse(cloneSource.required_docs || '[]') : ['salary_cert', 'civil_id', 'property_deed', 'valuation_report', 'utility_bill'])),
    JSON.stringify(product_draft.esg_required_docs || ['gsas_cert', 'epc_report', 'eia_approval']),
    JSON.stringify(product_draft.approved_materials || ['Green Concrete', 'Thermal Insulation', 'Solar Panels', 'Energy-Efficient Appliances', 'Low-E Glass', 'Recycled Steel']),
    JSON.stringify(product_draft.approved_vendors || ['Oman Readymix LLC', 'Gulf Insulation Group', 'SunTech Oman', 'Green Build Oman', 'EcoMaterials Oman']),
    JSON.stringify(config), 0, 0, user_id, ts, ts
  ).run()

  // Save rules
  const ruleIds: string[] = []
  if (rules_draft && Array.isArray(rules_draft)) {
    for (const rule of rules_draft) {
      const ruleId = generateId('r')
      await c.env.DB.prepare(`
        INSERT INTO rules (id, product_id, name, category, metric, operator, threshold_value,
        threshold_condition, action_on_breach, severity, regulatory_reference, source,
        ai_confidence, description, is_active, created_by, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(ruleId, id, rule.name, rule.category, rule.metric, rule.operator,
        rule.threshold_value || null, rule.threshold_condition || null,
        rule.action_on_breach || 'reject', rule.severity || 'hard',
        rule.regulatory_reference || null, 'ai_generated', rule.ai_confidence || null,
        rule.description || null, 0, user_id, ts
      ).run()
      ruleIds.push(ruleId)
    }
  }

  // Auto-publish: generate portal marketing content and set portal_visible=1
  const apiKey = c.env.OPENAI_API_KEY
  let portalHeroTitle = name
  let portalHighlights: string[] = []
  let portalBadge = ''
  const isGreen = (product_draft.esg_required_docs || []).length > 0

  if (apiKey) {
    try {
      const prompt = `Generate marketing content for a bank loan product. Return JSON only, no markdown:
{"hero_title":"short compelling tagline (max 6 words)","hero_subtitle":"one sentence benefit statement","card_badge":"2-3 word category badge","highlights":["benefit 1","benefit 2","benefit 3","benefit 4"]}
Product: ${name}. Description: ${product_draft.description || ''}. Base rate: ${product_draft.base_rate || 5.5}%.${isGreen ? ` Green discount: up to ${product_draft.green_discount_premium || 0.75}% for GSAS score ≥${product_draft.gsas_premium_score || 85}. ESG/green product.` : ''}`
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: 300 }),
      })
      const mktData = await resp.json() as any
      if (resp.ok) {
        const text = mktData.choices[0].message.content
        const match = text.match(/\{[\s\S]*\}/)
        if (match) {
          const parsed = JSON.parse(match[0])
          portalHeroTitle = parsed.hero_title || portalHeroTitle
          portalHighlights = parsed.highlights || []
          portalBadge = parsed.card_badge || ''
        }
      }
    } catch (_) { /* use defaults */ }
  }

  if (!portalHighlights.length) {
    if (isGreen) {
      portalHighlights = [`Up to ${product_draft.green_discount_premium || 0.75}% rate discount`, 'GSAS-certified properties only', 'Supports Oman Vision 2040', 'Maker-checker ESG approval']
      portalBadge = 'ESG Premium'
    } else {
      portalHighlights = [`From ${product_draft.base_rate || 5.5}% per annum`, `Terms up to ${product_draft.max_term || 25} years`, `Up to OMR ${Math.round((product_draft.max_amount || 500000) / 1000)}K financing`]
    }
  }

  await c.env.DB.prepare(
    `UPDATE products SET status='active', portal_visible=1, developer_portal_visible=?,
     portal_hero_title=?, portal_highlights=?, portal_card_badge=?, published_at=?, updated_at=? WHERE id=?`
  ).bind(isGreen ? 1 : 0, portalHeroTitle, JSON.stringify(portalHighlights), portalBadge, ts, ts, id).run()

  // Mark thread as completed
  if (thread_id) {
    await c.env.DB.prepare(
      "UPDATE ai_threads SET status='completed', product_id=?, result=?, updated_at=? WHERE id=?"
    ).bind(id, JSON.stringify({ product_id: id, rule_ids: ruleIds }), ts, thread_id).run()
  }

  await logAudit(c.env.DB, {
    userId: user_id, userName: user_name, userRole: 'product_manager',
    action: 'PRODUCT_CREATED_BY_AI', entityType: 'product', entityId: id,
    details: { name, rules_created: ruleIds.length, cloned_from: product_draft.clone_from_id || null, thread_id, portal_visible: true },
    source: 'ai_generated',
  })

  return c.json({ success: true, product_id: id, product_name: name, rule_ids: ruleIds, portal_hero_title: portalHeroTitle, portal_visible: true })
})

// ── AI-powered regulatory rule generation ───────────────────────────────
app.post('/rules/generate', async (c) => {
  const body = await c.req.json()
  const { text, product_id, user_id = 'u001', user_name = 'Fatima Al-Rashdi' } = body
  const apiKey = c.env.OPENAI_API_KEY

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
  const apiKey = c.env.OPENAI_API_KEY

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
  const apiKey = c.env.OPENAI_API_KEY

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

function getFallbackChatResponse(message: string, msgCount: number): any {
  const lower = message.toLowerCase()
  const isGreen = lower.includes('green') || lower.includes('gsas') || lower.includes('esg') || lower.includes('sustainable') || lower.includes('eco') || lower.includes('energy')
  const isAuto  = lower.includes('auto') || lower.includes('car') || lower.includes('vehicle')
  const isPersonal = lower.includes('personal') || lower.includes('unsecured') || lower.includes('consumer')
  const isSme  = lower.includes('sme') || lower.includes('business') || lower.includes('working capital')
  const isYes  = lower.includes('yes') || lower.includes('ok') || lower.includes('proceed') || lower.includes('confirm') || lower.includes('clone') || lower.includes('standard') || lower.includes('agree') || lower.includes('sounds good') || lower.includes('go ahead') || lower.includes('correct')

  // ── TURN 1: Intent classification → show roadmap ─────────────────────────
  if (msgCount <= 2) {
    if (isGreen) return {
      message: "Understood. I've classified this as a <strong>Green Home Loan</strong> — a mortgage product with ESG eligibility criteria.<br><br>" +
        "Our system is configured for <strong>Oman</strong> · regulator: <strong>CBO</strong> · currency: <strong>OMR</strong> · default max LTV: <strong>85%</strong>.<br><br>" +
        "I've mapped out the 6 configuration stages below. We'll work through them one at a time.<br><br>" +
        "<strong>Stage 1 — Product Model:</strong> Would you like to clone from your existing <em>Standard Home Loan</em> (5.5% base rate, 90% LTV) as a starting point, or configure from scratch?",
      current_stage: 1, show_roadmap: true, action: 'none', ui_events: [], product_draft: null, rules_draft: null, schema_draft: null,
    }
    if (isAuto) return {
      message: "Understood — <strong>Auto Finance</strong> product. Our system is configured for <strong>Oman · CBO · OMR</strong>.<br><br>I've mapped the 6 configuration stages below.<br><br><strong>Stage 1 — Product Model:</strong> Should we clone from <em>Auto Finance – Personal</em>, or start fresh? And will this be a conventional or Islamic (Murabaha) structure?",
      current_stage: 1, show_roadmap: true, action: 'none', ui_events: [], product_draft: null, rules_draft: null, schema_draft: null,
    }
    if (isPersonal) return {
      message: "Understood — <strong>Personal Loan</strong> product. Our system is configured for <strong>Oman · CBO · OMR</strong>.<br><br>I've mapped the 6 configuration stages below.<br><br><strong>Stage 1 — Product Model:</strong> Should we clone from the existing <em>Personal Loan</em> product? Any target customer segment (salaried, self-employed)?",
      current_stage: 1, show_roadmap: true, action: 'none', ui_events: [], product_draft: null, rules_draft: null, schema_draft: null,
    }
    if (isSme) return {
      message: "Understood — <strong>SME Finance</strong> product. Our system is configured for <strong>Oman · CBO · OMR</strong>.<br><br>I've mapped the 6 configuration stages below.<br><br><strong>Stage 1 — Product Model:</strong> Should we clone from <em>SME Working Capital</em>? Any sector focus or collateral type to note?",
      current_stage: 1, show_roadmap: true, action: 'none', ui_events: [], product_draft: null, rules_draft: null, schema_draft: null,
    }
    return {
      message: "I can help you create a new regulated banking product. Our system is configured for <strong>Oman · CBO · OMR</strong>.<br><br>What type of product would you like to create?<br><br>• <strong>Home Loan</strong> (including Green / ESG variants)<br>• <strong>Auto Finance</strong><br>• <strong>Personal Loan</strong><br>• <strong>SME Finance</strong><br>• <strong>Commercial</strong><br>• <strong>Education Finance</strong>",
      current_stage: 0, show_roadmap: false, action: 'none', ui_events: [], product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── TURN 2 (msgCount 3–4): Stage 1 complete → move to Stage 2 ────────────
  if (msgCount <= 4) {
    return {
      message: "✅ <strong>Stage 1 complete.</strong> I've cloned <em>Standard Home Loan</em> as the base and added two ESG attributes: <code>property_energy_rating</code> (A+ → C) and <code>property_green_cert_type</code> (EPC / LEED / BREEAM).<br><br>" +
        "<strong>Stage 2 — Core Configuration:</strong> The cloned defaults are: base rate <strong>5.5%</strong>, max LTV <strong>90%</strong>, max DBR <strong>60%</strong>, term up to <strong>25 years</strong>.<br><br>" +
        "For a green product, CBO Circular 2026-12 recommends a <strong>5% DBR buffer</strong> (bringing green DBR to 55%). Should I apply that, or keep 60%?",
      current_stage: 2, show_roadmap: false, action: 'none',
      ui_events: [
        { type: 'set_tab', tab: 'general' },
        { type: 'set_field', field: 'name', value: 'Green Home Loan – ESG' },
        { type: 'set_field', field: 'description', value: 'Preferential home financing for GSAS-certified green properties. Earn up to 0.75% rate discount based on your property\'s sustainability score.' },
        { type: 'highlight_field', field: 'name' },
      ],
      product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── TURN 3 (msgCount 5–6): Stage 2 complete → move to Stage 3 ────────────
  if (msgCount <= 6) {
    return {
      message: "✅ <strong>Stage 2 complete.</strong> Core parameters locked in: rate <strong>5.5%</strong> · LTV <strong>90%</strong> · DBR <strong>55%</strong> (green buffer applied) · Term <strong>5–25 years</strong> · Amount <strong>OMR 10,000–500,000</strong>.<br><br>" +
        "<strong>Stage 3 — Rule Builder:</strong> I'll now generate the eligibility and pricing rules. Based on OS GSO 3000:2025, what should the minimum GSAS sustainability score be for eligibility? The regulation suggests <strong>70</strong> as the floor. And for the premium green discount (0.75%), what score threshold — <strong>85</strong>?",
      current_stage: 3, show_roadmap: false, action: 'none',
      ui_events: [
        { type: 'set_tab', tab: 'pricing' },
        { type: 'set_field', field: 'base_rate', value: 5.5 },
        { type: 'set_field', field: 'max_ltv', value: 90 },
        { type: 'set_field', field: 'max_dbr', value: 55 },
        { type: 'set_field', field: 'max_term', value: 25 },
        { type: 'highlight_field', field: 'base_rate' },
      ],
      product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── TURN 4 (msgCount 7–8): Stage 3 complete → move to Stage 4 ────────────
  if (msgCount <= 8) {
    const rules = [
      { name: 'Green DBR Buffer', category: 'creditworthiness', metric: 'DBR', operator: '<=', threshold_value: 55, threshold_condition: 'loan_amount > 100000', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular 2026-12, §3.2', ai_confidence: 94, description: 'DBR capped at 55% for green loans >OMR 100,000.' },
      { name: 'GSAS Score – Minimum Eligibility', category: 'esg', metric: 'gsas_score', operator: '>=', threshold_value: 70, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'OS GSO 3000:2025, §4.2', ai_confidence: 97, description: 'Minimum GSAS score 70 for eligibility.' },
      { name: 'LTV Cap – Green Product', category: 'collateral', metric: 'LTV', operator: '<=', threshold_value: 90, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular BM/REG/2019/74', ai_confidence: 95, description: 'Maximum LTV 90% for residential green financing.' },
      { name: 'ESG Document Set Complete', category: 'esg', metric: 'esg_docs_complete', operator: '=', threshold_value: 1, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular 2026-12, §5.1', ai_confidence: 92, description: 'GSAS Cert + EPC Report + EIA Clearance all required.' },
    ]
    return {
      message: "✅ <strong>Stage 3 complete.</strong> 4 regulatory rules generated and added to the Eligibility tab:<br><br>" +
        "1. <strong>Green DBR Buffer</strong> ≤ 55% · CBO Circular 2026-12 §3.2 · confidence 94%<br>" +
        "2. <strong>GSAS Score ≥ 70</strong> (eligibility) · OS GSO 3000:2025 §4.2 · confidence 97%<br>" +
        "3. <strong>LTV ≤ 90%</strong> · CBO BM/REG/2019/74 · confidence 95%<br>" +
        "4. <strong>ESG Document Set Complete</strong> · CBO Circular 2026-12 §5.1 · confidence 92%<br><br>" +
        "<strong>Stage 4 — Workflow:</strong> For a green home loan I recommend this approval pipeline: <em>KYC/AML → Green Certificate Validation → Underwriting → Compliance Review → Final Approval</em>. Should I apply this template?",
      current_stage: 4, show_roadmap: false, action: 'none',
      ui_events: [
        { type: 'set_tab', tab: 'eligibility' },
        ...rules.map(r => ({ type: 'add_rule', rule: r })),
      ],
      product_draft: null, rules_draft: rules, schema_draft: null,
    }
  }

  // ── TURN 5 (msgCount 9–10): Stage 4 complete → move to Stage 5 ───────────
  if (msgCount <= 10) {
    const nodes = [
      { id: 'n1', type: 'start', label: 'Application Submitted', role: null },
      { id: 'n2', type: 'task', label: 'KYC / AML Check', role: 'compliance_officer', sla_hours: 24, auto: true },
      { id: 'n3', type: 'task', label: 'Green Certificate Validation', role: 'compliance_officer', sla_hours: 48, auto: true },
      { id: 'n4', type: 'approval', label: 'Underwriting', role: 'risk_officer', sla_hours: 48 },
      { id: 'n5', type: 'approval', label: 'Compliance Review', role: 'compliance_officer', sla_hours: 24 },
      { id: 'n6', type: 'approval', label: 'Final Approval', role: 'product_manager', sla_hours: 24 },
      { id: 'n7', type: 'end', label: 'Decision', role: null },
    ]
    return {
      message: "✅ <strong>Stage 4 complete.</strong> Workflow applied to the product — 5 approval nodes, 3 roles, AI auto-processing for KYC and Green Certificate Validation.<br><br>" +
        "<strong>Stage 5 — Compliance:</strong> I'll now map the regulatory tags. Based on CBO Circular 2026-12 and Oman Vision 2040, I recommend attaching: <strong>#CLIMATE_RISK</strong>, <strong>#ESG_ELIGIBILITY</strong>, <strong>#GREEN_FINANCING</strong>. Risk weight: <strong>75%</strong>, provisioning rate: <strong>1.5%</strong>. Shall I apply these?",
      current_stage: 5, show_roadmap: false, action: 'none',
      ui_events: [
        { type: 'set_tab', tab: 'workflow' },
        { type: 'set_workflow', nodes },
      ],
      product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── TURN 6 (msgCount 11+): Stage 5+6 complete → ready to confirm ──────────
  const productDraft = {
    name: 'Green Home Loan – ESG',
    description: 'Preferential home financing for GSAS-certified green properties. Earn up to 0.75% rate discount based on your sustainability score. Supports Oman Vision 2040.',
    category: 'home_loan', base_rate: 5.5, max_ltv: 90, max_dbr: 60, green_dbr: 55,
    min_term: 5, max_term: 25, min_amount: 10000, max_amount: 500000,
    gsas_min_score: 70, gsas_premium_score: 85, green_discount_premium: 0.75, green_discount_standard: 0.5,
    esg_required_docs: ['gsas_cert', 'epc_report', 'eia_approval'],
    approved_materials: ['Green Concrete', 'Thermal Insulation', 'Solar Panels', 'Energy-Efficient Appliances', 'Low-E Glass', 'Recycled Steel'],
    approved_vendors: ['Oman Readymix LLC', 'Gulf Insulation Group', 'SunTech Oman', 'Green Build Oman', 'EcoMaterials Oman'],
    clone_from_id: 'p001',
  }
  const rulesDraft = [
    { name: 'Green DBR Buffer', category: 'creditworthiness', metric: 'DBR', operator: '<=', threshold_value: 55, threshold_condition: 'loan_amount > 100000', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular 2026-12, §3.2', ai_confidence: 94, description: 'DBR ≤ 55% for green loans >OMR 100,000.' },
    { name: 'GSAS Score – Minimum Eligibility', category: 'esg', metric: 'gsas_score', operator: '>=', threshold_value: 70, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'OS GSO 3000:2025, §4.2', ai_confidence: 97, description: 'Minimum GSAS score 70 for eligibility.' },
    { name: 'LTV Cap – Green Product', category: 'collateral', metric: 'LTV', operator: '<=', threshold_value: 90, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular BM/REG/2019/74', ai_confidence: 95, description: 'Maximum LTV 90%.' },
    { name: 'ESG Document Set Complete', category: 'esg', metric: 'esg_docs_complete', operator: '=', threshold_value: 1, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular 2026-12, §5.1', ai_confidence: 92, description: 'GSAS Cert + EPC + EIA all required.' },
  ]
  const schemaDraft = {
    schema_type: 'gsas_certificate_validation',
    fields: [
      { name: 'Certificate Number', type: 'String', validation: '^GSAS-\\d{4}-\\d{3}$', error_message: 'Invalid certificate number format' },
      { name: 'Issuer', type: 'String', validation: 'Must be GORD or accredited body', error_message: 'Issuer not accredited' },
      { name: 'Issue Date', type: 'Date', validation: 'Must be ≤ today', error_message: 'Certificate not yet issued' },
      { name: 'Expiry Date', type: 'Date', validation: 'Must be ≥ today + 90 days', error_message: 'Certificate expires within 90 days' },
      { name: 'Overall Score', type: 'Integer', validation: '0–100, min 70 for eligibility', error_message: 'Score below minimum threshold (70)' },
      { name: 'Rating', type: 'String', validation: 'Silver / Gold / Platinum', error_message: 'Rating does not meet minimum (Bronze rejected)' },
    ],
    ai_confidence: 96, regulatory_reference: 'OS GSO 3000:2025, §4.2',
  }
  return {
    message: "✅ <strong>Stages 5 & 6 complete.</strong> Compliance tags applied · Risk weight 75% · Provisioning 1.5%.<br><br>" +
      "🎯 <strong>All 6 stages done.</strong> Here's the full summary:<br><br>" +
      "📋 <strong>Product:</strong> Green Home Loan – ESG · 5.5% base · Cloned from Standard Home Loan<br>" +
      "💚 <strong>Green discounts:</strong> 0.75% (GSAS ≥85) · 0.5% (GSAS 70–84)<br>" +
      "📏 <strong>Limits:</strong> DBR 55% · LTV 90% · 5–25 years · OMR 10,000–500,000<br>" +
      "📄 <strong>Required docs:</strong> GSAS Certificate · EPC Report · EIA Clearance<br>" +
      "⚙️ <strong>4 rules</strong> · 5-node workflow · 3 compliance tags · GSAS schema (96% confidence)<br><br>" +
      "Ready to publish. Click <strong>Confirm & Publish</strong> to save all configuration, generate portal marketing content, and make the product live.",
    current_stage: 6, show_roadmap: false, action: 'ready_to_confirm',
    ui_events: [{ type: 'set_tab', tab: 'ai_config' }],
    product_draft: productDraft, rules_draft: rulesDraft, schema_draft: schemaDraft,
  }
}

export { app as aiApi }
