// ============================================================================
//  GENUI PIPELINE v1 (3-step variant) — interpreter → normalizer → planner
//  ---------------------------------------------------------------------------
//  Each step is an INDEPENDENT LLM call. Output JSON of step N is passed
//  verbatim to step N+1. No step invents UI markup.
//
//    STEP 1  scenario_interpreter  scenario_text → {intent, context, tasks,
//                                                   constraints, ui_state}
//    STEP 2  handoff_normalizer    STEP_1 → {planning_summary, task_groups,
//                                            slot_requirements,
//                                            selection_constraints, ui_state}
//    STEP 3  component_selector    STEP_2 → {required_components[],
//                                            planner_notes}
//
//  Plus step_7 explanation_layer (invoked separately).
// ============================================================================

const fs = require('fs');
const path = require('path');
const {
  normalizeInterpreterOutput,
  normalizeNormalizerOutput,
  normalizeSelectorOutput,
  normalizeComposerOutput
} = require('./schema_normalizer');
const {
  validateContextComponentMatch,
  validateLayoutOverflow,
  buildViolation:  buildLayoutViolation,
  flattenGroups:   _flattenGroups
} = require('./layout_composer');
const Generator = require('./generator');
const DesignMemory = require('./design_memory');

const REGISTRY_PATH = path.join(__dirname, 'figma-refs', 'component_registry.json');
let REGISTRY = null;
try { REGISTRY = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
catch (e) { console.warn('[pipeline] component_registry.json not found or invalid:', e.message); }

// Registry ids that are true chrome — shared by Step 3 role correction + preset stitch layout.
const PIPELINE_CHROME_ROLE_IDS = new Set([
  'status-bar', 'status-bar.default', 'status-bar.live-activity-chip',
  'container.header', 'container.status-bar-app',
  'container.app-shell-dark', 'container.app-shell-light',
  'container.content-area',
  'container.nav-buttons-light', 'container.nav-gestures-dark',
  'lock-screen.clock', 'lock-screen.weather-date', 'lock-screen.shortcut-circle',
  'gesture-bar', 'appbar', 'bottomnav', 'pill-tab', 'tab-bar',
  'keyboard'
]);

// ---------------------------------------------------------------------------
//  COMPONENT EMBEDDINGS  (Stage 3 RAG shortlist)
//  Pre-computed by scripts/build_component_embeddings.js. At runtime we
//  embed the user scenario, take cosine top-K, and feed only that shortlist
//  to the planner LLM. This lets the vocabulary cover all 92 registry
//  entries without ballooning the prompt.
//
//  DEFAULT OFF (speed-first): RAG adds ~400ms per pipeline call for the
//  embedding fetch. Since latency is non-negotiable, the runtime shortlist
//  is OPT-IN. Set `PIPELINE_RAG=on` in .env to enable. With RAG off, the
//  selector reverts to the legacy 10-item curated vocabulary AND the
//  validator reverts to checking against the 10-item set — fully
//  pre-RAG behavior.
// ---------------------------------------------------------------------------
const RAG_ENABLED = (process.env.PIPELINE_RAG || 'off').toLowerCase() === 'on';

// ---------------------------------------------------------------------------
//  CONTEXT-AWARE INJECTION RULES
//  Maps a context tag (or a regex on tags) to component IDs the runSelect
//  stage will programmatically inject when:
//    (a) the tag appears in uiState.contextTags, AND
//    (b) the component isn't already in the plan, AND
//    (c) the component is in the allowed semantic vocabulary.
//  This addresses the "selector picks too narrowly" failure mode where the
//  LLM identifies relevant tasks (e.g. "scan-upcoming-day-context") but
//  doesn't translate them into rich content cards. Injection is silent and
//  deterministic — no prompt strings, no LLM dependency, no leakage risk.
// ---------------------------------------------------------------------------
const CONTEXT_INJECTION_RULES = {
  // Time-of-day / ambient
  'morning':       ['calendar_summary_card', 'reminder_card'],
  'briefing':      ['calendar_summary_card', 'reminder_card', 'message_summary_card'],
  'evening':       ['reminder_card'],
  'agenda':        ['calendar_summary_card'],
  'schedule':      ['calendar_summary_card'],
  // Activity / state
  'media-playing': ['now-bar.media-player', 'media-card'],
  'driving':       ['navigation_turn_card', 'eta_card'],
  'navigation':    ['navigation_turn_card'],
  'running':       ['navigation_turn_card'],
  'workout':       ['navigation_turn_card', 'media_control_bar'],
  'commute':       ['eta_card'],
  // Communication
  'messages':      ['message_summary_card'],
  'incoming-message': ['message_summary_card'],
  'notifications': [],   // notification-card handled separately
  // Tasks
  'reminder':      ['reminder_card'],
  'tasks':         ['reminder_card'],
  'todo':          ['reminder_card'],
  'weather':       ['weather_glance_card']
};

// ---------------------------------------------------------------------------
//  LEARNED RULES — runtime hooks
//  The improvement engine (improvement_engine.js) trials new rules by
//  applying them to these runtime maps without restarting the server. If a
//  trial improves test-suite scores, the rule is persisted to
//  figma-refs/learned_rules.json and loaded again on next boot.
// ---------------------------------------------------------------------------
const LEARNED_CONTEXT_INJECTIONS = {};   // tag → [componentIds]
const LEARNED_EVOLVE_ENTRIES     = [];   // [{ id, type, constraint }]
const LEARNED_RULE_INDEX         = {};   // ruleId → { kind, ...payload } for reverts

function addLearnedRule(rule) {
  if (!rule || !rule.type || !rule.payload || !rule.id) return false;
  if (rule.type === 'context_injection') {
    const tag = String(rule.payload.tag || '').toLowerCase();
    const ids = Array.isArray(rule.payload.componentIds) ? rule.payload.componentIds.slice() : [];
    if (!tag || ids.length === 0) return false;
    if (!LEARNED_CONTEXT_INJECTIONS[tag]) LEARNED_CONTEXT_INJECTIONS[tag] = [];
    ids.forEach(id => {
      if (LEARNED_CONTEXT_INJECTIONS[tag].indexOf(id) < 0) LEARNED_CONTEXT_INJECTIONS[tag].push(id);
    });
    LEARNED_RULE_INDEX[rule.id] = { kind: 'context_injection', tag, componentIds: ids };
    return true;
  }
  if (rule.type === 'evolve_constraint') {
    LEARNED_EVOLVE_ENTRIES.push({
      id:         rule.id,
      type:       rule.payload.type || 'general',
      constraint: rule.payload.constraint || ''
    });
    LEARNED_RULE_INDEX[rule.id] = { kind: 'evolve_constraint' };
    return true;
  }
  // composer_hint / selector_hint require human approval — not auto-applied
  return false;
}

function removeLearnedRule(ruleId) {
  if (!ruleId || !LEARNED_RULE_INDEX[ruleId]) return false;
  const idx = LEARNED_RULE_INDEX[ruleId];
  if (idx.kind === 'context_injection') {
    const { tag, componentIds } = idx;
    if (tag && LEARNED_CONTEXT_INJECTIONS[tag]) {
      LEARNED_CONTEXT_INJECTIONS[tag] = LEARNED_CONTEXT_INJECTIONS[tag]
        .filter(id => componentIds.indexOf(id) < 0);
      if (LEARNED_CONTEXT_INJECTIONS[tag].length === 0) delete LEARNED_CONTEXT_INJECTIONS[tag];
    }
  } else if (idx.kind === 'evolve_constraint') {
    for (let i = LEARNED_EVOLVE_ENTRIES.length - 1; i >= 0; i--) {
      if (LEARNED_EVOLVE_ENTRIES[i].id === ruleId) LEARNED_EVOLVE_ENTRIES.splice(i, 1);
    }
  }
  delete LEARNED_RULE_INDEX[ruleId];
  return true;
}

function listLearnedRules() {
  return {
    contextInjections: { ...LEARNED_CONTEXT_INJECTIONS },
    evolveEntries:     LEARNED_EVOLVE_ENTRIES.slice(),
    indexed:           Object.keys(LEARNED_RULE_INDEX)
  };
}

// Placeholder content for context-injected components. These look like
// real sample data (so the renderer's per-component visual treatment has
// something to lay out) but don't claim scenario-specific accuracy. A
// future improvement would be a tiny content-fill LLM call — but that
// adds latency, and the user's priority is speed.
const CONTEXT_INJECTION_PLACEHOLDERS = {
  'weather_glance_card':    { label: 'Seoul · Partly cloudy', value: '23° · feels 21°' },
  'calendar_summary_card':  { label: 'Next up · Today',    value: 'Stand-up · 9:30 AM · Studio A' },
  'reminder_card':          { label: "Today's tasks",      value: '3 items · Due today' },
  'message_summary_card':   { label: 'Messages · 2 new',   value: 'Alex: see you at coffee shop' },
  'eta_card':               { label: 'ETA · Home',         value: '12 min · Light traffic' },
  'navigation_turn_card':   { label: 'In 200 m',           value: 'Turn right onto Hangang-daero' },
  'now-bar.media-player':   { label: 'APT.',               value: 'ROSÉ & Bruno Mars' },
  'media-card':             { label: 'APT.',               value: 'ROSÉ & Bruno Mars' },
  'media_control_bar':      { label: 'Dreams',             value: 'Fleetwood Mac · 1977' },
  'notification-card':      { label: 'Notification',       value: 'Tap to view' }
};

const EMBEDDINGS_PATH = path.join(__dirname, 'figma-refs', 'component_embeddings.json');
let COMPONENT_EMBEDDINGS = null;
(function _loadComponentEmbeddings() {
  try {
    if (!fs.existsSync(EMBEDDINGS_PATH)) {
      console.warn('[pipeline] component_embeddings.json not found — RAG shortlist disabled. Run: node scripts/build_component_embeddings.js');
      return;
    }
    const raw = JSON.parse(fs.readFileSync(EMBEDDINGS_PATH, 'utf8'));
    if (!raw || !raw.components) return;
    // Pre-compute L2 norms for cosine similarity. We need the norm of each
    // component vector (query norm is computed once per call).
    Object.keys(raw.components).forEach(id => {
      const c = raw.components[id];
      if (!Array.isArray(c.embedding)) return;
      let s = 0;
      for (let i = 0; i < c.embedding.length; i++) s += c.embedding[i] * c.embedding[i];
      c._norm = Math.sqrt(s);
    });
    COMPONENT_EMBEDDINGS = raw;
    console.log(`[pipeline] embeddings loaded: ${Object.keys(raw.components).length} components, ${raw.dim}d, model=${raw.model}`);
  } catch (e) {
    console.warn('[pipeline] embeddings load failed:', e.message);
  }
})();

// Cosine similarity between query vector q (norm not pre-computed) and a
// component vector with pre-computed `_norm`. Returns 0 on shape mismatch.
function _cosine(q, qNorm, vec, vecNorm) {
  if (!Array.isArray(q) || !Array.isArray(vec) || q.length !== vec.length) return 0;
  let dot = 0;
  for (let i = 0; i < q.length; i++) dot += q[i] * vec[i];
  const denom = qNorm * vecNorm;
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
//  RENDERABLE_COMPONENT_IDS — the set of componentIds the client renderer
//  (app/scenes.js + app/templates.js + app/surface-layout.js) actually has
//  visual templates for. The selector + RAG shortlist MUST stay inside this
//  set, otherwise we get "(no template registered)" placeholder cards on
//  the device frame which trip width / order validators and surface as
//  multiple violations per render.
//
//  Source of truth (must match these maps in the client):
//   - templates                       (app/templates.js, line 10)
//   - PIPELINE_FALLBACK_TEMPLATES     (app/templates.js, line 60)
//   - PIPELINE_CHROME_ATOMIC_ROLE     (app/scenes.js,    line 695)
//   - PIPELINE_BODY_ATOMIC_ROLE       (app/scenes.js,    line 708)
//
//  Updating this list: when you add a new id to ANY of those four maps,
//  add it here too. The set is intentionally explicit so a missing
//  renderer is a hard failure on the server side, not a silent placeholder
//  card on the device.
// ---------------------------------------------------------------------------
const RENDERABLE_COMPONENT_IDS = new Set([
  // ─── chrome (PIPELINE_CHROME_ATOMIC_ROLE) ───
  'container.status-bar-app',
  'status-bar.default',
  'container.header',
  'container.nav-gestures-dark',
  'container.nav-buttons-light',
  'dialog.nav-gesture-bar',
  // ─── body atomics (PIPELINE_BODY_ATOMIC_ROLE) ───
  'input_summary_card',
  'weather_glance_card',
  'calendar_summary_card',
  'message_summary_card',
  'eta_card',
  'reminder_card',
  'media_control_bar',
  'now-bar.media-player',
  'now-bar.dual-line',
  'now-bar.single-line',
  'now-bar.charging',
  'navigation_turn_card',
  'action_chip_row',
  'quick_toggle_row',
  'notification-card',
  'notification.ai-regular',
  'lock-screen.clock',
  'lock-screen.weather-date',
  'lock-screen.shortcut-circle',
  // ─── editor primitives with full templates (templates.js) ───
  'btn-contained', 'btn-outlined', 'btn-flat', 'fab',
  'switch', 'checkbox', 'radio', 'chip', 'input', 'search',
  'appbar', 'bottomnav', 'pill-tab', 'tab-bar',
  'card', 'list-item', 'dialog', 'snackbar', 'divider', 'badge',
  'status-bar', 'now-bar', 'qs-toggle', 'qs-grid',
  'media-card', 'widget-small', 'keyboard'
]);

function isRenderableComponentId(id) {
  return RENDERABLE_COMPONENT_IDS.has(id);
}

// Retrieve top-K component IDs by cosine similarity to the query embedding.
// Returns [] if embeddings aren't loaded (caller falls back to full vocab).
//
// FILTER: only renderable IDs are returned. The RAG corpus contains 92
// registry components but only ~45 of those have a client renderer; the
// rest produce "(no template registered)" placeholder cards on the device
// frame and trip multiple validators. Filtering here makes the selector
// physically incapable of picking a non-renderable id.
function retrieveTopKComponentIds(queryEmbedding, k) {
  if (!COMPONENT_EMBEDDINGS || !Array.isArray(queryEmbedding)) return [];
  const components = COMPONENT_EMBEDDINGS.components;
  let qNorm = 0;
  for (let i = 0; i < queryEmbedding.length; i++) qNorm += queryEmbedding[i] * queryEmbedding[i];
  qNorm = Math.sqrt(qNorm);
  const scored = [];
  Object.keys(components).forEach(id => {
    if (!RENDERABLE_COMPONENT_IDS.has(id)) return;     // <- filter
    const c = components[id];
    if (!c || !Array.isArray(c.embedding)) return;
    const score = _cosine(queryEmbedding, qNorm, c.embedding, c._norm || 1);
    scored.push({ id, score });
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map(s => s.id);
}

// ============================================================================
//  DESIGN-SYSTEM KNOWLEDGE BASE
//  ---------------------------------------------------------------------------
//  Reads DESIGN.md / GENUI-PRINCIPLES.md / ORCHESTRATION.md / evolve.md at
//  module load, parses them into a { slug: body } map per file, and exposes
//  buildPromptContext(stage, uiState) which returns a focused slice suitable
//  for injecting into the user-message of an LLM call. Each stage gets only
//  the sections that matter to it so the LLM isn't drowned in principles.
// ============================================================================

function _safeRead(name) {
  try { return fs.readFileSync(path.join(__dirname, name), 'utf8'); }
  catch (_) { return ''; }
}

function _slug(s) {
  return (s || '')
    .replace(/^\s*\d+\.\s*/, '')        // strip leading "1. "
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Split markdown hierarchically. A ## parent's body includes everything up
// to the next ## — i.e. its own content PLUS all ### children verbatim.
// Each ### child is also keyed independently for fine-grained lookups.
// This way `vertical_stacking_rules` returns the full chapter, while the
// narrower `component_to_component_gaps` key still resolves to just that.
function _parseSections(md) {
  const sections = {};
  if (!md) return sections;
  let h2Key = null, h2Lines = [];
  let h3Key = null, h3Lines = [];
  const closeH3 = () => {
    if (h3Key) sections[h3Key] = h3Lines.join('\n').trim();
    h3Key = null; h3Lines = [];
  };
  const closeH2 = () => {
    closeH3();
    if (h2Key) sections[h2Key] = h2Lines.join('\n').trim();
    h2Key = null; h2Lines = [];
  };
  for (const line of md.split('\n')) {
    const m2 = line.match(/^## (.+)$/);
    const m3 = line.match(/^### (.+)$/);
    if (m2) {
      closeH2();
      h2Key = _slug(m2[1]);
      h2Lines = [line];
    } else if (m3) {
      closeH3();
      h3Key = _slug(m3[1]);
      h3Lines = [line];
      h2Lines.push(line);
    } else {
      if (h3Key) { h3Lines.push(line); h2Lines.push(line); }
      else if (h2Key) h2Lines.push(line);
    }
  }
  closeH2();
  return sections;
}

// Parse evolve.md into entries with { id, title, type, severity, scenario,
// issue, fix, constraint, date }. The "constraint" is the reusable rule.
function _parseEvolve(md) {
  if (!md) return [];
  const out = [];
  let curr = null;
  for (const line of md.split('\n')) {
    const mEntry = line.match(/^### (E\d+):\s*(.+)$/);
    if (mEntry) {
      if (curr) out.push(curr);
      curr = { id: mEntry[1], title: mEntry[2].trim() };
      continue;
    }
    if (!curr) continue;
    const mField = line.match(/^-\s*\*\*(\w+)\*\*:\s*(.+)$/);
    if (mField) curr[mField[1].toLowerCase()] = mField[2].trim();
  }
  if (curr) out.push(curr);
  return out;
}

const DESIGN_SECTIONS = _parseSections(_safeRead('DESIGN.md'));
const GENUI_SECTIONS  = _parseSections(_safeRead('GENUI-PRINCIPLES.md'));
const ORCH_SECTIONS   = _parseSections(_safeRead('ORCHESTRATION.md'));
const EVOLVE_ENTRIES  = _parseEvolve(_safeRead('evolve.md'));

// Cap any one section so a single massive chapter can't drown a prompt.
const MAX_SECTION_CHARS = 2000;

function _take(source, key) {
  const s = source[key];
  if (!s) return null;
  return s.length > MAX_SECTION_CHARS
    ? s.slice(0, MAX_SECTION_CHARS) + '\n[...truncated]'
    : s;
}

// Cached compact token reference from figma-refs/design_rules.json. Built
// once at module load. Referenced by the composer prompt so the LLM has
// the exact numeric token values (radius scale, spacing scale, typography
// scale) it should align padding / gap / radius decisions to.
let _DESIGN_TOKEN_BLOCK = '';
(function _buildDesignTokenBlockOnce() {
  let rules = null;
  try { rules = require('./figma-refs/design_rules.json'); }
  catch (e) { return; /* design_rules.json missing — composer just goes without */ }
  const lines = ['## Design tokens (from design_rules.json — exact values; align padding/gap/radius/typography to these)'];

  if (rules.radius) {
    const items = Object.keys(rules.radius)
      .filter(k => !k.startsWith('_'))
      .map(k => k + '=' + rules.radius[k]);
    lines.push('- radius: ' + items.join(', '));
    if (rules.radius._usage) lines.push('  usage: ' + rules.radius._usage);
  }
  if (rules.spacing) {
    const items = Object.keys(rules.spacing)
      .filter(k => !k.startsWith('_'))
      .map(k => k + '=' + rules.spacing[k]);
    lines.push('- spacing: ' + items.join(', '));
    if (rules.spacing._usage) lines.push('  usage: ' + rules.spacing._usage);
  }
  if (rules.typography && rules.typography.size) {
    const sizes = Object.keys(rules.typography.size)
      .map(k => k + '=' + rules.typography.size[k]);
    lines.push('- typography.size: ' + sizes.join(', '));
  }
  if (rules.typography && rules.typography.weight) {
    const weights = Object.keys(rules.typography.weight)
      .map(k => k + '=' + rules.typography.weight[k]);
    lines.push('- typography.weight: ' + weights.join(', '));
  }
  if (rules.glass && rules.glass._usage) {
    lines.push('- glass: ' + rules.glass._usage);
  }
  _DESIGN_TOKEN_BLOCK = lines.join('\n');
})();

function _buildDesignTokenBlock() {
  return _DESIGN_TOKEN_BLOCK;
}

// Cached refinement-rules block — pulled from figma-refs/refinement_rules.json.
// Each rule encodes a previously-observed mistake + how it should be fixed.
// Injecting these into the composer prompt as "common mistakes to avoid"
// nudges the LLM to produce the corrected pattern up-front, instead of
// requiring the rule-engine to fix it post-hoc.
let _REFINEMENT_RULES_BLOCK = '';
(function _buildRefinementRulesBlockOnce() {
  let bundle = null;
  try { bundle = require('./figma-refs/refinement_rules.json'); }
  catch (e) { return; }
  const rules = (bundle && Array.isArray(bundle.rules))
    ? bundle.rules.filter(r => r.enabled !== false)
    : [];
  if (!rules.length) return;
  const lines = ['## Refinement rules (anti-patterns previously caught — produce the corrected pattern from the start)'];
  rules.forEach(r => {
    const desc = r.description || r.id;
    lines.push('- [' + r.id + '] ' + desc);
  });
  _REFINEMENT_RULES_BLOCK = lines.join('\n');
})();

function _buildRefinementRulesBlock() {
  return _REFINEMENT_RULES_BLOCK;
}

// ---------------------------------------------------------------------------
//  COMPONENT DESCRIPTIONS for the planner prompt
//  Hand-authored overrides for the ~24 most-used components; the remaining
//  ~68 are auto-derived from orchestration_type + allowed_contexts at boot.
// ---------------------------------------------------------------------------

const COMPONENT_DESCRIPTIONS = {
  'btn-contained':       'Filled primary action button — use for CTAs, form submits, and positive next-step actions.',
  'btn-outlined':        'Outlined secondary action button — use for alternate, cancel-adjacent, or dismissable actions.',
  'btn-flat':            'Text-only ghost button — use for low-emphasis inline actions (dismiss, view more).',
  'fab':                 'Floating action button — single primary in-context action (compose, add, scan).',
  'switch':              'On/off toggle for a setting with instant effect.',
  'checkbox':            'Multi-select boolean option; respects pair-gap rules.',
  'radio':               'Single-select from a short list (≤ 5 options).',
  'chip':                'Filter / choice / tag — prefer for multi-select of short labels.',
  'input':               'Single-line text input field.',
  'search':              'Search bar with placeholder and icon; can collapse into a pill.',
  'status-bar':          'System status bar (time, battery, signal). Always first — surface chrome.',
  'appbar':              'App top bar with title, back/menu, and action icons.',
  'bottomnav':           'Bottom navigation bar with 3–5 destinations; anchored last.',
  'pill-tab':            'Pill-shaped tab bar for inline navigation inside content.',
  'tab-bar':             'Content-level tab segmentation.',
  'card':                'Surface-contained content block; hosts title, body, actions.',
  'list-item':           'One row of a vertical list (title, optional subtitle + trailing action).',
  'dialog':              'Modal overlay with title, body, and 1–3 actions; blocks underlying surface.',
  'snackbar':            'Transient ambient notification; auto-dismiss or single action.',
  'notification-card':   'Notification payload (avatar, title, body, actions); stratify per P9.',
  'media-card':          'Current-media surface: album art, track info, playback controls.',
  'now-bar':             'Compact ambient widget for in-progress activity (playing, call, timer).',
  'weather_glance_card': 'Small one-line weather summary (temperature + condition icon).',
  'qs-toggle':           'Quick-Settings tile toggle (Wi-Fi, Bluetooth, rotation, etc.).'
};

// Human-readable hint per orchestration_type for auto-description fallback.
const ORCH_TYPE_HINT = {
  button: 'Button', fab: 'Floating action button', switch: 'Toggle switch',
  chip: 'Chip (tag / filter / choice)', input: 'Text input',
  'search-bar': 'Search field', 'search-bar-ai': 'AI-powered search field',
  card: 'Content card', 'list-item': 'List row', dialog: 'Modal dialog',
  'now-bar': 'Now-bar ambient widget', 'now-bar-alert': 'Now-bar alert / status widget',
  'lock-widget': 'Lock-screen widget', 'lock-clock': 'Lock-screen clock block',
  'lock-weather-date': 'Lock-screen weather + date line',
  'lock-shortcut': 'Lock-screen quick shortcut chip',
  'qs-toggle': 'Quick-Settings toggle',
  'quick-toggle-half': 'Quick-Settings half-width toggle',
  'quick-toggle-single': 'Quick-Settings single toggle',
  'quick-shortcut-half': 'Quick-Settings half-width shortcut',
  'quick-settings-header': 'Quick-Settings header row',
  'vertical-slider': 'Quick-Settings vertical slider (brightness / volume)',
  'smartthings-rollup': 'SmartThings device rollup card',
  'system-status': 'System status bar',
  'inline-live-activity': 'Live-activity chip inline in status bar',
  'status-bar': 'System status bar', appbar: 'App top bar',
  bottomnav: 'Bottom navigation bar', 'tab-bar': 'Tab bar',
  'media-card': 'Media player card', 'media-player-tile': 'Media player tile',
  'notification-card': 'Notification card',
  'ai-notification': 'AI-generated notification',
  'live-notification': 'Live updating notification',
  'stacked-notification': 'Stacked notification group',
  'section-label': 'Section label / divider label',
  'dialog-header': 'Dialog header', 'browser-top-bar': 'Browser top bar',
  'icon-picker-grid': 'Icon picker grid (inside dialog)',
  'page-indicator': 'Paginated screens indicator',
  'home-gesture-bar': 'Home gesture bar', 'modal-dim': 'Modal dim-screen overlay',
  'button-primary': 'Primary (accent) button', 'button-ai': 'Galaxy AI styled button',
  'button-inline': 'Inline small header button',
  'app-shell': 'App shell container', 'content-area': 'App content area container',
  'app-header': 'App header container', 'app-status-bar': 'App-level status bar',
  'nav-bar-gestures': 'Gesture-style nav bar', 'nav-bar-buttons': 'Three-button nav bar',
  'card-toggle': 'Card containing a toggle row',
  'card-menu': 'Card menu item', 'card-menu-body': 'Card menu item body',
  'card-subheading': 'Card subheading row',
  'card-navigation': 'Chevron-navigation card',
  'card-radio': 'Radio-selection card',
  'card-stacked-group': 'Stacked card group',
  'modal-dialog-surface': 'Modal dialog surface',
  content: 'Content element', notification: 'Notification', widget: 'Widget'
};

function _cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function _autoDescription(c) {
  const base = ORCH_TYPE_HINT[c.orchestration_type]
            || (_cap(c.category || '') + ' component');
  const ctxs = Array.isArray(c.allowed_contexts) && c.allowed_contexts.length
    ? ' · contexts: ' + c.allowed_contexts.slice(0, 5).join('/')
    : '';
  return base + ctxs + '.';
}

// Pre-build the component vocabulary block once at module load.
let COMPONENT_DESCRIPTIONS_BLOCK = '(component registry unavailable)';
(function _buildComponentDescBlock() {
  if (!REGISTRY || !REGISTRY.components) return;
  const allowed = (REGISTRY.vocabulary && REGISTRY.vocabulary.semantic_allowed_types)
               || (REGISTRY.vocabulary && REGISTRY.vocabulary.allowed_types)
               || Object.keys(REGISTRY.components || {});
  const byCat = {};
  allowed.forEach(id => {
    const c = REGISTRY.components[id];
    if (!c) return;
    const cat = c.category || 'other';
    (byCat[cat] = byCat[cat] || []).push({ id, c });
  });
  const lines = [
    'COMPONENT VOCABULARY (select only these IDs; grouped by category).',
    'Each entry shows id [variants] [tokens]: description.',
    '- variants is the CLOSED set of values your variant_hint may take.',
    '- tokens are the design tokens the component uses (radius/background/',
    '  text_style); align your composer padding/gap decisions to these.',
    'Pick "default" or omit variant when no specific one fits.'
  ];
  // Helper: format a component's tokens object as a compact "[tokens: …]"
  // suffix. Skips when tokens is empty so simple components stay readable.
  function _fmtTokens(c) {
    const t = c && c.tokens;
    if (!t || typeof t !== 'object') return '';
    const parts = [];
    if (t.radius)            parts.push('radius=' + t.radius);
    if (t.background)        parts.push('bg=' + t.background);
    if (t.text_style_title)  parts.push('text=' + t.text_style_title);
    if (t.text_style)        parts.push('text=' + t.text_style);
    if (t.gap)               parts.push('gap=' + t.gap);
    if (!parts.length) return '';
    return ' [tokens: ' + parts.join(', ') + ']';
  }
  // Description-source priority chain (most specific → most generic):
  //   1. c.description + c.purpose from the registry (PDF-enriched, best)
  //   2. COMPONENT_DESCRIPTIONS[id]   — designer-curated overrides
  //   3. _autoDescription(c)          — auto-derived from category/contexts
  function _composeDesc(id, c) {
    if (c.description) {
      // Combine description (what it looks like) + purpose (when to use)
      // into one dense line for the vocabulary block.
      return c.purpose
        ? c.description + ' Use when: ' + c.purpose
        : c.description;
    }
    return COMPONENT_DESCRIPTIONS[id] || _autoDescription(c);
  }
  // Format a component's typical_content as a compact, indented example
  // block. Limit to 3 examples max per component to keep the vocabulary
  // prompt compact while still giving the LLM concrete reference text.
  // The LLM uses these as a template for label/value generation, so the
  // generic-placeholder problem ("Personalized guidance / Adaptations
  // based on...") gets resolved at the source rather than via post-hoc
  // validators.
  function _fmtTypicalContent(c) {
    const tc = c && c.typical_content;
    if (!tc || !Array.isArray(tc.examples) || tc.examples.length === 0) return '';
    const examples = tc.examples.slice(0, 3).map(ex => {
      const scn   = ex.scenario ? ex.scenario + ': ' : '';
      const label = ex.label ? '"' + ex.label + '"' : '""';
      const val   = ex.value ? '"' + ex.value + '"' : '""';
      return '    · ' + scn + 'label=' + label + ', value=' + val;
    });
    const guidance = tc.guidance ? '\n    Guidance: ' + tc.guidance : '';
    return '\n    Content examples:\n' + examples.join('\n') + guidance;
  }
  Object.keys(byCat).sort().forEach(cat => {
    lines.push('');
    lines.push('-- ' + cat + ' --');
    byCat[cat].forEach(({ id, c }) => {
      const desc = _composeDesc(id, c);
      const states = Array.isArray(c.states) && c.states.length
        ? ' [variants: ' + c.states.join(', ') + ']'
        : ' [variants: default]';
      const tokens = _fmtTokens(c);
      const examples = _fmtTypicalContent(c);
      lines.push('  ' + id + states + tokens + ': ' + desc + examples);
    });
  });
  COMPONENT_DESCRIPTIONS_BLOCK = lines.join('\n');
})();

// ---------------------------------------------------------------------------
//  buildShortlistedVocabBlock(ids)
//  Returns a vocabulary block formatted like COMPONENT_DESCRIPTIONS_BLOCK but
//  containing only the requested IDs, grouped by category. Used by the
//  Stage 3 RAG shortlist path: pass the top-K retrieved IDs (plus mandatory
//  ones) and get a focused block to put in the user message.
//  Falls back to the full block if IDs is empty.
// ---------------------------------------------------------------------------
function buildShortlistedVocabBlock(ids) {
  if (!REGISTRY || !REGISTRY.components || !Array.isArray(ids) || ids.length === 0) {
    return COMPONENT_DESCRIPTIONS_BLOCK;
  }
  const byCat = {};
  ids.forEach(id => {
    const c = REGISTRY.components[id];
    if (!c) return;
    const cat = c.category || 'other';
    (byCat[cat] = byCat[cat] || []).push({ id, c });
  });
  // Same formatters as _buildComponentDescBlock — kept in sync intentionally.
  function _fmtTokens(c) {
    const t = c && c.tokens;
    if (!t || typeof t !== 'object') return '';
    const parts = [];
    if (t.radius)            parts.push('radius=' + t.radius);
    if (t.background)        parts.push('bg=' + t.background);
    if (t.text_style_title)  parts.push('text=' + t.text_style_title);
    if (t.text_style)        parts.push('text=' + t.text_style);
    if (t.gap)               parts.push('gap=' + t.gap);
    if (!parts.length) return '';
    return ' [tokens: ' + parts.join(', ') + ']';
  }
  function _composeDesc(id, c) {
    if (c.description) {
      return c.purpose ? c.description + ' Use when: ' + c.purpose : c.description;
    }
    return COMPONENT_DESCRIPTIONS[id] || _autoDescription(c);
  }
  function _fmtTypicalContent(c) {
    const tc = c && c.typical_content;
    if (!tc || !Array.isArray(tc.examples) || tc.examples.length === 0) return '';
    const examples = tc.examples.slice(0, 3).map(ex => {
      const scn   = ex.scenario ? ex.scenario + ': ' : '';
      const label = ex.label ? '"' + ex.label + '"' : '""';
      const val   = ex.value ? '"' + ex.value + '"' : '""';
      return '    · ' + scn + 'label=' + label + ', value=' + val;
    });
    const guidance = tc.guidance ? '\n    Guidance: ' + tc.guidance : '';
    return '\n    Content examples:\n' + examples.join('\n') + guidance;
  }
  const lines = [
    'COMPONENT VOCABULARY (RAG shortlist — select only from these IDs).',
    'Each entry: id [variants] [tokens]: description.',
    `Shortlist size: ${ids.length} of ${Object.keys(REGISTRY.components).length} registry entries.`
  ];
  Object.keys(byCat).sort().forEach(cat => {
    lines.push('');
    lines.push('-- ' + cat + ' --');
    byCat[cat].forEach(({ id, c }) => {
      const desc = _composeDesc(id, c);
      const states = Array.isArray(c.states) && c.states.length
        ? ' [variants: ' + c.states.join(', ') + ']'
        : ' [variants: default]';
      const tokens = _fmtTokens(c);
      const examples = _fmtTypicalContent(c);
      lines.push('  ' + id + states + tokens + ': ' + desc + examples);
    });
  });
  return lines.join('\n');
}

// Focused variant reference for the composer — only the components actually
// selected by Step 3, with their valid variant set. Keeps the composer
// prompt small while making `invalid_variant` violations physically
// impossible (LLM can't emit a variant outside the closed set if it's
// staring at the closed set).
function buildVariantReference(componentIds) {
  if (!REGISTRY || !REGISTRY.components || !Array.isArray(componentIds)) return '';
  const seen = new Set();
  const lines = [];
  componentIds.forEach(id => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const c = REGISTRY.components[id];
    if (!c) return;
    const states = Array.isArray(c.states) && c.states.length
      ? c.states.join(', ')
      : 'default';
    lines.push('  ' + id + ': [' + states + ']');
  });
  if (!lines.length) return '';
  return 'VALID VARIANTS for the selected components — every children[].variant MUST be one of these (or "default"):\n' + lines.join('\n');
}

// Per-surface mandatory components from generator_memory.json. The LLM
// selector silently drops chrome (#7 "bare lock" → empty layout) because
// nothing in its prompt tells it some components are non-negotiable.
// This block is appended to the selector's user message so it knows what
// it cannot omit.
function buildMandatoryComponentsBlock(uiState) {
  if (!DesignMemory || !DesignMemory.generatorMemory) return '';
  const surface = uiState && uiState.baseSurface;
  if (!surface) return '';
  const screens = DesignMemory.generatorMemory.screens || {};
  const screen  = screens[surface];
  if (!screen) return '';
  const mand = screen.mandatoryComponents
            || screen.mandatory_components
            || [];
  if (!mand.length) return '';
  const lines = [
    'MANDATORY for surface "' + surface + '" — you MUST include each of',
    'these as a requiredComponent with priority 1. Never skip them, even',
    'when the scenario sounds minimal ("bare", "clean", "just the X"):'
  ];
  mand.forEach(id => lines.push('  - ' + id));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
//  CONTEXT TAG VOCABULARY
//  ---------------------------------------------------------------------------
//  Free-form scenario signals the interpreter can emit on uiState.context_tags.
//  Read by generator.js at render time to make scenario-aware variant choices
//  (which Now Bar to surface, whether to show a weather widget, etc.).
//  The list below is the *canonical* vocabulary; the LLM may invent additional
//  tags for unique scenarios — they will pass through normalization unchanged
//  but won't trigger built-in renderer behaviors unless the generator knows
//  about them. Prefix tags with "<feature>:<value>" for explicit overrides.
// ---------------------------------------------------------------------------

const CONTEXT_TAG_VOCABULARY = `## context_tags vocabulary

Emit only the tags the scenario justifies; an empty array is acceptable when
the scenario is generic. Tags are lowercase kebab-case strings. Multiple are
allowed. Format \`<feature>:<value>\` denotes an explicit override; bare tags
denote scenario facts.

Now Bar variant signals (consumed by generator.js for the lock-screen lower cluster):
- now-bar:media       — surface a media-playing Now Bar (album / track / controls)
- now-bar:charging    — surface a charging Now Bar (battery percent)
- now-bar:timer       — surface a timer/stopwatch Now Bar
- now-bar:voice       — surface a voice-friendly single-line variant
- now-bar:delivery    — surface a delivery / ETA tracker
- now-bar:eta         — alias for delivery
- no-now-bar          — explicitly suppress the Now Bar
- bare-lock           — minimal lock screen, suppress all ambient widgets

Activity signals (scenario facts; may also drive Now Bar choice indirectly):
- media-playing, charging, workout, running, commute, meeting, idle,
  driving, walking, stationary
- **running / outdoor activity with live directions:** include tags \`navigation\` or \`driving\` as appropriate so **navigation_turn_card** (maps-style turn pill) can be injected — not only \`workout\` (which is also used for indoor training).

Time-of-day:
- morning, afternoon, evening, night, dawn, dusk

System state:
- low-battery, dnd, focus-mode, airplane-mode, silent

Lock-screen extras:
- weather — surface weather / forecast content on GenUI: include tag "weather" when the scenario is a weather app or forecast; use weather_glance_card + reminder_card rows with newline-separated value lines for hourly / outlook / detail capsules (see planner rules).
- temporal:secondary        — show secondary time / date row
- notifications-pending     — there are pending notifications to surface
- widgets-active            — widget row should be shown

Examples:
- "Show the lock screen with music playing"          → ["media-playing", "now-bar:media"]
- "Lock screen at night, no widgets, just the time"  → ["night", "bare-lock"]
- "Driving navigation lock screen"                   → ["driving", "now-bar:voice"]
- "Workout in progress on lock"                      → ["workout"]
- "Show a clean home screen"                         → []
`;

// ---------------------------------------------------------------------------
//  buildPromptContext(stage, uiState) — returns the KB slice per stage.
//  Stages: 'interpreter' | 'normalizer' | 'selector' | 'composer' | 'explainer'
//  uiState is optional (interpreter doesn't have it yet); when present it
//  enables surface-specific sections (lock/home screen assembly, QS panel).
// ---------------------------------------------------------------------------

function buildPromptContext(stage, uiState) {
  const parts = ['# Design System Context'];
  const surface = uiState && uiState.baseSurface;
  const overlay = uiState && uiState.overlayType;

  const push = (body) => { if (body) parts.push(body); };

  if (stage === 'interpreter') {
    push(_take(GENUI_SECTIONS, 'terminology'));
    push(_take(GENUI_SECTIONS, 'p2_contextual_assembly'));
    push(_take(GENUI_SECTIONS, 'p4_progressive_density'));
    push(_take(GENUI_SECTIONS, 'p10_ambient_reactivity'));
    parts.push(CONTEXT_TAG_VOCABULARY);
  } else if (stage === 'normalizer') {
    push(_take(GENUI_SECTIONS, 'p1_component_role_classification'));
    push(_take(GENUI_SECTIONS, 'p4_progressive_density'));
    push(_take(GENUI_SECTIONS, 'p9_notification_stratification'));
    push(_take(ORCH_SECTIONS,  'vertical_stacking_rules'));
  } else if (stage === 'selector') {
    push(_take(GENUI_SECTIONS, 'component_composition_grammar'));
    push(_take(GENUI_SECTIONS, 'well_formedness_constraints'));
    const relEvolve = EVOLVE_ENTRIES.filter(e =>
      /touch-target|sizing|interaction|radius/.test(e.type || ''));
    if (relEvolve.length) {
      parts.push('## Learned selection rules (evolve.md)\n' +
        relEvolve.map(e => `- [${e.id}] ${e.constraint || e.title}`).join('\n'));
    }
    // Auto-learned constraints from improvement cycles. These are injected
    // at runtime when applyLearnedRule has been called (via Phase C trial)
    // and persisted in figma-refs/learned_rules.json. Filtered to selector-
    // relevant types so the prompt stays focused.
    const relLearned = LEARNED_EVOLVE_ENTRIES.filter(e =>
      /touch-target|sizing|interaction|radius|content|composition/.test(e.type || ''));
    if (relLearned.length) {
      parts.push('## Auto-learned rules (improvement cycles)\n' +
        relLearned.map(e => `- [${e.id}] ${e.constraint}`).join('\n'));
    }
  } else if (stage === 'composer') {
    // ORCHESTRATION rules — the composer's primary reference for HOW to
    // arrange components into surfaces.
    push(_take(ORCH_SECTIONS, 'screen_frame_structure'));
    push(_take(ORCH_SECTIONS, 'vertical_stacking_rules'));
    push(_take(ORCH_SECTIONS, 'horizontal_layout_rules'));
    push(_take(ORCH_SECTIONS, 'container_nesting_rules'));
    if (surface === 'lock') push(_take(ORCH_SECTIONS, 'lock_screen_assembly'));
    if (surface === 'home') push(_take(ORCH_SECTIONS, 'home_screen_assembly'));
    if (overlay === 'quick-settings')
      push(_take(ORCH_SECTIONS, 'quick_settings_panel_assembly'));

    // DESIGN.md token system — previously NOT injected into Path A prompts,
    // so the composer didn't know "Samsung Blue is #0381FE" or "primary CTA
    // radius is 18px". Now the composer reasons against the actual design
    // system tokens. Sections chosen for composer relevance: color palette
    // (semantic roles), typography scale, shape system (radius/morphology),
    // spacing system (grid). Skip "Visual Theme" and "Component Definitions"
    // (already covered by the component vocabulary block in the selector).
    push(_take(DESIGN_SECTIONS, 'color_palette_roles'));
    push(_take(DESIGN_SECTIONS, 'typography'));
    push(_take(DESIGN_SECTIONS, 'shape_system'));
    push(_take(DESIGN_SECTIONS, 'spacing_system'));

    // Compact token reference from design_rules.json — atomic numeric values
    // the composer can reference when picking padding / radius / typography.
    // Complements DESIGN.md's prose with the exact token table.
    parts.push(_buildDesignTokenBlock());

    // Refinement rules from figma-refs/refinement_rules.json — anti-patterns
    // previously observed + their corrections, injected as guidance so the
    // composer produces the right shape from the start instead of relying
    // on post-hoc rule-engine fixes.
    parts.push(_buildRefinementRulesBlock());

    if (EVOLVE_ENTRIES.length) {
      parts.push('## Learned composition rules (evolve.md)\n' +
        EVOLVE_ENTRIES.map(e => `- [${e.id}] ${e.constraint || e.title}`).join('\n'));
    }
    // Auto-learned constraints — composer sees ALL learned types because
    // composition is the cross-cutting stage where sizing/touch-target/
    // content rules all matter.
    if (LEARNED_EVOLVE_ENTRIES.length) {
      parts.push('## Auto-learned rules (improvement cycles)\n' +
        LEARNED_EVOLVE_ENTRIES.map(e => `- [${e.id}] (${e.type}) ${e.constraint}`).join('\n'));
    }
  } else if (stage === 'explainer') {
    parts.push('## Principles the pipeline emphasized\n' +
      '- P1: Component role classification (S vs G)\n' +
      '- P2: Contextual assembly — context drives structure\n' +
      '- P4: Progressive density (expanded → normal → compressed)\n' +
      '- P9: Notification stratification (info / interactive / alert)\n' +
      '- ORCH §2: Vertical stacking gaps (chrome→chrome 0dp, chrome→content 8dp, card→card 12dp)\n' +
      '- evolve.md: touch-target ≥ 48dp, no sub-0.5px borders, grid-snapped spacing');
  }
  return parts.filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
//  Pre-filter: single entry point for allowed-component filtering.
//  Called once before Step 4 (layout composer). Uses Generator's surfaceRules
//  + registry.allowedContexts from DesignMemory. Returns filtered refs array.
// ---------------------------------------------------------------------------
function preFilterComponents(componentRefs, uiState) {
  if (!DesignMemory || !DesignMemory.generatorMemory) return componentRefs;
  return Generator.filterAllowedComponents(uiState, componentRefs, DesignMemory);
}

function allowedComponentTypes() {
  if (!REGISTRY) return [];
  return (REGISTRY.vocabulary && REGISTRY.vocabulary.allowed_types) || Object.keys(REGISTRY.components || {});
}

function allowedSemanticComponentTypes() {
  if (!REGISTRY) return [];
  return (REGISTRY.vocabulary && REGISTRY.vocabulary.semantic_allowed_types) || allowedComponentTypes();
}

// ---------------------------------------------------------------------------
//  STEP 1 — SCENARIO INTERPRETER
// ---------------------------------------------------------------------------

function buildInterpreterPrompt() {
  return `You are a scenario interpreter for a state-based generative UI system.

You must NOT generate UI.
You must NOT choose components.
You must ONLY convert the scenario into structured intent, context, tasks, constraints, and UI state.

Return STRICT JSON only.

{
  "intent": {
    "primary_goal": "",
    "secondary_goal": null
  },
  "context": {
    "environment": "",
    "attention_mode": "focused | glanceable | distracted",
    "urgency": "low | medium | high",
    "mobility_mode": "stationary | walking | driving | transit",
    "interaction_mode": "touch | voice | mixed | minimal-touch"
  },
  "tasks": [
    {
      "task_id": "",
      "type": "",
      "priority": 1,
      "content_need": ""
    }
  ],
  "constraints": [],
  "ui_state": {
    "base_surface": "lock | home | app",
    "home_substate": "none | launcher | app-drawer | widget-edit",
    "overlay_type": "none | quick-settings | notification-shade | system-dialog",
    "overlay_coverage": "none | partial | full",
    "window_mode": "single | split | floating",
    "attention_mode": "focused | glanceable | distracted",
    "density_mode": "expanded | normal | compressed",
    "interaction_mode": "touch | voice | mixed | minimal-touch",
    "background_policy": "wallpaper | solid-dark | scrim-over-wallpaper | scrim-over-app | dialog-surface",
    "context_tags": ["string", "..."]
  }
}

Rules:
- interpret, do not design
- tasks must be atomic
- priority must be explicit (1 highest)
- constraints must reflect real UX constraints
- ui_state must reflect context, not arbitrary guess
- context_tags should be a list of scenario signals the renderer can act on (see vocabulary in the design-system context block); use [] when the scenario is generic

base_surface CLASSIFICATION (critical — most quality issues trace back to misclassification here):
  * "lock"  — the device's lock screen. Wallpaper visible, clock prominent, no app chrome. Use ONLY when the scenario explicitly takes place on the lock screen.
  * "home"  — the device's home / launcher screen ITSELF: system widgets (weather, calendar, music) on top of the wallpaper, app dock at the bottom. Use ONLY when the scenario is "show the home screen" / "the device home" / "launcher" / etc. The home screen is a CHROME surface, not a content surface.
  * "app"   — INSIDE a specific application. Use this for ANY scenario that describes a task, a tool, a content view, or a specific app — even if the app feels lifestyle-y or "personalized". The app surface gets its own status bar + app-bar + content area. NO wallpaper. NO home dock. NO system widgets.

Decision rule: if the user is asking to DO something or SEE something inside an application (cook, navigate, message, browse, configure, track, learn, shop, watch, play, edit) → "app". If the user is asking to see the device's idle screens themselves → "lock" or "home".

Examples:
  * "Personalized cooking assistant" → app   (cooking is an app, not the home screen)
  * "Driving navigation" → app   (navigation is an app)
  * "Workout tracker showing heart rate" → app   (a fitness app)
  * "Chat thread with photo attachment" → app
  * "Settings page with toggle list" → app
  * "Recipe browser with filters" → app
  * "Show the home screen with weather and music widgets" → home   (explicit home reference)
  * "Lock screen with now-playing media" → lock
  * "Notification shade" → home with overlay_type=notification-shade   (the shade overlays whatever is underneath; default underlying surface is home)`;
}

// ---------------------------------------------------------------------------
//  STEP 1+2 (MERGED) — INTERPRET + NORMALIZE in a single LLM call
//  ---------------------------------------------------------------------------
//  Speed optimization: Steps 1 and 2 are both "scenario understanding" and
//  share the same uiState; merging them into one model call cuts ~7s off
//  every pipeline run while still letting downstream code consume them as
//  separate canonical objects (normalizeInterpreterOutput +
//  normalizeNormalizerOutput each read their own subset of fields from the
//  same response). Used by runPlan when an llmCallFast is supplied.
// ---------------------------------------------------------------------------

function buildInterpretAndPlanPrompt() {
  return `You are a scenario interpreter AND planning normalizer for a state-based generative UI system. You handle pipeline stages 1 and 2 in a single response.

You must NOT generate UI.
You must NOT choose components.
You must produce a SINGLE strict-JSON object containing BOTH halves:
  (A) interpretation:  intent, context, tasks, constraints, ui_state
  (B) planning packet: planning_summary, task_groups, slot_requirements, selection_constraints

Return STRICT JSON only (no commentary):

{
  "intent": {
    "primary_goal": "",
    "secondary_goal": null
  },
  "context": {
    "environment": "",
    "attention_mode": "focused | glanceable | distracted",
    "urgency": "low | medium | high",
    "mobility_mode": "stationary | walking | driving | transit",
    "interaction_mode": "touch | voice | mixed | minimal-touch"
  },
  "tasks": [
    {
      "task_id": "",
      "type": "",
      "priority": 1,
      "content_need": ""
    }
  ],
  "constraints": [],
  "ui_state": {
    "base_surface": "lock | home | app",
    "home_substate": "none | launcher | app-drawer | widget-edit",
    "overlay_type": "none | quick-settings | notification-shade | system-dialog",
    "overlay_coverage": "none | partial | full",
    "window_mode": "single | split | floating",
    "attention_mode": "focused | glanceable | distracted",
    "density_mode": "expanded | normal | compressed",
    "interaction_mode": "touch | voice | mixed | minimal-touch",
    "background_policy": "wallpaper | solid-dark | scrim-over-wallpaper | scrim-over-app | dialog-surface",
    "context_tags": ["string", "..."]
  },
  "planning_summary": {
    "primary_goal": "",
    "interaction_priority": "",
    "attention_strategy": "",
    "density_strategy": "",
    "background_policy": ""
  },
  "task_groups": {
    "primary": [],
    "secondary": [],
    "optional": []
  },
  "slot_requirements": [
    {
      "slot": "",
      "purpose": "",
      "content_type": "",
      "priority": 1,
      "selection_hint": ""
    }
  ],
  "selection_constraints": {
    "prefer": [],
    "avoid": [],
    "collapse_first": []
  }
}

Rules — interpretation half:
- interpret, do not design
- tasks must be atomic
- priority must be explicit (1 highest)
- constraints must reflect real UX constraints
- ui_state must reflect context, not arbitrary guess
- context_tags should be a list of scenario signals the renderer can act on (see vocabulary in the design-system context block); use [] when the scenario is generic

DENSITY / ATTENTION DEFAULTS (calibrated against real Samsung One UI behavior):
- density_mode: default to "normal". Use "expanded" only when the scenario explicitly emphasizes detail (deep-dive, full-content reading, edit mode). Use "compressed" ONLY when the scenario explicitly says "minimal", "essentials only", "quick glance", "simplified", or "battery saver" — NOT just because the surface is lock or notification.
- attention_mode: default to "focused". Use "glanceable" only for genuinely passive surfaces (always-on display, status-at-a-glance widget). Lock screens with multiple content types (briefing, weather + meetings, notifications + media) are "focused", not glanceable — the user is actively reading multiple cards.
- interaction_mode: default to "touch". Use "minimal-touch" only when scenario context implies hands-busy (driving, cooking with messy hands, exercising) or when the surface is genuinely no-interaction (always-on display).
- A real Samsung lock screen typically shows 6-10 visible elements (status bar, clock, weather, date, widget row, shortcut row, gesture bar, etc.). Do not auto-compress it to 2-3 just because "lock screen sounds minimal".

Rules — planning half:
- group tasks into primary / secondary / optional. Top 2 priority=1 tasks → primary; remaining priority-1/2 → secondary; priority-3 → optional
- convert tasks into slot_requirements (slots, NOT component names)
- selection_hint describes BEHAVIOR not a component (e.g. "single-value glance summary", "primary action affordance")
- if attention_mode = glanceable → prefer summary / compact / single-value; mark dense components for collapse_first
- if interaction_mode = minimal-touch → avoid dense interaction clusters
- if urgency = high → primary must reflect urgency
- DO NOT invent component names anywhere

base_surface CLASSIFICATION (critical — most quality issues trace back to misclassification):
  * "lock"  — the device's lock screen. Wallpaper visible, clock prominent, no app chrome. Use ONLY when the scenario explicitly takes place on the lock screen.
  * "home"  — the device's home / launcher screen ITSELF: system widgets on top of the wallpaper, app dock at the bottom. Use ONLY when the scenario is "show the home screen" / "the device home" / "launcher" / etc.
  * "app"   — INSIDE a specific application. Use this for ANY scenario that describes a task, a tool, a content view, or a specific app — even if the app feels lifestyle-y or "personalized". App surface gets its own status bar + app-bar + content area. NO wallpaper. NO home dock. NO system widgets.

Decision rule: if the user is asking to DO or SEE something INSIDE an application (cook, navigate, message, browse, configure, track, learn, shop, watch, play, edit) → "app". If the user is asking to see the device's idle screens themselves → "lock" or "home".

Examples:
  * "Personalized cooking assistant" → app
  * "Driving navigation" → app
  * "Workout tracker showing heart rate" → app
  * "Settings page with toggle list" → app
  * "Show the home screen with weather and music widgets" → home
  * "Lock screen with now-playing media" → lock
  * "Notification shade" → home with overlay_type=notification-shade`;
}

// ---------------------------------------------------------------------------
//  STEP 2 — HANDOFF NORMALIZER (planner preparation)
//  Kept for backward compatibility / debug routes that want the legacy
//  two-call path. The merged buildInterpretAndPlanPrompt is preferred.
// ---------------------------------------------------------------------------

function buildNormalizerPrompt() {
  return `You are a handoff normalizer.

You receive structured scenario JSON from STEP 1.
Your job is to convert it into a component-selection-ready planning packet.

You must NOT:
- generate UI
- invent components
- change ui_state arbitrarily
- reinterpret the scenario creatively

You must:
- group tasks into primary / secondary / optional
- convert tasks into slot requirements
- translate constraints into selection constraints
- prepare a minimal, clean packet for component selection

Return STRICT JSON:

{
  "planning_summary": {
    "primary_goal": "",
    "interaction_priority": "",
    "attention_strategy": "",
    "density_strategy": "",
    "background_policy": ""
  },
  "task_groups": {
    "primary": [],
    "secondary": [],
    "optional": []
  },
  "slot_requirements": [
    {
      "slot": "",
      "purpose": "",
      "content_type": "",
      "priority": 1,
      "selection_hint": ""
    }
  ],
  "selection_constraints": {
    "prefer": [],
    "avoid": [],
    "collapse_first": []
  },
  "ui_state": {}
}

Rules:
- keep only top 2 tasks as primary/secondary if too many
- rest → optional
- convert tasks → slots (NOT components)
- selection_hint must describe behavior, not component name
- if attention_mode = glanceable → prefer summary, compact, single-value
- if minimal-touch → avoid dense interaction clusters
- if urgency high → primary must reflect urgency
- DO NOT invent component names`;
}

// ---------------------------------------------------------------------------
//  STEP 3 — COMPONENT SELECTOR
// ---------------------------------------------------------------------------

function buildPlannerPrompt(vocabOverride) {
  // When called with no argument: bake in the static COMPONENT_DESCRIPTIONS_BLOCK
  // (legacy, RAG-off behavior — vocab lives in the system prompt).
  // When called with a vocab block argument: use that instead (RAG=on path,
  // letting runSelect inject a per-call shortlist).
  const block = (typeof vocabOverride === 'string' && vocabOverride.length)
    ? vocabOverride
    : COMPONENT_DESCRIPTIONS_BLOCK;
  return `You are a component selector.

You receive a planning packet.
Your job is to select components ONLY from the allowed vocabulary below.
Each entry shows the component's ID, category, and a short description of
its purpose. Match components to slot_requirements based on purpose — not
just on string similarity.

You must NOT:
- reinterpret the scenario
- invent new components
- generate layout or styling

${block}

Return STRICT JSON:

{
  "required_components": [
    {
      "slot": "",
      "component_type": "",
      "variant_hint": "",
      "priority": 1,
      "role": "chrome | subject | state | action | feedback | context | navigation",
      "content": {
        "label": "",
        "value": "",
        "icon": null
      },
      "constraints": []
    }
  ],
  "planner_notes": {
    "kept_primary_tasks": [],
    "collapsed_optional_tasks": [],
    "selection_reasoning": []
  }
}

Rules:
- STATIC LAYOUT MODE: each component_type you pick is a fixed, fully-styled
  preset from the registry. Do NOT invent ad-hoc UI. Only vary content.label,
  content.value, and optional icon — same visual shell as /customize Live Preview.

- select components that match slot_requirements
- respect selection_constraints.prefer / avoid
- if conflict → preserve primary tasks
- collapse optional first
- if glanceable → compact or glance variants
- if minimal-touch → larger, simpler components
- content must match content_need

ROLE classification (the most important field for downstream layout coherence):
- chrome     — system-level structural elements: status bars, app bars, gesture bars, nav bars
- subject    — the primary content/artifact the user is interacting with: a recipe step card, a message body, a song/track card, a current notification; one screen typically has ONE subject
- state      — current status display tied to a subject: timer, progress bar, step counter "3 of 5", battery percentage
- action     — user-triggerable controls that operate ON the subject: "Next", "Pause", "Save", "Send"; chips, buttons, FABs
- feedback   — response/confirmation to a recent action: snackbar "Saved", inline success/error message
- context    — supporting info that frames the subject without acting on it: weather card next to lock clock, related recipes, tips, ambient widgets
- navigation — destination switches across screens: bottom nav, tabs, back arrow

Selection guidance:
- Every screen with a clear primary task MUST have at least one subject component.
- An action component should be selected only when the scenario implies the user can act (control_task type). Don't manufacture actions for inform-only scenarios.
- Slot names should be DESCRIPTIVE (e.g. "current_instruction", "save_action", "weather_glance") — they will be carried into the layout for visual grouping.

PRESET COMPONENT IDs (use these exact component_type strings — the client renders them as finished One UI atomics; your job is text only, not a novel layout):
- weather_glance_card — weather tile (temp, condition, location, icon)
- calendar_summary_card — calendar / schedule card (section, time, duration, title, location)
- reminder_card — checklist / reminder tile (section, task, due)
- message_summary_card — inbox / message preview (sender, preview, section)
- eta_card — commute / arrival summary
- input_summary_card — search or form recap with optional facet chips (NOT a generic “content card”)
- notification.ai-regular — Galaxy AI summary strip (sparkle icon row, expandable affordance)
- notification-card — standard app notification (service icon, title, time, body line)
- media_control_bar — compact now-playing / transport (**or** now-bar.* registry ids when player context is explicit)
Do NOT approximate these with primitives (btn/card/dialog) or free-form “card” types when a preset above fits the slot. The /customize Live Preview ("ALL THEMED CARDS") uses these same component_type values — reproducing that gallery in a generated screen is done by selecting these IDs and filling content; no separate "customize-only" renderer.

Content authoring:
- For each requiredComponent you pick, fill content.label and content.value with REAL, scenario-specific text — NOT placeholders.
- The vocabulary block above shows "Content examples" for each component (label / value pairs across diverse scenarios). Use them as a TEMPLATE — match the structure and concreteness, then adapt the wording to the user's scenario.
- NEVER emit content like "Title", "Subtitle", "Item", "Content", "Personalized guidance", "Adaptations based on preferences" — those are bad placeholders.
- When two requiredComponents share the same componentType but different slots, their content.label and content.value MUST be DISTINCT and tailored to each slot's purpose.

DIVERSITY (soft guidance — prefer mix when it fits the scenario):
- Reusing the SAME preset component_type several times with DIFFERENT content per slot is OK (e.g. multiple notification-card rows in a shade) — layout stays identical, only strings change.
- Prefer mixing weather / calendar / reminder / message / notifications when the scenario truly calls for it; do not force variety if the user asked for a homogeneous list.
- Duplicated label text across different slots is discouraged only when it adds no new information; otherwise vary titles realistically.
- input_summary_card = search/form recap with facets. For weather / calendar / notifications use their dedicated preset IDs above.
- When unsure, prefer the most specific preset ID that matches the slot.

Weather / forecast dashboards (app surface):
- Emit weather_glance_card for the hero current-conditions tile when the scenario asks for weather.
- For "next hours", "5-day", "details" sections, use separate reminder_card (preferred) or input_summary_card entries: put the section title in content.label (e.g. "NEXT 6 HOURS", "5-DAY OUTLOOK", "DETAILS") and put ONE ROW PER LINE in content.value (newline-separated). The client renders each line as a glass capsule chip — do not cram all rows into a single paragraph.
- **Density cap (enforced in UI):** hourly / "next hours" sections accept at most **4** chip lines — prefer 3–4 well-spaced rows (merge similar times) rather than 6+ skinny pills. For "today" metrics (precip, wind, humidity, UV), prefer **one** paragraph line or **2** short lines, not four separate chips unless truly necessary.

Running / fitness / navigation (app surface):
- Prefer **registry presets** with full One UI chrome — do not substitute plain input_summary_card when a specialized ID fits.
- **navigation_turn_card** — live turn-by-turn strip (arrow · distance · street instruction · optional ETA divider). Use for outdoor run, ride, walk with route guidance; content.label = distance ("In 200 m"), content.value = imperative turn text.
- **now-bar.dual-line** / **now-bar.single-line** / **now-bar.media-player** / **media_control_bar** — in-progress status pills (two-line status, single big metric, or audio). Pick **now-bar.single-line** for one dominant number (pace, heart zone); **now-bar.dual-line** for title+subtitle (e.g. split · lap time).
- When the scenario is **workout** or **running**, the interpreter often emits tag \`workout\`; still pick **navigation_turn_card** when the copy describes turns, streets, or distances to the next maneuver.

Music / playback (app or lock):
- Emit context tag **media-playing** (and often **now-bar:media**) when audio is active — the pipeline injects **now-bar.media-player** (pill transport + art) and **media-card** (larger album + controls) with real track-shaped placeholders.
- Prefer **now-bar.media-player** or **media_control_bar** for the bottom / ambient strip; **media-card** for the hero now-playing block. Do not collapse these into generic reminder_card / input_summary_card when the scenario is clearly music, podcast, or radio.`;
}

// ---------------------------------------------------------------------------
//  STEP 7 — EXPLANATION LAYER
// ---------------------------------------------------------------------------

function buildExplanationPrompt() {
  return `You are the EXPLANATION LAYER.

Your inputs are (a) the original scenario_text, (b) the resolved ui_state, (c) required_components, (d) layout_plan, (e) validation_report, (f) planner_notes. You do NOT make new decisions or invent components. You ONLY explain what the pipeline already decided and what the user should know.

Return STRICT JSON only:
{
  "why_this_ui": "string (1–3 sentences, plain language)",
  "what_was_prioritized": ["string", "..."],
  "what_was_removed_or_collapsed": ["string", "..."],
  "what_should_be_fixed": ["string", "..."]
}

RULES
- why_this_ui: cite the strongest ui_state signals (attention_mode, density_mode, mobility_mode, interaction_mode, background_policy) and the top-priority component. Max 3 sentences.
- what_was_prioritized: list component_type + one-line reason for each priority:1 item.
- what_was_removed_or_collapsed: use planner_notes.collapsed_optional_tasks; also list any priority:3 items flagged by layout_overflow_check.
- what_should_be_fixed: ONE line per validation.violations entry (include ruleId + message). If no violations, return [].
- JSON only. No prose. No markdown.`;
}

// ---------------------------------------------------------------------------
//  CANONICAL VIOLATION FACTORY + ID GEN
// ---------------------------------------------------------------------------

function makeIdGen(prefix) {
  let n = 0;
  return () => `${prefix}-${String(++n).padStart(3, '0')}`;
}

function buildViolation(fields) {
  const autoFix = fields.autoFix || { possible: false, action: null, value: null };
  const status  = fields.status || 'review-required';
  return {
    id:          fields.id,
    stage:       fields.stage,
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
//  validatePlan — canonical, camelCase only (stage='plan')
// ---------------------------------------------------------------------------

function validatePlan(plan) {
  // Vocabulary scope tracks RAG mode:
  //   RAG on  → allow all 92 registry types (selector sees a 30-item
  //             shortlist drawn from the full registry)
  //   RAG off → revert to the curated 10-item semantic vocabulary
  //             (selector only ever sees those 10 — strict legacy mode)
  const allowedVocab = new Set(
    RAG_ENABLED ? allowedComponentTypes() : allowedSemanticComponentTypes()
  );
  const components = (plan && plan.requiredComponents) || [];
  const idGen = makeIdGen('plan-v');
  const violations = [];

  components.forEach((c, idx) => {
    const type = c.componentType;
    if (!type) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'plan',
        ruleId:   'plan_missing_component_type',
        category: 'vocabulary',
        severity: 'high',
        status:   'review-required',
        element:  `requiredComponents[${idx}]`,
        property: 'componentType',
        actual:   null,
        expected: 'non-empty componentType',
        message:  `requiredComponents[${idx}] is missing componentType`
      }));
    } else if (!allowedVocab.has(type) && c._source !== 'mandatory-inject' && c.role !== 'chrome') {
      // Skip the vocabulary check for two cases:
      //  1. _source === 'mandatory-inject' — runPlan() programmatically
      //     injected this from generator_memory.json's mandatoryComponents.
      //  2. role === 'chrome' — the LLM correctly classified this as a
      //     structural chrome element (status bar, app bar, gesture bar).
      //     Chrome IDs (e.g. "container.status-bar-app", "container.header")
      //     live in the registry's `components` map but are intentionally
      //     omitted from `vocabulary.semantic_allowed_types` because we
      //     don't want LLM stages 1–3 selecting them as content. Once the
      //     LLM has labeled an entry role=chrome, the vocabulary scope
      //     no longer applies.
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'plan',
        ruleId:   'plan_vocabulary_violation',
        category: 'vocabulary',
        severity: 'high',
        status:   'review-required',
        element:  type,
        property: 'componentType',
        actual:   type,
        expected: Array.from(allowedVocab),
        message:  `componentType "${type}" is not in the semantic vocabulary`
      }));
    }
    if (c.priority == null || ![1, 2, 3].includes(c.priority)) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'plan',
        ruleId:   'plan_priority_out_of_range',
        category: 'consistency',
        severity: 'medium',
        status:   'review-required',
        element:  type || `requiredComponents[${idx}]`,
        property: 'priority',
        actual:   c.priority,
        expected: [1, 2, 3],
        message:  `priority must be 1, 2, or 3 (got ${JSON.stringify(c.priority)})`
      }));
    }
  });

  return { violations };
}

