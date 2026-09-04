-- ============================================================
-- Migration 0005: Product Genesis Engine Foundation
-- ============================================================
-- New tables: markets, product_versions, rule_matrices,
--             compliance_tags, workflow_templates
-- Extends: products (market_id, schema), ai_threads (product_id FK)
-- Seed: Oman market with full regulatory profile
-- ============================================================

-- ── Markets ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  name_ar                 TEXT,
  code                    TEXT UNIQUE NOT NULL,
  country                 TEXT NOT NULL,
  country_code            TEXT NOT NULL,         -- ISO 3166-1 alpha-2
  currency_code           TEXT NOT NULL,
  currency_name           TEXT NOT NULL,
  currency_name_ar        TEXT,
  currency_symbol         TEXT NOT NULL,
  regulator_name          TEXT NOT NULL,
  regulator_name_ar       TEXT,
  regulator_full_name     TEXT NOT NULL,
  regulator_full_name_ar  TEXT,
  locale                  TEXT DEFAULT 'en',
  rtl_supported           INTEGER DEFAULT 1,
  -- Hidden regulatory defaults (populated by LLM, not shown to users)
  regulatory_defaults     TEXT DEFAULT '{}',     -- JSON: DBR, LTV, thresholds etc.
  -- Market status
  status                  TEXT CHECK(status IN ('active','draft','archived')) DEFAULT 'active',
  is_default              INTEGER DEFAULT 0,
  created_by              TEXT DEFAULT 'system',
  created_at              TEXT DEFAULT (datetime('now')),
  updated_at              TEXT DEFAULT (datetime('now'))
);

-- ── Extend products table ────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN market_id TEXT REFERENCES markets(id);
ALTER TABLE products ADD COLUMN schema TEXT DEFAULT '{}';
ALTER TABLE products ADD COLUMN pge_stage INTEGER DEFAULT 0;  -- highest completed stage (0–6)
ALTER TABLE products ADD COLUMN pge_stage_data TEXT DEFAULT '{}';  -- per-stage completion metadata

