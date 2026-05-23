// ============================================================================
//  app/settings.js — canvas settings UI: device/theme/layout/colors/wallpaper/motion/brand
//  ---------------------------------------------------------------------------
//  Stateless(ish) handlers bound to sidebar controls. Writes to canvas or frame
//  DOM and to a handful of global vars (currentMotion/Easing/Duration, colorTarget,
//  userWallpaperChoice).
// ============================================================================

// === DEVICE ===
const deviceMeta = {
  mobile: { icon:'📱', name:'Galaxy S26' },
  tablet: { icon:'📋', name:'Galaxy Tab S10+' },
  watch:  { icon:'⌚', name:'Galaxy Watch 7' },
  tv:     { icon:'📺', name:'Samsung TV' },
  desktop:{ icon:'💻', name:'Galaxy Book' }
};
function toggleDeviceList() {
  const list = document.getElementById('deviceList');
  const btn = document.getElementById('deviceBtn');
  const show = !list.classList.contains('show');
  list.classList.toggle('show', show);
  btn.classList.toggle('open', show);
  if (show) {
    const close = (e) => {
      if (!document.getElementById('deviceSelector').contains(e.target)) {
        list.classList.remove('show'); btn.classList.remove('open');
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
}
function selectDevice(mode, el) {
  const frame = document.getElementById('canvasFrame');
  frame.classList.remove('desktop', 'tv', 'watch', 'tablet');
  if (mode !== 'mobile') frame.classList.add(mode);
  document.querySelectorAll('.device-list-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  const meta = deviceMeta[mode];
  document.getElementById('deviceBtnLabel').textContent = meta.name;
  document.querySelector('#deviceBtn .dev-icon').textContent = meta.icon;
  document.getElementById('deviceList').classList.remove('show');
  document.getElementById('deviceBtn').classList.remove('open');
}

// === THEME ===
// Canvas mode toggle. Label shows the *target* mode (opposite of current):
//   current = dark → button says "Light" (click → switch to light)
//   current = light → button says "Dark" (click → switch to dark)
function toggleTheme() {
  const frame = document.getElementById('canvasFrame');
  frame.classList.toggle('light');
  _syncThemeToggleLabel();
}
function _syncThemeToggleLabel() {
  const frame = document.getElementById('canvasFrame');
  const btn   = document.getElementById('themeToggleBtn');
  if (!frame || !btn) return;
  btn.textContent = frame.classList.contains('light') ? 'Dark' : 'Light';
}
// Initial sync after DOM ready
document.addEventListener('DOMContentLoaded', _syncThemeToggleLabel);

// === LAYOUT → SURFACE (temporary compat shim) ===
// Old layout presets now map to surface types. Later: rename UI labels to
// First depth / Second depth / Dialog / QS / Lock screen and drop this map.
function setLayout(type, el) {
  const surfaceMap = {
    column: window.SURFACE_TYPES ? window.SURFACE_TYPES.FIRST_DEPTH_LIST : 'first-depth-list',
    'two-col': window.SURFACE_TYPES ? window.SURFACE_TYPES.SECOND_DEPTH_DETAIL : 'second-depth-detail',
    grid: window.SURFACE_TYPES ? window.SURFACE_TYPES.TAB_ROOT : 'tab-root',
    app: window.SURFACE_TYPES ? window.SURFACE_TYPES.FIRST_DEPTH_LIST : 'first-depth-list',
    hero: window.SURFACE_TYPES ? window.SURFACE_TYPES.SECOND_DEPTH_DETAIL : 'second-depth-detail',
    free: window.SURFACE_TYPES ? window.SURFACE_TYPES.DIALOG_BOTTOM : 'dialog-bottom'
  };

  if (typeof window.setSurfaceType === 'function') {
    window.setSurfaceType(surfaceMap[type], el);
    return;
  }

  document.querySelectorAll('.layout-preset').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
}
// === GAP / PADDING (axis-split) ===
// Track H / V independently. CSS `gap` = "<row> <col>" (rowGap = V, colGap = H).
let _gapH = 8, _gapV = 8;
let _padH = 16, _padV = 16;

function _applyGap() {
  const canvas = document.getElementById('canvas');
  if (canvas) canvas.style.gap = _gapV + 'px ' + _gapH + 'px'; // rowGap colGap
}
function _applyPadding() {
  const canvas = document.getElementById('canvas');
  if (canvas) canvas.style.padding = _padV + 'px ' + _padH + 'px'; // vertical horizontal
}
function _setText(ids, val) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = val + 'px'; });
}

function setGapH(v) {
  _gapH = +v; _applyGap();
  _setText(['gapHValue', 'gapHValue2'], v);
}
function setGapV(v) {
  _gapV = +v; _applyGap();
  _setText(['gapVValue', 'gapVValue2'], v);
}
function setPaddingH(v) {
  _padH = +v; _applyPadding();
  _setText(['padHValue', 'padHValue2'], v);
}
function setPaddingV(v) {
  _padV = +v; _applyPadding();
  _setText(['padVValue', 'padVValue2'], v);
}

// Back-compat shims for any legacy callers (generateScenario etc.)
function setGap(v) { setGapH(v); setGapV(v); }
function setPadding(v) { setPaddingH(v); setPaddingV(v); }
function setAlign(a, btn) {
  document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('canvas').style.alignItems = a;
}

// === COLORS ===
function setColorTarget(t, btn) {
  colorTarget = t;
  document.querySelectorAll('.color-target button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
// Lightweight toast — used by applyColor and other Design-tab interactions
// to surface "no selection" / "applied X" status without an obtrusive alert.
// Floats bottom-center for ~1.6s then fades. Reuses an existing #appToast
// element if present (avoids stacking ghosts), creates one otherwise.
function showToast(msg) {
  let el = document.getElementById('appToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appToast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(8px);' +
      'padding:10px 18px;border-radius:999px;background:rgba(23,23,26,0.92);color:#efeef2;' +
      'font-size:13px;font-weight:500;font-family:var(--font);box-shadow:0 8px 32px rgba(0,0,0,0.4);' +
      'border:1px solid rgba(255,255,255,0.12);' +
      'opacity:0;pointer-events:none;transition:opacity 0.18s, transform 0.18s;z-index:9999;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(el._fadeTimer);
  el._fadeTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(8px)';
  }, 1600);
}
window.showToast = showToast;

function applyColor(color) {
  // No-selection guard — without this the swatch click was a no-op and
  // the user had no signal as to why. Show a brief hint and bail.
  if (!selectedItems || selectedItems.size === 0) {
    showToast('Select a component on the canvas first, then pick a color');
    return;
  }
  selectedItems.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const target = el.firstElementChild || el;
    switch (colorTarget) {
      case 'bg':
        target.style.background = color;
        break;
      case 'text': {
        // Inline-style override walk — the rich-card renderers emit
        // explicit `color:#fff` (etc.) on every text node, which
        // overrides the wrapper's color via cascade. To make the
        // panel actually visible-affect text, we set the color on
        // every descendant that already has an inline color value.
        target.style.color = color;
        target.querySelectorAll('*').forEach(node => {
          if (node.style && node.style.color) {
            node.style.color = color;
          }
        });
        break;
      }
      case 'border':
        target.style.border = '1.5px solid ' + color;
        break;
    }
  });
}

