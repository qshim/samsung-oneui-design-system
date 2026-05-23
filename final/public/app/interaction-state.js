// ============================================================================
//  app/interaction-state.js — Unified interaction store + overlay renderer
//  ---------------------------------------------------------------------------
//  Single source of truth for hover / selection / focus / drag on the canvas.
//  DOM nodes are stateless: they do NOT carry `.hovered` / `.selected` classes
//  as visual-truth. The overlay layer reads interactionState and draws boxes.
//
//  Why this exists:
//    - Per-element mouseenter/mouseleave leaked stale hover after rerender.
//    - Generated and palette-added components now share one node schema via
//      DesignDoc; selection must work identically for both.
//    - Future multi-select / drag / resize / refine-preview all need a
//      canonical rect table on the document.
//
//  Public surface (window.*):
//    interactionState           — { hoveredNodeId, selectedNodeIds[], focusedNodeId, dragNodeId }
//    setHoveredNode(id|null)
//    setSelectedNodes(idsArray)
//    toggleSelectNode(id)       — shift-click behaviour
//    clearInteractionState()    — full reset (called on every hydrate)
//    hitTestNodeIdFromPoint(x,y)
//    renderInteractionOverlay() — redraws overlay boxes from state
//    measureAllNodeRects()      — stamps `node.rect` onto every DesignDoc node
//    bindCanvasPointerTracking()— binds pointermove/leave on #canvas
// ============================================================================

