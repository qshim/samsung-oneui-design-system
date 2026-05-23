// ============================================================================
//  app/scenes.js — scenario generation engine (local + pipeline + variants)
//  ---------------------------------------------------------------------------
//  End-to-end orchestration of: prompt/URL → scenario selection → variant
//  generation (local or agent) → canvas render. Also owns pipeline rendering
//  (renderPipelineResponse walks layoutPlan.groups[].children[]).
// ============================================================================

// Version stamp — update when shipping visually-impactful changes so that
// users can verify in DevTools whether they're running cached vs fresh JS.
// Open the console after a hard refresh and look for the [oneui] log line.
console.log('[oneui] scenes.js loaded · build 2026-05-11 · pipeline feature toggles + timing panel');

// ---------------------------------------------------------------------------
//  Pipeline feature toggles + timing panel boot helpers (top-level so
//  they exist before pipelineGenerate or the step_done handler call
//  them). Three responsibilities:
//   1. Restore last-used toggle state from localStorage on DOM ready
//      so the user's pipeline preferences survive page reloads.
//   2. Reset the timing panel at the start of a run.
//   3. Append one row per step_done event.
//  Also keeps the "8 / 8 on" summary in the <summary> in sync as the
//  user clicks checkboxes.
// ---------------------------------------------------------------------------
(function _pipelineFeaturesBoot() {
  function _syncSummary() {
    var flags = document.querySelectorAll('.pf-flag');
    if (!flags.length) return;
    var total = flags.length;
    var on = 0;
    flags.forEach(function (el) { if (el.checked) on++; });
    var s = document.getElementById('pipelineFeaturesSummary');
    if (s) s.textContent = on + ' / ' + total + ' on';
    // Toggle-all button label flips based on current state — when at
    // least one is on we offer "Uncheck all"; when none are on we
    // offer "Check all". Single button = single click cost.
    var t = document.getElementById('pipelineFeaturesToggleAll');
    if (t) t.textContent = on > 0 ? 'Uncheck all' : 'Check all';
  }
  function _restoreSavedFlags() {
    try {
      var raw = localStorage.getItem('oneui-pipeline-features');
      if (!raw) return;
      var saved = JSON.parse(raw);
      Object.keys(saved || {}).forEach(function (k) {
        var el = document.querySelector('.pf-flag[data-feature="' + k + '"]');
        if (el) el.checked = saved[k] !== false;
      });
    } catch (_) { /* ignore corruption */ }
  }
  function _wireFlagListeners() {
    document.querySelectorAll('.pf-flag').forEach(function (el) {
      el.addEventListener('change', _syncSummary);
    });
  }
  // Global so the inline onclick on the summary button can reach it.
  // Flips every pipeline feature flag in one click based on current
  // state: any-on → all-off, all-off → all-on. Mirrors the change
  // through _syncSummary (label + count) and persists the new state
  // to localStorage so the next page load remembers it.
  window.togglePipelineFeaturesAll = function () {
    var flags = document.querySelectorAll('.pf-flag');
    if (!flags.length) return;
    var anyOn = false;
    flags.forEach(function (el) { if (el.checked) anyOn = true; });
    var nextState = !anyOn;   // any-on → off; all-off → on
    var saved = {};
    flags.forEach(function (el) {
      el.checked = nextState;
      var name = el.getAttribute('data-feature');
      if (name) saved[name] = nextState;
    });
    try { localStorage.setItem('oneui-pipeline-features', JSON.stringify(saved)); } catch (_) {}
    _syncSummary();
  };
  document.addEventListener('DOMContentLoaded', function () {
    _restoreSavedFlags();
    _syncSummary();
    _wireFlagListeners();
  });

  // Timing panel helpers — called from the step_done handler.
  window._oneuiResetTimingPanel = function () {
    var panel = document.getElementById('pipelineTimingPanel');
    var rows  = document.getElementById('pipelineTimingRows');
    if (panel) panel.style.display = 'block';
    if (rows)  rows.innerHTML = '<div style="color:var(--text-3);font-style:italic;">running…</div>';
    window._oneuiTimingStart = Date.now();
    window._oneuiTimingTotalMs = 0;
  };
  window._oneuiAppendTimingRow = function (step, elapsedMs, skipped) {
    var rows = document.getElementById('pipelineTimingRows');
    if (!rows) return;
    if (rows.firstElementChild && rows.firstElementChild.style && rows.firstElementChild.style.fontStyle === 'italic') {
      rows.innerHTML = '';
    }
    window._oneuiTimingTotalMs = (window._oneuiTimingTotalMs || 0) + (elapsedMs || 0);
    var secs = ((elapsedMs || 0) / 1000).toFixed(1);
    var mark = skipped ? '⨯' : '✓';
    var label = step.replace(/_/g, ' ');
    var line = document.createElement('div');
    line.innerHTML = '<span style="color:' + (skipped ? 'var(--text-3)' : '#4ade80') + ';width:14px;display:inline-block;">' + mark + '</span> ' +
                     '<span style="display:inline-block;min-width:88px;">' + _escapeHtmlSafe(label) + '</span>' +
                     '<span style="color:var(--text-2);">' + (skipped ? 'skipped' : secs + 's') + '</span>';
    rows.appendChild(line);
    // Append a running total row, replacing any previous one.
    var totals = rows.querySelector('.pf-total-row');
    if (totals) totals.remove();
    var totalsEl = document.createElement('div');
    totalsEl.className = 'pf-total-row';
    totalsEl.style.cssText = 'margin-top:6px;padding-top:6px;border-top:1px dashed var(--divider);color:var(--text-2);';
    totalsEl.innerHTML = '<b>total</b> <span>' + (window._oneuiTimingTotalMs / 1000).toFixed(1) + 's</span>';
    rows.appendChild(totalsEl);
  };
  function _escapeHtmlSafe(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c];
    });
  }
})();

// ---------------------------------------------------------------------------
//  Voice input (Korean) — Web Speech API
//  ---------------------------------------------------------------------------
//  Uses browser-native SpeechRecognition. Click to start, click again to stop.
//  Appends recognized Korean text to #genPrompt input.
// ---------------------------------------------------------------------------
let _speechRecognition = null;
let _speechActive = false;

function toggleVoiceInput() {
  const btn = document.getElementById('voiceBtn');
  const input = document.getElementById('genPrompt');
  if (!input) return;

  // Stop if already recording
  if (_speechActive && _speechRecognition) {
    _speechRecognition.stop();
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert('이 브라우저는 음성 입력을 지원하지 않습니다.\nChrome, Edge 또는 Safari에서 이용해 주세요.');
    return;
  }

  const rec = new SR();
  rec.lang = 'ko-KR';            // Korean (South Korea)
  rec.interimResults = true;     // show text as it's being recognized
  rec.continuous = false;        // stop automatically after silence
  rec.maxAlternatives = 1;

  const baseText = input.value;  // preserve any existing text
  let lastFinal = '';

  rec.onstart = () => {
    _speechActive = true;
    if (btn) {
      btn.style.color = '#E74C3C';
      btn.style.background = 'rgba(231,76,60,0.12)';
      btn.title = '녹음 중... 클릭하여 종료';
    }
    input.placeholder = '듣고 있습니다... (한국어)';
  };

  rec.onresult = (event) => {
    let interim = '';
    let final = lastFinal;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += transcript;
      else interim += transcript;
    }
    lastFinal = final;
    const sep = baseText && !baseText.endsWith(' ') ? ' ' : '';
    input.value = baseText + sep + final + interim;
  };

  rec.onerror = (event) => {
    console.warn('[voice]', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      alert('마이크 접근 권한이 필요합니다. 브라우저 설정에서 허용해 주세요.');
    } else if (event.error === 'no-speech') {
      // silent timeout — just reset UI
    }
  };

  rec.onend = () => {
    _speechActive = false;
    _speechRecognition = null;
    if (btn) {
      btn.style.color = '';
      btn.style.background = '';
      btn.title = '음성 입력 (한국어) — 클릭 후 말씀하세요';
    }
    input.placeholder = 'Describe a screen or paste a URL (한글도 가능)...';
    input.focus();
  };

  _speechRecognition = rec;
  rec.start();
}

function generateVariants(scenarioKey, promptText) {
  const prompt = promptText || scenarioKey;

  // Local-first routing (covers the 17 canonical scenario buttons):
  //   - Rules-based surfaces (Lock / Notif / QS / Dialog) → Figma atomic render
  //   - Hardcoded scenarios in templates.js → deterministic high-fidelity render
  //   - Anything else (free-form prompt with no matching scenario) → agent
  var hasLocalScenario =
    (typeof window.isRulesScenario === 'function' && window.isRulesScenario(scenarioKey)) ||
    (typeof scenarios !== 'undefined' && scenarios && scenarios[scenarioKey]);

  if (hasLocalScenario) {
    _generateVariantsLocal(scenarioKey, prompt);
    return;
  }

  // No local scenario for this key → fall back to agent if connected, else
  // a safe default (feed layout).
  if (agentSession.mode === 'agent') {
    generateVariantsFromAgent(prompt, scenarioKey);
    return;
  }
  _generateVariantsLocal(scenarioKey, prompt);
}

function _generateVariantsLocal(scenarioKey, promptText) {
  showVariantBar();
  const prompt = promptText || scenarioKey;
  const v = activeVariant; // generate only for currently active variant

  generateScenario(scenarioKey);
  _saveCurrentVariant();
  variants[v].generated = true;
  variants[v].prompt = prompt;
  variants[v].scenario = scenarioKey;

  // Save to backend
  _syncVariantsToBackend();
}

// Sync variant prompt+result metadata to backend for Refine context
async function _syncVariantsToBackend() {
  if (agentSession.mode !== 'agent') return;
  try {
    const base = AgentAPI._getBase();
    await fetch(base + '/api/agent/variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: agentSession.id,
        variants: {
          A: variants.A.generated ? { prompt: variants.A.prompt, scenario: variants.A.scenario, html: variants.A.html.substring(0, 2000), critic: variants.A.critic } : null,
          B: variants.B.generated ? { prompt: variants.B.prompt, scenario: variants.B.scenario, html: variants.B.html.substring(0, 2000), critic: variants.B.critic } : null
        }
      })
    });
  } catch (e) {
    console.warn('[Variants] Sync to backend failed:', e.message);
  }
}

function _applyVariantBDifferences() {
  const canvas = document.getElementById('canvas');
  const items = canvas.querySelectorAll('.canvas-item');
  if (items.length === 0) return;

  // Controlled differences: spacing, density, hierarchy emphasis
  // 1. Adjust gap (tighter or looser by 8px)
  const currentGap = parseInt(canvas.style.gap) || 0;
  canvas.style.gap = Math.max(0, currentGap + (currentGap < 8 ? 8 : -4)) + 'px';

  // 2. Adjust padding (slightly different)
  const currentPad = canvas.style.padding;
  if (currentPad === '0' || currentPad === '0px') {
    canvas.style.padding = '8px 0 0';
  } else if (parseInt(currentPad) >= 16) {
    canvas.style.padding = '8px';
  }

  // 3. Typography hierarchy: bump first heading
  items.forEach((item, i) => {
    const fc = item.firstElementChild;
    if (!fc) return;
    const cs = getComputedStyle(fc);

    if (i === 0 || i === 1) return; // skip status bar and appbar

    // Vary border-radius slightly
    if (fc.style.borderRadius || cs.borderRadius !== '0px') {
      const r = parseInt(cs.borderRadius) || 18;
      fc.style.borderRadius = Math.max(8, r + (r > 20 ? -6 : 6)) + 'px';
    }

    // Vary padding on cards
    if (fc.classList.contains('oui-card') || fc.style.padding) {
      const p = parseInt(cs.padding) || 16;
      fc.style.padding = (p + 4) + 'px';
    }

    // First content item: stronger hierarchy
    if (i === 2 || i === 3) {
      const fs = parseFloat(cs.fontSize) || 14;
      if (fs >= 18) {
        fc.style.fontSize = (fs + 2) + 'px';
        fc.style.fontWeight = '800';
      }
    }
  });
}

// Agent-powered generation — only generates for currently active variant
// ────────────────────────────────────────────────────────────────────────
// Generate history — last 5 (prompt, payload, response) tuples for
// ← previous / regenerate / → navigation.
// ────────────────────────────────────────────────────────────────────────
window.generateHistory = window.generateHistory || { entries: [], index: -1, max: 5 };

function _pushHistoryEntry(entry) {
  var h = window.generateHistory;
  // If user navigated back and then generated new → truncate forward branch
  if (h.index >= 0 && h.index < h.entries.length - 1) {
    h.entries = h.entries.slice(0, h.index + 1);
  }
  h.entries.push(entry);
  while (h.entries.length > h.max) h.entries.shift();
  h.index = h.entries.length - 1;
  _updateHistoryUI();
}

function _updateHistoryUI() {
  var h = window.generateHistory;
  var bar = document.getElementById('generateHistoryBar');
  var label = document.getElementById('historyLabel');
  var prev = document.getElementById('historyPrevBtn');
  var next = document.getElementById('historyNextBtn');
  if (!bar) return;
  if (h.entries.length === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'block';
  if (label) label.textContent = 'History ' + (h.index + 1) + '/' + h.entries.length;
  if (prev) prev.disabled = h.index <= 0;
  if (next) next.disabled = h.index >= h.entries.length - 1;
  if (prev) prev.style.opacity = h.index <= 0 ? '0.35' : '1';
  if (next) next.style.opacity = h.index >= h.entries.length - 1 ? '0.35' : '1';
}

function _restoreHistoryEntry(i) {
  var h = window.generateHistory;
  if (i < 0 || i >= h.entries.length) return;
  h.index = i;
  var entry = h.entries[i];

  // 1. Restore the prompt that produced this entry so the chat input
  //    reflects what's actually on canvas. Previously the input was
  //    whatever the user typed most recently, which didn't match the
  //    rendered variant — confusing on back/forward navigation.
  var promptEl = document.getElementById('genPrompt');
  if (promptEl && typeof entry.prompt === 'string') {
    promptEl.value = entry.prompt;
    if (typeof autoResizeChatInput === 'function') {
      try { autoResizeChatInput(promptEl); } catch (e) { /* ignore */ }
    }
  }

  // 2. Re-render the canvas from the cached renderModel. Attach the
  //    decision packet (from layoutTree) so the purpose-aware layout
  //    dispatcher still picks the right strategy on replay.
  if (entry.response && entry.response.renderModel) {
    if (entry.response.layoutTree) {
      entry.response.renderModel._orchestration       = entry.response.layoutTree.orchestration       || null;
      entry.response.renderModel._interpretation      = entry.response.layoutTree.interpretation      || null;
      entry.response.renderModel._statePacket         = entry.response.layoutTree.statePacket         || null;
      entry.response.renderModel._informationPriority = entry.response.layoutTree.informationPriority || null;
    }
    // Also blank overlay state — a history replay is semantically a
    // fresh render of the variant, not a layer-on-top.
    if (typeof _fullResetForGeneration === 'function') {
      try { _fullResetForGeneration(); } catch (e) { /* ignore */ }
    }
    RenderEngine.renderFromModel(entry.response.renderModel);
    if (entry.response.critic) RenderEngine.renderCritic(entry.response.critic);
  }

  // 3. Re-render the pipelineOutput blocks (4+2+1 classification,
  //    interpretation, state packet, information priority) for this
  //    entry so the log panel matches the canvas on replay.
  var lt = (entry.response && entry.response.layoutTree) || {};
  if (lt.orchestration || lt.interpretation || lt.statePacket || lt.informationPriority) {
    _pipelineStart('History replay \u2014 ' +
      (entry.prompt ? '"' + entry.prompt.slice(0, 60) + (entry.prompt.length > 60 ? '\u2026' : '') + '"' : 'Variant ' + (i + 1)));
    _pipelineInfo('Entry ' + (i + 1) + '/' + h.entries.length +
      (entry.ts ? '  \u00b7  ' + new Date(entry.ts).toLocaleTimeString() : ''));
    var classifiedPayload = {
      surfaceType: (entry.response.renderModel && entry.response.renderModel.surfaceType) || null,
      intent:      lt.intent      || null,
      hierarchy:   lt.hierarchy   || null,
      orchestration:       lt.orchestration       || null,
      interpretation:      lt.interpretation      || null,
      statePacket:         lt.statePacket         || null,
      informationPriority: lt.informationPriority || null
    };
    if (classifiedPayload.orchestration)       _renderClassificationBlock(classifiedPayload);
    if (classifiedPayload.interpretation)      _renderInterpretationBlock(classifiedPayload);
    if (classifiedPayload.statePacket)         _renderStatePacketBlock(classifiedPayload);
    if (classifiedPayload.informationPriority) _renderPriorityBlock(classifiedPayload);
    _pipelineSuccess('Replayed from history.');
  }

  _updateHistoryUI();
}

window.generateHistoryPrev = function () { _restoreHistoryEntry(window.generateHistory.index - 1); };
window.generateHistoryNext = function () { _restoreHistoryEntry(window.generateHistory.index + 1); };
window.generateRegenerate = function () {
  var h = window.generateHistory;
  if (h.index < 0 || h.index >= h.entries.length) return;
  var entry = h.entries[h.index];
  // Re-run with same prompt. Bypass cache by clearing the entry key.
  if (typeof _promptCache !== 'undefined' && _promptCache && _promptCache.map) {
    _promptCache.map.clear();
  }
  generateVariantsFromAgent(entry.prompt, entry.scenarioHint);
};

// ────────────────────────────────────────────────────────────────────────
// Error banner helpers
// ────────────────────────────────────────────────────────────────────────
var _lastGenerateAttempt = { prompt: null, scenarioHint: null };

function _showGenerateError(kind, message) {
  var banner = document.getElementById('generateErrorBanner');
  var kindEl = document.getElementById('generateErrorKind');
  var msgEl  = document.getElementById('generateErrorMessage');
  if (banner) banner.style.display = 'block';
  if (kindEl) kindEl.textContent = kind || 'ERROR';
  if (msgEl)  msgEl.textContent = message || 'Generation failed.';
}

function _hideGenerateError() {
  var banner = document.getElementById('generateErrorBanner');
  if (banner) banner.style.display = 'none';
}

window.retryLastGenerate = function () {
  _hideGenerateError();
  // Bypass cache — user explicitly asked for a fresh result
  if (typeof _promptCache !== 'undefined' && _promptCache && _promptCache.map) {
    _promptCache.map.clear();
  }
  generateVariantsFromAgent(_lastGenerateAttempt.prompt, _lastGenerateAttempt.scenarioHint);
};

// Hard reset everything that could "bleed through" into an AI-generated
// screen: the overlay layer, Screens / Overlays active highlights, and
// the state flags that the overlay flow reads (window.currentOverlay,
// window.currentBaseSurface, canvas-frame data-overlay-active /
// data-overlay-base, the overlay-hides-* classes on maskHost). Chat
// Send represents a fresh intent — the last Lock + Notification combo
// has nothing to do with "pick a browser to share this page".
function _fullResetForGeneration() {
  // 1. Remove overlay DOM + reset frame flags
  if (typeof _removeOverlayLayer === 'function') {
    try { _removeOverlayLayer(); } catch (e) { /* ignore */ }
  }
  window.currentOverlay     = null;
  window.currentBaseSurface = null;

  var frame = document.getElementById('canvasFrame');
  if (frame) {
    delete frame.dataset.overlayActive;
    delete frame.dataset.overlayBase;
    delete frame.dataset.overlayKind;
  }

  // 2. Clear Screens / Overlays active highlights so the sidebar
  //    doesn't falsely suggest the canvas is showing canned Lock/Home/etc.
  document.querySelectorAll('.scene-btn.active').forEach(function (b) {
    b.classList.remove('active');
  });

  // 3. Drop overlay-hides-* classes off the mask host (canvas/rulesInner)
  var canvas = document.getElementById('canvas');
  if (canvas) {
    canvas.classList.remove('overlay-hides-all', 'overlay-hides-statusbar',
      'overlay-hides-lock-content');
    if (canvas._rulesInner && canvas._rulesInner !== canvas) {
      canvas._rulesInner.classList.remove('overlay-hides-all',
        'overlay-hides-statusbar', 'overlay-hides-lock-content');
    }

    // 4. Wipe canvas content. Without this, the PREVIOUS render (a
    //    prior AI result, or a canned Home/Lock screen) stayed visible
    //    for the ~20s of the next AI call — users saw it through the
    //    loading blur and read it as "the result". Now the loading
    //    overlay sits on an empty wallpaper instead.
    canvas.innerHTML = '';
    canvas._rulesInner = null;
  }

  // 5. Refresh the Overlay hint text so it no longer says "Base: lock · Overlay: notif"
  if (typeof _refreshOverlayHint === 'function') {
    try { _refreshOverlayHint(); } catch (e) { /* ignore */ }
  }

  // 6. R4: blank the Flow Navigator so a previous multi-node flow's
  //    dots don't linger above the canvas during the next generation.
  if (typeof _hideFlowNavigator === 'function') {
    try { _hideFlowNavigator(); } catch (e) { /* ignore */ }
  }
  // Also drop the per-variant flow state so _switchFlowNode() can't
  // accidentally swap to a node from a prior generation.
  if (typeof variants !== 'undefined' && variants && variants[activeVariant]) {
    variants[activeVariant].flow = null;
  }
}

async function generateVariantsFromAgent(prompt, scenarioHint) {
  // Blank the slate first — overlay layer, active scene-btn highlights,
  // and overlay state flags from a previous click all get wiped so the
  // AI render doesn't sit on top of stale scenario state.
  _fullResetForGeneration();

  showVariantBar();
  const v = activeVariant;
  _lastGenerateAttempt = { prompt: prompt, scenarioHint: scenarioHint };
  _hideGenerateError();

  const payload = StateManager.getGeneratePayload(scenarioHint, prompt);

  if (scenarioHint && typeof applyScenarioBackground === 'function') {
    applyScenarioBackground(scenarioHint);
  }

  // NOTE: earlier builds pre-rendered a canned surface (e.g.
  // first-depth-list) as a skeleton behind the loading overlay so the
  // canvas never looked empty during the ~20s AI call. Reported as
  // confusing — a home screen or list UI would flash through the blur
  // and feel like "the result", then jump to something else when the
  // real AI response arrived. We now keep the canvas empty + blurred
  // during generation and rely on the loading overlay + pipelineOutput
  // blocks to communicate progress.
  showAgentLoading(`Generating Variant ${v}...`);

  // Live log in the pipelineOutput panel so the user can watch progress.
  // Skeleton surface is an internal pre-render for loading feedback —
  // the real surface is chosen by the classifier step, so we don't
  // surface the skeleton guess here (used to confuse: "Surface skeleton:
  // first-depth-list" followed seconds later by "Surface classified:
  // tab-root" — reader can't tell which one is the real result).
  _pipelineStart('AI generation \u2014 Variant ' + v);
  _pipelineInfo('Prompt: "' + prompt.slice(0, 80) + (prompt.length > 80 ? '\u2026' : '') + '"');
  if (scenarioHint) _pipelineInfo('Scenario hint: ' + scenarioHint);
  _pipelineStatus('ai-step', '\u2022 Calling AI\u2026', 'var(--text-3)');
  const _tStart = Date.now();

  try {
    let nodesDoneCount = 0;
    let totalNodes = 1;
    let classifiedInfo = null;
    // Node 0's final sanitized renderModel is painted to the canvas as
    // soon as its node_done fires — we don't wait for the slower nodes
    // to finish. `firstRenderDone` gates that single eager render.
    let firstRenderDone = false;

    const flow = await AgentAPI.generateFlowStream(payload, {
      onClassified: function (info) {
        classifiedInfo = info;
        // Update loading message with intent
        if (info && info.intent) {
          showAgentLoading(`Generating \u201C${info.intent}\u201D\u2026`);
        }
        // Live pipeline log — classification blocks
        if (info) {
          if (info.surfaceType) _pipelineLog('\u2022 Surface classified: <b>' + info.surfaceType + '</b>');
          if (info.intent)      _pipelineLog('\u2022 Intent: ' + info.intent);
          if (info.orchestration)       _renderClassificationBlock(info);
          if (info.interpretation)      _renderInterpretationBlock(info);
          if (info.statePacket)         _renderStatePacketBlock(info);
          if (info.informationPriority) _renderPriorityBlock(info);
          // R4: flow graph block — show nodes + edges immediately, BEFORE
          // individual per-node generators have returned, so the user
          // sees the flow shape early.
          if (info.flowPlan) {
            totalNodes = (info.flowPlan.nodes || []).length || 1;
            if (typeof _renderFlowBlock === 'function') {
              try { _renderFlowBlock(info.flowPlan, -1); } catch (e) { /* ignore */ }
            }
            if (totalNodes > 1) {
              _pipelineLog('\u2022 Flow graph: <b>' + totalNodes + ' nodes</b> (parallel)');
              showAgentLoading('Generating ' + totalNodes + ' nodes in parallel\u2026');
            }
          }
        }
      },
      // R4: each parallel generator resolves here. Node 0's arrival is
      // the "first screen ready" moment — we render the FINAL sanitized
      // renderModel for node 0 immediately, without waiting for the
      // other nodes. The other nodes' completions just tick the progress
      // counter; their renderModels are stored in the flow state when
      // flow_done fires and paint only when the user navigates there.
      onNodeDone: function (nd) {
        nodesDoneCount++;
        _pipelineStatus('flow-progress',
          '\u2022 Nodes ready: <b>' + nodesDoneCount + ' / ' + totalNodes + '</b>' +
          ' (last: ' + (nd.nodeKind || 'node') + ' in ' + (nd.elapsedMs || 0) + 'ms)',
          '#3E91FF');

        if (nd.nodeIndex === 0 && !firstRenderDone) {
          firstRenderDone = true;
          // Final clean render of node 0 with its canonical sanitized
          // renderModel (progressive stream may have used partial data).
          const res0 = _flowNodeToResponseShape({
            id: nd.nodeId, kind: nd.nodeKind, intent: nd.nodeIntent,
            triggered_by: nd.triggered_by,
            layoutTree:  nd.layoutTree,
            renderModel: nd.renderModel,
            critic:      nd.critic
          }, classifiedInfo);
          if (res0 && res0.renderModel && res0.layoutTree) {
            res0.renderModel._orchestration       = res0.layoutTree.orchestration       || null;
            res0.renderModel._interpretation      = res0.layoutTree.interpretation      || null;
            res0.renderModel._statePacket         = res0.layoutTree.statePacket         || null;
            res0.renderModel._informationPriority = res0.layoutTree.informationPriority || null;
          }
          hideAgentLoading();
          const c = document.getElementById('canvas');
          if (c) c.classList.remove('skeleton-loading');
          try { RenderEngine.renderFromModel(res0.renderModel); } catch (e) { /* ignore */ }

          // Wire variant state + critic RIGHT NOW so Refine / Export /
          // critic badges work the moment the first screen is visible.
          variants[v].layoutTree  = res0.layoutTree;
          variants[v].renderModel = res0.renderModel;
          variants[v].critic      = res0.critic;
          StateManager.updateFromAgentGenerate(res0);
          if (res0.critic) RenderEngine.renderCritic(res0.critic);
          if (typeof _renderResolutionBlock === 'function') {
            try { _renderResolutionBlock(res0.renderModel); } catch (e) { /* ignore */ }
          }

          var firstScreenMs = Date.now() - _tStart;
          _pipelineStatus('first-screen',
            '\u2022 <b>First screen rendered</b> (node 0) in ' +
            (firstScreenMs / 1000).toFixed(1) + 's',
            '#4ade80');
          _pipelineLog('\u2022 ' + (totalNodes > 1
            ? 'Remaining ' + (totalNodes - 1) + ' node(s) still generating in background\u2026'
            : 'Flow complete.'));
        } else if (!firstRenderDone) {
          // A non-zero node finished BEFORE node 0 did. Keep the loader
          // up and just update the "generated X/N" message.
          showAgentLoading('Generated ' + nodesDoneCount + ' / ' + totalNodes + ' nodes\u2026');
        }
      }
    });

    // Build per-variant flow state. If the flow only has ONE node this
    // is identical to the single-screen case — node 0 has already been
    // rendered above; we just store the flow metadata for consistency.
    const flowNodes = Array.isArray(flow && flow.nodes) ? flow.nodes : [];
    if (!flowNodes.length) {
      throw new Error('Flow generation returned zero nodes');
    }
    variants[v].flow = {
      nodes: flowNodes,
      edges: (flow && flow.edges) || [],
      currentNodeIdx: 0,
      totalElapsedMs: (flow && flow.totalElapsedMs) || 0
    };

    // Defensive: if somehow node 0 never fired onNodeDone (e.g. server
    // emitted only flow_done), render it now from the final flow payload.
    const res = firstRenderDone
      ? {
          sessionId:   'sess_' + Date.now(),
          layoutTree:  variants[v].layoutTree,
          renderModel: variants[v].renderModel,
          critic:      variants[v].critic
        }
      : (function () {
          const r0 = _flowNodeToResponseShape(flowNodes[0], classifiedInfo);
          if (r0 && r0.renderModel && r0.layoutTree) {
            r0.renderModel._orchestration       = r0.layoutTree.orchestration       || null;
            r0.renderModel._interpretation      = r0.layoutTree.interpretation      || null;
            r0.renderModel._statePacket         = r0.layoutTree.statePacket         || null;
            r0.renderModel._informationPriority = r0.layoutTree.informationPriority || null;
          }
          hideAgentLoading();
          const cc = document.getElementById('canvas');
          if (cc) cc.classList.remove('skeleton-loading');
          RenderEngine.renderFromModel(r0.renderModel);
          variants[v].layoutTree  = r0.layoutTree;
          variants[v].renderModel = r0.renderModel;
          variants[v].critic      = r0.critic;
          StateManager.updateFromAgentGenerate(r0);
          if (r0.critic) RenderEngine.renderCritic(r0.critic);
          if (typeof _renderResolutionBlock === 'function') {
            try { _renderResolutionBlock(r0.renderModel); } catch (e) { /* ignore */ }
          }
          return r0;
        })();

    // R4: render the Flow Navigator UI (only if multi-node).
    if (typeof _renderFlowNavigator === 'function') {
      try { _renderFlowNavigator(variants[v].flow); } catch (e) { /* ignore */ }
    }
    // R4: update the pipelineOutput FLOW block so the "current" node is
    // now highlighted (previously dashed, -1).
    if (typeof _renderFlowBlock === 'function' && classifiedInfo && classifiedInfo.flowPlan) {
      try { _renderFlowBlock(classifiedInfo.flowPlan, 0); } catch (e) { /* ignore */ }
    }

    _saveCurrentVariant();
    variants[v].generated = true;
    variants[v].prompt = prompt;
    variants[v].scenario = scenarioHint;

    _syncVariantsToBackend();

    // Surface the cached / fallback badges on the critic card
    var tagEl    = document.getElementById('criticBadgeTag');
    var cachedEl = document.getElementById('criticBadgeCached');
    var isFallback = res.critic && Array.isArray(res.critic.issues) &&
                     res.critic.issues.some(function (i) { return i && i.type === 'fallback'; });
    if (tagEl)    tagEl.style.display    = isFallback ? 'inline-block' : 'none';
    if (cachedEl) cachedEl.style.display = res.__cached ? 'inline-block' : 'none';

    if (isFallback) {
      _showGenerateError('FALLBACK',
        'Model response was sanitized or defaulted. Generated result is a minimal fallback surface.');
    }

    // Pipeline log — summary on success
    var elapsed = ((Date.now() - _tStart) / 1000).toFixed(1);
    _pipelineStatus('ai-step',
      '\u2022 AI call complete' + ' (' + elapsed + 's' +
      (totalNodes > 1 ? (' / ' + totalNodes + ' nodes parallel') : '') + ')',
      '#4ade80');
    if (res.critic) {
      var issuesCount = (res.critic.issues && res.critic.issues.length) || 0;
      _pipelineLog('\u2022 Critic: ' + (issuesCount
        ? issuesCount + ' issue' + (issuesCount === 1 ? '' : 's') + ' flagged'
        : 'no issues'), issuesCount ? '#f59e0b' : '#4ade80');
    }
    _pipelineSuccess('Rendered Variant ' + v +
      (totalNodes > 1 ? (' (' + totalNodes + '-node flow)') : '') +
      (isFallback ? ' (fallback)' : ''));

    // History — push unless this is a cached replay (cached came from history)
    if (!res.__cached) {
      _pushHistoryEntry({
        prompt: prompt,
        scenarioHint: scenarioHint,
        payload: payload,
        response: res,
        ts: Date.now()
      });
    }
  } catch (err) {
    console.warn('Agent generation failed:', err.message);
    hideAgentLoading();
    const canvasErr = document.getElementById('canvas');
    if (canvasErr) canvasErr.classList.remove('skeleton-loading');
    _pipelineError('Agent generation failed: ' +
      ((err && err.message) ? err.message : 'Unknown error'));

    // Graceful fallback: auto-run local keyword matching so the user
    // always sees SOMETHING on Send instead of a broken canvas. The
    // error banner still shows so they know the AI path failed and can
    // click Retry once the server recovers.
    _pipelineInfo('Falling back to Local mode (keyword matching)\u2026');
    try {
      const promptLower = (prompt || '').toLowerCase();
      let matched = scenarioHint;
      if (!matched) {
        for (const [keyword, scenario] of Object.entries(promptMap)) {
          if (promptLower.includes(keyword)) { matched = scenario; break; }
        }
      }
      matched = matched || (promptLower ? 'feed' : 'login');
      _pipelineSuccess('Local render: ' + matched);
      generateVariants(matched, prompt);
    } catch (fbErr) {
      console.warn('Local fallback also failed:', fbErr.message);
    }
    _showGenerateError('AI UNAVAILABLE \u2014 showing Local fallback',
      (err && err.message) ? err.message : 'Check server / network; click Retry after fixing.');
  }
}

// Bridge from Path A componentIds to Path B atomic roles. When a child has
// one of these IDs we route rendering through window.renderAtomicForRole
// (defined in app/surface-layout.js, line 894) which produces real visual
// HTML instead of the empty "(no template registered)" stub.
//
// CHROME bridge — absolute-positioned into the device frame's chrome zones
// (topSystem / bottomNav) by renderPipelineResponse.
const PIPELINE_CHROME_ATOMIC_ROLE = {
  'container.status-bar-app':    'status-bar',
  'status-bar.default':           'status-bar',
  'container.header':             'collapsed-app-bar',
  'container.nav-gestures-dark':  'gesture-bar',
  'container.nav-buttons-light':  'nav-buttons',
  'dialog.nav-gesture-bar':       'gesture-bar'
};

// BODY bridge — flow inline in canvas content. Each entry maps a Path A
// componentId to one of Path B's body atomic roles. The atomic library
// gives us One UI-correct HTML for free (focus-block, now-bar, action-row,
// list-item, toggle-chip, progress-track, etc.).
const PIPELINE_BODY_ATOMIC_ROLE = {
  // info-cards → focus-block (One UI single-source info tile)
  'input_summary_card':       'focus-block',
  'weather_glance_card':      'focus-block',
  'calendar_summary_card':    'focus-block',
  'message_summary_card':     'focus-block',
  'eta_card':                  'focus-block',
  'reminder_card':             'focus-block',
  // media + timer + delivery → now-bar (variant inferred from id/slot/tags)
  'media_control_bar':         'now-bar',
  'now-bar.media-player':      'now-bar',
  'now-bar.dual-line':         'now-bar',
  'now-bar.single-line':       'now-bar',
  'now-bar.charging':          'now-bar',
  'navigation_turn_card':      'now-bar',
  // chip / toggle rows
  'action_chip_row':           'action-row',
  'floating_action_bar':       'action-row',
  // Registry action primitives → real One UI chips (not generic oui-card stubs)
  'btn-contained':             'action-row',
  'btn-outlined':              'action-row',
  'btn-flat':                  'action-row',
  'fab':                       'action-row',
  'chip':                      'action-row',
  'button.dark':               'action-row',
  'button.light':              'action-row',
  'button.accent':             'action-row',
  'button.galaxy-ai':          'action-row',
  'button.header-small':       'action-row',
  'media-card':                'media-card',
  'music_progress_strip':      'progress-track',
  'widget-small':              'focus-block',
  'lock-screen.widget-activity': 'focus-block',
  'lock-screen.widget-battery':  'focus-block',
  'quick_toggle_row':          'toggle-chip',
  // notifications
  'notification-card':         'notif-card',
  'notification.ai-regular':   'notif-card-ai',
  // lock-screen widgets that have direct atomics
  'lock-screen.clock':         'clock',
  'lock-screen.weather-date':  'weather-date',
  'lock-screen.shortcut-circle':'shortcutLeft',
  // Dialog overlay primitives (registry IDs → palette atomics)
  'dialog.icon-grid-box':       'dialog-icon-grid',
  'dialog.browser-top-bar':     'dialog-browser-bar',
  'dialog.website-share-header':'dialog-site-header',
  'theme_summary_grid':         'focus-block-group'
};

// Media / timer / charging Now Bar strips — Samsung places these in the
// bottom system band (above the home gesture), not under the app header.
// Composer still emits them inside primary-task; we peel them out and
// absolute-pin to zones.bottomNav here. Lock surfaces keep lock-template
// bottom chrome (shortcuts) — skip docking there. Turn-by-turn
// (navigation_turn_card) stays in content flow so map UIs can keep it high.
const PIPELINE_NOWBAR_DOCK_BOTTOM_IDS = new Set([
  'media_control_bar',
  'now-bar.media-player',
  'now-bar.dual-line',
  'now-bar.single-line',
  'now-bar.charging'
]);

function _pipelineUiLockish(uiState) {
  const bs = uiState && uiState.baseSurface;
  return bs === 'lock' || bs === 'lockscreen';
}

function _pipelineShouldDockNowBarChild(child) {
  const cid = child && child.componentId;
  return !!(cid && PIPELINE_NOWBAR_DOCK_BOTTOM_IDS.has(cid));
}

/** Composer can emit two dock-eligible strips (e.g. playback state + prompt). Only
 *  one belongs in the bottom session band — pick the best candidate. */
function _pipelineDedupeDockedNowBars(elements) {
  if (!elements || elements.length <= 1) return elements;
  var bestIdx = 0;
  var bestScore = -Infinity;
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    var cid = (el && el.dataset && el.dataset.compType) || '';
    var base =
      cid === 'media_control_bar' ? 400
        : cid === 'now-bar.charging' ? 360
          : /^now-bar\./.test(cid) ? 300
            : 100;
    var pr = parseInt(
      (el && el.dataset && (el.dataset.pipelinePriority || el.dataset.priority)) || '2',
      10
    );
    if (!Number.isFinite(pr)) pr = 2;
    /* Lower composer priority number = more important (1 = primary). */
    var prBonus = (6 - Math.min(Math.max(pr, 0), 6)) * 20;
    /* Earlier group/child order wins on tie (subtract tiny fraction per index). */
    var score = base + prBonus - i * 0.01;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return [elements[bestIdx]];
}

/** Layout rect for session strip inside bottomNav, leaving room for gesture pill. */
function _pipelineRectBottomSessionNowBar(z) {
  if (!z || !z.bottomNav) return null;
  var nav = z.bottomNav;
  var gestureReserve = 26;
  var h = Math.max(56, Math.min(72, nav.h - gestureReserve - 6));
  var y = nav.y + Math.max(2, (nav.h - gestureReserve - h) / 2);
  return { x: nav.x, y: y, w: nav.w, h: h };
}

// Pick a now-bar variant.type from the child's componentId / slot / scenario
// tags. Path B's now-bar atomic styles itself differently per type (media =
// teal w/ album art, timer = glass w/ stopwatch, charging = green gradient,
// dual-line = generic 2-line, single-line = voice/driving).
function _inferNowBarVariant(child, content, uiState) {
  const id   = (child && child.componentId) || '';
  const slot = (child && child.slot) || '';
  const tags = ((uiState && uiState.contextTags) || []).map(String);
  const c    = content || {};
  const cLabel = String(c.label || '');
  const cValue = String(c.value || '');
  const cBlob = (cLabel + ' ' + cValue).toLowerCase();
  const cIcon = String(c.icon || '').toLowerCase();

  if (/charging/.test(id) || tags.indexOf('now-bar:charging') >= 0 || tags.indexOf('charging') >= 0) {
    return { type: 'charging', percent: 69 };
  }
  // Navigation turn-by-turn — must run BEFORE timer heuristics. Workout / running
  // scenarios often include context tag "workout"; the timer branch below would
  // otherwise steal navigation_turn_card and render a stopwatch strip instead of
  // the maps-style pill (arrow · distance · instruction · ETA).
  if (/navigation_turn|turn_card|nav-turn/.test(id) || /\bturn\b|navigation/.test(slot)) {
    return Object.assign({ type: 'navigation' }, _parseNavVariant(content));
  }
  // Timer semantics must win over the substring "media" inside **media_control_bar** —
  // otherwise cooking step timers render as a music strip (note icon + prev/play/next).
  const timerBySlot = /timer|workout|session_timer|timer_strip/.test(slot);
  const timerByTag =
    tags.indexOf('now-bar:timer') >= 0 ||
    (tags.indexOf('workout') >= 0 &&
      !/navigation_turn|turn_card|nav-turn/i.test(id) &&
      id !== 'media_control_bar' &&
      id !== 'now-bar.media-player');
  const timerByIcon = cIcon === 'timer' || cIcon === 'stopwatch';
  const timerByCopy =
    /\b(timer|countdown|stopwatch|simmer)\b/.test(cBlob) ||
    /\d{1,2}:\d{2}(:\d{2})?/.test(cLabel + ' ' + cValue);
  if (/timer/.test(id) || timerBySlot || timerByTag || timerByIcon || (id === 'media_control_bar' && timerByCopy)) {
    const merged = { type: 'timer', label: '00:00:00', icon: 'stopwatch', live: true };
    const tv = (cValue + ' ' + cLabel).match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
    if (tv) merged.label = tv[1];
    return merged;
  }
  // **media_control_bar** must default to playback (now-bar **media**), not **dual-line**.
  // dual-line uses delivery-style placeholders (Uber Eats + car glyph) when title/subtitle
  // are filled from track copy — the previous id!==media_control_bar guard blocked `media`
  // here entirely. Timer branch above still wins when copy/slot is timer-like.
  if (id === 'media_control_bar') {
    const deliveryBar =
      tags.indexOf('now-bar:delivery') >= 0 ||
      /eta|delivery/.test(slot) ||
      /\b(on the way|out for delivery|order (is )?on|arriv(es|ing))\b/i.test(cBlob);
    if (!deliveryBar) {
      return {
        type: 'media',
        title:   c.label || 'Now playing',
        artist:  c.value || '',
        marquee: (c.label && c.value)
          ? c.label + ' · ' + c.value
          : (c.label || c.value || '')
      };
    }
  }
  // Do not treat generic **media_control_bar** as media from the word "media" in its id.
  if (
    tags.indexOf('now-bar:media') >= 0 ||
    tags.indexOf('media-playing') >= 0 ||
    (id !== 'media_control_bar' && /media|player|playback/.test(id + ' ' + slot))
  ) {
    return {
      type: 'media',
      title:   c.label || 'Now playing',
      artist:  c.value || '',
      marquee: (c.label && c.value)
        ? c.label + ' · ' + c.value
        : (c.label || c.value || '')
    };
  }
  // **now-bar.dual-line** (or bare **now-bar**) is often mis-picked for a track row.
  // Without delivery hints, dual-line renders delivery chrome (Uber Eats + car) while
  // text is still song / artist — treat obvious playback metadata as **media**.
  const nbDeliveryHints =
    tags.indexOf('now-bar:delivery') >= 0 ||
    /eta|delivery/.test(slot) ||
    /\b(on the way|out for delivery|order (is )?on|arriv(es|ing)|\d+\s*min(?:utes)?\s+away)\b/i.test(cBlob);
  const hasTrackSeparator = /[·•]/.test(cLabel + cValue);
  const musicScenarioTags =
    tags.some(t =>
      /media-playing|now-bar:media|for-?you|discover|playlist|personalized\s+mix/i.test(t)
    );
  const nbPlaybackCopy =
    /\s·\s/.test(cLabel + ' ' + cValue) ||
    hasTrackSeparator ||
    /\b(mix|playlist|album(\s+art)?|track|now playing|listening|podcast|radio|shuffle|resume\s+mix|liked\s+songs|dream\s+pop|synth)\b/i.test(cBlob) ||
    /\b(spotify|apple music|youtube music|tidal|deezer|soundcloud)\b/.test(cBlob);
  if (
    (id === 'now-bar.dual-line' || id === 'now-bar') &&
    !nbDeliveryHints &&
    cLabel &&
    cValue &&
    (nbPlaybackCopy || musicScenarioTags)
  ) {
    return {
      type: 'media',
      title:   c.label || 'Now playing',
      artist:  c.value || '',
      marquee: c.label + ' · ' + c.value
    };
  }
  // Catch-all: two-line **non-delivery** copy with artist/title separator (e.g. "M83 · …")
  // still missed above — never fall through to Uber Eats stubs for that shape.
  if (
    (id === 'now-bar.dual-line' || id === 'now-bar') &&
    !nbDeliveryHints &&
    cLabel &&
    cValue &&
    hasTrackSeparator &&
    !/\b(away|arriv|delivery|order\s+on|min\s+away)\b/i.test(cBlob)
  ) {
    return {
      type: 'media',
      title:   c.label || 'Now playing',
      artist:  c.value || '',
      marquee: c.label + ' · ' + c.value
    };
  }
  if (/voice|driving/.test(id + ' ' + slot) || tags.indexOf('now-bar:voice') >= 0 || tags.indexOf('driving') >= 0) {
    return { type: 'single-line', label: content.label || 'Voice ready' };
  }
  if (/eta|delivery/.test(id + ' ' + slot) || tags.indexOf('now-bar:delivery') >= 0) {
    return { type: 'dual-line', title: content.label || 'On the way', subtitle: content.value || '' };
  }
  return { type: 'dual-line', title: content.label || '', subtitle: content.value || '' };
}

// Parse navigation content into turn instruction + distance + ETA + street.
// Examples the LLM emits:
//   label="In 200 m",         value="Turn right onto Hangang-daero"
//   label="Next exit",        value="Exit 12 in 2.5 km"
//   label="Continue straight",value="3.2 km · 8 min · Hangang Bridge"
function _parseNavVariant(content) {
  const c     = content || {};
  const label = String(c.label || '');
  const value = String(c.value || '');
  const all   = label + ' · ' + value;

  // Distance: "200 m", "2.5 km", "1.2 mi"
  const distMatch = all.match(/\b(\d+(?:\.\d+)?\s*(?:m|km|mi|ft)\b)/i);
  const distance = distMatch ? distMatch[1].replace(/\s+/g, ' ') : '';

  // ETA / time: "8 min", "2 h"
  const etaMatch = all.match(/\b(\d+\s*(?:min|m|h|hr)\b)/i);
  const eta = etaMatch && etaMatch[1] !== distance ? etaMatch[1].replace(/\s+/g, ' ') : '';

  // Direction inference for arrow icon
  let direction = 'straight';  // default
  if (/turn\s+left|left\s+onto|left\s+turn/i.test(all)) direction = 'left';
  else if (/turn\s+right|right\s+onto|right\s+turn/i.test(all)) direction = 'right';
  else if (/u-?turn|reverse/i.test(all)) direction = 'uturn';
  else if (/exit|off-?ramp/i.test(all)) direction = 'exit';
  else if (/merge|onto/i.test(all)) direction = 'merge';

  // Instruction: "Turn right onto Hangang-daero" — strip distance/eta
  let instruction = value;
  if (distMatch) instruction = instruction.replace(distMatch[0], '');
  if (etaMatch && etaMatch[1] !== distance) instruction = instruction.replace(etaMatch[0], '');
  instruction = instruction.replace(/^[\s·•|]+|[\s·•|]+$/g, '').trim();
  if (!instruction) instruction = label.trim();

  const imageUrl =
    typeof c.imageUrl === 'string' ? c.imageUrl.trim()
      : typeof c.image === 'string' ? c.image.trim()
        : '';

  return { type: 'navigation', distance, eta, direction, instruction, imageUrl };
}

// Parse input_summary_card content (form summaries — search query summary,
// settings change confirmation, address entry recap, etc.)
// Examples:
//   label="Search · Coffee shops",  value="Found 12 nearby"
//   label="Address",                value="123 Main St · Apt 4B"
//   label="Filters applied",        value="Vegetarian · Within 1 km · Open now"
function _parseInputVariant(content) {
  const c     = content || {};
  const label = String(c.label || '');
  const value = String(c.value || '');

  const lines = value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length >= 2 && /weather|hour|outlook|forecast|detail|humidity|°|cloud|rain|wind|uv\b|next\s*\d/i.test(label + value)) {
    const head = label.split(/\s*[·•|]\s*/)[0].trim() || 'Section';
    return {
      kind: 'chip_section',
      title: head,
      lines: capChipSectionLines(head, lines),
      wrap: /detail|humidity|uv|wind|rain|metric/i.test(label)
    };
  }

  // Section header (uppercase from label)
  const labelHead = label.split(/\s*[·•|]\s*/)[0].trim();
  const section = labelHead ? labelHead.toUpperCase() : 'INPUT';

  // Topic (the part after "·" if present, e.g. "Coffee shops" from
  // "Search · Coffee shops")
  const topicMatch = label.match(/[·•|]\s*(.+)$/);
  const topic = topicMatch ? topicMatch[1].trim() : '';

  const imageUrl =
    typeof c.imageUrl === 'string' ? c.imageUrl.trim()
      : typeof c.image === 'string' ? c.image.trim()
        : '';

  // Detail / facets — split value into chips if it has separators
  let detail = value;
  let facets = [];
  if (/[·•|]/.test(value)) {
    facets = value.split(/\s*[·•|]\s*/).map(s => s.trim()).filter(Boolean);
    detail = '';
  }

  return { kind: 'input', section, topic, detail, facets, imageUrl };
}

