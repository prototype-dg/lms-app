import { Hono } from 'hono'

type Bindings = { DB: D1Database; DEMO_MODE: string }
const app = new Hono<{ Bindings: Bindings }>()

// Run all migrations to seed DB
app.post('/run', async (c) => {
  const db = c.env.DB
  try {
    // Read SQL from built-in seed data
    const migrations = getSeedSQL()
    const statements = migrations
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 10 && !s.startsWith('--'))

    let count = 0
    for (const stmt of statements) {
      try {
        await db.prepare(stmt).run()
        count++
      } catch (e: any) {
        // Ignore duplicate key errors
        if (!e.message?.includes('UNIQUE') && !e.message?.includes('already exists')) {
          console.error('Migration error:', e.message, stmt.substring(0, 100))
        }
      }
    }
    return c.json({ success: true, executed: count })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

function getSeedSQL(): string {
  // Embedded schema + seed data
  return SCHEMA_SQL + '\n' + SEED_SQL
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE, description TEXT,
  category TEXT DEFAULT 'home_loan', status TEXT DEFAULT 'draft',
  base_rate REAL DEFAULT 5.5, max_ltv INTEGER DEFAULT 90, max_dbr INTEGER DEFAULT 60,
  green_dbr INTEGER DEFAULT 55, min_term INTEGER DEFAULT 5, max_term INTEGER DEFAULT 25,
  min_amount REAL DEFAULT 10000, max_amount REAL DEFAULT 500000,
  gsas_min_score INTEGER DEFAULT 70, gsas_premium_score INTEGER DEFAULT 85,
  green_discount_premium REAL DEFAULT 0.75, green_discount_standard REAL DEFAULT 0.5,
  ai_confidence_threshold INTEGER DEFAULT 90, allow_byop INTEGER DEFAULT 1,
  allow_partner_inventory INTEGER DEFAULT 1,
  required_docs TEXT DEFAULT '[]', esg_required_docs TEXT DEFAULT '[]',
  approved_materials TEXT DEFAULT '[]', approved_vendors TEXT DEFAULT '[]',
  configuration TEXT DEFAULT '{}', applications_ytd INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'system', created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
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

INSERT OR IGNORE INTO products VALUES ('p001','Standard Home Loan',null,'Standard Home Loan','Our flagship home financing product for Omani nationals and residents.','home_loan','active',5.5,90,60,60,5,25,10000,500000,0,0,0,0,90,1,1,'["salary_cert","utility_bill","civil_id","property_deed"]','[]','[]','[]','{"applications_ytd":4847}',4847,'u001','2024-01-10','2025-12-15');
INSERT OR IGNORE INTO products VALUES ('p002','Auto Finance – Personal',null,'Auto Finance - Personal','Financing for personal vehicles.','auto_loan','active',4.9,85,55,55,1,7,3000,80000,0,0,0,0,90,0,0,'["salary_cert","civil_id","vehicle_proforma"]','[]','[]','[]','{}',1923,'u001','2023-06-01','2025-11-20');
INSERT OR IGNORE INTO products VALUES ('p003','Personal Loan',null,'Personal Loan','Unsecured personal financing.','personal_loan','active',7.5,0,50,50,1,5,1000,30000,0,0,0,0,90,0,0,'["salary_cert","civil_id","employer_letter"]','[]','[]','[]','{}',3241,'u001','2023-01-15','2025-10-01');
INSERT OR IGNORE INTO products VALUES ('p004','SME Working Capital',null,'SME Working Capital Finance','Working capital for SMEs.','sme','active',6.5,70,65,65,1,3,5000,200000,0,0,0,0,85,0,0,'["cr_certificate","audited_financials","bank_statements"]','[]','[]','[]','{}',892,'u001','2023-08-10','2025-09-15');
INSERT OR IGNORE INTO products VALUES ('p005','Home Equity Line',null,'Home Equity Line of Credit','Revolving credit against property.','home_loan','active',6.0,75,55,55,5,15,20000,300000,0,0,0,0,90,0,0,'["property_title","valuation_report","civil_id"]','[]','[]','[]','{}',567,'u001','2024-03-01','2025-08-20');
INSERT OR IGNORE INTO products VALUES ('p006','Commercial Property Finance',null,'Commercial Property Finance','Commercial property financing.','commercial','active',6.8,70,65,65,5,20,50000,2000000,0,0,0,0,85,0,0,'["cr_certificate","audited_financials","property_title"]','[]','[]','[]','{}',234,'u001','2023-09-01','2025-07-10');
INSERT OR IGNORE INTO products VALUES ('p007','Expat Home Finance',null,'Expatriate Home Finance','Home financing for expatriates.','home_loan','active',6.0,75,55,55,5,20,15000,400000,0,0,0,0,90,0,0,'["work_permit","salary_cert","civil_id","property_deed"]','[]','[]','[]','{}',1102,'u001','2024-01-20','2025-12-01');
INSERT OR IGNORE INTO products VALUES ('p008','Education Finance',null,'Education Finance','Education expense financing.','education','archived',8.0,0,45,45,1,8,500,20000,0,0,0,0,90,0,0,'["civil_id","university_offer_letter"]','[]','[]','[]','{}',445,'u001','2022-01-01','2024-06-01');
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

INSERT OR IGNORE INTO projects VALUES ('proj001','d001','Al Mouj Residences','AMR-2024','Al Mouj, Muscat','Muscat','apartment',36,12,8,16,78,'Gold','B','EIA/2024/201','{"type":"FeatureCollection","features":[]}','active',1,0,'2024-06-15','2025-11-30');
INSERT OR IGNORE INTO projects VALUES ('proj002','d001','Seeb Heights Villas','SHV-2025','Airport Heights, Seeb','Muscat','villa',18,18,0,0,82,'Gold','A',null,'{"type":"FeatureCollection","features":[]}','active',1,0,'2025-01-10','2025-12-01');
INSERT OR IGNORE INTO projects VALUES ('proj003','d001','Mabella View Apartments','MVA-2023','Mabella, Muscat','Muscat','apartment',60,0,0,60,null,null,null,null,'{"type":"FeatureCollection","features":[]}','archived',0,0,'2023-05-01','2025-06-30');
INSERT OR IGNORE INTO projects VALUES ('proj004','d001','EcoVillage Muscat','EVM-2026','Seeb, Muscat Governorate','Muscat','villa',24,0,0,0,null,null,null,null,'{"type":"FeatureCollection","features":[]}','draft',0,0,'2026-08-31','2026-08-31');

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

// ── Demo reset endpoint ───────────────────────────────────────────────────
// Full hard-reset: returns DB to the exact pre-presentation template state.
// All user-created products, applications, threads, and live data are purged.
// Template products (p001-p008) are restored to their seeded values.
app.post('/reset-demo', async (c) => {
  const db = c.env.DB
  const TEMPLATE_PRODUCT_IDS = ['p001','p002','p003','p004','p005','p006','p007','p008']
  const TEMPLATE_PRODUCT_CODES = ['SHL-STANDARD','AFL-PERSONAL','PL-UNSECURED','SME-WORKCAP','HELOC-STANDARD','CPF-COMMERCIAL','EHL-EXPAT','EDU-FINANCE']

  try {
    // ── 1. Delete ALL child rows that reference non-template products ─────
    // Must happen BEFORE deleting the products themselves (FK constraints).
    // Uses NOT IN on the template ID list so template products' children survive.
    const idPlaceholders = TEMPLATE_PRODUCT_IDS.map(() => '?').join(',')

    // rules.product_id → products.id
    await db.prepare(
      `DELETE FROM rules WHERE product_id IS NOT NULL AND product_id NOT IN (${idPlaceholders})`
    ).bind(...TEMPLATE_PRODUCT_IDS).run()

    // audit_logs referencing non-template products
    await db.prepare(
      `DELETE FROM audit_logs WHERE entity_type='product' AND entity_id NOT IN (${idPlaceholders})`
    ).bind(...TEMPLATE_PRODUCT_IDS).run()

    // ai_threads referencing non-template products
    await db.prepare(
      `DELETE FROM ai_threads WHERE product_id IS NOT NULL AND product_id NOT IN (${idPlaceholders})`
    ).bind(...TEMPLATE_PRODUCT_IDS).run()

    // ── 2. Now safely delete non-template products ───────────────────────
    await db.prepare(
      `DELETE FROM products WHERE id NOT IN (${idPlaceholders})`
    ).bind(...TEMPLATE_PRODUCT_IDS).run()

    // ── 2. Restore template products to exact seeded field values ────────
    // Reset all mutable fields back to template defaults
    const productResets: [string, any[]][] = [
      [`UPDATE products SET
          name='Standard Home Loan', description='Our flagship home financing product for Omani nationals and residents. Competitive rates with flexible terms.',
          status='active', base_rate=5.5, max_ltv=90, max_dbr=60, green_dbr=60, min_term=5, max_term=25,
          min_amount=10000, max_amount=500000, gsas_min_score=0, gsas_premium_score=0,
          green_discount_premium=0, green_discount_standard=0, ai_confidence_threshold=90,
          required_docs='["salary_cert","utility_bill","civil_id","property_deed","valuation_report"]',
          esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["Fixed and variable rate options","Flexible 5–25 year terms","Top-up facility available","Insurance bundled"]',
          updated_at=datetime('now')
        WHERE id='p001'`, []],
      [`UPDATE products SET
          name='Auto Finance – Personal', status='active', base_rate=4.9, max_ltv=85, max_dbr=55, min_term=1, max_term=7,
          min_amount=3000, max_amount=80000, esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["Covers sedans, SUVs & EVs","Quick 48-hour approval","Flexible 1–7 year terms"]',
          updated_at=datetime('now')
        WHERE id='p002'`, []],
      [`UPDATE products SET
          name='Personal Loan', status='active', base_rate=7.5, max_dbr=50, min_term=1, max_term=5,
          min_amount=1000, max_amount=30000, esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["No collateral required","Approved employer list","Competitive fixed rate"]',
          updated_at=datetime('now')
        WHERE id='p003'`, []],
      [`UPDATE products SET
          name='SME Working Capital', status='active', base_rate=6.5, max_ltv=70, max_dbr=65, min_term=1, max_term=3,
          min_amount=5000, max_amount=200000, esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["For SMEs registered in Oman","Revolving or term facility","Supports growth & payroll"]',
          updated_at=datetime('now')
        WHERE id='p004'`, []],
      [`UPDATE products SET
          name='Home Equity Line', status='active', base_rate=6.0, max_ltv=75, max_dbr=55, min_term=5, max_term=15,
          min_amount=20000, max_amount=300000, esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["Use your property equity","Revolving credit line","Up to OMR 300,000"]',
          updated_at=datetime('now')
        WHERE id='p005'`, []],
      [`UPDATE products SET
          name='Commercial Property Finance', status='active', base_rate=6.8, max_ltv=70, max_dbr=65, min_term=5, max_term=20,
          min_amount=50000, max_amount=2000000, esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["For offices, retail & warehouses","Up to OMR 2,000,000","Flexible repayment structures"]',
          updated_at=datetime('now')
        WHERE id='p006'`, []],
      [`UPDATE products SET
          name='Expat Home Finance', status='active', base_rate=6.0, max_ltv=75, max_dbr=55, min_term=5, max_term=20,
          min_amount=15000, max_amount=400000, esg_required_docs='[]',
          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,
          portal_highlights='["For expatriate professionals","Competitive rates from 6%","Up to OMR 400,000"]',
          updated_at=datetime('now')
        WHERE id='p007'`, []],
      [`UPDATE products SET
          name='Education Finance', status='archived', base_rate=8.0, max_dbr=45, min_term=1, max_term=8,
          min_amount=500, max_amount=20000, esg_required_docs='[]',
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
    await db.prepare("DELETE FROM ai_threads").run()

    // ── 5. Remove all user-created applications and their dependants ─────
    // Keep only app001 and app002 (the two background seed applications)
    await db.prepare("DELETE FROM construction_stages WHERE application_id NOT IN ('app001','app002')").run()
    await db.prepare("DELETE FROM documents WHERE entity_id NOT IN ('app001','app002','proj001','proj002','proj003','proj004')").run()
    await db.prepare("DELETE FROM applications WHERE id NOT IN ('app001','app002')").run()

    // ── 6. Reset EcoVillage back to draft / hidden ──────────────────────
    await db.prepare(`UPDATE projects SET
        status='draft', listing_visible=0, green_eligible=0, premium_tier=0,
        gsas_score=NULL, gsas_rating=NULL, epc_rating=NULL, eia_reference=NULL,
        total_units=24, available_units=0, reserved_units=0, sold_units=0,
        marketing_tagline=NULL, hero_image_url=NULL, completion_date=NULL,
        updated_at=datetime('now')
      WHERE id='proj004'`).run()

    // Remove EcoVillage units and documents (uploaded live in Act 2)
    await db.prepare("DELETE FROM units WHERE project_id='proj004'").run()
    await db.prepare("DELETE FROM documents WHERE entity_id='proj004'").run()

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

    return c.json({
      success: true,
      message: 'System fully reset to template state. All demo-created products, applications, threads, and live data removed. Ready for a fresh run.'
    })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

export { app as seedApi }
