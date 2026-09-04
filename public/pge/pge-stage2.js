/* ============================================================
   pge-stage2.js — Stage 2: Core Configuration
   Market-driven defaults + financial parameters + docs list
   Exports: window.PGEStage2.mount(container, ctx)
   ============================================================ */
(function () {
  'use strict';
  const { state, API, toast, t, isAr, bus } = window.PGE;

  let _container = null;
  let _product   = null;
  let _market    = null;
  let _regs      = {};   // parsed regulatory_defaults
  let _draft     = {};

  /* ── Mount ── */
  async function mount(container, ctx) {
    _container = container;
    _product   = ctx.product;
    _market    = ctx.market;

    try {
      _regs = JSON.parse(_market?.regulatory_defaults || '{}');
    } catch (_) { _regs = {}; }

    _draft = {
      base_rate:            _product.base_rate            ?? _regs.default_base_rate    ?? 5.5,
      max_ltv:              _product.max_ltv              ?? _regs.default_max_ltv       ?? 90,
      max_dbr:              _product.max_dbr              ?? _regs.default_max_dbr       ?? 60,
      green_dbr:            _product.green_dbr            ?? _regs.default_green_dbr     ?? 55,
      min_term:             _product.min_term             ?? _regs.default_min_term_years ?? 1,
      max_term:             _product.max_term             ?? _regs.default_max_term_years ?? 25,
      min_amount:           _product.min_amount           ?? _regs.min_finance_amount    ?? 1000,
      max_amount:           _product.max_amount           ?? _regs.max_finance_amount    ?? 2000000,
      ai_confidence_threshold: _product.ai_confidence_threshold ?? _regs.default_ai_confidence_threshold ?? 90,
      gsas_min_score:       _product.gsas_min_score       ?? _regs.gsas_standard_threshold  ?? 0,
      gsas_premium_score:   _product.gsas_premium_score   ?? _regs.gsas_premium_threshold   ?? 0,
      green_discount_standard: _product.green_discount_standard ?? _regs.green_discount_standard_pct ?? 0,
      green_discount_premium:  _product.green_discount_premium  ?? _regs.green_discount_premium_pct  ?? 0,
      required_docs:        parseArr(_product.required_docs),
      esg_required_docs:    parseArr(_product.esg_required_docs),
    };

    render();
    bus.on('requestSave', doSave);
    bus.on('langChanged', () => render());
  }

  /* ── Render ── */
  function render() {
    if (!_container) return;

    const currency = _market?.currency_code || 'OMR';
    const regRef   = _regs.regulatory_framework || 'CBO BM 1117';

    _container.innerHTML = `
      <div class="stage-content">
        <div class="stage-header">
          <h2>${t('Core Configuration','الإعداد الأساسي')}</h2>
          <p>${t(
            `Market-driven defaults for ${_market?.name||'this market'} (${regRef}). All values respect regulatory floors and ceilings.`,
            `الإعدادات الافتراضية لسوق ${_market?.name_ar||_market?.name||''} (${regRef}). جميع القيم تراعي الحدود التنظيمية.`
          )}</p>
        </div>

        <!-- Regulatory context banner -->
        <div style="background:linear-gradient(135deg,#eaf5f4,#f8f9fa);border:1px solid rgba(0,127,134,.18);
            border-radius:12px;padding:.875rem 1rem;margin-bottom:1rem;display:flex;align-items:center;gap:.75rem">
          <i class="fas fa-landmark" style="font-size:1.1rem;color:#007F86;flex-shrink:0"></i>
          <div style="font-size:.78rem;color:#495057;line-height:1.5">
            <strong style="color:#003B5C">${_market?.regulator_full_name||'Central Bank of Oman'}</strong> ·
            ${t('Max DBR:','الحد الأقصى لـ DBR:')} <strong>${_regs.default_max_dbr||60}%</strong> ·
            ${t('Max LTV:','الحد الأقصى لـ LTV:')} <strong>${_regs.default_max_ltv||90}%</strong> ·
            ${t('Max Term:','الحد الأقصى للمدة:')} <strong>${_regs.default_max_term_years||25} ${t('yrs','سنة')}</strong> ·
            ${t('Stress Rate:','معدل الضغط:')} <strong>${_regs.stress_test_rate||9}%</strong>
          </div>
        </div>

        <!-- Pricing & Rates -->
        <div class="pge-card">
          <div class="pge-card-header">
            <h3><i class="fas fa-percent" style="color:#007F86;margin-right:.4rem"></i>${t('Pricing & Rates','التسعير والمعدلات')}</h3>
          </div>
          <div class="pge-card-body">
            <div class="pge-grid-3">
              ${numField('base_rate',    t('Base Rate (%)','المعدل الأساسي (%)'),       0, 30,  0.1)}
              ${numField('max_dbr',      t('Max DBR (%)','الحد الأقصى لـ DBR (%)'),       0, _regs.default_max_dbr||60, 1,
                `${t('CBO ceiling:','سقف البنك المركزي:')} ${_regs.default_max_dbr||60}%`)}
              ${numField('green_dbr',    t('Green DBR (%)','DBR للمنتجات الخضراء (%)'),   0, _regs.default_max_dbr||60, 1)}
            </div>
            <div class="pge-grid-2">
              ${numField('green_discount_standard', t('Green Discount — Standard (%)','الخصم الأخضر — قياسي (%)'), 0, 5, 0.05)}
              ${numField('green_discount_premium',  t('Green Discount — Premium (%)','الخصم الأخضر — ممتاز (%)'),  0, 5, 0.05)}
            </div>
          </div>
        </div>

        <!-- LTV & Term -->
        <div class="pge-card">
          <div class="pge-card-header">
            <h3><i class="fas fa-scale-balanced" style="color:#007F86;margin-right:.4rem"></i>${t('LTV & Term Limits','حدود LTV والمدة')}</h3>
          </div>
          <div class="pge-card-body">
            <div class="pge-grid-2">
              ${numField('max_ltv',  t('Max LTV (%)','الحد الأقصى لـ LTV (%)'),        0, _regs.default_max_ltv||90, 1,
                `${t('CBO ceiling:','سقف البنك المركزي:')} ${_regs.default_max_ltv||90}%`)}
              ${numField('min_term', t('Min Term (years)','الحد الأدنى للمدة (سنوات)'), 1, 5,  1)}
            </div>
            <div class="pge-grid-2">
              ${numField('max_term',   t('Max Term (years)','الحد الأقصى للمدة (سنوات)'), 1, _regs.default_max_term_years||25, 1,
                `${t('CBO max:','حد البنك المركزي:')} ${_regs.default_max_term_years||25} ${t('yrs','سنة')}`)}
              ${numField('ai_confidence_threshold', t('AI Confidence Threshold (%)','عتبة ثقة الذكاء الاصطناعي (%)'), 50, 100, 1)}
            </div>
          </div>
        </div>

        <!-- Finance Amounts -->
        <div class="pge-card">
          <div class="pge-card-header">
            <h3><i class="fas fa-coins" style="color:#007F86;margin-right:.4rem"></i>
              ${t('Finance Amount Limits','حدود مبلغ التمويل')} (${currency})
            </h3>
          </div>
          <div class="pge-card-body">
            <div class="pge-grid-2">
              ${numField('min_amount', t('Minimum Amount','الحد الأدنى للمبلغ'), 0, 1000000, 1000)}
              ${numField('max_amount', t('Maximum Amount','الحد الأقصى للمبلغ'), 0, 10000000, 10000)}
            </div>
          </div>
        </div>

        <!-- ESG / GSAS (shown for home_loan category) -->
        ${_product.category === 'home_loan' ? `
        <div class="pge-card">
          <div class="pge-card-header">
            <h3><i class="fas fa-leaf" style="color:#16845B;margin-right:.4rem"></i>${t('ESG / GSAS Thresholds','عتبات ESG / GSAS')}</h3>
          </div>
          <div class="pge-card-body">
            <div class="pge-grid-2">
              ${numField('gsas_min_score',     t('GSAS Standard Score','درجة GSAS القياسية'), 0, 100, 1,
                `${t('Market standard:','المعيار:') } ${_regs.gsas_standard_threshold||70}`)}
              ${numField('gsas_premium_score', t('GSAS Premium Score','درجة GSAS الممتازة'),  0, 100, 1,
                `${t('Market premium:','معيار ممتاز:') } ${_regs.gsas_premium_threshold||85}`)}
            </div>
          </div>
        </div>` : ''}

        <!-- Required Documents -->
        <div class="pge-card">
          <div class="pge-card-header">
            <h3><i class="fas fa-file-lines" style="color:#007F86;margin-right:.4rem"></i>${t('Required Documents','الوثائق المطلوبة')}</h3>
            <button class="pge-btn pge-btn-outline pge-btn-sm" onclick="PGEStage2.addDoc('required_docs')">
              <i class="fas fa-plus"></i> ${t('Add','إضافة')}
            </button>
          </div>
          <div class="pge-card-body" id="docsStandard">
            ${renderDocList('required_docs')}
          </div>
        </div>

        ${_product.category === 'home_loan' ? `
        <div class="pge-card">
          <div class="pge-card-header">
            <h3><i class="fas fa-leaf" style="color:#16845B;margin-right:.4rem"></i>${t('ESG Required Documents','وثائق ESG المطلوبة')}</h3>
            <button class="pge-btn pge-btn-outline pge-btn-sm" onclick="PGEStage2.addDoc('esg_required_docs')">
              <i class="fas fa-plus"></i> ${t('Add','إضافة')}
            </button>
          </div>
          <div class="pge-card-body" id="docsEsg">
            ${renderDocList('esg_required_docs')}
          </div>
        </div>` : ''}

        <!-- Stage footer -->
        <div class="stage-footer">
          <button class="pge-btn pge-btn-ghost" onclick="PGEShell.goToStage(1)" style="color:#003B5C;border-color:#dee2e6">
            <i class="fas fa-arrow-left"></i> ${t('Back','رجوع')}
          </button>
          <div style="display:flex;gap:.5rem">
            <button class="pge-btn pge-btn-outline" onclick="PGEStage2.saveAndStay()">
              <i class="fas fa-floppy-disk"></i> ${t('Save','حفظ')}
            </button>
            <button class="pge-btn pge-btn-primary" onclick="PGEStage2.saveAndNext()">
              ${t('Save & Continue','حفظ ومتابعة')} <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>`;
  }

  /* ── Numeric field builder ── */
  function numField(key, label, min, max, step, hint = '') {
    return `<div class="pge-field">
      <label class="pge-label">${label}</label>
      <input class="pge-input" type="number" id="f_${key}"
        value="${_draft[key]??''}" min="${min}" max="${max}" step="${step}"
        oninput="PGEStage2._num('${key}',this.value)">
      ${hint ? `<div class="pge-hint"><i class="fas fa-circle-info" style="color:#007F86;font-size:.65rem"></i> ${hint}</div>` : ''}
    </div>`;
  }

  /* ── Docs list ── */
  const DOC_PRESETS = {
    home_loan:    ['civil_id','salary_certificate','property_title_deed','valuation_report','bank_statements_6m','noc_municipality'],
    auto_loan:    ['civil_id','salary_certificate','vehicle_proforma_invoice','driving_license','insurance_quotation','bank_statements_3m'],
    personal_loan:['civil_id','salary_certificate','bank_statements_3m'],
    sme:          ['commercial_registration_certificate','audited_financials_3yr','bank_statements_12m','business_plan'],
    commercial:   ['commercial_registration_certificate','memorandum_of_association','audited_financials_3yr','bank_statements_12m','property_title_deed'],
    education:    ['civil_id','salary_certificate','admission_letter','tuition_invoice'],
  };

  function renderDocList(field) {
    const docs = _draft[field] || [];
    if (!docs.length) {
      return `<div style="font-size:.78rem;color:#6c757d;font-style:italic;padding:.5rem 0">
        ${t('No documents added.','لم تُضف وثائق بعد.')}
        ${DOC_PRESETS[_product.category] ? `<button class="pge-btn pge-btn-outline pge-btn-sm" style="margin-left:.5rem"
          onclick="PGEStage2.loadPreset('${field}')">${t('Load defaults','تحميل الافتراضيات')}</button>` : ''}
      </div>`;
    }
    return `<div style="display:flex;flex-direction:column;gap:.35rem">
      ${docs.map((doc, i) => `
        <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem .6rem;
            background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef">
          <i class="fas fa-file" style="color:#007F86;font-size:.7rem;flex-shrink:0"></i>
          <input class="pge-input" style="flex:1;padding:.3rem .5rem;font-size:.75rem;
              font-family:monospace;border:none;background:transparent;outline:none"
            value="${esc(doc)}"
            onchange="PGEStage2._docEdit('${field}',${i},this.value)">
          <button onclick="PGEStage2._docRemove('${field}',${i})"
            style="background:none;border:none;color:#BD3B4B;cursor:pointer;padding:.2rem;border-radius:4px"
            title="Remove">
            <i class="fas fa-times" style="font-size:.7rem"></i>
          </button>
        </div>`).join('')}
    </div>`;
  }

  /* ── Field handlers ── */
  function _num(key, value) {
    _draft[key] = parseFloat(value) || 0;
    bus.emit('dirty', {});
  }

  function _docEdit(field, idx, value) {
    _draft[field][idx] = value.trim();
    bus.emit('dirty', {});
  }

  function _docRemove(field, idx) {
    _draft[field].splice(idx, 1);
    _rerenderDocs(field);
    bus.emit('dirty', {});
  }

  function addDoc(field) {
    const val = prompt(t('Enter document key (e.g. civil_id):','أدخل مفتاح الوثيقة (مثال: civil_id):'));
    if (!val?.trim()) return;
    _draft[field].push(val.trim().toLowerCase().replace(/\s+/g,'_'));
    _rerenderDocs(field);
    bus.emit('dirty', {});
  }

  function loadPreset(field) {
    const preset = DOC_PRESETS[_product.category] || [];
    preset.forEach(d => { if (!_draft[field].includes(d)) _draft[field].push(d); });
    _rerenderDocs(field);
    bus.emit('dirty', {});
    toast(t('Default documents loaded.','تم تحميل الوثائق الافتراضية.'), 'info');
  }

  function _rerenderDocs(field) {
    const containerId = field === 'required_docs' ? 'docsStandard' : 'docsEsg';
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = renderDocList(field);
  }

  /* ── Validation ── */
  function validate() {
    const maxDbr = _regs.default_max_dbr || 60;
    const maxLtv = _regs.default_max_ltv || 90;
    const maxTerm = _regs.default_max_term_years || 25;

    if (_draft.max_dbr > maxDbr) {
      toast(t(`Max DBR cannot exceed CBO ceiling of ${maxDbr}%.`,`لا يمكن أن يتجاوز الحد الأقصى لـ DBR سقف البنك المركزي ${maxDbr}%.`), 'error');
      return false;
    }
    if (_draft.max_ltv > maxLtv) {
      toast(t(`Max LTV cannot exceed CBO ceiling of ${maxLtv}%.`,`لا يمكن أن يتجاوز الحد الأقصى لـ LTV سقف ${maxLtv}%.`), 'error');
      return false;
    }
    if (_draft.max_term > maxTerm) {
      toast(t(`Max term cannot exceed CBO limit of ${maxTerm} years.`,`لا يمكن أن تتجاوز المدة الحد الأقصى البالغ ${maxTerm} سنة.`), 'error');
      return false;
    }
    if (_draft.min_term >= _draft.max_term) {
      toast(t('Min term must be less than max term.','يجب أن تكون المدة الدنيا أقل من الحد الأقصى.'), 'error');
      return false;
    }
    return true;
  }

  /* ── Save ── */
  async function doSave(opts = {}) {
    if (!validate()) return false;
    try {
      const payload = {
        ..._draft,
        required_docs:     JSON.stringify(_draft.required_docs),
        esg_required_docs: JSON.stringify(_draft.esg_required_docs),
      };
      await API.patchProduct(_product.id, payload);
      const prevStage = _product.pge_stage || 0;
      if (prevStage < 2) {
        await API.snapshot(_product.id, 2, { changed_fields: Object.keys(_draft) });
        _product.pge_stage = 2;
      }
      Object.assign(_product, payload);
      bus.emit('saved', {});
      if (!opts.silent) toast(t('Stage 2 saved.','تم حفظ المرحلة 2.'), 'success');
      return true;
    } catch (e) {
      toast(t('Save failed: ','فشل الحفظ: ') + e.message, 'error');
      return false;
    }
  }

  async function saveAndStay() { await doSave(); }
  async function saveAndNext() {
    const ok = await doSave();
    if (ok) PGEShell.goToStage(3);
  }

  /* ── Helpers ── */
  function parseArr(val) {
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val || '[]'); } catch (_) { return []; }
  }
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  window.PGEStage2 = { mount, _num, _docEdit, _docRemove, addDoc, loadPreset, saveAndStay, saveAndNext };
})();
