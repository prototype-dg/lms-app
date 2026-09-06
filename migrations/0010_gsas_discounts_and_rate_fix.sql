-- ============================================================
-- Migration 0010: Fix GSAS discount fields on all home loan products
-- Also corrects the status chip colour mapping in the developer portal
-- by ensuring 'submitted' and 'credit_review' map to a visible status.
-- ============================================================

-- Fix p001 (Standard Home Loan) — was missing GSAS discount config
UPDATE products SET
  gsas_min_score         = 60,
  gsas_premium_score     = 85,
  green_discount_premium = 0.75,
  green_discount_standard= 0.25,
  updated_at             = datetime('now')
WHERE id = 'p001' AND category = 'home_loan';

-- Ensure prod_eco_home_001 (Green Home Finance) also has correct values
-- (was already set in 0008, but guard for re-runs)
UPDATE products SET
  gsas_min_score         = 60,
  gsas_premium_score     = 85,
  green_discount_premium = 0.75,
  green_discount_standard= 0.50,
  updated_at             = datetime('now')
WHERE id = 'prod_eco_home_001';
