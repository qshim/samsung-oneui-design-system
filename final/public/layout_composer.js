// ============================================================================
//  GENUI PIPELINE v1 — layout-level validators (context + overflow)
//  ---------------------------------------------------------------------------
//  Pure algorithm. NO LLM. Operates on the canonical camelCase layoutPlan
//  emitted by Step 4 (groups[].children[]) + uiState + selected plan, and
//  produces canonical violation rows (stage='layout').
//
//  The algorithmic composer that used to live here is superseded by the
//  Step 4 LLM composer in pipeline.js and has been removed.
// ============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, 'figma-refs', 'component_registry.json');
let REGISTRY = null;
try { REGISTRY = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
catch (e) { console.warn('[layout_composer] component_registry.json not found:', e.message); }

const DEFAULT_VIEWPORT = { width: 360, height: 780 };

function getComponentSpec(componentType) {
  if (!REGISTRY) return null;
  return (REGISTRY.components || {})[componentType] || null;
}

// ---------------------------------------------------------------------------
//  Canonical violation row
// ---------------------------------------------------------------------------

function buildViolation(fields) {
  const autoFix = fields.autoFix || { possible: false, action: null, value: null };
  const status  = fields.status || 'review-required';
  return {
    id:          fields.id,
    stage:       fields.stage || 'layout',
    ruleId:      fields.ruleId,
    category:    fields.category,
    severity:    fields.severity,
    status,
    frame:       fields.frame || '(pipeline)',
    element:     fields.element || null,
    nodeId:      fields.nodeId || null,
    property:    fields.property || null,
    actual:      fields.actual   === undefined ? null : fields.actual,
    expected:    fields.expected === undefined ? null : fields.expected,
    delta:       fields.delta    === undefined ? null : fields.delta,
    message:     fields.message || '',
    autoFix,
    needsReview: status !== 'auto-fixable'
  };
}

// ---------------------------------------------------------------------------
//  Helpers — walk canonical layoutPlan.groups[].children[]
// ---------------------------------------------------------------------------

function flattenGroups(layoutPlan) {
  const groups = (layoutPlan && Array.isArray(layoutPlan.groups)) ? layoutPlan.groups : [];
  const out = [];
  groups.forEach(g => {
    (g.children || []).forEach(ch => {
      out.push({
        componentId: ch.componentId,
        variant:     ch.variant,
        placement:   ch.placement,
        priority:    ch.priority,
        visibility:  ch.visibility,
        // role flows through so downstream validators can apply
        // chrome-vs-content rules (chrome is always full-width and always
        // present, so it shouldn't trigger width / visibleChildren checks
        // against canvas content budgets).
        role:        ch.role || g.role || null,
        slot:        ch.slot || null,
        _groupId:    g.groupId,
        _groupRole:  g.role,
        _groupContainer: g.container,
        _groupGap:   g.gap
      });
    });
  });
  return out;
}

function uiContextTags(uiState) {
  const tags = [];
  if (!uiState) return tags;
  if (uiState.baseSurface)     tags.push(uiState.baseSurface);
  if (uiState.overlayType && uiState.overlayType !== 'none') tags.push(uiState.overlayType);
  if (uiState.attentionMode)   tags.push(uiState.attentionMode);
  if (uiState.interactionMode) tags.push(uiState.interactionMode);
  return tags;
}

// ---------------------------------------------------------------------------
//  context_component_match
//  ---------------------------------------------------------------------------
//  Every componentId in layoutPlan.groups[].children[]:
//    (a) must be in plan.requiredComponents[].componentType
//    (b) its registry allowed_contexts must intersect the uiState tags
// ---------------------------------------------------------------------------

function validateContextComponentMatch(layoutPlan, uiState, plan, idGen) {
  const out = [];
  const ctxTags = uiContextTags(uiState);
  const ctxSet  = new Set(ctxTags);
  const selectedTypes = new Set(
    ((plan && plan.requiredComponents) || []).map(c => c.componentType).filter(Boolean)
  );
  const flat = flattenGroups(layoutPlan);

  flat.forEach(ch => {
    // (a) selection coherence
    if (!selectedTypes.has(ch.componentId)) {
      out.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'context_component_match',
        category: 'consistency',
        severity: 'high',
        status:   'review-required',
        element:  ch.componentId,
        property: 'componentId',
        actual:   ch.componentId,
        expected: Array.from(selectedTypes),
        message:  `componentId "${ch.componentId}" is not in STEP 3 requiredComponents`
      }));
      return;
    }
    // (b) registry allowed_contexts intersection
    const spec = getComponentSpec(ch.componentId);
    if (!spec) {
      out.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'context_component_match',
        category: 'vocabulary',
        severity: 'high',
        status:   'review-required',
        element:  ch.componentId,
        property: 'component_type',
        actual:   ch.componentId,
        expected: 'registered component',
        message:  `component_type "${ch.componentId}" is not in the registry`
      }));
      return;
    }
    // NOTE: allowed_contexts filtering is now handled upstream by
    // generator.filterAllowedComponents() in the pipeline entry point.
    // We only emit a low-severity informational note here (not a blocker)
    // in case components still slip through an unfiltered path.
    const allowed = Array.isArray(spec.allowed_contexts) ? spec.allowed_contexts : [];
    if (allowed.length > 0 && !allowed.some(tag => ctxSet.has(tag))) {
      out.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'context_component_match',
        category: 'context',
        severity: 'low',
        status:   'info',
        element:  ch.componentId,
        property: 'allowed_contexts',
        actual:   ctxTags,
        expected: allowed,
        message:  `[info] "${ch.componentId}" allowed_contexts [${allowed.join(', ')}] do not intersect uiState context [${ctxTags.join(', ')}] — upstream filter should have caught this`
      }));
    }
  });

  return out;
}

