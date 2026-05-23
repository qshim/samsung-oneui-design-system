// ============================================================================
//  app/ui-panels.js — sidebar tabs + refine subsystem + export + harmony
//  ---------------------------------------------------------------------------
//  Everything panel-related: tab switching, refine prefill/analysis/plan/apply,
//  before/after compare, accept/reject/revert, export HTML, harmony analysis,
//  reference-image preview.
// ============================================================================

// === SIDEBAR COLLAPSE ===
// Toggle the left sidebar in/out of view with a smooth slide. State
// persists to localStorage so the user's preference (collapsed vs
// expanded) survives reloads. Boot path also restores it on DOMContentLoaded
// so the page doesn't flash open-then-collapsed.
function toggleSidebar() {
  const sidebar  = document.querySelector('.sidebar');
  const chevron  = document.getElementById('sidebarCollapseChevron');
  const toggle   = document.getElementById('sidebarCollapseToggle');
  if (!sidebar) return;
  const isCollapsed = sidebar.classList.toggle('collapsed');
  if (chevron) chevron.textContent = isCollapsed ? '›' : '‹';
  if (toggle)  toggle.title = isCollapsed ? 'Show sidebar' : 'Hide sidebar';
  try { localStorage.setItem('oneui-sidebar-collapsed', isCollapsed ? '1' : '0'); } catch (_) {}
}
(function _restoreSidebarState() {
  function apply() {
    try {
      const v = localStorage.getItem('oneui-sidebar-collapsed');
      if (v !== '1') return;
      const sidebar = document.querySelector('.sidebar');
      const chevron = document.getElementById('sidebarCollapseChevron');
      const toggle  = document.getElementById('sidebarCollapseToggle');
      if (sidebar) sidebar.classList.add('collapsed');
      if (chevron) chevron.textContent = '›';
      if (toggle)  toggle.title = 'Show sidebar';
    } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();

// === CUSTOMIZE (full page customize.html — no iframe side panel)
function toggleCustomizePanel() {
  window.location.href = 'customize.html';
}
window.toggleCustomizePanel = toggleCustomizePanel;

// === TABS ===
function switchTab(idx, btn) {
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else {
    const map = {5:0, 6:1, 7:2};
    const tabs = document.querySelectorAll('.sidebar-tab');
    if (tabs[map[idx]]) tabs[map[idx]].classList.add('active');
  }
  const panel = document.getElementById('panel-' + idx);
  if (panel) panel.classList.add('active'); // Guard: panels may not exist on non-genui pages

  // Mark body with the active tab so CSS can gate tab-specific affordances.
  // - tab-design-active (idx 6): enables the Design-tab interaction
  //   overlay (hover/selected boxes on rendered components).
  // - tab-mlp-active (idx 7): widens the sidebar to ~600px so the
  //   3-col MLP tile gallery shows all prototypes without scrolling.
  //   See `body.tab-mlp-active .sidebar:not(.collapsed)` in genui.css.
  document.body.classList.toggle('tab-design-active', idx === 6);
  document.body.classList.toggle('tab-mlp-active',    idx === 7);
}

// Initial tab: default to Generate (panel-5). Deep-link via hash overrides.
// Additional deep-link affordances for docs/screenshots:
//   #design                  → Design tab
//   #mlp / #mlp-prototype    → MLP Prototype tab
//   #refine                  → (legacy) MLP slot, kept for backcompat
//   ?customize=open          → redirect to customize.html (theme editor)
window.addEventListener('DOMContentLoaded', () => {
  const hash = (location.hash || '').toLowerCase();
  if (hash === '#design' || hash === '#build') switchTab(6, null);
  else if (hash === '#mlp' || hash === '#mlp-prototype') switchTab(7, null);
  else if (hash === '#refine') switchTab(7, null);
  else switchTab(5, null); // Force Generate as the landing tab

  // Query-string trigger: open full-page theme customizer (e.g. screenshot runs).
  if (/[?&]customize=open\b/.test(location.search)) {
    setTimeout(function () {
      try { window.location.replace('customize.html'); } catch (_) {}
    }, 0);
  }
});

function toggleDesignSection(id) {
  const section = document.getElementById(id);
  if (section) section.classList.toggle('collapsed');
}



// === REFINE AUTO-PREFILL ===
// When Refine panel is active and user clicks a variant canvas or a component,
// auto-populate the feedback textarea with "Variant X – ComponentName: " context.
const COMP_LABELS = {
  'btn-contained':'Contained Button', 'btn-outlined':'Outlined Button', 'btn-flat':'Flat/Text Button',
  'fab':'FAB', 'switch':'Switch', 'checkbox':'Checkbox', 'radio':'Radio',
  'input':'Text Input', 'search':'Search Bar', 'chip':'Chip', 'badge':'Badge',
  'tab-bar':'Tab Bar', 'appbar':'App Bar', 'bottomnav':'Bottom Nav', 'dialog':'Dialog',
  'snackbar':'Snackbar/Toast', 'divider':'Divider', 'card':'Card', 'list-item':'List Item',
  'status-bar':'Status Bar', 'now-bar':'Now Bar', 'qs-grid':'Quick Settings Grid',
  'media-card':'Media Card', 'notification-card':'Notification Card',
  'widget-small':'Small Widget', 'keyboard':'Keyboard', 'custom':'Custom Element'
};
function refineAutoPrefill(el) {
  const panel7 = document.getElementById('panel-7');
  if (!panel7 || !panel7.classList.contains('active')) return;
  const ta = document.getElementById('refineFeedback');
  if (!ta) return;
  // Determine variant (A/B) by walking up to nearest canvas-frame
  const frame = el.closest('.canvas-frame');
  const variant = (frame && frame.id === 'canvasFrameB') ? 'B' : 'A';
  // Determine component label
  const type = el.dataset.compType || '';
  const label = COMP_LABELS[type] || (type ? type.replace(/-/g,' ') : 'Component');
  const prefix = `[Variant ${variant} – ${label}] `;
  const cur = ta.value || '';
  // Strip any existing [Variant …] prefix then prepend the new one
  const stripped = cur.replace(/^\[Variant [AB] – [^\]]+\]\s*/, '');
  ta.value = prefix + stripped;
  ta.focus();
  // Place caret at the end so user can keep typing their comment
  const end = ta.value.length;
  try { ta.setSelectionRange(end, end); } catch(_) {}
}
// Click on variant frame background (not a component) → variant-level context
function refineFrameClickListener(frame, variant) {
  frame.addEventListener('click', (e) => {
    const panel7 = document.getElementById('panel-7');
    if (!panel7 || !panel7.classList.contains('active')) return;
    // Only trigger if the click target is the frame itself or the inner canvas wrapper (not a component)
    if (e.target.closest('.canvas-item')) return;
    const ta = document.getElementById('refineFeedback');
    if (!ta) return;
    const prefix = `[Variant ${variant} – Overall] `;
    const cur = ta.value || '';
    const stripped = cur.replace(/^\[Variant [AB] – [^\]]+\]\s*/, '');
    ta.value = prefix + stripped;
    ta.focus();
    const end = ta.value.length;
    try { ta.setSelectionRange(end, end); } catch(_) {}
  });
}
window.addEventListener('DOMContentLoaded', () => {
  const fA = document.getElementById('canvasFrame');
  const fB = document.getElementById('canvasFrameB');
  if (fA) refineFrameClickListener(fA, 'A');
  if (fB) refineFrameClickListener(fB, 'B');
});


// === EXPORT (self-contained, re-importable) ===
//
// Produces a single HTML file with EVERY stylesheet inlined plus the
// currently-active theme variables AND a JSON metadata block. The file
// renders correctly when opened anywhere (no server, no network besides
// Google Fonts). When dropped into /customize → "Import HTML", the same
// file becomes the source of a brand-new editable theme preset.
//
// What lands in the export:
//   1. <link>  Google Fonts (kept as remote — cheap, common)
//   2. <style> The full css/genui.css text (fetched at export time)
//   3. <style id="theme-vars"> Whatever /api/themes wrote at runtime
//      (i.e. the active theme's :root tokens)
//   4. <style data-export="inline-overrides"> Any CSS variables the
//      user changed via the customize page that haven't been saved as
//      a theme yet (read from document.documentElement.style)
//   5. <!-- ONEUI_EXPORT_META: {...} --> machine-readable JSON with
//      all extractable theme tokens. This is what Import parses.
async function exportHTML() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  const clone = canvas.cloneNode(true);
  clone.querySelectorAll('.canvas-delete, .canvas-empty').forEach(e => e.remove());
  clone.querySelectorAll('.canvas-item').forEach(e => {
    e.classList.remove('canvas-item', 'selected');
    e.style.outline = '';
    e.removeAttribute('id');
  });

  // (1) Fetch the project's main stylesheet so the export renders the
  //     same set of rules the live app does. Same-origin fetch, no CORS.
  let mainCSS = '';
  try {
    const r = await fetch('css/genui.css', { cache: 'no-cache' });
    if (r.ok) mainCSS = await r.text();
  } catch (e) {
    console.warn('[export] failed to fetch css/genui.css:', e.message);
  }

  // (2) Capture the active-theme :root block (server-rendered into
  //     <style id="theme-vars"> at runtime).
  const themeVarsEl = document.getElementById('theme-vars');
  const themeVarsCSS = themeVarsEl ? themeVarsEl.textContent : '';

  // (3) Capture inline overrides — anything the user typed in the
  //     customize editor without saving. These live on <html> as
  //     element.style.setProperty('--xxx', '…').
  const inlineOverrides = (document.documentElement.getAttribute('style') || '')
    .split(';').map(s => s.trim()).filter(s => s.startsWith('--'));
  const inlineOverridesCSS = inlineOverrides.length
    ? `:root { ${inlineOverrides.join('; ')}; }`
    : '';

  // (4) Build the metadata JSON. Import reads this directly so it
  //     doesn't have to re-parse the inline CSS. Keep this list in
  //     sync with THEME_EDIT_SCHEMA in customize.html — every key
  //     the editor exposes should also round-trip through export.
  const themeVarKeys = [
    // Page
    '--page-bg','--text-primary','--text-secondary','--text-tertiary',
    '--accent-primary','--accent-on-primary',
    // Card globals
    '--card-radius','--card-padding-v','--card-padding-h','--card-gap',
    // Per-card overrides
    '--card-weather-accent','--card-weather-temp-color','--card-weather-temp-size',
    '--card-weather-temp-weight','--card-weather-temp-letterspacing','--card-weather-icon-size',
    '--card-calendar-accent','--card-calendar-time-size','--card-calendar-time-weight',
    '--card-reminder-accent','--card-reminder-task-size',
    '--card-message-avatar-grad','--card-message-avatar-size',
    '--card-eta-accent','--card-eta-size','--card-eta-icon-size',
    '--card-nav-accent','--card-nav-distance-size','--card-nav-arrow-bg',
    '--card-ai-grad','--card-ai-shimmer-speed','--card-input-topic-size',
    // Surface chrome
    '--surface-bg','--surface-border','--surface-shadow','--surface-filter',
    '--surface-overlay','--surface-overlay-opacity','--qs-tile-bg',
    // Typography (new — must round-trip)
    '--font-family-display','--font-family-body','--font-family-mono',
    '--font-size-xs','--font-size-sm','--font-size-md','--font-size-lg','--font-size-xl','--font-size-display',
    '--font-weight-regular','--font-weight-medium','--font-weight-semibold','--font-weight-bold',
    '--letter-spacing-tight','--letter-spacing-normal','--letter-spacing-wide',
    '--line-height-tight','--line-height-normal','--line-height-relaxed',
    // Spacing scale (new)
    '--space-xxs','--space-xs','--space-sm','--space-md','--space-lg','--space-xl',
    // Composition (new — driver of screen-level layout)
    '--screen-padding-v','--screen-padding-h',
    '--gap-screen','--gap-cards','--container-margin-bottom',
    '--screen-grid-columns','--screen-grid-gap'
  ];
  const computed = getComputedStyle(document.documentElement);
  const themeVars = {};
  themeVarKeys.forEach(k => {
    const v = computed.getPropertyValue(k).trim();
    if (v) themeVars[k] = v;
  });
  const isDark = !document.getElementById('canvasFrame').classList.contains('light');
  const exportMeta = {
    schema:        'oneui.export/v1',
    exportedAt:    new Date().toISOString(),
    canvasMode:    isDark ? 'dark' : 'light',
    activeThemeId: (window.localStorage && localStorage.getItem('oneuiActiveThemeId')) || null,
    themeVars:     themeVars
  };
  // Embed as an HTML comment with a stable sentinel so Import can grep it.
  const metaComment = `<!-- ONEUI_EXPORT_META:${JSON.stringify(exportMeta)}:END -->`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>One UI 8.5 Export</title>
${metaComment}
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style data-export="genui.css">
${mainCSS}
</style>
<style id="theme-vars" data-export="theme-vars">
${themeVarsCSS}
</style>${inlineOverridesCSS ? `
<style data-export="inline-overrides">
${inlineOverridesCSS}
</style>` : ''}
<style data-export="page-bg">
body { margin:0; background:${isDark ? '#171717' : '#FCFCFC'}; color:${isDark ? '#FAFAFA' : '#252525'}; }
.export-wrap { padding:16px; max-width:520px; margin:0 auto; }
</style>
</head>
<body>
<div class="export-wrap">
  ${clone.innerHTML}
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `oneui-export-${Date.now()}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  console.log('[export] wrote oneui-export.html with ' + Object.keys(themeVars).length + ' theme vars + ' + Math.round(mainCSS.length / 1024) + ' KB CSS');
}
window.exportHTML = exportHTML;

// === GEN/STATIC HARMONY ANALYSIS ===
function analyzeHarmony() {
  const items = document.querySelectorAll('.canvas-item[data-role]');
  if (items.length === 0) {
    showHarmony('No components with Gen/Static roles. Generate a layout first.', 'warn');
    return;
  }
  let genCount = 0, staticCount = 0;
  items.forEach(i => { if (i.dataset.role === 'gen') genCount++; else staticCount++; });
  const ratio = genCount / (genCount + staticCount);

  let report = `<div style="padding:10px;background:var(--surface);border-radius:10px;border:1px solid var(--divider);">`;
  report += `<div style="font-weight:600;margin-bottom:6px;">Harmony Report</div>`;
  report += `<div style="display:flex;gap:12px;margin-bottom:8px;">`;
  report += `<span style="color:#64e9e3;">GEN: ${genCount}</span>`;
  report += `<span style="color:var(--text-3);">STATIC: ${staticCount}</span>`;
  report += `<span>Ratio: ${Math.round(ratio*100)}% dynamic</span>`;
  report += `</div>`;

  // Harmony rules
  const issues = [];
  if (ratio > 0.8) issues.push('Too many Gen components \u2014 screen may feel unstable. Add more Static anchors (App Bar, Bottom Nav).');
  if (ratio < 0.2) issues.push('Too few Gen components \u2014 screen feels rigid. Add dynamic content (Cards, Lists, Chips).');
  if (genCount > 0 && staticCount === 0) issues.push('No Static components \u2014 user has no fixed reference point. Add navigation chrome.');

  // Motion harmony check
  let hasAppBar = false, hasBottomNav = false;
  items.forEach(i => {
    const inner = i.innerHTML;
    if (inner.includes('oui-appbar')) hasAppBar = true;
    if (inner.includes('oui-bottomnav') || inner.includes('oui-pill-tab')) hasBottomNav = true;
  });
  if (genCount > 3 && !hasAppBar) issues.push('Multiple Gen components without App Bar \u2014 add a Static top anchor for spatial continuity.');
  if (genCount > 3 && !hasBottomNav) issues.push('Consider adding a Bottom Nav or Pill Tab as a Static anchor below.');

  if (issues.length === 0) {
    report += `<div style="color:#2ecc71;">&#10003; Good harmony. Static anchors frame the Gen content well.</div>`;
    report += `<div style="margin-top:6px;font-size:13px;color:var(--text-3);">Motion: Gen components use Emphasized (0.2,0,0,1) with stagger. Static components use Basic Path (0.22,0.25,0,1). This creates visual hierarchy \u2014 static elements settle first, gen content flows in after.</div>`;
  } else {
    issues.forEach(issue => {
      report += `<div style="color:#F9A825;margin-bottom:4px;">&#9888; ${issue}</div>`;
    });
  }
  report += `</div>`;
  showHarmony(report);
}

