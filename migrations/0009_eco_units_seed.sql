-- ============================================================
-- Migration 0009: EcoVillage Muscat units seed
-- Seeds the 6 eco-units that migration 0008 failed to insert
-- on Azure (node crashed before reaching the INSERT statements).
-- Safe to re-run (INSERT OR IGNORE).
-- ============================================================

-- Ensure demo contractor exists (safe duplicate guard)
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

-- Seed 6 EcoVillage Muscat units
INSERT OR IGNORE INTO units (id, project_id, unit_number, type, status, price, bedrooms, bathrooms, area_sqm, floor, gsas_score, contractor_id) VALUES
  ('eco-v01','proj004','EV-101','villa','available',185000,3,2,210,1,89,'con001'),
  ('eco-v02','proj004','EV-102','villa','available',195000,3,2,225,1,89,'con001'),
  ('eco-v03','proj004','EV-103','villa','reserved',210000,4,3,245,1,89,'con001'),
  ('eco-v04','proj004','EV-201','villa','available',220000,4,3,258,2,91,'con001'),
  ('eco-v05','proj004','EV-202','villa','sold',235000,4,3,272,2,91,'con001'),
  ('eco-v06','proj004','EV-203','villa','available',248000,5,4,290,2,91,'con001');

-- Ensure units are linked to contractor (idempotent)
UPDATE units SET contractor_id='con001'
WHERE project_id='proj004' AND (contractor_id IS NULL OR contractor_id='');

-- Update green_features on EcoVillage project (idempotent)
UPDATE projects SET
  green_features='["Solar PV 8.5kWp","Greywater Recycling","Green Roof","HVAC SEER 18.2","EV Charging Ready","Smart Metering"]'
WHERE id='proj004';
