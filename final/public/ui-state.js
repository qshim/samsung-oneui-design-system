// ============================================================================
//  UI STATE MODEL + RESOLVER (Samsung One UI 8.5)
//  ---------------------------------------------------------------------------
//  Single source of truth for genui_pipeline_v1 step_2 (ui_state_resolution).
//  Given a BASE state (surface + overlays) plus an optional USER CONTEXT
//  (attention / mobility / urgency / interaction preference), the resolver
//  produces:
//    - the 9-field UI state (base_surface … background_policy)
//    - the render decision (showWallpaper + backgroundPolicy)
//
//  Exposed as window.UIState for the main page (vanilla JS).
//
//  @typedef {'lock'|'home'|'app'} BaseSurface
//  @typedef {'none'|'launcher'|'app-drawer'|'widget-edit'} HomeSubstate
//  @typedef {'none'|'quick-settings'|'notification-shade'|'system-dialog'} OverlayType
//  @typedef {'none'|'partial'|'full'} OverlayCoverage
//  @typedef {'single'|'split'|'floating'} WindowMode
//  @typedef {'focused'|'glanceable'|'distracted'} AttentionMode
//  @typedef {'expanded'|'normal'|'compressed'} DensityMode
//  @typedef {'touch'|'voice'|'mixed'|'minimal-touch'} InteractionMode
//  @typedef {'stationary'|'walking'|'driving'|'transit'} MobilityMode
//  @typedef {'low'|'medium'|'high'} Urgency
//  @typedef {'wallpaper'|'solid-dark'|'scrim-over-wallpaper'|'scrim-over-app'|'dialog-surface'} BackgroundPolicy
//
//  @typedef {{
//    baseSurface:BaseSurface, homeSubstate:HomeSubstate,
//    overlayType:OverlayType, overlayCoverage:OverlayCoverage,
//    windowMode:WindowMode,
//    attentionMode:AttentionMode, densityMode:DensityMode,
//    interactionMode:InteractionMode,
//    backgroundPolicy:BackgroundPolicy
//  }} UIState
//
//  @typedef {{
//    mobilityMode?:MobilityMode, attentionMode?:AttentionMode,
//    urgency?:Urgency, interactionPreference?:InteractionMode,
//    windowMode?:WindowMode
//  }} UserContext
//
//  @typedef {{showWallpaper:boolean, backgroundPolicy:BackgroundPolicy}} RenderDecision
// ============================================================================

