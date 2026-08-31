-- ============================================================
-- Sohar International – Demo Seed Data
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
INSERT OR IGNORE INTO products VALUES
  ('p001', 'Standard Home Loan', 'SHL-STANDARD', 'Our flagship home financing product for Omani nationals and residents. Competitive rates with flexible terms.', 'home_loan', 'active', 5.5, 90, 60, 60, 5, 25, 10000, 500000, 0, 0, 0, 0, 90, 1, 1,
   '["salary_cert","utility_bill","civil_id","property_deed","valuation_report"]',
   '[]', '[]', '[]',
   '{"features":["Fixed and variable rate options","Top-up facility available","Insurance bundled"]}',
   4847, 'u001', '2024-01-10', '2025-12-15'),
  ('p002', 'Auto Finance – Personal', 'AFL-PERSONAL', 'Financing for personal vehicles including sedans, SUVs, and electric vehicles.', 'auto_loan', 'active', 4.9, 85, 55, 55, 1, 7, 3000, 80000, 0, 0, 0, 0, 90, 0, 0,
   '["salary_cert","civil_id","vehicle_proforma"]',
   '[]', '[]', '[]', '{}', 1923, 'u001', '2023-06-01', '2025-11-20'),
  ('p003', 'Personal Loan', 'PL-UNSECURED', 'Unsecured personal financing for salaried employees of approved employers.', 'personal_loan', 'active', 7.5, 0, 50, 50, 1, 5, 1000, 30000, 0, 0, 0, 0, 90, 0, 0,
   '["salary_cert","civil_id","employer_letter"]',
   '[]', '[]', '[]', '{}', 3241, 'u001', '2023-01-15', '2025-10-01'),
  ('p004', 'SME Working Capital', 'SME-WORKCAP', 'Short-term working capital facility for small and medium enterprises registered in Oman.', 'sme', 'active', 6.5, 70, 65, 65, 1, 3, 5000, 200000, 0, 0, 0, 0, 85, 0, 0,
   '["cr_certificate","audited_financials","bank_statements","cr_extract"]',
   '[]', '[]', '[]', '{}', 892, 'u001', '2023-08-10', '2025-09-15'),
  ('p005', 'Home Equity Line', 'HELOC-STANDARD', 'Revolving credit facility secured against existing property equity.', 'home_loan', 'active', 6.0, 75, 55, 55, 5, 15, 20000, 300000, 0, 0, 0, 0, 90, 0, 0,
   '["property_title","valuation_report","civil_id","salary_cert"]',
   '[]', '[]', '[]', '{}', 567, 'u001', '2024-03-01', '2025-08-20'),
  ('p006', 'Commercial Property Finance', 'CPF-COMMERCIAL', 'Financing for commercial properties including offices, retail and warehouses.', 'commercial', 'active', 6.8, 70, 65, 65, 5, 20, 50000, 2000000, 0, 0, 0, 0, 85, 0, 0,
   '["cr_certificate","audited_financials","property_title","valuation_report"]',
   '[]', '[]', '[]', '{}', 234, 'u001', '2023-09-01', '2025-07-10'),
  ('p007', 'Expat Home Finance', 'EHL-EXPAT', 'Home financing solutions for expatriate professionals working in Oman.', 'home_loan', 'active', 6.0, 75, 55, 55, 5, 20, 15000, 400000, 0, 0, 0, 0, 90, 0, 0,
   '["work_permit","salary_cert","civil_id","property_deed","noc_employer"]',
   '[]', '[]', '[]', '{}', 1102, 'u001', '2024-01-20', '2025-12-01'),
  ('p008', 'Education Finance', 'EDU-FINANCE', 'Financing for education expenses including tuition fees for approved universities.', 'education', 'archived', 8.0, 0, 45, 45, 1, 8, 500, 20000, 0, 0, 0, 0, 90, 0, 0,
   '["civil_id","university_offer_letter","salary_cert"]',
   '[]', '[]', '[]', '{}', 445, 'u001', '2022-01-01', '2024-06-01'),
  ('p009', 'Green Home Loan – ESG', 'GHL-GREEN-PREMIUM', 'Preferential home financing for GSAS-certified green properties. Supports Oman Vision 2040 and the National ESG Strategy. Earn up to 0.75% rate discount based on sustainability score.', 'home_loan', 'active', 5.5, 90, 60, 55, 5, 25, 10000, 500000, 70, 85, 0.75, 0.5, 90, 1, 1,
   '["salary_cert","utility_bill","civil_id","property_deed","valuation_report"]',
   '["gsas_cert","epc_report","eia_approval"]',
   '["Green Concrete","Thermal Insulation","Solar Panels","Energy-Efficient Appliances","Low-E Glass","Recycled Steel"]',
   '["Oman Readymix LLC","Gulf Insulation Group","SunTech Oman","Green Build Oman","EcoMaterials Oman"]',
   '{"esg_features":["GSAS score-based pricing","Maker-checker ESG approval","Construction escrow with green material validation"],"launched_by":"Fatima Al-Rashdi","launched_at":"2026-08-31"}',
   127, 'u001', '2026-08-31', '2026-08-31');

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
  ('r014', null, 'EIA Clearance – Large Projects', 'esg', 'eia_required', '=', 1, 'units>20', 'reject', 'hard', 'Environment Authority Decision 107/2023', 'manual', null, 'EIA clearance mandatory for developments >20 residential units', 1, 'system', '2026-01-01'),
  ('r015', null, 'Green DBR Buffer', 'creditworthiness', 'green_dbr', '<=', 55, 'product=green', 'reject', 'soft', 'CBO Circular 2026-12, Section 3.2', 'ai_generated', 94, 'For green financing products with loan amount >OMR 100,000, effective DBR threshold is 55% (60% - 5% green buffer)', 1, 'u001', '2026-08-31');

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
  ('proj004', 'd001', 'EcoVillage Muscat', 'EVM-2026', 'Seeb, Muscat Governorate', 'Muscat', 'villa', 24, 24, 0, 0, 89, 'Gold', 'A', 'EIA/2026/442',
   '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"unit":"B1","status":"available","area":180},"geometry":{"type":"Point","coordinates":[58.1898,23.6512]}},{"type":"Feature","properties":{"unit":"B2","status":"available","area":175},"geometry":{"type":"Point","coordinates":[58.1905,23.6518]}},{"type":"Feature","properties":{"unit":"B3","status":"available","area":185},"geometry":{"type":"Point","coordinates":[58.1912,23.6524]}},{"type":"Feature","properties":{"unit":"B4","status":"reserved","area":180},"geometry":{"type":"Point","coordinates":[58.1919,23.6530]}},{"type":"Feature","properties":{"unit":"B5","status":"available","area":190},"geometry":{"type":"Point","coordinates":[58.1926,23.6536]}},{"type":"Feature","properties":{"unit":"B6","status":"available","area":175},"geometry":{"type":"Point","coordinates":[58.1933,23.6542]}}]}',
   'active', 1, 1, '2026-08-31', '2026-08-31');

