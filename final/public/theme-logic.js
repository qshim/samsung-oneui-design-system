
'use strict';

/** Theme style + chroma stay on documentElement (renderer reads --oneui-theme-style from :root). All other preset tokens live on #preview-theme-scope so the editor chrome never inherits them. */
var THEME_VARS_DOCUMENT_ONLY = ['--oneui-theme-style', '--oneui-chroma'];

function previewThemeScopeEl() {
  return document.getElementById('preview-theme-scope');
}

/** Element that holds --page-bg, --surface-bg, --text-*, card tokens, etc. */
function themeTokenContext() {
  return previewThemeScopeEl() || document.documentElement;
}

// ---------------------------------------------------------------------------
//  Preview datasets
//  - Normal: /datasets/normalPreviewCards.js → window.NORMAL_PREVIEW_CARDS
//  - Dot:    /datasets/dotPreviewCards.js    → window.DOT_PREVIEW_CARDS
//  Keep them fully separated so "normal" shows only normal, and "dot" only dot.
// ---------------------------------------------------------------------------
let PREVIEW_CARDS = [];
let PREVIEW_CARDS_NORMAL = [];
let PREVIEW_CARDS_DOT = [];

function _cloneCards(cards) {
  try { return JSON.parse(JSON.stringify(cards || [])); }
  catch (_) { return Array.isArray(cards) ? cards.slice() : []; }
}

function setPreviewDataset(kind) {
  const k = (kind === 'dot') ? 'dot' : 'normal';
  PREVIEW_CARDS = (k === 'dot') ? PREVIEW_CARDS_DOT : PREVIEW_CARDS_NORMAL;
  renderPreviewGrid();
  showToast(k === 'dot' ? 'Switched to dot data' : 'Switched to normal data');
}

const TOOLKIT_PREVIEW_SCALE = 0.72;

function shouldUseZoomPreviewForRole(role) {
  // Dot-matrix cards look blurry when downscaled via transform.
  // Using `zoom` keeps the same visual size but typically preserves dot-font crispness.
  return role === 'run-panel' || role === 'composite-set' || (typeof role === 'string' && role.indexOf('dot-') === 0);
}

var DOT_WEATHER_21_W = 168;
var DOT_WEATHER_21_H = 82;
var DOT_WEATHER_21_PAIR_GAP = 12;
var DOT_CAMERA_PREVIEW_SHELL = 82;

function isDotWeather21LightPairCard(card) {
  return !!(card && card.role === 'dot-weather-2x1-v1-1' && (!card.variant || card.variant.theme !== 'dark'));
}

function previewRectForDotWeather21Pair(scale) {
  return {
    w: DOT_WEATHER_21_W * 2 + DOT_WEATHER_21_PAIR_GAP,
    h: DOT_WEATHER_21_H,
    scale: scale || TOOLKIT_PREVIEW_SCALE
  };
}

function renderDotWeather21PairHtml(variant) {
  if (typeof window.renderAtomicForRole !== 'function') return '';
  var baseVariant = variant || {};
  var tileRect = { w: DOT_WEATHER_21_W, h: DOT_WEATHER_21_H };
  var left = window.renderAtomicForRole({ role: 'dot-weather-2x1-v1-1', variant: baseVariant }, tileRect);
  var rightVariant = Object.assign({}, baseVariant, { sunIcon: 'pair-raindrop-dual', weather: 'Rainy' });
  var right = window.renderAtomicForRole({ role: 'dot-weather-2x1-v1-1', variant: rightVariant }, tileRect);
  var pairW = DOT_WEATHER_21_W * 2 + DOT_WEATHER_21_PAIR_GAP;
  return '<div class="dot-weather21-pair" style="display:flex;flex-direction:row;align-items:flex-start;gap:' + DOT_WEATHER_21_PAIR_GAP + 'px;width:' + pairW + 'px;height:' + DOT_WEATHER_21_H + 'px;">' +
    '<div style="flex:0 0 ' + DOT_WEATHER_21_W + 'px;width:' + DOT_WEATHER_21_W + 'px;height:' + DOT_WEATHER_21_H + 'px;">' + left + '</div>' +
    '<div style="flex:0 0 ' + DOT_WEATHER_21_W + 'px;width:' + DOT_WEATHER_21_W + 'px;height:' + DOT_WEATHER_21_H + 'px;">' + right + '</div>' +
  '</div>';
}

function mountDotPairRainMotionInStage(stage) {
  if (!stage) return;
  requestAnimationFrame(function () {
    if (typeof window.initDotPairRainMotion === 'function') {
      initDotPairRainMotion(stage.querySelector('.dot-weather21-pair'));
    }
  });
}

function previewRectForCard(card) {
  const role = card && card.role;
  const variant = (card && card.variant) || {};
  if (isDotWeather21LightPairCard(card)) return previewRectForDotWeather21Pair(TOOLKIT_PREVIEW_SCALE);
  if (role === 'now-bar' && variant.type === 'charging') return { w: 248, h: 64, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'now-bar' && variant.type === 'single-line') return { w: 381, h: 58, scale: TOOLKIT_PREVIEW_SCALE };
  // Navigation copies need width for distance + instruction + ETA; height can grow with 2-line clamp.
  if (role === 'now-bar' && variant.type === 'navigation') return { w: 400, h: 76, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'now-bar' && variant.type === 'media') return { w: 360, h: 96, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'now-bar') return { w: 248, h: 64, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'notif-card' || role === 'notif-card-ai') return { w: 415, h: 86, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'toggle-chip') return { w: 408, h: 88, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'action-row' && variant.previewGallery) return { w: 415, h: 400, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'action-row') return { w: 408, h: 96, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'media-card') return { w: 360, h: 200, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'progress-track') return { w: 360, h: 52, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'run-panel') return { w: 165.38, h: 165.38, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-running') return { w: 297, h: 75, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-running-compact') return { w: 164, h: 82, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-goal') return { w: 340, h: 168, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-call') return { w: 343, h: 75, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-gallery-img') return { w: 168, h: 168, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-gallery-frame1') return { w: 168, h: 168, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-gallery-frame3') return { w: 162, h: 218, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-camera') return { w: 164, h: 246, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-music-1x1') return { w: 168, h: 168, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-music-1x2-actions') return { w: 340, h: 168, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-music-1x2-icon') return { w: 340, h: 168, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-clock-2x1') return { w: 168, h: 64, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-time-matrix') return { w: 340, h: 180, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-schedule-2x2') return { w: 168, h: 168, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-schedule-4x2') return { w: 340, h: 168, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-total-steps-2x1') return { w: 168, h: 82, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-temperature-1x1') return { w: 82, h: 82, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-weather-1x1') return { w: 82, h: 82, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-date-1x1-v1-1') return { w: 82, h: 82, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-date-1x1-v1-2') return { w: 82, h: 82, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'dot-weather-2x1-v1-1') return { w: 168, h: 82, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'composite-set') return { w: 600, h: 600, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'focus-block' && variant.kind === 'weather') return { w: 415, h: 218, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'focus-block' && variant.kind === 'calendar') return { w: 300, h: 128, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'focus-block' && variant.kind === 'input') return { w: 300, h: 168, scale: TOOLKIT_PREVIEW_SCALE };
  if (role === 'focus-block') return { w: 300, h: 112, scale: TOOLKIT_PREVIEW_SCALE };
  return { w: 415, h: 120, scale: TOOLKIT_PREVIEW_SCALE };
}

// ---------------------------------------------------------------------------
//  Editor schema ·groups every customizable CSS variable by section and
//  declares the appropriate input type. Adding a new var here is enough
//  to expose it in the editor panel; no other code needs to change.
//  Type semantics:
//    color      ·native swatch + text (hex, rgb(a), or CSS linear/radial/conic-gradient(...))
//    color-rgba ·<input type="text"> (free-form for rgba/oklch/etc)
//    size       ·<input type="number"> + 'px' suffix
//    weight     ·<select> with 400/500/600/700
//    text       ·<input type="text"> (gradients, letter-spacing strings)
// ---------------------------------------------------------------------------
const THEME_EDIT_SCHEMA = [
  {
    section: 'Typography',
    vars: [
      { key: '--font-family-display',  label: 'Display family',   type: 'text' },
      { key: '--font-family-body',     label: 'Body family',      type: 'text' },
      { key: '--font-family-mono',     label: 'Mono family',      type: 'text' },
      { key: '--font-size-xs',         label: 'Size · xs (meta)',     type: 'size', min: 14, max: 18, step: 1 },
      { key: '--font-size-sm',         label: 'Size · sm (label)',    type: 'size', min: 14, max: 22, step: 1 },
      { key: '--font-size-md',         label: 'Size · md (body)',     type: 'size', min: 14, max: 28, step: 1 },
      { key: '--font-size-lg',         label: 'Size · lg (title)',    type: 'size', min: 16, max: 34, step: 1 },
      { key: '--font-size-xl',         label: 'Size · xl (display)',  type: 'size', min: 18, max: 48, step: 1 },
      { key: '--font-size-display',    label: 'Size · hero heading', type: 'size', min: 20, max: 80, step: 1 },
      { key: '--font-weight-regular',  label: 'Weight · regular', type: 'weight' },
      { key: '--font-weight-medium',   label: 'Weight · medium',  type: 'weight' },
      { key: '--font-weight-semibold', label: 'Weight · semibold',type: 'weight' },
      { key: '--font-weight-bold',     label: 'Weight · bold',    type: 'weight' },
      { key: '--letter-spacing-tight', label: 'Letter spacing · tight',  type: 'text' },
      { key: '--letter-spacing-normal',label: 'Letter spacing · normal', type: 'text' },
      { key: '--letter-spacing-wide',  label: 'Letter spacing · wide',   type: 'text' },
      { key: '--line-height-tight',    label: 'Line height · tight',     type: 'text' },
      { key: '--line-height-normal',   label: 'Line height · normal',    type: 'text' },
      { key: '--line-height-relaxed',  label: 'Line height · relaxed',   type: 'text' }
    ]
  },
  {
    section: 'Spacing scale',
    vars: [
      { key: '--space-xxs', label: 'xxs', type: 'size', min: 0, max: 12, step: 1 },
      { key: '--space-xs',  label: 'xs',  type: 'size', min: 0, max: 16, step: 1 },
      { key: '--space-sm',  label: 'sm',  type: 'size', min: 0, max: 20, step: 1 },
      { key: '--space-md',  label: 'md',  type: 'size', min: 4, max: 28, step: 1 },
      { key: '--space-lg',  label: 'lg',  type: 'size', min: 8, max: 40, step: 1 },
      { key: '--space-xl',  label: 'xl',  type: 'size', min: 12,max: 64, step: 1 }
    ]
  },
  {
    section: 'Composition (screen-level)',
    vars: [
      { key: '--screen-padding-v',     label: 'Screen padding · vertical',   type: 'size', min: 0, max: 48, step: 1 },
      { key: '--screen-padding-h',     label: 'Screen padding · horizontal', type: 'size', min: 0, max: 48, step: 1 },
      { key: '--gap-screen',           label: 'Gap · between groups',         type: 'size', min: 0, max: 48, step: 1 },
      { key: '--gap-cards',            label: 'Gap · between cards',          type: 'size', min: 0, max: 32, step: 1 },
      { key: '--container-margin-bottom', label: 'Container · bottom margin', type: 'size', min: 0, max: 32, step: 1 },
      { key: '--screen-grid-columns',  label: 'Grid columns (1/2/3 or "1fr 2fr")', type: 'text' },
      { key: '--screen-grid-gap',      label: 'Grid gap',                     type: 'size', min: 0, max: 32, step: 1 }
    ]
  },
  {
    section: 'Page',
    vars: [
      { key: '--page-bg',          label: 'Background',     type: 'color' },
      { key: '--text-primary',     label: 'Text · primary', type: 'color' },
      { key: '--text-secondary',   label: 'Text · secondary (rgba)', type: 'color-rgba' },
      { key: '--text-tertiary',    label: 'Text · tertiary (rgba)',  type: 'color-rgba' },
      { key: '--accent-primary',   label: 'Accent · primary (filled)', type: 'color' },
      { key: '--accent-on-primary',label: 'Text on filled accent', type: 'color' }
    ]
  },
  {
    section: 'Card globals',
    vars: [
      { key: '--card-radius',     label: 'Corner radius',     type: 'size', min: 0,  max: 40, step: 1 },
      { key: '--card-padding-v',  label: 'Padding · vertical',type: 'size', min: 0,  max: 40, step: 1 },
      { key: '--card-padding-h',  label: 'Padding · horizontal', type: 'size', min: 0, max: 40, step: 1 },
      { key: '--card-gap',        label: 'Inner gap',         type: 'size', min: 0,  max: 24, step: 1 }
    ]
  },
  {
    section: 'Weather card',
    vars: [
      { key: '--card-weather-accent',          label: 'Accent (icon)',   type: 'color' },
      { key: '--card-weather-temp-color',      label: 'Temp color',      type: 'color' },
      { key: '--card-weather-temp-size',       label: 'Temp size',       type: 'size', min: 16, max: 90, step: 1 },
      { key: '--card-weather-temp-weight',     label: 'Temp weight',     type: 'weight' },
      { key: '--card-weather-temp-letterspacing', label: 'Temp letter-spacing', type: 'text' },
      { key: '--card-weather-icon-size',       label: 'Icon size',       type: 'size', min: 16, max: 80, step: 1 }
    ]
  },
  {
    section: 'Calendar card',
    vars: [
      { key: '--card-calendar-accent',         label: 'Accent (cal icon)', type: 'color' },
      { key: '--card-calendar-time-size',      label: 'Time size',         type: 'size', min: 14, max: 50, step: 1 },
      { key: '--card-calendar-time-weight',    label: 'Time weight',       type: 'weight' }
    ]
  },
  {
    section: 'Reminder card',
    vars: [
      { key: '--card-reminder-accent',         label: 'Accent (checkbox)', type: 'color' },
      { key: '--card-reminder-task-size',      label: 'Task size',         type: 'size', min: 14, max: 28, step: 1 }
    ]
  },
  {
    section: 'Message card',
    vars: [
      { key: '--card-message-avatar-grad',     label: 'Avatar gradient (CSS)', type: 'text' },
      { key: '--card-message-avatar-size',     label: 'Avatar size',           type: 'size', min: 18, max: 56, step: 1 }
    ]
  },
  {
    section: 'ETA card',
    vars: [
      { key: '--card-eta-accent',              label: 'Accent (car icon)', type: 'color' },
      { key: '--card-eta-size',                label: 'ETA size',          type: 'size', min: 18, max: 64, step: 1 },
      { key: '--card-eta-icon-size',           label: 'Icon size',         type: 'size', min: 16, max: 60, step: 1 }
    ]
  },
  {
    section: 'Navigation now-bar',
    vars: [
      { key: '--card-nav-accent',              label: 'Accent (arrow)',    type: 'color' },
      { key: '--card-nav-distance-size',       label: 'Distance size',     type: 'size', min: 12, max: 40, step: 1 },
      { key: '--card-nav-arrow-bg',            label: 'Arrow bg (rgba)',   type: 'color-rgba' }
    ]
  },
  {
    section: 'AI notification',
    vars: [
      { key: '--card-ai-grad',                 label: 'Background gradient', type: 'text' },
      { key: '--card-ai-shimmer-speed',        label: 'Shimmer speed (e.g. 3.6s)', type: 'text' }
    ]
  },
  {
    section: 'Input summary card',
    vars: [
      { key: '--card-input-topic-size',        label: 'Topic size',        type: 'size', min: 14, max: 36, step: 1 }
    ]
  }
];

// ---------------------------------------------------------------------------
//  State
// ---------------------------------------------------------------------------
let THEMES = [];
let ACTIVE_ID = null;
/** When set, left editor shows only THEME_EDIT_SCHEMA sections listed on that preview card (`editSections`). */
let SELECTED_PREVIEW_INDEX = null;
/** Double-click drill-down: show only these CSS var keys in the left editor (subset of current card scope). */
let INSPECTOR_LAYER = null;
/** { idx: preview cell index, path: number[] } ·child indices from `.stage` to the double-clicked element (for outline after re-render). */
let INSPECTOR_DOM_PATH = null;
/** Per preview-cell index: CSS var overrides applied only on that cell (not :root), so edits while a card is selected do not recolor the whole page. */
let PREVIEW_CELL_VAR_OVERRIDES = {};

