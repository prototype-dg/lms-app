-- ============================================================
-- Sohar International – Pre-Demo Seed Data
-- NOTE: Green Home Loan (p009), r015, EcoVillage units/docs,
-- GHL application (app003), and construction stages are NOT
-- seeded here. They are created LIVE during the demonstration.
-- ============================================================

-- Back-office Users
INSERT OR IGNORE INTO users VALUES
  ('u001', 'Fatima Al-Rashdi', 'فاطمة الراشدي', 'fatima@sib.om', 'product_manager', 'Product Management', 'FA', 'active', '2024-01-15'),
  ('u002', 'Aisha Al-Balushi', 'عائشة البلوشي', 'aisha@sib.om', 'compliance_officer', 'Compliance & ESG', 'AB', 'active', '2023-06-01'),
  ('u003', 'Omar Al-Mantheri', 'عمر المنذري', 'omar@sib.om', 'risk_officer', 'Credit Risk', 'OM', 'active', '2023-03-15'),
  ('u004', 'Khalid Al-Rawahi', 'خالد الرواحي', 'khalid@sib.om', 'operations', 'Operations', 'KR', 'active', '2022-09-01'),
  ('u005', 'admin', null, 'admin@sib.om', 'admin', 'IT', 'AD', 'active', '2021-01-01');

-- Developer / Partner Users
INSERT OR IGNORE INTO users VALUES
  ('u010', 'Ahmed Al-Hinai', 'أحمد الهنائي', 'ahmed@almadaen.om', 'developer', 'Al Madaen Real Estate', 'AH', 'active', '2023-11-01'),
  ('u011', 'Rashid Al-Hassani', 'راشد الحساني', 'rashid@aljazeera-const.om', 'contractor', 'Al Jazeera Constructions', 'RH', 'active', '2024-02-01');

-- Customer
INSERT OR IGNORE INTO users VALUES
  ('u020', 'Salim Al-Harthy', 'سالم الحارثي', 'salim@gmail.com', 'customer', null, 'SH', 'active', '2019-05-10');

-- Customers
INSERT OR IGNORE INTO customers VALUES
  ('c001', 'Salim Al-Harthy', 'سالم الحارثي', '84521789', 'salim@gmail.com', '+968 9921 3344', 'Omani', 'Ministry of Heritage & Tourism', 3200, 'salaried', 750, 0, '2019-05-10', 'active', '2019-05-10'),
  ('c002', 'Mariam Al-Siyabi', 'مريم السيابي', '91234567', 'mariam@hotmail.com', '+968 9955 1122', 'Omani', 'Oman Oil Company', 4500, 'salaried', 780, 12, '2020-03-22', 'active', '2020-03-22'),
  ('c003', 'Hassan Al-Amri', 'حسن العامري', '78654321', 'hassan@gmail.com', '+968 9977 8899', 'Omani', 'Bank Muscat', 2800, 'salaried', 710, 18, '2021-07-15', 'active', '2021-07-15');

-- Products Library
-- Column order (29): id, name, code, description, category, status,
--   base_rate, max_ltv, max_dbr, green_dbr, min_term, max_term,
--   min_amount, max_amount, gsas_min_score, gsas_premium_score,
--   green_discount_premium, green_discount_standard, ai_confidence_threshold,
--   allow_byop, allow_partner_inventory,
--   required_docs, esg_required_docs, approved_materials, approved_vendors,
--   configuration, applications_ytd, created_by, created_at, updated_at
--
-- p001 – Standard Home Loan (Omani nationals, salaried, secured)
--   LTV 90%, DBR 60%, salary min OMR 600, term 5–25 yr, collateral required
INSERT OR IGNORE INTO products VALUES
  ('p001', 'Standard Home Loan', 'SHL-STANDARD',
   'Flagship home financing for Omani nationals and residents. Fixed and variable rate options, top-up facility, and bundled insurance. CBO-compliant with full credit assessment.',
   'home_loan', 'active', 5.5, 90, 60, 60, 5, 25, 10000, 500000,
   0, 0, 0.0, 0.0, 90, 1, 1,
   '["civil_id","salary_certificate","utility_bill","property_deed","independent_valuation_report","bank_statements_3m","employer_letter"]',
   '[]', '[]', '[]',
   '{"features":["Fixed and variable rate options","Top-up facility available","Insurance bundled","Salary transfer preferred"]}',
   4847, 'u001', '2024-01-10', '2025-12-15'),