// ---------------------------------------------------------------------------
//  STEP 4 — LAYOUT COMPOSER (LLM)
//  ---------------------------------------------------------------------------
//  Turns (normalized planning packet, selected components) into a strict
//  layoutPlan with groups. This is the step that actually *composes* UI —
//  Steps 1–3 narrow semantics; Step 4 produces structure.
// ---------------------------------------------------------------------------

function buildComposerPrompt() {
  return `You are a layout composer for a state-based generative UI system.

You receive:
- a normalized planning packet from STEP 2
- a selected component list from STEP 3

Your job is to produce a strict layout plan.
Each selected component already has a fixed visual design in the client; you only
assign groups, order, and visibility — not new chrome or ad-hoc HTML.

You must compose from the given list, not invent.

You must NOT:
- invent new components
- reinterpret the original scenario
- generate free-form UI prose
- output visual styling commentary
- ignore the uiState
- rename component ids

You must:
- choose a layout container strategy
- assign variants to selected components
- decide ordering, grouping, and placement
- apply spacing and padding decisions
- decide whether lower-priority items should be visible, collapsed, or hidden
- preserve primary tasks first
- produce strict JSON only

Return STRICT JSON with this shape:

{
  "layoutPlan": {
    "container": "vertical-stack | horizontal-stack | grid | overlay-stack",
    "backgroundPolicy": "wallpaper | solid-dark | scrim-over-wallpaper | scrim-over-app | dialog-surface",
    "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
    "gap": 0,
    "groups": [
      {
        "groupId": "",
        "purpose": "",
        "role": "chrome | primary-task | supporting | tertiary | meta",
        "container": "vertical-stack | horizontal-stack | grid",
        "gap": 0,
        "children": [
          {
            "componentId": "",
            "variant": "",
            "slot": "",
            "role": "chrome | subject | state | action | feedback | context | navigation",
            "placement": "top | middle | bottom | leading | trailing | full-width",
            "priority": 1,
            "visibility": "visible | collapsed | hidden"
          }
        ]
      }
    ]
  },
  "composerNotes": {
    "layoutStrategy": "",
    "priorityPreservation": [],
    "collapsedComponents": [],
    "whyThisStructure": []
  }
}

TASK-UNIT THINKING (this is the core composer responsibility):
A "primary-task" group is the screen's main task unit. It bundles together
the components a user looks at and acts on as one logical thing:
  - 1 subject (the artifact: recipe step, message, song)
  - 0..n state (status: timer, progress, step counter, percent)
  - 0..n action (buttons / chips / toggles that operate on the subject)
  - 0..1 feedback (response to a recent action)
A user should look at a primary-task group and feel "these belong together."

Other group roles:
  - chrome      — wraps status bars, app bars, gesture bars (purely structural)
  - supporting  — context cards that frame the primary task (weather next to clock, tip card next to recipe)
  - tertiary    — lower-importance items (badges, secondary notifications)
  - meta        — meta-actions / overflow / settings shortcuts

Carry-over fields from Selected Components:
- children[].slot — copy verbatim from Selected Components. This is how the renderer identifies sibling task-unit members.
- children[].role — copy verbatim from Selected Components, refining ONLY when grouping requires (e.g. an "action" chip placed inside a chrome group becomes "navigation").

Examples of GOOD task units:
  group role=primary-task:
    - subject:    recipe_step_card     (slot=current_instruction)
    - state:      step_progress_bar    (slot=progress_3_of_5)
    - action:     next_button          (slot=advance_step)
  group role=primary-task:
    - subject:    media_card           (slot=now_playing)
    - state:      progress_bar         (slot=playback_position)
    - action:     play_pause_button    (slot=playback_control)

Anti-pattern (do NOT emit):
  group role=supporting:
    - context: action_chip   (action chip in a supporting group is incoherent — actions belong with their subject)

## Reference Layout

You will also receive a **Reference Layout** generated deterministically by the
design system engine (generator.js). It encodes One UI design guidelines:
  - Component ordering by weight (chrome → widgets → containers → navigation)
  - Screen-specific anchor positions (clock block, shortcut row, top status)
  - Mandatory components for the screen type
  - Pair-gap rules between adjacent component roles
  - Touch-target minimums and density constraints

**You MUST follow the Reference Layout ordering.** The reference determines:
  1. Which component comes first, second, third, etc.
  2. Which components anchor to fixed positions (top, bottom)
  3. The container strategy and spacing values

You MAY diverge from the reference ONLY when:
  - You need to group components that the reference lists sequentially
    (e.g., wrapping 3 chips into a horizontal-stack group is fine)
  - The reference has no opinion on a component (not listed) — place it
    by priority relative to its neighbors
  - attentionMode or densityMode require collapsing — drop from the
    reference tail first (highest index = lowest priority)

You MUST NOT reorder components against the reference. If the reference says
[status-bar, app-bar, content-card, bottom-nav], your groups[].children[]
must emit them in that exact sequence (possibly across groups).

Navigation components (bottom-nav, pill-tab, tab-bar) with placement "bottom"
in the reference MUST appear in the LAST group with placement: "bottom".

Composition rules:
- respect uiState.attentionMode
- respect uiState.densityMode
- respect uiState.interactionMode

VISIBILITY RULES (strict — over-collapsing is the most common quality regression):
- DEFAULT visibility = "visible" for ALL selected components
- priority=1 components: ALWAYS visible. Never collapse, never hide. Non-negotiable.
- priority=2 components: visible by DEFAULT. Only mark "collapsed" if you have CONCRETE evidence of viewport overflow (e.g. 6+ stacked cards on a 932px lock screen). Do NOT collapse priority-2 just because densityMode is "compressed" — compressed means tighter spacing, not fewer items.
- priority=3 components: visible by default. Mark "collapsed" only when (a) densityMode === "compressed" AND (b) you actually run out of vertical room.
- "hidden" is a last resort — almost never use it.
- If you mark anything as "collapsed", emit a brief one-line justification in composerNotes.collapsedComponents naming the overflow you anticipated.

Layout rules:
- if attentionMode is glanceable, prefer vertical-stack or simple overlay-stack (but glanceable does NOT mean "fewer components" — it means easier-to-scan layout)
- avoid dense multi-column layouts in glanceable mode
- if interactionMode is minimal-touch, prefer larger full-width or simply stacked components
- if overlayType is not none, assume limited usable space
- if backgroundPolicy is solid-dark, do not imply wallpaper-dependent layout logic
- componentId MUST match a componentType from the Selected Components list verbatim
- EVERY entry in Selected Components MUST appear in groups[].children[] at least once — silent omission is a hard error
- layoutPlan.backgroundPolicy MUST equal uiState.backgroundPolicy
- layoutPlan.padding and gap SHOULD match the Reference Layout spacing values
- output composition decisions, not descriptive prose

LAYOUT TEMPLATE INFERENCE (Tier 3 — pick a richer container shape based on the scenario, not always vertical-stack):
- HOME surface with 3+ widget cards (weather/calendar/widget-*) → use a "grid" container for the widget group (2-column). Same for quick-settings overlay (toggle row in grid).
- LOCK surface with media playback active → group should still be vertical-stack but reserve a hero slot for the media-card / now-bar.media-player at the top of primary-task.
- LOCK surface with 4+ small widgets (clock + weather-date + battery + activity + shortcut) → "grid" inside primary-task so they tile 2-up.
- APP surface with 1 dominant subject + 2-4 supporting cards → primary-task uses vertical-stack with the subject FIRST and visibly larger (priority=1 hero).
- APP surface with chip rows OR action rows → those go in horizontal-stack groups; the rest stays vertical-stack.
- NOTIFICATION-SHADE overlay → vertical-stack with notif-card / notif-card-ai stacked (no grid).
- Pick container='grid' when groups[].children would otherwise repeat the same component type 3+ times (e.g. 4 toggle chips, 4 widgets) — grid avoids the "wall of identical cards" anti-pattern.
- COOKING / recipe / kitchen assistant on an APP surface: target a **single fixed viewport — no scrolling inside the phone frame**. In primary-task use **vertical-stack** for the main recipe column (avoid **grid** for that column). Prefer **at most ~2 compact state lines** (current step + progress) and **one** optional short context card — not 3+ tall focus-blocks with long body text. Use **one** action_chip_row with every ingredient in **value** as **comma-separated** lines; each line may include fractions like "Parmesan 1/2 cup" (numeric slashes are preserved by the renderer). **Cap** ingredient chips at **5–6**. Bottom controls: **one** action row (Previous / Repeat / Next). Do not emit one action_chip_row per ingredient.

CONTAINER COVERAGE EXPECTATION:
- Don't always pick vertical-stack. A typical good output uses 2-3 different container types across its groups (e.g., chrome=vertical-stack, primary-task=grid for widgets, supporting=vertical-stack for content cards).`;
}

