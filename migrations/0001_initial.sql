-- ============================================================
-- Sohar International Digital Ecosystem – Demo Database Schema
-- ============================================================

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'home_loan',
  status TEXT CHECK(status IN ('draft','active','archived')) DEFAULT 'draft',
  base_rate REAL DEFAULT 5.5,
  max_ltv INTEGER DEFAULT 90,
  max_dbr INTEGER DEFAULT 60,
  green_dbr INTEGER DEFAULT 55,
  min_term INTEGER DEFAULT 5,
  max_term INTEGER DEFAULT 25,
  min_amount REAL DEFAULT 10000,
  max_amount REAL DEFAULT 500000,
  gsas_min_score INTEGER DEFAULT 70,
  gsas_premium_score INTEGER DEFAULT 85,
  green_discount_premium REAL DEFAULT 0.75,
  green_discount_standard REAL DEFAULT 0.5,
  ai_confidence_threshold INTEGER DEFAULT 90,
  allow_byop INTEGER DEFAULT 1,
  allow_partner_inventory INTEGER DEFAULT 1,
  required_docs TEXT DEFAULT '["salary_cert","utility_bill","civil_id","property_deed"]',
  esg_required_docs TEXT DEFAULT '["gsas_cert","epc_report","eia_approval"]',
  approved_materials TEXT DEFAULT '["Green Concrete","Thermal Insulation","Solar Panels","Energy-Efficient Appliances","Low-E Glass"]',
  approved_vendors TEXT DEFAULT '["Oman Readymix LLC","Gulf Insulation Group","SunTech Oman","Green Build Oman"]',
  configuration TEXT DEFAULT '{}',
  applications_ytd INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'system',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Rules Table
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  metric TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold_value REAL,
  threshold_condition TEXT,
  action_on_breach TEXT DEFAULT 'reject',
  severity TEXT DEFAULT 'hard',
  regulatory_reference TEXT,
  source TEXT CHECK(source IN ('manual','ai_generated','cloned')) DEFAULT 'manual',
  ai_confidence REAL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_by TEXT DEFAULT 'system',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Developers/Partners Table
CREATE TABLE IF NOT EXISTS developers (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  cr_number TEXT UNIQUE,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  po_box TEXT,
  status TEXT DEFAULT 'active',
  verified_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  developer_id TEXT REFERENCES developers(id),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  location TEXT,
  governorate TEXT,
  type TEXT DEFAULT 'residential',
  total_units INTEGER DEFAULT 0,
  available_units INTEGER DEFAULT 0,
  reserved_units INTEGER DEFAULT 0,
  sold_units INTEGER DEFAULT 0,
  gsas_score INTEGER,
  gsas_rating TEXT,
  epc_rating TEXT,
  eia_reference TEXT,
  geo_json TEXT,
  status TEXT CHECK(status IN ('draft','under_review','active','sold_out','archived')) DEFAULT 'draft',
  green_eligible INTEGER DEFAULT 0,
  premium_tier INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Units Table
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  unit_number TEXT NOT NULL,
  floor_number INTEGER,
  type TEXT DEFAULT 'villa',
  area_sqm REAL,
  bedrooms INTEGER,
  bathrooms INTEGER,
  price REAL,
  lat REAL,
  lng REAL,
  status TEXT CHECK(status IN ('available','reserved','sold')) DEFAULT 'available',
  features TEXT DEFAULT '[]',
  image_url TEXT,
  gsas_score INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Documents Table (for AI validation tracking)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  filename TEXT,
  file_url TEXT,
  extracted_data TEXT DEFAULT '{}',
  ai_confidence REAL,
  validation_status TEXT CHECK(validation_status IN ('pending','auto_verified','manual_review','approved','rejected')) DEFAULT 'pending',
  validation_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  civil_id TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  nationality TEXT DEFAULT 'Omani',
  employer TEXT,
  salary_omr REAL,
  employment_type TEXT DEFAULT 'salaried',
  credit_score INTEGER DEFAULT 700,
  existing_dbr REAL DEFAULT 0,
  sohar_customer_since TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Applications Table
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  product_id TEXT REFERENCES products(id),
  customer_id TEXT REFERENCES customers(id),
  customer_name TEXT,
  unit_id TEXT REFERENCES units(id),
  project_id TEXT REFERENCES projects(id),
  loan_amount REAL,
  loan_term INTEGER,
  property_address TEXT,
  property_source TEXT CHECK(property_source IN ('partner','byop')) DEFAULT 'partner',
  property_area_sqm REAL,
  gsas_score INTEGER,
  epc_rating TEXT,
  applied_rate REAL,
  standard_rate REAL DEFAULT 5.5,
  monthly_payment REAL,
  standard_monthly_payment REAL,
  lifetime_saving REAL,
  dbr REAL,
  ltv REAL,
  stress_test_rate REAL DEFAULT 9.0,
  stress_test_passed INTEGER DEFAULT 0,
  malaa_score INTEGER,
  status TEXT CHECK(status IN (
    'draft','submitted','credit_scoring','esg_review',
    'credit_review','approved','disbursed','completed','rejected'
  )) DEFAULT 'draft',
  esg_verification_status TEXT DEFAULT 'pending',
  compliance_approved_by TEXT,
  compliance_approved_at TEXT,
  risk_approved_by TEXT,
  risk_approved_at TEXT,
  escrow_amount REAL,
  escrow_released REAL DEFAULT 0,
  rejection_reason TEXT,
  tracking_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Construction Stages Table
CREATE TABLE IF NOT EXISTS construction_stages (
  id TEXT PRIMARY KEY,
  application_id TEXT REFERENCES applications(id),
  stage_number INTEGER NOT NULL,
  stage_name TEXT NOT NULL,
  description TEXT,
  tranche_amount REAL,
  tranche_percentage REAL,
  required_material TEXT,
  status TEXT CHECK(status IN ('locked','active','completed','paid')) DEFAULT 'locked',
  invoice_doc_id TEXT REFERENCES documents(id),
  ai_validated INTEGER DEFAULT 0,
  ai_confidence REAL,
  payment_reference TEXT,
  completed_at TEXT,
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Users Table (Back-office)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK(role IN ('product_manager','compliance_officer','risk_officer','operations','contractor','developer','customer','admin')) NOT NULL,
  department TEXT,
  avatar_initials TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT DEFAULT '{}',
  source TEXT CHECK(source IN ('manual','ai_generated','ai_recommendation','system')) DEFAULT 'manual',
  ai_confidence REAL,
  regulatory_reference TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- AI Knowledge Base entries
CREATE TABLE IF NOT EXISTS knowledge_base (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  effective_date TEXT,
  tags TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Regulatory Rules Cache
CREATE TABLE IF NOT EXISTS rule_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  regulatory_source TEXT,
  template_json TEXT NOT NULL,
  is_cbo_required INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_applications_customer ON applications(customer_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_reference ON applications(reference);
CREATE INDEX IF NOT EXISTS idx_units_project ON units(project_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_construction_stages_app ON construction_stages(application_id);
