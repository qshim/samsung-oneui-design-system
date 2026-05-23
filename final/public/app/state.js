// ============================================================================
//  app/state.js — shared global state + variant/refine state
//  ---------------------------------------------------------------------------
//  Intentionally uses global `let` declarations so other modules can read/write
//  the same variables (and so HTML onclick handlers can access them).
// ============================================================================

// === STATE ===
let selectedItems = new Set();
let currentMotion = 'fadeIn';
let currentBrand = 'samsung';
let currentEasing = 'cubic-bezier(0.22,0.25,0,1)';
let currentDuration = 300;
let colorTarget = 'bg';
let itemCounter = 0;

// =============================================
// === VARIANT SYSTEM ===
// =============================================
let variants = {
  A: { html: '', canvasStyle: {}, frameBackground: '', active: true, generated: false, prompt: '', scenario: '', layoutTree: null, renderModel: null, critic: null },
  B: { html: '', canvasStyle: {}, frameBackground: '', active: false, generated: false, prompt: '', scenario: '', layoutTree: null, renderModel: null, critic: null }
};
let activeVariant = 'A';
let compareMode = false;

function showVariantBar() {
  // A/B variant bar disabled — keeping function as no-op so existing callers
  // (_generateVariantsLocal, generateVariantsFromAgent) still work.
}

// Toggle variant visibility — A and B can be toggled independently
// Both on = side-by-side compare, one on = single view
let variantVisible = { A: true, B: false };

function toggleVariantView(v) {
  const other = v === 'A' ? 'B' : 'A';

  // If this variant is currently the only one visible, don't allow turning it off
  if (variantVisible[v] && !variantVisible[other]) return;

  variantVisible[v] = !variantVisible[v];

  // Update tab active states
  document.getElementById('varTabA').classList.toggle('active', variantVisible.A);
  document.getElementById('varTabB').classList.toggle('active', variantVisible.B);

  const bothVisible = variantVisible.A && variantVisible.B;

  if (bothVisible) {
    // Show side-by-side
    _saveCurrentVariant();
    _enterCompareView();
  } else {
    // Single variant view
    _exitCompareView();
    const visibleV = variantVisible.A ? 'A' : 'B';
    if (activeVariant !== visibleV) {
      _saveCurrentVariant();
      activeVariant = visibleV;
      _restoreVariant(visibleV);
    }
  }
}

function _enterCompareView() {
  const wrap = document.getElementById('canvasWrap');
  const compareFrame = document.getElementById('compareFrame');
  const primaryWrap = document.getElementById('canvasFrame').parentElement;

  wrap.classList.add('compare-mode');
  wrap.style.flexDirection = 'row';
  wrap.style.alignItems = 'flex-start';
  wrap.style.gap = '8px';
  compareFrame.style.display = 'flex';

  // Label A — placed as first child in primary wrapper (static flow, above frame)
  let labelA = document.getElementById('compareLabelA');
  if (!labelA) {
    labelA = document.createElement('div');
    labelA.id = 'compareLabelA';
    labelA.className = 'compare-label a';
    labelA.textContent = 'A';
    primaryWrap.insertBefore(labelA, primaryWrap.firstChild);
  }
  labelA.style.display = '';

  // Show the other variant in canvasB
  const otherV = activeVariant === 'A' ? 'B' : 'A';
  const canvasB = document.getElementById('canvasB');
  const frameB = document.getElementById('canvasFrameB');
  if (variants[otherV].generated) {
    canvasB.innerHTML = variants[otherV].html;
    if (variants[otherV].canvasStyle.gap) canvasB.style.gap = variants[otherV].canvasStyle.gap;
    if (variants[otherV].canvasStyle.padding) canvasB.style.padding = variants[otherV].canvasStyle.padding;
    if (variants[otherV].canvasStyle.display) canvasB.style.display = variants[otherV].canvasStyle.display;
    if (variants[otherV].canvasStyle.flexDirection) canvasB.style.flexDirection = variants[otherV].canvasStyle.flexDirection;
    if (variants[otherV].canvasStyle.alignItems) canvasB.style.alignItems = variants[otherV].canvasStyle.alignItems;
    // Remove stale delete buttons from canvasB
    canvasB.querySelectorAll('.canvas-item-delete, .canvas-delete').forEach(btn => btn.remove());
  } else {
    canvasB.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-3);font-size:12px;">Not generated</div>';
  }
  const frameA = document.getElementById('canvasFrame');
  frameB.className = frameA.className;

  // Sync exact pixel dimensions: use offsetWidth/Height for precise match
  frameB.style.width = frameA.offsetWidth + 'px';
  frameB.style.height = frameA.offsetHeight + 'px';
  frameB.style.aspectRatio = 'unset'; // override aspect-ratio so explicit w/h wins

  // Scale both frames identically — smaller to fit side-by-side with labels visible
  const scale = 0.72;
  frameA.style.transform = `scale(${scale})`;
  frameA.style.transformOrigin = 'top center';
  frameB.style.transform = `scale(${scale})`;
  frameB.style.transformOrigin = 'top center';

  // Label B
  const labelB = compareFrame.querySelector('.compare-label');
  if (labelB) {
    labelB.textContent = 'B';
    labelB.className = 'compare-label b';
  }
}

