// ============================================================================
//  app/canvas.js — canvas item manipulation: add/drag/select/group/clear
//  ---------------------------------------------------------------------------
//  All functions that mutate the #canvas DOM tree: adding components from the
//  palette, drag-and-drop reorder, selection, grouping, and clearing.
//  Cross-module: references refineAutoPrefill (ui-panels.js) — safe because
//  toggleSelect is only invoked at runtime, not at load.
// ============================================================================

// === ADD COMPONENT ===
// When the scene is empty, palette items should fill from the top (right
// below the status bar) rather than starting at ~58% interaction-zone Y.
// _getFillZone returns the full usable column: from below status bar down to
// above bottom-nav. _nextPaletteSlot stacks new items inside that column.
function _getFillZone() {
  const surfaceType =
    (window.DesignDoc && window.DesignDoc.state && window.DesignDoc.state.surfaceType) ||
    window.currentSurfaceType ||
    (window.SURFACE_TYPES && window.SURFACE_TYPES.FIRST_DEPTH_LIST) ||
    'first-depth-list';
  if (typeof window.createOneUILayout !== 'function') return null;
  const layout = window.createOneUILayout({ width: 451, height: 978 }, surfaceType);
  const z = layout && layout.zones;
  if (!z) return null;
  const topY = z.topSystem.y + z.topSystem.h + 8;   // right below status bar
  const bottomY = z.bottomNav ? z.bottomNav.y - 8 : 920;
  return {
    x: z.topSystem.x,
    y: topY,
    w: z.topSystem.w,
    h: Math.max(0, bottomY - topY)
  };
}
// Back-compat alias (older callers).
function _getInteractionZone() { return _getFillZone(); }

// Full-canvas decorative roles — excluded from the collision check because
// their bbox covers the whole viewport (palette items would stack forever).
const _PALETTE_COLLISION_SKIP_ROLES = new Set([
  'background', 'scrim', 'dimOverlay', 'wallpaper'
]);

function _nextPaletteSlot(zone) {
  // Find the bottom of the lowest existing component whose rect overlaps the
  // interaction zone's horizontal span. New item goes 8px below that.
  const canvas = document.getElementById('canvas');
  const host = (canvas && canvas._rulesInner) || canvas;
  if (!host) return { x: zone.x, y: zone.y, w: zone.w };

  const items = host.querySelectorAll(':scope > [data-node-id]');
  const zoneLeft  = zone.x;
  const zoneRight = zone.x + zone.w;
  let occupiedBottom = zone.y;   // start at zone top

  items.forEach(el => {
    const role = el.dataset.role || '';
    if (_PALETTE_COLLISION_SKIP_ROLES.has(role)) return;

    const top    = el.offsetTop;
    const left   = el.offsetLeft;
    const right  = left + el.offsetWidth;
    const bottom = top + el.offsetHeight;

    // Only items horizontally overlapping the zone block the palette column
    const overlapsX = !(right <= zoneLeft || left >= zoneRight);
    if (!overlapsX) return;

    // Skip items that are strictly below the zone (e.g. bottom-navigation,
    // bottom-bar) — they don't block the top of the zone.
    if (top >= zone.y + zone.h) return;

    if (bottom > occupiedBottom) occupiedBottom = bottom;
  });

  const hasContentAbove = occupiedBottom > zone.y;
  return {
    x: zone.x,
    y: occupiedBottom + (hasContentAbove ? 8 : 0),
    w: zone.w
  };
}

