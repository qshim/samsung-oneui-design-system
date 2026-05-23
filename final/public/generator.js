// ============================================================================
//  GENERATOR — Samsung One UI background & surface resolver
//  ---------------------------------------------------------------------------
//  Pure logic. No LLM. No DOM. Usable from Node + browser.
//  Takes a canonical uiState (baseSurface / overlayType / attentionMode / etc.)
//  and emits the 3-layer background + surface decision a renderer needs.
//
//  Guideline source (One UI 4+):
//  ---------------------------------------------------------------------------
//  ① Wallpaper layer — Home / Lock screen
//     - User's wallpaper is visible.
//     - Color extraction is mood-level only (low-saturation) — NOT direct
//       sampling — so content stays the visual focus.
//     - Quick Panel / Notification Shade sit on this layer with blur + dim.
//
//  ② App background layer — Settings / Messages / Contacts / Gallery / …
//     - Simple, calm colors. The surface should disappear.
//     - Light mode: off-white (near-white, not pure #FFFFFF).
//     - Dark mode: deep gray (NOT pure #000000), unless the device bezel is
//       black — in that case pure black is allowed to merge with the bezel
//       and make the screen feel larger.
//
//  ③ Focus block layer — setting rows / list items / widgets / cards
//     - Monotone palette. Three types:
//       Type 1 — standard monotone (most common; message list, setting rows,
//                functional content).
//       Type 2 — tinted from the app's brand color, low-saturation
//                (active toggle row, selected state; brighter in Light,
//                 deeper in Dark).
//       Type 3 — gradient. Use sparingly; complexity risk.
// ============================================================================

'use strict';

/** @see typography-rules.js — 폰트/자간 강제 단일 진입점 */
function _TypographyRulesResolve() {
  if (typeof TypographyRules !== 'undefined') return TypographyRules;
  try {
    if (typeof require !== 'undefined') return require('./typography-rules');
  } catch (eTr) { /* omit */ }
  return null;
}

// ---------------------------------------------------------------------------
//  Token tables
// ---------------------------------------------------------------------------

const APP_BG_TOKENS = {
  light: {
    default:     '#F7F8FA',   // off-white
    edgeToBezel: '#FFFFFF'    // optional: merge w/ white bezel device
  },
  dark: {
    default:     '#121316',   // deep gray, not pure black
    edgeToBezel: '#000000'    // merge w/ black bezel (default on Galaxy)
  }
};

const FOCUS_BLOCK_TOKENS = {
  light: {
    type1_standard:  { background: '#FFFFFF', border: '#E8EAED', text: '#1A1C1E' },
    type2_tinted:    { background: '#E8F2FF', border: 'transparent', text: '#0A4DA6' },
    type3_gradient:  { background: 'linear-gradient(135deg,#E8F2FF 0%,#F5E8FF 100%)', border: 'transparent', text: '#1A1C1E' }
  },
  dark: {
    type1_standard:  { background: '#1E1F23', border: '#2A2C30', text: '#E3E4E7' },
    type2_tinted:    { background: '#1A2A44', border: 'transparent', text: '#7AB8FF' },
    type3_gradient:  { background: 'linear-gradient(135deg,#1A2A44 0%,#2A1A44 100%)', border: 'transparent', text: '#E3E4E7' }
  }
};

const WALLPAPER_LAYER = {
  // Mood extraction: sampled wallpaper hue is desaturated ~60% and darkened
  // ~30% before being applied as scrim / tint color. This object records the
  // transform parameters — the renderer does the actual extraction.
  moodExtraction: {
    saturationMultiplier: 0.4,   // 0 = fully desaturated
    lightnessMultiplier:  0.7,   // darken
    usage: ['scrim-tint', 'notification-shade-dim', 'quick-panel-blur-tint']
  },
  overlayScrim: {
    'quick-settings':     { blurPx: 24, dimAlpha: 0.45 },
    'notification-shade': { blurPx: 24, dimAlpha: 0.45 },
    'system-dialog':      { blurPx:  0, dimAlpha: 0.60 }
  }
};

// ---------------------------------------------------------------------------
//  Layer 1 — wallpaper layer decision
// ---------------------------------------------------------------------------
//  Active when baseSurface is 'lock' OR 'home' (with or without shade/QS
//  overlay). backgroundPolicy will be 'wallpaper' or 'scrim-over-wallpaper'.
// ---------------------------------------------------------------------------

function resolveWallpaperLayer(uiState) {
  const on = (uiState.baseSurface === 'lock' || uiState.baseSurface === 'home');
  if (!on) return null;

  const overlay = uiState.overlayType || 'none';
  const scrim   = WALLPAPER_LAYER.overlayScrim[overlay] || null;

  return {
    showUserWallpaper: true,
    moodExtraction:    WALLPAPER_LAYER.moodExtraction,
    overlayScrim:      scrim,                         // null when no overlay
    backgroundPolicy:  scrim ? 'scrim-over-wallpaper' : 'wallpaper'
  };
}

// ---------------------------------------------------------------------------
//  Layer 2 — app background decision
// ---------------------------------------------------------------------------
//  Active for baseSurface='app' (most system/third-party apps).
//  Also covers scrim-over-app when a shade/QS floats over an app surface.
// ---------------------------------------------------------------------------

function resolveAppBackground(uiState, opts) {
  const o = opts || {};
  const theme = (o.theme === 'light') ? 'light' : 'dark';
  const edgeToBezel = !!o.edgeToBezel;      // true → merge with bezel
  const tokens = APP_BG_TOKENS[theme];
  const color  = edgeToBezel ? tokens.edgeToBezel : tokens.default;

  const overlay = uiState.overlayType || 'none';
  let backgroundPolicy = 'solid-dark';
  if (theme === 'light') backgroundPolicy = 'solid-light';
  if (overlay === 'quick-settings' || overlay === 'notification-shade') {
    backgroundPolicy = 'scrim-over-app';
  }
  if (overlay === 'system-dialog') {
    backgroundPolicy = 'dialog-surface';
  }

  return {
    theme,
    color,
    edgeToBezel,
    backgroundPolicy,
    // scrim values only meaningful when backgroundPolicy === 'scrim-over-app'
    scrim: WALLPAPER_LAYER.overlayScrim[overlay] || null
  };
}

// ---------------------------------------------------------------------------
//  Layer 3 — focus block decision
// ---------------------------------------------------------------------------
//  Called per-component, not per-screen. Picks one of 3 focus-block types
//  based on the component's role:
//    - 'functional' (list row, setting row, message item)        → Type 1
//    - 'active'     (toggled on, selected, brand-tinted state)   → Type 2
//    - 'hero'       (feature card, onboarding highlight, promo)  → Type 3
//
//  The renderer passes (role, theme, brandHueCss?) — brandHueCss is only
//  used if you later replace the fixed Type-2 token with an app-specific tint.
// ---------------------------------------------------------------------------

function resolveFocusBlock(role, opts) {
  const o = opts || {};
  const theme = (o.theme === 'light') ? 'light' : 'dark';
  const table = FOCUS_BLOCK_TOKENS[theme];

  let key = 'type1_standard';
  if (role === 'active')  key = 'type2_tinted';
  if (role === 'hero')    key = 'type3_gradient';

  const token = table[key];
  return {
    type: key,
    background: token.background,
    border:     token.border,
    textColor:  token.text,
    // Gradient blocks carry caution flag so the composer can enforce
    // "use sparingly" — e.g. at most 1 type-3 block per screen.
    cautionUseSparingly: (key === 'type3_gradient')
  };
}

// ---------------------------------------------------------------------------
//  Top-level resolver
// ---------------------------------------------------------------------------
//  Given a canonical uiState + optional render opts, returns the layered
//  decision a renderer/composer needs. Exactly one of {wallpaper, app} is
//  non-null; focusBlockDefaults is always present (renderer picks type
//  per-component via resolveFocusBlock).
// ---------------------------------------------------------------------------

function resolveLayers(uiState, opts) {
  const o = opts || {};
  const theme = (o.theme === 'light') ? 'light' : 'dark';
  const edgeToBezel = !!o.edgeToBezel;

  const wallpaper = resolveWallpaperLayer(uiState);
  const app       = wallpaper ? null : resolveAppBackground(uiState, { theme, edgeToBezel });

  return {
    theme,
    wallpaperLayer: wallpaper,
    appLayer:       app,
    focusBlockDefaults: {
      type1: FOCUS_BLOCK_TOKENS[theme].type1_standard,
      type2: FOCUS_BLOCK_TOKENS[theme].type2_tinted,
      type3: FOCUS_BLOCK_TOKENS[theme].type3_gradient
    },
    // One convenient policy field for the canvas frame:
    backgroundPolicy: wallpaper ? wallpaper.backgroundPolicy : app.backgroundPolicy
  };
}

// ---------------------------------------------------------------------------
//  Soft validators — return violations (not exceptions). The pipeline's
//  rollup can fold these into the canonical violations[] output.
// ---------------------------------------------------------------------------

function validateBackgroundUsage(uiState, components, opts) {
  const o = opts || {};
  const theme = (o.theme === 'light') ? 'light' : 'dark';
  const out = [];

  // 1) pure #000 / #FFF only allowed in edge-to-bezel mode
  if (!o.edgeToBezel) {
    const bgColor = (resolveAppBackground(uiState, { theme, edgeToBezel: false }) || {}).color;
    if (bgColor === '#000000' || bgColor === '#FFFFFF') {
      out.push({
        ruleId: 'bg_calm_color',
        severity: 'medium',
        message: 'App background must be off-white / deep-gray, not pure black/white, unless edge-to-bezel is enabled.'
      });
    }
  }

  // 2) cap type-3 gradient usage at 1 per screen
  const comps = Array.isArray(components) ? components : [];
  const type3Count = comps.filter(c => c && c.focusBlockRole === 'hero').length;
  if (type3Count > 1) {
    out.push({
      ruleId: 'focus_block_type3_cap',
      severity: 'low',
      message: `Type-3 gradient focus block should appear at most once per screen; found ${type3Count}.`
    });
  }

  // 3) wallpaper layer must not coexist with a solid app-bg request
  if ((uiState.baseSurface === 'home' || uiState.baseSurface === 'lock') &&
      o.forceSolidBackground) {
    out.push({
      ruleId: 'wallpaper_layer_integrity',
      severity: 'high',
      message: 'Home/Lock scenarios must preserve the wallpaper layer; forceSolidBackground is disallowed here.'
    });
  }

  return out;
}

// ===========================================================================
//  DESIGN-MEMORY-DRIVEN RULES
//  ---------------------------------------------------------------------------
//  Below functions consult DesignMemory (design_memory.js barrel) to decide
//  component size, margin, position and ordering for a given ui_state.
//  They never improvise — every value is looked up from
//    • component_registry.json       (unified registry, adapted to array by design_memory.js)
//    • generator_memory.json         (screens, spacingRhythm, radiusRules, surfaceRules,
//                                     collapseRules, componentMappings)
//    • orchestration_rules.json      (pair-gap rules between component types)
//    • global_rules.json             (touch-target min, spacing scale enforcement)
//
//  All functions accept an explicit `memory` arg so they work in Node or in
//  the browser after `window.DesignMemory.ready` has resolved. If `memory`
//  is omitted, we fall back to window.DesignMemory (browser) or
//  require('./design_memory') (node) lazily.
//
//  ORPHAN RULE FILES (now consumed):
//    • orchestration_rules.json  →  pair-gap lookup in resolveSpacing / validatePairGaps
//    • global_rules.json         →  touch-target min + spacing scale in validateGlobalRules
// ===========================================================================

// ---------------------------------------------------------------------------
//  Load orphan rule files (Node sync / browser async via DesignMemory)
// ---------------------------------------------------------------------------
var _orchestrationRules = null;
var _globalRules = null;
(function _loadOrphanRules() {
  if (typeof require === 'function') {
    var fs, path;
    try {
      fs = require('fs'); path = require('path');
      var dir = (typeof __dirname !== 'undefined') ? __dirname : '.';
      _orchestrationRules = JSON.parse(fs.readFileSync(path.join(dir, 'figma-refs', 'orchestration_rules.json'), 'utf8'));
      _globalRules        = JSON.parse(fs.readFileSync(path.join(dir, 'figma-refs', 'global_rules.json'), 'utf8'));
    } catch (_) { /* browser or missing */ }
  }
  // Browser: loaded lazily via fetch if needed
})();

function _getOrchestrationRules() {
  if (_orchestrationRules) return _orchestrationRules.rules || [];
  if (typeof window !== 'undefined' && window._generatorOrchRules) return window._generatorOrchRules;
  return [];
}
function _getGlobalRules() {
  if (_globalRules) return _globalRules.rules || [];
  if (typeof window !== 'undefined' && window._generatorGlobalRules) return window._generatorGlobalRules;
  return [];
}

// ---------------------------------------------------------------------------
//  Refinement rules loader
// ---------------------------------------------------------------------------
var _refinementRules = null;
(function _loadRefinementRules() {
  if (typeof require === 'function') {
    try {
      var fs2 = require('fs'), path2 = require('path');
      var dir2 = (typeof __dirname !== 'undefined') ? __dirname : '.';
      _refinementRules = JSON.parse(fs2.readFileSync(path2.join(dir2, 'figma-refs', 'refinement_rules.json'), 'utf8'));
    } catch (_) { /* browser or missing */ }
  }
})();
function _getRefinementRules() {
  if (_refinementRules) return (_refinementRules.rules || []).filter(function (r) { return r.enabled !== false; });
  if (typeof window !== 'undefined' && window._generatorRefinementRules) return window._generatorRefinementRules;
  return [];
}

function _getMemory(memory) {
  if (memory && memory.generatorMemory) return memory;
  if (typeof window !== 'undefined' && window.DesignMemory &&
      window.DesignMemory.generatorMemory) {
    return window.DesignMemory;
  }
  if (typeof require === 'function') {
    try { return require('./design_memory'); } catch (_) { /* ignore */ }
  }
  return null;
}

function _ctxKey(uiState) {
  // overlay wins over baseSurface when choosing a screen spec
  if (uiState.overlayType === 'quick-settings')     return 'quick-settings';
  if (uiState.overlayType === 'notification-shade') return 'notification-shade';
  if (uiState.overlayType === 'system-dialog')      return 'system-dialog';
  if (uiState.baseSurface === 'lock') return 'lock';
  if (uiState.baseSurface === 'home') return 'home';
  return 'app';
}

// ---------------------------------------------------------------------------
//  SIZE — resolveComponentSize(id | role, memory?)
//     → { minWidth, minHeight, padding:{t,r,b,l}, gap }
// ---------------------------------------------------------------------------

function resolveComponentSize(ref, memory) {
  const mem = _getMemory(memory);
  if (!mem) return null;
  const reg = mem.componentRegistry || [];
  let entry = reg.find(c => c.id === ref);
  if (!entry) {
    const mapped = (mem.generatorMemory.componentMappings || {})['by-role'] || {};
    const id = mapped[ref];
    if (id) entry = reg.find(c => c.id === id);
  }
  if (!entry) return null;
  return {
    id:        entry.id,
    minWidth:  entry.layoutSpec.minWidth,
    minHeight: entry.layoutSpec.minHeight,
    padding:   entry.layoutSpec.padding,
    gap:       entry.layoutSpec.gap,
    radius:    entry.tokens.radius
  };
}

// ---------------------------------------------------------------------------
//  RADIUS — resolveRadius(roleOrId, memory?)
//     Consults radiusRules.byRole first, then component tokens.
// ---------------------------------------------------------------------------

function resolveRadius(ref, memory) {
  const mem = _getMemory(memory);
  if (!mem) return null;
  const byRole = (mem.generatorMemory.radiusRules || {}).byRole || {};
  if (byRole[ref] != null) return byRole[ref];
  const size = resolveComponentSize(ref, mem);
  return size ? size.radius : null;
}

// ---------------------------------------------------------------------------
//  SPACING — resolveSpacing(uiState, memory?)
//     → { outerPadding, gap, rhythm:{intraGroup,controlToText,betweenRows,…} }
// ---------------------------------------------------------------------------

function resolveSpacing(uiState, memory) {
  const mem = _getMemory(memory);
  if (!mem) return null;
  const gm  = mem.generatorMemory;
  const key = _ctxKey(uiState);
  const screen = (gm.screens || {})[key] || {};
  return {
    ctx:          key,
    outerPadding: screen.outerPadding || { top: 16, right: 18, bottom: 0, left: 18 },
    gap:          screen.gridGap != null ? screen.gridGap
                  : (gm.layoutPatterns[screen.preferredLayoutContainer] || {}).defaultGap || 10,
    container:    screen.preferredLayoutContainer || 'vertical-stack',
    rhythm:       gm.spacingRhythm || {}
  };
}

// ---------------------------------------------------------------------------
//  FILTER — filterAllowedComponents(uiState, refs, memory?)
//     Drops any component whose category is disallowed for this ui_state.
// ---------------------------------------------------------------------------

// Fuzzy lookup: exact ID first, then prefix match (e.g. "card.hero" → "card"),
// then role match via componentMappings.by-role.
function _findRegistryEntry(reg, id, gm) {
  // 1. Exact match
  var entry = reg.find(function (c) { return c.id === id; });
  if (entry) return entry;
  // 2. Prefix match: "card.hero" → try "card", "button.contained" → "button"
  var dotIdx = id.indexOf('.');
  if (dotIdx > 0) {
    var prefix = id.substring(0, dotIdx);
    entry = reg.find(function (c) { return c.id === prefix; });
    if (entry) return entry;
  }
  // 3. Role mapping: check by-role in componentMappings
  if (gm && gm.componentMappings && gm.componentMappings['by-role']) {
    var mapped = gm.componentMappings['by-role'][id];
    if (mapped) {
      entry = reg.find(function (c) { return c.id === mapped; });
      if (entry) return entry;
    }
  }
  return null;
}

