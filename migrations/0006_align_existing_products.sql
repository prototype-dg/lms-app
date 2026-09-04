-- ============================================================
-- Migration 0006: Align Existing 8 Products with PGE Architecture
-- ============================================================
-- Scope:
--   1. Arabic names & descriptions for all 8 products
--   2. Three new workflow templates: personal_loan, sme, commercial/education
--   3. Assign workflow_template_id to every product
--   4. Product-specific rules (link product_id for relevant rules)
--   5. Rule matrices per product (LTV×rate, credit score, term bands)
--   6. Compliance tag mappings for p002–p006, p008
--   7. pge_stage = 6 for all active products; 5 for archived
--   8. pge_stage_data stamped with completion metadata
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- STEP 1: Arabic names & descriptions on all 8 products
-- ════════════════════════════════════════════════════════════

-- Add name_ar column to products (does not exist in original schema)
ALTER TABLE products ADD COLUMN name_ar TEXT;

UPDATE products SET name_ar = 'قرض المنزل المعياري'             WHERE id = 'p001';
UPDATE products SET name_ar = 'تمويل السيارات – الأفراد'         WHERE id = 'p002';
UPDATE products SET name_ar = 'القرض الشخصي'                    WHERE id = 'p003';
UPDATE products SET name_ar = 'رأس المال العامل للمنشآت الصغيرة' WHERE id = 'p004';
UPDATE products SET name_ar = 'خط الائتمان العقاري'              WHERE id = 'p005';
UPDATE products SET name_ar = 'تمويل العقارات التجارية'          WHERE id = 'p006';
UPDATE products SET name_ar = 'تمويل المنزل للمقيمين الأجانب'   WHERE id = 'p007';
UPDATE products SET name_ar = 'تمويل التعليم'                   WHERE id = 'p008';