var _PAGE_EDIT_KEYS = ['--page-bg', '--text-primary', '--text-secondary', '--text-tertiary', '--accent-primary', '--accent-on-primary'];
var _CARD_GLOBAL_KEYS = ['--card-radius', '--card-padding-v', '--card-padding-h', '--card-gap'];
var _SURFACE_THEME_KEYS = [
  '--oneui-theme-style',
  '--surface-bg',
  '--surface-border',
  '--surface-shadow',
  '--surface-filter',
  '--surface-overlay',
  '--surface-overlay-opacity',
  '--surface-bg-size',
  '--surface-animation',
  '--qs-tile-bg',
  '--qs-row-toggle-on-bg',
  '--qs-row-toggle-off-bg',
  '--qs-row-toggle-on-fg',
  '--qs-row-toggle-off-fg',
  '--qs-row-sheen-opacity',
  '--qs-chip-on-bg',
  '--qs-chip-off-bg',
  '--qs-chip-icon-on',
  '--qs-chip-icon-off',
  '--flat-toggle-grid-shell-bg',
  '--flat-toggle-grid-border',
  '--flat-toggle-grid-chip-on-bg',
  '--flat-toggle-grid-chip-off-bg',
  '--flat-toggle-grid-chip-icon-on',
  '--flat-toggle-grid-chip-icon-off',
  '--flat-toggle-grid-text',
  '--flat-toggle-grid-text-secondary',
  '--accent-on-primary',
  '--qs-fallback-toggle-on-bg',
  '--qs-fallback-toggle-off-bg',
  '--nowbar-charging-track-bg',
  '--nowbar-charging-fill-bg',
  '--nowbar-charging-bolt-fill',
  '--nowbar-charging-percent-color',
  '--oneui-chroma'
];
var FLAT_SCHEME = 'dark';
var FLAT_ACCENT = '#a3a3a8';
var FLAT_ACCENT_KEYS = [
  '--card-weather-accent',
  '--card-calendar-accent',
  '--card-reminder-accent',
  '--card-message-avatar-grad',
  '--card-eta-accent',
  '--card-nav-accent'
];
var FLAT_SCHEME_VARS = {
  dark: {
    '--page-bg': '#000000',
    '--text-primary': '#efeef2',
    '--text-secondary': 'rgba(242,242,244,0.68)',
    '--text-tertiary': 'rgba(242,242,244,0.44)',
    '--accent-primary': '#ffffff',
    '--accent-on-primary': '#0d0d0f',
    '--surface-bg': '#1e1e22',
    '--surface-border': 'none',
    '--surface-filter': 'none',
    '--card-ai-grad': '#1e1e22',
    '--card-nav-arrow-bg': 'rgba(255,255,255,0.14)',
    '--qs-tile-bg': '#26262b',
    '--qs-chip-on-bg': '#ffffff',
    '--qs-chip-off-bg': 'rgba(255,255,255,0.14)',
    '--qs-chip-icon-on': '#0d0d0f',
    '--qs-chip-icon-off': '#f2f2f5',
    '--flat-toggle-grid-shell-bg': '#e8e8ec',
    '--flat-toggle-grid-chip-on-bg': '#0d0d0f',
    '--flat-toggle-grid-chip-off-bg': 'rgba(13,13,15,0.08)',
    '--flat-toggle-grid-chip-icon-on': '#f5f5f7',
    '--flat-toggle-grid-chip-icon-off': 'rgba(13,13,15,0.55)'
  },
  light: {
    '--page-bg': '#f7f7f9',
    '--text-primary': '#0a0a0c',
    '--text-secondary': 'rgba(10,10,12,0.68)',
    '--text-tertiary': 'rgba(10,10,12,0.44)',
    '--accent-primary': '#0d0d0f',
    '--accent-on-primary': '#ffffff',
    '--surface-bg': '#f5f5f7',
    '--surface-border': 'none',
    '--surface-filter': 'none',
    '--card-ai-grad': '#f0f0f3',
    '--card-nav-arrow-bg': 'rgba(0,0,0,0.08)',
    '--qs-tile-bg': '#eaeaf0',
    '--qs-chip-on-bg': '#0d0d0f',
    '--qs-chip-off-bg': 'rgba(13,13,15,0.08)',
    '--qs-chip-icon-on': '#fafafa',
    '--qs-chip-icon-off': 'rgba(13,13,15,0.55)',
    '--flat-toggle-grid-shell-bg': '#1e1e22',
    '--flat-toggle-grid-chip-on-bg': '#ffffff',
    '--flat-toggle-grid-chip-off-bg': 'rgba(255,255,255,0.14)',
    '--flat-toggle-grid-chip-icon-on': '#0d0d0f',
    '--flat-toggle-grid-chip-icon-off': '#efeef2',
    '--flat-toggle-grid-text': '#efeef2',
    '--flat-toggle-grid-text-secondary': 'rgba(239,238,242,0.65)'
  }
};

function _styleChainHas(el, root, sub) {
  if (!sub || !el || !root) return false;
  for (var n = el; n && n !== root; n = n.parentElement) {
    if (!n.getAttribute) continue;
    var st = n.getAttribute('style') || '';
    if (st.indexOf(sub) >= 0) return true;
  }
  return false;
}
function _insideSvg(el) {
  return !!(el && el.closest && el.closest('svg'));
}
function _inspectorKindKey(card) {
  if (!card) return 'generic';
  if (card.role === 'focus-block' && card.variant && card.variant.kind) return 'fb-' + card.variant.kind;
  if (card.role === 'notif-card-ai') return 'notif-ai';
  if (card.role === 'notif-card') return 'notif';
  if (card.role === 'now-bar') return 'now-' + ((card.variant && card.variant.type) || 'unknown');
  if (card.role === 'action-row') return 'action-row';
  if (card.role === 'toggle-chip') return 'toggle-chip';
  return 'generic';
}
/**
 * Ordered rules: first matching test wins (most specific first).
 * Each test: (el, stageRoot) -> boolean
 */
var _INSPECTOR_LAYERS = {
  'fb-weather': [
    { label: 'Temperature', keys: ['--card-weather-temp-size', '--card-weather-temp-weight', '--card-weather-temp-color', '--card-weather-temp-letterspacing'],
      test: function (el, root) { return _styleChainHas(el, root, 'card-weather-temp-size') || _styleChainHas(el, root, 'card-weather-temp-color') || _styleChainHas(el, root, 'card-weather-temp-letterspacing'); } },
    { label: 'Weather icon', keys: ['--card-weather-accent', '--card-weather-icon-size'],
      test: function (el, root) { return _styleChainHas(el, root, 'card-weather-icon-size') || (_insideSvg(el) && _styleChainHas(el, root, 'card-weather')); } },
    { label: 'Card shell', keys: _CARD_GLOBAL_KEYS.concat(['--card-weather-accent', '--page-bg']),
      test: function (el, root) { return _styleChainHas(el, root, 'card-radius') && !_styleChainHas(el, root, 'card-weather'); } }
  ],
  'fb-calendar': [
    { label: 'Time', keys: ['--card-calendar-time-size', '--card-calendar-time-weight'],
      test: function (el, root) { return _styleChainHas(el, root, 'card-calendar-time-size'); } },
    { label: 'Calendar icon', keys: ['--card-calendar-accent'],
      test: function (el, root) { return _insideSvg(el) && _styleChainHas(el, root, 'card-calendar-accent'); } },
    { label: 'Card shell', keys: _CARD_GLOBAL_KEYS.concat(_PAGE_EDIT_KEYS),
      test: function (el, root) { return _styleChainHas(el, root, 'card-radius') && !_styleChainHas(el, root, 'card-calendar-time'); } }
  ],
  'fb-reminder': [
    { label: 'Checkbox & accent', keys: ['--card-reminder-accent'],
      test: function (el, root) { return _insideSvg(el) && _styleChainHas(el, root, 'card-reminder-accent'); } },
    { label: 'Task text', keys: ['--card-reminder-task-size', '--text-primary'],
      test: function (el, root) { return _styleChainHas(el, root, 'card-reminder-task-size'); } },
    { label: 'Card shell', keys: _CARD_GLOBAL_KEYS.concat(_PAGE_EDIT_KEYS),
      test: function (el, root) { return _styleChainHas(el, root, 'card-radius') && !_styleChainHas(el, root, 'card-reminder'); } }
  ],
  'fb-message': [
    { label: 'Avatar', keys: ['--card-message-avatar-grad', '--card-message-avatar-size'],
      test: function (el, root) { return _styleChainHas(el, root, 'card-message-avatar'); } },
    { label: 'Text', keys: ['--text-primary', '--text-secondary', '--text-tertiary'],
      test: function (el, root) { return _styleChainHas(el, root, '--text-primary') || _styleChainHas(el, root, '--text-secondary'); } },
    { label: 'Card shell', keys: _CARD_GLOBAL_KEYS.concat(_PAGE_EDIT_KEYS),
      test: function (el, root) { return _styleChainHas(el, root, 'card-radius') && !_styleChainHas(el, root, 'card-message-avatar'); } }
  ],
  'fb-eta': [
    { label: 'ETA number', keys: ['--card-eta-size', '--card-eta-accent', '--card-eta-icon-size'],
      test: function (el, root) { return _styleChainHas(el, root, 'card-eta-size') || (_insideSvg(el) && _styleChainHas(el, root, 'card-eta-accent')); } },
    { label: 'Card shell', keys: _CARD_GLOBAL_KEYS.concat(_PAGE_EDIT_KEYS),
      test: function (el, root) { return _styleChainHas(el, root, 'card-radius') && !_styleChainHas(el, root, 'card-eta-size'); } }
  ],
  'fb-input': [
    { label: 'Topic', keys: ['--card-input-topic-size', '--text-primary'],
      test: function (el, root) { return _styleChainHas(el, root, 'card-input-topic-size'); } },
    { label: 'Card shell', keys: _CARD_GLOBAL_KEYS.concat(_PAGE_EDIT_KEYS),
      test: function (el, root) { return _styleChainHas(el, root, 'card-radius'); } }
  ],
  'notif-ai': [
    { label: 'AI gradient & motion', keys: ['--card-ai-grad', '--card-ai-shimmer-speed'],
      test: function (el, root) { return _styleChainHas(el, root, 'card-ai-grad') || _styleChainHas(el, root, 'aiShimmer'); } },
    { label: 'Glyph area', keys: _PAGE_EDIT_KEYS.concat(['--accent-primary']),
      test: function (el, root) { return _styleChainHas(el, root, 'width:56px;height:56px') && _styleChainHas(el, root, 'backdrop-filter'); } },
    { label: 'Text', keys: ['--text-primary', '--text-secondary'],
      test: function (el, root) { return el.tagName === 'SPAN' && (el.getAttribute('style') || '').indexOf('font-size:15px') >= 0; } }
  ],
  'notif': [
    { label: 'App icon', keys: ['--accent-primary', '--text-primary'],
      test: function (el, root) { return _styleChainHas(el, root, 'width:56px;height:56px') && _styleChainHas(el, root, 'border-radius:50%'); } },
    { label: 'Title & time', keys: ['--text-primary', '--text-secondary'],
      test: function (el, root) {
        if (el.tagName !== 'SPAN') return false;
        var st = el.getAttribute('style') || '';
        return st.indexOf('font-size:15px') >= 0 || st.indexOf('--font-size-xs') >= 0;
      } },
    { label: 'Body', keys: ['--text-secondary', '--text-tertiary'],
      test: function (el, root) {
        var st = el.getAttribute('style') || '';
        if (st.indexOf('font-size:14px') < 0) return false;
        return el.tagName === 'SPAN' || el.tagName === 'DIV';
      } },
    { label: 'Card shell', keys: _CARD_GLOBAL_KEYS.concat(['--page-bg']),
      test: function (el, root) { return _styleChainHas(el, root, 'border-radius:50px'); } }
  ],
  'now-navigation': [
    { label: 'Turn arrow', keys: ['--card-nav-accent', '--card-nav-arrow-bg'],
      test: function (el, root) { return _styleChainHas(el, root, 'card-nav-arrow-bg') || _styleChainHas(el, root, 'card-nav-accent'); } },
    { label: 'Distance', keys: ['--card-nav-distance-size', '--text-primary'],
      test: function (el, root) { return _styleChainHas(el, root, 'card-nav-distance-size'); } },
    { label: 'Instruction & ETA', keys: ['--text-primary', '--text-secondary', '--text-tertiary'],
      test: function (el, root) { return el.tagName === 'DIV' && (el.getAttribute('style') || '').indexOf('--font-size-sm') >= 0; } }
  ],
  'now-single-line': [
    { label: 'Waveform & accent', keys: ['--accent-primary'],
      test: function (el, root) { return (el.getAttribute('style') || '').indexOf('slPulse') >= 0 || (el.getAttribute('style') || '').indexOf('#0381FE') >= 0; } },
    { label: 'Label', keys: ['--text-primary'],
      test: function (el, root) { return el.tagName === 'DIV' && (el.getAttribute('style') || '').indexOf('font-size:15px') >= 0; } }
  ],
  'now-charging': [
    { label: 'Charge fill', keys: ['--accent-primary'],
      test: function (el, root) { return _styleChainHas(el, root, '#0FCF6E') || _styleChainHas(el, root, 'linear-gradient(to right,#0FCF6E'); } },
    { label: 'Percent', keys: ['--text-primary'],
      test: function (el, root) { var st = el.getAttribute('style') || ''; return st.indexOf('font-size:26px') >= 0 && (el.textContent || '').indexOf('%') >= 0; } },
    { label: 'Lightning icon', keys: ['--text-primary', '--accent-primary'],
      test: function (el, root) { return _insideSvg(el) && (el.getAttribute('style') || '').indexOf('fill:#fff') >= 0; } }
  ],
  'action-row': [
    { label: 'Actions & chrome', keys: _PAGE_EDIT_KEYS.concat(_CARD_GLOBAL_KEYS),
      test: function () { return true; } }
  ],
  'toggle-chip': [
    { label: 'Quick toggles', keys: _PAGE_EDIT_KEYS.concat(_CARD_GLOBAL_KEYS),
      test: function () { return true; } }
  ],
  'generic': [
    { label: 'Page & cards', keys: _PAGE_EDIT_KEYS.concat(_CARD_GLOBAL_KEYS),
      test: function () { return true; } }
  ]
};

function _resolveInspectorLayer(card, target, stageRoot) {
  var kind = _inspectorKindKey(card);
  var layers = _INSPECTOR_LAYERS[kind] || _INSPECTOR_LAYERS.generic;
  for (var i = 0; i < layers.length; i++) {
    try {
      if (layers[i].test(target, stageRoot)) return { label: layers[i].label, keys: layers[i].keys.slice() };
    } catch (err) { /* ignore */ }
  }
  return null;
}

// Cross-cutting sections that affect EVERY card type (typography,
// spacing scale, screen-level composition). When the inspector
// filter is active, these sections still show in full so the
// designer can adjust globals without dropping the focus filter.
var ALWAYS_VISIBLE_SECTIONS = [
  'Typography',
  'Spacing scale',
  'Composition (screen-level)'
];

function getActiveEditorSections() {
  var sections = getFilteredSchema();
  if (!INSPECTOR_LAYER || !INSPECTOR_LAYER.keys || !INSPECTOR_LAYER.keys.length) return sections;
  var allow = {};
  INSPECTOR_LAYER.keys.forEach(function (k) { allow[k] = 1; });
  var out = [];
  sections.forEach(function (sec) {
    if (ALWAYS_VISIBLE_SECTIONS.indexOf(sec.section) >= 0) {
      // Pass through unfiltered ·these are cross-cutting tokens.
      out.push(sec);
      return;
    }
    var vs = sec.vars.filter(function (v) { return allow[v.key]; });
    if (vs.length) out.push({ section: sec.section, vars: vs });
  });
  return out.length ? out : sections;
}

// Activate the editor focus by card kind (e.g. 'fb-weather'). Picks
// the broadest layer for that kind ("Card shell") so the user gets
// every variable that touches the card, not just one subzone. Used
// by the Screen-mode preview's card-click handler. Pass null to
// clear the focus.
function setInspectorByKind(kindKey, label) {
  if (kindKey == null) {
    INSPECTOR_LAYER = null;
    INSPECTOR_DOM_PATH = null;
    SELECTED_PREVIEW_INDEX = null;
    buildEditorBody();
    renderPreviewGrid();
    return;
  }
  var layers = _INSPECTOR_LAYERS[kindKey] || _INSPECTOR_LAYERS.generic;
  // The last layer in each kind's list is the broadest ("Card shell" /
  // "Page & cards"). It captures all card-type-specific keys plus the
  // global card shell tokens ·a sensible "show me everything that
  // matters for this card type" default.
  var broadest = layers[layers.length - 1];
  INSPECTOR_LAYER = {
    label: label || (kindKey + ' (full card)'),
    keys:  broadest.keys.slice()
  };
  buildEditorBody();
}

// Map a Screen-preview spec ({role, variant}) to an inspector kind.
function _inspectorKindForSpec(spec) {
  if (!spec || !spec.role) return 'generic';
  if (spec.role === 'focus-block' && spec.variant && spec.variant.kind) {
    return 'fb-' + spec.variant.kind;
  }
  if (spec.role === 'now-bar' && spec.variant && spec.variant.type) {
    return 'now-' + spec.variant.type;
  }
  return spec.role;   // 'action-row' / 'toggle-chip' / etc.
}