function showHarmony(html) {
  const el = document.getElementById('harmonyResult');
  el.innerHTML = html;
  el.style.display = 'block';
}

// === PLAY FULL SEQUENCE ===
function playSequence() {
  const items = document.querySelectorAll('.canvas-item[data-role]');
  if (items.length === 0) return;

  // Reset all
  items.forEach(i => { i.style.animation = 'none'; i.style.opacity = '0'; });

  // Play static first, then gen
  const statics = Array.from(items).filter(i => i.dataset.role === 'static');
  const gens = Array.from(items).filter(i => i.dataset.role === 'gen');

  // Phase 1: Static elements (Basic Path, fast)
  statics.forEach((el, idx) => {
    setTimeout(() => {
      el.style.animation = `fadeIn 250ms cubic-bezier(0.22,0.25,0,1) forwards`;
    }, idx * 40);
  });

  // Phase 2: Gen elements (Emphasized, staggered, after statics settle)
  const genStartDelay = statics.length * 40 + 200;
  gens.forEach((el, idx) => {
    setTimeout(() => {
      el.style.animation = `slideUp 400ms cubic-bezier(0.2,0,0,1) forwards`;
    }, genStartDelay + idx * 60);
  });
}

// =============================================
// === REFERENCE IMAGE HANDLER ===
// =============================================
function handleRefImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('refPreviewImg').src = e.target.result;
    document.getElementById('refPreview').style.display = 'block';
    // Store reference for memory
    window._refImageData = e.target.result;
  };
  reader.readAsDataURL(file);
}
function clearRefImage() {
  document.getElementById('refPreview').style.display = 'none';
  document.getElementById('refPreviewImg').src = '';
  document.getElementById('genImage').value = '';
  window._refImageData = null;
}

