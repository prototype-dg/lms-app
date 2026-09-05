/* ============================================================
   pge-stage6.js — Stage 6: Simulation & Approval
   Depends on: pge-shared.js (window.PGE)
   Sub-modules: Charts | Sensitivity | StressTest | AIPanel | Approval
   ============================================================ */
(function () {
  'use strict';
  const { state, API, toast, t, isAr, bus } = window.PGE;

  /* ──────────────────────────────────────────────
     CONSTANTS
  ────────────────────────────────────────────── */
  const SIM_VERSION = 1;
  const CHART_COLORS = {
    primary:   '#0a2342',
    teal:      '#0e7490',
    amber:     '#d97706',
    success:   '#059669',
    danger:    '#dc2626',
    muted:     '#94a3b8',
    gridLine:  '#e2e8f0',
  };

  /* Default slider config — key, label, unit, min, max, step, default */
  const SLIDERS = [
    { key:'rate',      en:'Interest Rate',      ar:'سعر الفائدة',       unit:'%',  min:2,   max:25,  step:0.25, def:8    },
    { key:'term',      en:'Loan Term',           ar:'مدة القرض',          unit:'yr', min:1,   max:30,  step:1,    def:15   },
    { key:'ltv',       en:'LTV Ratio',           ar:'نسبة التمويل للقيمة',unit:'%',  min:10,  max:90,  step:5,    def:70   },
    { key:'dbr',       en:'DBR Ceiling',         ar:'نسبة العبء',         unit:'%',  min:20,  max:60,  step:5,    def:40   },
    { key:'fees',      en:'Origination Fee',     ar:'رسوم الإنشاء',       unit:'%',  min:0,   max:5,   step:0.25, def:1    },
    { key:'prepayment',en:'Prepayment Penalty',  ar:'غرامة السداد المبكر',unit:'%',  min:0,   max:5,   step:0.25, def:1.5  },
  ];

  /* Stress scenarios — each is a delta map applied to slider values */
  const STRESS_SCENARIOS = [
    {
      id:'base',     en:'Base Case',          ar:'الحالة الأساسية',
      deltas:{ rate:0, term:0, ltv:0 },
      color: CHART_COLORS.primary,
    },
    {
      id:'rate_up',  en:'Rate Shock +3%',     ar:'صدمة الفائدة +٣٪',
      deltas:{ rate:3, term:0, ltv:0 },
      color: CHART_COLORS.amber,
    },
    {
      id:'ltv_up',   en:'LTV Stress +10%',    ar:'ضغط التمويل +١٠٪',
      deltas:{ rate:0, term:0, ltv:10 },
      color: CHART_COLORS.teal,
    },
    {
      id:'adverse',  en:'Adverse Combined',   ar:'الحالة المعاكسة',
      deltas:{ rate:5, term:-5, ltv:10 },
      color: CHART_COLORS.danger,
    },
  ];

  const APPROVAL_ROLES = [
    { key:'risk',       en:'Risk Officer',      ar:'مسؤول المخاطر'      },
    { key:'compliance', en:'Compliance Officer', ar:'مسؤول الامتثال'     },
    { key:'ceo',        en:'CEO / Board',        ar:'الرئيس التنفيذي'    },
  ];

  /* ──────────────────────────────────────────────
     STATE
  ────────────────────────────────────────────── */
  let _pid    = null;
  let _prod   = null;          // full product row from API
  let _simData = null;         // saved simulation object
  let _sliderVals = {};        // current slider values
  let _activeTab  = 'portfolio'; // portfolio | charts | sensitivity | stress | approval
  let _charts     = {};        // Chart.js instances keyed by canvas id
  let _aiThread   = null;
  let _narrative  = '';
  let _approvals  = {};        // { risk:'approved'|'rejected'|null, ... }

  /* ──────────────────────────────────────────────
     FINANCIAL MATH HELPERS
  ────────────────────────────────────────────── */
  /**
   * Monthly payment for an annuity
   * P = principal, r = annual rate (%), n = term years
   */
  function monthlyPayment(P, r, n) {
    if (!r) return P / (n * 12);
    const rm = r / 100 / 12;
    const nm = n * 12;
    return P * rm * Math.pow(1 + rm, nm) / (Math.pow(1 + rm, nm) - 1);
  }

  /**
   * Build amortization schedule (year-by-year aggregates).
   * Returns array of { year, principal, interest, balance }
   */
  function amortSchedule(P, r, n) {
    const rm   = r / 100 / 12;
    const pmt  = monthlyPayment(P, r, n);
    let balance = P;
    const rows  = [];

    for (let yr = 1; yr <= n; yr++) {
      let yearPrincipal = 0;
      let yearInterest  = 0;
      for (let m = 0; m < 12; m++) {
        const interest = balance * rm;
        const principal = Math.max(0, pmt - interest);
        yearInterest  += interest;
        yearPrincipal += principal;
        balance       -= principal;
        if (balance < 0) balance = 0;
      }
      rows.push({ year: yr, principal: yearPrincipal, interest: yearInterest, balance: Math.max(0, balance) });
    }
    return rows;
  }

  /** NPV of a loan from lender perspective (simplified) */
  function calcNPV(P, r, n, discountRate = 0.1) {
    const cashflows = amortSchedule(P, r, n);
    let npv = -P;
    cashflows.forEach(row => {
      const totalCash = row.principal + row.interest;
      npv += totalCash / Math.pow(1 + discountRate / 12, row.year * 12);
    });
    return npv;
  }

  /** Effective APR given fees */
  function calcAPR(rate, fees, term) {
    // Simplified: APR ≈ rate + fees/term
    return rate + (fees / term);
  }

  /** Key metrics object given slider values */
  function calcMetrics(sv) {
    const principal  = 100000; // normalise to 100k for display
    const r          = sv.rate;
    const n          = sv.term;
    const ltv        = sv.ltv;
    const fees       = sv.fees;

    const pmt        = monthlyPayment(principal, r, n);
    const totalPaid  = pmt * n * 12;
    const totalInt   = totalPaid - principal;
    const apr        = calcAPR(r, fees, n);
    const loanAmt    = principal * ltv / 100;
    const breakeven  = (principal * fees / 100) / (totalInt / (n * 12)) ; // months to break even
    const npv        = calcNPV(loanAmt, r, n);

    return { pmt, totalPaid, totalInt, apr, loanAmt, breakeven, npv, principal, r, n, ltv };
  }

  /* ──────────────────────────────────────────────
     PORTFOLIO SIMULATION MATH
     Mirrors the AI Studio Stage 6 fallback logic.
     Segment detection: HNW (max_amount ≥ 500k or min ≥ 100k),
     Affluent (max ≥ 200k), else Mass.
  ────────────────────────────────────────────── */
  function _detectSegment() {
    const maxAmt  = parseFloat(_prod?.max_amount  || 0);
    const minAmt  = parseFloat(_prod?.min_amount  || 0);
    const desc    = (_prod?.description || '').toLowerCase();
    if (desc.includes('hnw') || desc.includes('high net') || minAmt >= 100000 || maxAmt >= 500000) return 'HNW';
    if (desc.includes('affluent') || desc.includes('wealth') || maxAmt >= 200000) return 'Affluent';
    return 'Mass';
  }

  function _calcPortfolioMetrics() {
    const seg = _detectSegment();
    const isHNW      = seg === 'HNW';
    const isAffluent = seg === 'Affluent';

    // Segment parameters (aligned with AI Studio fallback)
    const avgLoanAmt    = isHNW ? 280000 : isAffluent ? 150000 : 90000;
    const conversionPct = isHNW ? 8       : isAffluent ? 12      : 18;
    const costOfFunds   = 3.5;   // OMR wholesale/deposit funding rate baseline

    // Green pipeline: ~6% of Oman addressable mortgage market (~13 251 applicants)
    const greenPipeline = Math.round(13251 * 0.06);           // ~795 green-eligible
    const yr1Accounts   = Math.round(greenPipeline * (conversionPct / 100));
    const yr1Portfolio  = Math.round(yr1Accounts * avgLoanAmt / 1e6 * 10) / 10; // OMR M

    // Gross lending rate (what borrowers pay)
    const productRate = parseFloat(_prod?.base_rate || _sliderVals.rate || 5.5);

    // NIM = gross rate − cost of funds (the spread retained by the bank)
    const nim = Math.round((productRate - costOfFunds) * 100) / 100;

    // Year 1–3 portfolio growth (conservative 25% YoY new disbursements added)
    const yr2Portfolio = Math.round(yr1Portfolio * 1.25 * 10) / 10;
    const yr3Portfolio = Math.round(yr2Portfolio * 1.25 * 10) / 10;

    // ── P&L model (correct banking income statement) ──────────────────────────
    // Gross interest income = portfolio × gross lending rate
    // (what the bank collects from mortgage borrowers each year)
    const r = v => Math.round(v / 1000) * 1000; // round to nearest 1K OMR
    const yr1GrossIncome = r(yr1Portfolio * 1e6 * productRate / 100);
    const yr2GrossIncome = r(yr2Portfolio * 1e6 * productRate / 100);
    const yr3GrossIncome = r(yr3Portfolio * 1e6 * productRate / 100);

    // Cost of funds = what the bank pays to fund these loans
    const yr1FundingCost = r(yr1Portfolio * 1e6 * costOfFunds / 100);
    const yr2FundingCost = r(yr2Portfolio * 1e6 * costOfFunds / 100);
    const yr3FundingCost = r(yr3Portfolio * 1e6 * costOfFunds / 100);

    // Net Interest Income (NII) = gross income − funding cost = portfolio × NIM
    const yr1Income = yr1GrossIncome - yr1FundingCost;
    const yr2Income = yr2GrossIncome - yr2FundingCost;
    const yr3Income = yr3GrossIncome - yr3FundingCost;

    // IFRS9 ECL Stage 1 provisioning: 1.5% of outstanding portfolio per year
    const ecl1 = r(yr1Portfolio * 1e6 * 0.015);
    const ecl2 = r(yr2Portfolio * 1e6 * 0.015);
    const ecl3 = r(yr3Portfolio * 1e6 * 0.015);

    // Fixed product setup cost (systems, compliance, marketing, staff) — one-time
    const setupCost = isHNW ? 180000 : isAffluent ? 120000 : 85000;

    // Ongoing operating expense: ~15% of setup per year (maintenance, compliance run-rate)
    const ongoingOpex = Math.round(setupCost * 0.15 / 1000) * 1000;

    // Net revenue = NII − ECL − ongoing opex
    const netRev1 = yr1Income - ecl1 - ongoingOpex;
    const netRev2 = yr2Income - ecl2 - ongoingOpex;
    const netRev3 = yr3Income - ecl3 - ongoingOpex;

    // Break-even: month when cumulative NII covers setup cost
    // monthly NII = yr1Income / 12; months = setupCost / (yr1Income/12)
    const monthlyNII = yr1Income / 12;
    const breakEvenMonth = monthlyNII > 0
      ? Math.max(1, Math.round(setupCost / monthlyNII))
      : (isHNW ? 9 : isAffluent ? 11 : 14);

    // 3-year ROI = cumulative net revenue / setup cost
    const roi3 = Math.round((netRev1 + netRev2 + netRev3) / setupCost * 100);

    // Rate shock stress: +200bps impact on portfolio DBR compliance
    const stressRate = productRate + 2;
    const maxDBR = parseFloat(_prod?.max_dbr || 60);
    // Borrowers at risk: approx 30% of accounts are near DBR ceiling;
    // of those, the monthly payment increase from +200bps pushes them over.
    // Payment increase ≈ 200bps / 12 months × average loan duration factor (~0.6)
    const dbrAtRisk = Math.round(yr1Accounts * 0.30 * 0.60);

    return {
      seg, isHNW, isAffluent,
      avgLoanAmt, conversionPct, greenPipeline, yr1Accounts,
      yr1Portfolio, yr2Portfolio, yr3Portfolio,
      productRate, nim, costOfFunds,
      yr1GrossIncome, yr2GrossIncome, yr3GrossIncome,
      yr1FundingCost, yr2FundingCost, yr3FundingCost,
      yr1Income, yr2Income, yr3Income,
      ecl1, ecl2, ecl3,
      ongoingOpex, netRev1, netRev2, netRev3,
      setupCost, breakEvenMonth, roi3,
      stressRate, dbrAtRisk, maxDBR,
    };
  }

  /* ──────────────────────────────────────────────
     MOUNT
  ────────────────────────────────────────────── */
  function mount(container, ctx) {
    _pid  = ctx.productId;
    _prod = ctx.product;

    // Init slider defaults from product config if available
    _initSliderDefaults();
    _initApprovals();

    container.innerHTML = _renderShell();
    _attachTabEvents(container);
    _renderTab(_activeTab, container);

    bus.on('langChanged', () => {
      container.innerHTML = _renderShell();
      _attachTabEvents(container);
      _renderTab(_activeTab, container);
    });
  }

  function _initSliderDefaults() {
    const cfg = _prod?.config ? (() => { try { return JSON.parse(_prod.config); } catch { return {}; } })() : {};
    SLIDERS.forEach(s => {
      if (_sliderVals[s.key] === undefined) {
        // prefer saved value from product config
        const cfgVal = cfg[s.key] !== undefined ? parseFloat(cfg[s.key]) : null;
        _sliderVals[s.key] = cfgVal !== null && !isNaN(cfgVal)
          ? Math.min(s.max, Math.max(s.min, cfgVal))
          : s.def;
      }
    });
  }

  function _initApprovals() {
    APPROVAL_ROLES.forEach(r => {
      if (_approvals[r.key] === undefined) _approvals[r.key] = null;
    });
  }

  /* ──────────────────────────────────────────────
     SHELL RENDER
  ────────────────────────────────────────────── */
  function _renderShell() {
    const ar = isAr();
    const tabs = [
      { id:'portfolio',   en:'Portfolio Simulation', ar:'محاكاة المحفظة'   },
      { id:'charts',      en:'Loan Calculator',      ar:'حاسبة القرض'      },
      { id:'sensitivity', en:'Sensitivity',           ar:'التحليل الحساس'  },
      { id:'stress',      en:'Stress Test',           ar:'اختبار الضغط'    },
      { id:'approval',    en:'Approval Matrix',       ar:'مصفوفة الموافقة' },
    ];

    const tabHtml = tabs.map(tb => `
      <button class="pge-tab-btn${_activeTab === tb.id ? ' active' : ''}"
              data-tab="${tb.id}">${ar ? tb.ar : tb.en}</button>
    `).join('');

    return `
      <div class="s6-wrapper" dir="${ar ? 'rtl' : 'ltr'}">
        <header class="s6-header">
          <div class="s6-title">
            <i class="fas fa-chart-line"></i>
            <span>${t('Simulation & Approval', 'المحاكاة والموافقة')}</span>
          </div>
          <div class="s6-hdr-actions">
            <button class="pge-btn pge-btn-ghost" id="s6BtnRefresh">
              <i class="fas fa-sync-alt"></i> ${t('Recalculate','إعادة الحساب')}
            </button>
            <button class="pge-btn pge-btn-ghost" id="s6BtnAI">
              <i class="fas fa-robot"></i> ${t('AI Narrative','السرد الذكي')}
            </button>
          </div>
        </header>

        <!-- KPI Strip -->
        <div class="s6-kpi-strip" id="s6KpiStrip"></div>

        <!-- Slider Rail (always visible) -->
        <section class="s6-slider-rail" id="s6SliderRail"></section>

        <!-- Tab bar -->
        <nav class="pge-tab-bar">${tabHtml}</nav>

        <!-- Tab content -->
        <div class="s6-tab-content" id="s6TabContent"></div>

        <!-- AI Narrative Panel -->
        <div class="s6-ai-panel hidden" id="s6AiPanel">
          <div class="s6-ai-panel-hdr">
            <span><i class="fas fa-robot"></i> ${t('AI Narrative Commentary','التعليق السردي الذكي')}</span>
            <button class="pge-btn pge-btn-ghost" id="s6AiClose"><i class="fas fa-times"></i></button>
          </div>
          <div class="s6-ai-body" id="s6AiBody">
            <div class="s6-ai-placeholder">
              ${t('Click "Generate" to create an AI risk & product commentary based on current simulation parameters.',
                  'انقر على "توليد" لإنشاء تعليق مخاطر ذكي بناءً على معاملات المحاكاة الحالية.')}
            </div>
          </div>
          <div class="s6-ai-footer">
            <button class="pge-btn pge-btn-primary" id="s6AiGenerate">
              <i class="fas fa-magic"></i> ${t('Generate','توليد')}
            </button>
          </div>
        </div>

        <!-- Save bar -->
        <footer class="s6-save-bar">
          <button class="pge-btn pge-btn-ghost" id="s6SaveStay">
            <i class="fas fa-save"></i> ${t('Save Simulation','حفظ المحاكاة')}
          </button>
          <button class="pge-btn pge-btn-primary" id="s6Finalize">
            <i class="fas fa-flag-checkered"></i> ${t('Finalize Product','إنهاء المنتج')}
          </button>
        </footer>
      </div>
    `;
  }

  /* ──────────────────────────────────────────────
     TAB ROUTING
  ────────────────────────────────────────────── */
  function _attachTabEvents(container) {
    container.addEventListener('click', e => {
      const tb = e.target.closest('[data-tab]');
      if (tb) { _activeTab = tb.dataset.tab; _renderTab(_activeTab, container); return; }

      if (e.target.closest('#s6BtnRefresh')) { _renderTab(_activeTab, container); return; }
      if (e.target.closest('#s6BtnAI'))      { _toggleAiPanel(container);          return; }
      if (e.target.closest('#s6AiClose'))    { _hideAiPanel(container);             return; }
      if (e.target.closest('#s6AiGenerate')) { _generateNarrative(container);       return; }
      if (e.target.closest('#s6SaveStay'))   { saveAndStay();                        return; }
      if (e.target.closest('#s6Finalize'))   { _finalizeProduct(container);          return; }
    });
  }

  function _renderTab(tabId, container) {
    // Update tab btn active states
    container.querySelectorAll('.pge-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });

    // Render KPIs + sliders every tab switch
    _renderKpiStrip(container);
    _renderSliderRail(container);

    const tc = container.querySelector('#s6TabContent');
    if (!tc) return;

    switch (tabId) {
      case 'portfolio':   _renderPortfolioTab(tc);    break;
      case 'charts':      _renderChartsTab(tc);        break;
      case 'sensitivity': _renderSensitivityTab(tc);   break;
      case 'stress':      _renderStressTab(tc);         break;
      case 'approval':    _renderApprovalTab(tc);       break;
    }
  }

  /* ──────────────────────────────────────────────
     KPI STRIP
  ────────────────────────────────────────────── */
  function _renderKpiStrip(container) {
    const el = container.querySelector('#s6KpiStrip');
    if (!el) return;

    if (_activeTab === 'portfolio') {
      // Portfolio-level KPIs
      const p   = _calcPortfolioMetrics();
      const fmtM = v => 'OMR ' + (v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : v);
      const segLabel = p.seg === 'HNW' ? 'HNW' : p.seg === 'Affluent' ? 'Affluent' : 'Mass';
      const kpis = [
        { icon:'fa-users',           label: t('Yr 1 Accounts','حسابات السنة 1'),      val: p.yr1Accounts.toLocaleString(),         sub: t(`${segLabel} segment`, `شريحة ${segLabel}`) },
        { icon:'fa-briefcase',       label: t('Yr 1 Portfolio','محفظة السنة 1'),       val: 'OMR ' + p.yr1Portfolio + 'M',          sub: t('gross book value','إجمالي القيمة الدفترية') },
        { icon:'fa-percentage',      label: t('NIM','هامش الفائدة الصافي'),            val: p.nim.toFixed(2) + '%',                 sub: t('rate − cost of funds','السعر − تكلفة التمويل') },
        { icon:'fa-coins',           label: t('Yr 1 NII','دخل الفائدة الصافي س1'),     val: fmtM(p.yr1Income),                      sub: t('gross interest income','إجمالي دخل الفائدة') },
        { icon:'fa-calendar-check',  label: t('Break-even','نقطة التعادل'),            val: p.breakEvenMonth + t(' mo',' شهر'),     sub: t('vs setup cost','مقابل تكلفة الإعداد') },
        { icon:'fa-chart-line',      label: t('3-Yr ROI','عائد الاستثمار 3 سنوات'),   val: p.roi3 + '%',                           sub: t('cumulative net return','العائد الصافي التراكمي') },
      ];
      el.innerHTML = kpis.map(k => `
        <div class="s6-kpi">
          <i class="fas ${k.icon} s6-kpi-icon"></i>
          <div class="s6-kpi-val">${k.val}</div>
          <div class="s6-kpi-label">${k.label}</div>
          <div class="s6-kpi-sub">${k.sub}</div>
        </div>
      `).join('');
    } else {
      // Single-loan KPIs for other tabs
      const m   = calcMetrics(_sliderVals);
      const fmt = v => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
      const fmtC = v => 'OMR ' + fmt(v);
      const fmtP = v => v.toFixed(2) + '%';
      const kpis = [
        { icon:'fa-hand-holding-usd', label: t('Monthly Payment','الدفعة الشهرية'),   val: fmtC(m.pmt),       sub: t('per 100k principal','لكل 100 ألف') },
        { icon:'fa-percentage',       label: t('Effective APR','معدل العائد الفعلي'),  val: fmtP(m.apr),       sub: t('including fees','شاملاً الرسوم') },
        { icon:'fa-coins',            label: t('Total Interest','إجمالي الفائدة'),      val: fmtC(m.totalInt),  sub: t('over full term','على مدى الفترة') },
        { icon:'fa-calendar-check',   label: t('Break-even','نقطة التعادل'),            val: Math.ceil(m.breakeven) + t(' mo',' شهر'), sub: t('fee recovery','استرداد الرسوم') },
        { icon:'fa-chart-bar',        label: t('NPV (10% disc.)','القيمة الحالية'),     val: fmtC(m.npv),       sub: t('lender perspective','من منظور المقرض') },
      ];
      el.innerHTML = kpis.map(k => `
        <div class="s6-kpi">
          <i class="fas ${k.icon} s6-kpi-icon"></i>
          <div class="s6-kpi-val">${k.val}</div>
          <div class="s6-kpi-label">${k.label}</div>
          <div class="s6-kpi-sub">${k.sub}</div>
        </div>
      `).join('');
    }
  }

  /* ──────────────────────────────────────────────
     SLIDER RAIL
  ────────────────────────────────────────────── */
  function _renderSliderRail(container) {
    const el = container.querySelector('#s6SliderRail');
    if (!el) return;
    const ar = isAr();

    el.innerHTML = `
      <div class="s6-sliders-grid">
        ${SLIDERS.map(s => `
          <div class="s6-slider-item">
            <div class="s6-slider-hdr">
              <span class="s6-slider-label">${ar ? s.ar : s.en}</span>
              <span class="s6-slider-val" id="slval_${s.key}">${_sliderVals[s.key]}${s.unit}</span>
            </div>
            <input type="range" class="s6-range" id="sl_${s.key}"
                   min="${s.min}" max="${s.max}" step="${s.step}"
                   value="${_sliderVals[s.key]}"
                   data-key="${s.key}" data-unit="${s.unit}">
            <div class="s6-slider-bounds">
              <span>${s.min}${s.unit}</span><span>${s.max}${s.unit}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Wire live slider updates
    el.querySelectorAll('.s6-range').forEach(inp => {
      inp.addEventListener('input', e => {
        const key  = e.target.dataset.key;
        const unit = e.target.dataset.unit;
        const val  = parseFloat(e.target.value);
        _sliderVals[key] = val;
        const display = container.querySelector(`#slval_${key}`);
        if (display) display.textContent = val + unit;
        bus.emit('dirty');
        // Debounce chart redraw
        clearTimeout(inp._redrawTimer);
        inp._redrawTimer = setTimeout(() => _renderTab(_activeTab, container), 300);
      });
    });
  }

  /* ──────────────────────────────────────────────
     TAB 1: PORTFOLIO SIMULATION (new)
     Product Portfolio Manager view — mirrors AI Studio Stage 6 output:
     pipeline forecast, accounts, portfolio OMR, NIM, P&L 3-yr, break-even, ROI, stress.
  ────────────────────────────────────────────── */
  function _renderPortfolioTab(tc) {
    const ar = isAr();
    const p  = _calcPortfolioMetrics();

    const fmtOMR = v => {
      if (v >= 1e6) return 'OMR ' + (v / 1e6).toFixed(2) + 'M';
      if (v >= 1000) return 'OMR ' + Math.round(v / 1000) + 'K';
      return 'OMR ' + Math.round(v).toLocaleString();
    };
    const fmtPct = v => v.toFixed(2) + '%';
    const segColor = p.isHNW ? '#0a2342' : p.isAffluent ? '#0e7490' : '#059669';
    const segLabel = p.isHNW ? t('High Net Worth (HNW)','الثروة العالية') : p.isAffluent ? t('Affluent','الميسورون') : t('Mass Market','السوق الشامل');

    // P&L table rows — correct banking income statement
    const plRows = [
      { label: t('Gross Interest Income','إجمالي دخل الفائدة'),         yr1: p.yr1GrossIncome,  yr2: p.yr2GrossIncome,  yr3: p.yr3GrossIncome,  type:'income' },
      { label: t('Cost of Funds ('+p.costOfFunds+'%)','تكلفة التمويل ('+p.costOfFunds+'٪)'), yr1: -p.yr1FundingCost, yr2: -p.yr2FundingCost, yr3: -p.yr3FundingCost, type:'cost' },
      { label: t('Net Interest Income (NII)','صافي دخل الفائدة (NII)'), yr1: p.yr1Income,        yr2: p.yr2Income,        yr3: p.yr3Income,        type:'nim' },
      { label: t('IFRS9 ECL Provision (1.5%)','مخصص IFRS9 (١.٥٪)'),    yr1: -p.ecl1,           yr2: -p.ecl2,           yr3: -p.ecl3,           type:'cost' },
      { label: t('Ongoing Opex','المصاريف التشغيلية الجارية'),           yr1: -p.ongoingOpex,    yr2: -p.ongoingOpex,    yr3: -p.ongoingOpex,    type:'cost' },
      { label: t('Net Revenue','الإيرادات الصافية'),                      yr1: p.netRev1,         yr2: p.netRev2,         yr3: p.netRev3,         type:'net' },
    ];

    tc.innerHTML = `
      <div class="s6-portfolio-wrap">

        <!-- Segment badge + product info -->
        <div class="s6-port-header">
          <div class="s6-port-seg-badge" style="background:${segColor}">
            <i class="fas fa-users"></i>
            <span>${segLabel}</span>
          </div>
          <div class="s6-port-meta">
            <span><strong>${t('Product','المنتج')}:</strong> ${_prod?.name || '—'}</span>
            <span><strong>${t('Rate','السعر')}:</strong> ${p.productRate}%</span>
            <span><strong>${t('NIM','هامش الفائدة')}:</strong> ${fmtPct(p.nim)}</span>
            <span><strong>${t('Avg Loan','متوسط التمويل')}:</strong> ${fmtOMR(p.avgLoanAmt)}</span>
          </div>
        </div>

        <!-- Pipeline Forecast section -->
        <div class="s6-port-section">
          <div class="s6-section-hdr">
            <i class="fas fa-filter"></i>
            ${t('Green Mortgage Pipeline Forecast','توقعات خط أنابيب القروض الخضراء')}
          </div>
          <div class="s6-port-pipeline">
            <div class="s6-pipe-step">
              <div class="s6-pipe-icon" style="background:#dbeafe"><i class="fas fa-landmark" style="color:#1e40af"></i></div>
              <div class="s6-pipe-val">${(13251).toLocaleString()}</div>
              <div class="s6-pipe-label">${t('Total Addressable','إجمالي السوق المستهدف')}</div>
              <div class="s6-pipe-sub">${t('Oman mortgage market','سوق القروض العقارية بعُمان')}</div>
            </div>
            <div class="s6-pipe-arrow"><i class="fas fa-chevron-right"></i><span>6%</span></div>
            <div class="s6-pipe-step">
              <div class="s6-pipe-icon" style="background:#d1fae5"><i class="fas fa-leaf" style="color:#065f46"></i></div>
              <div class="s6-pipe-val">${p.greenPipeline.toLocaleString()}</div>
              <div class="s6-pipe-label">${t('Green-Eligible Pipeline','خط أنابيب مؤهل للتمويل الأخضر')}</div>
              <div class="s6-pipe-sub">${t('GSAS-certified properties','عقارات معتمدة GSAS')}</div>
            </div>
            <div class="s6-pipe-arrow"><i class="fas fa-chevron-right"></i><span>${p.conversionPct}%</span></div>
            <div class="s6-pipe-step s6-pipe-highlight">
              <div class="s6-pipe-icon" style="background:#fef3c7"><i class="fas fa-handshake" style="color:#92400e"></i></div>
              <div class="s6-pipe-val">${p.yr1Accounts.toLocaleString()}</div>
              <div class="s6-pipe-label">${t('Year 1 New Accounts','حسابات جديدة السنة الأولى')}</div>
              <div class="s6-pipe-sub">${t(`${p.conversionPct}% conversion rate`,`معدل تحويل ${p.conversionPct}٪`)}</div>
            </div>
          </div>
        </div>

        <!-- Portfolio Growth + KPIs -->
        <div class="s6-port-section">
          <div class="s6-section-hdr">
            <i class="fas fa-chart-area"></i>
            ${t('OMR Portfolio Value Forecast','توقعات قيمة المحفظة (ريال عُماني)')}
          </div>
          <div class="s6-port-growth-grid">
            ${[
              { yr: t('Year 1','السنة 1'), val: p.yr1Portfolio, accounts: p.yr1Accounts,                  gross: p.yr1GrossIncome, nii: p.yr1Income, ecl: p.ecl1, net: p.netRev1 },
              { yr: t('Year 2','السنة 2'), val: p.yr2Portfolio, accounts: Math.round(p.yr1Accounts*1.25), gross: p.yr2GrossIncome, nii: p.yr2Income, ecl: p.ecl2, net: p.netRev2 },
              { yr: t('Year 3','السنة 3'), val: p.yr3Portfolio, accounts: Math.round(p.yr1Accounts*1.56), gross: p.yr3GrossIncome, nii: p.yr3Income, ecl: p.ecl3, net: p.netRev3 },
            ].map((yr, i) => `
              <div class="s6-yr-card">
                <div class="s6-yr-label">${yr.yr}</div>
                <div class="s6-yr-portfolio">${yr.val}M OMR</div>
                <div class="s6-yr-accounts">${yr.accounts.toLocaleString()} ${t('accounts','حسابات')}</div>
                <div class="s6-yr-metrics">
                  <div class="s6-yr-row">
                    <span>${t('Gross Interest','إجمالي الفائدة')}</span>
                    <span class="s6-yr-pos">${fmtOMR(yr.gross)}</span>
                  </div>
                  <div class="s6-yr-row">
                    <span>${t('NII (after CoF)','NII بعد تكلفة التمويل')}</span>
                    <span class="s6-yr-pos">${fmtOMR(yr.nii)}</span>
                  </div>
                  <div class="s6-yr-row">
                    <span>${t('ECL Provision','مخصص الخسائر')}</span>
                    <span class="s6-yr-neg">−${fmtOMR(yr.ecl)}</span>
                  </div>
                  <div class="s6-yr-row s6-yr-net-row">
                    <span>${t('Net Revenue','الإيراد الصافي')}</span>
                    <span class="${yr.net >= 0 ? 's6-yr-pos' : 's6-yr-neg'}">${fmtOMR(yr.net)}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- P&L Table + Chart -->
        <div class="s6-port-section s6-port-pl-section">
          <div class="s6-port-pl-left">
            <div class="s6-section-hdr">
              <i class="fas fa-table"></i>
              ${t('3-Year P&L Summary','ملخص الأرباح والخسائر 3 سنوات')}
            </div>
            <table class="s6-table s6-pl-table">
              <thead>
                <tr>
                  <th>${t('Item','البند')}</th>
                  <th>${t('Year 1','السنة 1')}</th>
                  <th>${t('Year 2','السنة 2')}</th>
                  <th>${t('Year 3','السنة 3')}</th>
                </tr>
              </thead>
              <tbody>
                ${plRows.map(row => `
                  <tr class="s6-pl-row-${row.type}">
                    <td>${row.label}</td>
                    <td class="${row.yr1 >= 0 ? 's6-td-green' : 's6-td-red'}">${fmtOMR(Math.abs(row.yr1))}${row.yr1 < 0 ? ' <span class="s6-neg-sign">−</span>' : ''}</td>
                    <td class="${row.yr2 >= 0 ? 's6-td-green' : 's6-td-red'}">${fmtOMR(Math.abs(row.yr2))}${row.yr2 < 0 ? ' <span class="s6-neg-sign">−</span>' : ''}</td>
                    <td class="${row.yr3 >= 0 ? 's6-td-green' : 's6-td-red'}">${fmtOMR(Math.abs(row.yr3))}${row.yr3 < 0 ? ' <span class="s6-neg-sign">−</span>' : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="s6-port-pl-right">
            <div class="s6-chart-wrap" style="height:200px"><canvas id="chartPortPL"></canvas></div>
          </div>
        </div>

        <!-- Break-even + ROI + Stress row -->
        <div class="s6-port-section">
          <div class="s6-port-summary-grid">

            <!-- Break-even -->
            <div class="s6-port-summary-card">
              <div class="s6-section-hdr"><i class="fas fa-calendar-check"></i> ${t('Break-even Analysis','تحليل نقطة التعادل')}</div>
              <div class="s6-breakeven-big">${p.breakEvenMonth}</div>
              <div class="s6-breakeven-label">${t('months to break even','شهراً للوصول لنقطة التعادل')}</div>
              <div class="s6-port-summary-rows">
                <div class="s6-sum-row"><span>${t('Setup Cost (one-time)','تكلفة الإعداد (مرة واحدة)')}</span><span>${fmtOMR(p.setupCost)}</span></div>
                <div class="s6-sum-row"><span>${t('Monthly NII Run-rate','معدل دخل الفائدة الشهري')}</span><span>${fmtOMR(Math.round(p.yr1Income / 12))}</span></div>
              </div>
            </div>

            <!-- ROI -->
            <div class="s6-port-summary-card">
              <div class="s6-section-hdr"><i class="fas fa-trophy"></i> ${t('Return on Investment','العائد على الاستثمار')}</div>
              <div class="s6-roi-big ${p.roi3 >= 100 ? 's6-roi-pos' : ''}">${p.roi3}%</div>
              <div class="s6-breakeven-label">${t('3-year cumulative ROI','عائد الاستثمار التراكمي 3 سنوات')}</div>
              <div class="s6-port-summary-rows">
                <div class="s6-sum-row"><span>${t('Total Net Rev (3yr)','إجمالي الإيراد الصافي')}</span><span>${fmtOMR(p.netRev1 + p.netRev2 + p.netRev3)}</span></div>
                <div class="s6-sum-row"><span>${t('vs Setup Cost','مقابل تكلفة الإعداد')}</span><span>${fmtOMR(p.setupCost)}</span></div>
              </div>
            </div>

            <!-- Rate-shock stress -->
            <div class="s6-port-summary-card s6-stress-card-port">
              <div class="s6-section-hdr"><i class="fas fa-bolt"></i> ${t('Rate Shock Stress (+200bps)','صدمة السعر +٢٠٠ نقطة')}</div>
              <div class="s6-stress-rate-row">
                <div>
                  <div class="s6-stress-label">${t('Base Rate','السعر الأساسي')}</div>
                  <div class="s6-stress-val">${p.productRate}%</div>
                </div>
                <i class="fas fa-arrow-right s6-stress-arrow"></i>
                <div>
                  <div class="s6-stress-label">${t('Stressed Rate','السعر المُجهَّد')}</div>
                  <div class="s6-stress-val s6-stress-val-red">${p.stressRate}%</div>
                </div>
              </div>
              <div class="s6-port-summary-rows">
                <div class="s6-sum-row">
                  <span>${t('DBR Ceiling','سقف العبء')}</span>
                  <span>${p.maxDBR}%</span>
                </div>
                <div class="s6-sum-row">
                  <span>${t('Accounts at DBR risk','حسابات عند حد العبء')}</span>
                  <span class="s6-td-red">${p.dbrAtRisk}</span>
                </div>
                <div class="s6-sum-row">
                  <span>${t('% of Yr1 Book','٪ من محفظة السنة 1')}</span>
                  <span class="${p.dbrAtRisk / p.yr1Accounts < 0.1 ? 's6-td-green' : 's6-td-red'}">
                    ${(p.dbrAtRisk / p.yr1Accounts * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    `;

    // Draw P&L chart
    _loadChartJs(() => {
      _destroyChart('chartPortPL');
      const ctx = document.getElementById('chartPortPL');
      if (!ctx) return;
      _charts['chartPortPL'] = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: [t('Year 1','السنة 1'), t('Year 2','السنة 2'), t('Year 3','السنة 3')],
          datasets: [
            {
              label: t('Gross Interest Income','إجمالي دخل الفائدة'),
              data: [p.yr1Income, p.yr2Income, p.yr3Income],
              backgroundColor: CHART_COLORS.teal,
            },
            {
              label: t('ECL Provisioning','مخصص الخسائر'),
              data: [p.ecl1, p.ecl2, p.ecl3],
              backgroundColor: CHART_COLORS.danger,
            },
            {
              label: t('Net Revenue','الإيراد الصافي'),
              data: [p.netRev1, p.netRev2, p.netRev3],
              backgroundColor: CHART_COLORS.success,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
            tooltip: {
              callbacks: { label: ctx => ` OMR ${Math.abs(Math.round(ctx.raw)).toLocaleString()}` }
            },
          },
          scales: {
            x: { grid: { color: CHART_COLORS.gridLine }, ticks: { font: { size: 10 } } },
            y: {
              grid: { color: CHART_COLORS.gridLine },
              ticks: {
                font: { size: 10 },
                callback: v => 'OMR ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
              },
            },
          },
        },
      });
    });
  }

  /* ──────────────────────────────────────────────
     TAB 2: LOAN CALCULATOR (was: Projections)
  ────────────────────────────────────────────── */
  function _renderChartsTab(tc) {
    tc.innerHTML = `
      <div class="s6-charts-grid">
        <div class="s6-chart-card">
          <div class="s6-chart-title">${t('Amortization Schedule','جدول الإطفاء')}</div>
          <div class="s6-chart-wrap"><canvas id="chartAmort"></canvas></div>
        </div>
        <div class="s6-chart-card">
          <div class="s6-chart-title">${t('Cumulative Balance','الرصيد التراكمي')}</div>
          <div class="s6-chart-wrap"><canvas id="chartBalance"></canvas></div>
        </div>
        <div class="s6-chart-card">
          <div class="s6-chart-title">${t('Interest vs Principal Split','الفائدة مقابل الأصل')}</div>
          <div class="s6-chart-wrap"><canvas id="chartSplit"></canvas></div>
        </div>
        <div class="s6-chart-card">
          <div class="s6-chart-title">${t('Cash Flow Timeline','الجدول الزمني للتدفق النقدي')}</div>
          <div class="s6-chart-wrap"><canvas id="chartCash"></canvas></div>
        </div>
      </div>
    `;

    // Load Chart.js if needed, then draw
    _loadChartJs(() => {
      const sched = amortSchedule(100000, _sliderVals.rate, _sliderVals.term);
      _drawAmort(sched);
      _drawBalance(sched);
      _drawSplit(sched);
      _drawCashFlow(sched);
    });
  }

  function _loadChartJs(cb) {
    if (window.Chart) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function _destroyChart(id) {
    if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
  }

  function _drawAmort(sched) {
    _destroyChart('chartAmort');
    const ctx = document.getElementById('chartAmort');
    if (!ctx) return;
    const labels = sched.map(r => `Yr ${r.year}`);
    _charts['chartAmort'] = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: t('Principal','الأصل'),
            data: sched.map(r => Math.round(r.principal)),
            backgroundColor: CHART_COLORS.primary,
          },
          {
            label: t('Interest','الفائدة'),
            data: sched.map(r => Math.round(r.interest)),
            backgroundColor: CHART_COLORS.teal,
          },
        ],
      },
      options: _chartOpts({ stacked: true }),
    });
  }

  function _drawBalance(sched) {
    _destroyChart('chartBalance');
    const ctx = document.getElementById('chartBalance');
    if (!ctx) return;
    const labels = [t('Start','البداية'), ...sched.map(r => `Yr ${r.year}`)];
    const balances = [100000, ...sched.map(r => Math.round(r.balance))];
    _charts['chartBalance'] = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: t('Remaining Balance','الرصيد المتبقي'),
          data: balances,
          borderColor: CHART_COLORS.primary,
          backgroundColor: CHART_COLORS.primary + '22',
          fill: true,
          tension: 0.3,
        }],
      },
      options: _chartOpts(),
    });
  }

  function _drawSplit(sched) {
    _destroyChart('chartSplit');
    const ctx = document.getElementById('chartSplit');
    if (!ctx) return;
    const totalP = sched.reduce((a, r) => a + r.principal, 0);
    const totalI = sched.reduce((a, r) => a + r.interest,  0);
    _charts['chartSplit'] = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [t('Total Principal','إجمالي الأصل'), t('Total Interest','إجمالي الفائدة')],
        datasets: [{
          data: [Math.round(totalP), Math.round(totalI)],
          backgroundColor: [CHART_COLORS.primary, CHART_COLORS.teal],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: ctx => ` $${ctx.raw.toLocaleString()}`
            }
          }
        },
      },
    });
  }

  function _drawCashFlow(sched) {
    _destroyChart('chartCash');
    const ctx = document.getElementById('chartCash');
    if (!ctx) return;
    // Rolling cumulative cash received by lender
    let cum = 0;
    const data = sched.map(r => {
      cum += r.principal + r.interest;
      return Math.round(cum);
    });
    _charts['chartCash'] = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: sched.map(r => `Yr ${r.year}`),
        datasets: [
          {
            label: t('Cumulative Cash In','التدفق النقدي التراكمي'),
            data,
            borderColor: CHART_COLORS.success,
            backgroundColor: CHART_COLORS.success + '22',
            fill: true,
            tension: 0.2,
          },
          {
            label: t('Initial Principal','الأصل المبدئي'),
            data: sched.map(() => 100000),
            borderColor: CHART_COLORS.danger,
            borderDash: [6, 3],
            pointRadius: 0,
          },
        ],
      },
      options: _chartOpts(),
    });
  }

  function _chartOpts({ stacked = false } = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` $${Number(ctx.raw).toLocaleString()}`
          }
        },
      },
      scales: {
        x: {
          stacked,
          grid: { color: CHART_COLORS.gridLine },
          ticks: { font: { size: 10 } },
        },
        y: {
          stacked,
          grid: { color: CHART_COLORS.gridLine },
          ticks: {
            font: { size: 10 },
            callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
          },
        },
      },
    };
  }

  /* ──────────────────────────────────────────────
     TAB 2: SENSITIVITY ANALYSIS
  ────────────────────────────────────────────── */
  function _renderSensitivityTab(tc) {
    const ar = isAr();

    // Build matrix: vary rate and LTV, compute monthly payment
    const rates = [4, 6, 8, 10, 12, 14];
    const ltvs  = [50, 60, 70, 80, 90];

    const matrix = rates.map(r =>
      ltvs.map(l => {
        const pmt = monthlyPayment(100000 * l / 100, r, _sliderVals.term);
        return Math.round(pmt);
      })
    );

    const maxVal = Math.max(...matrix.flat());
    const minVal = Math.min(...matrix.flat());

    function heatColor(val) {
      const ratio = (val - minVal) / (maxVal - minVal);
      // green (low) → amber → red (high)
      if (ratio < 0.5) {
        const g = Math.round(59 + ratio * 2 * (215 - 59));
        return `rgb(5,${g},105)`;
      } else {
        const r = Math.round(217 + (ratio - 0.5) * 2 * (220 - 217));
        const g = Math.round(119 - (ratio - 0.5) * 2 * 119);
        return `rgb(${r},${g},0)`;
      }
    }

    // Tornado chart data — impact of each slider ±1 unit change on monthly pmt
    const base  = calcMetrics(_sliderVals);
    const tornado = SLIDERS.map(s => {
      const up   = Object.assign({}, _sliderVals, { [s.key]: Math.min(s.max, _sliderVals[s.key] + s.step * 2) });
      const down = Object.assign({}, _sliderVals, { [s.key]: Math.max(s.min, _sliderVals[s.key] - s.step * 2) });
      const upM  = monthlyPayment(100000 * up.ltv / 100,   up.rate,   up.term);
      const dnM  = monthlyPayment(100000 * down.ltv / 100, down.rate, down.term);
      return { label: ar ? s.ar : s.en, key: s.key, up: upM, down: dnM, base: base.pmt, swing: Math.abs(upM - dnM) };
    }).sort((a, b) => b.swing - a.swing);

    tc.innerHTML = `
      <div class="s6-sens-grid">
        <!-- Heat map -->
        <div class="s6-sens-card s6-sens-wide">
          <div class="s6-chart-title">
            ${t('Monthly Payment Heat Map (Rate × LTV, per $100k principal)','خريطة حرارية للدفعة الشهرية (السعر × التمويل)')}
          </div>
          <div class="s6-heatmap-wrap">
            <table class="s6-heatmap">
              <thead>
                <tr>
                  <th>${t('Rate↓ LTV→','السعر↓ التمويل→')}</th>
                  ${ltvs.map(l => `<th>${l}%</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${rates.map((r, ri) => `
                  <tr>
                    <th>${r}%</th>
                    ${ltvs.map((l, li) => {
                      const val = matrix[ri][li];
                      const bg  = heatColor(val);
                      const txtColor = val > (minVal + maxVal) / 2 ? '#fff' : '#fff';
                      return `<td style="background:${bg};color:${txtColor}">\$${val.toLocaleString()}</td>`;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tornado chart -->
        <div class="s6-sens-card">
          <div class="s6-chart-title">${t('Tornado: Parameter Sensitivity','إعصار: حساسية المعاملات')}</div>
          <div class="s6-chart-wrap" style="height:200px"><canvas id="chartTornado"></canvas></div>
        </div>

        <!-- Scenario compare table -->
        <div class="s6-sens-card">
          <div class="s6-chart-title">${t('Scenario Comparison','مقارنة السيناريوهات')}</div>
          <table class="s6-table">
            <thead>
              <tr>
                <th>${t('Parameter','المعامل')}</th>
                <th>${t('Current','الحالي')}</th>
                <th>${t('Min Impact','الحد الأدنى')}</th>
                <th>${t('Max Impact','الحد الأقصى')}</th>
              </tr>
            </thead>
            <tbody>
              ${tornado.map(row => `
                <tr>
                  <td>${row.label}</td>
                  <td>$${Math.round(row.base).toLocaleString()}</td>
                  <td class="s6-td-green">$${Math.round(row.down).toLocaleString()}</td>
                  <td class="s6-td-red">$${Math.round(row.up).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    _loadChartJs(() => _drawTornado(tornado));
  }

  function _drawTornado(tornado) {
    _destroyChart('chartTornado');
    const ctx = document.getElementById('chartTornado');
    if (!ctx) return;
    const basePmt = tornado[0]?.base || 0;
    _charts['chartTornado'] = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: tornado.map(r => r.label),
        datasets: [
          {
            label: t('Decrease','انخفاض'),
            data: tornado.map(r => -(basePmt - r.down)),
            backgroundColor: CHART_COLORS.success,
          },
          {
            label: t('Increase','ارتفاع'),
            data: tornado.map(r => r.up - basePmt),
            backgroundColor: CHART_COLORS.danger,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: ctx => ` $${Math.abs(Math.round(ctx.raw)).toLocaleString()} swing`
            }
          }
        },
        scales: {
          x: {
            stacked: false,
            grid:  { color: CHART_COLORS.gridLine },
            ticks: {
              callback: v => '$' + Math.abs(v).toLocaleString(),
            },
          },
          y: { grid: { color: CHART_COLORS.gridLine } },
        },
      },
    });
  }

  /* ──────────────────────────────────────────────
     TAB 3: STRESS TEST
  ────────────────────────────────────────────── */
  function _renderStressTab(tc) {
    const ar = isAr();

    // Compute metrics per scenario
    const scenarios = STRESS_SCENARIOS.map(sc => {
      const sv = {};
      SLIDERS.forEach(s => {
        const delta = sc.deltas[s.key] || 0;
        sv[s.key] = Math.min(s.max, Math.max(s.min, (_sliderVals[s.key] || s.def) + delta));
      });
      const m = calcMetrics(sv);
      return { ...sc, sv, metrics: m };
    });

    const base = scenarios.find(s => s.id === 'base');

    tc.innerHTML = `
      <div class="s6-stress-grid">
        <!-- Scenario cards -->
        ${scenarios.map(sc => {
          const pctDiff = base ? ((sc.metrics.pmt - base.metrics.pmt) / base.metrics.pmt * 100) : 0;
          const isBase  = sc.id === 'base';
          const badge   = isBase
            ? `<span class="s6-badge s6-badge-neutral">${t('Baseline','الأساس')}</span>`
            : pctDiff >= 0
              ? `<span class="s6-badge s6-badge-danger">+${pctDiff.toFixed(1)}%</span>`
              : `<span class="s6-badge s6-badge-success">${pctDiff.toFixed(1)}%</span>`;
          return `
            <div class="s6-stress-card" style="border-top:4px solid ${sc.color}">
              <div class="s6-stress-card-hdr">
                <span class="s6-stress-scenario">${ar ? sc.ar : sc.en}</span>
                ${badge}
              </div>
              <div class="s6-stress-metrics">
                <div class="s6-sm-row">
                  <span>${t('Monthly Pmt','الدفعة')}</span>
                  <strong>$${Math.round(sc.metrics.pmt).toLocaleString()}</strong>
                </div>
                <div class="s6-sm-row">
                  <span>${t('Total Interest','الفائدة الكلية')}</span>
                  <strong>$${Math.round(sc.metrics.totalInt).toLocaleString()}</strong>
                </div>
                <div class="s6-sm-row">
                  <span>${t('APR','معدل العائد')}</span>
                  <strong>${sc.metrics.apr.toFixed(2)}%</strong>
                </div>
                <div class="s6-sm-row">
                  <span>${t('Effective Rate','المعدل الفعلي')}</span>
                  <strong>${sc.sv.rate}%</strong>
                </div>
              </div>
              <div class="s6-stress-deltas">
                ${Object.entries(sc.deltas).filter(([,v]) => v !== 0).map(([k, v]) => {
                  const sl = SLIDERS.find(s => s.key === k);
                  return `<span class="s6-delta ${v > 0 ? 'up' : 'down'}">${sl ? (ar ? sl.ar : sl.en) : k} ${v > 0 ? '+' : ''}${v}${sl?.unit || ''}</span>`;
                }).join('')}
                ${Object.values(sc.deltas).every(v => v === 0) ? `<span class="s6-delta neutral">${t('No adjustments','بدون تعديلات')}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}

        <!-- Overlay chart -->
        <div class="s6-stress-chart-card">
          <div class="s6-chart-title">${t('Scenario Amortization Overlay','تراكب مخططات الإطفاء')}</div>
          <div class="s6-chart-wrap" style="height:220px"><canvas id="chartStressOverlay"></canvas></div>
        </div>

        <!-- Risk indicator table -->
        <div class="s6-stress-risk-card">
          <div class="s6-chart-title">${t('Risk Indicators','مؤشرات المخاطر')}</div>
          <table class="s6-table">
            <thead>
              <tr>
                <th>${t('Indicator','المؤشر')}</th>
                ${scenarios.map(sc => `<th>${ar ? sc.ar.split(' ').slice(0,2).join(' ') : sc.en.split(' ').slice(0,2).join(' ')}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${[
                { label: t('DBR Ratio','نسبة العبء'), key:'dbr', fmt: v => v + '%', warn: v => v > 50 },
                { label: t('LTV Ratio','نسبة التمويل'), key:'ltv', fmt: v => v + '%', warn: v => v > 80 },
                { label: t('Rate %','سعر الفائدة'), key:'rate', fmt: v => v + '%', warn: v => v > 15 },
                { label: t('Term (yr)','المدة'), key:'term', fmt: v => v + 'yr', warn: v => v > 25 },
              ].map(ind => `
                <tr>
                  <td>${ind.label}</td>
                  ${scenarios.map(sc => {
                    const val = sc.sv[ind.key];
                    const cls = ind.warn(val) ? 's6-td-red' : 's6-td-green';
                    return `<td class="${cls}">${ind.fmt(val)}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    _loadChartJs(() => _drawStressOverlay(scenarios));
  }

  function _drawStressOverlay(scenarios) {
    _destroyChart('chartStressOverlay');
    const ctx = document.getElementById('chartStressOverlay');
    if (!ctx) return;

    const maxTerm = Math.max(...scenarios.map(sc => sc.sv.term));
    const labels  = Array.from({ length: maxTerm }, (_, i) => `Yr ${i + 1}`);

    const datasets = scenarios.map(sc => {
      const sched = amortSchedule(100000 * sc.sv.ltv / 100, sc.sv.rate, sc.sv.term);
      const balances = Array(maxTerm).fill(null);
      sched.forEach((r, i) => { balances[i] = Math.round(r.balance); });
      return {
        label: isAr() ? sc.ar : sc.en,
        data: balances,
        borderColor: sc.color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.2,
        spanGaps: false,
      };
    });

    _charts['chartStressOverlay'] = new window.Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: _chartOpts(),
    });
  }

  /* ──────────────────────────────────────────────
     TAB 4: APPROVAL MATRIX
  ────────────────────────────────────────────── */
  function _renderApprovalTab(tc) {
    const ar = isAr();
    const m  = calcMetrics(_sliderVals);

    // Overall status
    const statuses     = APPROVAL_ROLES.map(r => _approvals[r.key]);
    const allApproved  = statuses.every(s => s === 'approved');
    const anyRejected  = statuses.some(s => s === 'rejected');
    const pending      = statuses.some(s => s === null);

    let overallBadge;
    if (anyRejected)  overallBadge = `<span class="s6-badge s6-badge-danger">${t('Rejected','مرفوض')}</span>`;
    else if (allApproved) overallBadge = `<span class="s6-badge s6-badge-success">${t('Approved','موافق عليه')}</span>`;
    else overallBadge = `<span class="s6-badge s6-badge-neutral">${t('Pending','قيد المراجعة')}</span>`;

    // Pre-approval checklist
    const checks = _buildChecklist(m);
    const checksPassed = checks.filter(c => c.pass).length;

    tc.innerHTML = `
      <div class="s6-approval-grid">
        <!-- Overall status banner -->
        <div class="s6-approval-banner ${anyRejected ? 'rejected' : allApproved ? 'approved' : 'pending'}">
          <i class="fas ${anyRejected ? 'fa-times-circle' : allApproved ? 'fa-check-circle' : 'fa-clock'}"></i>
          <div>
            <strong>${t('Product Approval Status','حالة الموافقة على المنتج')}</strong>
            ${overallBadge}
          </div>
        </div>

        <!-- Pre-approval checklist -->
        <div class="s6-approval-section">
          <div class="s6-section-hdr">${t('Pre-Approval Checklist','قائمة ما قبل الموافقة')}</div>
          <div class="s6-checklist">
            ${checks.map(c => `
              <div class="s6-check-row ${c.pass ? 'pass' : 'fail'}">
                <i class="fas ${c.pass ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                <span class="s6-check-label">${c.label}</span>
                <span class="s6-check-val">${c.val}</span>
              </div>
            `).join('')}
          </div>
          <div class="s6-checklist-summary">
            ${t('Checks passed:','الاختبارات الناجحة:')} <strong>${checksPassed} / ${checks.length}</strong>
          </div>
        </div>

        <!-- Approval matrix -->
        <div class="s6-approval-section">
          <div class="s6-section-hdr">${t('Approval Matrix','مصفوفة الموافقة')}</div>
          <div class="s6-appr-matrix">
            ${APPROVAL_ROLES.map(role => {
              const status = _approvals[role.key];
              return `
                <div class="s6-appr-row">
                  <div class="s6-appr-role">
                    <i class="fas fa-user-shield"></i>
                    <span>${ar ? role.ar : role.en}</span>
                  </div>
                  <div class="s6-appr-actions">
                    <button class="pge-btn s6-appr-btn ${status === 'approved' ? 'active-approve' : ''}"
                            data-role="${role.key}" data-action="approved">
                      <i class="fas fa-check"></i> ${t('Approve','موافقة')}
                    </button>
                    <button class="pge-btn s6-appr-btn ${status === 'rejected' ? 'active-reject' : ''}"
                            data-role="${role.key}" data-action="rejected">
                      <i class="fas fa-times"></i> ${t('Reject','رفض')}
                    </button>
                    <button class="pge-btn pge-btn-ghost s6-appr-reset"
                            data-role="${role.key}" data-action="reset">
                      ${t('Reset','إعادة')}
                    </button>
                  </div>
                  <div class="s6-appr-status">
                    ${status === 'approved'
                        ? `<span class="s6-badge s6-badge-success">${t('Approved','موافق')}</span>`
                      : status === 'rejected'
                        ? `<span class="s6-badge s6-badge-danger">${t('Rejected','مرفوض')}</span>`
                        : `<span class="s6-badge s6-badge-neutral">${t('Pending','معلق')}</span>`}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Simulation summary card -->
        <div class="s6-approval-section">
          <div class="s6-section-hdr">${t('Simulation Summary for Approvers','ملخص المحاكاة للمعتمدين')}</div>
          <div class="s6-summary-grid">
            ${[
              { label: t('Interest Rate','سعر الفائدة'),  val: `${_sliderVals.rate}%` },
              { label: t('Loan Term','المدة'),             val: `${_sliderVals.term} yr` },
              { label: t('LTV Ceiling','سقف التمويل'),     val: `${_sliderVals.ltv}%` },
              { label: t('DBR Ceiling','سقف العبء'),       val: `${_sliderVals.dbr}%` },
              { label: t('Monthly Pmt','الدفعة الشهرية'),  val: `$${Math.round(m.pmt).toLocaleString()}` },
              { label: t('Total Interest','إجمالي الفائدة'), val: `$${Math.round(m.totalInt).toLocaleString()}` },
              { label: t('Eff. APR','معدل العائد الفعلي'), val: `${m.apr.toFixed(2)}%` },
              { label: t('Origination Fee','رسوم الإنشاء'), val: `${_sliderVals.fees}%` },
            ].map(r => `
              <div class="s6-sum-row">
                <span class="s6-sum-label">${r.label}</span>
                <span class="s6-sum-val">${r.val}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Wire approval buttons
    tc.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const role   = btn.dataset.role;
        const action = btn.dataset.action;
        _approvals[role] = action === 'reset' ? null : action;
        bus.emit('dirty');
        _renderApprovalTab(tc);
      });
    });
  }

  function _buildChecklist(m) {
    const ar = isAr();
    return [
      {
        label: t('Interest Rate ≤ 25%','سعر الفائدة ≤ ٢٥٪'),
        pass: _sliderVals.rate <= 25,
        val: `${_sliderVals.rate}%`,
      },
      {
        label: t('LTV ≤ 90%','نسبة التمويل ≤ ٩٠٪'),
        pass: _sliderVals.ltv <= 90,
        val: `${_sliderVals.ltv}%`,
      },
      {
        label: t('DBR ≤ 50% (CBO guideline)','نسبة العبء ≤ ٥٠٪ (إرشادات البنك المركزي)'),
        pass: _sliderVals.dbr <= 50,
        val: `${_sliderVals.dbr}%`,
      },
      {
        label: t('Origination Fee ≤ 3%','رسوم الإنشاء ≤ ٣٪'),
        pass: _sliderVals.fees <= 3,
        val: `${_sliderVals.fees}%`,
      },
      {
        label: t('Term ≤ 30 years','المدة ≤ ٣٠ سنة'),
        pass: _sliderVals.term <= 30,
        val: `${_sliderVals.term} yr`,
      },
      {
        label: t('NPV positive (lender)','القيمة الحالية موجبة'),
        pass: m.npv > 0,
        val: `$${Math.round(m.npv).toLocaleString()}`,
      },
      {
        label: t('Prepayment Penalty ≤ 3%','غرامة السداد ≤ ٣٪'),
        pass: _sliderVals.prepayment <= 3,
        val: `${_sliderVals.prepayment}%`,
      },
    ];
  }

  /* ──────────────────────────────────────────────
     AI NARRATIVE PANEL
  ────────────────────────────────────────────── */
  function _toggleAiPanel(container) {
    const panel = container.querySelector('#s6AiPanel');
    if (!panel) return;
    panel.classList.toggle('hidden');
  }

  function _hideAiPanel(container) {
    const panel = container.querySelector('#s6AiPanel');
    if (panel) panel.classList.add('hidden');
  }

  async function _generateNarrative(container) {
    const btn  = container.querySelector('#s6AiGenerate');
    const body = container.querySelector('#s6AiBody');
    if (!btn || !body) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    body.innerHTML = `<div class="s6-ai-thinking">${t('Generating narrative…','جاري توليد السرد…')}</div>`;

    const m = calcMetrics(_sliderVals);
    const pf = _calcPortfolioMetrics();
    const prompt = `
You are a senior banking product portfolio manager and risk analyst at Sohar International Bank, Oman. Generate a concise professional narrative commentary (4-5 paragraphs) for the following product — covering both single-loan risk characteristics AND portfolio-level viability:

Product: ${_prod?.name || 'Unknown'}
Target Segment: ${pf.seg} (avg loan OMR ${pf.avgLoanAmt.toLocaleString()})
Interest Rate: ${pf.productRate}%  |  NIM: ${pf.nim.toFixed(2)}%  |  Cost of Funds: ${pf.costOfFunds}%
LTV Ceiling: ${_sliderVals.ltv}%  |  DBR Ceiling: ${_sliderVals.dbr}%

PORTFOLIO PROJECTIONS:
  Year 1 Accounts: ${pf.yr1Accounts} | Portfolio: OMR ${pf.yr1Portfolio}M | NII: OMR ${Math.round(pf.yr1Income/1000)}K
  Year 2 Accounts: ${Math.round(pf.yr1Accounts*1.25)} | Portfolio: OMR ${pf.yr2Portfolio}M | NII: OMR ${Math.round(pf.yr2Income/1000)}K
  Year 3 Accounts: ${Math.round(pf.yr1Accounts*1.56)} | Portfolio: OMR ${pf.yr3Portfolio}M | NII: OMR ${Math.round(pf.yr3Income/1000)}K
  IFRS9 ECL (1.5%): OMR ${Math.round(pf.ecl1/1000)}K / ${Math.round(pf.ecl2/1000)}K / ${Math.round(pf.ecl3/1000)}K
  Net Revenue: OMR ${Math.round(pf.netRev1/1000)}K / ${Math.round(pf.netRev2/1000)}K / ${Math.round(pf.netRev3/1000)}K
  Break-even: Month ${pf.breakEvenMonth}  |  3-Year ROI: ${pf.roi3}%
  Rate Shock (+200bps): ${pf.dbrAtRisk} accounts at DBR risk

SINGLE-LOAN METRICS:
  Monthly Payment (per 100k): OMR ${Math.round(m.pmt).toLocaleString()}
  Effective APR: ${m.apr.toFixed(2)}%  |  NPV: OMR ${Math.round(m.npv).toLocaleString()}

Include: (1) portfolio viability & market positioning, (2) NIM sustainability vs CBO rate environment, (3) IFRS9 provisioning adequacy, (4) rate shock resilience, (5) recommended approval conditions with CBO regulatory citations.
${isAr() ? 'Respond in Arabic.' : 'Respond in English.'}
    `.trim();

    try {
      const res = await API.aiChat(_pid, prompt, _aiThread);
      _narrative = res.reply || res.message || '';
      _aiThread  = res.thread_id || _aiThread;

      const rendered = window.PGE.md ? window.PGE.md(_narrative) : _narrative.replace(/\n/g, '<br>');
      body.innerHTML = `<div class="s6-ai-narrative">${rendered}</div>`;
    } catch (err) {
      body.innerHTML = `<div class="s6-ai-error">${t('AI generation failed. Please retry.','فشل توليد السرد. حاول مجدداً.')}</div>`;
      console.error('[pge-stage6] AI narrative error:', err);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-magic"></i> ${t('Regenerate','إعادة توليد')}`;
    }
  }

  /* ──────────────────────────────────────────────
     SAVE & FINALIZE
  ────────────────────────────────────────────── */
  async function saveAndStay() {
    await _doSave();
    toast(t('Simulation saved.', 'تم حفظ المحاكاة.'), 'success');
  }

  async function saveAndNext() {
    // Stage 6 is the last stage — finalize
    await _finalizeProduct();
  }

  async function _doSave() {
    // pge_stage_data is a JSON blob column added in migration 0005 — stores per-stage metadata
    const payload = {
      pge_stage_data: JSON.stringify({
        version:   SIM_VERSION,
        sliders:   _sliderVals,
        approvals: _approvals,
        narrative: _narrative,
        saved_at:  new Date().toISOString(),
      }),
    };
    try {
      await API.patchProduct(_pid, payload);
    } catch (err) {
      console.warn('[pge-stage6] save error:', err);
      throw err;
    }
  }

  async function _finalizeProduct(container) {
    const checks = _buildChecklist(calcMetrics(_sliderVals));
    const failed = checks.filter(c => !c.pass);

    if (failed.length) {
      toast(t(
        `${failed.length} compliance check(s) failed. Review before finalizing.`,
        `فشل ${failed.length} اختبار امتثال. راجع قبل الإنهاء.`
      ), 'warning');
      return;
    }

    const anyRejected = APPROVAL_ROLES.some(r => _approvals[r.key] === 'rejected');
    if (anyRejected) {
      toast(t('Product has been rejected by an approver.', 'تم رفض المنتج من قبل أحد المعتمدين.'), 'error');
      return;
    }

    const allApproved = APPROVAL_ROLES.every(r => _approvals[r.key] === 'approved');
    if (!allApproved) {
      toast(t('All approvers must approve before finalizing.', 'يجب موافقة جميع المعتمدين قبل الإنهاء.'), 'warning');
      return;
    }

    try {
      await _doSave();
      await API.patchProduct(_pid, { status: 'approved', pge_stage: 6 });
      await API.snapshot(_pid, 6, {
        sliders: _sliderVals, approvals: _approvals,
        finalized_at: new Date().toISOString(),
      });
      toast(t('Product finalized and approved! 🎉', 'تم إنهاء المنتج والموافقة عليه! 🎉'), 'success');
      bus.emit('productFinalized', { productId: _pid });
      setTimeout(() => { window.location.href = '/portals/backoffice.html'; }, 2000);
    } catch (err) {
      console.error('[pge-stage6] finalize error:', err);
      toast(t('Finalize failed. Please retry.', 'فشل الإنهاء. حاول مجدداً.'), 'error');
    }
  }

  /* ──────────────────────────────────────────────
     STYLES (injected once)
  ────────────────────────────────────────────── */
  (function _injectStyles() {
    if (document.getElementById('pge-s6-styles')) return;
    const style = document.createElement('style');
    style.id = 'pge-s6-styles';
    style.textContent = `
      /* ── Stage 6 wrapper ── */
      .s6-wrapper { display:flex; flex-direction:column; gap:0; height:100%; overflow:hidden; }

      /* ── Header ── */
      .s6-header { display:flex; align-items:center; justify-content:space-between;
                   padding:12px 20px; background:#fff; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
      .s6-title  { display:flex; align-items:center; gap:8px; font-weight:700; color:#0a2342; font-size:15px; }
      .s6-title i{ color:#0e7490; }
      .s6-hdr-actions { display:flex; gap:8px; }

      /* ── KPI strip ── */
      .s6-kpi-strip { display:flex; gap:0; border-bottom:1px solid #e2e8f0; background:#f8fafc; overflow-x:auto; flex-shrink:0; }
      .s6-kpi { display:flex; flex-direction:column; align-items:center; gap:2px;
                padding:12px 18px; border-right:1px solid #e2e8f0; min-width:130px; text-align:center; }
      [dir=rtl] .s6-kpi { border-right:none; border-left:1px solid #e2e8f0; }
      .s6-kpi-icon { font-size:18px; color:#0e7490; }
      .s6-kpi-val  { font-size:16px; font-weight:700; color:#0a2342; }
      .s6-kpi-label{ font-size:11px; font-weight:600; color:#475569; }
      .s6-kpi-sub  { font-size:10px; color:#94a3b8; }

      /* ── Slider rail ── */
      .s6-slider-rail { background:#fff; border-bottom:1px solid #e2e8f0; padding:12px 20px; flex-shrink:0; }
      .s6-sliders-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px 24px; }
      .s6-slider-item { display:flex; flex-direction:column; gap:4px; }
      .s6-slider-hdr  { display:flex; justify-content:space-between; align-items:center; }
      .s6-slider-label{ font-size:11px; font-weight:600; color:#475569; }
      .s6-slider-val  { font-size:12px; font-weight:700; color:#0a2342; background:#e0f2fe;
                        padding:1px 7px; border-radius:10px; }
      .s6-range { width:100%; accent-color:#0a2342; cursor:pointer; }
      .s6-slider-bounds{ display:flex; justify-content:space-between; font-size:9px; color:#94a3b8; }

      /* ── Tab content ── */
      .s6-tab-content { flex:1; overflow-y:auto; padding:16px 20px; background:#f1f5f9; }

      /* ── Charts tab ── */
      .s6-charts-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(400px,1fr)); gap:16px; }
      .s6-chart-card  { background:#fff; border-radius:10px; padding:16px;
                        box-shadow:0 1px 4px rgba(0,0,0,.06); height:300px; display:flex; flex-direction:column; }
      .s6-chart-wrap  { position:relative; flex:1; min-height:0; }
      .s6-chart-title { font-size:12px; font-weight:700; color:#0a2342; margin-bottom:12px;
                        padding-bottom:8px; border-bottom:1px solid #e2e8f0; }

      /* ── Sensitivity tab ── */
      .s6-sens-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
      .s6-sens-wide { grid-column:1/-1; }
      .s6-sens-card { background:#fff; border-radius:10px; padding:16px;
                      box-shadow:0 1px 4px rgba(0,0,0,.06); }
      .s6-heatmap-wrap { overflow-x:auto; }
      .s6-heatmap { border-collapse:collapse; width:100%; font-size:11px; }
      .s6-heatmap th { background:#0a2342; color:#fff; padding:6px 10px; text-align:center; white-space:nowrap; }
      .s6-heatmap td { padding:6px 10px; text-align:center; font-weight:600; white-space:nowrap; }

      /* ── Shared table ── */
      .s6-table { width:100%; border-collapse:collapse; font-size:12px; }
      .s6-table th { background:#f1f5f9; color:#475569; padding:6px 10px; text-align:start;
                     font-weight:600; border-bottom:1px solid #e2e8f0; }
      .s6-table td { padding:6px 10px; border-bottom:1px solid #f1f5f9; }
      .s6-td-green  { color:#059669; font-weight:600; }
      .s6-td-red    { color:#dc2626; font-weight:600; }

      /* ── Stress tab ── */
      .s6-stress-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:16px; }
      .s6-stress-chart-card,
      .s6-stress-risk-card { grid-column:1/-1; background:#fff; border-radius:10px;
                              padding:16px; box-shadow:0 1px 4px rgba(0,0,0,.06); }
      .s6-stress-card { background:#fff; border-radius:10px; padding:16px;
                        box-shadow:0 1px 4px rgba(0,0,0,.06); }
      .s6-stress-card-hdr { display:flex; justify-content:space-between; align-items:center;
                             margin-bottom:10px; }
      .s6-stress-scenario { font-size:12px; font-weight:700; color:#0a2342; }
      .s6-stress-metrics  { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
      .s6-sm-row  { display:flex; justify-content:space-between; font-size:11px; }
      .s6-sm-row span { color:#64748b; }
      .s6-sm-row strong{ color:#0a2342; }
      .s6-stress-deltas{ display:flex; flex-wrap:wrap; gap:4px; }
      .s6-delta { font-size:10px; padding:2px 7px; border-radius:10px; font-weight:600; }
      .s6-delta.up      { background:#fef3c7; color:#92400e; }
      .s6-delta.down    { background:#d1fae5; color:#065f46; }
      .s6-delta.neutral { background:#f1f5f9; color:#64748b; }

      /* ── Approval tab ── */
      .s6-approval-grid { display:flex; flex-direction:column; gap:16px; }
      .s6-approval-banner { display:flex; align-items:center; gap:12px;
                            padding:14px 20px; border-radius:10px; font-size:14px; }
      .s6-approval-banner.pending  { background:#fef3c7; color:#92400e; }
      .s6-approval-banner.approved { background:#d1fae5; color:#065f46; }
      .s6-approval-banner.rejected { background:#fee2e2; color:#991b1b; }
      .s6-approval-banner i { font-size:24px; }
      .s6-approval-section { background:#fff; border-radius:10px; padding:16px;
                             box-shadow:0 1px 4px rgba(0,0,0,.06); }
      .s6-section-hdr { font-size:12px; font-weight:700; color:#0a2342; margin-bottom:12px;
                        padding-bottom:8px; border-bottom:1px solid #e2e8f0; }
      .s6-checklist { display:flex; flex-direction:column; gap:6px; }
      .s6-check-row { display:flex; align-items:center; gap:8px; font-size:12px; padding:6px 8px;
                      border-radius:6px; }
      .s6-check-row.pass { background:#f0fdf4; }
      .s6-check-row.fail { background:#fef2f2; }
      .s6-check-row.pass i{ color:#059669; }
      .s6-check-row.fail i{ color:#dc2626; }
      .s6-check-label { flex:1; }
      .s6-check-val   { font-weight:700; color:#0a2342; }
      .s6-checklist-summary { margin-top:8px; font-size:12px; color:#475569; text-align:end; }

      .s6-appr-matrix { display:flex; flex-direction:column; gap:8px; }
      .s6-appr-row    { display:flex; align-items:center; gap:12px; padding:10px;
                        border:1px solid #e2e8f0; border-radius:8px; }
      .s6-appr-role   { display:flex; align-items:center; gap:8px; font-size:12px;
                        font-weight:600; color:#0a2342; min-width:160px; }
      .s6-appr-role i { color:#0e7490; }
      .s6-appr-actions{ display:flex; gap:6px; flex:1; }
      .s6-appr-btn { padding:5px 12px; border:1px solid #e2e8f0; border-radius:6px;
                     background:#fff; cursor:pointer; font-size:11px; font-weight:600; transition:all .2s; }
      .s6-appr-btn:hover { border-color:#0e7490; }
      .s6-appr-btn.active-approve { background:#d1fae5; border-color:#059669; color:#065f46; }
      .s6-appr-btn.active-reject  { background:#fee2e2; border-color:#dc2626; color:#991b1b; }
      .s6-appr-reset { font-size:10px; }
      .s6-appr-status { min-width:100px; text-align:center; }

      .s6-summary-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
      .s6-sum-row  { display:flex; justify-content:space-between; font-size:12px;
                     padding:6px 8px; background:#f8fafc; border-radius:6px; }
      .s6-sum-label{ color:#64748b; }
      .s6-sum-val  { font-weight:700; color:#0a2342; }

      /* ── Badges ── */
      .s6-badge { display:inline-flex; align-items:center; padding:2px 9px;
                  border-radius:10px; font-size:11px; font-weight:700; }
      .s6-badge-success { background:#d1fae5; color:#065f46; }
      .s6-badge-danger  { background:#fee2e2; color:#991b1b; }
      .s6-badge-neutral { background:#e2e8f0; color:#475569; }

      /* ── AI Panel ── */
      .s6-ai-panel { position:fixed; inset-inline-end:20px; top:80px; width:380px; max-height:70vh;
                     background:#fff; border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,.15);
                     display:flex; flex-direction:column; z-index:1000; }
      .s6-ai-panel.hidden { display:none; }
      .s6-ai-panel-hdr { display:flex; align-items:center; justify-content:space-between;
                          padding:12px 16px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:700; }
      .s6-ai-body { flex:1; overflow-y:auto; padding:16px; font-size:13px; line-height:1.6; }
      .s6-ai-footer { padding:12px 16px; border-top:1px solid #e2e8f0; }
      .s6-ai-placeholder, .s6-ai-thinking { color:#94a3b8; font-style:italic; }
      .s6-ai-narrative { color:#1e293b; }
      .s6-ai-narrative p { margin-bottom:8px; }
      .s6-ai-error { color:#dc2626; }

      /* ── Save bar ── */
      .s6-save-bar { display:flex; justify-content:flex-end; gap:10px;
                     padding:12px 20px; background:#fff; border-top:1px solid #e2e8f0; flex-shrink:0; }

      /* ── Portfolio Simulation tab ── */
      .s6-portfolio-wrap { display:flex; flex-direction:column; gap:16px; }
      .s6-port-header    { display:flex; align-items:center; gap:12px; background:#fff;
                           border-radius:10px; padding:14px 20px; box-shadow:0 1px 4px rgba(0,0,0,.06); flex-wrap:wrap; }
      .s6-port-seg-badge { display:flex; align-items:center; gap:8px; color:#fff; font-weight:700;
                           font-size:13px; padding:7px 16px; border-radius:8px; white-space:nowrap; }
      .s6-port-meta      { display:flex; flex-wrap:wrap; gap:16px; font-size:12px; color:#475569; }
      .s6-port-meta strong { color:#0a2342; }
      .s6-port-section   { background:#fff; border-radius:10px; padding:16px 20px;
                           box-shadow:0 1px 4px rgba(0,0,0,.06); }

      /* Pipeline funnel */
      .s6-port-pipeline  { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:8px 0; }
      .s6-pipe-step      { display:flex; flex-direction:column; align-items:center; gap:4px;
                           min-width:130px; text-align:center; }
      .s6-pipe-highlight { border:2px solid #f59e0b; border-radius:10px; padding:8px; }
      .s6-pipe-icon      { width:44px; height:44px; border-radius:50%; display:flex;
                           align-items:center; justify-content:center; font-size:18px; }
      .s6-pipe-val       { font-size:20px; font-weight:800; color:#0a2342; }
      .s6-pipe-label     { font-size:11px; font-weight:700; color:#0a2342; }
      .s6-pipe-sub       { font-size:10px; color:#94a3b8; }
      .s6-pipe-arrow     { display:flex; flex-direction:column; align-items:center; color:#94a3b8;
                           font-size:14px; gap:2px; }
      .s6-pipe-arrow span{ font-size:10px; font-weight:700; color:#0e7490; background:#e0f2fe;
                           padding:2px 7px; border-radius:10px; }

      /* Year cards */
      .s6-port-growth-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
      .s6-yr-card        { border:1px solid #e2e8f0; border-radius:10px; padding:14px;
                           display:flex; flex-direction:column; gap:6px; }
      .s6-yr-label       { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.05em; }
      .s6-yr-portfolio   { font-size:22px; font-weight:800; color:#0a2342; }
      .s6-yr-accounts    { font-size:11px; color:#0e7490; font-weight:600; }
      .s6-yr-metrics     { display:flex; flex-direction:column; gap:3px; margin-top:4px;
                           padding-top:8px; border-top:1px solid #f1f5f9; }
      .s6-yr-row         { display:flex; justify-content:space-between; font-size:11px; }
      .s6-yr-row span:first-child { color:#64748b; }
      .s6-yr-net-row     { background:#f8fafc; border-radius:5px; padding:3px 6px; font-weight:700; }
      .s6-yr-pos         { color:#059669; font-weight:600; }
      .s6-yr-neg         { color:#dc2626; font-weight:600; }

      /* P&L section */
      .s6-port-pl-section { display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start; }
      .s6-port-pl-left   {}
      .s6-port-pl-right  { display:flex; flex-direction:column; }
      .s6-pl-table       {}
      .s6-pl-row-net td  { font-weight:700; border-top:2px solid #e2e8f0; background:#f8fafc; }
      .s6-pl-row-nim td  { font-weight:600; border-top:1px solid #e2e8f0; background:#f0f9ff; color:#0369a1; }
      .s6-pl-row-cost td { color:#dc2626; }
      .s6-neg-sign       { color:#dc2626; }

      /* Summary cards row */
      .s6-port-summary-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
      .s6-port-summary-card { border:1px solid #e2e8f0; border-radius:10px; padding:16px;
                              display:flex; flex-direction:column; gap:8px; }
      .s6-breakeven-big  { font-size:40px; font-weight:800; color:#0a2342; line-height:1; }
      .s6-breakeven-label{ font-size:11px; color:#64748b; }
      .s6-roi-big        { font-size:40px; font-weight:800; color:#64748b; line-height:1; }
      .s6-roi-big.s6-roi-pos { color:#059669; }
      .s6-port-summary-rows { display:flex; flex-direction:column; gap:4px; margin-top:4px; }
      .s6-stress-card-port { border-top:4px solid #dc2626; }
      .s6-stress-rate-row  { display:flex; align-items:center; gap:16px; padding:8px 0; }
      .s6-stress-label    { font-size:10px; color:#64748b; }
      .s6-stress-val      { font-size:20px; font-weight:700; color:#0a2342; }
      .s6-stress-val-red  { color:#dc2626; }
      .s6-stress-arrow    { font-size:16px; color:#64748b; }

      /* ── Responsive ── */
      @media (max-width:768px) {
        .s6-charts-grid { grid-template-columns:1fr; }
        .s6-sens-grid   { grid-template-columns:1fr; }
        .s6-stress-grid { grid-template-columns:1fr; }
        .s6-stress-chart-card, .s6-stress-risk-card { grid-column:auto; }
        .s6-appr-row    { flex-wrap:wrap; }
        .s6-summary-grid{ grid-template-columns:1fr; }
        .s6-kpi-strip   { overflow-x:auto; }
        .s6-ai-panel    { inset-inline-end:0; top:0; width:100vw; height:100vh; max-height:100vh; border-radius:0; }
        .s6-port-growth-grid { grid-template-columns:1fr; }
        .s6-port-pl-section  { grid-template-columns:1fr; }
        .s6-port-summary-grid{ grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(style);
  })();

  /* ──────────────────────────────────────────────
     EXPORT
  ────────────────────────────────────────────── */
  window.PGEStage6 = {
    mount,
    _tab: _renderTab,
    _calcMetrics: calcMetrics,
    _calcPortfolioMetrics,
    _generateNarrative,
    saveAndStay,
    saveAndNext,
  };

})();
