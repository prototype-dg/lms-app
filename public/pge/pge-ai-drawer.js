/* ============================================================
   pge-ai-drawer.js — AI Assistant drawer for PGE
   Mounts into #aiDrawerMount; communicates via PGE.bus
   ============================================================ */
(function () {
  'use strict';
  const { state, API, toast, md, t, isAr, bus } = window.PGE;

  let currentStageId = 1;
  let thread = [];
  let sending = false;

  /* ── Stage-aware system context hints ── */
  const STAGE_HINTS = {
    1: { en: 'Product Model — archetype, name, description, target segment',
         ar: 'نموذج المنتج — النوع والاسم والوصف والشريحة المستهدفة' },
    2: { en: 'Core Configuration — rates, LTV, DBR, term limits, required documents',
         ar: 'الإعداد الأساسي — الأسعار، LTV، DBR، آجال التمويل، الوثائق' },
    3: { en: 'Rule Builder — eligibility rules, matrices, conditions',
         ar: 'منشئ القواعد — قواعد الأهلية، المصفوفات، الشروط' },
    4: { en: 'Workflow — approval stages, roles, parallel paths, escalation',
         ar: 'سير العمل — مراحل الموافقة، الأدوار، المسارات المتوازية' },
    5: { en: 'Compliance — CBO regulatory tags, gap analysis, mandatory checks',
         ar: 'الامتثال — علامات البنك المركزي، تحليل الثغرات، الفحوصات الإلزامية' },
    6: { en: 'Simulation — sensitivity analysis, stress test, approval matrix projection',
         ar: 'المحاكاة — تحليل الحساسية، اختبار الضغط، مصفوفة الموافقة' },
  };

  /* ── Mount ── */
  function mount(container) {
    container.innerHTML = `
      <div class="ai-drawer-header">
        <div style="display:flex;align-items:center;gap:.5rem">
          <div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);
              display:flex;align-items:center;justify-content:center">
            <i class="fas fa-wand-magic-sparkles" style="font-size:.7rem;color:white"></i>
          </div>
          <h3 style="font-size:.85rem" id="aiDrawerTitle">${t('AI Assistant','المساعد الذكي')}</h3>
        </div>
        <button class="pge-btn pge-btn-ghost pge-btn-sm" onclick="PGEShell.toggleAI()" title="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Stage context pill -->
      <div style="padding:.5rem .875rem;border-bottom:1px solid #e9ecef;flex-shrink:0">
        <div id="aiStageContext" style="font-size:.7rem;color:#6366f1;background:#f3f0ff;
            border-radius:6px;padding:.3rem .6rem;line-height:1.4"></div>
      </div>

      <!-- Quick prompts -->
      <div id="aiQuickPrompts" style="padding:.625rem .875rem;border-bottom:1px solid #e9ecef;
          display:flex;flex-wrap:wrap;gap:.35rem;flex-shrink:0"></div>

      <!-- Messages -->
      <div class="ai-messages" id="aiMessages">
        <div class="ai-msg assistant">
          ${t(
            `Hello! I'm your AI product configurator. I'm ready to help you build <strong>${state.product?.name||'this product'}</strong>. What would you like to configure?`,
            `مرحبًا! أنا مساعدك الذكي لإعداد المنتجات. أنا هنا لمساعدتك في بناء <strong>${state.product?.name||'هذا المنتج'}</strong>. بماذا تريد البدء؟`
          )}
        </div>
      </div>

      <!-- Input -->
      <div class="ai-input-row">
        <textarea id="aiInput" rows="2"
          placeholder="${t('Ask anything about this product…','اسألني أي شيء عن هذا المنتج…')}"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();PGEAIDrawer.send()}"
        ></textarea>
        <button class="pge-btn pge-btn-ai pge-btn-sm" onclick="PGEAIDrawer.send()" id="aiSendBtn">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>`;

    renderStageContext(currentStageId);
    renderQuickPrompts(currentStageId);

    // Listen to stage changes
    bus.on('stageChanged', ({ stageId }) => {
      currentStageId = stageId;
      renderStageContext(stageId);
      renderQuickPrompts(stageId);
    });
    bus.on('langChanged', () => {
      renderStageContext(currentStageId);
      renderQuickPrompts(currentStageId);
    });
  }

  function renderStageContext(stageId) {
    const el = document.getElementById('aiStageContext');
    if (!el) return;
    const hint = STAGE_HINTS[stageId];
    el.textContent = hint ? (isAr() ? hint.ar : hint.en) : '';
  }

  /* ── Quick prompts per stage ── */
  const QUICK = {
    1: [
      { en: 'Suggest a name',     ar: 'اقترح اسمًا' },
      { en: 'Write description',  ar: 'اكتب وصفًا' },
      { en: 'Target segment?',    ar: 'الشريحة المستهدفة؟' },
    ],
    2: [
      { en: 'Recommend rate',     ar: 'اقترح معدلًا' },
      { en: 'CBO DBR limit?',     ar: 'حد DBR للبنك المركزي؟' },
      { en: 'Required docs list', ar: 'قائمة الوثائق المطلوبة' },
    ],
    3: [
      { en: 'Add eligibility rule',ar: 'أضف قاعدة أهلية' },
      { en: 'Build LTV matrix',   ar: 'بناء مصفوفة LTV' },
      { en: 'Rate tier matrix',   ar: 'مصفوفة مستويات السعر' },
    ],
    4: [
      { en: 'Standard workflow',  ar: 'سير العمل القياسي' },
      { en: 'Add ESG review node',ar: 'إضافة عقدة مراجعة ESG' },
      { en: 'Escalation path',    ar: 'مسار التصعيد' },
    ],
    5: [
      { en: 'Check compliance gaps', ar: 'فحص ثغرات الامتثال' },
      { en: 'Map CBO tags',          ar: 'ربط علامات البنك المركزي' },
      { en: 'Mandatory checks?',     ar: 'الفحوصات الإلزامية؟' },
    ],
    6: [
      { en: 'Run stress test',    ar: 'تشغيل اختبار الضغط' },
      { en: 'Rate sensitivity',   ar: 'حساسية المعدل' },
      { en: 'Approval projection',ar: 'توقع نسبة الموافقة' },
    ],
  };

  function renderQuickPrompts(stageId) {
    const el = document.getElementById('aiQuickPrompts');
    if (!el) return;
    const prompts = QUICK[stageId] || [];
    el.innerHTML = prompts.map(p => {
      const label = isAr() ? p.ar : p.en;
      return `<button onclick="PGEAIDrawer.quickSend('${label.replace(/'/g,"&#39;")}')"
          style="padding:.25rem .55rem;border-radius:6px;border:1px solid #e0d5ff;
          background:#f3f0ff;color:#6366f1;font-size:.68rem;cursor:pointer;transition:all .15s"
          onmouseover="this.style.background='#6366f1';this.style.color='white'"
          onmouseout="this.style.background='#f3f0ff';this.style.color='#6366f1'"
        >${label}</button>`;
    }).join('');
  }

  /* ── Send message ── */
  async function send() {
    const input = document.getElementById('aiInput');
    const msg = (input?.value || '').trim();
    if (!msg || sending) return;
    input.value = '';
    await sendMessage(msg);
  }

  async function quickSend(msg) {
    const input = document.getElementById('aiInput');
    if (input) input.value = '';
    await sendMessage(msg);
  }

  // Track thread_id returned by server (needed for stage-update calls)
  let _threadId = null;

  async function sendMessage(msg) {
    if (sending) return;
    sending = true;

    appendMsg('user', msg);
    thread.push({ role: 'user', content: msg });

    const thinkId = appendMsg('assistant', '<i class="fas fa-spinner fa-spin"></i> ' + t('Thinking…','جارٍ التفكير…'), 'thinking');
    setSendBtnState(false);

    try {
      const d = await API.aiChat(state.productId, msg, thread);
      const reply = d.reply || d.response || d.message || t('No response','لا توجد استجابة');
      removeMsg(thinkId);
      appendMsg('assistant', md(reply));
      thread.push({ role: 'assistant', content: reply });
      // Keep thread ≤ 20 turns
      if (thread.length > 20) thread = thread.slice(-20);
      // Capture thread_id for stage-update calls
      if (d.thread_id) _threadId = d.thread_id;

      // ── Process ui_events: forward to stage modules via bus ──────────────
      // The server emits add_rule, set_field, set_workflow, highlight_field, set_tab
      // events inside ui_events[]. Each stage module listens to 'aiEvent' on the bus
      // and handles events relevant to its own stage.
      //
      // DUPLICATE-GUARD: when rules_draft is also present in this response, the
      // aiRulesDraft handler (below) is the single authoritative path for inserting
      // rules. Skip forwarding add_rule ui_events in that case to avoid double-inserts.
      const hasRulesDraft = Array.isArray(d.rules_draft) && d.rules_draft.length > 0;
      if (Array.isArray(d.ui_events) && d.ui_events.length > 0) {
        for (const evt of d.ui_events) {
          if (hasRulesDraft && evt.type === 'add_rule') continue; // handled by aiRulesDraft
          bus.emit('aiEvent', evt);
        }
      }

      // ── Auto-apply rules_draft when AI completes stage 3 ─────────────────
      // rules_draft is emitted by the server at stage 3 (eligibility rules stage).
      // IMPORTANT: the fallback state machine returns current_stage: 4 on the same
      // turn it generates the rules (it combines Stage 3 completion + Stage 4 opening
      // in a single response). So we check current_stage >= 3 (not === 3) to catch
      // both the pure-stage-3 case (real GPT) and the stage-3→4 transition turn
      // (fallback state machine). We also gate on rules_draft being non-empty so
      // stage 4+ turns that don't include rules don't trigger this erroneously.
      if (Array.isArray(d.rules_draft) && d.rules_draft.length > 0 && d.current_stage >= 3) {
        bus.emit('aiRulesDraft', { rules: d.rules_draft, stage: d.current_stage });
      }

      // ── Stage 1 complete: persist name/model to existing product in DB ────
      // In PGE the product already exists (opened via ?id=...). When the AI
      // confirms Stage 1 (action='create_draft'), we update its name/description
      // and advance pge_stage to 1 via stage-update stage:1.
      // draft_hint carries: { name, description, category, segment }
      if (d.action === 'create_draft' && d.draft_hint) {
        try {
          const hint = d.draft_hint;
          const sd = await API.aiStageUpdate(state.productId, {
            thread_id: _threadId,
            stage: 1,
            fields: {
              name:        hint.name        || undefined,
              description: hint.description || undefined,
              category:    hint.category    || undefined,
              segment:     hint.segment     || undefined,
            },
          });
          if (sd.success && sd.product) {
            _renderDraftCard(sd.product);
            // Refresh topbar product name so it reflects the new name immediately
            const nameEl = document.getElementById('topbarProductName');
            if (nameEl && sd.product.name) nameEl.textContent = sd.product.name;
          }
        } catch (e2) {
          console.warn('[PGE AI] stage-1 update error:', e2);
        }
      }

      // ── Stages 2–6: persist stage data to DB immediately on each confirm ──
      // action='stage_update' fires when AI confirms a stage (2 through 6).
      // stage_update_hint carries stage number + all relevant data for that stage.
      if ((d.action === 'stage_update' || d.action === 'ready_to_confirm') && d.stage_update_hint) {
        try {
          const hint = d.stage_update_hint;
          const body = {
            thread_id: _threadId,
            stage:     hint.stage,
            fields:    hint.fields        || {},
            rules:     hint.rules         || [],
            workflow_nodes: hint.workflow_nodes || [],
            compliance:hint.compliance    || {},
            simulation:hint.simulation    || {},
          };
          const sd = await API.aiStageUpdate(state.productId, body);
          if (sd.success && sd.product) {
            _renderDraftCard(sd.product);
            // Notify stage modules to refresh (e.g. stage 2 sliders, stage 3 rule list)
            bus.emit('aiStageCommitted', { stage: hint.stage, product: sd.product });
          }
        } catch (e3) {
          console.warn('[PGE AI] stage-update error:', e3);
        }
      }

    } catch (e) {
      removeMsg(thinkId);
      appendMsg('assistant', `<span style="color:#BD3B4B"><i class="fas fa-triangle-exclamation"></i> ${e.message}</span>`);
    } finally {
      sending = false;
      setSendBtnState(true);
    }
  }

  /* ── Draft card — shows live DB state after every stage commit ───────────
   * Renders/updates a sticky card at the bottom of the message list showing
   * the product's current DB values (rate, LTV, DBR, term, amounts, stage).
   * Replaces itself on every call so only the latest state is visible.
   * ──────────────────────────────────────────────────────────────────────── */
  function _renderDraftCard(product) {
    if (!product) return;
    const container = document.getElementById('aiMessages');
    if (!container) return;

    // Remove previous card if present
    const prev = document.getElementById('ai-pge-draft-card');
    if (prev) prev.remove();

    const stage = product.pge_stage || 1;
    const stageLabels = ['','Model','Pricing','Rules','Workflow','Compliance','Simulation'];
    const stageColors = ['','#6b7280','#35C6C4','#4ade80','#f4b35b','#a855f7','#60a5fa'];
    const col = stageColors[stage] || '#6b7280';
    const lbl = stageLabels[stage] || ('Stage ' + stage);

    const card = document.createElement('div');
    card.id = 'ai-pge-draft-card';
    card.style.cssText = [
      'margin:8px 4px 4px 4px',
      'padding:10px 13px',
      'background:rgba(10,35,66,.85)',
      'border:1px solid ' + col + '55',
      'border-radius:9px',
      'font-size:.76rem',
      'color:rgba(255,255,255,.85)',
      'animation:fadeIn .35s ease',
    ].join(';');

    // Stage badge + name row
    const stageRow = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">
        <span style="font-weight:700;color:${col};font-size:.8rem">
          <i class="fas fa-database" style="font-size:.68rem;margin-right:4px"></i>
          ${product.name || 'Draft Product'}
        </span>
        <span style="font-size:.64rem;background:${col}22;color:${col};border:1px solid ${col}55;
            padding:.1rem .42rem;border-radius:10px;font-weight:600;white-space:nowrap">
          DRAFT · S${stage} ${lbl}
        </span>
      </div>`;

    // Key metrics grid (only shows populated fields)
    const metrics = [
      { lbl:'Rate',       val: product.base_rate   != null ? product.base_rate + '%'   : null },
      { lbl:'Max LTV',    val: product.max_ltv      != null ? product.max_ltv + '%'      : null },
      { lbl:'Max DBR',    val: product.max_dbr      != null ? product.max_dbr + '%'      : null },
      { lbl:'Term',       val: (product.min_term != null && product.max_term != null) ? product.min_term + '–' + product.max_term + ' yr' : null },
      { lbl:'Min Amt',    val: product.min_amount   != null ? 'OMR ' + Number(product.min_amount).toLocaleString()   : null },
      { lbl:'Max Amt',    val: product.max_amount   != null ? 'OMR ' + Number(product.max_amount).toLocaleString()   : null },
    ].filter(m => m.val !== null);

    const gridHtml = metrics.length > 0
      ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px 8px;margin-bottom:6px">` +
        metrics.map(m =>
          `<div><span style="opacity:.42;font-size:.63rem">${m.lbl}</span><br><strong>${m.val}</strong></div>`
        ).join('') + `</div>`
      : '';

    // Stage checklist footer
    const checks = [
      stage >= 1 ? '✓ Model'      : '',
      stage >= 2 ? '✓ Pricing'    : '',
      stage >= 3 ? '✓ Rules'      : '',
      stage >= 4 ? '✓ Workflow'   : '',
      stage >= 5 ? '✓ Compliance' : '',
      stage >= 6 ? '✓ Simulation' : '',
    ].filter(Boolean).join(' · ');

    const footerHtml = `
      <div style="font-size:.63rem;color:rgba(255,255,255,.3);margin-top:2px">
        <i class="fas fa-circle-dot" style="color:#4ade80;font-size:.52rem;margin-right:3px"></i>
        Live in DB · id: ${product.id}
        ${checks ? ' · ' + checks : ''}
      </div>`;

    card.innerHTML = stageRow + gridHtml + footerHtml;
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;
  }

  let msgId = 0;
  function appendMsg(role, html, extra = '') {
    const id = 'aim-' + (++msgId);
    const el = document.getElementById('aiMessages');
    if (!el) return id;
    const div = document.createElement('div');
    div.id = id;
    div.className = `ai-msg ${role} ${extra}`;
    div.innerHTML = html;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
    return id;
  }

  function removeMsg(id) {
    document.getElementById(id)?.remove();
  }

  function setSendBtnState(enabled) {
    const btn = document.getElementById('aiSendBtn');
    if (btn) btn.disabled = !enabled;
  }

  window.PGEAIDrawer = { mount, send, quickSend };
})();
