import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'
const app = new Hono<{ Bindings: NodeBindings }>()


// ── Multi-turn AI Product Studio ─────────────────────────────────────────
// Handles the full product creation conversation: understand requirements,
// suggest configurations, generate rules, generate GSAS schema, confirm.
app.post('/products/chat', async (c) => {
  // Outer try/catch: any unhandled error must return JSON, never plain-text 500.
  // The frontend calls r.json() unconditionally — a non-JSON body causes the
  // "Unexpected token 'I'" SyntaxError that surfaces as a client-side crash.
  try {
  const body = await c.req.json()
  const { thread_id, message, context = {}, user_id = 'u001', user_name = 'Fatima Al-Rashdi' } = body as any
  const apiKey = c.env.OPENAI_API_KEY

  // Load or create thread
  let thread: any = null
  let messages: any[] = []
  let threadId = thread_id

  if (threadId) {
    thread = await c.env.DB.prepare('SELECT * FROM ai_threads WHERE id = ?').bind(threadId).first() as any
    if (thread) {
      try { messages = JSON.parse(thread.messages || '[]') } catch { messages = [] }
    }
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

  const systemPrompt = `You are a Senior Banking Product Architect at Sohar International Bank, Oman.
You have 20+ years of experience in Islamic and conventional banking product design, CBO regulatory compliance, ESG/green finance, credit risk modelling, and digital banking workflow design.
You are NOT a generic assistant. You are a domain expert who knows exactly what questions to ask, what parameters matter, and what regulators require.
System: jurisdiction Oman, currency OMR, regulator Central Bank of Oman (CBO), rating agency: CBUAE Credit Bureau (Oman), ESG standard: OS GSO 3000:2025.

REGULATORY KNOWLEDGE BASE (cite these precisely):
${kbContext}

EXISTING PRODUCTS IN PORTFOLIO (use real IDs for cloning):
${existingProducts.map((p: any) => `- ${p.name} (ID: ${p.id}): rate ${p.base_rate}%, LTV ${p.max_ltv}%, DBR ${p.max_dbr}%, term ${p.max_term}yr`).join('\n')}

══════════════════════════════════════════════════════════════════
THE 6-STAGE PRODUCT GOVERNANCE PROCESS (PGE):
  Stage 1 – Product Model       : archetype, name, Islamic vs conventional, clone source, target segment, jurisdiction
  Stage 2 – Core Configuration  : pricing (rate, DBR, LTV, terms, amounts), green discount tiers, fees, promotional rates
  Stage 3 – Eligibility Rules   : 10–15 rules covering credit, collateral, ESG, income, nationality, employment
  Stage 4 – Approval Workflow   : 8–12 nodes with external API integrations (eKYC, credit bureau, property valuation, ESG registry)
  Stage 5 – Compliance          : CBO regulatory tags, ECAI risk weights, IFRS9 provisioning, gap analysis, AML flags
  Stage 6 – Simulation          : portfolio modelling, P&L projection, stress test, approval matrix, publish
══════════════════════════════════════════════════════════════════

CONVERSATION RULES — NON-NEGOTIABLE:
1. ONE FOCUSED QUESTION PER TURN. Every single response MUST end with exactly one "?" — no exceptions.
   BANNED: Any response that ends without a "?". If you've confirmed something, immediately pivot to the NEXT sub-question in the same turn.
   BAD: "Great. Conventional structure confirmed. Let's proceed to Stage 2."   ← NO "?" — FORBIDDEN
   GOOD: "Conventional structure confirmed. Next: should this product target Omani nationals only, or include expats too? And what income band — Mass (OMR 800–2K), Affluent (OMR 2K–5K), or HNW (OMR 5K+)?"
   NEVER emit a pure acknowledgement like "Great.", "Understood.", "Noted." without immediately asking the next sub-question in the SAME message.
2. ACT AS THE EXPERT. Don't just ask open questions — give specific recommendations with regulatory citations, then ask the user to confirm or modify.
   BAD: "What interest rate do you want?"
   GOOD: "For a Green Home Loan targeting GSAS-certified properties, I recommend base rate 5.25% (10 bps below Standard Home Loan to incentivise green adoption), with a tiered green discount: 0.75% off for GSAS Score ≥85 (Gold), 0.5% off for Score 70–84 (Silver). Effective floor rate: 4.5%. CBO Circular 2026-12 §3.1 allows this structure. Shall I apply these pricing tiers, or do you want a different spread?"
3. ADVANCE STAGES ONLY ON EXPLICIT USER CONFIRMATION ("yes", "ok", "apply", "go ahead", "proceed", "correct", "sounds good", "use that").
4. WITHIN A STAGE, ask multiple sub-questions if needed before moving on. Don't rush.
5. EMIT UI EVENTS immediately when you apply configuration (not when you're asking). This updates the live product panel on screen.
6. product_draft ONLY at stage 6 (ready_to_confirm). Set null for all prior turns.
7. show_roadmap=true ONLY on Turn 1 when you first identify the product type.
8. current_stage must ONLY increase, never decrease. Track it carefully.
9. STAGE TRANSITIONS: When moving from one stage to the next, combine the "Stage X complete" acknowledgement WITH the first sub-question of Stage X+1 in a SINGLE message. Never send a stage transition without a question at the end.
   BAD: "✅ Stage 1 complete. Moving to Stage 2 — Core Configuration."   ← FORBIDDEN, no "?"
   GOOD: "✅ Stage 1 complete — EcoElite Home Finance, conventional, targeting HNW. <br><br>Stage 2 — Core Configuration. For the base rate: I recommend 5.25% (10 bps below Standard Home Loan). CBO Circular 2026-12 §3.1 permits preferential green pricing. Shall I set 5.25% as the base rate, or adjust?"
10. NEVER repeat a question the user has already answered in this conversation. Check the full message history before asking anything.

STAGE 1 — PRODUCT MODEL (ask these sub-questions in order):
  1a. Clone or scratch? Name the closest existing product and suggest it as a clone source.
  1b. Islamic (Murabaha/Diminishing Musharaka) or Conventional?
  1c. Target segment: Omani nationals only, expats too, or both? Income band (Mass, Affluent >OMR 3,000/mo, HNW)?
  1d. Product name (suggest one, e.g. "Sohar Green Home Finance – GSAS Premium").
  Emit set_field for name and description once confirmed.

STAGE 2 — CORE CONFIGURATION (ask these sub-questions in order):
  2a. Base rate and pricing structure. Give specific recommendation with CBO ceiling reference.
  2b. ESG-specific discount tiers (if green product): GSAS score bands → rate discounts.
  2c. LTV bands: standard vs green (CBO allows up to 90% for green). First home vs non-first.
  2d. DBR: standard 50%, green buffer 55% (CBO Circular 2026-12 §3.2 allows relaxed DBR for green products).
  2e. Term range (min/max years) and amount range (OMR min/max).
  2f. Fees: arrangement fee (suggest 1% capped at OMR 500), early settlement penalty (per CBO rules: 1% max).
  Emit set_field events for each confirmed value.

STAGE 3 — ELIGIBILITY RULES (for Green Home Loan, generate ALL of these):
  First ASK: "I'll now generate 14 eligibility rules covering credit, collateral, ESG, income, nationality and employment. For the GSAS minimum — should I use 70 (Silver, minimum eligibility) or 75 (stricter, premium positioning)?"
  Then on confirmation, emit ALL these rules as add_rule events:

  CREDIT RULES (cite CBO Circular BM/REG/2019/74):
  R1: DBR ≤ 55% (hard) — "max_dbr" — for loan >OMR 100K
  R2: DBR ≤ 60% (hard) — "max_dbr" — for loan ≤OMR 100K  
  R3: Credit Score ≥ 620 (hard) — "credit_score" — Oman Credit Bureau minimum
  R4: No active defaults in 24 months (hard) — "default_history"
  R5: Maximum 3 active credit facilities (soft) — "active_facilities"

  COLLATERAL RULES (cite CBO Circular BM/REG/2019/74):
  R6: LTV ≤ 90% (hard) — "LTV" — first home; ≤80% subsequent
  R7: Property valuation by CBO-approved valuator (hard) — "valuation_approved"
  R8: Title deed must be freehold or 99-year leasehold (hard) — "title_type"
  R9: Property location: Integrated Tourism Circuit (ITC) or Omani ownership zones (hard) — "property_zone"

  ESG RULES (cite OS GSO 3000:2025 and CBO Circular 2026-12):
  R10: GSAS Score ≥ [user-confirmed threshold] (hard) — "gsas_score"
  R11: EPC Rating ≥ C (hard) — "epc_rating" — OEESC minimum
  R12: GSAS Certificate issued by GORD, valid ≥90 days (hard) — "gsas_cert_valid"
  R13: EIA clearance from Environment Authority (hard for projects >20 units) — "eia_approval"
  R14: ESG document set complete: GSAS cert + EPC report + EIA approval (hard) — "esg_docs_complete"

  INCOME/EMPLOYMENT RULES:
  R15: Minimum net monthly income OMR 800 (hard) — "net_income"
  R16: Employment: minimum 6 months at current employer (soft) — "employment_tenure"
  R17: Omani nationals: no restriction. Expats: valid residency ≥ 1 year remaining (hard) — "residency_valid"

STAGE 4 — WORKFLOW (for Green Home Loan, generate all these nodes):
  First ASK: "I'll configure a 10-step approval workflow integrating 4 external data sources. Estimated processing time: 3–5 working days. Should I use automated processing for the first 4 steps (eKYC, credit check, document OCR, property lookup), or do you want more human touchpoints?"
  Then on confirmation, set_workflow with these nodes:

  N1 (start): "Application Submitted via Portal / Branch"
  N2 (task, auto=true, sla_hours=1, role=system): "eKYC & Identity Verification" — desc: "Calls National Centre for Information [NCI] eKYC API to verify Civil ID biometrics. AML screening via WorldCheck/Refinitiv. Result: identity_verified=true/false."
  N3 (task, auto=true, sla_hours=4, role=system): "CBO Credit Bureau Check" — desc: "Calls Oman Credit Bureau API. Retrieves credit score, active facilities count, default history. Auto-rejects if score <620 or default in 24 months."
  N4 (task, auto=true, sla_hours=2, role=system): "Document OCR & Extraction" — desc: "AI OCR extracts fields from: salary cert, civil ID, GSAS certificate, EPC report, EIA approval. Validates formats against product schema."
  N5 (task, auto=true, sla_hours=8, role=system): "GSAS Registry Verification" — desc: "Calls GORD (Gulf Organisation for Research & Development) GSAS API. Validates certificate number, issuer, score, rating, expiry. Confirms property matches submitted certificate."
  N6 (task, auto=true, sla_hours=4, role=system): "Property Valuation & Title Check" — desc: "Integrates with approved valuation firms API (Al Mashora, JLL Oman) for drive-by or desktop valuation. Calls Muscat Municipality / MRMEWR for title deed verification. Confirms ITC/ownership zone eligibility."
  N7 (approval, sla_hours=24, role=credit_analyst): "Credit Underwriting" — desc: "Credit analyst reviews full application: income verification vs salary cert, DBR calculation, stress test at +2% rate, LTV confirmation. Uses bank's internal credit scoring model."
  N8 (approval, sla_hours=24, role=green_finance_officer): "ESG Compliance Review" — desc: "Dedicated Green Finance Officer validates: GSAS score vs product threshold, EPC rating band (A/B/C), EIA coverage matches property units, approved materials list for construction-stage disbursement. Determines discount tier (0.75% or 0.5%)."
  N9 (approval, sla_hours=48, role=risk_officer): "Risk & Compliance Approval" — desc: "Risk Officer signs off: concentration risk check, IFRS9 staging (Stage 1 expected), regulatory capital adequacy (risk weight 75%), AML/CFT secondary review."
  N10 (approval, sla_hours=24, role=product_manager): "Product Manager Final Approval" — desc: "PM confirms product terms match approved configuration. Validates green discount applied correctly. Issues Letter of Offer."
  N11 (end): "Decision & Letter of Offer Issued"

STAGE 5 — COMPLIANCE (ask then apply):
  First ASK: "For compliance classification: I recommend tagging this as Basel III risk weight 75% (residential retail mortgage, LTV ≤90%), IFRS9 Stage 1 provisioning at 1.5% (higher than standard 1.0% due to ESG concentration), and CBO green finance classification. The AML risk score is LOW given eKYC + credit bureau auto-verification. Shall I apply these parameters?"
  Then emit ui_events set_field for:
  - risk_weight: 75%
  - provisioning_rate: 1.5%
  - regulatory_tags: ["#CLIMATE_RISK", "#ESG_ELIGIBILITY", "#GREEN_FINANCING", "#OMAN_VISION_2040"]
  - aml_risk: "LOW"
  - cbo_classification: "GREEN_FINANCE"
  - capital_treatment: "RETAIL_RESIDENTIAL_MORTGAGE"

STAGE 6 — SIMULATION (this turn: emit full product_draft + rules_draft + schema_draft):
  Provide real portfolio projections:
  - Portfolio target: 500 accounts, OMR 150M in first 24 months
  - Revenue model: NIM ~1.8% on green rate (vs 2.2% standard), offset by 0.4% lower provisioning + 10 bps CBO green capital relief
  - Stress test: portfolio performs at 100% pass rate if rates increase by 200 bps (DBR ≤55% built-in buffer)
  - Break-even: month 14 after launch
  - CBO reporting: monthly ESG portfolio report under Circular 2026-12 §7

UI EVENTS — emit immediately when you apply something:
- { type: "set_tab", tab: "general"|"pricing"|"eligibility"|"workflow"|"ai_config" }
- { type: "set_field", field: "name"|"description"|"base_rate"|"max_ltv"|"max_dbr"|"max_term"|"min_amount"|"max_amount"|"gsas_min_score"|"gsas_premium_score"|"green_discount_premium"|"green_discount_standard", value: any }
- { type: "add_rule", rule: { name, category, metric, operator, threshold_value, severity, regulatory_reference, ai_confidence, description } }
- { type: "set_workflow", nodes: [{id, type, label, role, sla_hours, auto, description}] }
- { type: "highlight_field", field: string }

RESPONSE FORMAT — ONLY valid JSON, NO markdown, NO code fences:
{
  "message": "Expert reply with specifics, recommendations, regulatory citations — ends with one focused question (?)",
  "current_stage": 1,
  "show_roadmap": false,
  "action": "none",
  "ui_events": [],
  "product_draft": null,
  "rules_draft": null,
  "schema_draft": null
}`

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
        if (match) {
          aiReply = JSON.parse(match[0])
          // ── Safety guards: prevent GPT from skipping the conversation ──
          // 1. Never emit product_draft before stage 6
          if (aiReply.current_stage < 6) aiReply.product_draft = null
          // 2. At stage 6: if GPT returned no product_draft (or a minimal one), synthesize
          //    it from the fallback state machine which has full conversation context.
          //    This is the primary fix for "No product draft found" — real GPT at stage 6
          //    often emits product_draft: null or an incomplete object.
          if (aiReply.current_stage >= 6 && !aiReply.product_draft) {
            const fallback = getFallbackChatResponse(message, messages.length, messages)
            if (fallback.product_draft) aiReply.product_draft = fallback.product_draft
            if (fallback.schema_draft && !aiReply.schema_draft) aiReply.schema_draft = fallback.schema_draft
          }
          // 3. Never emit rules_draft before stage 3, or AT stage 6 (prevents overwriting Stage 3's 17-rule set)
          if (aiReply.current_stage < 3) aiReply.rules_draft = null
          if (aiReply.current_stage >= 6) aiReply.rules_draft = null
          // 3. show_roadmap only allowed on stage 1 (first identification)
          if (aiReply.current_stage > 1) aiReply.show_roadmap = false
          // 4. Replace generic "how would you like to proceed?" with stage-aware nudge
          //    GPT sometimes emits this filler phrase when it has nothing concrete to ask.
          const msgRaw: string = aiReply.message || ''
          const isGenericProceed = /how would you like to proceed\?/i.test(msgRaw)
          const stg = aiReply.current_stage || 1
          const nudges: Record<number,string> = {
            1: 'Type <strong>yes</strong> to confirm this product model, or let me know what to adjust.',
            2: 'Type <strong>yes</strong> to confirm these parameters, or tell me which values to change.',
            3: 'Type <strong>yes</strong> to generate the eligibility rules, or adjust the GSAS threshold.',
            4: 'Type <strong>yes</strong> to confirm the workflow, or tell me if you want more human touchpoints.',
            5: 'Type <strong>yes</strong> to apply these compliance parameters, or request adjustments.',
            6: 'Click <strong>Confirm &amp; Publish</strong> above to save and publish the product.',
          }
          if (isGenericProceed) {
            // Strip generic question and replace with stage-aware guidance.
            // Mark as already nudged so step 5 below doesn't double-append.
            aiReply.message = msgRaw.replace(/how would you like to proceed\?/i, '').replace(/\s+$/, '') +
              (msgRaw.replace(/how would you like to proceed\?/i, '').trim() ? '<br><br>' : '') +
              '<em style="font-size:.8rem;color:rgba(255,255,255,.55)">' + (nudges[stg] || 'Reply to continue.') + '</em>'
          }
          // 5. If message doesn't end with a question and we're not confirming,
          //    and the generic-proceed replacement hasn't already handled this turn:
          //    append a stage-aware nudge so the user knows what to do next.
          //    Exception: pure transition/acknowledgement messages (GPT violated rule #1 and
          //    sent a "Stage X complete. Let's move to Stage Y." with no sub-question).
          //    Appending "Type yes to confirm these parameters" to a transition is misleading —
          //    the user hasn't been shown any parameters yet. Detect transitions and skip nudge.
          const msg: string = aiReply.message || ''
          const hasQuestion = msg.includes('?')
          const isTransitionOnly =
            !hasQuestion && (
              // Stage-complete acknowledgement without a question
              /stage \d+ complete/i.test(msg) ||
              /let'?s (proceed|move on|move to|configure|set up)/i.test(msg) ||
              /we('ll| will) (proceed|move|configure|set)/i.test(msg) ||
              /moving (on|to) stage/i.test(msg) ||
              /^(great|noted|understood|confirmed|perfect)\b.{0,120}$/i.test(msg.replace(/<[^>]+>/g, ''))
            )
          if (!hasQuestion && !isGenericProceed && aiReply.action !== 'ready_to_confirm') {
            if (isTransitionOnly) {
              // GPT sent a bare acknowledgement/transition with no question — just show a soft prompt
              aiReply.message = msg + '<br><br><em style="font-size:.8rem;color:rgba(255,255,255,.55)">Reply to continue.</em>'
            } else {
              // GPT said something substantive but forgot the question — add the stage nudge
              aiReply.message = msg + '<br><br><em style="font-size:.8rem;color:rgba(255,255,255,.55)">' + (nudges[stg] || 'Reply to continue.') + '</em>'
            }
          }
        } else {
          aiReply.message = text
        }
      }
    } catch (e: any) {
      aiReply = getFallbackChatResponse(message, messages.length, messages)
    }
  } else {
    aiReply = getFallbackChatResponse(message, messages.length, messages)
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
  } catch (outerErr: any) {
    // Always return JSON — never let a plain-text 500 reach the frontend
    return c.json({
      thread_id: null,
      reply: "I'm sorry, I encountered a technical issue. Please try again — your conversation progress is saved.",
      current_stage: 1,
      show_roadmap: false,
      action: 'none',
      ui_events: [],
      product_draft: null,
      rules_draft: null,
      schema_draft: null,
      _error: outerErr?.message || 'unknown',
    }, 200)  // 200 so frontend processes normally and shows the message
  }
})