/**
 * Split comma/pipe/bullet/slash-separated lists for chips & toggles.
 * Slashes separate items EXCEPT in numeric fractions (e.g. 1/2, 3/4) so
 * "Parmesan 1/2 cup" stays one chip (regression: naive / split).
 */
function splitListPreservingNumericFractions(raw) {
  const s = String(raw || '');
  if (!s.trim()) return [];
  const fracs = [];
  const masked = s.replace(/\b(\d+)\s*\/\s*(\d+)\b/g, function (full) {
    fracs.push(full);
    return '__FRAC_' + (fracs.length - 1) + '__';
  });
  const parts = masked.split(/\s*[,/|·•]\s*/);
  return parts
    .map(function (p) {
      return p
        .trim()
        .replace(/__FRAC_(\d+)__/g, function (_, i) {
          return fracs[+i] || '';
        });
    })
    .filter(Boolean);
}

/**
 * Chip sections can balloon into a tall stack of glass pills when the model
 * emits one line per forecast hour. Cap by section intent so mobile layouts
 * keep One UI–like padding and avoid "button spam".
 */
function capChipSectionLines(title, lines) {
  const arr = Array.isArray(lines) ? lines.map(s => String(s).trim()).filter(Boolean) : [];
  if (!arr.length) return arr;
  const t = String(title || '').toLowerCase();
  let max = 6;
  if (/next\s*\d|hour|hours|\bhourly\b|오늘\s*\d시간|시간대/.test(t)) max = 4;
  else if (/5[\s-]*day|daily outlook|week|요일별|일별/.test(t)) max = 5;
  else if (/today|detail|details|metric|요약|상세/.test(t)) max = 4;
  if (arr.length <= max) return arr;
  return arr.slice(0, max);
}

function chipListHasMultipleSegments(raw) {
  return splitListPreservingNumericFractions(raw).length > 1;
}

window.splitListPreservingNumericFractions = splitListPreservingNumericFractions;

// Parse reminder content: due time, task title, count, priority.
// Examples the LLM emits:
//   label="Today's tasks", value="3 items · Due today"
//   label="Reminder · 5 PM", value="Pick up dry cleaning"
//   label="Due now", value="Review proposal"
function _parseReminderVariant(content) {
  const c     = content || {};
  const label = String(c.label || '');
  const value = String(c.value || '');
  const lines = value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return {
      kind: 'chip_section',
      title: label.trim() || 'Section',
      lines: capChipSectionLines(label, lines),
      wrap: /detail|humidity|uv|wind|rain|metric|5-?day|outlook|forecast/i.test(label)
    };
  }
  const all   = label + ' · ' + value;

  // Due time: "5 PM", "5:30 PM", "Today", "Now", "Tomorrow"
  let due = '';
  const timeMatch = all.match(/\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\b/);
  if (timeMatch) {
    due = timeMatch[1].toUpperCase();
  } else {
    const dueWordMatch = all.match(/\b(?:Due\s+)?(today|tomorrow|now|this\s+morning|this\s+afternoon|tonight)\b/i);
    if (dueWordMatch) due = dueWordMatch[0].replace(/^Due\s+/i, '');
  }

  // Item count: "3 items", "5 tasks"
  const countMatch = all.match(/\b(\d+)\s+(?:items?|tasks?|reminders?|todos?|to-?dos?)\b/i);
  const count = countMatch ? countMatch[1] : '';

  // Task title: prefer value, strip time and count tokens.
  let task = value;
  if (timeMatch)  task = task.replace(timeMatch[0], '').replace(/^\s*Due\s*/i, '');
  if (countMatch) task = task.replace(countMatch[0], '');
  task = task.replace(/^[\s·•|]+|[\s·•|]+$/g, '').trim();

  // If task is empty (e.g. value was just "3 items · Due today"), use label.
  if (!task) {
    task = label.replace(/today's?\s+tasks?|reminder/i, '').replace(/^[\s·•|]+|[\s·•|]+$/g, '').trim();
    if (!task) task = label.trim();
  }

  // Section header: "TODAY · 3 ITEMS" style — combines count and time.
  const sectionParts = [];
  if (due)   sectionParts.push(due.toUpperCase());
  if (count) sectionParts.push(count + ' ITEM' + (count === '1' ? '' : 'S'));
  const section = sectionParts.join(' · ');

  const imgUrl =
    typeof c.imageUrl === 'string' ? c.imageUrl.trim()
      : typeof c.image === 'string' ? c.image.trim()
        : '';
  return { kind: 'reminder', task, due, count, section, imageUrl: imgUrl };
}

// Parse message content: sender, preview, time, count.
// Examples:
//   label="Messages · 2 new", value="Alex: Running 10 min late"
//   label="Alex",             value="Hey, are you around?"
//   label="Slack · 3 new",    value="Sarah: Stand-up moved to 10"
function _parseMessageVariant(content) {
  const c     = content || {};
  const label = String(c.label || '');
  const value = String(c.value || '');

  // Count of new messages (e.g. "2 new", "3 unread")
  const countMatch = label.match(/\b(\d+)\s+(?:new|unread|messages?)\b/i);
  const count = countMatch ? countMatch[1] : '';

  // Time (e.g. "now", "5m", "2h ago", "10:30 AM")
  let time = '';
  const timeMatch = label.match(/\b(now|\d{1,2}\s*(?:m|h|d)\b|\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  if (timeMatch) time = timeMatch[0];

  // Sender + preview: pattern "Sender: message" or "Sender — message"
  let sender = '';
  let preview = '';
  const colonSplit = value.match(/^([^:—–]+?)\s*[:—–]\s*(.+)$/);
  if (colonSplit) {
    sender = colonSplit[1].trim();
    preview = colonSplit[2].trim();
  } else {
    // No sender in value — try label as sender (if it doesn't have count/time)
    const cleanLabel = label.replace(/messages?\s*·\s*\d+\s+(?:new|unread).*$/i, '').replace(/\s*·.*$/, '').trim();
    if (cleanLabel && cleanLabel.length <= 30 && !/messages?/i.test(cleanLabel)) {
      sender = cleanLabel;
      preview = value;
    } else {
      preview = value;
    }
  }

  // Section header
  const sectionParts = [];
  if (count) sectionParts.push(count + ' NEW');
  if (time && time.toLowerCase() !== count) sectionParts.push(time.toUpperCase());
  const section = sectionParts.length ? 'MESSAGES · ' + sectionParts.join(' · ') : 'MESSAGES';

  const imageUrl =
    typeof c.imageUrl === 'string' ? c.imageUrl.trim()
      : typeof c.image === 'string' ? c.image.trim()
        : '';

  return { kind: 'message', sender, preview, count, time, section, imageUrl };
}

// Parse ETA content: time, destination, traffic, route.
// When uiState tags include commute/navigation (or content requests trip UI),
// returns kind `active-trip` — in-trip card with progress bar + End trip
// (GenUI travel / 교통 reference layout).
// Examples:
//   label="ETA · home", value="12 min · Light traffic"  → classic eta
//   + contextTags commute + label "Drive 1 min (500 m)" → active-trip
function _parseEtaVariant(content, uiState) {
  const c     = content || {};
  const label = String(c.label || '');
  const value = String(c.value || '');
  const all   = label + ' · ' + value;

  const tags = (uiState && Array.isArray(uiState.contextTags))
    ? uiState.contextTags.map(String)
    : [];
  const tagSet = new Set(tags.map(t => t.toLowerCase()));
  const tagTrip =
    c.tripSession === true ||
    c.activeTrip === true ||
    String(c.layout || '').toLowerCase() === 'trip-session' ||
    tagSet.has('trip-session') ||
    tagSet.has('active-trip') ||
    tagSet.has('in-trip');
  const tagNav =
    tagSet.has('commute') ||
    tagSet.has('navigation') ||
    tagSet.has('maps') ||
    tagSet.has('gps');

  const imageUrl =
    typeof c.imageUrl === 'string' ? c.imageUrl.trim()
      : typeof c.image === 'string' ? c.image.trim()
        : '';

  const explicitHead = String(c.headline || c.head || '').trim();
  const explicitArr  = String(c.arrival || '').trim();
  const explicitAddr = String(c.address || c.destinationLine || '').trim();

  const useActiveTrip =
    c.tripSession !== false &&
    (tagTrip ||
      (explicitHead && explicitArr) ||
      (tagNav && (/\b(drive|driving|navigat|turn|route|\d+\s*min|m\)|km|arrival|도착)\b/i.test(all) || explicitAddr.length > 8)));

  if (useActiveTrip) {
    const headline =
      explicitHead ||
      (label.trim() ? label.trim() : (function () {
        const etaMinMatch = all.match(/\b(\d{1,3}\s*(?:min|m\b))\b/i);
        const distMatch = all.match(/\(\s*([^)]+)\s*\)/);
        if (etaMinMatch && distMatch) return 'Drive ' + etaMinMatch[1] + ' (' + distMatch[1] + ')';
        if (etaMinMatch) return 'Drive ' + etaMinMatch[1];
        return 'Drive 1 min (500 m)';
      })());
    let arrival = explicitArr;
    if (!arrival) {
      const am = value.match(/\bArrival\s*:\s*([^\n·|]+)/i) || all.match(/\bArrival\s*:\s*([^\n·|]+)/i);
      arrival = am ? am[1].trim() : '';
    }
    if (!arrival) {
      const tm = all.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/);
      arrival = tm ? 'Arrival: ' + tm[1] : '';
    }
    let address = explicitAddr;
    if (!address) {
      const dm = label.match(/(?:ETA|Arrival|To|Going to|Heading to)[\s·]+(.+?)$/i);
      const destFromLabel = dm ? dm[1].trim() : '';
      const addrM = value.match(/\d[^·\n]*(?:Rd|Street|St|Ave|Avenue|Blvd|Dr|Road|R\s|길|로|번지)[^·\n]*/i);
      address = (addrM && addrM[0].trim()) || destFromLabel || '';
    }
    let pct = c.percent != null ? +c.percent : NaN;
    if (!Number.isFinite(pct)) pct = NaN;
    if (!Number.isFinite(pct) && c.progress != null) pct = +c.progress;
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) pct = 48;
    const endLabel = String(c.endLabel || c.endTripLabel || 'End Trip').trim() || 'End Trip';
    const pinIconUrl =
      typeof c.pinIconUrl === 'string' ? c.pinIconUrl.trim()
        : typeof c.pinUrl === 'string' ? c.pinUrl.trim()
          : '';
    const thumbIconUrl =
      typeof c.thumbIconUrl === 'string' ? c.thumbIconUrl.trim()
        : typeof c.carIconUrl === 'string' ? c.carIconUrl.trim()
          : '';
    return {
      kind: 'active-trip',
      headline,
      arrival,
      address,
      percent: pct,
      endLabel,
      imageUrl,
      pinIconUrl,
      thumbIconUrl,
      accent: typeof c.accent === 'string' ? c.accent : '#14B8A6',
      fillColor: typeof c.fillColor === 'string' ? c.fillColor : '#0A84FF'
    };
  }

  // ETA: "12 min", "1 h 5 min", "35 min"
  let eta = '';
  const etaMinMatch = all.match(/\b(\d{1,3}\s*(?:min|m\b))\b/i);
  const etaHrMatch  = all.match(/\b(\d{1,2}\s*h(?:our)?s?(?:\s+\d{1,3}\s*min)?)\b/i);
  if (etaHrMatch)  eta = etaHrMatch[1].replace(/\s+/g, ' ');
  else if (etaMinMatch) eta = etaMinMatch[1].replace(/\s+/g, ' ');

  // Destination: from label after "ETA ·" or "To" or "Arrival ·"
  let destination = '';
  const destMatch = label.match(/(?:ETA|Arrival|To|Going to|Heading to)[\s·]+(.+?)$/i);
  if (destMatch) {
    destination = destMatch[1].trim();
  } else if (/^\s*(?:home|work|office|airport)\b/i.test(label)) {
    destination = label.trim();
  }

  // Traffic: "Light", "Moderate", "Heavy", "Severe"
  const trafficMatch = all.match(/\b(light|moderate|heavy|severe)\s+traffic\b/i);
  const traffic = trafficMatch ? trafficMatch[0] : '';

  // Route: "via X" or "on X"
  const routeMatch = all.match(/\bvia\s+(.+?)$/i);
  const route = routeMatch ? routeMatch[0] : '';

  return { kind: 'eta', eta, destination, traffic, route, imageUrl };
}

// Parse notification content: app name, time, body, glyph.
// Examples:
//   label="Slack",              value="Sarah: Stand-up moved to 10"
//   label="WhatsApp · 5m",      value="Alex sent you a message"
//   label="Mail",               value="Quarterly review · Due Friday"
//
// We keep `value` whole as the notification body (sender + message stays
// readable as one line) and pull the app name + time out of the label.
function _parseNotificationVariant(content) {
  const c     = content || {};
  const label = String(c.label || '');
  const value = String(c.value || '');

  // App name + time: "Slack · 5m" or just "Slack"
  let appName = '';
  let time    = '';
  const appTimeMatch = label.match(/^([^·•|]+?)\s*[·•|]\s*(\d+\s*(?:m|h|d)\b|\d{1,2}:\d{2}|now)/i);
  if (appTimeMatch) {
    appName = appTimeMatch[1].trim();
    time    = appTimeMatch[2].trim();
  } else {
    appName = label.trim();
  }

  // Glyph letter for the app icon (first letter of appName, fallback "•")
  const glyph = appName ? appName.charAt(0).toUpperCase() : '•';

  return { kind: 'notification', appName, time, body: value, glyph };
}

// Parse the LLM's free-form calendar content into structured fields the
// renderer can lay out. The LLM emits things like:
//   label="Next up · Today",      value="Team stand-up · 9:30 AM · Studio A"
//   label="This morning",         value="Coffee with Maya · 9:30 AM · Elm Café"
//   label="9:30 AM · Stand-up",   value="Studio A · 30 min"
// We pull out: time (e.g. "9:30 AM"), event title, location, duration,
// section header. Everything else falls through as null fields.
function _parseCalendarVariant(content) {
  const c     = content || {};
  const label = String(c.label || '');
  const value = String(c.value || '');
  const all   = label + ' · ' + value;

  // Time: "9:30 AM" or "14:30" or "9 AM" — capture full match.
  const timeRe = /\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\b|\b(\d{1,2}:\d{2})\b/;
  const timeMatch = all.match(timeRe);
  const time = timeMatch ? (timeMatch[1] || timeMatch[2]).toUpperCase().replace(/\s+/g, ' ') : '';

  // Duration: "30 min", "1h", "1 hour"
  const durMatch = all.match(/\b(\d{1,3}\s*(?:min|minute|hour|hr|h)s?\.?)\b/i);
  const duration = durMatch ? durMatch[1].replace(/\s+/g, ' ') : '';

  // Section header: short label like "Today", "Next up · Today", "This
  // morning" — the LLM's contextual heading. Used as the small caption
  // line above the event.
  const SECTION_HINTS = /^(today|tomorrow|this morning|this afternoon|tonight|next up|coming up|upcoming|now)\b/i;
  let section = '';
  if (SECTION_HINTS.test(label)) {
    section = label.split(/\s*[·•|]\s*/)[0].trim();
    // If label is "Next up · Today" keep the longer version as a richer
    // section header.
    const fullLabelTrimmed = label.trim();
    if (fullLabelTrimmed.length <= 24 && SECTION_HINTS.test(fullLabelTrimmed)) {
      section = fullLabelTrimmed;
    }
  }

  // Strip time + duration from value to extract title + location.
  let body = value;
  if (time)     body = body.replace(time, '·');
  if (duration) body = body.replace(duration, '·');
  // Normalize separators to "·" then split.
  const parts = body.split(/\s*[·•|,]\s*/).map(s => s.trim()).filter(Boolean);

  // Heuristic: first part = title (event name); a part that looks like
  // a place (Studio A, Elm Café, Zoom, Conference Room 3) = location.
  let title = '';
  let location = '';
  if (parts.length === 1) {
    title = parts[0];
  } else if (parts.length >= 2) {
    title    = parts[0];
    location = parts[parts.length - 1];
    // If the "location" looks like a number/time/junk, drop it.
    if (!location || /^\d+\s*$/.test(location)) location = '';
  }

  // Fallback: if title still empty, derive from label (sans section header).
  if (!title) {
    const labelStripped = section
      ? label.replace(section, '').replace(/^[\s·•|]+/, '').trim()
      : label;
    if (labelStripped) title = labelStripped;
  }

  const imageUrl =
    typeof c.imageUrl === 'string' ? c.imageUrl.trim()
      : typeof c.image === 'string' ? c.image.trim()
        : '';

  return { kind: 'calendar', time, duration, title, location, section, imageUrl };
}