function addComp(type) {
  const canvas = document.getElementById('canvas');
  const hint = document.getElementById('canvasHint');
  if (hint) hint.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'canvas-item palette-addition';
  if (fullWidthTypes.has(type)) wrapper.classList.add('full-width');
  wrapper.id = 'item-' + (++itemCounter);
  wrapper.dataset.compType = type;
  wrapper.dataset.role = type;       // palette type == role for inspector
  wrapper.dataset.nodeId = wrapper.id;
  wrapper.dataset.zone = 'interaction';
  // Render content. Decision order:
  //   1. If `type` is a OneUI 8.5 role → force renderAtomicForRole (prevents
  //      legacy `templates['list-item']` from shadowing the surface-grammar
  //      version — same string, different renderer).
  //   2. Else if templates has it → legacy Material-style HTML.
  //   3. Else fall through to renderAtomicForRole / placeholder.
  var ONEUI_ROLES = new Set([
    'status-bar','app-dock','focus-block','search-bar','list-item',
    'notifCard','bottom-navigation','bottom-bar','expandable-app-bar',
    'collapsed-app-bar','selection-app-bar','app-icon','paragraph',
    'action-row','focus-block-group','app-grid','scrim',
    // OneUI 8.5 QS/Media/Notif atomics
    'toggle-chip','toggle-grid','slider-pill','slider-panel','drag-handle',
    'now-bar','media-card','media-half','notif-card','notif-card-ai','output-chip','progress-track',
    // QS composition atomics (added for labeled toggle / vertical slider /
    // control pill rows / media-output row / action tiles).
    'control-pill','media-output-row','qs-action-tile',
    // Figma-exact atomics (SingleToggle Half/Single × Toggle/Shortcut,
    // SmartThings 415×88 row).
    'single-toggle','smart-things',
    // Lock-screen atomics (huge clock, weather+date, padlock, unlock hint)
    'lock-clock','weather-date','lock-indicator','unlock-hint',
    // List-screen selection dialog (Figma 629:1602 dark / 629:1603 light)
    'selection-dialog',
    // List-screen compact header (Figma 989:22761: big time + date inline)
    'list-top-bar',
    // Dialog-overlay atomics (Figma InternetPopOutMenu 3074:6464) —
    // shell, website share header, 5-button browser bar, 2×4 icon grid.
    'dialog-shell','dialog-site-header','dialog-browser-bar','dialog-icon-grid'
  ]);
  if (ONEUI_ROLES.has(type) && typeof window.renderAtomicForRole === 'function') {
    wrapper.innerHTML = window.renderAtomicForRole(
      { role: type, variant: {}, content: {}, state: null },
      { w: 380, h: 80 }
    );
  } else if (typeof templates[type] === 'function') {
    wrapper.innerHTML = templates[type]();
  } else if (typeof window.renderAtomicForRole === 'function') {
    wrapper.innerHTML = window.renderAtomicForRole(
      { role: type, variant: {}, content: {}, state: null },
      { w: 380, h: 80 }
    );
  } else {
    wrapper.innerHTML = '<div style="padding:12px;color:var(--text-2);font-size:12px;">' + type + '</div>';
  }
  // Click / hover: centralized via interaction-state.js canvas-level tracker.
  wrapper.setAttribute('draggable', 'true');
  initDrag(wrapper);

  // Target surface: _rulesInner (rules-mode) or the canvas itself (surface/legacy).
  const target = canvas._rulesInner || canvas;

  // Position inside the interaction zone of the current surface.
  const zone = _getInteractionZone();
  if (zone) {
    const slot = _nextPaletteSlot(zone);
    wrapper.style.position = 'absolute';
    wrapper.style.left  = slot.x + 'px';
    wrapper.style.top   = slot.y + 'px';
    wrapper.style.width = slot.w + 'px';
    wrapper.style.boxSizing = 'border-box';
  }

  target.appendChild(wrapper);

  // Register in the shared design document (with zone + rect) so the Design
  // tab / inspector / overlay can edit it like any generated node.
  if (window.DesignDoc && typeof window.DesignDoc.addNode === 'function') {
    window.DesignDoc.addNode({
      id: wrapper.id,
      role: type,
      type: type,
      zone: 'interaction'
    });
  }

  // Entrance animation
  wrapper.style.animation = `fadeIn 300ms cubic-bezier(0.2,0,0,1) forwards`;
}

