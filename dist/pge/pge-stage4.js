/* ============================================================
   pge-stage4.js — Stage 4: Workflow Canvas
   Architecture: Model ↔ EventBus ↔ Renderer ↔ Interaction
   Hand-built SVG, no external library.
   Exports: window.PGEStage4.mount(container, ctx)
   ============================================================ */
(function () {
  'use strict';
  const { state, API, toast, t, isAr, bus } = window.PGE;

  /* ══════════════════════════════════════════════
     NODE TYPE REGISTRY
  ══════════════════════════════════════════════ */
  const NODE_TYPES = {
    start:      { label:'Start',          labelAr:'بداية',           shape:'circle',   color:'#16845B', icon:'▶' },
    end:        { label:'End',            labelAr:'نهاية',            shape:'circle',   color:'#BD3B4B', icon:'■' },
    task:       { label:'Task',           labelAr:'مهمة',             shape:'rect',     color:'#003B5C', icon:'⬜' },
    gateway_ex: { label:'Exclusive Gate', labelAr:'بوابة حصرية',     shape:'diamond',  color:'#9B6A13', icon:'◇' },
    gateway_par:{ label:'Parallel Gate',  labelAr:'بوابة متوازية',   shape:'diamond',  color:'#6366f1', icon:'⊕' },
    annotation: { label:'Note',           labelAr:'ملاحظة',           shape:'note',     color:'#6c757d', icon:'📝' },
  };

  const ROLE_OPTIONS = ['product_manager','compliance_officer','risk_officer','operations','system','any'];

  /* ══════════════════════════════════════════════
     MODEL
  ══════════════════════════════════════════════ */
  const Model = {
    nodes: [],
    edges: [],

    load(product) {
      try { this.nodes = JSON.parse(product.workflow_nodes || '[]'); } catch(_) { this.nodes = []; }
      try { this.edges = JSON.parse(product.workflow_edges || '[]'); } catch(_) { this.edges = []; }
      if (!this.nodes.length) this.applyTemplate(null);
    },

    applyTemplate(tpl) {
      if (tpl) {
        try { this.nodes = JSON.parse(tpl.nodes||'[]'); this.edges = JSON.parse(tpl.edges||'[]'); return; } catch(_){}
      }
      // Default blank: start + end
      this.nodes = [
        { id:'n_start', type:'start',  x:120, y:220, label:'Start',         label_ar:'بداية',   role:null, sla_hours:null, description:'' },
        { id:'n_end',   type:'end',    x:660, y:220, label:'End',           label_ar:'نهاية',   role:null, sla_hours:null, description:'' },
      ];
      this.edges = [];
    },

    addNode(type, x, y) {
      const id = 'n_' + Date.now();
      const nt = NODE_TYPES[type];
      const node = { id, type, x, y,
        label: nt?.label || type, label_ar: nt?.labelAr || type,
        role: 'any', sla_hours: 24, description: '' };
      this.nodes.push(node);
      bus.emit('wf:modelChanged', {});
      return node;
    },

    updateNode(id, patch) {
      const n = this.nodes.find(x => x.id === id);
      if (n) Object.assign(n, patch);
      bus.emit('wf:modelChanged', {});
    },

    deleteNode(id) {
      this.nodes = this.nodes.filter(n => n.id !== id);
      this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
      bus.emit('wf:modelChanged', {});
    },

    addEdge(fromId, toId, label = '') {
      if (fromId === toId) return;
      if (this.edges.find(e => e.from === fromId && e.to === toId)) return;
      this.edges.push({ id: 'e_' + Date.now(), from: fromId, to: toId, label });
      bus.emit('wf:modelChanged', {});
    },

    deleteEdge(id) {
      this.edges = this.edges.filter(e => e.id !== id);
      bus.emit('wf:modelChanged', {});
    },

    validate() {
      const issues = [];
      const starts = this.nodes.filter(n => n.type === 'start');
      const ends   = this.nodes.filter(n => n.type === 'end');
      if (!starts.length)  issues.push({ level:'error', msg: t('No Start node found.','لا توجد عقدة بداية.') });
      if (starts.length>1) issues.push({ level:'error', msg: t('Multiple Start nodes.','عقدات بداية متعددة.') });
      if (!ends.length)    issues.push({ level:'error', msg: t('No End node found.','لا توجد عقدة نهاية.') });
      // Orphans (non-start/end nodes with no edges)
      this.nodes.filter(n => n.type !== 'start' && n.type !== 'end').forEach(n => {
        const connected = this.edges.some(e => e.from === n.id || e.to === n.id);
        if (!connected) issues.push({ level:'warn', msg: `${t('Orphan node:','عقدة معزولة:')} "${n.label}"` });
      });
      // Tasks with no role
      this.nodes.filter(n => n.type === 'task').forEach(n => {
        if (!n.role || n.role === '') issues.push({ level:'warn', msg: `${t('Task has no assigned role:','مهمة بدون دور:')} "${n.label}"` });
      });
      return issues;
    },

    serialize() {
      return { workflow_nodes: JSON.stringify(this.nodes), workflow_edges: JSON.stringify(this.edges) };
    },
  };

  /* ══════════════════════════════════════════════
     SVG RENDERER
  ══════════════════════════════════════════════ */
  const GRID = 20;
  const W = 160, H = 60, R = 28, DH = 50;  // node dims

  const CANVAS_PAD = 60; // padding around node bounding box

  const Renderer = {
    svgEl: null,
    selectedId: null,

    init(svgEl) {
      this.svgEl = svgEl;
      this.render();
    },

    // Compute tight bounding box around all nodes and resize SVG to fit,
    // then scroll the container to show the leftmost content.
    _fitCanvas() {
      const nodes = Model.nodes;
      if (!nodes.length || !this.svgEl) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        const hw = (n.type === 'start' || n.type === 'end') ? R
          : (n.type === 'gateway_ex' || n.type === 'gateway_par') ? DH * 1.3
          : W / 2;
        const hh = (n.type === 'start' || n.type === 'end') ? R
          : (n.type === 'gateway_ex' || n.type === 'gateway_par') ? DH
          : H / 2;
        minX = Math.min(minX, n.x - hw);
        minY = Math.min(minY, n.y - hh);
        maxX = Math.max(maxX, n.x + hw);
        maxY = Math.max(maxY, n.y + hh);
      }
      const vbX = minX - CANVAS_PAD;
      const vbY = minY - CANVAS_PAD;
      const vbW = (maxX - minX) + CANVAS_PAD * 2;
      const vbH = (maxY - minY) + CANVAS_PAD * 2;
      // SVG intrinsic size = viewBox size (1:1 px, scrollable)
      this.svgEl.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
      this.svgEl.style.width  = vbW + 'px';
      this.svgEl.style.height = vbH + 'px';
      this.svgEl.style.minWidth  = '100%';   // never smaller than the container
      this.svgEl.style.minHeight = '100%';
    },

    render() {
      if (!this.svgEl) return;
      const nodes = Model.nodes;
      const edges = Model.edges;

      this.svgEl.innerHTML = `
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#6c757d"/>
          </marker>
          <pattern id="wfGrid" width="${GRID}" height="${GRID}" patternUnits="userSpaceOnUse">
            <path d="M ${GRID} 0 L 0 0 0 ${GRID}" fill="none" stroke="#e9ecef" stroke-width=".5"/>
          </pattern>
        </defs>
        <!-- Background grid -->
        <rect width="100%" height="100%" fill="url(#wfGrid)"/>
        <!-- Edges -->
        <g id="wfEdges">${edges.map(e => this.renderEdge(e, nodes)).join('')}</g>
        <!-- Nodes -->
        <g id="wfNodes">${nodes.map(n => this.renderNode(n)).join('')}</g>`;
      this._fitCanvas();
    },

    renderNode(n) {
      const nt   = NODE_TYPES[n.type] || NODE_TYPES.task;
      const sel  = this.selectedId === n.id;
      const sel_s = sel ? `filter:drop-shadow(0 0 6px ${nt.color}88)` : '';
      const label = isAr() ? (n.label_ar || n.label) : n.label;

      let shape = '';
      if (n.type === 'start' || n.type === 'end') {
        shape = `<circle cx="${n.x}" cy="${n.y}" r="${R}"
          fill="${nt.color}" stroke="${sel?'white':'none'}" stroke-width="${sel?3:0}"
          style="${sel_s}" class="wf-node" data-id="${n.id}"/>
          <text x="${n.x}" y="${n.y+1}" text-anchor="middle" dominant-baseline="middle"
            font-size="10" fill="white" pointer-events="none">${label}</text>`;
      } else if (n.type === 'gateway_ex' || n.type === 'gateway_par') {
        const pts = `${n.x},${n.y-DH} ${n.x+DH*1.3},${n.y} ${n.x},${n.y+DH} ${n.x-DH*1.3},${n.y}`;
        const sym = n.type === 'gateway_par' ? '+' : '×';
        shape = `<polygon points="${pts}" fill="white" stroke="${nt.color}"
          stroke-width="${sel?3:2}" style="${sel_s}" class="wf-node" data-id="${n.id}"/>
          <text x="${n.x}" y="${n.y}" text-anchor="middle" dominant-baseline="middle"
            font-size="18" fill="${nt.color}" font-weight="700" pointer-events="none">${sym}</text>
          <text x="${n.x}" y="${n.y+DH+14}" text-anchor="middle" font-size="10"
            fill="${nt.color}" pointer-events="none">${label}</text>`;
      } else if (n.type === 'annotation') {
        shape = `<rect x="${n.x-W/2}" y="${n.y-H/2}" width="${W}" height="${H}"
          rx="6" fill="#fffde7" stroke="#f4b35b" stroke-width="1.5" stroke-dasharray="5,3"
          class="wf-node" data-id="${n.id}"/>
          <text x="${n.x}" y="${n.y}" text-anchor="middle" dominant-baseline="middle"
            font-size="10" fill="#9B6A13" pointer-events="none">${label}</text>`;
      } else {
        // task rect
        const roleStr = n.role && n.role !== 'any' ? n.role.replace(/_/g,' ') : '';
        shape = `<rect x="${n.x-W/2}" y="${n.y-H/2}" width="${W}" height="${H}"
          rx="10" fill="white" stroke="${sel?nt.color:'#dee2e6'}"
          stroke-width="${sel?2.5:1.5}" style="${sel_s}" class="wf-node" data-id="${n.id}"/>
          <rect x="${n.x-W/2}" y="${n.y-H/2}" width="6" height="${H}" rx="3"
            fill="${nt.color}" pointer-events="none"/>
          <text x="${n.x+4}" y="${n.y-(roleStr?6:0)}" text-anchor="middle" dominant-baseline="middle"
            font-size="11" font-weight="600" fill="#003B5C" pointer-events="none"
            style="max-width:${W-20}px">${this.truncate(label,18)}</text>
          ${roleStr ? `<text x="${n.x+4}" y="${n.y+12}" text-anchor="middle" dominant-baseline="middle"
            font-size="9" fill="#6c757d" pointer-events="none">${roleStr}</text>` : ''}`;
      }
      // Port dots for connecting
      const port = (px, py, dir) =>
        `<circle cx="${px}" cy="${py}" r="5" fill="white" stroke="${nt.color}" stroke-width="2"
          class="wf-port" data-id="${n.id}" data-dir="${dir}" style="cursor:crosshair"/>`;

      const ports = (n.type !== 'end')
        ? port(n.x + (n.type==='start'?R:W/2), n.y, 'out') : '';

      return `<g class="wf-node-group" data-id="${n.id}" style="cursor:move">${shape}${ports}</g>`;
    },

    renderEdge(e, nodes) {
      const from = nodes.find(n => n.id === e.from);
      const to   = nodes.find(n => n.id === e.to);
      if (!from || !to) return '';
      // Simple straight line with right-side/left-side attachment
      const fx = from.type === 'start' ? from.x + R : from.x + W/2;
      const fy = from.y;
      const tx = to.type === 'end' ? to.x - R : to.x - W/2;
      const ty = to.y;
      const mx = (fx + tx) / 2;
      const path = `M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`;
      const label = e.label || '';
      const mid_x = mx, mid_y = (fy + ty) / 2;
      return `<g class="wf-edge" data-id="${e.id}" style="cursor:pointer">
        <path d="${path}" fill="none" stroke="#6c757d" stroke-width="1.5"
          marker-end="url(#arrowhead)"/>
        ${label ? `<rect x="${mid_x-24}" y="${mid_y-9}" width="48" height="18" rx="4"
          fill="white" stroke="#e9ecef"/>
          <text x="${mid_x}" y="${mid_y+1}" text-anchor="middle" dominant-baseline="middle"
            font-size="9" fill="#495057">${label}</text>` : ''}
        <!-- Invisible wide hit area -->
        <path d="${path}" fill="none" stroke="transparent" stroke-width="12"
          class="wf-edge-hit" data-id="${e.id}"/>
      </g>`;
    },

    truncate(s, max) { return s.length > max ? s.slice(0,max-1)+'…' : s; },

    highlight(id) {
      this.selectedId = id;
      this.render();
    },
  };

  /* ══════════════════════════════════════════════
     INTERACTION
  ══════════════════════════════════════════════ */
  const Interaction = {
    dragging: null,   // { nodeId, startX, startY, origX, origY }
    connecting: null, // { fromId }
    svgEl: null,

    bind(svgEl) {
      this.svgEl = svgEl;
      svgEl.addEventListener('mousedown', e => this._onDown(e));
      svgEl.addEventListener('mousemove', e => this._onMove(e));
      svgEl.addEventListener('mouseup',   e => this._onUp(e));
      svgEl.addEventListener('click',     e => this._onClick(e));
      svgEl.addEventListener('dblclick',  e => this._onDbl(e));
    },

    _svgPoint(e) {
      // Use SVG coordinate system so drag works correctly with viewBox scaling
      const pt = this.svgEl.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = this.svgEl.getScreenCTM();
      if (ctm) {
        const svgPt = pt.matrixTransform(ctm.inverse());
        return { x: svgPt.x, y: svgPt.y };
      }
      const rect = this.svgEl.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },

    _snapToGrid(v) { return Math.round(v / GRID) * GRID; },

    _onDown(e) {
      const nodeGroup = e.target.closest('.wf-node-group');
      const port      = e.target.closest('.wf-port');
      if (port) {
        // Start connecting
        e.stopPropagation();
        this.connecting = { fromId: port.dataset.id };
        return;
      }
      if (nodeGroup) {
        const id = nodeGroup.dataset.id;
        const node = Model.nodes.find(n => n.id === id);
        if (!node) return;
        const pt = this._svgPoint(e);
        this.dragging = { nodeId: id, startX: pt.x, startY: pt.y, origX: node.x, origY: node.y };
        Renderer.highlight(id);
        Properties.show(id);
        e.preventDefault();
      }
    },

    _onMove(e) {
      if (!this.dragging) return;
      const pt = this._svgPoint(e);
      const dx = pt.x - this.dragging.startX;
      const dy = pt.y - this.dragging.startY;
      Model.updateNode(this.dragging.nodeId, {
        x: this._snapToGrid(this.dragging.origX + dx),
        y: this._snapToGrid(this.dragging.origY + dy),
      });
      Renderer.render();
    },

    _onUp(e) {
      if (this.connecting) {
        // Check if released on a node port or node body
        const target = e.target.closest('.wf-node-group') || e.target.closest('.wf-port');
        if (target) {
          const toId = target.dataset.id || target.closest('.wf-node-group')?.dataset.id;
          if (toId && toId !== this.connecting.fromId) {
            const label = Model.nodes.find(n=>n.id===this.connecting.fromId)?.type === 'gateway_ex'
              ? (prompt(t('Edge label (optional):','تسمية الحافة (اختياري):')) || '') : '';
            Model.addEdge(this.connecting.fromId, toId, label);
            Renderer.render();
            bus.emit('dirty', {});
          }
        }
        this.connecting = null;
      }
      if (this.dragging) {
        this.dragging = null;
        bus.emit('dirty', {});
      }
    },

    _onClick(e) {
      const edgeHit = e.target.closest('.wf-edge-hit');
      if (edgeHit) {
        if (confirm(t('Delete this connection?','حذف هذا الاتصال؟'))) {
          Model.deleteEdge(edgeHit.dataset.id);
          Renderer.render();
          bus.emit('dirty', {});
        }
      }
    },

    _onDbl(e) {
      const nodeGroup = e.target.closest('.wf-node-group');
      if (nodeGroup) Properties.show(nodeGroup.dataset.id);
    },
  };

  /* ══════════════════════════════════════════════
     PROPERTIES PANEL
  ══════════════════════════════════════════════ */
  const Properties = {
    show(nodeId) {
      const n = Model.nodes.find(x => x.id === nodeId);
      if (!n) return;
      const nt = NODE_TYPES[n.type];
      const el = document.getElementById('wfProps');
      if (!el) return;

      const isGateway = n.type.startsWith('gateway');
      const outEdges  = Model.edges.filter(e => e.from === n.id);

      el.innerHTML = `
        <div style="font-size:.8rem;font-weight:700;color:#003B5C;margin-bottom:.75rem;
            display:flex;align-items:center;gap:.5rem">
          <span style="width:10px;height:10px;border-radius:50%;background:${nt.color};flex-shrink:0"></span>
          ${isAr() ? nt.labelAr : nt.label}
        </div>

        <div class="pge-field">
          <label class="pge-label">${t('Label (EN)','التسمية (إنجليزي)')}</label>
          <input class="pge-input pge-input-sm" id="prop_label" value="${esc(n.label||'')}"
            oninput="PGEStage4._propUpdate('${n.id}','label',this.value)">
        </div>
        <div class="pge-field">
          <label class="pge-label">${t('Label (AR)','التسمية (عربي)')}</label>
          <input class="pge-input pge-input-sm" id="prop_label_ar" dir="rtl" value="${esc(n.label_ar||'')}"
            oninput="PGEStage4._propUpdate('${n.id}','label_ar',this.value)">
        </div>
        ${n.type === 'task' ? `
        <div class="pge-field">
          <label class="pge-label">${t('Assigned Role','الدور المُسند')}</label>
          <select class="pge-select pge-select-sm" onchange="PGEStage4._propUpdate('${n.id}','role',this.value)">
            ${ROLE_OPTIONS.map(r=>`<option value="${r}" ${n.role===r?'selected':''}>${r.replace(/_/g,' ')}</option>`).join('')}
          </select>
        </div>
        <div class="pge-field">
          <label class="pge-label">${t('SLA (hours)','SLA (ساعات)')}</label>
          <input class="pge-input pge-input-sm" type="number" value="${n.sla_hours||24}"
            oninput="PGEStage4._propUpdate('${n.id}','sla_hours',+this.value)">
        </div>` : ''}
        ${isGateway ? `
        <div style="margin-top:.5rem">
          <div style="font-size:.72rem;font-weight:600;color:#6c757d;margin-bottom:.35rem">
            ${t('Outgoing edges','الحواف الصادرة')} (${outEdges.length})
          </div>
          ${outEdges.map(e=>`
            <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.25rem">
              <input class="pge-input pge-input-sm" style="flex:1" value="${esc(e.label||'')}"
                placeholder="${t('condition label','تسمية الشرط')}"
                onchange="PGEStage4._edgeLabel('${e.id}',this.value)">
            </div>`).join('')}
        </div>` : ''}
        <div class="pge-field">
          <label class="pge-label">${t('Description','الوصف')}</label>
          <textarea class="pge-textarea" rows="2" style="font-size:.75rem"
            oninput="PGEStage4._propUpdate('${n.id}','description',this.value)">${esc(n.description||'')}</textarea>
        </div>
        <button class="pge-btn pge-btn-danger pge-btn-sm" style="width:100%;margin-top:.5rem"
          onclick="PGEStage4._deleteNode('${n.id}')">
          <i class="fas fa-trash"></i> ${t('Delete Node','حذف العقدة')}
        </button>`;
    },

    clear() {
      const el = document.getElementById('wfProps');
      if (el) el.innerHTML = `<div style="font-size:.78rem;color:#6c757d;text-align:center;padding:1.5rem .5rem">
        ${t('Click a node to edit its properties.','انقر على عقدة لتعديل خصائصها.')}
      </div>`;
    },
  };

  /* ══════════════════════════════════════════════
     MOUNT
  ══════════════════════════════════════════════ */
  let _container = null;
  let _productId = null;
  let _product   = null;
  let _templates = [];

  async function mount(container, ctx) {
    _container = container;
    _productId = ctx.productId;
    _product   = ctx.product;

    try { const d = await API.getTemplates(); _templates = d.templates || []; } catch(_) {}

    // Load workflow: prefer product-specific nodes, fall back to assigned template
    let loadedFromTemplate = false;
    Model.load(_product);
    if (Model.nodes.length <= 2 && _product.workflow_template_id) {
      // Product has no custom nodes but has a template — load that template
      try {
        const tplRes = await fetch(`/api/v1/workflow-templates/${_product.workflow_template_id}`).then(r => r.json());
        if (tplRes.template && tplRes.template.nodes) {
          Model.applyTemplate(tplRes.template);
          loadedFromTemplate = true;
        }
      } catch(_) {}
    }
    renderShell();

    const svgEl = document.getElementById('wfSvg');
    Renderer.init(svgEl);
    Interaction.bind(svgEl);
    Properties.clear();

    bus.on('wf:modelChanged', () => { Renderer.render(); bus.emit('dirty', {}); });
    bus.on('requestSave', doSave);
    bus.on('langChanged', () => { renderShell(); });

    // Auto-fit on first load — run after the browser has laid out the container
    requestAnimationFrame(() => requestAnimationFrame(() => _fitView()));
  }

  function renderShell() {
    if (!_container) return;
    _container.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;min-height:0">

        <!-- Stage header (fixed) -->
        <div style="padding:1rem 1.5rem .75rem;flex-shrink:0">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem">
            <div>
              <h2 style="font-size:1.1rem;font-weight:700;color:#003B5C;margin:0 0 .2rem">
                ${t('Workflow Canvas','لوحة سير العمل')}
              </h2>
              <p style="font-size:.78rem;color:#6c757d;margin:0">
                ${t('Design the approval workflow. Drag nodes, connect ports, configure roles.','صمّم مسار الموافقة. اسحب العقد، اربط المنافذ، حدد الأدوار.')}
              </p>
            </div>
            <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">
              ${_templates.length ? `
              <select class="pge-select pge-select-sm" style="max-width:180px" onchange="PGEStage4._loadTemplate(this.value)">
                <option value="">${t('Load template…','تحميل قالب…')}</option>
                ${_templates.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}
              </select>` : ''}
              <button class="pge-btn pge-btn-ghost pge-btn-sm" onclick="PGEStage4._fitView()" title="${t('Fit entire workflow into view','ملاءمة سير العمل في العرض')}">
                <i class="fas fa-expand"></i> ${t('Fit','ملاءمة')}
              </button>
              <button class="pge-btn pge-btn-ghost pge-btn-sm" onclick="PGEStage4._validate()">
                <i class="fas fa-circle-check"></i> ${t('Validate','التحقق')}
              </button>
              <button class="pge-btn pge-btn-ghost pge-btn-sm" onclick="PGEStage4._resetCanvas()">
                <i class="fas fa-rotate-left"></i> ${t('Reset','إعادة تعيين')}
              </button>
            </div>
          </div>
        </div>

        <!-- 3-column workspace -->
        <div style="flex:1;display:flex;overflow:hidden;border-top:1px solid #e9ecef">

          <!-- Palette -->
          <div style="width:130px;min-width:130px;background:white;border-right:1px solid #e9ecef;
              padding:.75rem .5rem;overflow-y:auto;flex-shrink:0">
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#6c757d;
                margin-bottom:.5rem;letter-spacing:.5px">${t('Palette','اللوحة')}</div>
            ${Object.entries(NODE_TYPES).map(([type, nt]) =>
              `<div class="wf-palette-item" draggable="true"
                  ondragstart="PGEStage4._paletteDrag(event,'${type}')"
                  onclick="PGEStage4._addNodeCenter('${type}')"
                  title="${t('Click or drag','انقر أو اسحب')}">
                <div style="font-size:.65rem;font-weight:600;color:${nt.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  ${isAr() ? nt.labelAr : nt.label}
                </div>
              </div>`
            ).join('')}
          </div>

          <!-- SVG Canvas — scrollable in both axes -->
          <div id="wfCanvasScroll" style="flex:1;position:relative;overflow:auto;background:#f8f9fa"
              ondragover="event.preventDefault()"
              ondrop="PGEStage4._canvasDrop(event)">
            <svg id="wfSvg"
              style="display:block;cursor:default;user-select:none"></svg>
            <div style="position:sticky;bottom:.5rem;right:.5rem;float:right;
                font-size:.68rem;color:#aaa;pointer-events:none;padding-right:.5rem">
              ${t('Scroll to pan · Drag nodes · Click port to connect · Double-click to edit','مرر للتنقل · اسحب العقد · انقر المنفذ للاتصال · انقر مرتين للتعديل')}
            </div>
          </div>

          <!-- Properties panel -->
          <div style="width:210px;min-width:210px;background:white;border-left:1px solid #e9ecef;
              padding:.875rem .75rem;overflow-y:auto;flex-shrink:0">
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:#6c757d;
                margin-bottom:.625rem;letter-spacing:.5px">${t('Properties','الخصائص')}</div>
            <div id="wfProps"></div>
          </div>
        </div>

        <!-- Validation panel -->
        <div id="wfValidation" style="display:none;padding:.5rem 1rem;border-top:1px solid #e9ecef;
            background:white;font-size:.75rem;flex-shrink:0"></div>

        <!-- Stage footer -->
        <div class="stage-footer">
          <button class="pge-btn pge-btn-ghost" onclick="PGEShell.goToStage(3)"
              style="color:#003B5C;border-color:#dee2e6">
            <i class="fas fa-arrow-left"></i> ${t('Back','رجوع')}
          </button>
          <div style="display:flex;gap:.5rem">
            <button class="pge-btn pge-btn-outline" onclick="PGEStage4.saveAndStay()">
              <i class="fas fa-floppy-disk"></i> ${t('Save','حفظ')}
            </button>
            <button class="pge-btn pge-btn-primary" onclick="PGEStage4.saveAndNext()">
              ${t('Continue to Compliance','المتابعة إلى الامتثال')} <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>`;

    addCanvasStyles();

    // Re-bind after render
    const svgEl = document.getElementById('wfSvg');
    if (svgEl) {
      Renderer.init(svgEl);
      Interaction.bind(svgEl);
      Properties.clear();
    }
  }

  function addCanvasStyles() {
    if (document.getElementById('s4style')) return;
    const s = document.createElement('style');
    s.id = 's4style';
    s.textContent = `
      .wf-palette-item{padding:.4rem .5rem;border-radius:8px;cursor:pointer;margin-bottom:.25rem;
        border:1px solid #e9ecef;background:white;transition:all .15s;font-size:.72rem}
      .wf-palette-item:hover{border-color:#007F86;background:#eaf5f4}
      .pge-input-sm,.pge-select-sm{padding:.3rem .55rem;font-size:.75rem;border-radius:7px;
        border:1px solid #dee2e6;outline:none;width:100%}
      .pge-input-sm:focus,.pge-select-sm:focus{border-color:#007F86;box-shadow:0 0 0 2px rgba(0,127,134,.1)}
      .stage-footer{display:flex;align-items:center;justify-content:space-between;
        padding:.75rem 1.5rem;border-top:1px solid #e9ecef;background:white;flex-shrink:0}`;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════
     PALETTE / DRAG-DROP INTERACTIONS
  ══════════════════════════════════════════════ */
  let _dragType = null;

  function _paletteDrag(e, type) {
    _dragType = type;
    e.dataTransfer.effectAllowed = 'copy';
  }

  function _canvasDrop(e) {
    e.preventDefault();
    if (!_dragType) return;
    // Convert drop coords through SVG viewBox
    const svg = document.getElementById('wfSvg');
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    let x, y;
    if (ctm) {
      const sp = pt.matrixTransform(ctm.inverse());
      x = Math.round(sp.x / GRID) * GRID;
      y = Math.round(sp.y / GRID) * GRID;
    } else {
      const rect = svg.getBoundingClientRect();
      x = Math.round((e.clientX - rect.left) / GRID) * GRID;
      y = Math.round((e.clientY - rect.top)  / GRID) * GRID;
    }
    Model.addNode(_dragType, x, y);
    Renderer.render();
    _dragType = null;
  }

  function _addNodeCenter(type) {
    // Place new node in the viewBox centre so it's always visible
    const svg = document.getElementById('wfSvg');
    let cx = 400, cy = 260;
    if (svg) {
      const vb = svg.viewBox.baseVal;
      cx = vb.width  > 0 ? vb.x + vb.width  / 2 : cx;
      cy = vb.height > 0 ? vb.y + vb.height / 2 : cy;
    }
    Model.addNode(type, Math.round((cx + (Math.random()*80-40)) / GRID) * GRID,
                        Math.round(cy / GRID) * GRID);
    Renderer.render();
  }

  /* ══════════════════════════════════════════════
     PUBLIC PROPERTY UPDATERS
  ══════════════════════════════════════════════ */
  function _propUpdate(nodeId, key, value) {
    Model.updateNode(nodeId, { [key]: value });
    Renderer.render();
  }

  function _edgeLabel(edgeId, label) {
    const e = Model.edges.find(x => x.id === edgeId);
    if (e) { e.label = label; Renderer.render(); bus.emit('dirty', {}); }
  }

  function _deleteNode(nodeId) {
    if (!confirm(t('Delete this node and its connections?','حذف هذه العقدة واتصالاتها؟'))) return;
    Model.deleteNode(nodeId);
    Properties.clear();
    Renderer.render();
  }

  /* ══════════════════════════════════════════════
     TEMPLATE LOADER
  ══════════════════════════════════════════════ */
  async function _loadTemplate(tplId) {
    if (!tplId) return;
    if (Model.nodes.length > 2 && !confirm(t('Replace current workflow with template?','استبدال سير العمل الحالي بالقالب؟'))) return;
    try {
      const d = await fetch(`/api/v1/workflow-templates/${tplId}`).then(r=>r.json());
      const tpl = d.template;
      Model.applyTemplate(tpl);
      Renderer.render();
      Properties.clear();
      bus.emit('dirty', {});
      toast(t('Template loaded.','تم تحميل القالب.'), 'success');
    } catch(e) { toast(e.message, 'error'); }
  }

  function _resetCanvas() {
    if (!confirm(t('Reset workflow to default (Start → End)?','إعادة تعيين سير العمل إلى الافتراضي؟'))) return;
    Model.applyTemplate(null);
    Renderer.render();
    Properties.clear();
    bus.emit('dirty', {});
  }

  /* ══════════════════════════════════════════════
     LINTER
  ══════════════════════════════════════════════ */
  function _validate() {
    const issues = Model.validate();
    const panel  = document.getElementById('wfValidation');
    if (!panel) return;
    if (!issues.length) {
      panel.style.display = 'block';
      panel.innerHTML = `<i class="fas fa-circle-check" style="color:#16845B"></i>
        <span style="color:#16845B;font-weight:600"> ${t('Workflow is valid.','سير العمل صالح.')}</span>`;
      toast(t('Workflow is valid.','سير العمل صالح.'), 'success');
      setTimeout(() => { panel.style.display = 'none'; }, 3000);
      return;
    }
    panel.style.display = 'block';
    panel.innerHTML = issues.map(i => `
      <span style="margin-right:1rem;color:${i.level==='error'?'#BD3B4B':'#9B6A13'}">
        <i class="fas ${i.level==='error'?'fa-xmark-circle':'fa-triangle-exclamation'}"></i> ${i.msg}
      </span>`).join('');
  }

  /* ══════════════════════════════════════════════
     SAVE
  ══════════════════════════════════════════════ */
  async function doSave(opts = {}) {
    try {
      const issues = Model.validate();
      const hardIssues = issues.filter(x => x.level === 'error');
      if (hardIssues.length) {
        toast(t('Fix workflow errors before saving.','أصلح أخطاء سير العمل قبل الحفظ.'), 'error');
        _validate();
        return false;
      }
      const payload = Model.serialize();
      await API.patchProduct(_productId, payload);
      const prevStage = _product.pge_stage || 0;
      if (prevStage < 4) {
        await API.snapshot(_productId, 4, { node_count: Model.nodes.length, edge_count: Model.edges.length });
        _product.pge_stage = 4;
      }
      Object.assign(_product, payload);
      bus.emit('saved', {});
      if (!opts.silent) toast(t('Workflow saved.','تم حفظ سير العمل.'), 'success');
      return true;
    } catch(e) { toast(t('Save failed: ','فشل الحفظ: ') + e.message, 'error'); return false; }
  }

  async function saveAndStay() { await doSave(); }
  async function saveAndNext() { const ok = await doSave(); if (ok) PGEShell.goToStage(5); }

  /* ══════════════════════════════════════════════
     FIT VIEW
     Scales the SVG to make the entire workflow
     visible inside the scroll container without
     horizontal or vertical clipping.
  ══════════════════════════════════════════════ */
  function _fitView() {
    const svg       = document.getElementById('wfSvg');
    const container = document.getElementById('wfCanvasScroll');
    if (!svg || !container || !Model.nodes.length) return;

    // Re-run the bounding-box fit (already done after render, but call again
    // in case the container was resized since last render)
    Renderer._fitCanvas();

    const vb = svg.viewBox.baseVal;
    if (!vb || vb.width <= 0 || vb.height <= 0) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;

    // Scale so the full workflow fits inside the container with a small margin
    const scaleX = (cw - 24) / vb.width;
    const scaleY = (ch - 24) / vb.height;
    const scale  = Math.min(scaleX, scaleY, 1); // never zoom in past 100%

    svg.style.width  = Math.round(vb.width  * scale) + 'px';
    svg.style.height = Math.round(vb.height * scale) + 'px';
    svg.style.minWidth  = '';
    svg.style.minHeight = '';

    // Scroll to top-left
    container.scrollTo({ top: 0, left: 0 });
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  window.PGEStage4 = {
    mount,
    _propUpdate, _edgeLabel, _deleteNode,
    _paletteDrag, _canvasDrop, _addNodeCenter,
    _loadTemplate, _resetCanvas, _validate,
    _fitView,
    saveAndStay, saveAndNext,
  };
})();
