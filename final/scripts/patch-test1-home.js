const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const layoutPath = path.join(ROOT, 'public/app/surface-layout.js');
const cssPath = path.join(ROOT, 'styles/theme-page.css');
const restoreCssPath = path.join(ROOT, '_restore_test1_css.css');

let layout = fs.readFileSync(layoutPath, 'utf8');
const restoreCss = fs.readFileSync(restoreCssPath, 'utf8');

// --- 1. TAB_ROOT test1 component list ---
const oldTest1Block = `      if (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test1') {
        // Persona 1 — static lockscreen mock (public/Lock Screen.png via CSS)
        var test1RevealAll = !!(window.__mlpTestConfig && window.__mlpTestConfig.test1RevealAll);
        var test1StackGap = 16;
        var test1LotteY = test1RevealAll ? (411 + 72 + test1StackGap) : 411;
        var test1TransitScale = 1.177;
        var test1TransitVisW = Math.round(294 * test1TransitScale);
        var test1TransitVisH = Math.round(134 * test1TransitScale);
        var test1TransitX = Math.round((388 - test1TransitVisW) / 2) - 2;
        var test1ShortcutY = 797;
        var test1TransitGapAboveShortcut = test1StackGap;
        var test1TransitY = test1ShortcutY - test1TransitGapAboveShortcut - test1TransitVisH;
        var test1LotteStackY = test1LotteY + 88;
        return {
          surfaceType,
          components: [
            { id: 'test1-now-bar-b', role: 'test1-now-bar-b', zone: 'viewing',
              _rect: { x: 21, y: 421, w: 346, h: 72 } },
            { id: 'test1-now-bar', role: 'test1-now-bar', zone: 'viewing',
              _rect: { x: 21, y: test1LotteY, w: 346, h: 72 } },
            { id: 'test1-transit-card', role: 'test1-transit-card', zone: 'viewing',
              _rect: { x: test1TransitX, y: test1TransitY, w: test1TransitVisW, h: test1TransitVisH } },
            { id: 'test1-gradient-sweep-a', role: 'test1-gradient-sweep', zone: 'viewing',
              _rect: { x: 21, y: 421, w: 346, h: 72 }, variant: { sweepShape: 'bar' } },
            { id: 'test1-gradient-sweep-b', role: 'test1-gradient-sweep', zone: 'viewing',
              _rect: { x: 21, y: test1LotteStackY, w: 346, h: 72 }, variant: { sweepShape: 'bar' } },
            { id: 'test1-gradient-sweep-c', role: 'test1-gradient-sweep', zone: 'viewing',
              _rect: { x: test1TransitX, y: test1TransitY, w: test1TransitVisW, h: test1TransitVisH }, variant: { sweepShape: 'card' } },
            { id: 'test1-l-shortcut', role: 'test1-lock-shortcut-l', zone: 'bottomNav',
              _rect: { x: 16.5, y: 795, w: 64, h: 57 } },
            { id: 'test1-r-shortcut', role: 'test1-lock-shortcut-r', zone: 'bottomNav',
              _rect: { x: 307.5, y: 795, w: 64, h: 57 } },
            { id: 'test1-bottom-pill', role: 'test1-bottom-pill', zone: 'bottomNav',
              _rect: { x: 96.5, y: 797, w: 215, h: 57 } }
          ]
        };
      }`;