-- Enrich configuration JSON with Arabic description and key parameters
UPDATE products SET configuration = json_patch(configuration, json('{
  "name_ar": "قرض المنزل المعياري",
  "description_ar": "تمويل عقاري رئيسي للمواطنين العُمانيين والمقيمين. خيارات سعر ثابت ومتغير، مرفق بتأمين شامل ومتوافق مع متطلبات البنك المركزي.",
  "category_label": "Home Loan",
  "category_label_ar": "قرض سكني",
  "market": "Oman",
  "regulator": "CBO",
  "eligible_nationalities": ["Omani","Resident"],
  "employment_types": ["salaried","self_employed"],
  "collateral_required": true,
  "insurance_required": true,
  "salary_transfer_preferred": true,
  "min_salary_omr": 600
}')) WHERE id = 'p001';

UPDATE products SET configuration = json_patch(configuration, json('{
  "name_ar": "تمويل السيارات – الأفراد",
  "description_ar": "تمويل المركبات الشخصية بما في ذلك السيارات الكهربائية. قرار ائتماني خلال 48 ساعة. يشمل المركبات الجديدة والمستعملة حتى 5 سنوات.",
  "category_label": "Auto Loan",
  "category_label_ar": "قرض السيارة",
  "market": "Oman",
  "regulator": "CBO",
  "vehicle_types": ["sedan","suv","ev","hybrid"],
  "max_vehicle_age_years": 5,
  "collateral_required": true,
  "collateral_type": "vehicle",
  "insurance_required": true,
  "approval_sla_hours": 48
}')) WHERE id = 'p002';

UPDATE products SET configuration = json_patch(configuration, json('{
  "name_ar": "القرض الشخصي",
  "description_ar": "تمويل شخصي غير مضمون لموظفي الجهات المعتمدة. لا يتطلب ضمانات. سعر ثابت تنافسي للأغراض الطبية والسفر وتحسين المنازل.",
  "category_label": "Personal Loan",
  "category_label_ar": "قرض شخصي",
  "market": "Oman",
  "regulator": "CBO",
  "collateral_required": false,
  "approved_employer_required": true,
  "insurance_available": true,
  "purpose_list": ["medical","travel","renovation","education","general"]
}')) WHERE id = 'p003';

UPDATE products SET configuration = json_patch(configuration, json('{
  "name_ar": "رأس المال العامل للمنشآت الصغيرة",
  "description_ar": "تسهيل رأس المال العامل قصير الأجل للمنشآت الصغيرة والمتوسطة المسجلة في عُمان. هيكل دوار أو لأجل. يدعم الرواتب والمخزون والنمو التشغيلي.",
  "category_label": "SME Finance",
  "category_label_ar": "تمويل المنشآت الصغيرة",
  "market": "Oman",
  "regulator": "CBO",
  "entity_types": ["llc","sole_proprietorship","partnership"],
  "min_years_in_operation": 2,
  "moci_cr_required": true,
  "facility_types": ["revolving","term"],
  "audited_financials_required": true
}')) WHERE id = 'p004';

UPDATE products SET configuration = json_patch(configuration, json('{
  "name_ar": "خط الائتمان العقاري",
  "description_ar": "تسهيل ائتماني متجدد مضمون بعقار مملوك. الاستفادة من حقوق الملكية دون البيع. مثالي للمشتريات الكبيرة والتعليم وتمويل الأعمال.",
  "category_label": "Home Equity Line",
  "category_label_ar": "خط ائتمان عقاري",
  "market": "Oman",
  "regulator": "CBO",
  "collateral_required": true,
  "collateral_type": "existing_property",
  "second_charge": true,
  "revolving": true,
  "no_early_settlement_penalty": true,
  "noc_required_from_primary_lender": true
}')) WHERE id = 'p005';

UPDATE products SET configuration = json_patch(configuration, json('{
  "name_ar": "تمويل العقارات التجارية",
  "description_ar": "تمويل العقارات التجارية بما فيها المكاتب والمحلات التجارية والمستودعات. متاح للشركات العُمانية والملاك الأفراد. تقييم ائتماني مؤسسي كامل.",
  "category_label": "Commercial Finance",
  "category_label_ar": "تمويل تجاري",
  "market": "Oman",
  "regulator": "CBO",
  "property_types": ["office","retail","warehouse","mixed_use"],
  "entity_types": ["llc","sole_proprietorship","corporate"],
  "lease_income_considered": true,
  "board_resolution_required": true,
  "collateral_required": true
}')) WHERE id = 'p006';

UPDATE products SET configuration = json_patch(configuration, json('{
  "name_ar": "تمويل المنزل للمقيمين الأجانب",
  "description_ar": "تمويل منزلي للمهنيين المقيمين الأجانب في عُمان. نسبة قرض أقصاها 75% وفق لوائح البنك المركزي. متاح في مناطق التملك الحر المعتمدة.",
  "category_label": "Expat Home Finance",
  "category_label_ar": "تمويل المنزل للأجانب",
  "market": "Oman",
  "regulator": "CBO",
  "eligible_nationalities": ["expatriate"],
  "freehold_zones_only": true,
  "employer_noc_required": true,
  "work_permit_required": true,
  "max_ltv_cbo_expat": 75,
  "collateral_required": true
}')) WHERE id = 'p007';

UPDATE products SET configuration = json_patch(configuration, json('{
  "name_ar": "تمويل التعليم",
  "description_ar": "تمويل نفقات التعليم العالي بما فيها الرسوم الدراسية والإقامة والمستلزمات الدراسية في الجامعات المعتمدة داخل عُمان وخارجها. خيار تأجيل السداد متاح.",
  "category_label": "Education Finance",
  "category_label_ar": "تمويل تعليمي",
  "market": "Oman",
  "regulator": "CBO",
  "collateral_required": false,
  "deferred_repayment_available": true,
  "approved_universities_required": true,
  "covers": ["tuition","accommodation","study_materials"],
  "insurance_available": true
}')) WHERE id = 'p008';

-- ════════════════════════════════════════════════════════════
-- STEP 2: New workflow templates for remaining categories
-- ════════════════════════════════════════════════════════════

-- wft003: Personal Loan Fast Track
INSERT OR IGNORE INTO workflow_templates (
  id, market_id, name, name_ar, description, category,
  nodes, edges, is_system, is_active, created_by
) VALUES (
  'wft003',
  'mkt001',
  'Personal Loan Fast Track',
  'مسار القرض الشخصي السريع',
  'Streamlined workflow for unsecured personal loans — employer verification, auto credit check, single approval',
  'personal_loan',
  json('[
    {"id":"n1","type":"start","x":80,"y":200,"label":"Application Submitted","label_ar":"تقديم الطلب","role":null},
    {"id":"n2","type":"task","x":280,"y":200,"label":"Employer Verification","label_ar":"التحقق من صاحب العمل","role":"system","auto":true},
    {"id":"n3","type":"task","x":480,"y":200,"label":"Credit Bureau Check","label_ar":"فحص مكتب الائتمان","role":"system","auto":true},
    {"id":"n4","type":"gateway","x":680,"y":200,"label":"DBR & Score Gate","label_ar":"بوابة نسبة الدين والتقييم","gate_type":"exclusive"},
    {"id":"n5","type":"task","x":880,"y":120,"label":"Auto Approve","label_ar":"موافقة تلقائية","role":"system","auto":true},
    {"id":"n6","type":"task","x":880,"y":280,"label":"Risk Officer Review","label_ar":"مراجعة مسؤول المخاطر","role":"risk_officer","auto":false},
    {"id":"n7","type":"task","x":1080,"y":200,"label":"Disbursement","label_ar":"الصرف","role":"operations","auto":false},
    {"id":"n8","type":"end","x":1280,"y":200,"label":"Completed","label_ar":"مكتمل","role":null}
  ]'),
  json('[
    {"id":"e1","from":"n1","to":"n2","label":""},
    {"id":"e2","from":"n2","to":"n3","label":"Employer Verified"},
    {"id":"e3","from":"n3","to":"n4","label":""},
    {"id":"e4","from":"n4","to":"n5","label":"Score ≥ 680 & DBR ≤ 40%"},
    {"id":"e5","from":"n4","to":"n6","label":"Score < 680 or DBR > 40%"},
    {"id":"e6","from":"n5","to":"n7","label":""},
    {"id":"e7","from":"n6","to":"n7","label":"Approved"},
    {"id":"e8","from":"n7","to":"n8","label":""}
  ]'),
  1, 1, 'system'
);

-- wft004: SME Credit Committee
INSERT OR IGNORE INTO workflow_templates (
  id, market_id, name, name_ar, description, category,
  nodes, edges, is_system, is_active, created_by
) VALUES (
  'wft004',
  'mkt001',
  'SME Credit Committee',
  'لجنة ائتمان المنشآت الصغيرة',
  'Full committee review for SME working capital — financial analysis, AML check, dual credit/risk approval',
  'sme',
  json('[
    {"id":"n1","type":"start","x":80,"y":240,"label":"Application Submitted","label_ar":"تقديم الطلب","role":null},
    {"id":"n2","type":"task","x":280,"y":240,"label":"Document Completeness","label_ar":"اكتمال الوثائق","role":"operations","auto":false},
    {"id":"n3","type":"task","x":480,"y":140,"label":"AML / KYC Screening","label_ar":"فحص مكافحة الغسيل","role":"system","auto":true},
    {"id":"n4","type":"task","x":480,"y":340,"label":"Financial Analysis","label_ar":"التحليل المالي","role":"risk_officer","auto":false},
    {"id":"n5","type":"task","x":680,"y":140,"label":"Compliance Review","label_ar":"مراجعة الامتثال","role":"compliance_officer","auto":false},
    {"id":"n6","type":"gateway","x":880,"y":240,"label":"Credit Committee","label_ar":"لجنة الائتمان","gate_type":"parallel"},
    {"id":"n7","type":"task","x":1080,"y":240,"label":"Disbursement","label_ar":"الصرف","role":"operations","auto":false},
    {"id":"n8","type":"end","x":1280,"y":240,"label":"Completed","label_ar":"مكتمل","role":null}
  ]'),
  json('[
    {"id":"e1","from":"n1","to":"n2","label":""},
    {"id":"e2","from":"n2","to":"n3","label":"Docs Complete"},
    {"id":"e3","from":"n2","to":"n4","label":"Docs Complete"},
    {"id":"e4","from":"n3","to":"n5","label":"AML Clear"},
    {"id":"e5","from":"n4","to":"n6","label":"Analysis Done"},
    {"id":"e6","from":"n5","to":"n6","label":"Compliance Approved"},
    {"id":"e7","from":"n6","to":"n7","label":"All Approved"},
    {"id":"e8","from":"n7","to":"n8","label":""}
  ]'),
  1, 1, 'system'
);

-- wft005: Commercial & Education Standard Review
INSERT OR IGNORE INTO workflow_templates (
  id, market_id, name, name_ar, description, category,
  nodes, edges, is_system, is_active, created_by
) VALUES (
  'wft005',
  'mkt001',
  'Commercial Finance Review',
  'مراجعة التمويل التجاري',
  'Multi-stage review for commercial property and large-value facilities — valuation, legal, credit committee, CEO sign-off',
  'commercial',
  json('[
    {"id":"n1","type":"start","x":80,"y":240,"label":"Application Submitted","label_ar":"تقديم الطلب","role":null},
    {"id":"n2","type":"task","x":280,"y":240,"label":"KYC & AML Screening","label_ar":"فحص مكافحة الغسيل","role":"system","auto":true},
    {"id":"n3","type":"task","x":480,"y":140,"label":"Independent Valuation","label_ar":"تقييم مستقل","role":"operations","auto":false},
    {"id":"n4","type":"task","x":480,"y":340,"label":"Legal Review","label_ar":"المراجعة القانونية","role":"operations","auto":false},
    {"id":"n5","type":"task","x":680,"y":140,"label":"Credit Analysis","label_ar":"التحليل الائتماني","role":"risk_officer","auto":false},
    {"id":"n6","type":"task","x":680,"y":340,"label":"Compliance Sign-Off","label_ar":"موافقة الامتثال","role":"compliance_officer","auto":false},
    {"id":"n7","type":"gateway","x":880,"y":240,"label":"Senior Credit Committee","label_ar":"لجنة الائتمان العليا","gate_type":"parallel"},
    {"id":"n8","type":"task","x":1080,"y":240,"label":"CEO Approval","label_ar":"موافقة الرئيس التنفيذي","role":"ceo","auto":false},
    {"id":"n9","type":"task","x":1280,"y":240,"label":"Disbursement","label_ar":"الصرف","role":"operations","auto":false},
    {"id":"n10","type":"end","x":1480,"y":240,"label":"Completed","label_ar":"مكتمل","role":null}
  ]'),
  json('[
    {"id":"e1","from":"n1","to":"n2","label":""},
    {"id":"e2","from":"n2","to":"n3","label":"AML Clear"},
    {"id":"e3","from":"n2","to":"n4","label":"AML Clear"},
    {"id":"e4","from":"n3","to":"n5","label":"Valuation Complete"},
    {"id":"e5","from":"n4","to":"n6","label":"Legal Clear"},
    {"id":"e6","from":"n5","to":"n7","label":"Credit Approved"},
    {"id":"e7","from":"n6","to":"n7","label":"Compliance Approved"},
    {"id":"e8","from":"n7","to":"n8","label":"Committee Approved"},
    {"id":"e9","from":"n8","to":"n9","label":"CEO Signed"},
    {"id":"e10","from":"n9","to":"n10","label":""}
  ]'),
  1, 1, 'system'
);

-- wft006: Education Finance Light
INSERT OR IGNORE INTO workflow_templates (
  id, market_id, name, name_ar, description, category,
  nodes, edges, is_system, is_active, created_by
) VALUES (
  'wft006',
  'mkt001',
  'Education Finance Approval',
  'موافقة تمويل التعليم',
  'Simplified approval for education financing — university verification, single credit check, operations disbursement',
  'education',
  json('[
    {"id":"n1","type":"start","x":80,"y":200,"label":"Application Submitted","label_ar":"تقديم الطلب","role":null},
    {"id":"n2","type":"task","x":280,"y":200,"label":"University Verification","label_ar":"التحقق من الجامعة","role":"system","auto":true},
    {"id":"n3","type":"task","x":480,"y":200,"label":"Credit Bureau Check","label_ar":"فحص مكتب الائتمان","role":"system","auto":true},
    {"id":"n4","type":"task","x":680,"y":200,"label":"Credit Officer Review","label_ar":"مراجعة مسؤول الائتمان","role":"risk_officer","auto":false},
    {"id":"n5","type":"task","x":880,"y":200,"label":"Disbursement to Institution","label_ar":"الصرف للمؤسسة","role":"operations","auto":false},
    {"id":"n6","type":"end","x":1080,"y":200,"label":"Completed","label_ar":"مكتمل","role":null}
  ]'),
  json('[
    {"id":"e1","from":"n1","to":"n2","label":""},
    {"id":"e2","from":"n2","to":"n3","label":"University Approved"},
    {"id":"e3","from":"n3","to":"n4","label":""},
    {"id":"e4","from":"n4","to":"n5","label":"Approved"},
    {"id":"e5","from":"n5","to":"n6","label":""}
  ]'),
  1, 1, 'system'
);

-- wft007: Home Equity Line (HELOC)
INSERT OR IGNORE INTO workflow_templates (
  id, market_id, name, name_ar, description, category,
  nodes, edges, is_system, is_active, created_by
) VALUES (
  'wft007',
  'mkt001',
  'Home Equity Line Approval',
  'موافقة خط الائتمان العقاري',
  'HELOC approval — existing mortgage review, property re-valuation, NOC from primary lender, dual sign-off',
  'home_equity',
  json('[
    {"id":"n1","type":"start","x":80,"y":200,"label":"Application Submitted","label_ar":"تقديم الطلب","role":null},
    {"id":"n2","type":"task","x":280,"y":200,"label":"Existing Mortgage Review","label_ar":"مراجعة الرهن الحالي","role":"risk_officer","auto":false},
    {"id":"n3","type":"task","x":480,"y":120,"label":"Property Re-Valuation","label_ar":"إعادة تقييم العقار","role":"operations","auto":false},
    {"id":"n4","type":"task","x":480,"y":280,"label":"Credit Bureau Check","label_ar":"فحص مكتب الائتمان","role":"system","auto":true},
    {"id":"n5","type":"task","x":680,"y":200,"label":"NOC Verification","label_ar":"التحقق من عدم الممانعة","role":"operations","auto":false},
    {"id":"n6","type":"gateway","x":880,"y":200,"label":"Dual Approval","label_ar":"موافقة مزدوجة","gate_type":"parallel"},
    {"id":"n7","type":"task","x":1080,"y":200,"label":"Facility Activation","label_ar":"تفعيل التسهيل","role":"operations","auto":false},
    {"id":"n8","type":"end","x":1280,"y":200,"label":"Completed","label_ar":"مكتمل","role":null}
  ]'),
  json('[
    {"id":"e1","from":"n1","to":"n2","label":""},
    {"id":"e2","from":"n2","to":"n3","label":""},
    {"id":"e3","from":"n2","to":"n4","label":""},
    {"id":"e4","from":"n3","to":"n5","label":"Valuation Done"},
    {"id":"e5","from":"n4","to":"n5","label":"Score OK"},
    {"id":"e6","from":"n5","to":"n6","label":"NOC Received"},
    {"id":"e7","from":"n6","to":"n7","label":"Both Approved"},
    {"id":"e8","from":"n7","to":"n8","label":""}
  ]'),
  1, 1, 'system'
);

-- ════════════════════════════════════════════════════════════
-- STEP 3: Assign workflow_template_id to every product
-- ════════════════════════════════════════════════════════════

UPDATE products SET workflow_template_id = 'wft001' WHERE id = 'p001';  -- Standard Home Loan → Standard Loan Approval
UPDATE products SET workflow_template_id = 'wft002' WHERE id = 'p002';  -- Auto Finance → Express Auto Finance
UPDATE products SET workflow_template_id = 'wft003' WHERE id = 'p003';  -- Personal Loan → Personal Loan Fast Track
UPDATE products SET workflow_template_id = 'wft004' WHERE id = 'p004';  -- SME Working Capital → SME Credit Committee
UPDATE products SET workflow_template_id = 'wft007' WHERE id = 'p005';  -- Home Equity Line → HELOC Approval
UPDATE products SET workflow_template_id = 'wft005' WHERE id = 'p006';  -- Commercial Property → Commercial Finance Review
UPDATE products SET workflow_template_id = 'wft001' WHERE id = 'p007';  -- Expat Home Finance → Standard Loan Approval (same flow, stricter LTV)
UPDATE products SET workflow_template_id = 'wft006' WHERE id = 'p008';  -- Education Finance → Education Finance Approval

-- ════════════════════════════════════════════════════════════
-- STEP 4: Product-specific rules
--   Link the 14 global rules to the appropriate products.
--   Strategy: duplicate relevant global rules as product-specific
--   variants so each product has its own editable rule set.
-- ════════════════════════════════════════════════════════════

-- Rules schema: id, product_id, name, category, metric, operator, threshold,
--   condition, action, rule_type, regulatory_reference, source, ai_confidence,
--   description, is_active, created_by, created_at

-- ─── p001: Standard Home Loan ────────────────────────────────────────────────
INSERT OR IGNORE INTO rules VALUES
  ('r_p001_01','p001','DBR Cap – Standard Home Loan','creditworthiness','DBR','<=',60,null,'reject','hard','CBO BM 1117 Section 4.1','manual',null,'DBR must not exceed 60% for standard home loan applicants',1,'system','2026-01-01'),
  ('r_p001_02','p001','LTV Cap – Omani Salaried','collateral','LTV','<=',90,'nationality=Omani AND employment=salaried','reject','hard','CBO Circular 2024-01, Section 4.2','manual',null,'Max LTV 90% for salaried Omani nationals',1,'system','2026-01-01'),
  ('r_p001_03','p001','LTV Cap – Expat Residents','collateral','LTV','<=',75,'nationality!=Omani','reject','hard','CBO Circular 2024-01, Section 4.3','manual',null,'Max LTV 75% for expatriate applicants on standard home loan',1,'system','2026-01-01'),
  ('r_p001_04','p001','Min Term – Home Loan','product','loan_term','>=',5,null,'reject','hard','Bank Policy BP-2024-HL-001','manual',null,'Minimum term 5 years for standard home loan',1,'system','2026-01-01'),
  ('r_p001_05','p001','Max Term – Home Loan','product','loan_term','<=',25,null,'reject','hard','CBO Circular 2024-01, Section 5.1','manual',null,'Maximum term 25 years for standard home loan',1,'system','2026-01-01'),
  ('r_p001_06','p001','Min Credit Score','creditworthiness','credit_score','>=',650,null,'reject','hard','Bank Policy BP-2024-CR-002','manual',null,'Minimum MALA''A score 650',1,'system','2026-01-01'),
  ('r_p001_07','p001','Stress Test – Rate Hike','stress_test','stress_rate','<=',9,null,'reject','hard','CBO Circular 2025-07, Section 2.3','manual',null,'Post-stress DBR must stay ≤ 70% at +350bps',1,'system','2026-01-01'),
  ('r_p001_08','p001','Min Salary','eligibility','salary_omr','>=',600,null,'reject','soft','Bank Policy BP-2024-HL-003','manual',null,'Minimum monthly salary OMR 600 for home loan',1,'system','2026-01-01'),
  ('r_p001_09','p001','Property Valuation Required','collateral','valuation_required','=',1,null,'reject','hard','CBO Circular 2024-01, Section 6.1','manual',null,'Independent property valuation mandatory',1,'system','2026-01-01'),
  ('r_p001_10','p001','AML Sanctions Screen','compliance','sanctions_clear','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 8','manual',null,'Customer must pass OFAC/UN/EU sanctions screening',1,'system','2026-01-01'),
  ('r_p001_11','p001','KYC Completeness','compliance','kyc_complete','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 5.2','manual',null,'All KYC documents verified and current',1,'system','2026-01-01');

-- ─── p002: Auto Finance – Personal ───────────────────────────────────────────
INSERT OR IGNORE INTO rules VALUES
  ('r_p002_01','p002','DBR Cap – Auto Finance','creditworthiness','DBR','<=',55,null,'reject','hard','CBO BM 1117 Section 4.1','manual',null,'DBR must not exceed 55% for auto finance',1,'system','2026-01-01'),
  ('r_p002_02','p002','LTV Cap – Auto Finance','collateral','LTV','<=',85,null,'reject','hard','Bank Policy BP-AUTO-001','manual',null,'Max LTV 85% for personal auto finance',1,'system','2026-01-01'),
  ('r_p002_03','p002','Max Vehicle Age','product','vehicle_age_years','<=',5,null,'reject','hard','Bank Policy BP-AUTO-002','manual',null,'Vehicle must not be older than 5 years at origination',1,'system','2026-01-01'),
  ('r_p002_04','p002','Min Term – Auto','product','loan_term','>=',1,null,'reject','hard','Bank Policy BP-AUTO-003','manual',null,'Minimum term 1 year for auto finance',1,'system','2026-01-01'),
  ('r_p002_05','p002','Max Term – Auto','product','loan_term','<=',7,null,'reject','hard','Bank Policy BP-AUTO-003','manual',null,'Maximum term 7 years for auto finance',1,'system','2026-01-01'),
  ('r_p002_06','p002','Min Credit Score – Auto','creditworthiness','credit_score','>=',620,null,'reject','hard','Bank Policy BP-2024-CR-002','manual',null,'Minimum MALA''A score 620 for auto finance',1,'system','2026-01-01'),
  ('r_p002_07','p002','Insurance Required – Vehicle','collateral','insurance_active','=',1,null,'reject','hard','Bank Policy BP-AUTO-004','manual',null,'Comprehensive vehicle insurance mandatory throughout term',1,'system','2026-01-01'),
  ('r_p002_08','p002','AML Sanctions Screen','compliance','sanctions_clear','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 8','manual',null,'Customer must pass OFAC/UN/EU sanctions screening',1,'system','2026-01-01'),
  ('r_p002_09','p002','KYC Completeness','compliance','kyc_complete','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 5.2','manual',null,'All KYC documents verified',1,'system','2026-01-01');

-- ─── p003: Personal Loan (unsecured) ─────────────────────────────────────────
INSERT OR IGNORE INTO rules VALUES
  ('r_p003_01','p003','DBR Cap – Personal Loan','creditworthiness','DBR','<=',45,null,'reject','hard','CBO BM 1117 Section 4.1','manual',null,'DBR must not exceed 45% for unsecured personal loans (stricter than mortgage)',1,'system','2026-01-01'),
  ('r_p003_02','p003','Approved Employer Required','eligibility','approved_employer','=',1,null,'reject','hard','Bank Policy BP-PL-001','manual',null,'Applicant must work for employer on approved list',1,'system','2026-01-01'),
  ('r_p003_03','p003','Min Salary – Personal','eligibility','salary_omr','>=',300,null,'reject','soft','Bank Policy BP-PL-002','manual',null,'Minimum monthly salary OMR 300 for personal loan',1,'system','2026-01-01'),
  ('r_p003_04','p003','Min Credit Score – Personal','creditworthiness','credit_score','>=',600,null,'reject','hard','Bank Policy BP-2024-CR-002','manual',null,'Minimum MALA''A score 600 for personal loan',1,'system','2026-01-01'),
  ('r_p003_05','p003','Max Term – Personal Loan','product','loan_term','<=',5,null,'reject','hard','CBO BM 1117 Section 4.2','manual',null,'Maximum term 5 years for unsecured personal loans',1,'system','2026-01-01'),
  ('r_p003_06','p003','Max Amount – Personal Loan','product','loan_amount','<=',30000,null,'reject','hard','Bank Policy BP-PL-003','manual',null,'Maximum unsecured personal loan OMR 30,000',1,'system','2026-01-01'),
  ('r_p003_07','p003','AML Sanctions Screen','compliance','sanctions_clear','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 8','manual',null,'Mandatory sanctions screening',1,'system','2026-01-01'),
  ('r_p003_08','p003','KYC Completeness','compliance','kyc_complete','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 5.2','manual',null,'All KYC documents verified',1,'system','2026-01-01');

-- ─── p004: SME Working Capital ────────────────────────────────────────────────
INSERT OR IGNORE INTO rules VALUES
  ('r_p004_01','p004','DBR Cap – SME','creditworthiness','DBR','<=',65,null,'reject','hard','CBO BM 1117 Section 4.1','manual',null,'DBR/DSCR must not exceed 65% for SME working capital',1,'system','2026-01-01'),
  ('r_p004_02','p004','LTV Cap – SME Secured','collateral','LTV','<=',70,'collateral_type=property','reject','hard','Bank Policy BP-SME-001','manual',null,'Max LTV 70% when SME facility is secured against property',1,'system','2026-01-01'),
  ('r_p004_03','p004','Min Years in Operation','eligibility','years_in_operation','>=',2,null,'reject','hard','Bank Policy BP-SME-002','manual',null,'Business must have been operating for at least 2 years',1,'system','2026-01-01'),
  ('r_p004_04','p004','MOCI CR Valid','eligibility','cr_valid','=',1,null,'reject','hard','MOCI Companies Law','manual',null,'Commercial Registration must be current and valid',1,'system','2026-01-01'),
  ('r_p004_05','p004','Audited Financials Required','eligibility','audited_financials_2yr','=',1,null,'reject','hard','Bank Policy BP-SME-003','manual',null,'2 years audited financial statements mandatory',1,'system','2026-01-01'),
  ('r_p004_06','p004','Max Term – SME Working Capital','product','loan_term','<=',3,null,'reject','hard','Bank Policy BP-SME-004','manual',null,'Maximum term 3 years for SME working capital facilities',1,'system','2026-01-01'),
  ('r_p004_07','p004','AML Sanctions Screen','compliance','sanctions_clear','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 8','manual',null,'Entity and UBOs must pass sanctions screening',1,'system','2026-01-01'),
  ('r_p004_08','p004','KYC Completeness','compliance','kyc_complete','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 5.2','manual',null,'Corporate KYC including UBO disclosure complete',1,'system','2026-01-01'),
  ('r_p004_09','p004','Min Credit Score – SME','creditworthiness','credit_score','>=',640,'entity_type=sole_proprietorship','reject','soft','Bank Policy BP-2024-CR-002','manual',null,'Sole proprietor min MALA''A score 640',1,'system','2026-01-01');

-- ─── p005: Home Equity Line (HELOC) ──────────────────────────────────────────
INSERT OR IGNORE INTO rules VALUES
  ('r_p005_01','p005','DBR Cap – HELOC','creditworthiness','DBR','<=',55,null,'reject','hard','CBO BM 1117 Section 4.1','manual',null,'Combined DBR (first + HELOC) must not exceed 55%',1,'system','2026-01-01'),
  ('r_p005_02','p005','LTV Cap – HELOC Second Charge','collateral','LTV','<=',75,null,'reject','hard','Bank Policy BP-HELOC-001','manual',null,'Combined LTV including first mortgage must not exceed 75%',1,'system','2026-01-01'),
  ('r_p005_03','p005','Property Valuation Required','collateral','valuation_required','=',1,null,'reject','hard','CBO Circular 2024-01, Section 6.1','manual',null,'Fresh independent property valuation mandatory',1,'system','2026-01-01'),
  ('r_p005_04','p005','NOC from Primary Lender','collateral','noc_received','=',1,null,'reject','hard','Bank Policy BP-HELOC-002','manual',null,'No-Objection Certificate required from primary mortgage lender',1,'system','2026-01-01'),
  ('r_p005_05','p005','Min Credit Score – HELOC','creditworthiness','credit_score','>=',660,null,'reject','hard','Bank Policy BP-2024-CR-002','manual',null,'Minimum MALA''A score 660 for home equity line',1,'system','2026-01-01'),
  ('r_p005_06','p005','Stress Test – HELOC','stress_test','stress_rate','<=',9,null,'reject','hard','CBO Circular 2025-07, Section 2.3','manual',null,'Combined stress DBR must stay ≤ 70% at +350bps',1,'system','2026-01-01'),
  ('r_p005_07','p005','AML Sanctions Screen','compliance','sanctions_clear','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 8','manual',null,'Mandatory sanctions screening',1,'system','2026-01-01'),
  ('r_p005_08','p005','KYC Completeness','compliance','kyc_complete','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 5.2','manual',null,'All KYC documents verified',1,'system','2026-01-01');

-- ─── p006: Commercial Property Finance ───────────────────────────────────────
INSERT OR IGNORE INTO rules VALUES
  ('r_p006_01','p006','DBR Cap – Commercial','creditworthiness','DBR','<=',65,null,'reject','hard','CBO BM 1117 Section 4.1','manual',null,'DSCR equivalent DBR must not exceed 65% for commercial finance',1,'system','2026-01-01'),
  ('r_p006_02','p006','LTV Cap – Commercial Property','collateral','LTV','<=',70,null,'reject','hard','CBO BM 1117 Section 4.3','manual',null,'Max LTV 70% for commercial property financing',1,'system','2026-01-01'),
  ('r_p006_03','p006','Property Valuation – Commercial','collateral','valuation_required','=',1,null,'reject','hard','CBO Circular 2024-01, Section 6.1','manual',null,'Certified independent commercial property valuation mandatory',1,'system','2026-01-01'),
  ('r_p006_04','p006','Board Resolution Required','eligibility','board_resolution','=',1,'entity_type=llc OR entity_type=corporate','reject','hard','Companies Law Oman','manual',null,'Board resolution authorising borrowing required for companies',1,'system','2026-01-01'),
  ('r_p006_05','p006','Audited Financials – 3 Years','eligibility','audited_financials_3yr','=',1,null,'reject','hard','Bank Policy BP-COM-001','manual',null,'3 years audited financial statements required',1,'system','2026-01-01'),
  ('r_p006_06','p006','AML Sanctions Screen – Corporate','compliance','sanctions_clear','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 8','manual',null,'Entity, directors, and UBOs must pass sanctions screening',1,'system','2026-01-01'),
  ('r_p006_07','p006','KYC – Corporate','compliance','kyc_complete','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 5.2','manual',null,'Full corporate KYC including UBO chain complete',1,'system','2026-01-01'),
  ('r_p006_08','p006','MOCI CR Valid – Commercial','eligibility','cr_valid','=',1,null,'reject','hard','MOCI Companies Law','manual',null,'Commercial Registration must be current and valid',1,'system','2026-01-01'),
  ('r_p006_09','p006','Min Facility Amount – Commercial','product','loan_amount','>=',50000,null,'reject','hard','Bank Policy BP-COM-002','manual',null,'Minimum commercial property facility OMR 50,000',1,'system','2026-01-01');

-- ─── p007: Expat Home Finance ─────────────────────────────────────────────────
INSERT OR IGNORE INTO rules VALUES
  ('r_p007_01','p007','DBR Cap – Expat Home','creditworthiness','DBR','<=',55,null,'reject','hard','CBO BM 1117 Section 4.1','manual',null,'DBR must not exceed 55% for expat home finance (stricter than Omani)',1,'system','2026-01-01'),
  ('r_p007_02','p007','LTV Cap – Expat CBO Maximum','collateral','LTV','<=',75,null,'reject','hard','CBO Circular 2024-01, Section 4.3','manual',null,'Max LTV 75% for expatriate home finance per CBO regulations',1,'system','2026-01-01'),
  ('r_p007_03','p007','Freehold Zone Only','eligibility','freehold_zone','=',1,null,'reject','hard','Foreign Ownership Law Oman','manual',null,'Property must be in CBO-approved freehold / IZ zone for expat ownership',1,'system','2026-01-01'),
  ('r_p007_04','p007','Valid Work Permit Required','eligibility','work_permit_valid','=',1,null,'reject','hard','Royal Oman Police – Residency Regulations','manual',null,'Valid Omani work permit / residency card required at origination',1,'system','2026-01-01'),
  ('r_p007_05','p007','Employer NOC Required','eligibility','employer_noc','=',1,null,'reject','hard','Bank Policy BP-EHL-001','manual',null,'No-Objection Certificate from current employer mandatory',1,'system','2026-01-01'),
  ('r_p007_06','p007','Min Credit Score – Expat','creditworthiness','credit_score','>=',670,null,'reject','hard','Bank Policy BP-2024-CR-002','manual',null,'Minimum MALA''A score 670 for expat home finance',1,'system','2026-01-01'),
  ('r_p007_07','p007','Stress Test – Expat Rate Hike','stress_test','stress_rate','<=',9,null,'reject','hard','CBO Circular 2025-07, Section 2.3','manual',null,'Post-stress DBR must stay ≤ 70% at +350bps',1,'system','2026-01-01'),
  ('r_p007_08','p007','Property Valuation Required','collateral','valuation_required','=',1,null,'reject','hard','CBO Circular 2024-01, Section 6.1','manual',null,'Independent property valuation mandatory',1,'system','2026-01-01'),
  ('r_p007_09','p007','AML Sanctions Screen','compliance','sanctions_clear','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 8','manual',null,'Mandatory OFAC/UN/EU sanctions screening',1,'system','2026-01-01'),
  ('r_p007_10','p007','KYC Completeness','compliance','kyc_complete','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 5.2','manual',null,'All KYC including passport and residency card verified',1,'system','2026-01-01');

-- ─── p008: Education Finance ──────────────────────────────────────────────────
INSERT OR IGNORE INTO rules VALUES
  ('r_p008_01','p008','DBR Cap – Education','creditworthiness','DBR','<=',45,null,'reject','hard','CBO BM 1117 Section 4.1','manual',null,'DBR must not exceed 45% for education finance (same as personal loan)',1,'system','2026-01-01'),
  ('r_p008_02','p008','Approved University Required','eligibility','approved_university','=',1,null,'reject','hard','Bank Policy BP-EDU-001','manual',null,'Institution must be on bank approved-university list',1,'system','2026-01-01'),
  ('r_p008_03','p008','University Offer Letter Required','eligibility','offer_letter_provided','=',1,null,'reject','hard','Bank Policy BP-EDU-002','manual',null,'Valid enrollment / offer letter from institution mandatory',1,'system','2026-01-01'),
  ('r_p008_04','p008','Min Credit Score – Education','creditworthiness','credit_score','>=',580,null,'reject','soft','Bank Policy BP-2024-CR-002','manual',null,'Minimum MALA''A score 580 for education finance',1,'system','2026-01-01'),
  ('r_p008_05','p008','Max Term – Education','product','loan_term','<=',8,null,'reject','hard','Bank Policy BP-EDU-003','manual',null,'Maximum 8 years for education finance',1,'system','2026-01-01'),
  ('r_p008_06','p008','Max Amount – Education','product','loan_amount','<=',20000,null,'reject','hard','Bank Policy BP-EDU-004','manual',null,'Maximum education finance amount OMR 20,000',1,'system','2026-01-01'),
  ('r_p008_07','p008','AML Sanctions Screen','compliance','sanctions_clear','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 8','manual',null,'Mandatory sanctions screening',1,'system','2026-01-01'),
  ('r_p008_08','p008','KYC Completeness','compliance','kyc_complete','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 5.2','manual',null,'All KYC documents verified',1,'system','2026-01-01');

-- ════════════════════════════════════════════════════════════
-- STEP 5: Rule matrices per product
--   Each product gets at least:
--     A) DBR × credit score rate adjustment matrix
--     B) LTV band pricing matrix (for secured products)
--     C) Term band premium matrix (where applicable)
-- ════════════════════════════════════════════════════════════

-- ─── p001: Standard Home Loan ────────────────────────────────────────────────

-- p001-m1: LTV Band × GSAS Tier → Rate Adjustment (%)
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p001_01','p001','mkt001',
  'LTV Band × GSAS Tier – Rate Adjustment',
  'نطاق القرض/القيمة × درجة GSAS – تعديل السعر',
  'Adjusts base rate based on LTV band and GSAS sustainability rating',
  'تعديل السعر الأساسي بناءً على نسبة القرض للقيمة ودرجة GSAS',
  'ltv_band','LTV Band','نطاق القرض للقيمة',
  'gsas_tier','GSAS Tier','فئة GSAS',
  json('[
    {"row_key":"0-60","col_key":"none","value":-0.25,"label":"-0.25%"},
    {"row_key":"0-60","col_key":"bronze","value":-0.50,"label":"-0.50%"},
    {"row_key":"0-60","col_key":"silver","value":-0.60,"label":"-0.60%"},
    {"row_key":"0-60","col_key":"gold","value":-0.75,"label":"-0.75%"},
    {"row_key":"61-75","col_key":"none","value":0.00,"label":"Base"},
    {"row_key":"61-75","col_key":"bronze","value":-0.25,"label":"-0.25%"},
    {"row_key":"61-75","col_key":"silver","value":-0.40,"label":"-0.40%"},
    {"row_key":"61-75","col_key":"gold","value":-0.50,"label":"-0.50%"},
    {"row_key":"76-85","col_key":"none","value":0.25,"label":"+0.25%"},
    {"row_key":"76-85","col_key":"bronze","value":0.10,"label":"+0.10%"},
    {"row_key":"76-85","col_key":"silver","value":0.00,"label":"Base"},
    {"row_key":"76-85","col_key":"gold","value":-0.15,"label":"-0.15%"},
    {"row_key":"86-90","col_key":"none","value":0.50,"label":"+0.50%"},
    {"row_key":"86-90","col_key":"bronze","value":0.35,"label":"+0.35%"},
    {"row_key":"86-90","col_key":"silver","value":0.20,"label":"+0.20%"},
    {"row_key":"86-90","col_key":"gold","value":0.00,"label":"Base"}
  ]'),
  'rate_adjustment','%',
  1,'CBO BM 1117 & Sohar Green Finance Policy v2','manual',null,'system',
  datetime('now'),datetime('now')
);

-- p001-m2: Credit Score Band → Base Rate Override
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p001_02','p001','mkt001',
  'Credit Score Band – Rate Adjustment',
  'نطاق التقييم الائتماني – تعديل السعر',
  'Rate premium or discount based on MALA''A credit score band',
  'علاوة أو خصم على السعر بناءً على نطاق درجة ملاءة',
  'credit_score_band','Credit Score Band','نطاق التقييم الائتماني',
  null,null,null,
  json('[
    {"row_key":"800+","col_key":null,"value":-0.50,"label":"Premium: -0.50%"},
    {"row_key":"750-799","col_key":null,"value":-0.25,"label":"Discount: -0.25%"},
    {"row_key":"700-749","col_key":null,"value":0.00,"label":"Base Rate"},
    {"row_key":"650-699","col_key":null,"value":0.25,"label":"Premium: +0.25%"},
    {"row_key":"< 650","col_key":null,"value":null,"label":"DECLINE"}
  ]'),
  'rate_adjustment','%',
  1,'Bank Policy BP-2024-CR-002','manual',null,'system',
  datetime('now'),datetime('now')
);

-- ─── p002: Auto Finance – Personal ───────────────────────────────────────────

-- p002-m1: Vehicle Age × LTV Band → Rate Adjustment
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p002_01','p002','mkt001',
  'Vehicle Age × LTV Band – Rate Adjustment',
  'عمر المركبة × نطاق القرض/القيمة – تعديل السعر',
  'Rate adjustment based on vehicle age and LTV for auto finance',
  'تعديل السعر بناءً على عمر المركبة ونسبة القرض للقيمة',
  'vehicle_age_band','Vehicle Age (Years)','عمر المركبة (سنوات)',
  'ltv_band','LTV Band','نطاق القرض للقيمة',
  json('[
    {"row_key":"New","col_key":"0-70","value":-0.25,"label":"-0.25%"},
    {"row_key":"New","col_key":"71-80","value":0.00,"label":"Base"},
    {"row_key":"New","col_key":"81-85","value":0.25,"label":"+0.25%"},
    {"row_key":"1-3","col_key":"0-70","value":0.00,"label":"Base"},
    {"row_key":"1-3","col_key":"71-80","value":0.25,"label":"+0.25%"},
    {"row_key":"1-3","col_key":"81-85","value":0.50,"label":"+0.50%"},
    {"row_key":"4-5","col_key":"0-70","value":0.25,"label":"+0.25%"},
    {"row_key":"4-5","col_key":"71-80","value":0.50,"label":"+0.50%"},
    {"row_key":"4-5","col_key":"81-85","value":0.75,"label":"+0.75%"}
  ]'),
  'rate_adjustment','%',
  1,'Bank Policy BP-AUTO-001','manual',null,'system',
  datetime('now'),datetime('now')
);

-- p002-m2: Credit Score Band – Auto Rate
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p002_02','p002','mkt001',
  'Credit Score Band – Auto Rate Adjustment',
  'نطاق التقييم الائتماني – تعديل سعر السيارة',
  'Rate premium based on credit score for auto finance',
  'علاوة السعر بناءً على التقييم الائتماني لتمويل السيارات',
  'credit_score_band','Credit Score Band','نطاق التقييم الائتماني',
  null,null,null,
  json('[
    {"row_key":"750+","col_key":null,"value":-0.25,"label":"Discount: -0.25%"},
    {"row_key":"700-749","col_key":null,"value":0.00,"label":"Base Rate"},
    {"row_key":"650-699","col_key":null,"value":0.25,"label":"Premium: +0.25%"},
    {"row_key":"620-649","col_key":null,"value":0.50,"label":"Premium: +0.50%"},
    {"row_key":"< 620","col_key":null,"value":null,"label":"DECLINE"}
  ]'),
  'rate_adjustment','%',
  1,'Bank Policy BP-2024-CR-002','manual',null,'system',
  datetime('now'),datetime('now')
);

-- ─── p003: Personal Loan ─────────────────────────────────────────────────────

-- p003-m1: DBR Band × Loan Amount → Rate Tier
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p003_01','p003','mkt001',
  'DBR Band × Loan Amount – Rate Adjustment',
  'نطاق نسبة خدمة الدين × مبلغ القرض – تعديل السعر',
  'Personal loan rate adjusted by applicant DBR and requested amount',
  'تعديل سعر القرض الشخصي بناءً على نسبة الدين والمبلغ المطلوب',
  'dbr_band','DBR Band','نطاق نسبة خدمة الدين',
  'amount_band','Loan Amount (OMR)','مبلغ القرض (ر.ع.)',
  json('[
    {"row_key":"0-25%","col_key":"1k-10k","value":-0.50,"label":"-0.50%"},
    {"row_key":"0-25%","col_key":"10k-20k","value":-0.25,"label":"-0.25%"},
    {"row_key":"0-25%","col_key":"20k-30k","value":0.00,"label":"Base"},
    {"row_key":"26-35%","col_key":"1k-10k","value":-0.25,"label":"-0.25%"},
    {"row_key":"26-35%","col_key":"10k-20k","value":0.00,"label":"Base"},
    {"row_key":"26-35%","col_key":"20k-30k","value":0.25,"label":"+0.25%"},
    {"row_key":"36-45%","col_key":"1k-10k","value":0.25,"label":"+0.25%"},
    {"row_key":"36-45%","col_key":"10k-20k","value":0.50,"label":"+0.50%"},
    {"row_key":"36-45%","col_key":"20k-30k","value":0.75,"label":"+0.75%"},
    {"row_key":">45%","col_key":"1k-10k","value":null,"label":"DECLINE"},
    {"row_key":">45%","col_key":"10k-20k","value":null,"label":"DECLINE"},
    {"row_key":">45%","col_key":"20k-30k","value":null,"label":"DECLINE"}
  ]'),
  'rate_adjustment','%',
  1,'CBO BM 1117 Section 4.1 & Bank Policy BP-PL-001','manual',null,'system',
  datetime('now'),datetime('now')
);