function toggleRefineTag(el) {
  const tag = el.dataset.issue;
  el.classList.toggle('selected');
  if (refineSelectedTags.has(tag)) refineSelectedTags.delete(tag);
  else refineSelectedTags.add(tag);
}

// --- Snapshot ---
function captureSnapshot() {
  const canvas = document.getElementById('canvas');
  const frame = document.getElementById('canvasFrame');
  const items = canvas.querySelectorAll('.canvas-item');
  const itemData = [];
  items.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const fc = el.firstElementChild;
    const fcs = fc ? getComputedStyle(fc) : {};
    itemData.push({
      id: el.id,
      index: i,
      outerHTML: el.outerHTML,
      rect: el.getBoundingClientRect(),
      styles: {
        marginTop: cs.marginTop, padding: cs.padding, fontSize: fcs.fontSize || '0',
        fontWeight: fcs.fontWeight || '400', lineHeight: fcs.lineHeight || 'normal',
        gap: cs.gap, borderRadius: fcs.borderRadius || cs.borderRadius,
        background: fcs.background || '', color: fcs.color || '',
        height: cs.height, width: cs.width, display: cs.display,
        textAlign: fcs.textAlign || 'start'
      },
      textContent: el.textContent.substring(0, 100),
      childCount: el.querySelectorAll('*').length
    });
  });
  return {
    canvasHTML: canvas.innerHTML,
    canvasStyle: { gap: canvas.style.gap, padding: canvas.style.padding, alignItems: canvas.style.alignItems },
    frameBackground: frame.style.background || frame.style.cssText,
    items: itemData,
    timestamp: Date.now()
  };
}