const newTest1Block = `      if (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test1') {
        // Persona 1 — lockscreen intro + pre-mounted home widgets (revealed on pill swipe)
        var test1RevealAll = !!(window.__mlpTestConfig && window.__mlpTestConfig.test1RevealAll);
        var test1StackGap = 16;
        var test1LotteY = test1RevealAll ? (411 + 72 + test1StackGap) : 411;
        var test1TransitScale = 1.177;
        var test1TransitVisW = Math.round(294 * test1TransitScale);
        var test1TransitVisH = Math.round(134 * test1TransitScale);
        var test1TransitX = Math.round((388 - test1TransitVisW) / 2) - 2;
        var test1ShortcutY = 797;
        var test1TransitGapAboveShortcut = test1StackGap;
        var test1TransitY = test1ShortcutY - test1TransitGapAboveShortcut - test1TransitVisH;
        var test1LotteStackY = test1LotteY + 88;
        var test1HomeColX = 21;
        var test1HomeColW = 346;
        var test1HomeHeaderY = 72;
        var test1HomeHeaderH = 62;
        var test1HomeSmallW = 163;
        var test1HomeSmallH = 178;
        var test1HomeSmallGap = 14;
        var test1HomeRowY = test1HomeHeaderY + test1HomeHeaderH + 6;
        var test1HomeRowX = test1HomeColX + Math.round((test1HomeColW - (test1HomeSmallW * 2 + test1HomeSmallGap)) / 2);
        var test1HomeFoodW = 340;
        var test1HomeFoodY = test1HomeRowY + test1HomeSmallH + 10;
        var test1HomeFoodH = 662 - test1HomeFoodY - 8;
        var test1HomeFoodX = test1HomeColX + Math.round((test1HomeColW - test1HomeFoodW) / 2);
        return {
          surfaceType,
          components: [
            { id: 'test1-now-bar-b', role: 'test1-now-bar-b', zone: 'viewing',
              _rect: { x: 21, y: 421, w: 346, h: 72 } },
            { id: 'test1-now-bar', role: 'test1-now-bar', zone: 'viewing',
              _rect: { x: 21, y: test1LotteY, w: 346, h: 72 } },
            { id: 'test1-transit-card', role: 'test1-transit-card', zone: 'viewing',
              _rect: { x: test1TransitX, y: test1TransitY, w: test1TransitVisW, h: test1TransitVisH } },
            { id: 'test1-gradient-sweep-a', role: 'test1-gradient-sweep', zone: 'viewing',
              _rect: { x: 21, y: 421, w: 346, h: 72 }, variant: { sweepShape: 'bar' } },
            { id: 'test1-gradient-sweep-b', role: 'test1-gradient-sweep', zone: 'viewing',
              _rect: { x: 21, y: test1LotteStackY, w: 346, h: 72 }, variant: { sweepShape: 'bar' } },
            { id: 'test1-gradient-sweep-c', role: 'test1-gradient-sweep', zone: 'viewing',
              _rect: { x: test1TransitX, y: test1TransitY, w: test1TransitVisW, h: test1TransitVisH }, variant: { sweepShape: 'card' } },
            { id: 'test1-l-shortcut', role: 'test1-lock-shortcut-l', zone: 'bottomNav',
              _rect: { x: 16.5, y: 795, w: 64, h: 57 } },
            { id: 'test1-r-shortcut', role: 'test1-lock-shortcut-r', zone: 'bottomNav',
              _rect: { x: 307.5, y: 795, w: 64, h: 57 } },
            { id: 'test1-bottom-pill', role: 'test1-bottom-pill', zone: 'bottomNav',
              _rect: { x: 96.5, y: 797, w: 215, h: 57 } },
            { id: 'status-bar', role: 'status-bar', zone: 'topSystem',
              variant: { theme: 'light', carrier: '12:45', battery: 69 } },
            { id: 'test1-home-header', role: 'test1-home-header', zone: 'viewing',
              _rect: { x: test1HomeColX, y: test1HomeHeaderY, w: test1HomeColW, h: test1HomeHeaderH } },
            { id: 'test1-home-map', role: 'test1-home-map', zone: 'viewing',
              _rect: { x: test1HomeRowX, y: test1HomeRowY, w: test1HomeSmallW, h: test1HomeSmallH } },
            { id: 'test1-home-message', role: 'test1-home-message', zone: 'viewing',
              _rect: { x: test1HomeRowX + test1HomeSmallW + test1HomeSmallGap, y: test1HomeRowY, w: test1HomeSmallW, h: test1HomeSmallH } },
            { id: 'test1-home-food', role: 'test1-home-food', zone: 'viewing',
              _rect: { x: test1HomeFoodX, y: test1HomeFoodY, w: test1HomeFoodW, h: test1HomeFoodH } },
            { id: 'test1-page-dots', role: 'test1-page-dots', zone: 'viewing',
              _rect: { x: 0, y: 662, w: 388, h: 24 } },
            { id: 'test1-app-dock', role: 'test1-app-dock', zone: 'bottomNav' },
            { id: 'gesture-bar', role: 'gestureBar', zone: 'bottomAction' }
          ]
        };
      }`;