// ---------------------------------------------------------------------------
//  STEP 4 — VALIDATION (hard checks)
//  ---------------------------------------------------------------------------
//  Operates on the normalized composer output (camelCase, groups-based).
//  Returns canonical violation rows with stage='layout'.
// ---------------------------------------------------------------------------

function validateLayout(layoutPlan, uiState, plan, referenceLayout) {
  const violations = [];
  const lp     = layoutPlan || {};
  const groups = Array.isArray(lp.groups) ? lp.groups : [];
  const idGen  = makeIdGen('layout-v');

  const selectedTypes = new Set(
    ((plan && plan.requiredComponents) || [])
      .map(c => c.componentType)
      .filter(Boolean)
  );

  const allChildren = [];
  groups.forEach(g => {
    (g.children || []).forEach(ch => {
      allChildren.push({ ...ch, _groupId: g.groupId, _groupContainer: g.container });
    });
  });

  // 1. unknown componentIds
  allChildren.forEach(ch => {
    if (!selectedTypes.has(ch.componentId)) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'unknown_component_id',
        category: 'consistency',
        severity: 'high',
        status:   'review-required',
        element:  ch.componentId,
        property: 'componentId',
        actual:   ch.componentId,
        expected: Array.from(selectedTypes),
        message:  `componentId "${ch.componentId}" is not in STEP 3 requiredComponents`
      }));
    }
  });

  // 2. invalid variants (registry states)
  allChildren.forEach(ch => {
    if (!REGISTRY || !REGISTRY.components) return;
    const spec = REGISTRY.components[ch.componentId];
    if (!spec) return;
    const states = Array.isArray(spec.states) ? spec.states : [];
    if (!ch.variant || ch.variant === 'default') return;
    if (!states.includes(ch.variant)) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'invalid_variant',
        category: 'vocabulary',
        severity: 'medium',
        status:   'review-required',
        element:  ch.componentId,
        property: 'variant',
        actual:   ch.variant,
        expected: states,
        message:  `variant "${ch.variant}" not in registry states [${states.join(', ')}] for "${ch.componentId}"`
      }));
    }
  });

  // 3. densityMode === 'compressed' → priority 3 must not remain visible
  if (uiState && uiState.densityMode === 'compressed') {
    allChildren.forEach(ch => {
      if (ch.priority === 3 && ch.visibility === 'visible') {
        violations.push(buildViolation({
          id:       idGen(),
          stage:    'layout',
          ruleId:   'compressed_priority3_visible',
          category: 'layout',
          severity: 'medium',
          status:   'auto-fixable',
          element:  ch.componentId,
          property: 'visibility',
          actual:   'visible',
          expected: 'collapsed|hidden',
          message:  `priority 3 child "${ch.componentId}" must be collapsed or hidden when densityMode=compressed`,
          autoFix:  { possible: true, action: 'setVisibility', value: 'collapsed' }
        }));
      }
    });
  }

  // 4. attentionMode === 'glanceable' → no top-level grid, no grid groups with >2 children
  if (uiState && uiState.attentionMode === 'glanceable') {
    if (lp.container === 'grid') {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'glanceable_forbids_grid_root',
        category: 'layout',
        severity: 'high',
        status:   'review-required',
        element:  'layoutPlan',
        property: 'container',
        actual:   'grid',
        expected: 'vertical-stack|overlay-stack',
        message:  'attentionMode=glanceable forbids grid as top-level container'
      }));
    }
    groups.forEach(g => {
      if (g.container === 'grid' && (g.children || []).length > 2) {
        violations.push(buildViolation({
          id:       idGen(),
          stage:    'layout',
          ruleId:   'glanceable_grid_too_wide',
          category: 'layout',
          severity: 'medium',
          status:   'review-required',
          element:  g.groupId,
          property: 'children.length',
          actual:   (g.children || []).length,
          expected: 2,
          delta:    (g.children || []).length - 2,
          message:  `attentionMode=glanceable forbids grid groups with >2 children (found ${(g.children||[]).length})`
        }));
      }
    });
  }

  // 5. interactionMode === 'minimal-touch' → no dense horizontal clusters
  if (uiState && uiState.interactionMode === 'minimal-touch') {
    groups.forEach(g => {
      if (g.container === 'horizontal-stack' && (g.children || []).length > 3) {
        violations.push(buildViolation({
          id:       idGen(),
          stage:    'layout',
          ruleId:   'minimal_touch_dense_cluster',
          category: 'touch-target',
          severity: 'medium',
          status:   'review-required',
          element:  g.groupId,
          property: 'children.length',
          actual:   (g.children || []).length,
          expected: 3,
          delta:    (g.children || []).length - 3,
          message:  `interactionMode=minimal-touch forbids horizontal-stack groups with >3 children (found ${(g.children||[]).length})`
        }));
      }
    });
  }

  // 6. overlayType !== 'none' → at most 2 groups with visible children
  if (uiState && uiState.overlayType && uiState.overlayType !== 'none') {
    const visibleGroups = groups.filter(g => (g.children || []).some(ch => ch.visibility === 'visible'));
    if (visibleGroups.length > 2) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'overlay_too_many_groups',
        category: 'layout',
        severity: 'medium',
        status:   'review-required',
        element:  'layoutPlan',
        property: 'groups.visibleCount',
        actual:   visibleGroups.length,
        expected: 2,
        delta:    visibleGroups.length - 2,
        message:  `overlayType=${uiState.overlayType} limits visible groups to 2; found ${visibleGroups.length}`
      }));
    }
  }

  // 7. priority 1 must remain visible
  allChildren.forEach(ch => {
    if (ch.priority === 1 && (ch.visibility === 'hidden' || ch.visibility === 'collapsed')) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'priority1_removed',
        category: 'consistency',
        severity: 'high',
        status:   'review-required',
        element:  ch.componentId,
        property: 'visibility',
        actual:   ch.visibility,
        expected: 'visible',
        message:  `priority 1 component "${ch.componentId}" must not be hidden or collapsed`
      }));
    }
  });

  // 8. backgroundPolicy mismatch
  if (uiState && uiState.backgroundPolicy && lp.backgroundPolicy
      && lp.backgroundPolicy !== uiState.backgroundPolicy) {
    violations.push(buildViolation({
      id:       idGen(),
      stage:    'layout',
      ruleId:   'background_policy_mismatch',
      category: 'context',
      severity: 'high',
      status:   'review-required',
      element:  'layoutPlan',
      property: 'backgroundPolicy',
      actual:   lp.backgroundPolicy,
      expected: uiState.backgroundPolicy,
      message:  `layoutPlan.backgroundPolicy=${lp.backgroundPolicy} must equal uiState.backgroundPolicy=${uiState.backgroundPolicy}`
    }));
  }

  // 9. Reference Layout ordering check
  //    Verify the LLM's output follows the deterministic reference ordering.
  //    Emits medium-severity violations for out-of-order components and
  //    high-severity for navigation components not placed at the bottom.
  if (referenceLayout && Array.isArray(referenceLayout.orderedComponents)) {
    const refOrder = referenceLayout.orderedComponents.map(r => r.componentId);
    // Extract the LLM's actual ordering by walking groups[].children[]
    const actualOrder = [];
    groups.forEach(g => {
      (g.children || []).forEach(ch => {
        if (ch.visibility !== 'hidden') actualOrder.push(ch.componentId);
      });
    });

    // Check pairwise ordering: for any two components A,B where A appears
    // before B in refOrder, A should also appear before B in actualOrder.
    const refIdx = {};
    refOrder.forEach((id, i) => { refIdx[id] = i; });
    for (let i = 0; i < actualOrder.length - 1; i++) {
      const a = actualOrder[i], b = actualOrder[i + 1];
      if (refIdx[a] != null && refIdx[b] != null && refIdx[a] > refIdx[b]) {
        violations.push(buildViolation({
          id:       idGen(),
          stage:    'layout',
          ruleId:   'reference_order_mismatch',
          category: 'ordering',
          severity: 'medium',
          status:   'review-required',
          element:  b,
          property: 'order',
          actual:   `${a} (ref#${refIdx[a]}) before ${b} (ref#${refIdx[b]})`,
          expected: `${b} before ${a} per reference`,
          message:  `"${a}" appears before "${b}" but reference layout expects the opposite order`
        }));
      }
    }

    // Check navigation anchor: nav components must be in the last group
    const navRefEntries = referenceLayout.orderedComponents.filter(r => r.placement === 'bottom');
    const navIds = new Set(navRefEntries.map(r => r.componentId));
    if (navIds.size > 0 && groups.length > 0) {
      const lastGroup = groups[groups.length - 1];
      const lastGroupIds = new Set((lastGroup.children || []).map(ch => ch.componentId));
      navIds.forEach(navId => {
        if (actualOrder.includes(navId) && !lastGroupIds.has(navId)) {
          violations.push(buildViolation({
            id:       idGen(),
            stage:    'layout',
            ruleId:   'nav_not_at_bottom',
            category: 'ordering',
            severity: 'high',
            status:   'review-required',
            element:  navId,
            property: 'placement',
            actual:   'not in last group',
            expected: 'last group (bottom-anchored)',
            message:  `"${navId}" must be in the last layout group (bottom-anchored per One UI guidelines)`
          }));
        }
      });
    }
  }

  // 10. Task-unit coherence: every primary-task group must contain a subject child.
  //     Without a subject, the group has no central artifact for the user to act
  //     on — children become a flat pile rather than a coherent task unit.
  groups.forEach(g => {
    if (g.role !== 'primary-task') return;
    const visibleChildren = (g.children || []).filter(ch => ch.visibility !== 'hidden');
    const hasSubject = visibleChildren.some(ch => ch.role === 'subject');
    if (visibleChildren.length > 0 && !hasSubject) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'primary_task_missing_subject',
        category: 'composition',
        severity: 'medium',
        status:   'review-required',
        element:  g.groupId,
        property: 'children[].role',
        actual:   visibleChildren.map(c => c.role),
        expected: 'at least one role="subject"',
        message:  `primary-task group "${g.groupId}" has no subject child; a primary task must center on one artifact (use role="subject" on its main component)`
      }));
    }
  });

  // 11. Orphan actions: action children should sit in a primary-task group near
  //     their subject. An action in a chrome / supporting group is usually a
  //     misclassification (e.g. a "Save" button placed in chrome).
  groups.forEach(g => {
    if (g.role !== 'chrome' && g.role !== 'supporting') return;
    const orphans = (g.children || []).filter(ch =>
      ch.role === 'action' && ch.visibility !== 'hidden');
    orphans.forEach(ch => {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'orphan_action',
        category: 'composition',
        severity: 'low',
        status:   'review-required',
        element:  ch.componentId,
        property: 'group.role',
        actual:   g.role,
        expected: 'primary-task',
        message:  `action child "${ch.componentId}" sits in a ${g.role} group; actions should live in a primary-task group near their subject`
      }));
    });
  });

  // 12. Duplicate content across slots — when two requiredComponents share a
  //     componentType, their content.label / content.value must differ. The
  //     selector LLM tends to repeat placeholder text across slots when the
  //     scenario implies the same atomic for multiple purposes (e.g. three
  //     input_summary_cards all saying "Ingredients / Quantities..."). This
  //     catches it programmatically so the user sees a clear violation
  //     instead of silently-bad output.
  const _planComps = ((plan && plan.requiredComponents) || []);
  const _bySharedType = {};
  _planComps.forEach(c => {
    if (!c.componentType) return;
    if (!_bySharedType[c.componentType]) _bySharedType[c.componentType] = [];
    _bySharedType[c.componentType].push(c);
  });
  Object.keys(_bySharedType).forEach(type => {
    const peers = _bySharedType[type];
    if (peers.length < 2) return;
    for (let i = 0; i < peers.length; i++) {
      for (let j = i + 1; j < peers.length; j++) {
        const a = peers[i], b = peers[j];
        const aL = (a.content && a.content.label) || '';
        const aV = (a.content && a.content.value) || '';
        const bL = (b.content && b.content.label) || '';
        const bV = (b.content && b.content.value) || '';
        const aSlot = a.slot || '';
        const bSlot = b.slot || '';
        if (aSlot !== bSlot && aL === bL && aV === bV) {
          violations.push(buildViolation({
            id:       idGen(),
            stage:    'layout',
            ruleId:   'duplicate_content_across_slots',
            category: 'content',
            severity: 'medium',
            status:   'review-required',
            element:  type,
            property: 'content',
            actual:   { slotA: aSlot, slotB: bSlot, label: aL, value: aV },
            expected: 'distinct content per slot',
            message:  `"${type}" appears in slots "${aSlot}" and "${bSlot}" with identical content — each slot needs distinct, scenario-specific text`
          }));
        }
      }
    }
  });

  // 13. Subject with generic label — a component with role="subject" is the
  //     screen's primary artifact. Its label should be concrete + scenario-
  //     specific, NOT a generic placeholder ("Item", "Content", "Untitled",
  //     "Label", or empty). Catches cases where the LLM puts a real
  //     componentType in the subject slot but never wrote real label text.
  const _GENERIC_LABEL = /^\s*(item|content|title|untitled|label|value|none|text|placeholder|input|—|-)\s*$/i;
  allChildren.forEach(ch => {
    if (ch.role !== 'subject') return;
    if (ch.visibility === 'hidden') return;
    const planEntry = _planComps.find(p =>
      p.componentType === ch.componentId &&
      (!ch.slot || p.slot === ch.slot)
    );
    if (!planEntry) return;
    const label = (planEntry.content && planEntry.content.label) || '';
    if (!label || _GENERIC_LABEL.test(label)) {
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'subject_generic_label',
        category: 'content',
        severity: 'medium',
        status:   'review-required',
        element:  ch.componentId,
        property: 'content.label',
        actual:   label || '(empty)',
        expected: 'concrete, scenario-specific label',
        message:  `subject "${ch.componentId}" (slot="${ch.slot || planEntry.slot}") has empty/generic label "${label}" — the screen's main artifact must have concrete text`
      }));
    }
  });

  // 14. Action role only when scenario implies action — a child with role
  //     "action" should correspond to a control / edit / configure task,
  //     not to an inform-only scenario. Heuristic: if NONE of the plan's
  //     requiredComponents are tagged action-y in their slot name (e.g.
  //     "save", "submit", "next", "advance", "control", "edit"), and yet
  //     a layout child has role="action", flag it. This is a soft check —
  //     low severity — because the LLM may legitimately add affordances.
  const _actionSlotPattern = /save|submit|next|advance|control|edit|toggle|action|navigate|confirm|primary|cta/i;
  const _planHasActionySlot = _planComps.some(p =>
    p.role === 'action' || _actionSlotPattern.test(p.slot || ''));
  if (!_planHasActionySlot) {
    allChildren.forEach(ch => {
      if (ch.role !== 'action' || ch.visibility === 'hidden') return;
      violations.push(buildViolation({
        id:       idGen(),
        stage:    'layout',
        ruleId:   'action_without_control_task',
        category: 'composition',
        severity: 'low',
        status:   'review-required',
        element:  ch.componentId,
        property: 'role',
        actual:   'action',
        expected: 'context (or downgrade to non-action role)',
        message:  `"${ch.componentId}" is role="action" but the scenario plan has no action-implying tasks (no slot matches save/submit/next/edit/control/toggle) — verify the user can actually act here`
      }));
    });
  }

  return { violations };
}

