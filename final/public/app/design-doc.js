// ============================================================================
//  app/design-doc.js — Shared editable design document (single source of truth)
//  ---------------------------------------------------------------------------
//  Every rendered surface — rules-based (Lock/QS/Notif/Dialog), surface-grammar
//  (list/detail/dialog/etc.), and agent-generated — gets hydrated into this
//  document. Canvas DOM carries a `data-node-id` pointing back to its node.
//
//  Contract:
//    DesignDoc.state = {
//      surfaceType: string,
//      layout: { theme, variant, ... },
//      nodes: [
//        {
//          id:       stable string (== DOM data-node-id)
//          role:     one of ALLOWED_ROLES (e.g., 'expandable-app-bar')
//          type:     optional palette type (e.g., 'btn-contained'), else null
//          state:    optional state token (e.g., 'expanded'|'collapsed')
//          props:    { title, subtitle, placeholder, ... }
//          styles:   { opacity, backgroundColor, borderRadius, padding, fontSize, ... }
//          content:  { items[], tabs[], ... }
//          zone:     optional layout zone (topSystem|viewing|interaction|bottomNav|bottomBar|full)
//          html:     optional raw HTML fragment (for custom components)
//        }
//      ]
//    }
//
//  APIs (all emit 'change' unless noted):
//    DesignDoc.reset()
//    DesignDoc.set(doc)
//    DesignDoc.hydrateFromRenderModel(renderModel)      // agent output
//    DesignDoc.hydrateFromPlan(plan, surfaceType)       // surface-layout plan
//    DesignDoc.hydrateFromRulesPlan(plan, surfaceKey)   // rules-renderer plan
//    DesignDoc.hydrateFromCanvasDOM()                   // fallback: walk DOM
//    DesignDoc.getNode(id)                              // read-only
//    DesignDoc.updateNode(id, patch)                    // merge + apply to DOM
//    DesignDoc.deleteNode(id)                           // remove from doc + DOM
//    DesignDoc.selectNode(id)                           // sets 'selected' class
//    DesignDoc.subscribe(fn) → unsubscribe()
//    DesignDoc.debug()                                  // console.log the doc
// ============================================================================