-- p003-m2: Credit Score Band – Personal Loan Rate
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p003_02','p003','mkt001',
  'Credit Score Band – Personal Loan Rate',
  'نطاق التقييم الائتماني – سعر القرض الشخصي',
  'Personal loan rate tier by MALA''A credit score',
  'شريحة سعر القرض الشخصي بناءً على درجة ملاءة',
  'credit_score_band','Credit Score Band','نطاق التقييم الائتماني',
  null,null,null,
  json('[
    {"row_key":"750+","col_key":null,"value":7.00,"label":"7.00% (Best Rate)"},
    {"row_key":"700-749","col_key":null,"value":7.25,"label":"7.25%"},
    {"row_key":"650-699","col_key":null,"value":7.50,"label":"7.50% (Base)"},
    {"row_key":"620-649","col_key":null,"value":7.75,"label":"7.75%"},
    {"row_key":"600-619","col_key":null,"value":8.00,"label":"8.00% (Max)"},
    {"row_key":"< 600","col_key":null,"value":null,"label":"DECLINE"}
  ]'),
  'rate_absolute','%',
  1,'Bank Policy BP-PL-002','manual',null,'system',
  datetime('now'),datetime('now')
);

-- ─── p004: SME Working Capital ────────────────────────────────────────────────

-- p004-m1: Years in Operation × Annual Revenue Band → Max Facility (OMR)
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p004_01','p004','mkt001',
  'Years in Operation × Revenue Band – Max Facility',
  'سنوات التشغيل × نطاق الإيرادات – الحد الأقصى للتسهيل',
  'Maximum working capital facility size based on business maturity and annual revenue',
  'الحد الأقصى لتسهيل رأس المال العامل بناءً على عمر الشركة وإيراداتها السنوية',
  'years_in_operation','Years in Operation','سنوات التشغيل',
  'annual_revenue_band','Annual Revenue (OMR)','الإيرادات السنوية (ر.ع.)',
  json('[
    {"row_key":"2-3","col_key":"<100k","value":25000,"label":"OMR 25,000"},
    {"row_key":"2-3","col_key":"100k-500k","value":75000,"label":"OMR 75,000"},
    {"row_key":"2-3","col_key":"500k+","value":150000,"label":"OMR 150,000"},
    {"row_key":"4-7","col_key":"<100k","value":50000,"label":"OMR 50,000"},
    {"row_key":"4-7","col_key":"100k-500k","value":125000,"label":"OMR 125,000"},
    {"row_key":"4-7","col_key":"500k+","value":200000,"label":"OMR 200,000"},
    {"row_key":"8+","col_key":"<100k","value":75000,"label":"OMR 75,000"},
    {"row_key":"8+","col_key":"100k-500k","value":175000,"label":"OMR 175,000"},
    {"row_key":"8+","col_key":"500k+","value":200000,"label":"OMR 200,000 (Max)"}
  ]'),
  'max_facility_amount','OMR',
  1,'Bank Policy BP-SME-003','manual',null,'system',
  datetime('now'),datetime('now')
);