function filterAllowedComponents(uiState, refs, memory) {
  const mem = _getMemory(memory);
  if (!mem) return refs || [];
  const reg  = mem.componentRegistry || [];
  const gm   = mem.generatorMemory || {};
  const key  = _ctxKey(uiState);
  const rule = (mem.generatorMemory.surfaceRules || {})[key] || {};
  const allowed    = new Set(rule.allowedCategories    || []);
  const disallowed = new Set(rule.disallowedCategories || []);

  // The filter is gated by TWO separate authorities:
  //
  //  1. surfaceRules.{ctxKey}.allowedCategories / disallowedCategories
  //     A coarse per-surface categorical whitelist/blacklist authored in
  //     generator_memory.json. E.g. "home" allows chrome/widget/primitive/
  //     navigation but NOT info-card/media/selection.
  //
  //  2. component.allowedContexts
  //     Per-component list of contexts where this component fits (drawn
  //     from design memory — "message_summary_card → ['driving',
  //     'glanceable','quick-view']").
  //
  // The previous logic AND-joined these: both must pass. That was too
  // strict — semantic cards picked by Step-3 planner (info-card, media,
  // selection) all had legitimate `allowedContexts` matches for the
  // active uiState, but got killed by the category whitelist and the
  // plan emptied out. Now we OR them: a component passes if either
  //   (a) the surface's category whitelist lets it through, OR
  //   (b) its own allowedContexts explicitly declares a match with any
  //       current uiState dimension (surface / attention / mobility /
  //       interaction / density / scenario).
  // The disallowedCategories blacklist still hard-rejects regardless.
  const ctxTokens = [
    key,
    uiState.baseSurface,
    uiState.overlayType,
    uiState.attentionMode,
    uiState.mobilityMode,
    uiState.interactionMode,
    uiState.densityMode
  ].filter(Boolean);

  return (refs || []).filter(r => {
    const entry = _findRegistryEntry(reg, r, gm);
    if (!entry) return false;
    if (disallowed.has(entry.category)) return false;

    const categoryOK = allowed.size === 0 || allowed.has(entry.category);
    const contexts = Array.isArray(entry.allowedContexts) ? entry.allowedContexts : [];
    const contextOK = contexts.length === 0 ||
      ctxTokens.some(t => contexts.includes(t));

    // Pass if EITHER the surface approves the category OR the component
    // itself declares a context match for this uiState.
    return categoryOK || contextOK;
  });
}

// ---------------------------------------------------------------------------
//  ORDER — resolveOrder(uiState, requestedRefs, memory?)
//     Canonical ordering:
//       1) status-bar / chrome first (if present or mandatory)
//       2) mandatoryComponents for screen, in declared order
//       3) requested extras (deduped), preserving caller order
//       4) navigation / gesture bar last
//     Then applies collapseRules for compressed density.
// ---------------------------------------------------------------------------

function resolveOrder(uiState, requestedRefs, memory, opts) {
  const mem = _getMemory(memory);
  if (!mem) return requestedRefs || [];
  const gm  = mem.generatorMemory;
  const reg = mem.componentRegistry || [];
  const key = _ctxKey(uiState);
  const screen = (gm.screens || {})[key] || {};
  const options = opts || {};

  const mandatory = (screen.mandatoryComponents || []).slice();
  const requested = (requestedRefs || []).slice();

  // 1) Merge: mandatory first, then requested (dedup)
  const seen = new Set();
  const merged = [];
  [...mandatory, ...requested].forEach(id => {
    if (!seen.has(id)) { seen.add(id); merged.push(id); }
  });

  // 2) Filter by surface rules
  let ordered = filterAllowedComponents(uiState, merged, mem);

  // 3) Apply collapseRules (skip when building reference layout for LLM)
  const density = uiState.densityMode || 'normal';
  const collapse = (gm.collapseRules || {})[density] || {};
  const dropSet  = new Set(collapse.dropFirst || []);
  const preserve = new Set(collapse.preserveAlways || []);
  const cap = ((gm.collapseRules || {}).byOverlay || {})[uiState.overlayType || 'none'];
  const maxVisible = (cap && cap.maxVisibleGroups) || screen.maxVisibleGroups || 6;

  // Drop collapsible entries until we're under cap (preserve always stays)
  // When skipCollapse=true (used for reference layout), we keep all components
  // so the LLM sees the full design-system ordering and decides collapse itself.
  if (!options.skipCollapse && ordered.length > maxVisible) {
    const dropOrder = ordered.filter(id => dropSet.has(id) && !preserve.has(id));
    for (const id of dropOrder) {
      if (ordered.length <= maxVisible) break;
      ordered = ordered.filter(x => x !== id);
    }
    // fallback: drop by collapsePriority desc (larger priority → drop first)
    if (ordered.length > maxVisible) {
      ordered.sort((a, b) => {
        const pa = (_findRegistryEntry(reg, a, gm) || {}).behavior || {};
        const pb = (_findRegistryEntry(reg, b, gm) || {}).behavior || {};
        return (pb.collapsePriority || 0) - (pa.collapsePriority || 0);
      });
      while (ordered.length > maxVisible) {
        const id = ordered.shift();
        if (preserve.has(id)) { ordered.push(id); break; }
      }
    }
  }

  // 4) Re-sort: chrome (status-bar / section-label) → widgets/containers →
  //    primitives at the very end (page indicator, nav gesture bar).
  const weight = (id) => {
    const entry = _findRegistryEntry(reg, id, gm);
    if (!entry) return 50;
    // Bottom-anchored navigation (regardless of category) — always near end
    if (entry.id === 'bottomnav' || entry.id === 'pill-tab' || entry.id === 'tab-bar' ||
        entry.role === 'bottomnav' || entry.role === 'pill-tab' ||
        entry.id.includes('nav-gestures') || entry.id.includes('nav-buttons')) return 90;
    if (entry.id === 'status-bar.default' || entry.id === 'status-bar') return 0;
    if (entry.id === 'appbar' || entry.id.includes('app-bar')) return 5;
    if (entry.category === 'chrome')       return 10;
    if (entry.category === 'overlay')      return 15;
    if (entry.category === 'widget')       return 30;
    if (entry.category === 'media')        return 35;
    if (entry.category === 'container')    return 40;
    if (entry.category === 'notification') return 42;
    if (entry.category === 'selection')    return 45;
    if (entry.category === 'input')        return 46;
    if (entry.category === 'action')       return 55;
    if (entry.category === 'navigation') return 90;
    if (entry.category === 'primitive') {
      if (entry.role === 'home-gesture-bar' || entry.role === 'page-indicator') return 95;
      return 60;
    }
    return 50;
  };
  ordered.sort((a, b) => weight(a) - weight(b));

  return ordered;
}

// ---------------------------------------------------------------------------
//  POSITION — resolvePositions(uiState, orderedRefs, memory?)
//     Returns layout instructions per component:
//       - vertical-stack  → cumulative y with gap (+ anchor override)
//       - grid            → (row, col, span) via cell-width snap
//       - horizontal-stack→ x flow
//       - overlay-stack   → absolute anchor
// ---------------------------------------------------------------------------

function resolvePositions(uiState, orderedRefs, memory) {
  const mem = _getMemory(memory);
  if (!mem) return [];
  const gm  = mem.generatorMemory;
  const reg = mem.componentRegistry || [];
  const key = _ctxKey(uiState);
  const screen  = (gm.screens || {})[key] || {};
  const spacing = resolveSpacing(uiState, mem);
  const anchors = screen.anchorAreas || {};
  const container = spacing.container;
  const gap = spacing.gap;
  const pad = spacing.outerPadding;

  const entries = (orderedRefs || [])
    .map(id => _findRegistryEntry(reg, id, gm))
    .filter(Boolean);

  if (container === 'vertical-stack') {
    let y = pad.top;
    return entries.map(e => {
      // Anchor override for known roles (lock screen clock, shortcut row, …)
      let override = null;
      if (e.id === 'lock-screen.clock'       && anchors.clockBlock)  override = anchors.clockBlock;
      if (e.role === 'lock-shortcut'         && anchors.shortcutRow) override = anchors.shortcutRow;
      if (e.id === 'status-bar.default'      && anchors.topStatus)   override = anchors.topStatus;

      const row = override
        ? { top: override.top, left: override.left != null ? override.left : pad.left,
            width: override.width || (e.layoutSpec.minWidth) }
        : { top: y, left: pad.left, width: e.layoutSpec.minWidth };

      if (!override) y += e.layoutSpec.minHeight + gap;
      return {
        id: e.id, role: e.role, ...row,
        height: override && override.height ? override.height : e.layoutSpec.minHeight,
        margin: { top: override ? 0 : gap, right: 0, bottom: 0, left: 0 }
      };
    });
  }

  if (container === 'grid') {
    const cellWidths = (gm.layoutPatterns.grid || {}).cellWidths || [88, 199, 408];
    let x = pad.left, y = pad.top, rowH = 0;
    const contentWidth = 451 - pad.left - pad.right;  // frame width default
    return entries.map(e => {
      const w = e.layoutSpec.minWidth;
      const h = e.layoutSpec.minHeight;
      // Full-bleed rows bump to a fresh row
      if (w >= contentWidth - 10) {
        if (x > pad.left) { y += rowH + gap; x = pad.left; rowH = 0; }
        const out = { id: e.id, role: e.role, top: y, left: x, width: w, height: h,
                      margin: { top: gap, right: 0, bottom: 0, left: 0 } };
        y += h + gap; x = pad.left; rowH = 0;
        return out;
      }
      // Wrap to next row when no horizontal space
      if (x + w > pad.left + contentWidth) {
        y += rowH + gap; x = pad.left; rowH = 0;
      }
      const out = { id: e.id, role: e.role, top: y, left: x, width: w, height: h,
                    margin: { top: 0, right: gap, bottom: 0, left: 0 } };
      x += w + gap;
      if (h > rowH) rowH = h;
      return out;
    });
  }

  if (container === 'horizontal-stack') {
    let x = pad.left;
    return entries.map(e => {
      const out = { id: e.id, role: e.role, top: pad.top, left: x,
                    width: e.layoutSpec.minWidth, height: e.layoutSpec.minHeight,
                    margin: { top: 0, right: gap, bottom: 0, left: 0 } };
      x += e.layoutSpec.minWidth + gap;
      return out;
    });
  }

  // overlay-stack (system-dialog)
  return entries.map(e => ({
    id: e.id, role: e.role,
    top:    e.category === 'overlay' && e.role === 'modal-dim' ? 0 : pad.top + 120,
    left:   e.category === 'overlay' && e.role === 'modal-dim' ? 0 : pad.left,
    width:  e.category === 'overlay' && e.role === 'modal-dim' ? 451 : e.layoutSpec.minWidth,
    height: e.category === 'overlay' && e.role === 'modal-dim' ? 978 : e.layoutSpec.minHeight,
    margin: { top: gap, right: 0, bottom: 0, left: 0 }
  }));
}

// ---------------------------------------------------------------------------
//  PLAN — resolveScreenPlan(uiState, requestedRefs?, opts?)
//     Top-level convenience: background layers + spacing + ordered refs +
//     per-component positions. One call returns everything the composer needs.
// ---------------------------------------------------------------------------

function resolveScreenPlan(uiState, requestedRefs, opts) {
  const o = opts || {};
  const mem = _getMemory(o.memory);
  const layers  = resolveLayers(uiState, o);
  const spacing = resolveSpacing(uiState, mem);
  const ordered = resolveOrder(uiState, requestedRefs || [], mem);
  var positions = resolvePositions(uiState, ordered, mem);

  // --- AUTO-REFINE: analyze + patch before returning ---
  var refined = autoRefine(positions, uiState, mem);
  positions = refined.positions;

  return {
    ctx: spacing && spacing.ctx,
    layers,
    spacing,
    components: positions.map(function (pos) {
      var size = resolveComponentSize(pos.id, mem) || {};
      return {
        id: pos.id,
        size: size,
        radius: resolveRadius(pos.id, mem),
        position: pos,
        margin: pos.margin || null,
        _inserted: pos._inserted || false,
        _slots: pos._slots || null,
        _overflow: pos._overflow || false
      };
    }),
    refinements: refined.appliedPatches,
    violations: [].concat(
      validateBackgroundUsage(uiState, [], o),
      validatePairGaps(positions),
      validateGlobalRules(positions, mem)
    )
  };
}

// ---------------------------------------------------------------------------
//  PAIR-GAP — resolvePairGap(fromRole, toRole, context?)
//  Consults orchestration_rules.json for the expected gap between two
//  adjacent components. Falls back to the screen default gap.
// ---------------------------------------------------------------------------

function resolvePairGap(fromRole, toRole, context) {
  var ctx = context || 'default';
  var rules = _getOrchestrationRules();
  // Direct match
  var rule = rules.find(function (r) {
    return r.fromType === fromRole && r.toType === toRole &&
           (r.context === ctx || r.context === 'default');
  });
  // Try reverse
  if (!rule) {
    rule = rules.find(function (r) {
      return r.fromType === toRole && r.toType === fromRole &&
             (r.context === ctx || r.context === 'default');
    });
  }
  if (rule) return { gap: rule.expectedGap, tolerance: rule.tolerance, severity: rule.severity, ruleId: rule.id };
  return null;
}

// ---------------------------------------------------------------------------
//  validatePairGaps(orderedPositions)
//  Given the output of resolvePositions, checks adjacent pairs against
//  orchestration_rules and returns violations.
// ---------------------------------------------------------------------------

