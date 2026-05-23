// ============================================================================
//  app/agent.js — external agent API + render/state adapters
//  ---------------------------------------------------------------------------
//  AgentAPI.health/generateUI/refineUI/runCritic, StateManager, RenderEngine,
//  agent mode toggle, loading overlay.
// ============================================================================

// =============================================
// === AGENT INTEGRATION LAYER ===
// =============================================

// --- Session & Mode ---
let agentSession = {
  id: null,
  mode: 'local',        // 'local' | 'agent'
  endpoint: '',          // auto-detected from current origin
  lastLayoutTree: null,
  lastRenderModel: null,
  lastCritic: null,
  history: []
};

function setAgentMode(mode) {
  agentSession.mode = mode;
  const indicator = document.getElementById('agentModeIndicator');
  if (indicator) {
    indicator.textContent = mode === 'agent' ? 'AI' : 'Local';
    indicator.className = 'agent-mode-indicator ' + (mode === 'agent' ? 'connected' : 'local');
    indicator.title = mode === 'agent'
      ? 'AI mode \u2014 chat prompts call the OpenAI pipeline. Click to switch to Local (keyword matching).'
      : 'Local mode \u2014 chat prompts match pre-built scenarios via keywords. Click to switch to AI (OpenAI pipeline).';
  }
}

// --- API Adapter (calls Node.js proxy → OpenAI) ---
// ────────────────────────────────────────────────────────────────────────────
// LRU prompt cache — skip server roundtrip for identical (prompt + surfaceType
// + mode) requests within 60s. Size-bounded to 10 entries.
// ────────────────────────────────────────────────────────────────────────────
const _promptCache = {
  max: 10,
  ttl: 60 * 1000,   // 60 seconds
  map: new Map(),
  _key(p) {
    return ((p && p.prompt) || '').slice(0, 200) + '|' +
           ((p && p.surfaceType) || '') + '|' +
           ((p && p.mode) || 'dark') + '|' +
           ((p && p.scenario) || '');
  },
  get(payload) {
    var k = this._key(payload);
    var entry = this.map.get(k);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttl) { this.map.delete(k); return null; }
    // LRU bump — re-insert so it's at the tail of iteration order
    this.map.delete(k);
    this.map.set(k, entry);
    return entry.value;
  },
  set(payload, value) {
    var k = this._key(payload);
    this.map.set(k, { value: value, ts: Date.now() });
    while (this.map.size > this.max) {
      var oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
  },
  clear() { this.map.clear(); }
};