-- p002 – Auto Finance Personal (secured against vehicle, shorter term)
--   LTV 85%, DBR 55%, term 1–7 yr, vehicle-specific docs, no BYOP/inventory
  ('p002', 'Auto Finance – Personal', 'AFL-PERSONAL',
   'Financing for personal vehicles including sedans, SUVs, and electric vehicles. Competitive flat rate, quick 48-hour approval, covers new and used vehicles up to 5 years old.',
   'auto_loan', 'active', 4.9, 85, 55, 55, 1, 7, 3000, 80000,
   0, 0, 0.0, 0.0, 90, 0, 0,
   '["civil_id","salary_certificate","vehicle_proforma_invoice","driving_license","insurance_quotation","bank_statements_3m"]',
   '[]', '[]', '[]',
   '{"features":["Covers new & used vehicles","48-hour credit decision","EV purchase supported","Comprehensive insurance required"]}',
   1923, 'u001', '2023-06-01', '2025-11-20'),

-- p003 – Personal Loan (unsecured, no LTV, tighter DBR, approved employers only)
--   max_ltv=0 (unsecured), DBR 45%, term 1–5 yr, no BYOP/inventory
  ('p003', 'Personal Loan', 'PL-UNSECURED',
   'Unsecured personal financing for salaried employees of approved employers. No collateral required. Flat competitive rate for medical, travel, home renovation and other personal needs.',
   'personal_loan', 'active', 7.5, 0, 45, 45, 1, 5, 1000, 30000,
   0, 0, 0.0, 0.0, 90, 0, 0,
   '["civil_id","salary_certificate","employer_letter","bank_statements_3m","approved_employer_confirmation"]',
   '[]', '[]', '[]',
   '{"features":["No collateral required","Approved employer list","Competitive fixed rate","Loan protector insurance available"]}',
   3241, 'u001', '2023-01-15', '2025-10-01'),

-- p004 – SME Working Capital (business-secured, higher DBR, short term, CR required)
--   LTV 70%, DBR 65%, term 1–3 yr, corporate docs, no BYOP/inventory
  ('p004', 'SME Working Capital', 'SME-WORKCAP',
   'Short-term working capital facility for small and medium enterprises registered in Oman. Revolving or term structure. Supports payroll, inventory procurement, and operational growth.',
   'sme', 'active', 6.5, 70, 65, 65, 1, 3, 5000, 200000,
   0, 0, 0.0, 0.0, 85, 0, 0,
   '["commercial_registration_certificate","memorandum_of_association","audited_financials_2yr","bank_statements_6m","cr_extract","tax_clearance_certificate","business_profile"]',
   '[]', '[]', '[]',
   '{"features":["For Oman-registered SMEs","Revolving or term facility","Supports payroll & growth","MOCI-verified CR required"]}',
   892, 'u001', '2023-08-10', '2025-09-15'),

-- p005 – Home Equity Line (HELOC, secured against existing property, revolving)
--   LTV 75% (conservative for second charge), DBR 55%, term 5–15 yr
  ('p005', 'Home Equity Line', 'HELOC-STANDARD',
   'Revolving credit facility secured against existing owned property. Access equity without selling. Ideal for large purchases, education, or business funding. Second charge behind primary mortgage.',
   'home_loan', 'active', 6.0, 75, 55, 55, 5, 15, 20000, 300000,
   0, 0, 0.0, 0.0, 90, 0, 0,
   '["civil_id","property_title_deed","independent_valuation_report","salary_certificate","bank_statements_3m","existing_mortgage_statement","noc_from_primary_lender"]',
   '[]', '[]', '[]',
   '{"features":["Use your property equity","Revolving credit line","Up to OMR 300,000","No early settlement penalty"]}',
   567, 'u001', '2024-03-01', '2025-08-20'),