// === WALLPAPER ===
const wallpapers = {
  'none': '#171717',
  'dialog-surface': '#1c1c1e',
  'wp-1': "url('wallpapers/1.webp') center/cover no-repeat",
  'wp-2': "url('wallpapers/2.webp') center/cover no-repeat",
  'wp-3': "url('wallpapers/3.webp') center/cover no-repeat",
  'wp-4': "url('wallpapers/4.png') center/cover no-repeat",
  'galaxy-blue': 'linear-gradient(160deg,#0a1628 0%,#0d2847 25%,#1a4a7a 50%,#0d3b6e 75%,#081e3d 100%)',
  'galaxy-purple': 'linear-gradient(160deg,#1a0a2e 0%,#2d1b69 30%,#5b2d8e 55%,#3a1d6e 75%,#1a0a3e 100%)',
  'galaxy-green': 'linear-gradient(160deg,#0a1e14 0%,#0d3a28 30%,#1a6b4a 55%,#0d4a32 75%,#081e14 100%)',
  'galaxy-orange': 'linear-gradient(160deg,#1a0e08 0%,#4a1a08 25%,#8a3a10 45%,#c46a20 60%,#e8a040 75%,#4a1a08 100%)',
  'galaxy-rose': 'linear-gradient(160deg,#1e0a14 0%,#4a1028 30%,#8a2050 50%,#c43070 65%,#4a1028 100%)',
  'galaxy-night': 'linear-gradient(180deg,#020810 0%,#0a1428 40%,#0d1e3a 60%,#060e1e 100%)',
  'galaxy-abstract': 'linear-gradient(135deg,#0a0a1e 0%,#1428a0 30%,#0381fe 50%,#64e9e3 70%,#0a1428 100%)',
};
// Tracks the user's last deliberately-chosen wallpaper, so that when a scenario
// swaps in 'solid-dark' / 'dialog-surface' we can restore the real pick on
// home/lockscreen scenarios.
let userWallpaperChoice = 'wp-1';
// 'dialog-surface' is a system-only entry; 'galaxy-night' is user-selectable
// too, so we rely on the `system:true` flag (not the name) to decide whether
// a swap should update userWallpaperChoice.
const SYSTEM_WALLPAPERS = new Set(['dialog-surface']);