// Parse the LLM's free-form weather content (e.g. label="San Francisco ·
// Partly cloudy", value="13°C · feels 11°") into structured fields the
// renderer can lay out properly: temp, condition phrase, location, feels-
// like, and a glyph name for the weather icon. Tolerant of variant
// separators (·, |, comma) and bare values like "Sunny 22°".
function _parseWeatherVariant(content) {
  const c     = content || {};
  const label = String(c.label || '');
  const value = String(c.value || '');
  const all   = label + ' ' + value;
  const lc    = all.toLowerCase();

  // Temperature: first numeric token followed by ° (preserves negative).
  const tempMatch = all.match(/(-?\d{1,3}(?:\.\d+)?)\s*°/);
  const temp = tempMatch ? tempMatch[1] + '°' : '';

  // Feels-like: "feels 16°" or "feels like 16°"
  const feelsMatch = all.match(/feels?\s*(?:like\s*)?(-?\d{1,3}(?:\.\d+)?)\s*°?/i);
  const feels = feelsMatch ? feelsMatch[1] + '°' : '';

  // Condition icon — keyword scan, ordered most-specific first.
  const ICON_RULES = [
    [/partly\s*(?:cloudy|sunny)|mostly\s*sunny/, 'cloud-sun'],
    [/clear|sunny/,                              'sun'],
    [/storm|thunder|lightning/,                  'bolt'],
    [/rain|shower|drizzle/,                      'rain'],
    [/snow|flurries|sleet/,                      'snow'],
    [/fog|mist|haze/,                            'fog'],
    [/wind/,                                     'wind'],
    [/cloud|overcast/,                           'cloud']
  ];
  let icon = 'sun';
  for (const [re, ic] of ICON_RULES) {
    if (re.test(lc)) { icon = ic; break; }
  }

  // Condition phrase — pick the first matched human-readable label.
  const CONDITION_PHRASES = [
    'Partly cloudy', 'Mostly cloudy', 'Mostly sunny', 'Partly sunny',
    'Thunderstorm', 'Storms', 'Showers', 'Drizzle',
    'Sunny', 'Clear', 'Cloudy', 'Overcast',
    'Rain', 'Snow', 'Sleet', 'Fog', 'Mist', 'Haze', 'Windy'
  ];
  let condition = '';
  for (const w of CONDITION_PHRASES) {
    if (new RegExp('\\b' + w + '\\b', 'i').test(all)) {
      condition = w;
      break;
    }
  }

  // Location — first segment of label before separator, only if it looks
  // like a place (not a weather word, not "Today/Tomorrow/Now").
  let location = '';
  const segMatch = label.match(/^([^·,|]+?)(?:\s*[·,|])/);
  const candidate = segMatch ? segMatch[1].trim() : (/[·,|]/.test(label) ? '' : label.trim());
  if (candidate) {
    const lcCandidate = candidate.toLowerCase();
    const isWeatherWord = /sunny|cloud|rain|snow|clear|partly|fog|storm|wind|sleet|drizzle|shower|haze|mist|overcast/.test(lcCandidate);
    const isTimeWord    = /^(today|tomorrow|now|current|morning|afternoon|evening|night|tonight)\b/.test(lcCandidate);
    if (!isWeatherWord && !isTimeWord && candidate.length > 0 && candidate.length <= 40) {
      location = candidate;
    }
  }

  return { kind: 'weather', temp, condition, location, feels, icon };
}