-- p006 – Commercial Property Finance (corporate, large amounts, secured)
--   LTV 70%, DBR 65%, term 5–20 yr, full corporate docs + business valuation
  ('p006', 'Commercial Property Finance', 'CPF-COMMERCIAL',
   'Financing for commercial properties including offices, retail units, and warehouses. Available to Omani-registered companies and sole proprietors. Full corporate credit assessment applies.',
   'commercial', 'active', 6.8, 70, 65, 65, 5, 20, 50000, 2000000,
   0, 0, 0.0, 0.0, 85, 0, 0,
   '["commercial_registration_certificate","memorandum_of_association","audited_financials_3yr","bank_statements_12m","property_title_deed","independent_valuation_report","lease_agreements","board_resolution"]',
   '[]', '[]', '[]',
   '{"features":["For offices, retail & warehouses","Up to OMR 2,000,000","Flexible repayment structures","Lease income considered"]}',
   234, 'u001', '2023-09-01', '2025-07-10'),

-- p007 – Expat Home Finance (secured, lower LTV for non-Omani, work permit required)
--   LTV 75% (CBO cap for expats), DBR 55%, term 5–20 yr
  ('p007', 'Expat Home Finance', 'EHL-EXPAT',
   'Home financing for expatriate professionals working in Oman. Stricter LTV (max 75%) per CBO regulations. Employer NOC required. Available for IZ-approved freehold zones.',
   'home_loan', 'active', 6.0, 75, 55, 55, 5, 20, 15000, 400000,
   0, 0, 0.0, 0.0, 90, 0, 0,
   '["civil_id","passport_copy","valid_work_permit_residence_card","salary_certificate","noc_from_employer","property_deed_freehold_zone","independent_valuation_report","bank_statements_6m"]',
   '[]', '[]', '[]',
   '{"features":["Expatriate professionals","LTV up to 75%","Freehold zone properties","Employer NOC required"]}',
   1102, 'u001', '2024-01-20', '2025-12-01'),

-- p008 – Education Finance (unsecured, no LTV, lowest amounts, education docs)
--   max_ltv=0 (unsecured), DBR 45%, term 1–8 yr, university docs required
  ('p008', 'Education Finance', 'EDU-FINANCE',
   'Financing for higher education expenses including tuition, accommodation, and study materials at approved universities in Oman and abroad. Deferred repayment option available.',
   'education', 'archived', 8.0, 0, 45, 45, 1, 8, 500, 20000,
   0, 0, 0.0, 0.0, 90, 0, 0,
   '["civil_id","university_offer_letter_or_enrollment","salary_certificate","fee_schedule_from_institution","bank_statements_3m"]',
   '[]', '[]', '[]',
   '{"features":["Approved universities list","Deferred repayment option","Covers tuition & accommodation","Loan protector insurance"]}',
   445, 'u001', '2022-01-01', '2024-06-01');
-- NOTE: Green Home Loan (p009) is created LIVE by Product Manager during Act 1.