// ---------------------------------------------------------------------------
//  layout_overflow_check
//  ---------------------------------------------------------------------------
//  Walks canonical groups[] — per-group height (vertical-stack / horizontal-
//  stack / grid) + inter-group gap + top/bottom padding. Only visible children
//  are counted. Also widens by densityMode / attentionMode / overlayType:
//    - overlayType !== 'none' → usable height ~ 60% of viewport
//    - densityMode === 'compressed' with >6 visible children → flag
//    - attentionMode === 'glanceable' with >4 visible children → flag
// ---------------------------------------------------------------------------

function groupIntrinsicHeight(group, visibleChildren) {
  if (visibleChildren.length === 0) return 0;
  const heights = visibleChildren.map(ch => {
    const spec = getComponentSpec(ch.componentId);
    return (spec && spec.layout_spec && spec.layout_spec.min_height) || 0;
  });
  const gap = group.gap || 0;

  if (group.container === 'horizontal-stack') {
    return Math.max.apply(null, heights);
  }
  if (group.container === 'grid') {
    const cols = 2;
    const rows = Math.ceil(visibleChildren.length / cols);
    const rowMax = Math.max.apply(null, heights);
    return rows * rowMax + Math.max(0, rows - 1) * gap;
  }
  // vertical-stack (default)
  return heights.reduce((a, b) => a + b, 0) + Math.max(0, visibleChildren.length - 1) * gap;
}

