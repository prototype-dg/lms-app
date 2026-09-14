-- ============================================================
-- Migration 0014: Data-repair for AI Studio products stuck at pge_stage=1
-- ============================================================
-- Root cause: stage-update API Stage 3 block was guarded by `if (rules.length > 0)`.
-- When GPT omitted rules from stage_update_hint.rules the block was skipped entirely
-- and pge_stage was never advanced.  The block is now fixed to also advance pge_stage
-- when rules=[] (it copies global NULL-product_id rules instead).
--
-- This migration repairs existing products that went through the broken path:
--   1. Advance pge_stage to at least 3 for confirmed (active) AI demo products
--      whose rules exist in the rules table with product_id attached.
--   2. Advance pge_stage to 6 for confirmed active products that have rules
--      AND workflow_nodes AND a compliance/simulation config — meaning all
--      stages completed but pge_stage was never updated.
--   3. Attach global NULL-product_id rules to AI products that have none yet.
-- ============================================================

-- ── 1. Promote pge_stage for active AI-created products that already have rules ──
UPDATE products
SET    pge_stage  = 6,
       market_id  = COALESCE(market_id, 'mkt001'),
       updated_at = datetime('now')
WHERE  status        = 'active'
  AND  is_demo_product = 1
  AND  pge_stage    < 6
  AND  (
         -- Has product-specific rules
         (SELECT COUNT(*) FROM rules WHERE product_id = products.id AND is_active = 1) > 0
         -- OR had a full 6-stage AI session (configuration has simulation key)
         OR (configuration IS NOT NULL AND configuration LIKE '%"simulation"%')
       );

-- ── 2. For active AI products still at pge_stage=1 with NO product rules ─────
--    Attach any global (NULL) AI rules so PGE Stage 3 shows them.
--    We create copies with the correct product_id.
-- This uses a temporary approach: for each active AI product at pge_stage<3
-- with no product-specific rules, copy global AI rules to it.
INSERT OR IGNORE INTO rules (
  id, product_id, name, category, metric, operator,
  threshold_value, threshold_condition, action_on_breach, severity,
  regulatory_reference, source, ai_confidence, description, is_active, created_by, created_at
)
SELECT
  -- Generate new ID by appending product prefix to original id
  substr(p.id, 1, 8) || '_' || r.id,
  p.id,
  r.name, r.category, r.metric, r.operator,
  r.threshold_value, r.threshold_condition, r.action_on_breach, r.severity,
  r.regulatory_reference, r.source, r.ai_confidence, r.description, 1, r.created_by, r.created_at
FROM products p
CROSS JOIN rules r
WHERE p.status = 'active'
  AND p.is_demo_product = 1
  AND p.pge_stage < 3
  AND r.product_id IS NULL
  AND r.source = 'ai_generated'
  AND r.is_active = 1
  -- Only if the product has no rules yet
  AND NOT EXISTS (
    SELECT 1 FROM rules r2 WHERE r2.product_id = p.id AND r2.is_active = 1
  );

-- ── 3. Now promote those products to pge_stage=3 (or 6 if workflow exists) ───
UPDATE products
SET    pge_stage  = CASE
                     WHEN workflow_nodes IS NOT NULL AND workflow_nodes != '[]' AND workflow_nodes != '' THEN 6
                     ELSE 3
                   END,
       market_id  = COALESCE(market_id, 'mkt001'),
       updated_at = datetime('now')
WHERE  status        = 'active'
  AND  is_demo_product = 1
  AND  pge_stage    < 3
  AND  (SELECT COUNT(*) FROM rules WHERE product_id = products.id AND is_active = 1) > 0;