// ---------------------------------------------------------------------------
//  STEP 4 — RUNNER
//  ---------------------------------------------------------------------------
//  LLM composer → normalize → validateLayout + context/overflow validators.
//  Returns the canonical composed output and the merged layout-stage
//  violations (still canonical rows; rollup happens at the orchestrator).
// ---------------------------------------------------------------------------

// Resolve a features object into the canonical { flag: boolean } map.
// Defaults are ON so existing callers (no features object) keep
// pre-toggle behavior; explicit `false` turns a feature off.
function _resolveFeatures(input) {
  const f = (input && typeof input === 'object') ? input : {};
  return {
    contentBag:        f.contentBag         !== false,
    rag:               f.rag                !== false,
    explain:           f.explain            !== false,
    // Opt-in: static “same preset × N, only text changes” layouts need these OFF
    // unless the client explicitly checks the GenUI pipeline toggles.
    dedup:             f.dedup              === true,
    typeCap:           f.typeCap            === true,
    autoGrid:          f.autoGrid           !== false,
    chromeMigration:   f.chromeMigration    !== false,
    roleReorder:       f.roleReorder        !== false,
    composerBackfill:  f.composerBackfill   !== false,
    mandatoryInject:   f.mandatoryInject    !== false,
    contextInject:     f.contextInject      !== false,
    // Default ON: skip composer LLM — stitch selected presets in reference order
    // (customize-gallery “drag tiles” model). Turn off to restore LLM composer.
    presetStitch:      f.presetStitch       !== false
  };
}