-- p004-m2: SME Rate by Risk Grade
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p004_02','p004','mkt001',
  'Risk Grade – SME Rate Tier',
  'درجة المخاطر – شريحة سعر المنشأة الصغيرة',
  'Working capital rate determined by internal SME risk grade',
  'سعر رأس المال العامل بناءً على درجة المخاطر الداخلية',
  'risk_grade','Internal Risk Grade','درجة المخاطر الداخلية',
  null,null,null,
  json('[
    {"row_key":"A","col_key":null,"value":6.00,"label":"6.00% (Best)"},
    {"row_key":"B","col_key":null,"value":6.50,"label":"6.50% (Base)"},
    {"row_key":"C","col_key":null,"value":7.00,"label":"7.00%"},
    {"row_key":"D","col_key":null,"value":7.50,"label":"7.50%"},
    {"row_key":"E","col_key":null,"value":null,"label":"Refer to Senior Credit"}
  ]'),
  'rate_absolute','%',
  1,'Bank Policy BP-SME-004','manual',null,'system',
  datetime('now'),datetime('now')
);

-- ─── p005: Home Equity Line ───────────────────────────────────────────────────

-- p005-m1: Combined LTV × Credit Score → Approved Line Amount (%)
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p005_01','p005','mkt001',
  'Combined LTV × Credit Score – Max Line (% of Equity)',
  'LTV المجمع × التقييم الائتماني – الحد الأقصى للائتمان',
  'Maximum HELOC line as a percentage of net equity based on combined LTV and credit score',
  'الحد الأقصى لخط الائتمان كنسبة من صافي حقوق الملكية',
  'combined_ltv_band','Combined LTV Band','نطاق LTV المجمع',
  'credit_score_band','Credit Score Band','نطاق التقييم الائتماني',
  json('[
    {"row_key":"0-50%","col_key":"750+","value":90,"label":"90% of equity"},
    {"row_key":"0-50%","col_key":"700-749","value":80,"label":"80% of equity"},
    {"row_key":"0-50%","col_key":"660-699","value":70,"label":"70% of equity"},
    {"row_key":"51-65%","col_key":"750+","value":75,"label":"75% of equity"},
    {"row_key":"51-65%","col_key":"700-749","value":65,"label":"65% of equity"},
    {"row_key":"51-65%","col_key":"660-699","value":55,"label":"55% of equity"},
    {"row_key":"66-75%","col_key":"750+","value":60,"label":"60% of equity"},
    {"row_key":"66-75%","col_key":"700-749","value":50,"label":"50% of equity"},
    {"row_key":"66-75%","col_key":"660-699","value":40,"label":"40% of equity"},
    {"row_key":">75%","col_key":"750+","value":null,"label":"DECLINE"},
    {"row_key":">75%","col_key":"700-749","value":null,"label":"DECLINE"},
    {"row_key":">75%","col_key":"660-699","value":null,"label":"DECLINE"}
  ]'),
  'max_line_pct_equity','%',
  1,'Bank Policy BP-HELOC-001','manual',null,'system',
  datetime('now'),datetime('now')
);