function _domPathFromStage(stage, target) {
  if (!stage || !target || !stage.contains(target)) return null;
  var el = target.nodeType === 3 ? target.parentElement : target;
  if (!el || el === stage) return [];
  var path = [];
  for (var n = el; n && n !== stage; n = n.parentElement) {
    if (!n.parentElement) return null;
    var parent = n.parentElement;
    var idx = 0;
    var c = parent.firstElementChild;
    while (c && c !== n) {
      c = c.nextElementSibling;
      idx++;
    }
    if (!c) return null;
    path.unshift(idx);
  }
  return path;
}

function _elFromStagePath(stage, path) {
  if (!stage || !path || !path.length) return null;
  var cur = stage;
  for (var i = 0; i < path.length; i++) {
    cur = cur.children[path[i]];
    if (!cur) return null;
  }
  return cur;
}

function _applyInspectorOutline() {
  var grid = $('preview-grid');
  if (!grid) return;
  var marked = grid.querySelectorAll('.inspector-hit');
  for (var m = 0; m < marked.length; m++) marked[m].classList.remove('inspector-hit');
  if (!INSPECTOR_LAYER || !INSPECTOR_DOM_PATH || !INSPECTOR_DOM_PATH.path || !INSPECTOR_DOM_PATH.path.length) return;
  if (INSPECTOR_DOM_PATH.idx !== SELECTED_PREVIEW_INDEX) return;
  var cell = grid.querySelector('.preview-cell[data-preview-index="' + INSPECTOR_DOM_PATH.idx + '"]');
  if (!cell) return;
  var st = cell.querySelector('.stage');
  if (!st) return;
  var el = _elFromStagePath(st, INSPECTOR_DOM_PATH.path);
  if (el) el.classList.add('inspector-hit');
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------
function $(id) { return document.getElementById(id); }
async function fetchJSON(url, opts) {
  const res = await fetch(url, opts || {});
  if (!res.ok) throw new Error(url + ' ·HTTP ' + res.status);
  return res.json();
}
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 1500);
}

function isFlatThemeActive() {
  return (getComputedStyle(document.documentElement).getPropertyValue('--oneui-theme-style') || '').trim().toLowerCase() === 'flat';
}

function isNeonThemeActive() {
  return (getComputedStyle(document.documentElement).getPropertyValue('--oneui-theme-style') || '').trim().toLowerCase() === 'neon';
}

function solidForGradientValue(value) {
  var v = String(value || '').toLowerCase();
  var styles = getComputedStyle(themeTokenContext());
  var accent = (styles.getPropertyValue('--accent-primary') || FLAT_ACCENT).trim();
  var surface = (styles.getPropertyValue('--surface-bg') || 'rgba(23,23,26,0.80)').trim();
  if (v.indexOf('98dfa9') >= 0 || v.indexOf('31ce8a') >= 0 || v.indexOf('3bd18b') >= 0) return accent;
  return surface;
}

