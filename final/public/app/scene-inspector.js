// ============================================================================
//  app/scene-inspector.js — Live layer + property editor in the Design tab
//  ---------------------------------------------------------------------------
//  Bridges the Generate tab (canvas render output) with the Design tab
//  (editing surface). Walks the canvas for every rendered component, lists
//  them as clickable layers in panel-6, and shows a role-specific property
//  editor when a layer is selected.
//
//  Works with all three render paths:
//    - rules-renderer.js        → .rules-item  (Lock/QS/Notif/Dialog)
//    - surface-layout.js        → .surface-item (zone grammar)
//    - canvas.js / scenes.js    → .canvas-item  (legacy + addComp)
//
//  Auto-refreshes via MutationObserver on #canvas so Generate → Design is
//  always in sync without manual wiring.
// ============================================================================

(function () {
  'use strict';

  // --- role → icon glyph (compact, one-char-ish, no emoji rendering issues) ---
  var ROLE_ICON = {
    // surface-layout grammar roles
    'status-bar':           '▬',
    'expandable-app-bar':   '⊞',
    'collapsed-app-bar':    '⊟',
    'selection-app-bar':    '☰',
    'search-bar':           '⌕',
    'focus-block':          '◉',
    'focus-block-group':    '▦',
    'list':                 '☰',
    'detail-content':       '▤',
    'notification-list':    '♪',
    'bottom-navigation':    '⎯',
    'bottom-bar':           '▂',
    'bottom-dialog':        '▭',
    'center-dialog':        '▢',
    'lock-time':            '⏲',
    'lock-date':            '▦',
    'lock-shortcuts':       '◎',
    'quick-settings-panel': '⚙',
    'background':           '▣',
    'scrim':                '░',

    // rules-renderer (lock/notif/qs/dialog) roles
    'lockIndicator':    '🔒',
    'clock':            '⏲',
    'weatherDate':      '☁',
    'widgetsRow':       '▦',
    'nowBar':           '♫',
    'shortcutLeft':     '◎',
    'shortcutRight':    '◎',
    'unlockHint':       '⇡',
    'gestureBar':       '▬',
    'qsScreen':         '⚙',
    'notifScreen':      '♪',
    'tile':             '▦',
    'slider':           '▬',
    'primaryToggle':    '⦿',
    'secondaryToggle':  '◉',
    'mediaCast':        '⇆',
    'headerAction':     '⋯',
    'notifCard':        '▢',
    'compactCard':      '▢',
    'priorityCard':     '▢',
    'sectionLabel':     'Aa',
    'compactTemporal':  '⏲',
    'dragHandle':       '⌇',
    'overflowToggle':   '⋯',
    'dimOverlay':       '░',
    'dialogShell':      '▭',
    'dialogSiteHeader': 'Aa',
    'dialogBrowserBar': '⌕',
    'dialogIconGrid':   '▦',
    'dialogPageDots':   '•'
  };

  function iconFor(role) { return ROLE_ICON[role] || '◻'; }

  function getCanvasInner() {
    var canvas = document.getElementById('canvas');
    if (!canvas) return null;
    return canvas._rulesInner || canvas;
  }

  // Return all top-level rendered components currently on the canvas.
  function getCanvasItems() {
    var inner = getCanvasInner();
    if (!inner) return [];
    return Array.from(
      inner.querySelectorAll(':scope > .canvas-item, :scope > .rules-item, :scope > .surface-item')
    );
  }

  function getItemRole(el) {
    return el.dataset.role || el.getAttribute('data-role') || el.dataset.compType || 'unknown';
  }

  // --- Main: refresh the Layers list in the Design tab ---
  function refreshSceneInspector() {
    var list = document.getElementById('sceneLayersList');
    if (!list) return;

    // Prefer DesignDoc as source of truth; fall back to DOM walk
    var nodes = [];
    if (window.DesignDoc && window.DesignDoc.state && window.DesignDoc.state.nodes.length) {
      nodes = window.DesignDoc.state.nodes.map(function (n) {
        var el = document.querySelector('[data-node-id="' + n.id + '"]');
        return {
          id: n.id,
          role: n.role,
          // Group nodes carry isGroup flag in props — surface as a flag
          // here so the rendering can distinguish container from leaf.
          isGroup:  !!(n.props && n.props.isGroup),
          parentId: (n.props && n.props.parentId) || null,
          el: el,
          w: el ? Math.round(el.offsetWidth || 0) : 0,
          h: el ? Math.round(el.offsetHeight || 0) : 0,
          selected: el && el.classList.contains('selected')
        };
      });
    } else {
      nodes = getCanvasItems().map(function (el, idx) {
        if (!el.id) el.id = 'canvas-item-auto-' + idx;
        if (!el.dataset.nodeId) el.dataset.nodeId = el.id;
        return {
          id: el.dataset.nodeId,
          role: getItemRole(el),
          isGroup:  false,
          parentId: null,
          el: el,
          w: Math.round(el.offsetWidth || 0),
          h: Math.round(el.offsetHeight || 0),
          selected: el.classList.contains('selected')
        };
      });
    }

    // Build a hierarchy: groups first, then their children indented under
    // them. A child whose parentId matches a group node renders nested.
    // Orphans (parentId not found) appear at the root.
    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    var rootNodes = [];
    var childrenOf = {};
    nodes.forEach(function (n) {
      if (n.parentId && byId[n.parentId]) {
        if (!childrenOf[n.parentId]) childrenOf[n.parentId] = [];
        childrenOf[n.parentId].push(n);
      } else {
        rootNodes.push(n);
      }
    });
    // Linearize for rendering: each root node, followed by its children.
    var linearNodes = [];
    rootNodes.forEach(function (n) {
      n.depth = 0;
      linearNodes.push(n);
      if (childrenOf[n.id]) {
        childrenOf[n.id].forEach(function (c) {
          c.depth = 1;
          linearNodes.push(c);
        });
      }
    });
    nodes = linearNodes;

    // Auto-collapse the whole Scene section when there are no components.
    // Re-expand as soon as nodes appear.
    var sceneSection = document.getElementById('ds-scene');
    if (!nodes.length) {
      if (sceneSection) sceneSection.classList.add('collapsed');
      list.innerHTML = '<div class="scene-empty">Generate a surface to see its components here.</div>';
      hideProps();
      return;
    }
    if (sceneSection) sceneSection.classList.remove('collapsed');

    // Color-coded role indicator — matches the Component Role panel in the
    // design tab so a designer can quickly map "this colored chip in the
    // layer list" to "this row in the Component Role legend". Colors are
    // pulled from the same palette CSS uses for [data-pipeline-role="..."].
    function _roleColor(role) {
      switch (role) {
        case 'chrome':     return '#94A3B8';
        case 'subject':    return '#86EFAC';
        case 'state':      return '#A5B4FC';
        case 'action':     return '#FDE68A';
        case 'feedback':   return '#FCA5A5';
        case 'context':    return '#A78BFA';
        case 'navigation': return '#7DD3FC';
        default:           return 'rgba(255,255,255,0.18)';
      }
    }
    // Group-role colors (subset of _roleColor + custom) — applied to the
    // dashed-border indicator on group rows so a designer can quickly
    // tell primary-task vs supporting vs tertiary in the layer list.
    function _groupRoleColor(role) {
      switch (role) {
        case 'primary-task': return 'rgba(134, 239, 172, 0.55)';   // green-ish
        case 'supporting':   return 'rgba(167, 139, 250, 0.55)';   // purple
        case 'tertiary':     return 'rgba(165, 180, 252, 0.45)';   // muted indigo
        case 'meta':         return 'rgba(148, 163, 184, 0.45)';   // gray
        case 'chrome':       return 'rgba(148, 163, 184, 0.35)';
        default:             return 'rgba(255,255,255,0.18)';
      }
    }
    list.innerHTML = '';
    nodes.forEach(function (n) {
      var row = document.createElement('div');
      row.className = 'scene-layer-row' +
        (n.selected ? ' active' : '') +
        (n.isGroup  ? ' is-group' : '');
      row.dataset.target = n.id;
      // Indentation per nesting depth — visual hierarchy.
      if (n.depth > 0) row.style.paddingLeft = (8 + n.depth * 14) + 'px';
      // Group rows: distinct visual — folder-like icon + uppercase role
      // tag. Items inherit the existing leaf styling.
      var iconHtml;
      if (n.isGroup) {
        // Group rows use a small "container" glyph and group-role's color
        // as the indicator.
        var groupRole = (n.role || '').replace(/^group:/, '');
        var colorTag = '<span style="' +
          'display:inline-block;width:10px;height:10px;border-radius:3px;' +
          'background:' + _groupRoleColor(groupRole) + ';' +
          'flex-shrink:0;margin-right:6px;vertical-align:middle;' +
          'border:1px dashed rgba(255,255,255,0.3);' +
        '"></span>';
        iconHtml = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="display:inline-block;vertical-align:middle;margin-right:4px;"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/></svg>';
        row.innerHTML =
          colorTag +
          '<span class="scene-layer-icon" style="opacity:0.7;">' + iconHtml + '</span>' +
          '<span class="scene-layer-role" style="text-transform:uppercase;letter-spacing:0.4px;font-size:10.5px;font-weight:600;opacity:0.85;">' + groupRole + '</span>' +
          '<span class="scene-layer-size" style="opacity:0.55;font-size:10.5px;">' + n.w + '×' + n.h + '</span>';
      } else {
        var colorTag = '<span style="' +
          'display:inline-block;width:10px;height:10px;border-radius:3px;' +
          'background:' + _roleColor(n.role) + ';' +
          'flex-shrink:0;margin-right:6px;vertical-align:middle;' +
        '"></span>';
        row.innerHTML =
          colorTag +
          '<span class="scene-layer-icon">' + iconFor(n.role) + '</span>' +
          '<span class="scene-layer-role">' + n.role + '</span>' +
          '<span class="scene-layer-size">' + n.w + '×' + n.h + '</span>';
      }

      row.addEventListener('click', function (e) {
        e.stopPropagation();
        var target = document.querySelector('[data-node-id="' + n.id + '"]');
        if (!target) return;

        // Unified selection through interactionState (also keeps .selected
        // identity class in sync for legacy code paths).
        if (typeof window.setSelectedNodes === 'function') {
          window.setSelectedNodes([n.id]);
        }
        if (window.DesignDoc && typeof window.DesignDoc.selectNode === 'function') {
          window.DesignDoc.selectNode(n.id);
        }

        if (typeof selectedItems !== 'undefined' && selectedItems && selectedItems.add) {
          selectedItems.clear();
          selectedItems.add(target.id);
        }

        if (typeof refineAutoPrefill === 'function') {
          try { refineAutoPrefill(target); } catch (err) {}
        }

        try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (err) {}

        list.querySelectorAll('.scene-layer-row').forEach(function (r) {
          r.classList.remove('active');
        });
        row.classList.add('active');

        showItemProps(n.id, target);

        // Auto-scroll the Design tab to the Properties section so the user
        // doesn't have to hunt for the editor after clicking a layer.
        requestAnimationFrame(function () {
          var props = document.getElementById('scenePropsSection');
          if (props && props.style.display !== 'none') {
            try { props.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
          }
        });
      });

      // Hover a layer row → update the single interaction store. The overlay
      // renderer draws the dashed box; no class toggle on DOM items.
      row.addEventListener('mouseenter', function () {
        if (typeof window.setHoveredNode === 'function') {
          window.setHoveredNode(n.id);
        }
      });
      row.addEventListener('mouseleave', function () {
        if (typeof window.setHoveredNode === 'function') {
          window.setHoveredNode(null);
        }
      });

      list.appendChild(row);
    });

    var selectedNode = nodes.find(function (n) { return n.selected; });
    if (selectedNode && selectedNode.el) showItemProps(selectedNode.id, selectedNode.el);
    else hideProps();
  }

  function hideProps() {
    var section = document.getElementById('scenePropsSection');
    if (section) section.style.display = 'none';
  }

  // --- Role-specific property editor ---
  // All edits route through DesignDoc.updateNode(id, patch) so the document
  // and DOM stay in lockstep.
  function showItemProps(nodeId, el) {
    var section = document.getElementById('scenePropsSection');
    var body = document.getElementById('scenePropsBody');
    var label = document.getElementById('scenePropsLabel');
    if (!section || !body || !el) return;

    var role = getItemRole(el);
    var node = (window.DesignDoc && window.DesignDoc.getNode) ? window.DesignDoc.getNode(nodeId) : null;
    label.textContent = 'Properties — ' + role;

    body.innerHTML = '';

    function commit(patch) {
      if (window.DesignDoc && typeof window.DesignDoc.updateNode === 'function') {
        window.DesignDoc.updateNode(nodeId, patch);
      }
    }

    // ——— Text / Title ———
    var textTarget = findTextTarget(el, role);
    var currentText = (node && node.props && (node.props.title || node.props.text || node.props.label)) ||
                      (textTarget ? textTarget.textContent : '');
    if (textTarget || (node && node.props)) {
      body.appendChild(propInputRow({
        id: 'sp-text',
        labelText: textLabelFor(role),
        value: currentText || '',
        onInput: function (v) { commit({ props: { title: v, text: v } }); }
      }));
    }

    // ——— expandable-app-bar: state snap (expanded/collapsed) ———
    if (role === 'expandable-app-bar') {
      var currentState = (node && node.state) || el.dataset.appBarState || 'expanded';
      body.appendChild(propRadioRow({
        id: 'sp-state',
        labelText: 'State',
        options: ['expanded', 'collapsed'],
        value: currentState,
        onChange: function (v) { commit({ state: v }); }
      }));
    }

    // ——— search-bar: placeholder ———
    if (role === 'search-bar') {
      var inner = el.firstElementChild;
      var placeholder =
        (node && node.props && node.props.placeholder) ||
        (inner ? (inner.textContent || '').trim() : '');
      body.appendChild(propInputRow({
        id: 'sp-placeholder',
        labelText: 'Placeholder',
        value: placeholder,
        onInput: function (v) { commit({ props: { placeholder: v || ' ' } }); }
      }));
    }

    // ——— Universal style tokens ———
    body.appendChild(propInputRow({
      id: 'sp-opacity',
      labelText: 'Opacity',
      value: (node && node.styles && node.styles.opacity) || el.style.opacity || '1',
      type: 'number',
      step: '0.05',
      min: '0',
      max: '1',
      onInput: function (v) { commit({ styles: { opacity: v } }); }
    }));

    body.appendChild(propInputRow({
      id: 'sp-radius',
      labelText: 'Border radius',
      value: (node && node.styles && node.styles.borderRadius) ||
             (el.firstElementChild && el.firstElementChild.style.borderRadius) || '',
      type: 'text',
      onInput: function (v) { commit({ styles: { borderRadius: v } }); }
    }));

    body.appendChild(propInputRow({
      id: 'sp-padding',
      labelText: 'Padding',
      value: (node && node.styles && node.styles.padding) ||
             (el.firstElementChild && el.firstElementChild.style.padding) || '',
      type: 'text',
      onInput: function (v) { commit({ styles: { padding: v } }); }
    }));

    body.appendChild(propInputRow({
      id: 'sp-bg',
      labelText: 'Background',
      value: (node && node.styles && node.styles.background) || '',
      type: 'text',
      onInput: function (v) { commit({ styles: { background: v } }); }
    }));

    body.appendChild(propInputRow({
      id: 'sp-color',
      labelText: 'Text color',
      value: (node && node.styles && node.styles.color) || '',
      type: 'text',
      onInput: function (v) { commit({ styles: { color: v } }); }
    }));

    body.appendChild(propInputRow({
      id: 'sp-fs',
      labelText: 'Font size',
      value: (node && node.styles && node.styles.fontSize) || '',
      type: 'text',
      onInput: function (v) { commit({ styles: { fontSize: v } }); }
    }));

    // ——— Delete ———
    var delRow = document.createElement('div');
    delRow.className = 'scene-prop-row';
    var delBtn = document.createElement('button');
    delBtn.className = 'scene-prop-input';
    delBtn.style.cssText =
      'background:rgba(255,68,68,0.1);color:#ff6b6b;border-color:rgba(255,68,68,0.35);cursor:pointer;padding:8px;';
    delBtn.textContent = 'Delete component';
    delBtn.addEventListener('click', function () {
      if (window.DesignDoc && typeof window.DesignDoc.deleteNode === 'function') {
        window.DesignDoc.deleteNode(nodeId);
      } else {
        el.remove();
      }
      if (typeof selectedItems !== 'undefined' && selectedItems && selectedItems.delete) {
        selectedItems.delete(el.id);
      }
      refreshSceneInspector();
    });
    delRow.appendChild(delBtn);
    body.appendChild(delRow);

    section.style.display = 'block';
  }

  function textLabelFor(role) {
    if (role === 'expandable-app-bar' || role === 'collapsed-app-bar' || role === 'selection-app-bar') return 'Title';
    if (role === 'lock-time') return 'Time';
    if (role === 'lock-date') return 'Date';
    if (role === 'search-bar') return 'Placeholder';
    return 'Text';
  }

  function findTextTarget(el, role) {
    // Strongest signals first
    var t = el.querySelector('[data-appbar-title]');
    if (t) return t;
    t = el.querySelector('[contenteditable]');
    if (t) return t;

    // For surface-layout status/app/list/dialog HTML: find the first child with text
    var nodes = el.querySelectorAll('div, span, h1, h2, h3, p, button');
    for (var i = 0; i < nodes.length; i++) {
      var c = nodes[i];
      var txt = (c.textContent || '').trim();
      if (c.children.length === 0 && txt.length > 0 && txt.length < 200) {
        return c;
      }
    }
    return null;
  }

  // --- UI row builders ---
  function propInputRow(opts) {
    var row = document.createElement('div');
    row.className = 'scene-prop-row';

    var lab = document.createElement('div');
    lab.className = 'scene-prop-label';
    lab.textContent = opts.labelText;

    var inp = document.createElement('input');
    inp.type = opts.type || 'text';
    inp.id = opts.id;
    inp.className = 'scene-prop-input';
    inp.value = opts.value || '';
    if (opts.step) inp.step = opts.step;
    if (opts.min !== undefined) inp.min = opts.min;
    if (opts.max !== undefined) inp.max = opts.max;
    inp.addEventListener('input', function (e) { opts.onInput(e.target.value); });

    row.appendChild(lab);
    row.appendChild(inp);
    return row;
  }

  function propRadioRow(opts) {
    var row = document.createElement('div');
    row.className = 'scene-prop-row';

    var lab = document.createElement('div');
    lab.className = 'scene-prop-label';
    lab.textContent = opts.labelText;

    var group = document.createElement('div');
    group.className = 'scene-prop-radio';

    opts.options.forEach(function (opt) {
      var labelEl = document.createElement('label');
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = opts.id;
      input.value = opt;
      if (opt === opts.value) input.checked = true;
      input.addEventListener('change', function (e) {
        if (e.target.checked) opts.onChange(opt);
      });
      var span = document.createElement('span');
      span.textContent = opt;
      labelEl.appendChild(input);
      labelEl.appendChild(span);
      group.appendChild(labelEl);
    });

    row.appendChild(lab);
    row.appendChild(group);
    return row;
  }

  // --- Auto-refresh when canvas changes (scenario switch / addComp / agent render) ---
  function initSceneObserver() {
    var canvas = document.getElementById('canvas');
    if (!canvas) return;

    var rafId = 0;
    var observer = new MutationObserver(function () {
      if (rafId) return;
      rafId = requestAnimationFrame(function () {
        rafId = 0;
        refreshSceneInspector();
      });
    });

    // DesignDoc is the single source of truth for renders. Subscribe to it
    // for ALL structural updates — no MutationObserver needed, which removes
    // the duplicate refresh that used to fire once per DOM mutation AND once
    // per DesignDoc event.
    if (window.DesignDoc && typeof window.DesignDoc.subscribe === 'function') {
      window.DesignDoc.subscribe(function (state, changeType, meta) {
        if (rafId) return;
        rafId = requestAnimationFrame(function () {
          rafId = 0;
          refreshSceneInspector();
        });
      });
    } else {
      // Fallback: observe canvas for legacy paths that don't use DesignDoc.
      observer.observe(canvas, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-role', 'data-node-id', 'data-group-id']
      });
    }

    // First paint
    refreshSceneInspector();
  }

  // When a canvas item is clicked directly, re-sync the inspector's highlight
  // row and property editor.
  document.addEventListener('click', function (e) {
    var target = e.target.closest('.canvas-item, .rules-item, .surface-item');
    if (!target) return;
    // let toggleSelect finish first, then refresh
    setTimeout(function () {
      refreshSceneInspector();
      if (target.classList.contains('selected')) {
        var nodeId = target.dataset.nodeId || target.id;
        showItemProps(nodeId, target);

        // Make sure the Design tab is active, then scroll the props section
        // and the matching layer row into view.
        var designTab = document.getElementById('panel-6');
        if (designTab && designTab.classList.contains('active')) {
          var props = document.getElementById('scenePropsSection');
          if (props && props.style.display !== 'none') {
            try { props.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (err) {}
          }
          var activeRow = document.querySelector('.scene-layer-row[data-target="' + nodeId + '"]');
          if (activeRow) {
            document.querySelectorAll('.scene-layer-row.active').forEach(function (r) { r.classList.remove('active'); });
            activeRow.classList.add('active');
          }
        }
      }
    }, 0);
  });

  // Expose
  window.refreshSceneInspector = refreshSceneInspector;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSceneObserver);
  } else {
    initSceneObserver();
  }
})();