-- Units for EcoVillage Muscat (Villa B1 is Salim's saved property)
-- Schema: id, project_id, unit_number, floor_number, type, area_sqm, bedrooms, bathrooms, price, lat, lng, status, features, created_at
INSERT OR IGNORE INTO units VALUES
  ('unit001', 'proj004', 'B1', 1, 'villa', 180, 4, 3, 185000, 23.6512, 58.1898, 'available', '["GSAS Gold","Private Pool","Smart Home","Solar Panels","EV Charging"]', '2026-08-31'),
  ('unit002', 'proj004', 'B2', 1, 'villa', 175, 4, 3, 178000, 23.6518, 58.1905, 'available', '["GSAS Gold","Garden","Smart Home","Solar Panels"]', '2026-08-31'),
  ('unit003', 'proj004', 'B3', 1, 'villa', 185, 4, 3, 192000, 23.6524, 58.1912, 'available', '["GSAS Gold","Private Pool","Smart Home","Solar Panels","Maid Room"]', '2026-08-31'),
  ('unit004', 'proj004', 'B4', 1, 'villa', 180, 4, 3, 185000, 23.6530, 58.1919, 'reserved', '["GSAS Gold","Garden","Smart Home"]', '2026-08-31'),
  ('unit005', 'proj004', 'B5', 1, 'villa', 190, 5, 4, 198000, 23.6536, 58.1926, 'available', '["GSAS Gold","Private Pool","Smart Home","Solar Panels","Home Office"]', '2026-08-31'),
  ('unit006', 'proj004', 'B6', 1, 'villa', 175, 4, 3, 178000, 23.6542, 58.1933, 'available', '["GSAS Gold","Garden","Smart Home"]', '2026-08-31');

-- Documents (pre-validated for EcoVillage)
INSERT OR IGNORE INTO documents VALUES
  ('doc001', 'project', 'proj004', 'gsas_cert', 'GSAS_Cert_EcoVillage.pdf', null,
   '{"certificate_number":"GSAS-2026-078","issuer":"GORD (Gulf Organisation for Research & Development)","issue_date":"2026-02-15","expiry_date":"2028-12-31","overall_score":89,"rating":"Gold","property":"EcoVillage Muscat, Seeb"}',
   96, 'auto_verified', 'Auto-verified: All fields validated. Score 89 meets minimum threshold (70).', null, null, '2026-08-31'),
  ('doc002', 'project', 'proj004', 'epc_report', 'EPC_Report_VillaB1.pdf', null,
   '{"rating":"A","expiry_date":"2027-05-01","property_ref":"EVM-B1","energy_consumption":"85 kWh/m²/year","co2_rating":"A","assessor":"Green Build Oman"}',
   88, 'approved', 'Manual override: Visual verification completed. Document legible. Rating A and expiry 2027 confirmed. Low confidence due to slight image skew.', 'u002', '2026-08-31', '2026-08-31'),
  ('doc003', 'project', 'proj004', 'eia_approval', 'EIA_Approval_EnvAuth.pdf', null,
   '{"reference":"EIA/2026/442","issuer":"Environment Authority","approval_date":"2026-03-10","valid_until":"2029-03-10","project":"EcoVillage Muscat","units":24,"status":"Approved"}',
   95, 'auto_verified', 'Auto-verified: EIA clearance confirmed for 24 units. Issuer accredited.', null, null, '2026-08-31');

-- Applications (pre-existing + GHL-250001 in progress)
-- Schema (36 cols): id,reference,product_id,customer_id,customer_name,unit_id,project_id,
--   loan_amount,loan_term,property_address,property_source,property_area_sqm,
--   gsas_score,epc_rating,applied_rate,standard_rate,monthly_payment,standard_monthly_payment,
--   lifetime_saving,dbr,ltv,stress_test_rate,stress_test_passed,malaa_score,status,
--   esg_verification_status,compliance_approved_by,compliance_approved_at,
--   risk_approved_by,risk_approved_at,escrow_amount,escrow_released,
--   rejection_reason,tracking_url,created_at,updated_at
INSERT OR IGNORE INTO applications VALUES
  ('app001','HL-240892','p001','c002','Mariam Al-Siyabi','unit004','proj001',
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
   120000,0,null,null,'2024-12-01','2024-12-03'),
  ('app003','GHL-250001','p009','c001','Salim Al-Harthy','unit001','proj004',
   200000,25,'EcoVillage Muscat, Villa B1, Seeb','partner',
   180,89,'A',4.75,5.5,1139.13,1224.42,
   25500,48,80,9.0,1,750,'esg_review',
   'pending',null,null,null,null,
   200000,0,null,'https://sib.om/track/GHL-250001','2026-08-31','2026-08-31');

-- Construction Stages for GHL-250001
INSERT OR IGNORE INTO construction_stages VALUES
  ('stage001', 'app003', 1, 'Foundation & Groundwork', 'Complete foundation, groundwork, and underground utilities', 50000, 25, 'Green Concrete – C30 Grade', 'active', null, 0, null, null, null, null, '2026-08-31'),
  ('stage002', 'app003', 2, 'Roof & Envelope', 'Roof structure, external walls, and thermal envelope', 60000, 30, 'Thermal Insulation (R-30+)', 'locked', null, 0, null, null, null, null, '2026-08-31'),
  ('stage003', 'app003', 3, 'MEP & Solar Installation', 'Mechanical, electrical, plumbing, and solar panel installation', 50000, 25, 'Solar Panels (min 5kWp)', 'locked', null, 0, null, null, null, null, '2026-08-31'),
  ('stage004', 'app003', 4, 'Finishing & Handover', 'Interior finishing, energy-efficient appliances, and final handover', 40000, 20, 'Energy-Efficient Appliances', 'locked', null, 0, null, null, null, null, '2026-08-31');

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

-- Audit Logs (pre-populated for Act 1 demonstration)
INSERT OR IGNORE INTO audit_logs VALUES
  ('al001', 'u001', 'Fatima Al-Rashdi', 'product_manager', 'PRODUCT_CLONED', 'product', 'p009', '{"from_product":"p001","to_product":"p009","action":"Standard Home Loan → Green Home Loan – ESG"}', 'manual', null, null, '10.10.50.15', '2026-08-31 10:23:00'),
  ('al002', 'u001', 'Fatima Al-Rashdi', 'product_manager', 'PRODUCT_CONFIG_UPDATED', 'product', 'p009', '{"field":"pricing_modifier","value":"ESG Green Modifier","conditions":["GSAS>=85: 4.75%","GSAS>=70<85: 5.0%"]}', 'manual', null, null, '10.10.50.15', '2026-08-31 10:25:00'),
  ('al003', 'u001', 'Fatima Al-Rashdi', 'product_manager', 'AI_RULE_GENERATED', 'rule', 'r015', '{"prompt":"CBO DBR Circular","extracted_params":{"metric":"DBR","threshold":55,"scope":"green housing loans"},"ai_model":"gpt-4o"}', 'ai_generated', 94, 'CBO Circular 2026-12, Section 3.2', '10.10.50.15', '2026-08-31 10:28:00'),
  ('al004', 'u001', 'Fatima Al-Rashdi', 'product_manager', 'AI_RULE_CONFIRMED', 'rule', 'r015', '{"action":"manual_override","change":"Applied threshold only to loans >OMR 100,000"}', 'manual', null, 'CBO Circular 2026-12, Section 3.2', '10.10.50.15', '2026-08-31 10:30:00'),
  ('al005', 'u001', 'Fatima Al-Rashdi', 'product_manager', 'AI_SCHEMA_GENERATED', 'product', 'p009', '{"schema_type":"gsas_validation","fields":["certificate_number","issuer","score","rating","expiry"],"ai_model":"gpt-4o"}', 'ai_generated', 96, 'OS GSO 3000:2025, Section 4.2', '10.10.50.15', '2026-08-31 10:32:00'),
  ('al006', 'u001', 'Fatima Al-Rashdi', 'product_manager', 'PRODUCT_PUBLISHED', 'product', 'p009', '{"status":"active","product_name":"Green Home Loan – ESG"}', 'manual', null, null, '10.10.50.15', '2026-08-31 10:34:00'),
  ('al007', 'u010', 'Ahmed Al-Hinai', 'developer', 'PROJECT_CREATED', 'project', 'proj004', '{"name":"EcoVillage Muscat","location":"Seeb","units":24}', 'manual', null, null, '41.22.33.44', '2026-08-31 11:05:00'),
  ('al008', 'system', 'System AI', 'system', 'DOCUMENT_AUTO_VERIFIED', 'document', 'doc001', '{"doc_type":"gsas_cert","confidence":96,"status":"auto_verified","score":89}', 'ai_generated', 96, 'OS GSO 3000:2025', null, '2026-08-31 11:08:00'),
  ('al009', 'system', 'System AI', 'system', 'DOCUMENT_FLAGGED_REVIEW', 'document', 'doc002', '{"doc_type":"epc_report","confidence":88,"status":"manual_review","reason":"Image slightly skewed"}', 'ai_generated', 88, 'OEESC', null, '2026-08-31 11:09:00'),
  ('al010', 'u002', 'Aisha Al-Balushi', 'compliance_officer', 'DOCUMENT_OVERRIDE', 'document', 'doc002', '{"action":"Override AI Confidence","reason":"Visual verification completed. Document legible."}', 'manual', null, 'OEESC Section 5.1', '10.10.50.22', '2026-08-31 14:15:00'),
  ('al011', 'u020', 'Salim Al-Harthy', 'customer', 'APPLICATION_SUBMITTED', 'application', 'app003', '{"reference":"GHL-250001","amount":200000,"term":25,"rate":4.75,"gsas_score":89}', 'manual', null, null, '91.241.11.55', '2026-08-31 15:30:00'),
  ('al012', 'system', 'System AI', 'system', 'CREDIT_SCORING_COMPLETE', 'application', 'app003', '{"dbr":48,"ltv":80,"malaa_score":750,"stress_test":"passed","recommendation":"approve"}', 'ai_generated', 97, 'CBO Circular 2024-01', null, '2026-08-31 15:31:00');
