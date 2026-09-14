/* ============================================================
   pge-stage1.js — Stage 1: Product Model
   Archetype picker + name/code/description + schema fields
   Exports: window.PGEStage1.mount(container, ctx)
   ============================================================ */
(function () {
  'use strict';
  const { state, API, toast, t, isAr, ARCHETYPES, bus } = window.PGE;

  let _container = null;
  let _product   = null;
  let _draft     = {};   // local edits not yet saved

  /* ── Mount ── */
  async function mount(container, ctx) {
    _container = container;
    _product   = ctx.product;
    _draft     = {
      name:        _product.name        || '',
      name_ar:     _product.name_ar     || '',
      code:        _product.code        || '',
      category:    _product.category    || '',
      description: _product.description || '',
      description_ar: _product.description_ar || '',
      status:      _product.status      || 'draft',
    };

    render();

    // Listen for save requests from shell
    bus.on('requestSave', doSave);
    bus.on('langChanged', () => render());
  }

  /* ── Render ── */
  function render() {
    if (!_container) return;
    _container.innerHTML = `
      <div class="stage-content">
        <div class="stage-header">
          <h2>${t('Product Model','نموذج المنتج')}</h2>
          <p>${t(
            'Define the product archetype, identity, and purpose. This sets the foundation for all subsequent configuration stages.',
            'حدّد نوع المنتج وهويته وغرضه. هذا يُرسي الأساس لجميع مراحل الإعداد اللاحقة.'
          )}</p>
        </div>

        <!-- Archetype picker -->
        <div class="pge-card">
          <div class="pge-card-header">
            <h3><i class="fas fa-layer-group" style="color:#007F86;margin-right:.4rem"></i>
              ${t('Product Archetype','نوع المنتج')}
            </h3>
          </div>
          <div class="pge-card-body">
            <p style="font-size:.78rem;color:#6c757d;margin-bottom:.875rem">
              ${t('Choose the product category. This determines default attributes, regulatory rules, and workflow templates.',
                  'اختر فئة المنتج. يحدد ذلك الخصائص الافتراضية وقواعد الامتثال والقوالب.')}
            </p>
            <div class="archetype-grid" id="archetypeGrid">${renderArchetypes()}</div>
          </div>
        </div>

        <!-- Identity fields -->
        <div class="pge-card">
          <div class="pge-card-header">
            <h3><i class="fas fa-id-card" style="color:#007F86;margin-right:.4rem"></i>
              ${t('Product Identity','هوية المنتج')}
            </h3>
          </div>
          <div class="pge-card-body">
            <div class="pge-grid-2">
              <div class="pge-field">
                <label class="pge-label">${t('Product Name (English)','اسم المنتج (إنجليزي)')} <span class="pge-required">*</span></label>
                <input class="pge-input" id="f_name" value="${esc(_draft.name)}"
                  placeholder="${t('e.g. Standard Home Loan','مثال: قرض السكن القياسي')}"
                  oninput="PGEStage1._field('name',this.value)">
              </div>
              <div class="pge-field">
                <label class="pge-label">${t('Product Name (Arabic)','اسم المنتج (عربي)')}</label>
                <input class="pge-input" id="f_name_ar" value="${esc(_draft.name_ar)}"
                  dir="rtl" placeholder="مثال: قرض السكن القياسي"
                  oninput="PGEStage1._field('name_ar',this.value)">
              </div>
            </div>
            <div class="pge-grid-2">
              <div class="pge-field">
                <label class="pge-label">${t('Product Code','رمز المنتج')} <span class="pge-required">*</span></label>
                <input class="pge-input" id="f_code" value="${esc(_draft.code)}"
                  placeholder="e.g. HFL-STANDARD"
                  style="font-family:monospace;font-size:.8rem;text-transform:uppercase"
                  oninput="PGEStage1._field('code',this.value.toUpperCase())">
                <div class="pge-hint">${t('Uppercase letters, numbers and hyphens only.','أحرف كبيرة وأرقام وشرطات فقط.')}</div>
              </div>
              <div class="pge-field">
                <label class="pge-label">${t('Status','الحالة')}</label>
                <select class="pge-select" id="f_status" onchange="PGEStage1._field('status',this.value)">
                  <option value="draft"    ${_draft.status==='draft'?'selected':''}>${t('Draft','مسودة')}</option>
                  <option value="active"   ${_draft.status==='active'?'selected':''}>${t('Active','نشط')}</option>
                  <option value="archived" ${_draft.status==='archived'?'selected':''}>${t('Archived','مؤرشف')}</option>
                </select>
              </div>
            </div>
            <div class="pge-field">
              <label class="pge-label">${t('Description (English)','الوصف (إنجليزي)')}</label>
              <textarea class="pge-textarea" id="f_desc" rows="3"
                placeholder="${t('Describe the product purpose, target customers, and key benefits…','اصف غرض المنتج والعملاء المستهدفين والمزايا الرئيسية…')}"
                oninput="PGEStage1._field('description',this.value)">${esc(_draft.description)}</textarea>
            </div>
            <div class="pge-field">
              <label class="pge-label">${t('Description (Arabic)','الوصف (عربي)')}</label>
              <textarea class="pge-textarea" id="f_desc_ar" rows="3" dir="rtl"
                placeholder="اصف غرض المنتج والعملاء المستهدفين والمزايا الرئيسية…"
                oninput="PGEStage1._field('description_ar',this.value)">${esc(_draft.description_ar)}</textarea>
            </div>
          </div>
        </div>

        <!-- Stage footer -->
        <div class="stage-footer">
          <div style="font-size:.75rem;color:#6c757d" id="stageStatus">
            ${_product.pge_stage >= 1
              ? `<i class="fas fa-check-circle" style="color:#16845B"></i> ${t('Stage 1 completed','المرحلة 1 مكتملة')}`
              : `<i class="fas fa-circle-dot" style="color:#007F86"></i> ${t('In progress','جارٍ الإعداد')}`}
          </div>
          <div style="display:flex;gap:.5rem">
            <button class="pge-btn pge-btn-outline" onclick="PGEStage1.saveAndStay()">
              <i class="fas fa-floppy-disk"></i> ${t('Save','حفظ')}
            </button>
            <button class="pge-btn pge-btn-primary" onclick="PGEStage1.saveAndNext()">
              ${t('Save & Continue','حفظ ومتابعة')} <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>`;
  }

  /* ── Archetype grid ── */
  function renderArchetypes() {
    return ARCHETYPES.map(a => {
      const sel = _draft.category === a.id;
      const name = isAr() ? a.ar : a.en;
      return `<div class="archetype-card ${sel ? 'selected' : ''}"
            onclick="PGEStage1._pickArchetype('${a.id}')"
            style="${sel ? `border-color:${a.color};background:${hexAlpha(a.color,0.06)}` : ''}">
          <div class="archetype-icon"><i class="fas ${a.icon}" style="color:${a.color}"></i></div>
          <div class="archetype-name" style="${sel ? `color:${a.color}` : ''}">${name}</div>
        </div>`;
    }).join('');
  }

  /* ── Field helpers ── */
  function _field(key, value) {
    _draft[key] = value;
    if (key === 'code') {
      // Keep input uppercase in real-time
      const el = document.getElementById('f_code');
      if (el && el.value !== value) el.value = value;
    }
    bus.emit('dirty', {});
  }

  function _pickArchetype(id) {
    _draft.category = id;
    // Re-render archetype grid only (fast)
    const grid = document.getElementById('archetypeGrid');
    if (grid) grid.innerHTML = renderArchetypes();
    bus.emit('dirty', {});
    // Notify AI drawer context
    bus.emit('archetypeChanged', { category: id });
  }

  /* ── Validation ── */
  function validate() {
    if (!_draft.name?.trim())     { toast(t('Product name is required.','اسم المنتج مطلوب.'), 'error'); return false; }
    if (!_draft.code?.trim())     { toast(t('Product code is required.','رمز المنتج مطلوب.'), 'error'); return false; }
    if (!_draft.category)         { toast(t('Please select a product archetype.','يرجى اختيار نوع المنتج.'), 'error'); return false; }
    return true;
  }

  /* ── Save ── */
  async function doSave(opts = {}) {
    if (!validate()) return false;
    try {
      await API.patchProduct(_product.id, _draft);
      // Snapshot if advancing past stage 0
      const prevStage = _product.pge_stage || 0;
      if (prevStage < 1) {
        await API.snapshot(_product.id, 1, { changed_fields: Object.keys(_draft) });
        _product.pge_stage = 1;
      }
      Object.assign(_product, _draft);
      bus.emit('saved', {});
      if (!opts.silent) toast(t('Stage 1 saved.','تم حفظ المرحلة 1.'), 'success');
      return true;
    } catch (e) {
      toast(t('Save failed: ','فشل الحفظ: ') + e.message, 'error');
      return false;
    }
  }

  async function saveAndStay() {
    await doSave();
    // Re-render status footer
    const el = document.getElementById('stageStatus');
    if (el && _product.pge_stage >= 1) {
      el.innerHTML = `<i class="fas fa-check-circle" style="color:#16845B"></i> ${t('Stage 1 completed','المرحلة 1 مكتملة')}`;
    }
  }

  async function saveAndNext() {
    const ok = await doSave();
    if (ok) PGEShell.goToStage(2);
  }

  /* ── Utilities ── */
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  function hexAlpha(hex, a) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }

  window.PGEStage1 = { mount, _field, _pickArchetype, saveAndStay, saveAndNext };
})();