function _isChromePlanEntry(c) {
  if (!c) return false;
  return c.role === 'chrome'
    || c._source === 'mandatory-inject'
    || PIPELINE_CHROME_ROLE_IDS.has(c.componentType);
}

/**
 * Deterministic Step-4 layout: one layout group per chrome strip + one primary-task
 * group where every selected content preset is a single child (same registry shell as
 * /customize). Order follows Generator reference layout when available.
 */
function buildPresetStitchComposed({ planningPacket, plan, referenceLayout, scenarioText }) {
  const uiState = (planningPacket && planningPacket.uiState) || {};
  const scenario = scenarioText || '';
  const comps = (plan && plan.requiredComponents) || [];
  const refOrder = (referenceLayout && referenceLayout.orderedComponents) || [];
  const orderIdx = {};
  refOrder.forEach((oc, i) => {
    const id = oc.componentId;
    if (id && orderIdx[id] === undefined) orderIdx[id] = i;
  });
  function sortByRef(a, b) {
    const ia = orderIdx[a.componentType];
    const ib = orderIdx[b.componentType];
    if (ia != null && ib != null && ia !== ib) return ia - ib;
    if (ia != null && ib == null) return -1;
    if (ia == null && ib != null) return 1;
    return (a._stitchIdx ?? 0) - (b._stitchIdx ?? 0);
  }
  const indexed = comps.map((c, i) => Object.assign({}, c, { _stitchIdx: i }));
  const chromeComps = indexed.filter(_isChromePlanEntry).sort(sortByRef);
  const contentComps = indexed.filter(c => !_isChromePlanEntry(c)).sort(sortByRef);

  const pad = (referenceLayout && referenceLayout.padding) || { top: 16, right: 18, bottom: 0, left: 18 };
  const gap = (referenceLayout && referenceLayout.gap) != null ? referenceLayout.gap : 12;
  const glance = uiState.attentionMode === 'glanceable';
  const avoidGrid = /recipe|cooking|kitchen|instruction|step\b/i.test(scenario);
  // 2-column grid ONLY when there are exactly two content tiles — a phone
  // viewport cannot fit 3–4 presets side-by-side without paper-thin columns
  // and per-character wrapping (weather "18°" broken vertically, etc.).
  // Three or more presets → full-width vertical stack (readable, One UI–like).
  let useGrid = !avoidGrid && contentComps.length === 2;
  if (glance) {
    useGrid = !avoidGrid && contentComps.length === 2;
  }
  const rootContainer = glance
    ? 'vertical-stack'
    : ((referenceLayout && referenceLayout.container) || 'vertical-stack');

  const bgPolicy = uiState.backgroundPolicy || 'scrim-over-wallpaper';

  const groups = [];
  if (chromeComps.length) {
    groups.push({
      groupId: 'group_chrome_preset_stitch',
      purpose: 'Chrome (reference order)',
      role: 'chrome',
      container: 'vertical-stack',
      gap: Math.max(6, gap - 4),
      children: chromeComps.map(c => ({
        componentId: c.componentType,
        variant: c.variantHint || 'default',
        slot: c.slot || '',
        role: 'chrome',
        placement: 'top',
        priority: c.priority != null ? c.priority : 1,
        visibility: 'visible'
      }))
    });
  }
  if (contentComps.length) {
    const g = {
      groupId: 'group_primary_preset_stitch',
      purpose: 'Registered presets (stitched)',
      role: 'primary-task',
      container: useGrid ? 'grid' : 'vertical-stack',
      gap,
      children: contentComps.map(c => ({
        componentId: c.componentType,
        variant: c.variantHint || 'default',
        slot: c.slot || '',
        role: c.role || 'subject',
        placement: useGrid ? 'middle' : 'full-width',
        priority: c.priority != null ? c.priority : 2,
        visibility: 'visible'
      }))
    };
    if (useGrid) g.gridColumns = 2;
    groups.push(g);
  }

  return {
    layoutPlan: {
      container: rootContainer,
      backgroundPolicy: bgPolicy,
      padding: pad,
      gap,
      groups
    },
    composerNotes: {
      layoutStrategy: 'preset-stitch',
      priorityPreservation: [],
      collapsedComponents: [],
      whyThisStructure: [
        'Deterministic composer: each STEP-3 component is one preset tile in reference order (gallery stitch).'
      ]
    }
  };
}