(function () {
  'use strict';

  // === State ===============================================================
  var state = {
    hoveredNodeId: null,
    selectedNodeIds: [],
    focusedNodeId: null,
    dragNodeId: null
  };

  window.interactionState = state;

  var _listeners = new Set();
  function _notify() {
    _listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.warn('[interactionState] listener error', e); }
    });
  }
  window.onInteractionChange = function (fn) {
    _listeners.add(fn);
    return function () { _listeners.delete(fn); };
  };

  // === Setters =============================================================
  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function setHoveredNode(id) {
    if (state.hoveredNodeId === id) return;
    state.hoveredNodeId = id || null;
    renderInteractionOverlay();
    _notify();
  }

  function setSelectedNodes(ids) {
    var arr = Array.isArray(ids) ? ids.slice() : (ids ? [ids] : []);
    if (arraysEqual(arr, state.selectedNodeIds)) return;
    state.selectedNodeIds = arr;
    _syncSelectedClasses();
    renderInteractionOverlay();
    _notify();
  }

  function toggleSelectNode(id) {
    if (!id) return;
    var cur = state.selectedNodeIds.slice();
    var idx = cur.indexOf(id);
    if (idx >= 0) cur.splice(idx, 1);
    else cur.push(id);
    setSelectedNodes(cur);
  }

  function clearInteractionState() {
    state.hoveredNodeId = null;
    state.selectedNodeIds = [];
    state.focusedNodeId = null;
    state.dragNodeId = null;
    _syncSelectedClasses();
    renderInteractionOverlay();
    _notify();
  }

  // Keep `.selected` class + legacy `selectedItems` Set in sync so existing
  // code (groupSelected, refineAutoPrefill, etc.) reads the correct state.
  function _syncSelectedClasses() {
    document.querySelectorAll('.canvas-item.selected, .rules-item.selected, .surface-item.selected')
      .forEach(function (el) { el.classList.remove('selected'); });
    state.selectedNodeIds.forEach(function (id) {
      var el = document.querySelector('[data-node-id="' + id + '"]');
      if (el) el.classList.add('selected');
    });
    // Legacy selectedItems Set (canvas.js groupSelected reads this)
    if (typeof selectedItems !== 'undefined' && selectedItems && selectedItems.clear) {
      selectedItems.clear();
      state.selectedNodeIds.forEach(function (id) { selectedItems.add(id); });
    }
  }

  // === Hit-test ============================================================
  function hitTestNodeIdFromPoint(clientX, clientY) {
    var els = document.elementsFromPoint(clientX, clientY);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      // Skip the overlay itself (it has pointer-events:none anyway, but defensive)
      if (el && el.classList && el.classList.contains('interaction-overlay')) continue;
      if (el && el.dataset && el.dataset.nodeId) return el.dataset.nodeId;
    }
    return null;
  }

  // === Overlay =============================================================
  function _getOverlayHost() {
    var canvas = document.getElementById('canvas');
    if (!canvas) return null;
    // In rules-mode, the scaled _rulesInner holds the drawn nodes. Putting
    // the overlay there means it scales with them and shares the same
    // coordinate space as getBoundingClientRect measurements.
    return canvas._rulesInner || canvas;
  }

  function _getOrCreateOverlay() {
    var host = _getOverlayHost();
    if (!host) return null;

    var overlay = host.querySelector(':scope > .interaction-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'interaction-overlay';
      overlay.id = 'interactionOverlay';
      overlay.style.cssText =
        'position:absolute;inset:0;pointer-events:none;z-index:700;overflow:visible;';
      host.appendChild(overlay);
    }
    return overlay;
  }

  function _measureRectForNodeId(id) {
    var el = document.querySelector('[data-node-id="' + id + '"]');
    if (!el) return null;
    // Use offsetLeft/Top/Width/Height (layout-space, pre-transform).
    // getBoundingClientRect returns post-transform viewport pixels, which is
    // wrong for our overlay because the overlay itself lives inside the same
    // transformed parent (_rulesInner has transform:scale(...)) and would
    // apply the scale a second time.
    return {
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight
    };
  }

  function _drawBox(rect, className) {
    var box = document.createElement('div');
    box.className = className;
    box.style.cssText =
      'position:absolute;' +
      'left:' + rect.x + 'px;' +
      'top:' + rect.y + 'px;' +
      'width:' + rect.w + 'px;' +
      'height:' + rect.h + 'px;';
    return box;
  }

  function renderInteractionOverlay() {
    var overlay = _getOrCreateOverlay();
    if (!overlay) return;
    overlay.innerHTML = '';

    var doc = (window.DesignDoc && window.DesignDoc.state) || null;

    // Hover box (dashed, lower z)
    if (state.hoveredNodeId) {
      var hNode = doc ? doc.nodes.find(function (n) { return n.id === state.hoveredNodeId; }) : null;
      var hRect = (hNode && hNode.rect) || _measureRectForNodeId(state.hoveredNodeId);
      if (hRect) overlay.appendChild(_drawBox(hRect, 'ix-hover-box'));
    }

    // Selected boxes (solid, higher z)
    state.selectedNodeIds.forEach(function (id) {
      var sNode = doc ? doc.nodes.find(function (n) { return n.id === id; }) : null;
      var sRect = (sNode && sNode.rect) || _measureRectForNodeId(id);
      if (sRect) overlay.appendChild(_drawBox(sRect, 'ix-selected-box'));
    });
  }

  // Store rect on every DesignDoc node so the overlay can render without
  // hitting the DOM on every frame. Call AFTER layout (requestAnimationFrame).
  function measureAllNodeRects() {
    if (!window.DesignDoc || !window.DesignDoc.state) return;
    window.DesignDoc.state.nodes.forEach(function (node) {
      var r = _measureRectForNodeId(node.id);
      if (r) node.rect = r;
    });
  }

  // === Interaction mode (Cmd/Ctrl held) ====================================
  // When the user holds Cmd (⌘) or Ctrl, hover/selection is suppressed and
  // the user can interact with the rendered component directly — flip
  // toggles, drag sliders, check radios. The body class lets CSS flip the
  // cursor and fade the overlay, and the event handlers below early-exit
  // so native click bubbles through to onclick handlers on the atomics.
  var _interactKeyHeld = false;
  function _isInteractEvent(e) {
    return !!(e && (e.metaKey || e.ctrlKey));
  }
  function _setInteractMode(on) {
    if (_interactKeyHeld === on) return;
    _interactKeyHeld = on;
    if (on) {
      document.body.classList.add('cmd-interact-mode');
      // Clear any hover overlay immediately so it doesn't linger behind
      // the live component while the user interacts with it.
      setHoveredNode(null);
    } else {
      document.body.classList.remove('cmd-interact-mode');
    }
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Meta' || e.key === 'Control') _setInteractMode(true);
  });
  document.addEventListener('keyup', function (e) {
    if (e.key === 'Meta' || e.key === 'Control') _setInteractMode(false);
  });
  // If the window loses focus while the key is held (Cmd+Tab) the keyup
  // event never fires — reset on blur to avoid a stuck interact-mode.
  window.addEventListener('blur', function () { _setInteractMode(false); });

  // === Pointer tracking ====================================================
  function bindCanvasPointerTracking() {
    var canvas = document.getElementById('canvas');
    if (!canvas) return;
    if (canvas._ixPointerBound) return;
    canvas._ixPointerBound = true;

    // Throttle pointermove to one hit-test per frame. Prevents layout thrash
    // on fast cursor movement (hit-test + overlay redraw per event was ~60
    // calls/second on a normal drag).
    var _pmRaf = 0, _pmX = 0, _pmY = 0;
    canvas.addEventListener('pointermove', function (e) {
      // Interact mode: suppress hover so the overlay doesn't occlude the live
      // component. Clear any existing hover so it disappears immediately.
      if (_isInteractEvent(e)) {
        if (state.hoveredNodeId) setHoveredNode(null);
        return;
      }
      _pmX = e.clientX; _pmY = e.clientY;
      if (_pmRaf) return;
      _pmRaf = requestAnimationFrame(function () {
        _pmRaf = 0;
        var id = hitTestNodeIdFromPoint(_pmX, _pmY);
        setHoveredNode(id);
      });
    });

    // pointerleave on the canvas element is the definitive "no more hover"
    // trigger — eliminates the stale-box problem from per-item mouseleave.
    canvas.addEventListener('pointerleave', function () {
      setHoveredNode(null);
    });

    canvas.addEventListener('click', function (e) {
      // Interact mode: let the click land on the component itself (toggle
      // chip, switch, radio onclicks) without selecting/deselecting.
      if (_isInteractEvent(e)) return;

      // MLP test3 (health home): intro runner pill → switch to home widgets (front-only)
      try {
        var actionEl = e.target && e.target.closest ? e.target.closest('[data-mlp-action="mlp-intro-to-home"]') : null;
        if (actionEl && typeof window.__mlpTest3GoHome === 'function' && window.__mlpTest3GoHome()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      } catch (_) {}

      var id = hitTestNodeIdFromPoint(e.clientX, e.clientY);
      if (!id) {
        // Clicked empty canvas → deselect
        setSelectedNodes([]);
        return;
      }
      if (e.shiftKey) toggleSelectNode(id);
      else setSelectedNodes([id]);

      // Keep DesignDoc selection in sync so scene-inspector prop editor opens
      if (window.DesignDoc && typeof window.DesignDoc.selectNode === 'function') {
        window.DesignDoc.selectNode(id);
      }
    });
  }

  // === Wiring: DesignDoc hydrate → reset + remeasure overlay ===============
  function initDesignDocBridge() {
    if (!window.DesignDoc || typeof window.DesignDoc.subscribe !== 'function') return;

    window.DesignDoc.subscribe(function (docState, changeType) {
      // A new scene was hydrated. Previous hovered/selected IDs are stale.
      if (changeType === 'hydrate' || changeType === 'reset' || changeType === 'set') {
        clearInteractionState();
      }

      // After render, wait one frame so DOM has settled, then measure +
      // redraw. Two rAFs to survive scale transforms and image decode.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          measureAllNodeRects();
          renderInteractionOverlay();
        });
      });

      // On delete / reorder / add: just 2 measurements — one immediately,
      // one after the CSS transition finishes (~260ms). That keeps the
      // overlay box synced without burning 15 frames worth of work.
      if (changeType === 'delete' || changeType === 'reorder' || changeType === 'add' || changeType === 'update') {
        requestAnimationFrame(function () {
          measureAllNodeRects();
          renderInteractionOverlay();
        });
        setTimeout(function () {
          measureAllNodeRects();
          renderInteractionOverlay();
        }, 280);
      }
    });
  }

  // === Init ================================================================
  function init() {
    bindCanvasPointerTracking();
    _getOrCreateOverlay();
    initDesignDocBridge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // === Exports ==============================================================
  window.setHoveredNode = setHoveredNode;
  window.setSelectedNodes = setSelectedNodes;
  window.toggleSelectNode = toggleSelectNode;
  window.clearInteractionState = clearInteractionState;
  window.hitTestNodeIdFromPoint = hitTestNodeIdFromPoint;
  window.renderInteractionOverlay = renderInteractionOverlay;
  window.measureAllNodeRects = measureAllNodeRects;
  window.bindCanvasPointerTracking = bindCanvasPointerTracking;
})();