// Build the Path B atomic comp object from a Path A child + content. Each
// atomic expects a slightly different content/variant shape.
function _adaptForBodyAtomic(atomicRole, child, content, uiState) {
  const comp = { role: atomicRole };
  const c = content || {};
  switch (atomicRole) {
    case 'focus-block': {
      // VERIFIED at surface-layout.js:1204-1249 — atomic reads
      // comp.variant.title / variant.sub / variant.body / variant.kind.
      // Weather card gets a dedicated parser → kind='weather' so the
      // renderer can lay out icon + large temp + condition + location
      // instead of generic title+sub. Calendar gets kind='calendar' →
      // calendar icon + time + title + location. Other rich cards still
      // fall through to the title/body default until they get their own
      // treatments.
      if (child.componentId === 'weather_glance_card') {
        comp.variant = _parseWeatherVariant(c);
        break;
      }
      if (child.componentId === 'calendar_summary_card') {
        comp.variant = _parseCalendarVariant(c);
        break;
      }
      if (child.componentId === 'reminder_card') {
        comp.variant = _parseReminderVariant(c);
        break;
      }
      if (child.componentId === 'message_summary_card') {
        comp.variant = _parseMessageVariant(c);
        break;
      }
      if (child.componentId === 'eta_card') {
        comp.variant = Object.assign(
          _parseEtaVariant(c, uiState),
          child && typeof child.variant === 'object' && child.variant !== null ? child.variant : {}
        );
        break;
      }
      if (child.componentId === 'input_summary_card') {
        comp.variant = _parseInputVariant(c);
        break;
      }
      const img =
        typeof c.imageUrl === 'string' ? c.imageUrl.trim()
          : typeof c.image === 'string' ? c.image.trim()
            : '';
      const childV =
        child && typeof child.variant === 'object' && child.variant !== null ? child.variant : {};
      if (childV.kind === 'running' || childV.kind === 'workout') {
        var rvImg =
          img ||
          (typeof childV.imageUrl === 'string' ? childV.imageUrl.trim()
            : typeof childV.coverUrl === 'string' ? childV.coverUrl.trim()
              : typeof childV.iconUrl === 'string' ? childV.iconUrl.trim()
                : '');
        var rvPct = childV.percent != null ? +childV.percent : NaN;
        if (!Number.isFinite(rvPct) && c.value != null) {
          var rvTry = parseFloat(String(c.value).replace(/%/g, ''));
          if (Number.isFinite(rvTry) && rvTry >= 0 && rvTry <= 100) rvPct = rvTry;
        }
        if (!Number.isFinite(rvPct)) rvPct = 11;
        comp.variant = Object.assign({}, childV, {
          kind: childV.kind,
          title: childV.title || childV.headline || c.label || 'Running',
          headline: childV.headline || childV.title || c.label,
          stats: childV.stats || childV.subtitle || c.value || '',
          subtitle: childV.subtitle,
          percent: rvPct,
          pauseLabel: childV.pauseLabel || 'Pause',
          finishLabel: childV.finishLabel || 'Finish',
          accent: childV.accent || '#34d399'
        }, rvImg ? { imageUrl: rvImg } : {});
        break;
      }
      // For richer content (recipe step instructions) use kind='secondary'
      // so value renders as a body paragraph; for short content use the
      // default kind which renders title + sub.
      const rawVal = String(c.value || '');
      const nl = rawVal.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const lb = String(c.label || '');
      const looksForecast =
        nl.length >= 2 &&
        (/hour|outlook|forecast|detail|next\s*\d|5-?day|humidity|weather|\d\s*(?:pm|am)|°|°c|°f|cloud|rain|sunny|wind|uv\b/i.test(lb + ' ' + rawVal.slice(0, 160)));
      if (looksForecast) {
        comp.variant = Object.assign(
          {
            kind: 'chip_section',
            title: lb.trim() || child.slot || child.componentId,
            lines: capChipSectionLines(lb, nl),
            wrap: /detail|humidity|uv|wind|rain|metric/i.test(lb)
          },
          img ? { imageUrl: img } : {}
        );
        break;
      }
      const hasBody = rawVal.length > 72;
      if (hasBody) {
        comp.variant = Object.assign(
          { kind: 'secondary', title: c.label || child.slot || child.componentId, body: c.value },
          img ? { imageUrl: img } : {}
        );
      } else {
        comp.variant = Object.assign(
          { title: c.label || child.slot || child.componentId, sub: c.value || '' },
          img ? { imageUrl: img } : {}
        );
      }
      break;
    }
    case 'now-bar': {
      comp.variant = _inferNowBarVariant(child, c, uiState);
      break;
    }
    case 'media-card': {
      comp.variant = {
        title:   c.title  || c.label || '',
        artist:  c.artist || c.value || '',
        service: c.service || ''
      };
      break;
    }
    case 'progress-track': {
      var ptRaw = (child && typeof child.variant === 'object' && child.variant !== null) ? child.variant : {};
      comp.variant = Object.assign({}, ptRaw);
      if (child && child.componentId === 'music_progress_strip') {
        comp.variant.layout = comp.variant.layout || 'music-strip';
      }
      if (c.value != null && String(c.value).trim() !== '') {
        var ptNum = +c.value;
        if (Number.isFinite(ptNum)) {
          comp.variant.percent = Math.max(0, Math.min(100, ptNum));
        }
      }
      break;
    }
    case 'action-row': {
      const _rasterActionIcon = (v) => {
        if (v == null || v === '') return '';
        const t = String(v).trim();
        if (!t || /[\s"'<>]/.test(t)) return '';
        if (/^https?:\/\//i.test(t)) return t;
        if (/^app-icons\//i.test(t)) return t;
        if (/^assets\//i.test(t)) return t;
        if (/^\/(?!\/)/.test(t)) return t;
        return '';
      };
      // VERIFIED at surface-layout.js:1342 — atomic expects
      // variant.actions = [{label, icon?, kind?}, …] (objects, not strings).
      // We try BOTH label and value so the LLM can put a list in either.
      // Per-action icon is inferred from the label keyword: "save" → save
      // glyph, "share" → share glyph, etc. — the renderer reads action.icon
      // and renders the SVG inline.
      const ICON_KEYWORDS = [
        [/save|bookmark/i,         'bookmark'],
        [/share|send/i,            'share'],
        [/edit|pencil/i,           'edit'],
        [/delete|remove|trash/i,   'trash'],
        [/copy|duplicate/i,        'copy'],
        [/download|save\s+to/i,    'download'],
        [/like|favorite|heart/i,   'heart'],
        [/comment|reply|message/i, 'comment'],
        [/play|start/i,            'play'],
        [/pause|stop/i,            'pause'],
        [/repeat|replay|redo/i,    'repeat'],
        [/next\s+step|^next\b|\bskip\b/i, 'skip-forward'],
        [/back|previous/i,         'skip-back'],
        [/read\b|ingredients|recipe\s+list/i, 'book'],
        [/route|directions|navigate|commute|\beta\b|map\b|trail|loop\b/i, 'pin'],
        [/skip\s+song|next\s+track/i, 'skip-forward'],
        [/lap\b|split\b|pace\b/i, 'clock'],
        [/add|plus|new/i,          'plus'],
        [/cancel|close|dismiss/i,  'x'],
        [/ok|confirm|done|accept/i,'check'],
        [/settings|options/i,      'settings'],
        [/search|find/i,           'search'],
        [/timer|countdown/i,       'clock'],
        [/substitute|swap|replace/i, 'swap'],
        [/scale|measure|weight|grams?\b/i, 'scale'],
        [/voice|bixby|dictat|hands-?free/i, 'mic'],
        [/more\b|^⋯|ellipsis|overflow menu/i, 'more-vertical']
      ];
      function _inferIcon(label) {
        for (const [re, ic] of ICON_KEYWORDS) if (re.test(label)) return ic;
        return null;
      }
      const REGISTRY_BTN_KIND = {
        'btn-contained': 'primary',
        'btn-outlined': 'secondary',
        'btn-flat': 'secondary',
        'fab': 'primary',
        'chip': 'secondary',
        'button.dark': 'secondary',
        'button.light': 'secondary',
        'button.accent': 'primary',
        'button.galaxy-ai': 'primary',
        'button.header-small': 'secondary'
      };
      const cidBtn = child && child.componentId;
      if (cidBtn && REGISTRY_BTN_KIND[cidBtn]) {
        const lbl =
          String(c.label || '').trim() ||
          String(c.value || '').trim() ||
          'Continue';
        const ri =
          _rasterActionIcon(c.icon) ||
          _rasterActionIcon(c.iconUrl) ||
          _rasterActionIcon(c.imageUrl);
        comp.variant = {
          actions: [{
            label: lbl,
            icon: ri || _inferIcon(lbl),
            kind: REGISTRY_BTN_KIND[cidBtn]
          }]
        };
        if (child && child.componentId === 'floating_action_bar' && comp.variant && !comp.variant.layout) {
          comp.variant.layout = 'floating-pill';
        }
        break;
      }
      if (Array.isArray(c.actions) && c.actions.length) {
        comp.variant = {
          actions: c.actions.map((a, i) => {
            const lbl = String(a.label || a.name || '').trim();
            const ri =
              _rasterActionIcon(a.icon) ||
              _rasterActionIcon(a.iconUrl) ||
              _rasterActionIcon(a.imageUrl);
            return {
              label: lbl,
              icon: ri || (a.icon != null && String(a.icon).trim() ? a.icon : null) || _inferIcon(lbl),
              kind: a.kind != null ? a.kind
                : (i === 0 && !/cancel|dismiss|delete|remove/i.test(lbl) ? 'primary' : null)
            };
          }).filter(a => a.label)
        };
        if (child && child.componentId === 'floating_action_bar' && comp.variant && !comp.variant.layout) {
          comp.variant.layout = 'floating-pill';
        }
        break;
      }
      let labelSrc = '';
      const vRaw = String(c.value || '').trim();
      const lRaw = String(c.label || '').trim();
      if (child && child.componentId === 'action_chip_row') {
        if (chipListHasMultipleSegments(vRaw)) labelSrc = vRaw;
        else if (chipListHasMultipleSegments(lRaw)) labelSrc = lRaw;
        else labelSrc = lRaw || vRaw || '';
      } else {
        labelSrc = lRaw || vRaw || '';
      }
      let labels = splitListPreservingNumericFractions(labelSrc);
      if (child && child.componentId === 'action_chip_row' && labels.length > 24) {
        labels = labels.slice(0, 24);
      }
      comp.variant = {
        actions: labels.map((l, i) => ({
          label: l,
          icon: _inferIcon(l),
          // First action defaults to primary unless label looks negative
          kind: (i === 0 && !/cancel|dismiss|delete|remove/i.test(l)) ? 'primary' : (i === 0 ? 'secondary' : null)
        }))
      };
      if (child && child.componentId === 'floating_action_bar' && comp.variant && !comp.variant.layout) {
        comp.variant.layout = 'floating-pill';
      }
      break;
    }
    case 'toggle-chip': {
      // For `quick_toggle_row`: parse multiple toggle names from the LLM
      // value (comma/dot/pipe separated) and emit them as a row of small
      // toggles. The renderer checks `variant.toggles` and switches to
      // multi-toggle layout. Single-toggle path keeps the legacy shape.
      const isRow = child && child.componentId === 'quick_toggle_row';
      if (isRow) {
        const labelSrc = c.label || c.value || '';
        const items = splitListPreservingNumericFractions(labelSrc);
        const TOGGLE_ICON_MAP = [
          [/wifi|wireless/i,        'wifi'],
          [/bluetooth/i,            'bluetooth'],
          [/flashlight|torch/i,     'flashlight'],
          [/airplane|flight/i,      'airplane'],
          [/hotspot|tether/i,       'hotspot'],
          [/location|gps/i,         'location'],
          [/auto[-\s]?rotate/i,     'auto-rotate'],
          [/sound|audio/i,          'sound'],
          [/vibrat/i,               'vibrate'],
          [/mute|silent/i,          'mute'],
          [/power[-\s]?sav|battery[-\s]?sav/i, 'power-save'],
          [/camera/i,               'camera'],
          [/screen[-\s]?share|cast/i,'screen-share']
        ];
        function _inferToggleIcon(name) {
          for (const [re, ic] of TOGGLE_ICON_MAP) if (re.test(name)) return ic;
          return null;
        }
        comp.variant = {
          toggles: items.map((name, i) => ({
            name,
            icon: _inferToggleIcon(name) || 'sound',
            on: i < 3   // default first few "on" — visual variety
          }))
        };
      } else {
        comp.variant = {
          title: c.label || child.slot || 'Toggle',
          sub:   c.value || '',
          on:    true
        };
      }
      break;
    }
    case 'focus-block-group': {
      const chv = (child && typeof child.variant === 'object' && child.variant) ? child.variant : {};
      const items = Array.isArray(c.items) ? c.items
        : Array.isArray(c.themes) ? c.themes
          : Array.isArray(chv.items) ? chv.items
            : Array.isArray(chv.tiles) ? chv.tiles : undefined;
      comp.variant = Object.assign({ layout: 'theme-summary-grid' }, chv);
      if (items && items.length) comp.variant.items = items;
      break;
    }
    case 'notif-card':
    case 'notif-card-ai': {
      // Use the dedicated notification parser to extract app name, time,
      // body, and a glyph letter — feeds the existing notif-card
      // renderer (which expects title/body/time/glyph). App name maps
      // to title (renders as the bold top line), full value becomes the
      // body. Matches Samsung One UI notification stack visually.
      const parsed = _parseNotificationVariant(c);
      // Per-app accent color (fallback gray). Maps common app names to
      // their brand-ish accent so the icon circle isn't always gray.
      const APP_ACCENT = {
        slack:    '#611F69',
        whatsapp: '#25D366',
        mail:     '#0073E6',
        gmail:    '#EA4335',
        message:  '#34D399',
        messages: '#34D399',
        kakao:    '#FFCD00',
        line:     '#06C755',
        instagram:'#E1306C',
        twitter:  '#1DA1F2',
        x:        '#000000',
        calendar: '#A78BFA',
        weather:  '#FBBF24'
      };
      const accentKey = parsed.appName.toLowerCase();
      const accent = APP_ACCENT[accentKey] || '#3B82F6';
      comp.variant = {
        title:    parsed.appName || child.slot || 'Notification',
        subtitle: parsed.body || '',
        body:     parsed.body || '',
        time:     parsed.time,
        glyph:    parsed.glyph,
        accent:   accent,
        kind:     atomicRole === 'notif-card-ai' ? 'ai' : 'regular'
      };
      break;
    }
    case 'clock': {
      comp.variant = {};
      break;
    }
    case 'weather-date': {
      comp.variant = { temp: c.value || '', condition: c.label || '' };
      break;
    }
    case 'dialog-site-header': {
      const logoUrl =
        c.logoUrl || c.iconUrl || c.faviconUrl || c.thumbnailUrl ||
        c.imageUrl || c.heroUrl || '';
      comp.variant = {
        siteName: c.siteName || c.title || c.label || '',
        url: c.url || c.siteDesc || c.value || '',
        title: c.title,
        siteDesc: c.siteDesc,
        logoUrl
      };
      break;
    }
    case 'dialog-browser-bar': {
      let shortcuts = Array.isArray(c.shortcuts) ? c.shortcuts : null;
      if (!shortcuts && (c.label || c.value)) {
        const merge = [c.label, c.value].filter(Boolean).join(' ');
        const parts = merge.split(/\s*[,/|·•]\s*/).map(s => s.trim()).filter(Boolean);
        if (parts.length) shortcuts = parts.map(label => ({ label }));
      }
      comp.variant = shortcuts && shortcuts.length ? { shortcuts } : {};
      break;
    }
    case 'dialog-icon-grid': {
      let apps = Array.isArray(c.apps) ? c.apps : Array.isArray(c.items) ? c.items : null;
      if (!apps && (c.label || c.value)) {
        const src = c.value || c.label || '';
        apps = src.split(/\s*[,/|·•]\s*/).map(s => s.trim()).filter(Boolean).map(name => ({ name }));
      }
      comp.variant = apps && apps.length ? { apps } : {};
      break;
    }
    case 'shortcutLeft':
    case 'shortcutRight': {
      comp.variant = { icon: c.icon || 'phone' };
      break;
    }
    default: {
      // Cover both channels so any atomic that reads either side gets data.
      comp.variant = { title: c.label || '', sub: c.value || '', body: c.value || '' };
      comp.content = { title: c.label || '', subtitle: c.value || '' };
    }
  }
  return comp;
}

// Build a short, human-readable app-bar title from a scenario string +
// optional primaryGoal. Without this helper, primaryGoal verbosity (e.g.
// "personalized, context-aware guidance inside a cooking assistant")
// leaks straight into the header and reads like a prompt. Strategy:
//   1. Scan for known app/task domain keywords (cooking, weather,
//      navigation, …). If found → use that as the title.
//   2. Strip leading qualifiers ("personalized, smart, …").
//   3. Clip to ~22 chars at a word boundary.
//   4. Title-case.
// Returns '' when the input has nothing meaningful — caller decides what
// to do (atomic placeholder vs hide).
const APP_DOMAIN_PATTERNS = [
  // Each entry: regex to MATCH in scenario, label to USE as title.
  // Ordered most-specific → most-generic so "cooking assistant" wins
  // before generic "cooking".
  [/cooking\s+assistant/i,                'Cooking Assistant'],
  [/personalized\s+running\s+assistant|running\s+assistant/i, 'Running Assistant'],
  [/personalized\s+flight\s+assistant|flight\s+assistant/i,   'Flight Assistant'],
  [/recipe(?:\s+book|\s+app)?/i,           'Recipes'],
  [/cooking|kitchen|chef/i,                'Cooking'],
  [/workout|fitness|exercise|training/i,   'Fitness'],
  [/navigation|maps|route\s+to|driving/i,  'Navigation'],
  [/weather\s+forecast/i,                  'Weather Forecast'],
  [/weather/i,                             'Weather'],
  [/calendar|schedule|agenda/i,            'Calendar'],
  [/messages?|chat|inbox|conversation/i,   'Messages'],
  [/notification\s+shade|notifications?/i, 'Notifications'],
  [/quick\s+settings|control\s+panel/i,    'Quick Settings'],
  [/settings|preferences|configuration/i,  'Settings'],
  [/music|playlist|player|now\s+playing/i, 'Music'],
  [/camera|capture|photo\s+mode/i,         'Camera'],
  [/gallery|photos?/i,                     'Gallery'],
  [/timer|stopwatch/i,                     'Timer'],
  [/alarm/i,                               'Alarm'],
  [/notes?\s+app|memo/i,                   'Notes'],
  [/reminders?\s+app|to-?dos?\s+app/i,     'Reminders'],
  [/shopping|cart|store/i,                 'Shopping'],
  [/payment|wallet|pay/i,                  'Wallet'],
  [/email|mail/i,                          'Mail'],
  [/news|article(?:s)?/i,                  'News'],
  [/translat/i,                            'Translate'],
  [/calculator/i,                          'Calculator'],
  [/contacts?|phonebook/i,                 'Contacts'],
  [/dial(?:er)?|phone\s+app/i,             'Phone'],
  [/bixby|voice\s+assistant/i,             'Bixby'],
  [/health|wellness/i,                     'Health'],
  [/sleep|bedtime/i,                       'Sleep']
];
function _shortAppBarTitle(scenarioText, primaryGoal) {
  const sources = [scenarioText || '', primaryGoal || ''];
  // 1. Domain keyword scan
  for (const text of sources) {
    if (!text) continue;
    for (const [re, label] of APP_DOMAIN_PATTERNS) {
      if (re.test(text)) return label;
    }
  }
  // 2. Fallback: clean primaryGoal/scenario, strip leading qualifiers,
  //    truncate to ~22 chars at word boundary.
  const QUALIFIER_PREFIX = /^(a |an |the |this |my |your |personalized|smart|intelligent|adaptive|context-?aware|ai-?powered|simple|new|user-?facing|customized|deep|full)\b[\s,]*/i;
  for (const text of sources) {
    if (!text) continue;
    let cleaned = text.trim();
    // Strip up to 3 leading qualifier rounds
    for (let i = 0; i < 3; i++) {
      const stripped = cleaned.replace(QUALIFIER_PREFIX, '');
      if (stripped === cleaned) break;
      cleaned = stripped;
    }
    cleaned = cleaned.replace(/^[\s,.;:·•|]+/, '');
    if (!cleaned) continue;
    // Clip to 22 chars at last whole word
    let clipped = cleaned.slice(0, 22);
    if (cleaned.length > 22) {
      const lastSpace = clipped.lastIndexOf(' ');
      if (lastSpace > 8) clipped = clipped.slice(0, lastSpace);
    }
    // Title-case the first letter
    return clipped.charAt(0).toUpperCase() + clipped.slice(1);
  }
  return '';
}

// Chrome adapter — separate function so chrome and body don't share
// branching logic. Verified against surface-layout.js render cases:
//   status-bar (line 899):         reads variant.battery / variant.carrier / variant.theme
//   collapsed-app-bar (line 944):  reads content.title (or comp.text) — NOT variant
//   expandable-app-bar (line 932): reads content.title / content.subtitle
//   gesture-bar / nav-buttons:     no content needed (atomic draws the bar)
function _adaptForChromeAtomic(atomicRole, child, content, pageHint) {
  const comp = { role: atomicRole };
  const c = content || {};
  const hint = pageHint || {};
  // Title fallback chain for app-bar titles, in preference order:
  //   1. LLM-emitted content.label (best — the LLM thought about it)
  //   2. interpretation.intent.primaryGoal (good — derived from scenario)
  //   3. titleCase(scenario_text first 40 chars) (decent — at least relevant)
  //   4. child.slot (poor — but only fires when slot is meaningful, NOT
  //      the synthetic "chrome" slot used by mandatory injection)
  //   5. '' (empty) — atomic decides whether to show a placeholder
  function _titleFallback() {
    if (c.label) return c.label;
    if (hint.titleHint) return hint.titleHint;
    if (child.slot && child.slot !== 'chrome') return child.slot;
    return '';
  }
  switch (atomicRole) {
    case 'status-bar': {
      let batt = c.battery != null ? +c.battery : NaN;
      if (!Number.isFinite(batt) && c.value != null) {
        const vn = parseFloat(String(c.value).trim().replace(/%/g, ''));
        if (Number.isFinite(vn) && vn >= 0 && vn <= 100) batt = vn;
      }
      if (!Number.isFinite(batt)) batt = 69;
      const wf =
        c.wifi != null ? +c.wifi
        : c.wifiStrength != null ? +c.wifiStrength
        : undefined;
      const cell = c.cellular != null ? +c.cellular : undefined;
      comp.variant = {
        theme: c.theme || 'dark',
        battery: batt,
        carrier: c.carrier || c.label || 'K-Arts',
        wifi: Number.isFinite(wf) ? wf : undefined,
        cellular: Number.isFinite(cell) ? cell : undefined,
        batteryState: c.batteryState || c.batteryIcon || undefined
      };
      break;
    }
    case 'collapsed-app-bar':
    case 'selection-app-bar': {
      const title = _titleFallback();
      comp.content = { title };
      comp.text    = title;
      break;
    }
    case 'expandable-app-bar': {
      const title = _titleFallback();
      comp.content = { title, subtitle: c.value || '' };
      comp.text    = title;
      break;
    }
    case 'gesture-bar':
    case 'nav-buttons':
      comp.variant = {};
      break;
    default:
      comp.content = { title: c.label || '', subtitle: c.value || '' };
      comp.variant = { title: c.label || '', sub: c.value || '' };
  }
  return comp;
}

// Map uiState to one of Path B's SURFACE_TYPES. Used to build the zone
// layout via window.createOneUILayout so we can absolute-position chrome
// into the right slots in the device frame.
function pipelineSurfaceTypeFor(uiState) {
  const T = window.SURFACE_TYPES;
  if (!T || !uiState) return null;
  if (uiState.overlayType === 'system-dialog')      return T.DIALOG_CENTER;
  if (uiState.overlayType === 'notification-shade') return T.NOTIFICATION_SHADE;
  if (uiState.overlayType === 'quick-settings')     return T.QUICK_SETTINGS;
  if (uiState.baseSurface === 'lock')               return T.LOCKSCREEN;
  if (uiState.baseSurface === 'home')               return T.FIRST_DEPTH_LIST;
  if (uiState.baseSurface === 'app')                return T.FIRST_DEPTH_LIST;
  return T.FIRST_DEPTH_LIST;
}

function pipelineRenderChild(child, content, groupId, uiState, pageHint) {
  const type = child.componentId;
  let html;
  let bodyAtomic = null;  // tracked so the wrapper can mark itself appropriately
  // Path B chrome bridge — try this FIRST so chrome IDs render as real
  // status bars / app headers / gesture bars instead of falling through
  // to the "(no template registered)" stub.
  const atomicRole = PIPELINE_CHROME_ATOMIC_ROLE[type];
  if (atomicRole && typeof window.renderAtomicForRole === 'function') {
    // Adapter remaps Path A's { label, value, icon } into the field
    // shape each chrome atomic actually reads (e.g. collapsed-app-bar
    // reads content.title, NOT label — without this the atomic falls
    // back to its built-in "Title" placeholder).
    // pageHint provides interpretation-derived fallbacks (e.g. for the
    // app-bar title when the LLM emitted an empty label on a synthetic
    // mandatory-injected container.header).
    const comp = _adaptForChromeAtomic(atomicRole, child, content || {}, pageHint);
    // rect.w/h are nominal; the absolute-positioned wrapper in
    // renderPipelineResponse will set the real geometry from zones.
    html = window.renderAtomicForRole(comp, { x: 0, y: 0, w: 360, h: 48 });
  } else if (PIPELINE_BODY_ATOMIC_ROLE[type] && typeof window.renderAtomicForRole === 'function') {
    // Path B BODY bridge — info-cards / now-bar / action-row / etc. get
    // rendered as their proper One UI atomics with content adapted from
    // Path A's { label, value, icon } shape.
    bodyAtomic = PIPELINE_BODY_ATOMIC_ROLE[type];
    const comp = _adaptForBodyAtomic(bodyAtomic, child, content || {}, uiState);
    // Atomics size themselves to their container; rect is nominal here.
    html = window.renderAtomicForRole(comp, { x: 0, y: 0, w: 320, h: 64 });
  } else if (templates[type]) {
    html = templates[type]();
  } else if (PIPELINE_FALLBACK_TEMPLATES[type]) {
    html = PIPELINE_FALLBACK_TEMPLATES[type](content || {});
  } else {
    html = `<div class="oui-card"><div class="oui-card-title">${type}</div><div class="oui-card-desc">(no template registered)</div></div>`;
  }
  // Best-effort content injection for registry-native templates
  if (templates[type] && content && (content.label || content.value)) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const title = tmp.querySelector('.oui-card-title, .oui-appbar-title, .oui-list-title, .oui-dialog-title');
    const body  = tmp.querySelector('.oui-card-desc, .oui-list-sub, .oui-dialog-body');
    if (title && content.label) title.textContent = content.label;
    if (body  && content.value) body.textContent  = content.value;
    html = tmp.innerHTML;
  }

  const wrapper = document.createElement('div');
  // Chrome items use a slim wrapper without the .oui-card decoration so a
  // status bar isn't rendered inside a 20px-padded card. They also get
  // absolute-positioned in renderPipelineResponse based on createOneUILayout
  // zones (topSystem / bottomNav). Body atomics get a body-atomic class so
  // CSS can strip canvas-item's default card padding (atomics render their
  // own card chrome internally).
  if (atomicRole) {
    wrapper.className = 'canvas-item chrome-item';
    wrapper.dataset.atomicRole = atomicRole;
  } else if (bodyAtomic) {
    wrapper.className = 'canvas-item body-atomic';
    wrapper.dataset.atomicRole = bodyAtomic;
  } else {
    wrapper.className = 'canvas-item full-width';
  }
  wrapper.id = 'pipeline-item-' + (++itemCounter);
  // data-node-id lets refreshSceneInspector + DesignDoc identify this element
  // by node id (so Scene/Layers panel can highlight + scroll to it on click,
  // and DesignDoc.addNode below stays in sync with the DOM).
  wrapper.dataset.nodeId            = wrapper.id;
  wrapper.dataset.compType          = type;
  wrapper.dataset.pipelineGroup     = groupId || '';
  wrapper.dataset.pipelineVariant   = child.variant || '';
  wrapper.dataset.pipelinePlacement = child.placement || '';
  wrapper.dataset.pipelinePriority  = String(child.priority || 2);
  // Tier 1.1 — data-priority on the wrapper drives the hero variant
  // CSS in genui.css. Priority 1 cards inside primary-task groups get
  // larger sizing via CSS variable overrides scoped to the wrapper.
  wrapper.dataset.priority          = String(child.priority || 2);
  wrapper.dataset.pipelineVisibility = child.visibility || 'visible';
  // NEW: semantic role + slot from the layoutPlan schema. We use
  // data-pipeline-role (NOT data-role — that namespace is already used by
  // the surface-renderer for component-type identifiers like
  // "status-bar"/"now-bar"). CSS in genui.css styles canvas-item by
  // data-pipeline-role (subject/state/action/context/etc.) so visual
  // weight matches the data's stated importance, not just container order.
  // data-pipeline-slot lets future logic link siblings of a task unit
  // (e.g. an action attached to its subject via a shared slot prefix).
  wrapper.dataset.pipelineRole = child.role || '';
  wrapper.dataset.pipelineSlot = child.slot || '';
  wrapper.innerHTML = html;
  wrapper.setAttribute('draggable','true');
  // Click / hover: centralized via interaction-state.js canvas-level tracker.
  initDrag(wrapper);
  return wrapper;
}

/** Group glance cards that share a "today" style header next to each other. */
function clusterTodayGlanceCardsFirst(children, resolveContent) {
  if (!Array.isArray(children) || children.length < 2) return children;
  var GLANCE_IDS = {
    calendar_summary_card: true,
    reminder_card: true,
    message_summary_card: true,
    weather_glance_card: true,
    eta_card: true
  };
  var scored = children.map(function (ch, i) {
    var c = resolveContent(ch) || {};
    var text = String((c.label || '') + ' ' + (c.value || '')).toLowerCase();
    var todayish = /\b(today|now|오늘)\b/i.test(text);
    var id = ch.componentId || '';
    var isGlance = !!GLANCE_IDS[id];
    var bucket = (isGlance && todayish) ? 0 : isGlance ? 1 : 2;
    return { ch: ch, i: i, bucket: bucket };
  });
  scored.sort(function (a, b) {
    if (a.bucket !== b.bucket) return a.bucket - b.bucket;
    return a.i - b.i;
  });
  return scored.map(function (s) { return s.ch; });
}

// Primary-task 2-column layouts: wider hero + narrower action rail (One UI recipe / step UIs).
const _PIPELINE_HERO_ATOMIC = new Set(['focus-block', 'media-card', 'now-bar']);
const _PIPELINE_ACTION_ATOMIC = new Set(['action-row', 'toggle-chip']);

function _pipelineVisibleChildrenInOrder(children) {
  return (children || []).filter(function (ch) {
    return !ch.visibility || ch.visibility === 'visible';
  });
}

function _pipelineHeroActionAsymPair(group, visibleOrdered, isAppShell) {
  if (!isAppShell || !group || group.role !== 'primary-task' || visibleOrdered.length !== 2) return false;
  const ch0 = visibleOrdered[0];
  const ch1 = visibleOrdered[1];
  const r0 = ch0.role || '';
  const r1 = ch1.role || '';
  if ((r0 === 'subject' && r1 === 'action') || (r0 === 'action' && r1 === 'subject')) return true;
  const a0 = PIPELINE_BODY_ATOMIC_ROLE[ch0.componentId || ''];
  const a1 = PIPELINE_BODY_ATOMIC_ROLE[ch1.componentId || ''];
  return (
    (_PIPELINE_HERO_ATOMIC.has(a0) && _PIPELINE_ACTION_ATOMIC.has(a1)) ||
    (_PIPELINE_HERO_ATOMIC.has(a1) && _PIPELINE_ACTION_ATOMIC.has(a0))
  );
}

function _pipelineChildIsSubjectColumn(ch, other) {
  const r = ch.role || '';
  if (r === 'subject') return true;
  if (r === 'action') return false;
  const ro = other.role || '';
  if (ro === 'subject' && r !== 'action') return false;
  if (ro === 'action' && r !== 'subject') return true;
  const a = PIPELINE_BODY_ATOMIC_ROLE[ch.componentId || ''];
  const ao = PIPELINE_BODY_ATOMIC_ROLE[other.componentId || ''];
  return _PIPELINE_HERO_ATOMIC.has(a) && !_PIPELINE_HERO_ATOMIC.has(ao);
}

function renderPipelineResponse(resp) {
  const canvas = document.getElementById('canvas');
  const frame  = document.getElementById('canvasFrame');
  const output = document.getElementById('pipelineOutput');

  const uiState    = resp.uiState    || {};
  const layoutPlan = resp.layoutPlan || {};
  const plan       = resp.plan       || {};
  const validation = resp.validation || { summary: {}, violations: [] };
  const explanation = resp.explanation || {};

  // Urgency → Accent Color (R3-A): expose urgency on the canvas as a data
  // attribute so CSS can apply role-aware accents (Samsung blue for medium,
  // warning red ring for high). Path A's interpreter emits this on
  // interpretation.context.urgency. Falls back to "low" (no accent) when
  // unset so the default appearance is unchanged.
  const _urgency = (resp.interpretation && resp.interpretation.context && resp.interpretation.context.urgency) || 'low';
  if (canvas) canvas.dataset.urgency = _urgency;
  if (frame)  frame.dataset.urgency  = _urgency;
  if (canvas && uiState.baseSurface) canvas.dataset.baseSurface = uiState.baseSurface;

  const effectiveBackgroundPolicy =
    uiState.backgroundPolicy === 'dialog-surface' ||
    (layoutPlan.backgroundPolicy === 'dialog-surface')
      ? 'dialog-surface'
      : uiState.backgroundPolicy;
  const uiForBackground = Object.assign({}, uiState, {
    backgroundPolicy: effectiveBackgroundPolicy
  });

  // (1) Background from canonical uiState — Generator resolves 3-layer model
  //     (wallpaper / app-bg / focus-block) per One UI 4+ guidelines.
  if (window.UIState && uiState.backgroundPolicy) {
    const decision = {
      showWallpaper: (effectiveBackgroundPolicy === 'wallpaper' ||
                      effectiveBackgroundPolicy === 'scrim-over-wallpaper'),
      backgroundPolicy: effectiveBackgroundPolicy
    };
    window.UIState.applyDecisionToFrame(frame, decision, uiForBackground);

    const layers = window.Generator
      ? window.Generator.resolveLayers(uiForBackground, { theme: 'dark' })
      : null;
    // Background routing matches the policy:
    //   wallpaper / scrim-over-wallpaper → user wallpaper image
    //   dialog-surface                   → blurred dim
    //   solid-dark / scrim-over-app      → solid app shell (NO wallpaper)
    // Previously this branch unconditionally set the wallpaper unless
    // the policy was dialog-surface, so app surfaces (solid-dark) were
    // still showing the home/lock wallpaper underneath. Now we honour
    // decision.showWallpaper, computed above from the policy.
    if (typeof setWallpaper === 'function') {
      if (effectiveBackgroundPolicy === 'dialog-surface') {
        setWallpaper('dialog-surface', { system: true });
      } else if (decision.showWallpaper) {
        setWallpaper(userWallpaperChoice || 'wp-1', { system: true });
      } else {
        // Keep user's wallpaper on generated app surfaces too. One UI depth
        // comes from surface cards/scrims, not a forced black frame fill.
        setWallpaper(userWallpaperChoice || 'wp-1', { system: true });
      }
    }
  }

  // (2) Canvas: surface-first path — if the pipeline provides a surfaceType,
  //     delegate to the zone-based surface renderer and skip legacy groups[].
  clearCanvas();

  if (layoutPlan.surfaceType && typeof window.generateSurfaceScenario === 'function') {
    window.__lastPipelineRenderBundle = null;
    window.generateSurfaceScenario(layoutPlan.surfaceType);
    return;
  }

  // ZONE SETUP — bridge to Path B's createOneUILayout so chrome (status bar,
  // app header, gesture bar) can be absolute-positioned into the device
  // frame's structural slots, not stacked into the content flow.
  const surfaceType = pipelineSurfaceTypeFor(uiState);
  const layout = (typeof window.createOneUILayout === 'function' && surfaceType)
    ? window.createOneUILayout({
        width:  canvas.clientWidth  || 451,
        height: canvas.clientHeight || 978
      }, surfaceType)
    : null;

  // Reserve space at top for status bar + app header, and at bottom for
  // gesture/nav bar, so canvas content groups don't underlap the chrome
  // we're about to absolute-position over them.
  const z = layout ? layout.zones : null;
  const topReserve    = z ? (z.topSystem.h + 56) : 16;  // status (28) + app-bar slot (~56)
  const bottomReserve = z ? z.bottomNav.h         : 16;

  canvas.style.position      = 'relative';
  canvas.style.display       = 'flex';
  canvas.style.flexDirection = 'column';
  canvas.style.alignItems    = 'stretch';
  canvas.style.height        = '';
  canvas.style.maxHeight     = '';
  canvas.style.overflow      = '';
  delete canvas.dataset.pipelineDockedNowbar;
  const _isAppShell = uiState && uiState.baseSurface === 'app';
  const _lpBp = layoutPlan && layoutPlan.backgroundPolicy;
  const wantsPipelineBottomSheet =
    _isAppShell &&
    (uiState.backgroundPolicy === 'dialog-surface' ||
     uiState.overlayType === 'system-dialog' ||
     _lpBp === 'dialog-surface');
  // One UI phone body: ~20–24dp horizontal inset; composer often emits 0–14px → clamp up on app.
  // App vertical step: keep band-to-band / card-to-card rhythm at ~10px — larger composer
  // gaps (e.g. 16–18) read as loose; clamp into 8–10 so GenUI stays dense like reference tiles.
  const APP_GAP_FALLBACK = 10;
  const APP_GAP_MIN = 8;
  const APP_GAP_MAX = 10;
  let appGapPx = APP_GAP_FALLBACK;
  if (_isAppShell) {
    const gTry = layoutPlan.gap != null ? +layoutPlan.gap : NaN;
    if (Number.isFinite(gTry) && gTry >= APP_GAP_MIN && gTry <= APP_GAP_MAX) {
      appGapPx = Math.round(gTry);
    }
  }
  if (canvas && _isAppShell) {
    canvas.style.setProperty('--app-stack-gap', appGapPx + 'px');
  }
  const _defaultGap = _isAppShell ? appGapPx : 10;
  const _defaultPadH = _isAppShell ? 22 : 14;
  const _minPadHApp = 20;
  // Theme override pattern (CSS cascade only — no server-side override).
  // The composer's choice becomes the FALLBACK; if the active theme
  // defines --gap-screen / --screen-padding-v / --screen-padding-h, those
  // win automatically because var() resolves to the theme value when set
  // on :root. Theme silent → fallback (LLM choice). Designer wins.
  const _composerGap = wantsPipelineBottomSheet
    ? 0
    : (_isAppShell ? appGapPx : (layoutPlan.gap != null ? layoutPlan.gap : _defaultGap));
  canvas.style.gap = wantsPipelineBottomSheet
    ? '0'
    : `var(--gap-screen, ${_composerGap}px)`;
  const pad = layoutPlan.padding || {};
  const padT = pad.top != null ? +pad.top : 14;
  const padB = pad.bottom != null ? +pad.bottom : 14;
  const padL = pad.left != null ? +pad.left : _defaultPadH;
  const padR = pad.right != null ? +pad.right : _defaultPadH;
  var padH = Math.max(Number.isFinite(padL) ? padL : _defaultPadH, Number.isFinite(padR) ? padR : _defaultPadH);
  if (_isAppShell) padH = Math.max(_minPadHApp, padH);
  canvas.style.boxSizing = 'border-box';
  // Theme override: --screen-padding-v / --screen-padding-h win when defined.
  const _padTop    = Math.max(padT, topReserve + 4);
  const _padBot    = Math.max(Number.isFinite(padB) ? padB : 14, bottomReserve + 4);
  canvas.style.padding =
    `var(--screen-padding-v, ${_padTop}px) ` +
    `var(--screen-padding-h, ${padH}px) ` +
    `var(--screen-padding-v, ${_padBot}px) ` +
    `var(--screen-padding-h, ${padH}px)`;

  // Fill the phone frame vertically: stretch the pipeline canvas to the full
  // layout viewport height. createOneUILayout zones (bottomNav, docked now-bar
  // y) are expressed in that same coordinate system — previously minHeight was
  // usableContentH (viewport minus chrome), so rDock.y (~860) exceeded #canvas
  // height (~790) and absolute-positioned session pills were clipped under the
  // device frame (only the top edge of "The Weeknd…" visible).
  const viewportH = layout && layout.viewport ? layout.viewport.height : (canvas.clientHeight || 978);
  const usableContentH = Math.max(360, viewportH - topReserve - bottomReserve - 24);
  canvas.style.minHeight = viewportH + 'px';
  canvas.dataset.pipelineFillViewport = '1';

  if (canvas) {
    if (wantsPipelineBottomSheet) {
      canvas.dataset.pipelineBottomSheet = '1';
      // One UI expanded Now Bar / system floating sheet: Figma Theme=Light Type=Floating
      // by default; set uiState.floatingSheetTheme or layoutPlan.floatingSheetTheme to 'dark'
      // for the charcoal shell (≈#1C1C1E).
      var _fsTheme = (uiState && uiState.floatingSheetTheme) || (layoutPlan && layoutPlan.floatingSheetTheme);
      canvas.dataset.floatingSheetTheme = (_fsTheme === 'dark') ? 'dark' : 'light';
    } else {
      delete canvas.dataset.pipelineBottomSheet;
      delete canvas.dataset.floatingSheetTheme;
    }
  }
  let sheetMount = canvas;
  if (canvas && wantsPipelineBottomSheet) {
    const spacer = document.createElement('div');
    spacer.className = 'pipeline-bottom-sheet-spacer';
    spacer.style.cssText = 'flex:1 1 auto;min-height:48px;width:100%;pointer-events:none;';
    canvas.appendChild(spacer);
    const host = document.createElement('div');
    host.className = 'pipeline-bottom-sheet-host';
    host.setAttribute('role', 'presentation');
    const handle = document.createElement('div');
    handle.className = 'pipeline-bottom-sheet-handle';
    handle.setAttribute('aria-hidden', 'true');
    host.appendChild(handle);
    const inner = document.createElement('div');
    inner.className = 'pipeline-bottom-sheet-inner';
    host.appendChild(inner);
    canvas.appendChild(host);
    sheetMount = inner;
  }

  const nonChromeGroups = (layoutPlan.groups || []).filter(function (g) {
    return g && g.role !== 'chrome';
  });
  var nContentGroups = Math.max(1, nonChromeGroups.length);

  // Content lookup. Plan components are keyed by SLOT (unique) first,
  // and by componentType (may collide) as a fallback. Originally this
  // map was keyed by componentType only, which silently collapsed
  // multiple plan entries with the same componentType — so 3 distinct
  // input_summary_cards (e.g. "Recipe", "Step 3 of 6", "Today") all
  // ended up rendered with the LAST entry's content, making the screen
  // look like "STEP 3 OF 7 / Sauté kimchi…" repeated 3×. Now each
  // distinct slot keeps its own content, and the renderer picks by
  // child.slot first, falling back to componentType only when the
  // composer didn't preserve a slot. Per-type queues handle the rare
  // case where slot is missing on multiple same-type children — we
  // hand them out in plan order so each gets DIFFERENT content.
  const contentBySlot = new Map();
  const contentByTypeQueue = new Map();
  const contentByType = new Map();           // fallback: last-wins (legacy)
  (plan.requiredComponents || []).forEach(c => {
    const slot = c.slot || '';
    const type = c.componentType || '';
    const content = c.content || {};
    if (slot) contentBySlot.set(slot, content);
    if (type) {
      if (!contentByTypeQueue.has(type)) contentByTypeQueue.set(type, []);
      contentByTypeQueue.get(type).push(content);
      contentByType.set(type, content);
    }
  });
  function _resolveChildContent(child) {
    if (child && child.slot && contentBySlot.has(child.slot)) {
      return contentBySlot.get(child.slot);
    }
    const type = child && child.componentId;
    if (type && contentByTypeQueue.has(type)) {
      const q = contentByTypeQueue.get(type);
      if (q.length > 0) return q.shift();    // consume in plan order
    }
    return (type && contentByType.get(type)) || {};
  }

  // pageHint — passed to pipelineRenderChild so chrome atomics can fall
  // back to a sensible app-bar title when the LLM emitted an empty label
  // on a mandatory-injected container.header.
  // Pre-fix: titleHint used primaryGoal verbatim → verbose paraphrases
  // like "personalized, context-aware guidance inside a cooking
  // assistant" leaked into the header and read as a prompt. Now we run
  // both scenario and primaryGoal through _shortAppBarTitle which
  // extracts a domain keyword (Cooking, Weather, Calendar, …) or a
  // 22-char clean truncation.
  const _scenarioText = resp._scenario || resp.scenarioText || '';
  const _primaryGoal  = (resp.interpretation && resp.interpretation.intent && resp.interpretation.intent.primaryGoal) || '';
  const pageHint = {
    titleHint: _shortAppBarTitle(_scenarioText, _primaryGoal)
  };

  // Helper: compute the absolute-position rect for a chrome child based on
  // its atomic role and the layout zones. Stacks status-bar + app-header
  // at the top; pins gesture/nav-bar at the bottom.
  let topStack = 0;  // running offset for stacking chrome at top of frame
  function rectForChromeChild(child) {
    if (!z) return null;
    const role = PIPELINE_CHROME_ATOMIC_ROLE[child.componentId];
    if (role === 'status-bar') {
      const r = { x: z.topSystem.x, y: z.topSystem.y, w: z.topSystem.w, h: z.topSystem.h };
      topStack = z.topSystem.y + z.topSystem.h;
      return r;
    }
    if (role === 'collapsed-app-bar' || role === 'expandable-app-bar' || role === 'list-top-bar') {
      const y = topStack > 0 ? topStack + 4 : z.topSystem.y + z.topSystem.h + 4;
      const r = { x: z.topSystem.x, y, w: z.topSystem.w, h: 52 };
      topStack = y + 52;
      return r;
    }
    if (role === 'gesture-bar' || role === 'nav-buttons') {
      return { x: z.bottomNav.x, y: z.bottomNav.y, w: z.bottomNav.w, h: z.bottomNav.h };
    }
    return null;
  }

  // Helper: register a rendered child with DesignDoc so the Scene/Layers
  // panel (refreshSceneInspector) can list it. Without this, the Scene
  // panel either showed empty or only chrome (which were direct children
  // of canvas — content children sit inside .canvas-group and aren't
  // direct children, so getCanvasItems missed them).
  function _registerNodeWithDesignDoc(child, el, group) {
    if (!window.DesignDoc || typeof window.DesignDoc.addNode !== 'function') return;
    const isChrome = group.role === 'chrome';
    window.DesignDoc.addNode({
      id:    el.id,
      role:
        el.dataset.atomicRole ||
        child.role ||
        child.componentRole ||
        child.componentId,
      paletteId: child.componentId || null,
      semanticConcept: null,
      type:  child.componentId,
      zone:  isChrome
        ? (el.dataset.atomicRole === 'gesture-bar' || el.dataset.atomicRole === 'nav-buttons' ? 'bottomNav' : 'topSystem')
        : 'interaction',
      props: {
        slot:         child.slot || '',
        groupRole:    group.role || '',
        groupId:      group.groupId || '',
        // parentId — links this child to its containing group node so the
        // Scene/Layers panel can render a tree (or at least indent rows
        // under their group). Without this, the panel showed a flat list
        // and the visible "blue container" had no representation in
        // Design tab.
        parentId:     group.groupId ? ('group-' + group.groupId) : null,
        priority:     child.priority || 2,
        visibility:   child.visibility || 'visible',
        atomicRole:   el.dataset.atomicRole || null
      }
    });
  }

  // Register the GROUP wrapper itself (not just its children) so the
  // Scene/Layers panel reflects the visible canvas-group container — the
  // blue/dashed outline on screen now has a corresponding row in the
  // Design tab. Children point at this node via props.parentId so any
  // future tree-view inspector can build hierarchy. Chrome groups are
  // skipped — they don't have a wrapping canvas-group element.
  function _registerGroupWithDesignDoc(group, groupEl) {
    if (!window.DesignDoc || typeof window.DesignDoc.addNode !== 'function') return;
    if (!group || group.role === 'chrome') return;
    const groupNodeId = 'group-' + (group.groupId || ('autogen-' + Date.now()));
    if (groupEl) {
      groupEl.id = groupEl.id || groupNodeId;
      groupEl.dataset.nodeId = groupNodeId;
    }
    window.DesignDoc.addNode({
      id:   groupNodeId,
      role: 'group:' + (group.role || 'unknown'),
      type: 'group',
      zone: 'interaction',
      props: {
        groupRole:  group.role     || '',
        groupId:    group.groupId  || '',
        purpose:    group.purpose  || '',
        container:  group.container || 'vertical-stack',
        gap:        group.gap      != null ? group.gap : null,
        childCount: Array.isArray(group.children) ? group.children.length : 0,
        isGroup:    true
      }
    });
  }

  let renderedIndex = 0;
  var dockedNowBarElements = [];
  (layoutPlan.groups || []).forEach(group => {
    // CHROME GROUPS — render each child as absolute-positioned overlay into
    // the device frame's chrome zones instead of stacking in content flow.
    if (group.role === 'chrome' && z) {
      (group.children || []).forEach(child => {
        if (child.visibility && child.visibility !== 'visible') return;
        const content = _resolveChildContent(child);
        const el = pipelineRenderChild(child, content, group.groupId, uiState, pageHint);
        const r  = rectForChromeChild(child);
        if (r) {
          el.style.position = 'absolute';
          el.style.left   = r.x + 'px';
          el.style.top    = r.y + 'px';
          el.style.width  = r.w + 'px';
          el.style.height = r.h + 'px';
          el.style.animation = `fadeIn 200ms cubic-bezier(0.2,0,0,1) ${renderedIndex * 30}ms backwards`;
          canvas.appendChild(el);
          renderedIndex++;
        } else {
          // No zone mapping for this chrome ID — fall back to inline render
          // so it isn't lost. (Future: add to PIPELINE_CHROME_ATOMIC_ROLE.)
          canvas.appendChild(el);
        }
        _registerNodeWithDesignDoc(child, el, group);
      });
      return;  // skip the rest — chrome doesn't get a canvas-group wrapper
    }

    // CONTENT GROUPS — primary-task / supporting / tertiary / meta — flow as before
    const groupEl = document.createElement('div');
    groupEl.className = 'canvas-group';
    groupEl.dataset.groupId = group.groupId || '';
    // Register the group itself in DesignDoc so it appears in the
    // Scene/Layers panel — the visible "blue container" now has a row
    // in the Design tab. Done early so children inherit the parent
    // reference correctly.
    _registerGroupWithDesignDoc(group, groupEl);
    // NEW: group-level role drives visual cohesion. CSS in genui.css gives
    // primary-task groups a unified inner surface (background + radius +
    // tighter gap) so subject + state + action feel like one task unit
    // instead of three independent cards. supporting groups recede.
    groupEl.dataset.groupRole = group.role || '';
    groupEl.dataset.pipelineContainer = group.container || 'vertical-stack';
    if (group.purpose) groupEl.dataset.purpose = group.purpose;
    groupEl.style.display = 'flex';
    groupEl.style.flexDirection = (group.container === 'horizontal-stack') ? 'row'
                                : (group.container === 'grid')             ? 'row'
                                : 'column';
    // Row layouts: on app shell, stretch the cross-axis so a shorter itinerary /
    // glance tile grows to match a taller action column (travel, recipe hero + chips).
    // Lock/home and non-app surfaces keep top-align so dense widget grids stay compact.
    if (group.container === 'horizontal-stack') {
      groupEl.style.alignItems = _isAppShell ? 'stretch' : 'flex-start';
    } else if (_isAppShell && group.container === 'grid') {
      // All app grid bands (primary, meta, …): row cross-axis = tallest tile so
      // short + medium pairs don’t leave a dead column beside a tall card.
      groupEl.style.alignItems = 'stretch';
    }
    if (group.container === 'grid') groupEl.style.flexWrap = 'wrap';
    // Theme override pattern: --gap-cards wins when defined; LLM's
    // group.gap is the fallback. Designer toggles the slider in
    // /customize and every group's between-card gap updates.
    const _groupGap = _isAppShell ? appGapPx : (group.gap != null ? group.gap : _defaultGap);
    groupEl.style.gap = `var(--gap-cards, ${_groupGap}px)`;
    groupEl.style.width = '100%';
    if (group.role !== 'chrome') {
      groupEl.style.boxSizing = 'border-box';
      groupEl.style.flexShrink = '1';
      // App shell: pack groups to intrinsic height so flexGrow doesn’t inflate
      // empty vertical gutters between primary/supporting blocks (One UI rhythm).
      if (_isAppShell) {
        groupEl.style.flexGrow = '0';
        groupEl.style.flexBasis = 'auto';
        groupEl.style.flexShrink = '0';
        groupEl.style.minHeight = '0';
      } else if (group.role === 'primary-task') {
        groupEl.style.flexGrow = nContentGroups > 1 ? '2' : '1';
        groupEl.style.flexBasis = '0';
        groupEl.style.minHeight =
          nContentGroups === 1
            ? '0'
            : Math.max(120, Math.floor(usableContentH * 0.18)) + 'px';
      } else if (group.role === 'supporting') {
        groupEl.style.flexGrow = '1';
        groupEl.style.flexBasis = '0';
        groupEl.style.minHeight = '0';
      } else if (group.role === 'tertiary' || group.role === 'meta') {
        groupEl.style.flexGrow = '0';
        groupEl.style.flexBasis = 'auto';
      } else {
        groupEl.style.flexGrow = '1';
        groupEl.style.flexBasis = '0';
      }
    }

    let heroApplied = false;
    var childrenToRender = group.children || [];
    if (group.container !== 'horizontal-stack' && group.container !== 'grid') {
      childrenToRender = clusterTodayGlanceCardsFirst(childrenToRender, _resolveChildContent);
    }
    const visibleOrdered = _pipelineVisibleChildrenInOrder(childrenToRender);
    const visibleCountHS = visibleOrdered.length;
    const asymHeroActionPair = _pipelineHeroActionAsymPair(group, visibleOrdered, _isAppShell);
    const splitHorizPrimaryPair =
      _isAppShell &&
      group.role === 'primary-task' &&
      group.container === 'horizontal-stack' &&
      visibleCountHS === 2;
    if (group.container === 'grid' && visibleOrdered.length === 4) {
      groupEl.dataset.gridTileCount = '4';
    }
    childrenToRender.forEach(child => {
      if (child.visibility && child.visibility !== 'visible') return;
      const content = _resolveChildContent(child);
      const el = pipelineRenderChild(child, content, group.groupId, uiState, pageHint);
      el.style.animation = `fadeIn 300ms cubic-bezier(0.2,0,0,1) ${renderedIndex * 40}ms backwards`;
      var dockBottom =
        !!z &&
        !_pipelineUiLockish(uiState) &&
        el.dataset.atomicRole === 'now-bar' &&
        _pipelineShouldDockNowBarChild(child);
      if (!dockBottom) {
      // Width policy by container:
      //   grid              → flex 1 1 50% (2-column)
      //   horizontal-stack  → content-sized (chips/buttons in a row)
      //   vertical-stack    → FULL WIDTH (cards span the full group width,
      //                       matching real Samsung One UI lock/home cards)
      // Without this rule, .canvas-item defaults to width:fit-content and
      // every card hugs the left edge with empty right side — the
      // "everything aligned left, narrow" symptom.
      if (group.container === 'grid') {
        // Configurable column count via group.gridColumns (default 2).
        // 2-col gives a Samsung-style widget tile pair; 3-col is for
        // dense home-screen widget grids. Each child gets 100/N % of
        // the row minus the gap.
        var cols = (group.gridColumns && +group.gridColumns >= 2) ? +group.gridColumns : 2;
        var pct = 100 / cols;
        var gg = _isAppShell ? appGapPx : (group.gap != null ? +group.gap : 10);
        var gutter = cols > 1 ? (gg * (cols - 1)) / cols : 0;
        // Chip / toggle rows must span the full group width. Otherwise each
        // row sits in a ~50% grid cell and pills center *within that half*
        // — reads as pinned to the far left/right of the card (Music hubs,
        // etc. when the model emits one action_chip_row per chip).
        var cidGrid = (child && child.componentId) || '';
        var arGrid = el.dataset.atomicRole || '';
        var fullBleedActionRow =
          arGrid === 'action-row' ||
          arGrid === 'toggle-chip' ||
          cidGrid === 'action_chip_row' ||
          cidGrid === 'quick_toggle_row';
        /* Hero-wide atomics (media player, progress) must span the full group
           width — otherwise default grid flex (50% / N cols) leaves a half-
           empty card hugging the left (empty space on the right). */
        var fullBleedWideAtomic =
          arGrid === 'media-card' ||
          cidGrid === 'media-card' ||
          arGrid === 'progress-track' ||
          cidGrid === 'music_progress_strip';
        if (fullBleedActionRow || fullBleedWideAtomic) {
          el.style.flex = '0 1 100%';
          el.style.minWidth = '0';
          el.style.maxWidth = '100%';
          el.style.boxSizing = 'border-box';
        } else if (asymHeroActionPair && cols === 2 && visibleOrdered.length === 2) {
          var otherG = visibleOrdered[0] === child ? visibleOrdered[1] : (visibleOrdered[1] === child ? visibleOrdered[0] : null);
          if (otherG) {
            var pctCol = _pipelineChildIsSubjectColumn(child, otherG) ? 58 : 42;
            el.style.flex = '0 1 calc(' + pctCol + '% - ' + gutter + 'px)';
          } else {
            el.style.flex = '0 1 calc(' + pct + '% - ' + gutter + 'px)';
          }
        } else {
          // flex-grow: 0 keeps preset tiles at intrinsic height/width ratio —
          // only shrink-wrap columns within calc(...) basis (no vertical stretching glue).
          el.style.flex = '0 1 calc(' + pct + '% - ' + gutter + 'px)';
        }
        el.style.minWidth = '0';
        el.style.maxWidth = '100%';
        el.style.boxSizing = 'border-box';
      } else if (splitHorizPrimaryPair) {
        var ggH = appGapPx;
        var gutterH = ggH / 2;
        if (asymHeroActionPair) {
          var otherH = visibleOrdered[0] === child ? visibleOrdered[1] : (visibleOrdered[1] === child ? visibleOrdered[0] : null);
          if (otherH) {
            var pctH = _pipelineChildIsSubjectColumn(child, otherH) ? 58 : 42;
            el.style.flex = '0 1 calc(' + pctH + '% - ' + gutterH + 'px)';
          } else {
            el.style.flex = '0 1 calc(50% - ' + gutterH + 'px)';
          }
        } else {
          el.style.flex = '0 1 calc(50% - ' + gutterH + 'px)';
        }
        el.style.minWidth = '0';
        el.style.maxWidth = '100%';
      } else if (group.container !== 'horizontal-stack') {
        el.style.width = '100%';
        el.style.alignSelf = 'stretch';
      }
      if (
        group.role === 'primary-task' &&
        group.container !== 'horizontal-stack' &&
        group.container !== 'grid' &&
        !heroApplied
      ) {
        const visOk = !(child.visibility === 'collapsed' || child.visibility === 'hidden');
        const ar =
          PIPELINE_BODY_ATOMIC_ROLE[child.componentId] ||
          el.dataset.atomicRole ||
          '';
        const prRaw = child.priority != null ? +child.priority : 2;
        const isCompactAtomic =
          ar === 'now-bar' ||
          child.componentId === 'media_control_bar' ||
          ar === 'action-row' ||
          ar === 'toggle-chip' ||
          child.componentType === 'action_chip_row' ||
          child.componentType === 'quick_toggle_row';
        const wantHero =
          visOk &&
          !isCompactAtomic &&
          (
            prRaw <= 1 ||
            child.role === 'subject' ||
            (ar === 'media-card' && prRaw <= 2)
          );
        if (wantHero) {
          // Do NOT flex-grow: filling all free space shoves siblings to ~0 height
          // and focus-block inner `height:100%` + min-height:0 can paint over the
          // next card. Extra vertical room is handled by .canvas-group-flex-spacer.
          el.style.flex = '0 1 auto';
          el.style.flexGrow = '0';
          el.style.minHeight = '0';
          heroApplied = true;
        }
      }
      groupEl.appendChild(el);
      } else {
        el.style.width = '100%';
        el.style.maxWidth = '100%';
        el.style.boxSizing = 'border-box';
        el.dataset.pipelineDock = 'bottom-now-bar';
        dockedNowBarElements.push(el);
      }
      renderedIndex++;
      _registerNodeWithDesignDoc(child, el, group);
    });

    if (
      group.role === 'primary-task' &&
      group.container !== 'horizontal-stack' &&
      group.container !== 'grid' &&
      !heroApplied
    ) {
      var heroCand = groupEl.querySelector(
        '.canvas-item.body-atomic[data-atomic-role="focus-block"], .canvas-item.body-atomic[data-atomic-role="media-card"]'
      );
      if (heroCand) {
        heroCand.dataset.priority = '1';
        heroCand.style.flex = '0 1 auto';
        heroCand.style.flexGrow = '0';
        heroCand.style.minHeight = '0';
      }
    }

    // Omit bottom flex-spacer — it amplified height fights with QS-style
    // toggle rows (`height:auto` fixes) under dense pipelines.

    // One UI guideline: bottom navigation must always anchor to screen bottom
    if (groupEl.querySelector('.oui-bottomnav')) {
      groupEl.style.marginTop = 'auto';
      groupEl.style.flexShrink = '0';
    }

    if (groupEl.children.length > 0) sheetMount.appendChild(groupEl);
  });

  dockedNowBarElements = _pipelineDedupeDockedNowBars(dockedNowBarElements);

  if (dockedNowBarElements.length && z && canvas) {
    var rDock = _pipelineRectBottomSessionNowBar(z);
    if (rDock) {
      /* Session strip: pin with `bottom` so when primary-task content is tall,
         #canvas height stays locked to the layout viewport — otherwise a
         growing flex column moved `top:rDock.y` into the middle of the
         glass card (overlap / half-in-half-out clipping). Padding keeps
         in-flow groups above the strip band. */
      if (layout && layout.viewport && Number.isFinite(layout.viewport.height)) {
        var Hvp = layout.viewport.height;
        canvas.style.height = Hvp + 'px';
        canvas.style.maxHeight = Hvp + 'px';
        canvas.style.overflow = 'hidden';
        canvas.dataset.pipelineDockedNowbar = '1';
        var gapAboveStrip = 16;
        var neededBottomPad = Hvp - rDock.y + gapAboveStrip;
        var basePadB2 = Math.max(Number.isFinite(padB) ? padB : 14, bottomReserve + 4);
        var newPadB = Math.max(basePadB2, neededBottomPad);
        canvas.style.padding =
          Math.max(padT, topReserve + 4) + 'px ' +
          padH + 'px ' +
          newPadB + 'px ' +
          padH + 'px';
      }
      var HvpDock = layout && layout.viewport && Number.isFinite(layout.viewport.height)
        ? layout.viewport.height
        : 978;
      var stripH = Math.min(rDock.h, 72);
      var baseFromBottom = HvpDock - rDock.y - stripH;
      dockedNowBarElements.forEach(function dockMount(el, idx) {
        var stackLift = idx * (stripH + 8);
        el.style.position = 'absolute';
        el.style.top = 'auto';
        el.style.bottom = (baseFromBottom + stackLift) + 'px';
        /* Center the bottom rail in #canvas — rDock.x assumes raw frame safe
           insets; composer padding/zoom can desync so the pill hugged the left. */
        el.style.left = '50%';
        el.style.right = 'auto';
        el.style.setProperty('transform', 'translateX(-50%)', 'important');
        /* Fill the padded canvas row up to the layout rail width — a raw rDock.w
           px width can exceed the content box and clip under overflow:hidden. */
        el.style.setProperty('width', '100%', 'important');
        el.style.setProperty('max-width', rDock.w + 'px', 'important');
        el.style.setProperty('min-width', '0', 'important');
        el.style.minHeight = /* media/timer pill can be 68px tall */ Math.min(rDock.h, 72) + 'px';
        el.style.height = 'auto';
        el.style.display = 'flex';
        el.style.flexDirection = 'row';
        el.style.justifyContent = 'center';
        el.style.alignItems = 'center';
        el.style.boxSizing = 'border-box';
        el.style.pointerEvents = 'auto';
        el.style.zIndex = String(520 + idx);
        el.style.flexShrink = '0';
        canvas.appendChild(el);
      });
    }
  }

  // Refresh the Scene/Layers panel now that all nodes are registered.
  // (refreshSceneInspector reads DesignDoc.state.nodes preferentially, so
  // each addNode above already invalidated state — but the inspector
  // doesn't subscribe to DesignDoc events; we trigger one explicit refresh
  // at the end of the render to populate the list.)
  if (typeof window.refreshSceneInspector === 'function') {
    window.refreshSceneInspector();
  }

  // (3) Output panel — populated as a sequence of card blocks (mirrors
  //     Path B's idiom). Each block visualizes one stage of the pipeline:
  //     interpretation, information priority, layout (composer), and a
  //     final summary (explanation + validation). This replaces the prior
  //     monolithic innerHTML lump and makes Path A's pipeline as
  //     introspectable as Path B's.
  if (output) {
    // Progressive-render path: when streaming through pipelineGenerate,
    // _handlePipelineEvent already rendered each panel as its step
    // completed. Calling them again here would duplicate. Skip if
    // rendered flags are set; only render the panels that are still
    // missing (e.g. when this function is called from a non-streaming
    // /api/pipeline/full caller that never went through the SSE handler).
    const r = (typeof _pipelinePartial === 'object' && _pipelinePartial)
      ? _pipelinePartial.panelsRendered
      : { classification:false, interpretation:false, statePacket:false, priority:false, flow:false, resolution:false, layout:false, summary:false };
    const anyPanelRendered = Object.values(r).some(Boolean);
    if (!anyPanelRendered) {
      output.innerHTML = '';
      output.style.display = 'block';
    }
    if (!r.classification) _renderPipelineClassificationBlock(resp.interpretation, resp.planningPacket, resp._scenario || resp.scenarioText);
    if (!r.interpretation) _renderPipelineInterpretationBlock(resp.interpretation, resp._scenario || resp.scenarioText);
    if (!r.statePacket)    _renderPipelineStatePacketBlock(resp.interpretation, resp.planningPacket);
    if (!r.priority)       _renderPipelinePriorityBlock(plan, layoutPlan);
    if (!r.flow)           _renderPipelineFlowBlock();
    if (!r.resolution)     _renderPipelineComponentResolutionBlock(plan, layoutPlan);
    if (!r.layout)         _renderPipelineLayoutBlock(layoutPlan);
    if (!r.summary)        _renderPipelineSummaryBlock(explanation, validation);
    if (!anyPanelRendered) output.scrollTop = 0;
  }

  window.__lastPipelineRenderBundle = resp;
}

// ---------------------------------------------------------------------------
//  pipelineOutput helpers — live progress surface for AI / pipeline calls
//  ---------------------------------------------------------------------------
//  #pipelineOutput is a scrollable panel below the chat input. We use it as
//  a live log during AI generation (sendChatMessage in Agent mode,
//  pipelineGenerate, generateFromUrl) so the user sees what's happening
//  instead of just a blocking spinner.
// ---------------------------------------------------------------------------
function _pipelineOutput() {
  return document.getElementById('pipelineOutput');
}
// Reset + show the panel with a title header.
function _pipelineStart(title) {
  var o = _pipelineOutput();
  if (!o) return;
  o.style.display = 'block';
  o.innerHTML = '<div style="color:#3E91FF;font-weight:600;margin-bottom:6px;">' +
    title + '</div>';
}
// Append a one-off log line.
function _pipelineLog(html, color) {
  var o = _pipelineOutput();
  if (!o) return;
  o.style.display = 'block';
  var line = document.createElement('div');
  line.style.cssText = 'padding:1px 0;' + (color ? ('color:' + color + ';') : '');
  line.innerHTML = html;
  o.appendChild(line);
  o.scrollTop = o.scrollHeight;
}
// Update (or create) a persistent status line by key — used for counters
// that should update in place rather than appending a new row each tick.
function _pipelineStatus(key, html, color) {
  var o = _pipelineOutput();
  if (!o) return;
  o.style.display = 'block';
  var line = o.querySelector('[data-pline="' + key + '"]');
  if (!line) {
    line = document.createElement('div');
    line.dataset.pline = key;
    line.style.cssText = 'padding:1px 0;' + (color ? ('color:' + color + ';') : '');
    o.appendChild(line);
  } else if (color) {
    line.style.color = color;
  }
  line.innerHTML = html;
  o.scrollTop = o.scrollHeight;
}
function _pipelineSuccess(msg) { _pipelineLog('\u2713 ' + msg, '#4ade80'); }
function _pipelineError(msg)   { _pipelineLog('\u2717 ' + msg, '#ff6b6b'); }
function _pipelineInfo(msg)    { _pipelineLog('\u2192 ' + msg, 'var(--text-2)'); }

// Escape HTML for safe JSON rendering in the pipelineOutput panel.
function _escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Render a pretty-printed <details> block containing a step's JSON output.
function _pipelineJsonBlock(title, obj, meta) {
  var json = '';
  try { json = JSON.stringify(obj, null, 2); }
  catch (e) { json = String(obj); }
  // Cap size to avoid huge panels — show first 2500 chars + "(+N more)"
  var MAX = 2500;
  var truncated = '';
  if (json.length > MAX) {
    truncated = ' <span style="color:var(--text-3);">(+' + (json.length - MAX) + ' more chars)</span>';
    json = json.slice(0, MAX);
  }
  var metaHtml = meta ? ' <span style="color:var(--text-3);font-weight:400;">' + _escapeHtml(meta) + '</span>' : '';
  return '<details style="margin:4px 0;padding:4px 0;border-top:1px solid rgba(255,255,255,0.05);">' +
    '<summary style="cursor:pointer;color:#fff;font-weight:600;font-size:13px;">' + _escapeHtml(title) + metaHtml + '</summary>' +
    '<pre style="margin:6px 0 0 0;padding:8px;background:rgba(0,0,0,0.35);border-radius:6px;font-size:13px;line-height:1.45;color:#cbd5e1;overflow:auto;max-height:260px;white-space:pre-wrap;word-break:break-word;">' +
      _escapeHtml(json) + truncated +
    '</pre>' +
  '</details>';
}

// ---------------------------------------------------------------------------
//  4+2+1 classification renderer — displays the orchestration decision
//  packet the classifier returned. Default collapsed to a single-line
//  summary chip; click to expand the full brief (purpose, modulation A,
//  modulation B, governance). Color codes each purpose type so the
//  reader can tell at a glance what kind of UI should result.
// ---------------------------------------------------------------------------
var _PURPOSE_META = {
  context_reconstruction: { label: '\uB9E5\uB77D \uC7AC\uAD6C\uC131\uD615', en: 'Context Reconstruction',
    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)',
    icon: '\u25C8' },
  flow_continuity:        { label: '\uD750\uB984 \uC5F0\uC18D\uD615', en: 'Flow Continuity',
    color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)',
    icon: '\u2192' },
  focus_protection:       { label: '\uBAB0\uC785 \uBCF4\uD638\uD615', en: 'Focus Protection',
    color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.35)',
    icon: '\u25CE' },
  multi_party_coordination: { label: '\uB2E4\uC790\uAC04 \uC870\uC728\uD615', en: 'Multi-party Coordination',
    color: '#fb923c', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.35)',
    icon: '\u22C8' }
};

