-- ============================================================
-- Migration 0013: is_green_product flag on products
-- ============================================================
-- Adds explicit green-product flag so AI-created green/ESG/GSAS
-- products are visually highlighted in the backoffice product
-- grid even when esg_required_docs is not yet populated (e.g.
-- products created via AI Studio demo flow before Stage 2 runs).
-- ============================================================

ALTER TABLE products ADD COLUMN is_green_product INTEGER DEFAULT 0;

-- Back-fill: mark products whose name / description / ai context
-- already signals a green product (case-insensitive keyword match).
-- This covers pmu15c28msfj3l2 "Sohar Elite Green Home Loan" and
-- any other green products seeded before this migration.
UPDATE products
SET    is_green_product = 1
WHERE  is_green_product = 0
  AND  (
         LOWER(name)        LIKE '%green%'
      OR LOWER(name)        LIKE '%esg%'
      OR LOWER(name)        LIKE '%gsas%'
      OR LOWER(name)        LIKE '%eco%'
      OR LOWER(description) LIKE '%green%'
      OR LOWER(description) LIKE '%esg%'
      OR LOWER(description) LIKE '%gsas%'
      OR LOWER(description) LIKE '%sustainable%'
      OR (esg_required_docs IS NOT NULL AND esg_required_docs != '' AND esg_required_docs != '[]')
       );

-- ── Data-fix for pmu15c28msfj3l2 "Sohar Elite Green Home Loan" ────────────────
-- This product was created via AI Studio demo but has several data issues:
--   1. pge_stage=1  → stages 3-6 are locked in PGE (pge-shell.js: locked = s.id > maxReached+1)
--   2. market_id=NULL → default market fallback works but explicit value is cleaner
--   3. is_green_product not yet set (handled above via back-fill UPDATE)
-- Fix: advance pge_stage to 3 (unlocks all stages) and set market_id.
-- Note: pge_stage=3 means "Rules stage reached" — the minimum to open the full PGE rail.
UPDATE products
SET    pge_stage  = CASE WHEN pge_stage < 3 THEN 3 ELSE pge_stage END,
       market_id  = COALESCE(market_id, 'mkt001')
WHERE  id = 'pmu15c28msfj3l2';

-- Also fix any other AI-created (is_demo_product=1) products stuck at pge_stage=1
-- that have a name suggesting green content (likely from the same demo flow).
UPDATE products
SET    pge_stage  = CASE WHEN pge_stage < 3 THEN 3 ELSE pge_stage END,
       market_id  = COALESCE(market_id, 'mkt001')
WHERE  is_demo_product = 1
  AND  pge_stage < 3
  AND  (
         LOWER(name) LIKE '%green%'
      OR LOWER(name) LIKE '%esg%'
      OR LOWER(name) LIKE '%gsas%'
       );
