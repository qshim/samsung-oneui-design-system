// =============================================================================
//  improvement_engine.js
//  ----------------------------------------------------------------------------
//  Self-improving system foundation. This module owns:
//    1. Test suite execution against figma-refs/test_scenarios.json
//    2. Per-scenario scoring (violations + richness + expected coverage)
//    3. Pattern extraction from accumulated test runs (Phase B — placeholder)
//    4. Rule trial / persistence in figma-refs/learned_rules.json (Phase C)
//
//  Phase A surface: runTestSuite({ pipeline, runners }) → { runs, summary }.
//  The HTTP endpoints (/api/improve/test-suite, /api/improve/cycle) live in
//  server.js and call into this module.
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');

const SCENARIOS_PATH    = path.join(__dirname, 'figma-refs', 'test_scenarios.json');
const LEARNED_RULES_PATH = path.join(__dirname, 'figma-refs', 'learned_rules.json');
const HISTORY_DIR        = path.join(__dirname, 'data', 'improvement_history');

let TEST_SUITE = null;
try { TEST_SUITE = JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf8')); }
catch (e) { console.warn('[improve] test_scenarios.json not loaded:', e.message); }

// ---------------------------------------------------------------------------
//  EXPECTED FEATURE DETECTION
//  Each test scenario declares "expectedFeatures" — qualitative goals the
//  output should meet. These probes look at the rendered plan/layout and
//  return true when the goal is met. New features added here should match
//  the strings in test_scenarios.json scenarios[].expectedFeatures.
// ---------------------------------------------------------------------------
const FEATURE_DETECTORS = {
  has_clock: (plan, layout) => _hasComponent(plan, /lock-screen\.clock|^clock$/i),
  has_weather: (plan, layout) =>
    _hasComponent(plan, /weather_glance_card|lock-screen\.weather|weather/i),
  has_calendar: (plan, layout) =>
    _hasComponent(plan, /calendar_summary_card|calendar/i),
  has_calendar_or_widget: (plan, layout) =>
    _hasComponent(plan, /calendar|widget-/i),
  has_media: (plan, layout) =>
    _hasComponent(plan, /media_control_bar|media-card|now-bar\.media|media-player/i),
  has_eta_or_nav: (plan, layout) =>
    _hasComponent(plan, /eta_card|navigation_turn_card|now-bar\.dual|now-bar\.single/i),
  has_message_or_notif: (plan, layout) =>
    _hasComponent(plan, /message_summary_card|notification-card|notification\./i),
  has_timer_or_subject: (plan, layout) =>
    _hasComponent(plan, /now-bar\.timer|recipe|step|input_summary_card/i) ||
    _planHasRole(plan, 'subject'),
  has_toggle_or_action: (plan, layout) =>
    _hasComponent(plan, /quick_toggle_row|action_chip_row|toggle|switch/i) ||
    _planHasRole(plan, 'action'),
  has_status_signal: (plan, layout) =>
    _hasComponent(plan, /status-bar|now-bar\.charging|battery/i),
  // Charging-state detector (now-bar.charging is the canonical artifact;
  // any battery-named component also counts).
  has_charging_or_battery: (plan, layout) =>
    _hasComponent(plan, /now-bar\.charging|battery|charging/i),
  // Workout / activity widgets — Samsung's lock-screen.widget-activity, or
  // any active subject with workout-flavored slot/role.
  has_workout_or_activity: (plan, layout) =>
    _hasComponent(plan, /widget-activity|workout|activity|fitness|run/i) ||
    (_planHasRole(plan, 'subject') && _planSlotMatches(plan, /workout|run|activity|heart/i)),
  // Camera / capture mode — chip rows for camera modes, or capture-named
  // subjects.
  has_camera_or_capture: (plan, layout) =>
    _hasComponent(plan, /camera|capture|shutter|action_chip_row/i),
  // Voice / assistant — Bixby waveform, voice cards, now-bar single-line
  // (used for voice modes), or action_chip_row for suggested replies.
  has_voice_or_assistant: (plan, layout) =>
    _hasComponent(plan, /bixby|voice|assistant|now-bar\.single|input_summary_card|action_chip_row/i)
};

// Inspect plan slot names for a regex match — used by detectors that need
// semantic context beyond the bare componentType.
function _planSlotMatches(plan, regex) {
  const comps = (plan && plan.requiredComponents) || [];
  return comps.some(c => regex.test(c.slot || ''));
}

function _hasComponent(plan, regex) {
  const comps = (plan && plan.requiredComponents) || [];
  return comps.some(c => regex.test(c.componentType || ''));
}

function _planHasRole(plan, role) {
  const comps = (plan && plan.requiredComponents) || [];
  return comps.some(c => (c.role || '').toLowerCase() === role);
}

// ---------------------------------------------------------------------------
//  PROPERTY-BASED ASSERTIONS (universal structural rules)
//  These rules apply to EVERY pipeline output regardless of scenario. They
//  catch regressions on shapes the test suite doesn't explicitly check.
//  Each property returns { passed: bool, message?: string }. Failures
//  count against the score (negative weight) so a rule that fixes scenario
//  metrics but breaks structural invariants is rejected.
// ---------------------------------------------------------------------------
const PROPERTIES = [
  {
    id: 'lock_must_have_clock',
    description: 'Lock-surface output must contain a clock-like component.',
    weight: -8,
    check: (output) => {
      const surface = output && output.uiState && output.uiState.baseSurface;
      if (surface !== 'lock') return { passed: true };  // not applicable
      const plan = output.plan;
      const hasClock = (plan && plan.requiredComponents || [])
        .some(c => /lock-screen\.clock|^clock$/i.test(c.componentType || ''));
      return hasClock
        ? { passed: true }
        : { passed: false, message: 'lock surface missing clock component' };
    }
  },
  {
    id: 'app_must_have_status_bar',
    description: 'App-surface output must contain an app status bar.',
    weight: -6,
    check: (output) => {
      const surface = output && output.uiState && output.uiState.baseSurface;
      if (surface !== 'app') return { passed: true };
      const plan = output.plan;
      const hasStatusBar = (plan && plan.requiredComponents || [])
        .some(c => /container\.status-bar-app|status-bar/i.test(c.componentType || ''));
      return hasStatusBar
        ? { passed: true }
        : { passed: false, message: 'app surface missing status bar' };
    }
  },
  {
    id: 'priority1_never_collapsed',
    description: 'Priority-1 components must always be visible (never collapsed/hidden).',
    weight: -10,
    check: (output) => {
      const groups = (output && output.layoutPlan && output.layoutPlan.groups) || [];
      const offenders = [];
      groups.forEach(g => (g.children || []).forEach(c => {
        if (c.priority === 1 && c.visibility && c.visibility !== 'visible') {
          offenders.push(c.componentId + '(' + c.visibility + ')');
        }
      }));
      return offenders.length === 0
        ? { passed: true }
        : { passed: false, message: 'priority-1 not visible: ' + offenders.join(', ') };
    }
  },
  {
    id: 'no_silent_drops',
    description: 'Every plan component must appear in at least one layout group.',
    weight: -6,
    check: (output) => {
      const plan = output && output.plan;
      const layout = output && output.layoutPlan;
      if (!plan || !layout) return { passed: true };
      const layoutIds = new Set();
      (layout.groups || []).forEach(g => (g.children || []).forEach(c => {
        if (c.componentId) layoutIds.add(c.componentId);
      }));
      const dropped = (plan.requiredComponents || [])
        .filter(c => c.componentType && !layoutIds.has(c.componentType));
      return dropped.length === 0
        ? { passed: true }
        : { passed: false, message: 'dropped: ' + dropped.map(d => d.componentType).join(', ') };
    }
  },
  {
    id: 'group_density_cap',
    description: 'No single group should contain more than 6 visible children (avoid wall-of-cards).',
    weight: -3,
    check: (output) => {
      const groups = (output && output.layoutPlan && output.layoutPlan.groups) || [];
      const offenders = groups.filter(g => {
        const visible = (g.children || []).filter(c => c.visibility !== 'hidden' && c.visibility !== 'collapsed');
        return visible.length > 6;
      });
      return offenders.length === 0
        ? { passed: true }
        : { passed: false, message: offenders.length + ' group(s) exceed 6-child cap' };
    }
  },
  {
    id: 'subject_role_has_label',
    description: 'Components with role=subject must have a non-empty label.',
    weight: -3,
    check: (output) => {
      const plan = output && output.plan;
      const offenders = ((plan && plan.requiredComponents) || [])
        .filter(c => c.role === 'subject' &&
                    (!c.content || !c.content.label || c.content.label.trim().length === 0))
        .map(c => c.componentType);
      return offenders.length === 0
        ? { passed: true }
        : { passed: false, message: 'subjects without label: ' + offenders.join(', ') };
    }
  }
];

// Run every property against an output. Returns { passes, failures } where
// failures is a list of { id, message } and the aggregate score adjustment.
function evaluateProperties(output) {
  const failures = [];
  let scoreAdjustment = 0;
  PROPERTIES.forEach(prop => {
    let result;
    try { result = prop.check(output); }
    catch (e) { result = { passed: true /* don't penalize on engine bug */ }; }
    if (!result || !result.passed) {
      failures.push({ id: prop.id, message: result && result.message || prop.description });
      scoreAdjustment += prop.weight;  // negative
    }
  });
  return {
    passes:    PROPERTIES.length - failures.length,
    failures,
    scoreAdjustment
  };
}

// ---------------------------------------------------------------------------
//  SCORING
//  Composite score per scenario. Negative = bad, positive = good. Aggregated
//  across the suite into a single number we compare cycle-over-cycle.
// ---------------------------------------------------------------------------
function scoreScenarioOutput(scenario, output, weights) {
  const W = weights || {};
  const plan = output && output.plan;
  const layout = output && output.layoutPlan;
  const violations = (output && output.validation && output.validation.violations) || [];
  const breakdown = {
    violation_high:   0,
    violation_medium: 0,
    violation_low:    0,
    richness:         0,
    expected_components_hit:  0,
    expected_components_miss: 0,
    expected_surface:         0,
    expected_features_hit:    0,
    expected_features_miss:   0,
    no_silent_drops:          0,
    total: 0
  };

  // 1) Violations
  violations.forEach(v => {
    if (v.severity === 'high')   breakdown.violation_high   += (W.violation_high   || -10);
    else if (v.severity === 'medium') breakdown.violation_medium += (W.violation_medium || -3);
    else                              breakdown.violation_low    += (W.violation_low    || -1);
  });

  // 2) Richness — number of distinct visible cards in the layout
  const layoutChildren = layout && Array.isArray(layout.groups)
    ? layout.groups.flatMap(g => (g.children || []).filter(c => c.visibility !== 'hidden' && c.visibility !== 'collapsed'))
    : [];
  const distinctIds = new Set(layoutChildren.map(c => c.componentId).filter(Boolean));
  const richnessRaw = distinctIds.size * (W.richness_per_card || 4);
  breakdown.richness = Math.min(richnessRaw, W.richness_cap || 32);

  // 3) Expected components — present or absent
  const planTypes = new Set((plan && plan.requiredComponents || []).map(c => c.componentType));
  (scenario.expectedComponents || []).forEach(id => {
    if (planTypes.has(id)) breakdown.expected_components_hit  += (W.expected_component_present || 6);
    else                   breakdown.expected_components_miss += (W.expected_component_missing || -4);
  });

  // 4) Surface match
  const actualSurface = output && output.uiState && output.uiState.baseSurface;
  if (scenario.expectedSurface) {
    if (actualSurface === scenario.expectedSurface) {
      breakdown.expected_surface = (W.expected_surface_match || 8);
    } else {
      breakdown.expected_surface = (W.expected_surface_mismatch || -8);
    }
  }

  // 5) Expected features
  (scenario.expectedFeatures || []).forEach(f => {
    const detector = FEATURE_DETECTORS[f];
    if (!detector) return;  // unknown feature — skip silently
    if (detector(plan, layout)) breakdown.expected_features_hit  += (W.expected_component_present || 6);
    else                        breakdown.expected_features_miss += (W.expected_component_missing || -4);
  });

  // 6) No silent drops — every plan component appears in layout
  const layoutIds = new Set(layoutChildren.map(c => c.componentId));
  const dropped = (plan && plan.requiredComponents || [])
    .filter(c => c.componentType && !layoutIds.has(c.componentType));
  if (dropped.length === 0) {
    breakdown.no_silent_drops = (W.no_silent_drops || 3);
  } else {
    breakdown.no_silent_drops = -dropped.length * 2;
  }

  // 7) Universal property assertions — applied regardless of the scenario.
  // These catch regressions on structural invariants the scenario-specific
  // checks would miss. Failures contribute negative weight to the total.
  const propertyResult = evaluateProperties(output);
  breakdown.property_assertions = propertyResult.scoreAdjustment;
  breakdown._propertyFailures = propertyResult.failures;
  breakdown._propertyPasses   = propertyResult.passes;

  // Total
  breakdown.total = Object.keys(breakdown)
    .filter(k => k !== 'total' && !k.startsWith('_'))
    .reduce((s, k) => s + breakdown[k], 0);

  // Apply scenario weight (default 1)
  const w = scenario.weight || 1;
  return {
    score:     breakdown.total * w,
    raw:       breakdown.total,
    weight:    w,
    breakdown,
    droppedComponents: dropped.map(c => c.componentType),
    visibleCount: distinctIds.size,
    actualSurface
  };
}

// ---------------------------------------------------------------------------
//  TEST SUITE RUNNER
//  Caller provides a runner that, given { scenarioText }, returns the same
//  shape as POST /api/pipeline/full (interpretation, plan, layoutPlan,
//  validation, uiState). This isolates the engine from server.js wiring —
//  callers can pass in a real or stubbed runner.
// ---------------------------------------------------------------------------
async function runTestSuite({ runner, scenarios, weights, onProgress }) {
  const suite = scenarios || (TEST_SUITE && TEST_SUITE.scenarios) || [];
  const w = weights || (TEST_SUITE && TEST_SUITE._scoring && TEST_SUITE._scoring.weights) || {};
  if (typeof runner !== 'function') throw new Error('runTestSuite requires runner({scenarioText}) function');

  const runs = [];
  let cumulativeScore = 0;
  let totalWeight = 0;
  // Held-out validation tracking. Scenarios with `holdout: true` are run
  // exactly like training scenarios but their scores are aggregated
  // separately so the trialRule can verify rules generalize beyond what
  // the extraction LLM saw.
  let trainingScore   = 0;
  let validationScore = 0;
  let trainingCount   = 0;
  let validationCount = 0;

  for (let i = 0; i < suite.length; i++) {
    const scenario = suite[i];
    if (typeof onProgress === 'function') onProgress({ idx: i, total: suite.length, scenario });
    const t0 = Date.now();
    let output, error;
    try {
      output = await runner({ scenarioText: scenario.scenarioText });
    } catch (e) {
      error = e.message || String(e);
    }
    const elapsed = Date.now() - t0;
    let scored = null;
    if (output) scored = scoreScenarioOutput(scenario, output, w);
    if (scored) {
      cumulativeScore += scored.score;
      totalWeight     += scored.weight;
      if (scenario.holdout) {
        validationScore += scored.score;
        validationCount += 1;
      } else {
        trainingScore += scored.score;
        trainingCount += 1;
      }
    }
    runs.push({
      scenarioId: scenario.id,
      scenarioText: scenario.scenarioText,
      holdout: !!scenario.holdout,
      elapsedMs: elapsed,
      error: error || null,
      score: scored ? scored.score : null,
      breakdown: scored ? scored.breakdown : null,
      droppedComponents: scored ? scored.droppedComponents : [],
      visibleCount: scored ? scored.visibleCount : 0,
      actualSurface: scored ? scored.actualSurface : null,
      violations: output && output.validation && output.validation.violations
        ? output.validation.violations.map(v => ({
            ruleId: v.ruleId,
            severity: v.severity,
            element: v.element,
            message: (v.message || '').slice(0, 140)
          }))
        : []
    });
  }

  const summary = {
    totalScenarios: suite.length,
    completed:      runs.filter(r => r.score !== null).length,
    failed:         runs.filter(r => r.error).length,
    cumulativeScore,
    weightedAvgScore: totalWeight > 0 ? Math.round(cumulativeScore / totalWeight * 100) / 100 : 0,
    // Training / validation split — populated when scenarios carry the
    // `holdout: true` flag. Used by trialRule to verify rules generalize.
    trainingScore,
    trainingCount,
    validationScore,
    validationCount,
    elapsedMsTotal: runs.reduce((s, r) => s + r.elapsedMs, 0),
    violationCounts: _aggregateViolations(runs),
    droppedTotal:    runs.reduce((s, r) => s + (r.droppedComponents || []).length, 0),
    builtAt:         new Date().toISOString()
  };

  return { runs, summary };
}

// runTestSuiteWithVariations — same shape as runTestSuite but each
// scenario is run with its synthetic variations and the score is the
// aggregate (avg). Used by /api/improve/cycle when useVariations is true.
// Cost: ~3x runTestSuite if variationCount=2 (one main + two variants).
async function runTestSuiteWithVariations({ runner, llmCall, scenarios, weights, variationCount, onProgress }) {
  const suite = scenarios || (TEST_SUITE && TEST_SUITE.scenarios) || [];
  const w = weights || (TEST_SUITE && TEST_SUITE._scoring && TEST_SUITE._scoring.weights) || {};
  if (typeof runner !== 'function') throw new Error('requires runner({scenarioText})');

  const runs = [];
  let cumulativeScore = 0;
  let trainingScore   = 0;
  let validationScore = 0;
  let trainingCount   = 0;
  let validationCount = 0;
  for (let i = 0; i < suite.length; i++) {
    const sc = suite[i];
    if (typeof onProgress === 'function') onProgress({ idx: i, total: suite.length, scenario: sc });
    const t0 = Date.now();
    let result, error;
    try {
      result = await runScenarioWithVariations({ scenario: sc, runner, llmCall, weights: w, variationCount });
    } catch (e) { error = e.message || String(e); }
    const elapsed = Date.now() - t0;
    const aggScore = result ? result.aggregate.avg * (sc.weight || 1) : null;
    if (aggScore != null) {
      cumulativeScore += aggScore;
      if (sc.holdout) { validationScore += aggScore; validationCount += 1; }
      else            { trainingScore   += aggScore; trainingCount   += 1; }
    }
    runs.push({
      scenarioId:  sc.id,
      scenarioText: sc.scenarioText,
      holdout:     !!sc.holdout,
      elapsedMs:   elapsed,
      error:       error || null,
      score:       aggScore,
      mainScore:   result && result.main ? result.main.score : null,
      variationScores: result ? result.variations.map(v => ({ text: v.text, score: v.score, error: v.error || null })) : [],
      aggregate:   result ? result.aggregate : null
    });
  }
  return {
    runs,
    summary: {
      mode:           'variations',
      totalScenarios: suite.length,
      cumulativeScore,
      trainingScore, trainingCount,
      validationScore, validationCount,
      builtAt:        new Date().toISOString()
    }
  };
}

// Filter the test suite to training-only scenarios. The pattern-extraction
// LLM only sees these — the held-out scenarios remain blind so we can
// independently verify the proposed rules generalize.
function getTrainingScenarios() {
  const all = (TEST_SUITE && TEST_SUITE.scenarios) || [];
  return all.filter(s => !s.holdout);
}
function getHoldoutScenarios() {
  const all = (TEST_SUITE && TEST_SUITE.scenarios) || [];
  return all.filter(s => !!s.holdout);
}

function _aggregateViolations(runs) {
  const byRule = {};
  runs.forEach(r => (r.violations || []).forEach(v => {
    byRule[v.ruleId] = (byRule[v.ruleId] || 0) + 1;
  }));
  const sorted = Object.entries(byRule)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ruleId, count]) => ({ ruleId, count }));
  return { topRules: sorted, totalEvents: Object.values(byRule).reduce((s, n) => s + n, 0) };
}