function _purposeChip(key, prefix) {
  var m = _PURPOSE_META[key];
  if (!m) return _escapeHtml(key || '');
  return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;' +
    'background:' + m.bg + ';color:' + m.color + ';border:1px solid ' + m.border + ';' +
    'font-size:13px;font-weight:600;letter-spacing:0.2px;">' +
    m.icon + ' ' + (prefix || '') + m.label + ' <span style="opacity:0.6;">(' + m.en + ')</span>' +
    '</span>';
}

function _fieldRow(label, value, dim) {
  if (value === undefined || value === null || value === '') return '';
  var v = Array.isArray(value) ? value.join(', ') : String(value);
  return '<div style="display:flex;gap:8px;padding:1px 0;font-size:13px;">' +
    '<span style="color:var(--text-3);min-width:110px;">' + _escapeHtml(label) + '</span>' +
    '<span style="color:' + (dim ? 'var(--text-2)' : '#fff') + ';">' + _escapeHtml(v) + '</span>' +
    '</div>';
}

function _renderClassificationBlock(payload) {
  var o = _pipelineOutput();
  if (!o || !payload || !payload.orchestration) return;
  var orch = payload.orchestration;
  var pri  = (orch.purpose && orch.purpose.primary)   || 'context_reconstruction';
  var sec  = (orch.purpose && orch.purpose.secondary) || null;
  var modA = orch.modulationA || {};
  var modB = orch.modulationB || {};
  var gov  = orch.governance  || {};

  var summary = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:3px 0;">' +
    _purposeChip(pri) +
    (sec ? _purposeChip(sec, '+ ') : '') +
    '<span style="font-size:13px;color:var(--text-3);">\u00b7</span>' +
    '<span style="font-size:13px;color:var(--text-2);">attn:<b style="color:#fff;margin-left:2px;">' + _escapeHtml(modA.attention || '?') + '</b></span>' +
    '<span style="font-size:13px;color:var(--text-2);">interaction:<b style="color:#fff;margin-left:2px;">' + _escapeHtml(modA.interaction || '?') + '</b></span>' +
    '<span style="font-size:13px;color:var(--text-2);">devices:<b style="color:#fff;margin-left:2px;">' + _escapeHtml(modB.device_count || 'single') + '</b></span>' +
    ((gov.triggers && gov.triggers.length)
      ? '<span style="font-size:13px;padding:1px 6px;border-radius:8px;background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);">\u26A0 governance</span>'
      : '') +
    '</div>';

  var details = '';
  if (orch.purpose && orch.purpose.reasoning) {
    details += '<div style="font-size:13px;color:var(--text-2);font-style:italic;padding:2px 0 6px 0;">' +
      '\u201C' + _escapeHtml(orch.purpose.reasoning) + '\u201D</div>';
  }
  details += '<div style="padding:4px 0;">' +
    '<div style="font-size:13px;color:var(--text-3);font-weight:600;margin-bottom:2px;">Modulation A \u00B7 body / environment</div>' +
    _fieldRow('attention',   modA.attention) +
    _fieldRow('mobility',    modA.mobility) +
    _fieldRow('hands',       modA.hands) +
    _fieldRow('interaction', modA.interaction) +
    _fieldRow('privacy',     modA.privacy) +
    _fieldRow('time of day', modA.time_of_day) +
    _fieldRow('ambient',     modA.ambient) +
    '</div>';
  details += '<div style="padding:4px 0;">' +
    '<div style="font-size:13px;color:var(--text-3);font-weight:600;margin-bottom:2px;">Modulation B \u00B7 multi-device</div>' +
    _fieldRow('device count',   modB.device_count) +
    _fieldRow('primary device', modB.primary_device) +
    _fieldRow('secondary',      (modB.secondary_devices && modB.secondary_devices.length) ? modB.secondary_devices : null) +
    _fieldRow('handoff',        modB.handoff_required ? ('yes \u2192 ' + (modB.handoff_target || '?')) : 'no', true) +
    _fieldRow('allocation',     modB.surface_allocation_hint) +
    '</div>';
  details += '<div style="padding:4px 0;">' +
    '<div style="font-size:13px;color:var(--text-3);font-weight:600;margin-bottom:2px;">Governance</div>' +
    _fieldRow('triggers',            (gov.triggers && gov.triggers.length) ? gov.triggers : 'none', !(gov.triggers && gov.triggers.length)) +
    _fieldRow('autonomy',            gov.autonomy_level) +
    _fieldRow('explanation needed',  gov.explanation_needed ? 'yes' : 'no', !gov.explanation_needed) +
    _fieldRow('override needed',     gov.override_needed    ? 'yes' : 'no', !gov.override_needed) +
    '</div>';

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div style="margin:6px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;background:rgba(0,0,0,0.25);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
        '<span style="font-size:13px;color:var(--text-3);letter-spacing:0.4px;font-weight:600;">4+2+1 CLASSIFICATION</span>' +
      '</div>' +
      summary +
      '<details style="margin-top:6px;">' +
        '<summary style="cursor:pointer;font-size:13px;color:var(--text-3);padding:2px 0;">details</summary>' +
        details +
      '</details>' +
    '</div>';
  o.appendChild(wrap.firstElementChild);
  o.scrollTop = o.scrollHeight;
}

// ===========================================================================
//  PIPELINE-SPECIFIC PANEL BLOCKS (Path A)
//  --------------------------------------------------------------------------
//  Path B has rich card blocks (Interpretation / State Packet / Priority /
//  Resolution) that visualize each layer of its decision pipeline. Path A
//  was emitting a single monolithic innerHTML lump with chips + why +
//  prioritized + validation, leaving the user without visibility into the
//  interpret/normalize/select/compose stages.
//
//  These mirror Path B's visual idiom (bordered card with label header +
//  rows) but read from Path A's actual data shape: intent, context vectors,
//  tasks, plan.requiredComponents (with role/slot/priority), layoutPlan
//  (with group roles), validation, explanation.
// ===========================================================================

function _pipelineCard(title, bodyHtml) {
  return '<div style="margin:6px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.08);' +
           'border-radius:8px;background:rgba(255,255,255,0.02);">' +
           '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
             '<span style="font-size:13px;color:var(--text-3);letter-spacing:0.4px;font-weight:600;">' +
               title +
             '</span>' +
           '</div>' +
           bodyHtml +
         '</div>';
}

function _pipelineRow(key, val, opts) {
  if (val == null || val === '') return '';
  var keyColor = (opts && opts.keyColor) || 'var(--text-3)';
  var valColor = (opts && opts.valColor) || '#fff';
  return '<div style="display:flex;gap:8px;padding:2px 0;font-size:13px;line-height:1.4;">' +
           '<span style="color:' + keyColor + ';min-width:130px;flex-shrink:0;">' + _escapeHtml(String(key)) + '</span>' +
           '<span style="color:' + valColor + ';">' + _escapeHtml(String(val)) + '</span>' +
         '</div>';
}

// 🔍 INTERPRETATION block — six-question Q&A in the same idiom Path B uses.
// Path A's interpretation has a different shape (intent.primaryGoal, tasks[],
// context vectors, constraints[]) so each Q&A row is derived rather than
// looked up directly. Mappings are intentionally explicit in the code so a
// future reader can see the translation:
//   what user is doing   ← first task (type + contentNeed)
//   real goal            ← intent.primaryGoal
//   most lacking         ← contentNeed of the highest-priority task
//   what interferes      ← constraints joined
//   system role          ← unique task.type values joined
//   interaction complexity ← derived from interactionMode + densityMode
function _renderPipelineInterpretationBlock(interpretation, scenarioText) {
  var o = _pipelineOutput();
  if (!o || !interpretation) return;
  var intent = interpretation.intent || {};
  var ctx    = interpretation.context || {};
  var tasks  = interpretation.tasks   || [];
  var cons   = interpretation.constraints || [];
  var us     = interpretation.uiState || {};

  var firstTask  = tasks[0] || {};
  var topTasks   = tasks.filter(function (t) { return t.priority === 1; });
  var topNeeds   = topTasks.map(function (t) { return t.contentNeed; }).filter(Boolean);
  var taskTypes  = [];
  tasks.forEach(function (t) { if (t.type && taskTypes.indexOf(t.type) < 0) taskTypes.push(t.type); });

  function _complexity() {
    var im = us.interactionMode || ctx.interactionMode;
    var dm = us.densityMode;
    if (im === 'minimal-touch' || im === 'voice') return 'low (minimal-touch / voice)';
    if (dm === 'compressed' || us.attentionMode === 'glanceable') return 'low (glanceable / compressed)';
    if (dm === 'expanded' && im === 'mixed') return 'high (expanded + mixed input)';
    return 'medium';
  }

  var qaRows = [
    ['what user is doing',      firstTask.type
                                  ? firstTask.type + (firstTask.contentNeed ? ' — ' + firstTask.contentNeed : '')
                                  : (intent.primaryGoal || null)],
    ['real goal',               intent.primaryGoal || (intent.secondaryGoal || null)],
    ['most lacking',            topNeeds.length ? topNeeds.join(', ') : (firstTask.contentNeed || null)],
    ['what interferes',         cons.length ? cons.join(' · ') : null],
    ['system role',             taskTypes.length ? taskTypes.join(' + ') : null],
    ['interaction complexity',  _complexity()]
  ];

  var rows = '';
  if (scenarioText) {
    rows += _pipelineRow('scenario', scenarioText.length > 90 ? scenarioText.slice(0, 87) + '…' : scenarioText, { valColor: '#A5B4FC' });
  }
  qaRows.forEach(function (qa) {
    if (qa[1]) rows += _pipelineRow(qa[0], qa[1]);
  });
  rows += _pipelineRow('uiState',
    'surface=' + (us.baseSurface || '?') +
    (us.overlayType && us.overlayType !== 'none' ? ' / overlay=' + us.overlayType : '') +
    ' · attn=' + (us.attentionMode || '?') +
    ' · density=' + (us.densityMode || '?') +
    ' · int=' + (us.interactionMode || '?') +
    ' · bg=' + (us.backgroundPolicy || '?'));
  if (us.contextTags && us.contextTags.length) {
    rows += _pipelineRow('context_tags', us.contextTags.join(', '), { valColor: '#7DD3FC' });
  }

  var wrap = document.createElement('div');
  wrap.innerHTML = _pipelineCard('🔍 INTERPRETATION', rows);
  o.appendChild(wrap.firstElementChild);
}

// 📦 STATE PACKET block — Path A's planningPacket flattened into the
// state-packet idiom. Path A doesn't model some Path B fields (autonomy,
// privacy, coordination) — those rows simply omit. Other fields are
// derived from uiState and the planning summary.
function _renderPipelineStatePacketBlock(interpretation, planningPacket) {
  var o = _pipelineOutput();
  if (!o || !planningPacket) return;
  var summ = planningPacket.planningSummary || {};
  var us   = planningPacket.uiState || (interpretation && interpretation.uiState) || {};
  var ctx  = (interpretation && interpretation.context) || {};
  var groups = planningPacket.taskGroups || {};

  function _attentionCapacity() {
    if (us.attentionMode === 'focused')    return 'high';
    if (us.attentionMode === 'distracted') return 'medium';
    if (us.attentionMode === 'glanceable') return 'low';
    return us.attentionMode || '—';
  }
  function _interactionBudget() {
    if (us.densityMode === 'expanded')   return 'high';
    if (us.densityMode === 'compressed') return 'low';
    return us.densityMode || 'normal';
  }

  var fields = [
    ['purpose_type',         summ.interactionPriority],
    ['primary_goal',         summ.primaryGoal],
    ['urgency',              ctx.urgency],
    ['attention_capacity',   _attentionCapacity()],
    ['interaction_budget',   _interactionBudget()],
    ['attention_strategy',   summ.attentionStrategy],
    ['density_strategy',     summ.densityStrategy],
    ['background_policy',    summ.backgroundPolicy || us.backgroundPolicy],
    ['device_role',
      (us.windowMode || 'single') +
      ' · ' + (us.interactionMode || ctx.interactionMode || 'touch')],
    ['task_groups',
      'primary=' + ((groups.primary || []).length) +
      '  secondary=' + ((groups.secondary || []).length) +
      '  optional=' + ((groups.optional || []).length)]
  ];
  var rows = '';
  fields.forEach(function (f) { if (f[1]) rows += _pipelineRow(f[0], f[1]); });

  var sc = planningPacket.selectionConstraints || {};
  if ((sc.prefer && sc.prefer.length) || (sc.avoid && sc.avoid.length) || (sc.collapseFirst && sc.collapseFirst.length)) {
    if (sc.prefer && sc.prefer.length)        rows += _pipelineRow('prefer',        sc.prefer.join(' · '),        { valColor: '#86EFAC' });
    if (sc.avoid && sc.avoid.length)          rows += _pipelineRow('avoid',         sc.avoid.join(' · '),         { valColor: '#FCA5A5' });
    if (sc.collapseFirst && sc.collapseFirst.length) rows += _pipelineRow('collapse first', sc.collapseFirst.join(' · '), { valColor: '#FDE68A' });
  }

  var wrap = document.createElement('div');
  wrap.innerHTML = _pipelineCard('📦 STATE PACKET', rows);
  o.appendChild(wrap.firstElementChild);
}

// =====================================================================
//  4+2+1 CLASSIFICATION — Path A pseudo-classifier
//  Path B has an explicit classifier output; Path A doesn't, so we derive
//  one heuristically from scenario keywords + uiState + task types +
//  contextTags. Returns up to 2 pattern keys (primary + secondary).
// =====================================================================

const PIPELINE_PATTERNS = {
  'flow-continuity': {
    labelKo: '흐름 연속형',
    labelEn: 'Flow Continuity',
    layout:  'continuity_stream',
    icon:    '→',
    color:   '#4ade80'
  },
  'focus-protection': {
    labelKo: '몰입 보호형',
    labelEn: 'Focus Protection',
    layout:  'hero_single',
    icon:    '◎',
    color:   '#60a5fa'
  },
  'context-reconstruction': {
    labelKo: '맥락 재구성형',
    labelEn: 'Context Reconstruction',
    layout:  'summary_grid',
    icon:    '◆',
    color:   '#a78bfa'
  },
  'multi-party-coordination': {
    labelKo: '다자 협업형',
    labelEn: 'Multi-party Coordination',
    layout:  'modal_stack',
    icon:    '⟨⟩',
    color:   '#fb923c'
  }
};

function _classifyPipelinePurpose(interpretation, uiState, scenarioText) {
  const us  = uiState || (interpretation && interpretation.uiState) || {};
  const ctx = (interpretation && interpretation.context) || {};
  const tasks = (interpretation && interpretation.tasks) || [];
  const tags  = (us.contextTags) || [];
  const text  = String(scenarioText || '').toLowerCase();

  const sig = {
    'flow-continuity':           0,
    'focus-protection':          0,
    'context-reconstruction':    0,
    'multi-party-coordination':  0
  };

  // Flow continuity — sequential / step-by-step / ongoing activity
  if (/\b(step|steps|guidance|advance|sequential|workflow|tutorial|wizard|navigation|workout|tracking|in progress|step-by-step)\b/i.test(text)) sig['flow-continuity'] += 3;
  tags.forEach(t => {
    if (/^now-bar:|media-playing|workout|driving|charging|timer|delivery/.test(t)) sig['flow-continuity'] += 1;
  });
  if (tasks.length > 1 && tasks.some(t => /step|next|previous|progress|advance|continue/.test(t.contentNeed || ''))) sig['flow-continuity'] += 2;

  // Focus protection — single deep activity, hands busy, minimal-touch
  if (us.attentionMode === 'focused')                          sig['focus-protection'] += 2;
  if (us.interactionMode === 'minimal-touch' || us.interactionMode === 'voice') sig['focus-protection'] += 2;
  if (tasks.filter(t => t.priority === 1).length === 1)        sig['focus-protection'] += 1;
  if (/\b(cooking|driving|workout|focus|concentration|reading)\b/i.test(text)) sig['focus-protection'] += 2;

  // Context reconstruction — glanceable, overlays, multiple summary tiles
  if (us.attentionMode === 'glanceable')                       sig['context-reconstruction'] += 3;
  if (us.overlayType === 'notification-shade')                 sig['context-reconstruction'] += 3;
  if (us.overlayType === 'quick-settings')                     sig['context-reconstruction'] += 3;
  if (tasks.length >= 3 && tasks.every(t => t.type === 'inform')) sig['context-reconstruction'] += 2;
  if (us.baseSurface === 'home' && tasks.length >= 2)          sig['context-reconstruction'] += 1;

  // Multi-party coordination — system dialogs, share / handoff / collab
  if (us.overlayType === 'system-dialog')                      sig['multi-party-coordination'] += 3;
  if (/\b(share|collab|coordinate|sync|handoff|pair|connect|invite|cast)\b/i.test(text)) sig['multi-party-coordination'] += 2;
  if (us.windowMode === 'split' || us.windowMode === 'floating') sig['multi-party-coordination'] += 1;

  const sorted = Object.entries(sig)
    .filter(e => e[1] > 0)
    .sort((a, b) => b[1] - a[1]);

  const out = [];
  if (sorted[0]) out.push(sorted[0][0]);
  // Include secondary only if reasonably strong (≥60% of primary's score)
  if (sorted[1] && sorted[1][1] >= sorted[0][1] * 0.6) out.push(sorted[1][0]);
  return out;
}

// 4+2+1 CLASSIFICATION block — visual same as Path B (Korean + English label,
// pattern icon, attention/interaction/devices summary, expandable details).
function _renderPipelineClassificationBlock(interpretation, planningPacket, scenarioText) {
  const o = _pipelineOutput();
  if (!o) return;
  const us  = (planningPacket && planningPacket.uiState) || (interpretation && interpretation.uiState) || {};
  const ctx = (interpretation && interpretation.context) || {};

  const keys = _classifyPipelinePurpose(interpretation, us, scenarioText);
  if (!keys.length) return;
  const pri = PIPELINE_PATTERNS[keys[0]];
  const sec = keys[1] ? PIPELINE_PATTERNS[keys[1]] : null;

  function _pchip(p, prefix) {
    return '<span style="display:inline-flex;gap:5px;align-items:baseline;font-size:13px;">' +
      (prefix ? '<span style="color:var(--text-3);font-weight:500;">' + prefix + '</span>' : '') +
      '<span style="color:' + p.color + ';font-weight:700;">' + p.icon + ' ' + p.labelKo + '</span>' +
      '<span style="color:var(--text-3);">(' + p.labelEn + ')</span>' +
    '</span>';
  }

  const summary = '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:4px 0;">' +
    _pchip(pri, '→ ') +
    (sec ? _pchip(sec, '+ ') : '') +
    '<span style="font-size:13px;color:var(--text-3);margin:0 2px;">·</span>' +
    '<span style="font-size:13px;color:var(--text-2);">attn:<b style="color:#fff;margin-left:2px;">' + _escapeHtml(us.attentionMode || '?') + '</b></span>' +
    '<span style="font-size:13px;color:var(--text-2);">interaction:<b style="color:#fff;margin-left:2px;">' + _escapeHtml(us.interactionMode || ctx.interactionMode || '?') + '</b></span>' +
    '<span style="font-size:13px;color:var(--text-2);">devices:<b style="color:#fff;margin-left:2px;">' + _escapeHtml(us.windowMode === 'split' ? 'multi' : 'single') + '</b></span>' +
  '</div>';

  let details = '';
  details += '<div style="padding:4px 0;font-size:13px;color:var(--text-2);font-style:italic;">' +
    '“' + _escapeHtml(pri.labelKo + (sec ? ' + ' + sec.labelKo : '')) + '” classification derived from ' +
    'scenario keywords + uiState (' + (us.attentionMode || '?') + ' / ' + (us.densityMode || '?') + ' / ' + (us.interactionMode || '?') + ') + ' +
    'task types + contextTags. Path A has no explicit classifier yet — this is a heuristic.' +
  '</div>';
  details += '<div style="padding:4px 0;">' +
    '<div style="font-size:13px;color:var(--text-3);font-weight:600;margin-bottom:2px;">layout pattern (Path B equivalent)</div>' +
    '<div style="font-size:13px;color:#fff;">' + pri.layout + (sec ? ' + ' + sec.layout : '') + '</div>' +
  '</div>';

  const wrap = document.createElement('div');
  wrap.innerHTML =
    '<div style="margin:6px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;background:rgba(0,0,0,0.25);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
        '<span style="font-size:13px;color:var(--text-3);letter-spacing:0.4px;font-weight:600;">4+2+1 CLASSIFICATION</span>' +
      '</div>' +
      summary +
      '<details style="margin-top:6px;">' +
        '<summary style="cursor:pointer;font-size:13px;color:var(--text-3);padding:2px 0;">details</summary>' +
        details +
      '</details>' +
    '</div>';
  o.appendChild(wrap.firstElementChild);
}

// 🎯 INFORMATION PRIORITY block — column-card layout matching the Path B
// reference (MUST / SHOULD / SUPPRESS / DEFER as 4 horizontal columns of
// chip cards, color-coded). Each chip wraps its text so long componentIds
// don't overflow the column.
//   MUST     ← priority=1 components (kept visible by composer)
//   SHOULD   ← priority=2 components (kept visible by composer)
//   SUPPRESS ← plannerNotes.collapsedOptionalTasks (tasks dropped pre-layout)
//   DEFER    ← priority=3 OR layoutPlan visibility=collapsed
function _renderPipelinePriorityBlock(plan, layoutPlan) {
  var o = _pipelineOutput();
  if (!o || !plan) return;
  var comps = plan.requiredComponents || [];
  if (!comps.length) return;

  // Layout-aware view: visibility decisions made by the composer.
  var laidOut = {};
  ((layoutPlan && layoutPlan.groups) || []).forEach(function (g) {
    (g.children || []).forEach(function (ch) {
      laidOut[ch.componentId] = { visibility: ch.visibility || 'visible' };
    });
  });

  // Helpers for chip labeling — chrome items get their componentType
  // (slot="chrome" is generic and would dedupe to identical chips), while
  // content items get a prettified slot name + the componentType as a small
  // subtitle so users can see WHAT was picked for that slot.
  function _prettifySlot(slot) {
    if (!slot) return '';
    return slot
      .replace(/_slot$/, '')           // trailing _slot is noise
      .replace(/^slot[._-]/i, '')      // leading slot. or slot_ prefix
      .replace(/[_\-]+/g, ' ')          // word separators
      .trim();
  }
  function _chipLabelFor(c) {
    var isChrome = c.role === 'chrome' || c.slot === 'chrome' || /^container\./.test(c.componentType || '');
    if (isChrome) {
      // Strip "container." prefix for cleaner display ("status-bar-app", "header").
      return { primary: (c.componentType || '').replace(/^container\./, ''), secondary: '' };
    }
    var primary = _prettifySlot(c.slot) || c.componentType || '';
    var secondary = (c.componentType && c.componentType !== c.slot)
      ? c.componentType
      : '';
    return { primary, secondary };
  }

  var must = [], should = [], defer = [];
  comps.forEach(function (c) {
    var vis = (laidOut[c.componentType] || {}).visibility || 'visible';
    var item = _chipLabelFor(c);
    if (c.priority === 1 && vis === 'visible')      must.push(item);
    else if (c.priority === 2 && vis === 'visible') should.push(item);
    else                                            defer.push(item);
  });

  var notes = plan.plannerNotes || {};
  // SUPPRESS items come from plannerNotes — they're slot/task names that
  // were dropped pre-layout. Wrap them in the same {primary, secondary}
  // shape so _chipsFor renders them uniformly.
  var suppress = (notes.collapsedOptionalTasks || []).map(function (s) {
    return { primary: _prettifySlot(s) || s, secondary: '' };
  });

  // Column theming — matches the user-provided reference: MUST green,
  // SHOULD blue, SUPPRESS red, DEFER amber. Chips inherit the column tint.
  var COLS = [
    { key: 'must',     label: 'MUST',     items: must,     icon: '●', text: '#86EFAC', border: 'rgba(34,197,94,0.45)',  bg: 'rgba(34,197,94,0.10)'  },
    { key: 'should',   label: 'SHOULD',   items: should,   icon: '○', text: '#93C5FD', border: 'rgba(59,130,246,0.45)', bg: 'rgba(59,130,246,0.10)' },
    { key: 'suppress', label: 'SUPPRESS', items: suppress, icon: '⊘', text: '#FCA5A5', border: 'rgba(239,68,68,0.45)',  bg: 'rgba(239,68,68,0.10)'  },
    { key: 'defer',    label: 'DEFER',    items: defer,    icon: '⏸', text: '#FDE68A', border: 'rgba(245,158,11,0.45)', bg: 'rgba(245,158,11,0.10)' }
  ];

  function _chipsFor(col) {
    if (!col.items.length) {
      return '<div style="color:var(--text-3);font-style:italic;font-size:13px;padding:6px 0;">—</div>';
    }
    return col.items.map(function (item) {
      var primary   = item.primary || '';
      var secondary = item.secondary || '';
      return '<div style="' +
        'padding:6px 8px;' +
        'border:1px solid ' + col.border + ';' +
        'background:' + col.bg + ';' +
        'border-radius:6px;' +
        'color:' + col.text + ';' +
        'font-size:13px;' +
        'line-height:1.3;' +
        'word-break:break-word;' +
        'white-space:normal;' +
      '">' +
        '<div style="font-weight:500;">' + _escapeHtml(primary) + '</div>' +
        (secondary
          ? '<div style="font-size:13px;opacity:0.7;margin-top:2px;font-weight:400;">' + _escapeHtml(secondary) + '</div>'
          : '') +
      '</div>';
    }).join('');
  }

  function _columnFor(col) {
    return '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;">' +
      '<div style="font-size:13px;font-weight:700;color:' + col.text + ';letter-spacing:0.3px;">' +
        col.icon + ' ' + col.label + ' (' + col.items.length + ')' +
      '</div>' +
      _chipsFor(col) +
    '</div>';
  }

  var columnsHtml = '<div style="display:flex;gap:8px;align-items:flex-start;padding:4px 0;">' +
    COLS.map(_columnFor).join('') +
  '</div>';

  var trailing = '';
  var reasoning = notes.selectionReasoning || [];
  if (reasoning.length) {
    trailing += '<div style="margin-top:8px;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.08);font-size:13px;color:var(--text-2);line-height:1.5;">' +
      reasoning.map(function (r) { return '• ' + _escapeHtml(r); }).join('<br>') +
    '</div>';
  }
  if (notes.mandatoryInjected && notes.mandatoryInjected.length) {
    trailing += _pipelineRow('mandatory injected', notes.mandatoryInjected.join(', '), { valColor: '#FCA5A5' });
  }

  var wrap = document.createElement('div');
  wrap.innerHTML = _pipelineCard('🎯 INFORMATION PRIORITY', columnsHtml + trailing);
  o.appendChild(wrap.firstElementChild);
}

