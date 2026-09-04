/* ============================================================
   pge-shared.js — PGE shared state, API client, utilities
   All PGE modules import from window.PGE (set by this file)
   ============================================================ */
(function () {
  'use strict';

  /* ── Language ── */
  const lang = { current: 'en' };
  function isAr() { return lang.current === 'ar'; }
  function t(en, ar) { return isAr() ? ar : en; }

  /* ── Design tokens (mirror style.css) ── */
  const COLORS = {
    navy: '#003B5C', teal: '#007F86', seaGlass: '#35C6C4',
    amber: '#F4B35B', success: '#16845B', danger: '#BD3B4B',
    warning: '#9B6A13', grey500: '#6c757d', grey200: '#e9ecef',
  };

  /* ── Stage meta ── */
  const STAGES = [
    { id: 1, en: 'Product Model',       ar: 'نموذج المنتج',      icon: 'fa-layer-group' },
    { id: 2, en: 'Core Configuration',  ar: 'الإعداد الأساسي',   icon: 'fa-sliders' },
    { id: 3, en: 'Rule Builder',        ar: 'منشئ القواعد',      icon: 'fa-gavel' },
    { id: 4, en: 'Workflow',            ar: 'سير العمل',         icon: 'fa-sitemap' },
    { id: 5, en: 'Compliance',          ar: 'الامتثال',          icon: 'fa-shield-halved' },
    { id: 6, en: 'Simulation',          ar: 'المحاكاة',          icon: 'fa-chart-line' },
  ];

  /* ── Product archetypes ── */
  const ARCHETYPES = [
    { id: 'home_loan',     en: 'Home Loan',       ar: 'تمويل عقاري',      icon: 'fa-house',         color: '#007F86' },
    { id: 'auto_loan',     en: 'Auto Finance',    ar: 'تمويل السيارات',    icon: 'fa-car',           color: '#35C6C4' },
    { id: 'personal_loan', en: 'Personal Loan',   ar: 'قرض شخصي',         icon: 'fa-user',          color: '#F4B35B' },
    { id: 'sme',           en: 'SME Finance',     ar: 'تمويل الشركات الصغيرة', icon: 'fa-briefcase', color: '#003B5C' },
    { id: 'commercial',    en: 'Commercial',      ar: 'تمويل تجاري',       icon: 'fa-building',      color: '#6c757d' },
    { id: 'education',     en: 'Education',       ar: 'تمويل تعليمي',      icon: 'fa-graduation-cap',color: '#a855f7' },
  ];

  /* ── Shared state ── */
  const state = {
    productId: null,
    product: null,
    market: null,
    currentStage: 1,
    dirty: false,       // unsaved changes
    saving: false,
    aiOpen: false,
    aiThread: [],       // local AI conversation
  };

  /* ── API client ── */
  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch('/api/v1' + path, opts);
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: r.statusText }));
      throw new Error(err.error || r.statusText);
    }
    return r.json();
  }

  /* Default "system" user used when no session user is available */
  const SYS_USER = { id: 'u001', name: 'Fatima Al-Rashdi', role: 'product_manager' };

  const API = {
    getProduct:  (id) => api('GET', `/products/${id}`),
    patchProduct:(id, data) => api('PATCH', `/products/${id}`, data),
    /* Generic PATCH — convenience alias used by stage modules */
    patch:       (path, data) => api('PATCH', path, data),
    getMarket:   () => api('GET', '/markets/default/current'),
    getVersions: (id) => api('GET', `/products/${id}/versions`),
    /* snapshot — always injects required user fields the backend needs */
    snapshot:    (id, stage, data) => api('POST', `/products/${id}/versions/snapshot`, {
      stage,
      user_id:   SYS_USER.id,
      user_name: SYS_USER.name,
      user_role: SYS_USER.role,
      ...data,
    }),
    getRules:    (productId) => api('GET', `/rules?product_id=${productId}`),
    getMatrices: (productId) => api('GET', `/rule-matrices?product_id=${productId}`),
    getTags:     (productId) => api('GET', `/compliance-tags/product/${productId}`),
    getGap:      (productId) => api('GET', `/compliance-tags/product/${productId}/gap-analysis`),
    getTemplates:() => api('GET', '/workflow-templates'),
    aiChat:      (productId, message, thread) =>
      api('POST', '/ai/products/chat', { product_id: productId, message, thread }),
  };

  /* ── Toast ── */
  function toast(msg, type = 'info') {
    const colors = { info: COLORS.teal, success: COLORS.success, error: COLORS.danger, warn: COLORS.warning };
    const icons  = { info: 'fa-circle-info', success: 'fa-circle-check', error: 'fa-circle-xmark', warn: 'fa-triangle-exclamation' };
    const el = document.createElement('div');
    el.style.cssText = `display:flex;align-items:center;gap:.6rem;padding:.7rem 1rem;border-radius:10px;
      background:white;border-left:4px solid ${colors[type]||colors.info};
      box-shadow:0 4px 16px rgba(0,0,0,.12);font-size:.82rem;min-width:240px;max-width:340px;
      animation:slideInRight .2s ease`;
    el.innerHTML = `<i class="fas ${icons[type]||icons.info}" style="color:${colors[type]||colors.info}"></i>
      <span style="flex:1;color:#212529">${msg}</span>`;
    const c = document.getElementById('pge-toast-container');
    if (c) {
      c.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    }
  }

  /* ── Markdown renderer ── */
  function md(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/((?:^|\n)\d+\.\s.+)+/g, b => {
        const items = b.trim().split(/\n/).map(l => l.replace(/^\d+\.\s+/, ''));
        return '<ol style="margin:.4rem 0 .4rem 1.2rem;line-height:1.8">' + items.map(i => `<li>${i}</li>`).join('') + '</ol>';
      })
      .replace(/((?:^|\n)[-•]\s.+)+/g, b => {
        const items = b.trim().split(/\n/).map(l => l.replace(/^[-•]\s+/, ''));
        return '<ul style="margin:.4rem 0 .4rem 1.2rem;line-height:1.8">' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
      })
      .replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  }

  /* ── Event bus ── */
  const _listeners = {};
  const bus = {
    on:   (ev, fn) => { (_listeners[ev] = _listeners[ev] || []).push(fn); },
    off:  (ev, fn) => { _listeners[ev] = (_listeners[ev]||[]).filter(f=>f!==fn); },
    emit: (ev, data) => { (_listeners[ev]||[]).forEach(fn => fn(data)); },
  };

  /* ── Publish to window.PGE ── */
  window.PGE = { lang, isAr, t, COLORS, STAGES, ARCHETYPES, state, API, toast, md, bus };
})();