// === DRAG & DROP REORDER ===
let dragItem = null;
function initDrag(el) {
  el.addEventListener('dragstart', (e) => {
    // Don't drag when editing text
    if (e.target.closest('[contenteditable]') && document.activeElement.isContentEditable) {
      e.preventDefault(); return;
    }
    dragItem = el;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', el.id);
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    clearDropIndicators();
    dragItem = null;
  });
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragItem || dragItem === el) return;
    clearDropIndicators();
    const rect = el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (e.clientY < mid) el.classList.add('drag-over-top');
    else el.classList.add('drag-over-bottom');
  });
  el.addEventListener('dragleave', () => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!dragItem || dragItem === el) return;
    const rect = el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const canvas = document.getElementById('canvas');
    if (e.clientY < mid) canvas.insertBefore(dragItem, el);
    else canvas.insertBefore(dragItem, el.nextSibling);
    clearDropIndicators();
  });
}
function clearDropIndicators() {
  document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

// Also allow dropping on empty canvas area
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  if (canvas) {
    canvas.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragItem) return;
      // If dropped on canvas itself (not on an item), append to end
      if (e.target === canvas || e.target.classList.contains('canvas-inner')) {
        canvas.appendChild(dragItem);
      }
      clearDropIndicators();
    });
  }

  // --- Auto-connect to AI Agent server on page load ---
  const indicator = document.getElementById('agentModeIndicator');
  if (indicator) {
    indicator.textContent = 'Connecting...';
    indicator.className = 'agent-mode-indicator local';
  }
  AgentAPI.health()
    .then(data => {
      setAgentMode('agent');
      console.log('[Agent] Auto-connected to', data.model, '| Design KB:', data.designKB?.mode || 'ok');
    })
    .catch(() => {
      setAgentMode('local');
      console.log('[Agent] Server not available — running in local mode');
    });
});

// === SELECT / DESELECT ===
function toggleSelect(el, e) {
  if (e && !e.shiftKey) {
    document.querySelectorAll('.canvas-item.selected').forEach(i => { if (i !== el) { i.classList.remove('selected'); selectedItems.delete(i.id); } });
  }
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) selectedItems.add(el.id);
  else selectedItems.delete(el.id);
  // Auto-prefill refine feedback with variant + component context
  if (el.classList.contains('selected')) refineAutoPrefill(el);
}