async function runComposeLayout({ planningPacket, plan, llmCall, viewport, scenarioText, fastMode, features }) {
  const _F = _resolveFeatures(features);
  if (!llmCall && !_F.presetStitch) {
    throw new Error('runComposeLayout requires llmCall(systemPrompt, userMessage)');
  }
  if (!planningPacket) throw new Error('runComposeLayout requires planningPacket');
  if (!plan)           throw new Error('runComposeLayout requires plan');
  const scenario = scenarioText || '';

  // --- Pre-filter: single-point component filtering via Generator rules ---
  //
  // NON-MUTATING: earlier revisions did `plan.requiredComponents = plan...
  // .filter(...)` which mutated the caller's plan object. When the
  // streaming endpoint sent `step_done.plan` (still holding the full
  // list) and then the final `done` event (observing the post-filter
  // list), the two payloads disagreed — looked like data was being
  // wiped. We now build a local filtered copy without touching the
  // shared plan.
  const uiStatePre = planningPacket.uiState;
  let filteredPlan = plan;
  if (plan && Array.isArray(plan.requiredComponents)) {
    const ids = plan.requiredComponents.map(c => c.componentType).filter(Boolean);
    const allowed = preFilterComponents(ids, uiStatePre);
    const allowedSet = new Set(allowed);
    filteredPlan = Object.assign({}, plan, {
      requiredComponents: plan.requiredComponents.filter(
        c => !c.componentType || allowedSet.has(c.componentType)
      )
    });
  }
  // For the rest of this function, use `filteredPlan` instead of `plan`.
  plan = filteredPlan;

  // --- Reference Layout: deterministic order + positions from generator.js ---
  // This gives the LLM a design-system-grounded ordering to follow rather than
  // inventing its own sequence. Generator.resolveOrder applies weight-based
  // sorting (chrome→widgets→containers→navigation→gesture), mandatory component
  // injection, collapse rules, and screen-specific anchors.
  let referenceLayout = null;
  try {
    const refIds = (plan.requiredComponents || [])
      .map(c => c.componentType).filter(Boolean);
    const uiStateRef = planningPacket.uiState || {};
    const ordered   = Generator.resolveOrder(uiStateRef, refIds, DesignMemory, { skipCollapse: true });
    const positions = Generator.resolvePositions(uiStateRef, ordered, DesignMemory);
    const spacing   = Generator.resolveSpacing(uiStateRef, DesignMemory);

    referenceLayout = {
      _note: 'Deterministic reference from One UI design system rules. Follow this ordering.',
      container: spacing ? spacing.container : 'vertical-stack',
      padding:   spacing ? spacing.outerPadding : { top: 16, right: 18, bottom: 0, left: 18 },
      gap:       spacing ? spacing.gap : 10,
      orderedComponents: positions.map(function (pos, idx) {
        return {
          index:     idx,
          componentId: pos.id,
          role:      pos.role,
          placement: (pos.top != null && pos.top <= 30) ? 'top'
                   : (pos.id && (pos.id.includes('nav') || pos.id.includes('pill-tab') || pos.id.includes('gesture'))) ? 'bottom'
                   : 'middle',
          anchorFixed: !!(pos.top != null && pos.top <= 30) ||
                       !!(pos.id && (pos.id.includes('nav') || pos.id.includes('pill-tab') || pos.id.includes('gesture'))),
          position:  { top: pos.top, left: pos.left, width: pos.width, height: pos.height }
        };
      })
    };
  } catch (e) {
    console.warn('[pipeline] Reference layout generation failed (non-fatal):', e.message);
  }

  let composed;
  if (_F.presetStitch) {
    composed = buildPresetStitchComposed({
      planningPacket,
      plan,
      referenceLayout,
      scenarioText: scenario
    });
    console.log('[pipeline] Preset stitch: deterministic layout (composer LLM skipped).');
  } else {
    const refSection = referenceLayout
      ? `\n\nReference Layout (from design system rules — follow this ordering):\n${JSON.stringify(referenceLayout, null, 2)}`
      : '';

    const kbContext = buildPromptContext('composer', planningPacket.uiState);
    const selectedIds = (plan.requiredComponents || []).map(c => c.componentType);
    const variantRef  = buildVariantReference(selectedIds);

    const userMessage =
      kbContext + '\n\n---\n\n' +
      (variantRef ? variantRef + '\n\n---\n\n' : '') +
      (scenario ? `User Scenario:\n${scenario}\n\n` : '') +
      `Normalized Planning Packet:\n${JSON.stringify(planningPacket)}\n\n` +
      `Selected Components:\n${JSON.stringify(plan)}\n\n` +
      `IMPORTANT — closed-world rule:\n` +
      `1. groups[].children[].componentId MUST come ONLY from the componentType field of the entries in Selected Components above. Never introduce IDs that are not in that list, even if the surface "feels" incomplete.\n` +
      `2. EVERY entry in Selected Components MUST appear at least once in groups[].children[]. Silent omission is a hard error.\n` +
      `3. DEFAULT visibility for every child is "visible". Mark a child "collapsed" only if it is priority=3 AND densityMode is "compressed" AND you genuinely lack vertical room. Never collapse priority=1 or priority=2 by default — the user explicitly asked for them.` +
      refSection;

    const FAST_HINT_C = '\n\n[FAST MODE] Keep response MINIMAL. composerNotes.whyThisStructure[] must have at most 2 entries. priorityPreservation[] at most 2 entries. collapsedComponents[] at most 1 entry. Keep layoutPlan complete and accurate — do NOT trim groups or children.';
    const sysComp  = buildComposerPrompt() + (fastMode ? FAST_HINT_C : '');
    const raw      = await llmCall(sysComp, userMessage);
    composed = normalizeComposerOutput(raw);
  }
  const uiState  = planningPacket.uiState;

  // ── Post-composer chrome enforcement ──────────────────────────────
  // The composer LLM occasionally places content components inside the
  // chrome group when their slot name looks chrome-flavored (e.g.
  // "content-input_summary_card", "container-area"). This produces the
  // exact misplaced-widget symptom my Stage 3 chrome-role correction
  // tried to prevent — but at a different layer. Here we sweep the
  // composed layout: any non-chrome child sitting in a chrome group
  // gets migrated to a content group (supporting if it exists, else
  // a new primary-task slot at the end).
  // Skippable via features.chromeMigration=false.
  if (_F.chromeMigration && composed.layoutPlan && Array.isArray(composed.layoutPlan.groups)) {
    const planRoleByType = {};
    (plan.requiredComponents || []).forEach(c => {
      if (c.componentType && !planRoleByType[c.componentType]) {
        planRoleByType[c.componentType] = c.role;
      }
    });
    let migrated = 0;
    const movingChildren = [];
    composed.layoutPlan.groups.forEach(g => {
      if (g.role !== 'chrome') return;
      const stayingChildren = [];
      (g.children || []).forEach(ch => {
        // Keep: explicit chrome role OR plan said chrome (mandatory-inject)
        if (ch.role === 'chrome' || planRoleByType[ch.componentId] === 'chrome') {
          stayingChildren.push(ch);
        } else {
          movingChildren.push(ch);
          migrated++;
        }
      });
      g.children = stayingChildren;
    });
    if (movingChildren.length) {
      // Find or create a destination group for migrated children.
      let dest = composed.layoutPlan.groups.find(g => g.role === 'supporting');
      if (!dest) dest = composed.layoutPlan.groups.find(g => g.role === 'primary-task');
      if (!dest) {
        dest = {
          groupId:    'group_misplaced_chrome',
          purpose:    'Components migrated out of chrome (composer misplacement)',
          role:       'supporting',
          container:  'vertical-stack',
          gap:        12,
          children:   []
        };
        composed.layoutPlan.groups.push(dest);
      }
      dest.children = (dest.children || []).concat(movingChildren);
      composed.composerNotes = composed.composerNotes || {};
      composed.composerNotes.chromeMigrated = migrated;
      console.log('[pipeline] composer post-fix: migrated ' + migrated + ' non-chrome child(ren) out of chrome groups → ' + dest.groupId);
    }
  }

  // ── Role-based child ordering (One UI canonical sequence) ─────────
  // Samsung One UI groups read top-to-bottom in this order regardless
  // of priority numeric:
  //   subject → state → context → action → feedback → navigation
  // Without this pass, the LLM sometimes places an action chip ABOVE
  // its subject card (because priority=1 was on the action) — feels
  // backwards. Within a group, this stable-sorts children by role rank.
  // Chrome group is exempt (chrome has its own structural ordering
  // driven by the reference layout: status-bar → header → gesture-bar).
  // Skippable via features.roleReorder=false.
  if (_F.roleReorder && composed.layoutPlan && Array.isArray(composed.layoutPlan.groups)) {
    const ROLE_RANK = { subject: 1, state: 2, context: 3, action: 4, feedback: 5, navigation: 6 };
    let reordered = 0;
    composed.layoutPlan.groups.forEach(g => {
      if (g.role === 'chrome') return;
      if (!Array.isArray(g.children) || g.children.length < 2) return;
      // Pair each child with its original index for stable sort.
      const indexed = g.children.map((c, i) => ({ c, i }));
      const beforeOrder = indexed.map(x => x.c.componentId).join(',');
      indexed.sort((a, b) => {
        const ra = ROLE_RANK[a.c.role] != null ? ROLE_RANK[a.c.role] : 99;
        const rb = ROLE_RANK[b.c.role] != null ? ROLE_RANK[b.c.role] : 99;
        if (ra !== rb) return ra - rb;
        // Same role → keep original order (stable)
        return a.i - b.i;
      });
      g.children = indexed.map(x => x.c);
      const afterOrder = g.children.map(c => c.componentId).join(',');
      if (beforeOrder !== afterOrder) reordered += 1;
    });
    if (reordered) {
      composed.composerNotes = composed.composerNotes || {};
      composed.composerNotes.roleReordered = reordered;
      console.log('[pipeline] composer post-fix: role-reordered ' + reordered + ' group(s) to subject→state→context→action→feedback');
    }
  }

  // ── Auto-grid for repeated same-type TILE cards ───────────────────
  // When a non-chrome group has 3+ children of the same componentType
  // and that type is a COMPACT TILE (icon + 1-2 short lines), promoting
  // the container to 2-column grid gives a widget-board feel. But for
  // TEXT-HEAVY cards (recipe steps, message previews, ETA bodies,
  // calendar entries) a 2-col grid clips the body text at ~190px wide
  // — ending up with "Sauté kimchi and onion for 3 min, the..." cut off.
  // So we whitelist: only grid types that are designed to live in tile
  // grids. Everything else stays vertical-stack (full-width readable).
  const GRID_FRIENDLY_IDS = new Set([
    'weather_glance_card',
    'qs-toggle',
    'quick_toggle_row',
    'shortcut',
    'shortcut_tile',
    'lock-screen.shortcut-circle',
    'widget-small',
    'badge',
    'btn-contained',
    'btn-outlined',
    'btn-flat',
    'fab',
    'chip'
  ]);
  // Skippable via features.autoGrid=false.
  if (_F.autoGrid && composed.layoutPlan && Array.isArray(composed.layoutPlan.groups)) {
    let gridded = 0;
    composed.layoutPlan.groups.forEach(g => {
      if (g.role === 'chrome') return;
      if (g.container === 'grid' || g.container === 'horizontal-stack') return;
      const children = g.children || [];
      if (children.length < 3) return;
      const byType = {};
      children.forEach(c => {
        const t = c.componentId || '';
        byType[t] = (byType[t] || 0) + 1;
      });
      // Find the dominant repeated type (3+ instances).
      let dominant = null;
      let dominantCount = 0;
      Object.keys(byType).forEach(t => {
        if (byType[t] > dominantCount) {
          dominant = t;
          dominantCount = byType[t];
        }
      });
      if (dominantCount < 3) return;
      // Only auto-grid if the dominant type is in the tile whitelist.
      // Text-heavy cards (input_summary_card, reminder_card, etc.) stay
      // vertical-stack so their body text isn't clipped at half width.
      if (!GRID_FRIENDLY_IDS.has(dominant)) return;
      g.container = 'grid';
      g.gridColumns = 2;
      gridded += 1;
    });
    if (gridded) {
      composed.composerNotes = composed.composerNotes || {};
      composed.composerNotes.autoGridded = gridded;
      console.log('[pipeline] composer post-fix: auto-grid promoted ' + gridded + ' group(s) (3+ same-type TILE cards)');
    }
  }

  // Programmatic backfill: the composer LLM frequently drops Selected
  // Components silently — the closed-world rule in the prompt is advisory
  // and gets ignored under cognitive load (long prompt, many components).
  // Verified across multiple test scenarios: 7-pick plans coming back as
  // 4-child layouts. Here we deterministically append any missing plan
  // entries to an appropriate group with visibility="visible", so the
  // layout always reflects the selector's full intent.
  // Skippable via features.composerBackfill=false.
  if (_F.composerBackfill && composed.layoutPlan && Array.isArray(composed.layoutPlan.groups)) {
    const groups = composed.layoutPlan.groups;
    const presentIds = new Set();
    groups.forEach(g => {
      (g.children || []).forEach(ch => {
        if (ch && ch.componentId) presentIds.add(ch.componentId);
      });
    });
    const planComps = (plan && plan.requiredComponents) || [];
    const missing = planComps.filter(c => c.componentType && !presentIds.has(c.componentType));
    if (missing.length) {
      // Bucketize by role: chrome → chrome group; everything else → primary
      // task group (or first non-chrome group; or create one).
      const findGroup = (predicate, fallbackRole) => {
        let g = groups.find(predicate);
        if (g) return g;
        // Create a new group at the appropriate position.
        g = {
          groupId:    `group_backfill_${fallbackRole}`,
          purpose:    `Backfilled missing ${fallbackRole} components`,
          role:       fallbackRole,
          container:  'vertical-stack',
          gap:        12,
          children:   []
        };
        groups.push(g);
        return g;
      };
      const backfilled = [];
      missing.forEach(comp => {
        const isChrome = comp.role === 'chrome' || comp._source === 'mandatory-inject';
        const target = isChrome
          ? findGroup(g => g.role === 'chrome', 'chrome')
          : findGroup(g => g.role === 'primary-task' || g.role === 'supporting', 'primary-task');
        target.children.push({
          componentId: comp.componentType,
          variant:     comp.variantHint || 'default',
          slot:        comp.slot || '',
          role:        comp.role || (isChrome ? 'chrome' : 'subject'),
          placement:   isChrome ? 'top' : 'middle',
          priority:    comp.priority || 2,
          visibility:  'visible',
          _source:     'composer-backfill'
        });
        backfilled.push(comp.componentType);
      });
      composed.composerNotes = composed.composerNotes || {};
      composed.composerNotes.backfilled = backfilled;
      console.log(`[pipeline] composer backfill: appended ${backfilled.length} missing component(s) to layout: ${backfilled.join(', ')}`);
    }
  }

  const hardChecks = validateLayout(composed.layoutPlan, uiState, plan, referenceLayout);

  const ctxIdGen  = makeIdGen('layout-c');
  const ovfIdGen  = makeIdGen('layout-o');
  const ctxViolations = validateContextComponentMatch(composed.layoutPlan, uiState, plan, ctxIdGen);
  const ovfViolations = validateLayoutOverflow(composed.layoutPlan, uiState, viewport, ovfIdGen);

  const violations = [].concat(hardChecks.violations, ctxViolations, ovfViolations);
  return { composed, violations, referenceLayout };
}

// ---------------------------------------------------------------------------
//  STAGE 1+2 (MERGED) — runInterpretAndNormalize
//  Single LLM call producing both interpretation + planning packet. Exposed
//  separately so the streaming endpoint can emit a step_done event after it
//  completes (enabling progressive UI rendering on the client). The non-
//  streaming runPlan composes this with runSelect for a single-call API.
// ---------------------------------------------------------------------------

async function runInterpretAndNormalize({ scenarioText, llmCall, llmCallFast, fastMode }) {
  if (!llmCall) throw new Error('runInterpretAndNormalize requires llmCall');
  const scenario = scenarioText || '';
  const fastCall = llmCallFast || llmCall;

  // fastMode hint — appended to the system prompt to tell the LLM to
  // emit minimal arrays. This actually reduces generation time (which
  // post-process trimming on the server does not). The LLM still emits
  // the structural fields (uiState, slot_requirements, etc.) — only
  // the verbose paraphrase arrays shrink.
  const FAST_HINT = '\n\n[FAST MODE] Keep response MINIMAL. Emit:\n- tasks[] with at most 3 entries\n- slot_requirements[] with at most 3 entries\n- constraints[] with at most 2 entries\n- selection_constraints arrays with at most 2 entries each\nKeep all structural fields (intent, ui_state, planning_summary) intact. Do NOT add commentary or extra verbose paraphrases.';

  // Original (pre-cache-reorder) prompt structure restored — empirically
  // moving KB into the system prompt regressed UI quality across stages,
  // even though it improved cache hit rates.
  const sysPrompt = buildInterpretAndPlanPrompt() + (fastMode ? FAST_HINT : '');
  const combinedRaw = await fastCall(
    sysPrompt,
    buildPromptContext('interpreter', null) + '\n\n---\n\n' +
    buildPromptContext('normalizer', null) + '\n\n---\n\n' +
    `User Scenario:\n${scenario}`
  );
  const interpretation = normalizeInterpreterOutput(combinedRaw);
  const planningPacket = normalizeNormalizerOutput(combinedRaw);

  // Safety merge: backfill context_tags into planningPacket.uiState if the
  // merged response only put them at the top-level ui_state.
  if (planningPacket.uiState
      && (!planningPacket.uiState.contextTags
          || planningPacket.uiState.contextTags.length === 0)
      && interpretation.uiState
      && Array.isArray(interpretation.uiState.contextTags)
      && interpretation.uiState.contextTags.length > 0) {
    planningPacket.uiState.contextTags = interpretation.uiState.contextTags.slice();
  }

  return {
    interpretation,
    planningPacket,
    // Raw merged response — passed to runSelect so the selector sees the
    // exact JSON the LLM emitted (matches what the legacy two-call path
    // gave the selector via planningPacketRaw).
    rawCombined: combinedRaw
  };
}