function stripGradientsForFlat(root) {
  if (!root || (!isFlatThemeActive() && !isNeonThemeActive())) return;
  const nodes = [root].concat(Array.from(root.querySelectorAll('[style]')));
  nodes.forEach(function (el) {
    var css = el.getAttribute('style') || '';
    if (!/gradient\(/i.test(css)) return;
    var isGradientText = /background-clip\s*:\s*text|-webkit-background-clip\s*:\s*text/i.test(css);
    if (isGradientText) {
      el.style.background = 'transparent';
      el.style.backgroundImage = 'none';
      el.style.color = 'var(--accent-primary, ' + FLAT_ACCENT + ')';
      el.style.webkitTextFillColor = 'var(--accent-primary, ' + FLAT_ACCENT + ')';
      el.style.webkitBackgroundClip = 'initial';
      el.style.backgroundClip = 'initial';
      return;
    }
    var bg = el.style.background || el.style.backgroundImage || css;
    if (/gradient\(/i.test(bg)) {
      el.style.background = solidForGradientValue(bg);
      el.style.backgroundImage = 'none';
    }
  });
}

function normalizeFlatTextForScheme(root) {
  var style = (getComputedStyle(document.documentElement).getPropertyValue('--oneui-theme-style') || '').trim().toLowerCase();
  if (!root || (style !== 'flat' && style !== 'neon')) return;
  var textPrimary = (getComputedStyle(themeTokenContext()).getPropertyValue('--text-primary') || '').trim().toLowerCase();
  if (!/^#?0a0a0c$|^#?050805$|^#?000/.test(textPrimary)) return;
  const nodes = [root].concat(Array.from(root.querySelectorAll('[style]')));
  nodes.forEach(function (el) {
    if (el.closest && el.closest('svg')) return;
    var css = el.getAttribute('style') || '';
    var touched = false;
    if (/color\s*:\s*(#fff|#ffffff|rgba\(255\s*,\s*255\s*,\s*255)/i.test(css)) {
      el.style.color = 'var(--text-primary,#0a0a0c)';
      touched = true;
    }
    if (/color\s*:\s*#efeef2\b/i.test(css)) {
      el.style.color = 'var(--text-primary,#0a0a0c)';
      touched = true;
    }
    if (/color\s*:\s*#cfcccf\b/i.test(css)) {
      el.style.color = 'var(--text-secondary,rgba(10,10,12,0.68))';
      touched = true;
    }
    if (/stroke\s*:\s*#848487\b/i.test(css)) {
      el.style.stroke = 'var(--text-tertiary,rgba(10,10,12,0.44))';
      touched = true;
    }
    if (/fill\s*:\s*#848487\b/i.test(css)) {
      el.style.fill = 'var(--text-tertiary,rgba(10,10,12,0.44))';
      touched = true;
    }
    if (touched && /webkit-text-fill-color/i.test(css)) el.style.webkitTextFillColor = 'var(--text-primary,#0a0a0c)';
  });
}

function _stripPriorInlineThemeVars() {
  var root = document.documentElement;
  var scope = previewThemeScopeEl();
  ['--pg-bg', '--text', '--primary'].forEach(function (k) {
    root.style.removeProperty(k);
  });
  THEME_EDIT_SCHEMA.forEach(function (section) {
    section.vars.forEach(function (v) {
      var k = v.key;
      root.style.removeProperty(k);
      if (scope && THEME_VARS_DOCUMENT_ONLY.indexOf(k) < 0) scope.style.removeProperty(k);
    });
  });
}

// Apply preset vars: documentElement gets style/chroma only; everything else
// goes on #preview-theme-scope so header · toolbar · left editor stay stable.
function applyThemeVars(vars) {
  const root = document.documentElement;
  const scope = previewThemeScopeEl();
  var isMono = vars && String(vars['--oneui-chroma'] || '').trim().toLowerCase() === 'mono';
  root.classList.toggle('is-mono-chroma', isMono);

  _stripPriorInlineThemeVars();

  _SURFACE_THEME_KEYS.forEach(function (key) {
    var docOnly = THEME_VARS_DOCUMENT_ONLY.indexOf(key) >= 0;
    if (!vars || vars[key] == null || String(vars[key]).trim() === '') {
      if (docOnly) root.style.removeProperty(key);
      else if (scope) scope.style.removeProperty(key);
    }
  });

  if (!vars || !String(vars['--oneui-chroma'] || '').trim()) {
    root.style.removeProperty('--oneui-chroma');
  }

  Object.entries(vars || {}).forEach(([k, v]) => {
    if (THEME_VARS_DOCUMENT_ONLY.indexOf(k) >= 0) {
      root.style.setProperty(k, v);
    } else if (scope) {
      scope.style.setProperty(k, v);
    } else {
      root.style.setProperty(k, v);
    }
  });
}

function flatSchemeVars(scheme) {
  var base = Object.assign({
    '--oneui-theme-style': 'flat',
    '--surface-shadow': 'none',
    '--surface-filter': 'none',
    '--surface-overlay': 'transparent',
    '--surface-overlay-opacity': '0',
    '--surface-bg-size': 'auto',
    '--surface-animation': 'none',
    '--card-ai-shimmer-speed': '0s'
  }, FLAT_SCHEME_VARS[scheme] || FLAT_SCHEME_VARS.dark);
  FLAT_ACCENT_KEYS.forEach(function (key) { base[key] = FLAT_ACCENT; });
  return base;
}

function setFlatScheme(scheme, markUnsaved) {
  FLAT_SCHEME = scheme === 'light' ? 'light' : 'dark';
  var vars = flatSchemeVars(FLAT_SCHEME);
  var scope = previewThemeScopeEl();
  Object.keys(vars).forEach(function (key) {
    if (THEME_VARS_DOCUMENT_ONLY.indexOf(key) >= 0) {
      document.documentElement.style.setProperty(key, vars[key]);
    } else if (scope) {
      scope.style.setProperty(key, vars[key]);
      document.documentElement.style.removeProperty(key);
    } else {
      document.documentElement.style.setProperty(key, vars[key]);
    }
  });
  updateFlatSchemeToggle();
  renderPreviewGrid();
  buildEditorBody();
  if (markUnsaved) _markUnsaved(true);
}

function updateFlatSchemeToggle() {
  var wrap = document.getElementById('flat-scheme-toggle');
  if (!wrap) return;
  var visible = isFlatThemeActive();
  wrap.classList.toggle('visible', visible);
  wrap.querySelectorAll('.flat-scheme-btn').forEach(function (btn) {
    btn.setAttribute('aria-pressed', btn.getAttribute('data-flat-scheme') === FLAT_SCHEME ? 'true' : 'false');
  });
}

// Render every preview card using window.renderAtomicForRole. Called once
// at boot and whenever the theme changes (re-render is cheap; the same
// renderer that the main app uses produces consistent output).
// ---------------------------------------------------------------------------
//  Screen-mode preview ·grid of S26-ratio phones, each showing a
//  DIFFERENT scenario composed with the active theme's tokens. Every
//  slider tweak (font, gap, padding, columns) re-renders all in unison.
//
//  Each scenario is a list of "groups", each group is
//    { items: [{role, variant}, ...], gridable: bool }.
//  Gridable groups respect the --screen-grid-columns token (typically
//  defaults to 2); non-gridable always stack vertically (action rows,
//  hero now-bars, anything that breaks visually in a 2-col layout).
//
//  Each phone intentionally MIXES 1-col and 2-col groups so a single
//  glance shows how the same card type behaves in both contexts
//  (full-width vs. half-width). This is the screen-mode equivalent
//  of the cards-mode "see every card in isolation" ·it surfaces
//  responsive issues the cards mode would hide.
// ---------------------------------------------------------------------------
const SCREEN_PREVIEW_SCENARIOS = [
  {
    label: 'Glance',
    header: 'Today',
    groups: [
      // 2-col: Weather + Calendar side-by-side (the "morning glance" pattern)
      { gridable: true, items: [
        { role: 'focus-block', variant: { kind: 'weather', temp: '23°', condition: 'Partly cloudy', location: 'Seoul', feels: '21°', icon: 'cloud-sun' } },
        { role: 'focus-block', variant: { kind: 'calendar', section: 'NEXT UP · TODAY', time: '9:30 AM', duration: '30 min', title: 'Team stand-up', location: 'Studio A' } }
      ]},
      // 1-col: full-width reminder summary
      { gridable: false, items: [
        { role: 'focus-block', variant: { kind: 'reminder', task: '5 PM', due: 'Review proposal', count: '3', section: 'TODAY · 3 ITEMS' } }
      ]},
      // 2-col: ETA + another reminder ·shows how the same card type
      // (focus-block.reminder) sits as both full-width hero AND
      // half-width tile in the same phone.
      { gridable: true, items: [
        { role: 'focus-block', variant: { kind: 'eta', label: 'COMMUTE', value: '32 min', subtext: 'via Line 2', icon: 'navigation' } },
        { role: 'focus-block', variant: { kind: 'reminder', task: '6 PM', due: 'Pick up dry cleaning', count: '', section: 'NEARBY' } }
      ]}
    ]
  },
  {
    label: 'Cooking',
    header: 'Cooking Assistant',
    groups: [
      { gridable: false, items: [
        { role: 'now-bar', variant: { type: 'timer', label: 'Step 3 of 7', value: '02:30', subtext: 'Saut챕 kimchi' } }
      ]},
      // Single summary card: step topic + ingredient chips (1/2 stays one chip via facet array, not string split)
      { gridable: false, items: [
        { role: 'focus-block', variant: { kind: 'input', section: 'STEP', topic: 'Add cold rice', detail: '', facets: ['Mushrooms 200 g', 'Garlic 2 cloves', 'Cream 1 cup', 'Parmesan 1/2 cup'] } }
      ]},
      { gridable: false, items: [
        { role: 'action-row', variant: { actions: [
          { label: 'Previous', icon: 'skip-back', kind: 'primary' },
          { label: 'Repeat', icon: 'repeat' },
          { label: 'Next', icon: 'skip-forward' }
        ] } }
      ]}
    ]
  },
  {
    label: 'Calendar',
    header: 'Schedule',
    groups: [
      // 2-col: two events side-by-side ·typical agenda dense layout
      { gridable: true, items: [
        { role: 'focus-block', variant: { kind: 'calendar', section: 'TUE · 9:30', time: '9:30 AM', duration: '30 min', title: 'Stand-up', location: 'Studio A' } },
        { role: 'focus-block', variant: { kind: 'calendar', section: 'TUE · 11:00', time: '11:00 AM', duration: '60 min', title: 'Design review', location: 'Room 4' } }
      ]},
      // 1-col: full-width "next event" hero
      { gridable: false, items: [
        { role: 'focus-block', variant: { kind: 'calendar', section: 'TUE · 14:00', time: '2:00 PM', duration: '45 min', title: 'Coffee · Sarah', location: 'Cafe Bene' } }
      ]},
      // 2-col: two reminders ·pre-meeting prep + travel ·that
      // typically accompany calendar items
      { gridable: true, items: [
        { role: 'focus-block', variant: { kind: 'reminder', task: '8:45 AM', due: 'Prep slides', count: '', section: 'PRE-MEETING' } },
        { role: 'focus-block', variant: { kind: 'reminder', task: '1:30 PM', due: 'Leave for Cafe Bene', count: '20 min', section: 'TRAVEL' } }
      ]}
    ]
  },
  {
    label: 'Messages',
    header: 'Messages',
    groups: [
      // 2-col: two message threads side-by-side (inbox-style)
      { gridable: true, items: [
        { role: 'focus-block', variant: { kind: 'message', sender: 'Sarah', preview: 'see you at coffee shop', section: 'MESSAGES · 2 NEW' } },
        { role: 'focus-block', variant: { kind: 'message', sender: 'Mom', preview: 'Got the package ·thanks!', section: '' } }
      ]},
      // 1-col: full-width "newest thread" hero with longer preview
      { gridable: false, items: [
        { role: 'focus-block', variant: { kind: 'message', sender: 'Design team', preview: 'Anyone available for a 15-min sync on the customize panel layout?', section: 'GROUP · 3 NEW' } }
      ]},
      // 1-col action row
      { gridable: false, items: [
        { role: 'action-row', variant: { actions: [{ label: 'Reply' }, { label: 'Mark read' }, { label: 'Mute' }] } }
      ]}
    ]
  },
  {
    label: 'Navigation',
    header: 'Driving',
    groups: [
      // 1-col hero: now-bar with turn instruction (always full-width)
      { gridable: false, items: [
        { role: 'now-bar', variant: { type: 'navigation', distance: '200 m', instruction: 'Turn right onto Hangang-daero', eta: '8 min' } }
      ]},
      // 2-col: ETA card + parking reminder ·common driving HUD pair
      { gridable: true, items: [
        { role: 'focus-block', variant: { kind: 'eta', label: 'ARRIVAL', value: '15:24', subtext: '12 min', icon: 'navigation' } },
        { role: 'focus-block', variant: { kind: 'reminder', task: 'On arrival', due: 'Find parking near gate 3', count: '', section: 'AT DESTINATION' } }
      ]},
      // 1-col action row
      { gridable: false, items: [
        { role: 'action-row',  variant: { actions: [{ label: 'Reroute' }, { label: 'Stop' }, { label: 'Voice' }] } }
      ]}
    ]
  },
  {
    label: 'Search',
    header: 'Search',
    groups: [
      // 1-col input summary with facet chips (chip row needs width)
      { gridable: false, items: [
        { role: 'focus-block', variant: { kind: 'input', section: 'SEARCH · COFFEE SHOPS', topic: 'Found 12 nearby', detail: '', facets: ['Vegetarian', '< 1 km', 'Open now'] } }
      ]},
      // 2-col: top 2 results side-by-side // the typical SERP card grid
      { gridable: true, items: [
        { role: 'focus-block', variant: { kind: 'reminder', task: '0.4 km', due: 'Cafe Bene · Hapjeong', count: '4.6', section: 'TOP RESULT' } },
        { role: 'focus-block', variant: { kind: 'reminder', task: '0.6 km', due: 'Blue Bottle · Yeonnam', count: '4.7', section: '#2' } }
      ]},
      // 1-col action row
      { gridable: false, items: [
        { role: 'action-row',  variant: { actions: [{ label: 'Open' }, { label: 'Save' }, { label: 'Call' }] } }
      ]}
    ]
  },
  {
    label: 'Music',
    header: 'Your Music',
    groups: [
      { gridable: false, items: [
        { role: 'action-row', variant: { actions: [
          { label: 'Previous', icon: 'skip-back', kind: 'primary' },
          { label: 'Pause', icon: 'pause' },
          { label: 'Next', icon: 'skip-forward' }
        ] } }
      ]},
      { gridable: true, items: [
        { role: 'notif-card', variant: { title: 'Spotify', body: 'Now playing · Blend Mix', time: 'Live', glyph: 'S', accent: '#1DB954' } },
        { role: 'progress-track', variant: { left: '1:42 elapsed', right: '2:18 left', percent: 38 } }
      ]},
      { gridable: false, items: [
        { role: 'now-bar', variant: {
          type: 'media',
          title: 'Blinding Lights',
          artist: 'The Weeknd',
          marquee: 'Blinding Lights · The Weeknd · After Hours',
          imgBg: '#E91E8C'
        } }
      ]}
    ]
  }
];

// Map screen-preview spec ·matching THEME_EDIT_SCHEMA section name.
// Used both by the right-pane card label (so the badge above the
// matching cards reads "Navigation now-bar" not "navigation") AND
// by the left-pane section-heading highlighter (so we can mark the
// section that's currently focused with the same blue accent).
const _SECTION_FOR_KIND = {
  'fb-weather':    'Weather card',
  'fb-calendar':   'Calendar card',
  'fb-reminder':   'Reminder card',
  'fb-message':    'Message card',
  'fb-eta':        'ETA card',
  'fb-input':      'Input summary card',
  'now-navigation':'Navigation now-bar',
  'now-media':     'Now playing',
  'now-timer':     'Timer',
  'now-charging':  'Battery / charging',
  'notif-ai':      'AI notification',
  'action-row':    'Card globals',
  'toggle-chip':   'Card globals',
  'generic':       'Card globals'
};

function _kindReadableName(spec) {
  if (!spec) return '';
  const kind = _inspectorKindForSpec(spec);
  const sectionName = _SECTION_FOR_KIND[kind];
  if (sectionName) return sectionName;
  if (spec.role) return String(spec.role).replace(/[-_]/g, ' ');
  return 'card';
}

// Resolve the schema section name that goes with the currently
// active inspector filter, so buildEditorBody can mark its heading
// with the .is-active-section class for the blue highlight.
function _activeSectionName() {
  if (!INSPECTOR_LAYER) return null;
  const k = INSPECTOR_LAYER._screenKind;
  if (k && _SECTION_FOR_KIND[k]) return _SECTION_FOR_KIND[k];
  return null;
}

function _renderAtomicCard(spec) {
  if (!spec || typeof window.renderAtomicForRole !== 'function') return null;
  const html = window.renderAtomicForRole({ role: spec.role, variant: spec.variant }, { x: 0, y: 0, w: 360, h: 120 });
  const inner = document.createElement('div');
  inner.innerHTML = html;
  const atomic = inner.firstElementChild || inner;

  // Wrap the atomic so we can overlay an invisible-by-default kind
  // label that turns blue when the editor focus matches this card's
  // kind. Click handler lives on the wrap so the entire card surface
  // is clickable.
  const wrap = document.createElement('div');
  wrap.className = 'preview-card-wrap';
  wrap.style.cursor = 'pointer';
  wrap.dataset.previewKind = _inspectorKindForSpec(spec);
  wrap.appendChild(atomic);

  const label = document.createElement('span');
  label.className = 'preview-card-kind-label';
  label.textContent = _kindReadableName(spec);
  wrap.appendChild(label);

  wrap.addEventListener('click', function (e) {
    e.stopPropagation();
    var kind = wrap.dataset.previewKind;
    var displayLabel = _kindReadableName(spec) + ' · click anywhere off card to clear';
    if (INSPECTOR_LAYER && INSPECTOR_LAYER._screenKind === kind) {
      // Toggle off if clicking the same kind again.
      setInspectorByKind(null);
    } else {
      setInspectorByKind(kind, displayLabel);
      if (INSPECTOR_LAYER) INSPECTOR_LAYER._screenKind = kind;
    }
    _highlightActiveScreenCards();
  });
  return wrap;
}

// Show the per-card kind label in blue on every wrap whose kind
// matches the active editor focus. Other cards stay invisible. The
// CSS handles the actual color / visibility transition; this just
// flips data-active on the wrappers.
function _highlightActiveScreenCards() {
  var grid = document.getElementById('preview-screen-grid');
  if (!grid) return;
  var activeKind = (INSPECTOR_LAYER && INSPECTOR_LAYER._screenKind) || null;
  grid.querySelectorAll('.preview-card-wrap[data-preview-kind]').forEach(function (el) {
    var match = activeKind && el.dataset.previewKind === activeKind;
    el.dataset.active = match ? 'true' : 'false';
  });
}

function _buildScenarioPhone(scenario, gridCols) {
  const phone = document.createElement('div');
  phone.className = 'preview-phone-frame';

  const labelEl = document.createElement('div');
  labelEl.className = 'preview-phone-label';
  labelEl.textContent = scenario.label;
  phone.appendChild(labelEl);

  const canvas = document.createElement('div');
  canvas.className = 'preview-phone-canvas';

  // Status bar line + header text.
  const chrome = document.createElement('div');
  chrome.className = 'preview-screen-chrome';
  chrome.innerHTML = '<span>9:41</span><span>· · · ·</span>';
  canvas.appendChild(chrome);

  if (scenario.header) {
    const header = document.createElement('div');
    header.className = 'preview-screen-header';
    header.textContent = scenario.header;
    canvas.appendChild(header);
  }

  // Unified group iteration. Each scenario declares `groups`: an array
  // of { items, gridable } objects rendered in order. Mixing 1-col
  // and 2-col groups inside one phone is the whole point ·it lets
  // the designer see the same card type at full width AND half
  // width on a single screen, surfacing responsive issues.
  //
  // Backward compat: if a scenario still uses the legacy
  // primary/primaryGridable + secondary shape, synthesize a groups
  // array from those fields so nothing breaks during migration.
  const groups = Array.isArray(scenario.groups)
    ? scenario.groups
    : [
        ...(Array.isArray(scenario.primary)   && scenario.primary.length   ? [{ items: scenario.primary,   gridable: !!scenario.primaryGridable }]   : []),
        ...(Array.isArray(scenario.secondary) && scenario.secondary.length ? [{ items: scenario.secondary, gridable: false }] : [])
      ];

  groups.forEach(group => {
    if (!group || !Array.isArray(group.items) || !group.items.length) return;
    const groupEl = document.createElement('div');
    // gridable groups respect the --screen-grid-columns token. If the
    // token is "1" (or empty) the group stacks even when gridable ·    // honors the designer's intent when they globally set 1-column
    // mode from the editor.
    const useGrid = group.gridable && gridCols !== '1' && gridCols !== '';
    groupEl.className = 'preview-screen-group' + (useGrid ? ' is-grid' : '');
    // Custom fr-based templates (e.g. "1fr 2fr") pass through verbatim;
    // simple numeric values use the .is-grid default of 2 cols.
    if (useGrid && /\bfr\b/.test(gridCols)) groupEl.style.gridTemplateColumns = gridCols;
    group.items.forEach(spec => {
      const el = _renderAtomicCard(spec);
      if (el) groupEl.appendChild(el);
    });
    canvas.appendChild(groupEl);
  });

  phone.appendChild(canvas);
  return phone;
}

function renderScreenPreview() {
  const grid = document.getElementById('preview-screen-grid');
  if (!grid) return;
  if (typeof window.renderAtomicForRole !== 'function') {
    grid.innerHTML = '<div style="color:var(--text-3);padding:24px;font-size:12px;text-align:center;grid-column:1/-1;">renderer not yet ready</div>';
    return;
  }
  const cols = (getComputedStyle(document.documentElement).getPropertyValue('--screen-grid-columns') || '1').trim();
  grid.innerHTML = '';
  SCREEN_PREVIEW_SCENARIOS.forEach(scenario => {
    grid.appendChild(_buildScenarioPhone(scenario, cols));
  });
  // Click on the grid background (between phones) clears the focus.
  grid.addEventListener('click', function (e) {
    if (e.target === grid) setInspectorByKind(null);
  }, { once: false });
  // Restore highlight if a filter is already active (e.g. after re-render).
  _highlightActiveScreenCards();
}

// Mode switching: toggle visibility of preview-grid vs preview-screen-wrap.
let PREVIEW_MODE = 'cards';
function setPreviewMode(mode) {
  PREVIEW_MODE = mode === 'screen' ? 'screen' : 'cards';
  const grid = document.getElementById('preview-grid');
  const screen = document.getElementById('preview-screen-wrap');
  const title = document.getElementById('preview-mode-title');
  if (grid)   grid.style.display   = (PREVIEW_MODE === 'cards')  ? '' : 'none';
  if (screen) screen.style.display = (PREVIEW_MODE === 'screen') ? '' : 'none';
  if (title)  title.textContent    = (PREVIEW_MODE === 'cards')
    ? 'Live preview · all themed cards'
    : 'Live preview · screen composition';
  // Sync button states.
  document.querySelectorAll('.preview-mode-btn').forEach(btn => {
    const isActive = btn.dataset.mode === PREVIEW_MODE;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  if (PREVIEW_MODE === 'screen') renderScreenPreview();
}
(function _wirePreviewMode() {
  document.querySelectorAll('.preview-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setPreviewMode(btn.dataset.mode));
  });
  // URL deep-link: ?mode=screen activates the Screen preview on boot
  // so headless-Chrome screenshot runs can capture both modes without
  // needing to script a click.
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('mode') === 'screen') {
      // Defer one tick so renderAtomicForRole (loaded by trailing
      // ) has a chance to register before renderScreenPreview
      // runs.
      setTimeout(() => setPreviewMode('screen'), 0);
    }
  } catch (_) {}
})();

function renderPreviewGrid() {
  // When screen mode is active, also re-render the screen preview so
  // a token edit shows up in the live phone frame.
  if (PREVIEW_MODE === 'screen') renderScreenPreview();
  const grid = $('preview-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const orderedPreviewCards = PREVIEW_CARDS
    .map((card, idx) => ({ card, idx, rect: previewRectForCard(card) }))
    .sort((a, b) => {
      // Prioritize composite sets to the top
      if (a.card.role === 'composite-set' && b.card.role !== 'composite-set') return -1;
      if (a.card.role !== 'composite-set' && b.card.role === 'composite-set') return 1;

      const h = (a.rect.h * (a.rect.scale || 1)) - (b.rect.h * (b.rect.scale || 1));
      if (Math.abs(h) > 0.5) return h;
      return (a.rect.w * (a.rect.scale || 1)) - (b.rect.w * (b.rect.scale || 1));
    });
  orderedPreviewCards.forEach(({ card, idx, rect }) => {
    const cell = document.createElement('div');
    cell.className = 'preview-cell' + (SELECTED_PREVIEW_INDEX === idx ? ' selected' : '');
    cell.setAttribute('data-preview-index', String(idx));
    cell.setAttribute('role', 'button');
    cell.setAttribute('tabindex', '0');
    cell.setAttribute('aria-pressed', SELECTED_PREVIEW_INDEX === idx ? 'true' : 'false');
    cell.setAttribute('aria-label', card.name + ' \u2014 \ud074\ub9ad\ud558\uba74 \uc774 \uce74\ub4dc\uc5d0 \ud574\ub2f9\ud558\ub294 \ud14c\ub9c8 \ubcc0\uc218\ub9cc \ud45c\uc2dc');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = card.name;
    const stage = document.createElement('div');
    stage.className = 'stage';
    const previewRect = rect;
    const previewScale = previewRect.scale || 1;
    const useZoomPreview = shouldUseZoomPreviewForRole(card && card.role);
    const isDotCameraCard = card.role === 'dot-camera';
    const stageW = isDotCameraCard ? DOT_CAMERA_PREVIEW_SHELL : previewRect.w;
    const stageH = isDotCameraCard ? DOT_CAMERA_PREVIEW_SHELL : previewRect.h;
    let html = '';
    try {
      if (card.role === 'composite-set') {
        const children = (card.variant && card.variant.children) || [];
        
        // Calculate actual bounding box of children for perfect centering
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (children.length > 0) {
          children.forEach(c => {
            minX = Math.min(minX, c.x);
            minY = Math.min(minY, c.y);
            maxX = Math.max(maxX, c.x + c.w);
            maxY = Math.max(maxY, c.y + c.h);
          });
        } else {
          minX = 0; minY = 0; maxX = 340; maxY = 340;
        }

        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const offsetX = (previewRect.w - contentW) / 2 - minX;
        const offsetY = (previewRect.h - contentH) / 2 - minY;

        html = '<div class="composite-set-container theme-preview-container" style="position:relative; width:' + previewRect.w + 'px; height:' + previewRect.h + 'px;">';
        if (children.length === 0) {
          html += '<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.15); font-size:14px; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Empty Set</div>';
        }
        children.forEach(child => {
          if (typeof window.renderAtomicForRole === 'function') {
            const childHtml = window.renderAtomicForRole({ role: child.role, variant: child.variant || {} }, { w: child.w, h: child.h });
            const left = child.x + offsetX;
            const top = child.y + offsetY;
            const isMusic = child.role === 'dot-music-1x1';
            html += '<div class="composite-child' + (isMusic ? ' is-orange' : '') + '" data-comp-role="' + child.role + '" style="position:absolute; left:' + left + 'px; top:' + top + 'px; width:' + child.w + 'px; height:' + child.h + 'px;">' + childHtml + '</div>';
          }
        });
        html += '</div>';
      } else if (isDotWeather21LightPairCard(card)) {
        html = renderDotWeather21PairHtml(card.variant);
        if (!html) html = '<div style="padding:20px;color:var(--text-3);">renderer not loaded</div>';
      } else {
        const comp = { role: card.role, variant: card.variant, content: card.content || {} };
        if (typeof window.renderAtomicForRole === 'function') {
          html = window.renderAtomicForRole(comp, { x: 0, y: 0, w: previewRect.w, h: previewRect.h });
        } else {
          html = '<div style="padding:20px;color:var(--text-3);">renderer not loaded</div>';
        }
      }
    } catch (e) {
      html = '<div style="padding:20px;color:var(--warning);">render error: ' + e.message + '</div>';
    }
    var scaleStyle = useZoomPreview
      ? ('zoom:' + previewScale + ';transform:none;')
      : ('transform:scale(' + previewScale + ');');
    stage.innerHTML =
      '<div class="stage-scale" style="width:' + stageW + 'px;' +
      'min-height:' + stageH + 'px;height:auto;' +
      scaleStyle + '">' + html + '</div>';
    const scaleRoot = stage.firstElementChild;
    const cardRoot = scaleRoot && scaleRoot.firstElementChild;
    if (cardRoot && !isDotCameraCard) {
      cardRoot.style.width = previewRect.w + 'px';
      cardRoot.style.minHeight = previewRect.h + 'px';
      // Dot cards rely heavily on absolute positioning (fixed-size layouts).
      // Forcing height:auto in the preview causes contents to collapse/squish.
      if (useZoomPreview) cardRoot.style.height = previewRect.h + 'px';
      else cardRoot.style.height = 'auto';
      cardRoot.style.maxWidth = 'none';
      cardRoot.style.flex = 'none';
    }
    stripGradientsForFlat(stage);
    normalizeFlatTextForScheme(stage);
    if (isDotWeather21LightPairCard(card)) mountDotPairRainMotionInStage(stage);
    if (scaleRoot) {
      void scaleRoot.offsetHeight;
      if (useZoomPreview) {
        // Dot cards are fixed-size: avoid measuring zoomed layout and double-scaling.
        stage.style.width = Math.ceil(stageW * previewScale) + 'px';
        stage.style.height = Math.ceil(stageH * previewScale) + 'px';
      } else {
        var crH = 0;
        if (cardRoot && typeof cardRoot.getBoundingClientRect === 'function') {
          crH = Math.ceil(cardRoot.getBoundingClientRect().height);
        }
        var logicalH = Math.max(previewRect.h, scaleRoot.scrollHeight, crH) + 12;
        var scaledH = Math.ceil(logicalH * previewScale);
        var scaledW = Math.ceil(previewRect.w * previewScale);
        stage.style.width = scaledW + 'px';
        stage.style.height = scaledH + 'px';
      }
    } else {
      stage.style.width = Math.ceil(previewRect.w * previewScale) + 'px';
      stage.style.height = Math.ceil(previewRect.h * previewScale) + 'px';
    }
    stage.title = 'Double-click inside the card to inspect a part (Figma-style)';
    cell.appendChild(name);
    cell.appendChild(stage);
    var ovr = PREVIEW_CELL_VAR_OVERRIDES[idx];
    if (ovr) {
      Object.keys(ovr).forEach(function (k) {
        var val = ovr[k];
        if (val == null || String(val).trim() === '') return;
        cell.style.setProperty(k, val);
      });
      if (ovr['--page-bg']) cell.style.setProperty('--pg-bg', ovr['--page-bg']);
      if (ovr['--text-primary']) cell.style.setProperty('--text', ovr['--text-primary']);
      if (ovr['--accent-primary']) cell.style.setProperty('--primary', ovr['--accent-primary']);
    }
    grid.appendChild(cell);
  });
  _applyInspectorOutline();
}

// ---------------------------------------------------------------------------
//  Editor ·builds the property-edit panel from THEME_EDIT_SCHEMA, wires
//  every input to live :root updates, and provides a "Save as Custom..."
//  flow that POSTs the current var snapshot to /api/themes.
// ---------------------------------------------------------------------------
function _scopedPreviewCell() {
  if (SELECTED_PREVIEW_INDEX == null || SELECTED_PREVIEW_INDEX < 0) return null;
  var grid = $('preview-grid');
  if (!grid) return null;
  return grid.querySelector('.preview-cell[data-preview-index="' + SELECTED_PREVIEW_INDEX + '"]');
}

function _readVarFromRootOnly(key) {
  if (THEME_VARS_DOCUMENT_ONLY.indexOf(key) >= 0) {
    var root = document.documentElement;
    var inlineDoc = root.style.getPropertyValue(key);
    if (inlineDoc) return inlineDoc.trim();
    return getComputedStyle(root).getPropertyValue(key).trim();
  }
  var scope = previewThemeScopeEl();
  if (scope) {
    var inl = scope.style.getPropertyValue(key);
    if (inl) return inl.trim();
    var fromScope = getComputedStyle(scope).getPropertyValue(key);
    if (fromScope && fromScope.trim()) return fromScope.trim();
  }
  var root = document.documentElement;
  var inline = root.style.getPropertyValue(key);
  if (inline) return inline.trim();
  return getComputedStyle(root).getPropertyValue(key).trim();
}

function _readVar(key) {
  var idx = SELECTED_PREVIEW_INDEX;
  if (idx != null && idx >= 0) {
    var bag = PREVIEW_CELL_VAR_OVERRIDES[idx];
    if (bag && bag[key] != null && String(bag[key]).trim() !== '') {
      return String(bag[key]).trim();
    }
    var cell = _scopedPreviewCell();
    if (cell) {
      var fromCell = getComputedStyle(cell).getPropertyValue(key);
      if (fromCell && fromCell.trim()) return fromCell.trim();
    }
  }
  return _readVarFromRootOnly(key);
}

function _writeVar(key, value) {
  if ((isFlatThemeActive() || isNeonThemeActive()) && _isCssGradient(value)) {
    value = solidForGradientValue(value);
  }
  var idx = SELECTED_PREVIEW_INDEX;
  if (idx != null && idx >= 0) {
    if (!PREVIEW_CELL_VAR_OVERRIDES[idx]) PREVIEW_CELL_VAR_OVERRIDES[idx] = {};
    PREVIEW_CELL_VAR_OVERRIDES[idx][key] = value;
    var cell = _scopedPreviewCell();
    if (cell) {
      cell.style.setProperty(key, value);
      if (key === '--page-bg') cell.style.setProperty('--pg-bg', value);
      if (key === '--text-primary') cell.style.setProperty('--text', value);
      if (key === '--accent-primary') cell.style.setProperty('--primary', value);
    }
    _markUnsaved(true);
    return;
  }
  if (THEME_VARS_DOCUMENT_ONLY.indexOf(key) >= 0) {
    document.documentElement.style.setProperty(key, value);
  } else {
    var scope = previewThemeScopeEl();
    if (scope) {
      scope.style.setProperty(key, value);
      document.documentElement.style.removeProperty(key);
    } else {
      document.documentElement.style.setProperty(key, value);
    }
  }
  _markUnsaved(true);
}

// Unsaved-state tracker. Toggles the toolbar pill so the user knows
// their slider tweaks are LIVE-PREVIEWED only ·clicking the dropdown
// to a preset, clicking Save, or clicking Discard all reset this back
// to a clean state.
let HAS_UNSAVED_EDITS = false;
function _markUnsaved(flag) {
  HAS_UNSAVED_EDITS = !!flag;
  const pill = document.getElementById('unsaved-pill');
  if (pill) pill.style.display = HAS_UNSAVED_EDITS ? '' : 'none';
}
// Convert any color expression (hex, rgb, rgba) into a 6-digit hex for
// the <input type="color"> element. Falls back to '#000000' if it can't.
function _toHex6(value) {
  if (!value) return '#000000';
  const v = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v;
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    return '#' + v.slice(1).split('').map(c => c + c).join('');
  }
  // Use a temporary canvas to parse rgb()/rgba()/named colors.
  try {
    const tmp = document.createElement('div');
    tmp.style.color = v;
    document.body.appendChild(tmp);
    const c = getComputedStyle(tmp).color;
    document.body.removeChild(tmp);
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    if (m) {
      const r = (+m[1]).toString(16).padStart(2, '0');
      const g = (+m[2]).toString(16).padStart(2, '0');
      const b = (+m[3]).toString(16).padStart(2, '0');
      return '#' + r + g + b;
    }
  } catch (e) { /* ignore */ }
  return '#000000';
}

function _isCssGradient(str) {
  if (!str || typeof str !== 'string') return false;
  var s = str.trim().toLowerCase();
  return /\b(linear|radial|conic)-gradient\s*\(/.test(s) ||
    /\brepeating-(linear|radial|conic)-gradient\s*\(/.test(s);
}

function _syncColorPickerRow(row) {
  var text = row.querySelector('input[data-role="color-text"]');
  var color = row.querySelector('input[data-role="color"]');
  if (!text || !color) return;
  var raw = (text.value || '').trim();
  if (_isCssGradient(raw)) {
    color.disabled = true;
    color.title = 'Gradient ·edit in text field, or replace with a hex solid to use the swatch again.';
    color.style.opacity = '0.35';
  } else {
    color.disabled = false;
    color.title = '';
    color.style.opacity = '';
    var hx = _toHex6(raw);
    if (hx) color.value = hx;
  }
}

// Strip 'px' from a size string for <input type="number">.
function _toNumPx(value) {
  if (!value) return '';
  const m = /^(-?\d+(?:\.\d+)?)\s*px/.exec(value.trim());
  if (m) return m[1];
  const n = parseFloat(value);
  return isNaN(n) ? '' : String(n);
}

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getFilteredSchema() {
  if (SELECTED_PREVIEW_INDEX == null || SELECTED_PREVIEW_INDEX < 0 ||
      SELECTED_PREVIEW_INDEX >= PREVIEW_CARDS.length) {
    return THEME_EDIT_SCHEMA;
  }
  var card = PREVIEW_CARDS[SELECTED_PREVIEW_INDEX];
  var names = card.editSections;
  if (!names || !names.length) return THEME_EDIT_SCHEMA;
  var filtered = THEME_EDIT_SCHEMA.filter(function (s) {
    return names.indexOf(s.section) >= 0;
  });
  // Put card-specific sections first so e.g. "Weather card" is not buried
  // below Page / Card globals (users thought detailed vars were missing).
  function baseRank(sectionName) {
    if (sectionName === 'Page') return 2;
    if (sectionName === 'Card globals') return 1;
    return 0;
  }
  filtered.sort(function (a, b) {
    var ra = baseRank(a.section);
    var rb = baseRank(b.section);
    if (ra !== rb) return ra - rb;
    var ia = names.indexOf(a.section);
    var ib = names.indexOf(b.section);
    if (ia !== ib) return ia - ib;
    return THEME_EDIT_SCHEMA.indexOf(a) - THEME_EDIT_SCHEMA.indexOf(b);
  });
  return filtered;
}

function _purgeLegacyInspectorTipNodes() {
  document.querySelectorAll('#editor-scope-sub, .editor-scope-sub').forEach(function (n) {
    try { n.remove(); } catch (e) { /* ignore */ }
  });
}

function updateEditorScopeUI() {
  _purgeLegacyInspectorTipNodes();
  var hint = $('editor-scope-hint');
  var btn = $('btn-show-all-vars');
  if (SELECTED_PREVIEW_INDEX != null && SELECTED_PREVIEW_INDEX >= 0 &&
      SELECTED_PREVIEW_INDEX < PREVIEW_CARDS.length) {
    var c = PREVIEW_CARDS[SELECTED_PREVIEW_INDEX];
    var line = c.name;
    if (INSPECTOR_LAYER && INSPECTOR_LAYER.label) line += ' · ' + INSPECTOR_LAYER.label;
    if (hint) hint.textContent = line;
    if (btn) btn.style.display = '';
  } else {
    if (hint) hint.textContent = '';
    if (btn) btn.style.display = 'none';
  }
}

function buildEditorBody() {
  // Robust rebuild via innerHTML + delegated events. This avoids the
  // earlier failure mode where el()-based DOM construction silently
  // produced an empty panel ·easier to debug, harder to miswire.
  var body = document.getElementById('editor-body');
  if (!body) { console.warn('[customize] editor-body element missing'); return; }
  try {
    var html = '';

    // Active-filter chip ·surfaces the click-to-focus state at the
    // top of the editor so the designer always sees WHAT is being
    // filtered and can restore the full schema with one click.
    if (INSPECTOR_LAYER && INSPECTOR_LAYER.label) {
      html += '<div class="editor-filter-chip" style="display:flex;align-items:center;gap:8px;padding:8px 10px;margin:0 0 12px;border-radius:10px;background:rgba(3,129,254,0.10);border:1px solid rgba(3,129,254,0.30);color:var(--primary);font-size:12px;">';
      html += '<span style="font-weight:700;">Focused:</span>';
      html += '<span style="opacity:0.85;">' + _esc(INSPECTOR_LAYER.label) + '</span>';
      html += '<span style="flex:1;"></span>';
      html += '<button type="button" id="btn-clear-focus" class="secondary" style="font-size:11px;padding:4px 10px;">Show all</button>';
      html += '</div>';
    }

    var activeSectionName = _activeSectionName();
    getActiveEditorSections().forEach(function (section, secIdx) {
      var isActive = activeSectionName && section.section === activeSectionName;
      html += '<div class="editor-section' + (isActive ? ' is-active-section' : '') + '">';
      html += '<button type="button" class="editor-section-toggle" aria-expanded="true" aria-controls="editor-sec-body-' + secIdx + '">';
      html += '<span class="editor-section-toggle-label">' + _esc(section.section) + '</span>';
      html += '<span class="editor-section-chev" aria-hidden="true">\u25be</span></button>';
      html += '<div class="editor-section-body" id="editor-sec-body-' + secIdx + '">';
      section.vars.forEach(function (v) {
        var current = _readVar(v.key) || '';
        var rowHtml = '<div class="editor-row" data-var="' + _esc(v.key) + '" data-vtype="' + _esc(v.type) + '">';
        rowHtml += '<label>' + _esc(v.label) + '</label>';
        rowHtml += '<div class="input-wrap">';
        if (v.type === 'color') {
          var hex = _toHex6(_isCssGradient(current) ? '#888888' : current);
          rowHtml += '<input data-role="color" type="color" value="' + _esc(hex) + '">';
          rowHtml += '<input data-role="color-text" type="text" value="' + _esc(current) + '" placeholder="#hex, rgb(), or linear-gradient(...)">';
        } else if (v.type === 'color-rgba') {
          rowHtml += '<input data-role="text" type="text" value="' + _esc(current) + '" placeholder="rgba(255,255,255,0.7)">';
        } else if (v.type === 'size') {
          var n = _toNumPx(current);
          var min = v.min != null ? String(v.min) : '0';
          var max = v.max != null ? String(v.max) : '500';
          var step = v.step != null ? String(v.step) : '1';
          rowHtml += '<input data-role="size" type="number" value="' + _esc(n) +
            '" min="' + _esc(min) + '" max="' + _esc(max) + '" step="' + _esc(step) + '">';
          rowHtml += '<span class="suffix">px</span>';
        } else if (v.type === 'weight') {
          rowHtml += '<select data-role="weight">';
          ['400', '500', '600', '700'].forEach(function (w) {
            var sel = String(current).indexOf(w) >= 0 ? ' selected' : '';
            rowHtml += '<option value="' + w + '"' + sel + '>' + w + '</option>';
          });
          rowHtml += '</select>';
        } else {
          rowHtml += '<input data-role="text" type="text" value="' + _esc(current) + '">';
        }
        rowHtml += '</div></div>';
        html += rowHtml;
      });
      html += '</div></div>';
    });
    // Action footer ·single Save (primary) + Discard (secondary).
    // Live preview happens in real time; this footer is only about
    // *persisting* the current edited state (Save) or *throwing it
    // away* (Discard) and going back to the dropdown preset.
    html += '<div class="editor-actions">' +
      '<button id="btn-save">Save</button>' +
      '<button class="secondary" id="btn-discard">Discard changes</button>' +
      '<div class="spacer"></div>' +
      '<span class="hint">Slide / type ·live preview. Save creates a new theme.</span>' +
    '</div>';
    body.innerHTML = html;
    body.querySelectorAll('.editor-row[data-vtype="color"]').forEach(function (row) {
      _syncColorPickerRow(row);
    });
  } catch (e) {
    console.error('[customize] buildEditorBody failed:', e);
    body.innerHTML = '<div style="padding:18px;color:#EF4444;">Editor failed to render. Check console.<br>' + _esc(e.message) + '</div>';
    return;
  }
  _purgeLegacyInspectorTipNodes();
  updateEditorScopeUI();
}

// Delegated handler ·fired once per input/change event on any descendant
// of the editor body. Uses closest('.editor-row') to find the row's
// data-var (CSS variable key) and data-vtype (input type), then routes
// to the right write strategy.
function _onEditorInput(e) {
  var t = e.target;
  if (!t || !t.matches) return;
  var row = t.closest('.editor-row');
  if (!row) return;
  var key = row.getAttribute('data-var');
  var vtype = row.getAttribute('data-vtype');
  if (!key) return;
  var role = t.getAttribute('data-role');
  if (vtype === 'color' && (role === 'color' || role === 'color-text')) {
    var color = row.querySelector('input[data-role="color"]');
    var text  = row.querySelector('input[data-role="color-text"]');
    if (role === 'color' && color && text) { text.value = color.value; }
    if (role === 'color-text' && color && text) {
      var raw = (text.value || '').trim();
      if (!_isCssGradient(raw)) {
        var hex = _toHex6(raw);
        if (hex) color.value = hex;
      }
    }
    _writeVar(key, role === 'color' ? color.value : text.value);
    _syncColorPickerRow(row);
  } else if (vtype === 'size') {
    if (t.value === '' || t.value == null || isNaN(Number(t.value))) return;
    _writeVar(key, t.value + 'px');
  } else if (vtype === 'weight') {
    _writeVar(key, t.value);
  } else {
    _writeVar(key, t.value);
  }
  // With a preview card selected, vars go onto that cell only; otherwise :root.
}

function readAllVarsFromRoot() {
  const out = {};
  _SURFACE_THEME_KEYS.forEach(function (key) {
    var val = _readVarFromRootOnly(key);
    if (val) out[key] = val;
  });
  THEME_EDIT_SCHEMA.forEach(section => {
    section.vars.forEach(v => {
      var key = v.key;
      var val = _readVarFromRootOnly(key);
      for (var oi = 0; oi < PREVIEW_CARDS.length; oi++) {
        var o = PREVIEW_CELL_VAR_OVERRIDES[oi];
        if (o && o[key] != null && String(o[key]).trim() !== '') val = String(o[key]).trim();
      }
      if (val) out[v.key] = val;
    });
  });
  return out;
}

async function saveAsCustom() {
  const name = (window.prompt('Name for your custom theme?', 'My Custom Theme') || '').trim();
  if (!name) return;
  // Generate a kebab-case id from the name + a short hash so two saves
  // with the same name don't collide.
  const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'custom';
  const id = baseId + '-' + Math.random().toString(36).slice(2, 6);
  const vars = readAllVarsFromRoot();
  const description = 'Custom ·saved ' + new Date().toLocaleString();
  const theme = { id, name, description, vars };
  const btn = document.getElementById('btn-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    // 1) Persist the new theme.
    await fetchJSON('/api/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme })
    });
    THEMES.push(theme);
    // 2) Activate it server-side so other open windows pick it up via
    //    BroadcastChannel and so a fresh page load defaults to this
    //    new theme. Previously this was a separate "Apply to Site"
    //    button ·folded into Save now.
    await fetchJSON('/api/themes/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    ACTIVE_ID = id;
    // 3) Refresh dropdown + active-pill so the UI reflects the new state.
  const sel = $('theme-select');
  if (sel) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = name + ' (custom)';
    sel.appendChild(opt);
    sel.value = id;
  }
  const pill = $('active-pill');
  if (pill) pill.textContent = 'Active · ' + name;
    showToast('Saved · "' + name + '" is now active');
    updateOnSelect(id, false);
    _markUnsaved(false);
    // 4) Notify other open windows (genui main app) so their theme
    //    picker dropdown picks up the new id and the new active theme.
    _broadcastThemeChange('theme-saved', id);
    _broadcastThemeChange('theme-active-changed', id);
  } catch (e) {
    showToast('ERROR: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
  }
}

// Cross-window sync helper ·fires a BroadcastChannel message any
// time the customize page changes theme state. Other open windows
// (genui.html main app) listen for these to refresh their picker.
function _broadcastThemeChange(type, activeId) {
  try {
    if (!window.__themeChannel && typeof BroadcastChannel === 'function') {
      window.__themeChannel = new BroadcastChannel('oneui-themes');
    }
    if (window.__themeChannel) {
      window.__themeChannel.postMessage({ type, activeId, at: Date.now() });
    }
  } catch (e) { /* ignore */ }
}

// Discard all in-memory edits and snap back to whatever preset the
// dropdown is currently pointing at. Used by the Discard button and
// indirectly when the user picks a different preset (live-preview a
// preset = clean state). Does NOT touch the server.
function discardChanges() {
  SELECTED_PREVIEW_INDEX = null;
  INSPECTOR_LAYER = null;
  INSPECTOR_DOM_PATH = null;
  PREVIEW_CELL_VAR_OVERRIDES = {};
  const sel = $('theme-select');
  const id = sel ? sel.value : ACTIVE_ID;
  const theme = THEMES.find(t => t.id === id);
  if (!theme) return;
  applyThemeVars(theme.vars);
  if (isFlatThemeActive()) setFlatScheme(FLAT_SCHEME, false);
  else updateFlatSchemeToggle();
  buildEditorBody();   // refresh inputs to reflect current values
  renderPreviewGrid();
  _markUnsaved(false);
}

// ---------------------------------------------------------------------------
//  _buildPreviewGalleryHTML ·produce the comprehensive theme-preview.html
//
//  Why this exists: the previous template included 5 hand-coded mock
//  cards which barely hinted at the system's surface area. Designers
//  couldn't validate their token edits against the full component
//  catalogue without loading the live site. This helper snapshots the
//  three relevant surfaces (Cards · Screens · 22 base components) plus
//  the CSS they need, and assembles a single self-contained file.
//
//  Side effects: while running, may briefly toggle PREVIEW_MODE to
//  'screen' to capture that surface, then restores the user's prior
//  selection. The user sees no visible flicker because the toggle
//  happens within one await tick.
// ---------------------------------------------------------------------------
async function _fetchText(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return '';
    return await r.text();
  } catch (_) { return ''; }
}

// Parse via DOMParser, NOT regex. Regex over the raw source picks up
// literal <style> / </style> / <body> strings that appear inside
// JavaScript (e.g. this very file has `'<style>'` and `'</style>'`
// inside the template-string section that generates the gallery), and
// the parser then sees an early </style> in the gallery's own <style>
// block and renders half the file as body content. DOM-based parsing
// correctly distinguishes element boundaries from script text.
function _extractStyleBlocks(html) {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(doc.querySelectorAll('style'))
      .map(function (el) { return el.textContent || ''; })
      .join('\n\n');
  } catch (_) { return ''; }
}

function _extractBody(html) {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body ? doc.body.innerHTML : '';
  } catch (_) { return ''; }
}

// Final-line-of-defense: strip any literal </style> tokens from CSS
// text before we drop it into a <style> block. Even if the extractor
// is perfectly DOM-aware, CSS comments / string content technically
// can't contain </style> in HTML's serialization ·and the parser
// will close the style block at the first </style> it sees regardless
// of CSS context. Replace with the escaped form so it survives the
// roundtrip without breaking either the CSS parser or the HTML parser.
function _safeCssForInlineStyle(css) {
  if (!css) return '';
  return String(css).replace(/<\/style/gi, '<\\/style');
}

async function _buildPreviewGalleryHTML(theme) {
  // === (1) Snapshot Cards mode ==============================================
  // Force a fresh render so the snapshot reflects whatever tokens the
  // designer has just edited (even unsaved ones ·they're in computed
  // styles already).
  try { if (typeof renderPreviewGrid === 'function') renderPreviewGrid(); } catch (_) {}
  const cardsInner = ($('preview-grid') && $('preview-grid').innerHTML) || '';
  const cardsCount = (($('preview-grid') && $('preview-grid').querySelectorAll('.preview-cell')) || []).length;

  // === (2) Snapshot Screen mode (temporarily switch, then restore) ==========
  const wasMode = PREVIEW_MODE;
  try { setPreviewMode('screen'); } catch (_) {}
  // Two animation frames + a short timeout give the renderer time to
  // populate the screen grid even on slower machines.
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60))));
  const screensInner = ($('preview-screen-grid') && $('preview-screen-grid').innerHTML) || '';
  const screensCount = (($('preview-screen-grid') && $('preview-screen-grid').querySelectorAll('.preview-phone-frame')) || []).length;
  if (wasMode !== 'screen') {
    try { setPreviewMode(wasMode || 'cards'); } catch (_) {}
  }

  // === (3) Fetch the 22-component One UI page + its inline styles ==========
  const componentsRaw = await _fetchText('components.html');
  const componentsStyle = _extractStyleBlocks(componentsRaw);
  let componentsBody    = _extractBody(componentsRaw);
  // Components page has a <header>/<nav> we don't need in the gallery;
  // strip it so the section flows cleanly under our own H1.
  componentsBody = componentsBody
    .replace(/<header[\s\S]*?<\/header>/i, '')
    .replace(/<nav[\s\S]*?<\/nav>/i, '');
  const componentsCount = (componentsRaw.match(/class="comp-title"/g) || []).length;

  // === (4) Fetch base styles needed by the rendered atomic HTML ============
  const customizeRaw = await _fetchText('customize.html');
  const customizeStyle = _extractStyleBlocks(customizeRaw);
  const genuiCss = await _fetchText('css/genui.css');

  // === (5) Theme metadata ===================================================
  const themeName = theme.name || 'Theme preview';
  const safeName  = _esc(themeName);

  // === (6) Assemble the file ===============================================
  // CSS load order:
  //   1) genui.css  (atomic component rules, theme variable bridge)
  //   2) customize.html inline styles (preview-grid / screen-grid layout)
  //   3) components.html inline styles (22-component styles)
  //   4) gallery-specific overrides (TOC, sections)
  //   5) theme.css via <link>  ·designer's edits win the cascade
  return [
    '<!DOCTYPE html>',
    '<html lang="en"><head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<title>' + safeName + ' ·preview gallery</title>',
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">',
    '<style>',
    '/* === [1] Inlined: css/genui.css (atomic components + theme bridge) === */',
    _safeCssForInlineStyle(genuiCss),
    '/* === [2] Inlined: customize.html <style> (preview-grid + screen-grid) === */',
    _safeCssForInlineStyle(customizeStyle),
    '/* === [3] Inlined: components.html <style> (22 OneUI components) === */',
    _safeCssForInlineStyle(componentsStyle),
    '/* === [4] Gallery layout overrides ===================================== */',
    /* High-specificity selectors (`html body.tp-page ...`) so this block
       wins regardless of where it falls in the cascade vs. the three
       inlined source stylesheets above. Without the extra body class
       we observed the gallery layout being clobbered by .section /
       container rules from components.html. */
    'html, body.tp-page { margin: 0; padding: 0; background: var(--page-bg, #0a0a0c); color: var(--text-primary, #efeef2); font-family: var(--font-family-body, "Inter", sans-serif); line-height: var(--line-height-normal, 1.45); min-height: 100vh; overflow-x: hidden; overflow-y: auto; }',
    'body.tp-page * { box-sizing: border-box; }',
    'body.tp-page .tp-shell { max-width: 1480px; margin: 0 auto; padding: 56px 48px 96px; display: block; }',
    'body.tp-page .tp-meta { margin: 0 0 28px; display: block; }',
    'body.tp-page .tp-meta h1 { font-family: var(--font-family-display, "Inter", sans-serif); font-size: 34px; font-weight: 700; letter-spacing: -0.6px; margin: 0 0 8px; display: block; color: var(--text-primary, #efeef2); }',
    'body.tp-page .tp-meta p  { color: var(--text-secondary, rgba(239,238,242,0.7)); font-size: 14px; margin: 0; display: block; max-width: 760px; line-height: 1.55; }',
    'body.tp-page .tp-toc { display: flex; gap: 10px; flex-wrap: wrap; margin: 22px 0 36px; padding: 0; list-style: none; }',
    'body.tp-page .tp-toc a { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); color: var(--text-primary, #efeef2); text-decoration: none; font-size: 12.5px; font-weight: 500; transition: background 0.15s ease, border-color 0.15s ease; }',
    'body.tp-page .tp-toc a:hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.18); }',
    'body.tp-page .tp-toc a .count { color: var(--text-tertiary, rgba(239,238,242,0.50)); font-weight: 400; margin-left: 4px; }',
    'body.tp-page .tp-section { margin: 56px 0 0; padding: 36px 0 0; border-top: 1px solid rgba(255,255,255,0.08); display: block; }',
    'body.tp-page .tp-section > h2 { font-family: var(--font-family-display, "Inter", sans-serif); font-size: 22px; font-weight: 700; margin: 0 0 8px; letter-spacing: -0.3px; display: block; color: var(--text-primary, #efeef2); }',
    'body.tp-page .tp-section > .tp-hint { color: var(--text-tertiary, rgba(239,238,242,0.55)); font-size: 13px; margin: 0 0 28px; max-width: 760px; display: block; line-height: 1.55; }',
    'body.tp-page .tp-cards-scope { background: var(--preview-bg, #FFFEF1); border-radius: 28px; padding: 24px; }',
    'body.tp-page .tp-cards-scope .preview-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; padding: 0; }',
    'body.tp-page .tp-screens-wrap { padding: 0; }',
    'body.tp-page .tp-screens-wrap .preview-screen-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
    '@media (max-width: 980px) { body.tp-page .tp-cards-scope .preview-grid, body.tp-page .tp-screens-wrap .preview-screen-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } body.tp-page .tp-shell { padding: 40px 24px 80px; } }',
    '@media (max-width: 620px) { body.tp-page .tp-cards-scope .preview-grid, body.tp-page .tp-screens-wrap .preview-screen-grid { grid-template-columns: 1fr; } body.tp-page .tp-shell { padding: 28px 16px 80px; } }',
    '/* Components page has its own design system on a light surface ·keep it isolated visually */',
    'body.tp-page .tp-components-host { background: #f5f6f7; color: #111; border-radius: 24px; padding: 16px 24px 40px; margin: 0; }',
    'body.tp-page .tp-components-host .section { padding: 36px 0; margin: 0; background: transparent; }',
    'body.tp-page .tp-components-host .footer, body.tp-page .tp-components-host .nav, body.tp-page .tp-components-host .hero { display: none !important; }',
    '</style>',
    '<link rel="stylesheet" href="theme.css">',  // designer's edits ·LAST so they win
    '</head><body class="tp-page">',
    '<div class="tp-shell">',
    '  <header class="tp-meta">',
    '    <h1>' + safeName + ' · preview gallery</h1>',
    '    <p>Self-contained theme preview · edit <code>theme.css</code> &amp; refresh to verify · re-import via <code>/customize ·Import theme</code></p>',
    '  </header>',
    '  <nav class="tp-toc">',
    '    <a href="#tp-cards">Cards <span class="count">' + cardsCount + '</span></a>',
    '    <a href="#tp-screens">Screen compositions <span class="count">' + screensCount + '</span></a>',
    '    <a href="#tp-oneui">One UI base components <span class="count">' + componentsCount + '</span></a>',
    '  </nav>',
    '  <section id="tp-cards" class="tp-section">',
    '    <h2>All themed cards</h2>',
    '    <p class="tp-hint">Every card from Customize ·Cards mode. Re-render with your theme tokens to see how each surface reacts.</p>',
    '    <div class="tp-cards-scope preview-theme-scope">',
    '      <div class="preview-grid">' + cardsInner + '</div>',
    '    </div>',
    '  </section>',
    '  <section id="tp-screens" class="tp-section">',
    '    <h2>Screen compositions</h2>',
    '    <p class="tp-hint">Six S26-ratio phones ·each mixes 1-col and 2-col groups so the same card type renders in both contexts. Validate <code>--screen-padding-*</code>, <code>--gap-screen</code>, <code>--gap-cards</code>, <code>--screen-grid-columns</code>.</p>',
    '    <div class="tp-screens-wrap preview-screen-wrap">',
    '      <div class="preview-screen-grid">' + screensInner + '</div>',
    '    </div>',
    '  </section>',
    '  <section id="tp-oneui" class="tp-section">',
    '    <h2>One UI 8.5 · base components</h2>',
    '    <p class="tp-hint">The full primitive set from the standalone <code>components.html</code> reference ·buttons, FAB, switches, checkboxes, inputs, chips, cards, dialogs, sliders, etc. Theme tokens that match (radii, accent colors, typography) will flow through.</p>',
    '    <div class="tp-components-host">',
    componentsBody,
    '    </div>',
    '  </section>',
    '</div>',
    '</body></html>'
  ].join('\n');
}