// ---------------------------------------------------------------------------
//  HISTORY PERSISTENCE
//  Each cycle dumps a JSON file so we can compare runs and visualize trend.
// ---------------------------------------------------------------------------
function saveCycleReport(report) {
  try {
    if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
    const fname = (report && report.summary && report.summary.builtAt
      ? report.summary.builtAt.replace(/[:.]/g, '-')
      : 'run-' + Date.now()) + '.json';
    fs.writeFileSync(path.join(HISTORY_DIR, fname), JSON.stringify(report, null, 2));
    return fname;
  } catch (e) {
    console.warn('[improve] saveCycleReport failed:', e.message);
    return null;
  }
}

function listCycleReports() {
  try {
    if (!fs.existsSync(HISTORY_DIR)) return [];
    return fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json')).sort().reverse();
  } catch { return []; }
}

// ---------------------------------------------------------------------------
//  SYNTHETIC SCENARIO VARIATIONS
//  For each scenario, optionally generate N rephrased variations the system
//  hasn't been "trained on". Trials score the rule on the original AND its
//  variations — a rule that helps only the original (but not its rephrasings)
//  is overfitting. Cached on disk so we don't re-burn LLM tokens every cycle.
// ---------------------------------------------------------------------------
const VARIATIONS_DIR = path.join(__dirname, 'data', 'variations');

