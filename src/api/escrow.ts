import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
import { generateId, now, logAudit } from '../lib/db'
const app = new Hono<{ Bindings: NodeBindings }>()


app.post('/:appId/complete-stage', async (c) => {
  const appId = c.req.param('appId')
  const body = await c.req.json()
  const { stage_id, invoice_filename, user_id = 'u011', user_name = 'Rashid Al-Hassani' } = body
  const ts = now()
  
  // Simulate invoice AI validation
  const invoiceValidation = {
    ocr_extracted: {
      material: 'Green Concrete – C30 Grade',
      total_amount: 'OMR 12,000',
      supplier: 'Oman Readymix LLC',
      invoice_date: '2026-08-28',
      invoice_number: 'INV-2026-08-4471'
    },
    validation_results: [
      { check: 'Material', value: 'Green Concrete – C30 Grade', status: 'pass', icon: '✅', detail: 'Approved material' },
      { check: 'Supplier', value: 'Oman Readymix LLC', status: 'pass', icon: '✅', detail: 'Pre-approved vendor' },
      { check: 'Amount', value: 'OMR 12,000', status: 'pass', icon: '✅', detail: 'Within expected range' },
      { check: 'Invoice Date', value: '2026-08-28', status: 'pass', icon: '✅', detail: 'Valid date' }
    ],
    overall_status: 'auto_verified',
    ai_confidence: 94,
    recommendation: 'Stage 1 completion verified. Green material confirmed. Payment initiation in progress.'
  }

  // Update stage status
  await c.env.DB.prepare(`
    UPDATE construction_stages SET status = 'completed', ai_validated = 1, ai_confidence = 94, completed_at = ? WHERE id = ?
  `).bind(ts, stage_id).run()

  await logAudit(c.env.DB, {
    userId: user_id, userName: user_name, userRole: 'contractor',
    action: 'STAGE_COMPLETED', entityType: 'construction_stage', entityId: stage_id,
    details: { invoice: invoice_filename, ai_confidence: 94, material_verified: 'Green Concrete' },
    source: 'ai_generated', aiConfidence: 94
  })
  
  return c.json({ success: true, invoice_validation: invoiceValidation })
})

app.post('/:appId/release-tranche', async (c) => {
  const appId = c.req.param('appId')
  const body = await c.req.json()
  const { stage_id, amount, user_id = 'u004', user_name = 'Khalid Al-Rawahi' } = body
  const ts = now()
  const txRef = `TRX-${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`
  
  await c.env.DB.prepare(`
    UPDATE construction_stages SET status = 'paid', payment_reference = ?, paid_at = ? WHERE id = ?
  `).bind(txRef, ts, stage_id).run()
  
  // Activate next stage
  const stage = await c.env.DB.prepare('SELECT * FROM construction_stages WHERE id = ?').bind(stage_id).first() as any
  if (stage) {
    await c.env.DB.prepare(`
      UPDATE construction_stages SET status = 'active' 
      WHERE application_id = ? AND stage_number = ? AND status = 'locked'
    `).bind(appId, stage.stage_number + 1).run()
  }
  
  await c.env.DB.prepare(`
    UPDATE applications SET escrow_released = escrow_released + ?, status = 'disbursed', updated_at = ? WHERE id = ?
  `).bind(amount, ts, appId).run()
  
  await logAudit(c.env.DB, {
    userId: user_id, userName: user_name, userRole: 'operations',
    action: 'ESCROW_TRANCHE_RELEASED', entityType: 'application', entityId: appId,
    details: { stage_id, amount, transaction_reference: txRef }
  })
  
  return c.json({ success: true, transaction_reference: txRef, amount_released: amount })
})

export { app as escrowApi }