function _exitCompareView() {
  const wrap = document.getElementById('canvasWrap');
  const compareFrame = document.getElementById('compareFrame');

  wrap.classList.remove('compare-mode');
  wrap.style.flexDirection = '';
  wrap.style.alignItems = '';
  wrap.style.gap = '';
  compareFrame.style.display = 'none';

  // Reset frame A
  document.getElementById('canvasFrame').style.transform = '';
  document.getElementById('canvasFrame').style.transformOrigin = '';

  // Reset frame B inline styles to prevent stale sizing
  const frameB = document.getElementById('canvasFrameB');
  if (frameB) {
    frameB.style.transform = '';
    frameB.style.transformOrigin = '';
    frameB.style.height = '';
    frameB.style.width = '';
    frameB.style.aspectRatio = '';
  }

  const labelA = document.getElementById('compareLabelA');
  if (labelA) labelA.style.display = 'none';
}

// Legacy switchVariant for internal use
function switchVariant(v) {
  if (activeVariant === v) return;
  _saveCurrentVariant();
  activeVariant = v;
  _restoreVariant(v);
  variantVisible = { A: v === 'A', B: v === 'B' };
  document.getElementById('varTabA').classList.toggle('active', v === 'A');
  document.getElementById('varTabB').classList.toggle('active', v === 'B');
  _exitCompareView();
}

function _saveCurrentVariant() {
  const canvas = document.getElementById('canvas');
  const frame = document.getElementById('canvasFrame');
  // Finalize animation state before saving — ensure items are visible
  canvas.querySelectorAll('.canvas-item').forEach(el => {
    el.style.opacity = '1';
    el.style.animation = 'none';
  });
  variants[activeVariant].html = canvas.innerHTML;
  variants[activeVariant].canvasStyle = {
    gap: canvas.style.gap, padding: canvas.style.padding,
    display: canvas.style.display, flexDirection: canvas.style.flexDirection,
    alignItems: canvas.style.alignItems
  };
  variants[activeVariant].frameBackground = frame.style.background || '';
}

function _restoreVariant(v) {
  const canvas = document.getElementById('canvas');
  const frame = document.getElementById('canvasFrame');
  const data = variants[v];
  if (!data.generated) {
    canvas.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-3);font-size:12px;text-align:center;padding:20px;">Variant ' + v + ' not generated yet</div>';
    return;
  }
  canvas.innerHTML = data.html;
  if (data.canvasStyle.gap) canvas.style.gap = data.canvasStyle.gap;
  if (data.canvasStyle.padding) canvas.style.padding = data.canvasStyle.padding;
  if (data.canvasStyle.display) canvas.style.display = data.canvasStyle.display;
  if (data.canvasStyle.flexDirection) canvas.style.flexDirection = data.canvasStyle.flexDirection;
  if (data.canvasStyle.alignItems) canvas.style.alignItems = data.canvasStyle.alignItems;
  if (data.frameBackground) frame.style.background = data.frameBackground;
  // Re-init drag/select on restored items + remove stale delete buttons
  canvas.querySelectorAll('.canvas-item').forEach(el => {
    el.style.opacity = '1';
    el.style.animation = 'none';
    // Remove any inline delete buttons from saved HTML
    el.querySelectorAll('.canvas-item-delete, .canvas-delete').forEach(btn => btn.remove());
    initDrag(el);
    el.addEventListener('click', (e) => toggleSelect(el, e));
  });
}

// _updateVariantStatus removed — status text no longer displayed
// toggleVariantCompare replaced by toggleVariantView (A/B toggle)


// =============================================
// === REFINEMENT SYSTEM ===
// =============================================

let refineSnapshot = null;
let refinePatches = [];
let refineActiveIssues = [];
let refineSelectedTags = new Set();


// Guards against concurrent auto-refine runs.
let _autoRefineRunning = false;