-- ── Product Versions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_versions (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES products(id),
  version_number  INTEGER NOT NULL,
  stage           INTEGER NOT NULL,              -- stage that was completed (1–6)
  stage_name      TEXT NOT NULL,
  snapshot        TEXT NOT NULL,                 -- full product JSON at time of snapshot
  commit_message  TEXT,                          -- AI-generated description of changes
  created_by      TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_by_role TEXT NOT NULL,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_versions_product ON product_versions(product_id, version_number);

-- ── Rule Matrices ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rule_matrices (
  id                  TEXT PRIMARY KEY,
  product_id          TEXT REFERENCES products(id),
  market_id           TEXT REFERENCES markets(id),
  name                TEXT NOT NULL,
  name_ar             TEXT,
  description         TEXT,
  description_ar      TEXT,
  -- Dimension definitions
  row_dimension       TEXT NOT NULL,             -- e.g. "ltv_band"
  row_dimension_label TEXT NOT NULL,             -- e.g. "LTV Band"
  row_dimension_ar    TEXT,
  col_dimension       TEXT,                      -- null for single-dimension matrices
  col_dimension_label TEXT,
  col_dimension_ar    TEXT,
  -- The grid itself: JSON array of {row_key, col_key, value, label}
  grid_data           TEXT DEFAULT '[]',
  -- Output type
  output_metric       TEXT NOT NULL,             -- e.g. "rate_adjustment", "max_ltv", "approval_action"
  output_unit         TEXT,                      -- e.g. "%", "OMR", "boolean"
  -- Meta
  is_active           INTEGER DEFAULT 1,
  regulatory_reference TEXT,
  source              TEXT CHECK(source IN ('manual','ai_generated','cloned')) DEFAULT 'manual',
  ai_confidence       REAL,
  created_by          TEXT DEFAULT 'system',
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rule_matrices_product ON rule_matrices(product_id);

-- ── Compliance Tags ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_tags (
  id                    TEXT PRIMARY KEY,
  market_id             TEXT REFERENCES markets(id),
  code                  TEXT NOT NULL,            -- e.g. "CBO_DBR_CAP"
  name                  TEXT NOT NULL,
  name_ar               TEXT,
  description           TEXT,
  description_ar        TEXT,
  category              TEXT NOT NULL,            -- e.g. "credit_risk", "esg", "consumer_protection"
  regulatory_reference  TEXT,                     -- e.g. "CBO BM 1117 Section 4.2"
  severity              TEXT CHECK(severity IN ('mandatory','recommended','informational')) DEFAULT 'mandatory',
  applies_to            TEXT DEFAULT '[]',        -- JSON array of product categories it applies to
  is_active             INTEGER DEFAULT 1,
  created_at            TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_compliance_tags_market ON compliance_tags(market_id, category);

-- ── Product ↔ Compliance Tag mapping ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_compliance_tags (
  product_id  TEXT REFERENCES products(id),
  tag_id      TEXT REFERENCES compliance_tags(id),
  mapped_at   TEXT DEFAULT (datetime('now')),
  mapped_by   TEXT,
  PRIMARY KEY (product_id, tag_id)
);

-- ── Workflow Templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_templates (
  id            TEXT PRIMARY KEY,
  market_id     TEXT REFERENCES markets(id),
  name          TEXT NOT NULL,
  name_ar       TEXT,
  description   TEXT,
  description_ar TEXT,
  category      TEXT,                             -- e.g. "home_loan", "auto_loan", "general"
  nodes         TEXT DEFAULT '[]',               -- JSON: [{id, type, x, y, label, config}]
  edges         TEXT DEFAULT '[]',               -- JSON: [{id, from, to, label, condition}]
  is_system     INTEGER DEFAULT 0,               -- system templates cannot be deleted
  is_active     INTEGER DEFAULT 1,
  created_by    TEXT DEFAULT 'system',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ── Product → active workflow template ───────────────────────────────────────
ALTER TABLE products ADD COLUMN workflow_template_id TEXT REFERENCES workflow_templates(id);
ALTER TABLE products ADD COLUMN workflow_nodes TEXT DEFAULT '[]';   -- product-specific overrides
ALTER TABLE products ADD COLUMN workflow_edges TEXT DEFAULT '[]';

-- ── Extend ai_threads with product_id index (column already exists from 0003) ─
CREATE INDEX IF NOT EXISTS idx_ai_threads_product ON ai_threads(product_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Oman Market ───────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO markets (
  id, name, name_ar, code, country, country_code,
  currency_code, currency_name, currency_name_ar, currency_symbol,
  regulator_name, regulator_name_ar, regulator_full_name, regulator_full_name_ar,
  locale, rtl_supported,
  regulatory_defaults,
  status, is_default, created_by
) VALUES (
  'mkt001',
  'Oman',
  'عُمان',
  'OM',
  'Oman',
  'OM',
  'OMR',
  'Omani Rial',
  'ريال عُماني',
  'ر.ع.',
  'CBO',
  'البنك المركزي العُماني',
  'Central Bank of Oman',
  'البنك المركزي العُماني',
  'en',
  1,
  json('{
    "default_max_dbr": 60,
    "default_green_dbr": 55,
    "default_max_ltv": 90,
    "default_max_ltv_expat": 75,
    "default_max_term_years": 25,
    "default_min_term_years": 1,
    "default_base_rate": 5.5,
    "default_ai_confidence_threshold": 90,
    "gsas_standard_threshold": 70,
    "gsas_premium_threshold": 85,
    "green_discount_standard_pct": 0.5,
    "green_discount_premium_pct": 0.75,
    "stress_test_rate": 9.0,
    "min_malaa_score": 650,
    "regulatory_framework": "CBO BM 1117",
    "esg_framework": "GSAS / OEESC",
    "date_format": "DD/MM/YYYY",
    "number_format": "1,234.56",
    "max_finance_amount": 2000000,
    "min_finance_amount": 1000
  }'),
  'active',
  1,
  'system'
);

-- ── Assign all existing products to Oman market ───────────────────────────────
UPDATE products SET market_id = 'mkt001' WHERE market_id IS NULL;

-- ── Default Workflow Template: Standard Home Loan ─────────────────────────────
INSERT OR IGNORE INTO workflow_templates (
  id, market_id, name, name_ar, description, category,
  nodes, edges, is_system, is_active, created_by
) VALUES (
  'wft001',
  'mkt001',
  'Standard Loan Approval',
  'موافقة القرض المعياري',
  'Default approval workflow for retail lending products',
  'home_loan',
  json('[
    {"id":"n1","type":"start","x":80,"y":200,"label":"Application Submitted","label_ar":"تقديم الطلب","role":null},
    {"id":"n2","type":"task","x":280,"y":200,"label":"Credit Scoring","label_ar":"التقييم الائتماني","role":"system","auto":true},
    {"id":"n3","type":"task","x":480,"y":120,"label":"ESG Review","label_ar":"مراجعة معايير ESG","role":"compliance_officer","auto":false},
    {"id":"n4","type":"task","x":480,"y":280,"label":"Credit Review","label_ar":"مراجعة الائتمان","role":"risk_officer","auto":false},
    {"id":"n5","type":"gateway","x":680,"y":200,"label":"Dual Approval","label_ar":"موافقة مزدوجة","gate_type":"parallel"},
    {"id":"n6","type":"task","x":880,"y":200,"label":"Disbursement","label_ar":"الصرف","role":"operations","auto":false},
    {"id":"n7","type":"end","x":1080,"y":200,"label":"Completed","label_ar":"مكتمل","role":null}
  ]'),
  json('[
    {"id":"e1","from":"n1","to":"n2","label":""},
    {"id":"e2","from":"n2","to":"n3","label":"Auto-pass"},
    {"id":"e3","from":"n2","to":"n4","label":"Auto-pass"},
    {"id":"e4","from":"n3","to":"n5","label":"ESG Approved"},
    {"id":"e5","from":"n4","to":"n5","label":"Credit Approved"},
    {"id":"e6","from":"n5","to":"n6","label":"Both Approved"},
    {"id":"e7","from":"n6","to":"n7","label":"Disbursed"}
  ]'),
  1,
  1,
  'system'
);

INSERT OR IGNORE INTO workflow_templates (
  id, market_id, name, name_ar, description, category,
  nodes, edges, is_system, is_active, created_by
) VALUES (
  'wft002',
  'mkt001',
  'Express Auto Finance',
  'تمويل السيارات السريع',
  'Streamlined workflow for auto finance — auto-scoring, single credit review',
  'auto_loan',
  json('[
    {"id":"n1","type":"start","x":80,"y":200,"label":"Application Submitted","label_ar":"تقديم الطلب","role":null},
    {"id":"n2","type":"task","x":280,"y":200,"label":"Auto Scoring","label_ar":"التقييم التلقائي","role":"system","auto":true},
    {"id":"n3","type":"gateway","x":480,"y":200,"label":"Score Gate","label_ar":"بوابة التقييم","gate_type":"exclusive"},
    {"id":"n4","type":"task","x":680,"y":120,"label":"Auto Approve","label_ar":"موافقة تلقائية","role":"system","auto":true},
    {"id":"n5","type":"task","x":680,"y":280,"label":"Manual Review","label_ar":"مراجعة يدوية","role":"risk_officer","auto":false},
    {"id":"n6","type":"task","x":880,"y":200,"label":"Disbursement","label_ar":"الصرف","role":"operations","auto":false},
    {"id":"n7","type":"end","x":1080,"y":200,"label":"Completed","label_ar":"مكتمل","role":null}
  ]'),
  json('[
    {"id":"e1","from":"n1","to":"n2","label":""},
    {"id":"e2","from":"n2","to":"n3","label":""},
    {"id":"e3","from":"n3","to":"n4","label":"Score ≥ 700"},
    {"id":"e4","from":"n3","to":"n5","label":"Score < 700"},
    {"id":"e5","from":"n4","to":"n6","label":""},
    {"id":"e6","from":"n5","to":"n6","label":"Approved"},
    {"id":"e7","from":"n6","to":"n7","label":""}
  ]'),
  1,
  1,
  'system'
);

-- ── Compliance Tags — Oman / CBO ──────────────────────────────────────────────
INSERT OR IGNORE INTO compliance_tags (id, market_id, code, name, name_ar, description, category, regulatory_reference, severity, applies_to) VALUES
  ('ct001','mkt001','CBO_DBR_CAP','DBR Cap Compliance','حد نسبة خدمة الدين','Debt Burden Ratio must not exceed regulatory maximum per CBO BM 1117','credit_risk','CBO BM 1117 Section 4.1','mandatory','["home_loan","auto_loan","personal_loan","sme","commercial"]'),
  ('ct002','mkt001','CBO_LTV_CAP','LTV Cap Compliance','حد نسبة القرض للقيمة','Loan-to-Value ratio must not exceed CBO prescribed maximums','credit_risk','CBO BM 1117 Section 4.3','mandatory','["home_loan","commercial"]'),
  ('ct003','mkt001','CBO_STRESS_TEST','Stress Test Requirement','متطلب اختبار الضغط','All mortgage products must pass stress test at +350bps above applied rate','credit_risk','CBO BM 1117 Section 5.2','mandatory','["home_loan"]'),
  ('ct004','mkt001','MALAA_CHECK','Mala''a Credit Bureau Check','التحقق من ملاءة الائتمان','Mandatory credit bureau check via Mala''a before disbursement','credit_risk','CBO BM 1117 Section 3.1','mandatory','["home_loan","auto_loan","personal_loan","sme","commercial","education"]'),
  ('ct005','mkt001','GSAS_VERIFICATION','GSAS Certificate Verification','التحقق من شهادة GSAS','Green building certification must be verified via GORD database','esg','OEESC Section 6.1','mandatory','["home_loan"]'),
  ('ct006','mkt001','EPC_REVIEW','Energy Performance Certificate Review','مراجعة شهادة الأداء الطاقوي','EPC must be current (not expired) and rated B or above for green products','esg','OEESC Section 5.1','mandatory','["home_loan"]'),
  ('ct007','mkt001','EIA_CLEARANCE','EIA Clearance Verification','التحقق من تصريح تقييم الأثر البيئي','Environmental Impact Assessment clearance required for new construction','esg','Environment Authority Order 2011','mandatory','["home_loan"]'),
  ('ct008','mkt001','CBO_DISCLOSURE','Pre-Contractual Disclosure','الإفصاح قبل التعاقد','Total cost of credit disclosure required before signing','consumer_protection','CBO BM 1117 Section 8.1','mandatory','["home_loan","auto_loan","personal_loan","sme","commercial","education"]'),
  ('ct009','mkt001','CBO_COOLING_OFF','Cooling-Off Period','فترة التراجع','5 business day cooling-off period for retail customers','consumer_protection','CBO Consumer Protection Regulation Section 3','mandatory','["home_loan","auto_loan","personal_loan","education"]'),
  ('ct010','mkt001','AML_KYC','AML / KYC Screening','فحص مكافحة غسيل الأموال','Customer identity and sanctions screening before approval','aml_kyc','MOCIIP AML Regulation 2016','mandatory','["home_loan","auto_loan","personal_loan","sme","commercial","education"]'),
  ('ct011','mkt001','GREEN_DISCOUNT_AUDIT','Green Discount Audit Trail','مسار مراجعة الخصم الأخضر','Rate discount for green products must be documented and auditable','esg','Sohar International Green Finance Policy v2','recommended','["home_loan"]'),
  ('ct012','mkt001','CBO_MAX_TERM','Maximum Financing Term','الحد الأقصى لمدة التمويل','Term must not exceed CBO prescribed maximum for product category','credit_risk','CBO BM 1117 Section 4.2','mandatory','["home_loan","auto_loan","personal_loan"]');

-- ── Associate existing products with relevant compliance tags (Home Loans) ────
INSERT OR IGNORE INTO product_compliance_tags (product_id, tag_id, mapped_by) VALUES
  ('p001','ct001','system'), ('p001','ct002','system'), ('p001','ct003','system'),
  ('p001','ct004','system'), ('p001','ct008','system'), ('p001','ct009','system'),
  ('p001','ct010','system'), ('p001','ct012','system');

INSERT OR IGNORE INTO product_compliance_tags (product_id, tag_id, mapped_by) VALUES
  ('p007','ct001','system'), ('p007','ct002','system'), ('p007','ct003','system'),
  ('p007','ct004','system'), ('p007','ct005','system'), ('p007','ct006','system'),
  ('p007','ct007','system'), ('p007','ct008','system'), ('p007','ct009','system'),
  ('p007','ct010','system'), ('p007','ct011','system'), ('p007','ct012','system');