// ---------------------------------------------------------------------------
//  STAGE 3 — runSelect (component selector + mandatory injection + validation)
// ---------------------------------------------------------------------------

async function runSelect({ scenarioText, interpretation, planningPacket, rawCombined, llmCall, embedCall, fastMode, features }) {
  if (!llmCall) throw new Error('runSelect requires llmCall');
  const _F = _resolveFeatures(features);
  const scenario = scenarioText || '';
  const planningPacketRaw = rawCombined || planningPacket;

  const uiStateForSelector = planningPacket.uiState || interpretation.uiState;
  const mandatoryBlock = buildMandatoryComponentsBlock(uiStateForSelector);

  // RAG SHORTLIST (Stage 3 vocabulary expansion):
  // The full registry has 92 components but pasting all of them into every
  // prompt is wasteful. Embed the scenario, retrieve top-K by cosine
  // similarity, and feed only that shortlist to the planner. Mandatory
  // components for the surface are always appended so the chrome contract
  // can be satisfied even when the embeddings rank them low.
  // If the embed call or embeddings index is unavailable, we silently fall
  // back to COMPONENT_DESCRIPTIONS_BLOCK (the legacy 10-item set).
  const SHORTLIST_K = parseInt(process.env.PIPELINE_RAG_K || '30', 10);
  let vocabOverride = null;
  let shortlistInfo = null;
  // Kill switch: when RAG is disabled (default), skip the embedding fetch
  // entirely (~400ms saved) and use the curated 10-item vocab block baked
  // into buildPlannerPrompt(). When enabled, retrieve a per-call shortlist
  // and pass it to buildPlannerPrompt() as an override — vocab still ends
  // up in the SYSTEM prompt (preserves the legacy attention pattern that
  // produces healthy UI output).
  // Skippable per-request via features.rag=false (defaults follow env).
  if (_F.rag && RAG_ENABLED && embedCall && COMPONENT_EMBEDDINGS) {
    try {
      const ui = uiStateForSelector || {};
      const queryParts = [
        scenario || '',
        ui.baseSurface ? `surface: ${ui.baseSurface}` : '',
        ui.urgency    ? `urgency: ${ui.urgency}`     : '',
        ui.attentionMode ? `attention: ${ui.attentionMode}` : '',
        Array.isArray(ui.contextTags) && ui.contextTags.length
          ? 'context: ' + ui.contextTags.slice(0, 8).join(', ')
          : '',
        interpretation && interpretation.primaryGoal ? `goal: ${interpretation.primaryGoal}` : ''
      ].filter(Boolean);
      const queryText = queryParts.join('\n');
      const t0 = Date.now();
      const queryEmbedding = await embedCall(queryText);
      const topIds = retrieveTopKComponentIds(queryEmbedding, SHORTLIST_K);
      const mandatoryIds = (DesignMemory && DesignMemory.generatorMemory
        && DesignMemory.generatorMemory.screens
        && DesignMemory.generatorMemory.screens[(uiStateForSelector || {}).baseSurface]
        && (DesignMemory.generatorMemory.screens[uiStateForSelector.baseSurface].mandatoryComponents
          || DesignMemory.generatorMemory.screens[uiStateForSelector.baseSurface].mandatory_components))
        || [];
      const finalIds = topIds.slice();
      mandatoryIds.forEach(id => { if (!finalIds.includes(id)) finalIds.push(id); });
      // Always include every semantic-allowed preset (matches /customize card gallery
      // IDs) so RAG retrieval cannot drop weather/calendar/notification variants.
      (allowedSemanticComponentTypes() || []).forEach(id => {
        if (!finalIds.includes(id)) finalIds.push(id);
      });
      vocabOverride = buildShortlistedVocabBlock(finalIds);
      const elapsed = Date.now() - t0;
      shortlistInfo = { k: SHORTLIST_K, retrieved: topIds.length, finalSize: finalIds.length, elapsedMs: elapsed };
      console.log(`[pipeline] RAG shortlist: ${finalIds.length} ids (top-${topIds.length} + ${mandatoryIds.length} mandatory) in ${elapsed}ms`);
    } catch (e) {
      console.warn('[pipeline] RAG shortlist failed, using full vocab:', e.message);
    }
  }

  // Original prompt structure (KB + mandatory in user message, vocab inside
  // buildPlannerPrompt's system prompt). Restored after the cache-friendly
  // reorder regressed UI quality (fewer components, broken layouts).
  const FAST_HINT = '\n\n[FAST MODE] Keep response MINIMAL. plannerNotes.selectionReasoning[] must have at most 2 entries (or empty). Other plannerNotes arrays at most 1 entry. Keep requiredComponents[] complete and accurate — do NOT trim it.';
  const sysPlanner = buildPlannerPrompt(vocabOverride) + (fastMode ? FAST_HINT : '');
  const planRaw = await llmCall(
    sysPlanner,
    buildPromptContext('selector', uiStateForSelector) + '\n\n---\n\n' +
    (mandatoryBlock ? mandatoryBlock + '\n\n---\n\n' : '') +
    `User Scenario:\n${scenario}\n\n` +
    `Planning Packet:\n${JSON.stringify(planningPacketRaw)}`
  );
  const plan = normalizeSelectorOutput(planRaw);
  if (shortlistInfo && plan && plan.plannerNotes) {
    plan.plannerNotes.ragShortlist = shortlistInfo;
  }

  // Programmatic mandatory-component enforcement.
  // The mandatoryBlock in the selector's user message is advisory; verified
  // across the 10-scenario test, the LLM sometimes ignores it (e.g. the
  // "bare lock" run picked calendar_summary_card instead of the required
  // status-bar+clock). Here we backfill the missing mandatories so the
  // contract "surface S always has components M[]" is satisfied
  // deterministically rather than depending on prompt obedience.
  // ── Chrome-role correction ─────────────────────────────────────────
  // The LLM occasionally tags content components (quick_toggle_row,
  // input_summary_card, action_chip_row, etc.) as role=chrome — putting
  // them in the chrome group where they render as misplaced widgets
  // (e.g. a quick_toggle_row labeled "Status" rendered as a blue circle
  // beside the app header). Here we detect this misuse: if a component
  // has role=chrome but its componentType is NOT a registered chrome
  // primitive, demote it to its semantic-correct role (action / feedback
  // / context). Mandatory-injected ones are exempt.
  // Two patterns the LLM uses when (mistakenly) trying to satisfy a
  // "system status" placeholder for an app surface:
  //   1) label is a generic status word ("Status", "System status", …)
  //   2) value is status-bar-like (time + wifi/bluetooth/battery)
  // Either pattern, combined with chrome-role misuse, means the LLM was
  // duplicating the chrome status-bar (which is already mandatory-injected
  // as container.status-bar-app). These should be DROPPED, not demoted —
  // demoting just re-emits the same junk as content. Without this, the
  // user sees a stray "Status" card with a sound/wifi icon awkwardly
  // placed between the header and the real content.
  const STATUS_LIKE_LABELS = /^(status|system\s+status|app\s+status|device\s+status|connection\s+status|safe\s+area|chrome)\s*$/i;
  // Drops when chrome-misused content's value reads like a status-bar
  // string. Includes:
  //   • Wi-Fi / Bluetooth / battery / cellular / signal — connectivity
  //   • "safe area" — synthetic chrome placeholder
  //   • clock-like time tokens (7:42 PM, 14:30, etc.) — LLM trying to
  //     duplicate the system clock
  const STATUS_BAR_VALUE_PATTERNS = /\b(wi-?fi|bluetooth|battery|cellular|signal|safe\s+area|\d{1,2}:\d{2}(?:\s*(?:am|pm))?)\b/i;
  if (Array.isArray(plan.requiredComponents)) {
    let demoted = 0;
    let dropped = 0;
    const survivors = [];
    plan.requiredComponents.forEach(c => {
      // Pass-through: not a misuse case
      if (c.role !== 'chrome' || c._source === 'mandatory-inject' || PIPELINE_CHROME_ROLE_IDS.has(c.componentType)) {
        survivors.push(c);
        return;
      }
      // Drop heuristic: chrome misuse + status-bar duplication
      const lbl = (c.content && c.content.label) || '';
      const val = (c.content && c.content.value) || '';
      const labelIsGenericStatus  = STATUS_LIKE_LABELS.test(lbl.trim());
      const valueIsStatusBarLike  = STATUS_BAR_VALUE_PATTERNS.test(val);
      if (labelIsGenericStatus || valueIsStatusBarLike) {
        dropped += 1;
        return;  // skip — not added to survivors
      }
      // Otherwise demote (preserve content but reclassify)
      const t = c.componentType || '';
      let newRole = 'context';
      if (/action|chip|button|cta/i.test(t))         newRole = 'action';
      else if (/notif/i.test(t))                     newRole = 'feedback';
      else if (/toggle|switch/i.test(t))             newRole = 'action';
      else if (/progress|state|status/i.test(t))     newRole = 'state';
      c._roleDemotedFrom = c.role;
      c.role = newRole;
      if (c.slot && /^(chrome|container\.|status-bar|header|gesture)/i.test(c.slot)) {
        c.slot = 'content-' + (c.componentType || 'unknown').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      }
      demoted += 1;
      survivors.push(c);
    });
    if (dropped || demoted) {
      plan.requiredComponents = survivors;
      plan.plannerNotes = plan.plannerNotes || {};
      if (demoted) plan.plannerNotes.chromeRoleDemoted    = demoted;
      if (dropped) plan.plannerNotes.chromeRoleDropped    = dropped;
      console.log('[pipeline] runPlan: chrome-role correction — demoted=' + demoted + ' dropped=' + dropped);
    }
  }

  // ── Same-label dedup ───────────────────────────────────────────────
  // The selector LLM repeatedly picks the same widget type with
  // nominally different but practically-identical content — e.g.,
  // 4 "INGREDIENTS READY" cards each listing the same chips with
  // tiny prefix/separator variations. Earlier we deduped on
  // (componentType + label + value) but the value differences (a
  // "Ingredients:" prefix, comma vs ·) defeated it.
  //
  // The user-perceived duplicate is the LABEL — when 4 cards share
  // the same section header, they read as the same widget repeated
  // regardless of whether the values are byte-identical. So dedup is
  // now on (componentType + normalized label) with empty-label cards
  // exempt (mandatory chrome). This is more aggressive: 2 cards with
  // the same label but legitimately different values WILL get
  // deduped — but in practice repeated labels signal LLM duplication
  // intent rather than legit variety.
  // Two normalizers:
  //   _normalizeForDedup   — light: lowercase + collapse punctuation runs.
  //                          Used by primary+secondary sigs.
  //   _alphanumOnly        — heavy: strip everything non-alphanumeric.
  //                          Used by the tertiary sig to catch subtle
  //                          differences like trailing dots, parens,
  //                          ellipses, em/en dashes that the lighter
  //                          normalizer leaves intact.
  function _normalizeForDedup(s) {
    return String(s || '').toLowerCase().replace(/[\s·•|,;:!?-]+/g, ' ').trim();
  }
  function _alphanumOnly(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
  // Skippable via features.dedup=false (turning this off lets duplicate
  // labels through — useful for measuring how often the LLM repeats vs
  // how much the 4-tier dedup ladder catches).
  if (_F.dedup && Array.isArray(plan.requiredComponents)) {
    const seenSig = new Set();
    const seenAlnumSig = new Set();
    const dedupSurvivors = [];
    let dupDropped = 0;
    plan.requiredComponents.forEach(c => {
      const lbl = (c.content && c.content.label) || '';
      const val = (c.content && c.content.value) || '';
      if (!lbl.trim() && !val.trim()) {
        dedupSurvivors.push(c);
        return;
      }
      // PRIMARY signature: componentType + normalized label. Catches
      // the "same section header repeated" pattern.
      const labelSig = (c.componentType || '') + '||' + _normalizeForDedup(lbl);
      if (lbl.trim() && seenSig.has(labelSig)) {
        dupDropped += 1;
        return;
      }
      // SECONDARY signature: full content (label + value). Catches
      // cases with empty label but identical body text.
      const fullSig = labelSig + '||' + _normalizeForDedup(val);
      if (seenSig.has(fullSig)) {
        dupDropped += 1;
        return;
      }
      // TERTIARY signature: alphanumeric-only of the FULL content.
      // Catches subtle differences in punctuation/separators that
      // the lighter normalizer doesn't strip — e.g. "Step 2 of 6"
      // vs "Step 2 of 6." vs "STEP 2/6" all collapse to "step2of6".
      const alnumSig = (c.componentType || '') + '||' + _alphanumOnly(lbl) + '||' + _alphanumOnly(val);
      if (seenAlnumSig.has(alnumSig)) {
        dupDropped += 1;
        return;
      }
      // QUATERNARY signature: alphanumeric-only of label/value alone,
      // CROSS-TYPE. Catches "same content, different componentType"
      // duplicates such as the LLM emitting both `btn-contained` and
      // `action_chip_row` with label "Coupang cart" — two visual buttons
      // for the same action. Trigger only if the alphanumeric label is
      // ≥ 3 chars, so we don't false-positive on short shared labels
      // like "Hi" or numeric counters.
      const labelAlnum = _alphanumOnly(lbl);
      const valueAlnum = _alphanumOnly(val);
      if (labelAlnum.length >= 3 && seenAlnumSig.has('xtype||' + labelAlnum)) {
        dupDropped += 1;
        return;
      }
      if (valueAlnum.length >= 8 && seenAlnumSig.has('xtype||' + valueAlnum)) {
        dupDropped += 1;
        return;
      }
      if (lbl.trim()) seenSig.add(labelSig);
      seenSig.add(fullSig);
      seenAlnumSig.add(alnumSig);
      // Cross-type sentinels — see QUATERNARY check above.
      if (labelAlnum.length >= 3) seenAlnumSig.add('xtype||' + labelAlnum);
      if (valueAlnum.length >= 8) seenAlnumSig.add('xtype||' + valueAlnum);
      dedupSurvivors.push(c);
    });
    if (dupDropped) {
      plan.requiredComponents = dedupSurvivors;
      plan.plannerNotes = plan.plannerNotes || {};
      plan.plannerNotes.duplicatesDropped = dupDropped;
      console.log('[pipeline] runPlan: dedup — dropped ' + dupDropped + ' duplicate-labeled component(s)');
    }
  }

  // ── Per-type cap ───────────────────────────────────────────────────
  // Even after label-dedup, the selector sometimes still picks many
  // distinct-labeled cards of the same componentType. Cap per type when
  // typeCap feature is enabled (default: off; see _resolveFeatures).
  // Drops are tail-first (keep first N in plan order, drop rest).
  // Skippable via features.typeCap=false.
  if (_F.typeCap && Array.isArray(plan.requiredComponents)) {
    const TYPE_CAP = 24;
    const counts = {};
    const capSurvivors = [];
    let capDropped = 0;
    plan.requiredComponents.forEach(c => {
      const t = c.componentType || '';
      // Empty/mandatory chrome — never capped.
      const lbl = (c.content && c.content.label) || '';
      const val = (c.content && c.content.value) || '';
      if (!lbl.trim() && !val.trim()) {
        capSurvivors.push(c);
        return;
      }
      counts[t] = (counts[t] || 0) + 1;
      if (counts[t] > TYPE_CAP) {
        capDropped += 1;
        return;
      }
      capSurvivors.push(c);
    });
    if (capDropped) {
      plan.requiredComponents = capSurvivors;
      plan.plannerNotes = plan.plannerNotes || {};
      plan.plannerNotes.typeCapDropped = capDropped;
      console.log('[pipeline] runPlan: type-cap (' + TYPE_CAP + ' max per type) — dropped ' + capDropped + ' excess card(s)');
    }
  }

  // Skippable via features.mandatoryInject=false. Surface-required
  // chrome (status-bar / header etc) will then only show up if the LLM
  // picked it on its own — useful to measure how often the LLM ignores
  // the "every surface needs status-bar" rule.
  if (_F.mandatoryInject && DesignMemory && DesignMemory.generatorMemory && uiStateForSelector) {
    const screens = DesignMemory.generatorMemory.screens || {};
    const screen  = screens[uiStateForSelector.baseSurface] || {};
    const mandatoryIds = screen.mandatoryComponents
                      || screen.mandatory_components
                      || [];
    if (mandatoryIds.length) {
      if (!Array.isArray(plan.requiredComponents)) plan.requiredComponents = [];
      const have = new Set(plan.requiredComponents.map(c => c.componentType).filter(Boolean));
      const injected = [];
      mandatoryIds.forEach(id => {
        if (!have.has(id)) {
          plan.requiredComponents.unshift({
            slot:          'chrome',
            componentType: id,
            variantHint:   'default',
            priority:      1,
            // Surface-mandatory components are by definition chrome — they
            // hold the screen's structural frame. Naming the role here
            // (a) keeps downstream layout reasoning correct (chrome groups,
            // not primary-task groups), and (b) qualifies for the
            // role==='chrome' vocabulary-skip path in validatePlan().
            role:          'chrome',
            content:       { label: '', value: '', icon: null },
            constraints:   [],
            // Marker: validatePlan() skips the semantic-vocabulary check on
            // these because the IDs come from generator_memory.json (which
            // is the source of truth for what's mandatory per surface) and
            // are guaranteed to be valid registry entries — even if they
            // happen not to appear in vocabulary.semantic_allowed_types.
            _source:       'mandatory-inject'
          });
          injected.push(id);
        }
      });
      if (injected.length) {
        plan.plannerNotes = plan.plannerNotes || {};
        plan.plannerNotes.mandatoryInjected = injected;
        console.log('[pipeline] runPlan: injected ' + injected.length +
          ' mandatory component(s) for surface "' +
          uiStateForSelector.baseSurface + '": ' + injected.join(', '));
      }
    }
  }

  // ── Context-aware injection ─────────────────────────────────────────
  // Beyond the surface-mandatory chrome, broaden the selection based on
  // contextTags. The interpreter already identifies signals like "morning",
  // "briefing", "driving" — we use those to inject related rich content
  // cards (calendar_summary_card for morning, navigation_turn_card for
  // driving, etc.) when the LLM's narrower task→slot mapping would
  // otherwise miss them. Each injection is gated on the component being
  // (a) not already picked, and (b) in the active semantic vocabulary.
  // Skippable via features.contextInject=false.
  if (_F.contextInject && uiStateForSelector && Array.isArray(uiStateForSelector.contextTags) && uiStateForSelector.contextTags.length) {
    if (!Array.isArray(plan.requiredComponents)) plan.requiredComponents = [];
    const havePicked = new Set(plan.requiredComponents.map(c => c.componentType).filter(Boolean));
    const allowedVocab = new Set(allowedSemanticComponentTypes());
    const suggestions = new Set();
    uiStateForSelector.contextTags.forEach(tag => {
      const t = String(tag).toLowerCase();
      const baseIds    = CONTEXT_INJECTION_RULES[t]      || [];
      const learnedIds = LEARNED_CONTEXT_INJECTIONS[t]   || [];
      baseIds.forEach(id    => suggestions.add(id));
      learnedIds.forEach(id => suggestions.add(id));
    });
    const ctxInjected = [];
    suggestions.forEach(id => {
      if (havePicked.has(id) || !allowedVocab.has(id)) return;
      const placeholder = CONTEXT_INJECTION_PLACEHOLDERS[id] || { label: '', value: '' };
      plan.requiredComponents.push({
        slot:          'context-' + id.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
        componentType: id,
        variantHint:   'default',
        priority:      2,   // contextual, not critical
        role:          'context',
        // Pre-filled with reasonable sample content so the per-component
        // visual treatment (calendar layout, reminder layout, etc.) has
        // something to render instead of empty fields. The LLM may
        // override this if it picks the same component organically.
        content:       { label: placeholder.label, value: placeholder.value, icon: null },
        constraints:   [],
        _source:       'context-inject'
      });
      ctxInjected.push(id);
    });
    if (ctxInjected.length) {
      plan.plannerNotes = plan.plannerNotes || {};
      plan.plannerNotes.contextInjected = ctxInjected;
      console.log('[pipeline] runPlan: context-injected ' + ctxInjected.length +
        ' component(s) from tags [' +
        uiStateForSelector.contextTags.slice(0, 8).join(',') + ']: ' +
        ctxInjected.join(', '));
    }
  }

  const { violations } = validatePlan(plan);

  return {
    plan,
    planViolations: violations
  };
}

// ---------------------------------------------------------------------------
//  STAGE 3.5 — runContentBag (parallel content enrichment)
//
//  Fired in parallel with runSelect (Promise.all). The selector picks
//  componentTypes + initial content; the content bag runs alongside it on
//  a cheap mini model and emits a rich, varied fact bundle keyed by
//  componentType. After both resolve, applyContentSwap() fills in empty /
//  duplicated slots in the selector plan with bag entries — defeating the
//  "4× INGREDIENTS READY with identical chips" failure mode without any
//  extra latency on the critical path.
// ---------------------------------------------------------------------------

function buildContentBagPrompt() {
  return `You are a CONTENT FRAGMENT GENERATOR for a Samsung One UI screen.

You will receive a user scenario plus a short uiState. Your job is to emit a
COMPACT bag of REAL, scenario-grounded content fragments that DIFFERENT
component types could display. You are NOT picking components or designing a
screen — you are ONLY producing text/data fragments that can be plugged into
whatever the selector picked.

Return STRICT JSON shaped EXACTLY like this (no extra keys, no commentary):

{
  "weather":  { "label": "string", "value": "string", "icon": "string|null" },
  "calendar": [
    { "label": "string", "value": "string", "icon": "string|null" }
  ],
  "reminder": [
    { "label": "string", "value": "string", "icon": "string|null" }
  ],
  "message": [
    { "label": "string", "value": "string", "icon": "string|null" }
  ],
  "eta":      { "label": "string", "value": "string", "icon": "string|null" },
  "navigation": { "label": "string", "value": "string", "icon": "string|null" },
  "now_playing": { "label": "string", "value": "string", "icon": "string|null" },
  "shortcut": [
    { "label": "string", "value": "string", "icon": "string|null" }
  ],
  "input_summary": [
    { "label": "string", "value": "string", "icon": "string|null" }
  ],
  "primary_subject": { "label": "string", "value": "string", "icon": "string|null" },
  "primary_state":   { "label": "string", "value": "string", "icon": "string|null" },
  "primary_action":  { "label": "string", "value": "string", "icon": "string|null" }
}

Rules:
- Every label MUST be UNIQUE across the entire bag (case-insensitive). No two
  entries — across keys or within array fields — may share the same label.
- Arrays must contain 3 DIFFERENT entries (varied subjects, different verbs,
  different specifics).  Each entry is a complete tile, NOT a placeholder.
- label / value: use any length needed for a realistic line; the renderer
  ellipsizes long strings in tight cells. Avoid empty or generic filler
  ("Title", "TBD"). No emoji required.
- icon is OPTIONAL — null is fine. If you set one, use a single Material-style
  symbol name (e.g. "schedule", "bolt", "wifi") — never an emoji.
- Use the SCENARIO to populate everything. If the scenario is cooking, the
  reminders should be cooking-specific (different ingredients), the messages
  should be plausible cooking-context messages (e.g. "Sarah" asking about
  dinner), the calendar entries should be cooking-context times (prep,
  simmer, plate). The bag must feel coherent with the user's actual task.
- primary_subject / primary_state / primary_action describe the SCREEN's
  central concept (1 each) so the selector's chosen subject / state / action
  components can be enriched with on-task content if they were left generic.
- DO NOT repeat literal phrases between entries. "Pasta water boiling" /
  "Sauce reducing" / "Garlic toasting" — three DIFFERENT cooking states, NOT
  three near-identical "ingredients ready" lines.
- Keep total output small — JSON only, no markdown.`;
}

async function runContentBag({ scenarioText, planningPacket, interpretation, llmCall, fastMode }) {
  if (!llmCall) return null;             // optional stage — never throws
  const scenario = scenarioText || '';
  const ui = (planningPacket && planningPacket.uiState)
          || (interpretation && interpretation.uiState)
          || {};
  // Minimal user message — the bag prompt is self-contained, we just hand
  // it the scenario plus a tiny uiState slice for grounding.
  const uiHint = {
    baseSurface:   ui.baseSurface   || null,
    attentionMode: ui.attentionMode || null,
    densityMode:   ui.densityMode   || null,
    contextTags:   Array.isArray(ui.contextTags) ? ui.contextTags.slice(0, 8) : []
  };
  const userMsg = `Scenario:\n${scenario}\n\nuiState (hint, do not echo):\n${JSON.stringify(uiHint)}`;
  try {
    const t0 = Date.now();
    const raw = await llmCall(buildContentBagPrompt(), userMsg);
    const elapsed = Date.now() - t0;
    console.log(`[pipeline] content bag generated in ${elapsed}ms`);
    return _normalizeContentBag(raw);
  } catch (e) {
    console.warn('[pipeline] runContentBag failed (non-fatal):', e.message);
    return null;
  }
}

// Defensive normalization — the bag is best-effort; never let a malformed
// response take down the pipeline. Always return the canonical shape with
// unknown keys dropped and missing keys defaulted.
function _normalizeContentBag(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const oneOrNull = (v) => {
    if (!v || typeof v !== 'object') return null;
    const label = String(v.label || '').trim();
    const value = String(v.value || '').trim();
    if (!label && !value) return null;
    return { label, value, icon: v.icon || null };
  };
  const arrOf = (v) => {
    if (!Array.isArray(v)) return [];
    return v.map(oneOrNull).filter(Boolean);
  };
  return {
    weather:         oneOrNull(raw.weather),
    calendar:        arrOf(raw.calendar),
    reminder:        arrOf(raw.reminder),
    message:         arrOf(raw.message),
    eta:             oneOrNull(raw.eta),
    navigation:      oneOrNull(raw.navigation),
    now_playing:     oneOrNull(raw.now_playing),
    shortcut:        arrOf(raw.shortcut),
    input_summary:   arrOf(raw.input_summary),
    primary_subject: oneOrNull(raw.primary_subject),
    primary_state:   oneOrNull(raw.primary_state),
    primary_action:  oneOrNull(raw.primary_action)
  };
}

// Maps a planner componentType → the bag key that holds matching content.
// Multiple componentTypes can route to the same bag key (e.g. several
// reminder-style components all pull from bag.reminder). Returns null
// when no swap is appropriate (chrome, action chips with their own copy).
function _bagKeyForComponentType(componentType) {
  if (!componentType) return null;
  const t = String(componentType).toLowerCase();
  if (t.includes('weather'))               return 'weather';
  if (t.includes('calendar') || t.includes('event'))           return 'calendar';
  if (t.includes('reminder') || t.includes('todo') || t.includes('task_list')) return 'reminder';
  if (t.includes('message')  || t.includes('chat')  || t.includes('conversation')) return 'message';
  if (t.includes('eta')      || t.includes('arrival'))         return 'eta';
  if (t.includes('navigation') && !t.includes('bar'))          return 'navigation';
  if (t.includes('now_playing') || t.includes('media') || t.includes('track'))   return 'now_playing';
  if (t.includes('shortcut') || t.includes('tile'))            return 'shortcut';
  if (t.includes('input_summary') || t.includes('form'))       return 'input_summary';
  return null;
}

// ---------------------------------------------------------------------------
//  applyContentSwap — fill empty / duplicated slots from the content bag
//
//  Runs after runSelect + runContentBag both resolve. Walks the plan's
//  requiredComponents and for each component:
//    1. If content.label is missing/generic, pull a fresh entry from the
//       matching bag bucket.
//    2. If multiple components of the same componentType collide on the
//       same label, distribute distinct bag entries across the duplicates.
//    3. If the screen's primary subject/state/action components have
//       generic content, replace them with bag.primary_*.
//  Bag entries are consumed (popped) so each is used at most once across the
//  plan — guaranteeing label uniqueness without rerunning dedup.
// ---------------------------------------------------------------------------

const _GENERIC_LABEL_PATTERNS = [
  /^title$/i, /^subtitle$/i, /^item$/i, /^content$/i,
  /^card$/i,  /^info$/i,    /^data$/i, /^placeholder$/i,
  /^personalized\s+guidance$/i, /^adaptations\s+based\s+on\s+preferences$/i,
  /^.{0,2}$/   // 0–2 chars is functionally empty
];

function _isGenericLabel(label) {
  const s = String(label || '').trim();
  if (!s) return true;
  return _GENERIC_LABEL_PATTERNS.some(rx => rx.test(s));
}

function _normLabelForCompare(s) {
  return String(s || '').toLowerCase().replace(/[\s·•|,;:!?-]+/g, ' ').trim();
}

function applyContentSwap(plan, bag) {
  if (!plan || !Array.isArray(plan.requiredComponents) || !bag) return plan;
  const components = plan.requiredComponents;

  // Build per-bucket consumable queues so each entry is used at most once.
  const queues = {
    weather:       bag.weather       ? [bag.weather]       : [],
    calendar:      Array.isArray(bag.calendar)      ? bag.calendar.slice()      : [],
    reminder:      Array.isArray(bag.reminder)      ? bag.reminder.slice()      : [],
    message:       Array.isArray(bag.message)       ? bag.message.slice()       : [],
    eta:           bag.eta           ? [bag.eta]           : [],
    navigation:    bag.navigation    ? [bag.navigation]    : [],
    now_playing:   bag.now_playing   ? [bag.now_playing]   : [],
    shortcut:      Array.isArray(bag.shortcut)      ? bag.shortcut.slice()      : [],
    input_summary: Array.isArray(bag.input_summary) ? bag.input_summary.slice() : []
  };

  // Track labels already in use so we don't introduce a duplicate when
  // pulling from a queue.
  const usedLabels = new Set();
  components.forEach(c => {
    const lbl = (c && c.content && c.content.label) || '';
    if (lbl) usedLabels.add(_normLabelForCompare(lbl));
  });

  const popUnique = (key) => {
    const q = queues[key];
    if (!q || !q.length) return null;
    while (q.length) {
      const next = q.shift();
      if (!next) continue;
      const norm = _normLabelForCompare(next.label);
      if (!norm || usedLabels.has(norm)) continue;
      usedLabels.add(norm);
      return next;
    }
    return null;
  };

  // Pass 1 — count collisions per (componentType + normalized label) so we
  // can target the duplicates for swap (keep the first occurrence, swap the
  // rest with bag entries).
  const seenSig = new Map();   // sig → count
  components.forEach(c => {
    if (!c || c.role === 'chrome') return;
    const t = c.componentType || '';
    const lbl = (c.content && c.content.label) || '';
    const sig = t + '||' + _normLabelForCompare(lbl);
    seenSig.set(sig, (seenSig.get(sig) || 0) + 1);
  });

  let swaps = 0;
  components.forEach((c, idx) => {
    if (!c || c.role === 'chrome') return;
    if (!c.content) c.content = { label: '', value: '', icon: null };
    const t = c.componentType || '';
    const lbl = c.content.label || '';
    const norm = _normLabelForCompare(lbl);

    // (a) Primary slot enrichment — if this is the screen's subject/state/
    //     action and its content is generic, reach for bag.primary_*.
    if (_isGenericLabel(lbl)) {
      let primary = null;
      if (c.role === 'subject' && bag.primary_subject) primary = bag.primary_subject;
      else if (c.role === 'state' && bag.primary_state)   primary = bag.primary_state;
      else if (c.role === 'action' && bag.primary_action) primary = bag.primary_action;
      if (primary && !usedLabels.has(_normLabelForCompare(primary.label))) {
        c.content.label = primary.label;
        c.content.value = primary.value || c.content.value || '';
        if (primary.icon && !c.content.icon) c.content.icon = primary.icon;
        usedLabels.add(_normLabelForCompare(primary.label));
        swaps += 1;
        return;
      }
    }

    // (b) Bucket swap — for content components, route by componentType.
    const bagKey = _bagKeyForComponentType(t);
    if (!bagKey) return;
    const sig = t + '||' + norm;
    const isDupe = (seenSig.get(sig) || 0) > 1;
    const isEmpty = _isGenericLabel(lbl);
    if (!isDupe && !isEmpty) return;     // first occurrence with real content stays

    const fresh = popUnique(bagKey);
    if (!fresh) return;

    // For dupes, we leave the FIRST occurrence alone and swap subsequent
    // matches. Decrement the seen counter as we swap so we only target the
    // 2nd / 3rd / nth occurrences (not the first).
    if (isDupe && !isEmpty) {
      // Find this component's ordinal position among same-sig entries; if
      // it's the first one we encounter (count still equals total), skip.
      // Otherwise consume the queue.
      const remaining = seenSig.get(sig);
      if (remaining === seenSig.get(sig) && idx === components.findIndex(x =>
          x && x.componentType === t &&
          _normLabelForCompare((x.content && x.content.label) || '') === norm)) {
        // first occurrence — keep, but don't decrement queue
        // (the popUnique call already drained the queue once; we re-push.)
        queues[bagKey].unshift(fresh);
        usedLabels.delete(_normLabelForCompare(fresh.label));
        return;
      }
    }

    c.content.label = fresh.label;
    c.content.value = fresh.value || c.content.value || '';
    if (fresh.icon && !c.content.icon) c.content.icon = fresh.icon;
    swaps += 1;
  });

  if (swaps > 0) {
    console.log(`[pipeline] applyContentSwap: filled ${swaps} slot(s) from content bag`);
  }
  return plan;
}

// ---------------------------------------------------------------------------
//  ORCHESTRATOR — runPlan = runInterpretAndNormalize + (runSelect ‖ runContentBag)
//  Composition wrapper for non-streaming consumers (/api/pipeline/full,
//  /api/pipeline/plan). Streaming consumers should call the two halves
//  separately so each emits its own step_done event for progressive UI.
// ---------------------------------------------------------------------------

async function runPlan({ scenarioText, llmCall, llmCallFast, llmCallContentBag, embedCall, fastMode, features }) {
  const _F = _resolveFeatures(features);
  const ipn = await runInterpretAndNormalize({ scenarioText, llmCall, llmCallFast, fastMode });

  // Stages 3 (select) and 3.5 (content bag) fire in PARALLEL so the bag
  // adds zero critical-path latency. Stage 3 typically takes ~3–6 s on
  // gpt-5.4; the mini model bag returns in ~1–2 s, well inside that window.
  // features.contentBag=false skips the bag call entirely (and the swap)
  // — useful for A/B-testing how much the bag enriches outputs.
  const bagCall = llmCallContentBag || llmCallFast || llmCall;
  const [sel, bag] = await Promise.all([
    runSelect({
      scenarioText,
      interpretation:  ipn.interpretation,
      planningPacket:  ipn.planningPacket,
      rawCombined:     ipn.rawCombined,
      llmCall,
      embedCall,
      fastMode,
      features
    }),
    _F.contentBag
      ? runContentBag({
          scenarioText,
          planningPacket:  ipn.planningPacket,
          interpretation:  ipn.interpretation,
          llmCall:         bagCall,
          fastMode
        })
      : Promise.resolve(null)
  ]);

  // Swap is best-effort — runs after both calls resolve, before validation.
  // Skipped automatically when contentBag is off (bag === null).
  if (bag) applyContentSwap(sel.plan, bag);

  const uiState = ipn.planningPacket.uiState || ipn.interpretation.uiState;
  return {
    interpretation:  ipn.interpretation,
    planningPacket:  ipn.planningPacket,
    plan:            sel.plan,
    uiState,
    planViolations:  sel.planViolations,
    contentBag:      bag
  };
}

// ---------------------------------------------------------------------------
//  VALIDATION ROLLUP — single canonical report
// ---------------------------------------------------------------------------

function rollupValidationResults({ planViolations, layoutViolations }) {
  const violations = [].concat(planViolations || [], layoutViolations || []);
  const summary = {
    total:          violations.length,
    high:           violations.filter(v => v.severity === 'high').length,
    medium:         violations.filter(v => v.severity === 'medium').length,
    low:            violations.filter(v => v.severity === 'low').length,
    autoFixable:    violations.filter(v => v.status === 'auto-fixable').length,
    reviewRequired: violations.filter(v => v.status === 'review-required').length
  };
  return { summary, violations };
}

// ---------------------------------------------------------------------------
//  STEP 7 — EXPLANATION (canonical camelCase input)
// ---------------------------------------------------------------------------

async function runExplain({ scenarioText, uiState, plan, layoutPlan, validationReport, llmCall }) {
  if (!llmCall) throw new Error('runExplain requires llmCall(systemPrompt, userMessage)');
  const payload = {
    scenarioText,
    uiState,
    requiredComponents: (plan && plan.requiredComponents) || [],
    plannerNotes:       (plan && plan.plannerNotes)       || null,
    layoutPlan,
    validationReport
  };
  // Original prompt structure restored — KB context stays at the head of
  // the user message so the explainer can cite principle names (P1, P2,
  // etc.) when justifying the design.
  const userMessage =
    buildPromptContext('explainer', uiState) + '\n\n---\n\n' +
    JSON.stringify(payload);
  return llmCall(buildExplanationPrompt(), userMessage);
}

module.exports = {
  // KB helpers
  buildPromptContext,
  getComponentDescriptionsBlock: () => COMPONENT_DESCRIPTIONS_BLOCK,
  buildShortlistedVocabBlock,
  buildVariantReference,
  buildMandatoryComponentsBlock,
  retrieveTopKComponentIds,
  isRenderableComponentId,
  RENDERABLE_COMPONENT_IDS,
  // Phase C runtime hooks for the self-improving system
  addLearnedRule,
  removeLearnedRule,
  listLearnedRules,
  // prompts
  buildInterpreterPrompt,
  buildNormalizerPrompt,
  buildInterpretAndPlanPrompt,
  buildPlannerPrompt,
  buildComposerPrompt,
  buildExplanationPrompt,
  // validators (canonical, camelCase)
  validatePlan,
  validateLayout,
  rollupValidationResults,
  // orchestrators
  runPlan,
  runInterpretAndNormalize,
  runSelect,
  runContentBag,
  applyContentSwap,
  runComposeLayout,
  runExplain,
  // prompts (content bag)
  buildContentBagPrompt,
  // vocabulary introspection
  allowedComponentTypes,
  allowedSemanticComponentTypes,
  REGISTRY_PATH,
  // schema-normalizer re-exports
  normalizeInterpreterOutput,
  normalizeNormalizerOutput,
  normalizeSelectorOutput,
  normalizeComposerOutput
};
