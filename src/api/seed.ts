import type { NodeBindings } from '../lib/types'
import { Hono } from 'hono'
const app = new Hono<{ Bindings: NodeBindings }>()


function getSeedSQL(): string {
  // Embedded schema + portal migration columns + seed data
  return SCHEMA_SQL + '\n' + PORTAL_COLUMNS_SQL + '\n' + SEED_SQL
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE, description TEXT,
  category TEXT DEFAULT 'home_loan', status TEXT DEFAULT 'draft',
  base_rate REAL DEFAULT 5.5, max_ltv INTEGER DEFAULT 90, max_dbr INTEGER DEFAULT 60,
  green_dbr INTEGER DEFAULT 55, min_term INTEGER DEFAULT 5, max_term INTEGER DEFAULT 25,
  min_amount REAL DEFAULT 10000, max_amount REAL DEFAULT 500000,
  gsas_min_score INTEGER DEFAULT 0, gsas_premium_score INTEGER DEFAULT 0,
  green_discount_premium REAL DEFAULT 0.0, green_discount_standard REAL DEFAULT 0.0,
  ai_confidence_threshold INTEGER DEFAULT 90, allow_byop INTEGER DEFAULT 1,
  allow_partner_inventory INTEGER DEFAULT 1,
  required_docs TEXT DEFAULT '[]', esg_required_docs TEXT DEFAULT '[]',
  approved_materials TEXT DEFAULT '[]', approved_vendors TEXT DEFAULT '[]',
  configuration TEXT DEFAULT '{}', applications_ytd INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'system', created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  portal_visible INTEGER DEFAULT 0,
  portal_hero_title TEXT, portal_hero_subtitle TEXT, portal_card_badge TEXT,
  portal_highlights TEXT DEFAULT '[]',
  portal_calculator_enabled INTEGER DEFAULT 1,
  developer_portal_visible INTEGER DEFAULT 0,
  developer_requirements TEXT DEFAULT '{}',
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY, product_id TEXT, name TEXT NOT NULL, category TEXT NOT NULL,
  metric TEXT NOT NULL, operator TEXT NOT NULL, threshold_value REAL,
  threshold_condition TEXT, action_on_breach TEXT DEFAULT 'reject',
  severity TEXT DEFAULT 'hard', regulatory_reference TEXT,
  source TEXT DEFAULT 'manual', ai_confidence REAL, description TEXT,
  is_active INTEGER DEFAULT 1, created_by TEXT DEFAULT 'system',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS developers (
  id TEXT PRIMARY KEY, company_name TEXT NOT NULL, cr_number TEXT UNIQUE,
  contact_name TEXT, email TEXT, phone TEXT, po_box TEXT,
  status TEXT DEFAULT 'active', verified_at TEXT, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, developer_id TEXT, name TEXT NOT NULL, code TEXT UNIQUE,
  location TEXT, governorate TEXT, type TEXT DEFAULT 'residential',
  total_units INTEGER DEFAULT 0, available_units INTEGER DEFAULT 0,
  reserved_units INTEGER DEFAULT 0, sold_units INTEGER DEFAULT 0,
  gsas_score INTEGER, gsas_rating TEXT, epc_rating TEXT, eia_reference TEXT,
  geo_json TEXT, status TEXT DEFAULT 'draft',
  green_eligible INTEGER DEFAULT 0, premium_tier INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY, project_id TEXT, unit_number TEXT NOT NULL,
  floor_number INTEGER, type TEXT DEFAULT 'villa', area_sqm REAL,
  bedrooms INTEGER, bathrooms INTEGER, price REAL, lat REAL, lng REAL,
  status TEXT DEFAULT 'available', features TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  doc_type TEXT NOT NULL, filename TEXT, file_url TEXT,
  extracted_data TEXT DEFAULT '{}', ai_confidence REAL,
  validation_status TEXT DEFAULT 'pending', validation_notes TEXT,
  reviewed_by TEXT, reviewed_at TEXT, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, name_ar TEXT, civil_id TEXT UNIQUE,
  email TEXT, phone TEXT, nationality TEXT DEFAULT 'Omani', employer TEXT,
  salary_omr REAL, employment_type TEXT DEFAULT 'salaried',
  credit_score INTEGER DEFAULT 700, existing_dbr REAL DEFAULT 0,
  sohar_customer_since TEXT, status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, product_id TEXT,
  customer_id TEXT, customer_name TEXT, unit_id TEXT, project_id TEXT,
  loan_amount REAL, loan_term INTEGER, property_address TEXT,
  property_source TEXT DEFAULT 'partner', property_area_sqm REAL,
  gsas_score INTEGER, epc_rating TEXT, applied_rate REAL, standard_rate REAL DEFAULT 5.5,
  monthly_payment REAL, standard_monthly_payment REAL, lifetime_saving REAL,
  dbr REAL, ltv REAL, stress_test_rate REAL DEFAULT 9.0, stress_test_passed INTEGER DEFAULT 0,
  malaa_score INTEGER, status TEXT DEFAULT 'draft', esg_verification_status TEXT DEFAULT 'pending',
  compliance_approved_by TEXT, compliance_approved_at TEXT,
  risk_approved_by TEXT, risk_approved_at TEXT,
  escrow_amount REAL, escrow_released REAL DEFAULT 0,
  rejection_reason TEXT, tracking_url TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS construction_stages (
  id TEXT PRIMARY KEY, application_id TEXT, stage_number INTEGER NOT NULL,
  stage_name TEXT NOT NULL, description TEXT, tranche_amount REAL,
  tranche_percentage REAL, required_material TEXT, status TEXT DEFAULT 'locked',
  invoice_doc_id TEXT, ai_validated INTEGER DEFAULT 0, ai_confidence REAL,
  payment_reference TEXT, completed_at TEXT, paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, name_ar TEXT, email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL, department TEXT, avatar_initials TEXT,
  status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, user_id TEXT, user_name TEXT, user_role TEXT,
  action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, details TEXT DEFAULT '{}',
  source TEXT DEFAULT 'manual', ai_confidence REAL, regulatory_reference TEXT,
  ip_address TEXT, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_base (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL,
  content TEXT NOT NULL, source TEXT, effective_date TEXT,
  tags TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rule_templates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  regulatory_source TEXT, template_json TEXT NOT NULL,
  is_cbo_required INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_reference ON applications(reference);
CREATE INDEX IF NOT EXISTS idx_units_project ON units(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_construction_stages_app ON construction_stages(application_id);
`

// Portal & AI columns from migration 0003 — applied idempotently for local dev DBs.
// ALTER TABLE on existing columns errors silently (ignored by the seed/run executor).
const PORTAL_COLUMNS_SQL = `
ALTER TABLE products ADD COLUMN portal_visible INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN portal_hero_title TEXT;
ALTER TABLE products ADD COLUMN portal_hero_subtitle TEXT;
ALTER TABLE products ADD COLUMN portal_card_badge TEXT;
ALTER TABLE products ADD COLUMN portal_highlights TEXT DEFAULT '[]';
ALTER TABLE products ADD COLUMN portal_calculator_enabled INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN developer_portal_visible INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN developer_requirements TEXT DEFAULT '{}';
ALTER TABLE products ADD COLUMN published_at TEXT;
ALTER TABLE projects ADD COLUMN listing_visible INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN hero_image_url TEXT;
ALTER TABLE projects ADD COLUMN marketing_tagline TEXT;
ALTER TABLE projects ADD COLUMN price_from REAL;
ALTER TABLE projects ADD COLUMN price_to REAL;
ALTER TABLE projects ADD COLUMN completion_date TEXT;
ALTER TABLE projects ADD COLUMN amenities TEXT DEFAULT '[]';
CREATE TABLE IF NOT EXISTS ai_threads (
  id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, purpose TEXT NOT NULL,
  messages TEXT DEFAULT '[]', context TEXT DEFAULT '{}', status TEXT DEFAULT 'active',
  result TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
`

const SEED_SQL = `
INSERT OR IGNORE INTO users VALUES ('u001','Fatima Al-Rashdi','فاطمة الراشدي','fatima@sib.om','product_manager','Product Management','FA','active','2024-01-15');
INSERT OR IGNORE INTO users VALUES ('u002','Aisha Al-Balushi','عائشة البلوشي','aisha@sib.om','compliance_officer','Compliance & ESG','AB','active','2023-06-01');
INSERT OR IGNORE INTO users VALUES ('u003','Omar Al-Mantheri','عمر المنذري','omar@sib.om','risk_officer','Credit Risk','OM','active','2023-03-15');
INSERT OR IGNORE INTO users VALUES ('u004','Khalid Al-Rawahi','خالد الرواحي','khalid@sib.om','operations','Operations','KR','active','2022-09-01');
INSERT OR IGNORE INTO users VALUES ('u010','Ahmed Al-Hinai','أحمد الهنائي','ahmed@almadaen.om','developer','Al Madaen Real Estate','AH','active','2023-11-01');
INSERT OR IGNORE INTO users VALUES ('u011','Rashid Al-Hassani','راشد الحساني','rashid@aljazeera-const.om','contractor','Al Jazeera Constructions','RH','active','2024-02-01');
INSERT OR IGNORE INTO users VALUES ('u020','Salim Al-Harthy','سالم الحارثي','salim@gmail.com','customer',null,'SH','active','2019-05-10');

INSERT OR IGNORE INTO customers VALUES ('c001','Salim Al-Harthy','سالم الحارثي','84521789','salim@gmail.com','+968 9921 3344','Omani','Ministry of Heritage & Tourism',3200,'salaried',750,0,'2019-05-10','active','2019-05-10');
INSERT OR IGNORE INTO customers VALUES ('c002','Mariam Al-Siyabi','مريم السيابي','91234567','mariam@hotmail.com','+968 9955 1122','Omani','Oman Oil Company',4500,'salaried',780,12,'2020-03-22','active','2020-03-22');
INSERT OR IGNORE INTO customers VALUES ('c003','Hassan Al-Amri','حسن العامري','78654321','hassan@gmail.com','+968 9977 8899','Omani','Bank Muscat',2800,'salaried',710,18,'2021-07-15','active','2021-07-15');

INSERT OR IGNORE INTO products VALUES ('p001','Standard Home Loan','SHL-STANDARD','Flagship home financing for Omani nationals and residents. Fixed and variable rate options, top-up facility, and bundled insurance. CBO-compliant with full credit assessment.','home_loan','active',5.5,90,60,60,5,25,10000,500000,0,0,0.0,0.0,90,1,1,'["civil_id","salary_certificate","utility_bill","property_deed","independent_valuation_report","bank_statements_3m","employer_letter"]','[]','[]','[]','{"features":["Fixed and variable rate options","Top-up facility available","Insurance bundled","Salary transfer preferred"]}',4847,'u001','2024-01-10','2025-12-15');
INSERT OR IGNORE INTO products VALUES ('p002','Auto Finance – Personal','AFL-PERSONAL','Financing for personal vehicles including sedans, SUVs, and electric vehicles. Competitive flat rate, quick 48-hour approval, covers new and used vehicles up to 5 years old.','auto_loan','active',4.9,85,55,55,1,7,3000,80000,0,0,0.0,0.0,90,0,0,'["civil_id","salary_certificate","vehicle_proforma_invoice","driving_license","insurance_quotation","bank_statements_3m"]','[]','[]','[]','{"features":["Covers new & used vehicles","48-hour credit decision","EV purchase supported","Comprehensive insurance required"]}',1923,'u001','2023-06-01','2025-11-20');
INSERT OR IGNORE INTO products VALUES ('p003','Personal Loan','PL-UNSECURED','Unsecured personal financing for salaried employees of approved employers. No collateral required. Flat competitive rate for medical, travel, home renovation and other personal needs.','personal_loan','active',7.5,0,45,45,1,5,1000,30000,0,0,0.0,0.0,90,0,0,'["civil_id","salary_certificate","employer_letter","bank_statements_3m","approved_employer_confirmation"]','[]','[]','[]','{"features":["No collateral required","Approved employer list","Competitive fixed rate","Loan protector insurance available"]}',3241,'u001','2023-01-15','2025-10-01');
INSERT OR IGNORE INTO products VALUES ('p004','SME Working Capital','SME-WORKCAP','Short-term working capital facility for small and medium enterprises registered in Oman. Revolving or term structure. Supports payroll, inventory procurement, and operational growth.','sme','active',6.5,70,65,65,1,3,5000,200000,0,0,0.0,0.0,85,0,0,'["commercial_registration_certificate","memorandum_of_association","audited_financials_2yr","bank_statements_6m","cr_extract","tax_clearance_certificate","business_profile"]','[]','[]','[]','{"features":["For Oman-registered SMEs","Revolving or term facility","Supports payroll & growth","MOCI-verified CR required"]}',892,'u001','2023-08-10','2025-09-15');
INSERT OR IGNORE INTO products VALUES ('p005','Home Equity Line','HELOC-STANDARD','Revolving credit facility secured against existing owned property. Access equity without selling. Ideal for large purchases, education, or business funding. Second charge behind primary mortgage.','home_loan','active',6.0,75,55,55,5,15,20000,300000,0,0,0.0,0.0,90,0,0,'["civil_id","property_title_deed","independent_valuation_report","salary_certificate","bank_statements_3m","existing_mortgage_statement","noc_from_primary_lender"]','[]','[]','[]','{"features":["Use your property equity","Revolving credit line","Up to OMR 300,000","No early settlement penalty"]}',567,'u001','2024-03-01','2025-08-20');
INSERT OR IGNORE INTO products VALUES ('p006','Commercial Property Finance','CPF-COMMERCIAL','Financing for commercial properties including offices, retail units, and warehouses. Available to Omani-registered companies and sole proprietors. Full corporate credit assessment applies.','commercial','active',6.8,70,65,65,5,20,50000,2000000,0,0,0.0,0.0,85,0,0,'["commercial_registration_certificate","memorandum_of_association","audited_financials_3yr","bank_statements_12m","property_title_deed","independent_valuation_report","lease_agreements","board_resolution"]','[]','[]','[]','{"features":["For offices, retail & warehouses","Up to OMR 2,000,000","Flexible repayment structures","Lease income considered"]}',234,'u001','2023-09-01','2025-07-10');
INSERT OR IGNORE INTO products VALUES ('p007','Expat Home Finance','EHL-EXPAT','Home financing for expatriate professionals working in Oman. Stricter LTV (max 75%) per CBO regulations. Employer NOC required. Available for IZ-approved freehold zones.','home_loan','active',6.0,75,55,55,5,20,15000,400000,0,0,0.0,0.0,90,0,0,'["civil_id","passport_copy","valid_work_permit_residence_card","salary_certificate","noc_from_employer","property_deed_freehold_zone","independent_valuation_report","bank_statements_6m"]','[]','[]','[]','{"features":["Expatriate professionals","LTV up to 75%","Freehold zone properties","Employer NOC required"]}',1102,'u001','2024-01-20','2025-12-01');
INSERT OR IGNORE INTO products VALUES ('p008','Education Finance','EDU-FINANCE','Financing for higher education expenses including tuition, accommodation, and study materials at approved universities in Oman and abroad. Deferred repayment option available.','education','archived',8.0,0,45,45,1,8,500,20000,0,0,0.0,0.0,90,0,0,'["civil_id","university_offer_letter_or_enrollment","salary_certificate","fee_schedule_from_institution","bank_statements_3m"]','[]','[]','[]','{"features":["Approved universities list","Deferred repayment option","Covers tuition & accommodation","Loan protector insurance"]}',445,'u001','2022-01-01','2024-06-01');
-- Green Home Loan is created LIVE during the presentation (Act 1).

INSERT OR IGNORE INTO rules VALUES ('r001',null,'DBR Maximum Limit','creditworthiness','DBR','<=',60,null,'reject','hard','CBO Circular 2024-01, Section 3.1','manual',null,'Debt Burden Ratio must not exceed 60% of gross monthly income',1,'system','2024-01-01');
INSERT OR IGNORE INTO rules VALUES ('r002',null,'LTV Maximum – Salaried Omani','collateral','LTV','<=',90,'nationality=Omani AND employment=salaried','reject','hard','CBO Circular 2024-01, Section 4.2','manual',null,'LTV max 90% for salaried Omani nationals',1,'system','2024-01-01');
INSERT OR IGNORE INTO rules VALUES ('r003',null,'LTV Maximum – Expat','collateral','LTV','<=',75,'nationality!=Omani','reject','hard','CBO Circular 2024-01, Section 4.3','manual',null,'LTV max 75% for expatriates',1,'system','2024-01-01');
INSERT OR IGNORE INTO rules VALUES ('r004',null,'Minimum Loan Term','product','loan_term','>=',5,null,'reject','hard','Bank Policy BP-2024-HL-001','manual',null,'Minimum loan term 5 years',1,'system','2024-01-01');
INSERT OR IGNORE INTO rules VALUES ('r005',null,'Maximum Loan Term','product','loan_term','<=',25,null,'reject','hard','CBO Circular 2024-01, Section 5.1','manual',null,'Maximum loan term 25 years',1,'system','2024-01-01');
INSERT OR IGNORE INTO rules VALUES ('r006',null,'Minimum Credit Score','creditworthiness','credit_score','>=',650,null,'reject','hard','Bank Policy BP-2024-CR-002','manual',null,'Minimum MALAA credit score 650',1,'system','2024-01-01');
INSERT OR IGNORE INTO rules VALUES ('r007',null,'CBO Stress Test – Rate Hike','stress_test','stress_rate','<=',9,null,'reject','hard','CBO Circular 2025-07, Section 2.3','manual',null,'Simulate +350bps rate hike; DBR must not exceed 70%',1,'system','2024-01-01');
INSERT OR IGNORE INTO rules VALUES ('r008',null,'Minimum Salary – Home Loan','eligibility','salary_omr','>=',400,null,'reject','soft','Bank Policy BP-2024-HL-003','manual',null,'Minimum monthly salary OMR 400',1,'system','2024-01-01');
INSERT OR IGNORE INTO rules VALUES ('r009',null,'Property Valuation Required','collateral','valuation_required','=',1,null,'reject','hard','CBO Circular 2024-01, Section 6.1','manual',null,'Independent valuation mandatory',1,'system','2024-01-01');
INSERT OR IGNORE INTO rules VALUES ('r010',null,'AML Sanctions Screening','compliance','sanctions_clear','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 8','manual',null,'Customer must pass sanctions screening',1,'system','2024-01-01');
INSERT OR IGNORE INTO rules VALUES ('r011',null,'KYC Completeness Check','compliance','kyc_complete','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 5.2','manual',null,'All KYC documents must be verified',1,'system','2024-01-01');
INSERT OR IGNORE INTO rules VALUES ('r012',null,'GSAS Score – Green Entry','esg','gsas_score','>=',70,null,'reject','hard','OS GSO 3000:2025, Section 4.2','manual',null,'Minimum GSAS score 70 for Green Home Loan',1,'system','2026-01-01');
INSERT OR IGNORE INTO rules VALUES ('r013',null,'EPC Rating Minimum','esg','epc_rating','in',null,'A,B,C','reject','hard','OEESC Section 5.1','manual',null,'EPC minimum rating C required',1,'system','2026-01-01');
INSERT OR IGNORE INTO rules VALUES ('r014',null,'EIA Clearance – Large Projects','esg','eia_required','=',1,'units>20','reject','hard','Environment Authority Decision 107/2023','manual',null,'EIA clearance mandatory for >20 units',1,'system','2026-01-01');
-- r015 (Green DBR Buffer) is generated LIVE by AI during Act 1.

INSERT OR IGNORE INTO developers VALUES ('d001','Al Madaen Real Estate','CR-2019-45821','Ahmed Al-Hinai','ahmed@almadaen.om','+968 2434 5566','PO Box 1234, Muscat','active','2023-11-15','2019-03-01');
INSERT OR IGNORE INTO developers VALUES ('d002','Muscat Hills Development','CR-2018-33201','Sara Al-Lawati','sara@muscathills.om','+968 2488 9900','PO Box 567, Muscat','active','2022-09-20','2018-07-10');
INSERT OR IGNORE INTO developers VALUES ('d003','Gulf Horizon Properties','CR-2021-78543','Khalid Al-Farsi','khalid@gulfhorizon.om','+968 2456 7788','PO Box 890, Sohar','active','2024-01-05','2021-02-15');

INSERT OR IGNORE INTO projects VALUES ('proj001','d001','Al Mouj Residences','AMR-2024','Al Mouj, Muscat','Muscat','apartment',36,12,8,16,78,'Gold','B','EIA/2024/201','{"type":"FeatureCollection","features":[]}','active',1,0,'2024-06-15','2025-11-30',1,'/static/img/proj001_hero.jpg','Waterfront living with premium amenities in the heart of Muscat',95000,185000,NULL,'["Swimming Pool","Gym","24/7 Security","Covered Parking","Children''s Play Area"]');
INSERT OR IGNORE INTO projects VALUES ('proj002','d001','Seeb Heights Villas','SHV-2025','Airport Heights, Seeb','Muscat','villa',18,18,0,0,82,'Gold','A',null,'{"type":"FeatureCollection","features":[]}','active',1,0,'2025-01-10','2025-12-01',1,'/static/img/proj002_hero.jpg','Spacious villas with panoramic views near Muscat International Airport',145000,220000,NULL,'["Private Garden","Rooftop Terrace","Central A/C","Smart Home","Visitor Parking"]');
INSERT OR IGNORE INTO projects VALUES ('proj003','d001','Mabella View Apartments','MVA-2023','Mabella, Muscat','Muscat','apartment',60,0,0,60,null,null,null,null,'{"type":"FeatureCollection","features":[]}','archived',0,0,'2023-05-01','2025-06-30',0,'/static/img/proj003_hero.jpg',null,null,null,null,'[]');
INSERT OR IGNORE INTO projects VALUES ('proj004','d001','EcoVillage Muscat','EVM-2026','Seeb, Muscat Governorate','Muscat','villa',24,0,0,0,null,null,null,null,'{"type":"FeatureCollection","features":[]}','draft',0,0,'2026-08-31','2026-08-31',0,'/static/img/proj004_hero.jpg',null,null,null,null,'[]');

-- EcoVillage units and documents are uploaded LIVE during Act 2.

INSERT OR IGNORE INTO applications VALUES ('app001','HL-240892','p001','c002','Mariam Al-Siyabi',null,'proj001',250000,20,'Al Mouj Residences, Unit A12, Muscat','partner',142,null,null,5.5,5.5,1608.82,1608.82,0,46,78,9.0,1,780,'approved','verified','u002','2024-09-15','u003','2024-09-16',250000,0,null,null,'2024-09-14','2024-09-16');
INSERT OR IGNORE INTO applications VALUES ('app002','HL-241156','p001','c003','Hassan Al-Amri',null,null,120000,15,'Plot 45, Al Ghubra North, Muscat','byop',200,null,null,5.5,5.5,980.12,980.12,0,36,72,9.0,1,710,'credit_review','pending',null,null,null,null,120000,0,null,null,'2024-12-01','2024-12-03');
-- GHL-250001 (app003) and construction stages are created LIVE during Acts 3-5.

INSERT OR IGNORE INTO knowledge_base VALUES ('kb001','CBO Circular 2026-12 – DBR Rules','regulatory','The Central Bank of Oman requires DBR shall not exceed 60% of gross monthly income. For green financing, banks apply a 5% buffer, limiting DBR to 55%.','CBO Circular 2026-12','2026-01-01','["DBR","housing","green"]','2026-08-31');
INSERT OR IGNORE INTO knowledge_base VALUES ('kb002','OS GSO 3000:2025 – GSAS Standards','esg','GSAS certificates must contain: Certificate Number (GSAS-YYYY-NNN), Issuer (GORD), Issue Date, Expiry Date, Overall Score (0-100), Rating. Minimum score 70 for green financing.','OS GSO 3000:2025','2025-01-01','["GSAS","ESG","certification"]','2026-08-31');
INSERT OR IGNORE INTO knowledge_base VALUES ('kb003','Oman PDPL – Royal Decree 6/2022','compliance','PDPL requires explicit consent, secure storage, right to erasure, mandatory breach notification within 72 hours.','Royal Decree 6/2022','2022-02-01','["PDPL","data","privacy"]','2026-08-31');
INSERT OR IGNORE INTO knowledge_base VALUES ('kb004','OEESC – EPC Requirements','esg','Energy Performance Certificates required for all new residential developments. Minimum rating C for green financing. Scale A+ to G.','OEESC Section 5.1','2024-01-01','["EPC","energy","efficiency"]','2026-08-31');
INSERT OR IGNORE INTO knowledge_base VALUES ('kb005','Environment Authority Decision 107/2023','esg','EIA clearance mandatory for residential developments exceeding 20 units. Reference format: EIA/YYYY/NNN. Valid 3 years.','Environment Authority Decision 107/2023','2023-07-15','["EIA","environment","assessment"]','2026-08-31');

INSERT OR IGNORE INTO audit_logs VALUES ('al001','u001','Fatima Al-Rashdi','product_manager','PRODUCT_PUBLISHED','product','p001','{"status":"active","product_name":"Standard Home Loan"}','manual',null,null,'10.10.50.15','2024-01-10 09:00:00');
INSERT OR IGNORE INTO audit_logs VALUES ('al002','u001','Fatima Al-Rashdi','product_manager','PRODUCT_PUBLISHED','product','p002','{"status":"active","product_name":"Auto Finance - Personal"}','manual',null,null,'10.10.50.15','2023-06-01 10:00:00');
INSERT OR IGNORE INTO audit_logs VALUES ('al003','u002','Aisha Al-Balushi','compliance_officer','APPLICATION_APPROVED','application','app001','{"reference":"HL-240892","customer":"Mariam Al-Siyabi","amount":250000}','manual',null,'CBO Circular 2024-01','10.10.50.22','2024-09-15 14:30:00');
INSERT OR IGNORE INTO audit_logs VALUES ('al004','u003','Omar Al-Mantheri','risk_officer','CREDIT_REVIEW_APPROVED','application','app001','{"reference":"HL-240892","dbr":46,"ltv":78,"stress_test":"passed"}','manual',null,'CBO Circular 2024-01','10.10.50.33','2024-09-16 11:00:00');
`

// ── Seed/run endpoint ────────────────────────────────────────────────────
// Idempotent seed: applies schema and INSERT OR IGNORE seed data.
// Safe to call on any existing DB — will not overwrite live data.
// Called by the landing-page "Initialize System Data" button after reset-demo.
app.post('/run', async (c) => {
  const db = c.env.DB
  try {
    // Re-apply schema (all IF NOT EXISTS guards — safe on existing DB)
    const schemaSql = SCHEMA_SQL
    const statements = schemaSql.split(';').map(s => s.trim()).filter(s => s.length > 0)
    for (const stmt of statements) {
      try { await db.prepare(stmt).run() } catch (_) { /* ignore already-exists errors */ }
    }

    // Re-apply portal columns (ALTER TABLE — ignore "duplicate column" errors)
    const portalSql = PORTAL_COLUMNS_SQL
    const portalStmts = portalSql.split(';').map(s => s.trim()).filter(s => s.length > 0)
    for (const stmt of portalStmts) {
      try { await db.prepare(stmt).run() } catch (_) { /* duplicate column — safe to ignore */ }
    }

    // Re-apply seed data (INSERT OR IGNORE — won't overwrite existing rows)
    const seedSql = SEED_SQL
    const seedStmts = seedSql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'))
    for (const stmt of seedStmts) {
      try { await db.prepare(stmt).run() } catch (_) { /* ignore duplicate key errors */ }
    }

    return c.json({
      success: true,
      message: 'Seed data applied successfully. All tables and reference data are in place.'
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// ── Demo reset endpoint ───────────────────────────────────────────────────
// Full hard-reset: returns DB to the exact pre-presentation template state.
// All user-created products, applications, threads, and live data are purged.
// Template products (p001-p008) are restored to their seeded values.
app.post('/reset-demo', async (c) => {
  const db = c.env.DB
  const TEMPLATE_PRODUCT_IDS = ['p001','p002','p003','p004','p005','p006','p007','p008']
  const TEMPLATE_PRODUCT_CODES = ['SHL-STANDARD','AFL-PERSONAL','PL-UNSECURED','SME-WORKCAP','HELOC-STANDARD','CPF-COMMERCIAL','EHL-EXPAT','EDU-FINANCE']

  try {
    // ── 1. Delete ALL descendant rows in FK-safe leaf-to-root order ──────
    // Correct FK chain: construction_stages → applications → products
    //                   rules → products
    //                   ai_threads → products
    //                   audit_logs → (products, applications)
    // We MUST delete in leaf→root order to satisfy all FK constraints.
    const idPlaceholders = TEMPLATE_PRODUCT_IDS.map(() => '?').join(',')

    // 1a. construction_stages first (FK: invoice_doc_id → documents, application_id → applications)
    // Delete ALL non-seed construction stages to avoid doc FK
    await db.prepare("DELETE FROM construction_stages WHERE application_id NOT IN ('app001','app002')").run()
    // Also null out invoice_doc_id on any remaining stages that reference non-seed docs
    await db.prepare("UPDATE construction_stages SET invoice_doc_id=NULL WHERE invoice_doc_id IS NOT NULL").run()

    // 1b. documents attached to live applications or EcoVillage project
    await db.prepare("DELETE FROM documents WHERE entity_id NOT IN ('app001','app002','proj001','proj002','proj003','proj004')").run()

    // 1c. applications that reference non-template products (or any live app besides seed 2)
    await db.prepare("DELETE FROM applications WHERE id NOT IN ('app001','app002')").run()

    // 1d. rules.product_id → products.id
    await db.prepare(
      `DELETE FROM rules WHERE product_id IS NOT NULL AND product_id NOT IN (${idPlaceholders})`
    ).bind(...TEMPLATE_PRODUCT_IDS).run()

    // 1e. audit_logs referencing non-template products
    await db.prepare(
      `DELETE FROM audit_logs WHERE entity_type='product' AND entity_id NOT IN (${idPlaceholders})`
    ).bind(...TEMPLATE_PRODUCT_IDS).run()

    // 1f. ai_threads referencing non-template products (table may not exist on fresh DBs)
    try {
      await db.prepare(
        `DELETE FROM ai_threads WHERE product_id IS NOT NULL AND product_id NOT IN (${idPlaceholders})`
      ).bind(...TEMPLATE_PRODUCT_IDS).run()
    } catch(_) { /* ai_threads table may not exist yet */ }

    // ── 2. Now safely delete non-template products ───────────────────────
    await db.prepare(
      `DELETE FROM products WHERE id NOT IN (${idPlaceholders})`
    ).bind(...TEMPLATE_PRODUCT_IDS).run()

    // ── 2. Restore template products to exact seeded field values ────────
    // Reset all mutable fields back to template defaults (realistic per-product-type configs)
    const productResets: [string, any[]][] = [
      // p001 – Standard Home Loan: Omani salaried, secured, LTV 90%, DBR 60%, 5–25yr
      [`UPDATE products SET
          name='Standard Home Loan',
          description='Flagship home financing for Omani nationals and residents. Fixed and variable rate options, top-up facility, and bundled insurance. CBO-compliant with full credit assessment.',
          status='active', base_rate=5.5, max_ltv=90, max_dbr=60, green_dbr=60,
          min_term=5, max_term=25, min_amount=10000, max_amount=500000,
          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,
          ai_confidence_threshold=90, allow_byop=1, allow_partner_inventory=1,
          required_docs='["civil_id","salary_certificate","utility_bill","property_deed","independent_valuation_report","bank_statements_3m","employer_letter"]',
          esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["Fixed and variable rate options","Flexible 5–25 year terms","Top-up facility available","Insurance bundled"]',
          updated_at=datetime('now')
        WHERE id='p001'`, []],
      // p002 – Auto Finance Personal: vehicle-secured, LTV 85%, DBR 55%, 1–7yr, driving license required
      [`UPDATE products SET
          name='Auto Finance – Personal',
          description='Financing for personal vehicles including sedans, SUVs, and electric vehicles. Competitive flat rate, quick 48-hour approval, covers new and used vehicles up to 5 years old.',
          status='active', base_rate=4.9, max_ltv=85, max_dbr=55, green_dbr=55,
          min_term=1, max_term=7, min_amount=3000, max_amount=80000,
          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,
          ai_confidence_threshold=90, allow_byop=0, allow_partner_inventory=0,
          required_docs='["civil_id","salary_certificate","vehicle_proforma_invoice","driving_license","insurance_quotation","bank_statements_3m"]',
          esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["Covers new & used vehicles","48-hour credit decision","EV purchase supported","Comprehensive insurance required"]',
          updated_at=datetime('now')
        WHERE id='p002'`, []],
      // p003 – Personal Loan: unsecured (LTV=0), DBR 45%, 1–5yr, approved employers only
      [`UPDATE products SET
          name='Personal Loan',
          description='Unsecured personal financing for salaried employees of approved employers. No collateral required. Flat competitive rate for medical, travel, home renovation and other personal needs.',
          status='active', base_rate=7.5, max_ltv=0, max_dbr=45, green_dbr=45,
          min_term=1, max_term=5, min_amount=1000, max_amount=30000,
          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,
          ai_confidence_threshold=90, allow_byop=0, allow_partner_inventory=0,
          required_docs='["civil_id","salary_certificate","employer_letter","bank_statements_3m","approved_employer_confirmation"]',
          esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["No collateral required","Approved employer list","Competitive fixed rate","Loan protector insurance available"]',
          updated_at=datetime('now')
        WHERE id='p003'`, []],
      // p004 – SME Working Capital: business-secured, LTV 70%, DBR 65%, 1–3yr, full corporate docs
      [`UPDATE products SET
          name='SME Working Capital',
          description='Short-term working capital facility for small and medium enterprises registered in Oman. Revolving or term structure. Supports payroll, inventory procurement, and operational growth.',
          status='active', base_rate=6.5, max_ltv=70, max_dbr=65, green_dbr=65,
          min_term=1, max_term=3, min_amount=5000, max_amount=200000,
          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,
          ai_confidence_threshold=85, allow_byop=0, allow_partner_inventory=0,
          required_docs='["commercial_registration_certificate","memorandum_of_association","audited_financials_2yr","bank_statements_6m","cr_extract","tax_clearance_certificate","business_profile"]',
          esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["For Oman-registered SMEs","Revolving or term facility","Supports payroll & growth","MOCI-verified CR required"]',
          updated_at=datetime('now')
        WHERE id='p004'`, []],
      // p005 – Home Equity Line: HELOC, LTV 75% (conservative second charge), DBR 55%, 5–15yr
      [`UPDATE products SET
          name='Home Equity Line',
          description='Revolving credit facility secured against existing owned property. Access equity without selling. Ideal for large purchases, education, or business funding. Second charge behind primary mortgage.',
          status='active', base_rate=6.0, max_ltv=75, max_dbr=55, green_dbr=55,
          min_term=5, max_term=15, min_amount=20000, max_amount=300000,
          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,
          ai_confidence_threshold=90, allow_byop=0, allow_partner_inventory=0,
          required_docs='["civil_id","property_title_deed","independent_valuation_report","salary_certificate","bank_statements_3m","existing_mortgage_statement","noc_from_primary_lender"]',
          esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["Use your property equity","Revolving credit line","Up to OMR 300,000","No early settlement penalty"]',
          updated_at=datetime('now')
        WHERE id='p005'`, []],
      // p006 – Commercial Property Finance: corporate, LTV 70%, DBR 65%, 5–20yr, 3yr audited financials
      [`UPDATE products SET
          name='Commercial Property Finance',
          description='Financing for commercial properties including offices, retail units, and warehouses. Available to Omani-registered companies and sole proprietors. Full corporate credit assessment applies.',
          status='active', base_rate=6.8, max_ltv=70, max_dbr=65, green_dbr=65,
          min_term=5, max_term=20, min_amount=50000, max_amount=2000000,
          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,
          ai_confidence_threshold=85, allow_byop=0, allow_partner_inventory=0,
          required_docs='["commercial_registration_certificate","memorandum_of_association","audited_financials_3yr","bank_statements_12m","property_title_deed","independent_valuation_report","lease_agreements","board_resolution"]',
          esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["For offices, retail & warehouses","Up to OMR 2,000,000","Flexible repayment structures","Lease income considered"]',
          updated_at=datetime('now')
        WHERE id='p006'`, []],
      // p007 – Expat Home Finance: CBO LTV cap 75% for non-Omanis, work permit + employer NOC required
      [`UPDATE products SET
          name='Expat Home Finance',
          description='Home financing for expatriate professionals working in Oman. Stricter LTV (max 75%) per CBO regulations. Employer NOC required. Available for IZ-approved freehold zones.',
          status='active', base_rate=6.0, max_ltv=75, max_dbr=55, green_dbr=55,
          min_term=5, max_term=20, min_amount=15000, max_amount=400000,
          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,
          ai_confidence_threshold=90, allow_byop=0, allow_partner_inventory=0,
          required_docs='["civil_id","passport_copy","valid_work_permit_residence_card","salary_certificate","noc_from_employer","property_deed_freehold_zone","independent_valuation_report","bank_statements_6m"]',
          esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["Expatriate professionals","LTV up to 75%","Freehold zone properties","Employer NOC required"]',
          updated_at=datetime('now')
        WHERE id='p007'`, []],
      // p008 – Education Finance: unsecured (LTV=0), DBR 45%, 1–8yr, university docs only
      [`UPDATE products SET
          name='Education Finance',
          description='Financing for higher education expenses including tuition, accommodation, and study materials at approved universities in Oman and abroad. Deferred repayment option available.',
          status='archived', base_rate=8.0, max_ltv=0, max_dbr=45, green_dbr=45,
          min_term=1, max_term=8, min_amount=500, max_amount=20000,
          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,
          ai_confidence_threshold=90, allow_byop=0, allow_partner_inventory=0,
          required_docs='["civil_id","university_offer_letter_or_enrollment","salary_certificate","fee_schedule_from_institution","bank_statements_3m"]',
          esg_required_docs='[]',
          portal_visible=0, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='[]',
          updated_at=datetime('now')
        WHERE id='p008'`, []],
    ]
    for (const [sql, params] of productResets) {
      await db.prepare(sql).bind(...params).run()
    }

    // ── 3. Remove all AI-generated and product-specific rules ────────────
    // Keep only the 14 global template rules (r001-r014, product_id IS NULL)
    await db.prepare("DELETE FROM rules WHERE source='ai_generated' OR product_id IS NOT NULL").run()
    // Also remove any extra rules beyond r001-r014 that crept in
    await db.prepare("DELETE FROM rules WHERE id NOT IN ('r001','r002','r003','r004','r005','r006','r007','r008','r009','r010','r011','r012','r013','r014')").run()

    // ── 4. Clear all AI conversation threads ────────────────────────────
    try { await db.prepare("DELETE FROM ai_threads").run() } catch(_) { /* table may not exist */ }

    // ── 5. Reset projects + units to template state ─────────────────────
    const TEMPLATE_PROJECT_IDS = ['proj001','proj002','proj003','proj004']

    // Null out unit_id on seed applications before deleting any units
    await db.prepare("UPDATE applications SET unit_id=NULL WHERE id IN ('app001','app002')").run()

    // Delete ALL units (template projects get re-seeded below; user projects are purged)
    await db.prepare("DELETE FROM units").run()

    // Delete all user-created projects (keep only template 4)
    await db.prepare(
      `DELETE FROM projects WHERE id NOT IN ('proj001','proj002','proj003','proj004')`
    ).run()
    // Also purge documents for those deleted projects
    await db.prepare(
      `DELETE FROM documents WHERE entity_type='project' AND entity_id NOT IN ('proj001','proj002','proj003','proj004')`
    ).run()

    // ── 5a. Restore/re-seed ALL template project rows (INSERT OR REPLACE) ──
    // proj001 – Al Mouj Residences (active, 36 units, 12 available, 8 reserved, 16 sold)
    await db.prepare(`INSERT OR REPLACE INTO projects VALUES
      ('proj001','d001','Al Mouj Residences','AMR-2024','Al Mouj, Muscat','Muscat','apartment',
       36,12,8,16,78,'Gold','B','EIA/2024/201',
       '{"type":"FeatureCollection","features":[]}',
       'active',1,0,'2024-06-15','2025-11-30',
       1,'/static/img/proj001_hero.jpg',
       'Waterfront living with premium amenities in the heart of Muscat',
       95000,185000,NULL,
       '["Swimming Pool","Gym","24/7 Security","Covered Parking","Children''s Play Area"]')`).run()

    // proj002 – Seeb Heights Villas (active, 18 units all available)
    await db.prepare(`INSERT OR REPLACE INTO projects VALUES
      ('proj002','d001','Seeb Heights Villas','SHV-2025','Airport Heights, Seeb','Muscat','villa',
       18,18,0,0,82,'Gold','A',NULL,
       '{"type":"FeatureCollection","features":[]}',
       'active',1,0,'2025-01-10','2025-12-01',
       1,'/static/img/proj002_hero.jpg',
       'Spacious villas with panoramic views near Muscat International Airport',
       145000,220000,NULL,
       '["Private Garden","Rooftop Terrace","Central A/C","Smart Home","Visitor Parking"]')`).run()

    // proj003 – Mabella View Apartments (archived, 60 sold)
    await db.prepare(`INSERT OR REPLACE INTO projects VALUES
      ('proj003','d001','Mabella View Apartments','MVA-2023','Mabella, Muscat','Muscat','apartment',
       60,0,0,60,NULL,NULL,NULL,NULL,
       '{"type":"FeatureCollection","features":[]}',
       'archived',0,0,'2023-05-01','2025-06-30',
       0,'/static/img/proj003_hero.jpg',
       NULL,NULL,NULL,NULL,'[]')`).run()

    // proj004 – EcoVillage Muscat Phase 1 (draft, upcoming — reset to blank)
    await db.prepare(`INSERT OR REPLACE INTO projects VALUES
      ('proj004','d001','EcoVillage Muscat','EVM-2026','Seeb, Muscat Governorate','Muscat','villa',
       24,0,0,0,NULL,NULL,NULL,NULL,
       '{"type":"FeatureCollection","features":[]}',
       'draft',0,0,'2026-08-31','2026-08-31',
       0,'/static/img/proj004_hero.jpg',
       NULL,NULL,NULL,NULL,'[]')`).run()

    // ── 5b. Re-seed units for template projects ──────────────────────────
    // proj001 – Al Mouj Residences: 36 units, spread across Al Mouj waterfront area
    const proj001Units = [
      // Available (12)
      ['unit-a001','proj001','A-101','apartment',95,2,2,95000,23.5955,58.5810,'available'],
      ['unit-a002','proj001','A-102','apartment',98,2,2,98000,23.5958,58.5815,'available'],
      ['unit-a003','proj001','A-103','apartment',102,2,2,102000,23.5961,58.5820,'available'],
      ['unit-a004','proj001','B-201','apartment',118,3,2,120000,23.5964,58.5825,'available'],
      ['unit-a005','proj001','B-202','apartment',120,3,2,125000,23.5967,58.5830,'available'],
      ['unit-a006','proj001','B-203','apartment',122,3,2,128000,23.5970,58.5835,'available'],
      ['unit-a007','proj001','C-301','apartment',145,3,3,148000,23.5973,58.5840,'available'],
      ['unit-a008','proj001','C-302','apartment',148,3,3,152000,23.5976,58.5845,'available'],
      ['unit-a009','proj001','D-401','apartment',165,4,3,162000,23.5979,58.5850,'available'],
      ['unit-a010','proj001','D-402','apartment',168,4,3,168000,23.5982,58.5855,'available'],
      ['unit-a011','proj001','E-501','apartment',180,4,3,175000,23.5985,58.5860,'available'],
      ['unit-a012','proj001','E-502','apartment',182,4,3,180000,23.5988,58.5865,'available'],
      // Reserved (8)
      ['unit-a013','proj001','A-104','apartment',95,2,2,97000,23.5958,58.5808,'reserved'],
      ['unit-a014','proj001','A-105','apartment',98,2,2,100000,23.5961,58.5812,'reserved'],
      ['unit-a015','proj001','B-204','apartment',118,3,2,122000,23.5964,58.5818,'reserved'],
      ['unit-a016','proj001','B-205','apartment',120,3,2,126000,23.5967,58.5822,'reserved'],
      ['unit-a017','proj001','C-303','apartment',145,3,3,150000,23.5970,58.5828,'reserved'],
      ['unit-a018','proj001','C-304','apartment',148,3,3,155000,23.5973,58.5832,'reserved'],
      ['unit-a019','proj001','D-403','apartment',165,4,3,165000,23.5976,58.5838,'reserved'],
      ['unit-a020','proj001','D-404','apartment',168,4,3,170000,23.5979,58.5842,'reserved'],
      // Sold (16)
      ['unit-a021','proj001','A-106','apartment',95,2,2,94000,23.5955,58.5805,'sold'],
      ['unit-a022','proj001','A-107','apartment',98,2,2,97000,23.5957,58.5802,'sold'],
      ['unit-a023','proj001','A-108','apartment',100,2,2,99000,23.5959,58.5799,'sold'],
      ['unit-a024','proj001','B-206','apartment',118,3,2,120000,23.5962,58.5796,'sold'],
      ['unit-a025','proj001','B-207','apartment',120,3,2,122000,23.5964,58.5793,'sold'],
      ['unit-a026','proj001','B-208','apartment',122,3,2,124000,23.5966,58.5790,'sold'],
      ['unit-a027','proj001','C-305','apartment',145,3,3,146000,23.5968,58.5787,'sold'],
      ['unit-a028','proj001','C-306','apartment',148,3,3,150000,23.5970,58.5784,'sold'],
      ['unit-a029','proj001','C-307','apartment',150,3,3,152000,23.5972,58.5781,'sold'],
      ['unit-a030','proj001','D-405','apartment',165,4,3,162000,23.5974,58.5778,'sold'],
      ['unit-a031','proj001','D-406','apartment',168,4,3,165000,23.5976,58.5775,'sold'],
      ['unit-a032','proj001','E-503','apartment',180,4,3,172000,23.5978,58.5772,'sold'],
      ['unit-a033','proj001','E-504','apartment',182,4,3,176000,23.5980,58.5769,'sold'],
      ['unit-a034','proj001','F-601','apartment',185,4,3,182000,23.5982,58.5766,'sold'],
      ['unit-a035','proj001','F-602','apartment',188,4,3,184000,23.5984,58.5763,'sold'],
      ['unit-a036','proj001','F-603','apartment',190,4,3,185000,23.5986,58.5760,'sold'],
    ]
    for (const u of proj001Units) {
      await db.prepare(`INSERT OR IGNORE INTO units
        (id,project_id,unit_number,type,area_sqm,bedrooms,bathrooms,price,lat,lng,status,features,gsas_score,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`)
        .bind(u[0],u[1],u[2],u[3],u[4],u[5],u[6],u[7],u[8],u[9],u[10],'["Swimming Pool","Gym","24/7 Security"]',78).run()
    }

    // proj002 – Seeb Heights Villas: 18 villas all available
    const proj002Units = [
      ['unit-b001','proj002','V-001','villa',280,4,3,145000,23.5985,58.4750,'available'],
      ['unit-b002','proj002','V-002','villa',285,4,3,148000,23.5990,58.4755,'available'],
      ['unit-b003','proj002','V-003','villa',290,4,3,152000,23.5995,58.4760,'available'],
      ['unit-b004','proj002','V-004','villa',295,4,3,155000,23.6000,58.4765,'available'],
      ['unit-b005','proj002','V-005','villa',300,5,4,162000,23.6005,58.4770,'available'],
      ['unit-b006','proj002','V-006','villa',305,5,4,165000,23.6010,58.4775,'available'],
      ['unit-b007','proj002','V-007','villa',310,5,4,170000,23.6015,58.4780,'available'],
      ['unit-b008','proj002','V-008','villa',315,5,4,175000,23.6020,58.4785,'available'],
      ['unit-b009','proj002','V-009','villa',280,4,3,148000,23.5985,58.4758,'available'],
      ['unit-b010','proj002','V-010','villa',285,4,3,150000,23.5990,58.4763,'available'],
      ['unit-b011','proj002','V-011','villa',290,4,3,155000,23.5995,58.4768,'available'],
      ['unit-b012','proj002','V-012','villa',295,4,3,158000,23.6000,58.4773,'available'],
      ['unit-b013','proj002','V-013','villa',300,5,4,165000,23.6005,58.4778,'available'],
      ['unit-b014','proj002','V-014','villa',305,5,4,168000,23.6010,58.4783,'available'],
      ['unit-b015','proj002','V-015','villa',310,5,4,172000,23.6015,58.4788,'available'],
      ['unit-b016','proj002','V-016','villa',315,5,4,178000,23.6020,58.4793,'available'],
      ['unit-b017','proj002','V-017','villa',320,5,4,185000,23.6025,58.4798,'available'],
      ['unit-b018','proj002','V-018','villa',325,5,4,220000,23.6030,58.4803,'available'],
    ]
    for (const u of proj002Units) {
      await db.prepare(`INSERT OR IGNORE INTO units
        (id,project_id,unit_number,type,area_sqm,bedrooms,bathrooms,price,lat,lng,status,features,gsas_score,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`)
        .bind(u[0],u[1],u[2],u[3],u[4],u[5],u[6],u[7],u[8],u[9],u[10],'["Private Garden","Rooftop Terrace","Smart Home"]',82).run()
    }

    // proj003 – Mabella View (archived, all 60 sold — just 6 representative pins)
    const proj003Units = [
      ['unit-c001','proj003','M-101','apartment',75,2,1,62000,23.5830,58.5540,'sold'],
      ['unit-c002','proj003','M-102','apartment',78,2,1,64000,23.5835,58.5545,'sold'],
      ['unit-c003','proj003','M-201','apartment',90,3,2,72000,23.5840,58.5550,'sold'],
      ['unit-c004','proj003','M-202','apartment',92,3,2,74000,23.5845,58.5555,'sold'],
      ['unit-c005','proj003','M-301','apartment',105,3,2,82000,23.5850,58.5560,'sold'],
      ['unit-c006','proj003','M-302','apartment',108,3,2,85000,23.5855,58.5565,'sold'],
    ]
    for (const u of proj003Units) {
      await db.prepare(`INSERT OR IGNORE INTO units
        (id,project_id,unit_number,type,area_sqm,bedrooms,bathrooms,price,lat,lng,status,features,gsas_score,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`)
        .bind(u[0],u[1],u[2],u[3],u[4],u[5],u[6],u[7],u[8],u[9],u[10],'[]',null).run()
    }

    // ── 6. Restore seed applications to exact template state ─────────────
    // app001 may have had unit_id/project assigned during live demo; restore to template.
    await db.prepare(`INSERT OR REPLACE INTO applications VALUES
      ('app001','HL-240892','p001','c002','Mariam Al-Siyabi',NULL,'proj001',
       250000,20,'Al Mouj Residences, Unit A12, Muscat','partner',142,NULL,NULL,
       5.5,5.5,1608.82,1608.82,0,46,78,9.0,1,780,'approved','verified',
       'u002','2024-09-15','u003','2024-09-16',250000,0,NULL,NULL,
       '2024-09-14','2024-09-16')`).run()
    await db.prepare(`INSERT OR REPLACE INTO applications VALUES
      ('app002','HL-241156','p001','c003','Hassan Al-Amri',NULL,NULL,
       120000,15,'Plot 45, Al Ghubra North, Muscat','byop',200,NULL,NULL,
       5.5,5.5,980.12,980.12,0,36,72,9.0,1,710,'credit_review','pending',
       NULL,NULL,NULL,NULL,120000,0,NULL,NULL,
       '2024-12-01','2024-12-03')`).run()

    // ── 7. Reset audit logs to only the 4 background template entries ────
    await db.prepare("DELETE FROM audit_logs WHERE id NOT IN ('al001','al002','al003','al004')").run()
    // Restore the 4 template audit logs in case they were modified
    await db.prepare(`INSERT OR REPLACE INTO audit_logs VALUES
      ('al001','u001','Fatima Al-Rashdi','product_manager','PRODUCT_PUBLISHED','product','p001','{"status":"active","product_name":"Standard Home Loan"}','manual',NULL,NULL,'10.10.50.15','2024-01-10 09:00:00')`).run()
    await db.prepare(`INSERT OR REPLACE INTO audit_logs VALUES
      ('al002','u001','Fatima Al-Rashdi','product_manager','PRODUCT_PUBLISHED','product','p002','{"status":"active","product_name":"Auto Finance – Personal"}','manual',NULL,NULL,'10.10.50.15','2023-06-01 10:00:00')`).run()
    await db.prepare(`INSERT OR REPLACE INTO audit_logs VALUES
      ('al003','u002','Aisha Al-Balushi','compliance_officer','APPLICATION_APPROVED','application','app001','{"reference":"HL-240892","customer":"Mariam Al-Siyabi","amount":250000}','manual',NULL,'CBO Circular 2024-01','10.10.50.22','2024-09-15 14:30:00')`).run()
    await db.prepare(`INSERT OR REPLACE INTO audit_logs VALUES
      ('al004','u003','Omar Al-Mantheri','risk_officer','CREDIT_REVIEW_APPROVED','application','app001','{"reference":"HL-240892","dbr":46,"ltv":78,"stress_test":"passed"}','manual',NULL,'CBO Circular 2024-01','10.10.50.33','2024-09-16 11:00:00')`).run()

    // Re-enable FK enforcement
    await db.prepare("PRAGMA foreign_keys = ON").run()

    return c.json({
      success: true,
      message: 'System fully reset to template state. All demo-created products, applications, threads, and live data removed. Ready for a fresh run.'
    })
  } catch (e: any) {
    // Make sure FK enforcement is re-enabled even on error
    try { await (c.env.DB).prepare("PRAGMA foreign_keys = ON").run() } catch(_) {}
    return c.json({ success: false, error: e.message }, 500)
  }
})

export { app as seedApi }