function validatePairGaps(orderedPositions) {
  var out = [];
  if (!Array.isArray(orderedPositions) || orderedPositions.length < 2) return out;
  for (var i = 0; i < orderedPositions.length - 1; i++) {
    var a = orderedPositions[i], b = orderedPositions[i + 1];
    var actualGap = b.top - (a.top + a.height);
    var rule = resolvePairGap(a.role, b.role);
    if (!rule) continue;
    var delta = Math.abs(actualGap - rule.gap);
    if (delta > rule.tolerance) {
      out.push({
        ruleId:   rule.ruleId,
        severity: rule.severity,
        from:     a.id,
        to:       b.id,
        expected: rule.gap,
        actual:   actualGap,
        delta:    delta,
        message:  a.id + ' → ' + b.id + ': gap ' + actualGap + 'px, expected ' + rule.gap + '±' + rule.tolerance + 'px'
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
//  validateGlobalRules(orderedPositions, memory?)
//  Checks global_rules.json constraints against resolved components:
//    - touch_target_min: interactive elements must be ≥ 48dp on both axes
//    - spacing_scale_rule: all gaps must land on the allowed scale
// ---------------------------------------------------------------------------

function validateGlobalRules(orderedPositions, memory) {
  var out = [];
  var rules = _getGlobalRules();
  var mem = _getMemory(memory);
  var reg = mem ? (mem.componentRegistry || []) : [];

  var touchRule = rules.find(function (r) { return r.id === 'touch_target_min'; });
  var scaleRule = rules.find(function (r) { return r.id === 'spacing_scale_rule'; });
  var allowedScale = scaleRule ? new Set(scaleRule.allowedValues) : null;
  var snapWithin = scaleRule ? scaleRule.snapWithin : 3;

  (orderedPositions || []).forEach(function (pos) {
    var entry = reg.find(function (c) { return c.id === pos.id; });
    var interactive = entry && entry.behavior && entry.behavior.interactive;

    // Touch target check
    if (touchRule && interactive) {
      var minDim = touchRule.min || 48;
      if (pos.width < minDim || pos.height < minDim) {
        out.push({
          ruleId:   'touch_target_min',
          severity: touchRule.severity || 'high',
          element:  pos.id,
          actual:   pos.width + 'x' + pos.height,
          expected: minDim + 'x' + minDim,
          message:  pos.id + ' is ' + pos.width + 'x' + pos.height + 'px but interactive elements need ≥' + minDim + 'dp'
        });
      }
    }

    // Spacing scale check on margins
    if (allowedScale && pos.margin) {
      ['top', 'right', 'bottom', 'left'].forEach(function (side) {
        var val = pos.margin[side];
        if (val === 0) return;
        if (!allowedScale.has(val)) {
          // Check snap tolerance
          var closest = null;
          allowedScale.forEach(function (s) { if (closest === null || Math.abs(s - val) < Math.abs(closest - val)) closest = s; });
          if (closest !== null && Math.abs(closest - val) <= snapWithin) return; // within snap
          out.push({
            ruleId:   'spacing_scale_rule',
            severity: scaleRule.severity || 'medium',
            element:  pos.id,
            property: 'margin.' + side,
            actual:   val,
            expected: 'one of [' + Array.from(allowedScale).join(',') + ']',
            message:  pos.id + ' margin.' + side + '=' + val + ' is off the 4dp spacing scale'
          });
        }
      });
    }
  });

  return out;
}

// ===========================================================================
//  AUTO-REFINE ENGINE
//  ---------------------------------------------------------------------------
//  Runs refinement_rules.json analyzers against a resolved plan, then applies
//  matching patchers. Called automatically at the end of resolveScreenPlan.
//  Each rule has: analyzer (detect pattern) + patcher (fix it).
//
//  Adding a new rule = adding JSON to refinement_rules.json. No code change.
//  The system improves every time a refine comment reveals a new pattern.
// ===========================================================================

// ---------------------------------------------------------------------------
//  ANALYZERS — each returns { matched: bool, targets: [...] }
// ---------------------------------------------------------------------------

var _analyzers = {
  // Detect N+ consecutive components of the same category
  'consecutive-same-category': function (positions, params, uiState, mem) {
    var cat = params.category;
    var minCount = params.minCount || 3;
    var area = params.area || 'any';
    var reg = mem ? (mem.componentRegistry || []) : [];
    var runs = [], current = [];

    (positions || []).forEach(function (pos, i) {
      var entry = reg.find(function (c) { return c.id === pos.id; });
      var match = entry && entry.category === cat;
      if (match) {
        current.push({ index: i, pos: pos });
      } else {
        if (current.length >= minCount) runs.push(current.slice());
        current = [];
      }
    });
    if (current.length >= minCount) runs.push(current.slice());

    // Area filter
    if (area === 'top-half') {
      var midY = 978 / 2;
      runs = runs.filter(function (run) { return run[0].pos.top < midY; });
    }
    return { matched: runs.length > 0, targets: runs };
  },

  // Detect missing component for a specific context
  'context-missing-component': function (positions, params, uiState) {
    var ctxMatch = params.contextMatch || {};
    var matches = Object.keys(ctxMatch).every(function (k) { return uiState[k] === ctxMatch[k]; });
    if (!matches) return { matched: false, targets: [] };
    var requiredRole = params.requiredRole;
    var has = (positions || []).some(function (p) { return p.role === requiredRole; });
    if (has) return { matched: false, targets: [] };
    return { matched: true, targets: [{ missingRole: requiredRole, fallbackId: params.fallbackComponentId }] };
  },

  // Detect attention mode overflow
  'attention-overflow': function (positions, params, uiState) {
    var mode = params.attentionMode;
    var max = params.maxComponents || 4;
    if (!uiState || uiState.attentionMode !== mode) return { matched: false, targets: [] };
    if ((positions || []).length <= max) return { matched: false, targets: [] };
    return { matched: true, targets: [{ currentCount: positions.length, maxAllowed: max }] };
  },

  // Detect interactive elements smaller than minimum
  'undersized-interactive': function (positions, params, uiState, mem) {
    var minSize = params.minSize || 48;
    var reg = mem ? (mem.componentRegistry || []) : [];
    var hits = [];
    (positions || []).forEach(function (pos) {
      var entry = reg.find(function (c) { return c.id === pos.id; });
      if (entry && entry.behavior && entry.behavior.interactive) {
        if (pos.width < minSize || pos.height < minSize) {
          hits.push(pos);
        }
      }
    });
    return { matched: hits.length > 0, targets: hits };
  },

  // Detect pair-gap violations
  'pair-gap-violation': function (positions) {
    var violations = validatePairGaps(positions);
    return { matched: violations.length > 0, targets: violations };
  }
};

// ---------------------------------------------------------------------------
//  PATCHERS — each mutates positions array and returns { applied: bool, patches: [...] }
// ---------------------------------------------------------------------------

var _patchers = {
  // Wrap consecutive items into a horizontal-scroll group
  'group-wrap': function (positions, targets, params) {
    var patches = [];
    targets.forEach(function (run) {
      var ids = run.map(function (t) { return t.pos.id; });
      var firstPos = run[0].pos;
      var groupHeight = Math.max.apply(null, run.map(function (t) { return t.pos.height; }));
      var wrapPad = params.wrapPadding || { top: 4, right: 8, bottom: 4, left: 8 };
      var gap = params.gap || 8;

      // Reposition items horizontally inside the group
      var x = firstPos.left + wrapPad.left;
      run.forEach(function (t, i) {
        t.pos.top = firstPos.top + wrapPad.top;
        t.pos.left = x;
        x += t.pos.width + gap;
        // Mark overflow items
        if (params.maxVisible && i >= params.maxVisible) {
          t.pos._overflow = true;
        }
      });

      patches.push({
        type: 'group-wrap',
        container: params.container || 'horizontal-scroll',
        groupIds: ids,
        groupRect: {
          top: firstPos.top,
          left: firstPos.left,
          width: x - firstPos.left - gap + wrapPad.right,
          height: groupHeight + wrapPad.top + wrapPad.bottom
        },
        radius: params.wrapRadius || 16,
        maxVisible: params.maxVisible || null,
        overflowIndicator: params.overflowIndicator || false
      });
    });
    return { applied: patches.length > 0, patches: patches };
  },

  // Increase gap between consecutive items
  'increase-gap': function (positions, targets, params) {
    var patches = [];
    var addGap = params.addGap || 8;
    var maxGap = params.maxGap || 24;
    targets.forEach(function (run) {
      for (var i = 1; i < run.length; i++) {
        var prev = run[i - 1].pos, curr = run[i].pos;
        var currentGap = curr.top - (prev.top + prev.height);
        var newGap = Math.min(currentGap + addGap, maxGap);
        var shift = newGap - currentGap;
        if (shift > 0) {
          // Shift this and all subsequent items down
          for (var j = run[i].index; j < positions.length; j++) {
            positions[j].top += shift;
          }
          patches.push({ type: 'increase-gap', from: prev.id, to: curr.id, oldGap: currentGap, newGap: newGap });
        }
      }
    });
    return { applied: patches.length > 0, patches: patches };
  },

  // Insert a component at a specific position
  'insert-component': function (positions, targets, params, mem) {
    var patches = [];
    var size = resolveComponentSize(params.componentId, mem);
    if (!size) return { applied: false, patches: [] };
    var insertIdx = positions.length; // default: end
    if (params.position === 'before-nav') {
      for (var i = positions.length - 1; i >= 0; i--) {
        if (positions[i].role === 'nav-bar-gestures' || positions[i].role === 'nav-bar-buttons' ||
            positions[i].role === 'home-gesture-bar') {
          insertIdx = i;
          break;
        }
      }
    }
    var prevPos = insertIdx > 0 ? positions[insertIdx - 1] : null;
    var top = prevPos ? (prevPos.top + prevPos.height + 12) : 10;
    var left = prevPos ? prevPos.left : 10;
    var newPos = {
      id: params.componentId,
      role: (targets[0] && targets[0].missingRole) || params.componentId,
      top: top,
      left: left,
      width: size.minWidth,
      height: size.minHeight,
      margin: { top: 12, right: 0, bottom: 0, left: 0 },
      _inserted: true,
      _slots: params.slots || {}
    };
    positions.splice(insertIdx, 0, newPos);

    // Shift subsequent items down
    var shift = size.minHeight + 12;
    for (var j = insertIdx + 1; j < positions.length; j++) {
      positions[j].top += shift;
    }
    patches.push({ type: 'insert-component', componentId: params.componentId, at: insertIdx, slots: params.slots });
    return { applied: true, patches: patches };
  },

  // Collapse lowest-priority components to meet target count
  'collapse-lowest': function (positions, targets, params, mem) {
    var patches = [];
    var targetCount = params.targetCount || 4;
    var reg = mem ? (mem.componentRegistry || []) : [];
    if (positions.length <= targetCount) return { applied: false, patches: [] };

    // Sort by collapsePriority desc — highest priority number = drop first
    var indexed = positions.map(function (p, i) {
      var entry = reg.find(function (c) { return c.id === p.id; });
      return { index: i, priority: (entry && entry.behavior && entry.behavior.collapsePriority) || 0 };
    });
    indexed.sort(function (a, b) { return b.priority - a.priority; });

    var toRemove = positions.length - targetCount;
    var removeIdxs = indexed.slice(0, toRemove).map(function (x) { return x.index; });
    removeIdxs.sort(function (a, b) { return b - a; }); // reverse to splice safely

    removeIdxs.forEach(function (idx) {
      patches.push({ type: 'collapse', removedId: positions[idx].id, priority: indexed.find(function (x) { return x.index === idx; }).priority });
      positions.splice(idx, 1);
    });
    return { applied: patches.length > 0, patches: patches };
  },

  // Expand undersized interactive elements to min touch target
  'expand-to-min': function (positions, targets, params) {
    var patches = [];
    var minW = params.minWidth || 48, minH = params.minHeight || 48;
    targets.forEach(function (pos) {
      var changed = false;
      if (pos.width < minW) { pos.width = minW; changed = true; }
      if (pos.height < minH) { pos.height = minH; changed = true; }
      if (changed) patches.push({ type: 'expand', id: pos.id, newSize: pos.width + 'x' + pos.height });
    });
    return { applied: patches.length > 0, patches: patches };
  },

  // Adjust gaps to match orchestration_rules
  'adjust-gap-to-rule': function (positions, targets) {
    var patches = [];
    targets.forEach(function (v) {
      // Find the 'to' component and shift it
      var toIdx = positions.findIndex(function (p) { return p.id === v.to; });
      if (toIdx < 0) return;
      var fromIdx = positions.findIndex(function (p) { return p.id === v.from; });
      if (fromIdx < 0) return;
      var fromBottom = positions[fromIdx].top + positions[fromIdx].height;
      var shift = v.expected - v.actual;
      for (var j = toIdx; j < positions.length; j++) {
        positions[j].top += shift;
      }
      patches.push({ type: 'adjust-gap', from: v.from, to: v.to, oldGap: v.actual, newGap: v.expected });
    });
    return { applied: patches.length > 0, patches: patches };
  }
};

// ---------------------------------------------------------------------------
//  autoRefine(positions, uiState, memory)
//  Runs all enabled refinement rules: analyze → patch → report.
//  Returns { positions, appliedPatches[], skipped[] }
// ---------------------------------------------------------------------------

function autoRefine(positions, uiState, memory) {
  var mem = _getMemory(memory);
  var rules = _getRefinementRules();
  var applied = [];
  var skipped = [];

  // Sort by priority (lower = more important = run first)
  rules.sort(function (a, b) { return (a.priority || 99) - (b.priority || 99); });

  rules.forEach(function (rule) {
    var analyzerFn = _analyzers[rule.analyzer.type];
    if (!analyzerFn) { skipped.push({ ruleId: rule.id, reason: 'unknown analyzer: ' + rule.analyzer.type }); return; }

    var result = analyzerFn(positions, rule.analyzer.params, uiState, mem);
    if (!result.matched) return;

    var patcherFn = _patchers[rule.patcher.type];
    if (!patcherFn) { skipped.push({ ruleId: rule.id, reason: 'unknown patcher: ' + rule.patcher.type }); return; }

    var patchResult = patcherFn(positions, result.targets, rule.patcher.params, mem);
    if (patchResult.applied) {
      applied.push({
        ruleId: rule.id,
        description: rule.description,
        patches: patchResult.patches
      });
    }
  });

  return { positions: positions, appliedPatches: applied, skipped: skipped };
}


// ===========================================================================
//  SPATIAL GRAMMAR — top-depth layout primitives
//  ---------------------------------------------------------------------------
//  Philosophy (per user spec):
//    - Never hard-code absolute pixel positions. Every placement is derived
//      from screen ratios, spacing scale, and inter-cluster rhythm.
//    - 3 vertical zones: topSystem / contentFocus / bottomAction.
//    - Elements are composed into CLUSTERS (temporal, bottom-action, status)
//      so information hierarchy survives when items shuffle.
//    - Rhythm is preserved across viewports. Test at 360×800, 451×978,
//      540×1200 — all must read the same.
// ===========================================================================

function _clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Top edge → status layer safe distance. OS chrome (notch / island / cutout)
// forces this to a clamped band regardless of device height.
function getTopInset(height) { return Math.round(_clamp(height * 0.04, 24, 48)); }

/**
 * The only foundation function. Everything else composes on top of this.
 * Returns: { unit, safe, zones, spacing, typeScale }.
 *
 * - unit: 1% of min(width,height). Basis for the spacing scale.
 * - safe: inset region where content must not escape.
 * - zones: 3 vertical bands (topSystem / contentFocus / bottomAction).
 * - spacing: a rhythm ladder (xs → xxl). Use named values, never raw px.
 * - typeScale: 5 size steps keyed by information hierarchy, not by "big/small".
 */
function createTopDepthLayout(screen) {
  var width = screen.width, height = screen.height;
  var unit = Math.round(Math.min(width, height) * 0.01);
  var topInset = getTopInset(height);

  var safe = {
    top:    Math.max(Math.round(height * 0.045), topInset),
    right:  Math.round(width * 0.05),
    bottom: Math.round(height * 0.04),
    left:   Math.round(width * 0.05)
  };

  // Zones are anchored to height ratios. Overlap-free, no pixel magic.
  var zones = {
    topSystem:    { y: safe.top,                      h: Math.round(height * 0.28) },
    contentFocus: { y: Math.round(height * 0.34),     h: Math.round(height * 0.36) },
    bottomAction: { y: Math.round(height * 0.82),     h: Math.round(height * 0.12) }
  };

  var spacing = {
    xs:  Math.round(unit * 0.75),
    sm:  Math.round(unit * 1.5),
    md:  Math.round(unit * 2.5),
    lg:  Math.round(unit * 4),
    xl:  Math.round(unit * 6),
    xxl: Math.round(unit * 8)
  };

  // Type scale — five hierarchy tiers. Sized by width so landscape preserves ratio.
  var typeScale = {
    meta:  Math.round(width * 0.032),   // watch %, battery ring, secondary sensor readouts
    small: Math.round(width * 0.040),   // captions, URL, utility labels
    body:  Math.round(width * 0.048),   // affordance text (Swipe to unlock, alert body)
    title: Math.round(width * 0.080),   // date row, card headline
    hero:  Math.round(width * 0.140)    // clock / temperature / primary reading
  };

  return { unit: unit, safe: safe, zones: zones, spacing: spacing, typeScale: typeScale };
}

/**
 * Place a block between two other elements at `ratio` of the gap between them.
 * Keeps the middle element responsive to changes in what's above or below.
 */
function placeBetween(topBottomY, bottomTopY, ratio, size) {
  ratio = (ratio == null) ? 0.42 : ratio;
  size = size || 0;
  var gap = bottomTopY - topBottomY;
  return Math.round(topBottomY + gap * ratio - size / 2);
}

// ---------------------------------------------------------------------------
//  CLUSTER COMPOSERS
//  ---------------------------------------------------------------------------
//  Each cluster returns {baseline, bottom, members[]} where:
//    - baseline: the y of the cluster's first visible line
//    - bottom:   the y just below the cluster (for downstream placement)
//    - members:  per-role {x, y, w, h, fontSize, role} entries
//  Cluster callers care only about baseline/bottom — members are an impl detail.
// ---------------------------------------------------------------------------

/**
 * Status-layer cluster: OS chrome at the top of the screen.
 * Members vary (operator name, account chips, Wi-Fi/cell/battery, live activity)
 * but the cluster is always anchored to `safe.top` and has a fixed VERTICAL
 * budget. The horizontal distribution is left for the renderer.
 */
function getStatusCluster(layout, opts) {
  var o = opts || {};
  var statusH = Math.max(Math.round(layout.unit * 3), layout.spacing.lg); // ~12px baseline
  var y = layout.safe.top;
  return {
    baseline: y,
    bottom: y + statusH,
    zone: 'topSystem',
    fontSize: layout.typeScale.small,
    // Visual weight budget — renderer uses this to decide how many status items fit.
    slots: {
      leftTextSlot:   { x: layout.safe.left,  y: y, fontSize: layout.typeScale.small },
      rightIconSlot:  { x: null /* flex end */, y: y, iconSize: Math.round(layout.unit * 2.4) },
      liveActivityPill: o.liveActivity ? {
        type: o.liveActivity.type,
        color: o.liveActivity.color,
        y: y, fontSize: layout.typeScale.meta
      } : null
    },
    height: statusH
  };
}

/**
 * Temporal cluster: date + time + optional secondary info (weather, moon phase).
 * Treated as ONE block — the shuffle of weather/date/temp must preserve hierarchy:
 *   date (title) > time (hero) > secondary (small)
 * Internal spacing uses the scale (sm between same-level, lg between tiers).
 */
function getTemporalCluster(layout, opts) {
  var o = opts || {};
  var zone = layout.zones.topSystem;
  var startY = zone.y + layout.spacing.xl;

  // Line 1: date row (title tier)
  var dateY = startY;

  // Line 2: time (hero tier). Gap between date and time is `lg` (different tier).
  var timeY = dateY + layout.typeScale.title + layout.spacing.lg;

  // Time is stacked as two hero lines in One UI Nr (09 / 41).
  // The clock "height" we reserve equals hero * 2 * leading-ratio (~0.73).
  var timeHeroHeight = Math.round(layout.typeScale.hero * 2 * 0.73 + layout.spacing.sm);

  // Optional secondary line below the clock (health/weather/alarm metadata).
  var secondaryY = o.hasSecondary
    ? timeY + timeHeroHeight + layout.spacing.lg
    : null;

  return {
    zone: 'topSystem',
    baseline: dateY,
    bottom: (secondaryY != null)
      ? secondaryY + layout.typeScale.small
      : timeY + timeHeroHeight,
    cx: Math.round((o.viewportWidth || 451) / 2),
    members: {
      date: {
        role: 'date-row',
        fontSize: layout.typeScale.title,
        x: layout.safe.left,  // left-aligned edge (baseline); renderer can center inline
        y: dateY,
        w: (o.viewportWidth || 451) - layout.safe.left - layout.safe.right,
        h: layout.typeScale.title
      },
      time: {
        role: 'time-clock',
        fontSize: layout.typeScale.hero,
        x: layout.safe.left,
        y: timeY,
        w: (o.viewportWidth || 451) - layout.safe.left - layout.safe.right,
        h: timeHeroHeight,
        lines: 2,
        lineGap: layout.spacing.sm
      },
      secondary: secondaryY != null ? {
        role: 'secondary-info',
        fontSize: layout.typeScale.small,
        x: layout.safe.left,
        y: secondaryY,
        w: (o.viewportWidth || 451) - layout.safe.left - layout.safe.right,
        h: layout.typeScale.small
      } : null
    }
  };
}

/**
 * Bottom action cluster: [left-affordance] [center-now-bar | unlock-hint] [right-affordance].
 * All three share a single vertical axis anchored to screen bottom minus
 * `safe.bottom`. Widths are ratio-based so icons stay at the same relative
 * position on wider screens.
 */
function getBottomActionCluster(layout, screen, opts) {
  var o = opts || {};
  var zone = layout.zones.bottomAction;

  // Baseline of the action row — keep icons off the very bottom edge.
  var iconSize = Math.round(screen.width * 0.104);     // ≈ 47px on 451 (Figma match)
  var iconY = screen.height - layout.safe.bottom - iconSize - layout.spacing.md;
  var rowCx = Math.round(screen.width / 2);

  // Hint text sits just ABOVE the icon row (not below — users look up when scanning).
  var hintY = iconY - layout.spacing.xl;

  // Center slot (now-bar) — flex between the two side icons.
  var sideSafeX = layout.safe.left + iconSize + layout.spacing.md;
  var centerW = screen.width - 2 * sideSafeX;

  return {
    zone: 'bottomAction',
    baseline: hintY,
    bottom: iconY + iconSize,
    members: {
      leftAffordance: {
        role: 'shortcut-left',
        x: layout.safe.left, y: iconY, w: iconSize, h: iconSize
      },
      rightAffordance: {
        role: 'shortcut-right',
        x: screen.width - layout.safe.right - iconSize, y: iconY, w: iconSize, h: iconSize
      },
      centerSlot: o.hasNowBar ? {
        role: 'now-bar',
        x: sideSafeX, y: iconY - Math.round((Math.round(screen.width * 0.142) - iconSize) / 2),
        w: centerW, h: Math.round(screen.width * 0.142)  // ≈ 64px at 451
      } : null,
      unlockHint: o.hasUnlockHint ? {
        role: 'unlock-hint',
        x: rowCx, y: hintY,
        fontSize: layout.typeScale.body
      } : null
    }
  };
}

/**
 * Middle live-card (e.g. Uber Eats pill on lock) — placed by INTERPOLATION
 * between the temporal cluster's bottom and the bottom cluster's top.
 * Not relative to screen center.
 */
function placeLiveCardBetween(temporalBottomY, bottomClusterTopY, cardW, cardH, ratio) {
  ratio = (ratio == null) ? 0.42 : ratio;
  return {
    x: null /* renderer: (screen.width - cardW) / 2 */,
    y: placeBetween(temporalBottomY, bottomClusterTopY, ratio, cardH),
    w: cardW, h: cardH
  };
}

// ===========================================================================
//  LOCK SCREEN RULES — rebuilt on spatial grammar
//  ---------------------------------------------------------------------------
//  What changed vs the previous version (extracted from Figma absolute coords):
//    - NO hardcoded pixel values. Every position flows from the grammar.
//    - Elements are grouped into CLUSTERS (status / temporal / middle / bottom).
//    - Middle live-card uses placeBetween instead of a fixed y.
//    - Zones, spacing scale, type scale, safe inset are all computed from
//      the viewport dimensions — so 360×800, 451×978, 540×1200 all share rhythm.
// ---------------------------------------------------------------------------

var LOCK_SCREEN_SOURCE = {
  figmaFileKey: 'kxDvBUif6pV502Si4RPidK',
  figmaNodeId: '3010:2143',
  reference: { width: 451, height: 978, radius: 40 },
  _note: 'Figma node used as hierarchy reference, NOT as pixel source. Actual ' +
         'positions are ratio-derived via createTopDepthLayout + clusters.'
};

function _lockScreenContext(uiState) {
  var tags = Array.isArray(uiState && uiState.contextTags) ? uiState.contextTags : [];
  var tagSet = new Set(tags);
  var attn = (uiState && uiState.attentionMode) || 'focused';
  var density = (uiState && uiState.densityMode) || 'normal';
  var interaction = (uiState && uiState.interactionMode) || 'touch';
  var overlay = (uiState && uiState.overlayType) || 'none';
  var theme = (uiState && uiState.theme) || 'dark';

  var nowBarType = null;
  // Honor direct uiState.nowBarType (agent path passes this when the AI
  // explicitly chose a now-bar variant — deterministic, no random).
  if (uiState && uiState.nowBarType) {
    nowBarType = uiState.nowBarType;
  }
  else if (tagSet.has('now-bar:media') || tagSet.has('media-playing')) nowBarType = 'media';
  else if (tagSet.has('now-bar:charging') || tagSet.has('charging')) nowBarType = 'charging';
  else if (tagSet.has('now-bar:timer')) nowBarType = 'timer';
  else if (tagSet.has('now-bar:voice') || interaction === 'driving') nowBarType = 'single-line';
  else if (tagSet.has('now-bar:delivery') || tagSet.has('now-bar:eta') ||
           tagSet.has('now-bar')) nowBarType = 'dual-line';
  else if (tagSet.has('no-now-bar') || tagSet.has('bare-lock')) {
    // EXPLICIT SUPPRESSION: scenario asked for a clean / bare lock screen
    // with no ambient activity widget. Honors the user intent over the
    // demo-variety default below.
    nowBarType = null;
  }
  else {
    // DEFAULT for Lock screen: Now Bar is a One UI staple element of the
    // lower cluster, so when the scenario doesn't specify a variant we
    // pick one at random for visual variety. To suppress it explicitly,
    // emit contextTag "no-now-bar" or "bare-lock" from the interpreter.
    var RANDOM_POOL = ['media', 'timer', 'charging'];
    nowBarType = RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)];
  }

  return {
    attn: attn, density: density, interaction: interaction,
    overlay: overlay, theme: theme, tags: tagSet,
    hasNowBar: nowBarType !== null,
    nowBarType: nowBarType,
    // Pass AI-authored now-bar content through so _lockScreenVariant can
    // substitute it for the randomized SONGS preset. All optional — when
    // absent, classic demo behavior (random song) kicks in.
    nowBarTitle:   (uiState && uiState.nowBarTitle)   || null,
    nowBarArtist:  (uiState && uiState.nowBarArtist)  || null,
    nowBarMarquee: (uiState && uiState.nowBarMarquee) || null,
    nowBarPercent: (uiState && uiState.nowBarPercent != null) ? uiState.nowBarPercent : null,
    nowBarLabel:   (uiState && uiState.nowBarLabel)   || null,
    canShowWidgets: attn !== 'glanceable' && density !== 'compressed' && interaction !== 'driving',
    canShowShortcuts: overlay === 'none' && attn !== 'deep-focus',
    canShowDateRow: attn !== 'glanceable',
    canShowSwipeHint: interaction !== 'driving',
    hasSecondaryInfo: tagSet.has('temporal:secondary') || tagSet.has('weather')
  };
}

// Role declarations — a role references a zone + cluster slot, never raw px.
var LOCK_SCREEN_ROLES = {
  statusBar:        { zone: 'topSystem',    cluster: 'status',   anchor: 'cluster.top' },
  lockIndicator:    { zone: 'topSystem',    cluster: 'status',   anchor: 'cluster.bottom+sm' },
  weatherDate:      { zone: 'topSystem',    cluster: 'temporal', slot: 'date' },
  clock:            { zone: 'topSystem',    cluster: 'temporal', slot: 'time' },
  widgetsRow:       { zone: 'topSystem',    cluster: 'temporal', anchor: 'cluster.bottom+lg' },
  liveCard:         { zone: 'contentFocus', cluster: 'middle',   anchor: 'placeBetween:0.42' },
  unlockHint:       { zone: 'bottomAction', cluster: 'bottom',   slot: 'unlockHint' },
  shortcutLeft:     { zone: 'bottomAction', cluster: 'bottom',   slot: 'leftAffordance' },
  nowBar:           { zone: 'bottomAction', cluster: 'bottom',   slot: 'centerSlot' },
  shortcutRight:    { zone: 'bottomAction', cluster: 'bottom',   slot: 'rightAffordance' },
  gestureBar:       { zone: 'bottomAction', cluster: 'gesture',  anchor: 'screen.bottom' }
};

// Map generator_memory component ids → rules-renderer role keys.
function _lockIdToRole(id) {
  // Route Lock's status-bar through the OneUI 8.5 dash-case atomic so it
  // uses the same renderer path as Home / List / Detail — guarantees
  // identical carrier label, icons, padding, and color treatment.
  if (id === 'status-bar.default')                return 'status-bar';
  if (id === 'lock-screen.lock-icon')             return 'lockIndicator';
  if (id === 'lock-screen.clock')                 return 'clock';
  if (id === 'lock-screen.weather-date')          return 'weatherDate';
  if (id === 'lock-screen.widgets-row' ||
      id === 'lock-screen.widget-battery' ||
      id === 'lock-screen.widget-activity')       return 'widgetsRow';
  if (id === 'lock-screen.swipe-hint')            return 'unlockHint';
  if (id.indexOf('lock-screen.shortcut-circle') === 0) {
    return id.indexOf('camera') >= 0 ? 'shortcutRight' : 'shortcutLeft';
  }
  // Route lock-screen now-bar through the OneUI 8.5 atomic (`now-bar`
  // dash-case in app/surface-layout.js) which supports media/timer/
  // charging variants per Figma. Rules-renderer's atomic bridge picks it
  // up automatically.
  if (id.indexOf('now-bar.') === 0)               return 'now-bar';
  if (id === 'dialog.nav-gesture-bar')            return 'gestureBar';
  return null;
}

// Pull Lock-screen memory from generator_memory.json (loaded via DesignMemory).
// Falls back to a hardcoded baseline if the JSON isn't loaded yet.
function _getLockScreenMemory() {
  var mem = _getMemory();
  var lock = mem && mem.generatorMemory && mem.generatorMemory.screens && mem.generatorMemory.screens.lock;
  return lock || {
    mandatoryComponents: ['status-bar.default', 'lock-screen.clock'],
    optionalComponents: [
      'lock-screen.weather-date', 'lock-screen.widgets-row',
      'lock-screen.shortcut-circle', 'now-bar.dual-line',
      'now-bar.media-player', 'now-bar.charging', 'now-bar.single-line',
      'lock-screen.swipe-hint'
    ],
    anchorAreas: {
      topStatus: { top: 0, height: 51 },
      lockIcon: { top: 51 },
      clockBlock: { top: 133, width: 412 },
      shortcutRow: { top: 880, left: 31, width: 389 }
    }
  };
}

// Memory-driven component picker. Reads mandatoryComponents + optionalComponents
// from generator_memory.screens.lock and layers on context flags (ctx.canShow*,
// ctx.hasNowBar) to decide final inclusion.
function _lockScreenPickComponents(ctx) {
  var mem = _getLockScreenMemory();
  var mandatory = (mem.mandatoryComponents || []).slice();
  var optional  = new Set(mem.optionalComponents || []);
  var out = [];

  function pushId(id) {
    var role = _lockIdToRole(id);
    if (!role) return;
    // de-dup
    if (out.some(function (o) { return o.id === id; })) return;
    out.push({ id: id, role: role });
  }

  // 1) Always include mandatory
  mandatory.forEach(pushId);

  // Lock icon is visually always present on One UI lock but isn't in the
  // memory's mandatory list (it's structural chrome). Add it unconditionally.
  pushId('lock-screen.lock-icon');

  // 2) Context-driven optional inclusions (only if memory permits)
  if (ctx.canShowDateRow && optional.has('lock-screen.weather-date')) {
    pushId('lock-screen.weather-date');
  }

  // Widgets-row (battery arc + activity pills) intentionally NOT included
  // on the default Samsung-style lock screen. The clean "clock + wallpaper"
  // composition reads better without mid-screen pills. Re-enable by setting
  // `ctx.forceWidgetsRow = true` upstream if a specific scenario needs it.
  if (ctx.forceWidgetsRow && ctx.canShowWidgets && optional.has('lock-screen.widgets-row')) {
    pushId('lock-screen.widgets-row');
  }

  if (ctx.canShowSwipeHint && optional.has('lock-screen.swipe-hint')) {
    pushId('lock-screen.swipe-hint');
  }

  if (ctx.canShowShortcuts && optional.has('lock-screen.shortcut-circle')) {
    pushId('lock-screen.shortcut-circle:phone');
    if (ctx.hasNowBar) {
      var nbId = 'now-bar.' + ctx.nowBarType;
      // Fall back to dual-line if the requested variant isn't in memory
      if (!optional.has(nbId)) nbId = 'now-bar.dual-line';
      if (optional.has(nbId)) pushId(nbId);
    }
    pushId('lock-screen.shortcut-circle:camera');
  }

  // Gesture bar — always included (chrome)
  pushId('dialog.nav-gesture-bar');

  return out;
}

function _lockScreenVariant(componentId, ctx, layout) {
  if (componentId === 'status-bar.default')
    return { theme: ctx.theme, fontSize: layout.typeScale.small };
  if (componentId.indexOf('now-bar.') === 0) {
    // Map ctx.nowBarType → Figma atomic variant payload. When the agent
    // path has supplied AI-authored content (ctx.nowBarTitle / Artist /
    // Marquee / Percent / Label), use it directly instead of picking
    // from the random SONGS list — that way the canonical now-bar on
    // the Lock scene shows "Midnight City · M83" (AI's song) instead
    // of a randomized "Bad Guy · Billie Eilish".
    var t = ctx.nowBarType || 'timer';
    if (t === 'dual-line' || t === 'single-line') t = 'timer';

    function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    if (t === 'media') {
      // If the agent supplied song data, honor it verbatim.
      if (ctx.nowBarTitle || ctx.nowBarMarquee) {
        var mTitle   = ctx.nowBarTitle || 'Now playing';
        var mArtist  = ctx.nowBarArtist || null;
        var mMarquee = ctx.nowBarMarquee
          || [mTitle, mArtist].filter(Boolean).join(' \u00B7 ')
          || mTitle;
        return { type: 'media', title: mTitle, artist: mArtist, marquee: mMarquee };
      }
      // Otherwise random preset (classic Scene/Lock demo behavior).
      var SONGS = [
        { title: 'Never Gonna Give You Up', marquee: 'Never Gonna Give You Up \u00B7 Rick Astley (1987)' },
        { title: 'Bohemian Rhapsody',       marquee: 'Bohemian Rhapsody \u00B7 Queen (1975)' },
        { title: 'Smells Like Teen Spirit', marquee: 'Smells Like Teen Spirit \u00B7 Nirvana (1991)' },
        { title: 'Dynamite',                marquee: 'Dynamite \u00B7 BTS (2020)' },
        { title: 'Blinding Lights',         marquee: 'Blinding Lights \u00B7 The Weeknd (2019)' },
        { title: 'Bad Guy',                 marquee: 'Bad Guy \u00B7 Billie Eilish (2019)' },
        { title: 'Shape of You',            marquee: 'Shape of You \u00B7 Ed Sheeran (2017)' },
        { title: 'Espresso',                marquee: 'Espresso \u00B7 Sabrina Carpenter (2024)' }
      ];
      var song = _pick(SONGS);
      return { type: 'media', title: song.title, marquee: song.marquee };
    }
    if (t === 'charging') {
      // Honor AI-supplied percent, else Figma-spec 69%.
      var pct = ctx.nowBarPercent != null ? ctx.nowBarPercent : 69;
      return { type: 'charging', percent: pct };
    }
    // timer (default) — AI's label wins, else live counter from 00:00:00
    if (ctx.nowBarLabel) {
      return { type: 'timer', label: ctx.nowBarLabel, icon: 'stopwatch', live: false };
    }
    return { type: 'timer', label: '00:00:00', icon: 'stopwatch', live: true };
  }
  if (componentId === 'lock-screen.shortcut-circle:phone')
    return { icon: ctx.interaction === 'driving' ? 'voice' : 'phone' };
  if (componentId === 'lock-screen.shortcut-circle:camera')
    return { icon: 'camera' };
  if (componentId === 'lock-screen.clock') {
    // Google "Space Grotesk" — display-geometric sans with bold digit
    // shapes. Paired with Inter for rest of the UI. Loaded via <link>
    // in genui.html. Inter is the structural fallback while the web
    // font loads (keeps the clock readable on first paint without a
    // FOUT jump). Earlier revisions used Space Mono; switched to
    // Space Grotesk to match the requested Inter + Space Grotesk pair.
    return {
      fontSize: ctx.attn === 'glanceable'
        ? Math.round(layout.typeScale.hero * 1.15)
        : layout.typeScale.hero,
      stack: true,
      fontFamily: "'Space Grotesk', Inter, system-ui, sans-serif"
    };
  }
  if (componentId === 'lock-screen.weather-date')
    return { fontSize: layout.typeScale.title };
  if (componentId === 'lock-screen.swipe-hint')
    return { fontSize: layout.typeScale.body };
  if (componentId === 'lock-screen.widgets-row')
    return { slots: ['battery-arc-pair', 'daily-activity'] };
  return {};
}

function _lockScreenTokens(ctx, layout) {
  return {
    wallpaper: { layer: 'wallpaper', policy: ctx.overlay === 'none' ? 'wallpaper' : 'scrim-over-wallpaper' },
    text: {
      primary:   '#FFFFFF',
      statusBar: 'rgba(255,255,255,0.80)',
      widget:    'rgba(255,255,255,0.86)',
      hint:      '#FFFFFF'
    },
    glass: {
      shortcutCircle: { bg: 'rgba(55,55,55,0.3)', blur: 6,  border: '0.25px solid rgba(55,55,55,0.3)' },
      widgetPill:     { bg: 'rgba(23,23,26,0.3)', blur: 6,  border: '0.25px solid rgba(55,55,55,0.3)' },
      nowBar:         { bg: 'rgba(23,23,26,0.3)', blur: 12, border: '0.25px solid rgba(55,55,55,0.3)' }
    },
    // Typography — EVERY size comes from the type scale, not from Figma constants.
    typography: {
      clock:     { family: "'Space Grotesk', Inter",         size: layout.typeScale.hero },
      date:      { family: 'One UI Sans APP VF, Inter',      size: layout.typeScale.title },
      statusBar: { family: 'One UI Sans APP VF, Inter',      size: layout.typeScale.small, weight: 700 },
      hint:      { family: 'One UI Sans APP VF, Inter',      size: layout.typeScale.body },
      widgetLabel: { family: 'One UI Sans APP VF, Inter',    size: layout.typeScale.meta,  weight: 600 }
    }
  };
}

/**
 * Orchestrator: composes clusters, resolves each component's role, returns
 * a position derived from spatial grammar — not from Figma values.
 */
function lockScreenRules(uiState, opts) {
  var o = opts || {};
  var viewport = o.viewport || { width: 451, height: 978 };
  var ctx = _lockScreenContext(uiState || {});
  var layout = createTopDepthLayout(viewport);
  var tokens = _lockScreenTokens(ctx, layout);

  // ---- Compose clusters --------------------------------------------------
  var statusCluster = getStatusCluster(layout, {
    liveActivity: ctx.tags.has('live-activity:call')
      ? { type: 'call', color: '#0FCF6E' }
      : null
  });

  var temporalCluster = getTemporalCluster(layout, {
    viewportWidth: viewport.width,
    hasSecondary: ctx.hasSecondaryInfo
  });

  var bottomCluster = getBottomActionCluster(layout, viewport, {
    hasNowBar: ctx.hasNowBar && ctx.canShowShortcuts,
    hasUnlockHint: ctx.canShowSwipeHint
  });

  // Middle zone: anchor the live card by interpolation between clusters.
  var widgetsTop = temporalCluster.bottom + layout.spacing.lg;
  var middleCardW = Math.round(viewport.width * 0.64);   // 64% width, ~uber-eats size
  var middleCardH = Math.round(layout.unit * 6.4);       // ~44px at unit=7
  var middleAnchor = bottomCluster.baseline - layout.spacing.xl;
  var middleCard = placeLiveCardBetween(widgetsTop, middleAnchor, middleCardW, middleCardH, 0.42);

  // ---- Role → position resolver ------------------------------------------
  //   FIGMA GROUND TRUTH positions from node 3010:2143 (451×978).
  //   Each coordinate here is copied verbatim from the Figma manifest.
  //   When the viewport differs, positions scale linearly — but the ratio
  //   between elements is preserved.
  var FIGMA_W = 451, FIGMA_H = 978;
  var sx = viewport.width  / FIGMA_W;   // scale x
  var sy = viewport.height / FIGMA_H;   // scale y
  function S(x, y, w, h) {
    return {
      x: Math.round(x * sx),
      y: Math.round(y * sy),
      w: Math.round(w * sx),
      h: Math.round(h * sy)
    };
  }

  // Shortcut row inner layout (at y=880, left=31, w=389, gap=14):
  //   [47] [gap 14] [flex-nowbar] [gap 14] [47]
  //   shortcutLeft  x=31            → 47
  //   nowBar        x=31+47+14=92   → w = 389 - 47 - 14 - 14 - 47 = 267
  //   shortcutRight x=92+267+14=373 → 47
  // Memory-driven anchor regions (generator_memory.screens.lock.anchorAreas).
  // These provide the Y-axis rhythm; precise per-component sizes stay in code
  // because memory only stores region bounds.
  var _anchors = _getLockScreenMemory().anchorAreas || {};
  var _lockIconY    = (_anchors.lockIcon && _anchors.lockIcon.top)    != null ? _anchors.lockIcon.top    : 48;
  var _clockBlockY  = (_anchors.clockBlock && _anchors.clockBlock.top) != null ? _anchors.clockBlock.top : 133;
  var _shortcutRowY = (_anchors.shortcutRow && _anchors.shortcutRow.top) != null ? _anchors.shortcutRow.top : 880;
  var _shortcutRowL = (_anchors.shortcutRow && _anchors.shortcutRow.left) != null ? _anchors.shortcutRow.left : 31;
  var _shortcutRowW = (_anchors.shortcutRow && _anchors.shortcutRow.width) != null ? _anchors.shortcutRow.width : 389;
  // Right-side shortcut x = rowLeft + rowW - circleW (47)
  var _shortcutRightX = _shortcutRowL + _shortcutRowW - 47;

  // Bottom shortcut row: inner h=47 (shortcut) or 64 (nowbar)
  // Shortcut 47×47, centered vertically within 64h row → y-offset = (64-47)/2 = 8.5
  function resolveRole(comp) {
    var role = comp.role;
    var pos;
    if (role === 'background')         pos = S(0,    0,    451, 978);   // full-bleed wallpaper
    // Status bar — aligned with Home / List / Detail / QS topSystem zone:
    // x=24, y=16, w=403, h=28. Accept both camelCase (legacy) and dash-case
    // (new OneUI 8.5 atomic role name).
    else if (role === 'statusBar' || role === 'status-bar')
                                       pos = S(24,  16,    403, 28);
    else if (role === 'lockIndicator') pos = S(213.5, _lockIconY,   24,  24);    // memory.anchorAreas.lockIcon.top
    else if (role === 'weatherDate')   pos = S(129.5, _clockBlockY, 192, 20);    // memory.anchorAreas.clockBlock.top
    else if (role === 'clock')         pos = S(129.5, _clockBlockY + 46, 192, 176); // date(20) + gap(26) below
    else if (role === 'widgetsRow')    pos = S(107.5, 385,  292, 62);    // w=138+16+138=292, cx of 451 = 225.5 → x=79.5
    else if (role === 'liveCard')      pos = { x: 0, y: 0, w: 0, h: 0 }; // not used in Figma default (part of shortcut row now-bar)
    else if (role === 'unlockHint')    pos = S(0,    833,  451, 20);     // text centered at cy=843.5
    else if (role === 'shortcutLeft')  pos = S(_shortcutRowL, _shortcutRowY + 8, 47, 47);
    // Now-bar — Figma 752:7988 is exactly 248 wide. We center it in the
    // gap between phone (right edge at _shortcutRowL + 47 = 78) and camera
    // (left edge at _shortcutRightX = 373). Center of gap = (78 + 373)/2
    // = 225.5 → now-bar x = 225.5 - 124 = 101.5 → 102. Symmetric 23.5px
    // gap on each side between chip and now-bar.
    else if (role === 'nowBar' || role === 'now-bar') {
      // Center horizontally between the two 47-wide chips. Gap between
      // chips is 295px; dividing (295 - 247) / 2 = 24 gives pixel-perfect
      // symmetric 24px left + 24px right spacing. Width 247 is ~1px
      // slimmer than the Figma 248 — invisible, but lets the math land
      // on clean integers so no 1px asymmetry from rounding.
      var _nbW = 247;
      var _nbX = _shortcutRowL + 47 + 24;  // phone right + 24 gap
      pos = S(_nbX, _shortcutRowY, _nbW, 64);
    }
    else if (role === 'shortcutRight') pos = S(_shortcutRightX,  _shortcutRowY + 8, 47, 47);
    else if (role === 'gestureBar')    pos = S(0,    948,  451, 24);     // below shortcut row
    else pos = { x: 0, y: 0, w: 0, h: 0 };
    // Recenter widgetsRow precisely (292 wide, centered → x = (451-292)/2 = 79.5)
    if (role === 'widgetsRow') pos = S(79.5, 385, 292, 62);
    // Recenter weatherDate (192 wide, centered → x = (451-192)/2 = 129.5)
    if (role === 'weatherDate') pos = S(129.5, 133, 192, 20);
    // Clock has same x/w as date (part of the 192-wide clock column)
    if (role === 'clock') pos = S(129.5, 179, 192, 176);
    return Object.assign(pos, {
      _cluster: _lockSemanticCluster(role),
      _zone: _lockSemanticZone(role),
      _source: 'figma-3010:2143'
    });
  }
  function _lockSemanticZone(role) {
    if (role === 'background') return 'base';
    if (role === 'statusBar' || role === 'lockIndicator' || role === 'weatherDate' || role === 'clock' || role === 'widgetsRow') return 'topSystem';
    if (role === 'liveCard') return 'contentFocus';
    return 'bottomAction';
  }
  function _lockSemanticCluster(role) {
    if (role === 'background') return 'base';
    if (role === 'statusBar' || role === 'lockIndicator') return 'status';
    if (role === 'weatherDate' || role === 'clock' || role === 'widgetsRow') return 'temporal';
    if (role === 'liveCard') return 'middle';
    if (role === 'gestureBar') return 'gesture';
    return 'bottom';
  }

  var picked = _lockScreenPickComponents(ctx);
  var resolved = picked.map(function (comp, i) {
    return {
      order: i,
      id: comp.id,
      role: comp.role,
      roleRule: LOCK_SCREEN_ROLES[comp.role] || null,
      position: resolveRole(comp),
      variant: _lockScreenVariant(comp.id, ctx, layout)
    };
  });

  // NOTE: an earlier revision translated these legacy camelCase roles into
  // dash-case OneUI 8.5 atomics (status-bar, lock-clock, weather-date,
  // lock-indicator, unlock-hint, toggle-chip). The atomics render fine in
  // isolation but are deliberately simpler than the `GalaxyAtomics`
  // library in app/atomics.js — which already owns a polished Samsung
  // Clock (stacked HH/MM, Samsung font), StatusBar, WeatherDate, LockIcon,
  // Shortcut, UnlockHint, NowBar, GestureBar, WidgetRow.
  //
  // Since `GalaxyAtomics` IS part of our component library (just the
  // surface-grammar tier that feeds lock/home/app shells), we keep the
  // original camelCase roles here so Lock Screen routes through them via
  // rules-renderer's ROLE_RENDERERS map and gets the full Samsung polish.
  //
  // The dash-case atomics (lock-clock / weather-date / lock-indicator /
  // unlock-hint) are still registered in ONEUI_ROLES — available in the
  // Design-tab palette and for future composition.

  return {
    ctx: 'lock',
    source: LOCK_SCREEN_SOURCE,
    viewport: viewport,
    uiState: uiState || null,
    resolvedContext: ctx,

    // Spatial grammar foundations (exposed for debugging / renderer)
    grammar: {
      unit: layout.unit,
      safe: layout.safe,
      zones: layout.zones,
      spacing: layout.spacing,
      typeScale: layout.typeScale
    },
    clusters: {
      status:   statusCluster,
      temporal: temporalCluster,
      bottom:   bottomCluster,
      middle:   { card: middleCard, ratio: 0.42 }
    },
    roles: LOCK_SCREEN_ROLES,
    tokens: tokens,
    components: resolved,

    explain: {
      philosophy: '3 zones × spacing scale × type scale. No absolute px. Rhythm preserved across viewports.',
      rhythmAnchors: {
        topInset: layout.safe.top,
        statusBottom: statusCluster.bottom,
        temporalBaseline: temporalCluster.baseline,
        temporalBottom: temporalCluster.bottom,
        middleCardY: middleCard.y,
        bottomBaseline: bottomCluster.baseline,
        screenBottomInset: layout.safe.bottom
      },
      selection: {
        included: picked.map(function (p) { return p.id; }),
        excluded: [
          !ctx.canShowDateRow    && 'weather-date (glanceable)',
          !ctx.canShowWidgets    && 'widgets-row (glanceable/compressed/driving)',
          !ctx.canShowSwipeHint  && 'swipe-hint (driving)',
          !ctx.canShowShortcuts  && 'shortcut-row (shade/deep-focus)',
          !ctx.hasNowBar         && 'now-bar (no context trigger)'
        ].filter(Boolean)
      }
    }
  };
}

// ---- A/B comparator ---------------------------------------------------------
function compareLockScreenOutputs(uiState, opts) {
  var out = { uiState: uiState, diffs: {} };
  try {
    out.legacy = resolveScreenPlan(Object.assign({}, uiState, { baseSurface: 'lock' }), null, opts);
  } catch (e) { out.legacy = { error: e.message }; }
  try {
    out.rules = lockScreenRules(Object.assign({}, uiState, { baseSurface: 'lock' }), opts);
  } catch (e) { out.rules = { error: e.message }; }

  if (out.legacy && out.rules && out.legacy.components && out.rules.components) {
    var legacyIds = out.legacy.components.map(function (c) { return c.id; });
    var ruleIds   = out.rules.components.map(function (c) { return c.id; });
    out.diffs.onlyInLegacy = legacyIds.filter(function (id) { return ruleIds.indexOf(id) === -1; });
    out.diffs.onlyInRules  = ruleIds.filter(function (id) { return legacyIds.indexOf(id) === -1; });
    out.diffs.sharedCount  = legacyIds.filter(function (id) { return ruleIds.indexOf(id) !== -1; }).length;
  }
  return out;
}

// ---- Rhythm test helper — run across 3 viewports and return rhythm metrics
function testLockScreenRhythm(uiState) {
  var viewports = [
    { width: 360, height: 800,  label: 'Compact (S24)' },
    { width: 451, height: 978,  label: 'Figma reference (S26)' },
    { width: 540, height: 1200, label: 'Large (foldable outer)' }
  ];
  return viewports.map(function (v) {
    var res = lockScreenRules(uiState, { viewport: v });
    // Normalized rhythm — express anchors as % of height to compare
    var h = v.height;
    return {
      viewport: v.label + ' ' + v.width + '×' + v.height,
      unit: res.grammar.unit,
      safe: res.grammar.safe,
      rhythm: {
        topInset_pct:            +(res.explain.rhythmAnchors.topInset / h * 100).toFixed(2),
        statusBottom_pct:        +(res.explain.rhythmAnchors.statusBottom / h * 100).toFixed(2),
        temporalBaseline_pct:    +(res.explain.rhythmAnchors.temporalBaseline / h * 100).toFixed(2),
        temporalBottom_pct:      +(res.explain.rhythmAnchors.temporalBottom / h * 100).toFixed(2),
        middleCard_pct:          +(res.explain.rhythmAnchors.middleCardY / h * 100).toFixed(2),
        bottomBaseline_pct:      +(res.explain.rhythmAnchors.bottomBaseline / h * 100).toFixed(2)
      }
    };
  });
}

// ===========================================================================
//  CLUSTER COMPOSERS — shade / control-surface variants
//  ---------------------------------------------------------------------------
//  Lock screen used: status + temporal (stacked hero) + bottom-action + middle.
//  Shade / quick-settings screens have a different rhythm — no hero clock and
//  no bottom cluster. The content zone is a VERTICAL LIST of sub-rhythms.
//  These composers extend the grammar to cover that pattern.
// ===========================================================================

/**
 * Compact temporal cluster: time + date INLINE on one row.
 * Used at the top of notification shade / quick-settings where there is no
 * room for a stacked hero clock.
 */
function getCompactTemporalCluster(layout, opts) {
  var o = opts || {};
  var zone = layout.zones.topSystem;
  // Sits immediately below the status row.
  var y = zone.y + layout.spacing.xl;
  return {
    zone: 'topSystem',
    baseline: y,
    bottom: y + layout.typeScale.title,
    members: {
      time: {
        role: 'time-inline', fontSize: layout.typeScale.title, weight: 700,
        x: layout.safe.left, y: y, h: layout.typeScale.title
      },
      date: {
        role: 'date-inline', fontSize: layout.typeScale.small, weight: 500,
        x: layout.safe.left + Math.round((o.timeWidth || layout.typeScale.title * 2.2)) + layout.spacing.md,
        y: y + Math.round((layout.typeScale.title - layout.typeScale.small) / 2),
        h: layout.typeScale.small
      }
    }
  };
}

/**
 * Right-aligned header action icons (pencil / power / settings on QS).
 * Anchored to the top-right of the status cluster's bottom.
 */
function getHeaderActionsCluster(layout, screen, opts) {
  var o = opts || {};
  var count = o.count || 3;
  var iconSize = Math.round(layout.unit * 3.6);  // ~18px at unit=5
  var gap = layout.spacing.md;
  var totalW = count * iconSize + (count - 1) * gap;
  var y = (o.anchorY != null) ? o.anchorY : (layout.zones.topSystem.y + layout.spacing.xl);
  return {
    zone: 'topSystem',
    baseline: y,
    bottom: y + iconSize,
    members: Array.from({ length: count }).map(function (_, i) {
      return {
        role: 'header-action-' + i, iconSize: iconSize,
        x: screen.width - layout.safe.right - totalW + i * (iconSize + gap),
        y: y, w: iconSize, h: iconSize
      };
    })
  };
}

/**
 * A horizontal row of N pill-shaped toggles, distributed edge-to-edge within
 * `containerW`. Used for both the primary QS top row (3 pills) and the
 * secondary grid (4+ pills).
 */
function getTogglePillRow(layout, opts) {
  var o = opts || {};
  var count = o.count || 4;
  var containerW = o.containerW || 0;
  var height = o.height || Math.round(layout.unit * 10);
  var gap = o.gap != null ? o.gap : layout.spacing.md;
  var pillW = Math.floor((containerW - gap * (count - 1)) / count);
  return {
    zone: o.zone || 'contentFocus',
    baseline: o.y || 0,
    bottom: (o.y || 0) + height,
    members: Array.from({ length: count }).map(function (_, i) {
      return {
        role: 'toggle-pill-' + i,
        x: (o.originX || 0) + i * (pillW + gap),
        y: o.y || 0, w: pillW, h: height
      };
    })
  };
}

/**
 * Drag-handle indicator (small horizontal bar, dead-center).
 */
function getDragHandle(layout, screen, opts) {
  var o = opts || {};
  var w = o.w || Math.round(screen.width * 0.10);
  var h = Math.round(layout.unit * 0.7);
  var y = (o.anchorY != null) ? o.anchorY : Math.round(screen.height * 0.36);
  return {
    zone: 'contentFocus',
    baseline: y,
    bottom: y + h,
    member: {
      role: 'drag-handle',
      x: Math.round(screen.width / 2 - w / 2),
      y: y, w: w, h: h,
      radius: h / 2
    }
  };
}

/**
 * A stacked cards region — used by notification shade. Each card has the
 * same width (inset-aware) but the caller provides the individual heights.
 * Returns { totalHeight, cards:[{ x, y, w, h }] } so the caller can reason
 * about what fits in the content zone.
 */
function getStackedCardsRegion(layout, screen, opts) {
  var o = opts || {};
  var cardHeights = o.cardHeights || [];
  var gap = o.gap != null ? o.gap : layout.spacing.md;
  var startY = o.y || (layout.zones.contentFocus.y);
  var w = screen.width - layout.safe.left - layout.safe.right;
  var y = startY;
  var cards = cardHeights.map(function (h, i) {
    var out = { role: o.role || 'card-' + i, x: layout.safe.left, y: y, w: w, h: h };
    y += h + gap;
    return out;
  });
  return {
    zone: 'contentFocus',
    baseline: startY,
    bottom: y - gap,
    totalHeight: y - startY - gap,
    members: cards
  };
}

// ===========================================================================
//  NOTIFICATION SHADE RULES — Figma node 989:22754
//  ---------------------------------------------------------------------------
//  Shape of the shade:
//    [status]
//    [compact-temporal: time HH:MM + date inline]
//    [section-label: "Live notifications"]
//    [media-card (priority, tall)]
//    [compact-notification-card]
//    [section-label: "Other notifications"]
//    [regular notification cards ×N]
//    [gesture]
//  No bottom affordance cluster; content scrolls.
// ---------------------------------------------------------------------------

var NOTIFICATION_SHADE_SOURCE = {
  figmaFileKey: 'kxDvBUif6pV502Si4RPidK',
  figmaNodeId: '989:22754',
  reference: { width: 451, height: 978, radius: 40 },
  _note: 'Grammar-based, not pixel-copy.'
};

function _shadeContext(uiState) {
  var tags = Array.isArray(uiState && uiState.contextTags) ? uiState.contextTags : [];
  var tagSet = new Set(tags);
  return {
    theme: (uiState && uiState.theme) || 'dark',
    overlay: 'shade',
    hasMediaPriority: tagSet.has('media-playing') || tagSet.has('media'),
    hasLiveSection: true,
    otherCount: parseInt((uiState && uiState.otherNotificationCount) || 2, 10),
    tags: tagSet
  };
}

// Figma-ground-truth rules — emit a single full-screen atomic (GalaxyNotifScreen).
// QS / Notifications have intricate flex-wrap / flex-column internal layouts;
// recomposing them as per-element absolute positions doubles the work without
// visual benefit. The atomic owns its internal structure so fidelity stays 99%+.
// Notification preset pool — realistic sample content for random generation.
// Fields: { app, icon(PNG in app-icons/ or null), glyph (fallback), accent,
//          title, body, time }.
var NOTIF_PRESETS = [
  { app: 'Messages',  icon: 'Messages.png', glyph: '\u2709', accent: '#3E91FF',
    title: 'Jimin', body: 'See you at the BBQ place tonight!', time: '2m' },
  { app: 'KakaoTalk', icon: null, glyph: 'K', accent: '#FEE500',
    title: 'Design Team', body: 'Minji shared a file: wireframes_v2.pdf', time: '5m' },
  { app: 'Gmail',     icon: null, glyph: 'M', accent: '#EA4335',
    title: 'Sarah Chen', body: 'Re: Q2 planning — let\u2019s review tomorrow', time: '12m' },
  { app: 'Slack',     icon: null, glyph: '#', accent: '#611F69',
    title: '#product-launch', body: 'Alex: PR is ready for review', time: '18m' },
  { app: 'Calendar',  icon: 'Clock.png', glyph: '\u25EF', accent: '#4285F4',
    title: 'Stand-up in 10 min', body: 'Daily engineering sync \u00B7 Zoom', time: 'now' },
  { app: 'Uber Eats', icon: null, glyph: '\uD83C\uDF54', accent: '#06C167',
    title: 'Order on the way', body: 'Maria is 8 min away with your order', time: '8m' },
  { app: 'Spotify',   icon: null, glyph: '\u266B', accent: '#1DB954',
    title: 'Made for You', body: 'Your Daily Mix 1 is ready', time: '1h' },
  { app: 'Weather',   icon: 'Weather.png', glyph: '\u26C5', accent: '#5AC8FA',
    title: 'Rain expected', body: 'Light rain starting around 5\u202FPM today', time: '30m' },
  { app: 'X',         icon: null, glyph: '\uD835\uDD4F', accent: '#0B0B0B',
    title: '@samsungmobile', body: 'Introducing the new Galaxy S26 Ultra.', time: '1h' },
  { app: 'Instagram', icon: null, glyph: '\u25A3', accent: '#E1306C',
    title: 'maya_k liked your post', body: '"Friday coffee run"', time: '45m' },
  { app: 'System',    icon: null, glyph: '\u2699', accent: '#34C759',
    title: 'Software update ready', body: 'One UI 8.5.2 ready to install', time: '2h' },
  { app: 'Bank',      icon: null, glyph: '$', accent: '#00A86B',
    title: 'Card payment', body: '\u2212$24.80 at Blue Bottle Coffee', time: '15m' },
  { app: 'Gallery',   icon: 'Gallery.png', glyph: '\u25A3', accent: '#FF6B6B',
    title: 'Memories', body: '3 years ago today in Tokyo', time: '6h' },
  { app: 'YouTube',   icon: null, glyph: '\u25B6', accent: '#FF0000',
    title: 'New from MKBHD', body: '"The Galaxy Ring — one year later"', time: '3h' },
  { app: 'LinkedIn',  icon: null, glyph: 'in', accent: '#0A66C2',
    title: '5 new connections', body: 'Tom Harris and 4 others want to connect', time: '1h' },
  { app: 'Discord',   icon: null, glyph: '\u25C9', accent: '#5865F2',
    title: '@everyone in #announcements', body: 'Game night starting in 30 min', time: '15m' },
  { app: 'Reminder',  icon: 'Reminder.png', glyph: '\u25CF', accent: '#FF9500',
    title: 'Call mom', body: 'Due today at 7:00\u202FPM', time: '5m' },
  { app: 'WhatsApp',  icon: null, glyph: '\u2709', accent: '#25D366',
    title: 'Family Group', body: 'Dad: Don\u2019t forget the airport pickup tomorrow', time: '20m' },
  { app: 'Notes',     icon: 'Notes.png', glyph: '\u270E', accent: '#FFD60A',
    title: 'Q2 Strategy shared', body: 'Sarah edited the document', time: '1h' },
  { app: 'Contacts',  icon: 'Contacts.png', glyph: '\u2611', accent: '#9B6BE6',
    title: 'Missed call', body: 'Hannah \u00B7 mobile \u00B7 7 min ago', time: '7m' },
  // --- AI-generated notifications (render with `notif-card-ai` gradient) ---
  { app: 'Galaxy AI', icon: null, glyph: '\u2726', accent: '#6C5CE7',
    title: 'Morning briefing', body: '3 meetings today \u00B7 Rain starting 5 PM', time: '20m',
    ai: true },
  { app: 'Galaxy AI', icon: null, glyph: '\u2726', accent: '#22C9A6',
    title: 'Summary ready', body: 'Sarah\'s design review notes condensed to 4 points', time: '35m',
    ai: true },
  { app: 'Bixby',     icon: null, glyph: '\u25C6', accent: '#1564FF',
    title: 'Quick reply drafted', body: '"Got it \u2014 see you at 6" ready to send', time: '12m',
    ai: true }
];

// Realistic timestamp for a notification: clock time in "H:MM AM/PM" format,
// randomly picked between 10 and 60 minutes before NOW. Matches the Samsung
// notification-shade convention (e.g. "8:21 AM") rather than "12m" relative.
function _realisticNotifTime() {
  var now = new Date();
  var minAgo = 10 + Math.floor(Math.random() * 51); // 10..60
  var then = new Date(now.getTime() - minAgo * 60000);
  var h = then.getHours();
  var m = then.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  var mm = m < 10 ? '0' + m : String(m);
  return h + ':' + mm + ' ' + ampm;
}

function _randomizeNotifPresets(count) {
  // Fisher-Yates shuffle on a copy, take first `count`.
  var pool = NOTIF_PRESETS.slice();
  for (var s = pool.length - 1; s > 0; s--) {
    var j = Math.floor(Math.random() * (s + 1));
    var tmp = pool[s]; pool[s] = pool[j]; pool[j] = tmp;
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// Notif shade = ONE component type: notifCard, repeated N times with
// randomly-picked realistic content. Not a screen — a layer on top.
function notificationShadeRules(uiState, opts) {
  var o = opts || {};
  var viewport = o.viewport || { width: 451, height: 978 };
  var ctx = _shadeContext(uiState || {});

  var components = [];
  var order = 0;
  function push(id, role, pos, variant) {
    components.push({
      order: order++,
      id: id,
      role: role,
      position: Object.assign({ _source: 'figma-989:22754' }, pos),
      variant: variant || {}
    });
  }

  // Card count — randomized 1..3 per shade open so every notif shade feels
  // fresh and not always the same "5 cards" stack. uiState can still
  // override via `uiState.otherNotificationCount` for deterministic tests.
  var cardCount;
  if (uiState && typeof uiState.otherNotificationCount === 'number' && uiState.otherNotificationCount > 0) {
    cardCount = uiState.otherNotificationCount + (ctx.hasMediaPriority ? 1 : 0);
  } else {
    cardCount = 1 + Math.floor(Math.random() * 3); // 1, 2, or 3
  }

  // Shuffle preset pool and take the top cardCount entries so every render
  // produces a fresh, realistic set with no duplicates.
  var picked = _randomizeNotifPresets(cardCount);

  // Stack cards vertically. Start below the underlying screen's status-bar.
  // h=108 — enough vertical room for the Figma Regular notification
  // (actual content is 86 tall, extra 22 reserved for stagger shadow).
  //
  // Dispatch rule — pure 25% chance regardless of preset's ai flag so the
  // overall ratio stays at exactly "every 4th" (requested). The preset's
  // AI branding (Galaxy AI / Bixby) still shows correct content; only the
  // visual treatment (gradient pill vs glass pill) is randomized.
  //   25% → `notif-card-ai`  (Galaxy AI gradient pill)
  //   75% → `notif-card`     (Figma 544:1088 regular pill)
  //
  // Time: override preset.time with a realistic "H:MM AM/PM" stamp picked
  // 10–60 min before the current moment (Figma convention, e.g. "8:21 AM").
  var x = 18, w = 415, h = 108, gap = 8, y = 60;
  for (var i = 0; i < cardCount; i++) {
    var p = picked[i] || { app: 'App', title: 'Notification', body: '', time: '' };
    var role = Math.random() < 0.25 ? 'notif-card-ai' : 'notif-card';
    var realTime = _realisticNotifTime();
    push('notif.card:' + i, role,
      { x: x, y: y, w: w, h: h,
        _cluster: 'cards', _zone: 'interaction' },
      {
        index:    i,
        app:      p.app,
        icon:     p.icon,
        glyph:    p.glyph,
        accent:   p.accent,
        title:    p.title,
        subtitle: p.body,   // notif-card-ai reads `subtitle`
        body:     p.body,   // notif-card reads `body`
        time:     realTime,
        ai:       role === 'notif-card-ai'
      });
    y += h + gap;
  }

  return {
    ctx: 'notification-shade',
    source: NOTIFICATION_SHADE_SOURCE,
    viewport: viewport,
    uiState: uiState || null,
    resolvedContext: ctx,
    components: components
  };
}

// ===========================================================================
//  QUICK SETTINGS RULES — Figma node 3010:2142
//  ---------------------------------------------------------------------------
//  Shape:
//    [status]
//    [header-actions: pencil, power, settings]
//    [primary-toggle row ×3]
//    [secondary-toggle row ×4 small]
//    [drag-handle]
//    [controls-grid: left 2 vertical sliders | right 2×2 pills + tall pills]
//    [media-cast card]
//    [more toggles (overflow, scrollable)]
//    [gesture]
//  Dense, utility-first. No hero; content is a lot of ROWS.
// ---------------------------------------------------------------------------

var QUICK_SETTINGS_SOURCE = {
  figmaFileKey: 'kxDvBUif6pV502Si4RPidK',
  figmaNodeId: '3010:2142',
  reference: { width: 451, height: 978, radius: 40 },
  _note: 'Grammar-based. Rhythm = rowGap consistent across all toggle rows.'
};

function _qsContext(uiState) {
  var tags = Array.isArray(uiState && uiState.contextTags) ? uiState.contextTags : [];
  var tagSet = new Set(tags);
  // Density modes from the three reference screenshots:
  //   'full'    → top 4 big toggles + 4×4 labeled toggle grid + sliders + cards
  //   'compact' → 2×4 labeled toggle grid + sliders + action tiles
  //   'minimal' → top 4 big toggles + sliders + action tiles (no middle grid)
  var density = 'full';
  if (tagSet.has('qs:compact') || tagSet.has('qs:medium')) density = 'compact';
  else if (tagSet.has('qs:minimal') || tagSet.has('qs:small'))  density = 'minimal';
  return {
    theme: (uiState && uiState.theme) || 'dark',
    density: density,
    hasMedia: !tagSet.has('no-media'),
    tags: tagSet
  };
}

// ============================================================================
//  Quick Settings — composed from One UI 8.5 atomics
//  ---------------------------------------------------------------------------
//  Layouts match the three reference screenshots (full / compact / minimal).
//  Every component is an OneUI 8.5 atomic role so the Design tab can edit
//  each node via the shared renderAtomicForRole switch in surface-layout.js.
//
//  Top chrome (header row, big toggles) is shared. The middle band swaps
//  by density. Bottom (sliders + SmartThings + media output row + action
//  tiles) is shared.
// ============================================================================
function quickSettingsRules(uiState, opts) {
  var o = opts || {};
  var viewport = o.viewport || { width: 451, height: 978 };
  var ctx = _qsContext(uiState || {});

  var components = [];
  var order = 0;
  function push(id, role, pos, variant) {
    components.push({
      order: order++,
      id: id,
      role: role,
      position: Object.assign({ _source: 'figma-3010:2142' }, pos),
      variant: variant || {}
    });
  }

  // Status bar intentionally omitted — QS is an OVERLAY; the base screen
  // still owns the status bar cluster underneath the blur.

  // ── Header action row (edit / power / settings) ────────────────────────
  // Kept as headerAction role (small inline SVG chrome, already rendered
  // by rules-renderer). Not an atomic we need to replace.
  var headerY = 60;
  push('qs.header-action:edit',     'headerAction',
    { x: 327, y: headerY, w: 32, h: 32, _cluster: 'chrome', _zone: 'topSystem' },
    { icon: 'edit' });
  push('qs.header-action:power',    'headerAction',
    { x: 367, y: headerY, w: 32, h: 32, _cluster: 'chrome', _zone: 'topSystem' },
    { icon: 'power' });
  push('qs.header-action:settings', 'headerAction',
    { x: 407, y: headerY, w: 32, h: 32, _cluster: 'chrome', _zone: 'topSystem' },
    { icon: 'settings' });

  // ── Top connectivity row (present in Full + Minimal) ──────────────────
  // Figma QS 3010:2142 shows the top row as 3 connectivity toggles:
  //   Wi-Fi (Single/Toggle 88×88)   — Figma 989:22476
  //   Mobile Data (Single/Toggle 88×88) — Figma 989:22477
  //   Bluetooth (Half/Toggle 199×88 with paired-device subtitle) — Figma 989:22478
  // Layout: 18 margin + 88 + 18 gap + 88 + 18 gap + 199 + 22 margin = 451.
  // All 3 are toggleable via data-toggle-chip inside the single-toggle atomic.
  //
  // Vertical cadence: every inter-row gap in QS is kept at a single
  // 12px beat (4dp×3). Header ends at y=92 (headerY 60 + h 32), so
  // first row starts at 104 → gap of 12. Every subsequent cursor
  // advance also uses +12 so the shade reads with an even rhythm.
  var ROW_GAP = 12;
  var cursorY = 92 + ROW_GAP;          // 104
  if (ctx.density !== 'compact') {
    // Wi-Fi
    push('qs.top:wifi', 'single-toggle',
      { x: 18, y: cursorY, w: 88, h: 88, _cluster: 'primary', _zone: 'viewing' },
      { width: 'single', kind: 'toggle', icon: 'wifi', on: true });
    // Mobile Data
    push('qs.top:mobile-data', 'single-toggle',
      { x: 124, y: cursorY, w: 88, h: 88, _cluster: 'primary', _zone: 'viewing' },
      { width: 'single', kind: 'toggle', icon: 'mobile-data', on: false });
    // Bluetooth half-pill with active device name
    push('qs.top:bluetooth', 'single-toggle',
      { x: 230, y: cursorY, w: 199, h: 88, _cluster: 'primary', _zone: 'viewing' },
      { width: 'half', kind: 'toggle', icon: 'bluetooth', on: true,
        title: 'Bluetooth', sub: "Josh's Watch7", showSubtitle: true });
    cursorY += 88 + ROW_GAP;           // +100
  }

  // ── Middle band — varies by density ────────────────────────────────────
  // FULL: rows 2-5 = 4×4 labeled toggles (auto-rotate / airplane / …)
  // COMPACT: a single 2×4 labeled grid (8 items) slightly denser
  // MINIMAL: skipped entirely (top toggles + sliders already enough)
  if (ctx.density === 'full') {
    // Full QS: 4 essential toggles inside a single glass shell (toggle-grid
    // atomic 1×4). Keeps the shade focused — the most-used toggles only,
    // visually grouped the same way Compact groups its 8 toggles. Uses the
    // toggle-grid shell so Full and Compact share the same container
    // aesthetic; only the cell count differs.
    var FULL_CELLS = [
      { icon: 'auto-rotate' },
      { icon: 'airplane'    },
      { icon: 'flashlight'  },
      { icon: 'hotspot'     }
    ];
    push('qs.essentials', 'toggle-grid',
      { x: 18, y: cursorY, w: 415, h: 104,
        _cluster: 'essentials', _zone: 'viewing' },
      { cells: FULL_CELLS, cols: 4, rows: 1 });
    cursorY += 104 + ROW_GAP;          // +116 — keeps 12px beat
  } else if (ctx.density === 'compact') {
    // Compact QS: single glass panel enclosing 2×4 icon-only toggles.
    // toggle-grid atomic auto-renders blank-circle cells when variant.cells
    // contain only { icon } with no label.
    var COMPACT_CELLS = [
      { icon: 'dex'         }, { icon: 'eye-comfort' },
      { icon: 'dnd'         }, { icon: 'qr'          },
      { icon: 'interpreter' }, { icon: 'multi'       },
      { icon: 'secure'      }, { icon: 'broadcast'   }
    ];
    push('qs.grouped-toggles', 'toggle-grid',
      { x: 18, y: cursorY, w: 415, h: 180,
        _cluster: 'labeled', _zone: 'viewing' },
      { cells: COMPACT_CELLS, cols: 4, rows: 2 });
    cursorY += 180 + ROW_GAP;          // +192 — keeps 12px beat
  }
  // (minimal: nothing between top toggles and sliders — keeps the shade
  // visually light and lets sliders / smart-things / now-bar breathe)

  // Drag-handle is intentionally NOT added as a separate component here —
  // the `toggle-grid` shell (Full + Compact densities) already renders its
  // own bottom drag indicator matching Figma 987:16943 + 544:2861. Adding
  // a second standalone one stacked duplicate bars right below the grid.
  // Minimal density has no grid and therefore no drag handle; the shade's
  // shortcut rows at the bottom already read as interactive.

  // ── Controls block: 2 vertical slider-panels side-by-side ──────────────
  // Matches Figma QS 3010:2142 where brightness + volume appear as two
  // self-contained slider-panel pills. Each uses the new `slider-panel`
  // atomic (Figma 1109:10261 / 10246) which bundles:
  //   glass container (88 wide × 240 tall, padding 18)
  //   vertical track (fills available height)
  //   mode-cap toggle at bottom (brightness → moon, volume → mute)
  //
  // The old separate night-cap + horizontal-volume + modes/wifi right
  // column is replaced by this cleaner 2-column layout. The two caps
  // (moon = dark mode, mute = sound off) absorb what the external Modes
  // and WiFi affordances were doing.
  var panelH = 240;
  var leftBlockBottom = cursorY + panelH;

  push('qs.brightness', 'slider-panel',
    { x: 18, y: cursorY, w: 88, h: panelH, _cluster: 'controls', _zone: 'interaction' },
    { icon: 'brightness', capIcon: 'moon', capOn: true, percent: 62 });
  push('qs.volume', 'slider-panel',
    { x: 124, y: cursorY, w: 88, h: panelH, _cluster: 'controls', _zone: 'interaction' },
    { icon: 'music', capIcon: 'mute', capOn: true, percent: 70 });

  // Sound-mode shortcut pill (Figma 989:22486 SingleToggle Half/Shortcut)
  // sits next to the Volume slider-panel. Opens sound-mode settings when
  // tapped — mirrors Samsung QS where a secondary sound affordance lives
  // to the right of the main volume column.
  push('qs.sound-mode', 'single-toggle',
    { x: 230, y: cursorY, w: 199, h: 88, _cluster: 'controls', _zone: 'interaction' },
    { width: 'half', kind: 'shortcut', icon: 'open',
      title: 'Sound mode', sub: 'Ring', showSubtitle: true });

  // Media Half/Off card (Figma 544:967) directly below Sound mode —
  // collapsed glass player with Output chip + "No Media Playing" + 3 controls.
  var mediaY = cursorY + 88 + 8;   // 8px gap below sound-mode pill
  var mediaH = 144;                // slightly compressed from Figma 163 to fit
  push('qs.media-half', 'media-half',
    { x: 230, y: mediaY, w: 199, h: mediaH, _cluster: 'controls', _zone: 'interaction' },
    {});
  var rightColBottom = mediaY + mediaH;

  // Advance rowY past BOTH left (sliders) and right (shortcut + media)
  // columns so the full-width SmartThings row doesn't collide.
  var rowY = Math.max(leftBlockBottom, rightColBottom) + ROW_GAP;

  // SmartThings — full-width 415×88 glass pill, now safely below brightness.
  //   Full: 3 right action toggles (Figma default)
  //   Compact / Minimal: 1 output circle
  push('qs.smartthings', 'smart-things',
    { x: 18, y: rowY, w: 415, h: 88, _cluster: 'controls', _zone: 'interaction' },
    ctx.density === 'full'
      ? { title: '55" Neo QLED', sub: 'Living Room',
          actionCount: 3, actions: ['smart-view', 'remote', 'power'], activeIndex: 2 }
      : { title: 'SmartThings', sub: 'Device control',
          actionCount: 1, activeIndex: -1 });
  rowY += 88 + ROW_GAP;                // +100 — keeps 12px beat

  // Now Bar — Figma 3-type atomic for visual diversity. Only shown in the
  // Minimal density (where the vertical real-estate allows a "what's
  // happening now" signal). Rotates among media / timer / charging based
  // on context tags; defaults to timer.
  if (ctx.density === 'minimal' && ctx.hasMedia) {
    var tagSet = ctx.tags || new Set();
    var nbType = tagSet.has('now-bar:media') ? 'media'
               : tagSet.has('now-bar:charging') ? 'charging'
               : 'timer';
    push('qs.now-bar', 'now-bar',
      { x: 102, y: rowY, w: 248, h: 64, _cluster: 'media', _zone: 'interaction' },
      nbType === 'media'    ? { type: 'media', title: 'Dynamite' }
      : nbType === 'charging' ? { type: 'charging', percent: 69 }
      : { type: 'timer', label: '00:05:39', icon: 'stopwatch' });
    rowY += 64 + ROW_GAP;              // +76 — keeps 12px beat
  }

  // Smart View / Song Search — Figma-exact `single-toggle` Half/Shortcut
  // atomics (199×88). Smart View uses the Figma `smart-view` TV+play glyph;
  // Song Search uses the Figma media_volume speaker+waves glyph (340:8807).
  // Both flash on Cmd-click via data-shortcut handler.
  //
  // (The "Play music / Media output" label row was removed — the info it
  // carried is already implicit in Smart View + Song Search + SmartThings,
  // and its long thin shape broke the card rhythm below the shade.)
  if (ctx.hasMedia) {
    push('qs.smart-view', 'single-toggle',
      { x: 18, y: rowY, w: 199, h: 88, _cluster: 'media', _zone: 'interaction' },
      { width: 'half', kind: 'shortcut', icon: 'smart-view',
        title: 'Smart View', sub: 'Mirror screen', showSubtitle: true });
    push('qs.song-search', 'single-toggle',
      { x: 234, y: rowY, w: 199, h: 88, _cluster: 'media', _zone: 'interaction' },
      { width: 'half', kind: 'shortcut', icon: 'song-search',
        title: 'Song Search', sub: 'Find songs', showSubtitle: true });
  }

  // Gesture bar at very bottom
  push('qs.nav-gesture-bar', 'gestureBar',
    { x: 153, y: 944, w: 144, h: 4, _cluster: 'chrome', _zone: 'bottomNav' });

  return {
    ctx: 'quick-settings',
    source: QUICK_SETTINGS_SOURCE,
    viewport: viewport,
    uiState: uiState || null,
    resolvedContext: ctx,
    components: components
  };
}

// ---------------------------------------------------------------------------
//  DIALOG WIDGET RULES — code-driven, extracted from Figma node 3010:2144
//  ---------------------------------------------------------------------------
//  "Add a Dialog" surface = bottom-sheet style pop-out that overlays ANY base
//  surface (lock / home / app). The wallpaper below remains visible through
//  a dim scrim, and a heavy-glass dialog sits at the bottom containing:
//    [optional] website share header  (source attribution)
//    browser top bar                 (5 primary actions, pill-shaped icons)
//    browser icon box                (grid of target destinations, paginated)
//
//  Scope (same 4 pillars as lockScreenRules):
//    1. Component selection & ordering   → _dialogWidgetPickComponents(ctx)
//    2. Position / anchor calculation    → _dialogWidgetAnchors(viewport, ctx)
//    3. State variants                   → _dialogWidgetVariant(id, ctx)
//    4. Tokens / style                   → _dialogWidgetTokens(ctx)
// ---------------------------------------------------------------------------

var DIALOG_WIDGET_SOURCE = {
  figmaFileKey: 'kxDvBUif6pV502Si4RPidK',
  figmaNodeId: '3010:2144',
  frameName: 'Add a Dialog',
  reference: { width: 451, height: 978, radius: 40 }
};

// Normalise ctxTags + uiState into a capability set used throughout.
function _dialogWidgetContext(uiState) {
  var tags = Array.isArray(uiState && uiState.contextTags) ? uiState.contextTags : [];
  var tagSet = new Set(tags);
  var theme = (uiState && uiState.theme) || 'dark';
  var baseSurface = (uiState && uiState.baseSurface) || 'app';
  var attn = (uiState && uiState.attentionMode) || 'focused';
  var interaction = (uiState && uiState.interactionMode) || 'touch';

  // Dialog flavor. Tags win; default is 'share'.
  //   share:   source attribution + browser actions + target grid
  //   picker:  no source attribution; just a grid of targets
  //   cta:     minimal dialog with just actions (no grid)
  var dialogType = 'share';
  if (tagSet.has('dialog:picker')) dialogType = 'picker';
  else if (tagSet.has('dialog:cta')) dialogType = 'cta';

  // Live Activity pill in the status bar — optional and typed.
  //   null | 'call' | 'timer' | 'recording' | 'navigation' | 'media'
  var liveActivityType = null;
  if (tagSet.has('live-activity:call'))       liveActivityType = 'call';
  else if (tagSet.has('live-activity:timer'))      liveActivityType = 'timer';
  else if (tagSet.has('live-activity:recording'))  liveActivityType = 'recording';
  else if (tagSet.has('live-activity:navigation')) liveActivityType = 'navigation';
  else if (tagSet.has('live-activity:media'))      liveActivityType = 'media';

  // Counts (defaults match Figma reference)
  var actionCount    = dialogType === 'cta'    ? 3 : 5;   // top icon row
  var targetGridRows = dialogType === 'picker' ? 3 : dialogType === 'cta' ? 0 : 2;
  var targetGridCols = 4;

  return {
    theme: theme, baseSurface: baseSurface,
    attn: attn, interaction: interaction, tags: tagSet,
    dialogType: dialogType,
    hasSiteHeader: dialogType === 'share' && !tagSet.has('no-source-header'),
    hasBrowserTopBar: true,
    hasTargetGrid: targetGridRows > 0,
    hasPageIndicator: targetGridRows > 0 && !tagSet.has('no-pagination'),
    liveActivityType: liveActivityType,
    actionCount: actionCount,
    targetGridRows: targetGridRows,
    targetGridCols: targetGridCols,
    // Scrim intensity — darker when attention=glanceable (popup feels focal)
    scrimAlpha: attn === 'glanceable' ? 0.45 : 0.2
  };
}

// ----- Rule 1: component selection & order (top → bottom) ------------------
function _dialogWidgetPickComponents(ctx) {
  var out = [];
  // Wallpaper layer removed — canvas-frame CSS owns the base
  out.push('system.dim-overlay');         // the rgba(0,0,0,scrimAlpha) scrim
  // Status bar intentionally omitted — Dialog is an OVERLAY; the base screen
  // owns the wifi/battery/carrier cluster. Avoids duplication.

  out.push('dialog.shell');
  if (ctx.hasSiteHeader)     out.push('dialog.website-share-header');
  if (ctx.hasBrowserTopBar)  out.push('dialog.browser-top-bar');
  if (ctx.hasTargetGrid)     out.push('dialog.icon-grid-box');
  // Page indicator dots moved INSIDE dialogIconGrid per Figma 645:2944, so
  // no longer pushed as a separate component (would render a stray pair of
  // dots below the shell).

  // NOTE: `dialog.nav-gesture-bar` intentionally NOT included — the base
  // screen underneath the dialog already owns the system gesture bar, and
  // rendering a second one inside the dialog created a duplicate thin bar
  // floating below the icon grid.
  return out;
}

// ----- Rule 2: absolute + computed positions (bottom-sheet stack) ----------
// Dialog is anchored to the BOTTOM of the viewport with some margin; the
// internal sections flow vertically inside the dialog shell (flex col gap 20).
function _dialogWidgetAnchors(viewport, ctx) {
  var vw = viewport.width;
  var vh = viewport.height;
  var scaleY = vh / 978;

  // Internal section heights (Figma-observed)
  var siteHeaderH    = ctx.hasSiteHeader    ? 82 : 0;   // 50 thumbnail + 2 rows + bottom divider
  var siteHeaderGap  = ctx.hasSiteHeader    ? 20 : 0;
  var topBarH        = ctx.hasBrowserTopBar ? 81 : 0;
  var topBarGap      = ctx.hasBrowserTopBar ? 20 : 0;
  var gridH          = ctx.hasTargetGrid    ? 202 : 0;  // fixed per Figma

  // Dialog shell total = outer padding 16*2 + content heights + gaps
  var dialogPadding  = 16;
  var contentH = siteHeaderH + siteHeaderGap + topBarH + topBarGap + gridH;
  var dialogH  = dialogPadding * 2 + contentH;
  var dialogW  = vw - 36;     // 18 side margins (Figma: px-18 on frame)

  // Anchor dialog above the bottom-nav / bottom-bar zone so it doesn't
  // collide when composited as an overlay over a base screen that owns
  // the bottom region (List, Detail, Home).
  //   - gesture bar (34h)
  //   - bottom-nav zone (72h) — always reserved on overlay base screens
  //   - 16px breathing room between dialog and nav
  var gestureBarH = 34;
  var bottomNavReserve = 72;
  var dialogBottomInset = gestureBarH + bottomNavReserve + 16; // 34 + 72 + 16 = 122
  var dialogY = vh - dialogBottomInset - dialogH;
  var dialogX = 18;

  return {
    wallpaperLayer: { x: 0, y: 0, w: vw, h: vh, radius: 40 },
    dimOverlay:     { x: 0, y: 0, w: vw, h: vh, alpha: ctx.scrimAlpha },
    // Aligned with Lock / QS / Notif: x=18, y=4, w=415, h=44 (Figma ground truth)
    statusBar: {
      x: 18, y: 4, w: 415, h: 44,
      padding: { top: 16, right: 6, bottom: 16, left: 6 }
    },
    dialog: {
      shell:  { x: dialogX, y: dialogY, w: dialogW, h: dialogH,
                radius: 32, padding: dialogPadding, gap: 20 },
      // Section Y offsets are measured from the shell's inner-top (y + padding)
      siteHeader:   ctx.hasSiteHeader ? {
        offsetY: 0, w: dialogW - dialogPadding * 2, h: siteHeaderH
      } : null,
      browserTopBar: ctx.hasBrowserTopBar ? {
        offsetY: siteHeaderH + siteHeaderGap,
        w: dialogW - dialogPadding * 2, h: topBarH
      } : null,
      iconGridBox: ctx.hasTargetGrid ? {
        offsetY: siteHeaderH + siteHeaderGap + topBarH + topBarGap,
        w: dialogW - dialogPadding * 2, h: gridH,
        padding: { top: 21, right: 25, bottom: 21, left: 25 },
        radius: 24,
        rows: ctx.targetGridRows, cols: ctx.targetGridCols
      } : null,
      pageIndicator: ctx.hasPageIndicator ? {
        offsetY: siteHeaderH + siteHeaderGap + topBarH + topBarGap + gridH - 12 - 6,
        w: 18, h: 6  // centered; caller positions horizontally
      } : null
    },
    gestureBar: { x: (vw - 144) / 2, y: vh - gestureBarH - 4, w: 144, h: 4 }
  };
}

// ----- Rule 3: state variants ----------------------------------------------
function _dialogWidgetVariant(componentId, ctx) {
  if (componentId === 'status-bar.default') {
    return {
      theme: ctx.theme,
      liveActivity: ctx.liveActivityType && {
        type: ctx.liveActivityType,
        color: ctx.liveActivityType === 'call'       ? '#0FCF6E'
             : ctx.liveActivityType === 'timer'      ? '#F79009'
             : ctx.liveActivityType === 'recording'  ? '#E74C3C'
             : ctx.liveActivityType === 'navigation' ? '#0381FE'
             : ctx.liveActivityType === 'media'      ? '#9C27B0'
             : '#0FCF6E'
      } || null
    };
  }
  if (componentId === 'dialog.website-share-header') {
    return {
      thumbnailSize: 50, thumbnailRadius: 10,
      titleSize: 18, urlSize: 14,
      shareIconSize: 24, shareBtnSize: 42, shareBtnRadius: 14
    };
  }
  if (componentId === 'dialog.browser-top-bar') {
    return {
      iconCount: ctx.actionCount,
      iconCircleSize: 54, iconCirclePadding: 15, iconCircleRadius: 48,
      labelSize: 14, labelFamily: 'ABeeZee',
      theme: ctx.theme,
      circleBg: ctx.theme === 'dark' ? '#17171A' : '#FCFCFF',
      shadow: ctx.theme === 'dark'
        ? '0px 4px 4.7px rgba(0,0,0,0.25)'
        : '0px 4px 7.7px -1px rgba(0,0,0,0.25)'
    };
  }
  if (componentId === 'dialog.icon-grid-box') {
    return {
      rows: ctx.targetGridRows,
      cols: ctx.targetGridCols,
      totalSlots: ctx.targetGridRows * ctx.targetGridCols,
      itemSize: 54, itemIconSize: 24, itemLabelSize: 14
    };
  }
  if (componentId === 'dialog.page-indicator') {
    return {
      dotSize: 6, dotGap: 6, dotCount: 2,
      activeColor: '#FFFFFF', inactiveColor: 'rgba(255,255,255,0.6)'
    };
  }
  return {};
}

// ----- Rule 4: tokens / styles ---------------------------------------------
// Dialog uses a DIFFERENT glass stack than the lock screen — heavier blur,
// darker base (0.6 vs 0.3 alpha).
function _dialogWidgetTokens(ctx) {
  return {
    frameRadius: 40,
    scrim: { color: 'rgba(0,0,0,' + ctx.scrimAlpha + ')' },
    // Three tiers of dialog-context surfaces
    glass: {
      dialogShell:   { bg: 'rgba(23,23,26,0.6)', blur: 24, border: 'none' },
      innerIconBox:  { bg: 'rgba(23,23,26,0.6)', blur: 0,  border: 'none' },
      iconPillDark:  { bg: '#17171A', shadow: '0px 4px 4.7px rgba(0,0,0,0.25)' },
      iconPillLight: { bg: '#FCFCFF', shadow: '0px 4px 7.7px -1px rgba(0,0,0,0.25)' }
    },
    accent: {
      liveActivityCall:       '#0FCF6E',
      liveActivityTimer:      '#F79009',
      liveActivityRecording:  '#E74C3C',
      liveActivityNavigation: '#0381FE',
      liveActivityMedia:      '#9C27B0'
    },
    divider:    '#5F5F61',      // inside dialog (site-header divider)
    secondary:  '#848487',      // URL text color
    typography: {
      statusBarTime: { family: 'One UI Sans APP VF, Inter', size: 15, weight: 700, leading: 12 },
      liveActivity:  { family: 'One UI Sans APP VF, Inter', size: 10, weight: 600, leading: 12 },
      dialogTitle:   { family: 'One UI Sans APP VF, Inter', size: 18, weight: 600 },
      dialogUrl:     { family: 'ABeeZee, Inter',             size: 14, weight: 400 },
      iconLabel:     { family: 'ABeeZee, Inter',             size: 14, weight: 400 }
    }
  };
}

// ----- Entry point ---------------------------------------------------------
function dialogWidgetRules(uiState, opts) {
  var o = opts || {};
  var viewport = o.viewport || { width: 451, height: 978 };
  var ctx = _dialogWidgetContext(uiState || {});
  var components = _dialogWidgetPickComponents(ctx);
  var anchors = _dialogWidgetAnchors(viewport, ctx);
  var tokens = _dialogWidgetTokens(ctx);

  function positionFor(id) {
    if (id === 'system.wallpaper-layer')      return anchors.wallpaperLayer;
    if (id === 'system.dim-overlay')          return anchors.dimOverlay;
    if (id === 'status-bar.default')          return anchors.statusBar;
    if (id === 'dialog.shell')                return anchors.dialog.shell;
    if (id === 'dialog.website-share-header') {
      var s = anchors.dialog.shell, sh = anchors.dialog.siteHeader;
      return sh ? { x: s.x + s.padding, y: s.y + s.padding + sh.offsetY,
                    w: sh.w, h: sh.h } : { x: 0, y: 0, w: 0, h: 0 };
    }
    if (id === 'dialog.browser-top-bar') {
      var s2 = anchors.dialog.shell, tb = anchors.dialog.browserTopBar;
      return tb ? { x: s2.x + s2.padding, y: s2.y + s2.padding + tb.offsetY,
                    w: tb.w, h: tb.h } : { x: 0, y: 0, w: 0, h: 0 };
    }
    if (id === 'dialog.icon-grid-box') {
      var s3 = anchors.dialog.shell, gb = anchors.dialog.iconGridBox;
      return gb ? { x: s3.x + s3.padding, y: s3.y + s3.padding + gb.offsetY,
                    w: gb.w, h: gb.h, padding: gb.padding, radius: gb.radius,
                    rows: gb.rows, cols: gb.cols } : { x: 0, y: 0, w: 0, h: 0 };
    }
    if (id === 'dialog.page-indicator') {
      var s4 = anchors.dialog.shell, pi = anchors.dialog.pageIndicator;
      return pi ? { x: s4.x + s4.w / 2 - pi.w / 2,
                    y: s4.y + s4.padding + pi.offsetY, w: pi.w, h: pi.h } : { x: 0, y: 0, w: 0, h: 0 };
    }
    if (id === 'dialog.nav-gesture-bar')      return anchors.gestureBar;
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  // id → role (matches rules-renderer ROLE_RENDERERS)
  function roleFor(id) {
    if (id === 'system.wallpaper-layer')       return 'background';
    if (id === 'system.dim-overlay')           return 'dimOverlay';
    if (id === 'status-bar.default')           return 'statusBar';
    if (id === 'dialog.shell')                 return 'dialogShell';
    if (id === 'dialog.website-share-header')  return 'dialogSiteHeader';
    if (id === 'dialog.browser-top-bar')       return 'dialogBrowserBar';
    if (id === 'dialog.icon-grid-box')         return 'dialogIconGrid';
    if (id === 'dialog.page-indicator')        return 'dialogPageDots';
    if (id === 'dialog.nav-gesture-bar')       return 'gestureBar';
    return 'unknown';
  }

  var resolved = components.map(function (id, i) {
    return {
      order: i,
      id: id,
      role: roleFor(id),
      position: positionFor(id),
      variant: _dialogWidgetVariant(id, ctx),
      _rule: _dialogRuleOriginFor(id)
    };
  });

  return {
    ctx: 'dialog-widget',
    source: DIALOG_WIDGET_SOURCE,
    viewport: viewport,
    uiState: uiState || null,
    resolvedContext: ctx,
    tokens: tokens,
    anchors: anchors,
    components: resolved,
    explain: {
      selection: _explainDialogSelection(ctx, components),
      variants:  _explainDialogVariants(ctx),
      layout:    'Bottom-sheet dialog: wallpaper-layer → scrim → status-bar → dialog-shell (gap 20 between sections) → gesture-bar',
      figmaSource: DIALOG_WIDGET_SOURCE
    }
  };
}

function _dialogRuleOriginFor(id) {
  if (id === 'system.wallpaper-layer' || id === 'system.dim-overlay')
    return 'pillar:tokens (base surface + scrim)';
  if (id.indexOf('status-bar') === 0 || id === 'dialog.nav-gesture-bar')
    return 'pillar:selection (chrome mandatory)';
  if (id === 'dialog.website-share-header')
    return 'pillar:variants (dialogType=share)';
  if (id === 'dialog.page-indicator')
    return 'pillar:variants (targetGridRows>0 & not no-pagination)';
  return 'pillar:selection (dialog anchor cluster)';
}

function _explainDialogSelection(ctx, picked) {
  return {
    count: picked.length,
    included: picked,
    excluded: [
      !ctx.hasSiteHeader     && 'website-share-header (picker/cta or no-source-header)',
      !ctx.hasBrowserTopBar  && 'browser-top-bar',
      !ctx.hasTargetGrid     && 'icon-grid-box (cta dialog)',
      !ctx.hasPageIndicator  && 'page-indicator (no grid or no-pagination)'
    ].filter(Boolean)
  };
}

function _explainDialogVariants(ctx) {
  return {
    dialogType: ctx.dialogType,
    liveActivityType: ctx.liveActivityType,
    theme: ctx.theme,
    baseSurface: ctx.baseSurface,
    actionCount: ctx.actionCount,
    targetGrid: ctx.hasTargetGrid ? (ctx.targetGridRows + '×' + ctx.targetGridCols) : 'none',
    scrimAlpha: ctx.scrimAlpha
  };
}

// ---------------------------------------------------------------------------
//  ICON LIBRARY — lookup + render helpers
//  ---------------------------------------------------------------------------
//  Delegates to figma-refs/icon_library.js (inline SVG bank, survives Figma's
//  7-day asset URL expiry). Two surfaces:
//     Generator.getIcon('status-bar.wifi.3')  → raw SVG string
//     Generator.statusBar({ theme, time, wifi, cellular, battery }) → HTML row
//  Also exposes the raw library for templates that want direct access.
// ---------------------------------------------------------------------------

var _iconLibrary = null;
function _getIconLibrary() {
  if (_iconLibrary) return _iconLibrary;
  if (typeof window !== 'undefined' && window.IconLibrary) {
    _iconLibrary = window.IconLibrary;
    return _iconLibrary;
  }
  if (typeof require === 'function') {
    try { _iconLibrary = require('./figma-refs/icon_library'); }
    catch (e) { /* icon_library optional; generator still functions without it */ }
  }
  return _iconLibrary;
}

function getIcon(key) {
  var lib = _getIconLibrary();
  return (lib && typeof lib.getIcon === 'function') ? lib.getIcon(key) : null;
}

function statusBar(opts) {
  var lib = _getIconLibrary();
  if (lib && typeof lib.renderStatusBar === 'function') return lib.renderStatusBar(opts);
  // Fallback: minimal inline bar so scenarios still render if the library
  // failed to load (e.g. stale cache during deploy).
  var o = opts || {};
  var theme = o.theme || 'dark';
  var color = (theme === 'dark') ? 'rgba(255,255,255,0.9)' : '#1a1a1a';
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 16px;height:30px;font-size:12px;font-weight:600;color:' + color + ';"><span>' + (o.time || '9:41') + '</span><span>●●● ▲ ▮▮</span></div>';
}

// ===========================================================================
//  DESIGN RULES — unified tokens extracted from Figma, applied via helpers
//  ---------------------------------------------------------------------------
//  Source of truth: figma-refs/design_rules.json
//  Consumers: atomics.js, templates.js, and any scenario HTML generation path.
//
//  Philosophy:
//    - design_rules.json is the ONLY place where font sizes, colors, radii,
//      glass effects, spacing values live.
//    - Generator.* helpers below read that JSON and return either style
//      fragments (CSS strings) or full-HTML chunks.
//    - Scenario code calls Generator.typography('title'), Generator.glass('panel'),
//      Generator.statusBarHTML(), Generator.wallpaperHTML(src), etc.
//      Never hardcodes values.
//
//  Result: changing a single token in design_rules.json updates every
//  scenario that honors the rules — true design-system-driven generation.
// ===========================================================================

var DESIGN_RULES = null;
function _loadDesignRules() {
  if (DESIGN_RULES) return DESIGN_RULES;
  if (typeof window !== 'undefined' && window.__DESIGN_RULES) {
    DESIGN_RULES = window.__DESIGN_RULES;
    return DESIGN_RULES;
  }
  try {
    if (typeof require !== 'undefined') {
      DESIGN_RULES = require('./figma-refs/design_rules.json');
      return DESIGN_RULES;
    }
  } catch (e) { /* browser path handles below */ }
  return null;
}
// In browser, trigger async load. Consumers should await Generator.designRulesReady
// or use fallback defaults if it hasn't loaded yet.
var _designRulesPromise = null;
if (typeof window !== 'undefined' && !DESIGN_RULES) {
  _designRulesPromise = fetch('figma-refs/design_rules.json')
    .then(function (r) {
      if (!r.ok) return null;
      return r.json();
    })
    .then(function (j) {
      if (!j) return null;
      DESIGN_RULES = j;
      window.__DESIGN_RULES = j;
      return j;
    })
    .catch(function (e) { console.warn('[design-rules] failed to load:', e); });
}

// Fallback rules used if JSON isn't loaded yet (first paint during async).
// Kept small and compatible — real rules override these.
var _TypographyRulesBootstrap = _TypographyRulesResolve();
var FALLBACK_RULES = {
  typography: (_TypographyRulesBootstrap && _TypographyRulesBootstrap.MINIMAL_FALLBACK_TYPOGRAPHY)
    ? _TypographyRulesBootstrap.MINIMAL_FALLBACK_TYPOGRAPHY
    : {
      family: { system: "'One UI Sans APP VF', Inter, sans-serif",
                clock:  "'Space Grotesk', Inter, sans-serif" },
      weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
      size:   { micro: 14, caption: 14, label: 16, body: 18, title: 20, heading: 22, large: 24, date: 24, headline: 26, hero: 112 },
      color:  { primary: '#FFFFFF', secondary: '#CFCCCF', statusBar: 'rgba(255,255,255,0.8)' },
      lineHeight: { hero: 82, body: 24, title: 28, display: 32 },
      letterSpacing: {
        none: 0, statusCarrier: 0.15, sectionUppercase: 0.4,
        micro: 0.1, small: 0.15
      },
      typeScale: {
        display: { lineHeightPx: 32, letterSpacingPx: 0 },
        title:   { lineHeightPx: 28, letterSpacingPx: 0 },
        body:    { lineHeightPx: 24, letterSpacingPx: 0 },
        label:   { lineHeightPx: 22, letterSpacingPx: 0 },
        meta:    { lineHeightPx: 18, letterSpacingPx: 0.1 }
      },
      _sizeTierMap: {
        micro: 'meta', caption: 'meta', label: 'label', body: 'body',
        title: 'title', heading: 'title', large: 'display', date: 'display',
        headline: 'display', hero: 'hero'
      }
    },
  layoutRhythm: {
    textStackGapKey: 'sm',
    textParagraphGapKey: 'md',
    inlineIconGapKey: 'sm',
    listRowGapKey: 'md',
    chipRowGapKey: 'md',
    cardPaddingVerticalKey: 'xxl',
    cardPaddingHorizontalKey: 'xl',
    groupSectionGapKey: '4xl'
  },
  glass: {
    shortcutCircle: { bg:'rgba(55,55,55,0.3)', blur:6,  border:'0.25px solid rgba(55,55,55,0.3)' },
    widgetPill:     { bg:'rgba(23,23,26,0.3)', blur:6,  border:'0.25px solid rgba(55,55,55,0.3)' },
    nowBar:         { bg:'rgba(23,23,26,0.3)', blur:12, border:'0.25px solid rgba(55,55,55,0.3)' },
    panel:          { bg:'rgba(23,23,26,0.3)', blur:25, border:'1px solid rgba(255,255,255,0.2)' }
  },
  radius:  { small: 20, card: 20, medium: 20, widget: 20, pill: 32, dialog: 20, panel: 20, container: 20, circle: 63.636 },
  spacing: { xs: 4, sm: 6, md: 8, base: 10, lg: 12, xl: 14, xxl: 16, '3xl': 18, '4xl': 20 },
  statusBar: {
    height: 44, paddingX: 10, paddingY: 16, gap: 6,
    carrierFontSize: 15, carrierWeight: 'bold', iconSize: 18,
    battery: { leftWidth: 15.414, rightWidth: 8.808, height: 16.515 }
  },
  wallpaper: { radius: 40, objectFit: 'cover', scrimAlpha: 0.2 },
  surface:   { width: 451, height: 978, radius: 40, outerPaddingX: 18, outerPaddingTop: 18 }
};

function _rules() { return _loadDesignRules() || FALLBACK_RULES; }

// ----- Single-property helpers --------------------------------------------
function typography(size, options) {
  var rules = _rules();
  var r = rules.typography;
  var o = options || {};
  var Tr = _TypographyRulesResolve();
  if (Tr && typeof Tr.buildTypographyStyle === 'function') {
    return Tr.buildTypographyStyle(r, size, o);
  }
  var family = o.family === 'clock' ? r.family.clock : r.family.system;
  var weight = r.weight[o.weight || 'regular'];
  var px = r.size[size] || r.size.body;
  var color = o.color ? (r.color[o.color] || o.color) : r.color.primary;
  return 'font-family:' + family + ';font-weight:' + weight + ';font-size:' + px +
    'px;line-height:normal;letter-spacing:0;color:' + color + ';';
}

function glass(tier) {
  var t = _rules().glass[tier] || _rules().glass.widgetPill;
  return 'background:' + t.bg +
         ';-webkit-backdrop-filter:blur(' + t.blur + 'px)' +
         ';backdrop-filter:blur(' + t.blur + 'px)' +
         ';border:' + t.border + ';';
}

function radius(tier) {
  return (_rules().radius[tier] != null ? _rules().radius[tier] : 20) + 'px';
}

function spacing(tier) {
  return (_rules().spacing[tier] != null ? _rules().spacing[tier] : 8) + 'px';
}

// layoutRhythm 카드키 → 해당 spacing 토큰의 px 문자열 (카드 패딩·텍스트 스택 간격 통일용)
function layoutRhythm(rhythmKey) {
  var rules = _rules();
  var Tr = _TypographyRulesResolve();
  if (Tr && typeof Tr.layoutRhythmPx === 'function') {
    var pr = Tr.layoutRhythmPx(rules, rhythmKey);
    if (pr) return pr;
  }
  var lr = rules.layoutRhythm || {};
  var spacingToken = lr[rhythmKey];
  return spacingToken ? spacing(spacingToken) : null;
}

// ----- HTML-producing helpers ---------------------------------------------
// These output ready-to-inject HTML strings so a scenario can just concatenate.

function statusBarHTML(opts) {
  var o = opts || {};
  var r = _rules();
  var sb = r.statusBar;
  var carrier = o.carrier || 'K-Arts';
  var iconBase = o.iconBase || 'assets/figma/lock-screen/'; // default to lock assets
  var color = o.color || r.typography.color.statusBar;
  return '<div style="display:flex;align-items:center;justify-content:flex-end;' +
           'gap:' + sb.gap + 'px;padding:' + sb.paddingY + 'px ' + sb.paddingX + 'px;' +
           'height:' + sb.height + 'px;width:100%;box-sizing:border-box;overflow:hidden;">' +
           '<span style="font-family:' + r.typography.family.system + ';' +
             'font-weight:' + r.typography.weight[sb.carrierWeight] + ';' +
             'font-size:' + sb.carrierFontSize + 'px;line-height:12px;' +
             'letter-spacing:' + ((r.typography.letterSpacing &&
               r.typography.letterSpacing.statusCarrier != null)
               ? r.typography.letterSpacing.statusCarrier + 'px'
               : '0.15px') + ';color:' + color + ';white-space:nowrap;flex-shrink:0;">' +
             carrier + '</span>' +
           '<div style="flex:1 0 0;align-self:stretch;"></div>' +
           '<div style="display:flex;align-items:center;gap:' + r.spacing.xs + 'px;flex-shrink:0;">' +
             '<div style="position:relative;width:' + sb.iconSize + 'px;height:' + sb.iconSize + 'px;flex-shrink:0;overflow:hidden;">' +
               '<div style="position:absolute;inset:11.11% -0.11% 11.11% 0.68%;"><img src="' + iconBase + 'wifi.svg" style="width:100%;height:100%;display:block;" alt=""></div>' +
             '</div>' +
             '<div style="position:relative;width:' + sb.iconSize + 'px;height:' + sb.iconSize + 'px;flex-shrink:0;overflow:hidden;">' +
               '<img src="' + iconBase + 'cellular.svg" style="position:absolute;left:50%;top:50%;width:14px;height:14px;transform:translate(-50%,-50%);" alt="">' +
             '</div>' +
             '<div style="display:flex;align-items:center;flex-shrink:0;">' +
               '<img src="' + iconBase + 'battery-left.svg"  style="width:' + sb.battery.leftWidth  + 'px;height:' + sb.battery.height + 'px;display:block;" alt="">' +
               '<img src="' + iconBase + 'battery-right.svg" style="width:' + sb.battery.rightWidth + 'px;height:' + sb.battery.height + 'px;display:block;" alt="">' +
             '</div>' +
           '</div>' +
         '</div>';
}

function wallpaperHTML(src) {
  var r = _rules().wallpaper;
  return '<img src="' + src + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:' + r.objectFit + ';display:block;" alt="">';
}

// Wrap an HTML fragment in a glass tier. `extraStyle` can override anything.
function wrapInGlass(tier, innerHTML, extraStyle) {
  return '<div style="' + glass(tier) + (extraStyle || '') + '">' +
         innerHTML + '</div>';
}

// ---------------------------------------------------------------------------
//  Exports — usable from Node (require) and browser (window.Generator)
// ---------------------------------------------------------------------------

const Generator = {
  APP_BG_TOKENS,
  FOCUS_BLOCK_TOKENS,
  WALLPAPER_LAYER,
  resolveWallpaperLayer,
  resolveAppBackground,
  resolveFocusBlock,
  resolveLayers,
  validateBackgroundUsage,
  // design-memory-driven
  resolveComponentSize,
  resolveRadius,
  resolveSpacing,
  filterAllowedComponents,
  resolveOrder,
  resolvePositions,
  resolveScreenPlan,
  // orphan-rule consumers
  resolvePairGap,
  validatePairGaps,
  validateGlobalRules,
  // auto-refine engine
  autoRefine,
  // icon library (Figma-catalogued)
  getIcon,
  statusBar,
  // design-rules helpers — scenarios call these to honor Figma tokens
  typography,
  glass,
  radius,
  spacing,
  layoutRhythm,
  typographyRules: _TypographyRulesResolve,
  statusBarHTML,
  wallpaperHTML,
  wrapInGlass,
  getDesignRules: _loadDesignRules,
  getDesignRulesReady: function () { return _designRulesPromise; },
  // lock screen rules (code-driven, extracted from Figma 3010:2143)
  lockScreenRules,
  compareLockScreenOutputs,
  testLockScreenRhythm,
  LOCK_SCREEN_SOURCE,
  // spatial grammar primitives — reusable for any top-depth surface
  createTopDepthLayout,
  getStatusCluster,
  getTemporalCluster,
  getBottomActionCluster,
  getCompactTemporalCluster,
  getHeaderActionsCluster,
  getTogglePillRow,
  getDragHandle,
  getStackedCardsRegion,
  placeBetween,
  placeLiveCardBetween,
  getTopInset,
  // additional surface rules
  notificationShadeRules,
  quickSettingsRules,
  NOTIFICATION_SHADE_SOURCE,
  QUICK_SETTINGS_SOURCE,
  // dialog widget rules (code-driven, extracted from Figma 3010:2144)
  dialogWidgetRules,
  DIALOG_WIDGET_SOURCE
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Generator;
}
if (typeof window !== 'undefined') {
  window.Generator = Generator;
}
