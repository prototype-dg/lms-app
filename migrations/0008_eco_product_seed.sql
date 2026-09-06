-- ============================================================
-- Migration 0008: ECO Product + EcoVillage Muscat seed data
-- Seeds the Green Home Finance product and EcoVillage Muscat
-- project with 6 eco-units. Safe to re-run (INSERT OR IGNORE).
-- ============================================================

-- ── 1. Green Home Finance product ─────────────────────────
INSERT OR IGNORE INTO products (
  id, name, code, description, category, status,
  base_rate, max_ltv, max_dbr, green_dbr, min_term, max_term,
  min_amount, max_amount, gsas_min_score, gsas_premium_score,
  green_discount_premium, green_discount_standard, ai_confidence_threshold,
  allow_byop, allow_partner_inventory,
  required_docs, esg_required_docs, approved_materials, approved_vendors,
  configuration, applications_ytd, created_by, created_at, updated_at
) VALUES (
  'prod_eco_home_001',
  'Green Home Finance',
  'GHL-ECO-001',
  'Sohar International flagship green mortgage. Eligible for GSAS-certified properties only. Rates from 4.75% for 4-star and above. CBO-compliant, supports Al Jazeera Constructions and approved green builders. AI-assisted approval in 48 hours.',
  'home_loan',
  'active',
  4.75, 80, 40, 45, 5, 25, 20000, 500000,
  60, 85,
  0.75, 0.5, 88,
  1, 1,
  '["civil_id","salary_certificate","gsas_certificate","property_deed","independent_valuation_report","bank_statements_3m","employer_letter","epc_report"]',
  '["gsas_certificate","epc_report","green_contractor_license"]',
  '[]', '[]',
  '{"features":["GSAS-certified properties only","AI-assisted 48h approval","Premium rate 4.75% for GSAS 85+","Standard green rate 5.25% for GSAS 60+","Partner contractor pre-verified","CBO green mortgage guidelines"]}',
  0, 'u001', '2025-09-01', '2025-09-01'
);

-- Mark Green Home Finance as demo product and make it portal-visible
UPDATE products SET is_demo_product = 1, portal_visible = 1 WHERE id = 'prod_eco_home_001';

-- ── 2. EcoVillage Muscat project (activate + mark demo) ───
-- Ensure proj004 exists (may not if project seeds are elsewhere)
INSERT OR IGNORE INTO projects (
  id, name, type, location, status, listing_visible,
  total_units, gsas_overall_score, epc_rating, price_from, price_to,
  hero_image_url, is_demo_project, created_at
) VALUES (
  'proj004',
  'EcoVillage Muscat',
  'villa',
  'Seeb, Muscat Governorate',
  'active', 1,
  6, 89, 'A',
  180000, 260000,
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80',
  1,
  datetime('now')
);

-- Activate and mark as demo (in case it already exists)
UPDATE projects SET status='active', listing_visible=1, is_demo_project=1
WHERE id='proj004';

-- Update GSAS score if column exists (idempotent)
UPDATE projects SET gsas_overall_score=89, epc_rating='A', price_from=180000, price_to=260000
WHERE id='proj004';

-- ── 3. Seed demo contractor if not yet present ─────────────
INSERT OR IGNORE INTO contractors (
  id, company_name, company_name_ar, cr_number,
  contact_name, contact_phone, contact_email,
  license_number, license_expiry, governorate,
  specialization, is_approved, is_green_certified, green_cert_ref, status
) VALUES (
  'con001',
  'Al Jazeera Constructions LLC',
  'شركة الجزيرة للإنشاءات ذ.م.م',
  'CR-2018-44721',
  'Rashid Al-Hassani',
  '+968 9944 5512',
  'rashid@aljazeera-const.om',
  'MOH-CON-2024-0892',
  '2027-12-31',
  'Muscat',
  'residential',
  1, 1,
  'GBCOMAN-2024-0147',
  'active'
);

-- ── 4. Seed 6 EcoVillage units ─────────────────────────────
INSERT OR IGNORE INTO units (id, project_id, unit_number, type, status, price, bedrooms, bathrooms, area_sqm, floor, gsas_score, contractor_id) VALUES
  ('eco-v01','proj004','EV-101','villa','available',185000,3,2,210,1,89,'con001'),
  ('eco-v02','proj004','EV-102','villa','available',195000,3,2,225,1,89,'con001'),
  ('eco-v03','proj004','EV-103','villa','reserved',210000,4,3,245,1,89,'con001'),
  ('eco-v04','proj004','EV-201','villa','available',220000,4,3,258,2,91,'con001'),
  ('eco-v05','proj004','EV-202','villa','sold',235000,4,3,272,2,91,'con001'),
  ('eco-v06','proj004','EV-203','villa','available',248000,5,4,290,2,91,'con001');

-- Link all EcoVillage units to demo contractor
UPDATE units SET contractor_id='con001'
WHERE project_id='proj004' AND (contractor_id IS NULL OR contractor_id='');

-- ── 5. Set green_features JSON on EcoVillage project ──────
UPDATE projects SET
  green_features='["Solar PV 8.5kWp","Greywater Recycling","Green Roof","HVAC SEER 18.2","EV Charging Ready","Smart Metering"]'
WHERE id='proj004';