-- ─── p006: Commercial Property Finance ───────────────────────────────────────

-- p006-m1: Property Type × LTV Band → Rate Adjustment
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p006_01','p006','mkt001',
  'Property Type × LTV Band – Rate Adjustment',
  'نوع العقار × نطاق القرض/القيمة – تعديل السعر',
  'Commercial finance rate adjustment based on property type and LTV',
  'تعديل سعر التمويل التجاري بناءً على نوع العقار ونسبة القرض للقيمة',
  'property_type','Property Type','نوع العقار',
  'ltv_band','LTV Band','نطاق القرض للقيمة',
  json('[
    {"row_key":"office","col_key":"0-55","value":0.00,"label":"Base"},
    {"row_key":"office","col_key":"56-65","value":0.25,"label":"+0.25%"},
    {"row_key":"office","col_key":"66-70","value":0.50,"label":"+0.50%"},
    {"row_key":"retail","col_key":"0-55","value":0.10,"label":"+0.10%"},
    {"row_key":"retail","col_key":"56-65","value":0.35,"label":"+0.35%"},
    {"row_key":"retail","col_key":"66-70","value":0.60,"label":"+0.60%"},
    {"row_key":"warehouse","col_key":"0-55","value":-0.10,"label":"-0.10%"},
    {"row_key":"warehouse","col_key":"56-65","value":0.15,"label":"+0.15%"},
    {"row_key":"warehouse","col_key":"66-70","value":0.40,"label":"+0.40%"},
    {"row_key":"mixed_use","col_key":"0-55","value":0.15,"label":"+0.15%"},
    {"row_key":"mixed_use","col_key":"56-65","value":0.40,"label":"+0.40%"},
    {"row_key":"mixed_use","col_key":"66-70","value":0.65,"label":"+0.65%"}
  ]'),
  'rate_adjustment','%',
  1,'Bank Policy BP-COM-001','manual',null,'system',
  datetime('now'),datetime('now')
);