function _variationsCachePath(scenarioId) {
  return path.join(VARIATIONS_DIR, scenarioId + '.json');
}

function loadCachedVariations(scenarioId) {
  try {
    const p = _variationsCachePath(scenarioId);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return null; }
}

function saveCachedVariations(scenarioId, data) {
  try {
    if (!fs.existsSync(VARIATIONS_DIR)) fs.mkdirSync(VARIATIONS_DIR, { recursive: true });
    fs.writeFileSync(_variationsCachePath(scenarioId), JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.warn('[improve] saveCachedVariations failed:', e.message);
    return false;
  }
}

// Generate N variations of a scenario via LLM. Returns the variation
// strings (the structural fields stay the same — same expectedSurface,
// expectedComponents, etc — only the prompt text varies). Caches by
// scenario.id so re-runs are free.
async function generateScenarioVariations({ scenario, llmCall, count, force }) {
  if (!scenario || !llmCall) throw new Error('generateScenarioVariations requires scenario + llmCall');
  const N = count || 3;
  const cached = !force ? loadCachedVariations(scenario.id) : null;
  if (cached && Array.isArray(cached.variations) && cached.variations.length >= N) {
    return { variations: cached.variations.slice(0, N), cached: true };
  }
  const sys = 'You produce paraphrased prompt variations for testing a generative UI pipeline. Return strict JSON only.';
  const user = `Original scenario:
"${scenario.scenarioText}"

Surface: ${scenario.expectedSurface}
Tag: ${scenario.tag || '(none)'}
Expected features: ${(scenario.expectedFeatures || []).join(', ')}

Generate ${N} REPHRASED variations of this scenario. Each variation must:
- preserve the SAME intent (a UI pipeline should produce the same surface and roughly the same component types)
- vary the SURFACE WORDING significantly (different words, different sentence shape)
- include realistic detail / context (a user wouldn't type "morning briefing on lock screen" — they'd say "show me my morning rundown" or similar)
- be 4–14 words long
- NOT mention the scenario ID, the tag, or any test-suite labels

Output strict JSON:
{ "variations": ["string", "string", ...] }`;
  const raw = await llmCall(sys, user);
  const variations = (raw && Array.isArray(raw.variations))
    ? raw.variations.filter(s => typeof s === 'string' && s.length > 5 && s.length < 200).slice(0, N)
    : [];
  // Cache (even partial — better than nothing)
  saveCachedVariations(scenario.id, { id: scenario.id, builtAt: new Date().toISOString(), variations });
  return { variations, cached: false };
}

// Wrap a runner so it scores against the original scenario + variations,
// returning aggregated breakdown. Used by trialRule when "useVariations"
// is enabled. Each variation costs ~30s extra per scenario.
async function runScenarioWithVariations({ scenario, runner, llmCall, weights, variationCount }) {
  const N = variationCount != null ? variationCount : 2;
  const main = await runner({ scenarioText: scenario.scenarioText });
  const mainScored = scoreScenarioOutput(scenario, main, weights);

  let varScores = [];
  if (N > 0 && llmCall) {
    let variations = [];
    try {
      const v = await generateScenarioVariations({ scenario, llmCall, count: N });
      variations = v.variations;
    } catch (e) {
      console.warn('[improve] variation gen failed for ' + scenario.id + ':', e.message);
    }
    for (const text of variations) {
      try {
        const out = await runner({ scenarioText: text });
        const scored = scoreScenarioOutput(scenario, out, weights);
        varScores.push({ text, score: scored.score, breakdown: scored.breakdown });
      } catch (e) {
        varScores.push({ text, score: null, error: e.message });
      }
    }
  }
  // Aggregate: average of (main + variations). We use min instead if one
  // variation tanks — that catches "rule helps original but breaks variants"
  // — but for now use mean to keep signal smooth.
  const allScores = [mainScored.score].concat(varScores.filter(v => v.score != null).map(v => v.score));
  const avg = allScores.length > 0 ? allScores.reduce((s, n) => s + n, 0) / allScores.length : 0;
  const min = allScores.length > 0 ? Math.min.apply(null, allScores) : 0;
  return {
    main: mainScored,
    variations: varScores,
    aggregate: { avg: Math.round(avg * 100) / 100, min, count: allScores.length }
  };
}

// ---------------------------------------------------------------------------
//  PHASE B — PATTERN EXTRACTION
//  Takes a test-suite report and asks an LLM to identify recurring failure
//  patterns and propose rules. The proposed rules use a closed schema (see
//  RULE_TYPES below) so we can mechanically apply / revert them in Phase C
//  without parsing free-form prose.
// ---------------------------------------------------------------------------

// Rule schema: closed set the LLM must pick from. Anything outside this
// closed schema is auto-rejected before the trial step.
const RULE_TYPES = {
  context_injection: {
    description: 'Add a context-tag → component mapping so selector picks it automatically.',
    payloadShape: {
      tag:           'string (lowercase context-tag, e.g. "morning")',
      componentIds:  'string[] (registry IDs to inject when tag matches)'
    },
    safety: 'safe — additive, no prompt edit'
  },
  evolve_constraint: {
    description: 'Append a learned constraint to evolve.md so all stages can read it.',
    payloadShape: {
      type:        'string (touch-target | sizing | interaction | radius | content | composition)',
      constraint:  'string (one-line rule, ≤ 140 chars)'
    },
    safety: 'safe — appends to KB, all stages pick it up via buildPromptContext'
  },
  composer_hint: {
    description: 'Append guidance to composer prompt — REQUIRES HUMAN APPROVAL before applying.',
    payloadShape: {
      hint: 'string (≤ 200 chars, must reduce a specific violation)'
    },
    safety: 'risky — alters prompt; trial under sandbox only'
  },
  selector_hint: {
    description: 'Append guidance to selector prompt — REQUIRES HUMAN APPROVAL.',
    payloadShape: {
      hint: 'string (≤ 200 chars)'
    },
    safety: 'risky — alters prompt; trial under sandbox only'
  }
};

function getRuleSchemaSummary() {
  return Object.entries(RULE_TYPES).map(([type, def]) => ({
    type,
    description: def.description,
    payloadShape: def.payloadShape,
    safety: def.safety
  }));
}

// Build the prompt the extraction LLM receives. We compress the test-suite
// report into a small, structured digest so the LLM doesn't waste tokens
// reading raw violations / breakdowns.
function buildExtractionPrompt(report) {
  const summary = (report && report.summary) || {};
  // Filter out holdout scenarios — extraction LLM never sees these so any
  // rule it proposes must generalize to unseen shapes.
  const runs = ((report && report.runs) || []).filter(r => !r.holdout);

  // Compact per-scenario digest: id, score, top 3 violations, dropped IDs,
  // surface match, missing expected components.
  const digest = runs.map(r => ({
    id:       r.scenarioId,
    score:    r.score,
    surface:  r.actualSurface,
    visible:  r.visibleCount,
    dropped:  r.droppedComponents || [],
    violations: (r.violations || []).slice(0, 3).map(v => ({
      ruleId: v.ruleId, severity: v.severity, message: (v.message || '').slice(0, 100)
    }))
  }));

  return `You are a SYSTEM-IMPROVEMENT ANALYZER for a generative UI pipeline.

Your input is a TEST SUITE REPORT — N scenarios were run through the pipeline,
each was scored and validated. Your job is to identify recurring patterns
across runs and propose rules that, if applied to the system, would reduce
violations and increase scores in future runs.

You MUST propose rules using ONLY these closed types:

${JSON.stringify(getRuleSchemaSummary(), null, 2)}

CONSTRAINTS
- Propose 2–6 rules per cycle. Quality > quantity. Skip if you have nothing.
- Each rule must have: { type, reason, confidence (0–1), payload }.
- "reason" must cite specific evidence: scenario IDs, violation ruleIds, or dropped component IDs.
- Prefer "context_injection" and "evolve_constraint" (safer); use "composer_hint" / "selector_hint" only when the pattern can't be fixed any other way.
- "confidence" reflects how sure you are the rule will improve scores. Be honest — 0.5 is fine.
- Do NOT propose rules duplicating existing behavior (e.g. don't re-add "morning → calendar_summary_card" — that already exists).

GENERALIZATION RULES (critical — these prevent overfit to the test suite):
- Rules MUST target PATTERNS, not specific scenario IDs. The system must work
  on unseen scenarios with similar shape, not just on the 20 test scenarios.
- For "context_injection": the "tag" payload MUST be a generic context-tag
  (e.g. "morning", "driving", "messages") — NOT a scenario-specific marker.
  Tags are values the interpreter naturally produces, not test labels.
- For "evolve_constraint": phrase the constraint as a UNIVERSAL principle
  (e.g. "Lock surfaces with multiple cards must use vertical-stack with
  full-width children"), NOT a scenario-specific instruction (e.g. "for
  morning-briefing scenario, do X"). The constraint will be read by the LLM
  on every future call — keep it abstract enough to apply broadly.
- For "composer_hint" / "selector_hint": the hint must read as a general
  composition principle, not a scenario fix.
- A rule that mentions specific scenario IDs in its payload is rejected.
- Bias your confidence DOWN (×0.7) for rules that only cite 1 scenario as
  evidence; bias UP for rules where 3+ scenarios show the same failure.

TEST SUITE SUMMARY
${JSON.stringify(summary, null, 2)}

PER-SCENARIO DIGEST
${JSON.stringify(digest, null, 2)}

OUTPUT — strict JSON (no commentary):
{
  "analysis": "1-2 sentence summary of biggest patterns observed",
  "proposedRules": [
    {
      "type": "context_injection | evolve_constraint | composer_hint | selector_hint",
      "reason": "string citing evidence",
      "confidence": 0.0,
      "payload": { ...shape per type... }
    }
  ]
}`;
}

// Run extraction. llmCall must accept (systemPrompt, userMessage) and return
// a parsed JSON object (matching the existing pipeline.js pattern).
async function runPatternExtraction({ report, llmCall }) {
  if (!llmCall) throw new Error('runPatternExtraction requires llmCall');
  if (!report)  throw new Error('runPatternExtraction requires report');
  const sys  = 'You are a system-improvement analyzer that returns strict JSON only.';
  const user = buildExtractionPrompt(report);
  const raw  = await llmCall(sys, user);
  // Validate shape — strip rules that don't conform.
  const out = (raw && typeof raw === 'object') ? raw : {};
  const proposed = Array.isArray(out.proposedRules) ? out.proposedRules : [];
  const validated = proposed.filter(r => _validateProposedRule(r));
  return {
    analysis:        out.analysis || '',
    proposedRules:   validated,
    rejectedCount:   proposed.length - validated.length,
    extractedAt:     new Date().toISOString()
  };
}

function _validateProposedRule(r) {
  if (!r || typeof r !== 'object') return false;
  if (!r.type || !RULE_TYPES[r.type]) return false;
  if (!r.payload || typeof r.payload !== 'object') return false;
  // Type-specific shape checks
  if (r.type === 'context_injection') {
    if (typeof r.payload.tag !== 'string') return false;
    if (!Array.isArray(r.payload.componentIds) || r.payload.componentIds.length === 0) return false;
  }
  if (r.type === 'evolve_constraint') {
    if (typeof r.payload.type !== 'string') return false;
    if (typeof r.payload.constraint !== 'string' || r.payload.constraint.length > 200) return false;
  }
  if (r.type === 'composer_hint' || r.type === 'selector_hint') {
    if (typeof r.payload.hint !== 'string' || r.payload.hint.length > 240) return false;
  }
  // GENERALIZATION GUARD: reject any rule whose payload mentions a
  // test-scenario ID. Such rules are by definition overfit and won't
  // generalize. Test-scenario IDs are kebab-case slugs unique to this
  // suite (morning-briefing-lock, low-battery-alert, etc.). The
  // extraction prompt is explicitly told not to do this; this guard is
  // the safety net.
  const suite = (TEST_SUITE && TEST_SUITE.scenarios) || [];
  const scenarioIdSet = new Set(suite.map(s => s.id));
  const flat = JSON.stringify(r.payload).toLowerCase();
  for (const id of scenarioIdSet) {
    if (flat.indexOf(id.toLowerCase()) >= 0) {
      console.warn('[improve] rejected rule (mentions scenario ID): ' + id);
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
//  PHASE C — LEARNED RULES PERSISTENCE + APPLY/REVERT/TRIAL
//  - learned_rules.json holds every rule that has passed trial (active)
//    plus a recent-rejected log for transparency.
//  - applyRule() calls into pipeline.js's runtime hooks (addLearnedRule).
//  - revertRule() removes the rule from runtime AND from the persisted file.
//  - trialRule() runs the test suite with the rule applied, compares to a
//    baseline run, and decides accept/reject based on the score delta.
// ---------------------------------------------------------------------------
function loadLearnedRules() {
  try {
    if (!fs.existsSync(LEARNED_RULES_PATH)) return { rules: [], rejected: [], _version: 1 };
    const data = JSON.parse(fs.readFileSync(LEARNED_RULES_PATH, 'utf8'));
    if (!Array.isArray(data.rules))    data.rules = [];
    if (!Array.isArray(data.rejected)) data.rejected = [];
    return data;
  } catch (e) {
    console.warn('[improve] learned_rules load failed:', e.message);
    return { rules: [], rejected: [], _version: 1 };
  }
}

function saveLearnedRules(state) {
  try {
    fs.writeFileSync(LEARNED_RULES_PATH, JSON.stringify(state, null, 2));
    return true;
  } catch (e) {
    console.warn('[improve] learned_rules save failed:', e.message);
    return false;
  }
}

// Generate a stable rule ID from cycle timestamp + index
function _makeRuleId(prefix) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return (prefix || 'rule') + '_' + ts + '_' + Math.random().toString(36).slice(2, 8);
}

// Apply a proposed rule to the running pipeline. Returns { applied, reason }.
// Does NOT persist to disk — caller decides after trial.
function applyRule(rule, pipelineModule) {
  if (!pipelineModule || typeof pipelineModule.addLearnedRule !== 'function') {
    return { applied: false, reason: 'pipeline.addLearnedRule unavailable' };
  }
  // Ensure rule has an id
  if (!rule.id) rule.id = _makeRuleId(rule.type);
  const ok = pipelineModule.addLearnedRule(rule);
  return { applied: ok, reason: ok ? 'applied' : 'rule type not auto-applicable (may require human approval)', id: rule.id };
}

function revertRule(ruleId, pipelineModule) {
  if (!pipelineModule || typeof pipelineModule.removeLearnedRule !== 'function') {
    return { reverted: false, reason: 'pipeline.removeLearnedRule unavailable' };
  }
  const ok = pipelineModule.removeLearnedRule(ruleId);
  return { reverted: ok, reason: ok ? 'reverted' : 'rule not found in runtime' };
}

// Trial a single rule. Strategy:
//   1. Run baseline test suite (or use cached baseline scores if provided)
//   2. Apply rule
//   3. Re-run test suite
//   4. Compare cumulativeScore — accept if delta >= threshold, else revert
//   5. Return verdict + scores
//
// Caller passes runner (test suite runner closure) and pipelineModule.
async function trialRule({ rule, runner, baseline, pipelineModule, thresholdPct, onProgress, useVariations, llmCall, variationCount }) {
  if (!rule || !runner || !pipelineModule) throw new Error('trialRule requires rule + runner + pipelineModule');
  const suite = (TEST_SUITE && TEST_SUITE.scenarios) || [];
  const weights = (TEST_SUITE && TEST_SUITE._scoring && TEST_SUITE._scoring.weights) || {};
  const threshold = thresholdPct != null ? thresholdPct : ((TEST_SUITE && TEST_SUITE._scoring && TEST_SUITE._scoring.thresholds && TEST_SUITE._scoring.thresholds.improvement_required_pct) || 5);

  // Pick the runner to use based on whether variations are requested.
  // useVariations requires llmCall (for variation generation); we silently
  // fall back to the plain runner if llmCall is missing.
  const suiteRunner = (useVariations && llmCall)
    ? (opts) => runTestSuiteWithVariations({ ...opts, llmCall, variationCount })
    : runTestSuite;

  // 1) Baseline (or use provided)
  let baselineSummary = baseline && baseline.summary ? baseline.summary : null;
  if (!baselineSummary) {
    if (typeof onProgress === 'function') onProgress({ stage: 'baseline', rule: rule.id });
    const baseRun = await suiteRunner({ runner, scenarios: suite, weights, onProgress: p => onProgress && onProgress({ stage: 'baseline', ...p }) });
    baselineSummary = baseRun.summary;
    baseline = baseRun;
  }
  const baseTraining   = baselineSummary.trainingScore   != null ? baselineSummary.trainingScore   : baselineSummary.cumulativeScore;
  const baseValidation = baselineSummary.validationScore != null ? baselineSummary.validationScore : 0;
  const hasHoldout     = baselineSummary.validationCount > 0;

  // 2) Apply
  const applyRes = applyRule(rule, pipelineModule);
  if (!applyRes.applied) {
    return { rule, applied: false, accepted: false, reason: applyRes.reason, baseline: baselineSummary.cumulativeScore };
  }

  // 3) Trial
  if (typeof onProgress === 'function') onProgress({ stage: 'trial', rule: rule.id });
  let trialRun;
  try {
    trialRun = await suiteRunner({ runner, scenarios: suite, weights, onProgress: p => onProgress && onProgress({ stage: 'trial', ...p }) });
  } catch (e) {
    revertRule(rule.id, pipelineModule);
    return { rule, applied: true, accepted: false, reason: 'trial failed: ' + e.message, baseline: baselineSummary.cumulativeScore };
  }
  const trialScore      = trialRun.summary.cumulativeScore;
  const trialTraining   = trialRun.summary.trainingScore   != null ? trialRun.summary.trainingScore   : trialScore;
  const trialValidation = trialRun.summary.validationScore != null ? trialRun.summary.validationScore : 0;

  const delta              = trialScore - baselineSummary.cumulativeScore;
  const deltaPct           = baselineSummary.cumulativeScore !== 0
    ? (delta / Math.abs(baselineSummary.cumulativeScore)) * 100 : 0;
  const trainingDelta      = trialTraining - baseTraining;
  const trainingDeltaPct   = baseTraining !== 0
    ? (trainingDelta / Math.abs(baseTraining)) * 100 : 0;
  const validationDelta    = trialValidation - baseValidation;
  const validationDeltaPct = baseValidation !== 0
    ? (validationDelta / Math.abs(baseValidation)) * 100 : 0;

  // GENERALIZATION GATE:
  //   - training must improve by ≥ threshold
  //   - validation must NOT regress more than the regression alert pct
  //     (default -3%). Validation can stay flat (0%) — that's fine; we're
  //     guarding against rules that overfit to training and break holdout.
  const regressionAlert = (TEST_SUITE && TEST_SUITE._scoring && TEST_SUITE._scoring.thresholds && TEST_SUITE._scoring.thresholds.regression_alert_pct) || -3;
  const trainingOk      = trainingDeltaPct >= threshold;
  const validationOk    = !hasHoldout || validationDeltaPct >= regressionAlert;
  const passed          = trainingOk && validationOk;

  let verdict = '';
  if (passed) verdict = 'training +' + trainingDeltaPct.toFixed(2) + '%, validation ' + (validationDeltaPct >= 0 ? '+' : '') + validationDeltaPct.toFixed(2) + '% — accepted';
  else if (!trainingOk) verdict = 'training delta ' + trainingDeltaPct.toFixed(2) + '% < ' + threshold + '% threshold';
  else if (!validationOk) verdict = 'OVERFIT: training +' + trainingDeltaPct.toFixed(2) + '% but validation regressed ' + validationDeltaPct.toFixed(2) + '% (alert at ' + regressionAlert + '%)';

  // 4) Accept / Revert
  if (!passed) {
    revertRule(rule.id, pipelineModule);
  }

  return {
    rule,
    applied: true,
    accepted: passed,
    reason: verdict,
    baseline: baselineSummary.cumulativeScore,
    trial:    trialScore,
    delta,
    deltaPct: Math.round(deltaPct * 100) / 100,
    trainingDelta,
    trainingDeltaPct: Math.round(trainingDeltaPct * 100) / 100,
    validationDelta,
    validationDeltaPct: Math.round(validationDeltaPct * 100) / 100,
    threshold,
    hasHoldout,
    trialReport: trialRun
  };
}

// Persist accepted rules. Merges with existing learned_rules.json. The
// pipeline's runtime state already has the rule applied (via applyRule), so
// this just records it for survival across server restarts.
function persistAcceptedRules(rules) {
  const state = loadLearnedRules();
  const now = new Date().toISOString();
  rules.forEach(r => {
    state.rules.push({
      id:         r.rule.id,
      type:       r.rule.type,
      payload:    r.rule.payload,
      reason:     r.rule.reason,
      confidence: r.rule.confidence,
      status:     'active',
      addedAt:    now,
      trial: {
        baselineScore: r.baseline,
        trialScore:    r.trial,
        delta:         r.delta,
        deltaPct:      r.deltaPct
      }
    });
  });
  saveLearnedRules(state);
  return state;
}

// Persist rejected rules to the rejected log (transparency / debugging).
function persistRejectedRules(rules) {
  const state = loadLearnedRules();
  const now = new Date().toISOString();
  rules.forEach(r => {
    state.rejected.push({
      type:       r.rule.type,
      payload:    r.rule.payload,
      reason:     r.rule.reason,
      verdict:    r.reason,
      confidence: r.rule.confidence,
      rejectedAt: now,
      trial: {
        baselineScore: r.baseline,
        trialScore:    r.trial,
        delta:         r.delta,
        deltaPct:      r.deltaPct
      }
    });
  });
  // Cap rejected log to last 50 to avoid unbounded growth.
  if (state.rejected.length > 50) state.rejected = state.rejected.slice(-50);
  saveLearnedRules(state);
  return state;
}

// Re-apply persisted rules to a freshly-restarted pipeline runtime.
function rehydrateLearnedRules(pipelineModule) {
  if (!pipelineModule || typeof pipelineModule.addLearnedRule !== 'function') return 0;
  const state = loadLearnedRules();
  let applied = 0;
  (state.rules || []).filter(r => r.status === 'active').forEach(r => {
    if (pipelineModule.addLearnedRule(r)) applied += 1;
  });
  return applied;
}

module.exports = {
  // Phase A
  runTestSuite,
  runTestSuiteWithVariations,
  scoreScenarioOutput,
  saveCycleReport,
  listCycleReports,
  getTestSuite: () => TEST_SUITE,
  getTrainingScenarios,
  getHoldoutScenarios,
  // Synthetic variations
  generateScenarioVariations,
  loadCachedVariations,
  // Property-based assertions (Phase 3 generalization)
  evaluateProperties,
  PROPERTIES,
  // Phase B
  runPatternExtraction,
  buildExtractionPrompt,
  getRuleSchemaSummary,
  RULE_TYPES,
  // Phase C
  loadLearnedRules,
  saveLearnedRules,
  applyRule,
  revertRule,
  trialRule,
  persistAcceptedRules,
  persistRejectedRules,
  rehydrateLearnedRules,
  // Constants
  FEATURE_DETECTORS,
  SCENARIOS_PATH,
  LEARNED_RULES_PATH
};