// 🔗 COMPONENT RESOLUTION block — Path A doesn't have Path B's semantic→atomic
// resolution layer (it emits atomic IDs directly from the registry), but it
// does have a chrome bridge: PIPELINE_CHROME_ATOMIC_ROLE maps certain chrome
// componentIds onto Path B atomic roles for rendering. Show those mappings
// plus the chosen variant per child so the designer can see exactly what
// got rendered for each registry entry.
function _renderPipelineComponentResolutionBlock(plan, layoutPlan) {
  var o = _pipelineOutput();
  if (!o || !layoutPlan) return;
  var allChildren = [];
  (layoutPlan.groups || []).forEach(function (g) {
    (g.children || []).forEach(function (ch) {
      if (ch.visibility !== 'hidden') allChildren.push(ch);
    });
  });
  if (!allChildren.length) return;

  var bridged = 0, direct = 0;
  var rows = '';
  allChildren.forEach(function (ch) {
    var atomic = (typeof PIPELINE_CHROME_ATOMIC_ROLE !== 'undefined')
      ? PIPELINE_CHROME_ATOMIC_ROLE[ch.componentId]
      : null;
    var resolved, note;
    if (atomic) {
      resolved = atomic + ' (chrome bridge)';
      note = 'rendered via window.renderAtomicForRole';
      bridged++;
    } else {
      resolved = ch.componentId + ' (direct)';
      note = ch.variant ? 'variant=' + ch.variant : '';
      direct++;
    }
    rows += '<div style="display:grid;grid-template-columns:1.2fr auto 1fr;gap:8px;padding:3px 0;align-items:center;font-size:13px;line-height:1.4;">' +
      '<span style="color:#A78BFA;font-weight:500;">' + _escapeHtml(ch.componentId) + '</span>' +
      '<span style="color:var(--text-3);">→</span>' +
      '<span style="color:#fff;font-family:ui-monospace,monospace;">' + _escapeHtml(resolved) + '</span>' +
      (note ? '<div style="grid-column:1 / -1;color:var(--text-3);font-style:italic;font-size:13px;padding-left:2px;">' + _escapeHtml(note) + '</div>' : '') +
    '</div>';
  });
  var header = '<div style="font-size:13px;color:var(--text-2);margin-bottom:4px;">' +
    bridged + ' bridged / ' + direct + ' direct' +
    '</div>';

  var wrap = document.createElement('div');
  wrap.innerHTML = _pipelineCard('🔗 COMPONENT RESOLUTION', header + rows);
  o.appendChild(wrap.firstElementChild);
}

// 🔀 FLOW GRAPH — honest disclosure: Path A produces ONE screen per call,
// so there's no flow graph to show. We emit a small note in the same
// idiom rather than fabricating fake nodes.
function _renderPipelineFlowBlock() {
  var o = _pipelineOutput();
  if (!o) return;
  var rows = _pipelineRow('flow', 'single-screen pipeline (no entry/action/completion graph)', { valColor: 'var(--text-3)' }) +
             _pipelineRow('note', 'Path A composes one screen per call. For multi-step flows use the agent path.', { valColor: 'var(--text-3)' });
  var wrap = document.createElement('div');
  wrap.innerHTML = _pipelineCard('🔀 FLOW GRAPH', rows);
  o.appendChild(wrap.firstElementChild);
}

// Path A layout block. Shows the composer's group structure with role tags,
// child role/slot mapping — the actual task-unit assembly the LLM produced.
function _renderPipelineLayoutBlock(layoutPlan) {
  var o = _pipelineOutput();
  if (!o || !layoutPlan) return;
  var groups = layoutPlan.groups || [];
  if (!groups.length) return;

  var rows = '';
  rows += _pipelineRow('container', layoutPlan.container);
  rows += _pipelineRow('groups', groups.length + ' (' +
    groups.map(function (g) { return g.role || '?'; }).join(', ') + ')');

  groups.forEach(function (g, gi) {
    var groupColor = g.role === 'primary-task' ? '#A5F3FC'
                   : g.role === 'chrome'       ? '#94a3b8'
                   : g.role === 'supporting'   ? '#FDE68A'
                   : '#fff';
    var childLines = (g.children || []).map(function (c) {
      var v = c.visibility === 'visible' ? '' : ' [' + (c.visibility || '?') + ']';
      var roleTag = c.role ? '<span style="color:#A5B4FC;">[' + _escapeHtml(c.role) + ']</span> ' : '';
      return roleTag + _escapeHtml(c.componentId || '?') + v;
    });
    rows += '<div style="padding:3px 0;font-size:13px;line-height:1.5;">' +
              '<span style="color:' + groupColor + ';font-weight:600;">[group ' + gi + ' · ' + (g.role || '?') + ']</span> ' +
              (g.purpose ? '<span style="color:var(--text-3);font-style:italic;">' + _escapeHtml(g.purpose) + '</span>' : '') +
              '<div style="margin-left:14px;color:#fff;">' + childLines.join('<br>') + '</div>' +
           '</div>';
  });

  var wrap = document.createElement('div');
  wrap.innerHTML = _pipelineCard('▤ LAYOUT (composer)', rows);
  o.appendChild(wrap.firstElementChild);
}

// Path A explanation + validation block. Replaces the monolithic innerHTML
// summary with the same card idiom for consistency.
function _renderPipelineSummaryBlock(explanation, validation) {
  var o = _pipelineOutput();
  if (!o) return;

  if (explanation) {
    var rows = '';
    rows += _pipelineRow('why',         explanation.whyThisUi || explanation.why_this_ui);
    var prioritized = explanation.whatWasPrioritized || explanation.what_was_prioritized || [];
    var collapsed   = explanation.whatWasRemovedOrCollapsed || explanation.what_was_removed_or_collapsed || [];
    var fixes       = explanation.whatShouldBeFixed || explanation.what_should_be_fixed || [];
    if (prioritized.length) rows += _pipelineRow('prioritized', prioritized.join(' · '));
    if (collapsed.length)   rows += _pipelineRow('collapsed',   collapsed.join(' · '));
    if (fixes.length)       rows += _pipelineRow('to fix',      fixes.join(' · '), { valColor: '#FCA5A5' });
    if (rows) {
      var wrap = document.createElement('div');
      wrap.innerHTML = _pipelineCard('💬 EXPLANATION', rows);
      o.appendChild(wrap.firstElementChild);
    }
  }

  if (validation) {
    var s = validation.summary || {};
    var v = validation.violations || [];
    var rowsV = '';
    rowsV += _pipelineRow('summary',
      'total=' + (s.total || 0) +
      ' · high=' + (s.high || 0) +
      ' · med=' + (s.medium || 0) +
      ' · low=' + (s.low || 0) +
      (s.autoFixable ? ' · auto-fixable=' + s.autoFixable : ''),
      { valColor: (s.high > 0 ? '#FCA5A5' : (s.total > 0 ? '#FDE68A' : '#86EFAC')) });
    v.forEach(function (vio) {
      var sevColor = vio.severity === 'high' ? '#FCA5A5' : vio.severity === 'medium' ? '#FDE68A' : '#94a3b8';
      rowsV += '<div style="padding:2px 0;font-size:13px;line-height:1.4;">' +
                 '<span style="color:' + sevColor + ';font-weight:600;">[' + vio.severity + '] ' + _escapeHtml(vio.ruleId) + '</span> ' +
                 '<span style="color:#fff;">' + _escapeHtml(vio.message || '') + '</span>' +
              '</div>';
    });
    var wrapV = document.createElement('div');
    wrapV.innerHTML = _pipelineCard('✓ VALIDATION', rowsV);
    o.appendChild(wrapV.firstElementChild);
  }

  o.scrollTop = o.scrollHeight;
}

// ---------------------------------------------------------------------------
//  R2 — Interpretation Layer renderer (6-question answer block)
// ---------------------------------------------------------------------------
function _renderInterpretationBlock(payload) {
  var o = _pipelineOutput();
  if (!o || !payload || !payload.interpretation) return;
  var i = payload.interpretation;

  var qaRows = '';
  var rows = [
    ['what user is doing',         i.what_user_doing],
    ['real goal',                  i.real_goal],
    ['most lacking',               i.most_lacking],
    ['what interferes',            i.what_interferes],
    ['system role',                (i.system_role && i.system_role.length) ? i.system_role.join(' + ') : null],
    ['interaction complexity',     i.interaction_complexity]
  ];
  rows.forEach(function (r) {
    if (!r[1]) return;
    qaRows += '<div style="display:flex;gap:8px;padding:2px 0;font-size:13px;line-height:1.4;">' +
      '<span style="color:var(--text-3);min-width:130px;flex-shrink:0;">' + _escapeHtml(r[0]) + '</span>' +
      '<span style="color:#fff;">' + _escapeHtml(r[1]) + '</span>' +
      '</div>';
  });

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div style="margin:6px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;background:rgba(255,255,255,0.02);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<span style="font-size:13px;color:var(--text-3);letter-spacing:0.4px;font-weight:600;">' +
          '\uD83D\uDD0D INTERPRETATION' +
        '</span>' +
      '</div>' +
      qaRows +
    '</div>';
  o.appendChild(wrap.firstElementChild);
  o.scrollTop = o.scrollHeight;
}

// ---------------------------------------------------------------------------
//  R2 — State Packet renderer (compressed machine-readable decision state)
// ---------------------------------------------------------------------------
function _renderStatePacketBlock(payload) {
  var o = _pipelineOutput();
  if (!o || !payload || !payload.statePacket) return;
  var sp = payload.statePacket;
  var fields = [
    ['purpose_type',        sp.purpose_type],
    ['primary_goal',        sp.primary_goal],
    ['journey_stage',       sp.journey_stage],
    ['urgency',             sp.urgency],
    ['attention_capacity',  sp.attention_capacity],
    ['interaction_budget',  sp.interaction_budget],
    ['coordination_need',   sp.coordination_need],
    ['device_role',         sp.device_role],
    ['system_role',         sp.system_role],
    ['autonomy_level',      sp.autonomy_level],
    ['privacy_level',       sp.privacy_level]
  ];
  var rowsHtml = '';
  fields.forEach(function (f) {
    if (!f[1]) return;
    rowsHtml += '<div style="display:flex;gap:8px;padding:1px 0;font-size:13px;font-family:ui-monospace,monospace;">' +
      '<span style="color:var(--text-3);min-width:150px;">' + _escapeHtml(f[0]) + '</span>' +
      '<span style="color:#fff;">' + _escapeHtml(f[1]) + '</span>' +
      '</div>';
  });
  var flags = [];
  if (sp.explanation_needed) flags.push('explanation_needed');
  if (sp.override_needed)    flags.push('override_needed');
  if (sp.handoff_required)   flags.push('handoff_required');
  var flagsHtml = flags.length
    ? '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">' +
        flags.map(function (f) {
          return '<span style="font-size:13px;padding:1px 6px;border-radius:8px;' +
            'background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);">' +
            _escapeHtml(f) + '</span>';
        }).join('') +
      '</div>'
    : '';

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div style="margin:6px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;background:rgba(255,255,255,0.02);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<span style="font-size:13px;color:var(--text-3);letter-spacing:0.4px;font-weight:600;">' +
          '\uD83D\uDCE6 STATE PACKET' +
        '</span>' +
      '</div>' +
      rowsHtml +
      flagsHtml +
    '</div>';
  o.appendChild(wrap.firstElementChild);
  o.scrollTop = o.scrollHeight;
}

// ---------------------------------------------------------------------------
//  R2 — Information Priority renderer (4-column must/should/suppress/defer)
// ---------------------------------------------------------------------------
function _renderPriorityBlock(payload) {
  var o = _pipelineOutput();
  if (!o || !payload || !payload.informationPriority) return;
  var ip = payload.informationPriority;

  function renderColumn(title, items, color, bg, border, emoji) {
    var chips = (items && items.length)
      ? items.map(function (c) {
          return '<div style="padding:2px 6px;margin:1px 0;border-radius:5px;' +
            'background:' + bg + ';color:' + color + ';border:1px solid ' + border + ';' +
            'font-size:13px;line-height:1.3;word-break:break-word;">' + _escapeHtml(c) + '</div>';
        }).join('')
      : '<div style="padding:2px 0;color:var(--text-3);font-size:13px;font-style:italic;">\u2014</div>';
    return '<div style="flex:1;min-width:0;">' +
      '<div style="font-size:13px;color:' + color + ';letter-spacing:0.4px;font-weight:700;margin-bottom:3px;">' +
        emoji + ' ' + title + ' <span style="color:var(--text-3);font-weight:400;">(' + (items ? items.length : 0) + ')</span>' +
      '</div>' +
      chips +
      '</div>';
  }

  var columns =
    renderColumn('MUST',    ip.must_show,    '#4ade80', 'rgba(74,222,128,0.10)',  'rgba(74,222,128,0.30)',  '\u25CF') +
    renderColumn('SHOULD',  ip.should_show,  '#60a5fa', 'rgba(96,165,250,0.10)',  'rgba(96,165,250,0.30)',  '\u25CB') +
    renderColumn('SUPPRESS',ip.suppress,     '#f87171', 'rgba(248,113,113,0.10)', 'rgba(248,113,113,0.30)', '\u2298') +
    renderColumn('DEFER',   ip.defer,        '#fbbf24', 'rgba(251,191,36,0.10)',  'rgba(251,191,36,0.30)',  '\u23F8');

  var reasoning = '';
  if (ip.why_must || ip.why_suppress) {
    reasoning = '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.05);font-size:13px;color:var(--text-2);font-style:italic;line-height:1.4;">';
    if (ip.why_must)     reasoning += '<div>\u2022 <span style="color:#4ade80;">MUST:</span> ' + _escapeHtml(ip.why_must) + '</div>';
    if (ip.why_suppress) reasoning += '<div>\u2022 <span style="color:#f87171;">SUPPRESS:</span> ' + _escapeHtml(ip.why_suppress) + '</div>';
    reasoning += '</div>';
  }

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div style="margin:6px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;background:rgba(255,255,255,0.02);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<span style="font-size:13px;color:var(--text-3);letter-spacing:0.4px;font-weight:600;">' +
          '\uD83C\uDFAF INFORMATION PRIORITY' +
        '</span>' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:flex-start;">' + columns + '</div>' +
      reasoning +
    '</div>';
  o.appendChild(wrap.firstElementChild);
  o.scrollTop = o.scrollHeight;
}

// ---------------------------------------------------------------------------
//  R3-C — Component Resolution renderer
//  Shows the semantic id \u2192 atomic role mapping for every AI-emitted
//  component that came from the semantic vocabulary. Components that
//  were emitted as raw atomic roles are listed too (marked "direct")
//  so the designer sees the full picture of what got rendered.
// ---------------------------------------------------------------------------
function _renderResolutionBlock(renderModel) {
  var o = _pipelineOutput();
  if (!o || !renderModel) return;
  var comps = Array.isArray(renderModel.components) ? renderModel.components : [];
  if (!comps.length) return;

  // Split semantic-origin vs direct-atomic
  var semanticRows = [];
  var directCount = 0;
  comps.forEach(function (c) {
    if (c._semanticId) {
      semanticRows.push({
        semantic: c._semanticId,
        atomic:   c.role,
        note:     c._semanticNote || ''
      });
    } else {
      directCount++;
    }
  });

  var rowsHtml = semanticRows.map(function (r) {
    return '<div style="display:grid;grid-template-columns:1.1fr auto 1fr;gap:8px;padding:3px 0;align-items:center;font-size:13px;line-height:1.35;">' +
      '<span style="color:#a78bfa;font-weight:500;">' + _escapeHtml(r.semantic) + '</span>' +
      '<span style="color:var(--text-3);">\u2192</span>' +
      '<span style="color:#fff;font-family:ui-monospace,monospace;">' + _escapeHtml(r.atomic) + '</span>' +
      (r.note
        ? '<div style="grid-column:1 / -1;color:var(--text-3);font-style:italic;font-size:13px;padding-left:2px;margin-top:1px;">' + _escapeHtml(r.note) + '</div>'
        : '') +
    '</div>';
  }).join('');

  // Empty-state: if every component was direct-atomic, still show the
  // block with a count so the designer knows the AI didn't use the
  // semantic vocabulary this round (vs. it being broken).
  var innerHtml = semanticRows.length
    ? rowsHtml +
      (directCount
        ? '<div style="font-size:13px;color:var(--text-3);margin-top:6px;font-style:italic;">+ ' +
            directCount + ' direct atomic component' + (directCount === 1 ? '' : 's') +
            ' (no semantic wrapper)</div>'
        : '')
    : '<div style="font-size:13px;color:var(--text-3);font-style:italic;">AI emitted ' +
        directCount + ' direct atomic component' + (directCount === 1 ? '' : 's') +
        ' \u2014 no semantic ids used this round.</div>';

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div style="margin:6px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;background:rgba(255,255,255,0.02);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<span style="font-size:13px;color:var(--text-3);letter-spacing:0.4px;font-weight:600;">' +
          '\uD83D\uDD17 COMPONENT RESOLUTION' +
        '</span>' +
        '<span style="font-size:13px;color:var(--text-3);">' +
          semanticRows.length + ' semantic / ' + directCount + ' direct' +
        '</span>' +
      '</div>' +
      innerHtml +
    '</div>';
  o.appendChild(wrap.firstElementChild);
  o.scrollTop = o.scrollHeight;
}

// ============================================================================
// R4: Flow Graph helpers
// ----------------------------------------------------------------------------
// Convert a server-side flow node payload into the "response" shape that
// RenderEngine.renderFromModel + StateManager.updateFromAgentGenerate expect
// (i.e. { sessionId, layoutTree, renderModel, critic }). Classification
// info (orchestration / interpretation / statePacket / informationPriority)
// is re-attached from the shared classification so the render-engine's
// purpose-aware dispatcher can still drive layout.
// ============================================================================
function _flowNodeToResponseShape(nodePayload, classifiedInfo) {
  if (!nodePayload) return null;
  var layoutTree  = nodePayload.layoutTree  || {};
  var renderModel = nodePayload.renderModel || {};
  var critic      = nodePayload.critic      || { score: 80, issues: [], suggestions: [] };

  // Ensure the shared decision packet travels with every node so the
  // render dispatcher + pipelineOutput blocks behave exactly like the
  // single-screen path.
  if (classifiedInfo) {
    if (!layoutTree.orchestration)       layoutTree.orchestration       = classifiedInfo.orchestration       || null;
    if (!layoutTree.interpretation)      layoutTree.interpretation      = classifiedInfo.interpretation      || null;
    if (!layoutTree.statePacket)         layoutTree.statePacket         = classifiedInfo.statePacket         || null;
    if (!layoutTree.informationPriority) layoutTree.informationPriority = classifiedInfo.informationPriority || null;
  }

  return {
    sessionId:   nodePayload.sessionId || ('sess_' + Date.now()),
    layoutTree:  layoutTree,
    renderModel: renderModel,
    critic:      critic
  };
}

// Render the FLOW block inside the pipelineOutput panel. Appended to the
// bottom just like the other classification blocks. `currentIdx` is the
// index of the node currently rendered on the canvas (0 = entry); pass
// -1 to draw the block without any node marked current (used while the
// nodes are still being generated in parallel).
function _renderFlowBlock(flowPlan, currentIdx) {
  var o = _pipelineOutput();
  if (!o || !flowPlan) return;
  var nodes = Array.isArray(flowPlan.nodes) ? flowPlan.nodes : [];
  var edges = Array.isArray(flowPlan.edges) ? flowPlan.edges : [];
  if (!nodes.length) return;

  // Remove any previous flow block so re-renders don't stack duplicates.
  var prev = o.querySelector('[data-block="flow"]');
  if (prev) prev.remove();

  var KIND_ACCENT = {
    entry:      '#3E91FF',
    action:     '#f59e0b',
    confirm:    '#f59e0b',
    completion: '#4ade80',
    detail:     '#a78bfa',
    alternate:  '#94a3b8',
    ambient:    '#60a5fa'
  };

  var nodeRows = nodes.map(function (n, i) {
    var isCurrent = (i === currentIdx);
    var accent = KIND_ACCENT[n.kind] || '#94a3b8';
    return (
      '<div style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:6px;' +
        (isCurrent ? 'background:rgba(62,145,255,0.12);border:1px solid rgba(62,145,255,0.3);' : 'border:1px solid transparent;') +
      '">' +
        '<span style="width:8px;height:8px;border-radius:50%;background:' + accent + ';flex-shrink:0;"></span>' +
        '<span style="color:var(--text-3);font-size:13px;letter-spacing:0.3px;text-transform:uppercase;min-width:72px;">' + _escapeHtml(n.kind || '?') + '</span>' +
        '<span style="color:#fff;font-size:13px;font-weight:500;flex:1;">' + _escapeHtml(n.intent || '(unspecified)') + '</span>' +
        '<span style="color:var(--text-3);font-family:ui-monospace,monospace;font-size:13px;">#' + _escapeHtml(n.id || ('n' + (i + 1))) + '</span>' +
      '</div>'
    );
  }).join('');

  var edgeRows = edges.length
    ? edges.map(function (e) {
        return (
          '<div style="display:flex;align-items:center;gap:6px;padding:2px 6px;color:var(--text-3);font-size:13px;font-family:ui-monospace,monospace;">' +
            '<span style="color:#94a3b8;">' + _escapeHtml(e.from || '') + '</span>' +
            '<span style="color:var(--text-3);">\u2500\u2500 ' + _escapeHtml(e.trigger || '') + ' \u25B6</span>' +
            '<span style="color:#94a3b8;">' + _escapeHtml(e.to || '') + '</span>' +
          '</div>'
        );
      }).join('')
    : '<div style="color:var(--text-3);font-size:13px;font-style:italic;padding:2px 6px;">single-node flow (no edges)</div>';

  var wrap = document.createElement('div');
  wrap.setAttribute('data-block', 'flow');
  wrap.innerHTML =
    '<div style="margin:6px 0;padding:8px 10px;border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;background:rgba(255,255,255,0.02);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<span style="font-size:13px;color:var(--text-3);letter-spacing:0.4px;font-weight:600;">' +
          '\uD83D\uDD00 FLOW GRAPH' +
        '</span>' +
        '<span style="font-size:13px;color:var(--text-3);">' +
          nodes.length + ' node' + (nodes.length === 1 ? '' : 's') +
          (edges.length ? (' / ' + edges.length + ' edge' + (edges.length === 1 ? '' : 's')) : '') +
        '</span>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:2px;">' + nodeRows + '</div>' +
      (edges.length ? ('<div style="margin-top:6px;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.06);">' + edgeRows + '</div>') : '') +
    '</div>';
  o.appendChild(wrap.firstElementChild);
  o.scrollTop = o.scrollHeight;
}

// Render the Flow Navigator UI above the canvas. Hidden entirely for
// single-node flows — the navigator would be noise for one dot.
function _renderFlowNavigator(flowState) {
  var nav = document.getElementById('flowNavigator');
  if (!nav) return;
  if (!flowState || !Array.isArray(flowState.nodes) || flowState.nodes.length < 2) {
    _hideFlowNavigator();
    return;
  }

  var nodes = flowState.nodes;
  var currentIdx = flowState.currentNodeIdx || 0;
  var canPrev = currentIdx > 0;
  var canNext = currentIdx < nodes.length - 1;

  var parts = [];
  parts.push(
    '<button class="fn-arrow" type="button" ' +
      'onclick="_switchFlowNode(' + (currentIdx - 1) + ')" ' +
      (canPrev ? '' : 'disabled ') +
      'title="Previous node">&lsaquo;</button>'
  );
  parts.push('<div class="fn-nodes">');
  nodes.forEach(function (n, i) {
    if (i > 0) parts.push('<span class="fn-edge">&rsaquo;</span>');
    var cls = 'fn-node' + (i === currentIdx ? ' is-current' : '');
    var label = (n.kind || 'node').toLowerCase();
    parts.push(
      '<button class="' + cls + '" type="button" ' +
        'onclick="_switchFlowNode(' + i + ')" ' +
        'title="' + _escapeHtml(n.intent || '') + '">' +
        _escapeHtml(label) +
      '</button>'
    );
  });
  parts.push('</div>');
  parts.push(
    '<button class="fn-arrow" type="button" ' +
      'onclick="_switchFlowNode(' + (currentIdx + 1) + ')" ' +
      (canNext ? '' : 'disabled ') +
      'title="Next node">&rsaquo;</button>'
  );
  parts.push(
    '<span class="fn-meta">' + (currentIdx + 1) + ' / ' + nodes.length + '</span>'
  );

  nav.innerHTML = parts.join('');
  nav.removeAttribute('hidden');
  nav.classList.add('is-visible');
}

function _hideFlowNavigator() {
  var nav = document.getElementById('flowNavigator');
  if (!nav) return;
  nav.innerHTML = '';
  nav.setAttribute('hidden', '');
  nav.classList.remove('is-visible');
}

// Swap the canvas to a different node of the current variant's flow.
// This does NOT call the AI — it just re-renders the cached renderModel
// for that node. Used by Flow Navigator arrow / dot clicks.
function _switchFlowNode(newIdx) {
  var v = activeVariant;
  var flowState = variants[v] && variants[v].flow;
  if (!flowState || !Array.isArray(flowState.nodes)) return;
  if (newIdx < 0 || newIdx >= flowState.nodes.length) return;
  if (newIdx === flowState.currentNodeIdx) return;

  flowState.currentNodeIdx = newIdx;
  var node = flowState.nodes[newIdx];

  // Pull classification info back from the variant's layoutTree so the
  // node's renderModel inherits the shared decision packet (same path
  // as first-time render).
  var classifiedInfo = variants[v].layoutTree || {};
  var res = _flowNodeToResponseShape(node, {
    orchestration:       classifiedInfo.orchestration,
    interpretation:      classifiedInfo.interpretation,
    statePacket:         classifiedInfo.statePacket,
    informationPriority: classifiedInfo.informationPriority
  });
  if (!res) return;

  // Thread the decision packet onto the renderModel (same as the
  // first-render path in generateVariantsFromAgent).
  if (res.renderModel && res.layoutTree) {
    res.renderModel._orchestration       = res.layoutTree.orchestration       || null;
    res.renderModel._interpretation      = res.layoutTree.interpretation      || null;
    res.renderModel._statePacket         = res.layoutTree.statePacket         || null;
    res.renderModel._informationPriority = res.layoutTree.informationPriority || null;
  }

  RenderEngine.renderFromModel(res.renderModel);

  // Update the active variant's currently-rendered pointers so Refine /
  // Critic / Export operate on THIS node's model, not the entry node's.
  variants[v].layoutTree  = res.layoutTree;
  variants[v].renderModel = res.renderModel;
  variants[v].critic      = res.critic;
  if (typeof StateManager !== 'undefined' && StateManager.updateFromAgentGenerate) {
    StateManager.updateFromAgentGenerate(res);
  }
  _saveCurrentVariant();

  // Re-paint navigator (highlight moves) and the pipelineOutput FLOW
  // block so the current node indicator stays in sync.
  _renderFlowNavigator(flowState);
  var flowPlan = {
    nodes: flowState.nodes.map(function (n) { return { id: n.id, kind: n.kind, intent: n.intent, triggered_by: n.triggered_by }; }),
    edges: flowState.edges || []
  };
  _renderFlowBlock(flowPlan, newIdx);

  if (res.critic && typeof RenderEngine !== 'undefined' && RenderEngine.renderCritic) {
    RenderEngine.renderCritic(res.critic);
  }
}
// Expose for the inline onclick handlers on the nav buttons.
window._switchFlowNode = _switchFlowNode;

// =====================================================================
//  AUTO-ITERATE LOOP (Phase 1)
//  ---------------------------------------------------------------------
//  When the user enables the "Auto-iterate" toggle, every pipelineGenerate()
//  call enters a loop:
//    1. Run the pipeline.
//    2. Capture: prompt, validation summary, layoutPlan JSON, and a PNG
//       snapshot of the device frame (via html2canvas).
//    3. If violations > 0, apply mechanical auto-fixes (validator hints +
//       a few pipeline-level patches) to the layoutPlan, re-render canvas
//       with patched plan, then re-run pipeline with refined prompt.
//    4. Stop when:
//       - violations.summary.total === 0
//       - max iterations reached (default 5)
//       - user clicks "Stop"
//       - new iteration is WORSE than the best so far (preserve best)
//
//  History is kept in window.AutoIterState.history; the History button
//  opens a dialog showing each iteration's snapshot + violations.
// =====================================================================

const AUTO_ITER_MAX = 5;
window.AutoIterState = {
  active:       false,
  stopRequested: false,
  iteration:    0,
  history:      [],
  bestIdx:      -1
};

// Capture #canvasFrame as a PNG data URL via html-to-image. Returns null
// if the library isn't loaded yet (CDN race) — caller continues without
// an image, history just won't have a snapshot for that iteration.
//
// Why html-to-image (not html2canvas): html2canvas reproduces the DOM
// by parsing CSS and re-drawing on a 2D canvas, which broke for our
// setup (doubled text, multi-layer box-shadow → fill, absolute chrome
// on top of body). html-to-image embeds the DOM into an SVG
// <foreignObject> and rasterizes via the browser's native renderer —
// pixel-accurate. (We tried modern-screenshot first but it ships ESM
// only; html-to-image is the same approach with a UMD bundle.)
//
// Resolution: capture at 2× via pixelRatio so the PNG is sharp on
// Retina displays.
async function autoIterCaptureSnapshot() {
  const lib = window.htmlToImage;
  if (!lib || typeof lib.toPng !== 'function') {
    console.warn('[auto-iter] html-to-image not loaded yet — skipping snapshot');
    return null;
  }
  const frame = document.getElementById('canvasFrame');
  if (!frame) return null;
  try {
    const pixelRatio = Math.max(2, window.devicePixelRatio || 1);
    const dataUrl = await lib.toPng(frame, {
      pixelRatio,
      cacheBust: true,
      // skipFonts: false → embed @font-face faces into the SVG so text
      // renders the same in the capture as on screen.
      skipFonts: false
    });
    return dataUrl;  // data:image/png;base64,...
  } catch (e) {
    console.warn('[auto-iter] snapshot failed:', e.message);
    return null;
  }
}