function setWallpaper(name, opts) {
  const frame = document.getElementById('canvasFrame');
  document.querySelectorAll('.wp-thumb').forEach(t => t.classList.remove('active'));
  if (typeof event !== 'undefined' && event.currentTarget) event.currentTarget.classList.add('active');
  // Remember user-driven picks; ignore system swaps triggered by the resolver.
  if (!(opts && opts.system) && !SYSTEM_WALLPAPERS.has(name)) {
    userWallpaperChoice = name;
  }
  const bg = wallpapers[name];
  // Use individual properties so size/position/repeat stay correct
  if (bg.startsWith('url')) {
    const match = bg.match(/url\(['"]?([^'"\)]+)['"]?\)/);
    frame.style.backgroundImage = match ? `url('${match[1]}')` : bg;
    frame.style.backgroundColor = '';
  } else if (bg.startsWith('linear') || bg.startsWith('radial')) {
    frame.style.backgroundImage = bg;
    frame.style.backgroundColor = '';
  } else {
    frame.style.backgroundImage = 'none';
    frame.style.backgroundColor = bg;
  }
  frame.style.backgroundSize = 'cover';
  frame.style.backgroundPosition = 'center center';
  frame.style.backgroundRepeat = 'no-repeat';
}
function setWallpaperUrl(url) {
  if (!url) return;
  const frame = document.getElementById('canvasFrame');
  document.querySelectorAll('.wp-thumb').forEach(t => t.classList.remove('active'));
  frame.style.backgroundImage = `url('${url}')`;
  frame.style.backgroundSize = 'cover';
  frame.style.backgroundPosition = 'center center';
  frame.style.backgroundRepeat = 'no-repeat';
}
function uploadWallpaper(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const frame = document.getElementById('canvasFrame');
    document.querySelectorAll('.wp-thumb').forEach(t => t.classList.remove('active'));
    frame.style.background = `url('${ev.target.result}') center/cover no-repeat`;
  };
  reader.readAsDataURL(file);
}
function showAiWallpaper() {
  const panel = document.getElementById('aiWpPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}
// Unified entry for the Custom Wallpaper field in the Design tab: the user
// types EITHER an image URL OR a text description. Detect which and route.
function submitCustomWallpaper() {
  const input = document.getElementById('wpUrl2');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  const urlPattern = /^(https?:\/\/|www\.|data:image\/)|^[a-z0-9-]+\.[a-z]{2,}\//i;
  if (urlPattern.test(raw)) {
    setWallpaperUrl(raw);
    return;
  }
  // Text description → proxy into generateAiWallpaper via a shim
  const shim = document.createElement('input');
  shim.id = 'aiWpPrompt';
  shim.value = raw;
  shim.style.display = 'none';
  document.body.appendChild(shim);
  // Show the results panel in Design tab
  const panel = document.getElementById('aiWpPanel2');
  if (panel) panel.style.display = 'block';
  // Ensure results render into #aiWpResults2 by temporarily aliasing #aiWpResults
  const resultsAlias = document.getElementById('aiWpResults2');
  if (resultsAlias && !document.getElementById('aiWpResults')) {
    resultsAlias.id = 'aiWpResults';
    try { generateAiWallpaper(); }
    finally { resultsAlias.id = 'aiWpResults2'; shim.remove(); }
  } else {
    try { generateAiWallpaper(); } finally { shim.remove(); }
  }
}

function generateAiWallpaper() {
  const prompt = document.getElementById('aiWpPrompt').value.trim();
  if (!prompt) return;
  const results = document.getElementById('aiWpResults');
  if (!results) return;
  results.innerHTML = '';
  // Generate 4 CSS gradient variations based on keywords
  const colorMaps = {
    aurora: [['#0a1e14','#0d4a32','#1aaa6a','#64e9e3','#0d2847'],['#0a0a2e','#1a4a7a','#20c070','#64e9e3','#0a1628']],
    sunset: [['#1a0808','#6a1a08','#c44a10','#e8a040','#f0c860'],['#1a0a14','#6a1028','#c43060','#e88040','#f0c060']],
    ocean: [['#020810','#0a2040','#0d4a8a','#1a7aba','#0a3060'],['#081018','#0d2e58','#1a5a9a','#3090c0','#0a2040']],
    space: [['#020208','#0a0a28','#1a0a4a','#3a1a8a','#0a0a18'],['#080410','#140a30','#2a1060','#5020a0','#0a0618']],
    forest: [['#0a1208','#1a3a10','#2a6a20','#1a4a14','#0a1e08'],['#081008','#143010','#206018','#184a10','#0a1808']],
    sky: [['#0a2040','#1a5090','#3090e0','#60c0f0','#90d8ff'],['#0a1830','#144080','#2080d0','#50b0e8','#80d0f8']],
    night: [['#020208','#060e1e','#0a1428','#0d1e3a','#020810'],['#040410','#080a20','#0e1430','#121e40','#040810']],
    fire: [['#1a0804','#4a1008','#8a2010','#d04020','#f08030'],['#200a04','#5a1408','#a03018','#e05028','#f09038']],
    galaxy: [['#0a0a1e','#1a1060','#3a20a0','#0381fe','#64e9e3'],['#080818','#141050','#2a1890','#0270e0','#50d8d0']],
  };
  const words = prompt.toLowerCase().split(/\s+/);
  let palette = null;
  for (const w of words) {
    for (const [key, pals] of Object.entries(colorMaps)) {
      if (w.includes(key) || key.includes(w)) { palette = pals; break; }
    }
    if (palette) break;
  }
  if (!palette) {
    // Random warm/cool based on first char
    const seed = prompt.charCodeAt(0) % 2;
    palette = seed === 0
      ? [['#0a1628','#1a3a6a','#2a6aaa','#1a4a8a','#0a2040'],['#0a0a2e','#1a2a6e','#2a4aae','#1a3a8e','#0a1a40']]
      : [['#1a0a14','#3a1a3e','#5a2a6e','#3a1a4e','#1a0a24'],['#140a1e','#2a1438','#4a2460','#2a1440','#140a20']];
  }
  // Generate 4 variations with slight angle changes
  const angles = [135, 160, 180, 200];
  for (let i = 0; i < 4; i++) {
    const pal = palette[i % palette.length];
    const shuffled = [...pal].sort(() => Math.random() - 0.5);
    const grad = `linear-gradient(${angles[i]}deg,${shuffled[0]} 0%,${shuffled[1]} 25%,${shuffled[2]} 50%,${shuffled[3]} 75%,${shuffled[4]} 100%)`;
    const thumb = document.createElement('div');
    thumb.className = 'wp-thumb';
    thumb.innerHTML = `<div style="width:100%;height:100%;background:${grad};"></div>`;
    thumb.onclick = function() {
      const frame = document.getElementById('canvasFrame');
      document.querySelectorAll('.wp-thumb').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      frame.style.background = grad;
    };
    results.appendChild(thumb);
  }
}


// === MOTION ===
function selectMotion(anim, el) {
  currentMotion = anim;
  el.closest('.motion-grid').querySelectorAll('.motion-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
}
function selectEasing(el) {
  currentEasing = el.dataset.ease;
  el.parentElement.querySelectorAll('.motion-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
}
function onDurSlider(val) {
  currentDuration = parseInt(val);
  // Update all duration sliders (panel-4 legacy + panel-6 design)
  ['durSlider','durSlider2'].forEach(id => {
    const slider = document.getElementById(id);
    if (slider) { slider.value = val; slider.style.setProperty('--pct', ((val - 100) / 700) * 100 + '%'); }
  });
  ['durValue','durValue2'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = val + 'ms'; });
  const labels = [{max:150,t:'Instant'},{max:250,t:'Fast'},{max:400,t:'Normal'},{max:600,t:'Slow'},{max:800,t:'Page'}];
  const lbl = labels.find(l => val <= l.max) || labels[labels.length-1];
  ['durLabel','durLabel2'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = lbl.t; });
}
function setDurSlider(val) {
  ['durSlider','durSlider2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = val; });
  onDurSlider(val);
}
function previewMotion() {
  selectedItems.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = `${currentMotion} ${currentDuration}ms ${currentEasing} forwards`;
  });
  // If nothing selected, animate all
  if (selectedItems.size === 0) {
    document.querySelectorAll('.canvas-item').forEach(el => {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = `${currentMotion} ${currentDuration}ms ${currentEasing} forwards`;
    });
  }
}


// =============================================
// === BRAND THEMES ===
// =============================================
// =============================================
// === BRAND THEMES (card style + nav style ONLY) ===
// === All other tokens remain One UI 8.5      ===
// =============================================
const brandThemes = {
  samsung: {
    name: 'Samsung One UI 8.5',
    cardStyle: 'background:#222;border:1px solid rgba(255,255,255,0.06);',
    navStyle: 'background:rgba(255,255,255,0.08);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.12);',
    dialogStyle: 'background:#222;border:1px solid rgba(255,255,255,0.06);',
    desc: 'Solid surface + Glass UI floating nav (Ambient Design)',
  },
  apple: {
    name: 'Apple Liquid Glass',
    cardStyle: 'background:rgba(255,255,255,0.06);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border:1px solid rgba(255,255,255,0.18);',
    navStyle: 'background:rgba(255,255,255,0.10);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border:1px solid rgba(255,255,255,0.22);',
    dialogStyle: 'background:rgba(255,255,255,0.08);backdrop-filter:blur(50px);-webkit-backdrop-filter:blur(50px);border:1px solid rgba(255,255,255,0.2);',
    desc: 'Heavy frosted glass on all surfaces (Liquid Glass)',
  },
  google: {
    name: 'Google Material You',
    cardStyle: 'background:#2D2D2D;border:none;',
    navStyle: 'background:#2D2D2D;border:none;border-top:none;',
    dialogStyle: 'background:#2D2D2D;border:none;',
    desc: 'Solid opaque surfaces, no borders, elevation via shadow',
  },
  meta: {
    name: 'Meta Design System',
    cardStyle: 'background:#242526;border:1px solid rgba(255,255,255,0.05);',
    navStyle: 'background:#242526;border-top:1px solid rgba(255,255,255,0.05);',
    dialogStyle: 'background:#242526;border:1px solid rgba(255,255,255,0.05);',
    desc: 'Dense opaque surfaces, low-contrast borders',
  },
};

function setBrand(brand, btn) {
  currentBrand = brand;
  document.querySelectorAll('.brand-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Only change card style + nav style (all One UI tokens preserved)
  const theme = brandThemes[brand];
  const canvas = document.getElementById('canvas');

  // Cards & containers
  canvas.querySelectorAll('.oui-card').forEach(el => {
    el.style.cssText = theme.cardStyle + 'border-radius:26px;padding:20px;width:100%;';
  });
  canvas.querySelectorAll('.oui-dialog').forEach(el => {
    el.style.cssText = theme.dialogStyle + 'border-radius:26px;padding:24px 20px 16px;width:100%;max-width:300px;margin:0 auto;';
  });
  // Navigation
  canvas.querySelectorAll('.oui-pill-tab').forEach(el => {
    el.style.cssText = theme.navStyle + 'border-radius:999px;display:inline-flex;align-items:center;gap:4px;padding:6px 8px;';
  });
  canvas.querySelectorAll('.oui-bottomnav').forEach(el => {
    el.style.cssText = theme.navStyle + 'width:100%;height:56px;display:flex;align-items:center;justify-content:space-around;border-radius:0;margin-top:auto;flex-shrink:0;';
  });
  canvas.querySelectorAll('.oui-appbar').forEach(el => {
    el.style.cssText = theme.navStyle.replace('border-top','border-bottom') + 'width:100%;height:56px;display:flex;align-items:center;padding:0 12px;gap:8px;border-radius:0;';
  });
  // Grouped cards (container rule)
  canvas.querySelectorAll('.canvas-group').forEach(el => {
    el.style.cssText = theme.cardStyle + 'border-radius:18px;padding:12px;display:flex;flex-direction:column;gap:8px;border-style:dashed;';
  });
}

// Override generateScenario to apply brand theme
