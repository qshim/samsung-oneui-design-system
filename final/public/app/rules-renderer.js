// ============================================================================
//  app/rules-renderer.js — paint Generator.*Rules() output onto the canvas
//  ---------------------------------------------------------------------------
//  The grammar-driven rules (lockScreenRules / notificationShadeRules /
//  quickSettingsRules / dialogWidgetRules) return components as:
//    { id, role, position: { x,y,w,h, _cluster, _zone }, variant: {...} }
//
//  This module:
//    1. Maps legacy scenario keys → rule function names (RULES_SCENARIO_MAP).
//    2. Switches #canvas to an absolute-positioned 451×978 container (the
//       reference design viewport). The existing canvas-inner zoom scales it
//       to fit the device frame.
//    3. Walks plan.components and paints each via a role-specific HTML
//       renderer (ROLE_RENDERERS).
//    4. Exposes window.renderFromRules(scenarioKey, uiState) for scenes.js
//       to call from generateScenario().
// ============================================================================

(function (root) {
  'use strict';

  // Legacy scenario key → Generator rule function
  var RULES_SCENARIO_MAP = {
    lockscreen:    'lockScreenRules',
    lock:          'lockScreenRules',
    notifications: 'notificationShadeRules',
    notification:  'notificationShadeRules',
    notif:         'notificationShadeRules',
    quicksettings: 'quickSettingsRules',
    quickSettings: 'quickSettingsRules',
    qs:            'quickSettingsRules',
    dialog:        'dialogWidgetRules'
  };

  // Default uiState per surface so the render looks representative.
  function defaultUiStateFor(scenarioKey) {
    if (scenarioKey === 'lockscreen' || scenarioKey === 'lock') {
      return { overlayType: 'none', attentionMode: 'focused',
               // No hardcoded now-bar tag — let _lockScreenContext randomly
               // shuffle among media / timer / charging on each generation.
               interactionMode: 'touch', contextTags: [] };
    }
    if (scenarioKey === 'notifications' || scenarioKey === 'notification') {
      return { overlayType: 'shade', attentionMode: 'focused',
               contextTags: ['media-playing'] };  // card count randomized 1..3 in rules
    }
    if (scenarioKey === 'quicksettings' || scenarioKey === 'qs') {
      return { overlayType: 'shade', attentionMode: 'focused', contextTags: [] };
    }
    if (scenarioKey === 'dialog') {
      return { baseSurface: 'app', contextTags: ['live-activity:call'] };
    }
    return {};
  }

  function isRulesScenario(key) { return !!RULES_SCENARIO_MAP[key]; }

  // --- Canvas style bookkeeping --------------------------------------------
  // Legacy generateScenario relies on flex column. Rules mode uses absolute
  // positioning. We track which mode we're in on the canvas dataset so we
  // can transition cleanly.
  function enterRulesMode(canvas, viewport) {
    canvas.innerHTML = '';
    canvas.dataset.rulesMode = '1';

    // Canvas is configured identically to Home/List/Detail's
    // renderSurfacePlan setup: explicit 451×978 layout, no transform
    // wrapper. The CSS `zoom:0.78` on `.canvas-inner` visually scales
    // the whole canvas into the device frame. Both paths now produce
    // pixel-identical positioning for shared atomics (status-bar,
    // app-dock, etc.) — earlier the Lock-specific transform:scale on
    // _rulesInner compounded with CSS zoom and rendered 4px off from
    // Home/List/Detail, which made the status bar look shifted.
    canvas.style.display       = 'block';
    canvas.style.position      = 'relative';
    canvas.style.inset         = '';
    canvas.style.flexDirection = '';
    canvas.style.alignItems    = '';
    canvas.style.gap           = '0';
    canvas.style.padding       = '0';
    canvas.style.width         = viewport.width  + 'px';
    canvas.style.height        = viewport.height + 'px';
    canvas.style.overflow      = 'hidden';

    // _rulesInner alias points at the canvas itself — no separate
    // transform-scaled wrapper. Existing callers (interaction-state,
    // scenes.js overlays) keep using `canvas._rulesInner` transparently.
    canvas._rulesInner = canvas;
  }

  // Hide the empty-state hint when rules render (otherwise it overlaps)
  function hideHint() {
    var hint = document.getElementById('canvasHint');
    if (hint) hint.style.display = 'none';
  }

  // ==========================================================================
  //  ROLE RENDERERS — Option B hybrid.
  //  Rules decide WHERE (position, size, zone). Atomics decide WHAT (visual
  //  fidelity). Every renderer delegates to a GalaxyAtomics.* builder so the
  //  rendered output matches the templates.js reference at ~99%.
  // ==========================================================================
  function A() { return root.GalaxyAtomics || {}; }

  // --- Role dispatchers ---------------------------------------------------
  // Rules provide position+variant. Atomics provide HTML. Each role:
  //   1. pulls its variant props
  //   2. delegates to the matching GalaxyAtomics.* builder

  // Lock screen
  function renderStatusBar(comp, plan) {
    return (A().StatusBar || function(){ return ''; })({
      theme: (comp.variant && comp.variant.theme) || 'dark',
      battery: 69, carrier: 'K-Arts'
    });
  }
  function renderLockIcon(comp) { return (A().LockIcon || function(){ return ''; })({ size: 20 }); }
  function renderWeatherDate(comp, plan) {
    var size = (comp.variant && comp.variant.fontSize) || (plan.grammar && plan.grammar.typeScale.title) || 18;
    return (A().WeatherDate || function(){ return ''; })({ fontSize: Math.min(20, size) });
  }
  function renderClock(comp, plan) {
    // Render with the CURRENT real time directly (no post-render text
    // substitution). Earlier version emitted hardcoded ["09","41"] and
    // relied on injectRealtimeDateTime to swap digits, which (a) left the
    // 30s tick unable to update once swapped and (b) could double-replace
    // into weird strings like "3636" if the MAP matched both lines.
    var size = (comp.variant && comp.variant.fontSize) || (plan.grammar && plan.grammar.typeScale.hero) || 120;
    var family = (comp.variant && comp.variant.fontFamily) || null;
    var now = new Date();
    var HH = String(now.getHours()).padStart(2, '0');
    var MM = String(now.getMinutes()).padStart(2, '0');
    return (A().Clock || function(){ return ''; })({
      fontSize: Math.round(size * 1.9), // grammar hero (63) → visual ~120
      time: [HH, MM],
      family: family   // Space Mono via _lockScreenVariant (lock) or default
    });
  }
  function renderWidgetsRow(comp) { return (A().WidgetRow || function(){ return ''; })(); }
  function renderLiveCard(comp) {
    return (A().NowBar || function(){ return ''; })({ variant: 'delivery' });
  }
  function renderUnlockHint(comp, plan) {
    var size = (comp.variant && comp.variant.fontSize) || 13;
    return (A().UnlockHint || function(){ return ''; })({ fontSize: size });
  }
  function renderShortcut(comp) {
    var icon = (comp.variant && comp.variant.icon) || 'phone';
    return (A().ShortcutCircle || function(){ return ''; })({ icon: icon });
  }
  function renderNowBar(comp) {
    var type = (comp.variant && comp.variant.type) || 'dual-line';
    var variant = type === 'media' ? 'media'
               : type === 'charging' ? 'charging'
               : type === 'single-line' ? 'voice'
               : 'delivery';
    return (A().NowBar || function(){ return ''; })({ variant: variant });
  }
  function renderGestureBar(comp) { return (A().GestureBar || function(){ return ''; })(); }

  // Notification shade
  function renderCompactTemporal(comp, plan) {
    var big = (plan.grammar && plan.grammar.typeScale.title) || 32;
    var small = (plan.grammar && plan.grammar.typeScale.small) || 14;
    return '<div style="width:100%;height:100%;display:flex;align-items:baseline;gap:10px;padding:0 16px;box-sizing:border-box;color:#fff;">' +
             '<span style="font-size:' + big + 'px;font-weight:700;">8:21</span>' +
             '<span style="font-size:' + small + 'px;opacity:0.7;">Thu 28 Aug</span>' +
           '</div>';
  }
  function renderSectionLabel(comp) {
    var text = (comp.variant && comp.variant.text) || 'Section';
    return (A().SectionLabel || function(){ return ''; })({ text: text });
  }
  function renderPriorityCard(comp) {
    return (A().MediaCard || function(){ return ''; })({
      title: 'Title', artist: 'Samsung Music · Phone speaker', progress: 0.5
    });
  }
  function renderCompactCard(comp) {
    return (A().LiveNotifPill || function(){ return ''; })({
      text: 'Timer · 04:32 remaining', glyph: '&#9209;'
    });
  }
  // Token helpers (mirror surface-layout's _T/_G/_R for consistency)
  function _t(size, opts) {
    if (root.Generator && typeof root.Generator.typography === 'function') {
      return root.Generator.typography(size, opts || {});
    }
    var pxMap = { micro:10, caption:12, label:14, body:15, title:16, heading:18, large:20, date:24, headline:26 };
    return 'font-size:' + (pxMap[size] || 15) + 'px;font-weight:' + (((opts && opts.weight) === 'bold' || (opts && opts.weight) === 'semibold') ? 600 : 400) + ';color:#fff;';
  }
  function _g(tier) {
    if (root.Generator && typeof root.Generator.glass === 'function') return root.Generator.glass(tier);
    return 'background:rgba(23,23,26,0.3);-webkit-backdrop-filter:blur(25px);backdrop-filter:blur(25px);border:1px solid rgba(255,255,255,0.2);';
  }
  function _r(tier) {
    if (root.Generator && typeof root.Generator.radius === 'function') return root.Generator.radius(tier);
    var rMap = { card:14, medium:18, widget:20, pill:32, dialog:36, panel:40 };
    return (rMap[tier] != null ? rMap[tier] : 14) + 'px';
  }

  function renderNotifCard(comp, plan, idx) {
    var v = (comp && comp.variant) || {};
    var app    = v.app    || 'App';
    var title  = v.title  || '';
    var body   = v.body   || '';
    var time   = v.time   || '';
    var accent = v.accent || '#666';
    var icon   = v.icon   || null;
    var glyph  = v.glyph  || (app.charAt(0).toUpperCase());

    var iconHTML = icon
      ? '<img src="app-icons/' + icon + '" style="width:28px;height:28px;border-radius:' + _r('small') + ';flex-shrink:0;object-fit:cover;">'
      : '<div style="width:28px;height:28px;border-radius:' + _r('small') + ';background:' + accent + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;' +
          _t('caption', { weight: 'bold' }) +
        '">' + glyph + '</div>';

    // panel glass tier (per role → tier map: notifCard/mediaCast → panel)
    // Line-heights bumped so descenders (g / y / p / j / q) don't clip
    // inside the overflow:hidden text cells.
    return (
      '<div style="width:100%;height:100%;' + _g('panel') + 'border-radius:' + _r('card') + ';padding:10px 14px 12px;display:flex;flex-direction:column;gap:3px;box-sizing:border-box;overflow:hidden;">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;line-height:1.4;">' +
          iconHTML +
          '<div style="flex:1;min-width:0;display:flex;align-items:baseline;gap:6px;line-height:1.4;">' +
            '<span style="' + _t('micro', { weight: 'semibold' }) + 'line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + app + '</span>' +
            '<span style="' + _t('micro', { color: 'sectionLabel' }) + 'line-height:1.4;">\u00B7</span>' +
            '<span style="' + _t('micro', { color: 'translucentLabel' }) + 'line-height:1.4;white-space:nowrap;">' + time + '</span>' +
          '</div>' +
        '</div>' +
        '<div style="' + _t('label', { weight: 'semibold' }) + 'line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-bottom:1px;">' + title + '</div>' +
        '<div style="' + _t('caption', { color: 'translucentLabel' }) + 'line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;padding-bottom:1px;">' + body + '</div>' +
      '</div>'
    );
  }

  // Quick settings
  function renderHeaderAction(comp) {
    // QS chrome icon (edit / power / settings). Figma renders these as 25×25
    // icons. We keep the size but add `data-shortcut` so the interact-mode
    // click handler gives a press-animation — they feel like real buttons.
    var icon = (comp.variant && comp.variant.icon) || 'settings';
    // Better vector glyphs (match Figma 989:22473 / 22474 / 22475 closely)
    var SVGS = {
      'edit':     '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 21h3.5L20 7.5 16.5 4 3 17.5V21zM14.5 6L18 9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      'power':    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 4v8M6.5 7a7 7 0 1 0 11 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      'settings': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
    };
    var svg = SVGS[icon] || SVGS['settings'];
    return '<div data-shortcut="1" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.85);transition:transform 120ms ease,background 160ms ease;border-radius:50%;">' + svg + '</div>';
  }
  function renderPrimaryToggle(comp, plan, idx) {
    // Wider Bluetooth-style pill when idx===2 (matches Figma QS top row).
    if (idx === 2) {
      return '<div style="width:100%;height:100%;background:rgba(255,255,255,0.12);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,0.15);border-radius:' + ((comp.position.h || 55) / 2) + 'px;display:flex;align-items:center;padding:0 14px;color:#fff;box-sizing:border-box;gap:10px;">' +
               '<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.85);color:#222;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">&#9741;</div>' +
               '<div style="min-width:0;"><div style="font-size:13px;font-weight:600;">Bluetooth</div><div style="font-size:11px;opacity:0.65;">Josh\'s Watch7</div></div>' +
             '</div>';
    }
    var glyph = idx === 0 ? '&#128246;' : '&#8597;';
    return '<div style="width:100%;height:100%;background:rgba(255,255,255,0.12);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">' +
             '<div style="width:60%;height:60%;border-radius:50%;background:rgba(255,255,255,0.85);color:#222;display:flex;align-items:center;justify-content:center;font-size:18px;">' + glyph + '</div>' +
           '</div>';
  }
  function renderSecondaryToggle(comp) {
    return '<div style="width:100%;height:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.08);border-radius:50%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.45);font-size:18px;">+</div>';
  }
  function renderDragHandle(comp) {
    return '<div style="width:100%;height:100%;border-radius:2px;background:rgba(255,255,255,0.4);"></div>';
  }
  function renderSlider(comp) {
    var r = Math.round((comp.position.w || 40) / 2);
    return '<div style="width:100%;height:100%;background:rgba(23,23,26,0.25);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:0.25px solid rgba(55,55,55,0.3);border-radius:' + r + 'px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:10px 0;gap:12px;box-sizing:border-box;">' +
             '<div style="width:72%;aspect-ratio:1;border-radius:50%;background:rgba(255,255,255,0.9);color:#222;display:flex;align-items:center;justify-content:center;font-size:16px;">&#9728;</div>' +
             '<div style="width:72%;aspect-ratio:1;border-radius:50%;background:rgba(255,255,255,0.9);color:#222;display:flex;align-items:center;justify-content:center;font-size:16px;">&#9834;</div>' +
           '</div>';
  }
  function renderTile(comp, plan, idx) {
    if (idx === 0 || idx === 3) {
      return '<div style="width:100%;height:100%;background:rgba(255,255,255,0.12);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,0.15);border-radius:' + ((comp.position.h || 60) / 2) + 'px;display:flex;align-items:center;padding:0 14px;color:#fff;box-sizing:border-box;gap:10px;">' +
               '<div style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.85);color:#222;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">+</div>' +
               '<div><div style="font-size:13px;font-weight:600;">Title</div><div style="font-size:11px;opacity:0.65;">Subtitle</div></div>' +
             '</div>';
    }
    return '<div style="width:100%;height:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.08);border-radius:50%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.55);font-size:18px;">+</div>';
  }
  function renderMediaCast(comp) {
    return (A().MediaCompact || function(){ return ''; })();
  }
  function renderOverflowToggle(comp) {
    return '<div style="width:100%;height:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.06);border-radius:50%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:16px;opacity:0.7;">+</div>';
  }

  function renderBackground() {
    return (A().Background || function(){ return ''; })();
  }
  function renderQSScreen() {
    return (A().QSScreen || function(){ return ''; })();
  }
  function renderNotifScreen() {
    return (A().NotifScreen || function(){ return ''; })();
  }

  // --- Dialog widget renderers --------------------------------------------
  function renderDimOverlay(comp) {
    // The Dialog's scrim is now handled by the overlay-inner CSS
    // (background + backdrop-filter on the frame-level element), which
    // covers the full phone frame. Rendering the dim-overlay component
    // here at Figma coords (0,0,451,978) inside the zoom:0.78 scaled
    // wrapper only covers ~98% of the frame, producing a visible
    // "tint doesn't match frame" seam on the right + bottom edges.
    //
    // Returning an empty wrapper keeps the plan/DesignDoc node in place
    // (for inspector/evolve tooling) but skips the redundant rendering.
    return '';
  }
  function renderDialogShell(comp) {
    // Delegated to the OneUI atomic library (see app/surface-layout.js
    // renderAtomicForRole — case 'dialog-shell'). Single source of truth
    // so the Design-tab palette and the Dialog overlay render from the
    // same component.
    if (typeof root.renderAtomicForRole === 'function') {
      return root.renderAtomicForRole({ role: 'dialog-shell', variant: comp.variant || {} });
    }
    return '<div style="width:100%;height:100%;background:rgba(23,23,26,0.6);' +
      '-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);' +
      'border-radius:32px;"></div>';
  }
  function renderDialogSiteHeader(comp) {
    // Delegated to OneUI atomic — see app/surface-layout.js
    // 'dialog-site-header' case.
    if (typeof root.renderAtomicForRole === 'function') {
      return root.renderAtomicForRole({ role: 'dialog-site-header', variant: comp.variant || {} });
    }
    return '<div style="width:100%;height:100%;"></div>';
  }
  function renderDialogBrowserBar(comp) {
    // Delegated to OneUI atomic — see app/surface-layout.js
    // 'dialog-browser-bar' case.
    if (typeof root.renderAtomicForRole === 'function') {
      return root.renderAtomicForRole({ role: 'dialog-browser-bar', variant: comp.variant || {} });
    }
    return '<div style="width:100%;height:100%;"></div>';
  }
  function renderDialogIconGrid(comp) {
    // Delegated to OneUI atomic — see app/surface-layout.js
    // 'dialog-icon-grid' case.
    if (typeof root.renderAtomicForRole === 'function') {
      return root.renderAtomicForRole({ role: 'dialog-icon-grid', variant: comp.variant || {} });
    }
    return '<div style="width:100%;height:100%;"></div>';
  }
  function renderDialogPageDots(comp) {
    return (
      '<div style="display:flex;justify-content:center;align-items:center;gap:5px;height:100%;">' +
        '<div style="width:5px;height:5px;border-radius:50%;background:#fff;"></div>' +
        '<div style="width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.3);"></div>' +
      '</div>'
    );
  }

  var ROLE_RENDERERS = {
    // full-screen surfaces (Figma-ground-truth atomics)
    qsScreen:        renderQSScreen,
    notifScreen:     renderNotifScreen,
    // lock screen
    background:      renderBackground,
    statusBar:       renderStatusBar,
    lockIndicator:   renderLockIcon,
    weatherDate:     renderWeatherDate,
    clock:           renderClock,
    widgetsRow:      renderWidgetsRow,
    liveCard:        renderLiveCard,
    unlockHint:      renderUnlockHint,
    shortcutLeft:    renderShortcut,
    shortcutRight:   renderShortcut,
    nowBar:          renderNowBar,
    gestureBar:      renderGestureBar,
    // notification shade
    compactTemporal: renderCompactTemporal,
    sectionLabel:    renderSectionLabel,
    priorityCard:    renderPriorityCard,
    compactCard:     renderCompactCard,
    notifCard:       renderNotifCard,
    // quick settings
    headerAction:    renderHeaderAction,
    primaryToggle:   renderPrimaryToggle,
    secondaryToggle: renderSecondaryToggle,
    dragHandle:      renderDragHandle,
    slider:          renderSlider,
    tile:            renderTile,
    mediaCast:       renderMediaCast,
    overflowToggle:  renderOverflowToggle,
    // dialog widget
    dimOverlay:        renderDimOverlay,
    dialogShell:       renderDialogShell,
    dialogSiteHeader:  renderDialogSiteHeader,
    dialogBrowserBar:  renderDialogBrowserBar,
    dialogIconGrid:    renderDialogIconGrid,
    dialogPageDots:    renderDialogPageDots
  };

  // ==========================================================================
  //  MAIN ENTRY
  // ==========================================================================

  function renderFromRules(scenarioKey, uiState) {
    if (!root.Generator) {
      console.warn('[rules-renderer] Generator not loaded');
      return false;
    }
    var fnName = RULES_SCENARIO_MAP[scenarioKey];
    var fn = fnName && root.Generator[fnName];
    if (typeof fn !== 'function') {
      console.warn('[rules-renderer] No rule function for', scenarioKey);
      return false;
    }

    var canvas = document.getElementById('canvas');
    if (!canvas) return false;

    var viewport = { width: 451, height: 978 };
    var plan = fn(uiState || defaultUiStateFor(scenarioKey), { viewport: viewport });

    enterRulesMode(canvas, viewport);
    hideHint();

    var target = canvas._rulesInner || canvas;

    // Track per-role index (needed for primaryToggle/tile/etc. variants)
    var roleIndex = {};
    var rulesItemCounter = 0;
    plan.components.forEach(function (comp) {
      var role = comp.role;
      var idx = (roleIndex[role] = (roleIndex[role] || 0) + 1) - 1;
      rulesItemCounter++;

      var wrapper = document.createElement('div');
      // Standalone class — do NOT add 'canvas-item' because its CSS
      // (width:fit-content, align-self:flex-start, and img object-fit)
      // breaks absolute-positioned full-surface atomics (QS/Notif/Lock SVGs).
      wrapper.className = 'rules-item';
      wrapper.id = 'rules-item-' + scenarioKey + '-' + rulesItemCounter;
      wrapper.dataset.role = role;
      wrapper.dataset.componentId = comp.id;
      // Bind DOM ↔ design-doc: every node carries a stable id on its wrapper
      wrapper.dataset.nodeId = comp.id || wrapper.id;
      // compType is what refineAutoPrefill reads for labels
      wrapper.dataset.compType = role;
      var p = comp.position || {};
      if (p._cluster) wrapper.dataset.cluster = p._cluster;
      if (p._zone)    wrapper.dataset.zone    = p._zone;

      wrapper.style.position = 'absolute';
      wrapper.style.left   = (p.x || 0) + 'px';
      wrapper.style.top    = (p.y || 0) + 'px';
      wrapper.style.width  = (p.w || 0) + 'px';
      wrapper.style.height = (p.h || 0) + 'px';

      var renderer = ROLE_RENDERERS[role];
      if (renderer) {
        try {
          wrapper.innerHTML = renderer(comp, plan, idx);
        } catch (e) {
          console.warn('[rules-renderer] renderer failed for', role, e);
          wrapper.innerHTML = fallbackHTML(role);
        }
      } else if (typeof window.renderAtomicForRole === 'function') {
        // Bridge to OneUI 8.5 atomics (toggle-chip / slider-pill / control-
        // pill / etc.) — rules can emit these role names directly instead
        // of per-surface dedicated renderers.
        try {
          wrapper.innerHTML = window.renderAtomicForRole(
            comp,
            { w: p.w || 0, h: p.h || 0 }
          );
        } catch (e) {
          console.warn('[rules-renderer] atomic bridge failed for', role, e);
          wrapper.innerHTML = fallbackHTML(role);
        }
      } else {
        wrapper.innerHTML = fallbackHTML(role);
      }

      // ── Interactivity ────────────────────────────────────────────────
      // Info chip (shown on hover / selected / when inspect-mode is on)
      var chip = document.createElement('div');
      chip.className = 'rules-info-chip';
      var zoneTxt    = p._zone    ? ' · ' + p._zone    : '';
      var clusterTxt = p._cluster ? ' · ' + p._cluster : '';
      chip.textContent = role + zoneTxt + clusterTxt + ' · ' + Math.round(p.w||0) + '×' + Math.round(p.h||0);
      wrapper.appendChild(chip);

      // NOTE: click / hover are handled centrally by interaction-state.js via
      // canvas-level pointer tracking + hit-test. No per-item listeners here.

      // Reorderable roles: notif cards, list-items, any column-stacked item.
      // Bottom-anchored chrome (gestureBar / shortcutLeft / shortcutRight /
      // nowBar) is skipped — those can't be reordered.
      var REORDERABLE_ROLES = {
        notifCard:1, 'notif-card':1, 'notif-card-ai':1,
        'list-item':1, paragraph:1, tile:1,
        primaryToggle:1, secondaryToggle:1, priorityCard:1, compactCard:1
      };
      if (REORDERABLE_ROLES[role] && typeof root.attachReorderHandlers === 'function') {
        root.attachReorderHandlers(wrapper, comp.id);
      }

      target.appendChild(wrapper);
    });

    // Visual diagnostic badge + inspect toggle — debug-only, only emitted
    // when explicitly opted in via `window.__rulesBadge = true` (and the
    // corresponding `__rulesInspect`). Production render stays clean.
    if (root.__rulesBadge === true) {
      var badge = document.createElement('div');
      badge.className = 'rules-badge';
      badge.dataset.rulesBadge = '1';
      badge.textContent = 'RULES: ' + scenarioKey + ' (' + plan.components.length + ')';
      badge.style.cssText = 'position:absolute;left:8px;top:8px;padding:3px 8px;' +
        'background:#0FCF6E;color:#000;font-size:9px;font-weight:700;' +
        'border-radius:4px;z-index:999999;font-family:ui-monospace,monospace;pointer-events:none;';
      canvas.appendChild(badge);
    }
    if (root.__rulesInspect === true) {
      var inspect = document.createElement('button');
      inspect.type = 'button';
      inspect.className = 'rules-inspect-toggle';
      inspect.dataset.rulesInspect = '1';
      inspect.textContent = '👁 Inspect';
      inspect.title = 'Show/hide role, cluster, bounding box labels';
      inspect.style.cssText = 'position:absolute;right:8px;top:8px;padding:3px 10px;' +
        'background:rgba(15,207,110,0.15);color:#0FCF6E;border:1px solid #0FCF6E;' +
        'font-size:10px;font-weight:600;border-radius:4px;z-index:999999;' +
        'font-family:ui-monospace,monospace;cursor:pointer;';
      inspect.addEventListener('click', function (e) {
        e.stopPropagation();
        canvas.classList.toggle('rules-inspect-on');
        inspect.style.background = canvas.classList.contains('rules-inspect-on')
          ? '#0FCF6E' : 'rgba(15,207,110,0.15)';
        inspect.style.color = canvas.classList.contains('rules-inspect-on')
          ? '#000' : '#0FCF6E';
      });
      canvas.appendChild(inspect);
    }

    // Expose the most recent plan for debugging
    root.__lastRulesPlan = plan;
    console.log('[rules-renderer] rendered', scenarioKey, '→', plan.components.length, 'components');

    // Hydrate the shared design document so the Design tab can edit this surface
    if (root.DesignDoc && typeof root.DesignDoc.hydrateFromRulesPlan === 'function') {
      root.DesignDoc.hydrateFromRulesPlan(plan, scenarioKey);
    }

    return true;
  }

  function fallbackHTML(role) {
    return '<div style="' + fillStyle() + centerFlex() +
           'border:1px dashed rgba(255,255,255,0.25);color:rgba(255,255,255,0.6);font-size:10px;border-radius:6px;">' +
           role + '</div>';
  }

  // Render a rules plan into a target container without clearing/entering
  // rules-mode. Used for overlay composition (Dialog / QS / Notif pulled over
  // an existing base screen).
  //
  //   opts.scenarioKey: string — used for id prefixing (e.g., 'dialog')
  //   opts.layer:       'overlay' — stamped on data-layer for cleanup/removal
  //   opts.onNode(node) — optional callback for each DOM node created
  function renderPlanIntoTarget(plan, target, opts) {
    opts = opts || {};
    var scenarioKey = opts.scenarioKey || 'plan';
    var layer = opts.layer || 'overlay';
    var roleIndex = {};
    var counter = 0;

    plan.components.forEach(function (comp) {
      var role = comp.role;
      var idx = (roleIndex[role] = (roleIndex[role] || 0) + 1) - 1;
      counter++;

      var wrapper = document.createElement('div');
      wrapper.className = 'rules-item ' + layer + '-item';
      wrapper.id = layer + '-' + scenarioKey + '-' + counter;
      wrapper.dataset.role = role;
      wrapper.setAttribute('data-role', role);
      wrapper.dataset.componentId = comp.id;
      wrapper.dataset.nodeId = comp.id || wrapper.id;
      wrapper.dataset.compType = role;
      wrapper.dataset.layer = layer;

      var p = comp.position || {};
      if (p._cluster) wrapper.dataset.cluster = p._cluster;
      if (p._zone)    wrapper.dataset.zone    = p._zone;

      wrapper.style.position = 'absolute';
      wrapper.style.left   = (p.x || 0) + 'px';
      wrapper.style.top    = (p.y || 0) + 'px';
      wrapper.style.width  = (p.w || 0) + 'px';
      wrapper.style.height = (p.h || 0) + 'px';

      // Staggered enter animation for notification cards so they cascade in
      // when the overlay mounts. Tuned so a 5-card stack finishes at 0.8s:
      //   stagger 80ms × 4 + duration 480ms = 800ms
      // Stagger-enter animation for ANY notification card role (legacy
      // `notifCard` + new atomic `notif-card` / `notif-card-ai`) so they
      // cascade in together regardless of which atomic the rules emit.
      if (layer === 'overlay' &&
          (role === 'notifCard' || role === 'notif-card' || role === 'notif-card-ai')) {
        wrapper.style.animationName = 'notifCardEnter';
        wrapper.style.animationDuration = '480ms';
        wrapper.style.animationTimingFunction = 'cubic-bezier(0.2, 0.8, 0.15, 1)';
        wrapper.style.animationFillMode = 'both';
        wrapper.style.animationDelay = (idx * 80) + 'ms';
      }

      var renderer = ROLE_RENDERERS[role];
      if (renderer) {
        try {
          wrapper.innerHTML = renderer(comp, plan, idx);
        } catch (e) {
          console.warn('[rules-renderer] overlay renderer failed for', role, e);
          wrapper.innerHTML = fallbackHTML(role);
        }
      } else if (typeof window.renderAtomicForRole === 'function') {
        // Bridge to OneUI 8.5 atomics (single-toggle, smart-things,
        // toggle-chip, slider-pill, drag-handle, now-bar, media-output-row,
        // control-pill, qs-action-tile, …). Without this bridge, every QS
        // atomic falls through to fallbackHTML and the overlay shows empty.
        try {
          wrapper.innerHTML = window.renderAtomicForRole(
            comp,
            { w: p.w || 0, h: p.h || 0 }
          );
        } catch (e) {
          console.warn('[rules-renderer] atomic bridge failed in overlay for', role, e);
          wrapper.innerHTML = fallbackHTML(role);
        }
      } else {
        wrapper.innerHTML = fallbackHTML(role);
      }

      // Info chip (hover/selected/inspect) same as base rules-item
      var chip = document.createElement('div');
      chip.className = 'rules-info-chip';
      var zoneTxt    = p._zone    ? ' · ' + p._zone    : '';
      var clusterTxt = p._cluster ? ' · ' + p._cluster : '';
      chip.textContent = role + zoneTxt + clusterTxt + ' · ' + Math.round(p.w||0) + '×' + Math.round(p.h||0);
      wrapper.appendChild(chip);

      target.appendChild(wrapper);
      if (typeof opts.onNode === 'function') opts.onNode(comp, wrapper);
    });

    return counter;
  }

  // Expose globals
  root.renderFromRules = renderFromRules;
  root.renderPlanIntoTarget = renderPlanIntoTarget;
  root.isRulesScenario = isRulesScenario;
  root.RULES_SCENARIO_MAP = RULES_SCENARIO_MAP;

})(typeof window !== 'undefined' ? window : this);