function restoreSnapshot(snapshot) {
  if (!snapshot) return;
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = snapshot.canvasHTML;
  if (snapshot.canvasStyle.gap) canvas.style.gap = snapshot.canvasStyle.gap;
  if (snapshot.canvasStyle.padding) canvas.style.padding = snapshot.canvasStyle.padding;
  canvas.querySelectorAll('.canvas-item').forEach(el => {
    el.classList.remove('refine-highlight', 'refine-patched');
  });
}

// --- Feedback interpretation ---
const ISSUE_KEYWORDS = {
  spacing: ['spacing','space','gap','margin','padding','tight','cramped','too close','spread out','too far','compressed','breathe','room'],
  density: ['dense','density','cluttered','busy','crowded','packed','overwhelming','too many','too much'],
  hierarchy: ['hierarchy','important','emphasis','title','heading','stand out','flat','monotone','weight','prominence','priority'],
  alignment: ['align','alignment','centered','off-center','uneven','crooked','skewed','misaligned','left','right','center'],
  sizing: ['size','sizing','too big','too small','scale','proportion','oversized','tiny','width','height'],
  readability: ['read','readability','legible','font size','small text','contrast','hard to see','unclear','blurry'],
  consistency: ['consistent','consistency','inconsistent','mismatch','different styles','mixed','uniform','cohesive'],
  semantic: ['wrong','incorrect','doesn\'t match','semantic','label','content','text','meaning','placeholder'],
  interaction: ['flow','interaction','navigate','missing','button','action','tap','click','nav','navigation','bottom bar','app bar']
};

// interpretFeedback — routes to local fallback (agent mode uses API directly in analyzeRefinement)

function interpretFeedback(text, tags, snapshot) {
  return _local_interpretFeedback(text, tags, snapshot);
}

