-- ──────────────────────────────────────────────────────────────────────────────
-- Migration 0015: Source-agnostic repair for AI Studio products stuck at
--                 pge_stage < 3 (no rules, PGE opens empty).
--
-- ROOT CAUSE FIXED HERE:
--   Migration 0014 used AND source='ai_generated' in its INSERT filter, but all
--   14 global template rules have source='manual'.  The INSERT matched 0 rows →
--   products stayed at pge_stage=1 → PGE locked at Stage 1 after confirmation.
--
-- WHAT THIS MIGRATION DOES:
--   1. For every AI-created product that has no product-specific rules yet
--      (id NOT IN SELECT product_id FROM rules WHERE product_id IS NOT NULL),
--      copy all global rules (product_id IS NULL, is_active=1) giving each copy
--      a fresh unique id and the target product_id.
--   2. Advance pge_stage to 3 for products that are still at pge_stage < 3.
--   3. Set market_id to 'mkt001' where it is NULL (confirm endpoint omitted it).
--
-- SAFETY:
--   - No hardcoded product IDs — affects any product matching the predicate.
--   - INSERT OR IGNORE prevents duplicate rule rows on re-run.
--   - Only targets products with ai_draft=true in configuration OR created by
--     the AI Studio pipeline (is_demo_product=1 AND status IN ('draft','active')
--     AND pge_stage < 3 with no existing rules).
--   - Template products (p001–p008) are excluded because they already have
--     product-specific rules and pge_stage >= 6.
-- ──────────────────────────────────────────────────────────────────────────────

-- Step 1 ── Copy global rules to AI products that have zero product-specific rules.
-- We identify AI products by: configuration JSON containing 'ai_draft' key.
-- We exclude any product that already has at least one product-specific rule row.
-- Each copied rule gets a newly generated id (using the rule's rowid for uniqueness).
INSERT OR IGNORE INTO rules
  (id, product_id, name, category, metric, operator,
   threshold_value, threshold_condition, action_on_breach, severity,
   regulatory_reference, source, ai_confidence, description, is_active,
   created_by, created_at)
SELECT
  -- Deterministic id: 'r0015_' + target product id slug + '_' + source rule rowid
  -- This ensures idempotency: re-running produces the same ids and OR IGNORE skips them.
  'r0015_' || SUBSTR(p.id, 1, 12) || '_' || CAST(gr.rowid AS TEXT),
  p.id,          -- attach to the AI product
  gr.name, gr.category, gr.metric, gr.operator,
  gr.threshold_value, gr.threshold_condition,
  gr.action_on_breach, gr.severity,
  gr.regulatory_reference,
  'ai_generated',  -- mark as AI-generated so reset-demo cleanup logic applies
  gr.ai_confidence, gr.description, 1,
  COALESCE(gr.created_by, 'system'),
  datetime('now')
FROM
  products p,
  rules gr
WHERE
  -- Source rule must be global (no product assignment) and active
  gr.product_id IS NULL
  AND gr.is_active = 1
  -- Target: AI-created products identified by the 'ai_draft' marker in configuration
  AND (
    p.configuration LIKE '%"ai_draft":true%'
    OR p.configuration LIKE '%''ai_draft'':true%'
    OR p.configuration LIKE '%"ai_draft": true%'
  )
  -- Exclude products that already have at least one product-specific rule
  AND p.id NOT IN (
    SELECT DISTINCT product_id FROM rules
    WHERE product_id IS NOT NULL
  );

-- Step 2 ── Advance pge_stage to 3 for AI products still stuck below stage 3.
-- Only runs if they now have rules (either from Step 1 above or pre-existing).
-- Products at pge_stage=0 or pge_stage=1 with confirmed rules are updated.
UPDATE products
SET
  pge_stage = 3,
  updated_at = datetime('now')
WHERE
  pge_stage < 3
  AND (
    configuration LIKE '%"ai_draft":true%'
    OR configuration LIKE '%"ai_draft": true%'
  )
  AND id IN (
    SELECT DISTINCT product_id FROM rules
    WHERE product_id IS NOT NULL AND is_active = 1
  );

-- Step 3 ── Set market_id to 'mkt001' where it is NULL on AI products.
-- The confirm endpoint was missing COALESCE(market_id,'mkt001') — fix the data.
UPDATE products
SET
  market_id = 'mkt001',
  updated_at = datetime('now')
WHERE
  market_id IS NULL
  AND (
    configuration LIKE '%"ai_draft":true%'
    OR configuration LIKE '%"ai_draft": true%'
  );