-- p006-m2: Annual Revenue × Tenor → Max Commercial Facility
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p006_02','p006','mkt001',
  'Annual Revenue × Tenor – Max Facility (OMR)',
  'الإيرادات السنوية × مدة القرض – الحد الأقصى (ر.ع.)',
  'Maximum commercial facility determined by borrower revenue and requested tenor',
  'الحد الأقصى للتسهيل التجاري بناءً على الإيرادات والمدة',
  'annual_revenue_band','Annual Revenue (OMR)','الإيرادات السنوية (ر.ع.)',
  'tenor_band','Tenor (Years)','مدة القرض (سنوات)',
  json('[
    {"row_key":"500k-1M","col_key":"5-10","value":500000,"label":"OMR 500,000"},
    {"row_key":"500k-1M","col_key":"11-15","value":750000,"label":"OMR 750,000"},
    {"row_key":"500k-1M","col_key":"16-20","value":1000000,"label":"OMR 1,000,000"},
    {"row_key":"1M-5M","col_key":"5-10","value":1000000,"label":"OMR 1,000,000"},
    {"row_key":"1M-5M","col_key":"11-15","value":1500000,"label":"OMR 1,500,000"},
    {"row_key":"1M-5M","col_key":"16-20","value":2000000,"label":"OMR 2,000,000"},
    {"row_key":"5M+","col_key":"5-10","value":1500000,"label":"OMR 1,500,000"},
    {"row_key":"5M+","col_key":"11-15","value":2000000,"label":"OMR 2,000,000 (Max)"},
    {"row_key":"5M+","col_key":"16-20","value":2000000,"label":"OMR 2,000,000 (Max)"}
  ]'),
  'max_facility_amount','OMR',
  1,'Bank Policy BP-COM-002','manual',null,'system',
  datetime('now'),datetime('now')
);