function localizeIssue(issue, items) {
  const result = { nodes: [], description: '', suggestion: '' };
  if (items.length === 0) return result;

  const canvasInner = document.querySelector('.canvas-inner');
  const cRect = canvasInner ? canvasInner.getBoundingClientRect() : { top: 0 };

  switch (issue.type) {
    case 'spacing': {
      // Check gaps between consecutive items
      const gaps = [];
      for (let i = 1; i < items.length; i++) {
        const gap = items[i].rect.top - items[i-1].rect.bottom;
        gaps.push({ gap, i, id1: items[i-1].id, id2: items[i].id });
      }
      if (gaps.length === 0) break;
      const avgGap = gaps.reduce((s, g) => s + g.gap, 0) / gaps.length;
      const tightPairs = gaps.filter(g => g.gap < avgGap * 0.5);
      const loosePairs = gaps.filter(g => g.gap > avgGap * 1.8);
      if (tightPairs.length > 0) {
        result.nodes = tightPairs.flatMap(p => [p.id1, p.id2].filter(Boolean));
        result.description = `${tightPairs.length} pair(s) have unusually tight spacing (< ${Math.round(avgGap * 0.5)}px gap vs ${Math.round(avgGap)}px average)`;
        result.suggestion = 'Increase gap between affected elements to match the average rhythm';
      } else if (loosePairs.length > 0) {
        result.nodes = loosePairs.flatMap(p => [p.id1, p.id2].filter(Boolean));
        result.description = `${loosePairs.length} pair(s) have excessive spacing`;
        result.suggestion = 'Reduce gap to align with the 8px grid rhythm';
      } else {
        result.nodes = items.map(it => it.id).filter(Boolean);
        result.description = 'Overall spacing may need adjustment';
        result.suggestion = 'Fine-tune vertical gaps between elements';
      }
      break;
    }
    case 'density': {
      const canvasH = items[items.length - 1].rect.bottom - items[0].rect.top;
      const density = items.length / (canvasH / 100);
      if (density > 1.5) {
        result.nodes = items.map(it => it.id).filter(Boolean);
        result.description = `High density: ${items.length} elements in ${Math.round(canvasH)}px (${density.toFixed(1)} items per 100px)`;
        result.suggestion = 'Increase padding or reduce the number of elements';
      } else {
        result.nodes = items.map(it => it.id).filter(Boolean);
        result.description = `${items.length} elements across ${Math.round(canvasH)}px`;
        result.suggestion = 'Consider consolidating or restructuring elements';
      }
      break;
    }
    case 'hierarchy': {
      const fontSizes = items.map(it => ({ id: it.id, fs: parseFloat(it.styles.fontSize) || 14, fw: parseInt(it.styles.fontWeight) || 400 })).filter(it => it.fs > 0);
      const maxFs = Math.max(...fontSizes.map(f => f.fs));
      const minFs = Math.min(...fontSizes.map(f => f.fs));
      const ratio = maxFs / minFs;
      if (ratio < 1.5) {
        result.nodes = fontSizes.map(f => f.id).filter(Boolean);
        result.description = `Weak type hierarchy: size range ${minFs}px - ${maxFs}px (ratio ${ratio.toFixed(1)}x). Needs more contrast.`;
        result.suggestion = 'Increase title size or decrease body size. Target 2x+ ratio.';
      } else {
        const lowWeight = fontSizes.filter(f => f.fw < 500 && f.fs >= maxFs * 0.8);
        if (lowWeight.length > 0) {
          result.nodes = lowWeight.map(f => f.id).filter(Boolean);
          result.description = `Large text elements lack weight emphasis (found ${lowWeight.length} at <=400 weight)`;
          result.suggestion = 'Apply font-weight 600-700 to primary headings';
        }
      }
      break;
    }
    case 'alignment': {
      const lefts = items.map(it => ({ id: it.id, left: it.rect.left }));
      const avgLeft = lefts.reduce((s, l) => s + l.left, 0) / lefts.length;
      const misaligned = lefts.filter(l => Math.abs(l.left - avgLeft) > 8);
      result.nodes = misaligned.map(l => l.id).filter(Boolean);
      result.description = misaligned.length > 0 ? `${misaligned.length} element(s) deviate >8px from dominant left edge` : 'Elements appear generally aligned';
      result.suggestion = 'Snap to consistent left margin or center axis';
      break;
    }
    case 'sizing': {
      const widths = items.map(it => ({ id: it.id, w: it.rect.width }));
      const avgW = widths.reduce((s, w) => s + w.w, 0) / widths.length;
      const outliers = widths.filter(w => Math.abs(w.w - avgW) > avgW * 0.4);
      result.nodes = outliers.map(o => o.id).filter(Boolean);
      result.description = outliers.length > 0 ? `${outliers.length} element(s) have unusual sizing vs siblings` : 'Element sizes appear consistent';
      result.suggestion = 'Normalize widths to container or match sibling proportions';
      break;
    }
    case 'readability': {
      const small = items.filter(it => parseFloat(it.styles.fontSize) > 0 && parseFloat(it.styles.fontSize) < 12);
      result.nodes = small.map(s => s.id).filter(Boolean);
      result.description = small.length > 0 ? `${small.length} element(s) have font-size < 12px` : 'Font sizes appear readable';
      result.suggestion = 'Increase small text to minimum 12px, ensure adequate line-height (1.4+)';
      break;
    }
    case 'consistency': {
      const radii = {};
      items.forEach(it => {
        const r = it.styles.borderRadius || '0px';
        radii[r] = radii[r] || [];
        radii[r].push(it.id);
      });
      const uniqueRadii = Object.keys(radii).filter(r => r !== '0px');
      if (uniqueRadii.length > 2) {
        const minority = Object.entries(radii).filter(([k, v]) => v.length === 1).flatMap(([k, v]) => v);
        result.nodes = minority.filter(Boolean);
        result.description = `${uniqueRadii.length} different border-radius values found (${uniqueRadii.join(', ')})`;
        result.suggestion = 'Unify border-radius to 1-2 consistent values';
      } else {
        result.description = 'Visual properties appear consistent';
      }
      break;
    }
    case 'semantic': {
      result.nodes = Array.from(selectedItems).length > 0 ? Array.from(selectedItems) : items.slice(0, 3).map(it => it.id).filter(Boolean);
      result.description = 'Content may not match intended meaning or context';
      result.suggestion = 'Review text labels and icons for semantic accuracy';
      break;
    }
    case 'interaction': {
      const hasAppBar = items.some(it => it.textContent.includes('App Bar') || it.outerHTML.includes('appbar'));
      const hasBottomNav = items.some(it => it.textContent.includes('Bottom Nav') || it.outerHTML.includes('bottomnav'));
      const missing = [];
      if (!hasAppBar) missing.push('App Bar');
      if (!hasBottomNav) missing.push('Bottom Nav');
      result.nodes = items.length > 0 ? [items[0].id, items[items.length - 1].id].filter(Boolean) : [];
      result.description = missing.length > 0 ? `Missing navigation elements: ${missing.join(', ')}` : 'Basic navigation structure present';
      result.suggestion = missing.length > 0 ? `Add ${missing.join(' and ')} for proper app flow` : 'Verify tap targets and navigation paths';
      break;
    }
  }

  if (!result.description) result.description = `${issue.type} analysis complete`;
  if (result.nodes.length === 0) result.nodes = items.map(it => it.id).filter(Boolean);
  return result;
}

// --- Analyze ---

function analyzeRefinement(opts) {
  opts = opts || {};
  const canvas = document.getElementById('canvas');
  if (canvas.querySelectorAll('.canvas-item').length === 0) {
    if (!opts.silent) alert('Generate a design first, then refine it.');
    return Promise.reject(new Error('no canvas items'));
  }

  // Capture snapshot
  refineSnapshot = captureSnapshot();

  // Get feedback (allow auto-override)
  const text = (opts.feedback !== undefined)
    ? opts.feedback
    : document.getElementById('refineFeedback').value;
  if (!text && refineSelectedTags.size === 0 && !opts.auto) {
    if (!opts.silent) alert('Enter feedback or select issue tags first.');
    return Promise.reject(new Error('no feedback'));
  }

  return new Promise((resolve, reject) => {
    if (agentSession.mode === 'agent') {
      const payload = StateManager.getRefinePayload(text, refineSelectedTags, refineSnapshot);
      if (!opts.silent) showAgentLoading('Analyzing with Agent...');

      AgentAPI.refineUI(payload)
        .then(response => {
          if (!opts.silent) hideAgentLoading();
          StateManager.updateFromAgentRefine(response);
          refineActiveIssues = response.parsedIssue || [];
          window._agentPatchPlan = response.patchPlan || null;
          window._agentRenderModel = response.updatedRenderModel || null;
          _renderRefineIssues(canvas);
          RenderEngine.renderCritic(response.critic);
          showRefineStep(2);
          resolve(response);
        })
        .catch(err => {
          console.warn('Agent refine failed, falling back to local:', err.message);
          if (!opts.silent) hideAgentLoading();
          _local_analyzeRefinement(canvas, text);
          resolve({ critic: null, parsedIssue: refineActiveIssues, fallback: true });
        });
    } else {
      _local_analyzeRefinement(canvas, text);
      resolve({ critic: null, parsedIssue: refineActiveIssues, local: true });
    }
  });
}

