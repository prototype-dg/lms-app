import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'

const app = new Hono<{ Bindings: NodeBindings }>()

// Stage names map (EN + AR)
const STAGE_NAMES: Record<number, { en: string; ar: string }> = {
  1: { en: 'Product Model',       ar: 'نموذج المنتج' },
  2: { en: 'Core Configuration',  ar: 'الإعداد الأساسي' },
  3: { en: 'Rule Builder',        ar: 'منشئ القواعد' },
  4: { en: 'Workflow',            ar: 'سير العمل' },
  5: { en: 'Compliance Mapping',  ar: 'رسم الامتثال' },
  6: { en: 'Simulation',          ar: 'المحاكاة' },
}

// ── List versions for a product ───────────────────────────────────────────────
app.get('/products/:productId/versions', async (c) => {
  const productId = c.req.param('productId')
  const { results } = await c.env.DB.prepare(`
    SELECT id, product_id, version_number, stage, stage_name,
           commit_message, created_by, created_by_name, created_by_role, created_at
    FROM product_versions
    WHERE product_id = ?
    ORDER BY version_number DESC
  `).bind(productId).all()
  return c.json({ versions: results, total: results.length })
})

// ── Get single version (with full snapshot) ───────────────────────────────────
app.get('/products/:productId/versions/:versionId', async (c) => {
  const { productId, versionId } = c.req.param()
  const version = await c.env.DB.prepare(`
    SELECT * FROM product_versions WHERE id = ? AND product_id = ?
  `).bind(versionId, productId).first()
  if (!version) return c.json({ error: 'Version not found' }, 404)
  return c.json({ version })
})