// ---------------------------------------------------------------------------
//  Download template ·comprehensive starter pack
//
//  Designers click this once, get a working baseline of the currently
//  active theme as a small bundle of files.
//
//  Files inside the .zip:
//    theme.css          editable variable file (the actual edit surface)
//    theme.json         machine-readable mirror, same vars + metadata
//    theme-preview.html ·self-contained gallery ·opens any browser to show:
//                         (1) all themed cards from customize Cards mode
//                         (2) all 6 screen compositions from Screen mode
//                         (3) the 22 base One UI 8.5 components
//                         All three sections render with the user's
//                         theme.css applied, so the designer can verify
//                         every component / every screen at one glance
//                         without needing access to the live site.
//    README.md          30-second orientation for the recipient
//
//  Designer edits `theme.css` in VS Code / Cursor, refreshes
//  `theme-preview.html` to see the result, then sends `theme.css` back
//  via /customize ·Import theme to round-trip into the site.
// ---------------------------------------------------------------------------
async function downloadThemeTemplate() {
  const sel = $('theme-select');
  const themeId = sel ? sel.value : ACTIVE_ID;
  const theme = THEMES.find(t => t.id === themeId);
  if (!theme) { showToast('Pick a theme first'); return; }

  // Read every editable variable's current value (computed) so any
  // unsaved tweaks the designer made get baked into the template.
  const computed = getComputedStyle(document.documentElement);
  const themeVars = {};
  THEME_EDIT_SCHEMA.forEach(section => {
    section.vars.forEach(v => {
      const val = (computed.getPropertyValue(v.key) || '').trim();
      if (val) themeVars[v.key] = val;
    });
  });

  // (1) theme.css ·annotated, designer-friendly. Sections grouped
  //     and labeled so a designer scanning the file sees the structure.
  let css = '/*!\n';
  css += ' * ' + (theme.name || 'Theme template') + ' ·One UI GenUI theme\n';
  css += ' * Base: ' + (theme.id || 'unknown') + ' · Exported: ' + new Date().toISOString() + '\n';
  css += ' *\n';
  css += ' * Edit any --variable below. Save as theme.css and re-import\n';
  css += ' * via /customize ·Import HTML to register a new theme.\n';
  css += ' *\n';
  css += ' * Optional metadata (parsed by the importer):\n';
  css += ' *   oneui-theme: { "name": "My Theme", "author": "you", "baseThemeId": "' + (theme.id || '') + '" }\n';
  css += ' */\n\n';
  css += ':root {\n';
  THEME_EDIT_SCHEMA.forEach((section, secIdx) => {
    if (secIdx > 0) css += '\n';
    css += '  /* ?? ' + section.section + ' ?? */\n';
    section.vars.forEach(v => {
      const val = themeVars[v.key] || '';
      if (val) css += '  ' + v.key + ': ' + val + ';\n';
    });
  });
  css += '}\n';

  // (2) theme.json ·machine-readable counterpart. Same vars, plus
  //     metadata. The importer reads this directly when present.
  const meta = {
    schema:        'oneui.export/v1',
    exportedAt:    new Date().toISOString(),
    name:          theme.name || 'My Theme',
    baseThemeId:   theme.id || null,
    description:   theme.description || '',
    themeVars:     themeVars
  };
  const json = JSON.stringify(meta, null, 2);

  // (3) theme-preview.html ·comprehensive offline gallery.
  //
  //     Composed from three live sources, captured at download time so
  //     the designer's current edits + active theme are baked in:
  //
  //       a) Cards-mode preview  ·every themed card from #preview-grid
  //       b) Screen-mode preview ·6 phone compositions w/ 1-col + 2-col mix
  //       c) components.html     ·the 22 base One UI 8.5 components
  //
  //     Plus the three sources' inlined CSS (genui.css atomic styles,
  //     customize.html preview layout, components.html component styles)
  //     so the file renders standalone from any folder. theme.css is
  //     <link>ed LAST so the designer's tokens override the bases.
  const html = await _buildPreviewGalleryHTML(theme);

  // README inside the ZIP ·gives any designer who receives the file
  // pack a 30-second orientation without needing access to the site.
  const readme =
    '# ' + (theme.name || 'Theme') + ' template\n\n' +
    'A self-contained bundle for tweaking the theme tokens of Samsung One UI GenUI.\n\n' +
    '## Files\n\n' +
    '- `theme.css` ·the editable variables. Open in any code editor.\n' +
    '- `theme.json` ·machine-readable mirror (the tool reads this on import).\n' +
    '- `theme-preview.html` ·drag into a browser to verify your edits. Has three sections:\n' +
    '    1. **Cards** ·every themed card from Customize ·Cards mode\n' +
    '    2. **Screen compositions** ·6 S26-ratio phones with mixed 1-col + 2-col groups\n' +
    '    3. **One UI 8.5 base components** ·the full primitive set (Buttons, FAB,\n' +
    '       Toggle Switches, Checkboxes, Radios, Inputs, Search, Chips, Tabs, App Bar,\n' +
    '       Bottom Nav, Cards, List Items, Dialogs, Bottom Sheet, Sliders, Progress,\n' +
    '       Snackbar, Tooltips, Badges, Menus, Dividers ·22 in total)\n\n' +
    '## Edit\n\n' +
    'Open `theme.css`, change any `--variable` value, save, refresh\n' +
    '`theme-preview.html` to verify.\n\n' +
    'Optional metadata at the top of `theme.css`:\n\n' +
    '```css\n' +
    '/*! oneui-theme: { "name": "Sunset Glow", "author": "you" } */\n' +
    '```\n\n' +
    '## Apply\n\n' +
    'Send the updated `theme.css` (or all three files) to whoever runs\n' +
    'the One UI GenUI site ·they import via `/customize ·Import theme`\n' +
    'and click Save to register your work as a new theme preset.\n';

  // Single ZIP download ·bundling all three files dodges the browser's
  // multi-download throttle that previously delivered only the first
  // (theme.css), leaving designers without the json + preview files
  // they need to verify their work locally.
  if (typeof window.JSZip !== 'function') {
    showToast('ERROR: ZIP library not loaded yet ·refresh and retry');
    return;
  }
  try {
    const zip = new window.JSZip();
    zip.file('theme.css',          css);
    zip.file('theme.json',         json);
    zip.file('theme-preview.html', html);
    zip.file('README.md',          readme);
    const baseId = (theme.id || 'theme').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'oneui-' + baseId + '-template.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    showToast('Downloaded · oneui-' + baseId + '-template.zip (4 files inside)');
  } catch (e) {
    console.error('[customize] zip generation failed:', e);
    showToast('ERROR: zip generation failed (' + e.message + ')');
  }
}

