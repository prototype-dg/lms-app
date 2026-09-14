/* ── ai-extract.js ───────────────────────────────────────────────────────────
 * Text-extraction helpers for AI Studio chat turns.
 * ALL writes go to _pendingConfig / _pendingWorkflow (confirmed on user affirm).
 * Depends on: ai-draft.js (globals: _pendingConfig, _pendingWorkflow, updateAiDraftCard)
 * ─────────────────────────────────────────────────────────────────────────── */

/* ── extractStage1Name ───────────────────────────────────────────────────── *
 * Called when "Stage 1 complete" detected in reply.
 * Buffers product name into _pendingConfig — committed when user confirms.    */
function extractStage1Name(rawMsg) {
  if (aiDraftConfig.name || _pendingConfig.name) return;
  const plain = rawMsg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const m = plain.match(/stage\s+1\s+complete[\u2014\u2013\-\.\s]+([A-Z][^,\n]{3,59}),/i)
         || plain.match(/"([^"]{4,60})"/);
  if (!m) return;
  const name = m[1].trim().replace(/[.!]$/, '');
  if (/[A-Z]/.test(name) && name.split(' ').length <= 8) {
    _pendingConfig.name = name;
    // No card update — card appears only after user confirms
  }
}

/* ── extractStage2Complete ───────────────────────────────────────────────── *
 * Called when "Stage 2 complete" detected.
 * Extracts summary params from the completion message → _pendingConfig.       */
function extractStage2Complete(rawMsg) {
  const plain = rawMsg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  _tryExtractStage2Fields(plain);
}

/* ── extractStage2Turn ───────────────────────────────────────────────────── *
 * Called on every Stage 2 turn (before completion).
 * Seeds any fields still absent from confirmed AND pending.                   */
function extractStage2Turn(rawMsg) {
  if (aiDraftConfig.name == null && _pendingConfig.name == null) return; // name not yet confirmed — don't show params prematurely
  const plain = rawMsg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  _tryExtractStage2Fields(plain);
}

/* ── _tryExtractStage2Fields ─────────────────────────────────────────────── *
 * Shared extractor: reads plain text → buffers into _pendingConfig.
 * BUG F FIX: Two pend strategies:
 *   pend(key, val)      — seed-only: skip if already confirmed OR pending (stable fields)
 *   pendAmt(key, val)   — amount fields: ALWAYS update pending if value differs from current.
 *                         This lets the Q1-repeat echo block ("OMR 25,000–1,000,000") correctly
 *                         overwrite the initial default 500,000 that was seeded from the Q1 message.
 *                         Skips if field is already CONFIRMED (aiDraftConfig) since confirmed
 *                         values are committed on user affirmation and should not be overwritten
 *                         by subsequent extraction of the same stage's text. */
