// ============================================================================
//  DESIGN MEMORY — canonical barrel export
//  ---------------------------------------------------------------------------
//  Single entry point for generator.js + the LLM composer.
//
//  DATA SOURCES (after consolidation):
//    1. figma-refs/component_registry.json  — canonical registry (object form)
//    2. figma-refs/generator_memory.json    — screens, rules, tokens, mappings
//       → generator_memory.screens replaces the old screen_contexts.json
//
//  This barrel provides:
//    - screenContexts  → derived from generatorMemory.screens
//    - componentRegistry → array adapter from component_registry.json
//    - generatorMemory  → full generator_memory.json
//    - registryRaw      → original object-keyed registry (for layout_composer)
//
//  Usage:
//    const mem = (typeof require !== 'undefined')
//      ? require('./design_memory')
//      : window.DesignMemory;   // after mem.ready resolves (browser)
// ============================================================================

'use strict';

// ---------------------------------------------------------------------------
//  Registry adapter — converts {components:{...}} object to [{id,...}] array
//  with camelCase keys for generator.js, preserving all original fields.
// ---------------------------------------------------------------------------

function _adaptRegistry(raw) {
  if (!raw || !raw.components) return [];
  return Object.values(raw.components).map(function (c) {
    var ls = c.layout_spec || {};
    return {
      id:              c.id,
      sourceNodeId:    c._figma_node || null,
      category:        c.category,
      role:            c.role || c.orchestration_type || c.id,
      allowedContexts: c.allowed_contexts || [],
      states:          c.states || ['default'],
      slots:           c.slots || {},
      layoutSpec: {
        minWidth:  ls.min_width  || 0,
        minHeight: ls.min_height || 0,
        padding:   ls.padding    || { top: 0, right: 0, bottom: 0, left: 0 },
        gap:       ls.gap        || 0
      },
      tokens: {
        radius:          c.tokens && c.tokens.radius          || null,
        background:      c.tokens && c.tokens.background      || null,
        textStyleTitle:  c.tokens && c.tokens.text_style_title || c.tokens && c.tokens.textStyleTitle || null,
        textStyleValue:  c.tokens && c.tokens.text_style_value || c.tokens && c.tokens.textStyleValue || null,
        stroke:          c.tokens && c.tokens.stroke           || null
      },
      behavior: {
        interactive:      c.behavior && c.behavior.interactive       || false,
        collapsePriority: c.behavior && c.behavior.collapse_priority || c.behavior && c.behavior.collapsePriority || 0
      }
    };
  });
}

// ---------------------------------------------------------------------------
//  Derive screenContexts from generatorMemory.screens
//  (replaces the old screen_contexts.json — single source of truth)
// ---------------------------------------------------------------------------

function _deriveScreenContexts(gm) {
  if (!gm || !gm.screens) return [];
  return Object.entries(gm.screens).map(function (pair) {
    var key = pair[0], s = pair[1];
    return {
      screenName:           key,
      sourceNodeId:         s.sourceNodeId || null,
      preferredLayoutContainer: s.preferredLayoutContainer,
      outerPadding:         s.outerPadding,
      gridGap:              s.gridGap,
      maxVisibleGroups:     s.maxVisibleGroups,
      mandatoryComponents:  s.mandatoryComponents || [],
      optionalComponents:   s.optionalComponents  || [],
      anchorAreas:          s.anchorAreas || null,
      shellVariants:        s.shellVariants || null
    };
  });
}

(function () {
  var BASE = 'figma-refs/';
  var FILES = {
    registry:        BASE + 'component_registry.json',
    generatorMemory: BASE + 'generator_memory.json'
  };
  var EMPTY_REGISTRY = { components: {} };
  var EMPTY_GENERATOR_MEMORY = { screens: {} };

  // --- Node path (sync require) -------------------------------------------
  if (typeof module !== 'undefined' && module.exports) {
    var path = require('path');
    var fs   = require('fs');
    var load = function (rel) {
      return JSON.parse(fs.readFileSync(path.join(__dirname, rel), 'utf8'));
    };
    var raw = load(FILES.registry);
    var gm  = load(FILES.generatorMemory);
    var designMemory = {
      screenContexts:    _deriveScreenContexts(gm),
      componentRegistry: _adaptRegistry(raw),
      generatorMemory:   gm,
      registryRaw:       raw,
      ready: Promise.resolve()
    };
    module.exports = designMemory;
    module.exports.designMemory = designMemory;
    return;
  }

  // --- Browser path (async fetch) -----------------------------------------
  var designMemory = {
    screenContexts:    null,
    componentRegistry: null,
    generatorMemory:   null,
    registryRaw:       null,
    ready: null
  };

  function fetchOptionalJSON(url, fallback) {
    return fetch(url).then(function (r) {
      if (!r.ok) return fallback;
      return r.json();
    }).catch(function () {
      return fallback;
    });
  }

  designMemory.ready = Promise.all([
    fetchOptionalJSON(FILES.registry, EMPTY_REGISTRY),
    fetchOptionalJSON(FILES.generatorMemory, EMPTY_GENERATOR_MEMORY)
  ]).then(function (results) {
    var raw = results[0], gm = results[1];
    designMemory.screenContexts    = _deriveScreenContexts(gm);
    designMemory.componentRegistry = _adaptRegistry(raw);
    designMemory.generatorMemory   = gm;
    designMemory.registryRaw       = raw;
    return designMemory;
  }).catch(function (err) {
    console.warn('[design_memory] failed to load:', err);
    return designMemory;
  });

  if (typeof window !== 'undefined') {
    window.DesignMemory = designMemory;
  }
})();