const AgentAPI = {
  _getBase() {
    // Same origin when the UI is served by this Node app (default 3000, or PORT in .env).
    // If you open HTML from another static server, API calls go to the default Node URL below.
    if (agentSession.endpoint) return agentSession.endpoint;
    const port = location.port;
    var sameOriginPorts = { '3000': 1, '3001': 1 }; // 3001 = legacy default if you still use PORT=3001
    if (sameOriginPorts[port]) return '';
    return 'http://127.0.0.1:3000';
  },

  async _post(path, payload) {
    const base = this._getBase();
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API error: ${res.status}`);
    }
    return res.json();
  },

  async generateUI(payload) {
    // Prompt cache — return instantly for repeat (prompt+surfaceType+mode)
    const cached = _promptCache.get(payload);
    if (cached) {
      // Flag cached responses so callers can update UI state properly
      return Object.assign({}, cached, { __cached: true });
    }
    const res = await this._post('/api/agent/generate', payload);
    if (res && res.renderModel) _promptCache.set(payload, res);
    return res;
  },

  // Streaming generate. Subscribes to SSE events emitted by the server:
  //   onClassified({ surfaceType, intent, hierarchy })  — ~300ms in
  //   onComponent(component)                            — progressive
  //   onDone(response)                                  — final sanitized
  //   onError({ message })
  // Resolves with the final response (same shape as generateUI).
  async generateUIStream(payload, handlers) {
    handlers = handlers || {};
    // Cache hit — short-circuit with synthetic events
    const cached = _promptCache.get(payload);
    if (cached) {
      const lt = cached.layoutTree || {};
      if (handlers.onClassified) handlers.onClassified({
        surfaceType: cached.renderModel && cached.renderModel.surfaceType,
        intent: lt.intent,
        hierarchy: lt.hierarchy,
        // Preserve the full decision packet across cached replays so
        // the pipelineOutput blocks (classification / interpretation /
        // statePacket / informationPriority) render identically on
        // repeat generations.
        orchestration:        lt.orchestration        || null,
        interpretation:       lt.interpretation       || null,
        statePacket:          lt.statePacket          || null,
        informationPriority:  lt.informationPriority  || null
      });
      const res = Object.assign({}, cached, { __cached: true });
      if (handlers.onDone) handlers.onDone(res);
      return res;
    }

    const base = this._getBase();
    const response = await fetch(base + '/api/agent/generate/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Stream error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResponse = null;
    let streamError = null;

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      // Split SSE frames on blank line (\n\n)
      let frames = buffer.split('\n\n');
      buffer = frames.pop() || '';  // last may be incomplete

      for (const frame of frames) {
        if (!frame.trim()) continue;
        let event = 'message';
        let dataStr = '';
        const lines = frame.split('\n');
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        }
        if (!dataStr) continue;
        let data;
        try { data = JSON.parse(dataStr); } catch (e) { continue; }

        switch (event) {
          case 'classified':
            if (handlers.onClassified) handlers.onClassified(data);
            break;
          case 'component':
            if (handlers.onComponent) handlers.onComponent(data);
            break;
          case 'done':
            finalResponse = data;
            if (handlers.onDone) handlers.onDone(data);
            break;
          case 'error':
            streamError = data;
            if (handlers.onError) handlers.onError(data);
            break;
        }
      }
    }

    if (streamError) throw new Error(streamError.message || 'Stream error');
    if (!finalResponse) throw new Error('Stream ended without final response');
    if (finalResponse.renderModel) _promptCache.set(payload, finalResponse);
    return finalResponse;
  },

  // R4: Flow Graph streaming generate. Subscribes to SSE events emitted by
  // /api/agent/generate/flow/stream:
  //   onClassified({ …classification, flowPlan: { nodes, edges } })
  //   onNodeDone({ nodeId, nodeKind, nodeIntent, nodeIndex, renderModel, … })  ×N
  //   onFlowDone({ sessionId, nodes:[…], edges:[…], totalElapsedMs })
  //   onError({ message })
  //
  // Resolves with the final flow_done payload.
  //
  // NOTE: this bypasses _promptCache on purpose — flow graphs are
  // higher-order and we don't yet fingerprint them correctly. The single-
  // screen path remains cached unchanged.
  async generateFlowStream(payload, handlers) {
    handlers = handlers || {};
    const base = this._getBase();
    const response = await fetch(base + '/api/agent/generate/flow/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Flow stream error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalFlow = null;
    let streamError = null;

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      let frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      for (const frame of frames) {
        if (!frame.trim()) continue;
        let event = 'message';
        let dataStr = '';
        const lines = frame.split('\n');
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        }
        if (!dataStr) continue;
        let data;
        try { data = JSON.parse(dataStr); } catch (e) { continue; }

        switch (event) {
          case 'classified':
            if (handlers.onClassified) handlers.onClassified(data);
            break;
          case 'node_done':
            if (handlers.onNodeDone) handlers.onNodeDone(data);
            break;
          case 'flow_done':
            finalFlow = data;
            if (handlers.onFlowDone) handlers.onFlowDone(data);
            break;
          case 'error':
            streamError = data;
            if (handlers.onError) handlers.onError(data);
            break;
        }
      }
    }

    if (streamError) throw new Error(streamError.message || 'Flow stream error');
    if (!finalFlow) throw new Error('Flow stream ended without flow_done');
    return finalFlow;
  },

  async refineUI(payload) {
    return this._post('/api/agent/refine', payload);
  },

  async runCritic(payload) {
    return this._post('/api/agent/critic', payload);
  },

  async health() {
    const base = this._getBase();
    const res = await fetch(base + '/api/agent/health');
    if (!res.ok) throw new Error('Not available');
    return res.json();
  }
};

// --- State Manager: bridges agent response → UI ---
const StateManager = {
  currentLayout: null,
  currentRender: null,

  updateFromAgentGenerate(response) {
    // response: { sessionId, layoutTree, renderModel, critic }
    agentSession.id = response.sessionId;
    agentSession.lastLayoutTree = response.layoutTree;
    agentSession.lastRenderModel = response.renderModel;
    agentSession.lastCritic = response.critic;
    this.currentLayout = response.layoutTree;
    this.currentRender = response.renderModel;
    agentSession.history.push({ type: 'generate', timestamp: Date.now(), sessionId: response.sessionId });
  },

  updateFromAgentRefine(response) {
    // response: { parsedIssue, patchPlan, updatedLayoutTree, updatedRenderModel, critic }
    agentSession.lastLayoutTree = response.updatedLayoutTree;
    agentSession.lastRenderModel = response.updatedRenderModel;
    agentSession.lastCritic = response.critic;
    this.currentLayout = response.updatedLayoutTree;
    this.currentRender = response.updatedRenderModel;
    agentSession.history.push({ type: 'refine', timestamp: Date.now() });
  },

  getGeneratePayload(scenarioKey, promptText) {
    const frame = document.getElementById('canvasFrame');
    const device = document.querySelector('.device-selector-btn .dev-name')?.textContent || 'Galaxy S26';
    const mode = document.body.classList.contains('light-mode') ? 'light' : 'dark';

    const scenarioToSurface = {
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
      scenarioToSurface[scenarioKey] ||
      window.currentSurfaceType ||
      window.SURFACE_TYPES?.FIRST_DEPTH_LIST ||
      'first-depth-list';

    // NOTE: surface-grammar rules are in the server's system prompt
    // (buildGenerateSystemPrompt). We don't duplicate them here — that
    // was 2KB of wasted tokens per request. Pass the raw user prompt.
    return {
      sessionId: agentSession.id,
      scenario: scenarioKey,
      surfaceType: surfaceType,
      prompt: promptText || '',
      surface: currentBrand,
      device: device,
      mode: mode,
      constraints: {
        canvasWidth: 451,
        canvasHeight: 978,
        designSystem: currentBrand,
        wallpaper: frame?.style.background || 'none',
        useSurfaceGrammar: true,
        requireAbsoluteSlotLayout: true,
        safeMarginDp: 24,
        appBarSnapStates: ['expanded', 'collapsed']
      },
      referenceImage: window._refImageData || null
    };
  },

  getRefinePayload(feedback, tags, snapshot) {
    const selectedNodeIds = Array.from(selectedItems);
    return {
      sessionId: agentSession.id,
      currentLayout: agentSession.lastLayoutTree,
      currentRenderModel: agentSession.lastRenderModel,
      activeVariant: activeVariant,
      variantContext: {
        A: variants.A.generated ? { prompt: variants.A.prompt, scenario: variants.A.scenario, critic: variants.A.critic } : null,
        B: variants.B.generated ? { prompt: variants.B.prompt, scenario: variants.B.scenario, critic: variants.B.critic } : null
      },
      feedback: feedback,
      issueTags: Array.from(tags),
      selectedNodes: selectedNodeIds,
      snapshot: {
        items: snapshot.items.map(it => ({
          id: it.id,
          styles: it.styles,
          textContent: it.textContent,
          rect: { width: it.rect.width, height: it.rect.height, top: it.rect.top, left: it.rect.left }
        })),
        canvasStyle: snapshot.canvasStyle
      }
    };
  }
};

// Infer the surface-grammar zone for an agent-supplied component role
// when the agent didn't set an explicit zone. Used by renderFromModel
// to slot AI-picked atomics (now-bar, media-card, focus-block, etc.)
// into the right region of the canned surface plan — otherwise they
// fall through the role-merge filter and never render.
function _inferZoneForAgentRole(role) {
  if (!role) return 'interaction';
  if (role === 'status-bar') return 'topSystem';
  if (role === 'expandable-app-bar' || role === 'collapsed-app-bar' ||
      role === 'selection-app-bar' || role === 'search-bar' ||
      role === 'list-top-bar' || role === 'lock-clock' ||
      role === 'weather-date' || role === 'lock-time' ||
      role === 'lock-date') {
    return 'viewing';
  }
  if (role === 'app-dock' || role === 'bottom-navigation' ||
      role === 'bottom-bar' || role === 'gesture-bar' ||
      role === 'gestureBar' || role === 'bottom-dialog') {
    return 'bottomNav';
  }
  if (role === 'lock-indicator' || role === 'unlock-hint' ||
      role === 'shortcut-left' || role === 'shortcut-right' ||
      role === 'lock-shortcuts') {
    return 'bottomAction';
  }
  // now-bar used to live in bottomAction so it'd sit near the gesture
  // bar. On lockscreen that collided with unlock-hint + lock-shortcuts
  // (both also in bottomAction), producing the visible "timer on top
  // of Swipe up to unlock" overlap bug. Treat now-bar as a content
  // role instead so the purpose-aware layout dispatcher positions it
  // explicitly in the interaction zone (e.g. continuity_stream hero,
  // focus_protection hero_single supporting line, etc.).
  if (role === 'now-bar') return 'interaction';
  // Content / interactive components (focus-block, list, list-item,
  // media-card, notif-card, toggle-grid, slider-panel, selection-dialog,
  // dialog-shell, etc.) all land in the interaction zone and are
  // stacked vertically within it.
  return 'interaction';
}

// ═══════════════════════════════════════════════════════════════════════
//  R3-B: PURPOSE-AWARE LAYOUT STRATEGIES
//  ---------------------------------------------------------------------
//  The four Purpose Types from the 4+2+1 framework need visibly
//  different layouts, not just different component content. These
//  helpers take the AI-produced component list + the interaction zone
//  + the informationPriority.must_show set and return enriched specs
//  with `_rect` and `_emphasis` ('hero' | 'must' | 'secondary' |
//  'dim') so renderSurfacePlan can apply the matching CSS class.
// ═══════════════════════════════════════════════════════════════════════

// Semantic concept ↔ role matching — also used by the server-side
// enforcer. Kept local here so the renderer can reason without a
// network hop. Concepts are lowercase + underscore-normalized.
function _conceptMatchesRole(concept, role) {
  if (!concept || !role) return false;
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const c = norm(concept);
  const r = norm(role);
  if (c === r || c.indexOf(r) !== -1 || r.indexOf(c) !== -1) return true;
  const aliases = {
    'now-bar':          ['playback', 'now_bar', 'current_playback_status', 'timer', 'charging'],
    'focus-block':      ['summary', 'glance_card', 'hero_card', 'insight'],
    'media-card':       ['media_card', 'full_media_controls', 'playback_detail'],
    'weather-date':     ['weather', 'weather_glance', 'date_weather'],
    'lock-clock':       ['time', 'clock', 'lockscreen_clock'],
    'toggle-grid':      ['toggles', 'quick_toggles'],
    'slider-panel':     ['brightness', 'volume', 'slider'],
    'selection-dialog': ['options_menu', 'picker', 'select_list'],
    'action-row':       ['actions', 'confirm_cancel', 'primary_actions'],
    'progress-track':   ['progress', 'elapsed_time_and_metrics', 'session_progress'],
    'notif-card':       ['notification', 'unread_message_summary'],
    'notif-card-ai':    ['ai_summary', 'ai_insight'],
    'search-bar':       ['search'],
    'list':             ['list', 'feed'],
    'list-item':        ['list_item'],
    'dialog-shell':     ['dialog', 'share_sheet', 'picker_shell'],
    'dialog-icon-grid': ['share_target_options', 'target_picker']
  };
  const list = aliases[role] || [];
  return list.some(a => norm(a) === c || norm(a).indexOf(c) !== -1 || c.indexOf(norm(a)) !== -1);
}
function _isMustShow(role, mustShowList) {
  if (!mustShowList || !mustShowList.length) return false;
  return mustShowList.some(m => _conceptMatchesRole(m, role));
}

// Content-aware default height. Longer content → taller card; short
// prompt-specific bullets → compact. Replaces the old fixed defaultH
// table so focus-blocks don't all waste 160px when one has a 4-word title.
function _contentAwareHeight(comp, role, baseline) {
  const c = comp.content || {};
  const textSrc = [comp.text, c.title, c.sub, c.subtitle, c.body, c.value]
    .filter(Boolean).join(' ');
  const len = textSrc.length;
  let h = baseline;
  if (role === 'focus-block' || role === 'notif-card' || role === 'notif-card-ai' || role === 'list-item') {
    if (len < 30)  h = Math.max(72,  baseline - 60);
    else if (len < 80)  h = baseline - 20;
    else if (len > 140) h = baseline + 40;
  }
  return h;
}

// Default baseline heights per role (pre content-aware adjustment).
const _LAYOUT_BASELINE_H = {
  'focus-block':       140,
  'focus-block-group': 240,
  'now-bar':           72,
  'media-card':        180,
  'media-half':        144,
  'notif-card':        88,
  'notif-card-ai':     88,
  'list':              200,
  'list-item':         72,
  'paragraph':         48,
  'action-row':        52,
  'toggle-chip':       56,
  'toggle-grid':       180,
  'slider-pill':       56,
  'slider-panel':      240,
  'single-toggle':     88,
  'smart-things':      88,
  'selection-dialog':  360,
  'dialog-shell':      240,
  'dialog-site-header':72,
  'dialog-browser-bar':92,
  'dialog-icon-grid':  210,
  'weather-date':      96,
  'lock-clock':        160,
  'progress-track':    44
};
function _hFor(role, comp) {
  const base = _LAYOUT_BASELINE_H[role] || 120;
  return _contentAwareHeight(comp, role, base);
}

// Attach _rect + _emphasis to a component spec.
// Atomic roles that have a CANONICAL fixed size (pulled from the Figma
// Lock/Notif/QS reference frames). When the dispatcher tries to place
// one of these in a wider layout zone, we re-size to the canonical
// dimensions and CENTER horizontally — otherwise the now-bar, etc.,
// gets stretched to the full interaction-zone width (415px) leaving
// ugly empty margins inside the 247-wide pill. Entries are matched
// by role AND (optionally) by variant.type, because e.g. now-bar's
// media/timer/charging variants all share the same 247×64 hull.
const CANONICAL_ROLE_SIZES = {
  // now-bar pill: 247×64, aligned to canonical Figma (752:7978 / 7988 / 7994).
  'now-bar':        { w: 247, h: 64 },
  // Lock screen shortcut circles: exact 47×47.
  'shortcutLeft':   { w: 47,  h: 47 },
  'shortcutRight':  { w: 47,  h: 47 },
  // Canonical lock atomics (in case the dispatcher tries to place them).
  'lockIndicator':  { w: 24,  h: 24 },
  'weatherDate':    { w: 192, h: 20 },
  'clock':          { w: 192, h: 176 },
  'gestureBar':     { w: 451, h: 24 }
};

function _place(comp, rect, emphasis) {
  // Apply canonical size override if this role has one. We preserve the
  // rect's vertical anchor (y) so the dispatcher's stacking order is
  // respected, but constrain width/height to the canonical Figma size
  // and re-center horizontally within the original rect. Components
  // without a canonical size fill the rect as before.
  const canonical = CANONICAL_ROLE_SIZES[comp.role];
  let finalRect = rect;
  if (canonical && rect && rect.w > canonical.w) {
    finalRect = {
      x: rect.x + Math.round((rect.w - canonical.w) / 2),
      y: rect.y,
      w: canonical.w,
      h: Math.min(rect.h, canonical.h)
    };
  }
  return Object.assign({}, comp, {
    _rect: finalRect,
    _emphasis: emphasis || null
  });
}

// ---------------------------------------------------------------------
//  Strategy 1: HERO_SINGLE  (focus_protection)
//  One dominant component (the first must_show), calm whitespace,
//  supporting items dimmed below. Earlier revision pushed the hero
//  22% down the interaction zone — on a tall interaction zone that
//  left ~2/3 of the phone looking empty. Now the hero starts near
//  the top and supporting items sit tight under it so the vertical
//  column reads as intentionally minimal, not broken.
// ---------------------------------------------------------------------
function _layoutHeroSingle(aiComponents, z, mustShow) {
  const placed = [];
  if (!aiComponents.length) return placed;

  // Pick hero = first must_show match, else first non-chrome component.
  let heroIdx = aiComponents.findIndex(c => _isMustShow(c.role, mustShow));
  if (heroIdx < 0) heroIdx = 0;
  const hero = aiComponents[heroIdx];
  const rest = aiComponents.filter((_, i) => i !== heroIdx);

  // Hero near top of interaction zone, full width.
  const heroH = Math.min(220, Math.max(140, _hFor(hero.role, hero) + 20));
  const heroY = z.y;
  placed.push(_place(hero, { x: z.x, y: heroY, w: z.w, h: heroH }, 'hero'));

  // Supporting: up to 3 items, tighter spacing so the column feels
  // purposefully sparse without leaving a gaping void below.
  const maxSecondary = 3;
  const sidePad = 24;
  const secondaryW = z.w - sidePad * 2;
  let y = heroY + heroH + 14;
  for (let i = 0; i < Math.min(rest.length, maxSecondary); i++) {
    const c = rest[i];
    const h = Math.min(88, _hFor(c.role, c));
    if (y + h > z.y + z.h - 12) break;
    const emphasis = _isMustShow(c.role, mustShow) ? 'must' : 'dim';
    placed.push(_place(c, { x: z.x + sidePad, y: y, w: secondaryW, h: h }, emphasis));
    y += h + 8;
  }
  return placed;
}

// ---------------------------------------------------------------------
//  Strategy 2: SUMMARY_GRID  (context_reconstruction)
//  Top row: consolidated hero (greeting/time/weather). Below: 2-column
//  grid of information tiles. Optional wide card at bottom.
// ---------------------------------------------------------------------
function _layoutSummaryGrid(aiComponents, z, mustShow) {
  const placed = [];
  if (!aiComponents.length) return placed;

  const head = aiComponents[0];
  const rest = aiComponents.slice(1);

  // Head: full-width, moderate height
  const headH = _hFor(head.role, head);
  placed.push(_place(head,
    { x: z.x, y: z.y, w: z.w, h: headH },
    _isMustShow(head.role, mustShow) ? 'must' : 'hero'));

  // 2-column grid for the rest
  const colGap = 10;
  const rowGap = 10;
  const colW = Math.floor((z.w - colGap) / 2);
  const tileH = 108;
  let x = z.x;
  let y = z.y + headH + 14;
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    const col = i % 2;
    if (col === 0 && i > 0) { y += tileH + rowGap; x = z.x; }
    if (col === 1) x = z.x + colW + colGap;
    if (y + tileH > z.y + z.h - 8) break;
    const emph = _isMustShow(c.role, mustShow) ? 'must' : 'normal';
    placed.push(_place(c, { x: x, y: y, w: colW, h: tileH }, emph));
  }
  return placed;
}

// ---------------------------------------------------------------------
//  Strategy 3: CONTINUITY_STREAM  (flow_continuity)
//  Progress indicator hero (now-bar / progress-track) near top, session
//  state below, handoff / action-row pinned at bottom.
// ---------------------------------------------------------------------
function _layoutContinuityStream(aiComponents, z, mustShow) {
  const placed = [];
  if (!aiComponents.length) return placed;

  // Find the continuity hero (now-bar > progress-track > media-card > first).
  const heroCandidates = ['now-bar', 'progress-track', 'media-card'];
  let heroIdx = -1;
  for (const rc of heroCandidates) {
    heroIdx = aiComponents.findIndex(c => c.role === rc);
    if (heroIdx >= 0) break;
  }
  if (heroIdx < 0) heroIdx = 0;
  const hero = aiComponents[heroIdx];

  // Find action-row / handoff affordance for the bottom.
  const actionIdx = aiComponents.findIndex((c, i) =>
    i !== heroIdx && (c.role === 'action-row' || c.role === 'bottom-bar'));
  const actionComp = actionIdx >= 0 ? aiComponents[actionIdx] : null;

  // Middle items = everything else.
  const middle = aiComponents.filter((_, i) => i !== heroIdx && i !== actionIdx);

  // Hero at top — prominent but not oversized.
  const heroH = Math.max(80, _hFor(hero.role, hero));
  placed.push(_place(hero,
    { x: z.x, y: z.y, w: z.w, h: heroH }, 'hero'));

  // Middle stack — tighter spacing for continuity rhythm.
  let y = z.y + heroH + 14;
  const bottomReserve = actionComp ? 64 : 0;
  for (let i = 0; i < middle.length; i++) {
    const c = middle[i];
    const h = _hFor(c.role, c);
    if (y + h > z.y + z.h - bottomReserve - 8) break;
    const emph = _isMustShow(c.role, mustShow) ? 'must' : 'normal';
    placed.push(_place(c, { x: z.x, y: y, w: z.w, h: h }, emph));
    y += h + 10;
  }

  // Action-row pinned to bottom of interaction zone.
  if (actionComp) {
    placed.push(_place(actionComp,
      { x: z.x, y: z.y + z.h - 56, w: z.w, h: 48 }, 'action'));
  }
  return placed;
}

// ---------------------------------------------------------------------
//  Strategy 4: MODAL_STACK  (multi_party_coordination)
//  Centered dialog / selection-dialog dominates, options visible,
//  action-row anchored at bottom.
// ---------------------------------------------------------------------
function _layoutModalStack(aiComponents, z, mustShow) {
  const placed = [];
  if (!aiComponents.length) return placed;

  // Dialog-ish hero: selection-dialog > dialog-shell > first must_show.
  const preferred = ['selection-dialog', 'dialog-shell', 'dialog-icon-grid'];
  let heroIdx = -1;
  for (const p of preferred) {
    heroIdx = aiComponents.findIndex(c => c.role === p);
    if (heroIdx >= 0) break;
  }
  if (heroIdx < 0) {
    heroIdx = aiComponents.findIndex(c => _isMustShow(c.role, mustShow));
    if (heroIdx < 0) heroIdx = 0;
  }
  const hero = aiComponents[heroIdx];

  const actionIdx = aiComponents.findIndex((c, i) =>
    i !== heroIdx && c.role === 'action-row');
  const actionComp = actionIdx >= 0 ? aiComponents[actionIdx] : null;

  const rest = aiComponents.filter((_, i) => i !== heroIdx && i !== actionIdx);

  // Hero dialog — vertically centered, slightly lifted.
  const heroH = Math.min(Math.max(_hFor(hero.role, hero) + 40, 240), z.h - 100);
  const heroY = z.y + Math.max(40, Math.floor((z.h - heroH) / 2) - 30);
  placed.push(_place(hero,
    { x: z.x, y: heroY, w: z.w, h: heroH }, 'hero'));

  // Context rows above the dialog.
  let yAbove = heroY - 10;
  for (let i = rest.length - 1; i >= 0; i--) {
    const c = rest[i];
    const h = Math.min(_hFor(c.role, c), 64);
    if (yAbove - h < z.y + 8) break;
    const emph = _isMustShow(c.role, mustShow) ? 'must' : 'secondary';
    placed.push(_place(c,
      { x: z.x + 18, y: yAbove - h, w: z.w - 36, h: h }, emph));
    yAbove -= h + 8;
  }

  // Action-row pinned bottom.
  if (actionComp) {
    placed.push(_place(actionComp,
      { x: z.x, y: z.y + z.h - 56, w: z.w, h: 48 }, 'action'));
  }
  return placed;
}

// ---------------------------------------------------------------------
//  Default / fallback: straight vertical stack (the old Pass-2 behavior).
//  Used when no purpose info is present or purpose is unknown.
// ---------------------------------------------------------------------
function _layoutDefaultStack(aiComponents, z, mustShow) {
  const placed = [];
  let y = z.y;
  for (const c of aiComponents) {
    const h = _hFor(c.role, c);
    const remaining = (z.y + z.h) - y;
    if (remaining < h + 10) break;
    const emph = _isMustShow(c.role, mustShow) ? 'must' : 'normal';
    placed.push(_place(c, { x: z.x, y: y, w: z.w, h: h }, emph));
    y += h + 10;
  }
  return placed;
}

// ---------------------------------------------------------------------
//  MIXED WIDTH PACKER — honors per-component variant.width
//  ---------------------------------------------------------------------
//  The AI can tag each focus-block / card / info-tile with:
//     variant.width = "full"  → spans the full row (1-col)
//     variant.width = "half"  → half-width, pairs with the next half
//     (omitted)               → inherit from role default (see below)
//
//  Packer walks the component list top-to-bottom, row by row:
//   • If current item is "half" and the NEXT is also "half" → place
//     them side-by-side with a 10px gap, row height = max(h1,h2).
//   • Otherwise → full-width row, item gets the whole z.w.
//  This lets a single screen mix a 1-col hero on top with a 2-col
//  pair below (or vice versa) — designer-level flexibility.
// ---------------------------------------------------------------------
const _ROLE_DEFAULT_WIDTH = {
  'focus-block':        'full',  // default: full-width editorial card
  'notif-card':         'full',
  'notif-card-ai':      'full',
  'paragraph':          'full',
  'media-card':         'full',
  'media-half':         'half',
  'focus-block-group':  'full',  // renders its own internal grid
  'information_glance_tile': 'half',  // semantic id (pre-resolve) — also covered post-resolve
  // Small chrome-ish items stay full by default (row packer keeps them solo).
  'progress-track':     'full'
};

function _resolveWidthHint(c) {
  const v = c && c.variant || {};
  // Explicit hint wins. Accept 'full' or 'half'; anything else → role default.
  if (v.width === 'full' || v.width === 'half') return v.width;
  // Semantic-id fallback (semantic may resolve to a generic atomic role).
  const semDef = c && c._semanticId && _ROLE_DEFAULT_WIDTH[c._semanticId];
  if (semDef) return semDef;
  return _ROLE_DEFAULT_WIDTH[c && c.role] || 'full';
}

function _layoutMixed(aiComponents, z, mustShow) {
  const placed = [];
  const colGap = 10;
  const rowGap = 12;
  const halfW  = Math.floor((z.w - colGap) / 2);

  let y = z.y;
  let i = 0;
  while (i < aiComponents.length) {
    const c  = aiComponents[i];
    const wH = _resolveWidthHint(c);
    const h  = _hFor(c.role, c);
    const remaining = (z.y + z.h) - y;
    if (remaining < h + 10) break;
    const emph = _isMustShow(c.role, mustShow) ? 'must' : 'normal';

    // Try to pair two half-width items into one row.
    if (wH === 'half' && i + 1 < aiComponents.length) {
      const next  = aiComponents[i + 1];
      const nextH = _resolveWidthHint(next);
      if (nextH === 'half') {
        const rowH = Math.max(h, _hFor(next.role, next));
        if (remaining >= rowH + 10) {
          placed.push(_place(c,
            { x: z.x,                 y: y, w: halfW, h: rowH },
            emph));
          const nextEmph = _isMustShow(next.role, mustShow) ? 'must' : 'normal';
          placed.push(_place(next,
            { x: z.x + halfW + colGap, y: y, w: halfW, h: rowH },
            nextEmph));
          y += rowH + rowGap;
          i += 2;
          continue;
        }
      }
    }

    // Unpaired half (odd count) renders as a centered half-width card,
    // not stretched full-width — looks intentional instead of orphaned.
    if (wH === 'half') {
      placed.push(_place(c,
        { x: z.x + Math.floor((z.w - halfW) / 2), y: y, w: halfW, h: h },
        emph));
    } else {
      placed.push(_place(c,
        { x: z.x, y: y, w: z.w, h: h },
        emph));
    }
    y += h + rowGap;
    i += 1;
  }
  return placed;
}

// True when the AI has explicitly tagged any component with a width hint,
// signaling "I'm designing the layout, let me control it".
function _hasExplicitWidthHint(aiComponents) {
  return (aiComponents || []).some(c => {
    const w = c && c.variant && c.variant.width;
    return w === 'full' || w === 'half';
  });
}

// Main dispatcher.
function _layoutForPurpose(purposeType, aiComponents, interactionZone, mustShowList) {
  const z = interactionZone;
  const mustShow = Array.isArray(mustShowList) ? mustShowList : [];
  // If the AI has set explicit widths, honor its layout choices verbatim
  // via the mixed packer — no purpose-based override. This is the
  // "designer-driven" path where 1-col hero + 2-col pair can coexist.
  if (_hasExplicitWidthHint(aiComponents)) {
    return _layoutMixed(aiComponents, z, mustShow);
  }
  switch (purposeType) {
    case 'focus_protection':         return _layoutHeroSingle(aiComponents, z, mustShow);
    case 'context_reconstruction':   return _layoutSummaryGrid(aiComponents, z, mustShow);
    case 'flow_continuity':          return _layoutContinuityStream(aiComponents, z, mustShow);
    case 'multi_party_coordination': return _layoutModalStack(aiComponents, z, mustShow);
    default:                         return _layoutDefaultStack(aiComponents, z, mustShow);
  }
}

// --- Render Engine: renders agent response to DOM ---
const RenderEngine = {
  _normalizeSurfaceType(renderModel) {
    return (
      renderModel?.surfaceType ||
      renderModel?.layout?.surfaceType ||
      renderModel?.meta?.surfaceType ||
      window.currentSurfaceType ||
      window.SURFACE_TYPES?.FIRST_DEPTH_LIST ||
      'first-depth-list'
    );
  },

  _normalizeRenderModel(renderModel) {
    if (!renderModel) return null;

    const out = { ...renderModel };
    out.surfaceType = this._normalizeSurfaceType(renderModel);
    // R3-B: preserve the decision packet so the layout dispatcher can
    // read orchestration.purpose.primary, informationPriority.must_show,
    // etc. when picking a purpose-specific layout strategy.
    out._orchestration       = renderModel._orchestration       || null;
    out._interpretation      = renderModel._interpretation      || null;
    out._statePacket         = renderModel._statePacket         || null;
    out._informationPriority = renderModel._informationPriority || null;

    if (!out.layout) out.layout = {};
    out.layout.surfaceType = out.surfaceType;

    if (!Array.isArray(out.components)) out.components = [];

    out.components = out.components.map((comp, idx) => ({
      id: comp.id || `agent-comp-${idx + 1}`,
      role: comp.role || 'gen',
      type: comp.type || null,
      text: comp.text || '',
      html: comp.html || '',
      styles: comp.styles || {},
      motion: comp.motion || '',
      delay: comp.delay || 0,
      fullWidth: !!comp.fullWidth,
      state: comp.state || null,
      zone: comp.zone || null,
      // R2: information-priority enforcement. Server sets
      // visibility="collapsed" on defer-matched components; renderer
      // displays them dimmed / pointer-events disabled / scaled down.
      visibility: comp.visibility || 'visible',
      // Preserve semantic content + variant so renderers downstream
      // (renderAtomicForRole, focus-block kind:secondary, now-bar
      // type:media, etc.) can use them. Earlier this was stripped,
      // which is why rich AI components like now-bar always rendered
      // with default (empty) state.
      content: comp.content || null,
      variant: comp.variant || null
    }));

    return out;
  },

  _shouldUseSurfaceRenderer(renderModel) {
    const surfaceType = this._normalizeSurfaceType(renderModel);
    return !!surfaceType && typeof window.generateSurfaceScenario === 'function';
  },

  _mergeAgentOverridesIntoSurface(surfaceType, renderModel) {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    const byRole = new Map();
    (renderModel.components || []).forEach(comp => {
      if (!comp.role) return;
      if (!byRole.has(comp.role)) byRole.set(comp.role, comp);
    });

    canvas.querySelectorAll('.canvas-item').forEach(el => {
      const role = el.dataset.role;
      const agentComp = byRole.get(role);
      if (!agentComp) return;

      if (agentComp.html) {
        el.innerHTML = agentComp.html;
      } else if (agentComp.text) {
        const editable = el.querySelector('[contenteditable], button, .oui-appbar-title');
        if (editable) editable.textContent = agentComp.text;
      }

      if (agentComp.styles) {
        Object.assign(el.style, agentComp.styles);
      }

      if (agentComp.state && role === 'expandable-app-bar') {
        el.dataset.appBarState = agentComp.state;
      }
    });
  },

  // ────────────────────────────────────────────────────────────────
  //  LOCKSCREEN — render Scene/Lock as base, overlay AI content
  // ────────────────────────────────────────────────────────────────
  //  Strategy: instead of duplicating the canonical Lock plan in
  //  composeSurfacePlan + hand-matching every atomic's position +
  //  font + layout, we just REUSE the exact same renderFromRules()
  //  path that "Screens > Lock" uses. Everything the canned Scene
  //  gets, the AI path gets.
  //
  //  After the base renders, we scan AI's components for anything
  //  that's NOT already part of the canonical Lock set (lock-clock /
  //  weather-date / lock-indicator / shortcuts / gesture-bar, etc.)
  //  and append them as absolutely-positioned overlays inside the
  //  interaction zone (below the clock, above the shortcut row).
  //
  //  AI can also influence canonical atomics by passing hints via
  //  its components — e.g. a now-bar with variant.type=media tells
  //  the Lock rules to pick the media preset instead of randomizing.
  _renderLockscreenWithAIOverlay(renderModel) {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    const aiComps = (renderModel.components || []).filter(Boolean);

    // Extract hints that should steer the canonical Lock render so
    // AI-authored content (song title, artist, marquee, timer time,
    // charging percent) reaches the canonical Scene/Lock atomics
    // instead of being duplicated as an overlay below the canonical
    // now-bar. Without this, the user sees TWO now-bars: canonical's
    // randomized "Bad Guy · Billie Eilish" + AI's "Midnight City · M83".
    const uiState = {
      overlayType: 'none',
      attentionMode: 'focused',
      interactionMode: 'touch',
      contextTags: []
    };
    const aiNowBar = aiComps.find(c => c.role === 'now-bar' || c.role === 'nowBar');
    if (aiNowBar) {
      const v = (aiNowBar.variant || {});
      const ct = (aiNowBar.content || {});
      const type = v.type || ct.type || 'media';
      uiState.nowBarType = type;
      uiState.contextTags.push('now-bar:' + type);
      // Merge AI song/timer/charging content into the uiState so the
      // canonical _lockScreenVariant picks it up instead of randomizing.
      uiState.nowBarTitle   = v.title   || ct.title   || v.song   || ct.song   || null;
      uiState.nowBarArtist  = v.artist  || ct.artist  || null;
      uiState.nowBarMarquee = v.marquee || ct.marquee || null;
      uiState.nowBarPercent = v.percent != null ? v.percent
                          : ct.percent != null ? ct.percent : null;
      uiState.nowBarLabel   = v.label   || ct.label   || ct.time || null;
    }

    // 1. Paint the canonical Scene/Lock into #canvas.
    const ok = window.renderFromRules('lock', uiState);
    if (ok === false) {
      throw new Error('renderFromRules("lock") returned false');
    }

    // 2. Identify which AI components belong to canonical Lock atomics
    //    (they're already rendered by the rules-renderer — we just
    //    merge their CONTENT into the existing DOM nodes) vs. which
    //    are pure overlays (new content to append).
    const CANONICAL_LOCK_ROLES = new Set([
      'clock', 'lock-clock', 'lock-time',
      'weatherDate', 'weather-date',
      'lockIndicator', 'lock-indicator',
      'shortcutLeft', 'shortcutRight', 'lock-shortcuts',
      'gestureBar', 'unlock-hint',
      'status-bar', 'statusBar',
      // now-bar is a SINGLETON on lockscreen: the canonical Scene/Lock
      // already renders one (randomized song/timer/charging). When the
      // AI emits a now-bar, we MERGE its content (title / artist /
      // marquee / type) into the canonical slot — never append a
      // second one. Both casings listed so kebab-case AI emissions
      // and camelCase canonical slots alias correctly.
      'nowBar', 'now-bar',
      // Same rule for progress-track: the canonical Lock may include
      // one paired with the now-bar; AI's progress emissions merge in.
      'progress-track', 'progressTrack'
    ]);
    const overlays = [];
    aiComps.forEach(c => {
      if (!c.role) return;
      if (CANONICAL_LOCK_ROLES.has(c.role)) {
        // Merge AI-supplied content into the canonical DOM node.
        this._mergeAIContentIntoCanonicalLockAtom(c);
      } else {
        overlays.push(c);
      }
    });

    // 3. Overlay the AI's contextual components in the INTERACTION
    //    zone (below the clock). Uses the same purpose-aware layout
    //    dispatcher that non-lockscreen surfaces use, but constrained
    //    to a safe y-range (~y=440 → y=840 on a 978-tall canvas) so
    //    overlays never collide with the clock above or the shortcut
    //    row below.
    if (overlays.length) {
      this._appendLockscreenOverlays(overlays, renderModel);
    }
  },

  // Merge AI-emitted content into an already-rendered canonical Lock
  // atomic. E.g. AI emits weather-date with condition='Clear' temp='68°'
  // → the existing .rules-item[data-role="weatherDate"] DOM node gets
  // its innerHTML re-rendered via renderAtomicForRole with the merged
  // variant. This lets AI customize the base (e.g. "Rain tonight · 52°")
  // without redrawing the entire lockscreen.
  _mergeAIContentIntoCanonicalLockAtom(aiComp) {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    // now-bar and progress-track are handled upstream via uiState hints
    // (_renderLockscreenWithAIOverlay populates uiState.nowBarTitle /
    // Artist / Marquee / Percent / Type so the canonical rules-renderer
    // picks them up). Re-rendering them here via renderAtomicForRole
    // would replace the canonical GalaxyNowBar styling with the simpler
    // surface-layout kebab-case version — off-brand. Skip.
    if (aiComp.role === 'now-bar' || aiComp.role === 'nowBar' ||
        aiComp.role === 'progress-track' || aiComp.role === 'progressTrack') {
      return;
    }
    // Canonical role aliases — same as agent.js Pass 1 merge.
    const ROLE_ALIASES = {
      'lock-clock':      'clock',
      'lock-time':       'clock',
      'lock-indicator':  'lockIndicator',
      'weather-date':    'weatherDate',
      'unlock-hint':     'gestureBar',
      'lock-shortcuts':  'shortcutLeft',
      'status-bar':      'statusBar'
    };
    const targetRole = ROLE_ALIASES[aiComp.role] || aiComp.role;
    // rules-renderer uses either canvas._rulesInner or canvas itself
    const host = canvas._rulesInner || canvas;
    const node = host.querySelector('[data-role="' + targetRole + '"]');
    if (!node || typeof window.renderAtomicForRole !== 'function') return;

    // Rebuild the atom using the merged variant (canonical defaults
    // plus AI content). We pass the rect from the existing DOM so
    // proportions stay identical.
    const rect = {
      w: parseFloat(node.style.width)  || 0,
      h: parseFloat(node.style.height) || 0
    };
    const mergedComp = Object.assign({}, aiComp, {
      role: targetRole,
      variant: Object.assign({}, aiComp.variant || {}, aiComp.content || {})
    });
    try {
      node.innerHTML = window.renderAtomicForRole(mergedComp, rect);
    } catch (e) { /* leave canonical render in place */ }
  },

  // Place AI's overlay components (now-bar-media, focus-block, notif-
  // card, progress-track, …) in the interaction zone. Uses the same
  // _layoutForPurpose dispatcher the general path uses, but scoped
  // to a y-range safe from the clock+shortcuts.
  _appendLockscreenOverlays(overlays, renderModel) {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const host = canvas._rulesInner || canvas;

    // Safe band: below the clock bottom (~y=420) and above the
    // shortcut row top (~y=860). Leaves ~420px of vertical room
    // for AI content — enough for 1 hero + 2-3 supporting items.
    const layoutZone = { x: 24, y: 440, w: 451 - 48, h: 400 };

    // Determine purpose from renderModel orchestration so the
    // dispatcher picks the right strategy.
    const purpose = (renderModel._orchestration &&
                     renderModel._orchestration.purpose &&
                     renderModel._orchestration.purpose.primary) || 'focus_protection';
    const mustShow = (renderModel._informationPriority &&
                      renderModel._informationPriority.must_show) || [];
    const placed = (typeof _layoutForPurpose === 'function')
      ? _layoutForPurpose(purpose, overlays, layoutZone, mustShow)
      : overlays.map((c, i) => _place(c, {
          x: layoutZone.x, y: layoutZone.y + i * 80,
          w: layoutZone.w, h: 72
        }, 'normal'));

    placed.forEach(comp => {
      const rect = comp._rect || { x: 24, y: 440, w: 380, h: 72 };
      const wrapper = document.createElement('div');
      wrapper.className = 'rules-item agent-overlay';
      wrapper.dataset.role = comp.role;
      wrapper.dataset.nodeId = comp.id || ('overlay-' + Math.random().toString(36).slice(2, 7));
      wrapper.dataset.compType = comp.role;
      if (comp._semanticId) wrapper.dataset.semanticId = comp._semanticId;
      wrapper.dataset.zone = 'interaction';
      if (comp._emphasis) wrapper.dataset.emphasis = comp._emphasis;
      wrapper.style.position = 'absolute';
      wrapper.style.left   = rect.x + 'px';
      wrapper.style.top    = rect.y + 'px';
      wrapper.style.width  = rect.w + 'px';
      wrapper.style.height = rect.h + 'px';
      if (typeof window.renderAtomicForRole === 'function') {
        try { wrapper.innerHTML = window.renderAtomicForRole(comp, rect); }
        catch (e) { wrapper.innerHTML = ''; }
      }
      host.appendChild(wrapper);
    });
  },

  renderFromModel(renderModel) {
    if (!renderModel) return;

    const normalized = this._normalizeRenderModel(renderModel);
    agentSession.lastRenderModel = normalized;

    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    if (this._shouldUseSurfaceRenderer(normalized)) {
      const surfaceType = normalized.surfaceType;

      clearCanvas();

      // ──────────────────────────────────────────────────────────────
      //  LOCKSCREEN: render the canonical Scene/Lock template as the
      //  BASE LAYER, then overlay AI's contextual components on top.
      //  This is dramatically simpler than the general plan-merge
      //  path — we don't reimplement lock atomics, we just use the
      //  same renderFromRules() path that the "Screens > Lock" button
      //  uses. Anything the AI adds (now-bar, focus-block, notif-
      //  card, etc.) sits in the INTERACTION zone below the clock.
      //
      //  Benefits:
      //    - pixel-perfect parity with Scene/Lock (same DOM, same
      //      positions, same fonts, same atomics)
      //    - zero drift: one path, one source of truth
      //    - AI focuses on content overlays only (fewer tokens, higher
      //      quality output)
      // ──────────────────────────────────────────────────────────────
      if (surfaceType === 'lockscreen' &&
          typeof window.renderFromRules === 'function') {
        try {
          return this._renderLockscreenWithAIOverlay(normalized);
        } catch (e) {
          console.warn('[agent] Lockscreen overlay render failed; falling back to plan path:', e);
          clearCanvas();
          // fall through to the generic plan path below
        }
      }

      // Build plan manually so we can inject agent content BEFORE the
      // expansion step turns "list" into N "list-item" children. Otherwise
      // expansion uses random presets and the agent's semantic content
      // (items / title / description / actions) is thrown away.
      const viewport = { width: 451, height: 978 };
      const layout = window.createOneUILayout(viewport, surfaceType);
      const plan = window.composeSurfacePlan(surfaceType, layout);

      // Pass 1: merge agent content into plan items by role (for chrome
      // components already present in the canned plan — status-bar,
      // app-bar, app-dock, etc.). First match wins.
      // Canonical-role normalizer. The canned Scene/Lock template (and
      // its matching surface plan) uses the camelCase role names
      // `clock`, `lockIndicator`, `weatherDate`, `shortcutLeft`,
      // `shortcutRight`, `gestureBar`. The AI naturally emits kebab-
      // case (`lock-clock`, `weather-date`, etc.). This map normalizes
      // AI's kebab-case emissions to the Scene canonical names so
      // Pass 1 merge-by-role finds its target and the DOM output shows
      // the SAME node ids as the canned Scene/Lock — no more "two
      // naming conventions" confusion in the Layers inspector.
      const ROLE_ALIASES = {
        'lock-clock':     'clock',
        'lock-time':      'clock',
        'lock-indicator': 'lockIndicator',
        'weather-date':   'weatherDate',
        'unlock-hint':    'gestureBar',
        // The legacy combined `lock-shortcuts` expands to two canonical
        // circles. It merges into shortcutLeft by default; a second AI
        // emission (or the canned plan's shortcutRight slot) handles
        // the right-side camera circle.
        'lock-shortcuts': 'shortcutLeft'
      };
      function _canonicalRole(role) {
        if (!role) return role;
        return ROLE_ALIASES[role] || role;
      }

      const agentByRole = new Map();
      (normalized.components || []).forEach(function (ac) {
        const key = _canonicalRole(ac.role);
        if (!agentByRole.has(key)) agentByRole.set(key, ac);
      });
      const consumedRoles = new Set();
      (plan.components || []).forEach(function (pc) {
        const key = _canonicalRole(pc.role);
        var ac = agentByRole.get(key);
        if (!ac) return;
        // Mark BOTH the canonical key and the AI component's original
        // role as consumed, so the aiDrivingScreen counter below sees
        // them as merged (not "unconsumed extra content").
        consumedRoles.add(key);
        consumedRoles.add(ac.role);
        if (ac.id)      pc.id      = ac.id;
        if (ac.text)    pc.text    = ac.text;
        if (ac.state)   pc.state   = ac.state;
        if (ac.content) pc.content = Object.assign({}, pc.content || {}, ac.content);
        if (ac.styles)  pc.styles  = Object.assign({}, pc.styles  || {}, ac.styles);
        if (ac.variant) pc.variant = Object.assign({}, pc.variant || {}, ac.variant);
        // R2: propagate visibility (collapsed for defer-matched items)
        if (ac.visibility && ac.visibility !== 'visible') pc.visibility = ac.visibility;
      });

      // Before Pass 2: strip canned plan items that would COLLIDE with
      // what the AI is supplying.
      //
      // Earlier revision only fired this when the AI had INTERACTION-
      // zone content, but the classifier happily routes rich output
      // (lock-clock, weather-date, notif-card, expandable-app-bar, etc.)
      // into the VIEWING zone. Those AI components landed on top of
      // the canned lockscreen lock-time / lock-date / focus-block-group
      // because neither plan knew the other existed — visible overlap:
      // 12:45 clock + 00:00:00 timer + "Swipe to unlock" all stacked.
      //
      // New rule: if AI is supplying ANY 2+ content components (i.e.
      // it's actually driving the screen, not just dropping a single
      // tweak), strip EVERY canned content component. Only pure
      // chrome zones (topSystem, bottomNav, bottomAction) survive —
      // status-bar, app-dock, bottom-navigation, unlock-hint,
      // lock-shortcuts, gesture-bar. The AI's components then own
      // the viewing + interaction regions cleanly.
      const CHROME_ZONES = new Set(['topSystem', 'bottomNav', 'bottomAction']);
      const agentContentCount = (normalized.components || []).filter(function (ac) {
        if (!ac.role) return false;
        // A component counts as "extra AI content" (potential collider
        // with the canned plan) ONLY if it wasn't consumed via
        // merge-by-role — even after alias normalization. Lockscreen
        // atomics that merged into canned positions do NOT count here.
        if (consumedRoles.has(ac.role) || consumedRoles.has(_canonicalRole(ac.role))) return false;
        return true;
      }).length;
      // LOCKSCREEN LAYERED MODEL: the canned Screen/Lock template is
      // the BASE LAYER. AI-generated content is an OVERLAY on top of
      // that base — never a replacement. So on lockscreen we skip the
      // strip-canned-content logic entirely: every canonical atomic
      // (status-bar, lockIndicator, weatherDate, clock, shortcutLeft/
      // Right, gestureBar) stays on canvas, regardless of how many
      // contextual extras the AI adds. The dispatcher places AI's
      // unconsumed components in the INTERACTION zone (below the
      // clock) where they can't collide with the base chrome.
      //
      // For non-lockscreen surfaces, keep the old behavior: if the AI
      // supplies 2+ unmerged content components it's "driving the
      // screen", so strip the canned content items and let the AI's
      // content own viewing+interaction.
      const isLockscreen = surfaceType === 'lockscreen';
      const aiDrivingScreen = !isLockscreen && agentContentCount >= 2;
      if (aiDrivingScreen) {
        plan.components = (plan.components || []).filter(function (pc) {
          return CHROME_ZONES.has(pc.zone);
        });
      }
      if (consumedRoles.size) {
        console.log('[RenderEngine] merged ' + consumedRoles.size + ' AI role(s) into canned plan; ' +
          agentContentCount + ' extra AI component(s) ' +
          (aiDrivingScreen ? '(STRIPPING canned content)' : '(appending to plan)'));
      }
      // Track which zones the AI is filling — used by layouts to leave
      // bottom reserve for canned chrome that still exists (app-dock,
      // bottom-nav, gesture-bar).
      const agentInteractionRoles = new Set();
      (normalized.components || []).forEach(function (ac) {
        if (!ac.role || consumedRoles.has(ac.role)) return;
        const iz = ac.zone || _inferZoneForAgentRole(ac.role);
        if (iz === 'interaction') agentInteractionRoles.add(ac.role);
      });

      // Pass 2 (R3-B): APPEND agent's unique content components using a
      // PURPOSE-AWARE LAYOUT STRATEGY instead of the old fixed vertical
      // stack. The dispatcher reads normalized._orchestration (4+2+1)
      // and informationPriority.must_show to pick one of four strategies:
      //   focus_protection         → hero_single (one dominant element)
      //   context_reconstruction   → summary_grid (2-col info tiles)
      //   flow_continuity          → continuity_stream (hero + middle + action)
      //   multi_party_coordination → modal_stack (centered dialog)
      //
      // Layout scope = the combined VIEWING + INTERACTION area on most
      // surfaces. On LOCKSCREEN, though, the viewing zone holds
      // preserved Samsung identity chrome (lock-time huge clock,
      // weather-date, lock-date) — if the dispatcher places AI's
      // unconsumed components (now-bar, focus-block, notif-card, etc.)
      // there, they OVERLAP the clock and kill the Samsung look. So on
      // lockscreen we restrict the dispatcher to the INTERACTION zone
      // only, keeping AI content below the clock+date region.
      const viewingZone     = (layout && layout.zones && layout.zones.viewing)     || null;
      const interactionZone = (layout && layout.zones && layout.zones.interaction) ||
        { x: 18, y: 140, w: 415, h: 600 };
      const contentZone = (viewingZone && !isLockscreen) ? {
        x: Math.min(viewingZone.x, interactionZone.x),
        y: viewingZone.y,
        w: Math.max(viewingZone.w, interactionZone.w),
        h: (interactionZone.y + interactionZone.h) - viewingZone.y
      } : interactionZone;

      // Reserve space at the bottom if canned chrome (app-dock,
      // bottom-nav, gesture-bar, lock-shortcuts, unlock-hint) will
      // still render under the AI content.
      const hasBottomChrome = (plan.components || []).some(function (pc) {
        return pc.zone === 'bottomNav' || pc.zone === 'bottomAction';
      });
      const layoutZone = hasBottomChrome ? {
        x: contentZone.x,
        y: contentZone.y,
        w: contentZone.w,
        h: Math.max(120, contentZone.h - 20)     // 20px buffer above chrome
      } : contentZone;

      // Collect every AI component not already merged. The dispatcher
      // handles CONTENT components (anything zoned to viewing or
      // interaction); the remaining items (topSystem / bottomNav /
      // bottomAction chrome the AI explicitly emitted) fall through to
      // the standard zone resolver.
      const contentCandidates = [];
      const chromeCandidates  = [];
      (normalized.components || []).forEach(function (ac) {
        if (!ac.role) return;
        if (consumedRoles.has(ac.role)) return;
        const inferredZone = ac.zone || _inferZoneForAgentRole(ac.role);
        const spec = {
          id:         ac.id || ('agent-' + ac.role),
          role:       ac.role,
          zone:       inferredZone,
          text:       ac.text,
          content:    ac.content || {},
          state:      ac.state,
          variant:    ac.variant,
          visibility: ac.visibility || 'visible'
        };
        if (inferredZone === 'viewing' || inferredZone === 'interaction') {
          contentCandidates.push(spec);
        } else {
          chromeCandidates.push(spec);
        }
      });

      // Run the purpose-aware layout dispatcher over every AI content
      // component. Each result has `_rect` and `_emphasis` set.
      const purposeType = (normalized._orchestration &&
                           normalized._orchestration.purpose &&
                           normalized._orchestration.purpose.primary) || null;
      const mustShowList = (normalized._informationPriority &&
                            normalized._informationPriority.must_show) || [];
      const placed = _layoutForPurpose(purposeType, contentCandidates, layoutZone, mustShowList);

      placed.forEach(function (spec) {
        plan.components.push(spec);
        consumedRoles.add(spec.role);
      });
      chromeCandidates.forEach(function (spec) {
        // Chrome items get standard zone positioning via resolveComponentRect.
        plan.components.push(spec);
        consumedRoles.add(spec.role);
      });

      // Expand list / focus-block-group / detail-content with agent content
      window.expandContainerComponents(plan, layout);
      window.renderSurfacePlan(canvas, plan, layout);

      // Hydrate DesignDoc from the merged+expanded plan so Scene Inspector
      // shows agent-seeded nodes (each list-item is editable individually).
      if (window.DesignDoc && typeof window.DesignDoc.hydrateFromPlan === 'function') {
        window.DesignDoc.hydrateFromPlan(plan, surfaceType);
      }

      if (typeof window.enableExpandableAppBarSnap === 'function') {
        window.enableExpandableAppBarSnap(canvas, surfaceType);
      }

      return;
    }

    // Legacy fallback path (no surfaceType): old flex-column rendering.
    if (window.DesignDoc && typeof window.DesignDoc.hydrateFromRenderModel === 'function') {
      window.DesignDoc.hydrateFromRenderModel(normalized);
    }

    if (!normalized.components || !normalized.components.length) return;

    clearCanvas();
    canvas.style.display = 'flex';
    canvas.style.flexDirection = 'column';
    canvas.style.alignItems = normalized.layout?.align || 'stretch';
    canvas.style.gap = (normalized.layout?.gap ?? 8) + 'px';
    canvas.style.padding = normalized.layout?.padding || '16px';

    const useMotion = document.getElementById('genMotion')?.checked;
    const useStagger = document.getElementById('genStagger')?.checked;

    normalized.components.forEach((comp, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'canvas-item';
      wrapper.id = comp.id || 'item-' + (++itemCounter);
      wrapper.dataset.role = comp.role || 'gen';
      // Bind DOM ↔ design-doc
      wrapper.dataset.nodeId = wrapper.id;

      if (comp.html) {
        wrapper.innerHTML = comp.html;
      } else if (comp.type && templates[comp.type]) {
        wrapper.innerHTML = templates[comp.type]();
        if (comp.text) {
          const editable = wrapper.querySelector('[contenteditable], button, .oui-appbar-title');
          if (editable) editable.textContent = comp.text;
        }
      }

      if (comp.styles) {
        Object.assign(wrapper.style, comp.styles);
      }

      const isFullWidth = comp.fullWidth || fullWidthTypes.has(comp.type);
      wrapper.style.width = isFullWidth ? '100%' : '';
      wrapper.setAttribute('draggable', 'true');

      if (useMotion && comp.motion) {
        const delay = useStagger ? (comp.delay || idx * 40) : 0;
        wrapper.style.opacity = '0';
        setTimeout(() => {
          wrapper.style.animation = `${comp.motion} ${currentDuration}ms ${currentEasing} forwards`;
        }, delay);
      }

      initDrag(wrapper);
      // Click / hover: centralized via interaction-state.js canvas-level tracker.
      canvas.appendChild(wrapper);
    });
  },

  applyAgentPatches(patchPlan) {
    if (!patchPlan || !patchPlan.patches) return;

    const FORBIDDEN_PATCH_PROPS = new Set([
      'x', 'y', 'top', 'left', 'right', 'bottom',
      'width', 'height', 'position',
      'transform', 'translate', 'translateX', 'translateY'
    ]);
    const ALLOWED_KINDS = new Set(['content', 'style', 'state']);

    patchPlan.patches.forEach(patch => {
      let targets = [];

      // Role-first lookup (preferred). Fall back to node id only when no role.
      if (patch.targetRole) {
        targets = Array.from(
          document.querySelectorAll(`.canvas-item[data-role="${patch.targetRole}"], .rules-item[data-role="${patch.targetRole}"], .surface-item[data-role="${patch.targetRole}"]`)
        );
      } else if (patch.node) {
        const el = document.getElementById(patch.node);
        if (el) targets = [el];
      }

      if (!targets.length) return;

      // Route through DesignDoc when the element is bound to a node, so the
      // document stays in lockstep with the DOM.
      if (window.DesignDoc && typeof window.DesignDoc.updateNode === 'function') {
        targets.forEach(el => {
          const nodeId = el.dataset.nodeId;
          if (!nodeId) return;
          const docPatch = {};
          (patch.changes || []).forEach(ch => {
            if (!ALLOWED_KINDS.has(ch.kind)) return;
            if (ch.kind === 'state') {
              docPatch.state = ch.to;
            } else if (ch.kind === 'style') {
              if (FORBIDDEN_PATCH_PROPS.has(ch.property)) return;
              docPatch.styles = docPatch.styles || {};
              docPatch.styles[ch.property] = ch.to;
            } else if (ch.kind === 'content') {
              docPatch.props = docPatch.props || {};
              if (ch.field) docPatch.props[ch.field] = ch.to;
            }
          });
          if (Object.keys(docPatch).length) {
            window.DesignDoc.updateNode(nodeId, docPatch);
          }
          el.classList.remove('refine-highlight');
          el.classList.add('refine-patched');
        });
        return;  // DesignDoc applied — skip legacy DOM path below
      }

      targets.forEach(el => {
        (patch.changes || []).forEach(change => {
          if (!change || !change.kind || !ALLOWED_KINDS.has(change.kind)) return;

          // --- state kind: only valid for expandable-app-bar ---
          if (change.kind === 'state' && patch.targetRole === 'expandable-app-bar') {
            if (typeof window.setExpandableAppBarState === 'function') {
              window.setExpandableAppBarState(el, change.to);
            }
            return;
          }

          // --- style kind: semantic tokens only, no layout props ---
          if (change.kind === 'style') {
            if (FORBIDDEN_PATCH_PROPS.has(change.property)) return;

            const target = el.firstElementChild || el;
            const prop = (change.property || '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());

            if (prop === 'emphasis') {
              if (change.to === 'stronger') {
                target.style.filter = 'contrast(1.05)';
                target.style.transform = 'scale(1.0)';
              } else if (change.to === 'softer') {
                target.style.opacity = '0.9';
              }
            } else if (prop === 'tone') {
              if (change.to === 'cool') target.style.filter = 'hue-rotate(-10deg)';
              else if (change.to === 'warm') target.style.filter = 'hue-rotate(10deg)';
            } else {
              target.style[prop] = change.to;
            }
            return;
          }

          // --- content kind: text / title / placeholder / subtitle ---
          if (change.kind === 'content') {
            const target =
              el.querySelector('[data-appbar-title], [contenteditable], .oui-appbar-title, input') ||
              el.firstElementChild;
            if (!target) return;

            if (change.field === 'placeholder' && target.tagName === 'INPUT') {
              target.placeholder = change.to;
            } else if (change.field === 'title' || change.field === 'text' || change.field === 'subtitle') {
              target.textContent = change.to;
            }
          }
        });

        el.classList.remove('refine-highlight');
        el.classList.add('refine-patched');
      });
    });

    setTimeout(() => {
      document.querySelectorAll('.refine-patched').forEach(el => el.classList.remove('refine-patched'));
    }, 2000);
  },

  renderCritic(critic) {
    if (!critic) return;

    // ── Compact badge on the Generate tab header ─────────────────
    const badge = document.getElementById('criticBadge');
    const badgeScore = document.getElementById('criticBadgeScore');
    const badgeIssues = document.getElementById('criticBadgeIssues');
    // Normalize issues/suggestions locally in case the server contract
    // drifts: string → {type:'critique', message:string}, object →
    // pass-through with a message fallback. Keeps the "undefined
    // undefined" literals out of the UI whenever the AI returns a
    // shape we didn't expect.
    const _normIssue = function (i) {
      if (typeof i === 'string') return { type: 'critique', message: i };
      if (!i || typeof i !== 'object') return { type: 'critique', message: String(i || '') };
      return { type: i.type || 'critique', message: i.message || i.text || '' };
    };
    const _normSugg = function (s) {
      if (typeof s === 'string') return s;
      return (s && (s.message || s.text)) || '';
    };

    if (badge && badgeScore) {
      const score = (typeof critic.score === 'number') ? critic.score : null;
      if (score != null) {
        badgeScore.textContent = score + '/100';
        // Color: green ≥85, amber 70-84, red <70
        const color = score >= 85 ? '#0FCF6E' : score >= 70 ? '#F5A623' : '#FF6B6B';
        badgeScore.style.color = color;
        if (badgeIssues) {
          const issuesArr = (Array.isArray(critic.issues) ? critic.issues : []).map(_normIssue);
          if (issuesArr.length) {
            const preview = issuesArr.slice(0, 2).map(function (i) {
              return '<span style="color:' + color + ';opacity:0.9;">\u2022</span> ' + (i.message || i.type || '');
            }).join('<br>');
            badgeIssues.innerHTML = preview + (issuesArr.length > 2 ? '<br><span style="opacity:0.6;">+' + (issuesArr.length - 2) + ' more</span>' : '');
          } else {
            badgeIssues.innerHTML = '<span style="color:' + color + ';opacity:0.8;">No issues flagged</span>';
          }
        }
        badge.style.display = 'block';
        badge.style.borderColor = color + '55';
      }
    }

    // ── Full critic panel (existing Refine-tab area) ─────────────
    const el = document.getElementById('criticPanel');
    if (!el) return;
    let html = '<div class="critic-content">';
    if (critic.score !== undefined) {
      html += `<div class="critic-score">${critic.score}<span>/100</span></div>`;
    }
    if (critic.issues && critic.issues.length > 0) {
      critic.issues.map(_normIssue).forEach(issue => {
        html += `<div class="critic-issue"><span class="refine-issue-type ${issue.type}">${issue.type}</span> ${issue.message}</div>`;
      });
    }
    if (critic.suggestions && critic.suggestions.length > 0) {
      html += '<div class="critic-suggestions">';
      critic.suggestions.map(_normSugg).forEach(s => {
        if (s) html += `<div class="critic-suggestion">&#128161; ${s}</div>`;
      });
      html += '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
    el.style.display = 'block';
  }
};

