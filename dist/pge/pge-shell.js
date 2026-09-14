/* ============================================================
   pge-shell.js — PGE shell: init, routing, stepper, save
   Depends on: pge-shared.js (window.PGE)
   ============================================================ */
(function () {
  'use strict';
  const { state, API, toast, t, isAr, STAGES, bus } = window.PGE;

  /* ── Map stage id → module ── */
  const STAGE_MODULES = {
    1: window.PGEStage1,
    2: window.PGEStage2,
    3: window.PGEStage3,
    4: window.PGEStage4,
    5: window.PGEStage5,
    6: window.PGEStage6,
  };

  /* ── Init ── */
  async function init() {
    const params = new URLSearchParams(location.search);
    state.productId = params.get('id');
    if (!state.productId) {
      showError('No product ID provided.');
      return;
    }

    try {
      const [pRes, mRes] = await Promise.all([
        API.getProduct(state.productId),
        API.getMarket(),
      ]);
      state.product = pRes.product;
      state.market  = mRes.market;
    } catch (e) {
      showError('Failed to load product: ' + e.message);
      return;
    }

    // Restore last stage or default to 1
    state.currentStage = state.product.pge_stage || 1;
    if (state.currentStage < 1) state.currentStage = 1;

    renderTopbarProduct();
    renderMarketBadge();
    renderStepper();
    renderRail();
    hideLoading();
    await mountStage(state.currentStage);

    // Mount AI drawer
    if (window.PGEAIDrawer) PGEAIDrawer.mount(document.getElementById('aiDrawerMount'));

    // Listen for dirty flag from stage modules
    bus.on('dirty', () => {
      state.dirty = true;
      document.getElementById('saveBtn')?.classList.add('pge-btn-dirty');
    });
    bus.on('saved', () => {
      state.dirty = false;
      document.getElementById('saveBtn')?.classList.remove('pge-btn-dirty');
    });
  }

  /* ── Topbar ── */
  function renderTopbarProduct() {
    const p = state.product;
    document.getElementById('topbarProductName').textContent = p?.name || '—';
    document.getElementById('topbarProductCode').textContent = p?.code || '';
    document.title = `PGE — ${p?.name || 'Product'} | Sohar International`;
  }

  function renderMarketBadge() {
    const m = state.market;
    if (!m) return;
    const flag = getFlagEmoji(m.country_code);
    const name = isAr() ? (m.name_ar || m.name) : m.name;
    document.getElementById('pgeMarketBadge').innerHTML =
      `${flag} <strong>${name}</strong> · ${m.currency_code} · ${m.regulator_name}`;
  }

  function getFlagEmoji(code) {
    if (!code || code.length !== 2) return '🏳';
    return code.toUpperCase().split('').map(c =>
      String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
    ).join('');
  }

  /* ── Stepper (topbar) ── */
  function renderStepper() {
    const container = document.getElementById('pgeStepper');
    const maxReached = state.product?.pge_stage || 0;
    container.innerHTML = STAGES.map((s, idx) => {
      const done   = s.id <= maxReached && s.id !== state.currentStage;
      const active = s.id === state.currentStage;
      const cls    = active ? 'active' : done ? 'completed' : '';
      const label  = isAr() ? s.ar : s.en;
      const connector = idx < STAGES.length - 1
        ? '<div class="pge-step-connector" aria-hidden="true"></div>' : '';
      return `<button class="pge-step ${cls}" onclick="PGEShell.goToStage(${s.id})"
                aria-label="Stage ${s.id}: ${label}" aria-current="${active ? 'step' : 'false'}">
          <span class="pge-step-num">${done ? '<i class="fas fa-check" style="font-size:.55rem"></i>' : s.id}</span>
          <span>${label}</span>
        </button>${connector}`;
    }).join('');
  }

  /* ── Left rail ── */
  function renderRail() {
    const container = document.getElementById('pgeRailInner');
    const maxReached = state.product?.pge_stage || 0;
    const p = state.product;
    container.innerHTML = `
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;
          color:#6c757d;margin-bottom:.75rem;padding:0 .25rem">
        ${t('Configuration', 'الإعداد')}
      </div>
      ${STAGES.map(s => {
        const done   = s.id <= maxReached && s.id !== state.currentStage;
        const active = s.id === state.currentStage;
        const locked = s.id > maxReached + 1;
        const cls    = active ? 'active' : done ? 'completed' : '';
        const label  = isAr() ? s.ar : s.en;
        return `<div class="pge-rail-stage ${cls}" onclick="PGEShell.goToStage(${s.id})"
              style="${locked ? 'opacity:.45;pointer-events:none' : ''}">
            <div class="pge-rail-icon"><i class="fas ${s.icon}" style="font-size:.7rem;color:inherit"></i></div>
            <div class="pge-rail-label">${label}</div>
            ${done ? '<i class="fas fa-check-circle pge-rail-check"></i>' : ''}
          </div>`;
      }).join('')}
      <hr class="pge-rail-divider">
      <div style="font-size:.7rem;color:#6c757d;padding:0 .25rem;line-height:1.5">
        <div style="font-weight:600;color:#003B5C;margin-bottom:.25rem">${p?.name || ''}</div>
        <div>${p?.code || ''}</div>
        <div style="margin-top:.4rem">
          <span class="pge-badge ${p?.status==='active'?'pge-badge-active':'pge-badge-draft'}">
            ${t(p?.status || 'draft', p?.status==='active'?'نشط':'مسودة')}
          </span>
        </div>
      </div>`;
  }

  /* ── Stage mounting ── */
  async function mountStage(stageId) {
    state.currentStage = stageId;
    renderStepper();
    renderRail();

    const mount = document.getElementById('stageMount');
    mount.innerHTML = '';

    const mod = STAGE_MODULES[stageId];
    if (mod && typeof mod.mount === 'function') {
      await mod.mount(mount, { product: state.product, market: state.market, productId: state.productId });
    } else {
      mount.innerHTML = renderComingSoon(stageId);
    }

    // Notify AI drawer of stage change
    bus.emit('stageChanged', { stageId, product: state.product });
  }

  function renderComingSoon(stageId) {
    const s = STAGES.find(x => x.id === stageId) || {};
    return `<div class="stage-content">
      <div class="stage-header">
        <h2>${isAr() ? s.ar : s.en}</h2>
        <p>${t('This stage will be available in an upcoming sprint.','هذه المرحلة ستكون متاحة في تحديث قادم.')}</p>
      </div>
      <div class="pge-card" style="border:2px dashed #e9ecef">
        <div class="pge-card-body" style="text-align:center;padding:3rem;color:#6c757d">
          <i class="fas ${s.icon || 'fa-clock'}" style="font-size:2.5rem;opacity:.3;display:block;margin-bottom:1rem"></i>
          <div style="font-size:.9rem;font-weight:600">${t('Coming soon','قريبًا')}</div>
          <div style="font-size:.78rem;margin-top:.4rem">Stage ${stageId} of 6</div>
        </div>
      </div>
    </div>`;
  }

  /* ── Navigation ── */
  async function goToStage(stageId) {
    if (state.dirty) {
      const ok = confirm(t('You have unsaved changes. Leave without saving?', 'لديك تغييرات غير محفوظة. هل تريد المغادرة دون حفظ؟'));
      if (!ok) return;
    }
    await mountStage(stageId);
  }

  /* ── Save ── */
  async function save() {
    bus.emit('requestSave', {});
  }

  /* ── Version history modal ── */
  async function openVersions() {
    const modal = document.getElementById('pgeModal');
    modal.innerHTML = `<div class="pge-modal-overlay" onclick="this.parentElement.innerHTML=''">
      <div class="pge-modal" onclick="event.stopPropagation()" style="max-width:480px">
        <div class="pge-modal-header">
          <h3>${t('Version History','سجل الإصدارات')}</h3>
          <button class="pge-btn pge-btn-ghost pge-btn-sm" onclick="document.getElementById('pgeModal').innerHTML=''">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="pge-modal-body" id="versionsBody">
          <div style="text-align:center;padding:2rem;color:#6c757d"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
      </div>
    </div>`;

    // add modal styles inline if not already present
    if (!document.getElementById('pgeModalStyle')) {
      const s = document.createElement('style');
      s.id = 'pgeModalStyle';
      s.textContent = `.pge-modal-overlay{position:fixed;inset:0;background:rgba(0,59,92,.45);
        z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem}
        .pge-modal{background:white;border-radius:16px;width:100%;max-height:80vh;
        display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25)}
        .pge-modal-header{padding:1rem 1.25rem;border-bottom:1px solid #e9ecef;
        display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
        .pge-modal-header h3{margin:0;font-size:.95rem;font-weight:700;color:#003B5C}
        .pge-modal-body{padding:1.125rem;overflow-y:auto;flex:1}`;
      document.head.appendChild(s);
    }

    try {
      const d = await API.getVersions(state.productId);
      const versions = d.versions || [];
      const vb = document.getElementById('versionsBody');
      if (!versions.length) {
        vb.innerHTML = `<div style="text-align:center;padding:2rem;color:#6c757d;font-size:.85rem">
          ${t('No versions yet. Save progress to create the first snapshot.','لا توجد إصدارات بعد.')}</div>`;
        return;
      }
      vb.innerHTML = versions.map(v => `
        <div class="version-item">
          <div style="font-size:.8rem;font-weight:600;color:#003B5C">${v.commit_message || t('Snapshot','لقطة')}</div>
          <div class="version-meta">
            ${t('Stage','مرحلة')} ${v.stage} · v${v.version_number} · ${v.created_by_name || v.created_by} · ${fmtDate(v.created_at)}
          </div>
        </div>`).join('');
    } catch (e) {
      document.getElementById('versionsBody').innerHTML =
        `<div style="color:#BD3B4B;font-size:.82rem;padding:1rem">${e.message}</div>`;
    }
  }

  function fmtDate(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    return isNaN(d) ? dt : d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  /* ── Language toggle ── */
  function toggleLang() {
    const { lang } = window.PGE;
    lang.current = lang.current === 'en' ? 'ar' : 'en';
    const isAr = lang.current === 'ar';
    document.documentElement.setAttribute('lang', isAr ? 'ar' : 'en');
    document.documentElement.setAttribute('dir', isAr ? 'rtl' : 'ltr');
    document.getElementById('langToggleBtn').textContent = isAr ? 'EN' : 'ع';
    renderStepper();
    renderRail();
    renderMarketBadge();
    bus.emit('langChanged', { lang: lang.current });
  }

  /* ── AI toggle ── */
  function toggleAI() {
    state.aiOpen = !state.aiOpen;
    const drawer = document.getElementById('pgeAiDrawer');
    const btn    = document.getElementById('aiToggleBtn');
    drawer.classList.toggle('open', state.aiOpen);
    btn.classList.toggle('active', state.aiOpen);
  }

  /* ── Loading overlay ── */
  function hideLoading() {
    const el = document.getElementById('pgeLoadingOverlay');
    if (el) el.style.display = 'none';
  }

  function showError(msg) {
    const el = document.getElementById('pgeLoadingOverlay');
    if (el) el.innerHTML = `<i class="fas fa-triangle-exclamation" style="font-size:2rem;color:#BD3B4B"></i><span>${msg}</span>`;
  }

  /* ── Public API ── */
  window.PGEShell = { init, goToStage, save, openVersions, toggleLang, toggleAI };

  /* ── Auto-init on DOM ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