function _local_analyzeRefinement(canvas, text) {
  // Interpret (local heuristic)
  refineActiveIssues = _local_interpretFeedback(text, refineSelectedTags, refineSnapshot);

  // Clear agent patch plan
  window._agentPatchPlan = null;
  window._agentRenderModel = null;

  _renderRefineIssues(canvas);
  showRefineStep(2);
}

function _renderRefineIssues(canvas) {
  // Highlight affected nodes
  canvas.querySelectorAll('.canvas-item').forEach(el => el.classList.remove('refine-highlight'));
  const allAffected = new Set(refineActiveIssues.flatMap(i => i.affectedNodes || []));
  allAffected.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('refine-highlight');
  });

  // Render issues
  const list = document.getElementById('refineIssuesList');
  list.innerHTML = refineActiveIssues.map(issue => `
    <div class="refine-issue-card">
      <div class="refine-issue-type ${issue.type}">${issue.type}</div>
      <div class="refine-issue-desc">${issue.description || issue.message || ''}</div>
      <div class="refine-issue-nodes">${(issue.affectedNodes || []).length} node(s) affected</div>
    </div>
  `).join('');
}

// --- Patch planning ---

function planRefinementPatches() {
  if (agentSession.mode === 'agent' && window._agentPatchPlan) {
    // --- Agent Mode: use patch plan from agent response ---
    _renderAgentPatchPlan(window._agentPatchPlan);
    showRefineStep(3);
  } else {
    // --- Local Mode: compute patches locally ---
    _local_planRefinementPatches();
  }
}

function _renderAgentPatchPlan(patchPlan) {
  // patchPlan: { patches: [{ issueType, changes: [{node, property, from, to, target}], expectedEffect }] }
  refinePatches = patchPlan.patches || [];

  const list = document.getElementById('refinePatchList');
  list.innerHTML = refinePatches.map(patch => `
    <div style="margin-bottom:8px;">
      <div class="refine-issue-type ${patch.issueType}" style="margin-bottom:4px;">${patch.issueType}</div>
      ${(patch.changes || []).map(c => `
        <div class="refine-patch-item">
          <span class="refine-patch-prop">${c.property}</span>
          <span class="refine-patch-from">${c.from}</span>
          <span class="refine-patch-arrow">&rarr;</span>
          <span class="refine-patch-to">${c.to}</span>
        </div>
      `).join('')}
      <div class="refine-patch-effect">${patch.expectedEffect || ''}</div>
    </div>
  `).join('');

  if (refinePatches.length === 0) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:10px;">No patches returned by agent.</div>';
  }
}

function _local_planRefinementPatches() {
  refinePatches = [];

  refineActiveIssues.forEach(issue => {
    const patch = { issueType: issue.type, targetNodes: [...(issue.affectedNodes || [])], dependentNodes: [], changes: [], expectedEffect: issue.suggestion };

    switch (issue.type) {
      case 'spacing': {
        (issue.affectedNodes || []).forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          const fc = el.firstElementChild;
          if (!fc) return;
          const currentMt = parseInt(getComputedStyle(fc).marginTop) || 0;
          const desc = issue.description || '';
          const increase = desc.includes('tight') || desc.includes('tight');
          const newMt = increase ? Math.min(currentMt + 8, 48) : Math.max(currentMt - 4, 0);
          if (newMt !== currentMt) {
            patch.changes.push({ node: id, property: 'margin-top', from: currentMt + 'px', to: newMt + 'px', target: 'firstChild' });
          }
        });
        patch.expectedEffect = 'Adjust vertical spacing between elements';
        break;
      }
      case 'density': {
        (issue.affectedNodes || []).forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          const fc = el.firstElementChild;
          if (!fc) return;
          const currentP = parseInt(getComputedStyle(fc).padding) || 0;
          patch.changes.push({ node: id, property: 'padding', from: getComputedStyle(fc).padding, to: (currentP + 4) + 'px', target: 'firstChild' });
        });
        patch.expectedEffect = 'Increase breathing room by adding inner padding';
        break;
      }
      case 'hierarchy': {
        const items = refineSnapshot.items;
        const fontSizes = items.map(it => parseFloat(it.styles.fontSize) || 14);
        const maxFs = Math.max(...fontSizes);
        items.forEach((it, i) => {
          if (!it.id) return;
          const fs = fontSizes[i];
          if (fs >= maxFs * 0.8 && parseInt(it.styles.fontWeight) < 600) {
            patch.changes.push({ node: it.id, property: 'font-weight', from: it.styles.fontWeight, to: '700', target: 'firstChild' });
          }
          if (i === 0 && fs < 20) {
            patch.changes.push({ node: it.id, property: 'font-size', from: fs + 'px', to: '22px', target: 'firstChild' });
          }
        });
        patch.expectedEffect = 'Strengthen visual hierarchy through size and weight contrast';
        break;
      }
      case 'alignment': {
        (issue.affectedNodes || []).forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          const fc = el.firstElementChild;
          if (!fc) return;
          patch.changes.push({ node: id, property: 'text-align', from: getComputedStyle(fc).textAlign, to: 'left', target: 'firstChild' });
        });
        patch.expectedEffect = 'Snap elements to consistent alignment';
        break;
      }
      case 'sizing': {
        (issue.affectedNodes || []).forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          const fc = el.firstElementChild;
          if (!fc) return;
          patch.changes.push({ node: id, property: 'width', from: getComputedStyle(fc).width, to: '100%', target: 'firstChild' });
        });
        patch.expectedEffect = 'Normalize element widths';
        break;
      }
      case 'readability': {
        (issue.affectedNodes || []).forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          const fc = el.firstElementChild;
          if (!fc) return;
          const currentFs = parseFloat(getComputedStyle(fc).fontSize) || 14;
          if (currentFs < 12) {
            patch.changes.push({ node: id, property: 'font-size', from: currentFs + 'px', to: '13px', target: 'firstChild' });
          }
          patch.changes.push({ node: id, property: 'line-height', from: getComputedStyle(fc).lineHeight, to: '1.5', target: 'firstChild' });
        });
        patch.expectedEffect = 'Improve text legibility with proper sizing and line-height';
        break;
      }
      case 'consistency': {
        const modeRadius = (() => {
          const counts = {};
          (issue.affectedNodes || []).forEach(id => {
            const el = document.getElementById(id);
            if (!el || !el.firstElementChild) return;
            const r = getComputedStyle(el.firstElementChild).borderRadius;
            counts[r] = (counts[r] || 0) + 1;
          });
          return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '18px';
        })();
        (issue.affectedNodes || []).forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          const fc = el.firstElementChild;
          if (!fc) return;
          const current = getComputedStyle(fc).borderRadius;
          if (current !== modeRadius) {
            patch.changes.push({ node: id, property: 'border-radius', from: current, to: modeRadius, target: 'firstChild' });
          }
        });
        patch.expectedEffect = `Unify border-radius to ${modeRadius}`;
        break;
      }
      default: {
        patch.expectedEffect = `Apply ${issue.type} improvements`;
      }
    }

    if (patch.changes.length > 0) refinePatches.push(patch);
  });

  // Render patch plan
  const list = document.getElementById('refinePatchList');
  list.innerHTML = refinePatches.map(patch => `
    <div style="margin-bottom:8px;">
      <div class="refine-issue-type ${patch.issueType}" style="margin-bottom:4px;">${patch.issueType}</div>
      ${patch.changes.map(c => `
        <div class="refine-patch-item">
          <span class="refine-patch-prop">${c.property}</span>
          <span class="refine-patch-from">${c.from}</span>
          <span class="refine-patch-arrow">&rarr;</span>
          <span class="refine-patch-to">${c.to}</span>
        </div>
      `).join('')}
      <div class="refine-patch-effect">${patch.expectedEffect}</div>
    </div>
  `).join('');

  if (refinePatches.length === 0) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:10px;">No concrete patches generated. Try providing more specific feedback.</div>';
  }

  showRefineStep(3);
}