(function (global) {
  'use strict';

  // --------------------------------------------------------------------------
  //  DEFAULTS
  // --------------------------------------------------------------------------

  const DEFAULT_CONTEXT = {
    mobilityMode: 'stationary',
    attentionMode: 'focused',
    urgency: 'low',
    interactionPreference: 'touch',
    windowMode: 'single'
  };

  // --------------------------------------------------------------------------
  //  BACKGROUND POLICY RESOLVER (pure, from base state only)
  // --------------------------------------------------------------------------

  function resolveBackgroundPolicy(state) {
    // System dialog is always isolated.
    if (state.overlayType === 'system-dialog') return 'dialog-surface';

    if (state.baseSurface === 'lock') {
      if (state.overlayType === 'quick-settings' ||
          state.overlayType === 'notification-shade') return 'scrim-over-wallpaper';
      return 'wallpaper';
    }

    if (state.baseSurface === 'home') {
      if (state.overlayType === 'quick-settings' ||
          state.overlayType === 'notification-shade') return 'scrim-over-wallpaper';
      return 'wallpaper';
    }

    if (state.baseSurface === 'app') {
      if (state.overlayType === 'quick-settings' ||
          state.overlayType === 'notification-shade') return 'scrim-over-app';
      return 'solid-dark';
    }

    return 'solid-dark';
  }

  function resolveBackground(state) {
    const policy = resolveBackgroundPolicy(state);
    const showWallpaper = (policy === 'wallpaper' || policy === 'scrim-over-wallpaper');
    return { showWallpaper, backgroundPolicy: policy };
  }

  // --------------------------------------------------------------------------
  //  CONTEXT RESOLVER
  //  Applies the 6 rules from genui_pipeline_v1 step_2.resolver_logic.
  // --------------------------------------------------------------------------

  function resolveUIState(baseState, userContext) {
    const ctx = Object.assign({}, DEFAULT_CONTEXT, userContext || {});

    // Rule 1–4: base_surface / overlay → background_policy (see above)
    const backgroundPolicy = resolveBackgroundPolicy(baseState);

    // Rule 5: driving OR glanceable → density_mode = compressed (preferred)
    let densityMode = 'normal';
    if (ctx.mobilityMode === 'driving' || ctx.attentionMode === 'glanceable') {
      densityMode = 'compressed';
    } else if (ctx.attentionMode === 'focused') {
      densityMode = 'expanded';
    }

    // Rule 6: minimal-touch preference pins interaction_mode
    let interactionMode = ctx.interactionPreference || 'touch';
    if (ctx.interactionPreference === 'minimal-touch') interactionMode = 'minimal-touch';
    // Driving implicitly demotes to minimal-touch unless explicitly set to voice
    if (ctx.mobilityMode === 'driving' && ctx.interactionPreference !== 'voice') {
      interactionMode = 'minimal-touch';
    }

    return {
      baseSurface:     baseState.baseSurface,
      homeSubstate:    baseState.homeSubstate    || 'none',
      overlayType:     baseState.overlayType     || 'none',
      overlayCoverage: baseState.overlayCoverage || 'none',
      windowMode:      baseState.windowMode      || ctx.windowMode || 'single',
      attentionMode:   ctx.attentionMode || 'focused',
      densityMode:     densityMode,
      interactionMode: interactionMode,
      backgroundPolicy: backgroundPolicy
    };
  }

  // --------------------------------------------------------------------------
  //  DEBUG HELPER
  // --------------------------------------------------------------------------

  function debugState(state, userContext) {
    const resolved = resolveUIState(state, userContext);
    const decision = { showWallpaper: (resolved.backgroundPolicy === 'wallpaper' ||
                                       resolved.backgroundPolicy === 'scrim-over-wallpaper'),
                       backgroundPolicy: resolved.backgroundPolicy };
    console.log('UI STATE:',        JSON.stringify(resolved, null, 2));
    console.log('RENDER DECISION:', JSON.stringify(decision, null, 2));
    return { state: resolved, decision };
  }

  // --------------------------------------------------------------------------
  //  SCENARIO → BASE STATE MAP
  //  ------------------------------------------------------------------------
  //  Each genui scenario key maps to a BASE UIState (no user-context fields).
  //  The context overlay (attention/density/interaction) is applied by
  //  resolveUIState() when a userContext is supplied.
  // --------------------------------------------------------------------------

  const SCENARIO_STATES = {
    // LOCK layer
    lockscreen:    { baseSurface:'lock', homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },

    // HOME layer
    home:          { baseSurface:'home', homeSubstate:'launcher', overlayType:'none', overlayCoverage:'none',    windowMode:'single' },

    // SYSTEM OVERLAYS — modelled as sitting over an app by default so the
    // canvas shows scrim-over-app (no wallpaper bleed). Change baseSurface to
    // 'home' if you want to preview the overlay floating over the launcher.
    notifications: { baseSurface:'app',  homeSubstate:'none',     overlayType:'notification-shade', overlayCoverage:'partial', windowMode:'single' },
    quicksettings: { baseSurface:'app',  homeSubstate:'none',     overlayType:'quick-settings',     overlayCoverage:'partial', windowMode:'single' },

    // APP-INTERNAL scenes
    settings:      { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },
    chat:          { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },
    login:         { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },
    product:       { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },
    profile:       { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },
    feed:          { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },
    gallery:       { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },
    dashboard:     { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },
    onboarding:    { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },
    music:         { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },
    smartthings:   { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },
    media:         { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },
    keyboard:      { baseSurface:'app',  homeSubstate:'none',     overlayType:'none', overlayCoverage:'none',    windowMode:'single' },

    // SYSTEM DIALOG preset (use for any modal / confirmation scene)
    dialog:        { baseSurface:'app',  homeSubstate:'none',     overlayType:'system-dialog', overlayCoverage:'full', windowMode:'single' }
  };

  function stateForScenario(scenarioKey) {
    return SCENARIO_STATES[scenarioKey] || {
      baseSurface:'app', homeSubstate:'none',
      overlayType:'none', overlayCoverage:'none', windowMode:'single'
    };
  }

  function decisionForScenario(scenarioKey, userContext) {
    const base = stateForScenario(scenarioKey);
    const resolved = resolveUIState(base, userContext);
    return {
      showWallpaper: (resolved.backgroundPolicy === 'wallpaper' ||
                      resolved.backgroundPolicy === 'scrim-over-wallpaper'),
      backgroundPolicy: resolved.backgroundPolicy
    };
  }

  function resolveForScenario(scenarioKey, userContext) {
    return resolveUIState(stateForScenario(scenarioKey), userContext);
  }

  // --------------------------------------------------------------------------
  //  DOM APPLIER — writes the decision onto a canvas frame element.
  // --------------------------------------------------------------------------

  // CSS hooks consumed by .canvas-frame styles:
  //   data-bg-policy="wallpaper|solid-dark|scrim-over-wallpaper|scrim-over-app|dialog-surface"
  //   data-show-wallpaper="true|false"
  //   data-attention="focused|glanceable|distracted"
  //   data-density="expanded|normal|compressed"
  //   data-interaction="touch|voice|mixed|minimal-touch"
  function applyDecisionToFrame(frameEl, decision, extraState) {
    if (!frameEl || !decision) return;
    frameEl.dataset.bgPolicy      = decision.backgroundPolicy;
    frameEl.dataset.showWallpaper = decision.showWallpaper ? 'true' : 'false';
    if (extraState) {
      if (extraState.attentionMode)   frameEl.dataset.attention   = extraState.attentionMode;
      if (extraState.densityMode)     frameEl.dataset.density     = extraState.densityMode;
      if (extraState.interactionMode) frameEl.dataset.interaction = extraState.interactionMode;
    }

    // Direct style fallback (so it works without the CSS hook)
    if (decision.showWallpaper) {
      frameEl.style.backgroundImage = '';
      frameEl.style.backgroundColor = '';
    } else if (decision.backgroundPolicy === 'dialog-surface') {
      frameEl.style.backgroundImage = 'none';
      frameEl.style.backgroundColor = 'var(--dialog-surface, #1c1c1e)';
    } else {
      // solid-dark or scrim-over-app
      frameEl.style.backgroundImage = 'none';
      frameEl.style.backgroundColor = 'var(--canvas-bg-dark, #010102)';
    }
  }

  function applyScenarioToFrame(frameEl, scenarioKey, userContext) {
    const resolved = resolveForScenario(scenarioKey, userContext);
    const decision = {
      showWallpaper: (resolved.backgroundPolicy === 'wallpaper' ||
                      resolved.backgroundPolicy === 'scrim-over-wallpaper'),
      backgroundPolicy: resolved.backgroundPolicy
    };
    applyDecisionToFrame(frameEl, decision, resolved);
    return { decision, state: resolved };
  }

  // --------------------------------------------------------------------------
  //  EXPORT
  // --------------------------------------------------------------------------

  const api = {
    // Pure resolvers
    resolveBackground,
    resolveBackgroundPolicy,
    resolveUIState,
    // Scenario helpers
    stateForScenario,
    decisionForScenario,
    resolveForScenario,
    // DOM appliers
    applyDecisionToFrame,
    applyScenarioToFrame,
    // Debug
    debugState,
    // Constants
    SCENARIO_STATES,
    DEFAULT_CONTEXT
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.UIState = api;
})(typeof window !== 'undefined' ? window : globalThis);