// ── Create a snapshot (called on stage transition) ────────────────────────────
app.post('/products/:productId/versions/snapshot', async (c) => {
  const productId = c.req.param('productId')
  const body = await c.req.json() as any
  const { stage, user_id, user_name, user_role } = body

  if (!stage || !user_id) return c.json({ error: 'stage and user_id are required' }, 400)

  // Load full product record for snapshot
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first() as any
  if (!product) return c.json({ error: 'Product not found' }, 404)

  // Load associated rules
  const { results: rules } = await c.env.DB.prepare(
    'SELECT * FROM rules WHERE product_id = ?'
  ).bind(productId).all()

  // Load associated rule matrices
  const { results: matrices } = await c.env.DB.prepare(
    'SELECT * FROM rule_matrices WHERE product_id = ?'
  ).bind(productId).all()

  // Get current highest version number
  const latest = await c.env.DB.prepare(
    'SELECT MAX(version_number) as max_v FROM product_versions WHERE product_id = ?'
  ).bind(productId).first() as any
  const versionNumber = (latest?.max_v || 0) + 1

  const stageInfo = STAGE_NAMES[stage] || { en: `Stage ${stage}`, ar: `المرحلة ${stage}` }

  // Build full snapshot
  const snapshot = {
    product,
    rules,
    matrices,
    snapshotAt: now(),
    stageCompleted: stage,
    stageName: stageInfo.en
  }

  // Generate AI commit message
  let commitMessage = `Completed ${stageInfo.en}`
  const apiKey = c.env.OPENAI_API_KEY

  if (apiKey) {
    try {
      // Get previous version for diff context
      const prevVersion = await c.env.DB.prepare(`
        SELECT snapshot FROM product_versions
        WHERE product_id = ? ORDER BY version_number DESC LIMIT 1
      `).bind(productId).first() as any

      let prevProduct: any = {}
      if (prevVersion?.snapshot) {
        try { prevProduct = JSON.parse(prevVersion.snapshot).product || {} } catch {}
      }

      const changedFields: string[] = []
      const trackFields = ['name','description','base_rate','max_ltv','max_dbr','green_dbr',
        'min_term','max_term','min_amount','max_amount','gsas_min_score','gsas_premium_score',
        'green_discount_standard','green_discount_premium','status','schema']
      for (const f of trackFields) {
        if (product[f] !== prevProduct[f] && product[f] !== undefined) {
          changedFields.push(`${f}: ${prevProduct[f] ?? 'unset'} → ${product[f]}`)
        }
      }

      const prompt = `You are writing a git commit message for a banking product configuration change.
Product: "${product.name}" (${product.category})
Stage completed: ${stageInfo.en}
Changed fields: ${changedFields.length > 0 ? changedFields.join(', ') : 'configuration refinements'}
Rules count: ${rules.length}
Matrices count: ${matrices.length}

Write a concise, professional 1-sentence commit message (max 80 chars) describing what was accomplished in this stage. 
Start with a verb (e.g. "Defined", "Configured", "Added", "Mapped", "Completed").
Output ONLY the commit message text, no quotes, no markdown.`

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 60
        })
      })
      const data = await res.json() as any
      const msg = data.choices?.[0]?.message?.content?.trim()
      if (msg) commitMessage = msg
    } catch {
      // Fallback to default message — non-blocking
    }
  }

  const versionId = generateId('pv')
  const ts = now()

  await c.env.DB.prepare(`
    INSERT INTO product_versions (
      id, product_id, version_number, stage, stage_name,
      snapshot, commit_message, created_by, created_by_name, created_by_role, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    versionId, productId, versionNumber, stage, stageInfo.en,
    JSON.stringify(snapshot),
    commitMessage,
    user_id, user_name || user_id, user_role || 'product_manager',
    ts
  ).run()

  // Update pge_stage on the product if this stage is higher than current
  await c.env.DB.prepare(`
    UPDATE products SET pge_stage = MAX(COALESCE(pge_stage, 0), ?), updated_at = ?
    WHERE id = ?
  `).bind(stage, ts, productId).run()

  await logAudit(c.env.DB, {
    userId: user_id,
    userName: user_name || user_id,
    userRole: user_role || 'product_manager',
    action: 'PRODUCT_VERSION_SNAPSHOT',
    entityType: 'product',
    entityId: productId,
    details: { version: versionNumber, stage, stage_name: stageInfo.en, commit_message: commitMessage }
  })

  return c.json({
    id: versionId,
    version_number: versionNumber,
    commit_message: commitMessage,
    success: true
  })
})

// ── Revert to a specific version ──────────────────────────────────────────────
app.post('/products/:productId/versions/:versionId/revert', async (c) => {
  const { productId, versionId } = c.req.param()
  const body = await c.req.json() as any

  const version = await c.env.DB.prepare(
    'SELECT * FROM product_versions WHERE id = ? AND product_id = ?'
  ).bind(versionId, productId).first() as any
  if (!version) return c.json({ error: 'Version not found' }, 404)

  let snapshot: any = {}
  try { snapshot = JSON.parse(version.snapshot) } catch {
    return c.json({ error: 'Invalid snapshot data' }, 500)
  }

  const p = snapshot.product || {}
  const ts = now()

  // Restore flat product fields (preserve id, created_at, market_id)
  await c.env.DB.prepare(`
    UPDATE products SET
      name = ?, description = ?, base_rate = ?, max_ltv = ?, max_dbr = ?,
      green_dbr = ?, min_term = ?, max_term = ?, min_amount = ?, max_amount = ?,
      gsas_min_score = ?, gsas_premium_score = ?, green_discount_standard = ?,
      green_discount_premium = ?, ai_confidence_threshold = ?,
      required_docs = ?, esg_required_docs = ?, approved_materials = ?,
      approved_vendors = ?, configuration = ?, schema = ?,
      workflow_nodes = ?, workflow_edges = ?, workflow_template_id = ?,
      pge_stage = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    p.name, p.description, p.base_rate, p.max_ltv, p.max_dbr,
    p.green_dbr, p.min_term, p.max_term, p.min_amount, p.max_amount,
    p.gsas_min_score, p.gsas_premium_score, p.green_discount_standard,
    p.green_discount_premium, p.ai_confidence_threshold,
    p.required_docs, p.esg_required_docs, p.approved_materials,
    p.approved_vendors, p.configuration, p.schema || '{}',
    p.workflow_nodes || '[]', p.workflow_edges || '[]', p.workflow_template_id || null,
    version.stage, ts,
    productId
  ).run()

  // Snapshot current state before reverting (so revert is itself reversible)
  const currentVersionNumber = await c.env.DB.prepare(
    'SELECT MAX(version_number) as max_v FROM product_versions WHERE product_id = ?'
  ).bind(productId).first() as any

  await c.env.DB.prepare(`
    INSERT INTO product_versions (
      id, product_id, version_number, stage, stage_name,
      snapshot, commit_message, created_by, created_by_name, created_by_role, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    generateId('pv'), productId,
    (currentVersionNumber?.max_v || 0) + 1,
    version.stage, version.stage_name,
    JSON.stringify(snapshot),
    `Reverted to v${version.version_number}: "${version.commit_message}"`,
    body.user_id || 'u001', body.user_name || 'System',
    body.user_role || 'product_manager', ts
  ).run()

  await logAudit(c.env.DB, {
    userId: body.user_id || 'u001',
    userName: body.user_name || 'System',
    userRole: body.user_role || 'product_manager',
    action: 'PRODUCT_VERSION_REVERTED',
    entityType: 'product',
    entityId: productId,
    details: { reverted_to_version: version.version_number, commit: version.commit_message }
  })

  return c.json({ success: true, reverted_to_version: version.version_number })
})

export { app as productVersionsApi }
