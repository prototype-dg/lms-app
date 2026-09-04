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

  async function sendMessage(msg) {
    if (sending) return;
    sending = true;

    appendMsg('user', msg);
    thread.push({ role: 'user', content: msg });

    const thinkId = appendMsg('assistant', '<i class="fas fa-spinner fa-spin"></i> ' + t('Thinking…','جارٍ التفكير…'), 'thinking');
    setSendBtnState(false);

    try {
      const d = await API.aiChat(state.productId, msg, thread);
      const reply = d.response || d.message || t('No response','لا توجد استجابة');
      removeMsg(thinkId);
      appendMsg('assistant', md(reply));
      thread.push({ role: 'assistant', content: reply });
      // Keep thread ≤ 20 turns
      if (thread.length > 20) thread = thread.slice(-20);
    } catch (e) {
      removeMsg(thinkId);
      appendMsg('assistant', `<span style="color:#BD3B4B"><i class="fas fa-triangle-exclamation"></i> ${e.message}</span>`);
    } finally {
      sending = false;
      setSendBtnState(true);
    }
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