-- Rules Library (15 pre-configured CBO rules)
INSERT OR IGNORE INTO rules VALUES
  ('r001', null, 'DBR Maximum Limit', 'creditworthiness', 'DBR', '<=', 60, null, 'reject', 'hard', 'CBO Circular 2024-01, Section 3.1', 'manual', null, 'Debt Burden Ratio must not exceed 60% of gross monthly income', 1, 'system', '2024-01-01'),
  ('r002', null, 'LTV Maximum – Salaried Omani', 'collateral', 'LTV', '<=', 90, 'nationality=Omani AND employment=salaried', 'reject', 'hard', 'CBO Circular 2024-01, Section 4.2', 'manual', null, 'Loan-to-Value ratio max 90% for salaried Omani nationals', 1, 'system', '2024-01-01'),
  ('r003', null, 'LTV Maximum – Expat', 'collateral', 'LTV', '<=', 75, 'nationality!=Omani', 'reject', 'hard', 'CBO Circular 2024-01, Section 4.3', 'manual', null, 'Loan-to-Value ratio max 75% for expatriates', 1, 'system', '2024-01-01'),
  ('r004', null, 'Minimum Loan Term', 'product', 'loan_term', '>=', 5, null, 'reject', 'hard', 'Bank Policy BP-2024-HL-001', 'manual', null, 'Minimum loan term 5 years for home finance', 1, 'system', '2024-01-01'),
  ('r005', null, 'Maximum Loan Term', 'product', 'loan_term', '<=', 25, null, 'reject', 'hard', 'CBO Circular 2024-01, Section 5.1', 'manual', null, 'Maximum loan term 25 years', 1, 'system', '2024-01-01'),
  ('r006', null, 'Minimum Credit Score', 'creditworthiness', 'credit_score', '>=', 650, null, 'reject', 'hard', 'Bank Policy BP-2024-CR-002', 'manual', null, 'Minimum MALA''A credit score 650 for home financing', 1, 'system', '2024-01-01'),
  ('r007', null, 'CBO Stress Test – Rate Hike', 'stress_test', 'stress_rate', '<=', 9, null, 'reject', 'hard', 'CBO Circular 2025-07, Section 2.3', 'manual', null, 'Simulate +350bps rate hike; DBR must not exceed 70%', 1, 'system', '2024-01-01'),
  ('r008', null, 'Minimum Salary – Home Loan', 'eligibility', 'salary_omr', '>=', 400, null, 'reject', 'soft', 'Bank Policy BP-2024-HL-003', 'manual', null, 'Minimum monthly salary OMR 400 for home financing', 1, 'system', '2024-01-01'),
  ('r009', null, 'Property Valuation Required', 'collateral', 'valuation_required', '=', 1, null, 'reject', 'hard', 'CBO Circular 2024-01, Section 6.1', 'manual', null, 'Independent property valuation mandatory', 1, 'system', '2024-01-01'),
  ('r010', null, 'AML Sanctions Screening', 'compliance', 'sanctions_clear', '=', 1, null, 'reject', 'hard', 'CBO AML/CFT Rules 2022, Section 8', 'manual', null, 'Customer must pass OFAC/UN/EU sanctions screening', 1, 'system', '2024-01-01'),
  ('r011', null, 'KYC Completeness Check', 'compliance', 'kyc_complete', '=', 1, null, 'reject', 'hard', 'CBO AML/CFT Rules 2022, Section 5.2', 'manual', null, 'All KYC documents must be verified and current', 1, 'system', '2024-01-01'),
  ('r012', null, 'GSAS Score – Green Entry', 'esg', 'gsas_score', '>=', 70, null, 'reject', 'hard', 'OS GSO 3000:2025, Section 4.2', 'manual', null, 'Minimum GSAS score 70 for Green Home Loan eligibility', 1, 'system', '2026-01-01'),
  ('r013', null, 'EPC Rating Minimum', 'esg', 'epc_rating', 'in', null, 'A,B,C', 'reject', 'hard', 'OEESC Section 5.1', 'manual', null, 'Energy Performance Certificate minimum rating C required', 1, 'system', '2026-01-01'),
  ('r014', null, 'EIA Clearance – Large Projects', 'esg', 'eia_required', '=', 1, 'units>20', 'reject', 'hard', 'Environment Authority Decision 107/2023', 'manual', null, 'EIA clearance mandatory for developments >20 residential units', 1, 'system', '2026-01-01');
-- NOTE: r015 (Green DBR Buffer) is generated LIVE by AI during Act 1.

-- Developer Profiles
INSERT OR IGNORE INTO developers VALUES
  ('d001', 'Al Madaen Real Estate', 'CR-2019-45821', 'Ahmed Al-Hinai', 'ahmed@almadaen.om', '+968 2434 5566', 'PO Box 1234, Muscat', 'active', '2023-11-15', '2019-03-01'),
  ('d002', 'Muscat Hills Development', 'CR-2018-33201', 'Sara Al-Lawati', 'sara@muscathills.om', '+968 2488 9900', 'PO Box 567, Muscat', 'active', '2022-09-20', '2018-07-10'),
  ('d003', 'Gulf Horizon Properties', 'CR-2021-78543', 'Khalid Al-Farsi', 'khalid@gulfhorizon.om', '+968 2456 7788', 'PO Box 890, Sohar', 'active', '2024-01-05', '2021-02-15');

