/* ── ai-draft.js ─────────────────────────────────────────────────────────────
 * AI Studio draft state management.
 * Owns confirmed state (aiDraftConfig / aiDraftRules / aiDraftWorkflow),
 * pending buffers (_pendingConfig / _pendingRules / _pendingWorkflow),
 * and all card rendering helpers.
 *
 * Flow:
 *  AI proposes something  → write to _pending*
 *  User confirms (affirm) → _flushPending() → move _pending* → aiDraft*
 *  updateAiDraftCard()    → renders from confirmed aiDraft* only
 * ─────────────────────────────────────────────────────────────────────────── */

/* ── Confirmed state (shown in card, submitted on Save) ──────────────────── */
const aiDraftConfig   = {};
let   aiDraftRules    = [];
let   aiDraftWorkflow = [];

/* ── Pending buffers (proposed by AI, not yet user-confirmed) ────────────── */
const _pendingConfig   = {};
let   _pendingRules    = [];
let   _pendingWorkflow = [];

/* ── Card UI state ──────────────────────────────────────────────────────── */
let aiDraftCardExpanded  = false;
let _lastDraftSnapshot   = { _rCount: 0, _wCount: 0 };

/* ── resetDraftState ─────────────────────────────────────────────────────── */
function resetDraftState() {
  Object.keys(aiDraftConfig).forEach(k => delete aiDraftConfig[k]);
  aiDraftRules    = [];
  aiDraftWorkflow = [];
  Object.keys(_pendingConfig).forEach(k => delete _pendingConfig[k]);
  _pendingRules    = [];
  _pendingWorkflow = [];
  aiDraftCardExpanded = false;
  _lastDraftSnapshot  = { _rCount: 0, _wCount: 0 };
  const card = document.getElementById('ai-draft-card');
  if (card) card.remove();
}

/* ── _isUserConfirm ──────────────────────────────────────────────────────── */
function _isUserConfirm(msg) {
  const t = msg.toLowerCase().trim();
  return /^(yes|ok|okay|sure|proceed|confirm|confirmed|agree|agreed|good|great|looks good|perfect|correct|approved|approve|go ahead|sounds good|that.s (right|correct|good|fine)|continue|next|let.?s go|do it|set it|set that|lock it|lock that|accepted|accept|ready|done|fine|yep|yup|👍)/.test(t)
      || /\b(yes|ok|okay|confirm|proceed|approve|agreed|correct|go ahead|looks good|sounds good)\b/.test(t);
}

/* ── _flushPending ───────────────────────────────────────────────────────── */
function _flushPending() {
  let changed = false;
  for (const [k, v] of Object.entries(_pendingConfig)) {
    // Always overwrite — allows user-requested corrections to previously confirmed fields.
    // The old `if (aiDraftConfig[k] == null)` guard silently discarded every correction.
    if (aiDraftConfig[k] !== v) changed = true;
    aiDraftConfig[k] = v;
    delete _pendingConfig[k];
  }
  if (_pendingRules.length) {
    const existing = new Set(aiDraftRules.map(r => r.name));
    _pendingRules.forEach(r => { if (!existing.has(r.name)) { aiDraftRules.push(r); changed = true; } });
    _pendingRules = [];
  }
  if (_pendingWorkflow.length) {
    aiDraftWorkflow = _pendingWorkflow.slice();
    _pendingWorkflow = [];
    changed = true;
  }
  if (changed) {
    setTimeout(() => updateAiDraftCard(), 120);
    setTimeout(() => _pulseDraftBorder(), 300);
  }
}

/* ── _pulseDraftBorder ───────────────────────────────────────────────────── */
function _pulseDraftBorder() {
  const card = document.getElementById('ai-draft-card');
  if (!card) return;
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'draftBorderPulse 1.1s ease';
  setTimeout(() => { card.style.animation = ''; }, 1200);
}

/* ── _flashDraftFields ───────────────────────────────────────────────────── */
function _flashDraftFields(card) {
  if (!card) return;
  card.querySelectorAll('[data-flash]').forEach(el => {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'draftFlash .95s ease forwards';
    el.removeAttribute('data-flash');
  });
}

