/* ============================================================
   pge-stage5.js — Stage 5: Compliance Mapping
   Tag library browser · product mapping · gap analysis
   Exports: window.PGEStage5.mount(container, ctx)
   ============================================================ */
(function () {
  'use strict';
  const { state, API, toast, t, isAr, bus } = window.PGE;

  let _container = null;
  let _productId = null;
  let _product   = null;
  let _allTags   = [];     // full library for this market
  let _mapped    = [];     // tags already on this product
  let _gap       = null;   // gap analysis result
  let _activeTab = 'mapped';  // 'mapped' | 'library' | 'gap'

  const SEV_META = {
    mandatory:   { bg:'#fdf2f3', color:'#BD3B4B', label:'Mandatory',   labelAr:'إلزامي' },
    recommended: { bg:'#fef9ee', color:'#9B6A13', label:'Recommended', labelAr:'موصى به' },
    optional:    { bg:'#eaf5f4', color:'#007F86', label:'Optional',    labelAr:'اختياري' },
  };

  const CAT_ICONS = {
    credit:     'fa-chart-bar',
    esg:        'fa-leaf',
    aml:        'fa-shield-halved',
    disclosure: 'fa-file-lines',
    consumer:   'fa-user-shield',
    general:    'fa-tag',
  };

  /* ── Mount ── */
  async function mount(container, ctx) {
    _container = container;
    _productId = ctx.productId;
    _product   = ctx.product;

    renderSkeleton();
    await Promise.all([ loadLibrary(), loadMapped(), loadGap() ]);
    renderFull();

    bus.on('requestSave', doSave);
    bus.on('langChanged', () => renderFull());
  }

  async function loadLibrary() {
    try {
      const marketId = _product?.market_id || 'mkt001';
      const d = await fetch(`/api/v1/compliance-tags?market_id=${marketId}`).then(r=>r.json());
      _allTags = d.tags || [];
    } catch(_) { _allTags = []; }
  }

  async function loadMapped() {
    try {
      const d = await fetch(`/api/v1/compliance-tags/product/${_productId}`).then(r=>r.json());
      _mapped = d.tags || [];
    } catch(_) { _mapped = []; }
  }

  async function loadGap() {
    try {
      const d = await fetch(`/api/v1/compliance-tags/product/${_productId}/gap-analysis`).then(r=>r.json());
      _gap = d;
    } catch(_) { _gap = null; }
  }

  function renderSkeleton() {
    _container.innerHTML = `<div class="stage-content">
      <div class="pge-loading" style="height:300px">
        <i class="fas fa-spinner fa-spin"></i><span>${t('Loading compliance data…','جارٍ تحميل بيانات الامتثال…')}</span>
      </div></div>`;
  }

  /* ── Full render ── */
  function renderFull() {
    if (!_container) return;
    const covPct = _gap?.coverage_pct ?? null;

    _container.innerHTML = `
      <div class="stage-content">
        <div class="stage-header">
          <h2>${t('Compliance Mapping','رسم الامتثال')}</h2>
          <p>${t(
            'Map regulatory compliance tags to this product, review mandatory requirements, and identify gaps.',
            'ربط علامات الامتثال التنظيمي بهذا المنتج ومراجعة المتطلبات الإلزامية وتحديد الثغرات.'
          )}</p>
        </div>

        <!-- Coverage summary banner -->
        ${covPct !== null ? `
        <div style="display:flex;align-items:center;gap:1rem;background:white;border:1px solid #e9ecef;
            border-radius:12px;padding:.875rem 1rem;margin-bottom:1rem;flex-wrap:wrap">
          <div style="flex:1;min-width:180px">
            <div style="font-size:.75rem;color:#6c757d;margin-bottom:.3rem">${t('Compliance Coverage','تغطية الامتثال')}</div>
            <div style="height:8px;background:#e9ecef;border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${covPct}%;background:${covPct>=100?'#16845B':covPct>=70?'#9B6A13':'#BD3B4B'};border-radius:4px;transition:width .4s"></div>
            </div>
          </div>
          <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
            <div style="text-align:center">
              <div style="font-size:1.1rem;font-weight:700;color:#16845B">${_mapped.length}</div>
              <div style="font-size:.7rem;color:#6c757d">${t('Mapped','مرتبطة')}</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:1.1rem;font-weight:700;color:${(_gap?.gaps_count||0)>0?'#BD3B4B':'#16845B'}">${_gap?.gaps_count||0}</div>
              <div style="font-size:.7rem;color:#6c757d">${t('Gaps','ثغرات')}</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:1.1rem;font-weight:700;color:#003B5C">${Math.round(covPct)}%</div>
              <div style="font-size:.7rem;color:#6c757d">${t('Coverage','التغطية')}</div>
            </div>
          </div>
        </div>` : ''}

        <!-- Tabs -->
        <div class="s3-tabs" id="s5Tabs">
          ${tab('mapped',  'fa-link',            t('Mapped Tags','العلامات المرتبطة'), _mapped.length)}
          ${tab('library', 'fa-book',            t('Tag Library','مكتبة العلامات'),   _allTags.length)}
          ${tab('gap',     'fa-triangle-exclamation', t('Gap Analysis','تحليل الثغرات'), _gap?.gaps_count||0)}
        </div>

        <div id="s5Content"></div>
      </div>`;

    ensureTabStyles();
    switchTab(_activeTab);
  }

  function tab(id, icon, label, count) {
    const a = _activeTab === id;
    return `<button class="s3-tab ${a?'active':''}" onclick="PGEStage5._tab('${id}')">
      <i class="fas ${icon}"></i> ${label}
      <span class="s3-tab-count">${count}</span>
    </button>`;
  }

  function ensureTabStyles() {
    if (document.getElementById('s3style')) return; // reuse Stage 3 styles
    if (document.getElementById('s5style')) return;
    const s = document.createElement('style'); s.id = 's5style';
    s.textContent = `.s3-tabs{display:flex;gap:.25rem;background:white;padding:.5rem;border-radius:12px;
      border:1px solid #e9ecef;margin-bottom:1rem}
      .s3-tab{display:flex;align-items:center;gap:.4rem;padding:.45rem .85rem;border-radius:9px;
        border:none;background:transparent;font-size:.78rem;font-weight:500;color:#6c757d;cursor:pointer;transition:all .18s}
      .s3-tab:hover{background:#f8f9fa;color:#003B5C}
      .s3-tab.active{background:#003B5C;color:white}
      .s3-tab-count{background:rgba(255,255,255,.25);color:inherit;padding:.1rem .4rem;border-radius:5px;font-size:.68rem;font-weight:700}
      .s3-tab:not(.active) .s3-tab-count{background:#e9ecef;color:#6c757d}`;
    document.head.appendChild(s);
  }

  function _tab(id) {
    _activeTab = id;
    const tabs = document.getElementById('s5Tabs');
    if (tabs) tabs.innerHTML =
      tab('mapped','fa-link',t('Mapped Tags','العلامات المرتبطة'),_mapped.length) +
      tab('library','fa-book',t('Tag Library','مكتبة العلامات'),_allTags.length) +
      tab('gap','fa-triangle-exclamation',t('Gap Analysis','تحليل الثغرات'),_gap?.gaps_count||0);
    switchTab(id);
  }

  function switchTab(id) {
    const el = document.getElementById('s5Content');
    if (!el) return;
    if (id === 'mapped')  el.innerHTML = renderMappedTab();
    if (id === 'library') el.innerHTML = renderLibraryTab();
    if (id === 'gap')     el.innerHTML = renderGapTab();
  }

  /* ── Tab: Mapped ── */
  function renderMappedTab() {
    const footer = stageFooter();
    if (!_mapped.length) return `
      <div class="pge-card">
        <div class="pge-card-body" style="text-align:center;padding:2.5rem;color:#6c757d">
          <i class="fas fa-link" style="font-size:2rem;opacity:.25;display:block;margin-bottom:.75rem"></i>
          <div style="font-size:.85rem;font-weight:600">${t('No tags mapped yet.','لا توجد علامات مرتبطة بعد.')}</div>
          <div style="font-size:.78rem;margin-top:.4rem">${t('Browse the Tag Library to add compliance requirements.','تصفح مكتبة العلامات لإضافة متطلبات الامتثال.')}</div>
          <button class="pge-btn pge-btn-primary pge-btn-sm" style="margin-top:1rem"
            onclick="PGEStage5._tab('library')">${t('Browse Library','تصفح المكتبة')}</button>
        </div>
      </div>${footer}`;

    const grouped = groupByCategory(_mapped);
    return `
      <div class="pge-card">
        <div class="pge-card-header">
          <h3><i class="fas fa-link" style="color:#007F86;margin-right:.4rem"></i>
            ${t('Mapped Compliance Tags','علامات الامتثال المرتبطة')} (${_mapped.length})
          </h3>
        </div>
        <div class="pge-card-body">
          ${Object.entries(grouped).map(([cat, tags]) => `
            <div style="margin-bottom:1rem">
              <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.5rem">
                <i class="fas ${CAT_ICONS[cat]||'fa-tag'}" style="font-size:.75rem;color:#007F86"></i>
                <span style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#6c757d;letter-spacing:.3px">${cat}</span>
              </div>
              ${tags.map(tg => renderTagRow(tg, true)).join('')}
            </div>`).join('')}
        </div>
      </div>${footer}`;
  }

  /* ── Tab: Library ── */
  function renderLibraryTab() {
    const mappedIds = new Set(_mapped.map(t => t.id));
    const grouped = groupByCategory(_allTags);
    return `
      <div class="pge-card">
        <div class="pge-card-header">
          <h3><i class="fas fa-book" style="color:#007F86;margin-right:.4rem"></i>
            ${t('Compliance Tag Library','مكتبة علامات الامتثال')} (${_allTags.length})
          </h3>
          <button class="pge-btn pge-btn-primary pge-btn-sm" onclick="PGEStage5._mapSelected()">
            <i class="fas fa-link"></i> ${t('Map Selected','ربط المحددة')}
          </button>
        </div>
        <div class="pge-card-body">
          ${Object.entries(grouped).map(([cat, tags]) => `
            <div style="margin-bottom:1rem">
              <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.5rem">
                <i class="fas ${CAT_ICONS[cat]||'fa-tag'}" style="font-size:.75rem;color:#007F86"></i>
                <span style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:#6c757d;letter-spacing:.3px">${cat}</span>
              </div>
              ${tags.map(tg => renderTagRow(tg, false, mappedIds.has(tg.id))).join('')}
            </div>`).join('')}
        </div>
      </div>${stageFooter()}`;
  }

  /* ── Tab: Gap Analysis ── */
  function renderGapTab() {
    if (!_gap) return `<div class="pge-card"><div class="pge-card-body" style="text-align:center;padding:2rem;color:#6c757d">
      ${t('Gap analysis unavailable.','تحليل الثغرات غير متاح.')}</div></div>${stageFooter()}`;

    const { gaps = [], gaps_count = 0, covered_count = 0, total_applicable = 0, coverage_pct = 0 } = _gap;
    const allGood = gaps_count === 0;
    return `
      <div class="pge-card">
        <div class="pge-card-header">
          <h3><i class="fas fa-triangle-exclamation" style="color:${allGood?'#16845B':'#BD3B4B'};margin-right:.4rem"></i>
            ${t('Gap Analysis','تحليل الثغرات')}
          </h3>
          <button class="pge-btn pge-btn-outline pge-btn-sm" onclick="PGEStage5._remapAll()">
            <i class="fas fa-rotate"></i> ${t('Refresh','تحديث')}
          </button>
        </div>
        <div class="pge-card-body">
          ${allGood ? `
          <div style="display:flex;align-items:center;gap:.75rem;padding:1rem;background:#e8f7f0;
              border-radius:10px;border:1px solid #b7dfce;margin-bottom:1rem">
            <i class="fas fa-check-circle" style="font-size:1.5rem;color:#16845B;flex-shrink:0"></i>
            <div>
              <div style="font-weight:600;color:#16845B;font-size:.88rem">${t('All mandatory tags are mapped!','جميع العلامات الإلزامية مرتبطة!')}</div>
              <div style="font-size:.75rem;color:#16845B;margin-top:.15rem">${covered_count}/${total_applicable} ${t('applicable tags covered.','علامة قابلة للتطبيق مغطاة.')}</div>
            </div>
          </div>` : `
          <div style="font-size:.78rem;color:#6c757d;margin-bottom:.875rem">
            <strong style="color:#BD3B4B">${gaps_count}</strong> ${t('mandatory tag(s) not yet mapped for this product:','علامة إلزامية لم تُربط بعد بهذا المنتج:')}
          </div>
          ${gaps.map(tg => `
            <div style="display:flex;align-items:flex-start;gap:.75rem;padding:.7rem .875rem;
                border-radius:10px;background:#fff8f8;border:1px solid #e8b4ba;margin-bottom:.4rem">
              <i class="fas fa-xmark-circle" style="color:#BD3B4B;margin-top:.1rem;flex-shrink:0"></i>
              <div style="flex:1">
                <div style="font-size:.82rem;font-weight:600;color:#003B5C">${esc(isAr()?(tg.name_ar||tg.name):tg.name)}</div>
                <div style="font-size:.72rem;color:#6c757d;margin-top:.1rem">${esc(tg.code)} · ${tg.category}</div>
                ${tg.description ? `<div style="font-size:.72rem;color:#495057;margin-top:.2rem">${esc(isAr()?(tg.description_ar||tg.description):tg.description)}</div>` : ''}
              </div>
              <button class="pge-btn pge-btn-success pge-btn-sm"
                onclick="PGEStage5._mapSingle('${tg.id}')">
                <i class="fas fa-plus"></i> ${t('Map','ربط')}
              </button>
            </div>`).join('')}
          `}
        </div>
      </div>${stageFooter()}`;
  }

  /* ── Tag row ── */
  function renderTagRow(tg, canUnmap, alreadyMapped = false) {
    const sev = SEV_META[tg.severity] || SEV_META.optional;
    const name = isAr() ? (tg.name_ar || tg.name) : tg.name;
    const desc = isAr() ? (tg.description_ar || tg.description) : tg.description;
    return `
      <div style="display:flex;align-items:flex-start;gap:.625rem;padding:.6rem .75rem;
          border-radius:9px;border:1px solid #e9ecef;background:white;margin-bottom:.3rem">
        ${!canUnmap ? `<input type="checkbox" class="lib-tag-cb" data-id="${tg.id}"
          ${alreadyMapped?'checked disabled':''} style="margin-top:.2rem;flex-shrink:0">` : ''}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
            <span style="font-size:.8rem;font-weight:600;color:#003B5C">${esc(name)}</span>
            <span style="font-size:.65rem;font-family:monospace;color:#6c757d">${esc(tg.code)}</span>
            <span style="font-size:.65rem;font-weight:600;padding:.1rem .38rem;border-radius:5px;
              background:${sev.bg};color:${sev.color}">${isAr()?(sev.labelAr||sev.label):sev.label}</span>
          </div>
          ${desc ? `<div style="font-size:.72rem;color:#6c757d;margin-top:.2rem">${esc(desc)}</div>` : ''}
          ${tg.regulatory_reference ? `<div style="font-size:.68rem;color:#007F86;margin-top:.1rem">
            <i class="fas fa-landmark" style="font-size:.6rem"></i> ${esc(tg.regulatory_reference)}</div>` : ''}
        </div>
        ${canUnmap ? `<button class="pge-btn pge-btn-ghost pge-btn-sm" style="color:#BD3B4B;padding:.2rem .45rem"
          onclick="PGEStage5._unmap('${tg.id}')" title="${t('Remove','إزالة')}">
          <i class="fas fa-unlink" style="font-size:.7rem"></i>
        </button>` : alreadyMapped ? `<span style="font-size:.68rem;color:#16845B;flex-shrink:0">
          <i class="fas fa-check-circle"></i> ${t('Mapped','مرتبطة')}
        </span>` : ''}
      </div>`;
  }

  /* ── Map / unmap actions ── */
  async function _mapSelected() {
    const ids = [...document.querySelectorAll('.lib-tag-cb:checked:not(:disabled)')]
      .map(cb => cb.dataset.id);
    if (!ids.length) { toast(t('Select at least one tag.','اختر علامة واحدة على الأقل.'), 'warn'); return; }
    await _doMap(ids);
  }

  async function _mapSingle(tagId) { await _doMap([tagId]); }

  async function _doMap(tagIds) {
    try {
      await fetch(`/api/v1/compliance-tags/product/${_productId}/map`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tag_ids: tagIds, mapped_by: 'u001' }),
      });
      await Promise.all([ loadMapped(), loadGap() ]);
      toast(t(`${tagIds.length} tag(s) mapped.`,`تم ربط ${tagIds.length} علامة.`), 'success');
      bus.emit('dirty', {});
      renderFull();
    } catch(e) { toast(e.message, 'error'); }
  }

  async function _unmap(tagId) {
    try {
      await fetch(`/api/v1/compliance-tags/product/${_productId}/map/${tagId}`, { method:'DELETE' });
      await Promise.all([ loadMapped(), loadGap() ]);
      toast(t('Tag removed.','تمت إزالة العلامة.'), 'info');
      bus.emit('dirty', {});
      renderFull();
    } catch(e) { toast(e.message, 'error'); }
  }

  async function _remapAll() {
    await Promise.all([ loadMapped(), loadGap() ]);
    renderFull();
  }

  /* ── Helpers ── */
  function groupByCategory(tags) {
    const grouped = {};
    tags.forEach(tg => {
      const c = tg.category || 'general';
      if (!grouped[c]) grouped[c] = [];
      grouped[c].push(tg);
    });
    return grouped;
  }

  function stageFooter() {
    return `<div class="stage-footer">
      <button class="pge-btn pge-btn-ghost" onclick="PGEShell.goToStage(4)" style="color:#003B5C;border-color:#dee2e6">
        <i class="fas fa-arrow-left"></i> ${t('Back','رجوع')}
      </button>
      <div style="display:flex;gap:.5rem">
        <button class="pge-btn pge-btn-outline" onclick="PGEStage5.saveAndStay()">
          <i class="fas fa-floppy-disk"></i> ${t('Save','حفظ')}
        </button>
        <button class="pge-btn pge-btn-primary" onclick="PGEStage5.saveAndNext()">
          ${t('Continue to Simulation','المتابعة إلى المحاكاة')} <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>`;
  }

  /* ── Save ── */
  async function doSave(opts = {}) {
    try {
      const prevStage = _product.pge_stage || 0;
      if (prevStage < 5) {
        await API.snapshot(_productId, 5, { mapped_tags: _mapped.length, gaps: _gap?.gaps_count||0 });
        _product.pge_stage = 5;
      }
      bus.emit('saved', {});
      if (!opts.silent) toast(t('Stage 5 saved.','تم حفظ المرحلة 5.'), 'success');
      return true;
    } catch(e) { toast(t('Save failed: ','فشل الحفظ: ') + e.message, 'error'); return false; }
  }

  async function saveAndStay() { await doSave(); }
  async function saveAndNext() { const ok = await doSave(); if (ok) PGEShell.goToStage(6); }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  window.PGEStage5 = { mount, _tab, _mapSelected, _mapSingle, _unmap, _remapAll, saveAndStay, saveAndNext };
})();