// --- Loading UI helper ---
function showAgentLoading(message) {
  let overlay = document.getElementById('agentLoadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'agentLoadingOverlay';
    overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:500;border-radius:inherit;';
    document.getElementById('canvasFrame').appendChild(overlay);
  }
  overlay.innerHTML = `
    <div style="width:32px;height:32px;border:2px solid rgba(255,255,255,0.15);border-top-color:var(--primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
    <div style="margin-top:12px;font-size:12px;font-weight:500;color:var(--text-2);letter-spacing:0.3px;">${message || 'Processing...'}</div>
  `;
  overlay.style.display = 'flex';
}

function hideAgentLoading() {
  const overlay = document.getElementById('agentLoadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

function toggleAgentMode() {
  if (agentSession.mode === 'agent') {
    setAgentMode('local');
    console.log('[mode] Switched to Local \u2014 chat Send will match keywords against promptMap');
    return;
  }
  // Try to connect to Node.js agent server
  const indicator = document.getElementById('agentModeIndicator');
  if (indicator) {
    indicator.textContent = '\u2026';
    indicator.className = 'agent-mode-indicator local';
    indicator.title = 'Connecting to AI server\u2026';
  }

  AgentAPI.health()
    .then(data => {
      setAgentMode('agent');
      console.log('[mode] Switched to AI (%s)', (data && data.model) || 'connected');
    })
    .catch(() => {
      // Revert indicator and surface a non-blocking toast-style message
      // in #pipelineOutput (not an alert — alerts break flow).
      setAgentMode('local');
      if (typeof _pipelineStart === 'function') {
        _pipelineStart('AI server not reachable');
        _pipelineError('Can\'t reach /api/agent/health at the current origin.');
        _pipelineInfo('Start the Node server: <code>yarn dev</code> (requires .env with OPENAI_API_KEY)');
        _pipelineInfo('Staying in Local mode \u2014 chat Send will keep using keyword matching.');
      }
    });
}

// --- Local Fallback wrappers (preserve existing logic) ---
// Original functions renamed with _local prefix, originals become routers

const _local_interpretFeedback = function(text, tags, snapshot) {
  // This is the original interpretFeedback logic — preserved as fallback
  const issues = [];
  const textLower = (text || '').toLowerCase();
  const items = snapshot.items;
  for (const [type, keywords] of Object.entries(ISSUE_KEYWORDS)) {
    const matched = keywords.filter(k => textLower.includes(k));
    if (matched.length > 0 || tags.has(type)) {
      issues.push({ type, severity: matched.length >= 2 ? 'high' : 'medium', description: '', affectedNodes: [], suggestion: '', fromText: matched, fromTag: tags.has(type) });
    }
  }
  if (issues.length === 0 && textLower.length > 0) {
    issues.push({ type: 'spacing', severity: 'medium', description: '', affectedNodes: [], suggestion: '', fromText: [], fromTag: false });
  }
  issues.forEach(issue => {
    const affected = localizeIssue(issue, items);
    issue.affectedNodes = affected.nodes;
    issue.description = affected.description;
    issue.suggestion = affected.suggestion;
  });
  return issues;
};

// _local_planRefinementPatches is defined later in the refinement section

