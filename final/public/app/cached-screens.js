// ============================================================================
//  app/cached-screens.js — user-saved screen bookmarks
//  ---------------------------------------------------------------------------
//  Distinct from the time-limited prompt cache (_promptCache). These are
//  DELIBERATE saves the user makes by clicking "+ Save". Each entry stores:
//     { id, label, prompt, surfaceType, renderModel, critic, ts }
//
//  Persisted to localStorage so they survive page reloads.
//  Click entry → RenderEngine.renderFromModel restores the screen.
// ============================================================================

(function () {
  'use strict';

  var STORAGE_KEY = 'ouiGenUI.cachedScreens.v1';
  var MAX_ENTRIES = 20;

  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function _save(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      // Quota exceeded — drop oldest half
      console.warn('[cached-screens] localStorage quota exceeded, trimming');
      var trimmed = list.slice(Math.floor(list.length / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch (_) {}
    }
  }

  var _cache = _load();

  function _uid() {
    return 'cached-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e5).toString(36);
  }

  function _deriveLabel(entry) {
    if (entry.label) return entry.label;
    var prompt = (entry.prompt || '').trim();
    if (prompt) return prompt.length > 42 ? prompt.slice(0, 40) + '…' : prompt;
    return (entry.surfaceType || 'screen');
  }

  function _formatTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = new Date();
    var diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return diffMin + 'm ago';
    if (diffMin < 1440) return Math.floor(diffMin / 60) + 'h ago';
    return Math.floor(diffMin / 1440) + 'd ago';
  }

  // Icon per surfaceType (subtle visual cue)
  var SURFACE_GLYPH = {
    'lockscreen': '\u25EF',
    'first-depth-list': '\u2630',
    'second-depth-detail': '\u25A3',
    'tab-root': '\u2318',
    'dialog-bottom': '\u25AC',
    'dialog-center': '\u25A1',
    'quick-settings': '\u2699',
    'notification-shade': '\u266B',
    'selection-mode': '\u2713'
  };

  // ─────────────────────────────────────────────────────────────
  //  Public API (exposed on window)
  // ─────────────────────────────────────────────────────────────

  window.saveCurrentScreen = function saveCurrentScreen() {
    // Priority order for the renderModel source:
    //   1. agentSession.lastRenderModel (most recent agent output)
    //   2. DesignDoc.state (current structural snapshot)
    var renderModel = null;
    var prompt = null;
    var critic = null;

    if (typeof agentSession !== 'undefined' && agentSession && agentSession.lastRenderModel) {
      renderModel = agentSession.lastRenderModel;
      critic = agentSession.lastCritic || null;
      // Find matching prompt from variants
      if (typeof variants !== 'undefined' && variants && variants[activeVariant]) {
        prompt = variants[activeVariant].prompt || null;
      }
    } else if (window.DesignDoc && window.DesignDoc.state && window.DesignDoc.state.nodes.length) {
      // Synthesize a renderModel from DesignDoc for non-agent screens
      var state = window.DesignDoc.state;
      renderModel = {
        surfaceType: state.surfaceType || 'first-depth-list',
        layout: state.layout || {},
        components: state.nodes.map(function (n) {
          var comp = {
            id: n.id,
            role: n.role,
            state: n.state,
            text: (n.props && (n.props.title || n.props.text)) || '',
            content: Object.assign({}, n.props || {}, n.content || {}),
            styles: n.styles || {}
          };
          return comp;
        })
      };
      prompt = window.currentBaseSurface ? ('Scene: ' + window.currentBaseSurface) : null;
    }

    if (!renderModel || !renderModel.components || !renderModel.components.length) {
      alert('Nothing to save — generate or pick a screen first.');
      return;
    }

    var entry = {
      id: _uid(),
      label: null,   // user can rename later
      prompt: prompt || '',
      surfaceType: renderModel.surfaceType || 'first-depth-list',
      renderModel: renderModel,
      critic: critic,
      ts: Date.now()
    };

    _cache.unshift(entry);
    while (_cache.length > MAX_ENTRIES) _cache.pop();
    _save(_cache);
    window.refreshCachedScreensList();
  };

  window.restoreCachedScreen = function restoreCachedScreen(id) {
    var entry = _cache.find(function (e) { return e.id === id; });
    if (!entry || !entry.renderModel) return;

    // Use RenderEngine for agent-shaped renderModels (most entries)
    if (typeof RenderEngine !== 'undefined' && RenderEngine && typeof RenderEngine.renderFromModel === 'function') {
      RenderEngine.renderFromModel(entry.renderModel);
      if (entry.critic && typeof RenderEngine.renderCritic === 'function') {
        RenderEngine.renderCritic(entry.critic);
      }
    }

    // Highlight the active entry in the list
    document.querySelectorAll('.cached-entry').forEach(function (el) { el.classList.remove('active'); });
    var active = document.querySelector('.cached-entry[data-id="' + id + '"]');
    if (active) active.classList.add('active');
  };

  window.deleteCachedScreen = function deleteCachedScreen(id, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    _cache = _cache.filter(function (e) { return e.id !== id; });
    _save(_cache);
    window.refreshCachedScreensList();
  };

  window.renameCachedScreen = function renameCachedScreen(id) {
    var entry = _cache.find(function (e) { return e.id === id; });
    if (!entry) return;
    var current = _deriveLabel(entry);
    var next = prompt('Rename cached screen:', current);
    if (next == null) return;
    entry.label = next.trim() || null;
    _save(_cache);
    window.refreshCachedScreensList();
  };

  window.refreshCachedScreensList = function refreshCachedScreensList() {
    var list = document.getElementById('cachedScreensList');
    var empty = document.getElementById('cachedEmpty');
    if (!list) return;

    if (!_cache.length) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    list.innerHTML = _cache.map(function (e) {
      var glyph = SURFACE_GLYPH[e.surfaceType] || '\u25A1';
      var label = _deriveLabel(e);
      var time = _formatTime(e.ts);
      var typeLabel = (e.surfaceType || '').replace(/-/g, ' ');
      return (
        '<div class="cached-entry" data-id="' + e.id + '" title="' + typeLabel + '" ' +
          'onclick="restoreCachedScreen(\'' + e.id + '\')" ' +
          'ondblclick="renameCachedScreen(\'' + e.id + '\')">' +
          '<span class="cached-glyph">' + glyph + '</span>' +
          '<div class="cached-meta">' +
            '<div class="cached-label">' + _escapeHtml(label) + '</div>' +
            '<div class="cached-sub">' + typeLabel + ' \u00B7 ' + time + '</div>' +
          '</div>' +
          '<button class="cached-delete" onclick="deleteCachedScreen(\'' + e.id + '\', event)" title="Delete">\u00D7</button>' +
        '</div>'
      );
    }).join('');
  };

  function _escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.refreshCachedScreensList);
  } else {
    window.refreshCachedScreensList();
  }
})();