-- ─── p007: Expat Home Finance ─────────────────────────────────────────────────

-- p007-m1: LTV Band × Nationality Zone → Rate Adjustment
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p007_01','p007','mkt001',
  'LTV Band × Nationality Zone – Rate Adjustment',
  'نطاق القرض/القيمة × منطقة الجنسية – تعديل السعر',
  'Expat home loan rate adjusted by LTV and applicant''s nationality tier',
  'تعديل سعر قرض الأجانب بناءً على LTV وفئة الجنسية',
  'ltv_band','LTV Band','نطاق القرض للقيمة',
  'nationality_zone','Nationality Zone','منطقة الجنسية',
  json('[
    {"row_key":"0-60","col_key":"gcc","value":-0.15,"label":"-0.15%"},
    {"row_key":"0-60","col_key":"other","value":0.00,"label":"Base"},
    {"row_key":"61-70","col_key":"gcc","value":0.00,"label":"Base"},
    {"row_key":"61-70","col_key":"other","value":0.20,"label":"+0.20%"},
    {"row_key":"71-75","col_key":"gcc","value":0.20,"label":"+0.20%"},
    {"row_key":"71-75","col_key":"other","value":0.40,"label":"+0.40%"},
    {"row_key":">75","col_key":"gcc","value":null,"label":"DECLINE – CBO Cap"},
    {"row_key":">75","col_key":"other","value":null,"label":"DECLINE – CBO Cap"}
  ]'),
  'rate_adjustment','%',
  1,'CBO Circular 2024-01, Section 4.3','manual',null,'system',
  datetime('now'),datetime('now')
);

-- p007-m2: Credit Score Band – Expat Rate
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p007_02','p007','mkt001',
  'Credit Score Band – Expat Rate Tier',
  'نطاق التقييم الائتماني – شريحة سعر الأجانب',
  'Rate tier for expat home finance by MALA''A credit score',
  'شريحة السعر لتمويل الأجانب بناءً على درجة ملاءة',
  'credit_score_band','Credit Score Band','نطاق التقييم الائتماني',
  null,null,null,
  json('[
    {"row_key":"750+","col_key":null,"value":-0.25,"label":"Discount: -0.25%"},
    {"row_key":"700-749","col_key":null,"value":0.00,"label":"Base Rate"},
    {"row_key":"670-699","col_key":null,"value":0.25,"label":"Premium: +0.25%"},
    {"row_key":"< 670","col_key":null,"value":null,"label":"DECLINE"}
  ]'),
  'rate_adjustment','%',
  1,'Bank Policy BP-2024-CR-002','manual',null,'system',
  datetime('now'),datetime('now')
);

-- ─── p008: Education Finance ──────────────────────────────────────────────────

