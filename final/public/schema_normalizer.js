// ============================================================================
//  GENUI PIPELINE v1 — schema normalization layer
//  ---------------------------------------------------------------------------
//  Sits between each LLM step and its downstream consumer. Takes the raw
//  JSON emitted by the LLM (snake_case, partially-specified, occasionally
//  off-vocabulary) and produces a strict, camelCase, enum-checked object
//  shaped exactly like the NormalizedInterpreterOutput / PlanningPacket /
//  SelectorOutput / ComposerOutput types.
//
//  Pure functions. No LLM calls. No DOM. Usable from Node + browser.
//
//  FALLBACK TELEMETRY
//  ------------------
//  Every time the LLM returns a missing / malformed / off-enum value, the
//  corresponding assert* helper silently substitutes a default. Those
//  substitutions are counted so operators can see the drop rate without
//  changing what downstream code receives.
//
//    getFallbackStats()    → cumulative { total, byType } for the process
//    resetFallbackStats()  → zero the cumulative counters
//    withCollector(fn)     → run fn() and also return a per-call
//                            { total, byType, events[] } snapshot.
//                            Cumulative counters still update accurately.
//
//  Set env LOG_FALLBACKS=1 to also emit each fallback to stderr with a
//  "[FALLBACK]" prefix so it can be grepped.
// ============================================================================

'use strict';

const allowed = {
  baseSurface:      ['lock', 'home', 'app'],
  homeSubstate:     ['none', 'launcher', 'app-drawer', 'widget-edit'],
  overlayType:      ['none', 'quick-settings', 'notification-shade', 'system-dialog'],
  overlayCoverage:  ['none', 'partial', 'full'],
  windowMode:       ['single', 'split', 'floating'],
  attentionMode:    ['focused', 'glanceable', 'distracted'],
  densityMode:      ['expanded', 'normal', 'compressed'],
  interactionMode:  ['touch', 'voice', 'mixed', 'minimal-touch'],
  backgroundPolicy: ['wallpaper', 'solid-dark', 'scrim-over-wallpaper', 'scrim-over-app', 'dialog-surface'],
  urgency:          ['low', 'medium', 'high'],
  mobilityMode:     ['stationary', 'walking', 'driving', 'transit'],
  layoutContainer:  ['vertical-stack', 'horizontal-stack', 'grid', 'overlay-stack'],
  groupContainer:   ['vertical-stack', 'horizontal-stack', 'grid'],
  placement:        ['top', 'middle', 'bottom', 'leading', 'trailing', 'full-width'],
  visibility:       ['visible', 'collapsed', 'hidden'],
  // Semantic role of a single component within its containing group.
  // Drives visual emphasis (subject = dominant; state/action = anchored
  // to subject; context = subordinate) and cross-screen flow continuity
  // (subject carries through Entry → Action → Completion).
  componentRole:    ['chrome', 'subject', 'state', 'action', 'feedback', 'context', 'navigation'],
  // Role of a whole group within the layout.
  groupRole:        ['chrome', 'primary-task', 'supporting', 'tertiary', 'meta']
};

// ---------------------------------------------------------------------------
//  fallback telemetry
// ---------------------------------------------------------------------------

const FALLBACK_TYPES = ['enum', 'string', 'stringArray', 'priority', 'number'];

function _zeroCounters() {
  const c = { total: 0, byType: {} };
  for (const t of FALLBACK_TYPES) c.byType[t] = 0;
  return c;
}

const _cumulative = _zeroCounters();
const _collectorStack = [];
const _LOG = process.env.LOG_FALLBACKS === '1';

function _summarize(value) {
  if (value === undefined) return '<undefined>';
  if (value === null) return null;
  const t = typeof value;
  if (t === 'string')  return value.length > 500 ? value.slice(0, 497) + '...' : value;
  if (t === 'number' || t === 'boolean') return value;
  try {
    const s = JSON.stringify(value);
    return s.length > 500 ? s.slice(0, 497) + '...' : s;
  } catch (_) { return '<unserializable>'; }
}