if (!layout.includes(oldTest1Block)) {
  console.error('Could not find test1 TAB_ROOT block');
  process.exit(1);
}
layout = layout.replace(oldTest1Block, newTest1Block);

// --- 2. resolveComponentRect test1-app-dock ---
layout = layout.replace(
  "    case 'bottom-navigation':\n    case 'app-dock':",
  "    case 'bottom-navigation':\n    case 'app-dock':\n    case 'test1-app-dock':"
);

// --- 3. Constants ---
layout = layout.replace(
  'var TEST1_STACK_SHIFT_PX = 72 + TEST1_STACK_ITEM_GAP_PX;',
  'var TEST1_STACK_SHIFT_PX = 72 + TEST1_STACK_ITEM_GAP_PX;\nvar TEST1_HOME_EXIT_MS = 560;'
);

// --- 4. Home render cases ---
const renderInsert = `    case 'test1-app-dock': {
      var test1DockIcons = [
        { src: '/assets/test1/home/dock/messages.png', label: 'Messages' },
        { src: '/assets/test1/home/dock/camera.png', label: 'Camera' },
        { src: '/assets/test1/home/dock/notes.png', label: 'Notes' },
        { src: '/assets/test1/home/dock/maps.png', label: 'Maps' }
      ];
      return '<div class="test1-app-dock" aria-hidden="true">' +
        test1DockIcons.map(function (icon) {
          return '<img class="test1-app-dock__icon" src="' + icon.src + '" alt="" draggable="false" />';
        }).join('') +
      '</div>';
    }

    case 'test1-home-header': {
      return '<div class="test1-home-header">' +
        '<div class="test1-home-header__title">장을 보고 돌아오는 중이에요</div>' +
        '<div class="test1-home-header__sub">저녁 준비를 돕는 화면을 구성했습니다</div>' +
      '</div>';
    }

    case 'test1-home-map': {
      return '<div class="test1-home-widget test1-home-map">' +
        '<div class="test1-home-widget__bg" aria-hidden="true"></div>' +
        '<div class="test1-home-widget__inner">' +
          '<div class="test1-home-map__top">' +
            '<span class="test1-home-widget__chip test1-home-widget__chip--map"><img class="test1-home-widget__chip-icon" src="/assets/test1/home/naver-map-icon.png" alt="" draggable="false" />네이버지도</span>' +
            '<img class="test1-home-map__bus" src="/assets/test1/home/naver-map-chip-icon.png" alt="" draggable="false" />' +
          '</div>' +
          '<div class="test1-home-map__time"><span class="test1-home-map__time-num">5</span><span class="test1-home-map__time-unit">분 뒤</span></div>' +
          '<p class="test1-home-map__sub">진천청구타운 앞 하차</p>' +
          '<div class="test1-home-map__progress">' +
            '<div class="test1-home-map__track"></div>' +
            '<div class="test1-home-map__fill"></div>' +
            '<div class="test1-home-map__thumb"><img src="/assets/test1/home/send-arrow.png" alt="" draggable="false" /></div>' +
          '</div>' +
          '<p class="test1-home-widget__action">안내 종료</p>' +
        '</div>' +
      '</div>';
    }

    case 'test1-home-message': {
      return '<div class="test1-home-widget test1-home-message">' +
        '<div class="test1-home-widget__bg" aria-hidden="true"></div>' +
        '<div class="test1-home-widget__inner">' +
          '<div class="test1-home-message__top">' +
            '<span class="test1-home-widget__chip"><img class="test1-home-widget__chip-icon" src="/assets/test1/home/message-icon.png" alt="" draggable="false" />메시지</span>' +
            '<img class="test1-home-message__avatar" src="/assets/test1/home/daughter-avatar.png" alt="" draggable="false" />' +
          '</div>' +
          '<div class="test1-home-message__copy">' +
            '<p class="test1-home-message__title">우리 딸에게 답장</p>' +
            '<p class="test1-home-message__sub">AI 제안 메시지</p>' +
          '</div>' +
          '<div class="test1-home-message__bubble">' +
            '<p>I\\'m on my way.</p><p>Dinner in 20 min?</p>' +
          '</div>' +
          '<p class="test1-home-widget__action">보내기</p>' +
        '</div>' +
      '</div>';
    }

    case 'test1-home-food': {
      var foodRow = function (iconClass, title, sub) {
        return '<div class="test1-home-food__row">' +
          '<span class="test1-home-food__icon ' + iconClass + '" aria-hidden="true"></span>' +
          '<div class="test1-home-food__copy">' +
            '<p class="test1-home-food__title">' + title + '</p>' +
            '<p class="test1-home-food__sub">' + sub + '</p>' +
          '</div>' +
          '<span class="test1-home-food__chev" aria-hidden="true"></span>' +
        '</div>';
      };
      return '<div class="test1-home-widget test1-home-food">' +
        '<div class="test1-home-widget__bg" aria-hidden="true"></div>' +
        '<div class="test1-home-widget__inner">' +
          '<span class="test1-home-widget__chip test1-home-widget__chip--food"><img class="test1-home-widget__chip-icon" src="/assets/test1/home/smartthings-icon-new.png" alt="" draggable="false" />SmartThings Food</span>' +
          '<div class="test1-home-food__head">' +
            '<p class="test1-home-food__headline">구수한 두부 된장찌개</p>' +
            '<p class="test1-home-food__desc">냉장고 속 식재료로 저녁 메뉴를 추천합니다</p>' +
          '</div>' +
          '<div class="test1-home-food__rows">' +
            foodRow('test1-home-food__icon--tofu', '두부', '오늘 구매한 식재료') +
            foodRow('test1-home-food__icon--zucchini', '애호박', '보관 4일째 · 우선 사용') +
            foodRow('test1-home-food__icon--onion', '대파', '신선칸 보관 중') +
          '</div>' +
          '<div class="test1-home-food__actions">' +
            '<button type="button" class="test1-home-food__btn test1-home-food__btn--alt">다른 메뉴 추천</button>' +
            '<button type="button" class="test1-home-food__btn">레시피 보기</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    case 'test1-page-dots': {
      return '<div class="test1-page-dots">' +
        '<span class="test1-page-dots__dot"></span>' +
        '<span class="test1-page-dots__dot test1-page-dots__dot--active"></span>' +
        '<span class="test1-page-dots__dot"></span>' +
        '<span class="test1-page-dots__dot"></span>' +
      '</div>';
    }

    case 'test1-lock-shortcut-asset': {`;