-- p008-m1: Institution Type × Loan Amount → Rate Tier
INSERT OR IGNORE INTO rule_matrices VALUES (
  'rm_p008_01','p008','mkt001',
  'Institution Type × Loan Amount – Rate Tier',
  'نوع المؤسسة × مبلغ القرض – شريحة السعر',
  'Education loan rate based on institution type and loan amount',
  'سعر القرض التعليمي بناءً على نوع المؤسسة ومبلغ القرض',
  'institution_type','Institution Type','نوع المؤسسة التعليمية',
  'amount_band','Loan Amount (OMR)','مبلغ القرض (ر.ع.)',
  json('[
    {"row_key":"oman_public","col_key":"500-5k","value":7.50,"label":"7.50%"},
    {"row_key":"oman_public","col_key":"5k-15k","value":7.75,"label":"7.75%"},
    {"row_key":"oman_public","col_key":"15k-20k","value":8.00,"label":"8.00%"},
    {"row_key":"oman_private","col_key":"500-5k","value":7.75,"label":"7.75%"},
    {"row_key":"oman_private","col_key":"5k-15k","value":8.00,"label":"8.00%"},
    {"row_key":"oman_private","col_key":"15k-20k","value":8.25,"label":"8.25%"},
    {"row_key":"international","col_key":"500-5k","value":8.00,"label":"8.00%"},
    {"row_key":"international","col_key":"5k-15k","value":8.25,"label":"8.25%"},
    {"row_key":"international","col_key":"15k-20k","value":8.50,"label":"8.50% (Max)"}
  ]'),
  'rate_absolute','%',
  1,'Bank Policy BP-EDU-001','manual',null,'system',
  datetime('now'),datetime('now')
);

-- ════════════════════════════════════════════════════════════
-- STEP 6: Compliance tag mappings for p002–p006, p008
-- ════════════════════════════════════════════════════════════

-- p002: Auto Finance – Personal
-- Applicable: ct001(DBR), ct004(Mala'a), ct008(Disclosure), ct009(Cooling-Off), ct010(AML), ct012(Max Term)
INSERT OR IGNORE INTO product_compliance_tags (product_id, tag_id, mapped_by) VALUES
  ('p002','ct001','system'),
  ('p002','ct004','system'),
  ('p002','ct008','system'),
  ('p002','ct009','system'),
  ('p002','ct010','system'),
  ('p002','ct012','system');

-- p003: Personal Loan
-- Applicable: ct001(DBR), ct004(Mala'a), ct008(Disclosure), ct009(Cooling-Off), ct010(AML), ct012(Max Term)
INSERT OR IGNORE INTO product_compliance_tags (product_id, tag_id, mapped_by) VALUES
  ('p003','ct001','system'),
  ('p003','ct004','system'),
  ('p003','ct008','system'),
  ('p003','ct009','system'),
  ('p003','ct010','system'),
  ('p003','ct012','system');

-- p004: SME Working Capital
-- Applicable: ct001(DBR/DSCR), ct004(Mala'a), ct008(Disclosure), ct010(AML)
-- Not ct009 (cooling-off is retail only), not ct012 (SME max term not same CBO rule)
INSERT OR IGNORE INTO product_compliance_tags (product_id, tag_id, mapped_by) VALUES
  ('p004','ct001','system'),
  ('p004','ct004','system'),
  ('p004','ct008','system'),
  ('p004','ct010','system');

-- p005: Home Equity Line
-- Applicable: ct001(DBR), ct002(LTV), ct003(Stress Test), ct004(Mala'a),
--             ct008(Disclosure), ct009(Cooling-Off), ct010(AML), ct012(Max Term)
INSERT OR IGNORE INTO product_compliance_tags (product_id, tag_id, mapped_by) VALUES
  ('p005','ct001','system'),
  ('p005','ct002','system'),
  ('p005','ct003','system'),
  ('p005','ct004','system'),
  ('p005','ct008','system'),
  ('p005','ct009','system'),
  ('p005','ct010','system'),
  ('p005','ct012','system');

-- p006: Commercial Property Finance
-- Applicable: ct001(DBR), ct002(LTV), ct004(Mala'a), ct008(Disclosure), ct010(AML)
-- Not ct003 (stress test is mortgage/retail), not ct009 (cooling-off retail only)
INSERT OR IGNORE INTO product_compliance_tags (product_id, tag_id, mapped_by) VALUES
  ('p006','ct001','system'),
  ('p006','ct002','system'),
  ('p006','ct004','system'),
  ('p006','ct008','system'),
  ('p006','ct010','system');

-- p008: Education Finance
-- Applicable: ct001(DBR), ct004(Mala'a), ct008(Disclosure), ct009(Cooling-Off), ct010(AML), ct012(Max Term)
INSERT OR IGNORE INTO product_compliance_tags (product_id, tag_id, mapped_by) VALUES
  ('p008','ct001','system'),
  ('p008','ct004','system'),
  ('p008','ct008','system'),
  ('p008','ct009','system'),
  ('p008','ct010','system'),
  ('p008','ct012','system');

-- ════════════════════════════════════════════════════════════
-- STEP 7: Set pge_stage for all products
--   Active products that pre-exist PGE = mark as completed (6)
--   Archived (p008 status=archived) = mark 5 (all stages except final approval)
-- ════════════════════════════════════════════════════════════

UPDATE products SET pge_stage = 6 WHERE id IN ('p001','p002','p003','p004','p005','p006','p007');
UPDATE products SET pge_stage = 5 WHERE id = 'p008';  -- archived: compliance mapped but not re-approved

-- ════════════════════════════════════════════════════════════
-- STEP 8: Stamp pge_stage_data with completion metadata
-- ════════════════════════════════════════════════════════════

UPDATE products SET pge_stage_data = json('{
  "version": "1.0.0",
  "backfill": true,
  "backfill_migration": "0006_align_existing_products",
  "stages_completed": [1,2,3,4,5,6],
  "completed_at": "2026-09-04T00:00:00.000Z",
  "completed_by": "u001",
  "notes": "Product pre-dated PGE; all parameters validated against CBO BM 1117 during 0006 migration."
}') WHERE id = 'p001';

UPDATE products SET pge_stage_data = json('{
  "version": "1.0.0",
  "backfill": true,
  "backfill_migration": "0006_align_existing_products",
  "stages_completed": [1,2,3,4,5,6],
  "completed_at": "2026-09-04T00:00:00.000Z",
  "completed_by": "u001",
  "notes": "Auto finance product; LTV 85%, DBR 55%, 48h SLA, vehicle age capped at 5 years."
}') WHERE id = 'p002';

UPDATE products SET pge_stage_data = json('{
  "version": "1.0.0",
  "backfill": true,
  "backfill_migration": "0006_align_existing_products",
  "stages_completed": [1,2,3,4,5,6],
  "completed_at": "2026-09-04T00:00:00.000Z",
  "completed_by": "u001",
  "notes": "Unsecured personal loan; approved employer required; DBR cap 45%; max OMR 30,000."
}') WHERE id = 'p003';

UPDATE products SET pge_stage_data = json('{
  "version": "1.0.0",
  "backfill": true,
  "backfill_migration": "0006_align_existing_products",
  "stages_completed": [1,2,3,4,5,6],
  "completed_at": "2026-09-04T00:00:00.000Z",
  "completed_by": "u001",
  "notes": "SME working capital; 2yr minimum operation; MOCI CR required; max 3yr term; max OMR 200k."
}') WHERE id = 'p004';

UPDATE products SET pge_stage_data = json('{
  "version": "1.0.0",
  "backfill": true,
  "backfill_migration": "0006_align_existing_products",
  "stages_completed": [1,2,3,4,5,6],
  "completed_at": "2026-09-04T00:00:00.000Z",
  "completed_by": "u001",
  "notes": "HELOC second charge; combined LTV 75%; NOC from primary lender required; revolving facility."
}') WHERE id = 'p005';

UPDATE products SET pge_stage_data = json('{
  "version": "1.0.0",
  "backfill": true,
  "backfill_migration": "0006_align_existing_products",
  "stages_completed": [1,2,3,4,5,6],
  "completed_at": "2026-09-04T00:00:00.000Z",
  "completed_by": "u001",
  "notes": "Commercial property; LTV 70%; board resolution required; CEO sign-off for large facilities; max OMR 2M."
}') WHERE id = 'p006';

UPDATE products SET pge_stage_data = json('{
  "version": "1.0.0",
  "backfill": true,
  "backfill_migration": "0006_align_existing_products",
  "stages_completed": [1,2,3,4,5,6],
  "completed_at": "2026-09-04T00:00:00.000Z",
  "completed_by": "u001",
  "notes": "Expat home finance; CBO hard cap LTV 75%; freehold zones only; employer NOC mandatory."
}') WHERE id = 'p007';

UPDATE products SET pge_stage_data = json('{
  "version": "1.0.0",
  "backfill": true,
  "backfill_migration": "0006_align_existing_products",
  "stages_completed": [1,2,3,4,5],
  "completed_at": "2026-09-04T00:00:00.000Z",
  "completed_by": "u001",
  "notes": "Education finance – archived status; compliance mapped; pending re-approval before reactivation."
}') WHERE id = 'p008';

-- ════════════════════════════════════════════════════════════
-- STEP 9: Update updated_at timestamps on all 8 products
-- ════════════════════════════════════════════════════════════
UPDATE products SET updated_at = datetime('now')
WHERE id IN ('p001','p002','p003','p004','p005','p006','p007','p008');

-- End of migration 0006