// ---------------------------------------------------------------------------
//  Import HTML ·load theme from a self-contained export
//
//  The genui Export HTML button writes a file that embeds (a) all of
//  css/genui.css inline, (b) the active <style id="theme-vars">
//  block, (c) any unsaved inline overrides, and (d) a JSON metadata
//  comment of the form:
//
//    <!-- ONEUI_EXPORT_META:{"schema":"oneui.export/v1",...}:END -->
//
//  This handler reads the file as text, extracts that JSON block first
//  (cheapest path), falls back to regex-scraping `:root { --xxx: · }`
//  if metadata is missing, applies each --xxx via _writeVar so the
//  preview updates live, and marks the editor unsaved so a Save
//  persists it as a brand-new theme.
// ---------------------------------------------------------------------------
// Whitelist of theme variable prefixes ·used to filter out base
// design-system tokens (--primary, --bg, etc.) that live in the
// inlined genui.css inside the new gallery HTML. Without this filter
// an unsuspecting designer who imports theme-preview.html would
// accidentally overwrite their theme tokens with the base palette.
// The whitelist matches the prefixes used by THEME_EDIT_SCHEMA in
// this same file.
const _THEME_VAR_PREFIXES = [
  '--font-', '--letter-spacing', '--line-height',
  '--space-', '--screen-', '--gap-', '--container-',
  '--card-', '--qs-', '--nowbar-', '--fab-',
  '--surface-', '--text-primary', '--text-secondary', '--text-tertiary',
  '--accent-', '--primary-', '--oneui-theme-style', '--preview-bg'
];
function _isThemeVar(key) {
  if (!key || typeof key !== 'string') return false;
  return _THEME_VAR_PREFIXES.some(p => key.startsWith(p));
}