function _recordFallback(type, receivedValue, fallbackValue) {
  _cumulative.total++;
  _cumulative.byType[type] = (_cumulative.byType[type] || 0) + 1;
  const top = _collectorStack[_collectorStack.length - 1];
  if (top) {
    top.total++;
    top.byType[type] = (top.byType[type] || 0) + 1;
    top.events.push({
      type,
      received: _summarize(receivedValue),
      fallback: _summarize(fallbackValue),
      at:       Date.now()
    });
  }
  if (_LOG) {
    try {
      console.error(
        '[FALLBACK] ' + type +
        ' received=' + JSON.stringify(_summarize(receivedValue)) +
        ' -> used=' + JSON.stringify(_summarize(fallbackValue))
      );
    } catch (_) { /* never break the pipeline over a log call */ }
  }
}

function getFallbackStats() {
  return {
    total:  _cumulative.total,
    byType: Object.assign({}, _cumulative.byType)
  };
}

function resetFallbackStats() {
  _cumulative.total = 0;
  for (const k of Object.keys(_cumulative.byType)) _cumulative.byType[k] = 0;
}

// Wrap a (sync or async) function; returns { result, fallbacks }.
// Nested calls supported: only the innermost collector receives events,
// cumulative counters always update.
async function withCollector(fn) {
  const collector = _zeroCounters();
  collector.events = [];
  _collectorStack.push(collector);
  try {
    const result = await fn();
    return { result, fallbacks: collector };
  } finally {
    const idx = _collectorStack.indexOf(collector);
    if (idx !== -1) _collectorStack.splice(idx, 1);
  }
}

// ---------------------------------------------------------------------------
//  low-level assertions
//  Behaviour unchanged from the original; each now records a fallback event
//  via _recordFallback whenever it has to substitute a default.
// ---------------------------------------------------------------------------

function assertEnum(value, allowedValues, fallback) {
  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    _recordFallback('enum', value, fallback);
    return fallback;
  }
  return value;
}

function assertString(value, fallback) {
  if (fallback === undefined) fallback = '';
  if (typeof value !== 'string') {
    _recordFallback('string', value, fallback);
    return fallback;
  }
  return value;
}

function assertStringArray(value) {
  if (!Array.isArray(value)) {
    _recordFallback('stringArray', value, []);
    return [];
  }
  const filtered = value.filter(v => typeof v === 'string');
  if (filtered.length !== value.length) {
    // partial mangle — LLM sent an array containing non-strings
    _recordFallback('stringArray', value, filtered);
  }
  return filtered;
}

function assertPriority(value, fallback) {
  if (fallback === undefined) fallback = 2;
  if (value !== 1 && value !== 2 && value !== 3) {
    _recordFallback('priority', value, fallback);
    return fallback;
  }
  return value;
}

function assertNumber(value, fallback) {
  if (fallback === undefined) fallback = 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    _recordFallback('number', value, fallback);
    return fallback;
  }
  return value;
}

function camelizeKeysDeep(input) {
  if (Array.isArray(input)) return input.map(camelizeKeysDeep);
  if (input && typeof input === 'object') {
    const out = {};
    for (const key of Object.keys(input)) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      out[camelKey] = camelizeKeysDeep(input[key]);
    }
    return out;
  }
  return input;
}

// ---------------------------------------------------------------------------
//  UI state (shared by interpreter + normalizer outputs)
// ---------------------------------------------------------------------------

function normalizeUIState(input) {
  const raw = camelizeKeysDeep(input || {}) || {};
  return {
    baseSurface:      assertEnum(raw.baseSurface,      allowed.baseSurface,      'app'),
    homeSubstate:     assertEnum(raw.homeSubstate,     allowed.homeSubstate,     'none'),
    overlayType:      assertEnum(raw.overlayType,      allowed.overlayType,      'none'),
    overlayCoverage:  assertEnum(raw.overlayCoverage,  allowed.overlayCoverage,  'none'),
    windowMode:       assertEnum(raw.windowMode,       allowed.windowMode,       'single'),
    attentionMode:    assertEnum(raw.attentionMode,    allowed.attentionMode,    'focused'),
    densityMode:      assertEnum(raw.densityMode,      allowed.densityMode,      'normal'),
    interactionMode:  assertEnum(raw.interactionMode,  allowed.interactionMode,  'touch'),
    backgroundPolicy: assertEnum(raw.backgroundPolicy, allowed.backgroundPolicy, 'solid-dark'),
    // Free-form scenario signals (e.g. "media-playing", "now-bar:charging",
    // "evening", "weather"). Read by generator.js for variant selection
    // (which Now Bar to show, whether to surface a weather widget, etc.).
    // Validated only as a string array — no enum, since the vocabulary is
    // open-ended and the LLM may invent useful new tags.
    contextTags:      assertStringArray(raw.contextTags)
  };
}