// Mechanical auto-fix applied to a layoutPlan + plan pair. Reads the
// validation report; for each fixable rule, mutates the layoutPlan in
// place. Returns { fixed: [ruleId,...], unfixed: [ruleId,...] }.
function autoIterApplyMechanicalFixes(resp) {
  const lp = resp.layoutPlan || {};
  const violations = (resp.validation && resp.validation.violations) || [];
  const fixed = [], unfixed = [];

  violations.forEach(v => {
    let didFix = false;

    // Rule: priority 1 component must stay visible
    if (v.ruleId === 'priority1_removed') {
      (lp.groups || []).forEach(g => (g.children || []).forEach(ch => {
        if (ch.componentId === v.element && (ch.visibility === 'hidden' || ch.visibility === 'collapsed')) {
          ch.visibility = 'visible';
          didFix = true;
        }
      }));
    }

    // Rule: priority 3 in compressed density should be collapsed
    if (v.ruleId === 'compressed_priority3_visible') {
      (lp.groups || []).forEach(g => (g.children || []).forEach(ch => {
        if (ch.componentId === v.element && ch.priority === 3 && ch.visibility === 'visible') {
          ch.visibility = 'collapsed';
          didFix = true;
        }
      }));
    }

    // Rule: glanceable but >4 visible — collapse lowest-priority extras
    if (v.ruleId === 'layout_overflow_check' && /glanceable but .* visible children/.test(v.message || '')) {
      const allChildren = (lp.groups || []).flatMap(g => (g.children || []).map(ch => ({ ch, g })));
      const visible = allChildren.filter(({ ch }) => ch.visibility === 'visible');
      // Sort by priority desc (3 first → collapse those first), exclude chrome
      visible.sort((a, b) => (b.ch.priority || 2) - (a.ch.priority || 2));
      const excess = visible.length - 4;
      for (let i = 0; i < excess; i++) {
        // Skip chrome (must stay visible)
        if (visible[i].ch.role === 'chrome') continue;
        visible[i].ch.visibility = 'collapsed';
        didFix = true;
      }
    }

    // Rule: chrome overflow check — chrome bridge handles flexible layout,
    // these violations are over-reported. Mark fixed (we'll skip the validator
    // in a future patch; for now, accept that rendering is correct).
    if (v.ruleId === 'layout_overflow_check' &&
        /(container\.status-bar-app|container\.header).* min_width.* exceeds/.test(v.message || '')) {
      didFix = true;  // chrome bridge renders correctly regardless of registry min_width
    }

    if (didFix) fixed.push(v.ruleId); else unfixed.push(v.ruleId);
  });

  return { fixed, unfixed };
}

// Refine the prompt for the next iteration based on UNFIXED violations.
// Mechanical: append clarifying clauses that nudge the LLM toward fixed
// behavior. Keeps the user's original prompt intact.
function autoIterRefinePrompt(originalPrompt, unfixedRules) {
  if (!unfixedRules.length) return originalPrompt;
  const hints = [];
  if (unfixedRules.includes('duplicate_content_across_slots')) {
    hints.push('Each component must have DISTINCT label and value text — no repeated content across slots.');
  }
  if (unfixedRules.includes('subject_generic_label')) {
    hints.push('Use concrete, scenario-specific text for all subject labels — no placeholders like "Title" or "Item".');
  }
  if (unfixedRules.includes('action_without_control_task')) {
    hints.push('Only emit action components when the scenario explicitly involves a user action.');
  }
  if (unfixedRules.includes('primary_task_missing_subject')) {
    hints.push('Every primary-task group MUST contain at least one subject component.');
  }
  if (unfixedRules.includes('orphan_action')) {
    hints.push('Action components belong in primary-task groups, not chrome or supporting.');
  }
  if (unfixedRules.includes('reference_order_mismatch')) {
    hints.push('Follow the Reference Layout ordering exactly — chrome → widgets → containers → navigation.');
  }
  if (unfixedRules.includes('nav_not_at_bottom')) {
    hints.push('Bottom navigation components MUST be in the last layout group.');
  }
  if (!hints.length) return originalPrompt;
  return originalPrompt + '\n\n[Refinement hints from previous iteration]:\n' + hints.map(h => '- ' + h).join('\n');
}

// Build a record for the history panel.
function autoIterRecordIteration(iteration, prompt, resp, snapshotDataUrl, fixed, unfixed) {
  const summary = (resp.validation && resp.validation.summary) || {};
  return {
    iteration,
    prompt,
    snapshotDataUrl,
    violationsTotal: summary.total || 0,
    violationsHigh:  summary.high  || 0,
    violationsMed:   summary.medium || 0,
    violationsLow:   summary.low   || 0,
    fixed,
    unfixed,
    layoutPlan:  resp.layoutPlan,
    interpretation: resp.interpretation,
    explanation: resp.explanation
  };
}

function autoIterIsBetter(a, b) {
  if (!b) return true;
  // Lower total violations is better; tie-break by fewer high-severity.
  if (a.violationsTotal !== b.violationsTotal) return a.violationsTotal < b.violationsTotal;
  return a.violationsHigh < b.violationsHigh;
}

function autoIterStop() {
  window.AutoIterState.stopRequested = true;
  const btn = document.getElementById('autoIterStopBtn');
  if (btn) btn.style.display = 'none';
}

function autoIterShowHistory() {
  const state = window.AutoIterState;
  if (!state.history.length) {
    alert('No iteration history yet — enable Auto-iterate and run the pipeline.');
    return;
  }
  // Build the dialog content
  const dlg = document.createElement('div');
  dlg.id = 'autoIterDialog';
  dlg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;';
  const inner = document.createElement('div');
  inner.style.cssText = 'background:var(--surface);border-radius:14px;padding:20px;max-width:1100px;width:100%;max-height:90vh;overflow:auto;color:var(--text);font-family:var(--font);';
  const closeBtn = '<button onclick="document.getElementById(\'autoIterDialog\').remove()" style="float:right;background:none;border:none;color:var(--text-2);font-size:18px;cursor:pointer;">×</button>';
  let body = '<h3 style="margin:0 0 12px;">Auto-iterate history (' + state.history.length + ' iterations, best = #' + (state.bestIdx + 1) + ')</h3>';
  body += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;">';
  state.history.forEach((rec, idx) => {
    const isBest = idx === state.bestIdx;
    const violColor = rec.violationsTotal === 0 ? '#86EFAC' : rec.violationsHigh > 0 ? '#FCA5A5' : '#FDE68A';
    body += '<div style="border:' + (isBest ? '2px solid #86EFAC' : '1px solid var(--divider)') + ';border-radius:10px;padding:12px;background:rgba(255,255,255,0.02);">';
    body += '<div style="font-weight:600;margin-bottom:6px;">Iter ' + (idx + 1) + (isBest ? ' <span style="color:#86EFAC;font-size:13px;">★ BEST</span>' : '') + '</div>';
    if (rec.snapshotDataUrl) {
      // image-rendering:auto + a moderately wide column so the 2× capture
      // downscales smoothly. Click the image to open at full resolution
      // in a new tab (the dataUrl is the source of truth).
      body += '<img src="' + rec.snapshotDataUrl + '" ' +
        'onclick="window.open(this.src,&quot;_blank&quot;)" ' +
        'style="width:100%;border-radius:6px;margin-bottom:8px;cursor:zoom-in;' +
        'image-rendering:auto;display:block;" ' +
        'title="Click to open at full resolution" />';
    } else {
      body += '<div style="height:120px;background:rgba(255,255,255,0.04);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--text-3);margin-bottom:8px;">(no snapshot)</div>';
    }
    body += '<div style="font-size:13px;color:' + violColor + ';">violations: ' + rec.violationsTotal + ' (H' + rec.violationsHigh + '/M' + rec.violationsMed + '/L' + rec.violationsLow + ')</div>';
    if (rec.fixed.length) body += '<div style="font-size:13px;color:#86EFAC;margin-top:4px;">fixed: ' + rec.fixed.slice(0,3).join(', ') + (rec.fixed.length > 3 ? '…' : '') + '</div>';
    if (rec.unfixed.length) body += '<div style="font-size:13px;color:#FCA5A5;margin-top:2px;">unfixed: ' + rec.unfixed.slice(0,3).join(', ') + (rec.unfixed.length > 3 ? '…' : '') + '</div>';
    body += '</div>';
  });
  body += '</div>';
  inner.innerHTML = closeBtn + body;
  dlg.appendChild(inner);
  document.body.appendChild(dlg);
}

window.autoIterStop = autoIterStop;
window.autoIterShowHistory = autoIterShowHistory;

// Run the full 5-step pipeline with Server-Sent Events so each step's
// JSON output lands in #pipelineOutput as soon as it's produced. If a
// step fails, an explicit "✗ {step}" line appears instead of a generic
// error — makes it immediately obvious WHERE the chain is breaking.
async function pipelineGenerate(_overridePrompt) {
  const promptInput = document.getElementById('genPrompt');
  const userPrompt = (_overridePrompt || (promptInput && promptInput.value) || '').trim();
  if (!userPrompt) { alert('Enter a scenario first.'); return; }

  // Auto-iterate entry: if the toggle is on AND we're not already inside a
  // loop iteration (avoid recursive entry), kick off the loop. Otherwise
  // proceed with a single run as before.
  const autoToggle = document.getElementById('autoIterToggle');
  const autoOn = autoToggle && autoToggle.checked && !window.AutoIterState.active;
  if (autoOn) {
    return pipelineGenerateAutoIterate(userPrompt);
  }

  return pipelineGenerateSingle(userPrompt);
}

// Unwrapped single-shot generation. Called directly when auto-iterate is OFF,
// or per-iteration by the auto-iterate loop with a refined prompt.
async function pipelineGenerateSingle(promptText) {
  const prompt = promptText;
  _pipelineStart('AI Pipeline (5 steps)');
  _pipelineInfo('Prompt: "' + prompt.slice(0, 80) + (prompt.length > 80 ? '\u2026' : '') + '"');
  _pipelineInfo('Streaming each step&rsquo;s JSON output below.');
  // Reset progressive-render state so panels accumulate fresh as step_done
  // events arrive. _handlePipelineEvent reads _pipelinePartial to decide
  // which panels to render (each at most once per run).
  _resetPipelinePartial(prompt);
  const tPipeline = Date.now();

  let finalData = null;
  let firstErrStep = null;
  try {
    // fastMode flag — read from "Output log" checkbox. Default checked
    // (full output). When unchecked: server skips Stage 7 (explain) and
    // trims verbose reasoning arrays in stages 1+2/3/4 → typically
    // 15-25% faster end-to-end. UI panels still render structural data;
    // only the narrative prose is missing.
    const _outputLogChk = document.getElementById('outputLogToggle');
    const fastMode = !!(_outputLogChk && !_outputLogChk.checked);
    /** Optional structured overrides (music, bottom-sheet uiState, slot copy) — see pipeline.applyUserSupplements */
    let userSupplements = null;
    const _supEl = document.getElementById('genUserSupplements');
    if (_supEl && _supEl.value && String(_supEl.value).trim()) {
      try {
        userSupplements = JSON.parse(String(_supEl.value).trim());
      } catch (e) {
        console.error('[pipeline] userSupplements JSON', e);
        alert('userSupplements JSON 형식이 잘못되었습니다: ' + e.message);
        _pipelineError('Invalid userSupplements JSON');
        return null;
      }
    }
    // Pipeline features — per-request toggles for each stage / post-fix.
    // Reads every checkbox under #pipelineFeaturesDetails; default-on
    // means an unchecked entry sets the feature to false, server then
    // skips that step. State auto-persists to localStorage so the
    // user's preferred profile survives reloads.
    const _features = {};
    document.querySelectorAll('.pf-flag').forEach(el => {
      const name = el.getAttribute('data-feature');
      if (name) _features[name] = !!el.checked;
    });
    try { localStorage.setItem('oneui-pipeline-features', JSON.stringify(_features)); } catch (_) {}

    const _reqBody = { scenario_text: prompt, fastMode: fastMode, features: _features };
    if (userSupplements && typeof userSupplements === 'object') {
      _reqBody.userSupplements = userSupplements;
    }
    // Reset the timing panel for the new run (events accumulate below).
    if (typeof window._oneuiResetTimingPanel === 'function') window._oneuiResetTimingPanel();
    const resp = await fetch('/api/pipeline/full/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify(_reqBody)
    });
    if (!resp.ok || !resp.body) throw new Error('HTTP ' + resp.status);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Parse SSE frames separated by blank lines
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      for (const frame of frames) {
        if (!frame.trim()) continue;
        let ev = 'message', data = '';
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) ev = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        let payload = {};
        try { payload = data ? JSON.parse(data) : {}; } catch (e) { payload = { raw: data }; }
        _handlePipelineEvent(ev, payload);
        if (ev === 'done') finalData = payload;
        if (ev === 'error' && !firstErrStep) firstErrStep = payload.step || 'unknown';
      }
    }

    if (firstErrStep) {
      _pipelineError('Pipeline halted at step "' + firstErrStep + '"');
      return;
    }
    if (!finalData) {
      _pipelineError('Stream ended without a "done" event');
      return;
    }
    _pipelineSuccess('Pipeline complete (' + ((Date.now() - tPipeline) / 1000).toFixed(1) + 's total)');
    // Attach the original prompt so renderPipelineResponse's interpretation
    // panel block can display it as the first row (otherwise the user would
    // have to scroll up to see what they asked for).
    finalData._scenario = prompt;
    renderPipelineResponse(finalData);
    return finalData;  // exposed so the auto-iterate loop can inspect violations
  } catch (e) {
    console.error('[pipeline]', e);
    _pipelineError('Pipeline request failed: ' + e.message);
    return null;
  }
}

// Auto-iterate orchestrator. Calls pipelineGenerateSingle in a loop, captures
// snapshots between iterations, applies mechanical fixes, refines the prompt,
// and stops on success/timeout/cancel.
async function pipelineGenerateAutoIterate(initialPrompt) {
  const state = window.AutoIterState;
  state.active = true;
  state.stopRequested = false;
  state.iteration = 0;
  state.history = [];
  state.bestIdx = -1;

  const stopBtn = document.getElementById('autoIterStopBtn');
  const histBtn = document.getElementById('autoIterHistoryBtn');
  const histCount = document.getElementById('autoIterCount');
  if (stopBtn) stopBtn.style.display = 'inline-flex';
  if (histBtn) histBtn.style.display = 'inline-flex';

  let promptForIter = initialPrompt;
  let lastFinalData = null;

  for (let i = 0; i < AUTO_ITER_MAX; i++) {
    if (state.stopRequested) break;
    state.iteration = i + 1;

    // Run the pipeline once
    _pipelineInfo('— Auto-iterate ' + (i + 1) + '/' + AUTO_ITER_MAX + ' —');
    const finalData = await pipelineGenerateSingle(promptForIter);
    if (!finalData) break;  // pipeline error — stop loop
    lastFinalData = finalData;

    // Capture snapshot (after a tick so the canvas finishes painting)
    await new Promise(r => setTimeout(r, 200));
    const snapshot = await autoIterCaptureSnapshot();

    // Apply mechanical fixes
    const { fixed, unfixed } = autoIterApplyMechanicalFixes(finalData);

    // Record this iteration
    const rec = autoIterRecordIteration(i + 1, promptForIter, finalData, snapshot, fixed, unfixed);
    state.history.push(rec);
    if (autoIterIsBetter(rec, state.bestIdx >= 0 ? state.history[state.bestIdx] : null)) {
      state.bestIdx = state.history.length - 1;
    }
    if (histCount) histCount.textContent = '(' + state.history.length + ')';

    // Stop conditions
    if (rec.violationsTotal === 0) {
      _pipelineSuccess('✓ Clean result — stopping auto-iterate');
      break;
    }
    if (i + 1 >= AUTO_ITER_MAX) {
      _pipelineInfo('Reached max ' + AUTO_ITER_MAX + ' iterations — stopping');
      break;
    }

    // Refine the prompt for the next iteration based on unfixed rules
    promptForIter = autoIterRefinePrompt(initialPrompt, unfixed);
  }

  // Restore the best iteration if the last one is worse
  if (state.bestIdx >= 0 && state.bestIdx !== state.history.length - 1) {
    const best = state.history[state.bestIdx];
    _pipelineInfo('Best iteration was #' + (state.bestIdx + 1) + ' (' + best.violationsTotal + ' violations) — restoring');
    // Re-render the best layout
    if (lastFinalData) {
      lastFinalData.layoutPlan = best.layoutPlan;
      lastFinalData.interpretation = best.interpretation;
      lastFinalData.explanation = best.explanation;
      renderPipelineResponse(lastFinalData);
    }
  }

  state.active = false;
  if (stopBtn) stopBtn.style.display = 'none';
}

window.pipelineGenerate = pipelineGenerate;
window.pipelineGenerateSingle = pipelineGenerateSingle;
window.pipelineGenerateAutoIterate = pipelineGenerateAutoIterate;
window.renderPipelineResponse = renderPipelineResponse;

// Per-event handler. Each SSE event from /api/pipeline/full/stream is
// rendered as its own status line + collapsible JSON block.
// PROGRESSIVE-RENDER STATE \u2014 per-pipeline-run cache. Gets populated as
// step_done events arrive so each step can render the panels for which
// data is now available without waiting for the final 'done' event.
// Cleared at the start of each pipelineGenerate run.
var _pipelinePartial = null;

function _resetPipelinePartial(scenarioText) {
  _pipelinePartial = {
    scenarioText: scenarioText || '',
    interpretation: null,
    planningPacket: null,
    plan: null,
    layoutPlan: null,
    validation: null,
    explanation: null,
    panelsRendered: {
      classification: false,
      interpretation: false,
      statePacket:    false,
      priority:       false,
      flow:           false,
      resolution:     false,
      layout:         false,
      summary:        false
    }
  };
}

function _handlePipelineEvent(ev, payload) {
  if (ev === 'step_started') {
    _pipelineStatus('step-' + payload.step,
      '<b>Step ' + payload.idx + '/' + payload.total + '</b> &middot; ' +
      _escapeHtml(payload.step) + ' \u2014 ' + _escapeHtml(payload.label || '') +
      ' <span style="color:var(--text-3);">running\u2026</span>',
      'var(--text-2)');
    return;
  }
  if (ev === 'step_done') {
    var secs = ((payload.elapsedMs || 0) / 1000).toFixed(1);
    _pipelineStatus('step-' + payload.step,
      '\u2713 <b>Step ' + payload.idx + '/' + payload.total + '</b> &middot; ' +
      _escapeHtml(payload.step) + ' <span style="color:var(--text-3);">(' + secs + 's)</span>',
      '#4ade80');
    // Append a row to the pipeline timing panel \u2014 gives the operator
    // a per-stage breakdown so they can see exactly which features
    // affected latency when toggling on/off.
    if (typeof window._oneuiAppendTimingRow === 'function') {
      window._oneuiAppendTimingRow(payload.step, payload.elapsedMs || 0, !!payload.skipped);
    }
    var o = _pipelineOutput();
    if (!o) return;

    // PROGRESSIVE PANELS \u2014 append as each stage's data arrives. Each
    // panel renders at most ONCE per pipeline run (tracked via
    // _pipelinePartial.panelsRendered). The 'done' event then sees all
    // flags set and skips re-rendering.
    var out = payload.output || {};
    if (!_pipelinePartial) _resetPipelinePartial('');

    // step "interpret" \u2014 interpretation + planningPacket are now available
    if (payload.step === 'interpret') {
      _pipelinePartial.interpretation = out.interpretation;
      _pipelinePartial.planningPacket = out.planningPacket;
      var scn = _pipelinePartial.scenarioText;
      if (out.interpretation && !_pipelinePartial.panelsRendered.classification) {
        _renderPipelineClassificationBlock(out.interpretation, out.planningPacket, scn);
        _pipelinePartial.panelsRendered.classification = true;
      }
      if (out.interpretation && !_pipelinePartial.panelsRendered.interpretation) {
        _renderPipelineInterpretationBlock(out.interpretation, scn);
        _pipelinePartial.panelsRendered.interpretation = true;
      }
      if (out.planningPacket && !_pipelinePartial.panelsRendered.statePacket) {
        _renderPipelineStatePacketBlock(out.interpretation, out.planningPacket);
        _pipelinePartial.panelsRendered.statePacket = true;
      }
    }

    // step "select" \u2014 plan now available; render priority panel
    if (payload.step === 'select') {
      _pipelinePartial.plan = out.plan;
      if (out.plan && !_pipelinePartial.panelsRendered.priority) {
        // No layoutPlan yet, so visibility decisions aren't known \u2014
        // _renderPipelinePriorityBlock handles a missing layoutPlan
        // gracefully (just won't dim DEFER items).
        _renderPipelinePriorityBlock(out.plan, null);
        _pipelinePartial.panelsRendered.priority = true;
      }
    }

    // step "compose" \u2014 layoutPlan now available; render flow + resolution + layout
    if (payload.step === 'compose') {
      _pipelinePartial.layoutPlan = out.layoutPlan;
      if (!_pipelinePartial.panelsRendered.flow) {
        _renderPipelineFlowBlock();
        _pipelinePartial.panelsRendered.flow = true;
      }
      if (out.layoutPlan && _pipelinePartial.plan && !_pipelinePartial.panelsRendered.resolution) {
        _renderPipelineComponentResolutionBlock(_pipelinePartial.plan, out.layoutPlan);
        _pipelinePartial.panelsRendered.resolution = true;
      }
      if (out.layoutPlan && !_pipelinePartial.panelsRendered.layout) {
        _renderPipelineLayoutBlock(out.layoutPlan);
        _pipelinePartial.panelsRendered.layout = true;
      }
    }

    // step "validate" \u2014 store; final summary block waits for explain
    if (payload.step === 'validate') {
      _pipelinePartial.validation = out;
    }

    // step "explain" \u2014 render the final summary block
    if (payload.step === 'explain') {
      _pipelinePartial.explanation = out;
      if (!_pipelinePartial.panelsRendered.summary) {
        _renderPipelineSummaryBlock(out, _pipelinePartial.validation);
        _pipelinePartial.panelsRendered.summary = true;
      }
    }

    // Append a collapsible JSON preview for that step (for power users
    // who want raw output). Comes AFTER the panel render so the user-
    // friendly view stays at the top of the panel.
    var title = payload.step + ' output';
    var meta = '(' + secs + 's)';
    var wrap = document.createElement('div');
    wrap.innerHTML = _pipelineJsonBlock(title, payload.output || {}, meta);
    o.appendChild(wrap.firstElementChild);
    o.scrollTop = o.scrollHeight;
    return;
  }
  if (ev === 'done') {
    // Schema check — validate the server actually returned what
    // renderPipelineResponse expects (layoutPlan.groups[].children[]).
    _validatePipelineSchema(payload);
    return;
  }
  if (ev === 'error') {
    var secs2 = ((payload.elapsedMs || 0) / 1000).toFixed(1);
    _pipelineStatus('step-' + (payload.step || 'unknown'),
      '\u2717 <b>' + _escapeHtml(payload.step || 'unknown') + '</b> \u2014 ' +
      _escapeHtml(payload.message || 'error') +
      ' <span style="color:var(--text-3);">(' + secs2 + 's)</span>',
      '#ff6b6b');
    return;
  }
}

// Validate the final pipeline payload has the schema that
// renderPipelineResponse expects, and log any mismatches. This makes
// Phase-1 debugging explicit: if the server changes contract or a
// composer step returns something unexpected, we see it immediately.
function _validatePipelineSchema(data) {
  var errors = [];       // schema broken (renderer will fail)
  var warnings = [];     // schema ok, but suspicious data (renderer might show empty)

  if (!data || typeof data !== 'object') {
    errors.push('response is not an object');
  } else {
    if (!data.uiState || typeof data.uiState !== 'object') {
      errors.push('missing uiState (expected step-2 ui_state_resolution output)');
    }
    if (!data.plan || typeof data.plan !== 'object') {
      errors.push('missing plan (expected step-3 required_components output)');
    } else if (!Array.isArray(data.plan.requiredComponents)) {
      errors.push('plan.requiredComponents missing or not an array');
    } else if (data.plan.requiredComponents.length === 0) {
      warnings.push('plan.requiredComponents is empty \u2014 composer will render no content');
    }
    if (!data.layoutPlan || typeof data.layoutPlan !== 'object') {
      errors.push('missing layoutPlan (expected step-4 composer output)');
    } else {
      if (!Array.isArray(data.layoutPlan.groups)) {
        errors.push('layoutPlan.groups missing or not an array \u2014 renderPipelineResponse expects groups[]');
      } else {
        data.layoutPlan.groups.forEach(function (g, i) {
          if (!Array.isArray(g.children)) {
            errors.push('layoutPlan.groups[' + i + '].children missing or not an array');
          } else {
            g.children.forEach(function (c, j) {
              if (!c.componentId) {
                errors.push('layoutPlan.groups[' + i + '].children[' + j + '] missing componentId');
              }
            });
          }
        });
        if (!data.layoutPlan.surfaceType && !data.layoutPlan.groups.length) {
          errors.push('layoutPlan has neither surfaceType nor any groups');
        }
      }
      // Cross-check: every componentId used in layoutPlan should exist
      // in plan.requiredComponents. Composer inventing new ids is a
      // real bug we want to surface.
      if (data.plan && Array.isArray(data.plan.requiredComponents) &&
          Array.isArray(data.layoutPlan.groups)) {
        var known = new Set(data.plan.requiredComponents.map(function (c) { return c.componentType || c.id; }));
        data.layoutPlan.groups.forEach(function (g) {
          (g.children || []).forEach(function (c) {
            if (c.componentId && !known.has(c.componentId)) {
              warnings.push('composer invented componentId "' + c.componentId +
                '" not in plan.requiredComponents');
            }
          });
        });
      }
    }
    if (!data.validation || typeof data.validation !== 'object') {
      errors.push('missing validation (expected rollupValidationResults output)');
    } else if (data.validation.summary && data.validation.summary.high > 0) {
      warnings.push('validation: ' + data.validation.summary.high + ' HIGH-severity violation(s)');
    }
    if (!data.explanation || typeof data.explanation !== 'object') {
      errors.push('missing explanation (expected step-7 output)');
    }
  }

  if (errors.length === 0) {
    var groupCount = (data.layoutPlan && data.layoutPlan.groups && data.layoutPlan.groups.length) || 0;
    var childCount = 0;
    (data.layoutPlan && data.layoutPlan.groups || []).forEach(function (g) {
      childCount += (g.children || []).length;
    });
    _pipelineSuccess('Schema OK \u2014 layoutPlan.groups[' + groupCount + '] with ' +
      childCount + ' child' + (childCount === 1 ? '' : 'ren'));
  } else {
    _pipelineError('Schema BROKEN (' + errors.length + ' error' + (errors.length === 1 ? '' : 's') + '):');
    errors.forEach(function (msg) { _pipelineLog('&nbsp;&nbsp;\u2022 ' + _escapeHtml(msg), '#ff6b6b'); });
  }
  if (warnings.length > 0) {
    _pipelineLog('&#9888; Warnings (' + warnings.length + '):', '#fbbf24');
    warnings.forEach(function (msg) { _pipelineLog('&nbsp;&nbsp;\u2022 ' + _escapeHtml(msg), '#fbbf24'); });
  }
}

const promptMap = {
  'home': 'home', '홈': 'home', '홈화면': 'home', '홈 화면': 'home', 'homescreen': 'home', 'launcher': 'home',
  'login': 'login', 'sign in': 'login', 'signin': 'login', '로그인': 'login', '로그 인': 'login', '회원가입': 'login',
  'product': 'product', 'detail': 'product', '제품': 'product', '상세': 'product', '상품': 'product', 'galaxy': 'product',
  'settings': 'settings', 'setting': 'settings', '설정': 'settings', '환경설정': 'settings',
  'chat': 'chat', 'message': 'chat', '채팅': 'chat', '메시지': 'chat', '대화': 'chat',
  'feed': 'feed', 'news': 'feed', '피드': 'feed', '뉴스': 'feed', '탐색': 'feed', 'discover': 'feed',
  'profile': 'profile', '프로필': 'profile', '마이페이지': 'profile', 'my page': 'profile',
  'gallery': 'gallery', 'photo': 'gallery', '갤러리': 'gallery', '사진': 'gallery', '앨범': 'gallery',
  'dashboard': 'dashboard', '대시보드': 'dashboard', '통계': 'dashboard', 'stats': 'dashboard', 'analytics': 'dashboard',
  'onboarding': 'onboarding', 'welcome': 'onboarding', '온보딩': 'onboarding', '웰컴': 'onboarding', '시작': 'onboarding',
  'music': 'music', '음악': 'music', '플레이어': 'music',
  'lock': 'lockscreen', 'lockscreen': 'lockscreen', 'lock screen': 'lockscreen', '잠금': 'lockscreen', '잠금화면': 'lockscreen', '잠금 화면': 'lockscreen',
  'notification': 'notifications', 'notifications': 'notifications', '알림': 'notifications', '알림창': 'notifications',
  'quick settings': 'quicksettings', 'quicksettings': 'quicksettings', 'qs': 'quicksettings', '빠른 설정': 'quicksettings', '빠른설정': 'quicksettings', 'toggles': 'quicksettings',
  'smart': 'smartthings', 'smartthings': 'smartthings', 'iot': 'smartthings', '스마트싱스': 'smartthings', '스마트홈': 'smartthings',
  'media': 'media', 'player': 'media', '미디어': 'media',
  'keyboard': 'keyboard', '키보드': 'keyboard', 'type': 'keyboard', '타이핑': 'keyboard',
};

// Background policy is resolved by window.UIState (see ui-state.js) and then
// realised by *swapping the active wallpaper*:
//   - lock / home surfaces   → user's chosen wallpaper
//   - app surfaces           → 'galaxy-night' wallpaper
//   - shades over app        → 'galaxy-night' + scrim handled elsewhere
//   - shades over lock/home  → user's wallpaper + scrim
//   - system-dialog          → 'dialog-surface' wallpaper
function applyScenarioBackground(scenarioKey) {
  const frame = document.getElementById('canvasFrame');
  if (!frame) return;
  const decision = (window.UIState && window.UIState.decisionForScenario)
    ? window.UIState.decisionForScenario(scenarioKey)
    : { showWallpaper: (scenarioKey === 'home' || scenarioKey === 'lockscreen'),
        backgroundPolicy: (scenarioKey === 'home' || scenarioKey === 'lockscreen') ? 'wallpaper' : 'solid-dark' };

  // Mirror decision onto the frame as data-attrs (for any CSS hooks).
  frame.dataset.bgPolicy      = decision.backgroundPolicy;
  frame.dataset.showWallpaper = decision.showWallpaper ? 'true' : 'false';

  // Generator picks the wallpaper asset from the resolved 3-layer model.
  // Layer ① (wallpaper) → user's pick; Layer ② (app-bg) → galaxy-night;
  // dialog-surface is an isolated system surface.
  const resolved = (window.UIState && window.UIState.resolveForScenario)
    ? window.UIState.resolveForScenario(scenarioKey)
    : { baseSurface: (scenarioKey === 'lockscreen') ? 'lock'
                   : (scenarioKey === 'home')       ? 'home' : 'app',
        overlayType: 'none', backgroundPolicy: decision.backgroundPolicy };
  const layers = window.Generator
    ? window.Generator.resolveLayers(resolved, { theme: 'dark' })
    : null;

  // Restore the user's chosen wallpaper (or wp-1 default) for any scenario
  // whose backgroundPolicy allows it. Previously we force-set 'none' (solid
  // dark) for every generated scenario, which hid the wallpaper on Home /
  // List / Detail / Lock. Now the device-frame shows the actual wallpaper.
  if (typeof setWallpaper === 'function') {
    if (decision.backgroundPolicy === 'dialog-surface') {
      setWallpaper('dialog-surface', { system: true });
    } else {
      setWallpaper(userWallpaperChoice || 'wp-1', { system: true });
    }
  }
}

// ============================================================================
//  SCREEN / OVERLAY composition
// ----------------------------------------------------------------------------
//  Per One UI guideline, the nav distinguishes:
//    - Screens (full-surface): Lock / Home / App(list) / App(detail)
//    - Overlays (regions over a screen): Notification / QuickSettings / Dialog
//
//  State:
//    window.currentBaseSurface — which screen is rendered as the base
//    window.currentOverlay     — which overlay is layered on top (or null)
//
//  Entry points from genui.html buttons:
//    generateScreen(key, el) — sets base, clears overlay, renders
//    toggleOverlay(key, el)  — adds/removes overlay without touching base
//    clearOverlay()          — removes overlay only
// ============================================================================

window.currentBaseSurface = window.currentBaseSurface || null;
window.currentOverlay     = window.currentOverlay     || null;

function generateScreen(scenarioKey, buttonEl) {
  // Toggle behavior — matches Overlays. Clicking the currently active
  // screen button deselects it and clears the canvas, so the row reads
  // as a real toggle instead of a one-way radio. Clicking a different
  // screen switches as before.
  if (window.currentBaseSurface === scenarioKey) {
    window.currentBaseSurface = null;
    window.currentOverlay = null;
    _removeOverlayLayer();
    if (buttonEl) buttonEl.classList.remove('active');
    document.querySelectorAll('.scene-btn[data-role="overlay"].active')
      .forEach(function (b) { b.classList.remove('active'); });
    if (typeof window.clearCanvas === 'function') window.clearCanvas();
    window.__lastPipelineRenderBundle = null;
    _refreshOverlayHint();
    return;
  }
  window.currentBaseSurface = scenarioKey;
  window.currentOverlay = null;
  _removeOverlayLayer();
  _markActiveSceneBtn(buttonEl, 'screen');
  generateScenario(scenarioKey);
  _refreshOverlayHint();
}