// ZIP path ·accept the whole download bundle as-is. Designer drops
// `oneui-<theme>-template.zip` directly without unpacking. We read
// the embedded theme.json (preferred) or theme.css; theme-preview.html
// + README.md are intentionally skipped.
async function _parseZipFile(file) {
  if (typeof window.JSZip !== 'function') {
    return { vars: {}, source: 'skipped · JSZip not loaded', name: file.name, error: 'JSZip missing' };
  }
  let zip;
  try {
    const ab = await file.arrayBuffer();
    zip = await window.JSZip.loadAsync(ab);
  } catch (e) {
    return { vars: {}, source: 'skipped · not a valid zip', name: file.name, error: e.message };
  }
  // Find candidate files inside (case-insensitive, allow nested folders).
  const entries = Object.keys(zip.files);
  const findEntry = (pattern) => entries.find(p => pattern.test(p));
  const jsonEntry = findEntry(/(^|\/)theme\.json$/i);
  const cssEntry  = findEntry(/(^|\/)theme\.css$/i);

  // Prefer theme.json ·exact values, no parsing risk.
  if (jsonEntry) {
    const txt = await zip.files[jsonEntry].async('string');
    try {
      const meta = JSON.parse(txt);
      if (meta && meta.themeVars && typeof meta.themeVars === 'object') {
        return {
          vars: meta.themeVars,
          source: 'zip · ' + jsonEntry + ' (' + Object.keys(meta.themeVars).length + ' vars)',
          name: file.name,
          themeName: meta.name || null
        };
      }
    } catch (e) { /* fall through to CSS */ }
  }
  // Fall back to theme.css inside the zip.
  if (cssEntry) {
    const txt = await zip.files[cssEntry].async('string');
    const vars = _scrapeCssRootVars(txt);
    if (Object.keys(vars).length > 0) {
      return {
        vars,
        source: 'zip · ' + cssEntry + ' (' + Object.keys(vars).length + ' vars)',
        name: file.name
      };
    }
  }
  return {
    vars: {},
    source: 'zip · no theme.json or theme.css found',
    name: file.name,
    error: 'expected theme.json or theme.css inside the zip'
  };
}

// Scrape `:root { --xxx: value; }` blocks from a CSS-ish text and
// return them as an object. Shared by CSS files and the legacy
// inline-CSS HTML export fallback.
function _scrapeCssRootVars(text) {
  const out = {};
  if (!text) return out;
  const rootBlockRe = /:root[^{]*\{([^}]*)\}/g;
  let block;
  while ((block = rootBlockRe.exec(text)) !== null) {
    const varRe = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let m;
    while ((m = varRe.exec(block[1])) !== null) {
      out[m[1].trim()] = m[2].trim();
    }
  }
  return out;
}

// Parse a single file ·its themeVars + a tag describing the source.
// Pure function ·does NOT touch :root or the editor. Caller (the
// multi-file import handler) merges the maps and applies them.
async function _parseThemeFile(file) {
  if (!file) return { vars: {}, source: '(empty)', name: '(empty)' };
  const MAX_BYTES = 8 * 1024 * 1024;   // bumped to 8 MB to fit the comprehensive gallery zip + preview html
  if (file.size > MAX_BYTES) {
    return { vars: {}, source: 'skipped · too large', name: file.name, error: 'too large (' + Math.round(file.size / 1024) + ' KB)' };
  }

  // ZIP-aware path ·bypass text parsing entirely for .zip files.
  const fname = (file.name || '').toLowerCase();
  if (fname.endsWith('.zip')) {
    return await _parseZipFile(file);
  }

  let text = '';
  try { text = await file.text(); }
  catch (e) { return { vars: {}, source: 'skipped · read failure', name: file.name, error: e.message }; }

  // Format detection ·same handler accepts .html (full export with
  // metadata comment), .css (just the theme vars), or .json (machine
  // export from /customize ·Download template). Detection is by
  // extension first, then by content sniffing as a safety net.
  const looksJSON = fname.endsWith('.json') ||
                    /^\s*\{[\s\S]*"themeVars"\s*:/m.test(text);
  const looksCSS  = fname.endsWith('.css')  ||
                    (/:root[^{]*\{/.test(text) && !/<!DOCTYPE|<html/i.test(text) && !looksJSON);

  let themeVars = null;
  let importedFrom = null;

  // (1a) JSON path ·parse the file as a metadata document directly.
  if (looksJSON && !themeVars) {
    try {
      const meta = JSON.parse(text);
      if (meta && meta.themeVars && typeof meta.themeVars === 'object') {
        themeVars = meta.themeVars;
        importedFrom = 'json · ' + (meta.name || meta.baseThemeId || 'theme.json');
      }
    } catch (e) {
      console.warn('[import] JSON parse failed:', e.message);
    }
  }

  // (1b) HTML metadata comment path ·fast, structured. Old genui
  // Export HTML used this; new gallery preview omits it.
  if (!themeVars) {
    const metaMatch = text.match(/<!--\s*ONEUI_EXPORT_META:([\s\S]*?):END\s*-->/);
    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[1]);
        if (meta && meta.themeVars && typeof meta.themeVars === 'object') {
          themeVars = meta.themeVars;
          importedFrom = 'metadata · ' + (meta.exportedAt || 'unknown date');
        }
      } catch (e) {
        console.warn('[import] metadata JSON parse failed, falling back to CSS scan:', e.message);
      }
    }
  }

  // (1c) GALLERY PREVIEW DETECTION ·the new theme-preview.html links to
  // an external theme.css and inlines the base genui.css. Importing it
  // alone would scrape the base :root tokens (wrong: not the user's
  // theme). Tell the user what to do instead.
  if (!themeVars && fname.endsWith('.html')) {
    const isGalleryPreview = /<link[^>]+href="theme\.css"/i.test(text) ||
                             /body class="tp-page"/.test(text);
    if (isGalleryPreview) {
      return {
        vars: {},
        source: 'gallery preview · cannot import alone',
        name: file.name,
        error: 'theme-preview.html links to theme.css externally. Drop the .zip or theme.css/theme.json instead.'
      };
    }
  }

  // (1d) CSS comment metadata ·designer-authored .css files MAY include
  //   /*! oneui-theme: { "name": "...", "baseThemeId": "...", ... } */
  //  We don't need it for the vars themselves but capture the name.
  let cssMetaName = null;
  if (looksCSS) {
    const cssMeta = text.match(/oneui-theme\s*:\s*(\{[\s\S]*?\})/);
    if (cssMeta) {
      try { cssMetaName = JSON.parse(cssMeta[1]).name || null; }
      catch (_) { /* optional, ignore */ }
    }
  }

  // (2) Fallback: scrape every `:root { --xxx: VALUE; }` block. Works
  // for raw CSS files AND for legacy HTML exports lacking the metadata
  // comment. For HTML inputs we additionally filter by theme-var
  // prefix so an accidental import of a file that bundles base CSS
  // (e.g. a self-contained genui export) doesn't bring in --primary /
  // --bg / etc. ·only tokens the editor actually owns.
  if (!themeVars) {
    const scraped = _scrapeCssRootVars(text);
    if (looksCSS) {
      // CSS files are trusted ·designer wrote them, no filter.
      themeVars = scraped;
    } else {
      // HTML scan ·filter to theme-token prefixes only.
      themeVars = {};
      Object.keys(scraped).forEach(k => {
        if (_isThemeVar(k)) themeVars[k] = scraped[k];
      });
    }
    const sourceTag = looksCSS ? 'css' : 'html-scan';
    importedFrom = sourceTag + (cssMetaName ? (' · ' + cssMetaName) : '') +
                   ' · ' + Object.keys(themeVars).length + ' vars';
  }

  return { vars: themeVars || {}, source: importedFrom || '(unknown)', name: file.name };
}

// Top-level handler ·accepts ONE OR MANY files, parses each, then
// merges them in selection order (later files win on conflicts) and
// applies the merged map in one pass. Designers can split their work
// into multiple .css files (theme-base.css + theme-overrides.css) or
// drop a {.css, .json, .html} bundle and have it merge cleanly.
async function importThemeFiles(files) {
  const list = Array.from(files || []);
  if (list.length === 0) return;

  const reports = [];
  const merged = {};
  for (const file of list) {
    const r = await _parseThemeFile(file);
    reports.push(r);
    if (r.vars) {
      // Later files overwrite earlier on conflict.
      Object.keys(r.vars).forEach(k => {
        if (r.vars[k]) merged[k] = r.vars[k];
      });
    }
  }

  const keys = Object.keys(merged);
  if (keys.length === 0) {
    const errs = reports.filter(r => r.error).map(r => r.name + ': ' + r.error).join('; ');
    showToast('ERROR: no theme variables found' + (errs ? ' (' + errs + ')' : ''));
    return;
  }

  // Apply the merged map. _writeVar already marks unsaved + the
  // editor input listeners trigger a preview re-render on the next
  // tick. We still rebuild the editor body explicitly so all inputs
  // reflect the new values immediately.
  let applied = 0;
  keys.forEach(k => {
    if (!merged[k]) return;
    _writeVar(k, merged[k]);
    applied += 1;
  });
  buildEditorBody();
  renderPreviewGrid();

  // Build a friendly summary toast ·single-file shows the source tag,
  // multi-file shows file count + total var count.
  let summary;
  if (reports.length === 1) {
    summary = 'Imported ' + applied + ' theme var(s) from ' + reports[0].name;
  } else {
    summary = 'Merged ' + reports.length + ' files · ' + applied + ' theme var(s)';
  }
  showToast(summary + ' ·name + Save to keep');
  console.log('[import] ' + summary);
  reports.forEach(r => console.log('   · ' + r.name + ' (' + r.source + ')' + (r.error ? ' [error: ' + r.error + ']' : '')));
}

// Back-compat alias ·older code paths or external scripts may still
// call importHTMLFile() with a single file. Forwards to the multi
// handler so behavior is identical.
async function importHTMLFile(file) { return importThemeFiles(file ? [file] : []); }


// Drag-and-drop: any file dropped anywhere in the customize window
// triggers the import path. While a drag is in progress we show a
// fullscreen overlay so the user knows it's a valid drop target.
//
// Implementation details:
//   - dragenter/dragleave use a counter pattern because dragleave
//     fires every time the cursor crosses a child element, not just
//     when leaving the window
//   - we only react when the drag carries actual files (not text,
//     selected divs, etc.) ·that's the `types.includes('Files')` check
//   - the overlay is created on first dragenter so the markup cost is
//     deferred until the user actually drags something in
(function _wireNormalDotButtons() {
  const btnNormal = document.getElementById('btn-normal');
  const btnDot = document.getElementById('btn-dot');
  if (!btnNormal || !btnDot) return;

  btnNormal.addEventListener('click', () => {
    setPreviewDataset('normal');
  });

  btnDot.addEventListener('click', () => {
    setPreviewDataset('dot');
  });
})();

// Left panel: header toggles whole editor-body; each schema section toggles
// its own .editor-section-body. buildEditorBody() runs on boot and on
// theme / preview selection changes.

// ---------------------------------------------------------------------------
//  Boot
// ---------------------------------------------------------------------------
async function boot() {
  try {
    const data = await fetchJSON('/api/themes');
    THEMES = data.themes || [];
    ACTIVE_ID = data._active;
    // Build dropdown
    const sel = $('theme-select');
    if (sel) {
      sel.innerHTML = THEMES.map(t =>
        '<option value="' + t.id + '">' + t.name + '</option>'
      ).join('');
      sel.value = ACTIVE_ID;
    }
    updateOnSelect(ACTIVE_ID, false);
    // Load datasets (no merge).
    PREVIEW_CARDS_NORMAL = (Array.isArray(window.NORMAL_PREVIEW_CARDS) && window.NORMAL_PREVIEW_CARDS.length)
      ? _cloneCards(window.NORMAL_PREVIEW_CARDS)
      : [];
    PREVIEW_CARDS_DOT = (Array.isArray(window.DOT_PREVIEW_CARDS) && window.DOT_PREVIEW_CARDS.length)
      ? _cloneCards(window.DOT_PREVIEW_CARDS)
      : [];
    // Default view: dot if available, else normal.
    PREVIEW_CARDS = (PREVIEW_CARDS_DOT.length ? PREVIEW_CARDS_DOT : PREVIEW_CARDS_NORMAL);
    // Wait for renderer to be ready (the script tag is async-ish; if not
    // ready yet, retry once on next tick).
    if (typeof window.renderAtomicForRole === 'function') {
      renderPreviewGrid();
    } else {
      setTimeout(renderPreviewGrid, 50);
    }
  } catch (e) {
    console.error('boot failed', e);
    document.body.innerHTML = '<div style="padding:32px;color:#EF4444;">Failed to load themes: ' + e.message + '</div>';
  }
}