// ---------------------------------------------------------------------------
//  STEP 1 → normalized
// ---------------------------------------------------------------------------

function normalizeInterpreterOutput(input) {
  const raw = camelizeKeysDeep(input || {}) || {};
  const intent  = raw.intent  || {};
  const context = raw.context || {};
  const tasks   = Array.isArray(raw.tasks) ? raw.tasks : [];

  return {
    intent: {
      primaryGoal:   assertString(intent.primaryGoal),
      secondaryGoal: intent.secondaryGoal == null ? null : assertString(intent.secondaryGoal)
    },
    context: {
      environment:     assertString(context.environment),
      attentionMode:   assertEnum(context.attentionMode,   allowed.attentionMode,   'focused'),
      urgency:         assertEnum(context.urgency,         allowed.urgency,         'medium'),
      mobilityMode:    assertEnum(context.mobilityMode,    allowed.mobilityMode,    'stationary'),
      interactionMode: assertEnum(context.interactionMode, allowed.interactionMode, 'touch')
    },
    tasks: tasks.map((t, i) => {
      const task = camelizeKeysDeep(t) || {};
      return {
        taskId:      assertString(task.taskId, 'task_' + (i + 1)),
        type:        assertString(task.type),
        priority:    assertPriority(task.priority),
        contentNeed: assertString(task.contentNeed)
      };
    }),
    constraints: assertStringArray(raw.constraints),
    uiState:     normalizeUIState(raw.uiState)
  };
}

// ---------------------------------------------------------------------------
//  STEP 2 → normalized
// ---------------------------------------------------------------------------

function normalizeNormalizerOutput(input) {
  const raw = camelizeKeysDeep(input || {}) || {};
  const planningSummary      = raw.planningSummary      || {};
  const taskGroups           = raw.taskGroups           || {};
  const selectionConstraints = raw.selectionConstraints || {};

  const normalizeTaskGroup = (items) =>
    (Array.isArray(items) ? items : []).map((item, i) => {
      const t = camelizeKeysDeep(item) || {};
      return {
        taskId:        assertString(t.taskId, 'task_' + (i + 1)),
        type:          assertString(t.type),
        contentNeed:   assertString(t.contentNeed),
        selectionHint: assertString(t.selectionHint)
      };
    });

  return {
    planningSummary: {
      primaryGoal:         assertString(planningSummary.primaryGoal),
      interactionPriority: assertString(planningSummary.interactionPriority),
      attentionStrategy:   assertString(planningSummary.attentionStrategy),
      densityStrategy:     assertString(planningSummary.densityStrategy),
      backgroundPolicy:    assertString(planningSummary.backgroundPolicy)
    },
    taskGroups: {
      primary:   normalizeTaskGroup(taskGroups.primary),
      secondary: normalizeTaskGroup(taskGroups.secondary),
      optional:  normalizeTaskGroup(taskGroups.optional)
    },
    slotRequirements: (Array.isArray(raw.slotRequirements) ? raw.slotRequirements : []).map((item) => {
      const s = camelizeKeysDeep(item) || {};
      return {
        slot:          assertString(s.slot),
        purpose:       assertString(s.purpose),
        contentType:   assertString(s.contentType),
        priority:      assertPriority(s.priority),
        selectionHint: assertString(s.selectionHint)
      };
    }),
    selectionConstraints: {
      prefer:        assertStringArray(selectionConstraints.prefer),
      avoid:         assertStringArray(selectionConstraints.avoid),
      collapseFirst: assertStringArray(selectionConstraints.collapseFirst)
    },
    uiState: normalizeUIState(raw.uiState)
  };
}

// ---------------------------------------------------------------------------
//  STEP 3 → normalized
// ---------------------------------------------------------------------------