/* ── updateAiDraftCard ───────────────────────────────────────────────────── */
function updateAiDraftCard() {
  // Only show card if we have at least a confirmed name (Stage 1 confirmed)
  if (!aiDraftConfig.name && Object.keys(aiDraftConfig).length === 0 && !aiDraftRules.length && !aiDraftWorkflow.length) return;

  let card = document.getElementById('ai-draft-card');
  if (!card) {
    const inputWrapper = document.getElementById('aiInputWrapper');
    if (!inputWrapper) return;
    card = document.createElement('div');
    card.id = 'ai-draft-card';
    card.style.cssText = 'margin:.35rem 1rem;background:rgba(0,59,92,.6);border:1px solid rgba(53,198,196,.32);border-radius:9px;font-size:.77rem;animation:fadeIn .4s ease;overflow:hidden;max-height:460px;display:flex;flex-direction:column';
    inputWrapper.parentNode.insertBefore(card, inputWrapper);
  }

  const cfg    = aiDraftConfig;
  const rCount = aiDraftRules.length;
  const wCount = aiDraftWorkflow.length;
  const exp    = aiDraftCardExpanded;

  const fr = (label, val, color) => val != null
    ? `<div style="display:flex;justify-content:space-between;padding:.14rem 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <span style="color:rgba(255,255,255,.42);font-size:.72rem">${label}</span>
        <span style="color:${color||'rgba(255,255,255,.84)'};font-weight:600;font-size:.73rem">${val}</span>
       </div>` : '';

  const effectiveRate = cfg.green_discount_premium != null
    ? ((cfg.base_rate||5.25) - (cfg.green_discount_premium||0.75)).toFixed(2) + '%' : null;
  const rateStr = cfg.base_rate != null
    ? cfg.base_rate + '%' + (effectiveRate ? ' → ' + effectiveRate : '') : null;
  const termStr = cfg.max_term != null ? (cfg.min_term||3) + '–' + cfg.max_term + ' yrs' : null;
  const amtStr  = cfg.max_amount != null
    ? 'OMR ' + (cfg.min_amount ? Number(cfg.min_amount).toLocaleString() + '–' : '') + Number(cfg.max_amount).toLocaleString() : null;

  // Track changed fields for flash
  const snap   = _lastDraftSnapshot;
  const newSnap = { ...cfg, _rCount: rCount, _wCount: wCount };
  const changed = new Set();
  Object.keys(newSnap).forEach(k => { if (newSnap[k] !== snap[k]) changed.add(k); });

  function flashSpan(key, html) {
    return changed.has(key) ? `<span data-flash style="transition:color .3s">${html}</span>` : html;
  }

  // Summary bar
  const namePart  = cfg.name ? `<span style="font-weight:700;color:var(--sea-glass);font-size:.82rem">${flashSpan('name', cfg.name)}</span>` : '<span style="color:rgba(255,255,255,.3);font-size:.75rem">Naming…</span>';
  const ratePart  = rateStr  ? `<span style="color:#fbbf24;font-size:.73rem">${flashSpan('base_rate', rateStr)}</span>` : '';
  const termPart  = termStr  ? `<span style="color:rgba(255,255,255,.55);font-size:.71rem">${flashSpan('max_term', termStr)}</span>` : '';
  const amtPart   = amtStr   ? `<span style="color:rgba(255,255,255,.55);font-size:.71rem">${flashSpan('max_amount', amtStr)}</span>` : '';
  const rulePart  = rCount   ? `<span style="background:rgba(53,198,196,.15);color:var(--sea-glass);padding:.1rem .4rem;border-radius:10px;font-size:.68rem">${flashSpan('_rCount', rCount + ' rules')}</span>` : '';
  const wfPart    = wCount   ? `<span style="background:rgba(244,179,91,.12);color:#fbbf24;padding:.1rem .4rem;border-radius:10px;font-size:.68rem">${flashSpan('_wCount', wCount + '-step workflow')}</span>` : '';
  const cmpPart   = cfg._compliance ? `<span style="background:rgba(22,132,91,.15);color:#4ade80;padding:.1rem .4rem;border-radius:10px;font-size:.68rem">Basel III</span>` : '';

  const expandBtn = (rCount > 0 || wCount > 0)
    ? `<button onclick="aiDraftCardExpanded=!aiDraftCardExpanded;updateAiDraftCard()" style="margin-left:auto;background:rgba(53,198,196,.12);border:1px solid rgba(53,198,196,.25);color:var(--sea-glass);border-radius:5px;padding:.1rem .45rem;font-size:.62rem;cursor:pointer;white-space:nowrap"><i class="fas fa-${exp?'compress-alt':'expand-alt'}" style="margin-right:.18rem"></i>${exp?'Collapse':'Expand'}</button>` : '';

  let html = `<div style="padding:.5rem .85rem;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;border-bottom:${exp?'1px solid rgba(255,255,255,.07)':'none'}">
    <i class="fas fa-file-contract" style="color:var(--sea-glass);font-size:.8rem;flex-shrink:0"></i>
    ${namePart}${ratePart?`<span style="color:rgba(255,255,255,.2)">·</span>${ratePart}`:''}${termPart?`<span style="color:rgba(255,255,255,.2)">·</span>${termPart}`:''}${amtPart?`<span style="color:rgba(255,255,255,.2)">·</span>${amtPart}`:''}
    ${rulePart}${wfPart}${cmpPart}${expandBtn}
  </div>`;

  if (exp) {
    let expandedHtml = `<div style="overflow-y:auto;flex:1;padding:.5rem .85rem">`;
    if (Object.keys(cfg).filter(k => !k.startsWith('_')).length) {
      expandedHtml += `<div style="font-size:.68rem;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.3rem">Parameters</div>`;
      expandedHtml += fr('Base Rate', rateStr, '#fbbf24');
      expandedHtml += fr('Max LTV', cfg.max_ltv != null ? cfg.max_ltv + '%' : null);
      expandedHtml += fr('Max DBR', cfg.max_dbr != null ? cfg.max_dbr + '%' : null);
      expandedHtml += fr('Term Range', termStr);
      expandedHtml += fr('Amount Range', amtStr);
    }
    if (rCount) {
      expandedHtml += `<div style="font-size:.68rem;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.06em;margin:.5rem 0 .3rem">Eligibility Rules (${rCount})</div>`;
      expandedHtml += aiDraftRules.map(r => {
        const sc = r.severity==='hard'?'#f87171':r.severity==='soft'?'#fbbf24':'#60a5fa';
        return `<div style="display:flex;align-items:center;gap:.35rem;padding:.2rem 0">
          <span style="width:6px;height:6px;border-radius:50%;background:${sc};flex-shrink:0"></span>
          <span style="font-size:.72rem;color:rgba(255,255,255,.75)">${r.name||r.metric||'Rule'}</span>
          ${r.threshold_value!=null?`<span style="font-size:.65rem;color:rgba(255,255,255,.35);margin-left:auto">${r.operator||''} ${r.threshold_value}</span>`:''}
        </div>`;
      }).join('');
    }
    if (wCount) {
      expandedHtml += `<div style="font-size:.68rem;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.06em;margin:.5rem 0 .3rem">Workflow (${wCount} steps)</div>`;
      expandedHtml += aiDraftWorkflow.map((n, idx) =>
        `<div style="display:flex;align-items:center;gap:.35rem;padding:.18rem 0">
          <span style="font-size:.62rem;color:rgba(255,255,255,.25);width:14px;flex-shrink:0">${idx+1}</span>
          <span style="font-size:.72rem;color:rgba(255,255,255,.75)">${n.label||n.id}</span>
          ${n.auto?'<span style="font-size:.6rem;color:#fbbf24;margin-left:auto">AUTO</span>':''}
        </div>` +
        (idx < wCount-1 ? `<div style="width:1px;height:8px;background:rgba(255,255,255,.1);margin:.03rem 0 .03rem 7px"></div>` : '')
      ).join('');
    }
    if (!rCount && !wCount && Object.keys(cfg).filter(k=>!k.startsWith('_')).length < 3) {
      expandedHtml += `<div style="font-size:.72rem;color:rgba(255,255,255,.3);text-align:center;padding:.75rem 0">More details will appear as we progress.</div>`;
    }
    expandedHtml += `</div>`;
    html += expandedHtml;
  }

  const prev = card.innerHTML;
  card.innerHTML = html;
  if (prev !== html) _flashDraftFields(card);
  _lastDraftSnapshot = newSnap;
}
