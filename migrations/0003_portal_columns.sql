-- ============================================================
-- Migration 0003: Portal columns, AI threads, listing controls
-- ============================================================

-- Add portal visibility + AI-generated content columns to products
ALTER TABLE products ADD COLUMN portal_visible INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN portal_hero_title TEXT;
ALTER TABLE products ADD COLUMN portal_hero_subtitle TEXT;
ALTER TABLE products ADD COLUMN portal_card_badge TEXT;
ALTER TABLE products ADD COLUMN portal_highlights TEXT DEFAULT '[]';
ALTER TABLE products ADD COLUMN portal_calculator_enabled INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN developer_portal_visible INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN developer_requirements TEXT DEFAULT '{}';
ALTER TABLE products ADD COLUMN published_at TEXT;

-- Add listing visibility columns to projects
ALTER TABLE projects ADD COLUMN listing_visible INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN hero_image_url TEXT;
ALTER TABLE projects ADD COLUMN marketing_tagline TEXT;
ALTER TABLE projects ADD COLUMN price_from REAL;
ALTER TABLE projects ADD COLUMN price_to REAL;
ALTER TABLE projects ADD COLUMN completion_date TEXT;
ALTER TABLE projects ADD COLUMN amenities TEXT DEFAULT '[]';

-- AI conversation threads for multi-turn product studio
CREATE TABLE IF NOT EXISTS ai_threads (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  product_id TEXT,
  purpose TEXT NOT NULL,
  messages TEXT DEFAULT '[]',
  context TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  result TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Make existing standard products visible on consumer portal
UPDATE products SET portal_visible = 1, developer_portal_visible = 0
  WHERE code IN ('SHL-STANDARD','AFL-PERSONAL','PL-UNSECURED','SME-WORKCAP','HELOC-STANDARD','CPF-COMMERCIAL','EHL-EXPAT');

-- Set portal_highlights for standard products
UPDATE products SET portal_highlights = '["Fixed and variable rate options","Flexible 5–25 year terms","Top-up facility available","Insurance bundled"]'
  WHERE code = 'SHL-STANDARD';
UPDATE products SET portal_highlights = '["Covers sedans, SUVs & EVs","Quick 48-hour approval","Flexible 1–7 year terms"]'
  WHERE code = 'AFL-PERSONAL';
UPDATE products SET portal_highlights = '["No collateral required","Approved employer list","Competitive fixed rate"]'
  WHERE code = 'PL-UNSECURED';
UPDATE products SET portal_highlights = '["For SMEs registered in Oman","Revolving or term facility","Supports growth & payroll"]'
  WHERE code = 'SME-WORKCAP';
UPDATE products SET portal_highlights = '["Use your property equity","Revolving credit line","Up to OMR 300,000"]'
  WHERE code = 'HELOC-STANDARD';
UPDATE products SET portal_highlights = '["For offices, retail & warehouses","Up to OMR 2,000,000","Flexible repayment structures"]'
  WHERE code = 'CPF-COMMERCIAL';
UPDATE products SET portal_highlights = '["For expatriate professionals","Competitive rates from 6%","Up to OMR 400,000"]'
  WHERE code = 'EHL-EXPAT';

-- Make Al Mouj and Seeb Heights visible on consumer portal
UPDATE projects SET listing_visible = 1,
  price_from = 95000, price_to = 185000,
  marketing_tagline = 'Waterfront living with premium amenities in the heart of Muscat',
  amenities = '["Swimming Pool","Gym","24/7 Security","Covered Parking","Children''s Play Area"]'
  WHERE id = 'proj001';
UPDATE projects SET listing_visible = 1,
  price_from = 145000, price_to = 220000,
  marketing_tagline = 'Spacious villas with panoramic views near Muscat International Airport',
  amenities = '["Private Garden","Rooftop Terrace","Central A/C","Smart Home","Visitor Parking"]'
  WHERE id = 'proj002';

-- EcoVillage starts hidden (developer publishes in Act 2)
UPDATE projects SET listing_visible = 0 WHERE id = 'proj004';