// === APP ICON LOAD SAFETY NET ===
// If any scenario/template img fails to load (path typo, rename, encoding issue),
// replace with a neutral emoji square so the UI never shows broken-image icons.
// Also log which URL failed for easier debugging.
document.addEventListener('error', (e) => {
  const el = e.target;
  if (!(el instanceof HTMLImageElement)) return;
  if (!el.src || el.dataset.iconFallback) return;
  if (!/app-icons\//.test(el.src)) return;
  console.warn('[app-icon missing]', el.src);
  el.dataset.iconFallback = '1';
  // Swap the img for a styled div with an emoji (preserve sizing)
  const w = el.getAttribute('width') || el.style.width || '32px';
  const h = el.getAttribute('height') || el.style.height || '32px';
  const radius = el.style.borderRadius || '8px';
  const fallback = document.createElement('div');
  fallback.textContent = '\u25A3'; // ▣
  fallback.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:${w};height:${h};border-radius:${radius};background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);font-size:calc(${h} * 0.5);flex-shrink:0;`;
  fallback.title = 'missing: ' + el.src.split('/').pop();
  if (el.parentNode) el.parentNode.replaceChild(fallback, el);
}, true); // capture phase so it fires even if child img is inside contenteditable
function selectAll() { document.querySelectorAll('.canvas-item').forEach(i => { i.classList.add('selected'); selectedItems.add(i.id); }); }
function deselectAll() { document.querySelectorAll('.canvas-item').forEach(i => { i.classList.remove('selected'); selectedItems.delete(i.id); }); }
function removeItem(el) { el.remove(); selectedItems.delete(el.id); }

// === GROUPING ===
// Metadata-only grouping: each node tagged with a shared groupId in both
// DesignDoc + DOM dataset. Members get a dashed outline via CSS. Reorder
// and delete operate on the whole group when any member is touched.
function groupSelected() {
  var ids = (window.interactionState && window.interactionState.selectedNodeIds) || [];
  if (ids.length < 2) return;
  var groupId = 'grp-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e4).toString(36);
  ids.forEach(function (id) {
    var el = document.querySelector('[data-node-id="' + id + '"]');
    if (el) el.dataset.groupId = groupId;
    if (window.DesignDoc && typeof window.DesignDoc.getNode === 'function') {
      var node = window.DesignDoc.getNode(id);
      if (node) node.groupId = groupId;
    }
  });
  if (typeof window.refreshSceneInspector === 'function') {
    window.refreshSceneInspector();
  }
}
function ungroupSelected() {
  var ids = (window.interactionState && window.interactionState.selectedNodeIds) || [];
  if (!ids.length) return;

  // Collect group IDs from the selection
  var groupIds = new Set();
  ids.forEach(function (id) {
    var node = window.DesignDoc && window.DesignDoc.getNode(id);
    if (node && node.groupId) groupIds.add(node.groupId);
  });
  if (!groupIds.size) return;

  // Clear groupId from every node that was a member of any of those groups
  var allNodes = (window.DesignDoc && window.DesignDoc.state && window.DesignDoc.state.nodes) || [];
  allNodes.forEach(function (node) {
    if (node.groupId && groupIds.has(node.groupId)) {
      delete node.groupId;
      var el = document.querySelector('[data-node-id="' + node.id + '"]');
      if (el) delete el.dataset.groupId;
    }
  });
  if (typeof window.refreshSceneInspector === 'function') {
    window.refreshSceneInspector();
  }
}

// ============================================================================
//  Keyboard shortcuts — Delete / Backspace, Cmd/Ctrl+G (group),
//  Cmd/Ctrl+Shift+G (ungroup). Typing in inputs / contenteditable is ignored.
// ============================================================================
document.addEventListener('keydown', function (e) {
  var t = e.target;
  var typing = t && (
    t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
    t.isContentEditable ||
    (t.getAttribute && t.getAttribute('contenteditable') === 'true')
  );
  if (typing) return;

  var cmd = e.ctrlKey || e.metaKey;
  var selectedIds = (window.interactionState && window.interactionState.selectedNodeIds) || [];

  // Delete / Backspace → delete all selected nodes
  if ((e.key === 'Delete' || e.key === 'Backspace') && !cmd) {
    if (selectedIds.length === 0) return;
    e.preventDefault();
    // Copy IDs because deleteNode mutates state.nodes
    var toDel = selectedIds.slice();
    toDel.forEach(function (id) {
      if (window.DesignDoc && typeof window.DesignDoc.deleteNode === 'function') {
        window.DesignDoc.deleteNode(id);
      }
    });
    if (typeof window.setSelectedNodes === 'function') {
      window.setSelectedNodes([]);
    }
    return;
  }

  // Cmd/Ctrl+Shift+G → ungroup (must check BEFORE plain Cmd+G)
  if (cmd && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
    e.preventDefault();
    if (typeof window.ungroupSelected === 'function') window.ungroupSelected();
    return;
  }

  // Cmd/Ctrl+G → group (at least 2 selected)
  if (cmd && !e.shiftKey && (e.key === 'g' || e.key === 'G')) {
    e.preventDefault();
    if (typeof window.groupSelected === 'function') window.groupSelected();
    return;
  }
});
function setGroupRadius(v) {
  ['groupRadValue','groupRadValue2'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = v + 'px'; });
  document.querySelectorAll('.canvas-group').forEach(g => g.style.borderRadius = v + 'px');
}
function setGroupPadding(v) {
  ['groupPadValue','groupPadValue2'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = v + 'px'; });
  document.querySelectorAll('.canvas-group').forEach(g => g.style.padding = v + 'px');
}

function clearCanvas() {
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '';
  // Clean up any legacy canvasHint element lingering from prior builds.
  // The "Click a component or scenario to start" affordance was removed
  // per user feedback — the sidebar palette + top-bar already signal
  // entry points, so the floating hint was noise.
  const oldHint = document.getElementById('canvasHint');
  if (oldHint) oldHint.remove();
  selectedItems.clear();
  // Also clear any active overlay layer (notification shade, dialog,
  // quick settings, etc). The overlay attaches to #canvasFrame /
  // canvas._rulesInner — NOT to #canvas — so canvas.innerHTML alone
  // didn't dismiss it. Calling clearOverlay() resets currentOverlay,
  // strips overlay-inner nodes, and removes scene-btn .active state.
  if (typeof window.clearOverlay === 'function') {
    try { window.clearOverlay(); } catch (e) { /* ignore */ }
  }
  // Reset DesignDoc so the Scene/Layers panel doesn't show stale nodes
  // from a prior generation. Without this, every successive run accumulated
  // ghost layer entries from the previous canvas.
  if (window.DesignDoc && typeof window.DesignDoc.reset === 'function') {
    window.DesignDoc.reset();
  }
  // Repaint the inspector so the cleared state is reflected immediately.
  if (typeof window.refreshSceneInspector === 'function') {
    window.refreshSceneInspector();
  }
}