if (!layout.includes("case 'test1-lock-shortcut-asset': {")) {
  console.error('Could not find render insert point');
  process.exit(1);
}
layout = layout.replace("    case 'test1-lock-shortcut-asset': {", renderInsert);

// --- 5. Home motion helpers ---
const homeHelpers = `
function _runTest1HomeIntro() {
  try {
    var c = document.getElementById('canvas');
    if (!c || c.getAttribute('data-test-scope') !== 'test1') return;
    if (window.__mlpTestConfig && window.__mlpTestConfig.test1RevealAll) return;
    if (c.getAttribute('data-test1-home-run')) return;
    c.removeAttribute('data-test1-pill-swipe-armed');
    c.setAttribute('data-test1-home-prep', '1');
    c.setAttribute('data-test1-home-exit', '1');
    c.removeAttribute('data-test1-coda-run');
    if (window.__mlpTestConfig) {
      window.__mlpTestConfig.test1HomePrep = true;
      window.__mlpTestConfig.test1CodaRun = false;
    }
    if (window.__mlpTest1HomeExitTimer) clearTimeout(window.__mlpTest1HomeExitTimer);
    window.__mlpTest1HomeExitTimer = setTimeout(function () {
      window.__mlpTest1HomeExitTimer = null;
      try {
        var c2 = document.getElementById('canvas');
        if (!c2 || c2.getAttribute('data-test-scope') !== 'test1') return;
        if (window.__mlpTestConfig && window.__mlpTestConfig.test1RevealAll) return;
        c2.removeAttribute('data-test1-home-exit');
        c2.setAttribute('data-test1-home-run', '1');
        c2.setAttribute('data-test1-home-animate', '1');
        void c2.offsetWidth;
        if (window.__mlpTestConfig) {
          window.__mlpTestConfig.test1HomeRun = true;
        }
        window.__mlpTest1Transitioning = false;
        var homeShellMs = 520;
        setTimeout(function () {
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              try {
                var c3 = document.getElementById('canvas');
                if (!c3 || c3.getAttribute('data-test-scope') !== 'test1') return;
                if (window.__mlpTestConfig && window.__mlpTestConfig.test1RevealAll) return;
                if (!c3.getAttribute('data-test1-home-animate')) return;
                c3.setAttribute('data-test1-home-inner-rise', '1');
              } catch (_) {}
            });
          });
        }, homeShellMs);
      } catch (_) {}
    }, TEST1_HOME_EXIT_MS);
  } catch (_) {}
}

window.__mlpTest1GoHome = function __mlpTest1GoHome() {
  if (!window.__mlpTestConfig || window.__mlpTestConfig.id !== 'test1') return false;
  if (window.__mlpTestConfig.test1HomeRun) return true;
  if (window.__mlpTest1Transitioning) return true;
  window.__mlpTest1Transitioning = true;
  _runTest1HomeIntro();
  return true;
};

function _installTest1BottomPillSwipe(canvas) {
  if (!canvas || canvas.getAttribute('data-test-scope') !== 'test1') return;
  if (canvas.getAttribute('data-test1-pill-swipe-armed')) return;
  if (window.__mlpTestConfig && window.__mlpTestConfig.test1HomeRun) return;
  if (!canvas.getAttribute('data-test1-coda-done')) return;
  canvas.setAttribute('data-test1-pill-swipe-armed', '1');

  var pillEl = document.getElementById('test1-bottom-pill');
  if (!pillEl) return;
  var pillItem = pillEl.closest('.canvas-item') || pillEl;
  var SWIPE_THRESHOLD = 72;
  var dragging = false;
  var startX = 0;

  function applyDrag(dx) {
    var clamped = Math.min(0, dx);
    var progress = Math.min(1, Math.abs(clamped) / SWIPE_THRESHOLD);
    var opacity = 1 - progress * 0.9;
    var tx = clamped * 0.65;
    pillItem.style.transition = 'none';
    pillItem.style.opacity = String(opacity);
    pillItem.style.transform = 'translate3d(' + tx + 'px, 0, 0)';
  }

  function resetDrag() {
    pillItem.style.transition = 'opacity 280ms cubic-bezier(0.22, 0.82, 0.24, 1), transform 280ms cubic-bezier(0.22, 0.82, 0.24, 1)';
    pillItem.style.opacity = '1';
    pillItem.style.transform = 'translate3d(0, 0, 0)';
  }

  function finishSwipe() {
    pillItem.style.transition = '';
    pillItem.style.opacity = '';
    pillItem.style.transform = '';
    if (window.__mlpTest1Transitioning) return;
    window.__mlpTest1Transitioning = true;
    _runTest1HomeIntro();
  }

  function onDown(e) {
    if (window.__mlpTest1Transitioning || window.__mlpTestConfig.test1HomeRun) return;
    dragging = true;
    startX = e.clientX;
    if (pillItem.setPointerCapture) {
      try { pillItem.setPointerCapture(e.pointerId); } catch (_) {}
    }
  }

  function onMove(e) {
    if (!dragging) return;
    applyDrag(e.clientX - startX);
  }

  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    var dx = e.clientX - startX;
    if (dx < -(SWIPE_THRESHOLD * 0.5)) {
      finishSwipe();
    } else {
      resetDrag();
    }
  }

  pillItem.style.pointerEvents = 'auto';
  pillItem.style.touchAction = 'pan-y';
  pillItem.style.cursor = 'grab';
  pillItem.addEventListener('pointerdown', onDown);
  pillItem.addEventListener('pointermove', onMove);
  pillItem.addEventListener('pointerup', onUp);
  pillItem.addEventListener('pointercancel', onUp);
}

function _armTest1StackDelay(canvas) {`;