function normalizeSelectorOutput(input) {
  const raw = camelizeKeysDeep(input || {}) || {};
  const plannerNotes = raw.plannerNotes || {};

  return {
    requiredComponents: (Array.isArray(raw.requiredComponents) ? raw.requiredComponents : []).map((item) => {
      const c       = camelizeKeysDeep(item) || {};
      const content = c.content || {};
      return {
        slot:          assertString(c.slot),
        componentType: assertString(c.componentType),
        variantHint:   assertString(c.variantHint),
        priority:      assertPriority(c.priority),
        // Semantic role within a task unit. Defaults to "context" (the most
        // generic / least committal value) when the LLM omits or fumbles
        // the field. The composer reads role to assemble task-coherent
        // groups instead of flat component piles.
        role:          assertEnum(c.role, allowed.componentRole, 'context'),
        content: {
          label: assertString(content.label),
          value: assertString(content.value),
          icon:  content.icon == null ? null : assertString(content.icon)
        },
        constraints: assertStringArray(c.constraints)
      };
    }),
    plannerNotes: {
      keptPrimaryTasks:       assertStringArray(plannerNotes.keptPrimaryTasks),
      collapsedOptionalTasks: assertStringArray(plannerNotes.collapsedOptionalTasks),
      selectionReasoning:     assertStringArray(plannerNotes.selectionReasoning)
    }
  };
}

// ---------------------------------------------------------------------------
//  STEP 4 → normalized (composer output)
//  NOTE: Step 4 composer is not yet LLM-driven; this normalizer is ready for
//  when the composer is rewired. Currently unused by the pipeline.
// ---------------------------------------------------------------------------

function normalizeComposerOutput(input) {
  const raw           = camelizeKeysDeep(input || {}) || {};
  const layoutPlan    = raw.layoutPlan    || {};
  const padding       = layoutPlan.padding || {};
  const composerNotes = raw.composerNotes || {};

  return {
    layoutPlan: {
      container:        assertEnum(layoutPlan.container,        allowed.layoutContainer,  'vertical-stack'),
      backgroundPolicy: assertEnum(layoutPlan.backgroundPolicy, allowed.backgroundPolicy, 'solid-dark'),
      padding: {
        top:    assertNumber(padding.top),
        right:  assertNumber(padding.right),
        bottom: assertNumber(padding.bottom),
        left:   assertNumber(padding.left)
      },
      gap: assertNumber(layoutPlan.gap),
      groups: (Array.isArray(layoutPlan.groups) ? layoutPlan.groups : []).map((group, i) => {
        const g = camelizeKeysDeep(group) || {};
        return {
          groupId:   assertString(g.groupId, 'group_' + (i + 1)),
          purpose:   assertString(g.purpose),
          container: assertEnum(g.container, allowed.groupContainer, 'vertical-stack'),
          gap:       assertNumber(g.gap),
          // Group-level role: chrome | primary-task | supporting | tertiary | meta.
          // Lets the renderer style the whole group based on its job, and
          // lets validators check task coherence (e.g. primary-task groups
          // must contain a subject child).
          role:      assertEnum(g.role, allowed.groupRole, 'supporting'),
          children: (Array.isArray(g.children) ? g.children : []).map((child) => {
            const ch = camelizeKeysDeep(child) || {};
            return {
              componentId: assertString(ch.componentId),
              variant:     assertString(ch.variant),
              placement:   assertEnum(ch.placement,  allowed.placement,  'full-width'),
              priority:    assertPriority(ch.priority),
              visibility:  assertEnum(ch.visibility, allowed.visibility, 'visible'),
              // Carry the semantic slot name from the selector verbatim
              // so the renderer can identify which task unit this child
              // belongs to (e.g. slot="current_instruction" pairs with
              // slot="step_navigation" as subject + action).
              slot:        assertString(ch.slot),
              // Component-level role mirroring the selector's classification;
              // composer may refine if grouping requires (e.g. a button that
              // was "action" in selection becomes "navigation" if grouped
              // with chrome). Defaults to "context".
              role:        assertEnum(ch.role, allowed.componentRole, 'context')
            };
          })
        };
      })
    },
    composerNotes: {
      layoutStrategy:        assertString(composerNotes.layoutStrategy),
      priorityPreservation:  assertStringArray(composerNotes.priorityPreservation),
      collapsedComponents:   assertStringArray(composerNotes.collapsedComponents),
      whyThisStructure:      assertStringArray(composerNotes.whyThisStructure)
    }
  };
}

module.exports = {
  allowed,
  camelizeKeysDeep,
  normalizeUIState,
  normalizeInterpreterOutput,
  normalizeNormalizerOutput,
  normalizeSelectorOutput,
  normalizeComposerOutput,
  // telemetry
  getFallbackStats,
  resetFallbackStats,
  withCollector
};