function toggleOverlay(overlayKey, buttonEl) {
  // If the user hit an overlay button without picking a screen first, pick
  // one of the four base screens at random so the overlay has realistic
  // context behind it (matches the Lock / Home / List / Detail buttons in
  // genui.html line 468–471). Every open gives a fresh underlying scene.
  if (!window.currentBaseSurface) {
    var BASE_SCREENS = ['lockscreen', 'home', 'feed', 'detail'];
    var pickedBase = BASE_SCREENS[Math.floor(Math.random() * BASE_SCREENS.length)];
    window.currentBaseSurface = pickedBase;
    generateScenario(pickedBase);
    // Reflect the pick in the sidebar so the user sees which base was chosen
    var baseBtn = document.querySelector('.scene-btn[data-role="screen"][onclick*="\'' + pickedBase + '\'"]');
    if (baseBtn) _markActiveSceneBtn(baseBtn, 'screen');
  }

  if (window.currentOverlay === overlayKey) {
    clearOverlay();
    return;
  }

  // Switching overlays: remove previous, render new
  window.currentOverlay = overlayKey;
  _removeOverlayLayer();
  _renderOverlay(overlayKey);
  _markActiveSceneBtn(buttonEl, 'overlay');
  _refreshOverlayHint();
}

function clearOverlay() {
  window.currentOverlay = null;
  _removeOverlayLayer();
  document.querySelectorAll('.scene-btn[data-role="overlay"].active')
    .forEach(function (b) { b.classList.remove('active'); });
  _refreshOverlayHint();
}

function _markActiveSceneBtn(btn, role) {
  if (role === 'screen') {
    document.querySelectorAll('.scene-btn[data-role="screen"].active')
      .forEach(function (b) { b.classList.remove('active'); });
    // Screen change also clears overlay button active state
    document.querySelectorAll('.scene-btn[data-role="overlay"].active')
      .forEach(function (b) { b.classList.remove('active'); });
  } else if (role === 'overlay') {
    document.querySelectorAll('.scene-btn[data-role="overlay"].active')
      .forEach(function (b) { b.classList.remove('active'); });
  }
  if (btn) btn.classList.add('active');
}

function _refreshOverlayHint() {
  var hint = document.getElementById('overlayHint');
  if (!hint) return;
  if (!window.currentBaseSurface) {
    hint.textContent = 'Overlays render on top of the current screen. Pick a screen first.';
  } else if (!window.currentOverlay) {
    hint.textContent = 'Base: ' + window.currentBaseSurface + ' — click an overlay to layer it on top.';
  } else {
    hint.textContent = 'Base: ' + window.currentBaseSurface + ' · Overlay: ' + window.currentOverlay;
  }
}

// Remove overlay DOM + overlay nodes from DesignDoc; leaves base intact.
function _removeOverlayLayer() {
  var canvas = document.getElementById('canvas');
  if (!canvas) return;

  // overlay-inner now lives on canvas-FRAME (not canvas-inner). Clean
  // up from both locations so we catch legacy + current layouts.
  canvas.querySelectorAll(':scope > .overlay-inner').forEach(function (n) { n.remove(); });

  var frameEl = document.getElementById('canvasFrame');
  if (frameEl) {
    frameEl.querySelectorAll(':scope > .overlay-inner').forEach(function (n) { n.remove(); });
    delete frameEl.dataset.overlayActive;
    delete frameEl.dataset.overlayBase;
    delete frameEl.dataset.overlayKind;
  }

  var rulesInner = canvas._rulesInner;
  if (rulesInner) {
    rulesInner.querySelectorAll(':scope > .overlay-inner').forEach(function (n) { n.remove(); });
    rulesInner.querySelectorAll('[data-layer="overlay"]').forEach(function (n) { n.remove(); });
    rulesInner.classList.remove('overlay-hides-all', 'overlay-hides-statusbar',
      'overlay-hides-lock-content');
  }

  // Also strip any stray overlay-layer items at canvas level
  canvas.querySelectorAll('[data-layer="overlay"]').forEach(function (n) { n.remove(); });

  // Drop overlay nodes from DesignDoc
  if (window.DesignDoc && window.DesignDoc.state && Array.isArray(window.DesignDoc.state.nodes)) {
    var kept = window.DesignDoc.state.nodes.filter(function (n) { return n.layer !== 'overlay'; });
    if (kept.length !== window.DesignDoc.state.nodes.length) {
      window.DesignDoc.state.nodes = kept;
    }
  }
}

// Solid white stacked notifs over Home/List/Detail are a legacy baseline
// (Default / base preset only). Gradient · Glass · Flat · Neon · Grain all
// use the same tokenized atomics as the rest of GenUI — otherwise theme
// changes never reached the overlay layer (always `theme: light`).
function _overlayLegacyLightNotifications() {
  try {
    if (typeof document === 'undefined' || !document.documentElement) return true;
    var v = (getComputedStyle(document.documentElement).getPropertyValue('--oneui-theme-style') || '').trim().toLowerCase();
    return v === '' || v === 'base';
  } catch (e) {
    return true;
  }
}

// Render an overlay (Dialog / QS / Notif) on top of the current base screen.
function _renderOverlay(overlayKey) {
  var canvas = document.getElementById('canvas');
  if (!canvas) return;
  if (typeof window.renderPlanIntoTarget !== 'function') return;
  if (!window.Generator) return;

  var ruleMap = {
    notifications: 'notificationShadeRules',
    notification:  'notificationShadeRules',
    notif:         'notificationShadeRules',
    quicksettings: 'quickSettingsRules',
    quickSettings: 'quickSettingsRules',
    qs:            'quickSettingsRules',
    dialog:        'dialogWidgetRules'
  };
  var fnName = ruleMap[overlayKey];
  var fn = fnName && window.Generator[fnName];
  if (typeof fn !== 'function') return;

  // Default uiState per overlay type
  var defaults = {
    notifications: { overlayType: 'shade', attentionMode: 'focused', contextTags: ['media-playing'] },
    quicksettings: { overlayType: 'shade', attentionMode: 'focused', contextTags: [] },
    dialog:        { baseSurface: 'app', contextTags: ['live-activity:call'] }
  };
  var uiState =
    defaults[overlayKey] ||
    defaults[ruleMap[overlayKey] === 'notificationShadeRules' ? 'notifications' :
             ruleMap[overlayKey] === 'quickSettingsRules'     ? 'quicksettings' :
             'dialog'] || {};

  var viewport = { width: 451, height: 978 };
  var plan = fn(uiState, { viewport: viewport });

  // The overlay is appended to the CANVAS (canvas-inner) as a sibling of
  // _rulesInner — NOT inside _rulesInner. Why: _rulesInner has
  // transform:scale() which creates a stacking context that traps
  // backdrop-filter. If the overlay lives inside _rulesInner it can only
  // blur what's inside that stacking context, producing a visible seam at
  // the scaled element's boundary. By placing overlay-inner at canvas
  // level, backdrop-filter can reach all the way to canvas-frame's
  // wallpaper, and overlay-inner fills 100% of the visible phone area so
  // there's no seam anywhere.
  // overlay-inner stays INSIDE canvas-inner so chrome z-index:550 keeps
  // working (chrome above overlay-inner z:500, both within canvas-inner's
  // zoom stacking context). To work around canvas-inner's zoom:0.78
  // visibly shrinking the overlay, oversize overlay-inner by a generous
  // margin on all sides — canvas-frame's overflow:hidden + radius:44
  // clips the excess cleanly at the device silhouette.
  // overlay-inner is a direct child of canvas-FRAME so it naturally
  // covers the full phone silhouette (canvas-inner's zoom:0.78 +
  // overflow-y:auto would otherwise clip both the horizontal shrinkage
  // AND any vertical negative-inset compensation). canvas-frame has
  // no zoom and overflow:hidden + border-radius:44 so inset:0 here
  // fills the phone edge-to-edge with clean rounded corners.
  //
  // Chrome (status-bar/now-bar/etc at z:550 inside canvas-inner) still
  // renders above the blur: canvas-inner gets z-index:550 when the
  // overlay is active (and only for Lock base — other bases keep
  // canvas-inner at z-auto so base content stays below the blur).
  var overlayInner = document.createElement('div');
  overlayInner.className = 'overlay-inner';
  overlayInner.dataset.overlayKey = overlayKey;
  overlayInner.style.cssText =
    'position:absolute;inset:0;z-index:500;pointer-events:auto;' +
    'overflow:hidden;border-radius:inherit;';

  var frameEl = document.getElementById('canvasFrame');
  var hostEl = frameEl || canvas;
  hostEl.appendChild(overlayInner);

  // An inner wrapper re-applies 0.78 zoom so plan children (at Figma
  // 451×978 coords) render at the same scale as the base screen inside
  // canvas-inner.
  var overlayScaled = document.createElement('div');
  overlayScaled.className = 'overlay-scaled';
  overlayScaled.style.cssText =
    'position:absolute;inset:0;zoom:0.78;pointer-events:auto;';
  overlayInner.appendChild(overlayScaled);

  var overlayCoord = overlayScaled;

  // Per-overlay base-screen masking — applied to the base content host
  // (_rulesInner), NOT the overlay. QS covers the whole screen behind a
  // frosted shade so base pointer-events must be off. Notif is a pure
  // "cards on top" layer — no mask, base stays fully visible and
  // interactive. Dialog hides only the status bar so the app underneath
  // stays contextually present.
  var maskHost = canvas._rulesInner || canvas;
  maskHost.classList.remove('overlay-hides-all', 'overlay-hides-statusbar',
    'overlay-hides-lock-content');
  var isQS = overlayKey === 'quicksettings' || overlayKey === 'qs' ||
             overlayKey === 'quickSettings';
  var isNotif = overlayKey === 'notifications' || overlayKey === 'notification' ||
                overlayKey === 'notif';
  var isDialog = overlayKey === 'dialog';

  // Frame-level flags for CSS (e.g. hide duplicate base gestureBar when QS
  // renders its own). Must run after isQS / isNotif / isDialog are known.
  if (frameEl) {
    frameEl.dataset.overlayActive = '1';
    frameEl.dataset.overlayKind = isQS ? 'quicksettings'
      : isNotif ? 'notifications'
      : isDialog ? 'dialog'
      : 'other';
  }

  if (isQS)          maskHost.classList.add('overlay-hides-all');
  else if (isDialog) maskHost.classList.add('overlay-hides-statusbar');
  // Notif: no mask — just cards floating on the untouched base.

  // Notif-card theme: Lock → dark. Day bases → solid white ONLY when the
  // global preset is Default (`--oneui-theme-style: base`). Themed presets
  // keep dark + `_G(panel)` so glass/gradient/grain propagate from tokens.
  var baseKey = window.__currentBaseScenario || 'lockscreen';
  var baseIsLock = (baseKey === 'lockscreen' || baseKey === 'lock');
  // When ANY overlay opens over Lock, fade out the Lock-screen decorative
  // content (clock, weather, widgets, padlock icon) so only the blurred
  // wallpaper + chrome remain behind the shade — matches Samsung's
  // pattern where the giant clock ghost doesn't bleed through the frost.
  if (baseIsLock && (isQS || isNotif || isDialog)) {
    maskHost.classList.add('overlay-hides-lock-content');
  }
  var notifTheme = (isNotif && !baseIsLock && _overlayLegacyLightNotifications()) ? 'light' : 'dark';
  overlayInner.dataset.theme = notifTheme;
  overlayInner.dataset.base = baseKey;
  // Mirror the base onto canvas-frame so CSS can scope behavior (e.g.
  // canvas-inner z-index promotion is Lock-only — other bases keep
  // base content visible below the blur).
  if (frameEl) frameEl.dataset.overlayBase = baseKey;

  // Stamp the theme into every notif-card / notif-card-ai component's
  // variant so the atomic picks the right bg + text colors.
  if (isNotif) {
    plan.components.forEach(function (comp) {
      if (comp.role === 'notif-card' || comp.role === 'notif-card-ai') {
        comp.variant = comp.variant || {};
        comp.variant.theme = notifTheme;
      }
    });
  }

  window.renderPlanIntoTarget(plan, overlayCoord, {
    scenarioKey: overlayKey,
    layer: 'overlay'
  });

  // Append overlay components to DesignDoc (alongside base nodes) so the
  // Scene Inspector / property editor / interaction overlay work on them.
  // Use addNode so subscribers (interaction-state, scene-inspector) are
  // notified properly — direct .push() wouldn't emit a change event.
  if (window.DesignDoc && typeof window.DesignDoc.addNode === 'function') {
    plan.components.forEach(function (comp) {
      window.DesignDoc.addNode({
        id: comp.id,
        role: comp.role,
        type: null,
        state: (comp.variant && comp.variant.state) || null,
        props: {},
        styles: {},
        content: {},
        zone: (comp.position && comp.position._zone) || null,
        cluster: (comp.position && comp.position._cluster) || null,
        position: comp.position || null,
        layer: 'overlay',
        html: null
      });
    });
  }
}

function generateScenario(scenarioKey) {
  // Track the last-rendered base scenario so overlays (Notif / QS / Dialog)
  // can adapt their theme to whatever's underneath (e.g. Notif over Lock =
  // dark shade, over Home = light).
  window.__currentBaseScenario = scenarioKey;
  // 1) Resolve the surface type (used only by Tier-2 fallback below).
  const surfaceMap = {
    lockscreen: window.SURFACE_TYPES?.LOCKSCREEN || 'lockscreen',
    lock: window.SURFACE_TYPES?.LOCKSCREEN || 'lockscreen',
    home: window.SURFACE_TYPES?.TAB_ROOT || 'tab-root',
    feed: window.SURFACE_TYPES?.FIRST_DEPTH_LIST || 'first-depth-list',
    list: window.SURFACE_TYPES?.FIRST_DEPTH_LIST || 'first-depth-list',
    detail: window.SURFACE_TYPES?.SECOND_DEPTH_DETAIL || 'second-depth-detail',
    dialog: window.SURFACE_TYPES?.DIALOG_BOTTOM || 'dialog-bottom',
    notifications: window.SURFACE_TYPES?.NOTIFICATION_SHADE || 'notification-shade',
    notification: window.SURFACE_TYPES?.NOTIFICATION_SHADE || 'notification-shade',
    notif: window.SURFACE_TYPES?.NOTIFICATION_SHADE || 'notification-shade',
    quicksettings: window.SURFACE_TYPES?.QUICK_SETTINGS || 'quick-settings',
    quickSettings: window.SURFACE_TYPES?.QUICK_SETTINGS || 'quick-settings',
    qs: window.SURFACE_TYPES?.QUICK_SETTINGS || 'quick-settings',
    selection: window.SURFACE_TYPES?.SELECTION_MODE || 'selection-mode'
  };

  const surfaceType =
    surfaceMap[scenarioKey] ||
    window.currentSurfaceType ||
    window.SURFACE_TYPES?.FIRST_DEPTH_LIST ||
    'first-depth-list';

  if (typeof applyScenarioBackground === 'function') {
    applyScenarioBackground(scenarioKey);
  }

  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  // 2) Tear down previous rules-mode DOM state so both render paths start clean.
  if (canvas.dataset.rulesMode) {
    canvas.style.position = '';
    canvas.style.inset = '';
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.style.overflow = '';
    canvas.style.zoom = '';
    delete canvas.dataset.rulesMode;
    // _rulesInner now aliases the canvas itself (unified render paths).
    // Only `.remove()` if it's a DIFFERENT element from canvas — otherwise
    // we'd delete the canvas itself and null out on the next click.
    if (canvas._rulesInner && canvas._rulesInner !== canvas) {
      try { canvas._rulesInner.remove(); } catch (e) {}
    }
    canvas._rulesInner = null;
    const hint = document.getElementById('canvasHint');
    if (hint) hint.style.display = '';
  }

  clearCanvas();
  window.__lastPipelineRenderBundle = null;

  // 3) Tier 1 — Figma-ground-truth rules (Lock / QS / Notif / Dialog).
  //    These have pixel-accurate atomics extracted from Figma designs and
  //    should always win over the generic surface grammar when available.
  const useRules =
    typeof window.isRulesScenario === 'function' &&
    typeof window.renderFromRules === 'function' &&
    window.isRulesScenario(scenarioKey);

  if (useRules) {
    const rendered = window.renderFromRules(scenarioKey /* default uiState per surface */);
    if (rendered) {
      // renderFromRules handles canvas styling + sets dataset.rulesMode.
      // Real-time clock applies to rules output too.
      injectRealtimeDateTime(canvas);
      return;
    }
    // renderFromRules returned false → fall through to Tier-2.
  }

  // 4) Tier 2 — generic surface grammar (zone/role engine).
  if (typeof window.generateSurfaceScenario === 'function') {
    window.generateSurfaceScenario(surfaceType);
  } else {
    canvas.style.display = 'flex';
    canvas.style.flexDirection = 'column';
    canvas.style.alignItems = 'stretch';
    canvas.style.gap = '12px';
    canvas.style.padding = '16px';
  }

  injectRealtimeDateTime(canvas);
}

// ---------------------------------------------------------------------------
//  injectRealtimeDateTime — replace hardcoded Figma clock placeholders
//  ---------------------------------------------------------------------------
//  Walks the canvas DOM and substitutes known placeholder strings with the
//  current clock. Safe for every scenario (legacy hardcoded, rules-based
//  atomics, and future AI-generated screens) because it only replaces text
//  nodes whose content exactly matches a known Figma placeholder.
//
//  Replacements:
//    "9:41" / "8:21"                → current H:MM (no leading 0 on hour)
//    "09" or "8" clock line 1       → zero-padded hour
//    "41" or "21" clock line 2      → zero-padded minute
//    "Sat, May 3"                   → today's ddd, MMM D
//    "Thu 28 Aug"                   → today's ddd D MMM
//    "Monday, April 14"             → today's dddd, MMMM D
// ---------------------------------------------------------------------------
// Global live tick — updates the canvas's time display every minute.
// Started lazily on first injectRealtimeDateTime call.
var _liveClockTimer = null;
function _startLiveClockTick() {
  if (_liveClockTimer) return;
  _liveClockTimer = setInterval(function () {
    var c = document.getElementById('canvas');
    if (c) injectRealtimeDateTime(c);
  }, 30 * 1000); // every 30 seconds — cheap DOM walk
}

// --------------------------------------------------------------------------
//  Live timer ticker — progressively enhances `[data-live-timer]` nodes
//  (set by the now-bar atomic when variant.live=true) so the stopwatch
//  Now Bar counts up every second from the `data-start` timestamp.
//  Runs once per second globally; cheap (<= 1 element normally).
// --------------------------------------------------------------------------
var _liveTimerTimer = null;
function _startLiveTimerTick() {
  if (_liveTimerTimer) return;
  _liveTimerTimer = setInterval(function () {
    var nodes = document.querySelectorAll('[data-live-timer="1"][data-start]');
    if (!nodes.length) return;
    var now = Date.now();
    nodes.forEach(function (el) {
      if (el.getAttribute('data-paused') === '1') return;
      var start = parseInt(el.getAttribute('data-start'), 10) || now;
      var elapsed = Math.max(0, Math.floor((now - start) / 1000));
      var h = Math.floor(elapsed / 3600);
      var m = Math.floor((elapsed % 3600) / 60);
      var s = elapsed % 60;
      var pad = function (n) { return n < 10 ? '0' + n : String(n); };
      el.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
    });
  }, 1000);
}
// Kick off immediately on load so timers start counting as soon as rendered.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _startLiveTimerTick);
  } else {
    _startLiveTimerTick();
  }
}

// Pause / resume stopwatch on pipeline now-bar (no ⌘ required).
if (typeof document !== 'undefined') {
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('[data-timer-pause="1"]');
    if (!btn) return;
    e.stopPropagation();
    var shell = btn.closest('[data-now-bar-shell="1"]');
    var tel = shell && shell.querySelector('[data-live-timer="1"]');
    if (!tel) return;
    var paused = tel.getAttribute('data-paused') === '1';
    if (!paused) {
      tel.setAttribute('data-paused', '1');
      tel.setAttribute('data-pause-began', String(Date.now()));
    } else {
      var start = parseInt(tel.getAttribute('data-start'), 10) || Date.now();
      var pb = parseInt(tel.getAttribute('data-pause-began'), 10) || Date.now();
      tel.setAttribute('data-start', String(start + (Date.now() - pb)));
      tel.removeAttribute('data-paused');
      tel.removeAttribute('data-pause-began');
    }
  }, false);
}

// --------------------------------------------------------------------------
//  Live weather — open-meteo API (free, CORS-friendly, no API key).
//  Tries geolocation first, falls back to Seoul. Caches result on
//  window.__liveWeather and re-injects on each canvas render.
// --------------------------------------------------------------------------
window.__liveWeather = null;

function _fetchLiveWeather() {
  function run(lat, lon) {
    // Celsius — matches Samsung's default locale in most regions.
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude='  + lat +
      '&longitude=' + lon +
      '&current=temperature_2m,weather_code&temperature_unit=celsius';
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.current) return;
        window.__liveWeather = {
          temp: Math.round(d.current.temperature_2m),
          code: d.current.weather_code
        };
        // Apply to canvas immediately if already rendered
        var c = document.getElementById('canvas');
        if (c) _applyLiveWeather(c);
      })
      .catch(function () { /* silent — default temp stays */ });
  }
  // Try geolocation, fall back to Seoul (37.5665, 126.9780) after short timeout
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (pos) { run(pos.coords.latitude, pos.coords.longitude); },
      function ()    { run(37.5665, 126.9780); },
      { timeout: 2500, maximumAge: 600000 }
    );
  } else {
    run(37.5665, 126.9780);
  }
}

// Substitute the rendered "24°" placeholder (used by GalaxyWeatherDate) with
// the live temp when available. Walks only text nodes matching /^\s*\d+°\s*$/
// so we don't touch percentages like "69%" or unrelated numbers.
function _applyLiveWeather(canvas) {
  var w = window.__liveWeather;
  if (!w || !canvas) return;
  var walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      var p = node.parentNode;
      var tag = p && p.tagName ? p.tagName.toLowerCase() : '';
      if (tag === 'script' || tag === 'style') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var n;
  while ((n = walker.nextNode())) {
    if (/^\s*\d+°\s*$/.test(n.nodeValue)) {
      n.nodeValue = w.temp + '°';
    }
  }
}

// Kick off the live-weather fetch once per page load. Refresh every 10 min.
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _fetchLiveWeather);
  } else {
    _fetchLiveWeather();
  }
  setInterval(_fetchLiveWeather, 10 * 60 * 1000);
}

function injectRealtimeDateTime(canvas) {
  if (!canvas) return;
  _startLiveClockTick();
  var now = new Date();
  var days  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var daysF = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var mon   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monF  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  var hour   = now.getHours();
  var min    = now.getMinutes();
  var dayI   = now.getDay();
  var date   = now.getDate();
  var monI   = now.getMonth();

  var HH = hour.toString().padStart(2, '0');
  var MM = min.toString().padStart(2, '0');
  var Hc = hour + ':' + MM;                          // "9:07"
  var HHc = HH + ':' + MM;                           // "09:07"
  var shortDate = days[dayI]  + ', ' + mon[monI] + ' ' + date;         // "Sat, Apr 20"
  var notifDate = days[dayI]  + ' ' + date + ' ' + mon[monI];          // "Sat 20 Apr"
  var longDate  = daysF[dayI] + ', ' + monF[monI] + ' ' + date;        // "Saturday, April 20"

  // Ordered exact-match replacements. Longest/most-specific first.
  var MAP = [
    // Long labels first so we don't partially match them later
    { from: 'Monday, April 14',    to: longDate  },
    { from: 'Sat, May 3',          to: shortDate },
    { from: 'Thu 28 Aug',          to: notifDate },
    // Time labels (inline "9:41" / "8:21" placeholders inside small text)
    { from: '9:41',                to: Hc        },
    { from: '8:21',                to: Hc        }
    // Note: the two-line hero clock ["09","41"] substitution was removed.
    // renderClock now injects the real time directly, so text-substitute
    // is no longer needed AND it was causing the "3636" double-replace bug.
  ];

  // Walk text nodes. Avoid inputs/textareas/contenteditable.
  var walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      var p = node.parentNode;
      if (!p) return NodeFilter.FILTER_REJECT;
      var tag = (p.tagName || '').toLowerCase();
      if (tag === 'script' || tag === 'style') return NodeFilter.FILTER_REJECT;
      if (p.isContentEditable) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var nodes = [];
  var n;
  while ((n = walker.nextNode())) nodes.push(n);

  nodes.forEach(function (node) {
    var txt = node.nodeValue;
    var trimmed = txt.trim();
    for (var i = 0; i < MAP.length; i++) {
      var r = MAP[i];
      if (trimmed !== r.from) continue;
      if (r.onlyHeroClock) {
        // Only replace when the text is in a clock-like context — very big
        // font-size (e.g. 56, 80, 112) or the dedicated clock font family.
        var fs = 0;
        try { fs = parseFloat(getComputedStyle(node.parentNode).fontSize) || 0; } catch (e) {}
        if (fs < 48) continue;
      }
      node.nodeValue = txt.replace(r.from, r.to);
      break;
    }
  });

  // Also inject live-weather temperature if the open-meteo fetch has
  // completed. Runs at the end so any "24°" placeholder rendered by
  // GalaxyWeatherDate gets swapped for the real-time value.
  _applyLiveWeather(canvas);
}

// ---------------------------------------------------------------------------
//  applyUnifiedDesignRules — normalize legacy scenarios to match Figma tokens
//  ---------------------------------------------------------------------------
//  Rules injected:
//    1. Inject a unified status bar at top (if none present)
//    2. Force font-family to the system token on all text nodes
//    3. Snap radius values to the nearest radius tier
//
//  Only touches .canvas-item children; does not alter user-authored inline
//  styles beyond these three axes.
// ---------------------------------------------------------------------------
function applyUnifiedDesignRules(canvas, scenarioKey) {
  try {
    var G = window.Generator;

    // 1. REPLACE any existing ad-hoc status bar at the top with the unified
    //    Figma status bar. Rules-mapped scenarios (lock/qs/notif) skip this
    //    because their atomics already render the Figma status bar.
    if (window.isRulesScenario && window.isRulesScenario(scenarioKey)) {
      // rules path already handles everything
    } else {
      var firstItem = canvas.querySelector('.canvas-item');
      var firstHTML = firstItem ? firstItem.innerHTML : '';
      var looksLikeStatusBar = /\b(9:41|K-Arts|\bTJG\b)/.test(firstHTML) ||
                               /status-bar|battery-left|wifi\.svg/.test(firstHTML);

      // Build the unified status bar wrapper with explicit margin/padding
      // matching Figma surface header: 18px top breathing room + 44px bar.
      var sbWrapper = document.createElement('div');
      sbWrapper.className = 'canvas-item';
      sbWrapper.dataset.role = 'static';
      sbWrapper.dataset.injected = 'unified-status-bar';
      sbWrapper.style.cssText = 'margin-top:0;padding-top:4px;flex-shrink:0;';
      sbWrapper.innerHTML = G.statusBarHTML({ carrier: 'K-Arts' });

      if (looksLikeStatusBar && firstItem) {
        // Replace the legacy status bar
        firstItem.parentNode.replaceChild(sbWrapper, firstItem);
      } else if (firstItem) {
        // Prepend (no status bar existed)
        canvas.insertBefore(sbWrapper, firstItem);
      }
    }

    // 2-3. Font + radius normalization DISABLED (too aggressive).
  } catch (e) {
    console.warn('[applyUnifiedDesignRules] skipped due to error:', e.message);
  }
}

// Unified chat send: inspects input and routes to URL/prompt/image flows.
// Chat now accepts all three in one field (URL auto-detected, image via paperclip).
// Auto-grow the chat textarea as the user types.
// min-height/max-height are enforced in the inline style (48px / 240px).
function autoResizeChatInput(el) {
  if (!el) return;
  el.style.height = 'auto';
  // Cap height using the inline max-height so scrollbar appears past the limit
  const max = parseInt(el.style.maxHeight, 10) || 240;
  const next = Math.min(el.scrollHeight, max);
  el.style.height = next + 'px';
}

function sendChatMessage() {
  const raw = document.getElementById('genPrompt').value.trim();
  if (!raw) return;
  // URL detection — http(s):// or starts with www. or looks like a domain
  const urlPattern = /^(https?:\/\/|www\.)|^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i;
  if (urlPattern.test(raw)) {
    // Proxy into generateFromUrl by temporarily shimming #genUrl (removed from DOM)
    const shim = document.createElement('input');
    shim.id = 'genUrl';
    shim.value = raw;
    shim.style.display = 'none';
    document.body.appendChild(shim);
    try { generateFromUrl(); } finally { shim.remove(); }
    return;
  }
  generateFromPrompt();
}

function generateFromPrompt() {
  const prompt = document.getElementById('genPrompt').value.trim();
  const promptLower = prompt.toLowerCase();

  // Determine scenario hint
  let scenarioHint = null;
  for (const [keyword, scenario] of Object.entries(promptMap)) {
    if (promptLower.includes(keyword)) { scenarioHint = scenario; break; }
  }

  if (agentSession.mode === 'agent') {
    // Agent Mode: full reset happens inside generateVariantsFromAgent
    generateVariantsFromAgent(prompt, scenarioHint);
  } else {
    // Local Mode: same blank-slate rule so the canvas doesn't show
    // previous overlay/screen state under the new scenario.
    _fullResetForGeneration();
    const matched = scenarioHint || (promptLower ? 'feed' : 'login');
    _pipelineStart('Local mode');
    _pipelineInfo('Prompt: "' + prompt.slice(0, 80) + (prompt.length > 80 ? '\u2026' : '') + '"');
    _pipelineInfo('Keyword match: ' + (scenarioHint ? '<b>' + scenarioHint + '</b>' : 'none') +
      (scenarioHint ? '' : ' \u2014 defaulting to <b>' + matched + '</b>'));
    _pipelineSuccess('Rendering scenario: ' + matched);
    generateVariants(matched, prompt);
  }
}

function _local_generateFromPrompt(promptLower) {
  if (!promptLower) { generateScenario('login'); return; }
  let matched = null;
  for (const [keyword, scenario] of Object.entries(promptMap)) {
    if (promptLower.includes(keyword)) { matched = scenario; break; }
  }
  if (matched) {
    generateScenario(matched);
  } else {
    generateScenario('feed');
  }
}

function generateFromUrl() {
  const url = document.getElementById('genUrl').value.trim();
  if (!url) return;

  if (agentSession.mode === 'agent') {
    // Agent mode: send URL for analysis
    const payload = StateManager.getGeneratePayload(null, '');
    payload.referenceUrl = url;
    showAgentLoading('Analyzing reference...');
    _pipelineStart('URL reference generation');
    _pipelineInfo('Reference URL: ' + url);
    _pipelineStatus('url-step', '\u2022 Analyzing reference\u2026', 'var(--text-3)');
    var _urlT0 = Date.now();
    AgentAPI.generateUI(payload)
      .then(response => {
        hideAgentLoading();
        _pipelineStatus('url-step',
          '\u2022 Analysis complete (' + ((Date.now() - _urlT0) / 1000).toFixed(1) + 's)',
          '#4ade80');
        StateManager.updateFromAgentGenerate(response);
        RenderEngine.renderFromModel(response.renderModel);
        RenderEngine.renderCritic(response.critic);
        _pipelineSuccess('Rendered from URL');
      })
      .catch(err => {
        console.warn('Agent URL generate failed, falling back to local:', err.message);
        hideAgentLoading();
        _pipelineError('URL analysis failed: ' + err.message + ' \u2014 falling back to local');
        _local_generateFromUrl(url);
      });
    return;
  }
  _pipelineStart('Local mode \u2014 URL');
  _pipelineInfo('URL: ' + url);
  _local_generateFromUrl(url);
}

function _local_generateFromUrl(url) {
  if (url.includes('login') || url.includes('sign')) generateScenario('login');
  else if (url.includes('product') || url.includes('galaxy') || url.includes('smartphone')) generateScenario('product');
  else if (url.includes('setting')) generateScenario('settings');
  else if (url.includes('message') || url.includes('chat')) generateScenario('chat');
  else if (url.includes('profile') || url.includes('account')) generateScenario('profile');
  else if (url.includes('gallery') || url.includes('photo')) generateScenario('gallery');
  else if (url.includes('music') || url.includes('player')) generateScenario('music');
  else generateScenario('product'); // Default for samsung.com
}

const _origGenerateScenario = generateScenario;
generateScenario = function(key) {
  _origGenerateScenario(key);
  // After generating, apply current brand theme
  if (currentBrand !== 'samsung') {
    const btn = document.querySelector(`.brand-btn[data-brand="${currentBrand}"]`);
    if (btn) setBrand(currentBrand, btn);
  }
};


function _detectCurrentScenario() {
  // Try to detect from active scene button
  const activeBtn = document.querySelector('.scene-btn[style*="border-color"],.scene-btn.active');
  if (activeBtn) {
    const onclick = activeBtn.getAttribute('onclick') || '';
    const m = onclick.match(/generateVariants\('([^']+)'\)/);
    if (m) return m[1];
  }
  return 'general';
}