layout = layout.replace('function _armTest1StackDelay(canvas) {', homeHelpers);

// --- 6. Coda done -> swipe arm ---
layout = layout.replace(
  `          if (window.__mlpTestConfig) window.__mlpTestConfig.test1CodaDone = true;
        } catch (_) {}
    }, TEST1_CODA_FADE_IN_MS);`,
  `          if (window.__mlpTestConfig) window.__mlpTestConfig.test1CodaDone = true;
          _installTest1BottomPillSwipe(c2);
        } catch (_) {}
    }, TEST1_CODA_FADE_IN_MS);`
);

// --- 7. Clear home timers ---
layout = layout.replace(
  `  if (window.__mlpTest1AiLogoPauseTimer) {
    clearTimeout(window.__mlpTest1AiLogoPauseTimer);
    window.__mlpTest1AiLogoPauseTimer = null;
  }
}`,
  `  if (window.__mlpTest1AiLogoPauseTimer) {
    clearTimeout(window.__mlpTest1AiLogoPauseTimer);
    window.__mlpTest1AiLogoPauseTimer = null;
  }
  if (window.__mlpTest1HomeExitTimer) {
    clearTimeout(window.__mlpTest1HomeExitTimer);
    window.__mlpTest1HomeExitTimer = null;
  }
  window.__mlpTest1Transitioning = false;
}`
);