function validateLayoutOverflow(layoutPlan, uiState, viewport, idGen) {
  const out = [];
  const vp  = viewport || DEFAULT_VIEWPORT;
  const lp  = layoutPlan || {};
  const pad = lp.padding || { top: 0, right: 0, bottom: 0, left: 0 };
  const groupGap = lp.gap || 0;
  const groups   = Array.isArray(lp.groups) ? lp.groups : [];

  const visibleByGroup = groups.map(g => ({
    group: g,
    visible: (g.children || []).filter(ch => ch.visibility === 'visible')
  }));

  // Height check
  let needed = pad.top + pad.bottom;
  let nonEmptyGroups = 0;
  visibleByGroup.forEach(({ group, visible }) => {
    if (visible.length === 0) return;
    needed += groupIntrinsicHeight(group, visible);
    nonEmptyGroups += 1;
  });
  if (nonEmptyGroups > 1) needed += (nonEmptyGroups - 1) * groupGap;

  // Overlay surfaces have less usable height
  const overlayDiscount = (uiState && uiState.overlayType && uiState.overlayType !== 'none') ? 0.6 : 1.0;
  const usableHeight = Math.floor(vp.height * overlayDiscount);

  if (needed > usableHeight) {
    out.push(buildViolation({
      id:       idGen(),
      stage:    'layout',
      ruleId:   'layout_overflow_check',
      category: 'layout',
      severity: 'high',
      status:   'auto-fixable',
      element:  lp.container || 'layoutPlan',
      property: 'height',
      actual:   needed,
      expected: usableHeight,
      delta:    needed - usableHeight,
      message:  `layout exceeds usable height by ${needed - usableHeight}px (usable=${usableHeight}, overlay=${uiState && uiState.overlayType}) — collapse priority-3 children or switch to compact variants`,
      autoFix:  { possible: true, action: 'collapse', value: 'priority_3_first' }
    }));
  }

  // Width check — any single child whose min_width + horizontal padding exceeds viewport.width.
  //
  // CHROME EXEMPTION: chrome elements (status-bar, app-bar/header, gesture-bar,
  // bottom-navigation-bar) are absolute-positioned by the renderer into the
  // device frame's reserved zones (topSystem / bottomNav) — they ALWAYS span
  // the full viewport width by design, which means they always exceed the
  // canvas content's usable width (viewport - inner padding). Flagging that
  // is a false positive that produced 1-2 noise violations every iteration.
  // The width check applies only to body content, not structural chrome.
  const widthCap = vp.width - pad.left - pad.right;
  flattenGroups(lp).forEach(ch => {
    if (ch.visibility !== 'visible') return;
    // Chrome exemption — full-width by design, lives in topSystem/bottomNav zones.
    if (ch.role === 'chrome' || ch._groupRole === 'chrome') return;
    const spec = getComponentSpec(ch.componentId);
    const minW = (spec && spec.layout_spec && spec.layout_spec.min_width) || 0;
    if (minW > widthCap) {
      out.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'layout_overflow_check',
        category: 'layout',
        severity: 'medium',
        status:   'review-required',
        element:  ch.componentId,
        property: 'width',
        actual:   minW,
        expected: widthCap,
        delta:    minW - widthCap,
        message:  `"${ch.componentId}" min_width (${minW}) exceeds usable width (${widthCap}) — switch to compact variant or relax padding`
      }));
    }
  });

  // Density / attention heuristics — count CONTENT children only. Chrome
  // (status bar, header, gesture bar, bottom nav) is always present and does
  // not compete for the user's primary attention, so excluding it keeps the
  // glanceable=4 / compressed=6 budgets meaningful for the things the user
  // actually scans.
  const allVisible = flattenGroups(lp).filter(ch =>
    ch.visibility === 'visible' &&
    ch.role !== 'chrome' &&
    ch._groupRole !== 'chrome'
  );
  if (uiState && uiState.densityMode === 'compressed' && allVisible.length > 6) {
    out.push(buildViolation({
      id:       idGen(),
      stage:    'layout',
      ruleId:   'layout_overflow_check',
      category: 'layout',
      severity: 'medium',
      status:   'review-required',
      element:  lp.container || 'layoutPlan',
      property: 'visibleChildren',
      actual:   allVisible.length,
      expected: 6,
      delta:    allVisible.length - 6,
      message:  `densityMode=compressed but ${allVisible.length} visible children (>6) — collapse lower-priority items`
    }));
  }
  if (uiState && uiState.attentionMode === 'glanceable' && allVisible.length > 4) {
    out.push(buildViolation({
      id:       idGen(),
      stage:    'layout',
      ruleId:   'layout_overflow_check',
      category: 'layout',
      severity: 'medium',
      status:   'review-required',
      element:  lp.container || 'layoutPlan',
      property: 'visibleChildren',
      actual:   allVisible.length,
      expected: 4,
      delta:    allVisible.length - 4,
      message:  `attentionMode=glanceable but ${allVisible.length} visible children (>4) — surface only the top 4`
    }));
  }

  return out;
}

module.exports = {
  validateContextComponentMatch,
  validateLayoutOverflow,
  buildViolation,
  getComponentSpec,
  flattenGroups,
  DEFAULT_VIEWPORT,
  REGISTRY_PATH
};