function _tryExtractStage2Fields(plain) {
  let seeded = false;

  // Seed-only: write only if neither confirmed nor pending (stable fields like rates, terms)
  function pend(key, val) {
    if (aiDraftConfig[key] == null && _pendingConfig[key] == null && val != null) {
      _pendingConfig[key] = val; seeded = true;
    }
  }

  // Amount-aware: ALWAYS update pending when value changes — allows "increase max to 1M"
  // to overwrite the initial 500K seed. Never overwrites confirmed (aiDraftConfig) values.
  function pendAmt(key, val) {
    if (val == null) return;
    if (aiDraftConfig[key] != null) return; // already confirmed — don't touch
    if (_pendingConfig[key] !== val) { _pendingConfig[key] = val; seeded = true; }
  }

  // base_rate
  const br = plain.match(/(?:base\s+rate|rate)[^0-9]*(\d+\.\d+)%/i)
          || plain.match(/(\d+\.\d+)%[^,]*(?:base|rate|per annum)/i);
  if (br) pend('base_rate', parseFloat(br[1]));

  // green_discount_premium
  const gd = plain.match(/(\d+\.\d+)%\s*(?:off|discount|for\s+gsas)/i);
  if (gd) pend('green_discount_premium', parseFloat(gd[1]));

  // max_ltv
  const ltv = plain.match(/(?:ltv|loan.to.value)[^0-9]*(\d{2,3})%/i)
           || plain.match(/(\d{2,3})%\s*ltv/i);
  if (ltv) { const v = parseInt(ltv[1]); if (v >= 60 && v <= 100) pend('max_ltv', v); }

  // max_dbr (prefer explicit "set at X%" pattern, else minimum of context values)
  const dbrExplicit = plain.match(/(?:set\s+at|applying|apply)\s*(\d{2,3})%\s*(?:dbr|debt)/i)
                   || plain.match(/(?:dbr\s+(?:set|applied|confirmed)\s+(?:at|to))\s*(\d{2,3})%/i);
  if (dbrExplicit) {
    const v = parseInt(dbrExplicit[1]);
    if (v >= 30 && v <= 80) pend('max_dbr', v);
  } else {
    const dbrCtx = [...plain.matchAll(/(\d{2,3})%[^.]*(?:dbr|debt.burden)|(?:dbr|debt.burden)[^.]*?(\d{2,3})%/gi)];
    const vals = dbrCtx.map(m => parseInt(m[1]||m[2])).filter(v => v >= 30 && v <= 80);
    if (vals.length) pend('max_dbr', Math.min(...vals));
  }

  // max_amount — use pendAmt so Q1-repeat echo block ("OMR 25,000–1,000,000") updates the value
  // even if an earlier turn already seeded 500,000 into _pendingConfig.
  // Also handle en-dash range format ("OMR 25,000–1,000,000" / "OMR 25K–1M").
  const amtRangeTo  = plain.match(/omr\s*[\d,]+\s*to\s*omr\s*([\d,]+)/i);           // "omr X to omr Y"
  const amtRangeDash = plain.match(/omr\s*[\d,.k]+\s*[–\-]\s*omr?\s*([\d,.]+)\s*m?\b/i); // "omr X – omr Y" or "X – YM"
  const amtDashM     = plain.match(/omr\s*[\d,k]+\s*[–\-]\s*([\d.]+)\s*m\b/i);      // "omr 25K – 1M"
  const amtSingle    = plain.match(/(?:max(?:imum)?|up\s+to)\s+omr\s*([\d,]+)/i);
  // Priority: range with 'to' > range with dash > single value
  const amtRaw = amtRangeTo || amtDashM || amtRangeDash || amtSingle;
  if (amtRaw) {
    const raw = amtRaw[1].replace(/,/g, '');
    const v = raw.toLowerCase().endsWith('m') || amtDashM
      ? parseFloat(raw) * 1000000
      : parseInt(raw);
    if (v >= 10000 && v <= 5000000) pendAmt('max_amount', v);
  }

  // min_amount
  const minAmt = plain.match(/omr\s*([\d,]+)\s*(?:to|\u2013|-)\s*omr\s*[\d,]/i)   // "omr X to/– omr Y"
              || plain.match(/omr\s*([\d,]+)\s*(?:to|\u2013|-)\s*[\d]/i);           // "omr X – Y"
  if (minAmt) { const v = parseInt(minAmt[1].replace(/,/g,'')); if (v >= 1000 && v <= 200000) pendAmt('min_amount', v); }

  // max_term — match "up to 25 years", "max 25yr", "5–25 years" (take the LAST/larger number)
  const maxTRange = plain.match(/\d{1,2}\s*[–\-]\s*(\d{1,2})\s*years?/i);          // "5–25 years" → 25
  const maxTExplicit = plain.match(/(?:up\s+to|max(?:imum)?|term\s+(?:up\s+to|max))[^0-9]*(\d{1,2})\s*years?/i)
                    || plain.match(/(?:term|terms?)\s*(?:max|:)?\s*(\d+)\s*yr/i)
                    || plain.match(/(\d{1,2})\s*years?[^,]*(?:max|maximum|ceiling)/i);
  const maxT = maxTRange || maxTExplicit;
  if (maxT) { const v = parseInt(maxT[1]); if (v >= 5 && v <= 35) pend('max_term', v); }

  // min_term — match "from 5 to 25", "5–25 year", "term range of 5", "minimum term 5", "min 5 years"
  const minT = plain.match(/(?:term\s+range\s+of|from)\s*(\d{1,2})\s*(?:to|–|-)/i)
            || plain.match(/(\d{1,2})\s*[–\-]\s*\d{1,2}\s*years?/i)
            || plain.match(/(?:minimum\s+(?:term|of)|min\.?\s+term)[^0-9]*(\d{1,2})\s*years?/i)
            || plain.match(/min[^0-9]*(\d{1,2})\s*years?[^,]*(?:term|range)/i);
  if (minT) { const v = parseInt(minT[1]); if (v >= 1 && v <= 15) pend('min_term', v); }
  else if ((aiDraftConfig.max_term || _pendingConfig.max_term) && aiDraftConfig.min_term == null && _pendingConfig.min_term == null) {
    pend('min_term', 5); // default to 5 for home loans (CBO minimum for mortgages)
  }

  // No card update here — pending fields shown only after user confirms
}