// --- 8. generateSurfaceScenario test1 attrs ---
const oldGenStart = `    if (testScope === 'test1') {
      if (window.__mlpTestConfig && window.__mlpTestConfig.test1RevealAll == null) {
        window.__mlpTestConfig.test1RevealAll = false;
      }
      if (window.__mlpTestConfig && window.__mlpTestConfig.test1RevealAll) {`;

const newGenStart = `    if (testScope === 'test1') {
      if (window.__mlpTestConfig && window.__mlpTestConfig.test1RevealAll == null) {
        window.__mlpTestConfig.test1RevealAll = false;
      }
      if (window.__mlpTestConfig && window.__mlpTestConfig.test1HomeRun == null) {
        window.__mlpTestConfig.test1HomeRun = false;
        window.__mlpTestConfig.test1HomePrep = false;
      }
      if (window.__mlpTestConfig && window.__mlpTestConfig.test1RevealAll) {`;

layout = layout.replace(oldGenStart, newGenStart);

layout = layout.replace(
  `        canvas.setAttribute('data-test1-reveal-all', '1');
        canvas.removeAttribute('data-test1-intro');`,
  `        canvas.setAttribute('data-test1-reveal-all', '1');
        canvas.setAttribute('data-test1-home-run', '1');
        canvas.setAttribute('data-test1-home-prep', '1');
        canvas.removeAttribute('data-test1-intro');`
);