-- Projects (3 existing + EcoVillage Muscat)
INSERT OR IGNORE INTO projects VALUES
  ('proj001', 'd001', 'Al Mouj Residences', 'AMR-2024', 'Al Mouj, Muscat', 'Muscat', 'apartment', 36, 12, 8, 16, 78, 'Gold', 'B', 'EIA/2024/201', 
   '{"type":"FeatureCollection","features":[]}',
   'active', 1, 0, '2024-06-15', '2025-11-30'),
  ('proj002', 'd001', 'Seeb Heights Villas', 'SHV-2025', 'Airport Heights, Seeb', 'Muscat', 'villa', 18, 18, 0, 0, 82, 'Gold', 'A', null,
   '{"type":"FeatureCollection","features":[]}',
   'active', 1, 0, '2025-01-10', '2025-12-01'),
  ('proj003', 'd001', 'Mabella View Apartments', 'MVA-2023', 'Mabella, Muscat', 'Muscat', 'apartment', 60, 0, 0, 60, null, null, null, null,
   '{"type":"FeatureCollection","features":[]}',
   'archived', 0, 0, '2023-05-01', '2025-06-30'),
  ('proj004', 'd001', 'EcoVillage Muscat', 'EVM-2026', 'Seeb, Muscat Governorate', 'Muscat', 'villa', 24, 0, 0, 0, null, null, null, null,
   '{"type":"FeatureCollection","features":[]}',
   'draft', 0, 0, '2026-08-31', '2026-08-31');
-- NOTE: EcoVillage units, documents, and listing_visible=1 are set LIVE during Act 2.

-- NOTE: EcoVillage units and documents are uploaded LIVE during Act 2.

-- Applications (2 background applications for context)
-- Schema (36 cols): id,reference,product_id,customer_id,customer_name,unit_id,project_id,
--   loan_amount,loan_term,property_address,property_source,property_area_sqm,
--   gsas_score,epc_rating,applied_rate,standard_rate,monthly_payment,standard_monthly_payment,
--   lifetime_saving,dbr,ltv,stress_test_rate,stress_test_passed,malaa_score,status,
--   esg_verification_status,compliance_approved_by,compliance_approved_at,
--   risk_approved_by,risk_approved_at,escrow_amount,escrow_released,
--   rejection_reason,tracking_url,created_at,updated_at
INSERT OR IGNORE INTO applications VALUES
  ('app001','HL-240892','p001','c002','Mariam Al-Siyabi',null,'proj001',
   250000,20,'Al Mouj Residences, Unit A12, Muscat','partner',
   142,null,null,5.5,5.5,1608.82,1608.82,
   0,46,78,9.0,1,780,'approved',
   'verified','u002','2024-09-15','u003','2024-09-16',
   250000,0,null,null,'2024-09-14','2024-09-16'),
  ('app002','HL-241156','p001','c003','Hassan Al-Amri',null,null,
   120000,15,'Plot 45, Al Ghubra North, Muscat','byop',
   200,null,null,5.5,5.5,980.12,980.12,
   0,36,72,9.0,1,710,'credit_review',
   'pending',null,null,null,null,
   120000,0,null,null,'2024-12-01','2024-12-03');
-- NOTE: GHL-250001 (app003) and construction stages are created LIVE during Acts 3-5.