// ── Confirm product draft — saves to DB ──────────────────────────────────
app.post('/products/confirm', async (c) => {
  try {
  const body = await c.req.json() as any
  let { thread_id, product_draft, rules_draft, schema_draft, user_id = 'u001', user_name = 'Fatima Al-Rashdi' } = body

  // Always load thread result to fill in any missing drafts.
  // product_draft may be passed in body (from aiProductDraft client state),
  // but rules_draft and schema_draft are usually NOT sent from the client —
  // they must be loaded from the thread's saved result.
  if (thread_id) {
    const thread = await c.env.DB.prepare('SELECT result FROM ai_threads WHERE id = ?').bind(thread_id).first() as any
    if (thread?.result) {
      try {
        const saved = JSON.parse(thread.result)
        if (!product_draft && saved.product_draft) product_draft = saved.product_draft
        if (!rules_draft  && saved.rules_draft)   rules_draft  = saved.rules_draft
        if (!schema_draft && saved.schema_draft)  schema_draft = saved.schema_draft
      } catch {}
    }
  }

  // Last-resort synthesis: if product_draft still missing, rebuild from thread messages.
  // This handles the case where real GPT never emitted a product_draft (e.g. stage 6
  // response had product_draft: null, or the thread was saved before Stage 6 fired).
  if (!product_draft && thread_id) {
    const thread2 = await c.env.DB.prepare('SELECT messages FROM ai_threads WHERE id = ?').bind(thread_id).first() as any
    if (thread2?.messages) {
      try {
        const msgs = JSON.parse(thread2.messages)
        const fallback = getFallbackChatResponse('confirm', msgs.length, msgs)
        if (fallback.product_draft) {
          product_draft = fallback.product_draft
          if (!rules_draft && fallback.rules_draft) rules_draft = fallback.rules_draft
          if (!schema_draft && fallback.schema_draft) schema_draft = fallback.schema_draft
        }
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
    configuration, portal_visible, developer_portal_visible, pge_stage, created_by, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
    JSON.stringify(config), 0, 0,
    1,  // pge_stage=1 so PGE opens on Stage 1 with product data pre-filled
    user_id, ts, ts
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
        rule.description || null, 1, user_id, ts  // is_active=1 so PGE Stage 3 shows them
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

  // Determine final pge_stage based on what was generated:
  // 6 = AI confirmed everything (rules saved) — all stages pre-completed, PGE is for review/edit
  //     pge_stage=6 means locked = id > 6+1 = never locked → all 6 stages accessible
  // 3 = rules saved, no workflow — PGE opens at rules tab
  // 1 = product model only
  // When AI completes full workflow (stages 1-6) and user confirms, set pge_stage=6
  // so the PGE opens with all stages unlocked for review, not just Stage 1.
  const finalPgeStage = ruleIds.length > 0 ? 6 : 1

  await c.env.DB.prepare(
    `UPDATE products SET status='active', portal_visible=1, developer_portal_visible=?,
     portal_hero_title=?, portal_highlights=?, portal_card_badge=?, published_at=?, pge_stage=?, updated_at=? WHERE id=?`
  ).bind(isGreen ? 1 : 0, portalHeroTitle, JSON.stringify(portalHighlights), portalBadge, ts, finalPgeStage, ts, id).run()

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
  } catch (outerErr: any) {
    return c.json({ success: false, error: 'Server error during product save. Please try again.', _error: outerErr?.message || 'unknown' }, 200)
  }
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

function getFallbackChatResponse(message: string, msgCount: number, allMessages?: any[]): any {
  const lower = message.toLowerCase()
  const isYes = lower.includes('yes') || lower.includes('ok') || lower.includes('proceed') || lower.includes('confirm')
    || lower.includes('clone') || lower.includes('standard') || lower.includes('agree') || lower.includes('sounds good')
    || lower.includes('go ahead') || lower.includes('correct') || lower.includes('apply') || lower.includes('sure')
    || lower.includes('fine') || lower.includes('good') || lower.includes('perfect') || lower.includes('great')
    || lower.includes('continue') || lower.includes('use') || lower.includes('keep') || lower.includes('proceed')

  // ── Derive conversation state from full message history ───────────────────
  const history = allMessages || []
  const assistantMsgs = history.filter((m: any) => m.role === 'assistant').map((m: any) => (m.content || '').toLowerCase())
  const hasAskedStage1  = assistantMsgs.some(m => m.includes('clone') || m.includes('from scratch') || m.includes('product model') || m.includes('stage 1'))
  const hasAskedStage1b = assistantMsgs.some(m => m.includes('islamic') || m.includes('murabaha') || m.includes('conventional') || m.includes('structure'))
  const hasAskedStage1c = assistantMsgs.some(m => m.includes('target segment') || m.includes('omani nationals') || m.includes('expat') || m.includes('income band'))
  const hasAskedStage1d = assistantMsgs.some(m =>
    m.includes('product name') || m.includes('sohar green') || m.includes('sohar eco') ||
    m.includes('ecohome') || m.includes('confirm the name') || m.includes('shall i use') ||
    m.includes('for the product name') || m.includes('i suggest') && m.includes('name')
  )
  const hasAskedStage2  = assistantMsgs.some(m => m.includes('base rate') || m.includes('pricing structure') || m.includes('stage 2') || m.includes('5.25%'))
  const hasAskedStage2b = assistantMsgs.some(m => m.includes('discount tier') || m.includes('green discount') || m.includes('gsas score band'))
  const hasAskedStage2c = assistantMsgs.some(m =>
    m.includes('ltv band') || m.includes('loan-to-value') ||
    (m.includes('ltv') && m.includes('first home') && m.includes('subsequent')) ||
    m.includes('90% ltv') || m.includes('ltv settings')
  )
  const hasAskedStage2d = assistantMsgs.some(m => m.includes('dbr') && (m.includes('55%') || m.includes('stage 2') || m.includes('debt burden')))
  const hasAskedStage2e = assistantMsgs.some(m => m.includes('term range') || m.includes('amount range') || m.includes('omr 10,000') || m.includes('min/max'))
  const hasAskedStage2f = assistantMsgs.some(m => m.includes('arrangement fee') || m.includes('early settlement') || m.includes('fee'))
  // Stage 3 QUESTION marker — must be UNIQUE to the stage-3 question turn only.
  // Do NOT use 'eligibility rules' or 'workflow' — Stage 3 COMPLETION message also contains both.
  // Use '17 eligibility rules' (question) or 'gsas minimum' (question text).
  const hasAskedStage3  = assistantMsgs.some(m =>
    m.includes('17 eligibility rules') || m.includes('gsas minimum') ||
    (m.includes('stage 3') && m.includes('credit risk'))
  )
  // Stage 4 QUESTION marker: user was asked the workflow automation question.
  // Detect by the Stage 3 completion message's unique "10-step workflow" ask phrase.
  const hasAskedStage4  = assistantMsgs.some(m =>
    m.includes('10-step workflow') ||
    m.includes('10-step approval workflow') ||
    m.includes('more human touchpoints in the automated phase') ||
    m.includes('should i configure automated processing')
  )
  // Stage 4 COMPLETE marker: Stage 4 response was returned (workflow built).
  // Use 'stage 4 complete.' (unique — only in the Stage 4 response message).
  // Must NOT use 'nci ekyc' alone — that string also appears in Stage 4 ask.
  const hasAskedStage4Complete = assistantMsgs.some(m =>
    m.includes('stage 4 complete') ||
    m.includes('10-step approval workflow configured') ||
    m.includes('approval workflow set') ||
    m.includes('approval workflow configured') ||
    m.includes('workflow is now configured') ||
    m.includes('workflow has been configured') ||
    (m.includes('nci ekyc') && m.includes('muscat municipality')) ||  // only in stage 4 response
    (m.includes('workflow') && m.includes('10 steps')) ||
    (m.includes('workflow') && m.includes('10-step') && m.includes('stage 5'))
  )
  // Stage 5 QUESTION marker: Stage 5 compliance ask was shown to user.
  // Use 'shall i apply these compliance parameters' — unique to stage 5 ask message.
  // Do NOT use 'aml risk score' or 'basel iii' — those are in stage 4 response too.
  // hasAskedStage5 = the Stage 5 compliance question WAS shown to the user.
  // Also true if the Stage 5 compliance ANSWER was returned (which means user replied yes).
  // 'stage 5 complete' is in the Stage 5 answer message (compliance applied) → user said yes.
  // 'compliance parameters applied' / 'basel iii risk weight 75%' also only in Stage 5 answer.
  const hasAskedStage5  = assistantMsgs.some(m =>
    m.includes('shall i apply these compliance parameters') ||
    m.includes('compliance parameters, or do you want to adjust') ||
    m.includes('stage 5 complete') ||
    (m.includes('compliance parameters applied') || (m.includes('basel iii') && m.includes('ifrs9') && m.includes('aml risk score')))
  )
  // hasAskedConfirm = the STAGE 6 SIMULATION response was already delivered.
  // Must NOT fire on the Stage 5→6 transition text ("Stage 6 — Simulation. Are you ready...")
  // because that message does not contain the product_draft or simulation data yet.
  // Only the actual Stage 6 response contains 'ready to publish' / 'confirm & publish'.
  const hasAskedConfirm = assistantMsgs.some(m =>
    m.includes('ready to publish') || m.includes('confirm &amp; publish') ||
    m.includes('confirm & publish') || m.includes('click confirm') ||
    // Portfolio projection text appears ONLY in the actual Stage 6 simulation message
    (m.includes('stage 6') && (m.includes('portfolio target') || m.includes('break-even') || m.includes('nim ~'))) ||
    (m.includes('stage 6') && m.includes('everything is configured'))
  )

  // Product type detection from full conversation context
  const fullContext = [...history.map((m: any) => m.content || ''), message].join(' ').toLowerCase()
  const ctxGreen    = fullContext.includes('green') || fullContext.includes('gsas') || fullContext.includes('esg') || fullContext.includes('sustainable')
  const ctxAuto     = !ctxGreen && (fullContext.includes('auto') || fullContext.includes('car') || fullContext.includes('vehicle'))
  const ctxPersonal = !ctxGreen && !ctxAuto && (fullContext.includes('personal') || fullContext.includes('unsecured') || fullContext.includes('consumer'))
  const ctxSme      = !ctxGreen && !ctxAuto && !ctxPersonal && (fullContext.includes('sme') || fullContext.includes('business') || fullContext.includes('working capital'))

  // Parse numeric values from user message
  const gsasFromMsg = (() => { const m = lower.match(/\b(7[0-9]|80|85|90)\b/); return m ? parseInt(m[1]) : 70 })()

  const productLabel = ctxGreen ? 'Sohar Green Home Finance – GSAS' : ctxAuto ? 'Auto Finance' : ctxPersonal ? 'Personal Finance' : ctxSme ? 'SME Working Capital' : 'Home Finance'

  // ── No prior context — ask for product type ───────────────────────────────
  if (!hasAskedStage1 && !ctxGreen && !ctxAuto && !ctxPersonal && !ctxSme) {
    return {
      message: "I can help you create a new fully-regulated banking product from scratch — I'll guide you through all 6 stages, ask the right expert questions, and automatically populate the configuration on screen.<br><br>" +
        "<strong>What type of product would you like to create?</strong><br><br>" +
        "🏠 <strong>Green Home Loan</strong> (GSAS/ESG-certified mortgages)<br>" +
        "🏠 <strong>Standard Home Loan</strong> (conventional or Islamic Murabaha)<br>" +
        "🚗 <strong>Auto Finance</strong> (personal or fleet)<br>" +
        "💳 <strong>Personal Finance</strong> (salary-backed unsecured)<br>" +
        "🏢 <strong>SME Finance</strong> (working capital, equipment, trade)<br>" +
        "🎓 <strong>Education Finance</strong><br>" +
        "🏗️ <strong>Commercial Real Estate</strong>",
      current_stage: 0, show_roadmap: false, action: 'none', ui_events: [], product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 1a: Product type identified — Clone or scratch? ────────────────
  if (!hasAskedStage1) {
    const cloneProduct = ctxGreen ? 'Standard Home Loan (5.5% base, LTV 90%, DBR 60%, term 25yr)'
      : ctxAuto ? 'Auto Finance – Personal (6.5% base, LTV 80%, DBR 55%)'
      : ctxPersonal ? 'Personal Finance (8.5% base, DBR 45%)'
      : ctxSme ? 'SME Working Capital (7.0% base, DBR 50%)'
      : 'Standard Home Loan'
    return {
      message: ctxGreen
        ? `Excellent choice. A <strong>Green Home Loan linked to GSAS certification</strong> is a strategically important product — it aligns with CBO Circular 2026-12 on green finance and Oman Vision 2040 sustainability targets.<br><br>` +
          `<strong>Stage 1 — Product Model</strong><br><br>` +
          `The closest base is our existing <em>${cloneProduct}</em>. We'd inherit the core credit parameters and then layer on ESG-specific attributes (GSAS score bands, green discounts, ESG document requirements).<br><br>` +
          `<strong>Would you like to clone from Standard Home Loan as a starting point, or configure everything from scratch?</strong>`
        : `Good. I'll help configure this as a CBO-compliant <strong>${productLabel}</strong> for the Omani market.<br><br>` +
          `<strong>Stage 1 — Product Model</strong><br><br>` +
          `Closest existing product: <em>${cloneProduct}</em>.<br><br>` +
          `<strong>Shall we clone from this as a base?</strong>`,
      current_stage: 1, show_roadmap: true, action: 'none', ui_events: [], product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 1b: Islamic or Conventional? ───────────────────────────────────
  if (hasAskedStage1 && !hasAskedStage1b) {
    const cloningFrom = isYes || lower.includes('clone') || lower.includes('standard') ? 'Standard Home Loan (p001)' : 'scratch'
    return {
      message: `Noted — ${lower.includes('scratch') ? 'configuring from scratch' : `cloning from <em>Standard Home Loan</em>`}.<br><br>` +
        `<strong>Financing structure:</strong> Should this product be:<br><br>` +
        `&bull; <strong>Conventional</strong> — standard interest-bearing mortgage (most of our existing portfolio)<br>` +
        `&bull; <strong>Islamic – Diminishing Musharaka</strong> — co-ownership with declining bank share; more complex to configure but growing demand (especially for Omani nationals)<br>` +
        `&bull; <strong>Islamic – Murabaha</strong> — cost-plus financing, simpler structure<br><br>` +
        `Most of our green home loan applicants are conventional at this stage. <strong>Which structure should this product use?</strong>`,
      current_stage: 1, show_roadmap: false, action: 'none', ui_events: [], product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 1c: Target segment ──────────────────────────────────────────────
  if (hasAskedStage1 && hasAskedStage1b && !hasAskedStage1c) {
    const structure = lower.includes('islamic') || lower.includes('musharaka') || lower.includes('murabaha') ? 'Islamic' : 'Conventional'
    return {
      message: `${structure} structure — confirmed.<br><br>` +
        `<strong>Target customer segment:</strong><br><br>` +
        `&bull; <strong>Omani Nationals only</strong> — higher LTV permitted (up to 90%), eligible for government salary-backed schemes<br>` +
        `&bull; <strong>Expats included</strong> — residency ≥1 year remaining required; max LTV typically 80% for expats; GSAS requirement still applies<br>` +
        `&bull; <strong>Both, with tiered terms</strong> — different LTV and income thresholds per nationality<br><br>` +
        `Income band target:<br>` +
        `&bull; <strong>Mass market</strong> (OMR 800–2,000/mo net) — larger volume, stricter DBR management<br>` +
        `&bull; <strong>Affluent</strong> (OMR 2,000–5,000/mo) — preferred for green premium tier<br>` +
        `&bull; <strong>Both</strong><br><br>` +
        `<strong>Who is the primary target — nationals only or both, and what income segment?</strong>`,
      current_stage: 1, show_roadmap: false, action: 'none', ui_events: [], product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 1d: Product name confirmation ──────────────────────────────────
  if (hasAskedStage1 && hasAskedStage1b && hasAskedStage1c && !hasAskedStage1d) {
    const bothSegs = lower.includes('both') || lower.includes('all')
    const nationalsOnly = lower.includes('national') && !lower.includes('both')
    const affluent = lower.includes('affluent') || lower.includes('2,000') || lower.includes('2000')
    const suggestedName = ctxGreen
      ? (affluent ? 'Sohar Green Home Finance – GSAS Premium' : 'Sohar Green Home Finance – GSAS')
      : `${productLabel}`
    return {
      message: `Segment noted — ${nationalsOnly ? 'Omani nationals' : 'nationals and expats'}, ${affluent ? 'affluent tier (OMR 2K+)' : 'mass and affluent'}.<br><br>` +
        `For the product name, I suggest: <strong>"${suggestedName}"</strong><br><br>` +
        `This follows our naming convention: Bank · Product Type · Variant. The GSAS suffix signals the ESG positioning immediately to customers and regulators.<br><br>` +
        `<strong>Shall I use "${suggestedName}", or do you have a different name in mind?</strong>`,
      current_stage: 1, show_roadmap: false, action: 'none', ui_events: [], product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 2a: Base rate and pricing ──────────────────────────────────────
  if (hasAskedStage1d && !hasAskedStage2) {
    const nameConfirmed = isYes ? 'Sohar Green Home Finance – GSAS' : (message.length > 3 && message.length < 80 ? message.trim() : 'Sohar Green Home Finance – GSAS')
    return {
      message: `✅ <strong>Stage 1 complete.</strong> Product model defined — "${nameConfirmed}", conventional, cloned from Standard Home Loan.<br><br>` +
        `<strong>Stage 2 — Core Configuration</strong><br><br>` +
        `<strong>Pricing structure recommendation:</strong><br><br>` +
        `Base rate: <strong>5.25%</strong> per annum (10 bps below Standard Home Loan at 5.35%) — a modest incentive for green adoption without significant NIM compression.<br><br>` +
        `CBO Circular 2026-12 §3.1 permits preferential pricing for green-certified products. Our current cost of funds is ~3.8%, giving a spread of ~1.45% — acceptable for this asset class.<br><br>` +
        `<strong>Shall I set the base rate at 5.25%, or would you like to adjust it?</strong>`,
      current_stage: 2, show_roadmap: false, action: 'none',
      ui_events: [
        { type: 'set_tab', tab: 'general' },
        { type: 'set_field', field: 'name', value: nameConfirmed },
        { type: 'set_field', field: 'description', value: 'Preferential home financing for GSAS-certified green properties. Earn up to 0.75% rate discount based on sustainability score. Supports Oman Vision 2040 and CBO green finance objectives.' },
        { type: 'highlight_field', field: 'name' },
      ],
      product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 2b: Green discount tiers ───────────────────────────────────────
  if (hasAskedStage2 && !hasAskedStage2b && ctxGreen) {
    return {
      message: `Base rate set at 5.25%. Confirmed.<br><br>` +
        `<strong>ESG Green Discount tiers</strong> — this is what differentiates a real green product from a standard one:<br><br>` +
        `&bull; <strong>GSAS Score ≥ 85 (Gold/Platinum)</strong> → −0.75% discount → effective rate <strong>4.50%</strong><br>` +
        `&bull; <strong>GSAS Score 70–84 (Silver)</strong> → −0.50% discount → effective rate <strong>4.75%</strong><br>` +
        `&bull; <strong>GSAS Score &lt; 70</strong> → <span style="color:#f87171">NOT eligible</span> (product requires minimum Silver certification)<br><br>` +
        `These tiers incentivise customers to choose higher-rated green properties. Oman's GORD (Gulf Organisation for Research & Development) manages GSAS ratings under OS GSO 3000:2025.<br><br>` +
        `<strong>Should I apply these discount tiers, or do you want different GSAS score thresholds or discount spreads?</strong>`,
      current_stage: 2, show_roadmap: false, action: 'none',
      ui_events: [
        { type: 'set_tab', tab: 'pricing' },
        { type: 'set_field', field: 'base_rate', value: 5.25 },
        { type: 'highlight_field', field: 'base_rate' },
      ],
      product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 2c: LTV bands ───────────────────────────────────────────────────
  if ((hasAskedStage2b || (hasAskedStage2 && !ctxGreen)) && !hasAskedStage2c) {
    return {
      message: `Green discount tiers confirmed — 0.75% for Gold/Platinum (≥85), 0.5% for Silver (70–84).<br><br>` +
        `<strong>Loan-to-Value (LTV) bands:</strong><br><br>` +
        `Under CBO Circular BM/REG/2019/74, residential mortgages are capped at:<br>` +
        `&bull; <strong>First home purchase</strong>: up to <strong>90% LTV</strong><br>` +
        `&bull; <strong>Second/subsequent property</strong>: up to <strong>80% LTV</strong><br>` +
        `&bull; <strong>Expat customers</strong>: max <strong>80% LTV</strong> regardless of purchase number<br><br>` +
        `For a green home loan, I recommend keeping the CBO maximum (90% for first home, 80% otherwise) — the GSAS certification already provides quality collateral assurance through certified construction standards.<br><br>` +
        `<strong>Shall I configure LTV at 90% (first home) / 80% (subsequent/expat), or do you want stricter limits?</strong>`,
      current_stage: 2, show_roadmap: false, action: 'none',
      ui_events: [
        { type: 'set_field', field: 'gsas_min_score', value: 70 },
        { type: 'set_field', field: 'gsas_premium_score', value: 85 },
        { type: 'set_field', field: 'green_discount_premium', value: 0.75 },
        { type: 'set_field', field: 'green_discount_standard', value: 0.5 },
        { type: 'highlight_field', field: 'green_discount_premium' },
      ],
      product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 2d: DBR ─────────────────────────────────────────────────────────
  if (hasAskedStage2c && !hasAskedStage2d) {
    return {
      message: `LTV set: 90% first home, 80% subsequent/expat. Confirmed.<br><br>` +
        `<strong>Debt Burden Ratio (DBR) limit:</strong><br><br>` +
        `Standard CBO maximum is 50% of net monthly income. However, <strong>CBO Circular 2026-12 §3.2 explicitly allows an enhanced DBR of up to 55% for green-certified financing products</strong> — a 5% relaxation designed to incentivise green uptake.<br><br>` +
        `My recommendation:<br>` +
        `&bull; <strong>55% DBR</strong> for green-certified loans (using the CBO allowance)<br>` +
        `&bull; <strong>50% DBR</strong> standard safety floor for all other cases<br><br>` +
        `This gives customers slightly more headroom when purchasing green properties, directly supporting adoption.<br><br>` +
        `<strong>Shall I set DBR at 55% for this green product, or do you prefer the standard 50%?</strong>`,
      current_stage: 2, show_roadmap: false, action: 'none',
      ui_events: [
        { type: 'set_field', field: 'max_ltv', value: 90 },
        { type: 'highlight_field', field: 'max_ltv' },
      ],
      product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 2e: Term and amount ranges ─────────────────────────────────────
  if (hasAskedStage2d && !hasAskedStage2e) {
    return {
      message: `DBR at 55% confirmed — using CBO green finance allowance (Circular 2026-12 §3.2).<br><br>` +
        `<strong>Term and amount ranges:</strong><br><br>` +
        `&bull; <strong>Term</strong>: min 3 years, max <strong>25 years</strong> (CBO ceiling for residential mortgages). For green, no reason to shorten — longer terms support larger green property purchases.<br>` +
        `&bull; <strong>Minimum loan</strong>: <strong>OMR 25,000</strong> — below this, the GSAS certification cost (~OMR 3,000–8,000) makes the product uneconomical for the customer<br>` +
        `&bull; <strong>Maximum loan</strong>: <strong>OMR 500,000</strong> — our standard residential cap; above this goes to Commercial Real Estate<br><br>` +
        `<strong>Are these ranges acceptable — 3–25 years, OMR 25K–500K — or do you want to adjust?</strong>`,
      current_stage: 2, show_roadmap: false, action: 'none',
      ui_events: [
        { type: 'set_field', field: 'max_dbr', value: 55 },
        { type: 'highlight_field', field: 'max_dbr' },
      ],
      product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 2f: Fees ────────────────────────────────────────────────────────
  if (hasAskedStage2e && !hasAskedStage2f) {
    return {
      message: `Term and amounts set: 3–25 years, OMR 25,000–500,000. Confirmed.<br><br>` +
        `<strong>Fee structure:</strong><br><br>` +
        `Under CBO Consumer Protection Circular 2018/2, all fees must be disclosed upfront. Recommended:<br><br>` +
        `&bull; <strong>Arrangement fee</strong>: 1% of loan amount, capped at OMR 500 — standard market rate, waived for GSAS Platinum (≥90 score) as an additional green incentive<br>` +
        `&bull; <strong>Early settlement penalty</strong>: 1% of outstanding balance (CBO maximum allowed) — or waived after year 5 to encourage refinancing into newer green products<br>` +
        `&bull; <strong>Valuation fee</strong>: actual cost (OMR 200–800 depending on property) — pass-through to customer<br>` +
        `&bull; <strong>GSAS re-validation fee</strong>: OMR 150 (charged at certificate renewal, every 3 years) — new ESG-specific fee<br><br>` +
        `<strong>Should I apply this fee structure, or modify any of these?</strong>`,
      current_stage: 2, show_roadmap: false, action: 'none',
      ui_events: [
        { type: 'set_field', field: 'min_amount', value: 25000 },
        { type: 'set_field', field: 'max_amount', value: 500000 },
        { type: 'set_field', field: 'max_term', value: 25 },
        { type: 'highlight_field', field: 'max_amount' },
      ],
      product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 3: Eligibility Rules ────────────────────────────────────────────
  if (hasAskedStage2f && !hasAskedStage3) {
    return {
      message: `✅ <strong>Stage 2 complete.</strong> Full pricing and configuration set:<br>` +
        `Rate 5.25% · Green discount 0.75%/0.5% · LTV 90/80% · DBR 55% · OMR 25K–500K · Term 25yr max<br><br>` +
        `<strong>Stage 3 — Eligibility Rules</strong><br><br>` +
        `I'll now generate <strong>17 eligibility rules</strong> covering 5 categories: credit risk, collateral, ESG/green, income & employment, and documentation. All rules are cited against specific CBO circulars and OS GSO standards.<br><br>` +
        `One key decision before I generate: <strong>GSAS minimum score</strong>:<br>` +
        `&bull; <strong>70 (Silver minimum)</strong> — broader market eligibility, higher volume, lower average green quality<br>` +
        `&bull; <strong>75 (stricter Silver)</strong> — better ESG positioning, may reduce addressable market by ~20%<br><br>` +
        `<strong>Which GSAS minimum should I use: 70 or 75?</strong>`,
      current_stage: 3, show_roadmap: false, action: 'none', ui_events: [], product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 3 answered: Generate all 17 rules ───────────────────────────────
  if (hasAskedStage3 && !hasAskedStage4) {
    const gsasMin = lower.includes('75') ? 75 : lower.includes('70') ? 70 : gsasFromMsg >= 70 ? gsasFromMsg : 70
    const rules = [
      // CREDIT RULES
      { name: 'DBR ≤ 55% (Loans > OMR 100K)', category: 'creditworthiness', metric: 'DBR', operator: '<=', threshold_value: 55, threshold_condition: 'loan_amount > 100000', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular 2026-12, §3.2', ai_confidence: 96, description: 'Maximum debt burden ratio 55% for green finance loans exceeding OMR 100,000. CBO green finance allowance.' },
      { name: 'DBR ≤ 60% (Loans ≤ OMR 100K)', category: 'creditworthiness', metric: 'DBR', operator: '<=', threshold_value: 60, threshold_condition: 'loan_amount <= 100000', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular BM/REG/2019/74, §4', ai_confidence: 95, description: 'Standard DBR cap for smaller loan amounts. CBO residential mortgage DBR ceiling.' },
      { name: 'Credit Score ≥ 620 (Oman CRB)', category: 'creditworthiness', metric: 'credit_score', operator: '>=', threshold_value: 620, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Credit Bureau Framework, §6.1', ai_confidence: 94, description: 'Minimum credit score from Oman Credit Bureau (OCB). Score below 620 indicates elevated default risk. Auto-rejected.' },
      { name: 'No Active Defaults (24 Months)', category: 'creditworthiness', metric: 'default_history_months', operator: '>=', threshold_value: 24, threshold_condition: 'default_count = 0', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular on Loan Classification, §3', ai_confidence: 97, description: 'No payment defaults, restructured loans, or write-offs in the past 24 months. Hard reject — no exceptions.' },
      { name: 'Max 4 Active Credit Facilities', category: 'creditworthiness', metric: 'active_facilities_count', operator: '<=', threshold_value: 4, threshold_condition: null, action_on_breach: 'flag', severity: 'soft', regulatory_reference: 'CBO Circular BM/REG/2019/74, §5.2', ai_confidence: 88, description: 'Applicants with >4 active facilities flagged for enhanced underwriting review. Soft rule — underwriter discretion.' },
      // COLLATERAL RULES
      { name: 'LTV ≤ 90% (First Home)', category: 'collateral', metric: 'LTV', operator: '<=', threshold_value: 90, threshold_condition: 'is_first_home = true', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular BM/REG/2019/74, §7.1', ai_confidence: 98, description: 'Maximum LTV 90% for first-home purchase by Omani nationals. CBO absolute ceiling.' },
      { name: 'LTV ≤ 80% (Subsequent/Expat)', category: 'collateral', metric: 'LTV', operator: '<=', threshold_value: 80, threshold_condition: 'is_first_home = false OR nationality = expat', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular BM/REG/2019/74, §7.2', ai_confidence: 97, description: 'Maximum LTV 80% for non-first home purchases and all expat applicants.' },
      { name: 'CBO-Approved Property Valuator', category: 'collateral', metric: 'valuator_approved', operator: '=', threshold_value: 1, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Valuations Circular 2021/8', ai_confidence: 93, description: 'Property must be valued by a CBO-approved independent valuator (Al Mashora, JLL, Cushman). No self-valuation.' },
      { name: 'Title: Freehold or 99-Year Leasehold', category: 'collateral', metric: 'title_type', operator: 'in', threshold_value: 1, threshold_condition: 'freehold OR leasehold_years >= 99', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'Royal Decree 12/2006 (Property Law)', ai_confidence: 91, description: 'Only freehold title deeds or 99-year leaseholds accepted as collateral. Shorter-term leaseholds rejected.' },
      // ESG RULES
      { name: `GSAS Score ≥ ${gsasMin} (Minimum Eligibility)`, category: 'esg', metric: 'gsas_score', operator: '>=', threshold_value: gsasMin, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'OS GSO 3000:2025, §4.2 · CBO Circular 2026-12, §2.1', ai_confidence: 98, description: `Minimum GSAS sustainability score of ${gsasMin} (${gsasMin >= 75 ? 'strong Silver' : 'Silver'} rating). Property must hold valid GSAS certificate from GORD. Hard reject — no waiver.` },
      { name: 'EPC Rating ≥ C (Energy Performance)', category: 'esg', metric: 'epc_rating', operator: '>=', threshold_value: 3, threshold_condition: 'A=5, B=4, C=3, D=2, E=1', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'OEESC (Oman Energy Efficiency & Sustainability Code), §5.1', ai_confidence: 94, description: 'Minimum Energy Performance Certificate rating of C. Assessed by OEESC-accredited assessor. EPC must be valid (not expired).' },
      { name: 'GSAS Certificate Valid ≥ 90 Days', category: 'esg', metric: 'gsas_cert_days_remaining', operator: '>=', threshold_value: 90, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'OS GSO 3000:2025, §6.3 · CBO Circular 2026-12, §2.3', ai_confidence: 96, description: 'GSAS certificate must be issued by GORD, not expired, and have ≥90 days validity remaining at loan disbursement.' },
      { name: 'EIA Clearance (Projects > 20 Units)', category: 'esg', metric: 'eia_approval', operator: '=', threshold_value: 1, threshold_condition: 'project_units > 20', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'Environment Authority Decision 107/2023', ai_confidence: 91, description: 'Environmental Impact Assessment approval from Oman Environment Authority required for developments with more than 20 residential units.' },
      { name: 'ESG Document Set: All 3 Required', category: 'esg', metric: 'esg_docs_complete', operator: '=', threshold_value: 1, threshold_condition: 'gsas_cert AND epc_report AND (eia_approval OR project_units <= 20)', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular 2026-12, §5.1', ai_confidence: 97, description: 'Complete ESG document set required: (1) GSAS Certificate, (2) EPC Report, (3) EIA Approval (if applicable). Missing any document = auto-reject.' },
      // INCOME & EMPLOYMENT RULES
      { name: 'Minimum Net Income OMR 800/Month', category: 'eligibility', metric: 'net_monthly_income', operator: '>=', threshold_value: 800, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'Sohar Internal Credit Policy §12.1', ai_confidence: 92, description: 'Minimum verified net monthly income of OMR 800. Verified against salary certificate and payroll data. Self-employed: average of last 24 months audited income.' },
      { name: 'Employment Tenure ≥ 6 Months', category: 'eligibility', metric: 'employment_months', operator: '>=', threshold_value: 6, threshold_condition: 'employment_type = salaried', action_on_breach: 'flag', severity: 'soft', regulatory_reference: 'Sohar Internal Credit Policy §12.2', ai_confidence: 87, description: 'Salaried applicants must have ≥6 months at current employer. Soft rule — underwriter may override with salary continuity evidence.' },
      { name: 'Expat Residency ≥ 12 Months Remaining', category: 'eligibility', metric: 'residency_days_remaining', operator: '>=', threshold_value: 365, threshold_condition: 'nationality = expat', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular on Expat Credit Facilities, §3', ai_confidence: 95, description: 'Expat applicants must have at least 12 months remaining on current residency permit at time of application. Hard reject.' },
    ]
    return {
      message: `✅ <strong>Stage 3 complete.</strong> <strong>${rules.length} eligibility rules</strong> generated and added to the Eligibility tab — check it now!<br><br>` +
        `<strong>Credit rules (5):</strong> DBR ≤55% (>100K), DBR ≤60% (≤100K), Credit Score ≥620, No defaults 24mo, Max 4 facilities<br>` +
        `<strong>Collateral rules (4):</strong> LTV ≤90% first home, ≤80% subsequent/expat, Approved valuator, Freehold/leasehold title<br>` +
        `<strong>ESG rules (5):</strong> GSAS ≥${gsasMin}, EPC ≥C, GSAS cert valid ≥90 days, EIA clearance, Full document set<br>` +
        `<strong>Income/employment (3):</strong> Net income ≥OMR 800, Tenure ≥6mo, Expat residency ≥12mo<br><br>` +
        `<strong>Stage 4 — Approval Workflow</strong><br><br>` +
        `I'll configure a <strong>10-step workflow</strong> with 4 external API integrations: eKYC/NCI, Oman Credit Bureau, GSAS registry (GORD), property valuation APIs, and Muscat Municipality title check.<br><br>` +
        `First 5 steps are fully automated (0 human time, ~15 hours total). Last 5 require human review (credit analyst, green finance officer, risk officer, PM).<br><br>` +
        `<strong>Should I configure automated processing for the first 5 steps, or do you want more human touchpoints in the automated phase?</strong>`,
      current_stage: 4, show_roadmap: false, action: 'none',
      ui_events: [
        { type: 'set_tab', tab: 'eligibility' },
        ...rules.map(r => ({ type: 'add_rule', rule: r })),
      ],
      product_draft: null, rules_draft: rules, schema_draft: null,
    }
  }

  // ── STAGE 4 answered: Generate full workflow ──────────────────────────────
  if (hasAskedStage4 && !hasAskedStage4Complete) {
    const wfNodes = [
      { id: 'n1', type: 'start', label: 'Application Submitted', role: null, description: 'Customer submits via Sohar Mobile App, Internet Banking, or branch. Application ID generated. Documents uploaded to secure vault.' },
      { id: 'n2', type: 'task', label: 'eKYC & AML Screening', role: 'system', sla_hours: 1, auto: true, description: 'Calls National Centre for Information (NCI) eKYC API — biometric Civil ID verification. Simultaneous AML/CFT screening via WorldCheck/Refinitiv. Result: identity_verified. Auto-reject if AML hit.' },
      { id: 'n3', type: 'task', label: 'Oman Credit Bureau Check', role: 'system', sla_hours: 4, auto: true, description: 'Calls OCB API. Retrieves: credit score, active facilities count, payment history 24 months, defaults, restructured loans. Auto-reject: score <620 or any default in 24mo.' },
      { id: 'n4', type: 'task', label: 'Document OCR & AI Validation', role: 'system', sla_hours: 2, auto: true, description: 'AI OCR extracts structured data from: salary certificate, Civil ID, GSAS certificate, EPC report, EIA approval. Validates field formats vs. product schema. Confidence score per document.' },
      { id: 'n5', type: 'task', label: 'GSAS Registry Verification (GORD API)', role: 'system', sla_hours: 4, auto: true, description: 'Calls GORD GSAS API. Validates: certificate number authenticity, issuer = GORD, score matches submitted cert, rating band (Silver/Gold/Platinum), expiry ≥ 90 days, property address matches application.' },
      { id: 'n6', type: 'task', label: 'Property Valuation & Title Verification', role: 'system', sla_hours: 8, auto: true, description: 'API integration: Al Mashora/JLL Oman for desktop or drive-by valuation. Muscat Municipality / MRMEWR API for title deed authenticity, ownership zone (ITC/Omani zone), freehold confirmation. Calculates LTV against confirmed valuation.' },
      { id: 'n7', type: 'approval', label: 'Credit Underwriting', role: 'credit_analyst', sla_hours: 24, description: 'Credit Analyst reviews: income vs salary cert, DBR calculation with all facilities, stress test at base rate +2% (must still pass DBR), LTV confirmation, employment stability. Uses Sohar internal credit scoring model (FICO-based adaptation).' },
      { id: 'n8', type: 'approval', label: 'Green Finance ESG Review', role: 'green_finance_officer', sla_hours: 24, description: 'Dedicated Green Finance Officer (new role under CBO Circular 2026-12): validates GSAS score vs product threshold, EPC rating band, EIA coverage scope, determines applicable discount tier (0.75% if GSAS ≥85, 0.5% if 70–84), confirms approved materials list for staged disbursement.' },
      { id: 'n9', type: 'approval', label: 'Risk & Compliance Sign-off', role: 'risk_officer', sla_hours: 48, description: 'Risk Officer: concentration risk check (green portfolio exposure limit), IFRS9 Stage 1 classification, regulatory capital calculation (risk weight 75% residential mortgage), secondary AML/CFT review, CBO reporting flags.' },
      { id: 'n10', type: 'approval', label: 'PM Final Approval & Offer Letter', role: 'product_manager', sla_hours: 24, description: 'Product Manager: confirms all product terms match approved configuration, green discount applied correctly per GSAS score, offer letter generated from template, CBO disclosure checklist completed, signed digitally via DocuSign.' },
      { id: 'n11', type: 'end', label: 'Decision & Letter of Offer Issued', role: null, description: 'Approved: Letter of Offer sent via SMS + email + in-app. SLA: customer 7 working days. Rejected: reason code + remediation guidance. Customer has 30 days to accept offer.' },
    ]
    return {
      message: `✅ <strong>Stage 4 complete.</strong> 10-step approval workflow configured and visible in the Workflow tab.<br><br>` +
        `<strong>Automated steps (1–6):</strong> eKYC/AML → Credit Bureau → OCR/Validation → GSAS Registry (GORD) → Property Valuation → Title Check<br>` +
        `<strong>Human review steps (7–10):</strong> Credit Underwriting (24h) → Green Finance ESG Review (24h) → Risk & Compliance (48h) → PM Final Approval (24h)<br><br>` +
        `⏱️ Total SLA: <strong>~5 working days</strong> (automated: <19h, human: ~4 days)<br>` +
        `🔗 External integrations: NCI eKYC · Oman Credit Bureau · GORD GSAS API · Al Mashora/JLL · Muscat Municipality<br><br>` +
        `<strong>Ready for Stage 5 — Compliance Classification?</strong> I'll apply Basel III capital rules, IFRS 9 provisioning, and CBO green finance tagging. Shall I proceed?`,
      current_stage: 5, show_roadmap: false, action: 'none',
      ui_events: [
        { type: 'set_tab', tab: 'workflow' },
        { type: 'set_workflow', nodes: wfNodes },
      ],
      product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 4 complete → ask Stage 5 compliance question ───────────────────
  if (hasAskedStage4Complete && !hasAskedStage5) {
    return {
      message: `<strong>Stage 5 — Compliance Classification</strong><br><br>` +
        `For regulatory reporting, I recommend classifying this product as follows:<br>` +
        `&bull; <strong>Basel III risk weight</strong>: 75% (residential retail mortgage, LTV ≤90% per CBO BM/REG/2019/74 Schedule 3)<br>` +
        `&bull; <strong>IFRS 9 provisioning</strong>: 1.5% Stage 1 ECL (higher than standard 1.0% due to green portfolio concentration, per IFRS 9 §5.5)<br>` +
        `&bull; <strong>CBO classification</strong>: Green Finance (reportable under Circular 2026-12 §7 monthly ESG portfolio return)<br>` +
        `&bull; <strong>AML risk tier</strong>: LOW (eKYC + OCB auto-verified; green property reduces beneficial ownership complexity)<br>` +
        `&bull; <strong>Regulatory tags</strong>: #CLIMATE_RISK · #ESG_ELIGIBILITY · #GREEN_FINANCING · #OMAN_VISION_2040<br><br>` +
        `<strong>Shall I apply these compliance parameters, or do you want to adjust the risk weight or provisioning rate?</strong>`,
      current_stage: 5, show_roadmap: false, action: 'none',
      ui_events: [{ type: 'set_tab', tab: 'compliance' }],
      product_draft: null, rules_draft: null, schema_draft: null,
    }
  }

  // ── STAGE 5 answered — Stage 6: Simulation + ready to confirm ────────────
  if (hasAskedStage5 && !hasAskedConfirm) {
    // ── Derive actual values from conversation context ──────────────────────
    // Product name: look for a confirmed custom name in user messages or assistant confirmation
    const userMsgs = history.filter((m: any) => m.role === 'user').map((m: any) => (m.content || '').toLowerCase())
    const fullConvText = [...assistantMsgs, ...userMsgs].join(' ')

    // Extract product name from conversation — priority order:
    // 1. "Stage 1 complete — [Name]" assistant message (most reliable: GPT confirms the exact name)
    // 2. "How about [Name]?" suggestion confirmed by user "yes"
    // 3. Any assistant message quoting a product name after user approval
    // 4. Fall back to default
    let derivedName = 'Sohar Green Home Finance – GSAS'

    // Strategy 1: look for Stage 1 complete message with confirmed name
    const stage1CompleteMsg = assistantMsgs.find(m => /stage\s+1\s+complete/i.test(m))
    if (stage1CompleteMsg) {
      // "Stage 1 complete — EcoElite Home Finance, conventional..."
      const cm = stage1CompleteMsg.match(/stage\s+1\s+complete[\u2014\u2013\-\.\s]+([A-Z][^,\n]{3,59}),/i)
        || stage1CompleteMsg.match(/"([^"]{4,60})"/)
      if (cm) {
        const candidate = cm[1].trim().replace(/[.!]$/, '')
        if (/[A-Z]/.test(candidate) && candidate.split(' ').length <= 8) derivedName = candidate
      }
    }

    // Strategy 2: look for "How about [Name]?" suggestion that was accepted
    // GPT says: "How about \"EcoElite Home Finance\"?" and user says "yes"
    if (derivedName === 'Sohar Green Home Finance – GSAS') {
      const suggestionMsg = assistantMsgs.find(m =>
        /how about/i.test(m) && (/[""""]/.test(m) || m.includes('"'))
      )
      if (suggestionMsg) {
        const sm = suggestionMsg.match(/[""""']([A-Z][^""""\n]{3,59})[""""']/)
          || suggestionMsg.match(/"([^"]{4,60})"/)
        if (sm) {
          const candidate = sm[1].trim().replace(/[.!]$/, '')
          if (/[A-Z]/.test(candidate) && candidate.split(' ').length <= 8) derivedName = candidate
        }
      }
    }

    // Strategy 3: look for assistant quoting a name after confirmation
    if (derivedName === 'Sohar Green Home Finance – GSAS') {
      const confirmMsg = assistantMsgs.find(m =>
        (m.includes('confirmed') || m.includes('name works') || m.includes('name is set')) &&
        /[""""]/.test(m)
      )
      if (confirmMsg) {
        const qm = confirmMsg.match(/[""""']([A-Z][^""""\n]{3,59})[""""']/)
        if (qm) {
          const candidate = qm[1].trim().replace(/[.!]$/, '')
          if (/[A-Z]/.test(candidate) && candidate.split(' ').length <= 8) derivedName = candidate
        }
      }
    }

    // Extract max_amount: scan user messages for explicit "lower/change/set to X" instructions
    // then fall back to the last confirmed value in assistant messages.
    // Priority: user override (e.g. "lower to 500,000") > assistant confirmed value > default.
    const maxAmountFromCtx = (() => {
      // Check user messages for explicit amount adjustments (latest wins)
      const userAmountMsgs = history.filter((m: any) => m.role === 'user')
        .map((m: any) => (m.content || '').toLowerCase())
      for (let i = userAmountMsgs.length - 1; i >= 0; i--) {
        const um = userAmountMsgs[i]
        const m = um.match(/(?:lower|change|set|reduce|make).*?(\d[\d,]+)\s*omr/)
          || um.match(/omr\s*(\d[\d,]+)\s*(?:max|maximum|limit)/)
          || um.match(/(?:maximum|max)\s*(?:loan|amount)?\s*(?:to|is|of)?\s*(?:omr)?\s*(\d[\d,]+)/i)
        if (m) { const v = parseInt(m[1].replace(/,/g,'')); if (v >= 50000 && v <= 5000000) return v }
      }
      // Check assistant confirmation messages for the last confirmed amount
      for (let i = assistantMsgs.length - 1; i >= 0; i--) {
        const am = assistantMsgs[i]
        const m = am.match(/(?:omr\s*[\d,]+\s*[\u2013\u2014\-]{1,2}\s*omr\s*)([\d,]+)/i)
          || am.match(/(?:amount(?:\s+range)?[:\s]+omr\s*[\d,]+\s*[\u2013\-]\s*)([\d,]+)/i)
          || am.match(/(?:up to|maximum|max)\s*omr\s*([\d,]+)/i)
        if (m) { const v = parseInt(m[1].replace(/,/g,'')); if (v >= 50000 && v <= 5000000) return v }
      }
      // Final fallback: scan full context for any 500k or 1M mention
      if (fullConvText.includes('500,000') || fullConvText.match(/\b500k\b/)) return 500000
      if (fullConvText.includes('1,000,000') || fullConvText.match(/\b1m\b/)) return 1000000
      return 500000
    })()

    // Extract min_amount similarly
    const minAmountFromCtx = (() => {
      for (let i = assistantMsgs.length - 1; i >= 0; i--) {
        const am = assistantMsgs[i]
        const m = am.match(/omr\s*([\d,]+)\s*(?:to|-)\s*omr\s*[\d,]+/i)
          || am.match(/(?:minimum|min)\s+(?:loan\s+)?(?:amount\s+)?(?:of\s+)?omr\s*([\d,]+)/i)
        if (m) { const v = parseInt(m[1].replace(/,/g,'')); if (v >= 5000 && v <= 200000) return v }
      }
      return 25000
    })()

    // Extract GSAS min from stage 3 context
    const gsasMin = (() => {
      const s3msg = assistantMsgs.find(m => m.includes('gsas ≥') || m.includes('gsas minimum') || m.includes('gsas score ≥'))
      if (s3msg) {
        const gm = s3msg.match(/gsas[^0-9]*([0-9]{2})/i)
        if (gm) { const v = parseInt(gm[1]); if (v >= 65 && v <= 90) return v }
      }
      if (fullConvText.includes('75')) return 75
      return 70
    })()

    // Extract base rate
    const baseRateFromCtx = (() => {
      const rm = fullConvText.match(/base rate[^0-9]*([0-9]+\.[0-9]+)%/)
      if (rm) return parseFloat(rm[1])
      if (fullConvText.includes('5.25')) return 5.25
      return 5.25
    })()

    // Extract discount tiers from conversation — user may have approved non-default values
    const discountPremiumFromCtx = (() => {
      // Look for confirmed discount tier messages (latest assistant confirmation wins)
      for (let i = assistantMsgs.length - 1; i >= 0; i--) {
        const am = assistantMsgs[i]
        // "0.5% for GSAS ≥85 (Gold)" — first percentage mentioned alongside Gold/≥85
        const m = am.match(/(\d+\.\d+)%[^.]*(?:gsas[^.]*[≥>=]\s*85|gold|premium)/i)
          || am.match(/(?:gold|premium|gsas[^.]*[≥>=]\s*85)[^.]*?(\d+\.\d+)%/i)
        if (m) { const v = parseFloat(m[1]); if (v >= 0.1 && v <= 2.0) return v }
      }
      return 0.75
    })()
    const discountStandardFromCtx = (() => {
      for (let i = assistantMsgs.length - 1; i >= 0; i--) {
        const am = assistantMsgs[i]
        // "0.25% for GSAS 70–84 (Silver)" — percentage alongside Silver/70-84
        const m = am.match(/(\d+\.\d+)%[^.]*(?:silver|70[^0-9]|score\s+70)/i)
          || am.match(/(?:silver|70[–\-]84)[^.]*?(\d+\.\d+)%/i)
        if (m) { const v = parseFloat(m[1]); if (v >= 0.1 && v <= 2.0) return v }
      }
      return 0.5
    })()

    // Extract min_term from conversation (user may have set 5yr minimum, not 3)
    const minTermFromCtx = (() => {
      for (let i = assistantMsgs.length - 1; i >= 0; i--) {
        const am = assistantMsgs[i]
        const m = am.match(/(?:term\s+range[^0-9]*|from\s+)(\d{1,2})\s*(?:to|–|-)\s*\d{1,2}\s*years?/i)
          || am.match(/(?:minimum\s+(?:term|of)\s*)(\d{1,2})\s*years?/i)
        if (m) { const v = parseInt(m[1]); if (v >= 1 && v <= 15) return v }
      }
      return 3
    })()

    // Customer segment detection — drives simulation math
    const isHNW = fullConvText.includes('hnw') || fullConvText.includes('high net worth') || fullConvText.match(/omr\s*5[k,\s]|5,000\+|income.*5000/i) != null
    const isAffluent = !isHNW && (fullConvText.includes('affluent') || fullConvText.match(/omr\s*2[k,\s]|2,000/i) != null)

    // Derive structure — check USER messages only (not assistant, which lists Islamic as an option)
    // The Stage 1b assistant message contains 'Islamic', 'Murabaha', 'Musharaka' as examples,
    // so checking fullConvText gives false positives for Conventional products.
    const userMsgText = userMsgs.join(' ')
    const isIslamic = userMsgText.includes('islamic') || userMsgText.includes('murabaha') || userMsgText.includes('musharaka')
    const structureLabel = isIslamic ? 'Islamic (Diminishing Musharaka)' : 'Conventional'

    const productDraft = {
      name: derivedName,
      description: `${structureLabel} home financing for GSAS-certified green properties in Oman. Earn up to ${discountPremiumFromCtx}% rate discount based on sustainability score (GSAS ≥85: Gold tier, ${discountStandardFromCtx}% for GSAS 70–84: Silver). Targets ${isHNW ? 'HNW' : isAffluent ? 'affluent' : 'retail'} customers. Supports Oman Vision 2040, CBO green finance objectives, and OS GSO 3000:2025.`,
      category: 'home_loan',
      base_rate: baseRateFromCtx,
      max_ltv: 90,
      max_dbr: 55,
      green_dbr: 55,
      min_term: minTermFromCtx, max_term: 25,
      min_amount: minAmountFromCtx, max_amount: maxAmountFromCtx,
      gsas_min_score: gsasMin,
      gsas_premium_score: 85,
      green_discount_premium: discountPremiumFromCtx,
      green_discount_standard: discountStandardFromCtx,
      esg_required_docs: ['gsas_cert', 'epc_report', 'eia_approval'],
      approved_materials: ['Green Concrete (GSAS-rated)', 'Low-E Double Glazing', 'Thermal Insulation (R-value ≥ 2.5)', 'Solar PV Panels (SASO-certified)', 'LED Lighting Systems', 'High-Efficiency HVAC (EER ≥ 3.5)', 'Recycled Steel Reinforcement', 'Rainwater Harvesting System'],
      approved_vendors: ['Oman Readymix LLC', 'Gulf Insulation Group', 'SunTech Oman', 'Green Build Oman', 'EcoMaterials Oman', 'HVAC Oman LLC', 'Voltec Solar Oman'],
      clone_from_id: 'p001',
    }
    const rulesDraft = [
      { name: 'DBR ≤ 55% (Loans > OMR 100K)', category: 'creditworthiness', metric: 'DBR', operator: '<=', threshold_value: 55, threshold_condition: 'loan_amount > 100000', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular 2026-12, §3.2', ai_confidence: 96, description: 'Max DBR 55% for green loans >OMR 100K.' },
      { name: 'DBR ≤ 60% (Loans ≤ OMR 100K)', category: 'creditworthiness', metric: 'DBR', operator: '<=', threshold_value: 60, threshold_condition: 'loan_amount <= 100000', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular BM/REG/2019/74, §4', ai_confidence: 95, description: 'Standard DBR cap for smaller amounts.' },
      { name: 'Credit Score ≥ 620', category: 'creditworthiness', metric: 'credit_score', operator: '>=', threshold_value: 620, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Credit Bureau Framework, §6.1', ai_confidence: 94, description: 'Minimum Oman Credit Bureau score.' },
      { name: 'No Defaults (24 Months)', category: 'creditworthiness', metric: 'default_history_months', operator: '>=', threshold_value: 24, threshold_condition: 'default_count = 0', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Loan Classification Circular, §3', ai_confidence: 97, description: 'No defaults or restructured loans in 24 months.' },
      { name: 'LTV ≤ 90% (First Home)', category: 'collateral', metric: 'LTV', operator: '<=', threshold_value: 90, threshold_condition: 'is_first_home = true', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular BM/REG/2019/74, §7.1', ai_confidence: 98, description: 'First home LTV cap.' },
      { name: 'LTV ≤ 80% (Subsequent/Expat)', category: 'collateral', metric: 'LTV', operator: '<=', threshold_value: 80, threshold_condition: 'is_first_home = false OR nationality = expat', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular BM/REG/2019/74, §7.2', ai_confidence: 97, description: 'Non-first home and expat LTV cap.' },
      { name: `GSAS Score ≥ ${gsasMin}`, category: 'esg', metric: 'gsas_score', operator: '>=', threshold_value: gsasMin, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'OS GSO 3000:2025, §4.2', ai_confidence: 98, description: `GSAS minimum ${gsasMin}.` },
      { name: 'EPC Rating ≥ C', category: 'esg', metric: 'epc_rating', operator: '>=', threshold_value: 3, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'OEESC, §5.1', ai_confidence: 94, description: 'Minimum EPC rating C.' },
      { name: 'GSAS Certificate Valid ≥ 90 Days', category: 'esg', metric: 'gsas_cert_days_remaining', operator: '>=', threshold_value: 90, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'OS GSO 3000:2025, §6.3', ai_confidence: 96, description: 'GSAS cert must not expire within 90 days.' },
      { name: 'ESG Document Set Complete', category: 'esg', metric: 'esg_docs_complete', operator: '=', threshold_value: 1, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular 2026-12, §5.1', ai_confidence: 97, description: 'GSAS cert + EPC report + EIA approval (where applicable).' },
      { name: 'Net Income ≥ OMR 800/Month', category: 'eligibility', metric: 'net_monthly_income', operator: '>=', threshold_value: 800, threshold_condition: null, action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'Sohar Internal Credit Policy §12.1', ai_confidence: 92, description: 'Minimum net monthly income.' },
      { name: 'Expat Residency ≥ 12 Months', category: 'eligibility', metric: 'residency_days_remaining', operator: '>=', threshold_value: 365, threshold_condition: 'nationality = expat', action_on_breach: 'reject', severity: 'hard', regulatory_reference: 'CBO Circular on Expat Credit, §3', ai_confidence: 95, description: '≥12 months remaining on residency permit.' },
    ]
    const schemaDraft = {
      schema_type: 'gsas_certificate_validation',
      fields: [
        { name: 'Certificate Number', type: 'String', validation: '^GSAS-\\d{4}-\\d{3,5}$', error_message: 'Invalid GSAS certificate number format (expected: GSAS-YYYY-NNN)' },
        { name: 'Issuer', type: 'String', validation: 'Must be "GORD" or GORD-accredited body', error_message: 'Issuer not GORD-accredited' },
        { name: 'Issue Date', type: 'Date', validation: 'Must be ≤ today', error_message: 'Certificate issue date is in the future' },
        { name: 'Expiry Date', type: 'Date', validation: 'Must be ≥ today + 90 days', error_message: 'Certificate expires within 90 days — not acceptable' },
        { name: 'Overall Score', type: 'Integer', validation: `0–100, minimum ${gsasMin} for eligibility`, error_message: `Score below minimum threshold (${gsasMin})` },
        { name: 'Rating', type: 'String', validation: 'Silver / Gold / Platinum only (Bronze rejected)', error_message: 'Bronze rating does not meet minimum requirement' },
        { name: 'Property Address', type: 'String', validation: 'Must match application property address (fuzzy match ≥85%)', error_message: 'Certificate property address does not match application' },
        { name: 'EPC Rating', type: 'String', validation: 'A / B / C minimum (D/E/F/G rejected)', error_message: 'EPC rating below minimum required (C)' },
      ],
      ai_confidence: 96, regulatory_reference: 'OS GSO 3000:2025, §4.2 · OEESC §5.1',
    }
    // ── Portfolio simulation math — segment-aware ────────────────────────────
    // HNW: avg property OMR 400K, avg loan OMR 300K (75% LTV on 400K), conversion 8%
    // Affluent: avg property OMR 200K, avg loan OMR 150K, conversion 12%
    // Mass: avg property OMR 120K, avg loan OMR 90K, conversion 18%
    const avgLoanAmt   = isHNW ? 280000 : isAffluent ? 150000 : 90000
    const avgPropVal   = isHNW ? 380000 : isAffluent ? 200000 : 120000
    const conversionPct = isHNW ? 8 : isAffluent ? 12 : 18
    // Total green-eligible pipeline: 13,251 applications YTD × est. 6% green-certified properties
    const greenPipeline = Math.round(13251 * 0.06)
    const yr1Accounts  = Math.round(greenPipeline * (conversionPct / 100))
    const yr1Portfolio = Math.round(yr1Accounts * avgLoanAmt / 1e6 * 10) / 10  // OMR M, 1dp
    const effectiveRate = baseRateFromCtx - discountPremiumFromCtx  // best-tier effective rate
    const nim = Math.round((baseRateFromCtx - 3.5) * 100) / 100  // rough NIM vs 3.5% CoF
    const provisionSaving = 0.4  // green ECL saves vs standard
    const breakEvenMonth  = isHNW ? 9 : isAffluent ? 11 : 14  // HNW = higher avg, faster BEP
    const setupCost       = 85  // OMR K

    // Effective rate tiers for display
    const rateGold   = (baseRateFromCtx - discountPremiumFromCtx).toFixed(2)
    const rateSilver = (baseRateFromCtx - discountStandardFromCtx).toFixed(2)
    const segmentLabel = isHNW ? 'HNW (OMR 5K+ income)' : isAffluent ? 'Affluent (OMR 2K–5K)' : 'Mass market'

    return {
      message: `✅ <strong>Stage 5 complete.</strong> Compliance classification applied — Basel III 75% risk weight, IFRS9 1.5% Stage 1 ECL, CBO Green Finance designation.<br><br>` +
        `<strong>Stage 6 — Portfolio Simulation</strong><br><br>` +
        `📊 <strong>12-month portfolio projections</strong> — <em>${segmentLabel} segment · avg loan OMR ${avgLoanAmt.toLocaleString()}</em><br>` +
        `&bull; <strong>Pipeline:</strong> ~${greenPipeline} green-eligible applicants from current 13,251 YTD pipeline (est. 6% hold GSAS-certified properties)<br>` +
        `&bull; <strong>Target:</strong> <strong>${yr1Accounts} accounts · OMR ${yr1Portfolio}M</strong> in Year 1 at ${conversionPct}% pipeline conversion (${isHNW ? 'conservative — HNW segment has longer decision cycle' : 'moderate — verified against regional green mortgage benchmarks'})<br>` +
        `&bull; <strong>NIM:</strong> ~${nim.toFixed(2)}% on green book (3.5% estimated cost of funds) — partially offset by ${provisionSaving}% lower provisioning (green ECL) + CBO capital relief ~8 bps<br>` +
        `&bull; <strong>Effective rates:</strong> ${baseRateFromCtx}% base → ${rateGold}% (GSAS ≥85 Gold) · ${rateSilver}% (GSAS 70–84 Silver)<br>` +
        `&bull; <strong>Stress test:</strong> +200 bps rate shock — 98% of modelled HNW portfolio passes DBR ≤55% (avg. DBR ${isHNW ? '38' : '44'}% at origination provides buffer)<br>` +
        `&bull; <strong>Break-even:</strong> month ${breakEvenMonth} post-launch (setup: OMR ${setupCost}K — GORD API integration + Green Finance Officer role)<br>` +
        `&bull; <strong>ESG reporting:</strong> monthly CBO Green Finance Return (Circular 2026-12 §7) + annual TCFD disclosure<br><br>` +
        `📋 <strong>Full product configuration summary:</strong><br>` +
        `• <strong>${derivedName}</strong> · ${structureLabel} · Cloned from Standard Home Loan · Segment: ${segmentLabel}<br>` +
        `• Rate: <strong>${baseRateFromCtx}%</strong> · Discount tiers: −${discountPremiumFromCtx}% (GSAS ≥85) → <strong>${rateGold}%</strong> · −${discountStandardFromCtx}% (GSAS 70–84) → <strong>${rateSilver}%</strong><br>` +
        `• LTV: <strong>90%</strong> (first home) · <strong>80%</strong> (subsequent/expat) · DBR: <strong>55%</strong> (CBO green allowance)<br>` +
        `• Terms: <strong>${minTermFromCtx}–25 years</strong> · Amount: <strong>OMR ${minAmountFromCtx.toLocaleString()}–${maxAmountFromCtx.toLocaleString()}</strong> · Avg property value: OMR ${avgPropVal.toLocaleString()}<br>` +
        `• Eligibility: <strong>17 rules</strong> across credit, collateral, ESG, income<br>` +
        `• Workflow: <strong>10-step</strong> (5 auto + 5 human) · SLA: 5 working days<br>` +
        `• Compliance: Basel III 75% · IFRS9 1.5% · CBO Green Finance · #CLIMATE_RISK · #ESG_ELIGIBILITY · #OMAN_VISION_2040<br><br>` +
        `🚀 Everything is configured. Click <strong>Confirm &amp; Publish</strong> to save the full product and make it live on the customer portal.`,
      current_stage: 6, show_roadmap: false, action: 'ready_to_confirm',
      ui_events: [
        { type: 'set_tab', tab: 'ai_config' },
        // set_field events to seed draft card at Stage 6 — the frontend set_field handler
        // guards protected fields (name/rate/etc.) that were already confirmed in Stages 1–5,
        // so these only fill in any gaps that per-turn extraction missed.
        { type: 'set_field', field: 'name', value: derivedName },
        { type: 'set_field', field: 'base_rate', value: baseRateFromCtx },
        { type: 'set_field', field: 'max_ltv', value: 90 },
        { type: 'set_field', field: 'max_dbr', value: 55 },
        { type: 'set_field', field: 'min_term', value: minTermFromCtx },
        { type: 'set_field', field: 'max_term', value: 25 },
        { type: 'set_field', field: 'min_amount', value: minAmountFromCtx },
        { type: 'set_field', field: 'max_amount', value: maxAmountFromCtx },
        { type: 'set_field', field: 'gsas_min_score', value: gsasMin },
        { type: 'set_field', field: 'green_discount_premium', value: discountPremiumFromCtx },
        { type: 'set_field', field: 'green_discount_standard', value: discountStandardFromCtx },
      ],
      // rules_draft intentionally null here — Stage 3 already saved the full 17-rule set
      // to the thread result. Returning rules_draft here would overwrite with this 12-rule
      // subset. Confirm endpoint loads rules from thread result (Stage 3 saved version).
      product_draft: productDraft, rules_draft: null, schema_draft: schemaDraft,
    }
  }

  // ── Already at stage 6 ───────────────────────────────────────────────────
  return {
    message: `All 6 stages are complete. Click <strong>Confirm & Publish</strong> above to save the product, or ask me any follow-up questions about the configuration.`,
    current_stage: 6, show_roadmap: false, action: 'ready_to_confirm',
    ui_events: [], product_draft: null, rules_draft: null, schema_draft: null,
  }
}

export { app as aiApi }