layout = layout.replace(
  `          window.__mlpTestConfig.test1CodaDone = false;
        }
      } else {
        canvas.removeAttribute('data-test1-reveal-all');
        canvas.removeAttribute('data-test1-intro');`,
  `          window.__mlpTestConfig.test1CodaDone = false;
          window.__mlpTestConfig.test1HomePrep = true;
          window.__mlpTestConfig.test1HomeRun = true;
        }
      } else {
        canvas.removeAttribute('data-test1-reveal-all');
        canvas.removeAttribute('data-test1-home-run');
        canvas.removeAttribute('data-test1-home-prep');
        canvas.removeAttribute('data-test1-home-exit');
        canvas.removeAttribute('data-test1-home-animate');
        canvas.removeAttribute('data-test1-home-inner-rise');
        canvas.removeAttribute('data-test1-pill-swipe-armed');
        if (window.__mlpTestConfig && window.__mlpTestConfig.test1HomeRun) {
          canvas.setAttribute('data-test1-home-run', '1');
          if (window.__mlpTestConfig.test1HomePrep) {
            canvas.setAttribute('data-test1-home-prep', '1');
          }
        }
        canvas.removeAttribute('data-test1-intro');`
);

// reveal-all also needs home attr cleanup
layout = layout.replace(
  `        canvas.removeAttribute('data-test1-coda-done');
        if (window.__mlpTestConfig) {`,
  `        canvas.removeAttribute('data-test1-coda-done');
        canvas.removeAttribute('data-test1-home-animate');
        canvas.removeAttribute('data-test1-home-inner-rise');
        if (window.__mlpTestConfig) {`
);

// post-render: skip intro when home run + re-arm swipe after coda
layout = layout.replace(
  `      if (window.__mlpTestConfig && !window.__mlpTestConfig.test1RevealAll) {
        _armTest1IntroDelay(canvas);`,
  `      if (window.__mlpTestConfig && !window.__mlpTestConfig.test1RevealAll && !window.__mlpTestConfig.test1HomeRun) {
        _armTest1IntroDelay(canvas);`
);

layout = layout.replace(
  `        if (canvas.getAttribute('data-test1-stack-run') && !canvas.getAttribute('data-test1-coda-run')) {
          _armTest1CodaAfterStack(canvas);
        }
      }
    } catch (_) {}
  }
  if (testScope === 'test2') {`,
  `        if (canvas.getAttribute('data-test1-stack-run') && !canvas.getAttribute('data-test1-coda-run')) {
          _armTest1CodaAfterStack(canvas);
        }
      }
      if (canvas.getAttribute('data-test1-coda-done') && !(window.__mlpTestConfig && window.__mlpTestConfig.test1HomeRun)) {
        _installTest1BottomPillSwipe(canvas);
      }
    } catch (_) {}
  }
  if (testScope === 'test2') {`
);

// cleanup non-test1 home attrs
layout = layout.replace(
  `    canvas.removeAttribute('data-test1-coda-inner-rise');
    canvas.removeAttribute('data-test1-coda-done');
  }
  window.renderSurfacePlan(canvas, plan, layout);`,
  `    canvas.removeAttribute('data-test1-coda-inner-rise');
    canvas.removeAttribute('data-test1-coda-done');
    canvas.removeAttribute('data-test1-home-run');
    canvas.removeAttribute('data-test1-home-prep');
    canvas.removeAttribute('data-test1-home-exit');
    canvas.removeAttribute('data-test1-home-animate');
    canvas.removeAttribute('data-test1-home-inner-rise');
    canvas.removeAttribute('data-test1-pill-swipe-armed');
  }
  window.renderSurfacePlan(canvas, plan, layout);`
);

fs.writeFileSync(layoutPath, layout, 'utf8');
console.log('surface-layout.js patched');