-- AI Knowledge Base
INSERT OR IGNORE INTO knowledge_base VALUES
  ('kb001', 'CBO Circular 2026-12 – DBR Rules for Housing Finance', 'regulatory', 
   'The Central Bank of Oman requires that for all housing loans, the Debt Burden Ratio (DBR) shall not exceed 60% of the applicant''s gross monthly income. For green financing products, banks are encouraged to apply a 5% buffer, effectively limiting DBR to 55%. This buffer recognises the lower operational costs of energy-efficient properties.', 
   'CBO Circular 2026-12', '2026-01-01', '["DBR","housing","green"]', '2026-08-31'),
  ('kb002', 'OS GSO 3000:2025 – GSAS Technical Standards', 'esg',
   'GSAS (Global Sustainability Assessment System) certificates issued under OS GSO 3000:2025 must contain: Certificate Number (format: GSAS-YYYY-NNN), Issuer (GORD or accredited body), Issue Date, Expiry Date (valid for 5 years), Overall Score (0-100), and Rating (Bronze/Silver/Gold/Platinum). Minimum score for green financing: 70 (Good). Premium tier for 0.75% discount: 85 (Excellent).',
   'OS GSO 3000:2025', '2025-01-01', '["GSAS","ESG","green","certification"]', '2026-08-31'),
  ('kb003', 'Oman PDPL – Royal Decree 6/2022', 'compliance',
   'The Oman Personal Data Protection Law (Royal Decree 6/2022) requires explicit consent for data collection, secure storage of personal data, right to erasure, and mandatory breach notification within 72 hours. Financial institutions must maintain data processing records.',
   'Royal Decree 6/2022', '2022-02-01', '["PDPL","data","privacy"]', '2026-08-31'),
  ('kb004', 'OEESC – Energy Performance Certificate Requirements', 'esg',
   'The Oman Energy Efficiency Standards Code requires Energy Performance Certificates (EPC) for all new residential developments. Minimum rating C for green financing eligibility. Rating scale: A+ (best) to G (worst). Certificates valid for 5-10 years. Assessor must be OEESC-accredited.',
   'OEESC Section 5.1', '2024-01-01', '["EPC","energy","efficiency"]', '2026-08-31'),
  ('kb005', 'Environment Authority Decision 107/2023 – EIA Requirements', 'esg',
   'Environmental Impact Assessment (EIA) clearance is mandatory for residential developments exceeding 20 units. Must be issued by the Environment Authority of Oman or accredited body. Reference format: EIA/YYYY/NNN. Valid for 3 years from issue date.',
   'Environment Authority Decision 107/2023', '2023-07-15', '["EIA","environment","assessment"]', '2026-08-31');

-- Rule Templates (15 CBO rules)
INSERT OR IGNORE INTO rule_templates VALUES
  ('rt001', 'DBR Calculation', 'creditworthiness', 'CBO Circular 2024-01', '{"metric":"DBR","formula":"total_monthly_debt/gross_monthly_income*100","max_value":60}', 1, '2024-01-01'),
  ('rt002', 'LTV Calculation', 'collateral', 'CBO Circular 2024-01', '{"metric":"LTV","formula":"loan_amount/property_value*100","max_value":90}', 1, '2024-01-01'),
  ('rt003', 'Stress Test Rate Hike', 'risk', 'CBO Circular 2025-07', '{"metric":"stress_dbr","rate_addition":3.5,"max_dbr":70}', 1, '2025-01-01'),
  ('rt004', 'AML Sanctions Screen', 'compliance', 'CBO AML Rules 2022', '{"screen_lists":["OFAC","UN","EU","CBO"]}', 1, '2022-01-01'),
  ('rt005', 'Credit Bureau Check', 'creditworthiness', 'CBO Circular 2023-05', '{"provider":"MALAA","min_score":650}', 1, '2023-01-01');

-- Audit Logs (background history only; Acts 1-5 logs created live)
INSERT OR IGNORE INTO audit_logs VALUES
  ('al001', 'u001', 'Fatima Al-Rashdi', 'product_manager', 'PRODUCT_PUBLISHED', 'product', 'p001', '{"status":"active","product_name":"Standard Home Loan"}', 'manual', null, null, '10.10.50.15', '2024-01-10 09:00:00'),
  ('al002', 'u001', 'Fatima Al-Rashdi', 'product_manager', 'PRODUCT_PUBLISHED', 'product', 'p002', '{"status":"active","product_name":"Auto Finance – Personal"}', 'manual', null, null, '10.10.50.15', '2023-06-01 10:00:00'),
  ('al003', 'u002', 'Aisha Al-Balushi', 'compliance_officer', 'APPLICATION_APPROVED', 'application', 'app001', '{"reference":"HL-240892","customer":"Mariam Al-Siyabi","amount":250000}', 'manual', null, 'CBO Circular 2024-01', '10.10.50.22', '2024-09-15 14:30:00'),
  ('al004', 'u003', 'Omar Al-Mantheri', 'risk_officer', 'CREDIT_REVIEW_APPROVED', 'application', 'app001', '{"reference":"HL-240892","dbr":46,"ltv":78,"stress_test":"passed"}', 'manual', null, 'CBO Circular 2024-01', '10.10.50.33', '2024-09-16 11:00:00');