// --- Apply patches ---

function applyRefinementPatches() {
  if (agentSession.mode === 'agent' && window._agentRenderModel) {
    // Agent mode: if a full updated renderModel is available, re-render from it
    // But only apply patches (partial update) to preserve user's drag/edit state
    RenderEngine.applyAgentPatches({ patches: refinePatches });
  } else {
    // Local mode: apply patches directly
    refinePatches.forEach(patch => {
      (patch.changes || []).forEach(change => {
        const el = document.getElementById(change.node);
        if (!el) return;
        const target = change.target === 'firstChild' ? el.firstElementChild : el;
        if (!target) return;
        target.style[change.property.replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = change.to;
        el.classList.remove('refine-highlight');
        el.classList.add('refine-patched');
      });
    });

    // Brief flash then remove
    setTimeout(() => {
      document.querySelectorAll('.refine-patched').forEach(el => el.classList.remove('refine-patched'));
    }, 2000);
  }

  // Summary
  const totalChanges = refinePatches.reduce((s, p) => s + (p.changes || []).length, 0);
  const types = [...new Set(refinePatches.map(p => p.issueType))];
  document.getElementById('refineSummary').innerHTML = `Applied <strong>${totalChanges}</strong> change(s) across <strong>${types.join(', ')}</strong>. Review the result and decide.`;

  showRefineStep(4);
}

// --- Comparison ---
function showRefineComparison() {
  if (!refineSnapshot) return;
  const compare = document.getElementById('refineCompare');
  const beforeEl = document.getElementById('refineBeforeCanvas');
  const afterEl = document.getElementById('refineAfterCanvas');

  // Before: from snapshot
  beforeEl.innerHTML = `<div class="canvas-inner-clone">${refineSnapshot.canvasHTML}</div>`;
  // After: current state
  afterEl.innerHTML = `<div class="canvas-inner-clone">${document.getElementById('canvas').innerHTML}</div>`;

  // Remove interactive states from clones
  compare.querySelectorAll('.canvas-item').forEach(el => {
    el.classList.remove('refine-highlight', 'refine-patched', 'selected');
    el.style.cursor = 'default';
  });

  compare.classList.add('show');
}

function hideRefineComparison() {
  document.getElementById('refineCompare').classList.remove('show');
}

// --- Decision ---
function acceptRefinement() {
  hideRefineComparison();
  document.querySelectorAll('.canvas-item').forEach(el => el.classList.remove('refine-highlight', 'refine-patched'));

  refineSnapshot = null;
  refinePatches = [];
  refineActiveIssues = [];
  showRefineStep(1);
  document.getElementById('refineFeedback').value = '';
  document.querySelectorAll('.refine-tag').forEach(t => t.classList.remove('selected'));
  refineSelectedTags.clear();
}

function rejectRefinement() {
  hideRefineComparison();
  restoreSnapshot(refineSnapshot);
  refineSnapshot = null;
  refinePatches = [];
  refineActiveIssues = [];
  showRefineStep(1);
}

function revertRefinement() {
  rejectRefinement();
}

async function saveToEvolve() {
  const btn = document.getElementById('btnSaveEvolve');
  if (!refineActiveIssues || refineActiveIssues.length === 0) {
    btn.textContent = 'No issues to save';
    setTimeout(() => { btn.textContent = 'Save to Evolve'; }, 2000);
    return;
  }

  btn.textContent = 'Saving...';
  btn.disabled = true;

  let savedCount = 0;
  for (const issue of refineActiveIssues) {
    // Build constraint from issue
    const constraint = issue.suggestion || issue.description || '';
    const entry = {
      title: issue.description ? issue.description.substring(0, 60) : 'Design issue',
      type: issue.type || 'consistency',
      severity: issue.severity || 'medium',
      scenario: _detectCurrentScenario(),
      issue: issue.description || '',
      fix: issue.suggestion || '',
      constraint: constraint
    };

    try {
      const base = AgentAPI._getBase();
      const res = await fetch(base + '/api/agent/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (res.ok) savedCount++;
    } catch (e) {
      console.warn('[Evolve] Save failed:', e.message);
    }
  }

  btn.textContent = `Saved ${savedCount} to evolve.md`;
  btn.disabled = false;
  setTimeout(() => { btn.textContent = 'Save to Evolve'; }, 3000);
}


function resetRefinement() {
  hideRefineComparison();
  if (refineSnapshot) restoreSnapshot(refineSnapshot);
  document.querySelectorAll('.canvas-item').forEach(el => el.classList.remove('refine-highlight', 'refine-patched'));
  refineSnapshot = null;
  refinePatches = [];
  refineActiveIssues = [];
  refineSelectedTags.clear();
  document.querySelectorAll('.refine-tag').forEach(t => t.classList.remove('selected'));
  document.getElementById('refineFeedback').value = '';
  document.getElementById('refineIssuesList').innerHTML = '';
  document.getElementById('refinePatchList').innerHTML = '';
  document.getElementById('refineSummary').innerHTML = '';
  showRefineStep(1);
}

// --- Auto Refine Loop ---

async function runAutoRefine() {
  if (_autoRefineRunning) return;
  const input = document.getElementById('autoRefineCount');
  const statusEl = document.getElementById('autoRefineStatus');
  const btn = document.getElementById('autoRefineBtn');
  let n = parseInt(input.value, 10);
  if (isNaN(n) || n < 0) n = 0;
  if (n > 5) n = 5;
  input.value = n;

  if (n === 0) {
    statusEl.textContent = 'Set 1–5 iterations to run auto refine.';
    return;
  }

  const canvas = document.getElementById('canvas');
  if (canvas.querySelectorAll('.canvas-item').length === 0) {
    statusEl.textContent = 'Generate a design first.';
    return;
  }

  _autoRefineRunning = true;
  btn.disabled = true;
  const originalBtnText = btn.textContent;

  // Severity ranking for picking the single top issue per iteration.
  const sevRank = { high: 3, medium: 2, low: 1 };
  const pickTopIssue = (issues) => {
    if (!issues || !issues.length) return null;
    return [...issues].sort((a, b) => (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0))[0];
  };

  // Use user-typed feedback as seed if provided, otherwise let agent self-analyze.
  const seedFeedback = (document.getElementById('refineFeedback').value || '').trim();

  let prevScore = null;
  let prevSnapshot = null; // snapshot BEFORE the latest applied patch (for revert if score drops)
  try {
    for (let i = 1; i <= n; i++) {
      statusEl.textContent = `Iteration ${i}/${n} — analyzing…`;
      btn.textContent = `Running ${i}/${n}`;

      // Auto prompt asks for the SINGLE most important issue + minimal patches only.
      // Explicitly forbid wholesale regeneration.
      const autoPrompt =
        '자동 품질 개선 (surgical mode): 현재 디자인에서 가장 중요한 문제 하나만 식별하고, ' +
        '그 문제에만 해당하는 최소한의 CSS 패치만 반환하세요. ' +
        '전체 레이아웃을 재생성하지 말고, 영향받는 노드만 수정합니다. ' +
        '컴포넌트 구조·종류·순서는 그대로 유지하세요.';
      const feedback = (i === 1 && seedFeedback) ? seedFeedback : autoPrompt;

      let resp;
      try {
        resp = await analyzeRefinement({ feedback, auto: true, silent: true });
      } catch (e) {
        statusEl.textContent = `Iteration ${i}: analyze failed (${e.message}). Stopped.`;
        break;
      }

      const curScore = resp && resp.critic && typeof resp.critic.score === 'number' ? resp.critic.score : null;

      // Score regression check — if the just-applied patch made things worse, revert and stop.
      if (prevScore !== null && curScore !== null && curScore < prevScore && prevSnapshot) {
        restoreSnapshot(prevSnapshot);
        statusEl.textContent =
          `Iteration ${i}: score dropped ${prevScore} → ${curScore}. Reverted and stopped.`;
        break;
      }

      const issueCount = (refineActiveIssues || []).length;
      if (issueCount === 0 && (!resp || !resp.patchPlan || !(resp.patchPlan.patches || []).length)) {
        statusEl.textContent =
          `Iteration ${i}/${n}: no issues found${curScore !== null ? ` (score ${curScore})` : ''}. Stopped.`;
        break;
      }

      // Narrow to the SINGLE top issue — surgical fix only, no wholesale rewrites.
      const top = pickTopIssue(refineActiveIssues);
      if (top) {
        refineActiveIssues = [top];
      }

      statusEl.textContent = `Iteration ${i}/${n} — planning patches…`;
      planRefinementPatches();

      // Further narrow: keep only patches whose issueType matches the top issue.
      if (top && Array.isArray(refinePatches) && refinePatches.length > 1) {
        const matching = refinePatches.filter(p => p.issueType === top.type);
        if (matching.length) refinePatches = matching;
      }

      if (!refinePatches || refinePatches.length === 0) {
        statusEl.textContent = `Iteration ${i}/${n}: no applicable patches. Stopped.`;
        break;
      }

      // Snapshot BEFORE apply so we can revert if next critic score regresses.
      prevSnapshot = captureSnapshot();
      prevScore = curScore;

      statusEl.textContent =
        `Iteration ${i}/${n} — applying ${refinePatches.length} patch(es) for "${top ? top.type : 'top'}"…`;
      applyRefinementPatches();

      // Let DOM settle
      await new Promise(r => setTimeout(r, 400));

      // Accept to clear step state (snapshot cleared inside, but prevSnapshot retained separately)
      acceptRefinement();

      statusEl.textContent =
        `Iteration ${i}/${n} — done${curScore !== null ? ` (score ${curScore})` : ''}.`;
      await new Promise(r => setTimeout(r, 250));
    }
    statusEl.textContent =
      `Auto refine complete${prevScore !== null ? ` · last score ${prevScore}/100` : ''}.`;
  } finally {
    _autoRefineRunning = false;
    btn.disabled = false;
    btn.textContent = originalBtnText;
  }
}

// --- Step visibility ---
function showRefineStep(step) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('refineStep' + i);
    if (el) el.classList.toggle('visible', i <= step);
  }
}