// --- CSS: extract home block from restore and append ---
const cssLines = restoreCss.split(/\r?\n/);
const homeCss = cssLines.slice(17400 - 1, 18008).join('\n')
  .replace(
    `@keyframes test1HomeBottomExit {
    0% {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
    100% {
      opacity: 0;
      transform: translate3d(0, -28px, 0);
      visibility: hidden;
    }
  }`,
    `@keyframes test1HomeBottomExit {
    0% {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
    100% {
      opacity: 0;
      transform: translate3d(-72px, 0, 0);
      visibility: hidden;
    }
  }`
  )
  .replace(
    '#canvas[data-test-scope="test1"] .test1-home-header__title {\n    font-family',
    `#canvas[data-test-scope="test1"] .test1-home-header__title {
    font-family`
  )
  .replace('color: #0b0b0b;', 'color: #0a3d58;')
  .replace('color: rgba(11, 11, 11, 0.72);', 'color: rgba(10, 61, 88, 0.72);')
  .replace(
    '#canvas[data-test-scope="test1"] .test1-home-food__icon--tofu {\n    background: linear-gradient(145deg, #fff8ef 0%, #f2dfc8 100%);\n  }',
    `#canvas[data-test-scope="test1"] .test1-home-food__icon--tofu {
    background-image: url('/assets/test1/home/food-tofu.png');
    background-size: cover;
    background-position: center;
  }`
  )
  .replace(
    '#canvas[data-test-scope="test1"] .test1-home-food__icon--zucchini {\n    background: linear-gradient(145deg, #dff3a8 0%, #8fbf4d 100%);\n  }',
    `#canvas[data-test-scope="test1"] .test1-home-food__icon--zucchini {
    background-image: url('/assets/test1/home/food-zucchini.png');
    background-size: cover;
    background-position: center;
  }`
  )
  .replace(
    '#canvas[data-test-scope="test1"] .test1-home-food__icon--onion {\n    background: linear-gradient(145deg, #e8ffd0 0%, #b8e86a 100%);\n  }',
    `#canvas[data-test-scope="test1"] .test1-home-food__icon--onion {
    background-image: url('/assets/test1/home/food-onion.png');
    background-size: cover;
    background-position: center;
  }`
  );

const extraCss = `
  /* test1 home — pill swipe affordance after coda */
  #canvas[data-test-scope="test1"][data-test1-coda-done]:not([data-test1-home-run]):not([data-test1-home-exit]) .canvas-item[data-role="test1-bottom-pill"],
  #canvas[data-test-scope="test1"][data-test1-coda-done]:not([data-test1-home-run]):not([data-test1-home-exit]) #test1-bottom-pill {
    pointer-events: auto !important;
    cursor: grab;
    touch-action: pan-y;
  }
  #canvas[data-test-scope="test1"] .test1-home-food__btn--alt {
    background: rgba(255, 255, 255, 0.4);
    color: #0a3d58;
  }
`;

let themeCss = fs.readFileSync(cssPath, 'utf8');
if (themeCss.includes('data-test1-home-run')) {
  console.log('theme-page.css already has test1-home CSS, skipping append');
} else {
  // Insert before closing brace of test1 scope (last line of test1 block)
  const marker = '  }\n';
  const idx = themeCss.lastIndexOf(marker);
  if (idx === -1) {
    console.error('Could not find test1 CSS block end');
    process.exit(1);
  }
  // Find the test1 scope closing - use the one at end of file section around line 18898
  const test1End = themeCss.indexOf('\n  }\n', themeCss.indexOf('#canvas[data-test-scope="test1"][data-test1-coda-animate]'));
  if (test1End === -1) {
    console.error('Could not find test1 coda CSS end anchor');
    process.exit(1);
  }
  themeCss = themeCss.slice(0, test1End) + '\n' + homeCss + extraCss + themeCss.slice(test1End);
  fs.writeFileSync(cssPath, themeCss, 'utf8');
  console.log('theme-page.css patched');
}