/* ── extractStage4Workflow ───────────────────────────────────────────────── *
 * Called when Stage 4 detected and no set_workflow event from GPT.
 * Builds synthetic workflow list → _pendingWorkflow (confirmed by user).      */
function extractStage4Workflow(rawMsg, hasSetWorkflow) {
  if (hasSetWorkflow) return; // GPT already sent set_workflow event
  if (aiDraftWorkflow.length > 0 || _pendingWorkflow.length > 0) return;

  const plain = rawMsg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const isWfConfirm = /10[- ]step|10\s*steps/i.test(plain)
    || /approval workflow configured/i.test(plain)
    || /stage 4 complete/i.test(plain)
    || (/workflow/i.test(plain) && /automated/i.test(plain) && /human/i.test(plain));
  if (!isWfConfirm) return;

  const stepMatches = [...plain.matchAll(/(?:step\s*\d+[:\-–]?\s*|[•\-]\s*)([A-Z][^,.\n]{5,60})/g)];
  _pendingWorkflow = stepMatches.length >= 5
    ? stepMatches.slice(0, 11).map((m, i) => ({
        id: 'n' + (i+1),
        type: i === 0 ? 'start' : i === stepMatches.length-1 ? 'end' : i < 6 ? 'task' : 'approval',
        label: m[1].trim(), auto: i < 6, role: i < 6 ? 'system' : 'analyst',
      }))
    : [
        { id:'n1',  type:'start',    label:'Application Submitted',       auto:false, role:null },
        { id:'n2',  type:'task',     label:'eKYC & AML Screening',        auto:true,  role:'system',               sla_hours:1  },
        { id:'n3',  type:'task',     label:'Credit Bureau Check',         auto:true,  role:'system',               sla_hours:4  },
        { id:'n4',  type:'task',     label:'Document OCR & Validation',   auto:true,  role:'system',               sla_hours:2  },
        { id:'n5',  type:'task',     label:'GSAS Registry Verification',  auto:true,  role:'system',               sla_hours:4  },
        { id:'n6',  type:'task',     label:'Property Valuation & Title',  auto:true,  role:'system',               sla_hours:8  },
        { id:'n7',  type:'approval', label:'Credit Underwriting',         auto:false, role:'credit_analyst',        sla_hours:24 },
        { id:'n8',  type:'approval', label:'Green Finance ESG Review',    auto:false, role:'green_finance_officer', sla_hours:24 },
        { id:'n9',  type:'approval', label:'Risk & Compliance Sign-off',  auto:false, role:'risk_officer',          sla_hours:48 },
        { id:'n10', type:'approval', label:'PM Final Approval',           auto:false, role:'product_manager',       sla_hours:24 },
        { id:'n11', type:'end',      label:'Decision & Letter of Offer',  auto:false, role:null },
      ];
  // Pending — card updates when user confirms
}

/* ── extractStage5Compliance ─────────────────────────────────────────────── *
 * Called when "Stage 5 complete" detected.
 * Buffers compliance summary into _pendingConfig._compliance.                 */
function extractStage5Compliance(rawMsg) {
  if (aiDraftConfig._compliance || _pendingConfig._compliance) return;
  const plain = rawMsg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const rw   = plain.match(/(\d+)%\s*(?:risk weight|capital)/i);
  const prov = plain.match(/(\d+\.\d+)%\s*(?:stage 1|provisioning|ecl)/i);
  const aml  = /aml\s*(?:risk|score)?\s*(?:is|=|:)?\s*(low|medium|high)/i.exec(plain);
  _pendingConfig._compliance = {
    risk_weight:    rw   ? rw[1] + '%'            : '75%',
    provisioning:   prov ? prov[1] + '%'          : '1.5%',
    aml:            aml  ? aml[1].toUpperCase()   : 'LOW',
    classification: plain.toLowerCase().includes('green finance') ? 'Green Finance' : 'Standard',
  };
  // Pending — card updates when user confirms
}