(function () {
  'use strict';

  // --- Initial state ---
  var _state = {
    surfaceType: null,
    layout: {},
    nodes: []
  };

  var _listeners = new Set();
  var _selectedNodeId = null;
  var _nodeCounter = 0;

  function _emit(changeType, meta) {
    _listeners.forEach(function (fn) {
      try { fn(_state, changeType, meta || {}); } catch (e) { console.warn('[DesignDoc] listener error', e); }
    });
  }

  function _uid(prefix) {
    _nodeCounter++;
    return (prefix || 'node') + '-' + Date.now().toString(36) + '-' + _nodeCounter;
  }

  function _domForNode(id) {
    return document.querySelector('[data-node-id="' + id + '"]');
  }

  // --- Public API ---
  var DesignDoc = {
    // Direct state read — treat as immutable from outside
    get state() { return _state; },

    reset: function () {
      _state = { surfaceType: null, layout: {}, nodes: [] };
      _selectedNodeId = null;
      _emit('reset');
    },

    set: function (doc) {
      _state = {
        surfaceType: doc.surfaceType || null,
        layout: doc.layout || {},
        nodes: Array.isArray(doc.nodes) ? doc.nodes.slice() : []
      };
      _emit('set');
    },

    // Hydrate from an agent renderModel (the schema our server emits).
    // components[] → nodes[] with stable ids.
    hydrateFromRenderModel: function (renderModel) {
      if (!renderModel) return;
      var nodes = (renderModel.components || []).map(function (c, i) {
        return {
          id: c.id || _uid('agent'),
          role: c.role,
          type: c.type || null,
          state: c.state || null,
          props: _extractPropsFromContent(c),
          styles: c.styles && typeof c.styles === 'object' ? Object.assign({}, c.styles) : {},
          content: c.content && typeof c.content === 'object' ? Object.assign({}, c.content) : {},
          zone: c.zone || null,
          html: typeof c.html === 'string' && c.html.length ? c.html : null
        };
      });
      _state = {
        surfaceType: renderModel.surfaceType || (renderModel.layout && renderModel.layout.surfaceType) || null,
        layout: renderModel.layout ? Object.assign({}, renderModel.layout) : {},
        nodes: nodes
      };
      _selectedNodeId = null;
      _emit('hydrate', { source: 'renderModel' });
    },

    // Hydrate from a surface-layout plan (surface-layout.js composeSurfacePlan output)
    hydrateFromPlan: function (plan, surfaceType) {
      if (!plan) return;
      var nodes = (plan.components || []).map(function (c) {
        return {
          id: c.id || _uid('surface'),
          role: c.role,
          type: null,
          state: c.state || null,
          props: {},
          styles: {},
          content: {},
          zone: c.zone || null,
          html: null
        };
      });
      _state = {
        surfaceType: surfaceType || plan.surfaceType || null,
        layout: { surfaceType: surfaceType || plan.surfaceType || null },
        nodes: nodes
      };
      _selectedNodeId = null;
      _emit('hydrate', { source: 'surface-plan' });
    },

    // Hydrate from a rules-renderer plan (figma-accurate Lock/QS/Notif/Dialog)
    hydrateFromRulesPlan: function (plan, surfaceKey) {
      if (!plan) return;
      var nodes = (plan.components || []).map(function (c) {
        return {
          id: c.id || _uid('rules'),
          role: c.role,
          type: null,
          state: (c.variant && c.variant.state) || null,
          props: _extractPropsFromVariant(c.variant || {}),
          styles: {},
          content: {},
          zone: (c.position && c.position._zone) || null,
          cluster: (c.position && c.position._cluster) || null,
          position: c.position || null,
          html: null
        };
      });
      _state = {
        surfaceType: surfaceKey || plan.ctx || null,
        layout: { surfaceKey: surfaceKey, source: plan.source || null },
        nodes: nodes
      };
      _selectedNodeId = null;
      _emit('hydrate', { source: 'rules-plan' });
    },

    // Last-resort hydrate: walk current canvas DOM and rebuild doc from it.
    // Used when no plan is available (e.g., legacy templates, palette additions).
    hydrateFromCanvasDOM: function () {
      var canvas = document.getElementById('canvas');
      if (!canvas) return;
      var inner = canvas._rulesInner || canvas;
      var domItems = Array.from(
        inner.querySelectorAll(':scope > .canvas-item, :scope > .rules-item, :scope > .surface-item')
      );
      var nodes = domItems.map(function (el) {
        var role = el.dataset.role || el.getAttribute('data-role') || el.dataset.compType || 'unknown';
        var id = el.dataset.nodeId || el.id || _uid('dom');
        // Stamp data-node-id so later edits can find this element
        el.dataset.nodeId = id;
        if (!el.id) el.id = id;
        return {
          id: id,
          role: role,
          type: el.dataset.compType || null,
          state: el.dataset.appBarState || null,
          props: {},
          styles: {},
          content: {},
          zone: null,
          html: null
        };
      });
      _state = {
        surfaceType: canvas.dataset.rulesMode ? _state.surfaceType : _state.surfaceType,
        layout: _state.layout,
        nodes: nodes
      };
      _emit('hydrate', { source: 'dom' });
    },

    // After a render path places DOM items, call this to stamp data-node-id
    // onto each DOM element so updateNode can find them later. This is the
    // binding step between the document and the view.
    bindDOMToNodes: function () {
      var canvas = document.getElementById('canvas');
      if (!canvas) return;
      var inner = canvas._rulesInner || canvas;
      var domItems = Array.from(
        inner.querySelectorAll(':scope > .canvas-item, :scope > .rules-item, :scope > .surface-item')
      );
      var nodes = _state.nodes;

      // Match by order when counts align; otherwise match by role (first-available).
      if (domItems.length === nodes.length) {
        for (var i = 0; i < domItems.length; i++) {
          domItems[i].dataset.nodeId = nodes[i].id;
          if (!domItems[i].id) domItems[i].id = nodes[i].id;
        }
      } else {
        // Fallback: role-based greedy matching
        var nodeQueue = nodes.slice();
        domItems.forEach(function (el) {
          var role = el.dataset.role || el.getAttribute('data-role');
          var idx = nodeQueue.findIndex(function (n) { return n.role === role; });
          if (idx >= 0) {
            el.dataset.nodeId = nodeQueue[idx].id;
            if (!el.id) el.id = nodeQueue[idx].id;
            nodeQueue.splice(idx, 1);
          }
        });
      }
      _emit('bind');
    },

    // --- Node reads ---
    getNode: function (id) {
      return _state.nodes.find(function (n) { return n.id === id; }) || null;
    },

    // --- Node mutations ---
    updateNode: function (id, patch) {
      var node = this.getNode(id);
      if (!node) return false;

      // Deep-merge props/styles/content; shallow for top-level scalars.
      if (patch.props) node.props = Object.assign({}, node.props, patch.props);
      if (patch.styles) node.styles = Object.assign({}, node.styles, patch.styles);
      if (patch.content) node.content = Object.assign({}, node.content, patch.content);
      ['role', 'type', 'state', 'zone', 'html'].forEach(function (k) {
        if (patch[k] !== undefined) node[k] = patch[k];
      });

      // Apply to DOM surgically
      _applyPatchToDOM(node, patch);

      _emit('update', { nodeId: id, patch: patch });
      return true;
    },

    deleteNode: function (id) {
      var idx = _state.nodes.findIndex(function (n) { return n.id === id; });
      if (idx < 0) return false;
      var deletedNode = _state.nodes[idx];
      _state.nodes.splice(idx, 1);

      // Reflow vertical siblings below to close the gap. CSS transitions
      // on top/left make this slide smoothly.
      _reflowAfterDelete(deletedNode);

      var el = _domForNode(id);
      if (el) el.remove();
      if (_selectedNodeId === id) _selectedNodeId = null;
      _emit('delete', { nodeId: id });
      return true;
    },

    addNode: function (node) {
      var n = Object.assign(
        { id: _uid('manual'), role: 'unknown', type: null, props: {}, styles: {}, content: {}, state: null, zone: null, html: null },
        node
      );
      _state.nodes.push(n);
      _emit('add', { nodeId: n.id });
      return n;
    },

    reorderNode: function (id, targetIndex) {
      var idx = _state.nodes.findIndex(function (n) { return n.id === id; });
      if (idx < 0 || idx === targetIndex) return false;
      var n = _state.nodes.splice(idx, 1)[0];
      _state.nodes.splice(targetIndex, 0, n);
      _emit('reorder', { nodeId: id, from: idx, to: targetIndex });
      return true;
    },

    // Move `sourceId` to occupy the slot currently held by `targetId` within
    // the same vertical column (same x + w). Other siblings shift to preserve
    // the original sequence of y slots — so the visual stack stays compact.
    // Used by drag-drop reorder on expanded children (list-items, widget
    // cells, notif cards, palette-added items in the same column).
    reorderInColumn: function (sourceId, targetId) {
      if (!sourceId || !targetId || sourceId === targetId) return false;
      var src = this.getNode(sourceId);
      var tgt = this.getNode(targetId);
      if (!src || !tgt || !src.rect || !tgt.rect) return false;

      // Chrome (bottom-nav, gesture bar, shortcuts) can't be reordered.
      if (_isBottomAnchored(src) || _isBottomAnchored(tgt)) return false;

      // Same-column guard: items must share x/w within tolerance.
      if (Math.abs(src.rect.x - tgt.rect.x) > 4) return false;
      if (Math.abs(src.rect.w - tgt.rect.w) > 8) return false;

      // All column siblings (including src + tgt), sorted by current y.
      // Bottom-anchored chrome is excluded from the reorder pool.
      var siblings = _state.nodes.filter(function (n) {
        if (!n.rect) return false;
        if (_isBottomAnchored(n)) return false;
        return Math.abs(n.rect.x - src.rect.x) <= 4 &&
               Math.abs(n.rect.w - src.rect.w) <= 8;
      }).sort(function (a, b) { return a.rect.y - b.rect.y; });

      // Freeze the original slot Y values — nodes will be re-dealt into them.
      var slots = siblings.map(function (n) { return n.rect.y; });

      // Remove src, insert before tgt in the ordered list.
      var ordered = siblings.filter(function (n) { return n.id !== sourceId; });
      var tIdx = ordered.findIndex(function (n) { return n.id === targetId; });
      if (tIdx < 0) return false;
      ordered.splice(tIdx, 0, src);

      // Re-deal slot Y values in new order. CSS transition animates.
      ordered.forEach(function (n, i) {
        var newY = slots[i];
        if (n.rect.y === newY) return;
        n.rect.y = newY;
        var el = _domForNode(n.id);
        if (el) el.style.top = newY + 'px';
      });

      _emit('reorder', { movedId: sourceId, targetId: targetId });
      return true;
    },

    // --- Selection ---
    selectNode: function (id) {
      if (_selectedNodeId === id) return;
      _selectedNodeId = id;
      document.querySelectorAll(
        '.canvas-item.selected, .rules-item.selected, .surface-item.selected'
      ).forEach(function (el) { el.classList.remove('selected'); });
      if (id) {
        var el = _domForNode(id);
        if (el) el.classList.add('selected');
      }
      _emit('select', { nodeId: id });
    },

    getSelection: function () { return _selectedNodeId; },

    // --- Observers ---
    subscribe: function (fn) {
      _listeners.add(fn);
      return function () { _listeners.delete(fn); };
    },

    debug: function () {
      console.log('[DesignDoc]', JSON.parse(JSON.stringify(_state)));
      return _state;
    }
  };

  // === Internal helpers =====================================================

  // Pull "props" out of the agent's loose content/text fields. Our canonical
  // props shape for editing: { title, subtitle, placeholder, label, text }.
  function _extractPropsFromContent(comp) {
    var p = {};
    if (comp.text) p.text = comp.text;
    if (comp.content && typeof comp.content === 'object') {
      if (comp.content.title) p.title = comp.content.title;
      if (comp.content.subtitle) p.subtitle = comp.content.subtitle;
      if (comp.content.placeholder) p.placeholder = comp.content.placeholder;
      if (comp.content.label) p.label = comp.content.label;
    }
    return p;
  }

  function _extractPropsFromVariant(variant) {
    var p = {};
    if (variant.title)       p.title       = variant.title;
    if (variant.text)        p.text        = variant.text;
    if (variant.label)       p.label       = variant.label;
    if (variant.placeholder) p.placeholder = variant.placeholder;
    // Notif-card-specific
    if (variant.app)   p.app   = variant.app;
    if (variant.body)  p.body  = variant.body;
    if (variant.time)  p.time  = variant.time;
    // List-item / widget-specific
    if (variant.subtitle) p.subtitle = variant.subtitle;
    if (variant.value)    p.value    = variant.value;
    if (variant.sub)      p.sub      = variant.sub;
    if (variant.primary)  p.primary  = variant.primary;
    if (variant.secondary) p.secondary = variant.secondary;
    return p;
  }

  // Apply a patch to the node's DOM element without re-rendering the whole
  // canvas. Handles: text content, app-bar state snap, opacity, background,
  // borderRadius, padding, fontSize, color.
  function _applyPatchToDOM(node, patch) {
    var el = _domForNode(node.id);
    if (!el) return;

    // ── state (expandable-app-bar) ──
    if (patch.state !== undefined && node.role === 'expandable-app-bar') {
      if (typeof window.setExpandableAppBarState === 'function') {
        window.setExpandableAppBarState(el, patch.state);
      } else {
        el.dataset.appBarState = patch.state;
      }
    }

    // ── props.text / title / placeholder / subtitle → first text target ──
    if (patch.props) {
      var text = patch.props.title || patch.props.text || patch.props.label;
      if (text !== undefined) {
        var tTarget = _findTextTarget(el);
        if (tTarget) tTarget.textContent = text;
      }
      if (patch.props.placeholder !== undefined) {
        var phTarget = el.querySelector('input') || _findTextTarget(el);
        if (phTarget) {
          if (phTarget.tagName === 'INPUT') phTarget.placeholder = patch.props.placeholder;
          else phTarget.textContent = patch.props.placeholder;
        }
      }
      if (patch.props.subtitle !== undefined) {
        // Find a secondary text node (second text-only child)
        var all = el.querySelectorAll('div, span');
        var textOnly = Array.from(all).filter(function (n) {
          return n.children.length === 0 && (n.textContent || '').trim().length > 0;
        });
        if (textOnly[1]) textOnly[1].textContent = patch.props.subtitle;
      }
    }

    // ── styles → inline style overrides ──
    if (patch.styles) {
      Object.keys(patch.styles).forEach(function (prop) {
        var value = patch.styles[prop];
        // Forbid layout props
        if (['x','y','top','left','right','bottom','width','height','position'].indexOf(prop) >= 0) return;

        var cssProp = prop.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
        // For color/background/opacity: apply to wrapper
        // For border-radius / padding / font-size: apply to first child (content surface)
        if (prop === 'opacity' || prop === 'transform') {
          el.style[cssProp] = value;
        } else if (prop === 'background' || prop === 'backgroundColor' || prop === 'color') {
          var firstChild = el.firstElementChild || el;
          firstChild.style[cssProp] = value;
        } else if (prop === 'borderRadius' || prop === 'border-radius') {
          var fc = el.firstElementChild || el;
          fc.style.borderRadius = value;
        } else if (prop === 'padding' || prop === 'fontSize' || prop === 'font-size' ||
                   prop === 'fontWeight' || prop === 'font-weight') {
          var fc2 = el.firstElementChild || el;
          fc2.style[cssProp] = value;
        } else {
          el.style[cssProp] = value;
        }
      });
    }

    // ── html replacement (advanced) ──
    if (patch.html !== undefined && patch.html !== null) {
      el.innerHTML = patch.html;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  //  Reflow — close the gap left by a deleted node by shifting siblings in
  //  the same vertical column up. Works for any node whose rect is present:
  //    - preset-expanded children (notif cards, list-items, widget cells)
  //    - palette-added items (addComp) stacked in the interaction zone
  //    - manually-placed nodes with matching x/width in the column
  //
  //  Siblings are identified as nodes whose rect has the same left/right
  //  edges (within tolerance). Only those vertically BELOW the deleted node
  //  are shifted up. Shift amount = the exact Y distance from the deleted
  //  top to the next sibling top, so arbitrary gaps are preserved.
  // ────────────────────────────────────────────────────────────────────────

  // Roles / zones that are pinned to the bottom of the screen — these must
  // NEVER slide up to fill a gap above them (bottom-nav, gesture bar, bottom
  // action bar, etc. stay where they are; only mid-column items reflow).
  var BOTTOM_ANCHORED_ROLES = new Set([
    'bottom-navigation', 'bottom-bar', 'bottom-dialog',
    'gestureBar', 'gesture-bar', 'nav-gesture-bar',
    'lock-shortcuts', 'dialog-nav-gesture-bar',
    // rules-renderer lock-screen bottom chrome
    'shortcutLeft', 'shortcutRight', 'nowBar'
  ]);
  var BOTTOM_ANCHORED_ZONES = new Set(['bottomNav', 'bottomBar']);

  function _isBottomAnchored(node) {
    if (!node) return false;
    if (BOTTOM_ANCHORED_ROLES.has(node.role)) return true;
    if (node.zone && BOTTOM_ANCHORED_ZONES.has(node.zone)) return true;
    return false;
  }

  function _reflowAfterDelete(deletedNode) {
    if (!deletedNode || !deletedNode.rect) return;
    var siblings = _findVerticalSiblings(deletedNode);
    if (!siblings.length) return;

    // Only items BELOW the deleted one slide up — and only if they're NOT
    // bottom-anchored chrome (those must stay pinned regardless of what
    // gets deleted above them).
    var below = siblings
      .filter(function (n) {
        if (!n.rect) return false;
        if (n.rect.y <= deletedNode.rect.y) return false;
        if (_isBottomAnchored(n)) return false;
        return true;
      })
      .sort(function (a, b) { return a.rect.y - b.rect.y; });

    if (!below.length) return;

    // Shift = Y distance from deleted top to first-below top.
    // That consumes both deleted.h and the gap between it and the next item.
    var shift = below[0].rect.y - deletedNode.rect.y;

    below.forEach(function (sib) {
      sib.rect.y = Math.max(0, sib.rect.y - shift);
      var el = _domForNode(sib.id);
      if (el) {
        // CSS transition on top animates the slide smoothly.
        el.style.top = sib.rect.y + 'px';
      }
    });
  }

  // Nodes in the same vertical column as the reference node (same x + w,
  // allowing small tolerance for subpixel rendering).
  function _findVerticalSiblings(ref) {
    if (!ref || !ref.rect) return [];
    var rx = ref.rect.x, rw = ref.rect.w;
    return _state.nodes.filter(function (n) {
      if (!n.rect || n.id === ref.id) return false;
      return Math.abs(n.rect.x - rx) <= 4 && Math.abs(n.rect.w - rw) <= 8;
    });
  }

  function _findTextTarget(el) {
    var t = el.querySelector('[data-appbar-title]');
    if (t) return t;
    t = el.querySelector('[contenteditable]');
    if (t) return t;
    var nodes = el.querySelectorAll('div, span, h1, h2, h3, p, button');
    for (var i = 0; i < nodes.length; i++) {
      var c = nodes[i];
      if (c.children.length === 0 && (c.textContent || '').trim().length > 0) return c;
    }
    return null;
  }

  // Expose
  window.DesignDoc = DesignDoc;
})();