function updateOnSelect(id, applyServer) {
  SELECTED_PREVIEW_INDEX = null;
  INSPECTOR_LAYER = null;
  INSPECTOR_DOM_PATH = null;
  PREVIEW_CELL_VAR_OVERRIDES = {};
  const theme = THEMES.find(t => t.id === id);
  if (!theme) return;
  applyThemeVars(theme.vars);
  if (isFlatThemeActive()) setFlatScheme(FLAT_SCHEME, false);
  else updateFlatSchemeToggle();
  const pill = $('active-pill');
  if (pill) {
    pill.textContent = (theme.id === ACTIVE_ID ? 'Active · ' : 'Preview · ') + theme.name;
  }
  // Re-render preview so any cards that compute color from vars at render
  // time pick up the new values.
  renderPreviewGrid();
  // Always rebuild editor inputs ·they should reflect the newly-
  // selected theme's values. (The panel is no longer collapsible.)
  buildEditorBody();
}

$('theme-select')?.addEventListener('change', (e) => {
  SELECTED_PREVIEW_INDEX = null;
  INSPECTOR_LAYER = null;
  INSPECTOR_DOM_PATH = null;
  var pickedId = e.target.value;
  updateOnSelect(pickedId, false);
  var picked = THEMES.find(function (t) { return t.id === pickedId; });
  if (picked) {
    showToast('\ubbf8\ub9ac\ubcf4\uae30 \ud14c\ub9c8: ' + picked.name);
  }
  _markUnsaved(false);
});

document.getElementById('flat-scheme-toggle')?.addEventListener('click', function (e) {
  var btn = e.target.closest && e.target.closest('.flat-scheme-btn');
  if (!btn || !this.contains(btn) || !isFlatThemeActive()) return;
  setFlatScheme(btn.getAttribute('data-flat-scheme'), true);
});

document.getElementById('preview-bg-swatches')?.addEventListener('click', function (e) {
  var btn = e.target.closest && e.target.closest('.preview-bg-swatch');
  if (!btn || !this.contains(btn)) return;
  var bg = btn.getAttribute('data-preview-bg');
  if (!bg) return;
  document.documentElement.style.setProperty('--preview-bg', bg);
  this.querySelectorAll('.preview-bg-swatch').forEach(function (swatch) {
    swatch.setAttribute('aria-pressed', swatch === btn ? 'true' : 'false');
  });
});

// btn-apply ("Apply to Site") and btn-reset ("Reset preview") removed ·// their roles are now folded into Save (which both creates a new theme
// AND sets it active) and Discard (which clears unsaved edits without
// touching the server). The dropdown's onChange already handles preset
// switching.

(function wireEditorPanelDelegates() {
  var panel = document.getElementById('editor-panel');
  if (!panel || panel.__delegatesBound) return;
  panel.__delegatesBound = true;
  panel.addEventListener('input', function (e) {
    if (!e.target.closest('#editor-body')) return;
    _onEditorInput(e);
  });
  panel.addEventListener('change', function (e) {
    if (!e.target.closest('#editor-body')) return;
    _onEditorInput(e);
  });
  panel.addEventListener('click', function (e) {
    var t = e.target;
    var pToggle = t.closest && t.closest('.editor-panel-toggle');
    if (pToggle) {
      e.preventDefault();
      var pel = document.getElementById('editor-panel');
      if (pel) {
        var collapsed = pel.classList.toggle('is-collapsed');
        pToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      }
      return;
    }
    var sToggle = t.closest && t.closest('.editor-section-toggle');
    if (sToggle) {
      e.preventDefault();
      var wasOpen = sToggle.getAttribute('aria-expanded') === 'true';
      sToggle.setAttribute('aria-expanded', wasOpen ? 'false' : 'true');
      var bid = sToggle.getAttribute('aria-controls');
      var sBody = bid && document.getElementById(bid);
      if (sBody) sBody.hidden = wasOpen;
      return;
    }
    if (t.closest && t.closest('#btn-save')) { e.preventDefault(); saveAsCustom(); return; }
    if (t.closest && t.closest('#btn-discard')) { e.preventDefault(); discardChanges(); return; }
    if (t.closest && t.closest('#btn-clear-focus')) {
      e.preventDefault();
      setInspectorByKind(null);
      _highlightActiveScreenCards();
      return;
    }
    if (t.closest && t.closest('#btn-show-all-vars')) {
      e.preventDefault();
      SELECTED_PREVIEW_INDEX = null;
      INSPECTOR_LAYER = null;
      INSPECTOR_DOM_PATH = null;
      PREVIEW_CELL_VAR_OVERRIDES = {};
      renderPreviewGrid();
      buildEditorBody();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !INSPECTOR_LAYER || !$('editor-body')) return;
    INSPECTOR_LAYER = null;
    INSPECTOR_DOM_PATH = null;
    buildEditorBody();
    updateEditorScopeUI();
    _applyInspectorOutline();
  });
})();

(function wirePreviewGridDelegates() {
  var grid = $('preview-grid');
  if (!grid || grid.__delegatesBound) return;
  grid.__delegatesBound = true;
  function applyPreviewSelection(idx) {
    console.log('Applying preview selection:', idx);
    SELECTED_PREVIEW_INDEX = idx;
    updateDetailView(idx);
    renderPreviewGrid();
  }


  function renderDetailCard(card) {
    const detail = $('detail-view');
    const stage = $('detail-stage');
    const controls = $('detail-controls');

    if (!detail || !stage || !card || typeof window.renderAtomicForRole !== 'function') return;

    const rect = previewRectForCard(card);
    const previewScale = rect.scale || 1;
    const useZoomPreview = shouldUseZoomPreviewForRole(card && card.role);
    const html = isDotWeather21LightPairCard(card)
      ? renderDotWeather21PairHtml(card.variant)
      : window.renderAtomicForRole(card, rect);
    const scaleStyle = useZoomPreview
      ? ('zoom:' + previewScale + ';transform:none;')
      : ('transform:scale(' + previewScale + ');');

    stage.innerHTML =
      '<div class="stage-scale" style="width:' + rect.w + 'px;' +
      'min-height:' + rect.h + 'px;height:auto;' +
      scaleStyle + '">' + html + '</div>';

    stage.style.width = Math.ceil(rect.w * previewScale) + 'px';
    stage.style.height = useZoomPreview ? Math.ceil(rect.h * previewScale) + 'px' : 'auto';

    const cardEl = stage.querySelector('.dot-card, .focus-block, .notif-card, .now-bar, .media-card, .progress-track');
    if (cardEl) cardEl.setAttribute('data-state', 'idle');
    if (isDotWeather21LightPairCard(card)) mountDotPairRainMotionInStage(stage);

    if (controls) {
      controls.innerHTML = '';
      controls.style.display = 'none';
    }
  }

  function updateDetailView(idx) {
    console.log('Updating detail view for idx:', idx);
    const detail = $('detail-view');
    const stage = $('detail-stage');
    const controls = $('detail-controls');

    if (!detail || !stage) {
      console.warn('Detail or stage not found');
      return;
    }

    const card = PREVIEW_CARDS[idx];
    if (!card) {
      console.warn('Card not found for idx:', idx);
      return;
    }

    // Render component into detail stage
    const rect = previewRectForCard(card);
    const previewScale = rect.scale || 1;
    const useZoomPreview = shouldUseZoomPreviewForRole(card && card.role);
    let html = '';
    
    if (card.role === 'composite-set') {
      const children = (card.variant && card.variant.children) || [];
      
      // Calculate actual bounding box of children for perfect centering
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      if (children.length > 0) {
        children.forEach(c => {
          minX = Math.min(minX, c.x);
          minY = Math.min(minY, c.y);
          maxX = Math.max(maxX, c.x + c.w);
          maxY = Math.max(maxY, c.y + c.h);
        });
      } else {
        minX = 0; minY = 0; maxX = 340; maxY = 340;
      }

      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const offsetX = (rect.w - contentW) / 2 - minX;
      const offsetY = (rect.h - contentH) / 2 - minY;

      html = '<div class="composite-set-container theme-preview-container" style="position:relative; width:' + rect.w + 'px; height:' + rect.h + 'px; border:none; box-shadow:none; border-radius: 48px;">';
      children.forEach(child => {
        if (typeof window.renderAtomicForRole === 'function') {
          const childHtml = window.renderAtomicForRole({ role: child.role, variant: child.variant || {} }, { w: child.w, h: child.h });
          const left = child.x + offsetX;
          const top = child.y + offsetY;
          const isMusic = child.role === 'dot-music-1x1';
          
          // Theme view only: Calculate overlaps and adjust sizes slightly if necessary
          // Note: In original design, Productivity Set does not have overlap issues,
          // so we don't apply scale by default unless it's a known tight layout
          const sizeStyle = ''; 
          
          html += '<div class="composite-child' + (isMusic ? ' is-orange' : '') + '" data-comp-role="' + child.role + '" style="position:absolute; left:' + left + 'px; top:' + top + 'px; width:' + child.w + 'px; height:' + child.h + 'px; ' + sizeStyle + '">' + childHtml + '</div>';
        }
      });
      html += '</div>';
    } else if (isDotWeather21LightPairCard(card)) {
      html = renderDotWeather21PairHtml(card.variant);
    } else {
      html = window.renderAtomicForRole(card, rect);
    }
    
    var scaleStyle = useZoomPreview
      ? ('zoom:' + previewScale + ';transform:none;')
      : ('transform:scale(' + previewScale + ');');

    stage.innerHTML =
      '<div class="stage-scale" style="width:' + rect.w + 'px;' +
      'min-height:' + rect.h + 'px;height:auto;' +
      scaleStyle + '">' + html + '</div>';
    
    // Ensure stage has correct dimensions for scaling
    const scaleRoot = stage.firstElementChild;
    if (scaleRoot) {
      if (useZoomPreview) {
        stage.style.width = Math.ceil(rect.w * previewScale) + 'px';
        stage.style.height = Math.ceil(rect.h * previewScale) + 'px';
      } else {
        stage.style.width = Math.ceil(rect.w * previewScale) + 'px';
        stage.style.height = 'auto'; // Let scaleRoot determine height
      }
    }
    
    // Reset state to idle
    const cardEls = stage.querySelectorAll('.dot-card, .focus-block, .notif-card, .now-bar, .media-card, .progress-track');
    cardEls.forEach(function (cardEl) { cardEl.setAttribute('data-state', 'idle'); });
    if (isDotWeather21LightPairCard(card)) mountDotPairRainMotionInStage(stage);

    // Detail controls: dot-time-matrix time scrubber
    if (controls) {
      controls.innerHTML = '';
      controls.style.display = 'none';
    }

    if (card && card.role === 'dot-time-matrix' && controls && typeof window.renderAtomicForRole === 'function') {
      controls.style.display = 'flex';

      var wrap = document.createElement('div');
      wrap.className = 'timemat-controls';
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.gap = '10px';
      wrap.style.minWidth = '320px';

      var title = document.createElement('div');
      title.textContent = 'Time scrubber';
      title.style.color = 'rgba(255,255,255,0.72)';
      title.style.fontSize = '12px';
      title.style.fontWeight = '600';
      title.style.letterSpacing = '0.06em';
      title.style.textTransform = 'uppercase';

      var row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '12px';

      var range = document.createElement('input');
      range.type = 'range';
      range.min = '0';
      range.max = String(24 * 60 - 1);
      range.step = '1';
      range.value = String((new Date()).getHours() * 60 + (new Date()).getMinutes());
      range.style.flex = '1';

      var label = document.createElement('div');
      label.style.minWidth = '84px';
      label.style.textAlign = 'right';
      label.style.color = '#fff';
      label.style.fontSize = '13px';
      label.style.fontWeight = '700';

      function pad2(n) { return String(n).padStart(2, '0'); }
      function timeTextFromMinutes(total) {
        var h24 = Math.floor(total / 60);
        var m = total % 60;
        var isAM = h24 < 12;
        var h12 = h24 % 12;
        if (h12 === 0) h12 = 12;
        return { hh: pad2(h12), mm: pad2(m), period: isAM ? 'AM' : 'PM' };
      }

      // Crossfade between two renders for "animation" feel.
      var pendingRAF = 0;
      function updateTime() {
        var mins = parseInt(range.value, 10) || 0;
        var t = timeTextFromMinutes(mins);
        label.textContent = t.hh + ':' + t.mm + ' ' + t.period;

        // Re-render stage with updated variant values.
        var next = {
          role: 'dot-time-matrix',
          variant: Object.assign({}, (card && card.variant) || {}, {
            time: t.hh + ':' + t.mm,
            meta: t.period + ' ' + (['SUN','MON','TUE','WED','THU','FRI','SAT'][(new Date()).getDay()]),
          })
        };
        var nextHtml = window.renderAtomicForRole(next, rect);

        // lightweight crossfade
        stage.style.transition = 'opacity 140ms ease';
        stage.style.opacity = '0.0';
        if (pendingRAF) cancelAnimationFrame(pendingRAF);
        pendingRAF = requestAnimationFrame(function () {
          stage.innerHTML = nextHtml;
          stage.style.opacity = '1';
        });
      }

      range.addEventListener('input', updateTime);
      updateTime();

      row.appendChild(range);
      row.appendChild(label);
      wrap.appendChild(title);
      wrap.appendChild(row);
      controls.appendChild(wrap);
    }
  }

  grid.addEventListener('click', function (e) {
    if (e.detail !== 1) return;
    const handled = handleCompositeMusicClick(e);
    if (handled) return;

    var cell = e.target.closest('.preview-cell');
    if (!cell || !grid.contains(cell)) return;
    var raw = cell.getAttribute('data-preview-index');
    if (raw == null || raw === '') return;
    var idx = parseInt(raw, 10);
    if (isNaN(idx)) return;
    e.preventDefault();
    applyPreviewSelection(idx);
  });

  const stage = $('detail-stage');
  if (stage) {
    stage.addEventListener('click', handleCompositeMusicClick);
  }

  function handleCompositeMusicClick(e) {
    const compMusic = e.target.closest('.composite-child[data-comp-role="dot-music-1x1"]');
    if (compMusic) {
      const container = compMusic.closest('.composite-set-container');
      if (container) {
        const cell = compMusic.closest('.preview-cell');
        const raw = cell && cell.getAttribute('data-preview-index');
        const idx = raw == null || raw === '' ? -1 : parseInt(raw, 10);
        const parentCard = idx >= 0 ? PREVIEW_CARDS[idx] : null;
        const children = (parentCard && parentCard.variant && parentCard.variant.children) || [];
        const musicChild = children.find(child => child && child.role === 'dot-music-1x1') || {};

        e.preventDefault();
        e.stopPropagation();

        renderDetailCard({
          role: 'dot-music-1x1',
          variant: musicChild.variant || {},
          editSections: ['Page', 'Card globals']
        });

        return true;
      }
    }
    return false;
  }
  grid.addEventListener('dblclick', function (e) {
    var stage = e.target.closest && e.target.closest('.preview-cell .stage');
    var cell = e.target.closest && e.target.closest('.preview-cell');
    if (!stage || !cell || !grid.contains(cell)) return;
    e.preventDefault();
    e.stopPropagation();
    var raw = cell.getAttribute('data-preview-index');
    var idx = parseInt(raw, 10);
    if (isNaN(idx)) return;
    if (SELECTED_PREVIEW_INDEX !== idx) SELECTED_PREVIEW_INDEX = idx;
    var card = PREVIEW_CARDS[idx];
    var targetEl = e.target.nodeType === 3 ? e.target.parentElement : e.target;
    var hit = _resolveInspectorLayer(card, targetEl, stage);
    INSPECTOR_LAYER = hit;
    INSPECTOR_DOM_PATH = hit ? { idx: idx, path: _domPathFromStage(stage, targetEl) } : null;
    renderPreviewGrid();
    buildEditorBody();
    updateEditorScopeUI();
  });
  grid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var cell = e.target.closest('.preview-cell');
    if (!cell || !grid.contains(cell)) return;
    var raw = cell.getAttribute('data-preview-index');
    if (raw == null || raw === '') return;
    e.preventDefault();
    var idx = parseInt(raw, 10);
    if (isNaN(idx)) return;
    applyPreviewSelection(idx);
  });
})();

boot();
