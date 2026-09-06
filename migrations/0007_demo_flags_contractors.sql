-- ============================================================
-- Migration 0007: Demo flags + Contractors table
-- ============================================================
-- 1. is_demo_product flag on products (set by AI Studio confirm)
-- 2. is_demo_project flag on projects (set by developer portal publish)
-- 3. contractors table — linked to projects/units
-- 4. contractor_id FK on units
-- 5. Seed one demo contractor (Al Jazeera Constructions — matches u011)
-- ============================================================

-- ── 1. Demo flag on products ─────────────────────────────────
ALTER TABLE products ADD COLUMN is_demo_product INTEGER DEFAULT 0;

-- ── 2. Demo flag on projects ──────────────────────────────────
ALTER TABLE projects ADD COLUMN is_demo_project INTEGER DEFAULT 0;

-- ── 3. Contractors table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS contractors (
  id              TEXT PRIMARY KEY,
  company_name    TEXT NOT NULL,
  company_name_ar TEXT,
  cr_number       TEXT UNIQUE NOT NULL,
  contact_name    TEXT,
  contact_phone   TEXT,
  contact_email   TEXT,
  license_number  TEXT,
  license_expiry  TEXT,
  governorate     TEXT DEFAULT 'Muscat',
  specialization  TEXT DEFAULT 'residential',  -- residential, commercial, green_build
  is_approved     INTEGER DEFAULT 1,           -- bank-approved contractor
  is_green_certified INTEGER DEFAULT 0,       -- has green building certification
  green_cert_ref  TEXT,
  status          TEXT DEFAULT 'active',
  created_at      TEXT DEFAULT (datetime('now'))
);

-- ── 4. contractor_id on units ────────────────────────────────
ALTER TABLE units ADD COLUMN contractor_id TEXT REFERENCES contractors(id);

-- ── 5. Seed demo contractor (Al Jazeera Constructions) ───────
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
  1,
  1,
  'GBCOMAN-2024-0147',
  'active'
);

-- ── 6. Link EcoVillage Phase 2 units to demo contractor ──────
-- (applied when those units exist; OR IGNORE prevents errors if not yet created)
UPDATE units SET contractor_id = 'con001'
WHERE project_id IN (
  SELECT id FROM projects WHERE name LIKE '%EcoVillage%'
);

-- ── 7. Mark EcoVillage Muscat (Phase 1) as demo project ──────
UPDATE projects SET is_demo_project = 1
WHERE id = 'proj004';
