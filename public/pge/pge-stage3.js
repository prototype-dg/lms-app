/* ============================================================
   pge-stage3.js — Stage 3: Rule Builder
   Three tabs: Condition Rules | Matrices | Sandbox
   Exports: window.PGEStage3.mount(container, ctx)
   ============================================================ */
(function () {
  'use strict';
  const { state, API, toast, t, isAr, bus, md } = window.PGE;

  let _container = null;
  let _productId = null;
  let _product   = null;
  let _market    = null;
  let _rules     = [];
  let _matrices  = [];
  let _activeTab = 'rules';   // 'rules' | 'matrices' | 'sandbox'

  /* ─────────────────── Mount ─────────────────── */
  async function mount(container, ctx) {
    _container = container;
    _productId = ctx.productId;
    _product   = ctx.product;
    _market    = ctx.market;

    renderSkeleton();
    await Promise.all([ loadRules(), loadMatrices() ]);
    renderFull();

    bus.on('requestSave', doSave);
    bus.on('langChanged', () => renderFull());
  }

  async function loadRules() {
    try {
      const d = await API.getRules(_productId);
      _rules = (d.rules || []).filter(r => r.product_id === _productId);
    } catch(e) { _rules = []; }
  }

  async function loadMatrices() {
    try {
      const d = await API.getMatrices(_productId);
      _matrices = d.matrices || [];
    } catch(e) { _matrices = []; }
  }

  /* ─────────────────── Skeleton ─────────────────── */
  function renderSkeleton() {
    _container.innerHTML = `<div class="stage-content">
      <div class="pge-loading" style="height:300px">
        <i class="fas fa-spinner fa-spin"></i><span>${t('Loading rules…','جارٍ تحميل القواعد…')}</span>
      </div></div>`;
  }

  /* ─────────────────── Full render ─────────────────── */
  function renderFull() {
    if (!_container) return;
    _container.innerHTML = `
      <div class="stage-content">
        <div class="stage-header">
          <h2>${t('Rule Builder','منشئ القواعد')}</h2>
          <p>${t(
            'Define eligibility conditions, approval thresholds, and rate matrices that govern this product.',
            'حدّد شروط الأهلية وعتبات الموافقة ومصفوفات الأسعار التي تحكم هذا المنتج.'
          )}</p>
        </div>

        <!-- Tab bar -->
        <div class="s3-tabs" id="s3Tabs">
          ${renderTab('rules',    'fa-list-check',  t('Condition Rules','قواعد الشروط'),    _rules.length)}
          ${renderTab('matrices', 'fa-table',       t('Rate Matrices','مصفوفات الأسعار'),   _matrices.length)}
          ${renderTab('sandbox',  'fa-flask',       t('Rule Sandbox','بيئة اختبار القواعد'), 0, true)}
        </div>

        <!-- Tab content -->
        <div id="s3Content"></div>
      </div>`;

    addTabStyles();
    switchTab(_activeTab);
  }

  function renderTab(id, icon, label, count, noCount = false) {
    const active = _activeTab === id;
    return `<button class="s3-tab ${active ? 'active' : ''}" onclick="PGEStage3._tab('${id}')">
      <i class="fas ${icon}"></i> ${label}
      ${!noCount ? `<span class="s3-tab-count">${count}</span>` : ''}
    </button>`;
  }

  function addTabStyles() {
    if (document.getElementById('s3style')) return;
    const s = document.createElement('style');
    s.id = 's3style';
    s.textContent = `
      .s3-tabs{display:flex;gap:.25rem;background:white;padding:.5rem;border-radius:12px;
        border:1px solid #e9ecef;margin-bottom:1rem;flex-wrap:wrap}
      .s3-tab{display:flex;align-items:center;gap:.4rem;padding:.45rem .85rem;border-radius:9px;
        border:none;background:transparent;font-size:.78rem;font-weight:500;color:#6c757d;
        cursor:pointer;transition:all .18s}
      .s3-tab:hover{background:#f8f9fa;color:#003B5C}
      .s3-tab.active{background:#003B5C;color:white}
      .s3-tab-count{background:rgba(255,255,255,.25);color:inherit;padding:.1rem .4rem;
        border-radius:5px;font-size:.68rem;font-weight:700}
      .s3-tab:not(.active) .s3-tab-count{background:#e9ecef;color:#6c757d}
      .rule-row{display:flex;align-items:flex-start;gap:.625rem;padding:.7rem .875rem;
        border-radius:10px;border:1px solid #e9ecef;background:white;margin-bottom:.4rem;transition:border-color .15s}
      .rule-row:hover{border-color:#007F86}
      .rule-row.inactive{opacity:.5}
      .rule-sev-hard{border-left:3px solid #BD3B4B}
      .rule-sev-soft{border-left:3px solid #9B6A13}
      .rule-sev-advisory{border-left:3px solid #007F86}
      .rule-cat-pill{display:inline-flex;align-items:center;padding:.15rem .45rem;border-radius:5px;
        font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
      .matrix-card{background:white;border:1px solid #e9ecef;border-radius:12px;
        margin-bottom:.75rem;overflow:hidden}
      .matrix-card-header{padding:.75rem 1rem;border-bottom:1px solid #e9ecef;
        display:flex;align-items:center;justify-content:space-between;background:#f8f9fa}
      .matrix-table{width:100%;border-collapse:collapse;font-size:.75rem}
      .matrix-table th{background:#003B5C;color:white;padding:.4rem .6rem;text-align:center;font-weight:600}
      .matrix-table td{padding:.38rem .6rem;border:1px solid #e9ecef;text-align:center}
      .matrix-table tr:nth-child(even) td{background:#f8f9fa}
      .matrix-table td:first-child{background:#eaf5f4;font-weight:600;color:#003B5C;text-align:left}
      .sandbox-panel{background:white;border:1px solid #e9ecef;border-radius:12px;padding:1.125rem;margin-bottom:.75rem}
      .sandbox-result{padding:.875rem;border-radius:10px;margin-top:.75rem;font-size:.82rem}
      .sandbox-pass{background:#e8f7f0;border:1px solid #b7dfce;color:#16845B}
      .sandbox-fail{background:#fdf2f3;border:1px solid #e8b4ba;color:#BD3B4B}
      .sandbox-warn{background:#fef9ee;border:1px solid #e8d5a3;color:#9B6A13}`;
    document.head.appendChild(s);
  }

  function _tab(id) {
    _activeTab = id;
    document.querySelectorAll('.s3-tab').forEach(b => {
      b.classList.toggle('active', b.textContent.trim().startsWith(
        id === 'rules' ? (isAr()?'قواعد':'Condition') :
        id === 'matrices' ? (isAr()?'مصفوفات':'Rate') : (isAr()?'بيئة':'Rule')
      ));
    });
    // Simpler: re-render tabs inline
    const tabs = document.getElementById('s3Tabs');
    if (tabs) {
      tabs.innerHTML =
        renderTab('rules',    'fa-list-check',  t('Condition Rules','قواعد الشروط'),   _rules.length) +
        renderTab('matrices', 'fa-table',       t('Rate Matrices','مصفوفات الأسعار'),  _matrices.length) +
        renderTab('sandbox',  'fa-flask',       t('Rule Sandbox','بيئة اختبار القواعد'), 0, true);
    }
    switchTab(id);
  }

  function switchTab(id) {
    const el = document.getElementById('s3Content');
    if (!el) return;
    if (id === 'rules')    el.innerHTML = renderRulesTab();
    if (id === 'matrices') el.innerHTML = renderMatricesTab();
    if (id === 'sandbox')  el.innerHTML = renderSandboxTab();
  }

  /* ═══════════════════════════════════════════
     TAB 1 — CONDITION RULES
  ═══════════════════════════════════════════ */
  const RULE_CAT_COLORS = {
    eligibility:      { bg:'#eaf5f4', color:'#007F86' },
    creditworthiness: { bg:'#f3f0ff', color:'#6366f1' },
    collateral:       { bg:'#fef9ee', color:'#9B6A13' },
    compliance:       { bg:'#e8f7f0', color:'#16845B' },
    esg:              { bg:'#f0fdf4', color:'#16845B' },
    general:          { bg:'#f8f9fa', color:'#6c757d' },
  };

  function renderRulesTab() {
    const grouped = {};
    const catOrder = ['eligibility','creditworthiness','collateral','compliance','esg','general'];
    catOrder.forEach(c => grouped[c] = []);
    _rules.forEach(r => {
      const c = r.category || 'general';
      if (!grouped[c]) grouped[c] = [];
      grouped[c].push(r);
    });

    const rows = catOrder.filter(c => grouped[c].length > 0).map(cat => {
      const meta = RULE_CAT_COLORS[cat] || RULE_CAT_COLORS.general;
      const label = t(cat.replace(/_/g,' '), cat);
      return `<div style="margin-bottom:1.25rem">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
          <span class="rule-cat-pill" style="background:${meta.bg};color:${meta.color}">${label}</span>
          <span style="font-size:.7rem;color:#6c757d">${grouped[cat].length} ${t('rule(s)','قاعدة')}</span>
        </div>
        ${grouped[cat].map(renderRuleRow).join('')}
      </div>`;
    }).join('');

    return `
      <div class="pge-card">
        <div class="pge-card-header">
          <h3><i class="fas fa-list-check" style="color:#007F86;margin-right:.4rem"></i>
            ${t('Condition Rules','قواعد الشروط')}
            <span style="font-size:.75rem;font-weight:400;color:#6c757d;margin-left:.4rem">(${_rules.length})</span>
          </h3>
          <div style="display:flex;gap:.4rem">
            <button class="pge-btn pge-btn-outline pge-btn-sm" onclick="PGEStage3.openAiRuleModal()">
              <i class="fas fa-wand-magic-sparkles"></i> ${t('AI Generate','توليد بالذكاء')}
            </button>
            <button class="pge-btn pge-btn-primary pge-btn-sm" onclick="PGEStage3.openRuleModal()">
              <i class="fas fa-plus"></i> ${t('Add Rule','إضافة قاعدة')}
            </button>
          </div>
        </div>
        <div class="pge-card-body">
          ${_rules.length === 0 ? `
            <div style="text-align:center;padding:2.5rem;color:#6c757d;font-size:.82rem">
              <i class="fas fa-gavel" style="font-size:2rem;opacity:.25;display:block;margin-bottom:.75rem"></i>
              ${t('No rules yet. Add your first rule or use AI to generate.','لا توجد قواعد بعد. أضف قاعدتك الأولى أو استخدم الذكاء الاصطناعي.')}
            </div>` : rows}
        </div>
      </div>
      ${renderStageFooter()}`;
  }

  function renderRuleRow(r) {
    const sevClass = r.severity === 'hard' ? 'rule-sev-hard' : r.severity === 'soft' ? 'rule-sev-soft' : 'rule-sev-advisory';
    const sevBadge = r.severity === 'hard'
      ? `<span style="font-size:.65rem;background:#fdf2f3;color:#BD3B4B;padding:.15rem .4rem;border-radius:5px;font-weight:700">HARD</span>`
      : r.severity === 'soft'
      ? `<span style="font-size:.65rem;background:#fef9ee;color:#9B6A13;padding:.15rem .4rem;border-radius:5px;font-weight:700">SOFT</span>`
      : `<span style="font-size:.65rem;background:#eaf5f4;color:#007F86;padding:.15rem .4rem;border-radius:5px;font-weight:700">INFO</span>`;
    const aiChip = r.source === 'ai_generated'
      ? `<span style="font-size:.65rem;background:#f3f0ff;color:#6366f1;padding:.15rem .4rem;border-radius:5px;font-weight:600">AI</span>` : '';
    return `<div class="rule-row ${sevClass} ${r.is_active ? '' : 'inactive'}">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.2rem;flex-wrap:wrap">
          <span style="font-size:.82rem;font-weight:600;color:#003B5C">${esc(r.name)}</span>
          ${sevBadge} ${aiChip}
        </div>
        <div style="font-size:.75rem;color:#495057;font-family:monospace;background:#f8f9fa;
            display:inline-block;padding:.15rem .45rem;border-radius:5px;margin-bottom:.25rem">
          ${esc(r.metric)} ${esc(r.operator)} ${r.threshold_value ?? '—'}
          ${r.threshold_condition ? `<span style="color:#6c757d"> | ${esc(r.threshold_condition)}</span>` : ''}
        </div>
        ${r.description ? `<div style="font-size:.72rem;color:#6c757d;margin-top:.15rem">${esc(r.description)}</div>` : ''}
        ${r.regulatory_reference ? `<div style="font-size:.68rem;color:#007F86;margin-top:.1rem"><i class="fas fa-landmark" style="font-size:.6rem"></i> ${esc(r.regulatory_reference)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:.3rem;flex-shrink:0">
        <button class="pge-btn pge-btn-ghost pge-btn-sm" style="padding:.2rem .4rem"
          onclick="PGEStage3.openRuleModal('${r.id}')" title="${t('Edit','تعديل')}">
          <i class="fas fa-pen" style="font-size:.65rem"></i>
        </button>
        <button class="pge-btn pge-btn-ghost pge-btn-sm" style="padding:.2rem .4rem;color:#BD3B4B"
          onclick="PGEStage3.deleteRule('${r.id}')" title="${t('Delete','حذف')}">
          <i class="fas fa-trash" style="font-size:.65rem"></i>
        </button>
      </div>
    </div>`;
  }

  /* ═══════════════════════════════════════════
     TAB 2 — MATRICES
  ═══════════════════════════════════════════ */
  function renderMatricesTab() {
    return `
      <div class="pge-card">
        <div class="pge-card-header">
          <h3><i class="fas fa-table" style="color:#007F86;margin-right:.4rem"></i>
            ${t('Rate Matrices','مصفوفات الأسعار')}
            <span style="font-size:.75rem;font-weight:400;color:#6c757d;margin-left:.4rem">(${_matrices.length})</span>
          </h3>
          <div style="display:flex;gap:.4rem">
            <button class="pge-btn pge-btn-outline pge-btn-sm" onclick="PGEStage3.openAiMatrixModal()">
              <i class="fas fa-wand-magic-sparkles"></i> ${t('AI Generate','توليد بالذكاء')}
            </button>
            <button class="pge-btn pge-btn-primary pge-btn-sm" onclick="PGEStage3.openMatrixModal()">
              <i class="fas fa-plus"></i> ${t('New Matrix','مصفوفة جديدة')}
            </button>
          </div>
        </div>
        <div class="pge-card-body">
          ${_matrices.length === 0
            ? `<div style="text-align:center;padding:2.5rem;color:#6c757d;font-size:.82rem">
                <i class="fas fa-table" style="font-size:2rem;opacity:.25;display:block;margin-bottom:.75rem"></i>
                ${t('No matrices yet. Matrices let you define 2D lookup tables (e.g. LTV × Tenure → Rate).','لا توجد مصفوفات بعد.')}
               </div>`
            : _matrices.map(renderMatrixCard).join('')}
        </div>
      </div>
      ${renderStageFooter()}`;
  }

  function renderMatrixCard(mx) {
    let grid = [];
    try { grid = JSON.parse(mx.grid_data || '[]'); } catch(_) {}

    // Build row/col key sets preserving insertion order
    const rowKeys = [...new Set(grid.map(c => c.row_key))];
    const colKeys = mx.col_dimension
      ? [...new Set(grid.map(c => c.col_key).filter(Boolean))]
      : null;

    const tableHtml = rowKeys.length === 0 ? `<em style="font-size:.75rem;color:#6c757d">${t('Empty grid','شبكة فارغة')}</em>` : `
      <div style="overflow-x:auto">
        <table class="matrix-table">
          <thead><tr>
            <th>${isAr() ? (mx.row_dimension_ar||mx.row_dimension_label) : mx.row_dimension_label}</th>
            ${colKeys ? colKeys.map(k=>`<th>${k}</th>`).join('') : `<th>${isAr()?mx.output_metric:mx.output_metric}</th>`}
          </tr></thead>
          <tbody>
            ${rowKeys.map(rk => {
              const cells = colKeys
                ? colKeys.map(ck => { const c = grid.find(x=>x.row_key===rk&&x.col_key===ck); return `<td>${c?c.value:'—'}</td>`; }).join('')
                : (() => { const c = grid.find(x=>x.row_key===rk); return `<td>${c?c.value:'—'}</td>`; })();
              return `<tr><td>${rk}</td>${cells}</tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    return `<div class="matrix-card">
      <div class="matrix-card-header">
        <div>
          <div style="font-size:.85rem;font-weight:600;color:#003B5C">
            ${esc(isAr() ? (mx.name_ar||mx.name) : mx.name)}
          </div>
          <div style="font-size:.7rem;color:#6c757d;margin-top:.15rem">
            ${mx.output_metric} · ${mx.output_unit||''} ·
            <span style="color:#6366f1">${mx.row_dimension_label}${mx.col_dimension_label ? ' × ' + mx.col_dimension_label : ''}</span>
          </div>
        </div>
        <div style="display:flex;gap:.35rem">
          <button class="pge-btn pge-btn-outline pge-btn-sm"
            onclick="PGEStage3.openMatrixModal('${mx.id}')">${t('Edit','تعديل')}</button>
          <button class="pge-btn pge-btn-ghost pge-btn-sm" style="color:#BD3B4B"
            onclick="PGEStage3.deleteMatrix('${mx.id}')"><i class="fas fa-trash" style="font-size:.7rem"></i></button>
        </div>
      </div>
      <div style="padding:.875rem">${tableHtml}</div>
    </div>`;
  }

  /* ═══════════════════════════════════════════
     TAB 3 — SANDBOX
  ═══════════════════════════════════════════ */
  function renderSandboxTab() {
    return `
      <div class="sandbox-panel">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.875rem">
          <div style="width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#eaf5f4,#c5ecec);
              display:flex;align-items:center;justify-content:center">
            <i class="fas fa-flask" style="color:#007F86;font-size:.8rem"></i>
          </div>
          <div>
            <div style="font-size:.88rem;font-weight:600;color:#003B5C">${t('Rule Sandbox','بيئة اختبار القواعد')}</div>
            <div style="font-size:.72rem;color:#6c757d">${t('Test an applicant profile against all active rules.','اختبر ملف مقدم الطلب مقابل جميع القواعد النشطة.')}</div>
          </div>
        </div>

        <div class="pge-grid-3" style="margin-bottom:.75rem">
          ${sbField('sb_ltv',     t('LTV (%)','LTV (%)'),            '80')}
          ${sbField('sb_dbr',     t('DBR (%)','DBR (%)'),            '45')}
          ${sbField('sb_term',    t('Term (years)','المدة (سنوات)'), '20')}
          ${sbField('sb_amount',  t('Amount (OMR)','المبلغ (OMR)'),  '150000')}
          ${sbField('sb_malaa',   t('Malaa Score','درجة ملاءة'),     '720')}
          ${sbField('sb_gsas',    t('GSAS Score','درجة GSAS'),       '75')}
        </div>

        <div class="pge-grid-2" style="margin-bottom:.75rem">
          <div class="pge-field">
            <label class="pge-label">${t('Nationality','الجنسية')}</label>
            <select class="pge-select" id="sb_nationality">
              <option value="Omani">${t('Omani','عُماني')}</option>
              <option value="Expat">${t('Expatriate','وافد')}</option>
            </select>
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Employment','نوع التوظيف')}</label>
            <select class="pge-select" id="sb_employment">
              <option value="salaried">${t('Salaried','موظف براتب')}</option>
              <option value="self_employed">${t('Self Employed','أعمال حرة')}</option>
              <option value="retired">${t('Retired','متقاعد')}</option>
            </select>
          </div>
        </div>

        <button class="pge-btn pge-btn-primary" onclick="PGEStage3.runSandbox()" style="width:100%">
          <i class="fas fa-play-circle"></i> ${t('Run Rules Check','تشغيل فحص القواعد')}
        </button>

        <div id="sandboxResult"></div>
      </div>
      ${renderStageFooter()}`;
  }

  function sbField(id, label, placeholder) {
    return `<div class="pge-field">
      <label class="pge-label">${label}</label>
      <input class="pge-input" type="number" id="${id}" placeholder="${placeholder}" value="${placeholder}">
    </div>`;
  }

  /* ─────────── Sandbox run ─────────── */
  function runSandbox() {
    const profile = {
      ltv:         parseFloat(document.getElementById('sb_ltv')?.value    || 0),
      dbr:         parseFloat(document.getElementById('sb_dbr')?.value    || 0),
      term:        parseFloat(document.getElementById('sb_term')?.value   || 0),
      amount:      parseFloat(document.getElementById('sb_amount')?.value || 0),
      malaa_score: parseFloat(document.getElementById('sb_malaa')?.value  || 0),
      gsas_score:  parseFloat(document.getElementById('sb_gsas')?.value   || 0),
      nationality: document.getElementById('sb_nationality')?.value || 'Omani',
      employment:  document.getElementById('sb_employment')?.value  || 'salaried',
    };

    const METRIC_MAP = {
      LTV:            () => profile.ltv,
      DBR:            () => profile.dbr,
      term:           () => profile.term,
      finance_amount: () => profile.amount,
      malaa_score:    () => profile.malaa_score,
      gsas_score:     () => profile.gsas_score,
    };

    const OPS = {
      '<=': (a,b) => a <= b,
      '>=': (a,b) => a >= b,
      '<':  (a,b) => a <  b,
      '>':  (a,b) => a >  b,
      '=':  (a,b) => a == b,
      '!=': (a,b) => a != b,
    };

    function evalCondition(cond) {
      if (!cond) return true;
      // simple: "nationality=Omani AND employment=salaried"
      return cond.split(/\s+AND\s+/i).every(part => {
        const m = part.trim().match(/^(\w+)(=|!=)(.+)$/);
        if (!m) return true;
        const [, key, op, val] = m;
        const profileVal = String(profile[key] || '');
        return op === '=' ? profileVal.toLowerCase() === val.toLowerCase()
                          : profileVal.toLowerCase() !== val.toLowerCase();
      });
    }

    const activeRules = _rules.filter(r => r.is_active);
    const results = activeRules.map(r => {
      const getValue = METRIC_MAP[r.metric];
      if (!getValue) return { rule: r, status: 'skipped', reason: t('Metric not in profile','المقياس غير موجود') };

      const conditionMet = evalCondition(r.threshold_condition);
      if (!conditionMet) return { rule: r, status: 'skipped', reason: t('Condition not applicable','الشرط غير منطبق') };

      const val = getValue();
      const passes = OPS[r.operator]?.(val, r.threshold_value) ?? true;
      return {
        rule: r,
        status: passes ? 'pass' : (r.severity === 'hard' ? 'fail' : 'warn'),
        actual: val,
        reason: passes
          ? t('Within limits','ضمن الحدود')
          : `${r.metric} = ${val} ${t('breaches','يتجاوز')} ${r.operator} ${r.threshold_value}`,
      };
    });

    const hardFails = results.filter(x => x.status === 'fail');
    const softFails = results.filter(x => x.status === 'warn');
    const passes    = results.filter(x => x.status === 'pass');
    const overall   = hardFails.length > 0 ? 'fail' : softFails.length > 0 ? 'warn' : 'pass';

    const resultHtml = `
      <div class="sandbox-result sandbox-${overall}" style="margin-bottom:.75rem">
        <div style="font-weight:700;font-size:.88rem;margin-bottom:.3rem">
          ${overall === 'pass'
            ? `<i class="fas fa-check-circle"></i> ${t('All rules passed','اجتازت جميع القواعد')}`
            : overall === 'warn'
            ? `<i class="fas fa-triangle-exclamation"></i> ${t('Soft limit breaches detected','تم رصد تجاوزات للحدود اللينة')}`
            : `<i class="fas fa-xmark-circle"></i> ${t('Hard rule violations detected','تم رصد انتهاكات للقواعد الصارمة')} (${hardFails.length})`}
        </div>
        <div style="font-size:.75rem">${passes.length} ${t('pass','نجح')} · ${softFails.length} ${t('warn','تحذير')} · ${hardFails.length} ${t('fail','فشل')} · ${results.filter(x=>x.status==='skipped').length} ${t('skipped','تخطي')}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.35rem">
        ${results.filter(x=>x.status!=='skipped').map(x=>`
          <div style="display:flex;align-items:center;gap:.6rem;padding:.45rem .65rem;border-radius:8px;
              background:${x.status==='pass'?'#f8fff8':x.status==='warn'?'#fefdf5':'#fff8f8'};
              border:1px solid ${x.status==='pass'?'#b7dfce':x.status==='warn'?'#e8d5a3':'#e8b4ba'}">
            <i class="fas ${x.status==='pass'?'fa-check-circle':'fa-xmark-circle'}"
               style="color:${x.status==='pass'?'#16845B':x.status==='warn'?'#9B6A13':'#BD3B4B'};flex-shrink:0;font-size:.8rem"></i>
            <div style="flex:1;min-width:0">
              <div style="font-size:.77rem;font-weight:600;color:#003B5C">${esc(x.rule.name)}</div>
              <div style="font-size:.7rem;color:#6c757d">${x.reason}</div>
            </div>
            <span style="font-size:.65rem;font-weight:700;padding:.15rem .4rem;border-radius:5px;
              background:${x.status==='pass'?'#e8f7f0':x.status==='warn'?'#fef9ee':'#fdf2f3'};
              color:${x.status==='pass'?'#16845B':x.status==='warn'?'#9B6A13':'#BD3B4B'}">
              ${x.status.toUpperCase()}
            </span>
          </div>`).join('')}
      </div>`;

    const el = document.getElementById('sandboxResult');
    if (el) el.innerHTML = resultHtml;
  }

  /* ═══════════════════════════════════════════
     MODALS — Rule Create/Edit
  ═══════════════════════════════════════════ */
  function openRuleModal(ruleId) {
    const existing = ruleId ? _rules.find(r => r.id === ruleId) : null;
    const d = existing || {};
    const title = existing ? t('Edit Rule','تعديل القاعدة') : t('Add Rule','إضافة قاعدة');

    showModal(`
      <div class="pge-modal-header">
        <h3>${title}</h3>
        <button class="pge-btn pge-btn-ghost pge-btn-sm" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="pge-modal-body">
        <div class="pge-grid-2">
          <div class="pge-field" style="grid-column:1/-1">
            <label class="pge-label">${t('Rule Name','اسم القاعدة')} <span class="pge-required">*</span></label>
            <input class="pge-input" id="rm_name" value="${esc(d.name||'')}" placeholder="${t('e.g. Max LTV — Expat','مثال: الحد الأقصى LTV — وافد')}">
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Category','الفئة')}</label>
            <select class="pge-select" id="rm_category">
              ${['eligibility','creditworthiness','collateral','compliance','esg','general'].map(c =>
                `<option value="${c}" ${d.category===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Severity','الشدة')}</label>
            <select class="pge-select" id="rm_severity">
              <option value="hard"     ${d.severity==='hard'?'selected':''}>${t('Hard (reject)','صارمة (رفض)')}</option>
              <option value="soft"     ${d.severity==='soft'?'selected':''}>${t('Soft (flag)','لينة (إشارة)')}</option>
              <option value="advisory" ${d.severity==='advisory'?'selected':''}>${t('Advisory','استشارية')}</option>
            </select>
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Metric','المقياس')} <span class="pge-required">*</span></label>
            <input class="pge-input" id="rm_metric" value="${esc(d.metric||'')}" placeholder="LTV, DBR, term, finance_amount…">
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Operator','المعامل')}</label>
            <select class="pge-select" id="rm_operator">
              ${['<=','>=','<','>','=','!='].map(op =>
                `<option ${d.operator===op?'selected':''}>${op}</option>`).join('')}
            </select>
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Threshold Value','القيمة الحدية')}</label>
            <input class="pge-input" type="number" id="rm_threshold" value="${d.threshold_value??''}">
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Condition (optional)','الشرط (اختياري)')}</label>
            <input class="pge-input" id="rm_condition" value="${esc(d.threshold_condition||'')}" placeholder="nationality=Omani AND employment=salaried">
            <div class="pge-hint">${t('AND-chain of key=value pairs','سلسلة AND من أزواج key=value')}</div>
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Action on Breach','الإجراء عند الانتهاك')}</label>
            <select class="pge-select" id="rm_action">
              <option value="reject"  ${d.action_on_breach==='reject'?'selected':''}>${t('Reject','رفض')}</option>
              <option value="flag"    ${d.action_on_breach==='flag'?'selected':''}>${t('Flag for review','إحالة للمراجعة')}</option>
              <option value="notify"  ${d.action_on_breach==='notify'?'selected':''}>${t('Notify','إشعار')}</option>
            </select>
          </div>
          <div class="pge-field" style="grid-column:1/-1">
            <label class="pge-label">${t('Regulatory Reference','المرجع التنظيمي')}</label>
            <input class="pge-input" id="rm_regref" value="${esc(d.regulatory_reference||'')}" placeholder="CBO Circular 2024-01, Section 4.2">
          </div>
          <div class="pge-field" style="grid-column:1/-1">
            <label class="pge-label">${t('Description','الوصف')}</label>
            <textarea class="pge-textarea" id="rm_desc" rows="2">${esc(d.description||'')}</textarea>
          </div>
        </div>
      </div>
      <div style="padding:.875rem 1.125rem;border-top:1px solid #e9ecef;display:flex;justify-content:flex-end;gap:.5rem">
        <button class="pge-btn pge-btn-ghost" onclick="closeModal()">${t('Cancel','إلغاء')}</button>
        <button class="pge-btn pge-btn-primary" onclick="PGEStage3._saveRule('${ruleId||''}')">
          <i class="fas fa-floppy-disk"></i> ${t('Save Rule','حفظ القاعدة')}
        </button>
      </div>`);
  }

  async function _saveRule(ruleId) {
    const body = {
      name:               document.getElementById('rm_name')?.value.trim(),
      category:           document.getElementById('rm_category')?.value,
      severity:           document.getElementById('rm_severity')?.value,
      metric:             document.getElementById('rm_metric')?.value.trim(),
      operator:           document.getElementById('rm_operator')?.value,
      threshold_value:    parseFloat(document.getElementById('rm_threshold')?.value) || null,
      threshold_condition:document.getElementById('rm_condition')?.value.trim() || null,
      action_on_breach:   document.getElementById('rm_action')?.value,
      regulatory_reference:document.getElementById('rm_regref')?.value.trim() || null,
      description:        document.getElementById('rm_desc')?.value.trim() || null,
      user_id:            state.product?.created_by || 'u001',
    };
    if (!body.name || !body.metric) { toast(t('Name and metric are required.','الاسم والمقياس مطلوبان.'), 'error'); return; }
    try {
      if (ruleId) {
        await fetch(`/api/v1/products/${_productId}/rules/${ruleId}`, {
          method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
        });
        const idx = _rules.findIndex(r=>r.id===ruleId);
        if (idx >= 0) _rules[idx] = { ..._rules[idx], ...body };
      } else {
        const r = await fetch(`/api/v1/products/${_productId}/rules`, {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
        });
        const d = await r.json();
        _rules.push({ id: d.id, product_id: _productId, is_active: 1, source:'manual', ...body });
      }
      closeModal();
      bus.emit('dirty', {});
      _tab('rules');
      toast(t('Rule saved.','تم حفظ القاعدة.'), 'success');
    } catch(e) { toast(e.message, 'error'); }
  }

  async function deleteRule(ruleId) {
    if (!confirm(t('Delete this rule?','حذف هذه القاعدة؟'))) return;
    try {
      await fetch(`/api/v1/products/${_productId}/rules/${ruleId}`, { method:'DELETE' });
      _rules = _rules.filter(r => r.id !== ruleId);
      _tab('rules');
      toast(t('Rule deleted.','تم حذف القاعدة.'), 'info');
    } catch(e) { toast(e.message, 'error'); }
  }

  /* ═══════════════════════════════════════════
     MODALS — Matrix Create/Edit
  ═══════════════════════════════════════════ */
  function openMatrixModal(matrixId) {
    const existing = matrixId ? _matrices.find(m => m.id === matrixId) : null;
    const d = existing || {};
    let grid = [];
    try { grid = JSON.parse(d.grid_data || '[]'); } catch(_) {}

    showModal(`
      <div class="pge-modal-header">
        <h3>${matrixId ? t('Edit Matrix','تعديل المصفوفة') : t('New Matrix','مصفوفة جديدة')}</h3>
        <button class="pge-btn pge-btn-ghost pge-btn-sm" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="pge-modal-body">
        <div class="pge-grid-2">
          <div class="pge-field">
            <label class="pge-label">${t('Matrix Name (EN)','اسم المصفوفة (إنجليزي)')} <span class="pge-required">*</span></label>
            <input class="pge-input" id="mx_name" value="${esc(d.name||'')}">
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Matrix Name (AR)','اسم المصفوفة (عربي)')}</label>
            <input class="pge-input" id="mx_name_ar" dir="rtl" value="${esc(d.name_ar||'')}">
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Row Dimension Key','مفتاح بُعد الصف')} <span class="pge-required">*</span></label>
            <input class="pge-input" id="mx_row_dim" value="${esc(d.row_dimension||'')}" placeholder="ltv_band">
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Row Dimension Label','عنوان بُعد الصف')} <span class="pge-required">*</span></label>
            <input class="pge-input" id="mx_row_label" value="${esc(d.row_dimension_label||'')}" placeholder="LTV Band">
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Col Dimension Key (optional)','مفتاح بُعد العمود (اختياري)')}</label>
            <input class="pge-input" id="mx_col_dim" value="${esc(d.col_dimension||'')}" placeholder="tenure_band">
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Col Dimension Label','عنوان بُعد العمود')}</label>
            <input class="pge-input" id="mx_col_label" value="${esc(d.col_dimension_label||'')}" placeholder="Tenure Band">
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Output Metric','مقياس الناتج')} <span class="pge-required">*</span></label>
            <input class="pge-input" id="mx_metric" value="${esc(d.output_metric||'')}" placeholder="rate_adjustment">
          </div>
          <div class="pge-field">
            <label class="pge-label">${t('Output Unit','وحدة الناتج')}</label>
            <input class="pge-input" id="mx_unit" value="${esc(d.output_unit||'')}" placeholder="%, OMR, boolean">
          </div>
        </div>
        <div class="pge-field" style="margin-top:.5rem">
          <label class="pge-label">${t('Grid Data (JSON)','بيانات الشبكة (JSON)')}</label>
          <textarea class="pge-textarea" id="mx_grid" rows="5" style="font-family:monospace;font-size:.75rem">${esc(JSON.stringify(grid, null, 2))}</textarea>
          <div class="pge-hint">[{"row_key":"≤60%","col_key":"1-5yr","value":5.2},…]</div>
        </div>
      </div>
      <div style="padding:.875rem 1.125rem;border-top:1px solid #e9ecef;display:flex;justify-content:flex-end;gap:.5rem">
        <button class="pge-btn pge-btn-ghost" onclick="closeModal()">${t('Cancel','إلغاء')}</button>
        <button class="pge-btn pge-btn-primary" onclick="PGEStage3._saveMatrix('${matrixId||''}')">
          <i class="fas fa-floppy-disk"></i> ${t('Save Matrix','حفظ المصفوفة')}
        </button>
      </div>`, '640px');
  }

  async function _saveMatrix(matrixId) {
    const name = document.getElementById('mx_name')?.value.trim();
    const rowDim = document.getElementById('mx_row_dim')?.value.trim();
    const rowLabel = document.getElementById('mx_row_label')?.value.trim();
    const metric = document.getElementById('mx_metric')?.value.trim();
    if (!name || !rowDim || !rowLabel || !metric) {
      toast(t('Name, row dimension, and output metric are required.','الاسم وبُعد الصف ومقياس الناتج مطلوبة.'), 'error'); return;
    }
    let grid = [];
    try { grid = JSON.parse(document.getElementById('mx_grid')?.value || '[]'); }
    catch(_) { toast(t('Invalid JSON in grid data.','JSON غير صالح في بيانات الشبكة.'), 'error'); return; }

    const body = {
      product_id: _productId,
      market_id:  _market?.id || 'mkt001',
      name, name_ar: document.getElementById('mx_name_ar')?.value.trim()||null,
      row_dimension: rowDim, row_dimension_label: rowLabel,
      row_dimension_ar: null,
      col_dimension: document.getElementById('mx_col_dim')?.value.trim()||null,
      col_dimension_label: document.getElementById('mx_col_label')?.value.trim()||null,
      output_metric: metric,
      output_unit: document.getElementById('mx_unit')?.value.trim()||null,
      grid_data: JSON.stringify(grid),
      created_by: 'u001',
    };
    try {
      if (matrixId) {
        await fetch(`/api/v1/rule-matrices/${matrixId}`, {
          method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
        });
        const idx = _matrices.findIndex(m=>m.id===matrixId);
        if (idx>=0) _matrices[idx] = { ..._matrices[idx], ...body };
      } else {
        const r = await fetch('/api/v1/rule-matrices', {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
        });
        const d = await r.json();
        _matrices.push({ id: d.id, is_active:1, source:'manual', ...body });
      }
      closeModal();
      bus.emit('dirty', {});
      _tab('matrices');
      toast(t('Matrix saved.','تم حفظ المصفوفة.'), 'success');
    } catch(e) { toast(e.message, 'error'); }
  }

  async function deleteMatrix(id) {
    if (!confirm(t('Delete this matrix?','حذف هذه المصفوفة؟'))) return;
    try {
      await fetch(`/api/v1/rule-matrices/${id}`, { method:'DELETE' });
      _matrices = _matrices.filter(m => m.id !== id);
      _tab('matrices');
      toast(t('Matrix deleted.','تم حذف المصفوفة.'), 'info');
    } catch(e) { toast(e.message, 'error'); }
  }

  /* ═══════════════════════════════════════════
     AI Generate Modals
  ═══════════════════════════════════════════ */
  function openAiRuleModal() {
    showModal(`
      <div class="pge-modal-header">
        <h3><i class="fas fa-wand-magic-sparkles" style="color:#6366f1;margin-right:.4rem"></i>
          ${t('AI Rule Generation','توليد القواعد بالذكاء الاصطناعي')}</h3>
        <button class="pge-btn pge-btn-ghost pge-btn-sm" onclick="closeModal()"><i class="fas fa-times"></i></button>
      </div>
      <div class="pge-modal-body">
        <div class="pge-field">
          <label class="pge-label">${t('Describe the rule you need','صف القاعدة التي تحتاجها')}</label>
          <textarea class="pge-textarea" id="ai_rule_prompt" rows="3"
            placeholder="${t('e.g. Add a hard rule: LTV must not exceed 75% for expatriates. Reference CBO Circular 2024-01.',
                            'مثال: أضف قاعدة صارمة: لا يجوز أن يتجاوز LTV 75% للوافدين. مرجع التعميم البنكي.')}"></textarea>
        </div>
        <div id="ai_rule_result"></div>
      </div>
      <div style="padding:.875rem 1.125rem;border-top:1px solid #e9ecef;display:flex;justify-content:flex-end;gap:.5rem">
        <button class="pge-btn pge-btn-ghost" onclick="closeModal()">${t('Cancel','إلغاء')}</button>
        <button class="pge-btn pge-btn-ai" onclick="PGEStage3._aiGenerateRule()">
          <i class="fas fa-wand-magic-sparkles"></i> ${t('Generate','توليد')}
        </button>
      </div>`);
  }

  async function _aiGenerateRule() {
    const prompt = document.getElementById('ai_rule_prompt')?.value.trim();
    if (!prompt) return;
    const resultEl = document.getElementById('ai_rule_result');
    if (resultEl) resultEl.innerHTML = `<div style="padding:1rem;text-align:center;color:#6c757d"><i class="fas fa-spinner fa-spin"></i></div>`;
    try {
      const sysCtx = `Product: ${_product.name}, category: ${_product.category}, market: Oman (CBO).`;
      const d = await API.aiChat(_productId,
        `${sysCtx} Generate a rule JSON object with fields: name, category, metric, operator, threshold_value, threshold_condition, action_on_breach, severity, regulatory_reference, description. User request: ${prompt}. Return ONLY valid JSON, no markdown.`,
        []);
      const raw = (d.response||'').replace(/```json|```/g,'').trim();
      let rule;
      try { rule = JSON.parse(raw); } catch(_) {
        if (resultEl) resultEl.innerHTML = `<div style="color:#BD3B4B;font-size:.8rem;padding:.5rem">${t('AI did not return valid JSON.','لم يُرجع الذكاء الاصطناعي JSON صالحًا.')}<br><pre style="font-size:.7rem;white-space:pre-wrap">${esc(raw)}</pre></div>`;
        return;
      }
      if (resultEl) resultEl.innerHTML = `
        <div style="margin-top:.75rem;background:#f8f9fa;border-radius:10px;padding:.875rem;border:1px solid #e9ecef">
          <div style="font-size:.78rem;font-weight:600;color:#003B5C;margin-bottom:.5rem">${t('Generated Rule Preview','معاينة القاعدة المُولَّدة')}</div>
          <pre style="font-size:.72rem;white-space:pre-wrap;color:#495057">${esc(JSON.stringify(rule,null,2))}</pre>
          <button class="pge-btn pge-btn-success pge-btn-sm" style="margin-top:.625rem;width:100%"
            onclick="PGEStage3._applyAiRule(${esc(JSON.stringify(JSON.stringify(rule)))})">
            <i class="fas fa-check"></i> ${t('Apply & Save','تطبيق وحفظ')}
          </button>
        </div>`;
    } catch(e) {
      if (resultEl) resultEl.innerHTML = `<div style="color:#BD3B4B;font-size:.8rem;padding:.5rem">${e.message}</div>`;
    }
  }

  async function _applyAiRule(jsonStr) {
    try {
      const rule = JSON.parse(jsonStr);
      const body = { ...rule, source:'ai_generated', user_id:'u001', product_id: _productId };
      const r = await fetch(`/api/v1/products/${_productId}/rules`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body),
      });
      const d = await r.json();
      _rules.push({ id: d.id, product_id: _productId, is_active:1, ...body });
      closeModal();
      _tab('rules');
      toast(t('AI rule applied.','تم تطبيق القاعدة المُولَّدة.'), 'success');
    } catch(e) { toast(e.message, 'error'); }
  }

  function openAiMatrixModal() {
    toast(t('AI matrix generation — ask the AI drawer to build a matrix for you.','توليد المصفوفة — اطلب من مساعد الذكاء إنشاء مصفوفة.'), 'info');
    PGEShell.toggleAI();
  }

  /* ─────────── Stage footer ─────────── */
  function renderStageFooter() {
    return `<div class="stage-footer">
      <button class="pge-btn pge-btn-ghost" onclick="PGEShell.goToStage(2)" style="color:#003B5C;border-color:#dee2e6">
        <i class="fas fa-arrow-left"></i> ${t('Back','رجوع')}
      </button>
      <div style="display:flex;gap:.5rem">
        <button class="pge-btn pge-btn-outline" onclick="PGEStage3.saveAndStay()">
          <i class="fas fa-floppy-disk"></i> ${t('Save','حفظ')}
        </button>
        <button class="pge-btn pge-btn-primary" onclick="PGEStage3.saveAndNext()">
          ${t('Continue to Workflow','المتابعة إلى سير العمل')} <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>`;
  }

  /* ─────────── Save / snapshot ─────────── */
  async function doSave(opts = {}) {
    try {
      const prevStage = _product.pge_stage || 0;
      if (prevStage < 3) {
        await API.snapshot(_productId, 3, { rule_count: _rules.length, matrix_count: _matrices.length });
        _product.pge_stage = 3;
      }
      bus.emit('saved', {});
      if (!opts.silent) toast(t('Stage 3 saved.','تم حفظ المرحلة 3.'), 'success');
      return true;
    } catch(e) { toast(t('Save failed: ','فشل الحفظ: ') + e.message, 'error'); return false; }
  }

  async function saveAndStay() { await doSave(); }
  async function saveAndNext() { const ok = await doSave(); if (ok) PGEShell.goToStage(4); }

  /* ─────────── Modal helpers ─────────── */
  function showModal(html, maxWidth = '560px') {
    ensureModalStyles();
    document.getElementById('pgeModal').innerHTML = `
      <div class="pge-modal-overlay" onclick="if(event.target===this)closeModal()">
        <div class="pge-modal" style="max-width:${maxWidth}">${html}</div>
      </div>`;
  }

  function closeModal() { document.getElementById('pgeModal').innerHTML = ''; }
  window.closeModal = closeModal;

  function ensureModalStyles() {
    if (document.getElementById('pgeModalStyle')) return;
    const s = document.createElement('style');
    s.id = 'pgeModalStyle';
    s.textContent = `.pge-modal-overlay{position:fixed;inset:0;background:rgba(0,59,92,.45);
      z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem}
      .pge-modal{background:white;border-radius:16px;width:100%;max-height:88vh;
      display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)}
      .pge-modal-header{padding:1rem 1.25rem;border-bottom:1px solid #e9ecef;
      display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
      .pge-modal-header h3{margin:0;font-size:.95rem;font-weight:700;color:#003B5C}
      .pge-modal-body{padding:1.125rem;overflow-y:auto;flex:1}`;
    document.head.appendChild(s);
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  window.PGEStage3 = {
    mount, _tab, runSandbox,
    openRuleModal, _saveRule, deleteRule,
    openMatrixModal, _saveMatrix, deleteMatrix,
    openAiRuleModal, _aiGenerateRule, _applyAiRule, openAiMatrixModal,
    saveAndStay, saveAndNext,
  };
})();
