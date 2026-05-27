// ============================================================================
// app/surface-layout.js
// One UI surface grammar based layout system
// Surface-first, zone-first, slot-based renderer
// ============================================================================

window.SURFACE_TYPES = {
  LOCKSCREEN: 'lockscreen',
  FIRST_DEPTH_LIST: 'first-depth-list',
  SECOND_DEPTH_DETAIL: 'second-depth-detail',
  TAB_ROOT: 'tab-root',
  DIALOG_BOTTOM: 'dialog-bottom',
  DIALOG_CENTER: 'dialog-center',
  QUICK_SETTINGS: 'quick-settings',
  NOTIFICATION_SHADE: 'notification-shade',
  SELECTION_MODE: 'selection-mode',
  HEALTH_MLP: 'health-mlp'
};

window.currentSurfaceType = window.SURFACE_TYPES.FIRST_DEPTH_LIST;

// test3 home card stack — Figma-tight vertical gap (4px). Horizontal
// half-card gap stays 4px on the 340px grid.
var TEST3_GOAL_TOP = 42;
var TEST3_GOAL_H = 168;
var TEST3_CARD_GAP = 4;
var TEST3_ROW2_TOP = TEST3_GOAL_TOP + TEST3_GOAL_H + TEST3_CARD_GAP;
// Grid 1×1 half-column — outer shell must match weather/steps column (168px).
var TEST3_MUSIC_COMPACT = 168;
var TEST3_MUSIC_TITLE = '러닝에 어울리는 신스팝 플레이리스트 재생';
var TEST3_MUSIC_FOLD_TITLE = '러닝에 어울리는\n신스팝 플레이리스트 재생';
var TEST3_MUSIC_COMPACT_FOLD = '러닝에 어울리는\n신스팝 플레이리스트';
var TEST3_MUSIC_LYRICS_TITLE = '저녁 한강 러닝에 어울리는\nBPM 120-140 신스팝 플레이리스트';
var TEST3_MUSIC_SEARCH_LINE2 = '러닝에 어울리는 신스팝 플레이리스트 재생';
var TEST3_GOAL_UNIFIED_RISE_MS = 520;
var TEST3_MUSIC_MOTION_MS = 14000;
var TEST3_MUSIC_PRE_DELAY_MS = Math.round(TEST3_MUSIC_MOTION_MS * 0.10);
var TEST3_MUSIC_EXPAND_START_MS = Math.round(TEST3_MUSIC_MOTION_MS * 0.57);
var TEST3_MUSIC_EXPAND_DUR_MS = Math.round(TEST3_MUSIC_MOTION_MS * 0.11);
var TEST3_MUSIC_EXPAND_END_MS = TEST3_MUSIC_EXPAND_START_MS + TEST3_MUSIC_EXPAND_DUR_MS;
var TEST3_MUSIC_FILL_START_MS = Math.round(TEST3_MUSIC_MOTION_MS * 0.14);
var TEST3_MUSIC_IMAGE1_HOLD_MS = 320;
var TEST3_MUSIC_SETTLE_MS = 1000;
var TEST3_MUSIC_ENTRANCE_END_MS = TEST3_MUSIC_MOTION_MS;

/** Themes set `--oneui-chroma: mono` (e.g. Mono · Grayscale) so skies/icons stay neutral — no chroma accents in markup. */
function _isMonoChromaRoot() {
  try {
    if (typeof document === 'undefined' || !document.documentElement) return false;
    if (document.documentElement.classList.contains('is-mono-chroma')) return true;
    var v = (getComputedStyle(document.documentElement).getPropertyValue('--oneui-chroma') || '').trim().toLowerCase();
    return v === 'mono' || v === 'grayscale' || v === 'greyscale';
  } catch (e) {
    return false;
  }
}

function _themeSurfaceStyleRoot() {
  try {
    if (typeof document === 'undefined' || !document.documentElement) return 'base';
    var v = (getComputedStyle(document.documentElement).getPropertyValue('--oneui-theme-style') || '').trim().toLowerCase();
    return v || 'base';
  } catch (e) {
    return 'base';
  }
}

window.setSurfaceType = function setSurfaceType(type, el) {
  window.currentSurfaceType = type;

  document.querySelectorAll('.layout-preset').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
};

window.createOneUILayout = function createOneUILayout(viewport, surfaceType) {
  const width = viewport.width || 451;
  const height = viewport.height || 978;

  // Safe-area insets — must clear the device frame's rounded bezel
  // (border-radius:44px on .canvas-frame). Previous safe.bottom=16 was
  // smaller than the bezel radius, so bottom-edge content (shortcut
  // circles, charging pill) ended up partially clipped inside the
  // rounded corner — visible at 100% browser zoom in the user's
  // screenshot. Bumped to 36 (clears the 44px arc and leaves a small
  // visual gap so content doesn't kiss the bezel). Top stays smaller
  // because the status-bar zone already adds visual margin.
  const safe = {
    // Slightly larger top inset so status-bar never clips
    // into the device bezel radius (prototype frame uses overflow:hidden).
    top: 16,
    right: 24,
    bottom: 36,
    left: 24
  };

  const topSystemH = 38;
  const appBarExpandedH = Math.round(height * 0.22);
  const appBarCollapsedH = 56;
  const interactionStartY = Math.round(height * 0.58);
  // bottomNavH bumped from 72 → 80 so the shortcut circles + now-bar
  // pill have enough vertical room AND are positioned higher within
  // the safe area (no longer touching the bezel arc).
  const bottomNavH = 80;
  const bottomBarH = 64;

  return {
    viewport: { width, height },
    safe,
    metrics: {
      topSystemH,
      appBarExpandedH,
      appBarCollapsedH,
      interactionStartY,
      bottomNavH,
      bottomBarH,
      gap: 12,
      focusBlockRadius: 28
    },
    zones: {
      full: {
        x: 0, y: 0, w: width, h: height
      },
      topSystem: {
        x: safe.left,
        y: safe.top,
        w: width - safe.left - safe.right,
        h: topSystemH
      },
      viewing: {
        x: safe.left,
        y: safe.top + topSystemH + 8,
        w: width - safe.left - safe.right,
        h: interactionStartY - (safe.top + topSystemH + 8) - 12
      },
      interaction: {
        x: safe.left,
        y: interactionStartY,
        w: width - safe.left - safe.right,
        h: height - interactionStartY - safe.bottom - bottomNavH
      },
      bottomNav: {
        x: safe.left,
        y: height - safe.bottom - bottomNavH,
        w: width - safe.left - safe.right,
        h: bottomNavH
      },
      bottomBar: {
        x: safe.left,
        y: height - safe.bottom - bottomBarH,
        w: width - safe.left - safe.right,
        h: bottomBarH
      }
    },
    surfaceType
  };
};

window.composeSurfacePlan = function composeSurfacePlan(surfaceType, layout) {
  const T = window.SURFACE_TYPES;

  switch (surfaceType) {
    case T.LOCKSCREEN:
      return {
        surfaceType,
        components: [
          { id: 'status-bar',    role: 'status-bar',    zone: 'topSystem' },
          { id: 'lockIndicator', role: 'lockIndicator', zone: 'topSystem' },
          { id: 'weatherDate',   role: 'weatherDate',   zone: 'viewing', variant: { date: 'Sat, May 3', temp: 24, condition: 'moon' } },
          { id: 'clock',         role: 'clock',         zone: 'viewing', variant: { fontSize: 90, lineHeight: 66, gap: 10 } },
          { id: 'lock-widgets',  role: 'lock-widgets',  zone: 'viewing' },
          { id: 'running-coach', role: 'dot-running',   zone: 'interaction', variant: { state: 'idle' } },
          { id: 'shortcutLeft',  role: 'shortcutLeft',  zone: 'bottomNav', variant: { icon: 'phone' } },
          { id: 'shortcutRight', role: 'shortcutRight', zone: 'bottomNav', variant: { icon: 'camera' } },
          { id: 'gestureBar',    role: 'gestureBar',    zone: 'bottomAction' }
        ]
      };

    case T.LOCKSCREEN_DOT:
      return {
        surfaceType,
        components: [
          { id: 'status-bar',    role: 'status-bar',    zone: 'topSystem' },
          { id: 'lockIndicator', role: 'lockIndicator', zone: 'topSystem' },
          { id: 'lock-dot-widgets', role: 'lock-dot-widgets', zone: 'viewing' },
          { id: 'lock-dot-shortcuts', role: 'lock-dot-shortcuts', zone: 'bottomNav' },
          { id: 'gestureBar',    role: 'gestureBar',    zone: 'bottomAction' }
        ]
      };

    case 'lockscreen-persona2':
      return {
        surfaceType,
        components: [
          { id: 'status-bar',    role: 'status-bar',    zone: 'topSystem' },
          { id: 'lockIndicator', role: 'lockIndicator', zone: 'topSystem' },
          { id: 'weatherDate',   role: 'weatherDate',   zone: 'viewing', variant: { date: 'Sat, May 3', temp: '24', condition: 'moon' } },
          // Match the intended lockscreen scale (image2)
          { id: 'clock',         role: 'clock',         zone: 'viewing', variant: { fontSize: 90, lineHeight: 66, gap: 10 } },
          { id: 'persona2-widgets', role: 'persona2-widgets', zone: 'viewing' },
          { id: 'shortcutLeft',  role: 'shortcutLeft',  zone: 'bottomNav', variant: { icon: 'phone' } },
          { id: 'shortcutRight', role: 'shortcutRight', zone: 'bottomNav', variant: { icon: 'camera' } },
          { id: 'unlock-hint',   role: 'unlock-hint',   zone: 'bottomNav', variant: { showArrow: false } },
          { id: 'gestureBar',    role: 'gestureBar',    zone: 'bottomAction' }
        ]
      };

    case T.FIRST_DEPTH_LIST: {
      // Pick the search-bar theme ONCE per scene compose and share it with
      // the selection-dialog below so both alternate in sync (Figma
      // 629:1603 = light, 629:1602 = dark — pure black/white, no AI).
      var listTheme = Math.random() < 0.5 ? 'light' : 'dark';

      // Natural-sounding menu scenarios — rotated per scene so the user
      // sees realistic planning / recommendation / schedule content
      // instead of "This is a menu option" placeholders.
      var LIST_SCENARIOS = [
        {
          title: 'Summer travel plan',
          options: [
            'Jun 8-10 \u00b7 Jeju Island (3 days)',
            'Jul 15-22 \u00b7 Italy (1 week)',
            'Book Colosseum tour in Rome',
            'Hike Hallasan \u00b7 Witseoreum trail',
            'Sunscreen SPF50 + eye cream',
            'Book JAL flight (ICN \u2192 FCO)'
          ]
        },
        {
          title: 'Weekend plan \u00b7 Apr 27-28',
          options: [
            'Sat morning \u00b7 Brunch with Mom',
            'Sat afternoon \u00b7 MMCA exhibition',
            'Sat evening \u00b7 IU concert (Olympic Park)',
            'Sun lunch \u00b7 Bukchon hanok restaurant',
            'Sun afternoon \u00b7 Naksan Park sunset walk',
            'Mon morning \u00b7 Confirm reservation'
          ]
        },
        {
          title: 'Today\u2019s agenda \u00b7 Mon, Apr 20',
          options: [
            '10 AM \u00b7 Design team standup',
            '2 PM \u00b7 Q2 review presentation',
            '4 PM \u00b7 Coffee with Sarah',
            'Before EOD \u00b7 Finish project brief',
            'Workout \u00b7 Arms + core',
            'Return Mom\u2019s missed call'
          ]
        },
        {
          title: 'Saved Articles',
          options: [
            'The Future of Ambient UI',
            'Samsung One UI 8.5 deep dive',
            'Why designers write less now',
            'Jony Ive\'s next act, explained',
            'Building a type system at scale',
            'Galaxy S26 review — one year later'
          ]
        },
        {
          title: 'Shopping List · 6 items',
          options: [
            'MacBook Pro M4 14" · Space Black',
            'AirPods Pro 2 (USB-C)',
            'Samsung T7 Shield 2TB',
            'iPhone clear case w/ MagSafe',
            'Sony WH-1000XM5 (Black)',
            'Anker 737 power bank (24K mAh)'
          ]
        },
        {
          title: 'This week\u2019s bookings',
          options: [
            'Tue 7 PM \u00b7 Cheongdam omakase',
            'Wed 10 AM \u00b7 Dental checkup',
            'Thu 6 PM \u00b7 Pilates private lesson',
            'Fri 8 PM \u00b7 Dinner with the kids',
            'Sat 2 PM \u00b7 Gangnam hair salon',
            'Sun 11 AM \u00b7 Han River picnic (4)'
          ]
        }
      ];
      var pickedScenario = LIST_SCENARIOS[Math.floor(Math.random() * LIST_SCENARIOS.length)];

      return {
        surfaceType,
        components: [
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          // Compact Figma "Top" header (989:22761) — big time + date.
          // Replaces the old tall `expandable-app-bar` so search-bar and
          // selection-dialog sit higher with more breathing room.
          // Scenario title moved INTO list-top-bar (above time/date).
          // selection-dialog renders with showTitle:false so the title
          // isn't duplicated in both the header and the menu.
          { id: 'list-top-bar', role: 'list-top-bar', zone: 'viewing',
            variant: { title: pickedScenario.title } },
          { id: 'search-bar', role: 'search-bar', zone: 'viewing',
            variant: { style: listTheme } },
          { id: 'selection-dialog', role: 'selection-dialog', zone: 'interaction',
            variant: {
              theme: listTheme,
              showTitle: false,
              options: pickedScenario.options
            } },
          // Keep the pinned-apps dock on the bottom nav (same shortcuts as Home).
          { id: 'app-dock', role: 'app-dock', zone: 'bottomNav',
            content: { apps: ['Phone','Messages','Internet','Camera'] } }
        ]
      };
    }

    case T.SECOND_DEPTH_DETAIL: {
      // Detail — status-bar (restored) + list-top-bar rendered as TWO
      // lines (greeting title on line 1, time + date on line 2) so the
      // upper area feels balanced next to the stack of focus-blocks
      // below. A random greeting is picked on each generation so the
      // screen reads differently each time.
      var DETAIL_GREETINGS = [
        'Good morning, Kyuha',
        'Here\u2019s your day',
        'Today at a glance',
        'Daily briefing',
        'Welcome back'
      ];
      var detailGreet = DETAIL_GREETINGS[Math.floor(Math.random() * DETAIL_GREETINGS.length)];
      return {
        surfaceType,
        components: [
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          { id: 'list-top-bar', role: 'list-top-bar', zone: 'viewing',
            variant: { title: detailGreet } },
          { id: 'hero-card',      role: 'focus-block', zone: 'viewing',
            variant: { kind: 'secondary',
              title: 'Morning routine',
              body: 'Weather + calendar preview so you can plan the day at a glance.' } },
          { id: 'secondary-card', role: 'focus-block', zone: 'viewing',
            variant: { kind: 'secondary',
              title: 'Now playing',
              body: 'Resume \u201cDaily Mix 1\u201d on Spotify. Queued: 27 tracks.' } },
          { id: 'tertiary-card',  role: 'focus-block', zone: 'viewing',
            variant: { kind: 'secondary',
              title: 'Coming up',
              body: 'Design review at 3:00 PM with Sarah and Alex. Notes attached.' } },
          { id: 'app-dock', role: 'app-dock', zone: 'bottomNav',
            content: { apps: ['Phone','Messages','Internet','Camera'] } }
        ]
      };
    }

    case T.TAB_ROOT:
      if (window.__p1_custom_widgets && window.__p1_custom_widgets.length > 0) {
        return {
          surfaceType,
          components: [
            { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
            { id: 'home-persona1-widgets', role: 'home-persona1-widgets', zone: 'viewing' },
            { id: 'app-dock',   role: 'app-dock',   zone: 'bottomNav',
              content: { apps: ['Camera','Gallery','Maps','YT Music'] } },
            { id: 'gesture-bar', role: 'gestureBar', zone: 'bottomAction' }
          ]
        };
      }
      if (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test1') {
        // Persona 1 Gen Home (Figma 75:13339) — Goal + Music + Steps + Jogging + dot clock
        return {
          surfaceType,
          components: [
            { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
            { id: 'p1-goal', role: 'dot-goal', zone: 'viewing',
              variant: { title: "Today's Goal", time: '01:42:43', timeSuffix: 'Within', distance: '15km' },
              _rect: { x: 24, y: 42, w: 340, h: 168 } },
            { id: 'p1-music', role: 'dot-music-1x1', zone: 'viewing',
              variant: { artist: 'Jimmy Hall', album: 'Album', song: 'Concierto', current: '0:40', remaining: '-1:10', barFull: 120, barTrack: 31.48 },
              _rect: { x: 24, y: 214, w: 168, h: 168 } },
            { id: 'p1-steps', role: 'dot-total-steps-2x1', zone: 'viewing',
              variant: { count: '5,543' },
              _rect: { x: 196, y: 214, w: 168, h: 82 } },
            { id: 'p1-run', role: 'dot-running-compact', zone: 'viewing',
              variant: { label: 'Jogging', time: '10:35' },
              _rect: { x: 196, y: 300, w: 168, h: 82 } },
            { id: 'p1-timemat', role: 'dot-time-matrix', zone: 'viewing',
              variant: { bgColor: 'transparent', dotColor: '#FF7F24', time: '12:45', meta: 'MON', dayDigits: '  ' },
              _rect: { x: 26, y: 386, w: 335, h: 165 } },
            { id: 'app-dock', role: 'app-dock', zone: 'bottomNav',
              content: { apps: ['Camera','Gallery','Maps','YT Music'] } },
            { id: 'gesture-bar', role: 'gestureBar', zone: 'bottomAction' }
          ]
        };
      }
      if (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3') {
        var stage = window.__mlpTestConfig.homeStage || 'intro'; // 'intro' | 'home'
        var musicShifted = !!window.__mlpTest3MusicShifted;
        var test3Row2Y = TEST3_ROW2_TOP;
        if (stage !== 'home') {
          // Persona 3 (health home) intro: prompt banner at top → click to reveal home widgets.
          // Banner is the wide Jogging prompt variant (340×82) so it
          // visually aligns with Today's Goal width on the home stage
          // that follows. The previous 164×82 compact pill read too
          // small at the top of an otherwise empty home, and the new
          // copy ("빠른 움직임이 감지됐어요. 운동을 시작할까요?")
          // explains WHY the workout suggestion is appearing, which
          // the bare "Jogging 10:35" did not.
          // mlpAction stays intact so tap-to-reveal-home keeps working
          // (the data-mlp-action gets read by interaction-state.js).
          return {
            surfaceType,
            components: [
              { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
              { id: 'test3-intro-run', role: 'dot-running-prompt', zone: 'viewing',
                /* Intro sequence: compact pill shows "Running Now"
                   first (see test3IntroTitleStart in theme-page.css),
                   then stretches to full width and cross-fades into the
                   detection prompt. On tap, titleAtEnd drives the morph
                   into the live Running Now goal card. */
                variant: {
                  prompt: '빠른 움직임이 감지됐어요. 운동을 시작할까요?',
                  titleAtEnd: 'Running Now',
                  mlpAction: 'mlp-intro-to-home'
                },
                /* y=42 (was 56) so the intro pill sits at the SAME y
                   as the goal card it morphs into. Without this match
                   the wrapper jumped UP 14 px at the rename moment
                   (when finishTransition sets the goal's plan top of
                   42 px), which the user saw as the card "popping up"
                   after the morph. Now the y is identical from start
                   to end — only the height changes (82 → 168). */
                _rect: { x: 24, y: 42, w: 340, h: 82 } },
              { id: 'test3-page-dots', role: 'test3-page-dots', zone: 'viewing',
                _rect: { x: 0, y: 714, w: 388, h: 24 } },
              { id: 'app-dock', role: 'app-dock', zone: 'bottomNav',
                content: { apps: ['Camera','Gallery','Maps','YT Music'] } },
              { id: 'gesture-bar', role: 'gestureBar', zone: 'bottomAction' }
            ]
          };
        }
        return {
          surfaceType,
          components: [
            { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
            { id: 'test3-goal', role: 'dot-goal', zone: 'viewing',
              /* Title was "Today's Goal" but the card actually appears
                 AFTER the user accepts the workout prompt — so it's a
                 live-status card, not a target card. "Running Now"
                 reflects that state.
                 No `titleWave` here on purpose: the title's wave
                 animation runs DURING the morph (via the prompt's
                 `titleAtEnd: 'Running Now'` preview), settling to its
                 final state by the time the morph swaps in this goal
                 card. Adding titleWave here would replay the wave
                 right after the swap — visible "double bounce". */
              /* Live state at the moment the user accepted the prompt:
                 the run has just begun, so time/distance start near zero
                 and tick up. _startTest3GoalTimeTicker increments the
                 time once per second; _startTest3GoalDistanceTicker
                 advances the distance at ~3.33 m/s (5:00 min/km pace),
                 formatted as "Xm" under 1000 and "X.Y km" past that. */
              variant: { title: "Running Now", time: '00:01:42', timeSuffix: 'Within', distance: '180m', useRealMap: true },
              _rect: { x: 24, y: 42, w: 340, h: 168 } },
            musicShifted ? { id: 'test3-music', role: 'dot-music-1x1', zone: 'viewing',
              variant: {
                compactTitle: '러닝을 위한 음악을 찾고 있어요',
                iconTitle:    TEST3_MUSIC_TITLE,
                iconSubtitle: 'M83 - Midnight City',
                expandedBarFull: 246,
                expandedBarTrack: 188
              },
              _rect: { x: 24, y: test3Row2Y, w: 340, h: 168 } } : null,
            { id: 'test3-weather', role: 'dot-weather-2x1-v1-1', zone: 'viewing',
              variant: {
                partyPill: {
                  title: '러닝 파티 모드',
                  subtitle: '실시간 경로 수정 중',
                  expandTitle: '러닝 아일랜드 모드',
                  expandBody: '고요한 러닝을 위해 현재 사람이 적은\n한강 공원으로 경로를 수정했어요'
                }
              },
              _rect: { x: 24, y: test3Row2Y, w: 168, h: 82 } },
            { id: 'test3-steps', role: 'dot-total-steps-2x1', zone: 'viewing',
              variant: {
                pacePill: {
                  title: '러닝 페이스',
                  subtitle: '현재 7\'00"',
                  expandTitle: '러닝 페이스'
                }
              },
              _rect: { x: 196, y: test3Row2Y, w: 168, h: 82 } },
            { id: 'test3-page-dots', role: 'test3-page-dots', zone: 'viewing',
              _rect: { x: 0, y: 714, w: 388, h: 24 } },
            { id: 'app-dock', role: 'app-dock', zone: 'bottomNav',
              content: { apps: ['Camera','Gallery','Maps','YT Music'] } },
            { id: 'gesture-bar', role: 'gestureBar', zone: 'bottomAction' }
          ].filter(Boolean)
        };
      }
      return {
        surfaceType,
        components: [
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          // Persona 1 Home — initial-state layout. The "movement detected,
          // start workout?" prompt is the first thing the user sees, so
          // Music / TOTAL STEPS / compact-Jogging are deferred to the
          // post-tap "active" state. Layout now stacks vertically:
          //   y= 42–210  Today's Goal (340×168)
          //   y=214–296  Wide Jogging prompt (340×82)  ← initial state
          //   y=300–465  Time matrix (335×165)
          { id: 'p1-goal', role: 'dot-goal', zone: 'viewing',
            variant: { title: "Today's Goal", time: '01:42:43', timeSuffix: 'Within', distance: '15km' },
            _rect: { x: 24, y: 42, w: 340, h: 168 } },
          { id: 'p1-run', role: 'dot-running-prompt', zone: 'viewing',
            variant: { prompt: '빠른 움직임이 감지됐어요. 운동을 시작할까요?' },
            _rect: { x: 24, y: 214, w: 340, h: 82 } },
          { id: 'p1-timemat', role: 'dot-time-matrix', zone: 'viewing',
            variant: { bgColor: 'transparent', dotColor: '#FF7F24', time: '12:45', meta: 'MON', dayDigits: '  ' },
            _rect: { x: 26, y: 300, w: 335, h: 165 } },
          { id: 'app-dock',   role: 'app-dock',   zone: 'bottomNav',
            content: { apps: ['Camera','Gallery','Maps','YT Music'] } },
          { id: 'gesture-bar', role: 'gestureBar', zone: 'bottomAction' }
        ]
      };

    case T.DIALOG_BOTTOM:
      return {
        surfaceType,
        components: [
          { id: 'scrim', role: 'scrim', zone: 'full' },
          { id: 'dialog', role: 'bottom-dialog', zone: 'interaction' }
        ]
      };

    case T.DIALOG_CENTER:
      return {
        surfaceType,
        components: [
          { id: 'scrim', role: 'scrim', zone: 'full' },
          { id: 'dialog', role: 'center-dialog', zone: 'full' }
        ]
      };

    case T.QUICK_SETTINGS:
      return {
        surfaceType,
        components: [
          { id: 'qs-bg', role: 'background', zone: 'full' },
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          { id: 'qs-panel', role: 'quick-settings-panel', zone: 'interaction' }
        ]
      };

    case T.NOTIFICATION_SHADE:
      return {
        surfaceType,
        components: [
          { id: 'shade-bg', role: 'background', zone: 'full' },
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          { id: 'notif-list', role: 'notification-list', zone: 'interaction' }
        ]
      };

    case T.SELECTION_MODE:
      return {
        surfaceType,
        components: [
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          { id: 'selection-app-bar', role: 'selection-app-bar', zone: 'viewing' },
          { id: 'selection-list', role: 'list', zone: 'interaction' },
          { id: 'selection-toolbar', role: 'bottom-bar', zone: 'bottomBar' }
        ]
      };

    case T.HEALTH_MLP:
      return {
        surfaceType,
        components: [
          // Persona 3 (Figma 76:15282) — Cooking screen
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem', variant: { theme: 'light', carrier: 'TJG' } },
          { id: 'p3-bg', role: 'cooking-bg', zone: 'full',
            _rect: { x: 0, y: 0, w: 388, h: 880 } },
          { id: 'p3-greeting', role: 'cooking-greeting', zone: 'viewing',
            variant: { line1: '민수님,', line2: '운동 수고하셨어요!' },
            _rect: { x: 24, y: 70, w: 340, h: 80 } },
          { id: 'p3-subtitle', role: 'cooking-subtitle', zone: 'viewing',
            variant: { text: '회복을 돕는 연어스테이크를 준비해볼까요?' },
            _rect: { x: 24, y: 142, w: 340, h: 32 } },
          { id: 'p3-yes-no', role: 'cooking-yes-no-btn', zone: 'interaction',
            _rect: { x: 24, y: 190, w: 340, h: 56 } },
          { id: 'p3-recipe', role: 'cooking-recipe', zone: 'viewing',
            variant: { rightMeta: '85% 데이터 일치' },
            _rect: { x: 24, y: 184, w: 340, h: 125 } },
          { id: 'p3-ingredients', role: 'cooking-ingredients', zone: 'viewing',
            variant: { rightMeta: '스마트싱즈 연동 중' },
            _rect: { x: 24, y: 317, w: 340, h: 390 } },
          { id: 'p3-send', role: 'cooking-send-btn', zone: 'viewing',
            variant: { text: '인덕션 연동 및 조리 시작' },
            _rect: { x: 24, y: 782, w: 340, h: 56 } },
          { id: 'p3-agent', role: 'cooking-agent-card', zone: 'interaction',
            variant: { title: '에이전트 추천', text: '와인 페어링 추천: 쇼비뇽 블랑이 잘 어울려요', icon: '🍷' },
            _rect: { x: 24, y: 880, w: 340, h: 100 } }, // Positioned below screen
          { id: 'p3-agent-2', role: 'cooking-agent-card-2', zone: 'interaction',
            variant: {},
            _rect: { x: 24, y: 880, w: 340, h: 100 } }, // Positioned below screen
          { id: 'gesture-bar', role: 'gestureBar', zone: 'bottomAction' }
        ]
      };

    default:
      return {
        surfaceType,
        components: [
          { id: 'status-bar', role: 'status-bar', zone: 'topSystem' },
          { id: 'app-bar', role: 'collapsed-app-bar', zone: 'viewing' },
          { id: 'content', role: 'detail-content', zone: 'interaction' }
        ]
      };
  }
};

// ============================================================================
// Container expansion — turn compositional roles (list, focus-block-group,
// detail-content) into individual editable nodes with real gaps.
// ============================================================================

// List-item preset pool — messaging-style rows with varied content
var LIST_ITEM_PRESETS = [
  { avatar: 'Messages.png',  title: 'Jimin',          subtitle: 'See you at 7 PM',            time: '2m',  badge: 3 },
  { avatar: null, glyph: 'M', accent: '#EA4335', title: 'Sarah Chen',   subtitle: 'Re: Q2 planning — let\u2019s sync', time: '12m' },
  { avatar: 'Contacts.png',  title: 'Hannah',         subtitle: '\u266B Voice message',        time: '1h',  badge: 1 },
  { avatar: null, glyph: 'S', accent: '#611F69', title: 'Alex (Slack)', subtitle: 'PR is ready for review',        time: '30m' },
  { avatar: 'Notes.png',     title: 'Maya',           subtitle: 'Added you to "Trip plan"',    time: '3h' },
  { avatar: null, glyph: 'D', accent: '#5865F2', title: 'Dev Community',subtitle: 'New message in #general',       time: '5h',  badge: 12 },
  { avatar: 'Gallery.png',   title: 'Tomas',          subtitle: 'Shared a photo',              time: '6h' },
  { avatar: null, glyph: 'F', accent: '#25D366', title: 'Family',       subtitle: 'Dad: Pickup at 6',              time: '1d' },
  { avatar: 'Clock.png',     title: 'Reminder',       subtitle: 'Call mom today',              time: '9h' },
  { avatar: null, glyph: 'W', accent: '#1DA1F2', title: 'Work',         subtitle: 'Standup tomorrow at 10',        time: '1d' }
];

function _randomList(pool, n) {
  var copy = pool.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
  }
  return copy.slice(0, Math.min(n, copy.length));
}

// Widget presets (for focus-block-group cells)
var WIDGET_PRESETS = [
  { kind: 'weather',  title: 'Seoul',        value: '18\u00B0',  accent: '#5AC8FA', sub: 'Partly cloudy' },
  { kind: 'battery',  title: 'Battery',      value: '69%',       accent: '#34C759', sub: '5h left' },
  { kind: 'activity', title: 'Steps',        value: '4,209',     accent: '#FF6B6B', sub: 'Goal 6,000' },
  { kind: 'music',    title: 'Now playing',  value: 'Dynamite',  accent: '#9B6BE6', sub: 'BTS' },
  { kind: 'calendar', title: 'Today',        value: '3 events',  accent: '#4285F4', sub: 'Next: 2pm stand-up' },
  { kind: 'alarm',    title: 'Alarm',        value: '7:00 AM',   accent: '#FF9500', sub: 'Weekday' }
];

window.expandContainerComponents = function expandContainerComponents(plan, layout) {
  if (!plan || !Array.isArray(plan.components)) return plan;
  var out = [];
  plan.components.forEach(function (comp) {
    var kids = null;
    if (comp.role === 'list')                kids = _expandList(comp, layout);
    else if (comp.role === 'notification-list') kids = _expandList(comp, layout); // same vertical stack
    else if (comp.role === 'focus-block-group') kids = _expandFocusBlockGroup(comp, layout);
    else if (comp.role === 'detail-content')  kids = _expandDetailContent(comp, layout);
    else if (comp.role === 'app-grid')        kids = _expandAppGrid(comp, layout);
    else if (comp.role === 'lock-widgets')    kids = _expandLockWidgets(comp, layout);
    else if (comp.role === 'home-top-widgets') kids = _expandHomeTopWidgets(comp, layout);
    else if (comp.role === 'home-mid-widgets') kids = _expandHomeMidWidgets(comp, layout);
    if (kids && kids.length) {
      out.push.apply(out, kids);
    } else {
      out.push(comp);
    }
  });
  plan.components = out;
  return plan;
};

// Home app grid — fills the space from below status-bar to above dock with
// a 4-column grid of app icons. Each cell becomes an editable `app-icon` node.
var HOME_APP_POOL = [
  'Phone', 'Messages', 'Camera', 'Gallery',
  'Contacts', 'Clock', 'Weather', 'Calculator',
  'Settings', 'Notes', 'Cloud', 'Health',
  'Reminder', 'Store', 'SmartThings', 'Bixby',
  'Internet', 'MyFiles', 'Studio', 'Wallet'
];

function _expandAppGrid(comp, layout) {
  var z = layout.zones;
  var leftX  = z.topSystem.x;
  var rightX = leftX + z.topSystem.w;
  var topY   = z.topSystem.y + z.topSystem.h + 12;        // below status bar
  var bottomY = z.bottomNav.y - 10;                        // above dock
  var gridW  = rightX - leftX;
  var gridH  = bottomY - topY;

  var cols   = 4;
  var colGap = 4;
  var labelH = 22;                                          // text row under icon
  var rowGap = 10;

  var cellW = Math.floor((gridW - colGap * (cols - 1)) / cols);
  var cellH = cellW + labelH;                              // icon area + label

  var rows = Math.max(1, Math.floor((gridH + rowGap) / (cellH + rowGap)));
  if (rows > 5) rows = 5;
  var total = Math.min(rows * cols, HOME_APP_POOL.length);

  // Center the grid vertically if there's leftover space
  var actualH = rows * cellH + (rows - 1) * rowGap;
  var startY = topY + Math.max(0, Math.floor((gridH - actualH) / 2));

  var result = [];
  for (var i = 0; i < total; i++) {
    var r = Math.floor(i / cols), c = i % cols;
    result.push({
      id: comp.id + ':app-' + i,
      role: 'app-icon',
      zone: comp.zone,
      _rect: {
        x: leftX + c * (cellW + colGap),
        y: startY + r * (cellH + rowGap),
        w: cellW,
        h: cellH
      },
      variant: { app: HOME_APP_POOL[i] }
    });
  }
  return result;
}

function _expandList(comp, layout) {
  var z = layout.zones[comp.zone] || layout.zones.interaction;
  var gap = (layout.metrics && layout.metrics.gap) || 8;
  var itemH = 72;  // One UI list-item default
  var maxCount = Math.max(1, Math.floor((z.h + gap) / (itemH + gap)));

  // Prefer agent-provided items when present — maps arbitrary shape into
  // our canonical list-item variant. Falls back to random presets otherwise.
  var agentItems = (comp.content && Array.isArray(comp.content.items))
    ? comp.content.items : null;

  var count, picked;
  if (agentItems && agentItems.length) {
    count = Math.min(agentItems.length, maxCount);
    picked = agentItems.slice(0, count).map(function (it) {
      it = it || {};
      return {
        title:    it.title    || it.name    || it.primary  || 'Item',
        subtitle: it.subtitle || it.secondary || it.description || it.body || '',
        time:     it.time     || it.timestamp || it.date   || '',
        avatar:   it.avatar   || it.icon     || null,
        glyph:    it.glyph    || null,
        accent:   it.accent   || null,
        badge:    it.badge    != null ? it.badge : undefined
      };
    });
  } else {
    count = Math.min(6, maxCount);
    picked = _randomList(LIST_ITEM_PRESETS, count);
  }

  var result = [];
  var y = z.y;
  for (var i = 0; i < count; i++) {
    result.push({
      id: comp.id + ':item-' + i,
      role: 'list-item',
      zone: comp.zone,
      _rect: { x: z.x, y: y, w: z.w, h: itemH },
      variant: picked[i] || {}
    });
    y += itemH + gap;
  }
  return result;
}

function _expandFocusBlockGroup(comp, layout) {
  var z = layout.zones[comp.zone] || layout.zones.interaction;
  var cols = 2, rows = 2;
  var gap = (layout.metrics && layout.metrics.gap) || 12;
  var cellW = Math.round((z.w - gap * (cols - 1)) / cols);
  // cap cell height so the group doesn't stretch the full zone
  var cellH = Math.min(110, Math.round((z.h - gap * (rows - 1)) / rows));
  var picked = _randomList(WIDGET_PRESETS, cols * rows);
  var result = [];
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var i = r * cols + c;
      result.push({
        id: comp.id + ':cell-' + i,
        role: 'focus-block',
        zone: comp.zone,
        _rect: {
          x: z.x + c * (cellW + gap),
          y: z.y + r * (cellH + gap),
          w: cellW,
          h: cellH
        },
        variant: picked[i] || {}
      });
    }
  }
  return result;
}

function _expandDetailContent(comp, layout) {
  var z = layout.zones[comp.zone] || layout.zones.interaction;
  var gap = (layout.metrics && layout.metrics.gap) || 12;
  var items = [];
  var y = z.y;

  // Agent-provided content (preferred) or fallback copy
  var c = comp.content || {};
  var heroTitle   = c.hero || c.title || 'Hero content';
  var titleText   = c.title || c.headline || 'Detail Title';
  var bodyParas   = Array.isArray(c.paragraphs) && c.paragraphs.length
    ? c.paragraphs
    : Array.isArray(c.body) ? c.body
    : (c.description
        ? [c.description]
        : [
            'Concise description of the detail — one or two lines that give the user the core of what they\u2019re looking at.',
            'A secondary paragraph with supporting info. Tap to expand for more context, reviews, or related items.'
          ]);
  var actions = c.actions || c.primaryAction
    ? {
        primary:   (c.actions && c.actions[0] && (c.actions[0].label || c.actions[0].text)) || c.primaryAction || 'Save',
        secondary: (c.actions && c.actions[1] && (c.actions[1].label || c.actions[1].text)) || c.secondaryAction || 'Share'
      }
    : { primary: 'Save', secondary: 'Share' };

  // Hero card (4:3 aspect)
  var heroH = Math.round(z.w * 0.6);
  items.push({
    id: comp.id + ':hero', role: 'focus-block', zone: comp.zone,
    _rect: { x: z.x, y: y, w: z.w, h: heroH },
    variant: { kind: 'hero', title: heroTitle }
  });
  y += heroH + gap;

  // Title block
  items.push({
    id: comp.id + ':title', role: 'paragraph', zone: comp.zone,
    _rect: { x: z.x, y: y, w: z.w, h: 48 },
    variant: { kind: 'title', text: titleText }
  });
  y += 48 + gap;

  // Body paragraphs (agent-provided or fallback)
  for (var p = 0; p < Math.min(bodyParas.length, 3) && (y + 52) <= z.y + z.h - 60; p++) {
    items.push({
      id: comp.id + ':para-' + p, role: 'paragraph', zone: comp.zone,
      _rect: { x: z.x, y: y, w: z.w, h: 52 },
      variant: { kind: 'body', text: bodyParas[p] }
    });
    y += 52 + gap;
  }

  // Action row
  items.push({
    id: comp.id + ':actions', role: 'action-row', zone: comp.zone,
    _rect: { x: z.x, y: y, w: z.w, h: 48 },
    variant: actions
  });

  return items;
}

function _expandLockWidgets(comp, layout) {
  var z = layout.zones.viewing;
  var widgetW = 124, widgetH = 56, gap = 14;
  var totalW = widgetW * 2 + gap;
  var startX = z.x + (z.w - totalW) / 2;
  var startY = 347; // Figma top: 347.37

  return [
    {
      id: comp.id + ':battery',
      role: 'lock-widget-battery',
      zone: comp.zone,
      _rect: { x: startX, y: startY, w: widgetW, h: widgetH }
    },
    {
      id: comp.id + ':activity',
      role: 'lock-widget-activity',
      zone: comp.zone,
      _rect: { x: startX + widgetW + gap, y: startY, w: widgetW, h: widgetH }
    }
  ];
}

function _expandHomeTopWidgets(comp, layout) {
  var startX = 23, startY = 57; // Figma Group 2085670788
  return [
    {
      id: comp.id + ':temp',
      role: 'dot-temperature-1x1',
      zone: comp.zone,
      _rect: { x: startX, y: startY + 86, w: 82, h: 82 }
    },
    {
      id: comp.id + ':date',
      role: 'dot-date-1x1-v1-1',
      zone: comp.zone,
      _rect: { x: startX + 86, y: startY + 86, w: 82, h: 82 }
    },
    {
      id: comp.id + ':weather',
      role: 'dot-weather-2x1-v1-1',
      zone: comp.zone,
      _rect: { x: startX, y: startY, w: 168, h: 82 }
    },
    {
      id: comp.id + ':schedule',
      role: 'dot-schedule-2x2',
      zone: comp.zone,
      _rect: { x: startX + 174, y: startY, w: 168, h: 168 }
    }
  ];
}

function _expandHomeMidWidgets(comp, layout) {
  var startX = 24, startY = 398; // Figma Group 2085670789
  return [
    {
      id: comp.id + ':music',
      role: 'dot-music-1x1',
      zone: comp.zone,
      _rect: { x: startX, y: startY, w: 168, h: 168 }
    }
  ];
}

window.resolveComponentRect = function resolveComponentRect(comp, layout, plan) {
  // If the container-expansion pass already computed a rect, use it as-is.
  if (comp._rect) return comp._rect;

  const z = layout.zones;
  const m = layout.metrics;
  const vw = layout.viewport.width;
  const vh = layout.viewport.height;

  switch (comp.role) {
    case 'status-bar':
      return {
        x: z.topSystem.x,
        y: z.topSystem.y,
        w: z.topSystem.w,
        h: z.topSystem.h
      };

    case 'expandable-app-bar':
      return {
        x: z.viewing.x,
        y: z.viewing.y,
        w: z.viewing.w,
        h: comp.state === 'expanded' ? m.appBarExpandedH : m.appBarCollapsedH
      };

    case 'collapsed-app-bar':
    case 'selection-app-bar':
      return {
        x: z.viewing.x,
        y: z.viewing.y,
        w: z.viewing.w,
        h: m.appBarCollapsedH
      };

    case 'search-bar':
      // Sits below the list-top-bar (80h + 8 gap). The top-bar now holds
      // a title line + time/date line so it's taller than before.
      return {
        x: z.viewing.x,
        y: z.viewing.y + 80 + 8,   // list-top-bar.bottom + 8
        w: z.viewing.w,
        h: 44
      };

    case 'focus-block': {
      // Sits below the list-top-bar (80h + 12 gap). Detail screen may
      // include up to THREE stacked focus-blocks — 'secondary-card' (or
      // 'hero-card-2') offsets below the first by 1× (fbH + 12 gap),
      // and 'tertiary-card' (or 'hero-card-3') offsets by 2×.
      var fbBaseY = z.viewing.y + 80 + 12;
      var fbH = 160;
      var fbY = fbBaseY;
      if (comp.id === 'secondary-card' || comp.id === 'hero-card-2') {
        fbY = fbBaseY + fbH + 12;
      } else if (comp.id === 'tertiary-card' || comp.id === 'hero-card-3') {
        fbY = fbBaseY + (fbH + 12) * 2;
      }
      return {
        x: z.viewing.x,
        y: fbY,
        w: z.viewing.w,
        h: fbH
      };
    }

    case 'focus-block-group':
      return {
        x: z.interaction.x,
        y: z.interaction.y,
        w: z.interaction.w,
        h: z.interaction.h - 12
      };

    case 'detail-content':
    case 'list':
    case 'notification-list':
      return {
        x: z.interaction.x,
        y: z.interaction.y,
        w: z.interaction.w,
        h: z.interaction.h
      };

    case 'list-top-bar':
      // Figma "Top" header (989:22761) + optional title line above.
      // Height 80: 30 for title + 4 gap + 35 for time/date + 11 pad.
      // When no title, still uses 80 so downstream positions stay stable.
      return {
        x: z.viewing.x,
        y: z.viewing.y,
        w: z.viewing.w,
        h: 80
      };

    case 'selection-dialog': {
      // Sits just below the search-bar on List screens. Starts at
      // (list-top-bar + 8 gap + search-bar + 16 gap) and extends through
      // the interaction zone so the 6 menu options have room to breathe.
      var sdY = z.viewing.y + 80 + 8 + 44 + 16; // top-bar(80) + gap + search-bar(44) + gap
      var sdH = (z.interaction.y + z.interaction.h) - sdY - 12;
      return {
        x: z.viewing.x,
        y: sdY,
        w: z.viewing.w,
        h: Math.max(200, sdH)
      };
    }

    case 'bottom-navigation':
    case 'app-dock':
      return {
        x: z.bottomNav.x,
        y: z.bottomNav.y,
        w: z.bottomNav.w,
        h: z.bottomNav.h
      };

    case 'app-grid':
      // Full content column between status bar and dock.
      return {
        x: z.topSystem.x,
        y: z.topSystem.y + z.topSystem.h + 12,
        w: z.topSystem.w,
        h: z.bottomNav.y - (z.topSystem.y + z.topSystem.h + 12) - 10
      };

    case 'bottom-bar':
      return {
        x: z.bottomBar.x,
        y: z.bottomBar.y,
        w: z.bottomBar.w,
        h: z.bottomBar.h
      };

    case 'bottom-dialog':
      return {
        x: 0,
        y: vh - 320,
        w: vw,
        h: 320
      };

    case 'center-dialog':
      return {
        x: Math.round(vw * 0.1),
        y: Math.round(vh * 0.38),
        w: Math.round(vw * 0.8),
        h: 220
      };

    case 'quick-settings-panel':
      return {
        x: 0,
        y: Math.round(vh * 0.16),
        w: vw,
        h: vh - Math.round(vh * 0.16)
      };

    // Canonical Samsung lockscreen atomics (names match Scene/Lock
    // template layers — see app/rules-renderer.js ROLE_RENDERERS).
    // Coordinates mirror the Figma Lock frame 451×978:
    //   lockIndicator y≈48  (small padlock icon, top center)
    //   weatherDate   y≈133 (condition + temp line above the clock)
    //   clock         y≈179 (huge center clock)
    //   shortcutLeft/Right = 47×47 circles in bottomNav zone corners
    //   gestureBar    = full-width 24h home indicator at very bottom
    case 'lockIndicator':
    case 'lock-indicator':   // kebab alias, same render target
      return {
        x: Math.round(vw / 2 - 12),
        y: z.topSystem.y + z.topSystem.h + 12,
        w: 24,
        h: 24
      };

    case 'weatherDate':
    case 'weather-date':
      return {
        x: z.viewing.x,
        y: 84 + (window.currentSurfaceType === 'lockscreen-persona2' ? 28 : 0), // Figma top: 119.67 -> Adjusted higher
        w: z.viewing.w,
        h: 28
      };

    case 'clock':
    case 'lock-clock':
    case 'lock-time':
      return {
        x: z.viewing.x,
        y: 112 + (window.currentSurfaceType === 'lockscreen-persona2' ? 28 : 0), // Below weatherDate -> Adjusted higher
        w: z.viewing.w,
        h: 176
      };

    case 'lock-date':
      return {
        x: z.viewing.x,
        y: z.viewing.y + 262,
        w: z.viewing.w,
        h: 28
      };

    case 'lock-widgets':
      return {
        x: z.viewing.x,
        y: 347,
        w: z.viewing.w,
        h: 56
      };

    case 'persona2-widgets':
      if (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test2') {
        return {
          x: 0,
          y: 326,
          w: vw,
          h: 240
        };
      }
      return {
        x: 0,
        y: 310 + 46,
        w: vw,
        h: 450
      };
    case 'lock-dot-widgets':
      return {
        x: z.viewing.x,
        y: 119, // Same as weatherDate
        w: z.viewing.w,
        h: z.viewing.h
      };

    case 'dot-running':
      return {
        x: (vw - 310) / 2,
        y: 699,
        w: 310,
        h: 78
      };

    case 'lock-dot-shortcuts':
      return {
        x: z.bottomNav.x,
        y: z.bottomNav.y,
        w: z.bottomNav.w,
        h: z.bottomNav.h
      };

    case 'shortcutLeft':
    case 'shortcutRight': {
      var isRight = comp.role === 'shortcutRight';
      var sideGap = 28;
      var bottomGap = 16;
      var size = 54;
      return {
        x: isRight ? (vw - sideGap - size) : sideGap,
        y: vh - bottomGap - size - 8,
        w: size,
        h: size
      };
    }

    case 'navigation-bar':
      return {
        x: 0,
        y: vh - 22,
        w: vw,
        h: 22
      };

    case 'home-persona1-widgets':
      return {
        x: 0,
        // Align with the viewing zone top so the first card doesn't clip
        // against the device bezel on some browser zoom levels.
        y: 100,
        w: vw,
        h: 600
      };

    case 'home-top-widgets':
      return {
        x: 23,
        y: 57,
        w: vw - 46,
        h: 168
      };

    case 'home-mid-widgets':
      return {
        x: 24,
        y: 418,
        w: vw - 48,
        h: 168
      };

    case 'dot-time-matrix':
      return {
        x: 29,
        y: 229,
        w: vw - 58,
        h: 165
      };

    case 'dot-music-1x2-actions':
      return {
        x: 22,
        y: 594,
        w: vw - 44,
        h: 165
      };

    case 'lock-shortcuts':   // legacy combined role
      return {
        x: z.bottomNav.x,
        y: z.bottomNav.y,
        w: z.bottomNav.w,
        h: z.bottomNav.h
      };

    case 'gestureBar':
      return {
        x: 0,
        y: vh - 10,
        w: vw,
        h: 24
      };

    case 'health-header':
      return { x: 25, y: 80, w: vw - 50, h: 40 };
    case 'health-brief':
      return { x: 25, y: 130, w: vw - 50, h: 60 };
    case 'health-goal-card':
      return { x: 25, y: 210, w: 401, h: 110 };
    case 'health-course-card':
      return { x: 25, y: 338, w: 193, h: 193 };
    case 'health-weather-card':
      return { x: 233, y: 338, w: 193, h: 78 };
    case 'health-jogging-card':
      return { x: 233, y: 431, w: 193, h: 100 };
    case 'health-music-card':
      return { x: 25, y: 550, w: 401, h: 180 };
    case 'health-header':
      return { x: 25, y: 80, w: vw - 50, h: 40 };
    case 'health-brief':
      return { x: 25, y: 130, w: vw - 50, h: 60 };
    case 'health-goal-card':
      return { x: 25, y: 210, w: 401, h: 110 };
    case 'health-course-card':
      return { x: 25, y: 338, w: 193, h: 193 };
    case 'health-weather-card':
      return { x: 233, y: 338, w: 193, h: 78 };
    case 'health-jogging-card':
      return { x: 233, y: 431, w: 193, h: 100 };
    case 'health-weather-card':
      return '<div class="health-weather-card" style="width:100%;height:100%;background:#FF7F24;border-radius:39px;padding:16px 24px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;color:#000;">' +
        window.renderAtomicForRole({ role: 'dot-weather-2x1-v1-1', variant: { location: 'Sydney', condition: 'sunny', dotColor: '#000' } }, { w: 40, h: 40 }) +
        '<div style="text-align:right;">' +
          '<div style="font-family:var(--font);font-weight:600;font-size:16px;">Sydney</div>' +
          '<div style="font-family:var(--font);font-weight:500;font-size:14px;opacity:0.8;">Sunny</div>' +
        '</div>' +
      '</div>';
    case 'health-jogging-card':
      return '<div class="health-jogging-card" style="width:100%;height:100%;background:#1A1D1C;border-radius:50px;padding:16px 24px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;color:#fff;">' +
        window.renderAtomicForRole({ role: 'dot-running', variant: { state: 'idle', scale: 0.5 } }, { w: 40, h: 40 }) +
        '<div style="text-align:right;">' +
          '<div style="font-family:var(--font);font-weight:600;font-size:16px;color:#FF7F24;">조깅</div>' +
          '<div style="font-family:var(--font);font-weight:500;font-size:14px;color:#FF7F24;">10:35</div>' +
        '</div>' +
      '</div>';
    case 'health-music-card':
      return '<div class="health-music-card" style="width:100%;height:100%;background:#1A1D1C;border-radius:24px;padding:20px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;color:#fff;position:relative;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
          '<div style="display:flex;gap:16px;align-items:center;">' +
            '<div style="width:64px;height:64px;background:#3B393E;border-radius:20px;display:flex;align-items:center;justify-content:center;">' +
              '<svg class="dot-music3__noteSvg" width="32" height="32" viewBox="-2 -2 68 68" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                '<circle cx="27.98" cy="3.49" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="35.66" cy="3.49" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="44.25" cy="3.49" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="52.39" cy="3.49" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="60.52" cy="3.49" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="19.85" cy="3.49" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="27.98" cy="11.62" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="44.25" cy="11.62" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="60.52" cy="11.62" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="19.85" cy="11.62" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="35.66" cy="11.62" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="52.39" cy="11.62" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="27.98" cy="19.76" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="44.25" cy="19.76" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="60.52" cy="19.76" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="19.85" cy="19.76" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="35.66" cy="19.76" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="52.39" cy="19.76" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="19.85" cy="28.80" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="60.52" cy="28.80" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="19.85" cy="36.94" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="60.52" cy="36.94" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="19.85" cy="45.18" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="60.52" cy="45.18" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="11.62" cy="53.32" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="3.49"  cy="53.32" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="52.39" cy="53.32" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="19.85" cy="53.32" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="60.52" cy="53.32" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="11.62" cy="61.45" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="3.49"  cy="61.45" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="52.39" cy="61.45" r="3.5" fill="#FFFFFF"/>' +
              '</svg>' +
            '</div>' +
            '<div style="font-family:var(--font);font-weight:600;font-size:16px;line-height:1.3;">오늘 날씨에 딱 맞는<br/>플레이리스트</div>' +
          '</div>' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" style="opacity:0.9;"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.485 17.303c-.215.354-.674.466-1.028.251-2.858-1.747-6.457-2.141-10.694-1.173-.406.092-.813-.162-.905-.568-.092-.406.162-.813.568-.905 4.632-1.059 8.604-.604 11.808 1.354.354.215.466.674.251 1.028zm1.465-3.262c-.271.441-.849.584-1.29.313-3.271-2.011-8.258-2.593-12.126-1.418-.497.151-1.025-.129-1.176-.626-.151-.497.129-1.025.626-1.176 4.418-1.34 9.907-.689 13.653 1.627.441.271.584.849.313 1.29zm.127-3.398c-3.923-2.33-10.392-2.546-14.162-1.401-.602.183-1.24-.158-1.423-.76-.183-.602.158-1.24.76-1.423 4.316-1.311 11.458-1.054 15.96 1.619.541.321.718 1.02.397 1.561-.321.541-1.02.718-1.561.397z"/></svg>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">' +
          '<div style="font-family:Roboto;font-weight:400;font-size:14px;color:rgba(255,255,255,0.6);">Jim Hall - Concierto</div>' +
          '<div style="height:2px;background:rgba(255,255,255,0.1);position:relative;border-radius:1px;">' +
            '<div style="position:absolute;left:0;top:0;bottom:0;width:30%;background:#fff;border-radius:1px;"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    case 'unlock-hint':
      return {
        x: z.bottomNav.x,
        // Keep the text close to the lowered shortcut row.
        y: (z.bottomNav.y || vh - 80) + 12,
        w: z.bottomNav.w,
        h: 32
      };

    case 'scrim':
    case 'background':
      return {
        x: 0,
        y: 0,
        w: vw,
        h: vh
      };

    default:
      return {
        x: z.interaction.x,
        y: z.interaction.y,
        w: 200,
        h: 60
      };
  }
};

// ── Token helpers (typography + glass + radius + spacing) ───────────────
// Thin wrappers that read from design_rules.json via Generator.* when loaded.
// Fallbacks are defensive for offline / early-boot rendering.
function _T(size, opts) {
  if (window.Generator && typeof window.Generator.typography === 'function') {
    return window.Generator.typography(size, opts || {});
  }
  var Tr = typeof TypographyRules !== 'undefined' ? TypographyRules : null;
  if (Tr && typeof Tr.buildTypographyStyle === 'function') {
    var slice = Tr.MINIMAL_FALLBACK_TYPOGRAPHY;
    var dr = (typeof window.__DESIGN_RULES !== 'undefined' && window.__DESIGN_RULES)
      ? window.__DESIGN_RULES
      : null;
    if (dr && dr.typography) slice = dr.typography;
    return Tr.buildTypographyStyle(slice, size, opts || {});
  }
  return '';
}
function _G(tier) {
  var __surfTier = _themeSurfaceStyleRoot();
  // Neon matches flat: single matte surface token — avoid the glass gradient stack.
  if (__surfTier === 'flat' || __surfTier === 'neon') {
    return 'background:var(--surface-bg, rgba(23,23,26,0.80));' +
      '-webkit-backdrop-filter:var(--surface-filter, blur(24px));backdrop-filter:var(--surface-filter, blur(24px));' +
      'border:var(--surface-border, 1px solid rgba(255,255,255,0.06));' +
      'box-shadow:var(--surface-shadow, none);';
  }
  // Default / 기본 프리셋: 단일 표면 레이어 + 토큰 기반 블러/테두리.
  // (구형 이중 레이어 `transparent, var(--surface-bg)` + color-mix 폴백은
  // 일부 브라우저에서 배경 전체가 빠져 카드가 투명해 보이는 경우가 있었음.)
  if (_themeSurfaceStyleRoot() === 'base') {
    return 'background:var(--surface-bg, rgba(23,23,26,0.60));' +
      '-webkit-backdrop-filter:var(--surface-filter, blur(48px));backdrop-filter:var(--surface-filter, blur(48px));' +
      'border:var(--surface-border, 1px solid rgba(255,255,255,0.12));' +
      'box-shadow:var(--surface-shadow, none);';
  }
  if (_themeSurfaceStyleRoot() === 'glass') {
    return 'background:var(--surface-overlay, transparent), var(--surface-bg, rgba(255,255,255,0.10));' +
      'background-size:var(--surface-bg-size, 160% 160%);' +
      '-webkit-backdrop-filter:var(--surface-filter, blur(42px) saturate(1.55));backdrop-filter:var(--surface-filter, blur(42px) saturate(1.55));' +
      'border:var(--surface-border, 1px solid rgba(255,255,255,0.34));' +
      'box-shadow:var(--surface-shadow, inset 0 1px 0 rgba(255,255,255,0.46), 0 22px 60px rgba(0,0,0,0.30));';
  }
  var fallback = tier === 'widgetPill'
    ? 'rgba(23,23,26,0.6)'
    : 'rgba(23,23,26,0.60)';
  return 'background:var(--surface-overlay, transparent), var(--surface-bg,' + fallback + ');' +
    'background-size:var(--surface-bg-size, auto);animation:var(--surface-animation, none);' +
    '-webkit-backdrop-filter:var(--surface-filter, blur(20px));backdrop-filter:var(--surface-filter, blur(20px));' +
    'border:var(--surface-border, 1px solid rgba(255,255,255,0.08));' +
    'box-shadow:var(--surface-shadow, none);';
}
function _R(tier) {
  if (window.Generator && typeof window.Generator.radius === 'function') {
    return window.Generator.radius(tier);
  }
  const rMap = { small:20, card:20, medium:20, widget:20, pill:32, dialog:20, panel:20, container:20, circle:63.636 };
  return (rMap[tier] != null ? rMap[tier] : 14) + 'px';
}
function _S(tier) {
  if (window.Generator && typeof window.Generator.spacing === 'function') {
    return window.Generator.spacing(tier);
  }
  const sMap = { xs:4, sm:6, md:8, base:10, lg:12, xl:14, xxl:16, '3xl':18, '4xl':20 };
  return (sMap[tier] != null ? sMap[tier] : 8) + 'px';
}

// ── Weather icon — monochrome (Mono · Grayscale theme) ──────────────────
function _weatherIconSvgMonochrome(name) {
  var N = (name || 'sun').toLowerCase();
  var base = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" style="display:block;">';
  var close = '</svg>';
  var hi = '#d4d4d8';
  var mid = '#9a9a9f';
  var lo = '#6f6f75';
  var cloud = '<path d="M7 17a4 4 0 0 1-1-7.87A6 6 0 0 1 17.5 8.5 4 4 0 0 1 17 17H7z" fill="' + lo + '"/>';
  var cloud2 = '<path d="M7 17a4 4 0 0 1-1-7.87A6 6 0 0 1 17.5 8.5 4 4 0 0 1 17 17H7z" fill="' + mid + '"/>';
  switch (N) {
    case 'sun':
    case 'clear':
      return base +
        '<circle cx="12" cy="12" r="4.5" fill="' + hi + '"/>' +
        '<g stroke="' + hi + '" strokeWidth="2" strokeLinecap="round">' +
          '<path d="M12 2v2.5M12 19.5v2.5M2 12h2.5M19.5 12h2.5"/>' +
          '<path d="M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"/>' +
        '</g>' +
      close;
    case 'cloud-sun':
    case 'partly-cloudy':
      return base +
        '<circle cx="8" cy="7.5" r="3" fill="' + hi + '"/>' +
        '<g stroke="' + hi + '" strokeWidth="1.5" strokeLinecap="round">' +
          '<path d="M8 2v1.5M2 7.5h1.5M3.5 3.5l1.06 1.06M12.5 3.5l-1.06 1.06M2.94 11.56l1.06-1.06"/>' +
        '</g>' +
        cloud +
      close;
    case 'cloud':
    case 'overcast':
      return base + cloud2 + close;
    case 'rain':
    case 'showers':
    case 'drizzle':
      return base +
        cloud2 +
        '<g stroke="' + mid + '" strokeWidth="2" strokeLinecap="round">' +
          '<path d="M9 19v2.5M12 19.5v2M15 19v2.5"/>' +
        '</g>' +
      close;
    case 'snow':
    case 'sleet':
      return base +
        cloud +
        '<g fill="' + hi + '">' +
          '<circle cx="9" cy="20" r="1.2"/>' +
          '<circle cx="12" cy="21" r="1.2"/>' +
          '<circle cx="15" cy="20" r="1.2"/>' +
        '</g>' +
      close;
    case 'bolt':
    case 'storm':
    case 'thunderstorm':
      return base +
        cloud2 +
        '<path d="M12 18l-2 4h2.5l-1 4 4-6h-2.5l1-2z" fill="' + hi + '"/>' +
      close;
    case 'fog':
    case 'mist':
    case 'haze':
      return base +
        '<g stroke="' + mid + '" strokeWidth="2" strokeLinecap="round">' +
          '<path d="M3 8h18M3 12h18M3 16h13M5 20h14"/>' +
        '</g>' +
      close;
    case 'wind':
    case 'windy':
      return base +
        '<g stroke="' + mid + '" strokeWidth="2" strokeLinecap="round" fill="none">' +
          '<path d="M3 9h12a3 3 0 1 0-3-3"/>' +
          '<path d="M3 15h15a3 3 0 1 1-3 3"/>' +
        '</g>' +
      close;
    default:
      return base + cloud2 + close;
  }
}

// ── Weather icon glyph set ──────────────────────────────────────────────
// Returns an inline SVG string for the named weather condition. Sized to
// fill its container. Used by the focus-block weather variant. The colors
// are tuned to read on the dark glass card surface — sun is amber, cloud
// is light gray, rain is sky blue, snow is white-on-cloud, etc.
function _weatherIconSvg(name) {
  if (_isMonoChromaRoot()) {
    return _weatherIconSvgMonochrome(name);
  }
  const N = (name || 'sun').toLowerCase();
  const base = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" style="display:block;">';
  const close = '</svg>';
  const cloud = '<path d="M7 17a4 4 0 0 1-1-7.87A6 6 0 0 1 17.5 8.5 4 4 0 0 1 17 17H7z" fill="#E5E7EB"/>';
  const cloudGray = '<path d="M7 17a4 4 0 0 1-1-7.87A6 6 0 0 1 17.5 8.5 4 4 0 0 1 17 17H7z" fill="#9CA3AF"/>';
  switch (N) {
    case 'sun':
    case 'clear':
      return base +
        '<circle cx="12" cy="12" r="4.5" fill="#FBBF24"/>' +
        '<g stroke="#FBBF24" strokeWidth="2" strokeLinecap="round">' +
          '<path d="M12 2v2.5M12 19.5v2.5M2 12h2.5M19.5 12h2.5"/>' +
          '<path d="M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"/>' +
        '</g>' +
      close;
    case 'cloud-sun':
    case 'partly-cloudy':
      return base +
        '<circle cx="8" cy="7.5" r="3" fill="#FBBF24"/>' +
        '<g stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round">' +
          '<path d="M8 2v1.5M2 7.5h1.5M3.5 3.5l1.06 1.06M12.5 3.5l-1.06 1.06M2.94 11.56l1.06-1.06"/>' +
        '</g>' +
        cloud +
      close;
    case 'cloud':
    case 'overcast':
      return base + cloud + close;
    case 'rain':
    case 'showers':
    case 'drizzle':
      return base +
        cloudGray +
        '<g stroke="#60A5FA" strokeWidth="2" strokeLinecap="round">' +
          '<path d="M9 19v2.5M12 19.5v2M15 19v2.5"/>' +
        '</g>' +
      close;
    case 'snow':
    case 'sleet':
      return base +
        cloud +
        '<g fill="#fff">' +
          '<circle cx="9" cy="20" r="1.2"/>' +
          '<circle cx="12" cy="21" r="1.2"/>' +
          '<circle cx="15" cy="20" r="1.2"/>' +
        '</g>' +
      close;
    case 'bolt':
    case 'storm':
    case 'thunderstorm':
      return base +
        cloudGray +
        '<path d="M12 18l-2 4h2.5l-1 4 4-6h-2.5l1-2z" fill="#FBBF24"/>' +
      close;
    case 'fog':
    case 'mist':
    case 'haze':
      return base +
        '<g stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">' +
          '<path d="M3 8h18M3 12h18M3 16h13M5 20h14"/>' +
        '</g>' +
      close;
    case 'wind':
    case 'windy':
      return base +
        '<g stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" fill="none">' +
          '<path d="M3 9h12a3 3 0 1 0-3-3"/>' +
          '<path d="M3 15h15a3 3 0 1 1-3 3"/>' +
        '</g>' +
      close;
    default:
      return base + cloud + close;
  }
}

function _isTest2Scope() {
  return !!(window.__mlpTestConfig && window.__mlpTestConfig.id === 'test2');
}

function _escP2Html(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _computeP2ContactListHeight(itemCount) {
  var count = Math.max(1, Math.min(itemCount || 3, 3));
  var padTop = 20;
  var padBottom = 16;
  var headerBlock = 28;
  var headerGap = 12;
  var itemH = 68;
  var itemGap = 8;
  return padTop + headerBlock + headerGap + count * itemH + (count - 1) * itemGap + padBottom;
}

function _renderP2ContactList(variant, rect) {
  var v = variant || {};
  var w = (rect && rect.w) || 340;
  var rawItems = Array.isArray(v.items) ? v.items : [];
  var defaultTimes = ['3일 전', '2일 전', '4일 전'];
  var defaultTitles = [
    '체크아웃 개선 리서치 공유',
    '슬랙: 신규 알림 2건',
    'Figma: 디자인 시스템 업데이트'
  ];
  var defaultSubs = [
    '이민재 · 프로토타입 확인 후 피드백 요청',
    '김지훈 · 쇼핑몰 개편 2차 시안 준비',
    '김지훈 · Figma 완료, Notion 문서화만 남음'
  ];
  var items = rawItems.slice(0, 3);
  while (items.length < 3) {
    var fillIdx = items.length;
    items.push({
      text: defaultTitles[fillIdx] || ('항목 ' + (fillIdx + 1)),
      time: defaultTimes[fillIdx] || '',
      subtitle: defaultSubs[fillIdx] || ''
    });
  }
  var header = v.title || v.section || v.date || '휴가 중 디자인 피드백';
  if (/^(summary|may\s+\d+|today|messages)$/i.test(String(header).trim())) {
    header = '휴가 중 디자인 피드백';
  }
  var chevron = '<svg class="p2-contact-list__chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M6 4l4 4-4 4" stroke="rgba(255,255,255,0.5)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var rows = items.map(function (it, idx) {
    var title = (it && it.text) || defaultTitles[idx] || ('항목 ' + (idx + 1));
    var time = (it && it.time) || defaultTimes[idx] || '';
    var sub = (it && (it.subtitle || it.note || it.meta)) || defaultSubs[idx] || '';
    return '<div class="p2-contact-list__item dot-sch__row">' +
      '<div class="p2-contact-list__icon" aria-hidden="true"></div>' +
      '<div class="p2-contact-list__body">' +
        '<div class="p2-contact-list__title-row">' +
          '<span class="p2-contact-list__title">' + _escP2Html(title) + '</span>' +
          (time ? '<span class="p2-contact-list__time">' + _escP2Html(time) + '</span>' : '') +
        '</div>' +
        (sub ? '<div class="p2-contact-list__subtitle">' + _escP2Html(sub) + '</div>' : '') +
      '</div>' +
      chevron +
    '</div>';
  }).join('');
  return '' +
    '<div class="dot-card p2-contact-list" data-item-count="' + items.length + '" style="width:' + w + 'px;">' +
      '<div class="p2-contact-list__header dot-sch__date">' + _escP2Html(header) + '</div>' +
      '<div class="p2-contact-list__items">' + rows + '</div>' +
    '</div>';
}

window.renderAtomicForRole = function renderAtomicForRole(comp, rect) {
  const A = window.GalaxyAtomics || {};

  switch (comp.role) {
    // (p3-ai-orb / p3-ai-result removed — star interaction belongs to persona2)
    case 'cooking-bg': {
      var bgImg = '/assets/dot-gallery/image-114131.png';
      return '<div class="p3-bg-container" style="width:100%;height:100%;position:absolute;inset:0;overflow:hidden;">' +
        '<div class="p3-bg-overlay" style="position:absolute;inset:-50px;background:url(' + bgImg + ') center/cover; filter:blur(40px) brightness(0.65); opacity:0;"></div>' +
      '</div>';
    }

    case 'cooking-greeting': {
      var gv = (comp && comp.variant) || {};
      var l1 = gv.line1 || '민수님,';
      var l2 = gv.line2 || '운동 수고하셨어요!';
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;font-family:var(--font);font-weight:700;color:#1a1d1c;letter-spacing:-0.2px;">' +
        '<div style="font-size:26px;line-height:1.2;">' + l1 + '</div>' +
        '<div style="font-size:26px;line-height:1.2;">' + l2 + '</div>' +
      '</div>';
    }

    case 'cooking-subtitle': {
      var sv = (comp && comp.variant) || {};
      var t = sv.text || '회복을 돕는 연어스테이크를 준비해볼까요?';
      return '<div style="width:100%;height:100%;display:flex;align-items:center;font-family:var(--font);font-weight:500;font-size:16px;line-height:1.3;color:#1a1d1c;opacity:0.9;">' +
        t +
      '</div>';
    }

    case 'cooking-yes-no-btn': {
      return '<div style="width:100%;height:100%;display:flex;gap:12px;">' +
        '<button class="p3-yes-no-action" data-action="no" aria-label="아니요" style="flex:1;height:56px;border-radius:28px;background:rgba(255,255,255,0.4);color:#1A1D1C;font-family:var(--font);font-weight:600;font-size:16px;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:opacity 0.2s;"></button>' +
        '<button class="p3-yes-no-action" data-action="yes" aria-label="네, 준비해볼게요" style="flex:1;height:56px;border-radius:28px;background:#B7E46A;color:#1A1D1C;font-family:var(--font);font-weight:600;font-size:16px;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:opacity 0.2s;"></button>' +
      '</div>';
    }

    case 'test3-page-dots': {
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:7px;">' +
        '<span style="width:6px;height:6px;border-radius:50%;background:rgba(11,27,44,0.58);display:block;box-shadow:0 1px 3px rgba(255,255,255,0.12);"></span>' +
        '<span style="width:6px;height:6px;border-radius:50%;background:rgba(11,27,44,0.58);display:block;box-shadow:0 1px 3px rgba(255,255,255,0.12);"></span>' +
        '<span style="width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.55);display:block;box-shadow:0 1px 3px rgba(0,0,0,0.18);"></span>' +
        '<span style="width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.94);display:block;box-shadow:0 1px 3px rgba(0,0,0,0.18);"></span>' +
      '</div>';
    }

    case 'cooking-recipe': {
      var rv = (comp && comp.variant) || {};
      var right = rv.rightMeta || '85% 데이터 일치';
      var chip = function (label, value) {
        return '<div style="width:100px;height:54px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.10);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:var(--p3-green,#B7E46A);">' +
          '<div style="font-family:var(--font);font-weight:500;font-size:13px;line-height:1.3;color:rgba(231,255,200,0.92);">' + label + '</div>' +
          '<div style="font-family:var(--font-dot);font-weight:400;font-size:19px;line-height:1.1;color:var(--p3-green,#B7E46A);letter-spacing:0.02em;white-space:nowrap;">' + value + '</div>' +
        '</div>';
      };
      var alertIcon =
        '<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;">' +
          '<div style="width:7px;height:18px;display:grid;grid-template-rows:repeat(5,1fr);gap:2px;">' +
            '<span style="width:4px;height:4px;border-radius:99px;background:#1a1d1c;opacity:0.8;"></span>'.repeat(5) +
          '</div>' +
        '</div>';
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<div style="display:flex;align-items:center;gap:4px;color:#1a1d1c;">' +
            alertIcon +
            '<div style="font-family:var(--font);font-weight:600;font-size:15px;line-height:1.3;">레시피 요약</div>' +
          '</div>' +
          '<div style="font-family:var(--font);font-weight:500;font-size:15px;line-height:1.3;opacity:0.5;color:#1a1d1c;">' + right + '</div>' +
        '</div>' +
        '<div style="width:340px;height:72px;background:var(--p3-black,rgba(16,16,18,0.92));border-radius:30px;display:flex;align-items:center;justify-content:center;gap:10px;">' +
          chip('칼로리', '420kcal') +
          chip('조리 시간', '15min') +
          chip('난이도', 'M') +
        '</div>' +
      '</div>';
    }

    case 'cooking-ingredients': {
      var iv = (comp && comp.variant) || {};
      var right = iv.rightMeta || '스마트싱즈 연동 중';
      var alertIcon =
        '<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;">' +
          '<div style="width:7px;height:18px;display:grid;grid-template-rows:repeat(5,1fr);gap:2px;">' +
            '<span style="width:4px;height:4px;border-radius:99px;background:#1a1d1c;opacity:0.8;"></span>'.repeat(5) +
          '</div>' +
        '</div>';
      function row(title, sub, amount, shouldBeChecked) {
        var extraClass = shouldBeChecked ? ' will-be-checked' : '';
        return '<button type="button" class="p3-ing-row' + extraClass + '" data-title="' + (title || '') + '" aria-label="' + (title || 'ingredient') + '" style="width:341px;height:61px;border-radius:93px;display:flex;align-items:center;justify-content:space-between;padding:0 18px 0 15px;box-sizing:border-box;border:1px solid rgba(16,16,18,0.06);cursor:pointer;-webkit-tap-highlight-color:transparent;">' +
          '<div style="display:flex;align-items:center;gap:17px;min-width:0;">' +
            '<div class="p3-left-circle" style="width:35px;height:35px;border-radius:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              '<div class="p3-check-ring" style="width:18px;height:18px;border-radius:99px;border:2px solid;display:flex;align-items:center;justify-content:center;">' +
                '<div class="p3-check-dot" style="width:8px;height:8px;border-radius:99px;"></div>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:3px;min-width:0;">' +
              '<div style="font-family:var(--font);font-weight:700;font-size:15px;line-height:1.3;color:var(--p3-ink,#1A1D1C);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + title + '</div>' +
              (sub ? '<div class="p3-subtext" style="font-family:var(--font);font-weight:600;font-size:12px;line-height:1.3;color:rgba(26,29,28,0.62);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + sub + '</div>' : '') +
            '</div>' +
          '</div>' +
          '<div style="font-family:var(--font-dot);font-weight:400;font-size:22px;line-height:1.1;color:var(--p3-ink,#1A1D1C);letter-spacing:0.06em;">' + amount + '</div>' +
        '</button>';
      }
      return '<div id="p3-ingredients-wrapper" style="width:100%;height:100%;display:none;flex-direction:column;gap:8px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;width:341px;">' +
          '<div style="display:flex;align-items:center;gap:4px;color:#1a1d1c;">' +
            alertIcon +
            '<div style="font-family:var(--font);font-weight:600;font-size:15px;line-height:1.3;">재료 준비 현황</div>' +
          '</div>' +
          '<div style="font-family:var(--font);font-weight:500;font-size:15px;line-height:1.3;opacity:0.5;color:#1a1d1c;">' + right + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:7px;">' +
          row('생연어 필렛','냉장고 2칸 확인됨','200g',true) +
          row('아스파라거스','신선실 확인됨','4',true) +
          row('올리브 오일','펜트리 보관 추천','2',false) +
          row('소금 및 후추','', '2',false) +
        '</div>' +
      '</div>';
    }

    case 'cooking-send-btn': {
      var bv = (comp && comp.variant) || {};
      var text = bv.text || '인덕션 연동 및 조리 시작';
      return '<button id="p3-send" type="button" class="p3-send" aria-label="' + text + '" style="width:100%;height:100%;background:var(--p3-black,rgba(16,16,18,0.92));border-radius:14000px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;box-sizing:border-box;color:#fff;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent;">' +
        '<div style="font-family:var(--font);font-weight:500;font-size:18px;line-height:1.3;">' + text + '</div>' +
        '<div class="p3-arrowdots" aria-hidden="true" style="display:grid;grid-template-columns:repeat(2,4px);grid-auto-rows:4px;gap:4px;transform:rotate(90deg);">' +
          '<span></span><span></span><span></span><span></span><span></span><span></span>' +
        '</div>' +
      '</button>';
    }

    case 'cooking-agent-card': {
      var cav = (comp && comp.variant) || {};
      var title = cav.title || '에이전트 추천';
      var text = cav.text || '와인 페어링 추천: 쇼비뇽 블랑이 잘 어울려요';
      var icon = cav.icon || '🍷';
      return '<div class="p3-agent-card" style="width:340px; height:auto; background:rgba(255,255,255,0.85); border-radius:40px; padding:22px 26px; box-sizing:border-box; display:flex; flex-direction:column; gap:12px; box-shadow: 0 15px 40px rgba(0,0,0,0.08); border: 1px solid rgba(255,255,255,0.6); backdrop-filter:blur(15px);">' +
        '<div style="display:flex; align-items:center; gap:14px;">' +
          '<div style="width:44px; height:44px; background:rgba(185,166,255,0.2); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:24px;">' + icon + '</div>' +
          '<div style="font-family:var(--font); font-weight:800; font-size:14px; color:var(--p2-lavender, #8E74FF); text-transform:uppercase; letter-spacing:1px;">' + title + '</div>' +
        '</div>' +
        '<div style="font-family:var(--font); font-weight:700; font-size:18px; color:#1a1d1c; line-height:1.4;">' + text + '</div>' +
      '</div>';
    }
    case 'cooking-agent-card-2': {
      var cav = (comp && comp.variant) || {};
      var title = cav.title || '부족한 재료 구매';
      var text = cav.text || '올리브 오일, 소금 및 후추를 장바구니에 담을까요?';
      var icon = cav.icon || '🛒';
      return '<div class="p3-agent-card" style="width:340px; height:auto; background:rgba(255,255,255,0.85); border-radius:40px; padding:22px 26px; box-sizing:border-box; display:flex; flex-direction:column; gap:12px; box-shadow: 0 15px 40px rgba(0,0,0,0.08); border: 1px solid rgba(255,255,255,0.6); backdrop-filter:blur(15px);">' +
        '<div style="display:flex; align-items:center; gap:14px;">' +
          '<div style="width:44px; height:44px; background:rgba(185,166,255,0.2); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:24px;">' + icon + '</div>' +
          '<div style="font-family:var(--font); font-weight:800; font-size:14px; color:var(--p2-lavender, #8E74FF); text-transform:uppercase; letter-spacing:1px;">' + title + '</div>' +
        '</div>' +
        '<div style="font-family:var(--font); font-weight:700; font-size:18px; color:#1a1d1c; line-height:1.4;">' + text + '</div>' +
        '<div style="display:flex; gap:8px; margin-top:8px;">' +
          '<button type="button" class="p3-agent-action-btn p3-agent-action-btn-yes" style="flex:1; height:48px; background:var(--p3-ink,#1A1D1C); color:#fff; border-radius:24px; border:none; font-family:var(--font); font-weight:600; font-size:15px; cursor:pointer;">네, 담아주세요</button>' +
        '</div>' +
      '</div>';
    }
    case 'status-bar':
      var sbv = (comp && comp.variant) || {};
      var sbTheme = sbv.theme || (window.currentSurfaceType === window.SURFACE_TYPES.HEALTH_MLP ? 'light' : 'dark');
      return A.StatusBar
        ? A.StatusBar({ theme: sbTheme, battery: 69, carrier: 'TJG' })
        : '<div style="height:100%;display:flex;align-items:center;justify-content:space-between;' +
            _T('caption', { color: 'statusBar' }) +
          '"><span>12:45</span><span>69%</span></div>';

    case 'list-top-bar': {
      // Figma "Top" 989:22761 + optional title line.
      //   Line 1 (18/700): big bold title (e.g. scenario title)
      //   Line 2: 26/700 time "8:21" + 18/500 date "Thu 28 Aug" inline
      // When variant.title is empty, only the time/date line renders.
      var ltv = (comp && comp.variant) || {};
      var ltTitle = ltv.title || '';
      var now = new Date();
      var h = now.getHours();
      var mi = now.getMinutes();
      var timeStr = h + ':' + (mi < 10 ? '0' + mi : String(mi));
      var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var mon  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var dateStr = days[now.getDay()] + ' ' + now.getDate() + ' ' + mon[now.getMonth()];
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;gap:8px;padding:0 10px;box-sizing:border-box;color:#fff;font-family:var(--font);">' +
        (ltTitle
          ? '<div style="font-size:22px;font-weight:700;letter-spacing:-0.1px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + ltTitle + '</div>'
          : '') +
        '<div style="display:flex;align-items:center;gap:20px;">' +
          '<span style="font-size:22px;font-weight:700;letter-spacing:0.22px;line-height:1;">' + timeStr + '</span>' +
          '<span style="font-size:15px;font-weight:500;letter-spacing:0.15px;line-height:1;opacity:0.9;">' + dateStr + '</span>' +
        '</div>' +
      '</div>';
    }

    case 'expandable-app-bar': {
      var abc = (comp && comp.content) || {};
      var abTitle = abc.title || comp.text || 'Title';
      var abSub   = abc.subtitle || '';
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:0 0 ' + _S('lg') + ' 0;box-sizing:border-box;">' +
        '<div data-appbar-title="1" style="' +
          _T(comp.state === 'expanded' ? 'headline' : 'heading', { weight: 'bold' }) +
          'line-height:1.1;transition:font-size 220ms cubic-bezier(0.2,0,0,1), transform 220ms cubic-bezier(0.2,0,0,1);">' + abTitle + '</div>' +
        (abSub ? '<div style="' + _T('caption', { color: 'translucentLabel' }) + 'margin-top:2px;">' + abSub + '</div>' : '') +
      '</div>';
    }

    case 'collapsed-app-bar':
    case 'selection-app-bar': {
      var cabc = (comp && comp.content) || {};
      var cabTitle = cabc.title || comp.text || 'Title';
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;">' +
        '<span style="' + _T('heading', { weight: 'bold' }) + '">' + cabTitle + '</span>' +
        '<span style="' + _T('large') + 'opacity:0.7;">⋮</span>' +
      '</div>';
    }

    case 'selection-dialog': {
      // Figma SelectionDialog — node 629:1603 (light) / 629:1602 (dark).
      //   container: 354 wide, bg rgba(255,255,255,0.5) OR rgba(0,0,0,0.5),
      //              backdrop-blur 24, rounded 28, padding 24, gap 24
      //   title: 20/600 (bold), theme-colored
      //   options: 6 rows, 20/400, theme-colored, 30h each
      var sdv = (comp && comp.variant) || {};
      var sdTheme = sdv.theme === 'dark' ? 'dark' : 'light';
      var sdTitle = sdv.title || 'This is a menu title';
      var DEFAULT_OPTIONS = [
        'This is a menu option',
        'This is a menu option',
        'This is a menu option',
        'This is a menu option',
        'This is a menu option',
        'This is a menu option'
      ];
      var sdOptions = Array.isArray(sdv.options) ? sdv.options : DEFAULT_OPTIONS;
      var sdShowTitle = sdv.showTitle !== false;
      var sdBg, sdText;
      if (sdTheme === 'dark') {
        sdBg   = 'rgba(0,0,0,0.5)';
        sdText = '#ffffff';
      } else {
        sdBg   = 'rgba(255,255,255,0.5)';
        sdText = '#000000';
      }
      var titleHTML = sdShowTitle
        ? '<div data-shortcut="1" style="width:100%;padding:8px 0;display:flex;align-items:center;cursor:pointer;">' +
            '<span style="font-family:var(--font);font-size:20px;font-weight:700;color:' + sdText + ';">' + sdTitle + '</span>' +
          '</div>'
        : '';
      var optsHTML = sdOptions.map(function (opt) {
        return '<div data-shortcut="1" style="width:100%;padding:8px 0;display:flex;align-items:center;cursor:pointer;">' +
          '<span style="font-family:var(--font);font-size:20px;font-weight:500;color:' + sdText + ';">' + opt + '</span>' +
        '</div>';
      }).join('');
      return '<div style="width:100%;height:100%;box-sizing:border-box;' +
        'background:' + sdBg + ';' +
        '-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);' +
        'border-radius:' + _R('widget') + ';padding:24px;' +
        'display:flex;flex-direction:column;gap:24px;align-items:flex-start;overflow:hidden;">' +
        titleHTML +
        '<div style="display:flex;flex-direction:column;gap:24px;width:100%;align-items:flex-start;">' +
          optsHTML +
        '</div>' +
      '</div>';
    }

    // ========================================================================
    // DIALOG ATOMICS (Figma InternetPopOutMenu 3074:6464)
    //   dialog-shell        → rounded glass container (bg + 24px blur)
    //   dialog-site-header  → 50×50 thumb + title + URL + share icon row
    //   dialog-browser-bar  → 5 circular icon buttons with labels
    //   dialog-icon-grid    → 2×4 icon+label grid inside a glass box +
    //                          page-indicator dots
    // These mirror the Dialog overlay's rules-renderer counterparts
    // (app/rules-renderer.js: renderDialogShell/SiteHeader/BrowserBar/
    // IconGrid) so the Dialog overlay can render its components through
    // the same atomic library that backs the Design-tab palette.
    // ========================================================================
    case 'dialog-shell': {
      return '<div style="width:100%;height:100%;' +
        'background:rgba(23,23,26,0.6);' +
        '-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);' +
        'border-radius:' + _R('dialog') + ';box-sizing:border-box;' +
        'box-shadow:0 16px 48px rgba(0,0,0,0.35);"></div>';
    }

    case 'dialog-site-header': {
      var dshv = (comp && comp.variant) || {};
      var dshTitle = dshv.siteName || dshv.title || 'One UI Design Kit';
      var dshUrl   = dshv.siteDesc || dshv.url   || 'https://www.figma.com/community/file/oneui';
      return (
        '<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:12px;padding:8px 8px 0;box-sizing:border-box;">' +
          '<div style="display:flex;align-items:center;gap:15px;">' +
            '<div style="width:50px;height:50px;border-radius:' + _R('widget') + ';background:linear-gradient(135deg,#4A5568,#2D3748);flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700;">\u25A3</div>' +
            '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;">' +
              '<div style="font-family:var(--font);font-size:18px;font-weight:700;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1;">' + dshTitle + '</div>' +
              '<div style="font-family:var(--font);font-size:14px;font-weight:500;color:#848487;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1;">' + dshUrl + '</div>' +
            '</div>' +
            '<div style="width:42px;height:42px;border-radius:' + _R('widget') + ';background:#17171a;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
              '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M12 4l-4 4M12 4l4 4M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>' +
            '</div>' +
          '</div>' +
          '<div style="height:1px;background:#5f5f61;width:100%;"></div>' +
        '</div>'
      );
    }

    case 'dialog-browser-bar': {
      var dbbActions = [
        { label: 'History',   svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7L3 7M3 3v4h4M12 7v5l3.5 2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>' },
        { label: 'Downloads', svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 4v12M6 12l6 6 6-6M4 20h16" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>' },
        { label: 'Galaxy AI', svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5L12 3zM18 15l.9 2.2L21 18l-2.1.8L18 21l-.9-2.2L15 18l2.1-.8L18 15z" fill="#fff"/></svg>' },
        { label: 'Add page',  svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>' },
        { label: 'Settings',  svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="1.6"/><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/></svg>' }
      ];
      var dbbCells = dbbActions.map(function (a) {
        return '<div data-shortcut="1" style="display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;">' +
          '<div style="width:54px;height:54px;border-radius:48px;background:#17171a;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 4.7px rgba(0,0,0,0.25);">' + a.svg + '</div>' +
          '<div style="font-family:var(--font);font-size:var(--font-size-xs,14px);font-weight:500;color:#fff;text-align:center;line-height:1.2;white-space:nowrap;">' + a.label + '</div>' +
        '</div>';
      }).join('');
      return '<div style="width:100%;height:100%;display:flex;align-items:flex-start;justify-content:space-between;padding:0 8px;box-sizing:border-box;">' +
        dbbCells +
      '</div>';
    }

    case 'dialog-icon-grid': {
      var digApps = [
        { name: 'Videos',     svg: '<rect x="3" y="5" width="18" height="12" rx="1.5" stroke="#fff" strokeWidth="1.6" fill="none"/><path d="M10 9l5 3-5 3V9z" fill="#fff"/>' },
        { name: 'Extensions', svg: '<path d="M8 3v3h8V3M3 8h3v8H3M21 8h-3v8h3M8 21v-3h8v3M6 9v6h12V9H6z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>' },
        { name: 'Block ads',  svg: '<circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.6" fill="none"/><path d="M5 5l14 14" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>' },
        { name: 'Privacy',    svg: '<path d="M12 3l7 3v5a9 9 0 0 1-7 9 9 9 0 0 1-7-9V6l7-3z" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>' },
        { name: 'Brightness', svg: '<circle cx="12" cy="12" r="4" stroke="#fff" strokeWidth="1.6" fill="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>' },
        { name: 'Find',       svg: '<circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="1.6" fill="none"/><path d="M16 16l4 4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>' },
        { name: 'Text',       svg: '<path d="M5 6h14M12 6v14M9 20h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>' },
        { name: 'Save PDF',   svg: '<rect x="5" y="3" width="14" height="18" rx="1.5" stroke="#fff" strokeWidth="1.6" fill="none"/><path d="M15 3v4h4M12 11v6M9 14l3 3 3-3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>' }
      ];
      var digRow = function (slice) {
        return slice.map(function (a) {
          return '<div data-shortcut="1" style="width:54px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;">' +
            '<div style="width:40px;height:28px;display:flex;align-items:center;justify-content:center;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none">' + a.svg + '</svg></div>' +
            '<div style="font-family:var(--font);font-size:var(--font-size-xs,14px);font-weight:500;color:#fff;text-align:center;line-height:1.2;white-space:nowrap;">' + a.name + '</div>' +
          '</div>';
        }).join('');
      };
      return (
        '<div style="width:100%;height:100%;background:rgba(23,23,26,0.6);border-radius:' + _R('widget') + ';padding:18px 20px 16px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;">' +
          '<div style="display:flex;justify-content:space-between;width:100%;">' + digRow(digApps.slice(0, 4)) + '</div>' +
          '<div style="display:flex;justify-content:space-between;width:100%;">' + digRow(digApps.slice(4, 8)) + '</div>' +
          '<div style="display:flex;justify-content:center;align-items:center;gap:6px;">' +
            '<div style="width:6px;height:6px;border-radius:5px;background:#ffffff;"></div>' +
            '<div style="width:6px;height:6px;border-radius:5px;background:rgba(255,255,255,0.6);"></div>' +
          '</div>' +
        '</div>'
      );
    }

    case 'search-bar': {
      // Randomly picks one of 4 Figma search-bar variants + one of 10
      // natural-sounding prompts. Renders as an actual <input> so the
      // user can type — styled to match Figma exactly (bg/text/mic).
      //
      // Figma variants (kxDvBUif6pV502Si4RPidK):
      //   47:221  — dark solid (#17171a bg, white text)
      //   547:9639 — light solid (#fcfcff bg, black text)
      //   47:228  — Galaxy-AI dark gradient (with blue→green gradient text)
      //   547:9646 — Galaxy-AI light gradient
      //
      // variant.style can pin a specific one ('dark'|'light'|'ai-dark'|
      // 'ai-light'); otherwise it's random per render.
      var sbc = (comp && comp.content) || {};
      var sbv = (comp && comp.variant) || {};
      var SEARCH_PROMPTS = [
        'What are you searching for?',
        'What do you need?',
        'What would you like to find?',
        'What are you trying to find?',
        'What can I help you find?',
        'What do you have in mind?',
        'What are you here for?',
        'What are you after?',
        'What are you hoping to discover?',
        'What brings you here today?'
      ];
      var sbPh = sbc.placeholder || sbv.placeholder ||
        SEARCH_PROMPTS[Math.floor(Math.random() * SEARCH_PROMPTS.length)];

      var STYLES = ['dark', 'light', 'ai-dark', 'ai-light'];
      var sbStyle = sbv.style || STYLES[Math.floor(Math.random() * STYLES.length)];
      var __surfStyle = _themeSurfaceStyleRoot();
      if ((__surfStyle === 'flat' || __surfStyle === 'neon') && (sbStyle === 'ai-dark' || sbStyle === 'ai-light')) {
        sbStyle = 'dark';
      }

      // Common shell: 30px rounded pill, px-20 py-17, flex justify-between
      // with 24px mic icon on the right. Background + text color vary.
      var wrapBg, inputColor, inputBgClip, shadow, phColor;
      if (sbStyle === 'light') {
        wrapBg     = 'background:#fcfcff;';
        inputColor = 'color:#000000;';
        inputBgClip = '';
        shadow = '';
        phColor = '#000000';
      } else if (sbStyle === 'ai-dark') {
        wrapBg     = 'background:linear-gradient(to right,#364b6f 0%,#384247 64.807%,#2d2d30 87.168%);';
        inputColor = 'color:transparent;background:linear-gradient(to right,#66a1f3,#22c9a6);-webkit-background-clip:text;background-clip:text;';
        inputBgClip = '';
        shadow = 'box-shadow:-1px 0 4px 1px rgba(78,102,139,0.58);';
        phColor = 'transparent'; // gradient via ::placeholder workaround below
      } else if (sbStyle === 'ai-light') {
        wrapBg     = 'background:linear-gradient(to right,#364b6f 0%,#91b0bf 64.807%,#cfcfcf 87.168%);';
        inputColor = 'color:transparent;background:linear-gradient(to right,#66a1f3,#22c9a6);-webkit-background-clip:text;background-clip:text;';
        inputBgClip = '';
        shadow = 'box-shadow:-1px 0 4px 1px rgba(78,102,139,0.58);';
        phColor = 'transparent';
      } else {
        // dark (default)
        wrapBg     = 'background:#17171a;';
        inputColor = 'color:#ffffff;';
        inputBgClip = '';
        shadow = '';
        phColor = '#ffffff';
      }

      // Unique ID so multiple search-bars on one page don't collide.
      var inputId = 'searchbar-' + Math.random().toString(36).slice(2, 8);
      var isAI = sbStyle === 'ai-dark' || sbStyle === 'ai-light';

      // Mic icon — 24×24, inherits wrap text color (stroke currentColor)
      var micColor = (sbStyle === 'light') ? '#000000' : '#ffffff';
      var micSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;color:' + micColor + ';"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/></svg>';

      // For AI variants, use a separate span that renders the gradient text
      // AND a transparent real input on top for typing. The span shows the
      // placeholder when empty; hidden when user types.
      if (isAI) {
        return '<div style="width:100%;height:100%;' + wrapBg + shadow +
          'border-radius:30px;padding:17px 20px;box-sizing:border-box;' +
          'display:flex;align-items:center;justify-content:space-between;gap:8px;overflow:hidden;position:relative;">' +
          '<div style="flex:1;min-width:0;position:relative;height:22px;">' +
            // Gradient placeholder (shown when input is empty)
            '<span data-sb-gradient-placeholder style="position:absolute;inset:0;display:flex;align-items:center;' +
              'font-family:var(--font);font-size:16px;font-weight:700;line-height:1;' +
              'background:linear-gradient(to right,#66a1f3,#22c9a6);-webkit-background-clip:text;background-clip:text;color:transparent;' +
              'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;">' + sbPh + '</span>' +
            // Real input (transparent text so user sees gradient placeholder,
            // switches to own text once they type)
            '<input id="' + inputId + '" type="text" ' +
              'oninput="this.previousElementSibling.style.display=this.value?\'none\':\'flex\';" ' +
              'style="width:100%;height:100%;background:transparent;border:none;outline:none;' +
              'font-family:var(--font);font-size:16px;font-weight:700;' +
              'background:linear-gradient(to right,#66a1f3,#22c9a6);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;' +
              'caret-color:#66a1f3;padding:0;margin:0;"/>' +
          '</div>' +
          micSvg +
        '</div>';
      }

      // Solid variants (dark / light)
      return '<div style="width:100%;height:100%;' + wrapBg +
        'border-radius:30px;padding:17px 20px;box-sizing:border-box;' +
        'display:flex;align-items:center;justify-content:space-between;gap:8px;overflow:hidden;">' +
        '<input id="' + inputId + '" type="text" placeholder="' + sbPh + '" ' +
          'style="flex:1;min-width:0;height:22px;background:transparent;border:none;outline:none;' +
          'font-family:var(--font);font-size:16px;font-weight:700;' + inputColor + 'padding:0;margin:0;' +
          '--sb-ph:' + phColor + ';"/>' +
        micSvg +
      '</div>';
    }

    case 'focus-block': {
      // Variant-aware: widget cells, hero cards, 'secondary' editorial
      // cards, weather cards, or default focus
      var fv = (comp && comp.variant) || {};
      var ftitle = fv.title || 'Focus block';
      var fvalue = fv.value || '';
      var fbody  = fv.body || fv.description || '';
      var fsub   = fv.sub   || (fv.kind === 'hero' ? '' : 'Important content goes here');
      var faccent = fv.accent || 'var(--accent-primary,#0381FE)';

      // Calendar variant — dedicated visual treatment so
      // calendar_summary_card doesn't render as a generic banner. Layout:
      // small section header ("Next up · Today") + small calendar glyph
      // beside a prominent time block, then event title large, location
      // with pin icon at the bottom.
      if (fv.kind === 'calendar') {
        var cTime     = fv.time     || '';
        var cTitle    = fv.title    || 'Event';
        var cLocation = fv.location || '';
        var cDuration = fv.duration || '';
        var cSection  = fv.section  || '';
        // Inline calendar glyph
        var calIcon = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" style="display:block;">' +
          '<rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke="#ffffff" strokeWidth="2" fill="none"/>' +
          '<path d="M8 3V7M16 3V7M3.5 10H20.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>' +
          '<rect x="7" y="13" width="10" height="2" rx="1" fill="#ffffff"/>' +
        '</svg>';
        // Build header row (section + duration meta, optional)
        var headerParts = [];
        if (cSection)  headerParts.push('<span>' + cSection + '</span>');
        if (cSection && cDuration) headerParts.push('<span style="opacity:0.5;">·</span>');
        if (cDuration) headerParts.push('<span>' + cDuration + '</span>');
          var headerRow = '<div style="font-family:var(--font);font-size:16px;font-weight:500;color:#ffffff;display:flex;gap:4px;align-items:center;text-transform:uppercase;margin-bottom:7px;line-height:1.3;">' + headerParts.join('') + '</div>';
        // Build time + cal-icon row
        var timeRow = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">' +
          '<div style="width:28px;height:28px;flex-shrink:0;">' + calIcon + '</div>' +
          (cTime ? '<div style="font-family:var(--font);font-size:32px;font-weight:500;line-height:1.3;color:#ffffff;">' + cTime + '</div>' : '') +
        '</div>';
        // Title row
        var titleRow = '<div style="font-family:var(--font);font-size:16px;font-weight:500;color:#8DE7E7;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:7px;">' + cTitle + '</div>';
        // Location row
          var locRow = cLocation
            ? '<div style="font-family:var(--font);font-size:16px;font-weight:400;color:#C4FAFA;line-height:1.3;">' + cLocation + '</div>'
            : '';
        return '<div style="width:100%;min-height:132px;height:auto;box-sizing:border-box;border-radius:28px;' +
          _G('panel') +
          'padding:24px;box-sizing:border-box;' +
          'display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden;position:relative;">' +
          '<div style="position:relative;z-index:1;display:flex;flex-direction:column;justify-content:flex-start;flex-shrink:0;">' +
            headerRow +
            timeRow +
            titleRow +
            locRow +
          '</div>' +
        '</div>';
      }

      // Input-summary variant — for `input_summary_card`. Layout: a small
      // form-input glyph in the corner, section header (uppercase), large
      // topic phrase, and either a single detail line OR a row of facet
      // chips when the value contained separators. Used for search recap,
      // settings change confirmation, address entry summary.
      if (fv.kind === 'input') {
        var iSection = fv.section || 'INPUT';
        var iTopic   = fv.topic   || '';
        var iFacets  = Array.isArray(fv.facets) ? fv.facets : [];
        
        // Render facet chips
        var facetHtml = iFacets.slice(0, 12).map(function (f) {
          return '<span style="padding:8px 16px;background:rgba(236, 238, 247, 0.2);border-radius:999px;' +
            'font-family:var(--font);font-size:14px;font-weight:500;color:#C6FFFF;' +
            'max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + f + '</span>';
        }).join('');

        return '<div style="width:100%;min-height:140px;height:auto;border-radius:28px;' +
          _G('panel') +
          'padding:24px;box-sizing:border-box;' +
          'display:flex;flex-direction:column;justify-content:flex-start;overflow:visible;">' +
          // Subtitle (Description)
            '<div style="font-family:var(--font);font-size:16px;font-weight:500;color:#ffffff;text-transform:uppercase;margin-bottom:7px;line-height:1.3;">' + iSection + '</div>' +
          // Title (Topic)
          (iTopic
            ? '<div style="font-family:var(--font);font-size:24px;font-weight:500;line-height:1.3;color:#ffffff;margin-bottom:18px;">' + iTopic + '</div>'
            : '') +
          // Chips Row
          '<div style="display:flex;flex-wrap:wrap;gap:5px 10px;justify-content:flex-start;align-content:flex-start;overflow:visible;max-width:100%;margin:0;padding:0;">' + 
            facetHtml + 
          '</div>' +
        '</div>';
      }

      // Forecast / metrics sections: uppercase header + stacked or wrapped
      // glass capsules (hourly timeline, 5-day rows, humidity · wind chips).
      if (fv.kind === 'chip_section') {
        var csTitle = fv.title || 'Section';
        var csLines = Array.isArray(fv.lines) ? fv.lines : [];
        var csWrap = !!fv.wrap;
        var escCS = function (t) {
          return String(t)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        };
        var miniSq = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="3" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3"/></svg>';
        var pillStyle = 'width:100%;align-self:stretch;padding:12px 16px;border-radius:999px;background:rgba(255,255,255,0.13);' +
          'border:1px solid rgba(255,255,255,0.16);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);' +
          'font-size:16px;font-weight:500;font-family:var(--font);color:var(--text-primary,#fff);text-align:center;' +
          'max-width:100%;min-width:0;box-sizing:border-box;line-height:1.42;white-space:normal;overflow-wrap:break-word;word-break:normal;';
        var pillsHtml = csLines.map(function (line) {
          return '<div style="' + pillStyle + '">' + escCS(line) + '</div>';
        }).join('');
        var bodyCS = csWrap
          ? '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-content:center;width:100%;">' + pillsHtml + '</div>'
          : '<div style="display:flex;flex-direction:column;align-items:stretch;gap:10px;width:100%;">' + pillsHtml + '</div>';
        return '<div style="width:100%;min-height:112px;height:auto;border-radius:var(--card-radius,' + _R('widget') + ');' +
          _G('panel') +
          'padding:' + _S('xxl') + ' ' + _S('4xl') + ' ' + '22px;box-sizing:border-box;display:flex;flex-direction:column;gap:' + _S('xl') + ';overflow:visible;">' +
          '<div style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;">' +
            '<div style="width:14px;height:14px;flex-shrink:0;opacity:0.88;">' + miniSq + '</div>' +
            '<div style="' + _T('label', { weight: 'medium', color: 'translucentLabel' }) + 'letter-spacing:0.4px;text-transform:uppercase;text-align:center;">' + escCS(csTitle) + '</div>' +
          '</div>' +
          bodyCS +
        '</div>';
      }

      // Reminder variant — checkbox + task title + due time, with an
      // orange accent for the section header. Sample Samsung One UI
      // reminder widget layout.
      if (fv.kind === 'reminder') {
        var rTask    = fv.task    || '9:30 AM';
        var rDue     = fv.due     || 'Team stand-up';
        var rSection = fv.section || 'NEXT UP · TODAY · 30 MIN';
        var rMeta    = fv.meta    || fv.location || '';
        // Hollow checkbox SVG — accent driven by theme var
        var checkBox = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" style="display:block;">' +
          '<rect x="4" y="4" width="16" height="16" rx="4" stroke="var(--card-reminder-accent,#F59E0B)" strokeWidth="1.8" fill="color-mix(in srgb, var(--card-reminder-accent,#F59E0B) 12%, transparent)"/>' +
        '</svg>';
        var calendarIcon = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" style="display:block;">' +
          '<rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>' +
          '<line x1="16" y1="2" x2="16" y2="6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>' +
          '<line x1="8" y1="2" x2="8" y2="6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>' +
          '<line x1="3" y1="10" x2="21" y2="10" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>' +
        '</svg>';
        return '<div style="width:100%;min-height:104px;height:100%;border-radius:28px;' +
          _G('panel') +
          'padding:24px;box-sizing:border-box;' +
          'display:flex;flex-direction:column;justify-content:center;overflow:hidden;">' +
          // Header: section
          '<div style="display:flex;align-items:center;gap:4px;margin-bottom:7px;">' +
            '<div style="font-family:var(--font);font-size:16px;font-weight:500;color:#ffffff;letter-spacing:0.35px;text-transform:uppercase;line-height:1.3;">' + rSection + '</div>' +
          '</div>' +
          // Task title with calendar icon
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;">' +
            '<div style="width:24px;height:24px;flex-shrink:0;">' + calendarIcon + '</div>' +
            '<div style="font-family:var(--font);font-size:32px;font-weight:500;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#ffffff;">' + rTask + '</div>' +
          '</div>' +
          // Due time row
          (rDue
            ? '<div style="font-family:var(--font);font-size:16px;font-weight:500;color:#8DE7E7;line-height:1.3;' + (rMeta ? 'margin-bottom:7px;' : '') + '">' + rDue + '</div>'
            : '') +
          (rMeta
            ? '<div style="font-family:var(--font);font-size:16px;font-weight:400;color:#C4FAFA;line-height:1.3;">' + rMeta + '</div>'
            : '') +
        '</div>';
      }

      // Message summary variant — avatar circle + sender + preview.
      // Green accent for "new messages" section header.
      if (fv.kind === 'message') {
        var mSender  = fv.sender  || '';
        var mPreview = fv.preview || '(no preview)';
        var mSection = fv.section || 'MESSAGES';
        // Avatar — colored circle with first letter of sender (or chat
        // bubble glyph when no sender)
        var avatarLetter = mSender ? mSender.charAt(0).toUpperCase() : '';
        var avatar = avatarLetter
          ? '<div style="width:min(var(--card-message-avatar-size,32px),28px);height:min(var(--card-message-avatar-size,32px),28px);border-radius:50%;background:var(--card-message-avatar-grad,linear-gradient(135deg,#34D399,#10B981));display:flex;align-items:center;justify-content:center;color:var(--text-primary,#fff);font-weight:700;font-size:var(--font-size-sm,16px);flex-shrink:0;">' + avatarLetter + '</div>'
          : '<div style="width:min(var(--card-message-avatar-size,32px),28px);height:min(var(--card-message-avatar-size,32px),28px);border-radius:50%;background:var(--card-message-avatar-grad,linear-gradient(135deg,#34D399,#10B981));display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.5A8 8 0 0 1 21 12z" fill="#fff"/></svg>' +
            '</div>';
        return '<div style="width:100%;min-height:118px;height:auto;border-radius:28px;' +
          _G('panel') +
          'padding:24px;box-sizing:border-box;' +
          'display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden;">' +
          // Header
          '<div style="font-family:var(--font);font-size:16px;font-weight:500;color:#ffffff;letter-spacing:0.35px;text-transform:uppercase;margin-bottom:7px;line-height:1.3;">' + mSection + '</div>' +
          // Body: avatar + (sender + preview)
          '<div style="display:flex;align-items:flex-start;gap:10px;">' +
            avatar +
            '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:9px;">' +
                (mSender
                  ? '<div style="font-family:var(--font);font-size:24px;font-weight:500;color:#ffffff;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:18px;">' + mSender + '</div>'
                  : '') +
              '<div style="font-family:var(--font);font-size:16px;font-weight:500;color:#8DE7E7;line-height:1.3;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">' + mPreview + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }

      // ETA variant — route icon + large duration + destination + traffic.
      // Teal accent for the navigation context.
      if (fv.kind === 'eta') {
        var eEta         = fv.eta         || '—';
        var eDestination = fv.destination || '';
        var eTraffic     = fv.traffic     || '';
        var eRoute       = fv.route       || '';
        // Trafficaccent: green for light, amber for moderate, red for heavy
        var trafficColor = '#10B981';  // light (default)
        if (/heavy|severe/i.test(eTraffic)) trafficColor = '#EF4444';
        else if (/moderate/i.test(eTraffic)) trafficColor = '#F59E0B';
        var carIcon = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" style="display:block;">' +
          '<path d="M5 17h14M7 17l1.5-5h7L17 17M6 17v2M18 17v2" stroke="var(--card-eta-accent,#14B8A6)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>' +
          '<circle cx="9" cy="14" r="0.8" fill="var(--card-eta-accent,#14B8A6)"/>' +
          '<circle cx="15" cy="14" r="0.8" fill="var(--card-eta-accent,#14B8A6)"/>' +
        '</svg>';
        var pinIcon = '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" style="display:block;">' +
          '<path d="M12 22s7-7.58 7-13a7 7 0 0 0-14 0c0 5.42 7 13 7 13z" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none"/>' +
          '<circle cx="12" cy="9" r="2.2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>' +
        '</svg>';
        return '<div style="width:100%;min-height:104px;height:100%;border-radius:28px;' +
          _G('panel') +
          'padding:24px;box-sizing:border-box;' +
          'display:flex;flex-direction:column;justify-content:center;overflow:hidden;">' +
          // Top: car icon + huge ETA
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">' +
            '<div style="width:28px;height:28px;flex-shrink:0;">' + carIcon + '</div>' +
            '<div style="font-family:var(--font);font-size:32px;font-weight:500;line-height:1.3;color:#ffffff;letter-spacing:-0.7px;">' + eEta + '</div>' +
          '</div>' +
          // Mid: destination
          (eDestination
            ? '<div style="display:flex;align-items:center;gap:4px;margin-bottom:7px;">' +
                '<div style="width:14px;height:14px;flex-shrink:0;opacity:0.7;">' + pinIcon + '</div>' +
                '<div style="font-family:var(--font);font-size:16px;font-weight:500;color:#ffffff;line-height:1.3;">' + eDestination + '</div>' +
              '</div>'
            : '') +
          // Bottom: route info (traffic status removed, "via" stripped per user request)
          ((eRoute || eTraffic)
            ? '<div style="font-family:var(--font);font-size:16px;font-weight:500;color:#8DE7E7;line-height:1.3;">' + (eRoute ? eRoute.replace(/^via\s+/i, '') : eTraffic) + '</div>'
            : '') +
        '</div>';
      }

      // Tier 2.1 — Condition-aware background gradient for weather cards.
      // Replaces the flat glass surface with a dynamic sky-like color
      // that responds to the weather condition. Real Samsung weather
      // widgets use full-card imagery; this is a CSS-only equivalent
      // (no network calls, no images to load) that captures ~60% of
      // the visual richness for ~5% of the cost.
      function _weatherBgGradient(icon) {
        var I = (icon || '').toLowerCase();
        // Strong, visible gradients — these are the weather card's
        // identity. Previously too subtle (0.18-0.32 alpha); bumped
        // to 0.45-0.65 so the sun/cloud/rain identity reads at a
        // glance. Final stop blends to dark surface so text contrast
        // stays readable.
        switch (I) {
          case 'sun':
          case 'clear':
            return 'linear-gradient(155deg, rgba(251,191,36,0.62) 0%, rgba(249,115,22,0.40) 55%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          case 'cloud-sun':
          case 'partly-cloudy':
            return 'linear-gradient(155deg, rgba(251,191,36,0.48) 0%, rgba(180,180,195,0.30) 50%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          case 'cloud':
          case 'overcast':
            return 'linear-gradient(155deg, rgba(180,180,195,0.42) 0%, rgba(120,125,140,0.28) 60%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          case 'rain':
          case 'showers':
          case 'drizzle':
            return 'linear-gradient(155deg, rgba(96,165,250,0.55) 0%, rgba(51,65,85,0.35) 55%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          case 'snow':
          case 'sleet':
            return 'linear-gradient(155deg, rgba(226,232,240,0.55) 0%, rgba(148,163,184,0.32) 60%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          case 'bolt':
          case 'storm':
          case 'thunderstorm':
            return 'linear-gradient(155deg, rgba(251,191,36,0.40) 0%, rgba(71,85,105,0.55) 45%, color-mix(in srgb, var(--page-bg,#171717) 78%, transparent) 100%)';
          case 'fog':
          case 'mist':
          case 'haze':
            return 'linear-gradient(155deg, rgba(180,180,195,0.36) 0%, rgba(120,125,140,0.26) 50%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          case 'wind':
          case 'windy':
            return 'linear-gradient(155deg, rgba(165,180,252,0.45) 0%, rgba(120,125,140,0.28) 60%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          default:
            return '';
        }
      }

      /** Grayscale-only sky fills when `--oneui-chroma: mono` is active. */
      function _weatherBgGradientMono(icon) {
        var I = (icon || '').toLowerCase();
        switch (I) {
          case 'sun':
          case 'clear':
            return 'linear-gradient(155deg, rgba(205,205,210,0.40) 0%, rgba(125,125,130,0.30) 55%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          case 'cloud-sun':
          case 'partly-cloudy':
            return 'linear-gradient(155deg, rgba(185,185,190,0.36) 0%, rgba(110,110,115,0.28) 50%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          case 'cloud':
          case 'overcast':
            return 'linear-gradient(155deg, rgba(155,155,160,0.38) 0%, rgba(85,85,90,0.26) 60%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          case 'rain':
          case 'showers':
          case 'drizzle':
            return 'linear-gradient(155deg, rgba(145,148,155,0.40) 0%, rgba(65,68,74,0.32) 55%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          case 'snow':
          case 'sleet':
            return 'linear-gradient(155deg, rgba(210,210,215,0.42) 0%, rgba(130,132,138,0.30) 60%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          case 'bolt':
          case 'storm':
          case 'thunderstorm':
            return 'linear-gradient(155deg, rgba(175,175,180,0.36) 0%, rgba(70,72,78,0.34) 45%, color-mix(in srgb, var(--page-bg,#171717) 78%, transparent) 100%)';
          case 'fog':
          case 'mist':
          case 'haze':
            return 'linear-gradient(155deg, rgba(150,150,155,0.34) 0%, rgba(88,90,95,0.26) 50%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          case 'wind':
          case 'windy':
            return 'linear-gradient(155deg, rgba(165,165,172,0.36) 0%, rgba(95,98,105,0.28) 60%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
          default:
            return 'linear-gradient(155deg, rgba(170,170,176,0.36) 0%, rgba(95,95,100,0.28) 55%, color-mix(in srgb, var(--page-bg,#171717) 72%, transparent) 100%)';
        }
      }

      // Weather variant — dedicated visual treatment so weather_glance_card
      // doesn't render as a generic title+sub box. Layout: condition icon
      // beside a large temp number, condition phrase below, location +
      // feels-like meta at the bottom. THEME-DRIVEN: every visual property
      // pulls from a CSS variable (e.g. --card-weather-temp-size) so the
      // /customize dropdown can swap the entire visual identity at runtime
      // without touching this code.
      if (fv.kind === 'weather') {
        var wTemp      = fv.temp      || '—';
        var wCondition = fv.condition || '';
        var wLocation  = fv.location  || '';
        var wFeels     = fv.feels     || '';
        var wIcon      = _weatherIconSvg(fv.icon || 'sun');
        var themeSurface = _themeSurfaceStyleRoot();
        var wDate = fv.date || 'Tue, Apr 14';
        var wTime = fv.time || '3:16';
        var wWind = fv.wind || 'Wind 5 mph';
        var wBgStyle;
        if (_isMonoChromaRoot()) {
          wBgStyle = 'background:linear-gradient(180deg,rgba(111,111,117,0.86) 0%,rgba(155,155,160,0.78) 100%), color-mix(in srgb, var(--page-bg,#171717) 26%, transparent);-webkit-backdrop-filter:blur(18px) saturate(1.12);backdrop-filter:blur(18px) saturate(1.12);border:1px solid rgba(255,255,255,0.18);box-shadow:inset 0 1px 0 rgba(255,255,255,0.22), var(--surface-shadow, none);';
        } else if (themeSurface === 'flat' || themeSurface === 'neon') {
          wBgStyle = 'background:var(--surface-bg, rgba(23,23,26,0.80));-webkit-backdrop-filter:var(--surface-filter, blur(24px));backdrop-filter:var(--surface-filter, blur(24px));border:var(--surface-border, 1px solid rgba(255,255,255,0.06));box-shadow:var(--surface-shadow, none);';
        } else if (themeSurface === 'base') {
          wBgStyle = 'background:linear-gradient(180deg,rgba(63,136,221,0.86) 0%,rgba(112,177,230,0.78) 100%), color-mix(in srgb, var(--page-bg,#171717) 28%, transparent);-webkit-backdrop-filter:blur(18px) saturate(1.16);backdrop-filter:blur(18px) saturate(1.16);border:1px solid rgba(255,255,255,0.20);box-shadow:inset 0 1px 0 rgba(255,255,255,0.24), 0 18px 42px rgba(30,93,160,0.28);';
        } else {
          wBgStyle = _G('panel');
        }
        var wGlassSheen = (themeSurface === 'flat' || themeSurface === 'neon') ? '' : '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.18),transparent 42%,rgba(0,0,0,0.08));pointer-events:none;"></div>';
        var wInsetBorder = 'inset 0 0 0 1px ' + (themeSurface === 'neon' ? 'rgba(5,8,5,0.10)' : 'rgba(255,255,255,0.08)');
        var wIconBox = 'width:32px;height:32px;flex-shrink:0;';
        return '<div style="width:100%;min-height:0;height:auto;align-self:stretch;flex:0 1 auto;border-radius:28px;' +
          wBgStyle +
          'padding:24px;box-sizing:border-box;color:#ffffff;' +
          'display:flex;flex-direction:column;overflow:visible;position:relative;font-family:var(--font);">' +
          wGlassSheen +
          '<div style="position:absolute;inset:1px;border-radius:27px;box-shadow:' + wInsetBorder + ';pointer-events:none;"></div>' +
          '<div style="position:relative;z-index:1;display:flex;flex-direction:row;justify-content:space-between;align-items:flex-start;gap:12px;min-width:0;margin-bottom:18px;">' +
            '<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;">' +
              '<div style="font-size:24px;font-weight:500;line-height:1.3;color:#ffffff;max-width:100%;white-space:nowrap;word-break:normal;overflow-wrap:normal;margin-bottom:18px;">' + wTemp + '</div>' +
              (wLocation ? '<div style="font-size:14px;font-weight:500;line-height:1.3;color:#C6FFFF;background:rgba(236,238,247,0.2);padding:4px 8px;border-radius:12px;display:inline-flex;align-items:center;gap:4px;min-width:0;max-width:100%;word-break:normal;overflow-wrap:break-word;margin-bottom:4px;"><span style="font-size:14px;flex-shrink:0;">📍</span><span style="min-width:0;">' + wLocation + '</span></div>' : '') +
            '</div>' +
            '<div style="position:relative;z-index:1;' + wIconBox + 'filter:drop-shadow(0 3px 4px rgba(0,0,0,0.18));">' +
              '<div style="width:100%;height:100%;">' + wIcon + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="position:relative;z-index:1;display:flex;flex-direction:row;justify-content:space-between;align-items:flex-end;gap:12px;min-width:0;margin:0;padding-top:18px;border-top:1px solid rgba(255,255,255,0.14);">' +
            '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:7px;">' +
              (wCondition ? '<div style="font-size:16px;font-weight:500;line-height:1.3;color:#8DE7E7;max-width:100%;word-break:normal;overflow-wrap:break-word;">' + wCondition + '</div>' : '') +
              '<div style="font-size:16px;font-weight:500;line-height:1.3;color:#C4FAFA;max-width:100%;word-break:normal;overflow-wrap:break-word;">' + (wFeels ? 'Feels ' + wFeels : wWind) + '</div>' +
            '</div>' +
            '<div style="flex-shrink:0;max-width:48%;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:7px;min-width:0;">' +
              '<div style="font-size:16px;font-weight:500;line-height:1.3;color:#ffffff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">' + wDate + '</div>' +
              '<div style="font-size:32px;font-weight:500;line-height:1.3;color:#ffffff;white-space:nowrap;word-break:normal;">' + wTime + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }

      if (fv.kind === 'hero') {
        return '<div style="width:100%;height:100%;border-radius:' + _R('widget') + ';' +
          _G('panel') +
          'display:flex;align-items:center;justify-content:center;box-sizing:border-box;overflow:hidden;">' +
          '<div style="width:60px;height:60px;border-radius:50%;background:' + faccent + ';opacity:0.6;"></div>' +
        '</div>';
      }
      // 'secondary' editorial card: title + body paragraph, no dot.
      // Used for Detail-screen focus-block stacks where every card should
      // read as a short article block (title + 1-2 line copy).
      if (fv.kind === 'secondary') {
        return '<div style="width:100%;min-height:0;height:auto;border-radius:' + _R('widget') + ';' +
          _G('panel') +
          'padding:20px 22px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-start;gap:10px;overflow:visible;">' +
          '<div style="' + _T('large', { weight: 'bold' }) + 'line-height:1.25;max-width:100%;word-wrap:break-word;">' + ftitle + '</div>' +
          (fbody ? '<div style="' + _T('label', { color: 'translucentLabel' }) +
            'font-size:16px;line-height:1.45;max-width:100%;word-wrap:break-word;overflow-wrap:anywhere;overflow:visible;">' + fbody + '</div>' : '') +
        '</div>';
      }
      // Widget-style cell (focus-block-group expansion)
      if (fv.kind) {
        return '<div style="width:100%;min-height:0;height:auto;border-radius:' + _R('widget') + ';' +
          _G('panel') +
          'padding:' + _S('lg') + ';box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-start;gap:' + _S('sm') + ';overflow:visible;">' +
          '<div style="display:flex;justify-content:center;align-items:center;gap:8px;width:100%;flex-wrap:wrap;">' +
            '<div style="' + _T('label', { color: 'translucentLabel' }) + 'min-width:0;flex:0 1 auto;max-width:100%;word-wrap:break-word;overflow-wrap:anywhere;line-height:1.3;text-align:center;">' + ftitle + '</div>' +
            '<div style="width:8px;height:8px;border-radius:50%;background:' + faccent + ';flex-shrink:0;"></div>' +
          '</div>' +
          (fvalue ? '<div style="' + _T('large', { weight: 'bold' }) + 'line-height:1.2;max-width:100%;word-wrap:break-word;overflow-wrap:anywhere;text-align:center;">' + fvalue + '</div>' : '') +
          (fsub ? '<div style="' + _T('label', { color: 'sectionLabel' }) + 'max-width:100%;word-wrap:break-word;line-height:1.35;text-align:center;">' + fsub + '</div>' : '') +
        '</div>';
      }
      // Default focus-block
      return '<div style="width:100%;min-height:0;height:auto;border-radius:' + _R('widget') + ';' +
        _G('panel') +
        'padding:' + _S('3xl') + ';box-sizing:border-box;overflow:visible;">' +
        '<div style="' + _T('large', { weight: 'bold' }) + 'max-width:100%;word-wrap:break-word;">' + ftitle + '</div>' +
        (fsub ? '<div style="' + _T('label', { color: 'translucentLabel' }) + 'margin-top:' + _S('sm') + ';max-width:100%;word-wrap:break-word;line-height:1.35;">' + fsub + '</div>' : '') +
      '</div>';
    }

    case 'list-item': {
      // Mirrors the `notif-card` atomic (Figma Notification/Regular 544:1088)
      // with two theme variants:
      //   theme='light' (default) → bg #ffffff, text #000 — List screen
      //   theme='dark'            → bg rgba(23,23,26,0.6), text #efeef2 —
      //     used in Detail screen where the group sits in a glass shell
      //
      // Shared layout: rounded 50 pill, 56 icon, title+time row, subtitle
      // below, trailing chevron or badge pill.
      var lv = (comp && comp.variant) || {};
      var liTheme  = lv.theme === 'dark' ? 'dark' : 'light';
      var title    = lv.title    || 'Item';
      var subtitle = lv.subtitle || '';
      var time     = lv.time     || '';
      var avatar   = lv.avatar   || null;
      var glyph    = lv.glyph    || title.charAt(0).toUpperCase();
      var accent   = lv.accent   || '#4285F4';
      var badge    = lv.badge;

      var liBg, liTitleColor, liTimeColor, liSubColor, liChevColor;
      if (liTheme === 'dark') {
        liBg         = 'rgba(23,23,26,0.6)';
        liTitleColor = '#efeef2';
        liTimeColor  = '#d5d5d5';
        liSubColor   = '#cfcccf';
        liChevColor  = '#ffffff';
      } else {
        liBg         = '#ffffff';
        liTitleColor = '#000000';
        liTimeColor  = '#555555';
        liSubColor   = '#333333';
        liChevColor  = '#222222';
      }

      var iconHTML = avatar
        ? '<img src="app-icons/' + avatar + '" style="width:56px;height:56px;border-radius:50%;object-fit:cover;flex-shrink:0;"/>'
        : '<div style="width:56px;height:56px;border-radius:50%;background:' + accent +
            ';display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
            'color:#fff;font-size:22px;font-weight:700;line-height:1;">' + glyph + '</div>';

      var trailingHTML = (badge != null && badge > 0)
        ? '<div style="min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#FF3B30;' +
            'display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;' +
            'font-size:var(--font-size-xs,14px);font-weight:700;font-family:Inter,system-ui,sans-serif;">' + badge + '</div>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;opacity:0.8;"><path d="M6 9l6 6 6-6" stroke="' + liChevColor + '" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>';

      return '<div style="width:100%;height:100%;background:' + liBg + ';border-radius:var(--card-radius,' + _R('widget') + ');' +
        'padding:15px 20px 15px 16px;box-sizing:border-box;' +
        'display:flex;align-items:center;gap:10px;overflow:hidden;font-family:var(--font);">' +
        iconHTML +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden;">' +
          '<div style="display:flex;align-items:baseline;gap:8px;white-space:nowrap;overflow:hidden;">' +
            '<span style="font-size:var(--font-size-md,18px);font-weight:700;color:' + liTitleColor + ';overflow:hidden;text-overflow:ellipsis;">' + title + '</span>' +
            (time ? '<span style="font-size:var(--font-size-sm,16px);font-weight:500;color:' + liTimeColor + ';flex-shrink:0;">' + time + '</span>' : '') +
          '</div>' +
          (subtitle
            ? '<div style="font-size:var(--font-size-sm,16px);font-weight:500;color:' + liSubColor + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">' + subtitle + '</div>'
            : '') +
        '</div>' +
        trailingHTML +
      '</div>';
    }

    case 'paragraph': {
      var pv = (comp && comp.variant) || {};
      var ptxt = pv.text || '';
      if (pv.kind === 'title') {
        return '<div style="width:100%;height:100%;display:flex;align-items:center;">' +
          '<div style="' + _T('headline', { weight: 'bold' }) + 'line-height:1.2;">' + ptxt + '</div>' +
        '</div>';
      }
      return '<div style="width:100%;height:100%;display:flex;align-items:flex-start;">' +
        '<div style="' + _T('body', { color: 'translucentLabel' }) + 'line-height:1.5;">' + ptxt + '</div>' +
      '</div>';
    }

    case 'action-row': {
      // Reads an action list: variant.actions / content.actions, or legacy
      // variant.primary | variant.secondary (when not placeholders).
      // Optional previewGallery:true → toolkit-only stacked "Studio" demo.
      var av = (comp && comp.variant) || {};
      var ac = (comp && comp.content) || {};
      var actions = Array.isArray(av.actions) ? av.actions
                  : Array.isArray(ac.actions) ? ac.actions
                  : null;
      if (!actions) {
        // Legacy 2-button form — only honor when actual strings supplied,
        // never the "Primary"/"Secondary" placeholders.
        var hasLegacy = (av.primary && av.primary !== 'Primary') ||
                        (av.secondary && av.secondary !== 'Secondary');
        if (hasLegacy) {
          actions = [];
          if (av.primary)   actions.push({ label: av.primary,   kind: 'primary'   });
          if (av.secondary) actions.push({ label: av.secondary, kind: 'secondary' });
        }
      }

      var previewGallery = av.previewGallery === true || ac.previewGallery === true;

      if (previewGallery) {
        var actionRowSkinG = _themeSurfaceStyleRoot();
        var actionRowNeonG = actionRowSkinG === 'neon';
        // Nested circles/pills must follow theme tokens — not a fixed dark gray.
        // Neon: high-contrast white chips on green surface; other styles: --qs-tile-bg + text tokens.
        var gChipBg = actionRowNeonG
          ? 'var(--qs-chip-off-bg, #ffffff)'
          : 'var(--qs-tile-bg, rgba(23,23,26,0.80))';
        var gChipFg = actionRowNeonG
          ? 'var(--qs-chip-icon-off, var(--text-primary, #050805))'
          : 'var(--text-primary, #efeef2)';
        var gLabelFg = actionRowNeonG
          ? 'var(--text-primary, #050805)'
          : 'var(--text-secondary, rgba(239,238,242,0.7))';
        var gChipBorder = 'var(--surface-border, 1px solid rgba(255,255,255,0.12))';
        var gInsetSquareBg = actionRowNeonG
          ? 'color-mix(in srgb, var(--text-primary,#050805) 10%, transparent)'
          : 'color-mix(in srgb, var(--text-primary,#fff) 18%, transparent)';
        var ACTION_ICONS_G = {
          trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>',
          settings: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>'
        };
        var PANEL_ICONS_G = {
          video: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="5" y="4" width="14" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M10 8l5 4-5 4V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>',
          heart: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>',
          clock: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>',
          pin: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 21s-6-6.2-6-11a6 6 0 1 1 12 0c0 4.8-6 11-6 11z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8"/></svg>',
          users: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8"/><circle cx="16" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M13.5 16c1.9.2 3.4 1.2 4 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>',
          clean: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="5" y="9" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M9 9V6a3 3 0 0 1 6 0v3M8 14h8M10 12v4M14 12v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>',
          trash: ACTION_ICONS_G.trash,
          settings: ACTION_ICONS_G.settings,
          chevron: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>'
        };
          function shortcutG(icon, label) {
            return '<div style="display:flex;flex-direction:column;align-items:center;gap:9px;min-width:0;color:' + gLabelFg + ';">' +
              '<div style="width:54px;height:54px;max-width:100%;aspect-ratio:1;border-radius:50%;background:' + gChipBg + ';border:' + gChipBorder + ';display:flex;align-items:center;justify-content:center;color:' + gChipFg + ';">' + PANEL_ICONS_G[icon] + '</div>' +
              '<div style="font-family:var(--font);font-size:14px;font-weight:500;line-height:1.3;text-align:center;width:100%;max-width:100%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;white-space:normal;color:#C6FFFF;">' + label + '</div>' +
            '</div>';
          }
          function panelPillG(icon, label, dot) {
            var pillPadDot = dot ? 'padding-right:22px;' : '';
            return '<div style="min-height:64px;border-radius:53px;background:rgba(236,238,247,0.2);border:' + gChipBorder + ';display:flex;align-items:center;justify-content:center;color:#ffffff;font-family:var(--font);font-size:14px;font-weight:500;line-height:1.3;position:relative;padding:12px 24px 12px 16px;box-sizing:border-box;' + pillPadDot + '">' +
              '<span style="display:inline-flex;align-items:center;justify-content:center;gap:10px;max-width:100%;">' +
                '<span style="width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;flex:none;">' + PANEL_ICONS_G[icon] + '</span>' +
                '<span style="min-width:0;max-width:100%;text-align:center;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;white-space:normal;color:#C6FFFF;">' + label + '</span>' +
              '</span>' +
              (dot ? '<span style="position:absolute;right:16px;top:16px;width:6px;height:6px;border-radius:50%;background:#E65B17;"></span>' : '') +
            '</div>';
          }
        var studioBarBg = gChipBg;
        var studioBarFg = '#ffffff';
        var studioBarChev = '#ffffff';
        var studioBarBorder = gChipBorder;
        var studioTileBg = gInsetSquareBg;
        return '<div style="width:100%;max-width:100%;min-width:0;height:auto;box-sizing:border-box;display:flex;flex-direction:column;align-items:stretch;' +
          'padding:24px;gap:18px;background:var(--surface-bg, rgba(23,23,26,0.80));' +
          '-webkit-backdrop-filter:var(--surface-filter, blur(24px));backdrop-filter:var(--surface-filter, blur(24px));border-radius:28px;' +
          'color:var(--text-primary,#fff);font-family:var(--font);overflow:visible;align-self:stretch;">' +
          '<div style="width:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;">' +
            shortcutG('video', 'Videos') + shortcutG('heart', 'Favorites') + shortcutG('clock', 'Recent') + shortcutG('pin', 'Locations') +
          '</div>' +
          '<div style="width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;">' +
            panelPillG('users', 'Shared albums') + panelPillG('clean', 'Clean out', true) +
            panelPillG('trash', 'Trash') + panelPillG('settings', 'Settings') +
          '</div>' +
          '<div style="width:100%;min-height:64px;border-radius:53px;background:' + studioBarBg + ';border:' + studioBarBorder + ';display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;column-gap:14px;padding:12px 24px 12px 16px;box-sizing:border-box;color:' + studioBarFg + ';font-size:20px;font-weight:500;font-family:var(--font);line-height:1.3;">' +
            '<span aria-hidden="true"></span>' +
            '<span style="display:inline-flex;align-items:center;gap:16px;justify-content:center;min-width:0;">' +
              '<span style="width:24px;height:24px;border-radius:50%;background:' + studioTileBg + ';flex:none;"></span>' +
              '<span style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;">Go to Studio</span>' +
            '</span>' +
            '<span style="display:flex;justify-self:end;color:' + studioBarChev + ';flex-shrink:0;">' + PANEL_ICONS_G.chevron + '</span>' +
          '</div>' +
        '</div>';
      }

      if (!actions || !actions.length) {
        return '<div style="width:100%;height:100%;"></div>';
      }
      // Render each action as a pill chip. The FIRST action gets the
      // filled (primary-accent) style; subsequent ones use glass. If an
      // explicit act.kind === 'override', that chip uses muted outline style.
      var ACTION_ICONS = {
        bookmark:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 4v17l6-4 6 4V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>',
        share:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8"/><circle cx="18" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.8"/><circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4" stroke="currentColor" strokeWidth="1.8"/></svg>',
        edit:        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M16 3l5 5-12 12H4v-5L16 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>',
        trash:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>',
        copy:        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="8" y="4" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>',
        download:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 4v12M6 12l6 6 6-6M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>',
        heart:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 21l-9-9a5 5 0 0 1 7-7l2 2 2-2a5 5 0 0 1 7 7l-9 9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>',
        comment:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12a8 8 0 0 1-12 7L3 21l1.5-5A8 8 0 1 1 21 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>',
        play:        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z"/></svg>',
        pause:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5" width="3.5" height="14"/><rect x="13.5" y="5" width="3.5" height="14"/></svg>',
        'skip-forward':'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5l9 7-9 7V5z"/><rect x="16" y="5" width="2.5" height="14"/></svg>',
        'skip-back': '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 5L10 12l9 7V5z"/><rect x="5.5" y="5" width="2.5" height="14"/></svg>',
        repeat:      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 3h4v4M7 21H3v-4M3 11a9 9 0 0 1 15.2-6.7M21 13a9 9 0 0 1-15.2 6.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>',
        plus:        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>',
        x:           '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>',
        check:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>',
        settings:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>',
        search:      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>',
        clock:       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8"/><path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>',
        pin:         '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 21s-6-6.2-6-11a6 6 0 1 1 12 0c0 4.8-6 11-6 11z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8"/></svg>'
      };
      function _renderActionIcon(name) {
        return name && ACTION_ICONS[name]
          ? '<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex-shrink:0;">' + ACTION_ICONS[name] + '</span>'
          : '';
      }
      function _escAttr(s) {
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;');
      }
      function _actionLeadingGlyph(icon) {
        if (icon == null) return '';
        var s = String(icon).trim();
        if (!s) return '';
        if (/^https?:\/\//i.test(s) || /^(app-icons|assets)\//i.test(s) || /^\/(?!\/)/.test(s)) {
          return '<img src="' + _escAttr(s) + '" alt="" style="width:18px;height:18px;object-fit:contain;border-radius:4px;flex-shrink:0;"/>';
        }
        return _renderActionIcon(s);
      }
      var chips = '';
      for (var ai = 0; ai < actions.length; ai++) {
        var act = actions[ai] || {};
        var lbl = String(act.label || act.text || '').trim();
        if (!lbl) continue;
        var ic = act.icon != null ? act.icon : null;
        var lead = _actionLeadingGlyph(ic);
        var kind = act.kind;
        var isPrimary = kind === 'primary' || (!kind && ai === 0 && !/(^|\b)(cancel|dismiss|close|delete|remove)(\b|$)/i.test(lbl));
        var isMuted = kind === 'override';
        var shell;
        if (isMuted) {
          shell = 'background:transparent;color:var(--text-secondary,rgba(255,255,255,0.55));border:1px solid rgba(255,255,255,0.14);';
        } else if (isPrimary) {
          shell = 'background:var(--accent-primary,#0381FE);color:#fff;border:1px solid transparent;box-shadow:0 2px 10px rgba(3,129,254,0.35);';
        } else {
          shell = 'background:rgba(255,255,255,0.09);color:var(--text-primary,#fff);border:1px solid rgba(255,255,255,0.16);';
        }
        chips +=
          '<div data-shortcut="1" role="button" tabindex="0" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;' +
            'padding:12px 16px;border-radius:999px;font-family:var(--font);font-size:15px;font-weight:700;line-height:1.1;' +
            shell + 'flex:0 1 auto;min-width:0;max-width:100%;cursor:default;">' +
            lead +
            '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">' + lbl + '</span>' +
          '</div>';
      }
      if (!chips) {
        return '<div style="width:100%;height:100%;"></div>';
      }
      return '<div style="width:100%;max-width:100%;min-width:0;height:100%;box-sizing:border-box;display:flex;flex-direction:row;flex-wrap:wrap;' +
        'align-items:center;justify-content:center;gap:10px;padding:4px 2px;">' +
        chips +
      '</div>';
    }

    case 'focus-block-group':
      return '<div style="width:100%;height:100%;display:grid;grid-template-columns:1fr 1fr;gap:' + _S('lg') + ';">' +
        '<div style="border-radius:' + _R('widget') + ';' + _G('widgetPill') + '"></div>' +
        '<div style="border-radius:' + _R('widget') + ';' + _G('widgetPill') + '"></div>' +
        '<div style="border-radius:' + _R('widget') + ';' + _G('widgetPill') + '"></div>' +
        '<div style="border-radius:' + _R('widget') + ';' + _G('widgetPill') + '"></div>' +
      '</div>';

    case 'list':
    case 'notification-list':
      // Plain list — 6 simple system-surface rows (used when the list
      // isn't expanded into individual list-item children).
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:' + _S('base') + ';">' +
        Array.from({ length: 6 }).map(() =>
          '<div style="height:56px;border-radius:' + _R('widget') + ';background:#F1F1F3;box-shadow:0 1px 2px rgba(0,0,0,0.08);"></div>'
        ).join('') +
      '</div>';

    case 'detail-content': {
      // Detail screen — "related items" rows use the DARK notif-card
      // variant at rgba(23,23,26,0.6) (30% opacity) and the outer shell
      // also uses rgba(23,23,26,0.6) so the whole section reads as one
      // cohesive dark glass group over the wallpaper/app background.
      var presetItems = [
        { title: 'Lisa Park',    sub: 'Shared a photo · 2 new',  time: '10:32 AM', glyph: 'L', accent: '#E91E63', theme: 'dark' },
        { title: 'Team standup', sub: 'Starts in 15 min · Zoom', time: '9:45 AM',  glyph: 'T', accent: '#4285F4', theme: 'dark' },
        { title: 'Gmail',        sub: 'Re: Q2 planning draft',   time: '8:14 AM',  glyph: 'M', accent: '#EA4335', theme: 'dark' },
        { title: 'Bank',         sub: '\u2212$48.20 at Starbucks', time: '7:02 AM', glyph: '$', accent: '#00A86B', theme: 'dark' }
      ];
      var cardsHTML = presetItems.map(function (it) {
        return '<div style="height:86px;">' +
          window.renderAtomicForRole(
            { role: 'list-item', variant: it },
            { w: 0, h: 86 }
          ) +
        '</div>';
      }).join('');
      return '<div style="width:100%;height:100%;' +
        'background:rgba(23,23,26,0.6);' +
        '-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);' +
        'border:1px solid rgba(255,255,255,0.08);border-radius:' + _R('widget') + ';' +
        'padding:10px;box-sizing:border-box;overflow:hidden;' +
        'display:flex;flex-direction:column;gap:6px;">' +
        cardsHTML +
      '</div>';
    }

    case 'bottom-navigation': {
      var bnc = (comp && comp.content) || {};
      var tabs = Array.isArray(bnc.tabs) ? bnc.tabs : ['Home','Explore','Saved','Profile'];
      var activeIdx = bnc.activeIndex != null ? bnc.activeIndex : 0;

      // Returns a SVG path pair: { outline, filled } for active/inactive state.
      // Samsung One UI bottom-nav: filled variant on active, outline on rest.
      function navIconFor(name, active) {
        var lc = (name || '').toLowerCase();
        var c = 'currentColor';
        var sw = active ? '0' : '1.7';
        var fill = active ? c : 'none';
        var s = 'width="22" height="22" viewBox="0 0 24 24"';

        if (/home|main|for.you/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><path d="M3 11L12 3l9 8v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1v-9z" stroke="' + c + '" strokeWidth="' + sw + '" strokeLinejoin="round"/></svg>';
        }
        if (/search|explore|discover|browse|find/.test(lc)) {
          return '<svg ' + s + ' fill="none"><circle cx="11" cy="11" r="7" stroke="' + c + '" strokeWidth="' + (active ? '2.2' : '1.7') + '" fill="' + (active ? c : 'none') + '" fillOpacity="' + (active ? '0.18' : '0') + '"/><path d="M20 20l-3.5-3.5" stroke="' + c + '" strokeWidth="' + (active ? '2.4' : '1.7') + '" strokeLinecap="round"/></svg>';
        }
        if (/save|bookmark|wishlist|favorite|favour|like|heart/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" stroke="' + c + '" strokeWidth="' + sw + '" strokeLinejoin="round"/></svg>';
        }
        if (/profile|account|me|user/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><circle cx="12" cy="8" r="3.5" stroke="' + c + '" strokeWidth="' + sw + '"/><path d="M5 20a7 7 0 0 1 14 0" stroke="' + c + '" strokeWidth="' + sw + '" strokeLinecap="round" fill="' + fill + '"/></svg>';
        }
        if (/message|chat|inbox|mail/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><path d="M4 6h16v10H8l-4 4V6z" stroke="' + c + '" strokeWidth="' + sw + '" strokeLinejoin="round"/></svg>';
        }
        if (/cart|shop|buy/.test(lc)) {
          return '<svg ' + s + ' fill="none"><path d="M4 5h2l2 12h11l2-8H7" stroke="' + c + '" strokeWidth="' + (active ? '2.2' : '1.7') + '" strokeLinejoin="round" fill="' + (active ? c : 'none') + '" fillOpacity="' + (active ? '0.18' : '0') + '"/><circle cx="10" cy="20" r="1.6" fill="' + c + '"/><circle cx="17" cy="20" r="1.6" fill="' + c + '"/></svg>';
        }
        if (/album|gallery|photo|media|library/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><rect x="4" y="5" width="16" height="14" rx="2" stroke="' + c + '" strokeWidth="' + sw + '"/><circle cx="9" cy="10" r="1.5" stroke="' + c + '" fill="' + (active ? '#fff' : 'none') + '" strokeWidth="' + sw + '"/><path d="M4 16l5-5 4 4 3-3 4 4" stroke="' + c + '" strokeWidth="' + sw + '" strokeLinejoin="round" fill="none"/></svg>';
        }
        if (/play|music|listen/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><path d="M8 5l12 7-12 7V5z" stroke="' + c + '" strokeWidth="' + sw + '" strokeLinejoin="round"/></svg>';
        }
        if (/notif|alert|bell/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5L6 16z" stroke="' + c + '" strokeWidth="' + sw + '" strokeLinejoin="round"/><path d="M10 20a2 2 0 0 0 4 0" stroke="' + c + '" strokeWidth="1.7" strokeLinecap="round" fill="none"/></svg>';
        }
        if (/settings|gear|pref/.test(lc)) {
          return '<svg ' + s + ' fill="' + fill + '"><circle cx="12" cy="12" r="3" stroke="' + c + '" strokeWidth="' + sw + '"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="' + c + '" strokeWidth="1.7" strokeLinecap="round"/></svg>';
        }
        if (/add|plus|create|new/.test(lc)) {
          return '<svg ' + s + ' fill="none"><circle cx="12" cy="12" r="9" stroke="' + c + '" strokeWidth="' + (active ? '2.2' : '1.7') + '" fill="' + (active ? c : 'none') + '" fillOpacity="' + (active ? '0.18' : '0') + '"/><path d="M12 8v8M8 12h8" stroke="' + c + '" strokeWidth="' + (active ? '2.2' : '1.7') + '" strokeLinecap="round"/></svg>';
        }
        // Fallback — solid dot when active, ring when inactive
        return '<svg ' + s + ' fill="' + fill + '"><circle cx="12" cy="12" r="5" stroke="' + c + '" strokeWidth="' + sw + '"/></svg>';
      }

      var tabsHTML = tabs.slice(0, 5).map(function (t, i) {
        var active = i === activeIdx;
        var label = (t && typeof t === 'object') ? (t.label || t.text || '') : String(t);
        var styleLbl = active
          ? _T('label', { weight: 'semibold' })
          : _T('label', { color: 'sectionLabel' });
        return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;flex:1;' +
          (active ? 'color:#fff;' : 'color:rgba(255,255,255,0.55);') +
        '">' +
          '<div style="display:flex;align-items:center;justify-content:center;line-height:0;">' + navIconFor(label, active) + '</div>' +
          '<span style="' + styleLbl + '">' + label + '</span>' +
        '</div>';
      }).join('');

      return '<div style="width:100%;height:100%;border-radius:var(--card-radius,' + _R('widget') + ');' +
        _G('widgetPill') +
        'display:flex;align-items:stretch;padding:6px 4px;box-sizing:border-box;">' +
        tabsHTML +
      '</div>';
    }

    case 'app-icon': {
      // Single app launcher: PNG icon + small label underneath.
      // Used inside Home's app-grid (expanded from `app-grid` role).
      var av = (comp && comp.variant) || {};
      var app = av.app || 'App';
      var pngMap = {
        'Phone':'Phone.png','Messages':'Messages.png','Internet':'Internet.png',
        'Camera':'Camera.png','Gallery':'Gallery.png','Contacts':'Contacts.png',
        'Settings':'Settings.png','Clock':'Clock.png','Weather':'Weather.png',
        'Calculator':'Calculator.png','Calendar':'Clock.png','Notes':'Notes.png',
        'Cloud':'Cloud.png','Health':'Health.png','Reminder':'Reminder.png',
        'Store':'Store.png','SmartThings':'SmartThings.png','Bixby':'Bixby.png',
        'MyFiles':'MyFiles.png','Studio':'Studio.png','Wallet':'Wallet.png',
        'Wearable':'Wearable.png','Pass':'Pass.png','Find':'Find.png',
        'Radio':'Radio.png','VoiceRecorder':'VoiceRecorder.png',
        'DailyBoard':'DailyBoard.png','DeviceCare':'DeviceCare.png',
        'DigitalWellbeing':'DigitalWellbeing.png','SecureFolder':'SecureFolder.png',
        'SecureWifi':'SecureWifi.png'
      };
      var file = pngMap[app];
      // Size icon to the cell width (leave room for label line)
      var iconSize = rect ? Math.min(rect.w - 8, (rect.h || 0) - 28, 72) : 60;
      if (iconSize < 32) iconSize = 32;
      var iconRadius = Math.round(iconSize * 0.28);

      var iconHTML;
      if (file) {
        iconHTML = '<img src="app-icons/' + file + '" style="width:' + iconSize + 'px;height:' + iconSize + 'px;border-radius:' + iconRadius + 'px;object-fit:cover;flex-shrink:0;">';
      } else {
        iconHTML = '<div style="width:' + iconSize + 'px;height:' + iconSize + 'px;border-radius:' + iconRadius + 'px;background:var(--accent-primary,#4285F4);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;line-height:1;' +
          _T('heading', { weight: 'bold', color: '#fff' }) + '">' + app.charAt(0).toUpperCase() + '</div>';
      }

      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">' +
        iconHTML +
        '<div style="font-size:var(--font-size-sm,16px);font-weight:500;color:#fff;line-height:1.35;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px 1px;text-shadow:0 1px 2px rgba(0,0,0,0.45);">' + app + '</div>' +
      '</div>';
    }

    // ─── OneUI 8.5 atomics — extracted from Figma One UI Design Kit ───────
    // Shared primitives intentionally kept small so Media / QS / Notif
    // variants can be composed from them.

    case 'toggle-chip': {
      // Multi-toggle ROW path — emitted by the `quick_toggle_row`
      // adapter. Lays out N circular toggles side-by-side with a tiny
      // label under each. Used for Samsung QS-style strips on lock or
      // home surface.
      var tcvRow = (comp && comp.variant) || {};
      if (Array.isArray(tcvRow.toggles) && tcvRow.toggles.length) {
        if (A && typeof A.QSToggleStrip === 'function') {
          return A.QSToggleStrip({ toggles: tcvRow.toggles });
        }
        var TOGGLE_ROW_ICONS = {
          'wifi':       '<path d="M2 9c5-4 15-4 20 0M5 13c3.5-3 11-3 14 0M9 17c1.7-1.3 4.3-1.3 6 0M12 21h0.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>',
          'bluetooth':  '<path d="M7 17l10-10-5-5v20l5-5-10-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>',
          'flashlight': '<path d="M9 3h6v3l-1 3H10L9 6V3zM10 9h4v12h-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>',
          'airplane':   '<path d="M3 13l8-2V5a1 1 0 0 1 2 0v6l8 2v2l-8-1v4l2 1v2l-3-1-3 1v-2l2-1v-4l-8 1v-2z" fill="currentColor"/>',
          'hotspot':    '<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 16a6 6 0 0 1 0-8M16 16a6 6 0 0 0 0-8M5 19a10 10 0 0 1 0-14M19 19a10 10 0 0 0 0-14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>',
          'location':   '<path d="M12 22s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" fill="none"/>',
          'auto-rotate':'<path d="M4 12a8 8 0 0 1 14-5l2-2M20 7v4h-4M20 12a8 8 0 0 1-14 5l-2 2M4 17v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>',
          'sound':      '<path d="M5 9v6h4l5 4V5L9 9H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"/><path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>',
          'vibrate':    '<path d="M5 9v6h4l5 4V5L9 9H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"/><path d="M18 8c1.5 1 2 2.5 2 4s-0.5 3-2 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>',
          'mute':       '<path d="M5 9v6h4l5 4V5L9 9H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>',
          'power-save': '<rect x="5" y="7" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="19" y="10" width="2" height="4" fill="currentColor"/><path d="M11 10l-2 4h3l-1 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>',
          'camera':     '<rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none"/><circle cx="12" cy="13.5" r="3.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M9 7l1.5-2h3L15 7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>',
          'screen-share':'<rect x="3" y="5" width="18" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M9 20h6M12 16v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>'
        };
        var tiles = tcvRow.toggles.map(function (t) {
          var iconPath = TOGGLE_ROW_ICONS[t.icon] || TOGGLE_ROW_ICONS['sound'];
          var bg    = t.on
            ? 'var(--qs-row-toggle-on-bg, rgba(246,248,248,0.88))'
            : 'var(--qs-row-toggle-off-bg, rgba(56,77,82,0.42))';
          var color = t.on
            ? 'var(--qs-row-toggle-on-fg, rgba(30,42,46,0.82))'
            : 'var(--qs-row-toggle-off-fg, rgba(214,226,226,0.52))';
          var shadow = t.on
            ? 'box-shadow:inset 0 1px 0 rgba(255,255,255,0.65),0 8px 18px rgba(0,0,0,0.18);'
            : 'box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);';
          return '<div style="display:flex;align-items:center;justify-content:center;flex:1;min-width:0;cursor:pointer;" data-toggle-chip="1" data-on="' + (t.on ? '1' : '0') + '" title="' + t.name + '">' +
            '<div style="width:52px;height:52px;border-radius:50%;background:' + bg + ';display:flex;align-items:center;justify-content:center;color:' + color + ';transition:background 0.15s;' + shadow + '">' +
              '<svg width="23" height="23" viewBox="0 0 24 24">' + iconPath + '</svg>' +
            '</div>' +
          '</div>';
        }).join('');
        return '<div style="width:100%;min-height:92px;height:100%;display:flex;align-items:center;justify-content:space-around;gap:12px;padding:18px 20px;box-sizing:border-box;border-radius:var(--card-radius,' + _R('widget') + ');' +
          _G('panel') +
          'overflow:hidden;position:relative;">' +
          '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.10),transparent 58%,rgba(0,0,0,0.08));pointer-events:none;opacity:var(--qs-row-sheen-opacity, 1);"></div>' +
          '<div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-around;gap:12px;width:100%;">' +
          tiles +
          '</div>' +
          '<div style="position:absolute;left:50%;bottom:7px;transform:translateX(-50%);width:40px;height:4px;border-radius:4px;background:rgba(240,244,244,0.72);"></div>' +
        '</div>';
      }
      // 56×56 circular toggle — primitive. Matches Figma `ToggleIcon`
      // 544:1125 exactly: bg rgba(180,180,180,0.2) / p-13 / rounded-full.
      // `data-toggle-chip` marks it for the delegated interact-mode click
      // handler (see _bindInteractiveAtomics at bottom of file).
      //
      // variant.label → Samsung QS "label below circle" composition. NOT a
      //                 Figma-defined atomic — it's composed by Samsung from
      //                 Single/Toggle (88×88) + external label text. Use
      //                 `single-toggle` role (role = 'single-toggle') for
      //                 Figma-exact 88×88 wrapper or 199×88 side-label.
      // variant.icon  → named glyph for the circle center.
      var tcv = (comp && comp.variant) || {};
      var on = tcv.on === true || tcv.state === 'on';
      var label = tcv.label || '';
      var iconKey = tcv.icon || '';

      // Small icon library for QS labeled toggles. Keys mirror the Samsung
      // QS names (auto-rotate / airplane / flashlight / …). Unknown keys
      // fall back to a neutral + / ✓ pair.
      var ICONS = {
        'sound':       '<path d="M5 9v6h4l5 4V5L9 9H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>',
        'vibrate':     '<path d="M5 9v6h4l5 4V5L9 9H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M18 8c1.5 1 2 2.5 2 4s-0.5 3-2 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>',
        'mute':        '<path d="M5 9v6h4l5 4V5L9 9H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>',
        // Figma 340:6297 — classic bluetooth B: diagonals + vertical spine.
        // Path: low-left → diag up-right → top-peak → vertical spine down →
        // low-right-peak → diag up-left back. Renders the recognizable
        // Samsung bluetooth glyph at 24×24.
        'bluetooth':   '<path d="M7 17l10-10-5-5v20l5-5-10-10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>',
        'screen-share':'<rect x="3" y="5" width="18" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><path d="M9 20h6M12 16v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>',
        'camera':      '<rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="13.5" r="3.5" stroke="currentColor" strokeWidth="1.6"/><path d="M9 7l1.5-2h3L15 7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>',
        'auto-rotate': '<path d="M4 12a8 8 0 0 1 14-5l2-2M20 7v4h-4M20 12a8 8 0 0 1-14 5l-2 2M4 17v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>',
        'airplane':    '<path d="M3 13l8-2V5a1 1 0 0 1 2 0v6l8 2v2l-8-1v4l2 1v2l-3-1-3 1v-2l2-1v-4l-8 1v-2z" fill="currentColor"/>',
        'flashlight':  '<path d="M9 3h6v3l-1 3H10L9 6V3zM10 9h4v12h-4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>',
        'hotspot':     '<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 16a6 6 0 0 1 0-8M16 16a6 6 0 0 0 0-8M5 19a10 10 0 0 1 0-14M19 19a10 10 0 0 0 0-14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>',
        'power-save':  '<rect x="5" y="7" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="19" y="10" width="2" height="4" fill="currentColor"/><path d="M11 10l-2 4h3l-1 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>',
        'location':    '<path d="M12 22s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6"/>',
        'link':        '<path d="M10 14l-3 3a3 3 0 0 1-4-4l3-3M14 10l3-3a3 3 0 0 1 4 4l-3 3M8 16l8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>',
        'quick-share': '<circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6"/><circle cx="18" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.6"/><circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.6"/><path d="M8 11l8-4M8 13l8 4" stroke="currentColor" strokeWidth="1.6"/>',
        'dex':         '<rect x="3" y="5" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><path d="M8 20h8M12 17v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><text x="12" y="12.5" font-size="6" fill="currentColor" text-anchor="middle" font-family="Arial" font-weight="700">DeX</text>',
        'eye-comfort': '<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/><path d="M16 8a6 6 0 1 1-4 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="10" cy="10" r="1" fill="currentColor"/>',
        'dnd':         '<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/><path d="M7 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>',
        'qr':          '<rect x="4" y="4" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><rect x="14" y="4" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><rect x="4" y="14" width="6" height="6" stroke="currentColor" strokeWidth="1.6"/><path d="M14 14h3v3M20 14v6M14 20h6" stroke="currentColor" strokeWidth="1.6"/>',
        'interpreter': '<path d="M5 9h6M8 6v3M7 12l2 5 2-5M14 14l2 5 2-5M13 17h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>',
        'multi':       '<path d="M6 12l4-4 4 4-4 4-4-4zM14 6h6v6M20 18h-6v-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>',
        'secure':      '<rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>',
        'broadcast':   '<circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M8 8a5 5 0 0 0 0 8M16 8a5 5 0 0 1 0 8M5 5a9 9 0 0 0 0 14M19 5a9 9 0 0 1 0 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>',
        // Figma "wifi 3" (3018:6371 / 6381) — 4 vectors: 3 nested arcs
        // (outer/middle/inner) bowing UP + 1 dot at the bottom center.
        // Cubic bezier used (instead of elliptical arc) for a smoother
        // Samsung curve at small sizes.
        'wifi':        '<path d="M5 10.5c3.9-3 10.1-3 14 0M7.5 13.5c2.6-2 6.4-2 9 0M10 16.5c1.3-1 2.7-1 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/>',
        // Figma 989:22477 / 3018:6357 "mobile data qs" — two vertical arrows
        // side-by-side: left ↓ (download), right ↑ (upload). Aspect ≈ 71:61.
        'mobile-data': '<path d="M8.5 4v16M4.5 15l4 5 4-5M15.5 20V4M11.5 9l4-5 4 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>',
        // Figma 474:600 — battery "fully charged" pill with 100% fill.
        // Rounded rectangle body + small positive terminal nub on the right.
        'battery':     '<rect x="3" y="8" width="17" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="20.5" y="11" width="1.5" height="4" rx="0.5" fill="currentColor"/><rect x="5" y="10" width="13" height="6" rx="1" fill="currentColor"/>',
        'modes':       '<circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6"/><path d="M12 4v8l6 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>',
        // Figma brightness (I1109:10261;…;340:6324 + 6325) — sun disc + rays
        'brightness':  '<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>',
        // Figma 1109:10246;…;530:6 — music eighth note with beam
        'music':       '<path d="M9 18V5l11-2v11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="7" cy="18" r="2.5" fill="currentColor"/><circle cx="18" cy="14" r="2.5" fill="currentColor"/>',
        // Figma 340:6583 — dark mode moon (crescent)
        'moon':        '<path d="M19 14A8 8 0 1 1 10 5a6 6 0 0 0 9 9z" fill="currentColor"/>',
        // Figma 340:7776 — sound vibrate (muted speaker with diagonal line)
        'mute':        '<path d="M4 10v4h3l4 3.5V6.5L7 10H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>',
        // Phone handset — used by lock-screen bottom-left shortcut
        'phone':       '<path d="M5 4.5C5 3.67 5.67 3 6.5 3h2.28c0.69 0 1.28 0.47 1.44 1.14l0.59 2.35c0.11 0.43-0.02 0.88-0.33 1.19l-1.27 1.27a11.5 11.5 0 0 0 5.34 5.34l1.27-1.27c0.31-0.31 0.76-0.44 1.19-0.33l2.35 0.59c0.67 0.16 1.14 0.75 1.14 1.44V17.5c0 0.83-0.67 1.5-1.5 1.5C9.94 19 5 14.06 5 8.5V4.5z" fill="currentColor"/>'
      };
      var iconPath = ICONS[iconKey] || ICONS['modes'];
      var size = label ? 22 : 24;
      var iconColorOn = 'var(--qs-chip-icon-on, #222)';
      var iconColorOff = 'var(--qs-chip-icon-off, #fff)';
      var plusSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="' + iconColorOff + '" strokeWidth="1.8" strokeLinecap="round"/></svg>';
      var iconSvg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" style="color:' + (on ? iconColorOn : iconColorOff) + ';">' + iconPath + '</svg>';
      var circle = '<div data-toggle-chip data-on="' + (on ? '1' : '0') + '" ' +
        'style="width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
          'background:' + (on ? 'var(--qs-chip-on-bg, #d5d5d5)' : 'var(--qs-chip-off-bg, rgba(180,180,180,0.2))') + ';transition:background 180ms ease;' +
          (label ? 'margin:0 auto 8px;' : 'margin:auto;') + '">' +
          '<span data-toggle-on style="display:' + (on ? 'inline-flex' : 'none') + ';">' + iconSvg + '</span>' +
          '<span data-toggle-off style="display:' + (on ? 'none' : 'inline-flex') + ';">' +
            (iconKey ? iconSvg.replace('color:' + iconColorOn, 'color:' + iconColorOff) : plusSvg) +
          '</span>' +
        '</div>';
      if (!label) return circle;
      // Labeled variant — ANCHOR the circle to the top (NOT justify-center)
      // so rows of chips stay perfectly aligned regardless of whether the
      // label wraps to 1 or 2 lines. Circle at padding-top:4; label at
      // fixed margin-top so it hangs below at a consistent offset.
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;' +
        'padding-top:4px;box-sizing:border-box;color:var(--text-primary,#fff);font-family:var(--font);overflow:visible;">' +
        circle +
        '<div style="' + _T('label', { weight: 'medium', color: 'secondary' }) + 'text-align:center;line-height:1.25;max-width:86px;' +
          'margin-top:8px;white-space:normal;word-break:keep-all;color:var(--text-secondary,rgba(255,255,255,0.92));">' + label + '</div>' +
      '</div>';
    }

    case 'toggle-grid': {
      // Figma "Icons" shell — node 544:865 / 1109:10370. Glass pill with
      // N rows of 56×56 toggle-chips, evenly distributed via flex
      // justify-between. Spec matches 1:1:
      //   bg rgba(23,23,26,0.6) + 1px border rgba(255,255,255,0.2)
      //   rounded 50 · padding 24 25 · column flex gap 20
      //   per row: flex justify-between, 4 toggle-chips
      //   drag handle 50×4 bar near the bottom edge
      //
      // variant.cells → array of { icon, label, on } — when a cell has a
      //                 `label` we render the labeled toggle-chip (icon +
      //                 text below). No label = icon-only 56 circle.
      // variant.cols / rows → grid shape (default 4×2 = 8 cells).
      var tgv = (comp && comp.variant) || {};
      var cells = Array.isArray(tgv.cells) ? tgv.cells : null;
      var cols = tgv.cols || 4;
      var rows = tgv.rows || 2;

      function _tgCell(cellVariant) {
        return window.renderAtomicForRole(
          { role: 'toggle-chip', variant: cellVariant || {} },
          { w: 88, h: 88 }
        );
      }

      var rowsHtml = '';
      for (var r = 0; r < rows; r++) {
        var rowInner = '';
        for (var c = 0; c < cols; c++) {
          var idx = r * cols + c;
          var cellVariant;
          if (cells && cells[idx]) {
            cellVariant = {
              icon:  cells[idx].icon  || 'modes',
              label: cells[idx].label || '',
              on:    cells[idx].on === true
            };
          } else {
            cellVariant = { on: false };
          }
          rowInner += '<div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
            _tgCell(cellVariant) +
          '</div>';
        }
        rowsHtml += '<div style="display:flex;align-items:flex-start;justify-content:space-between;width:100%;flex-shrink:0;">' +
          rowInner +
        '</div>';
      }

      return '<div style="width:100%;height:100%;' +
        _G('panel') +
        'border:var(--surface-border, 1px solid rgba(255,255,255,0.2));border-radius:var(--card-radius,' + _R('widget') + ');' +
        'padding:24px 25px;box-sizing:border-box;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;' +
        'position:relative;overflow:hidden;">' +
        rowsHtml +
        // Figma drag handle (987:16943 + 544:2861): 11px holder at bottom:-1px
        // with a 50×4 bar riding at top of holder → visually sits just above
        // the bottom edge, bumping slightly past the rounded corner.
        '<div style="position:absolute;left:50%;bottom:-1px;transform:translateX(-50%);width:50px;height:11px;pointer-events:none;">' +
          '<div style="position:absolute;top:0;left:0;width:50px;height:4px;border-radius:2px;background:rgba(255,255,255,0.6);"></div>' +
        '</div>' +
      '</div>';
    }

    case 'slider-pill': {
      // Pill slider with gradient fill. Horizontal by default; set
      // `variant.orient = 'vertical'` for the tall brightness-style slider.
      // `variant.icon` selects the handle glyph:
      //   'volume' (default), 'sun' (brightness), 'moon' (night).
      var spv = (comp && comp.variant) || {};
      var pct = spv.percent != null ? spv.percent : 32;
      var orient = spv.orient || 'horizontal';
      var iconKey = spv.icon || 'volume';
      var ICON_SVGS = {
        'volume':    '<path d="M4 12h16M7 8l-3 4 3 4M17 8l3 4-3 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>',
        'sun':       '<circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>',
        'moon':      '<path d="M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>',
        // Figma brightness (I1109:10261;…;340:6324 + 6325): sun disc + rays
        'brightness':'<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v3M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5l1.5-1.5M17 7l1.5-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>',
        // Figma music (I1109:10246;…;530:6): eighth note with beam
        'music':     '<path d="M9 18V5l11-2v11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="7" cy="18" r="2.5" fill="currentColor"/><circle cx="18" cy="14" r="2.5" fill="currentColor"/>'
      };
      var iconSvg = ICON_SVGS[iconKey] || ICON_SVGS['volume'];

      if (orient === 'vertical') {
        // Tall vertical slider — fill grows from the BOTTOM up. Handle icon
        // sits at the bottom center of the pill (representing the control
        // handle / indicator glyph below the track).
        return '<div data-slider-pill data-pct="' + pct + '" data-orient="vertical" ' +
          'style="width:100%;height:100%;min-width:56px;background:rgba(185,185,185,0.2);border-radius:28px;position:relative;touch-action:none;overflow:hidden;">' +
          '<div data-slider-fill style="position:absolute;left:0;right:0;bottom:0;height:' + pct + '%;min-height:56px;background:linear-gradient(to top,#c6c4c3,#e4e4e4);border-radius:28px;transition:height 60ms linear;"></div>' +
          '<div style="position:absolute;bottom:13px;left:50%;transform:translateX(-50%);width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#222;pointer-events:none;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">' + iconSvg + '</svg>' +
          '</div>' +
        '</div>';
      }
      return '<div data-slider-pill data-pct="' + pct + '" ' +
        'style="width:100%;height:56px;background:rgba(185,185,185,0.2);border-radius:28px;position:relative;touch-action:none;">' +
        '<div data-slider-fill style="position:absolute;left:0;top:0;bottom:0;width:' + pct + '%;min-width:74px;background:linear-gradient(to right,#c6c4c3,#e4e4e4);border-radius:28px;transition:width 60ms linear;"></div>' +
        '<div style="position:absolute;left:13px;top:13px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#222;pointer-events:none;">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">' + iconSvg + '</svg>' +
        '</div>' +
      '</div>';
    }

    case 'drag-handle': {
      // 50×4 rounded bar — bottom-of-sheet / QS expand indicator.
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><div style="width:50px;height:4px;border-radius:2px;background:rgba(255,255,255,0.6);"></div></div>';
    }

    case 'now-bar': {
      // Figma Now Bar — 248×64 pill with 3 type variants (3 distinct Figma
      // components sharing the same container spec):
      //   media    (752:7978) → teal bg rgba(3,78,110,0.8), 40 image + song
      //                          title (14 semibold) + prev/pause/next controls
      //   timer    (752:7988) → glass rgba(23,23,26,0.6) + 0.25 border, 40
      //                          icon (#5b53c8 optional bg) + 26 semibold time
      //                          + pause icon on right
      //   charging (752:7994) → glass + green Union gradient fill (left), bolt
      //                          icon + 26 semibold percent (no right icon)
      // All: backdrop-blur 12px, padding 12 top/bottom, pl 12 pr 18, radius 53.
      var nbv = (comp && comp.variant) || {};
      var nbType = nbv.type || 'timer';
      var common = 'min-height:64px;height:64px;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
        'padding:12px 18px 12px 12px;box-sizing:border-box;display:flex;align-items:center;gap:14px;' +
        'border-radius:53px;color:var(--text-primary,#fff);font-family:var(--font);overflow:hidden;position:relative;max-width:100%;min-width:0;';

      if (nbType === 'media') {
        // Song title scrolls as a marquee. Earlier revisions used a
        // hardcoded "Never Gonna Give You Up · Rick Astley (1987)"
        // default that leaked into production screens when the AI
        // didn't supply a marquee (the "Astley (1987)" tail visible
        // on every music lockscreen generation). Now: if marquee isn't
        // set, build it from the actual content (title · artist · album),
        // falling back to just the title. Only use "Now playing" as a
        // last-ditch placeholder when literally nothing is emitted —
        // better than a wrong song name.
        var mSong    = nbv.title || nbv.song || 'Now playing';
        var mMarquee = nbv.marquee
          || [nbv.title || nbv.song, nbv.artist, nbv.album].filter(Boolean).join(' \u00B7 ')
          || mSong;
        var mImgBg   = nbv.imgBg || '#5b53c8';
        return '<div style="width:100%;max-width:100%;min-width:0;box-sizing:border-box;' + common + _G('widgetPill') + 'padding:5px 12px;gap:8px;color:var(--text-primary,#fff);">' +
          '<div style="width:40px;height:40px;border-radius:37px;background:' + mImgBg + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--text-primary,#fff);">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.8"/><circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.8"/></svg>' +
          '</div>' +
          '<div style="flex:1;min-width:0;max-width:100%;display:flex;flex-direction:column;align-items:stretch;gap:10px;">' +
            // Marquee — fluid width inside the pill (was fixed 164px → overflow in narrow cards).
            '<div style="width:100%;max-width:100%;min-width:0;height:22px;overflow:hidden;position:relative;mask-image:linear-gradient(to right,transparent 0,#000 8px,#000 calc(100% - 8px),transparent 100%);">' +
              '<div class="nowbar-marquee-track" style="position:absolute;top:0;left:0;white-space:nowrap;font-size:14px;font-weight:700;line-height:1.3;color:var(--text-primary,#fff);animation:nowbar-marquee 14s linear infinite;">' +
                '<span style="padding-right:32px;">' + mMarquee + '</span>' +
                '<span style="padding-right:32px;">' + mMarquee + '</span>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:center;gap:12px;color:var(--text-primary,#fff);flex-shrink:0;">' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18 5L8 12l10 7V5z" fill="currentColor"/><rect x="5" y="5" width="2" height="14" fill="currentColor"/></svg>' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="7" y="5" width="3.5" height="14" fill="currentColor"/><rect x="13.5" y="5" width="3.5" height="14" fill="currentColor"/></svg>' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 5l10 7-10 7V5z" fill="currentColor"/><rect x="17" y="5" width="2" height="14" fill="currentColor"/></svg>' +
            '</div>' +
          '</div>' +
        '</div>';
      }

      // Navigation turn-by-turn — arrow icon (direction-aware) + big
      // distance + instruction text. Teal/blue accent for navigation
      // context. Mimics Samsung Maps live navigation now-bar.
      if (nbType === 'navigation') {
        var navDist  = nbv.distance    || '';
        var navInstr = nbv.instruction || 'Continue';
        var navEta   = nbv.eta         || '';
        var dir      = nbv.direction   || 'straight';
        // Direction-aware arrow glyphs
        var ARROW = {
          left:    '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12l7-7M5 12l7 7" stroke="var(--card-nav-accent,#14B8A6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>',
          right:   '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M19 12l-7-7M19 12l-7 7" stroke="var(--card-nav-accent,#14B8A6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>',
          straight:'<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="var(--card-nav-accent,#14B8A6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>',
          uturn:   '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none"><path d="M5 17V11a5 5 0 0 1 10 0v6M5 17l-2-3M5 17l3-3" stroke="var(--card-nav-accent,#14B8A6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>',
          exit:    '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none"><path d="M9 5l-4 7 4 7M5 12h12M14 7l4 5-4 5" stroke="var(--card-nav-accent,#14B8A6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>',
          merge:   '<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none"><path d="M12 19V8M12 8l-4 4M12 8l4 4M5 19l4-4M19 19l-4-4" stroke="var(--card-nav-accent,#14B8A6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>'
        };
        var arrow = ARROW[dir] || ARROW.straight;
        var nbSkin = _themeSurfaceStyleRoot();
        var navPillShell = nbSkin === 'neon'
          ? 'background:#ffffff;border:var(--surface-border);box-shadow:var(--surface-shadow);-webkit-backdrop-filter:none;backdrop-filter:none;'
          : _G('widgetPill');
        // Do not reuse `common`: fixed 64px height + overflow clipped long turn
        // instructions mid-glyph. Auto height + 2-line ellipsis; distance ellipsizes when cramped.
        var navOuter = 'min-height:64px;height:auto;' +
          '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
          'padding:12px 18px 12px 12px;box-sizing:border-box;display:flex;align-items:center;gap:10px;' +
          'border-radius:53px;color:var(--text-primary,#fff);font-family:var(--font);overflow:hidden;' +
          'position:relative;width:100%;max-width:100%;';
        function _navEscAttr(txt) {
          return String(txt || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/\r|\n/g, ' ');
        }
        return '<div style="' + navOuter + navPillShell + 'padding:12px 24px 12px 16px;">' +
          '<div style="width:40px;height:40px;flex-shrink:0;align-self:center;border-radius:20px;background:var(--card-nav-arrow-bg,rgba(20,184,166,0.25));display:flex;align-items:center;justify-content:center;padding:8px;">' +
            arrow +
          '</div>' +
          '<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:9px;">' +
            (navDist
              ? '<div title="' + _navEscAttr(navDist) + '" style="font-size:20px;font-weight:500;line-height:1.3;color:#ffffff;letter-spacing:-0.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + navDist + '</div>'
              : '') +
            '<div title="' + _navEscAttr(navInstr) + '" style="font-family:var(--font);font-size:16px;font-weight:500;color:#8DE7E7;' +
              'display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;' +
              'word-break:break-word;line-height:1.3;text-overflow:ellipsis;">' + navInstr + '</div>' +
          '</div>' +
          (navEta
            ? '<div title="' + _navEscAttr(navEta) + '" style="font-family:var(--font);font-size:18px;font-weight:700;color:#E3DBC8;flex-shrink:0;flex-basis:auto;white-space:nowrap;align-self:center;padding-left:8px;border-left:1px solid color-mix(in srgb, var(--text-primary,#fff) 18%, transparent);line-height:1.3;">' + navEta + '</div>'
            : '') +
        '</div>';
      }

      // Dual-line — notification-style now-bar with a 40px app icon,
      // two stacked text lines, and an optional trailing status glyph.
      if (nbType === 'dual-line' || nbType === 'delivery') {
        var dlTitle    = nbv.title    || nbv.label   || '8min away';
        var dlSubtitle = nbv.subtitle || nbv.sub     || nbv.value || 'Arrives 9:45 - 9:50';
        var dlApp      = nbv.app      || nbv.service || nbv.iconLabel || 'Uber Eats';
        var dlIconBg   = nbv.iconBg   || '#35D466';
        var dlTrail    = nbv.trailing || nbv.trailingIcon || 'car';
        var dlTrailSvg = dlTrail === 'none' ? '' :
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="flex:none;opacity:0.78;">' +
            '<path d="M5 17h14M7 17l1.45-5h7.1L17 17M6 17v2M18 17v2" stroke="#848487" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>' +
            '<circle cx="9" cy="15.2" r="0.9" fill="#848487"/>' +
            '<circle cx="15" cy="15.2" r="0.9" fill="#848487"/>' +
          '</svg>';
        return '<div style="margin:0 auto;width:100%;max-width:100%;min-width:0;min-height:64px;height:auto;flex:none;box-sizing:border-box;' +
          'display:flex;flex-direction:row;align-items:center;padding:12px 24px 12px 16px;gap:14px;' +
          'background:var(--surface-bg, rgba(23,23,26,0.80));border:var(--surface-border, 1px solid rgba(255,255,255,0.12));' +
          '-webkit-backdrop-filter:var(--surface-filter, blur(12px));backdrop-filter:var(--surface-filter, blur(12px));border-radius:53px;' +
          'color:var(--text-primary,#fff);font-family:var(--font);overflow:hidden;">' +
          '<div style="width:40px;height:40px;border-radius:20px;background:' + dlIconBg + ';flex:none;display:flex;align-items:center;justify-content:center;color:#000;overflow:hidden;">' +
            '<div style="font-weight:700;font-size:16px;line-height:1.15;letter-spacing:-0.7px;text-align:left;white-space:normal;">' + dlApp.replace(/\s+/, '<br>') + '</div>' +
          '</div>' +
          '<div style="flex:1 1 auto;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:9px;">' +
            '<div style="font-size:20px;font-weight:500;line-height:1.3;color:#ffffff;letter-spacing:-0.45px;white-space:nowrap;overflow:hidden;text-overflow:clip;">' + dlTitle + '</div>' +
            '<div style="font-size:16px;font-weight:500;line-height:1.3;color:#8DE7E7;letter-spacing:-0.25px;white-space:nowrap;overflow:hidden;text-overflow:clip;">' + dlSubtitle + '</div>' +
          '</div>' +
          dlTrailSvg +
        '</div>';
      }

      // Voice input — One UI voice/search pill.
      if (nbType === 'single-line') {
        var voicePrompt = nbv.prompt || nbv.placeholder || 'What are you looking for?';
        var voiceSurface = _themeSurfaceStyleRoot();
        var voiceIsFlat = voiceSurface === 'flat';
        var voiceIsNeon = voiceSurface === 'neon';
        var voiceIsGlass = voiceSurface === 'glass';
        var voiceBg = voiceIsNeon
          ? '#ffffff'
          : (voiceIsFlat
          ? 'var(--surface-bg, rgba(23,23,26,0.80))'
          : (voiceIsGlass
            ? 'radial-gradient(circle at 14% 0%,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0.045) 30%,transparent 58%), linear-gradient(90deg,rgba(102,161,243,0.28) 0%,rgba(34,201,166,0.18) 58%,rgba(255,255,255,0.04) 100%), rgba(23,23,26,0.18)'
            : 'linear-gradient(90deg,#364B6F 0%,#384247 64.81%,#2D2D30 87.17%)'));
        var voiceNeonGreen = 'var(--surface-bg,#b8ff42)';
        var voiceTextStyle = voiceIsNeon
          ? 'color:' + voiceNeonGreen + ';'
          : (voiceIsFlat
            ? 'color:var(--accent-primary,#0381FE);'
            : 'background:linear-gradient(90deg,#78AFFF 0%,#31D8B3 100%);-webkit-background-clip:text;background-clip:text;color:transparent;');
        var voiceIconColor = voiceIsNeon
          ? voiceNeonGreen
          : (voiceIsFlat ? 'var(--accent-primary,#0381FE)' : '#31D8B3');
        var voiceChrome = voiceIsGlass
          ? 'border:1px solid rgba(255,255,255,0.16);-webkit-backdrop-filter:blur(42px) saturate(1.45) brightness(1.02);backdrop-filter:blur(42px) saturate(1.45) brightness(1.02);box-shadow:inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(255,255,255,0.035), 0 18px 42px rgba(0,0,0,0.24);'
          : (voiceIsNeon
            ? 'border:var(--surface-border, 1px solid rgba(255,255,255,0.12));-webkit-backdrop-filter:var(--surface-filter, blur(12px));backdrop-filter:var(--surface-filter, blur(12px));box-shadow:var(--surface-shadow, none);'
            : 'box-shadow:-1px 0px 4px 1px rgba(78,102,139,0.58);');
        return '<div style="margin:0 auto;width:100%;max-width:100%;min-width:0;height:58px;display:flex;flex-direction:row;justify-content:space-between;align-items:center;padding:17px 20px;gap:12px;box-sizing:border-box;background:' + voiceBg + ';' + voiceChrome + 'border-radius:30px;color:var(--text-primary,#fff);font-family:var(--font);overflow:hidden;flex:1 1 auto;">' +
          '<div style="font-size:20px;font-weight:500;line-height:1.3;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + voiceTextStyle + '">' + voicePrompt + '</div>' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="flex:none;color:' + voiceIconColor + ';">' +
            '<rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" fill="none"/>' +
            '<path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>' +
          '</svg>' +
        '</div>';
      }

      if (nbType === 'charging') {
        var percent = nbv.percent != null ? nbv.percent : 69;
        var chargeSurface = _themeSurfaceStyleRoot();
        var chargeIsFlat = chargeSurface === 'flat';
        var chargeIsNeon = chargeSurface === 'neon';
        var chargeIsGlass = chargeSurface === 'glass';
        // Neon: white track (unfilled / right), neon-green fill grows from the
        // left by percent — avoids the legacy two-layer gradient trick.
        if (chargeIsNeon) {
          var neonTrack = 'var(--nowbar-charging-track-bg, #ffffff)';
          var neonFill = 'var(--nowbar-charging-fill-bg, var(--surface-bg))';
          var neonBolt = 'var(--nowbar-charging-bolt-fill, var(--text-primary,#050805))';
          var neonPct = 'var(--nowbar-charging-percent-color, var(--text-primary,#050805))';
          var pctW = Math.max(0, Math.min(100, Number(percent)));
          if (isNaN(pctW)) pctW = 69;
          return '<div style="margin:0 auto;width:100%;max-width:100%;min-width:0;height:64px;' +
            'display:flex;flex-direction:row;align-items:center;padding:12px 18px 12px 12px;gap:14px;' +
            'isolation:isolate;position:relative;overflow:hidden;box-sizing:border-box;' +
            'background:' + neonTrack + ';' +
            'border:var(--surface-border, 1px solid rgba(5,8,5,0.14));' +
            'box-shadow:var(--surface-shadow, none);' +
            '-webkit-backdrop-filter:none;backdrop-filter:none;' +
            'border-radius:53px;font-family:var(--font);">' +
            '<div style="position:absolute;left:0;top:0;bottom:0;width:' + pctW + '%;max-width:100%;background:' + neonFill + ';z-index:0;pointer-events:none;"></div>' +
            '<div style="width:40px;height:40px;position:relative;z-index:1;flex:none;">' +
              '<div style="position:absolute;width:40px;height:40px;left:0;top:0;background:#5B53C8;opacity:0;border-radius:20px;"></div>' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="position:absolute;left:8px;top:8px;">' +
                '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="' + neonBolt + '"/>' +
              '</svg>' +
            '</div>' +
            '<div style="position:relative;z-index:2;flex:1 1 auto;min-width:0;height:23px;display:flex;align-items:center;justify-content:center;">' +
              '<div style="font-size:26px;font-weight:700;line-height:18px;color:' + neonPct + ';letter-spacing:-0.2px;font-feature-settings:\'pnum\' on, \'lnum\' on;">' + percent + '%</div>' +
            '</div>' +
            '<div style="width:24px;height:24px;opacity:0;position:relative;z-index:3;flex:none;"></div>' +
          '</div>';
        }
        var chargeFill = chargeIsFlat
          ? 'var(--accent-primary,#0381FE)'
          : (_isMonoChromaRoot()
            ? 'linear-gradient(90deg,#d5d5d5 0%,#aaaaae 35.93%,#78787d 100%)'
            : 'linear-gradient(90deg,#98DFA9 0%,#3BD18B 35.93%,#2E979F 100%)');
        var chargeSubtract = chargeIsFlat
          ? 'var(--accent-primary,#0381FE)'
          : (_isMonoChromaRoot()
            ? 'linear-gradient(90deg,#d8d8dc 0%,#a8a8ad 28.87%,#77777c 100%)'
            : 'linear-gradient(90deg,#9BDCA9 0%,#31CE8A 28.87%,#2F989F 100%)');
        var chargeMotionStyle = chargeIsFlat ? '' : 'background-size:180% 100%;animation:oneuiSurfaceShift 3.8s ease-in-out infinite alternate;';
        var chargeShimmer = chargeIsFlat ? '' : '<div style="position:absolute;width:157px;height:76px;left:-0.5px;bottom:0;background:linear-gradient(110deg,transparent 0%,transparent 34%,rgba(255,255,255,0.28) 50%,transparent 66%,transparent 100%);background-size:260% 100%;animation:aiShimmer 2.8s linear infinite;mix-blend-mode:screen;opacity:0.7;z-index:1;pointer-events:none;"></div>';
        var chargeShell = chargeIsGlass
          ? _G('panel')
          : 'background:var(--surface-bg, rgba(23,23,26,0.80));-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);';
        return '<div style="margin:0 auto;width:100%;max-width:100%;min-width:0;height:64px;' +
          'display:flex;flex-direction:row;align-items:center;padding:12px 18px 12px 12px;gap:14px;' +
          'isolation:isolate;position:relative;overflow:hidden;box-sizing:border-box;' +
          chargeShell +
          'border-radius:53px;color:var(--text-primary,#fff);font-family:var(--font);">' +
          '<div style="position:absolute;width:157px;height:76px;left:-0.5px;bottom:0;background:' + chargeFill + ';' + chargeMotionStyle + 'z-index:0;"></div>' +
          '<div style="position:absolute;width:154px;height:64px;left:-0.5px;top:0;background:' + chargeSubtract + ';' + chargeMotionStyle + 'z-index:0;"></div>' +
          chargeShimmer +
          '<div style="width:40px;height:40px;position:relative;z-index:1;flex:none;">' +
            '<div style="position:absolute;width:40px;height:40px;left:0;top:0;background:#5B53C8;opacity:0;border-radius:20px;"></div>' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="position:absolute;left:8px;top:8px;">' +
              '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#848487"/>' +
            '</svg>' +
          '</div>' +
          '<div style="position:relative;z-index:2;flex:1 1 auto;min-width:0;height:23px;display:flex;align-items:center;justify-content:center;">' +
            '<div style="font-size:26px;font-weight:700;line-height:18px;color:var(--text-primary,#fff);letter-spacing:-0.2px;font-feature-settings:\'pnum\' on, \'lnum\' on;">' + percent + '%</div>' +
          '</div>' +
          '<div style="width:24px;height:24px;opacity:0;position:relative;z-index:3;flex:none;"></div>' +
        '</div>';
      }

      // timer (default) — icon + 26px time + pause
      // When variant.live === true, adds data-live-timer so a global ticker
      // (see scenes.js _startLiveTimerTicker) increments the displayed time
      // every second. The `data-start` attribute records when the timer
      // began so we can compute elapsed seconds on each tick (survives
      // rerenders by using the wall-clock delta, not an accumulator).
      var tLabel = nbv.label || nbv.time || '00:00:00';
      var tIcon  = nbv.icon  || 'stopwatch';
      var showPause = nbv.showPause !== false;
      var iconBg = nbv.iconBg !== false;
      var isLive = nbv.live === true;
      var TIMER_ICONS = {
        'stopwatch':'<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="14" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M12 11v3l2 1.5M10 3h4M14 5l1.5-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>',
        'timer':    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6"/><path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>'
      };
      var timerSvg = TIMER_ICONS[tIcon] || TIMER_ICONS['stopwatch'];
      var liveAttrs = isLive ? ' data-live-timer="1" data-start="' + Date.now() + '"' : '';
      return '<div style="width:100%;' + common + _G('widgetPill') + '">' +
        '<div style="width:40px;height:40px;border-radius:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--text-primary,#fff);' +
          (iconBg ? 'background:#5b53c8;' : '') + '">' + timerSvg + '</div>' +
        '<div style="flex:1;min-width:0;"><div' + liveAttrs + ' style="font-size:26px;font-weight:700;line-height:18px;color:var(--text-primary,#fff);letter-spacing:-0.2px;white-space:nowrap;font-family:Inter,system-ui,sans-serif;">' + tLabel + '</div></div>' +
        (showPause ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;color:var(--text-primary,#fff);"><rect x="7" y="5" width="3.5" height="14" fill="currentColor"/><rect x="13.5" y="5" width="3.5" height="14" fill="currentColor"/></svg>' : '') +
      '</div>';
    }

    case 'media-half': {
      // Figma "Media (Half | Off)" — node 544:967. Collapsed 199×163 glass
      // card shown when no media is active. Structure:
      //   container 199×163, bg rgba(23,23,26,0.6), border 1px rgba 0.2,
      //              rounded 36, padding 14 29
      //   inner stack (160w) vertically justify-between:
      //     1) Output chip — bg rgba(0,0,0,0.2) rounded 43, px-8 py-5,
      //          media-volume icon 19.7 + "Media Output" text 14/400
      //     2) Song row — play-triangle 19 + "No Media Playing" 15/500
      //     3) Progress line — thin 150.5 horizontal divider
      //     4) Controls — prev/play/next 24px icons, gap 21
      // All-interactive: each control has data-shortcut for press ripple.
      var mhv = (comp && comp.variant) || {};
      var mhTitle = mhv.title || 'No Media Playing';
      var mhOutput = mhv.output || 'Media Output';
      return '<div style="width:100%;height:100%;max-width:100%;min-width:0;' +
        'background:rgba(23,23,26,0.6);border:1px solid rgba(255,255,255,0.2);' +
        'border-radius:' + _R('widget') + ';padding:14px 29px;box-sizing:border-box;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'color:#fff;font-family:var(--font);overflow:hidden;">' +
        '<div style="width:100%;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:10px;flex:1;">' +
          // 1) Output chip
          '<div data-shortcut="1" style="display:flex;align-items:center;gap:6px;padding:6px 9px;background:rgba(0,0,0,0.2);border-radius:43px;cursor:pointer;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="color:#fff;">' +
              '<path d="M4 10v4h3l4 3.5V6.5L7 10H4z" fill="currentColor"/>' +
              '<path d="M14 9.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>' +
            '</svg>' +
            '<span style="font-size:var(--font-size-xs,14px);font-weight:500;color:#fff;white-space:nowrap;">' + mhOutput + '</span>' +
          '</div>' +
          // 2) Song title row (play-triangle + "No Media Playing")
          '<div style="display:flex;align-items:center;gap:6px;justify-content:center;">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;"><path d="M8 5l10 7-10 7V5z" fill="#fff"/></svg>' +
            '<span style="font-size:var(--font-size-sm,16px);font-weight:500;letter-spacing:0.3px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + mhTitle + '</span>' +
          '</div>' +
          // 3) Progress line (empty/inactive)
          '<div style="width:100%;height:2px;background:rgba(255,255,255,0.25);border-radius:1px;"></div>' +
          // 4) Controls row — prev / play / next
          '<div style="display:flex;align-items:center;gap:21px;">' +
            '<svg data-shortcut="1" width="22" height="22" viewBox="0 0 24 24" fill="none" style="cursor:pointer;"><path d="M6 5v14M18 5L8 12l10 7V5z" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinejoin="round"/></svg>' +
            '<svg data-shortcut="1" width="22" height="22" viewBox="0 0 24 24" fill="none" style="cursor:pointer;"><path d="M8 5l10 7-10 7V5z" fill="#fff"/></svg>' +
            '<svg data-shortcut="1" width="22" height="22" viewBox="0 0 24 24" fill="none" style="cursor:pointer;"><path d="M18 5v14M6 5l10 7-10 7V5z" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinejoin="round"/></svg>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    case 'media-card': {
      // Compact media player — title + single meta line + progress + core transport
      // (prev / pause / next). Omit service/output chrome and shuffle/like so the
      // card stays glanceable on narrow pipeline layouts.
      var mcv = (comp && comp.variant) || {};
      var mTitle = mcv.title  || 'Title';
      var mArtist = mcv.artist != null ? String(mcv.artist).trim() : '';
      var mSub = mArtist
        ? '<div style="font-size:var(--font-size-xs,13px);color:rgba(255,255,255,0.72);letter-spacing:0.2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3;">' + mArtist + '</div>'
        : '';
      return '<div style="width:100%;max-width:100%;min-width:0;height:100%;border-radius:' + _R('dialog') + ';padding:12px 16px;box-sizing:border-box;color:#fff;display:flex;flex-direction:column;gap:10px;background:linear-gradient(135deg,#2A1A5E,#1A0A3E 60%,#3A1A6E);overflow:hidden;position:relative;">' +
        '<div style="display:flex;flex-direction:column;gap:4px;min-width:0;flex:0 0 auto;">' +
          '<div style="font-size:15px;font-weight:700;letter-spacing:0.2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.25;">' + mTitle + '</div>' +
          mSub +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:4px;min-width:0;flex:0 0 auto;">' +
          '<div style="height:3px;background:rgba(255,255,255,0.22);border-radius:2px;position:relative;">' +
            '<div style="position:absolute;left:0;top:0;bottom:0;width:45%;background:#fff;border-radius:2px;"></div>' +
            '<div style="position:absolute;left:45%;top:50%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 6px rgba(255,255,255,0.45);"></div>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,0.65);letter-spacing:0.15px;">' +
            '<span>02:41</span><span>03:24</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:center;align-items:center;gap:20px;padding:4px 0 0;min-width:0;flex:0 0 auto;">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 5L8 12l10 7V5z" fill="#fff"/><rect x="5" y="5" width="2" height="14" fill="#fff"/></svg>' +
          '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="7" y="5" width="3.5" height="14" fill="#fff"/><rect x="13.5" y="5" width="3.5" height="14" fill="#fff"/></svg>' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 5l10 7-10 7V5z" fill="#fff"/><rect x="17" y="5" width="2" height="14" fill="#fff"/></svg>' +
        '</div>' +
      '</div>';
    }

    case 'notif-card': {
      // Figma Notification/Regular — node 544:1088. Samsung OneUI 8.5 pill
      // shape with 56×56 app icon + title/time row + subtitle + chevron.
      //
      //   container  → 415×86, rounded 50, padding 15 / 16 / 20, gap 10
      //   icon       → 56×56 circle, app accent bg or png icon inside
      //
      //   theme='dark'  (default, over Lock shade)
      //     bg rgba(23,23,26,0.6) + backdrop-blur; title #efeef2 / sub #cfcccf
      //   theme='light' (over Home / List / Detail day UI)
      //     bg #ffffff; title #000 / sub #333 — pops against light app content
      var ncv = (comp && comp.variant) || {};
      var ncTheme = ncv.theme === 'light' ? 'light' : 'dark';
      var ncTitle = ncv.title || ncv.app || 'Title';
      var ncBody  = ncv.body  || ncv.subtitle || '';
      var ncTime  = ncv.time  || '';
      var ncAccent= ncv.accent|| '#d5d5d5';
      var ncIcon  = ncv.icon  || null;
      var ncGlyph = ncv.glyph || '';
      var ncShowSub = !!ncBody;

      var ncSurfRoot = _themeSurfaceStyleRoot();
      var ncBg, ncBlur, ncTitleColor, ncTimeColor, ncSubColor, ncChevronColor;
      if (ncTheme === 'light') {
        ncBg = '#ffffff';
        ncBlur = '';
        ncTitleColor = '#000000';
        ncTimeColor = '#555555';
        ncSubColor = '#333333';
        ncChevronColor = '#222222';
      } else if (ncSurfRoot === 'neon') {
        ncBg = '#ffffff';
        ncBlur = '';
        ncTitleColor = 'var(--text-primary,#050805)';
        ncTimeColor = 'var(--text-secondary,rgba(5,8,5,0.72))';
        ncSubColor = 'var(--text-secondary,rgba(5,8,5,0.72))';
        ncChevronColor = 'var(--text-primary,#050805)';
      } else {
        ncBg = 'rgba(23,23,26,0.6)';
        ncBlur = '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);';
        ncTitleColor = 'var(--text-primary,#efeef2)';
        ncTimeColor = 'var(--text-secondary,#d5d5d5)';
        ncSubColor = 'var(--text-secondary,#cfcccf)';
        ncChevronColor = 'var(--text-primary,#ffffff)';
      }

      // 56×56 circular app icon. Uses the png if provided, else a colored
      // circle with the glyph fallback. Matches Figma Shape (548:2740).
      var ncIconHTML = ncIcon
        ? '<img src="app-icons/' + ncIcon + '" style="width:44px;height:44px;border-radius:50%;flex-shrink:0;object-fit:cover;"/>'
        : '<div style="width:44px;height:44px;border-radius:50%;background:' + ncAccent +
            ';display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
            'color:#fff;font-size:18px;font-weight:700;line-height:1;">' + ncGlyph + '</div>';

      var ncSurface = ncTheme === 'light'
        ? 'background:' + ncBg + ';' + ncBlur
        : (ncSurfRoot === 'neon'
          ? 'background:' + ncBg + ';border:var(--surface-border);box-shadow:var(--surface-shadow);-webkit-backdrop-filter:none;backdrop-filter:none;'
          : _G('panel'));
      return '<div style="width:415px;min-height:64px;height:auto;max-width:100%;' +
        ncSurface +
        'border-radius:53px;padding:12px 24px 12px 16px;box-sizing:border-box;' +
        'display:flex;align-items:center;gap:10px;overflow:hidden;font-family:var(--font);">' +
        ncIconHTML +
        // Stacked unit — title+time row (baseline aligned) on top, subtitle below
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:9px;overflow:hidden;">' +
          '<div style="display:flex;align-items:baseline;gap:20px;white-space:nowrap;overflow:hidden;line-height:1.3;">' +
            '<span style="font-size:20px;font-weight:500;color:' + ncTitleColor + ';overflow:hidden;text-overflow:ellipsis;">' + ncTitle + '</span>' +
            (ncTime ? '<span style="font-size:18px;font-weight:700;color:#E3DBC8;flex-shrink:0;">' + ncTime + '</span>' : '') +
          '</div>' +
          (ncShowSub
            ? '<div style="font-size:16px;font-weight:500;color:#8DE7E7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;">' + ncBody + '</div>'
            : '') +
        '</div>' +
        // Chevron-down expand affordance (Figma node 745:7185, opacity 0.8)
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;opacity:0.8;"><path d="M6 9l6 6 6-6" stroke="' + ncChevronColor + '" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>' +
      '</div>';
    }

    case 'notif-card-ai': {
      // Notification variant with AI blue→green gradient + animated
      // shimmer overlay (slow, ambient — signals "AI is processing"
      // without being noisy). Sparkle glyph in a glass circle. App
      // name + time on top line, body below. Empty fallbacks return
      // empty rather than the "Title/Subtitle" placeholder antipattern.
      var naiv = (comp && comp.variant) || {};
      var aiTheme = naiv.theme === 'light' ? 'light' : 'dark';
      var aiTitle = (naiv.title && naiv.title !== 'Title') ? naiv.title : '';
      var aiSub   = (naiv.subtitle && naiv.subtitle !== 'Subtitle') ? naiv.subtitle : (naiv.body || '');
      var aiTime  = naiv.time || '';
      var aiSurface = _themeSurfaceStyleRoot();
      var aiTitleColor = aiTheme === 'light' ? '#111111' : 'var(--text-primary,#efeef2)';
      var aiTimeColor  = aiTheme === 'light' ? '#444444' : 'var(--text-secondary,rgba(239,238,242,0.7))';
      var aiSubColor   = aiTheme === 'light' ? '#222222' : 'var(--text-secondary,rgba(239,238,242,0.85))';
      var aiChevColor  = aiTheme === 'light' ? '#111111' : 'var(--text-primary,#ffffff)';
      var aiSparkFill = aiSurface === 'neon'
        ? '#ffffff'
        : (aiTheme === 'light' ? '#111111' : 'var(--text-primary,#ffffff)');
      // Richer gradient: blue → purple → teal — three-stop AI signature.
      // Theme-driven via --card-ai-grad. Light mode keeps a stronger
      // gradient (no backdrop blur); dark mode uses a translucent one.
      var aiGrad = (aiSurface === 'flat' || aiSurface === 'neon')
        ? 'var(--card-ai-grad, var(--surface-bg, rgba(23,23,26,0.80)))'
        : (aiTheme === 'light'
          ? 'linear-gradient(120deg, rgba(102,161,243,1) 0%, rgba(167,139,250,1) 50%, rgba(34,201,166,1) 100%)'
          : 'var(--card-ai-grad, linear-gradient(120deg, rgba(102,161,243,0.45) 0%, rgba(167,139,250,0.45) 50%, rgba(34,201,166,0.45) 100%))');
      var aiSurfaceStyle = aiSurface === 'glass' ? _G('panel') : 'background:' + aiGrad + ';';
      // Shimmer overlay — animated white sweep, very subtle. Speed
      // tunable via --card-ai-shimmer-speed for theme variations.
      var shimmerSpeed = (getComputedStyle(document.documentElement).getPropertyValue('--card-ai-shimmer-speed') || '3.6s').trim();
      var shimmerOff = shimmerSpeed === '0s' || shimmerSpeed === '0ms';
      var shimmer = (aiSurface === 'flat' || aiSurface === 'neon' || shimmerOff) ? '' : '<div style="position:absolute;inset:0;background:linear-gradient(110deg,transparent 0%,transparent 35%,rgba(255,255,255,0.10) 50%,transparent 65%,transparent 100%);background-size:300% 100%;animation:aiShimmer var(--card-ai-shimmer-speed,3.6s) linear infinite;pointer-events:none;border-radius:inherit;"></div>';
      var aiIconBubble = aiSurface === 'neon'
        ? 'background:var(--surface-bg,#b8ff42);-webkit-backdrop-filter:none;backdrop-filter:none;border:1px solid rgba(5,8,5,0.14);'
        : 'background:rgba(255,255,255,0.22);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.3);';
      return '<div style="position:relative;width:415px;min-height:64px;height:auto;max-width:100%;' + aiSurfaceStyle + 'border-radius:53px;padding:12px 24px 12px 16px;display:flex;align-items:center;gap:10px;box-sizing:border-box;overflow:hidden;">' +
        shimmer +
        '<div style="position:relative;z-index:1;width:44px;height:44px;border-radius:50%;' + aiIconBubble + 'flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
          '<svg width="28" height="31" viewBox="0 0 39 43" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M25.3011 4.73334C25.6795 4.9781 25.8481 5.34637 26.0017 5.75821C26.026 5.82177 26.026 5.82177 26.0508 5.88662C26.0853 5.97691 26.1196 6.06727 26.1537 6.1577C26.2429 6.39394 26.3334 6.62966 26.4237 6.86546C26.4504 6.93509 26.4504 6.93509 26.4775 7.00612C26.619 7.37572 26.7662 7.74276 26.9173 8.10851C27.0696 8.478 27.216 8.84828 27.3539 9.22346C27.5614 9.78572 27.7836 10.3423 28.0027 10.9001C28.0992 11.1457 28.1954 11.3915 28.2913 11.6374C28.5489 12.2969 28.8079 12.9557 29.071 13.6131C29.2606 14.0868 29.4451 14.5619 29.6212 15.0408C29.6432 15.1003 29.6652 15.1597 29.6879 15.221C29.7001 15.2681 29.7123 15.3151 29.7248 15.3636C29.8356 15.5711 29.9984 15.6333 30.2038 15.7262C30.288 15.7663 30.3722 15.8064 30.4563 15.8466C30.5006 15.8673 30.5449 15.8881 30.5905 15.9095C30.8196 16.0182 31.0454 16.1332 31.2717 16.2477C31.3633 16.2937 31.455 16.3397 31.5467 16.3857C31.9661 16.5962 32.3855 16.8067 32.8049 17.0172C32.7858 17.0937 32.7668 17.1702 32.7472 17.249C32.8234 17.249 32.8995 17.249 32.9781 17.249C32.9781 17.2872 32.9781 17.3255 32.9781 17.3649C33.0733 17.384 33.1685 17.4031 33.2667 17.4228C33.2667 17.461 33.2667 17.4993 33.2667 17.5387C33.3047 17.5387 33.3428 17.5387 33.3821 17.5387C33.3821 17.5769 33.3821 17.6152 33.3821 17.6546C33.4152 17.6334 33.4483 17.6123 33.4824 17.5905C33.613 17.5387 33.613 17.5387 33.7345 17.572C33.7742 17.5932 33.8138 17.6145 33.8547 17.6365C33.8948 17.657 33.9349 17.6775 33.9762 17.6987C34.0748 17.7705 34.0748 17.7705 34.1325 17.9443C34.1818 17.9313 34.2312 17.9183 34.282 17.9049C34.5276 17.8817 34.6389 17.9395 34.8569 18.0525C34.9099 18.0794 34.9099 18.0794 34.964 18.1069C35.0781 18.1653 35.1915 18.2249 35.3049 18.2847C35.383 18.3251 35.4611 18.3655 35.5393 18.4058C35.6931 18.4853 35.8467 18.5653 36.0001 18.6458C36.1785 18.7392 36.3581 18.8299 36.5385 18.9194C36.6264 18.9637 36.7142 19.008 36.8021 19.0524C36.8412 19.0715 36.8803 19.0905 36.9205 19.1101C37.0949 19.2005 37.1822 19.2585 37.2738 19.4359C37.2848 19.479 37.2958 19.5222 37.3071 19.5667C37.3702 19.5715 37.4333 19.5762 37.4983 19.5812C37.7112 19.6246 37.7112 19.6246 37.823 19.7369C37.8844 19.8564 37.8844 19.8564 37.8844 19.9723C37.9415 19.9914 37.9986 20.0105 38.0575 20.0302C38.0575 20.145 38.0575 20.2597 38.0575 20.3779C38.0956 20.3779 38.1337 20.3779 38.173 20.3779C38.3159 20.5932 38.3135 20.7659 38.2884 21.0153C38.2307 21.1891 38.2307 21.1891 38.173 21.305C38.1158 21.305 38.0587 21.305 37.9998 21.305C37.9808 21.4006 37.9617 21.4962 37.9421 21.5947C37.8459 21.5947 37.7497 21.5947 37.6535 21.5947C37.7106 21.6712 37.7678 21.7477 37.8266 21.8265C37.3049 22.1044 36.7831 22.3818 36.2537 22.6449C35.9575 22.7921 35.6646 22.944 35.3735 23.1012C35.0885 23.255 34.8021 23.4044 34.5124 23.5489C34.4728 23.5687 34.4331 23.5886 34.3923 23.609C34.2672 23.6716 34.1421 23.734 34.017 23.7965C32.6597 24.4716 32.6597 24.4716 31.3149 25.1714C30.1989 25.7675 30.1989 25.7675 29.9175 25.8649C29.7443 25.9795 29.7119 26.1203 29.639 26.3129C29.6244 26.3508 29.6098 26.3887 29.5948 26.4277C29.5469 26.5523 29.5002 26.6773 29.4534 26.8023C29.4202 26.8895 29.3868 26.9766 29.3534 27.0638C29.2853 27.2414 29.2176 27.4191 29.1502 27.597C29.0125 27.9598 28.8703 28.3207 28.7283 28.6818C28.6765 28.8141 28.6247 28.9465 28.573 29.0788C28.5475 29.1439 28.5221 29.209 28.4958 29.276C28.4164 29.4791 28.3371 29.6823 28.2578 29.8855C27.9778 30.6021 27.6967 31.3182 27.4093 32.0319C27.2816 32.3503 27.1587 32.6703 27.0393 32.992C26.8601 33.4745 26.6731 33.9538 26.4844 34.4326C26.4528 34.5132 26.4211 34.5937 26.3895 34.6742C26.3271 34.8329 26.2646 34.9915 26.2018 35.15C26.1387 35.3095 26.0767 35.4694 26.0152 35.6295C25.9849 35.7077 25.9546 35.7858 25.9243 35.864C25.8845 35.9679 25.8845 35.9679 25.8438 36.0739C25.6777 36.4441 25.4419 36.6352 25.081 36.8046C24.6911 36.9425 24.3367 36.9038 23.9591 36.7431C23.4783 36.462 23.2929 35.9363 23.1005 35.4394C23.0735 35.3713 23.0465 35.3032 23.0187 35.2331C22.9467 35.0508 22.8754 34.8682 22.8046 34.6854C22.7618 34.575 22.7189 34.4647 22.676 34.3544C22.5013 33.9053 22.3283 33.4555 22.156 33.0054C21.2361 30.6032 21.2361 30.6033 20.2774 28.2165C20.1538 27.9147 20.0354 27.6116 19.9222 27.3057C19.9085 27.269 19.8947 27.2323 19.8806 27.1946C19.8103 27.0064 19.7427 26.8177 19.678 26.6276C19.5326 26.1702 19.5326 26.1702 19.2187 25.8281C19.1308 25.7861 19.0415 25.7466 18.9518 25.7086C18.8476 25.6563 18.7434 25.6039 18.6396 25.5508C18.5199 25.49 18.3996 25.4304 18.2792 25.3709C18.0295 25.2467 17.7834 25.1162 17.5376 24.9843C17.1498 24.7767 16.7589 24.5764 16.3652 24.3805C16.1399 24.2683 15.9149 24.1555 15.6901 24.0425C15.375 23.8843 15.0597 23.7264 14.7442 23.5688C13.2878 22.8409 13.2877 22.8409 12.6107 22.4781C12.4161 22.3739 12.2211 22.2717 12.0227 22.175C11.9674 22.148 11.9674 22.148 11.9109 22.1204C11.8142 22.0735 11.7171 22.0272 11.62 21.981C11.2066 21.7488 10.968 21.4667 10.8131 21.0153C10.7397 20.6322 10.8286 20.3401 10.9991 19.9967C11.28 19.6125 11.6681 19.4074 12.0874 19.2036C12.1432 19.1759 12.199 19.1482 12.2564 19.1197C12.434 19.0315 12.612 18.9442 12.79 18.8569C13.0225 18.7421 13.2549 18.6271 13.4872 18.5119C13.544 18.4838 13.6009 18.4557 13.6595 18.4268C14.1175 18.1996 14.5702 17.9632 15.0212 17.7221C15.4038 17.5178 15.7928 17.3261 16.1811 17.1331C16.8027 16.8239 17.4229 16.5129 18.0342 16.1835C18.2528 16.0663 18.4716 15.9545 18.6981 15.8531C18.7403 15.8338 18.7825 15.8144 18.8259 15.7944C18.9043 15.7588 18.9833 15.7245 19.063 15.6919C19.3411 15.5638 19.4268 15.4163 19.531 15.1435C19.5494 15.0926 19.5678 15.0417 19.5867 14.9892C19.6336 14.8732 19.6809 14.7573 19.7283 14.6416C19.7822 14.5064 19.8361 14.3712 19.8897 14.236C19.9043 14.1994 19.9188 14.1628 19.9338 14.1252C20.3082 13.1837 20.6738 12.2388 21.0402 11.2942C21.3045 10.6132 21.571 9.93297 21.8378 9.25288C21.867 9.17846 21.8962 9.10404 21.9254 9.02962C21.9404 8.99138 21.9554 8.95315 21.9709 8.91375C22.0018 8.8348 22.0328 8.75585 22.0638 8.6769C22.1424 8.47642 22.2211 8.27598 22.3 8.07559C22.4482 7.69877 22.5959 7.32175 22.7412 6.94381C22.8085 6.76917 22.876 6.59466 22.9436 6.42015C22.9756 6.33731 23.0074 6.25439 23.0391 6.17141C23.5119 4.93136 23.5119 4.93136 24.0224 4.68106C24.4736 4.4917 24.86 4.53907 25.3011 4.73334Z" fill="white"/>' +
            '<path d="M10.5335 13.4071C10.9553 13.6269 11.1189 14.0585 11.264 14.4919C11.3155 14.6831 11.3326 14.8483 11.3326 15.0472C11.3689 15.1254 11.4077 15.2026 11.448 15.2789C11.467 15.3375 11.4861 15.396 11.5057 15.4564C11.5581 15.6346 11.5581 15.6346 11.6789 15.8004C11.6884 15.8602 11.6979 15.9199 11.7077 15.9815C11.7173 16.0365 11.7268 16.0914 11.7366 16.1481C11.7747 16.1672 11.8128 16.1863 11.852 16.206C11.8592 16.2598 11.8663 16.3136 11.8737 16.369C11.8929 16.5583 11.8929 16.5583 12.0252 16.6696C12.1733 16.8182 12.1719 16.929 12.1984 17.1331C12.1659 17.1494 12.1334 17.1656 12.0999 17.1824C10.8346 17.8205 9.63034 18.4896 9.13915 19.9143C8.9115 20.7383 9.02966 21.5367 9.43271 22.2911C9.89608 23.0154 10.5319 23.4606 11.294 23.8372C11.3761 23.8781 11.4581 23.919 11.5402 23.9599C11.5822 23.9807 11.6241 24.0016 11.6674 24.0231C11.8723 24.125 12.0768 24.2279 12.2813 24.3307C12.3636 24.3719 12.4458 24.4132 12.528 24.4545C12.6931 24.5373 12.8581 24.6202 13.0232 24.703C13.0639 24.7235 13.1047 24.7439 13.1467 24.765C13.2286 24.8061 13.3104 24.8472 13.3923 24.8883C13.5947 24.9899 13.7972 25.0915 13.9998 25.1928C14.4561 25.421 14.9106 25.6523 15.3622 25.8897C15.443 25.9319 15.443 25.9319 15.5254 25.975C15.6865 26.0595 15.8473 26.1447 16.008 26.2301C16.0659 26.2606 16.1238 26.2912 16.1835 26.3226C16.2401 26.3529 16.2967 26.3832 16.355 26.4143C16.4316 26.4551 16.4316 26.4551 16.5098 26.4967C16.6332 26.5719 16.7175 26.6474 16.8161 26.7516C16.8566 26.7719 16.897 26.7922 16.9387 26.8132C17.047 26.8675 17.047 26.8675 17.1047 26.9834C17.1511 26.9917 17.1975 27.0001 17.2454 27.0087C17.3933 27.0413 17.3933 27.0413 17.5087 27.2151C17.5087 27.2725 17.5087 27.3299 17.5087 27.389C17.4746 27.4065 17.4404 27.4241 17.4052 27.4421C17.3596 27.4664 17.314 27.4907 17.267 27.5157C17.2222 27.5392 17.1773 27.5628 17.1311 27.587C16.9813 27.6763 16.9813 27.6763 16.8519 27.8201C16.4636 28.2006 15.9116 28.4226 15.373 28.4319C15.373 28.4702 15.373 28.5084 15.373 28.5478C15.3385 28.555 15.304 28.5622 15.2684 28.5695C15.127 28.6031 15.127 28.6031 14.969 28.7216C14.8139 28.7289 14.8139 28.7289 14.6804 28.7216C14.6423 28.7981 14.6042 28.8746 14.5649 28.9534C14.4507 28.9343 14.3364 28.9152 14.2186 28.8955C14.2377 28.972 14.2567 29.0484 14.2763 29.1272C14.143 29.1464 14.0097 29.1655 13.8723 29.1852C13.8723 29.2234 13.8723 29.2617 13.8723 29.3011C13.7961 29.3202 13.7199 29.3393 13.6414 29.359C13.6414 29.3973 13.6414 29.4355 13.6414 29.4749C13.6795 29.4749 13.7176 29.4749 13.7569 29.4749C13.7222 29.8225 13.6013 30.1525 13.3528 30.402C13.3432 30.5806 13.3432 30.5806 13.3528 30.7496C13.3147 30.7496 13.2766 30.7496 13.2374 30.7496C13.2284 30.8375 13.2284 30.8375 13.2193 30.9271C13.177 31.1703 13.1159 31.3412 13.0065 31.5608C12.9684 31.58 12.9303 31.5991 12.891 31.6188C12.8934 31.6917 12.8958 31.7646 12.8982 31.8397C12.9048 32.0412 12.8945 32.0772 12.7756 32.2561C12.7184 32.2561 12.6613 32.2561 12.6024 32.2561C12.6143 32.2884 12.6262 32.3207 12.6385 32.3539C12.6667 32.5286 12.6243 32.622 12.5447 32.7776C12.5066 32.7968 12.4685 32.8159 12.4293 32.8356C12.3894 32.985 12.3894 32.985 12.3643 33.1579C12.3498 33.2458 12.3498 33.2458 12.335 33.3356C12.328 33.3809 12.321 33.4262 12.3138 33.4729C12.2567 33.4921 12.1995 33.5112 12.1407 33.5309C12.1597 33.5883 12.1788 33.6456 12.1984 33.7047C12.1443 33.8604 12.1443 33.8604 12.0829 33.9944C12.0448 33.9944 12.0067 33.9944 11.9675 33.9944C11.9675 34.1092 11.9675 34.2239 11.9675 34.3421C11.9294 34.3421 11.8913 34.3421 11.852 34.3421C11.8431 34.4281 11.8431 34.4281 11.834 34.5159C11.7996 34.7641 11.7143 34.9795 11.6212 35.2112C11.5831 35.2112 11.545 35.2112 11.5057 35.2112C11.5057 35.2686 11.5057 35.326 11.5057 35.3851C11.4909 35.4735 11.4739 35.5617 11.4552 35.6494C11.4411 35.7177 11.4412 35.7177 11.4268 35.7873C11.3903 35.9065 11.3903 35.9065 11.2748 36.0224C11.2558 36.0798 11.2367 36.1372 11.2171 36.1963C11.1594 36.3701 11.1594 36.3701 11.0439 36.486C11.0463 36.5397 11.0487 36.5935 11.0512 36.6489C11.0421 36.8806 10.9608 36.9519 10.8131 37.1233C10.8131 37.1807 10.8131 37.2381 10.8131 37.2972C10.4769 37.5012 10.212 37.4807 9.83022 37.4085C9.56911 37.3272 9.50091 37.2476 9.37003 37.0075C9.28706 36.7938 9.28706 36.7938 9.25459 36.6019C9.29268 36.5445 9.33078 36.4871 9.37003 36.428C9.29384 36.428 9.21765 36.428 9.13915 36.428C9.09458 36.3037 9.05011 36.1794 9.00567 36.055C8.99239 36.018 8.97911 35.9809 8.96543 35.9427C8.89306 35.7398 8.82438 35.5364 8.76035 35.3307C8.70825 35.1697 8.64611 35.0334 8.55833 34.8889C8.43165 34.6633 8.3885 34.4775 8.33105 34.2262C8.2989 34.1635 8.2989 34.1635 8.26611 34.0995C8.20075 33.9635 8.20737 33.8536 8.2156 33.7047C8.17751 33.7047 8.13941 33.7047 8.10016 33.7047C7.96591 33.4941 7.97533 33.3124 7.98472 33.0673C7.94662 33.0673 7.90853 33.0673 7.86928 33.0673C7.79674 32.899 7.75383 32.7895 7.75383 32.6038C7.70227 32.6028 7.70227 32.6028 7.64967 32.6018C7.52295 32.5459 7.52295 32.5459 7.43231 32.365C7.4015 32.282 7.37167 32.1986 7.34257 32.1149C7.30772 32.0201 7.27285 31.9254 7.23795 31.8306C7.21913 31.7786 7.2003 31.7265 7.18091 31.6729C7.06508 31.3554 6.94374 31.04 6.82308 30.7243C6.79956 30.6619 6.77603 30.5996 6.7518 30.5353C6.68327 30.355 6.61284 30.1756 6.54169 29.9964C6.50786 29.9076 6.50786 29.9076 6.47334 29.8169C6.36859 29.5599 6.30012 29.3952 6.07766 29.2239C6.00936 29.1956 5.94105 29.1673 5.87068 29.1381C5.78819 29.1015 5.70582 29.0646 5.62356 29.0274C5.57743 29.0072 5.53129 28.9869 5.48376 28.9661C5.17388 28.8242 4.87372 28.6626 4.57195 28.5044C4.47156 28.4521 4.47156 28.4521 4.36915 28.3988C3.88894 28.1482 3.41342 27.8899 2.93924 27.6281C2.41141 27.3376 1.87393 27.0689 1.33189 26.8064C0.308671 26.3076 0.308671 26.3076 0.0769008 25.9223C-0.0201404 25.5631 -0.0507361 25.2733 0.13823 24.9409C0.362589 24.586 0.771197 24.3917 1.13821 24.2152C1.22003 24.175 1.30183 24.1347 1.38361 24.0944C1.42528 24.074 1.46696 24.0535 1.5099 24.0324C1.71201 23.9324 1.91237 23.829 2.1127 23.7254C2.15257 23.7049 2.19244 23.6843 2.23352 23.6631C2.35765 23.599 2.48173 23.5348 2.60582 23.4706C2.69412 23.4249 2.78242 23.3793 2.87072 23.3337C3.41405 23.0527 3.95711 22.7713 4.4998 22.4892C4.56269 22.4565 4.62558 22.4238 4.69038 22.3901C4.96907 22.2449 5.24726 22.0989 5.52412 21.9503C5.57047 21.9254 5.61682 21.9005 5.66457 21.8749C5.74844 21.8298 5.83219 21.7844 5.9158 21.7387C6.18281 21.5947 6.18281 21.5947 6.3108 21.5947C6.32076 21.5638 6.33072 21.5329 6.34098 21.5011C6.45237 21.1603 6.57496 20.8248 6.7029 20.4899C6.73328 20.41 6.73328 20.41 6.76428 20.3285C6.82827 20.1602 6.89241 19.992 6.95656 19.8238C7.00027 19.7089 7.04398 19.5941 7.08767 19.4792C7.19417 19.1993 7.3008 18.9194 7.40751 18.6396C7.46465 18.6396 7.52179 18.6396 7.58067 18.6396C7.66092 18.4481 7.66092 18.4481 7.72001 18.2494C7.76719 18.0663 7.83119 17.8906 7.89453 17.7125C7.91946 17.642 7.94438 17.5715 7.97006 17.4989C8.02588 17.3508 8.08488 17.2148 8.15788 17.0751C8.19711 16.9789 8.23577 16.8824 8.27333 16.7854C8.23523 16.7854 8.19713 16.7854 8.15788 16.7854C8.29343 16.3653 8.44576 15.9533 8.60466 15.5416C8.71059 15.2663 8.81334 14.9906 8.90939 14.7117C8.92857 14.6575 8.94775 14.6032 8.96752 14.5473C9.00388 14.4443 9.03919 14.3408 9.07324 14.2369C9.20458 13.8706 9.39455 13.6439 9.71636 13.4248C9.99149 13.3327 10.2545 13.3168 10.5335 13.4071Z" fill="white"/>' +
          '</svg>' +
        '</div>' +
        '<div style="position:relative;z-index:1;flex:1;min-width:0;display:flex;flex-direction:column;gap:9px;overflow:hidden;">' +
          (aiTitle || aiTime
            ? '<div style="display:flex;gap:20px;align-items:baseline;white-space:nowrap;overflow:hidden;line-height:1.3;">' +
                (aiTitle ? '<span style="font-size:20px;font-weight:500;color:' + aiTitleColor + ';">' + aiTitle + '</span>' : '') +
                (aiTime  ? '<span style="font-size:18px;font-weight:700;color:#E3DBC8;">' + aiTime + '</span>'   : '') +
              '</div>'
            : '') +
          (aiSub
            ? '<div style="font-size:16px;font-weight:500;color:#8DE7E7;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + aiSub + '</div>'
            : '') +
        '</div>' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="position:relative;z-index:1;opacity:0.8;flex-shrink:0;"><path d="M7 10l5 5 5-5" stroke="' + aiChevColor + '" strokeWidth="1.5" strokeLinecap="round"/></svg>' +
      '</div>';
    }

    case 'output-chip': {
      // Small pill — media device indicator ("Phone speaker").
      var ocv = (comp && comp.variant) || {};
      var ocLabel = ocv.label || 'Phone speaker';
      return '<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 11px;background:rgba(0,0,0,0.35);border-radius:999px;font-size:var(--font-size-sm,16px);color:#fff;white-space:nowrap;margin:auto;">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="6" y="3" width="12" height="18" rx="2" stroke="#fff" strokeWidth="1.5"/><circle cx="12" cy="17" r="1" fill="#fff"/></svg>' +
        '<span>' + ocLabel + '</span>' +
      '</div>';
    }

    case 'progress-track': {
      // Time progress bar with left/right timestamps.
      var ptv = (comp && comp.variant) || {};
      var left  = ptv.left  || '02:41';
      var right = ptv.right || '03:24';
      var ptPct = ptv.percent != null ? ptv.percent : 45;
      return '<div style="width:100%;height:100%;max-width:100%;min-width:0;display:flex;flex-direction:column;gap:3px;justify-content:center;padding:0 4px;box-sizing:border-box;overflow:hidden;">' +
        '<div style="height:3px;background:rgba(255,255,255,0.25);border-radius:2px;position:relative;"><div style="position:absolute;left:0;top:0;bottom:0;width:' + ptPct + '%;background:#fff;border-radius:2px;"></div><div style="position:absolute;left:' + ptPct + '%;top:50%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:#fff;"></div></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:var(--font-size-sm,16px);color:rgba(255,255,255,0.75);">' +
          '<span>' + left + '</span><span>' + right + '</span>' +
        '</div>' +
      '</div>';
    }

    case 'run-panel': {
      var rpv = (comp && comp.variant) || {};
      // Reference (state2) grid extracted from image: 15×16 centers.
      // Keep step/dot from existing spec so the density matches.
      var step = 10.65;
      var dot = 5.65;
      var r = dot / 2;
      // Spec: 165.38×165.38, step 10.65, dot 5.65 → 16×16 grid.
      var cols = 16;
      var rows = 16;
      var grid = '';
      for (var yy = 0; yy < rows; yy++) {
        for (var xx = 0; xx < cols; xx++) {
          // Figma exports use `left/top` for ellipse; center = (left/top) + r.
          grid += '<circle cx="' + (r + xx * step) + '" cy="' + (r + yy * step) + '" r="' + r + '" fill="#303030" />';
        }
      }

      // Render runner dots for a frame. Animation is dot-level via CSS (run-dot--fN),
      // so motion happens "on the dot grid" like Time Matrix — no panel blink.
      function _circles(points, frameKey) {
        var s = '';
        var seen = {};
        for (var i = 0; i < points.length; i++) {
          var p = points[i];
          var gx = p[0] | 0;
          var gy = p[1] | 0;
          if (gx < 0) gx = 0;
          if (gy < 0) gy = 0;
          if (gx > cols - 1) gx = cols - 1;
          if (gy > rows - 1) gy = rows - 1;
          var key = gx + ',' + gy;
          if (seen[key]) continue;
          seen[key] = 1;
          s += '<circle class="run-dot run-dot--' + frameKey + '" cx="' + (r + gx * step) + '" cy="' + (r + gy * step) + '" r="' + r + '" fill="#FF7F24" />';
        }
        return s;
      }

      // Use specific coordinates provided by the user for 3-frame running animation.
      // Offset applied to center the 11x10 character in the 16x16 grid.
      var offX = 3;
      var offY = 3;

      // Frame 1 (Group 2085670779)
      var f1_raw = [[8,0],[9,0],[4,1],[5,1],[8,1],[9,1],[3,2],[5,2],[6,2],[7,2],[5,3],[6,3],[7,3],[8,3],[10,3],[4,4],[5,4],[6,4],[8,4],[9,4],[3,5],[4,5],[5,5],[3,6],[4,6],[6,6],[7,6],[3,7],[4,7],[7,7],[8,7],[1,8],[2,8],[3,8],[5,8],[6,8],[7,8],[0,9],[1,9],[4,9],[5,9]];
      // Frame 2 (Group 2085670778)
      var f2_raw = [[6,0],[7,0],[6,1],[7,1],[2,2],[3,2],[4,2],[5,2],[0,3],[1,3],[4,3],[5,3],[6,3],[9,3],[3,4],[4,4],[5,4],[7,4],[8,4],[2,5],[3,5],[4,5],[2,6],[3,6],[5,6],[6,6],[2,7],[3,7],[5,7],[6,7],[1,8],[2,8],[5,8],[6,8],[0,9],[1,9],[6,9],[7,9]];
      // Frame 3 (Group 2085670781)
      var f3_raw = [[6,0],[7,0],[6,1],[7,1],[10,1],[3,2],[4,2],[5,2],[6,2],[10,2],[2,3],[5,3],[6,3],[7,3],[8,3],[9,3],[2,4],[4,4],[5,4],[6,4],[4,5],[5,5],[6,5],[0,6],[1,6],[4,6],[5,6],[6,6],[7,6],[1,7],[2,7],[3,7],[4,7],[7,7],[8,7],[3,8],[8,8],[9,8],[9,9],[10,9]];

      function _applyOffset(pts) {
        return pts.map(function(p) { return [p[0] + offX, p[1] + offY]; });
      }

      var f1 = _applyOffset(f1_raw);
      var f2use = _applyOffset(f2_raw);
      var f3 = _applyOffset(f3_raw);

      return '' +
        '<div class="dot-card run-panel" data-state="' + (rpv.state || 'idle') + '">' +
          '<svg class="run-panel__svg" width="165.38" height="165.38" viewBox="0 0 165.38 165.38" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            grid +
            '<g class="run-frame f1">' + _circles(f1, 'f1') + '</g>' +
            '<g class="run-frame f2">' + _circles(f2use, 'f2') + '</g>' +
            '<g class="run-frame f3">' + _circles(f3, 'f3') + '</g>' +
          '</svg>' +
        '</div>';
    }

    case 'dot-goal': {
      // The suffix ("Within"/"이내") was visually adjacent to the
      // time and ended up reading as a label that pulled focus from
      // the goal number. Removed per UX feedback — `timeSuffix`
      // stays in the variant schema (legacy datasets pass it) but is
      // no longer rendered. Add it back here if you ever need it.
      //
      // Title can opt into the ReactBits-style proximity wave on
      // first appearance via `variant.titleWave = true`. Each char
      // gets wrapped in a <span class="prox-char-once"> with a
      // staggered --i index; CSS animates them left-to-right ONCE,
      // settling to the normal title weight (no infinite loop).
      // test3's "Running Now" uses this; other goal cards stay plain.
      //
      // Map thumbnail lives at /prototype-assets/goal-map.png served
      // through Next.js public/ static handler. aria-hidden because
      // it's decorative (the textual goal data carries the meaning).
      var gv = (comp && comp.variant) || {};
      var gTitle = gv.title || '오늘의 목표';
      var gTime = gv.time || '01:42:43';
      var gDist = gv.distance || '15km';
      var gMap = gv.mapSrc || '/prototype-assets/goal-map.png';

      // Two map render modes:
      //   useRealMap (test3): empty Leaflet container, init post-mount
      //   default            : the static PNG asset
      var mapInnerHtml;
      if (gv.useRealMap) {
        mapInnerHtml = '<div class="dot-goal__map-leaflet" data-map-init="0"></div>';
      } else {
        mapInnerHtml = '<img src="' + gMap + '" alt="" />';
      }

      var gTitleHtml = gTitle;
      if (gv.titleWave) {
        var _charIdx = 0;
        // Array.from handles Hangul / surrogate pairs as single chars.
        gTitleHtml = Array.from(String(gTitle)).map(function (ch) {
          if (ch === ' ') return '<span class="prox-space">&nbsp;</span>';
          if (ch === '\n') return '<br/>';
          var safe = (ch === '<') ? '&lt;'
                   : (ch === '>') ? '&gt;'
                   : (ch === '&') ? '&amp;'
                   : (ch === '"') ? '&quot;'
                   : ch;
          var span = '<span class="prox-char-once" style="--i:' + _charIdx + ';">' + safe + '</span>';
          _charIdx += 1;
          return span;
        }).join('');
      }

      return '' +
        '<div class="dot-card dot-goal" data-state="' + (gv.state || 'idle') + '">' +
          '<div class="dot-goal__main">' +
            '<div class="dot-goal__title">' + gTitleHtml + '</div>' +
            '<div class="dot-goal__unit">' +
              '<div class="dot-goal__timeRow">' +
                '<div class="dot-goal__time">' + gTime + '</div>' +
              '</div>' +
              '<div class="dot-goal__distance">' + gDist + '</div>' +
            '</div>' +
          '</div>' +
          (gv.useRealMap
            ? '<div class="dot-goal__map-slot" aria-hidden="true">' +
                '<div class="dot-goal__map-seed" aria-hidden="true"></div>' +
                '<div class="dot-goal__map">' + mapInnerHtml + '</div>' +
              '</div>'
            : '<div class="dot-goal__map" aria-hidden="true">' + mapInnerHtml + '</div>') +
        '</div>';
    }

    case 'composite-set': {
      var cv = (comp && comp.variant) || {};
      var children = cv.children || [];
      if (_isTest2Scope()) {
        var scheduleOnly = null;
        for (var sci = 0; sci < children.length; sci++) {
          var srole = children[sci] && children[sci].role;
          if (srole === 'dot-schedule-4x2' || srole === 'dot-schedule-2x2') {
            scheduleOnly = children[sci];
            break;
          }
        }
        if (scheduleOnly) {
          return _renderP2ContactList(scheduleOnly.variant || {}, { w: 340, h: (rect && rect.h) || 168 });
        }
      }
      var targetRect = rect || { w: 340, h: 340 };
      var maxBottom = 0;
      children.forEach(function(child) {
        maxBottom = Math.max(maxBottom, (child.y || 0) + (child.h || 0));
      });
      var containerH = Math.max(targetRect.h || 168, maxBottom);

      var html = '<div class="composite-set-container" style="position:relative; width:340px; height:'+containerH+'px; overflow:visible; background:transparent !important; border:none !important;">';
      children.forEach(function(child) {
        var childHtml = window.renderAtomicForRole({ role: child.role, variant: child.variant || {} }, { w: child.w, h: child.h });
        var left = child.x || 0;
        var top = child.y || 0;
        var isMusic = child.role === 'dot-music-1x1';
        // For wide child components, ensure they take full width instead of hardcoded width
        var widthStyle = (child.w === 340) ? 'width:100%;' : 'width:' + (child.w || 0) + 'px;';
        html += '<div class="composite-child' + (isMusic ? ' is-orange' : '') + '" data-comp-role="' + child.role + '" style="position:absolute; left:' + left + 'px; top:' + top + 'px; ' + widthStyle + ' height:' + (child.h || 0) + 'px; overflow:visible;">' + childHtml + '</div>';
      });
      html += '</div>';
      return html;
    }

    case 'dot-call': {
      var cv = (comp && comp.variant) || {};
      var cName = cv.name || 'Michael Jones';
      var cPhone = cv.phone || '+1 (555) 456-7890';
      // Always show a person image (fallback to bundled avatar).
      var avatar = cv.avatar || '/assets/avatar-michael.png';
      var avatarHtml =
        '<img class="dot-call__avatarImg" src="' + avatar + '" alt="" ' +
          'onerror="this.onerror=null;this.src=\'/assets/avatar-michael.png\';" />';
      return '' +
        '<div class="dot-card dot-call" data-state="' + (cv.state || 'idle') + '">' +
          '<div class="dot-call__avatar">' + avatarHtml + '</div>' +
          '<div class="dot-call__text">' +
            '<div class="dot-call__name">' + cName + '</div>' +
            '<div class="dot-call__phone">' + cPhone + '</div>' +
          '</div>' +
          '<div class="dot-call__arrow">' +
            // Same arrow geometry/direction as Running coach; only color differs.
            '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<circle class="dot-call-arrow-dot dot-call-arrow-dot--0" cx="6" cy="16" r="2.1" fill="#FF7F24" opacity="0" />' +
              '<circle class="dot-call-arrow-dot dot-call-arrow-dot--1" cx="10.2" cy="16" r="2.1" fill="#FF7F24" opacity="0" />' +
              '<circle class="dot-call-arrow-dot dot-call-arrow-dot--2" cx="14.4" cy="16" r="2.1" fill="#FF7F24" opacity="0" />' +
              '<circle class="dot-call-arrow-dot dot-call-arrow-dot--3" cx="18.6" cy="16" r="2.1" fill="#FF7F24" opacity="0" />' +
              '<circle class="dot-call-arrow-dot dot-call-arrow-dot--4" cx="22.8" cy="16" r="2.1" fill="#FF7F24" opacity="0" />' +
              '<circle class="dot-call-arrow-dot dot-call-arrow-dot--5" cx="27" cy="16" r="2.1" fill="#FF7F24" opacity="0" />' +
              '<circle class="dot-call-arrow-dot dot-call-arrow-dot--6" cx="22.8" cy="11.8" r="2.1" fill="#FF7F24" opacity="0" />' +
              '<circle class="dot-call-arrow-dot dot-call-arrow-dot--7" cx="18.6" cy="7.6" r="2.1" fill="#FF7F24" opacity="0" />' +
              '<circle class="dot-call-arrow-dot dot-call-arrow-dot--8" cx="22.8" cy="20.2" r="2.1" fill="#FF7F24" opacity="0" />' +
              '<circle class="dot-call-arrow-dot dot-call-arrow-dot--9" cx="18.6" cy="24.4" r="2.1" fill="#FF7F24" opacity="0" />' +
            '</svg>' +
          '</div>' +
        '</div>';
    }

    case 'health-header':
      return '<div style="width:100%;height:100%;display:flex;align-items:center;font-family:var(--font);font-weight:700;font-size:26.6px;color:#000;">오늘의 러닝 브리프</div>';
    case 'health-brief':
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;font-family:var(--font);font-weight:400;font-size:16.3px;color:#000;line-height:1.3;">오늘의 에너지 점수는 매우 좋음입니다.<br/>5.2km 코스를 준비했어요.</div>';
    case 'health-goal-card':
      return '<div style="width:100%;height:100%;background:#1A1D1C;border-radius:10.5px;padding:15px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;color:#fff;position:relative;overflow:hidden;">' +
        '<div style="font-family:var(--font);font-weight:600;font-size:15.7px;margin-bottom:10px;">오늘의 목표</div>' +
        '<div style="display:flex;align-items:baseline;gap:10px;">' +
          '<div style="font-family:var(--font-dot);font-size:35.3px;letter-spacing:3.5px;">01:42:43</div>' +
          '<div style="font-family:var(--font);font-weight:400;font-size:10.5px;opacity:0.8;">이내에</div>' +
        '</div>' +
        '<div style="position:absolute;right:15px;top:50%;transform:translateY(-50%);font-family:var(--font-dot);font-size:35.3px;letter-spacing:3.5px;">15km</div>' +
      '</div>';
    case 'health-course-card':
      return '<div style="width:100%;height:100%;background:url(\'https://www.figma.com/api/mcp/asset/6e2b38ba-80aa-48e9-8f64-d1c437032962\') center/cover;border-radius:32px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;position:relative;overflow:hidden;pointer-events:none;">' +
        '<div style="font-family:var(--font);font-weight:700;font-size:15.7px;margin-bottom:10px;text-shadow:0 1px 4px rgba(0,0,0,0.4);">추천 코스</div>' +
        '<div style="width:50px;height:36px;transform:rotate(90deg);"><img src="https://www.figma.com/api/mcp/asset/7b08d885-48a8-4676-811c-0bb3624cd11f" style="width:100%;height:100%;filter:drop-shadow(0 1px 4px rgba(0,0,0,0.4));"/></div>' +
        '<div style="position:absolute;left:12px;bottom:10px;display:flex;align-items:center;gap:4px;opacity:0.8;">' +
          '<svg width="60" height="12" viewBox="0 0 60 12" fill="none"><path d="M5.5 2h1v8h-1V2zM2 4h1v6H2V4zm7 0h1v6H9V4zm3.5-2h1v8h-1V2zM16 4h1v6h-1V4zm3.5 0h1v6h-1V4z" fill="white" opacity="0.6"/><text x="22" y="10" fill="white" font-size="8" font-family="sans-serif" font-weight="bold">mapbox</text></svg>' +
          '<div style="width:10px;height:10px;border-radius:50%;border:1px solid white;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:bold;">i</div>' +
        '</div>' +
      '</div>';
    case 'health-weather-card':
      return '<div style="width:100%;height:100%;background:#FFB01C;border-radius:97px;padding:0 24px;box-sizing:border-box;display:flex;align-items:center;gap:15px;color:#1B1C21;">' +
        '<img src="https://www.figma.com/api/mcp/asset/e71720af-6f3d-4797-801a-06375bc13590" style="width:35px;height:35px;"/>' +
        '<div style="display:flex;flex-direction:column;align-items:center;flex:1;">' +
          '<div style="font-family:var(--font);font-weight:600;font-size:13.2px;">Sydney</div>' +
          '<div style="font-family:var(--font);font-weight:600;font-size:13.2px;">Sunny</div>' +
        '</div>' +
      '</div>';
    case 'health-jogging-card':
      return '<div style="width:100%;height:100%;background:#1A1D1C;border-radius:97px;padding:0 33px;box-sizing:border-box;display:flex;align-items:center;gap:15px;color:#FFB01C;">' +
        '<img src="https://www.figma.com/api/mcp/asset/a5f7bc1d-9edb-4f62-9cbe-7810b2b03ecc" style="width:19px;height:24px;"/>' +
        '<div style="display:flex;flex-direction:column;align-items:center;flex:1;">' +
          '<div style="font-family:var(--font);font-weight:600;font-size:13.2px;">조깅</div>' +
          '<div style="font-family:var(--font);font-weight:600;font-size:13.2px;">10:35</div>' +
        '</div>' +
      '</div>';
    case 'health-course-card':
      return '<div class="health-course-card" style="width:100%;height:100%;border-radius:32px;background:#1A1D1C;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#fff;position:relative;overflow:hidden;pointer-events:none;">' +
        '<img src="https://www.figma.com/api/mcp/asset/ff01314a-579c-4934-8035-7140e6988894" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.25));" />' +
        '<div style="position:relative;z-index:1;text-align:center;">' +
          '<div style="font-family:var(--font);font-weight:700;font-size:18px;text-shadow:0 2px 4px rgba(0,0,0,0.5);">추천 코스</div>' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="margin-top:8px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">' +
            '<path d="M5 12h14M12 5l7 7-7 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</div>' +
        '<div style="position:absolute;left:12px;bottom:12px;z-index:1;display:flex;align-items:center;gap:4px;">' +
          '<svg width="50" height="12" viewBox="0 0 65 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.2 3.4c-1.3 0-2.3.4-3.1 1.2V3.6H3.6v8.8h3.5V8.1c0-1.1.7-1.8 1.7-1.8.9 0 1.5.6 1.5 1.7v4.4h3.5V7.6c0-2.6-1.5-4.2-3.6-4.2zM21.5 3.4c-1.3 0-2.3.4-3.1 1.2V3.6h-3.5v8.8h3.5V8.1c0-1.1.7-1.8 1.7-1.8.9 0 1.5.6 1.5 1.7v4.4h3.5V7.6c0-2.6-1.5-4.2-3.6-4.2zM32.8 3.4c-1.3 0-2.3.4-3.1 1.2V3.6h-3.5v8.8h3.5V8.1c0-1.1.7-1.8 1.7-1.8.9 0 1.5.6 1.5 1.7v4.4h3.5V7.6c0-2.6-1.5-4.2-3.6-4.2zM43.1 3.4c-2.4 0-4.3 1.9-4.3 4.5s1.9 4.5 4.3 4.5c1.1 0 2.2-.5 2.9-1.3v1.1h3.5V3.6h-3.5v1.1c-.7-.8-1.8-1.3-2.9-1.3zm0 6.2c-1 0-1.8-.8-1.8-1.7s.8-1.7 1.8-1.7 1.8.8 1.8 1.7-.8 1.7-1.8 1.7zM54.4 3.4c-2.4 0-4.3 1.9-4.3 4.5s1.9 4.5 4.3 4.5c1.1 0 2.2-.5 2.9-1.3v1.1h3.5V0h-3.5v4.7c-.7-.8-1.8-1.3-2.9-1.3zm0 6.2c-1 0-1.8-.8-1.8-1.7s.8-1.7 1.8-1.7 1.8.8 1.8 1.7-.8 1.7-1.8 1.7z" fill="white" fill-opacity="0.6"/></svg>' +
          '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" stroke="white" stroke-opacity="0.6" stroke-width="1.2"/><path d="M8 11V7.5M8 5.5V5" stroke="white" stroke-opacity="0.6" stroke-width="1.2" stroke-linecap="round"/></svg>' +
        '</div>' +
      '</div>';

    case 'dot-gallery-img': {
      var gv = (comp && comp.variant) || {};
      var active = gv.activeIndex != null ? gv.activeIndex : 0;
      var img = gv.img || '/assets/dot-gallery/image-114131.png';
      var imgHtml = img ? '<img class="dot-gimg__img" src="' + img + '" alt="" />' : '';
      return '' +
        '<div class="dot-card dot-gimg" data-state="' + (gv.state || 'idle') + '">' +
          imgHtml +
          '<div class="dot-gimg__fade" aria-hidden="true"></div>' +
          '<div class="dot-gimg__dots" aria-hidden="true">' +
            '<span class="' + (active === 0 ? 'is-active' : '') + '"></span>' +
            '<span class="' + (active === 1 ? 'is-active' : '') + '"></span>' +
            '<span class="' + (active === 2 ? 'is-active' : '') + '"></span>' +
            '<span class="' + (active === 3 ? 'is-active' : '') + '"></span>' +
          '</div>' +
        '</div>';
    }

    case 'dot-gallery-frame1': {
      var f1v = (comp && comp.variant) || {};
      var labs = Array.isArray(f1v.labels) ? f1v.labels : ['18','19','20','21','22','23','24','25','Today'];
      // 3×3 tiles (48×48) with per-tile image geometry per Figma.
      // Use per-tile images when provided (thumb-2..thumb-10), fallback to legacy single image.
      var imgSrc = f1v.img || '/assets/dot-gallery/image-114131.png';
      var imgs = Array.isArray(f1v.imgs) ? f1v.imgs : null;
      var geom = [
        // 0: image114307 (flip)
        'width:69.43px;height:92.58px;left:calc(50% - 69.43px/2 + 0.7px);top:calc(50% - 92.58px/2 + 0.74px);transform:scaleX(-1);',
        // 1: image114306 (flip) ·height only, left/right/top
        'height:91.21px;left:-3.07px;right:-0.22px;top:-32.79px;transform:scaleX(-1);',
        // 2: image114305
        'height:64.73px;left:-3.08px;right:-1.06px;top:-12.3px;',
        // 3: image114308
        'height:83.94px;left:0px;right:0.8px;top:-13.32px;',
        // 4: image114309
        'width:68.54px;height:91.38px;left:calc(50% - 68.54px/2 + 6.14px);top:calc(50% - 91.38px/2 + 8.34px);',
        // 5: image114310
        'width:50.51px;height:67.26px;left:calc(50% - 50.51px/2 + 0.2px);top:calc(50% - 67.26px/2 + 8.58px);',
        // 6: image114311 (flip)
        'width:61.58px;height:109.5px;left:calc(50% - 61.58px/2 + 0.53px);top:calc(50% - 109.5px/2 - 15.39px);transform:scaleX(-1);',
        // 7: image114312
        'height:84.27px;left:-6.15px;right:-2.06px;top:-22.55px;',
        // 8: image114313
        'width:48.81px;height:86.77px;left:calc(50% - 48.81px/2 + 0.38px);top:calc(50% - 86.77px/2 + 0.91px);'
      ];
      if (typeof window !== 'undefined' && !window.__dotGalleryFrame1Focus) {
        window.__dotGalleryFrame1Focus = function (cell) {
          var frame = cell && cell.parentNode;
          if (!frame || !frame.closest) return;
          if (!frame.closest('.detail-stage') && !frame.closest('#canvas') && !frame.closest('#theme-container') && !frame.classList.contains('dot-gframe3')) return;
          var cells = Array.prototype.slice.call(frame.children).filter(function (item) {
            return item.classList && item.classList.contains('dot-gcell');
          });
          var activeIndex = cells.indexOf(cell);
          if (activeIndex < 0) return;

          var fromLeft = cell.offsetLeft;
          var fromTop = cell.offsetTop;
          var targetLeft = Math.min(Math.max(fromLeft, 1), 57);
          var targetTop = Math.min(Math.max(fromTop, 1), 113);
          var smallSlots = [
            { left: 1, top: 1 },
            { left: 57, top: 1 },
            { left: 113, top: 1 },
            { left: 1, top: 57 },
            { left: 57, top: 57 },
            { left: 113, top: 57 },
            { left: 1, top: 113 },
            { left: 57, top: 113 },
            { left: 113, top: 113 },
            { left: 1, top: 169 },
            { left: 57, top: 169 },
            { left: 113, top: 169 }
          ];
          var slots = smallSlots.filter(function (slot) {
            return slot.left + 48 <= targetLeft ||
              slot.left >= targetLeft + 104 ||
              slot.top + 48 <= targetTop ||
              slot.top >= targetTop + 104;
          });
          var neededSlots = Math.max(0, cells.length - 1);
          // Prefer non-overlapping slots; if there aren't enough, fall back to the remaining slots
          // so we never crash on `slot.left` during layout.
          if (slots.length < neededSlots) {
            var seen = {};
            slots.forEach(function (s) {
              seen[s.left + ',' + s.top] = 1;
            });
            smallSlots.forEach(function (s) {
              var key = s.left + ',' + s.top;
              if (!seen[key]) slots.push(s);
            });
          }
          slots = slots.slice(0, neededSlots);

          frame.classList.add('is-focus');
          cells.forEach(function (item) {
            item.classList.remove('is-selected');
            item.style.animation = 'none';
            item.style.removeProperty('--dot-gallery-origin-left');
            item.style.removeProperty('--dot-gallery-origin-top');
            item.style.removeProperty('--dot-gallery-target-left');
            item.style.removeProperty('--dot-gallery-target-top');
          });

          var slotIndex = 0;
          cells.forEach(function (item, index) {
            item.style.position = 'absolute';
            item.style.width = '48px';
            item.style.height = '48px';
            item.style.borderRadius = '23.5714px';
            if (index === activeIndex) {
              item.style.left = fromLeft + 'px';
              item.style.top = fromTop + 'px';
              item.style.setProperty('--dot-gallery-origin-left', fromLeft + 'px');
              item.style.setProperty('--dot-gallery-origin-top', fromTop + 'px');
              item.style.setProperty('--dot-gallery-target-left', targetLeft + 'px');
              item.style.setProperty('--dot-gallery-target-top', targetTop + 'px');
              void item.offsetWidth;
              item.style.removeProperty('animation');
              item.classList.add('is-selected');
              return;
            }
            var slot = slots[slotIndex++] || smallSlots[(slotIndex - 1) % smallSlots.length] || { left: 1, top: 1 };
            item.style.left = slot.left + 'px';
            item.style.top = slot.top + 'px';
          });
        };
      }
      var out = '<div class="dot-card dot-gframe1" data-state="' + (f1v.state || 'idle') + '">';
      for (var i = 0; i < 9; i++) {
        var label = labs[i] != null ? String(labs[i]) : String(i + 18);
        var isToday = (i === 8);
        var src = (imgs && imgs[i]) ? imgs[i] : imgSrc;
        out += '' +
          '<div class="dot-gcell' + (isToday ? ' is-today' : '') + '" onclick="window.__dotGalleryFrame1Focus&&window.__dotGalleryFrame1Focus(this)" role="button" tabindex="0">' +
            '<img class="dot-gcell__img" src="' + src + '" alt="" style="--dot-gallery-img-x:' + (geom[i].indexOf('transform:scaleX(-1)') !== -1 ? '-1' : '1') + ';" onerror="this.style.display=`none`;" />' +
            '<div class="dot-gcell__shade" aria-hidden="true"></div>' +
            '<div class="dot-gcell__label' + (isToday ? ' is-today' : '') + '">' + label + '</div>' +
          '</div>';
      }
      out += '</div>';
      return out;
    }

    case 'dot-gallery-frame3': {
      var f3v = (comp && comp.variant) || {};
      var active3 = f3v.activeIndex != null ? f3v.activeIndex : 0;
      var labs3 = Array.isArray(f3v.labels) ? f3v.labels : ['18','19','20','21','22','23','24','25','Today'];
      // Tile layout: big tile + right column, with dot pagination.
      var imgSrc3 = f3v.img || '/assets/dot-gallery/image-114131.png';
      var imgs3 = Array.isArray(f3v.imgs) ? f3v.imgs : null;
      if (typeof window !== 'undefined' && !window.__dotGalleryFrame3PreviewLoop) {
        window.__dotGalleryFrame3PreviewLoop = function (frame) {
          if (!frame || frame.__dotGalleryFrame3PreviewLoopStarted) return;
          if (!frame.closest || !frame.closest('.preview-cell')) return;
          frame.__dotGalleryFrame3PreviewLoopStarted = true;
          var order = [2, 4, 7, 1, 6, 3, 8, 5, 0];
          var step = 0;
          var run = function () {
            var cells = Array.prototype.slice.call(frame.children).filter(function (item) {
              return item.classList && item.classList.contains('dot-gcell');
            });
            var cell = cells[order[step % order.length]];
            if (cell && window.__dotGalleryFrame1Focus) window.__dotGalleryFrame1Focus(cell);
            step += 1;
          };
          setTimeout(run, 500);
          setInterval(run, 1800);
        };
      }
      var tile = function (label, isBig, op, src) {
        var useSrc = src || imgSrc3;
        return '' +
          '<div class="dot-gcell dot-gtile' + (isBig ? ' is-big' : '') + '" onclick="window.__dotGalleryFrame1Focus&&window.__dotGalleryFrame1Focus(this)" role="button" tabindex="0">' +
            '<img class="dot-gcell__img dot-gtile__img" src="' + useSrc + '" alt="" style="--op:' + op + ';--dot-gallery-img-x:1;" onerror="this.style.display=`none`;" />' +
            '<div class="dot-gcell__shade dot-gtile__shade" aria-hidden="true"></div>' +
            '<div class="dot-gcell__label dot-gtile__label">' + label + '</div>' +
          '</div>';
      };
      return '' +
        '<div class="dot-card dot-gframe3 is-focus" data-state="' + (f3v.state || 'idle') + '" onmouseenter="window.__dotGalleryFrame3PreviewLoop&&window.__dotGalleryFrame3PreviewLoop(this)" onanimationstart="window.__dotGalleryFrame3PreviewLoop&&window.__dotGalleryFrame3PreviewLoop(this)">' +
          tile(labs3[0] || '18', true, '28% 28%', (imgs3 && imgs3[0]) ? imgs3[0] : null) +
            tile(labs3[1] || '19', false, '70% 18%', (imgs3 && imgs3[1]) ? imgs3[1] : null) +
            tile(labs3[2] || '20', false, '82% 35%', (imgs3 && imgs3[2]) ? imgs3[2] : null) +
            tile(labs3[3] || '21', false, '60% 30%', (imgs3 && imgs3[3]) ? imgs3[3] : null) +
            tile(labs3[4] || '22', false, '60% 30%', (imgs3 && imgs3[4]) ? imgs3[4] : null) +
            tile(labs3[5] || '23', false, '60% 30%', (imgs3 && imgs3[5]) ? imgs3[5] : null) +
            tile(labs3[6] || '24', false, '60% 30%', (imgs3 && imgs3[6]) ? imgs3[6] : null) +
            tile(labs3[7] || '25', false, '60% 30%', (imgs3 && imgs3[7]) ? imgs3[7] : null) +
            tile(labs3[8] || 'Today', false, '60% 30%', (imgs3 && imgs3[8]) ? imgs3[8] : null) +
          '<div class="dot-gframe3__dots" aria-hidden="true">' +
            '<span class="' + (active3 === 0 ? 'is-active' : '') + '"></span>' +
            '<span class="' + (active3 === 1 ? 'is-active' : '') + '"></span>' +
            '<span class="' + (active3 === 2 ? 'is-active' : '') + '"></span>' +
            '<span class="' + (active3 === 3 ? 'is-active' : '') + '"></span>' +
          '</div>' +
        '</div>';
    }

    case 'dot-camera': {
      var camv = (comp && comp.variant) || {};
      return '' +
        '<div class="dot-cam dot-camera-motion" data-state="' + (camv.state || 'idle') + '">' +
          '<div class="dot-camera-motion__intro" aria-hidden="true">' +
            '<svg class="dot-camera-motion__introIcon" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M6.66667 28C5.93333 28 5.30556 27.7389 4.78333 27.2167C4.26111 26.6944 4 26.0667 4 25.3333V20H6.66667V25.3333H12V28H6.66667ZM20 28V25.3333H25.3333V20H28V25.3333C28 26.0667 27.7389 26.6944 27.2167 27.2167C26.6944 27.7389 26.0667 28 25.3333 28H20ZM4 12V6.66667C4 5.93333 4.26111 5.30556 4.78333 4.78333C5.30556 4.26111 5.93333 4 6.66667 4H12V6.66667H6.66667V12H4ZM25.3333 12V6.66667H20V4H25.3333C26.0667 4 26.6944 4.26111 27.2167 4.78333C27.7389 5.30556 28 5.93333 28 6.66667V12H25.3333Z" fill="#1A1D1C"/>' +
              '<path fill-rule="evenodd" clip-rule="evenodd" d="M16.0003 18.667C17.4731 18.667 18.667 17.4731 18.667 16.0003C18.667 14.5276 17.4731 13.3337 16.0003 13.3337C14.5276 13.3337 13.3337 14.5276 13.3337 16.0003C13.3337 17.4731 14.5276 18.667 16.0003 18.667ZM16.0003 21.3337C18.9458 21.3337 21.3337 18.9458 21.3337 16.0003C21.3337 13.0548 18.9458 10.667 16.0003 10.667C13.0548 10.667 10.667 13.0548 10.667 16.0003C10.667 18.9458 13.0548 21.3337 16.0003 21.3337Z" fill="#1A1D1C"/>' +
            '</svg>' +
          '</div>' +
          '<div class="camera-widget-key-color-ver" aria-hidden="true">' +
            '<div class="camera-widget__img"></div>' +
            '<div class="camera-widget__bg-gradient"></div>' +
            '<div class="camera-widget__shot-button">' +
              '<div class="camera-widget__shot-button-graphic"></div>' +
            '</div>' +
            '<div class="camera-widget__expand-button">' +
              '<svg class="camera-widget__expand-svg" width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M23 8C22.7348 8 22.4804 8.10536 22.2929 8.29289C22.1054 8.48043 22 8.73478 22 9C22 9.26522 22.1054 9.51957 22.2929 9.70711C22.4804 9.89464 22.7348 10 23 10H24.586L20.293 14.293C20.1108 14.4816 20.01 14.7342 20.0123 14.9964C20.0146 15.2586 20.1198 15.5094 20.3052 15.6948C20.4906 15.8802 20.7414 15.9854 21.0036 15.9877C21.2658 15.99 21.5184 15.8892 21.707 15.707L26 11.414V13C26 13.2652 26.1054 13.5196 26.2929 13.7071C26.4804 13.8946 26.7348 14 27 14C27.2652 14 27.5196 13.8946 27.7071 13.7071C27.8946 13.5196 28 13.2652 28 13V9C28 8.73478 27.8946 8.48043 27.7071 8.29289C27.5196 8.10536 27.2652 8 27 8H23ZM10 24.586V23C10 22.7348 9.89464 22.4804 9.70711 22.2929C9.51957 22.1054 9.26522 22 9 22C8.73478 22 8.48043 22.1054 8.29289 22.2929C8.10536 22.4804 8 22.7348 8 23V27C8 27.2652 8.10536 27.5196 8.29289 27.7071C8.48043 27.8946 8.73478 28 9 28H13C13.2652 28 13.5196 27.8946 13.7071 27.7071C13.8946 27.5196 14 27.2652 14 27C14 26.7348 13.8946 26.4804 13.7071 26.2929C13.5196 26.1054 13.2652 26 13 26H11.414L15.707 21.707C15.8892 21.5184 15.99 21.2658 15.9877 21.0036C15.9854 20.7414 15.8802 20.4906 15.6948 20.3052C15.5094 20.1198 15.2586 20.0146 14.9964 20.0123C14.7342 20.01 14.4816 20.1108 14.293 20.293L10 24.586Z" fill="white"/>' +
              '</svg>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    case 'dot-music-1x1': {
      var mv = (comp && comp.variant) || {};
      var isTest3Music =
        (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3') ||
        (document.body && document.body.dataset && document.body.dataset.mlpTest === 'test3');
      var expandedBarW = mv.expandedBarFull != null ? mv.expandedBarFull : 292;
      var expandedBarTrack = mv.expandedBarTrack != null ? mv.expandedBarTrack : 77;
      var iconTitle = mv.iconTitle || '가벼운 러닝에는 부드럽고 상쾌한\nConcierto가 좋을거같아요!';
      var iconSubtitle = mv.iconSubtitle || 'Jim Hall - Concierto';
      if (isTest3Music) {
        iconTitle = TEST3_MUSIC_TITLE;
        iconSubtitle = 'M83 - Midnight City';
      }
      var iconHtml = window.renderAtomicForRole({
        role: 'dot-music-1x2-icon',
        variant: {
          title: iconTitle,
          subtitle: iconSubtitle,
          barFull: expandedBarW,
          barTrack: expandedBarTrack
        }
      }, rect);
      // Search/loading copy that appears WHILE the LLM resolves a real
      // track recommendation. Previously a generic "운동할 때 듣기 좋은
      // 곡을 찾아드릴게요"; now references the three real factors the
      // recommendation actually uses — pace BPM, weather tone, distance-
      // based historical preference — to make the wait feel like the AI
      // is actively reasoning about THIS run. Uses {weather} / {distance}
      // template substitution from the searchWeather / searchDistance
      // overrides (defaults: '비 오는 날' / '5km').
      var _sw = mv.searchWeather  || '비 오는 날';
      var _sd = mv.searchDistance || '5km';
      var compactTitle = mv.compactTitle || (_sw + ' ' + _sd + ' 러닝에 맞는\nBPM과 선호 톤으로\n트랙을 찾고 있어요');
      var compactIconHtml = '' +
        '<svg class="dot-music1__noteSvg" width="32" height="32" viewBox="-2 -2 68 68" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<circle cx="19.85" cy="3.49" r="3.5" fill="#000000"/><circle cx="27.98" cy="3.49" r="3.5" fill="#000000"/><circle cx="35.66" cy="3.49" r="3.5" fill="#000000"/><circle cx="44.25" cy="3.49" r="3.5" fill="#000000"/><circle cx="52.39" cy="3.49" r="3.5" fill="#000000"/><circle cx="60.52" cy="3.49" r="3.5" fill="#000000"/>' +
          '<circle cx="19.85" cy="11.62" r="3.5" fill="#000000"/><circle cx="27.98" cy="11.62" r="3.5" fill="#000000"/><circle cx="35.66" cy="11.62" r="3.5" fill="#000000"/><circle cx="44.25" cy="11.62" r="3.5" fill="#000000"/><circle cx="52.39" cy="11.62" r="3.5" fill="#000000"/><circle cx="60.52" cy="11.62" r="3.5" fill="#000000"/>' +
          '<circle cx="19.85" cy="19.76" r="3.5" fill="#000000"/><circle cx="27.98" cy="19.76" r="3.5" fill="#000000"/><circle cx="35.66" cy="19.76" r="3.5" fill="#000000"/><circle cx="44.25" cy="19.76" r="3.5" fill="#000000"/><circle cx="52.39" cy="19.76" r="3.5" fill="#000000"/><circle cx="60.52" cy="19.76" r="3.5" fill="#000000"/>' +
          '<circle cx="19.85" cy="28.80" r="3.5" fill="#000000"/><circle cx="60.52" cy="28.80" r="3.5" fill="#000000"/>' +
          '<circle cx="19.85" cy="36.94" r="3.5" fill="#000000"/><circle cx="60.52" cy="36.94" r="3.5" fill="#000000"/>' +
          '<circle cx="19.85" cy="45.18" r="3.5" fill="#000000"/><circle cx="60.52" cy="45.18" r="3.5" fill="#000000"/>' +
          '<circle cx="3.49" cy="53.32" r="3.5" fill="#000000"/><circle cx="11.62" cy="53.32" r="3.5" fill="#000000"/><circle cx="19.85" cy="53.32" r="3.5" fill="#000000"/><circle cx="44.25" cy="53.32" r="3.5" fill="#000000"/><circle cx="52.39" cy="53.32" r="3.5" fill="#000000"/><circle cx="60.52" cy="53.32" r="3.5" fill="#000000"/>' +
          '<circle cx="3.49" cy="61.45" r="3.5" fill="#000000"/><circle cx="11.62" cy="61.45" r="3.5" fill="#000000"/><circle cx="44.25" cy="61.45" r="3.5" fill="#000000"/><circle cx="52.39" cy="61.45" r="3.5" fill="#000000"/>' +
        '</svg>';
      var compactHtml = isTest3Music
        ? ('<div class="dot-music1__player" aria-hidden="true">' +
            '<div class="dot-music1__iconBg">' +
              '<div class="dot-music1__musicIcon">' + compactIconHtml + '</div>' +
            '</div>' +
            '<div class="dot-music1__searchText">' +
              '<span class="dot-music1__searchLine dot-music1__searchLine--1">러닝 bgm을 찾고 있어요</span>' +
              '<span class="dot-music1__searchLine dot-music1__searchLine--2">' + TEST3_MUSIC_SEARCH_LINE2 + '</span>' +
            '</div>' +
          '</div>')
        : ('<div class="dot-music1__player" aria-hidden="true">' +
            '<div class="dot-music1__singer-name">' + String(compactTitle).replace(/\n/g, '<br/>') + '</div>' +
            '<div class="dot-music1__iconBg"></div>' +
            '<div class="dot-music1__musicIcon">' + compactIconHtml + '</div>' +
          '</div>');
      var expandedIconHtml = compactIconHtml.replace('dot-music1__noteSvg', 'dot-music1__secondNoteSvg');
      // Search-reasoning text replaces the old static "검색중이에요" with
      // three context-aware lines that cycle (800ms each) during the
      // visibility window. Three stacked <span>s + staggered opacity
      // animation lets the user see the AI's reasoning factors:
      //   1) BPM-pace match
      //   2) Weather-conditioned tone
      //   3) Distance-based historical preference
      // Placeholders {날씨} → defaults to "비 오는 날" (test3 weather is Rainy);
      // {현재 거리} → "5km" (typical training milestone). Both overridable
      // via mv.searchWeather / mv.searchDistance.
      var searchWeather  = mv.searchWeather  || '비 오는 날';
      var searchDistance = mv.searchDistance || '5km';
      // Search-reasoning copy was a 3-line cycle (BPM / weather tone /
       // distance-style) but the swap fired too quickly to be readable —
       // user direction: just show the BPM line statically. Single span,
       // no cycle, no animation; the other two factors are still implied
       // in the compact title above.
      var expandedHtml = isTest3Music
        ? ('<div class="dot-music1__secondPlayer">' +
            '<div class="dot-music1__secondIconBg"></div>' +
            '<div class="dot-music1__secondTitle">' +
              '<span class="dot-music1__reason dot-music1__reason--1">현재 페이스에 맞는 BPM</span>' +
            '</div>' +
          '</div>')
        : ('<div class="dot-music1__secondPlayer">' +
            '<div class="dot-music1__secondIconBg">' +
              '<div class="dot-music1__secondMusicIcon">' + expandedIconHtml + '</div>' +
            '</div>' +
            '<div class="dot-music1__secondTitle">' +
              '<span class="dot-music1__reason dot-music1__reason--1">현재 페이스에 맞는 BPM</span>' +
            '</div>' +
          '</div>');
      var isTabRoot = window.currentSurfaceType === window.SURFACE_TYPES.TAB_ROOT;
      var orangeClass = isTabRoot ? ' is-orange' : '';
      var test3FillHtml = isTest3Music
        ? ('<div class="test3-music-fill p2-agent-fill" aria-hidden="true">' +
            '<canvas class="test3-music-fill__gl p2-agent-fill__gl"></canvas>' +
            '<div class="p2-agent-fill__edge" aria-hidden="true"></div>' +
            '<div class="p2-agent-fill__edge-inner" aria-hidden="true"></div>' +
            '<div class="p2-agent-fill__bloom"></div>' +
            '<div class="p2-agent-fill__mist"></div>' +
            '<div class="p2-agent-fill__wave"></div>' +
          '</div>')
        : '';
      return '' +
        '<div class="dot-card dot-music dot-music1' + orangeClass + '" data-state="' + (mv.state || 'idle') + '">' +
          test3FillHtml +
          '<div class="dot-music1__compact dot-music1__compact--layout">' +
            compactHtml +
          '</div>' +
          '<div class="dot-music1__expanded" aria-hidden="true">' +
            expandedHtml +
          '</div>' +
          '<div class="dot-music1__icon" aria-hidden="true">' + iconHtml + '</div>' +
        '</div>';
    }

    case 'dot-music-1x2-actions': {
      var mv2 = (comp && comp.variant) || {};
      var artist2 = mv2.artist || 'Jimmy Hall';
      var album2 = mv2.album || 'Album';
      var song2 = mv2.song || 'Concierto';
      var current2 = mv2.current || '0:40';
      var remaining2 = mv2.remaining || '-1:10';
      var barW2 = mv2.barFull != null ? mv2.barFull : 292;
      var barTrack2 = mv2.barTrack != null ? mv2.barTrack : 77;
      var isTabRoot = window.currentSurfaceType === window.SURFACE_TYPES.TAB_ROOT;
      var orangeClass = isTabRoot ? ' is-orange' : '';
      return '' +
        '<div class="dot-card dot-music dot-music2 dot-music2--actions' + orangeClass + '" data-state="' + (mv2.state || 'idle') + '">' +
          '<div class="dot-music2__top">' +
            '<div class="dot-music2__artistBlock">' +
              '<div class="dot-music2__artist">' + artist2 + '</div>' +
              '<div class="dot-music2__album">' + album2 + '</div>' +
            '</div>' +
            '<div class="dot-music2__btnUnit" aria-hidden="true">' +
              '<div class="dot-music2__btn">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                  '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.53L12 21.35Z" fill="#000000"/>' +
                '</svg>' +
              '</div>' +
              '<div class="dot-music2__btn">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
                  '<path d="M3 5.5h18v13H3v-13Z" stroke="#000000" stroke-width="2" fill="none" />' +
                  '<path d="M5 17c1.9 0 3.6.8 4.8 2" stroke="#000000" stroke-width="2" stroke-linecap="round" fill="none" />' +
                  '<path d="M5 13.5c3.1 0 5.8 1.3 7.8 3.2" stroke="#000000" stroke-width="2" stroke-linecap="round" fill="none" />' +
                '</svg>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="dot-music__bottom dot-music2__bottom">' +
            '<div class="dot-music2__playRow">' +
              '<div class="dot-music__song">' + song2 + '</div>' +
              '<div class="dot-music2__eq" aria-hidden="true">' +
                '<div class="dot-music2__eqCol is-tall">' +
                  '<span></span><span></span><span></span><span></span><span></span>' +
                '</div>' +
                '<div class="dot-music2__eqCol is-mid">' +
                  '<span></span><span></span><span></span>' +
                '</div>' +
                '<div class="dot-music2__eqCol is-small">' +
                  '<span></span>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="dot-music__timeInfo dot-music__timeInfo--wide">' +
              '<div class="dot-music__timeRow dot-music__timeRow--wide">' +
                '<div class="dot-music__time dot-music__time--current">' + current2 + '</div>' +
                '<div class="dot-music__time dot-music__time--remaining">' + remaining2 + '</div>' +
              '</div>' +
              '<div class="dot-music__bar dot-music__bar--wide" style="--bar-w:' + barW2 + 'px;--bar-track:' + barTrack2 + 'px;">' +
                '<div class="dot-music__barFill" aria-hidden="true"></div>' +
                '<div class="dot-music__barTrack" aria-hidden="true"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    case 'dot-music-1x2-icon': {
      var mv3 = (comp && comp.variant) || {};
      var isTest3Lyrics =
        (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3') ||
        (document.body && document.body.dataset && document.body.dataset.mlpTest === 'test3');
      var title3 = mv3.title || (isTest3Lyrics
        ? TEST3_MUSIC_TITLE
        : '오늘 날씨에 딱 맞는\n플레이리스트');
      var subtitle3 = mv3.subtitle || (isTest3Lyrics ? 'M83 - Midnight City' : 'Jim Hall - Concierto');
      if (isTest3Lyrics) {
        title3 = TEST3_MUSIC_TITLE;
        subtitle3 = 'M83 - Midnight City';
      }
      var foldTitle3 = mv3.foldTitle;
      if (!foldTitle3) {
        foldTitle3 = isTest3Lyrics
          ? TEST3_MUSIC_FOLD_TITLE
          : (function () {
              var foldDash = subtitle3.indexOf(' - ');
              return foldDash >= 0 ? subtitle3.slice(foldDash + 3).trim() : subtitle3;
            })();
      }
      var barW3 = mv3.barFull != null ? mv3.barFull : (isTest3Lyrics ? 246 : 292);
      var barTrack3 = mv3.barTrack != null ? mv3.barTrack : (isTest3Lyrics ? 188 : 77);
      var safeTitle = String(title3).replace(/\n/g, '<br/>');
      // Placeholder lyrics block — visible only when the user taps the
      // card to enter the `lyrics` state. The LLM endpoint can supply
      // real lyrics via mv3.lyrics; otherwise a generic 3-line stand-in.
      var lyrics3 = mv3.lyrics ||
        '♪\n흐르는 빗방울을 따라\n페이스를 맞춰 가면\n오늘도 한 걸음 더 멀리';
      var lyricsLines = String(lyrics3).split('\n').filter(function (line) { return line.length > 0; });
      if (!lyricsLines.length) lyricsLines = ['♪'];
      function _escLyricLine(s) {
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
      var lyricsBlockHtml;
      if (isTest3Lyrics) {
        var lineHtml = lyricsLines.map(function (line) {
          return '<span class="dot-music3__lyrics-line">' + _escLyricLine(line) + '</span>';
        }).join('');
        var cloneHtml = lyricsLines.map(function (line) {
          return '<span class="dot-music3__lyrics-line dot-music3__lyrics-line--clone" aria-hidden="true">' + _escLyricLine(line) + '</span>';
        }).join('');
        lyricsBlockHtml =
          '<div class="dot-music3__lyrics dot-music3__lyrics--flow" aria-hidden="true" data-count="' + lyricsLines.length + '">' +
            '<div class="dot-music3__lyrics-scroller">' + lineHtml + cloneHtml + '</div>' +
          '</div>';
      } else {
        var safeLyrics = String(lyrics3).replace(/\n/g, '<br/>');
        lyricsBlockHtml = '<div class="dot-music3__lyrics" aria-hidden="true">' + safeLyrics + '</div>';
      }
      // Decorative music-note SVG is replaced with a play/pause button.
      // Per user direction the recommended song is already playing on
      // the device by the time this card surfaces, so initial state is
      // `playing` (the pause icon is shown). Click handling lives in
      // interaction-state.js / a delegated listener — the button just
      // toggles its own `data-music-playing` attribute, and the two
      // stacked SVGs are mutually visible via the CSS in theme-page.css
      // (.dot-music3__playIcon--play / --pause).
      var playPauseBtnHtml =
        '<button type="button" class="dot-music3__playBtn" data-music-playing="1" aria-label="Pause">' +
          '<svg class="dot-music3__playIcon dot-music3__playIcon--pause" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">' +
            '<rect x="8"  y="6" width="4" height="16" rx="1" fill="#FFFFFF"/>' +
            '<rect x="16" y="6" width="4" height="16" rx="1" fill="#FFFFFF"/>' +
          '</svg>' +
          '<svg class="dot-music3__playIcon dot-music3__playIcon--play" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">' +
            '<path d="M9 6.5 L21 14 L9 21.5 Z" fill="#FFFFFF"/>' +
          '</svg>' +
        '</button>';
      var compactHeaderHtml = isTest3Lyrics
        ? ('<span class="dot-music3__spotify" aria-hidden="true"></span>' +
            '<div class="dot-music3__compactHeader" aria-hidden="true">' +
              '<span class="dot-music3__mediaPill">미디어 출력</span>' +
            '</div>')
        : '';
      return '' +
        '<div class="dot-card dot-music dot-music3 dot-music3--icon" data-state="' + (mv3.state || 'idle') + '">' +
          compactHeaderHtml +
          '<div class="dot-music3__top">' +
            '<div class="dot-music3__icon">' +
              '<span class="dot-music3__iconBg"></span>' +
              playPauseBtnHtml +
              // Original decorative music-note SVG retained but hidden
              // — kept as a comment-style fallback in case we want to
              // toggle back to the static icon for non-test3 surfaces.
              '<svg class="dot-music3__noteSvg" width="32" height="32" viewBox="-2 -2 68 68" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:none">' +
                // Dot-note icon reconstructed from Figma ellipse positions (percent grid) ·r≈3.5 on 64 canvas
                '<circle cx="19.85" cy="3.49" r="3.5" fill="#FFFFFF"/>' +   // x=25.57, y=0
                '<circle cx="27.98" cy="3.49" r="3.5" fill="#FFFFFF"/>' +   // x=38.28, y=0
                '<circle cx="35.66" cy="3.49" r="3.5" fill="#FFFFFF"/>' +   // x=50.99, y=0
                '<circle cx="44.25" cy="3.49" r="3.5" fill="#FFFFFF"/>' +   // x=63.69, y=0
                '<circle cx="52.39" cy="3.49" r="3.5" fill="#FFFFFF"/>' +   // x=76.41, y=0
                '<circle cx="60.52" cy="3.49" r="3.5" fill="#FFFFFF"/>' +   // x=89.11, y=0

                '<circle cx="19.85" cy="11.62" r="3.5" fill="#FFFFFF"/>' +  // x=25.57, y=12.71
                '<circle cx="27.98" cy="11.62" r="3.5" fill="#FFFFFF"/>' +  // x=38.28, y=12.71
                '<circle cx="35.66" cy="11.62" r="3.5" fill="#FFFFFF"/>' +  // x=50.99, y=12.71
                '<circle cx="44.25" cy="11.62" r="3.5" fill="#FFFFFF"/>' +  // x=63.69, y=12.71
                '<circle cx="52.39" cy="11.62" r="3.5" fill="#FFFFFF"/>' +  // x=76.41, y=12.71
                '<circle cx="60.52" cy="11.62" r="3.5" fill="#FFFFFF"/>' +  // x=89.11, y=12.71

                '<circle cx="19.85" cy="19.76" r="3.5" fill="#FFFFFF"/>' +  // x=25.57, y=25.43
                '<circle cx="27.98" cy="19.76" r="3.5" fill="#FFFFFF"/>' +  // x=38.28, y=25.43
                '<circle cx="35.66" cy="19.76" r="3.5" fill="#FFFFFF"/>' +  // x=50.99, y=25.43
                '<circle cx="44.25" cy="19.76" r="3.5" fill="#FFFFFF"/>' +  // x=63.69, y=25.43
                '<circle cx="52.39" cy="19.76" r="3.5" fill="#FFFFFF"/>' +  // x=76.41, y=25.43
                '<circle cx="60.52" cy="19.76" r="3.5" fill="#FFFFFF"/>' +  // x=89.11, y=25.43

                '<circle cx="19.85" cy="28.80" r="3.5" fill="#FFFFFF"/>' +  // x=25.57, y=38.14
                '<circle cx="60.52" cy="28.80" r="3.5" fill="#FFFFFF"/>' +  // x=89.11, y=38.14

                '<circle cx="19.85" cy="36.94" r="3.5" fill="#FFFFFF"/>' +  // x=25.57, y=50.85
                '<circle cx="60.52" cy="36.94" r="3.5" fill="#FFFFFF"/>' +  // x=89.11, y=50.85

                '<circle cx="19.85" cy="45.18" r="3.5" fill="#FFFFFF"/>' +  // x=25.57, y=63.57
                '<circle cx="60.52" cy="45.18" r="3.5" fill="#FFFFFF"/>' +  // x=89.11, y=63.57

                '<circle cx="3.49"  cy="53.32" r="3.5" fill="#FFFFFF"/>' +  // x=0,     y=76.28
                '<circle cx="11.62" cy="53.32" r="3.5" fill="#FFFFFF"/>' +  // x=12.71, y=76.28
                '<circle cx="19.85" cy="53.32" r="3.5" fill="#FFFFFF"/>' +  // x=25.57, y=76.28
                '<circle cx="44.25" cy="53.32" r="3.5" fill="#FFFFFF"/>' +  // restored upper-left dot of the right note head
                '<circle cx="52.39" cy="53.32" r="3.5" fill="#FFFFFF"/>' +  // x=63.7,  y=76.28
                '<circle cx="60.52" cy="53.32" r="3.5" fill="#FFFFFF"/>' +  // x=89.11, y=76.28

                '<circle cx="3.49"  cy="61.45" r="3.5" fill="#FFFFFF"/>' +  // x=0,     y=89
                '<circle cx="11.62" cy="61.45" r="3.5" fill="#FFFFFF"/>' +  // x=12.71, y=89
                '<circle cx="44.25" cy="61.45" r="3.5" fill="#FFFFFF"/>' +
                '<circle cx="52.39" cy="61.45" r="3.5" fill="#FFFFFF"/>' +
              '</svg>' +
            '</div>' +
            '<div class="dot-music3__title">' + safeTitle + '</div>' +
          '</div>' +
          // Lyrics block — hidden by default, surfaced when the user taps
          // the card to enter `data-music-state="lyrics"`. The two-step
          // tap cycle is: normal → lyrics (tap 1) → square (tap 2) →
          // normal (tap 3). Cycle handler lives in surface-layout.js.
          lyricsBlockHtml +
          '<div class="dot-music3__playlistPill" aria-hidden="true">' +
            '<span class="dot-music3__playlistThumb" aria-hidden="true"></span>' +
            '<div class="dot-music3__playlistCopy">' +
              '<span class="dot-music3__playlistTitle">3,2,1 러닝 시작</span>' +
              '<span class="dot-music3__playlistMeta">10곡 · 38분 34초</span>' +
            '</div>' +
            '<span class="dot-music3__playlistChevron" aria-hidden="true"></span>' +
          '</div>' +
          '<div class="dot-music3__foldTitle" aria-hidden="true">' + String(foldTitle3).replace(/\n/g, '<br/>') + '</div>' +
          '<div class="dot-music__bottom dot-music3__bottom">' +
            // Name row pairs the artist/song marquee on the left with
            // the current/total track time on the right end, both
            // aligned to the bar below.
            '<div class="dot-music3__nameRow">' +
              // ScrollVelocity-style marquee: double the text inside an inner
              // flex so the second copy slides into the first copy's slot —
              // when looped (translateX by one copy-width + gap), the wrap is
              // seamless. .is-scrolling is added by _setupMusicNameMarquee
              // only when the text actually overflows the visible window.
              '<div class="dot-music3__name">' +
                '<div class="dot-music3__name-inner">' +
                  '<span class="dot-music3__name-text">' + subtitle3 + '</span>' +
                  '<span class="dot-music3__name-text" aria-hidden="true">' + subtitle3 + '</span>' +
                '</div>' +
              '</div>' +
              // Track times: current / total. Total matches the bar's
              // 180s playback animation; current is a placeholder for
              // now and can be ticked live later.
              '<div class="dot-music3__times" aria-hidden="true">' +
                '<span class="dot-music3__time--current">' + (isTest3Lyrics ? '01:35' : '0:00') + '</span>' +
                '<span class="dot-music3__time--sep"> / </span>' +
                '<span class="dot-music3__time--total">' + (isTest3Lyrics ? '02:30' : '3:00') + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="dot-music__bar dot-music__bar--wide dot-music3__bar" style="--bar-w:' + barW3 + 'px;--bar-track:' + barTrack3 + 'px;">' +
              '<div class="dot-music__barFill" aria-hidden="true"></div>' +
              '<div class="dot-music__barTrack" aria-hidden="true"></div>' +
            '</div>' +
            '<div class="dot-music3__transport" aria-hidden="true"></div>' +
            (isTest3Lyrics
              ? '<div class="dot-music3__albumCredit" aria-hidden="true">Hurry Up, We\'re Dreaming.</div>'
              : '') +
          '</div>' +
        '</div>';
    }

    case 'dot-clock-2x1': {
      var ck = (comp && comp.variant) || {};
      var t = ck.time || '11:33';
      t = t.replace(':', '<span style="font-family: ui-monospace; margin-top: -3px; display: inline-block;">:</span>');
      var p = ck.period || 'AM';
      return '' +
        '<div class="dot-card dot-clock21" data-state="' + (ck.state || 'idle') + '">' +
          '<div class="dot-clock21__time">' + t + '</div>' +
          '<div class="dot-clock21__period">' + p + '</div>' +
        '</div>';
    }

    case 'dot-time-matrix': {
      // Dot-matrix time panel:
      // - full background dot grid (inactive dots)
      // - active orange dots overlay (time + weekday + day-of-month)
      // - left aligned, no clipping from inner padding/containers
      // Also exposes data-dot-count so the lit-dot count can be verified.
      var mv = (comp && comp.variant) || {};
      var now = new Date();
      var h24 = now.getHours();
      var mm = String(now.getMinutes()).padStart(2, '0');
      var isAM = h24 < 12;
      var h12 = h24 % 12;
      if (h12 === 0) h12 = 12;
      var hh = String(h12).padStart(2, '0');
      var period = isAM ? 'AM' : 'PM';
      var weekday = ['SUN','MON','TUE','WED','THU','FRI','SAT'][now.getDay()];
      var month = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][now.getMonth()];
      var day = String(now.getDate()).padStart(2, '0');

      var lineTime = (mv.time || (hh + ':' + mm));
      var lineMeta = (mv.meta || (period + ' ' + weekday));
      // Show day-of-month as a separate 2-digit block to avoid right clipping.
      var dayDigits = (mv.dayDigits || day);

      var DOT_COLOR = mv.dotColor || 'var(--p2-lavender, #FF7F24)';
      // No solid background panel — only gray background dots.
      var BG_DOT = mv.bgDotColor || 'rgba(255,255,255,0.16)';

      // 5x7 dot matrix patterns for needed characters.
      var P = {
        '0': ['01110','10001','10001','10001','10001','10001','01110'],
        '1': ['00100','01100','00100','00100','00100','00100','01110'],
        '2': ['01110','10001','00001','00010','00100','01000','11111'],
        '3': ['11110','00001','00001','01110','00001','00001','11110'],
        '4': ['00010','00110','01010','10010','11111','00010','00010'],
        '5': ['11111','10000','10000','11110','00001','00001','11110'],
        '6': ['00110','01000','10000','11110','10001','10001','01110'],
        '7': ['11111','00001','00010','00100','01000','01000','01000'],
        '8': ['01110','10001','10001','01110','10001','10001','01110'],
        '9': ['01110','10001','10001','01111','00001','00010','11100'],
        ':': ['00000','00100','00100','00000','00100','00100','00000'],
        ' ': ['00000','00000','00000','00000','00000','00000','00000'],
        'A': ['01110','10001','10001','11111','10001','10001','10001'],
        'D': ['11110','10001','10001','10001','10001','10001','11110'],
        'E': ['11111','10000','10000','11110','10000','10000','11111'],
        'F': ['11111','10000','10000','11110','10000','10000','10000'],
        'H': ['10001','10001','10001','11111','10001','10001','10001'],
        'I': ['01110','00100','00100','00100','00100','00100','01110'],
        'J': ['00111','00010','00010','00010','00010','10010','01100'],
        'L': ['10000','10000','10000','10000','10000','10000','11111'],
        'M': ['10001','11011','10101','10101','10001','10001','10001'],
        'N': ['10001','11001','10101','10011','10001','10001','10001'],
        'O': ['01110','10001','10001','10001','10001','10001','01110'],
        'P': ['11110','10001','10001','11110','10000','10000','10000'],
        'R': ['11110','10001','10001','11110','10100','10010','10001'],
        'S': ['01111','10000','10000','01110','00001','00001','11110'],
        'T': ['11111','00100','00100','00100','00100','00100','00100'],
        'U': ['10001','10001','10001','10001','10001','10001','01110'],
        'W': ['10001','10001','10001','10101','10101','10101','01010'],
        'Y': ['10001','10001','01010','00100','00100','00100','00100']
      };

      function _normText(s) {
        return String(s || '').toUpperCase().replace(/[^0-9A-Z: ]/g, ' ');
      }

      // Panel grid (fixed): 340×180, step 8px with margin 10px.
      var panelW = 340;
      var panelH = 180;
      var step = 8;
      var margin = 10;
      var r = 2.8;
      var cols = Math.floor((panelW - margin * 2) / step) + 1;
      var rows = Math.floor((panelH - margin * 2) / step) + 1;

      function _putText(set, text, gx0, gy0) {
        var t = _normText(text);
        var charW = 5;
        var charH = 7;
        var gap = 1;
        for (var ci = 0; ci < t.length; ci++) {
          var ch = t[ci];
          var pat = P[ch] || P[' '];
          var baseX = gx0 + ci * (charW + gap);
          for (var ry = 0; ry < charH; ry++) {
            var row = pat[ry] || '00000';
            for (var rx = 0; rx < charW; rx++) {
              if (row[rx] !== '1') continue;
              var gx = baseX + rx;
              var gy = gy0 + ry;
              if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) continue;
              set[gx + ',' + gy] = 1;
            }
          }
        }
      }

      var active = {};
      // Left aligned layout: time on top, meta on bottom-left, day digits bottom-right.
      _putText(active, lineTime, 0, 2);
      _putText(active, lineMeta, 0, 11);
      _putText(active, String(dayDigits).padStart(2, '0'), cols - 11, 11);

      var isMusic = lineTime.indexOf('MUSIC') !== -1 || lineMeta.indexOf('MUSIC') !== -1;

      var bgDots = '';
      for (var yy = 0; yy < rows; yy++) {
        for (var xx = 0; xx < cols; xx++) {
          // Skip corner dots to give a rounded appearance.
          if ((xx === 0 && yy === 0) || 
              (xx === 0 && yy === rows - 1) || 
              (xx === cols - 1 && yy === 0) || 
              (xx === cols - 1 && yy === rows - 1)) {
            continue;
          }
          var cx = margin + xx * step;
          var cy = margin + yy * step;
          bgDots += '<circle class="dot-timemat__bgDot" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + BG_DOT + '" />';
        }
      }

      var onDots = '';
      var dotIndex = 0;
      for (var k in active) {
        var parts = k.split(',');
        var gx = parseInt(parts[0], 10);
        var gy = parseInt(parts[1], 10);
        
        // Skip corner dots for active overlay as well.
        if ((gx === 0 && gy === 0) || 
            (gx === 0 && gy === rows - 1) || 
            (gx === cols - 1 && gy === 0) || 
            (gx === cols - 1 && gy === rows - 1)) {
          continue;
        }

        var cx2 = margin + gx * step;
        var cy2 = margin + gy * step;
        onDots += '<circle class="dot-timemat__dot" cx="' + cx2 + '" cy="' + cy2 + '" r="' + r + '" fill="' + DOT_COLOR + '" style="--i:' + dotIndex + ';" />';
        dotIndex++;
      }
      var totalDots = dotIndex;

      var onDotsHtml = isMusic 
        ? '<g class="dot-timemat__onGroup--scroll">' + onDots + '</g>' 
        : onDots;

      return '' +
        '<div class="dot-card dot-timemat" ' +
          'data-state="' + (mv.state || 'idle') + '" ' +
          'data-dot-count="' + totalDots + '" ' +
          'data-time="' + lineTime + '" data-meta="' + lineMeta + '" data-day="' + dayDigits + '" ' +
          'title="dot-count: ' + totalDots + '">' +
          '<svg class="dot-timemat__svg" width="340" height="180" viewBox="0 0 340 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            bgDots +
            onDotsHtml +
          '</svg>' +
        '</div>';
    }

    case 'dot-schedule-2x2': {
      if (_isTest2Scope()) {
        return _renderP2ContactList((comp && comp.variant) || {}, rect);
      }
      var sv = (comp && comp.variant) || {};
      var date = sv.date || '13 May';
      var items = Array.isArray(sv.items) ? sv.items : [
        { text: 'Wild Life', tone: 'strong' },
        { text: 'Blue Mountains', tone: 'muted' },
        { text: 'Darling Harbour', tone: 'muted' },
        { text: 'Opera House', tone: 'muted' }
      ];
      while (items.length < 4) items.push({ text: 'Schedule item', tone: 'muted' });
      var row = function (it) {
        var tone = (it && it.tone) || 'muted';
        var bulletClass = tone === 'accent' ? 'is-accent' : 'is-dark';
        var textClass = tone === 'accent' ? 'is-accent' : (tone === 'strong' ? 'is-strong' : 'is-muted');
        return '' +
          '<div class="dot-sch__row">' +
            '<span class="dot-sch__bullet ' + bulletClass + '" aria-hidden="true"></span>' +
            '<span class="dot-sch__text ' + textClass + '" data-text="' + (it.text || '') + '">' + (it.text || '') + '</span>' +
          '</div>';
      };
      var expandedItems = Array.isArray(sv.expandedItems) ? sv.expandedItems : [
        { text: 'Darling Harbour', time: '9:00', note: 'Need to arrive until', tone: 'strong' },
        { text: 'Wild Life', time: '10:00', tone: 'muted' },
        { text: 'Blue Mountains', time: '14:00', tone: 'muted' },
        { text: 'Opera House', time: '18:30', tone: 'muted' }
      ];
      var expandedHtml = window.renderAtomicForRole({
        role: 'dot-schedule-4x2',
        variant: {
          date: sv.expandedDate || '13 May',
          items: expandedItems
        }
      }, rect);
      return '' +
        '<div class="dot-card dot-sch dot-sch22" data-state="' + (sv.state || 'idle') + '">' +
          '<div class="dot-sch22__compact">' +
            '<div class="dot-sch__unit">' +
              '<div class="dot-sch__date">' + date + '</div>' +
              '<div class="dot-sch__list">' +
                row(items[0]) +
                row(items[1]) +
                row(items[2]) +
                row(items[3]) +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="dot-sch22__expanded" aria-hidden="true">' + expandedHtml + '</div>' +
        '</div>';
    }

    case 'dot-schedule-4x2': {
      if (_isTest2Scope()) {
        return _renderP2ContactList((comp && comp.variant) || {}, rect);
      }
      var sv2 = (comp && comp.variant) || {};
      var date2 = sv2.date || 'May 15';
      var items2 = Array.isArray(sv2.items) ? sv2.items : [];
      while (items2.length < 4) items2.push({ text: 'Schedule item', time: '00:00', tone: 'muted' });
      var row2 = function (it) {
        var tone = (it && it.tone) || 'muted';
        var bulletClass = tone === 'accent' ? 'is-accent' : 'is-dark';
        var textClass = tone === 'accent' ? 'is-accent' : (tone === 'strong' ? 'is-strong' : 'is-muted');
        var timeClass = tone === 'strong' ? 'is-strong' : 'is-time';
        var noteHtml = it.note ? '<span class="dot-sch__time-note">' + it.note + '</span>' : '';
        return '' +
          '<div class="dot-sch__row dot-sch__row--wide' + (it.note ? ' dot-sch__row--has-note' : '') + '">' +
            '<span class="dot-sch__bullet ' + bulletClass + '" aria-hidden="true"></span>' +
            '<span class="dot-sch__text ' + textClass + '">' + (it.text || '') + '</span>' +
            noteHtml +
            '<span class="dot-sch__time ' + timeClass + '">' + (it.time || '') + '</span>' +
          '</div>';
      };
      return '' +
        '<div class="dot-card dot-sch dot-sch42" data-state="' + (sv2.state || 'idle') + '">' +
          '<div class="dot-sch__unit dot-sch__unit--wide">' +
            '<div class="dot-sch__date dot-sch__date--wide">' + date2 + '</div>' +
            '<div class="dot-sch__list dot-sch__list--wide">' +
              row2(items2[0]) +
              row2(items2[1]) +
              row2(items2[2]) +
              row2(items2[3]) +
            '</div>' +
          '</div>' +
        '</div>';
    }

    case 'dot-total-steps-2x1': {
      var st = (comp && comp.variant) || {};
      if (st.pacePill) {
        var pp = st.pacePill;
        var ppTitle = pp.title || '러닝 페이스';
        var ppSub = pp.subtitle || '현재 7\'00"';
        var ppExpandTitle = pp.expandTitle || ppTitle;
        var ppIconHtml =
          '<div class="dot-steps21__pillIcon" aria-hidden="true">' +
            '<span class="dot-steps21__pillIconBg"></span>' +
            '<img class="dot-steps21__pillIconMark" src="/assets/test3-running-icon.svg" alt="" aria-hidden="true">' +
          '</div>';
        var ppCompactHtml =
          '<div class="dot-steps21__compact" aria-hidden="false">' +
            '<div class="dot-steps21__pillRow">' +
              '<div class="dot-steps21__pillCopy">' +
                '<div class="dot-steps21__pillTitle">' + ppTitle + '</div>' +
                '<div class="dot-steps21__pillSub">' + ppSub + '</div>' +
              '</div>' +
              ppIconHtml +
            '</div>' +
          '</div>';
        var ppWaveHtml =
          '<svg class="dot-steps21__paceWave" width="92" height="28" viewBox="0 0 92 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<defs>' +
              '<linearGradient id="test3PaceWaveGrad" x1="0" y1="14" x2="92" y2="14" gradientUnits="userSpaceOnUse">' +
                '<stop stop-color="#FF6B4A"/><stop offset="0.35" stop-color="#FF4FA3"/>' +
                '<stop offset="0.65" stop-color="#8B5CF6"/><stop offset="1" stop-color="#2563EB"/>' +
              '</linearGradient>' +
            '</defs>' +
            '<ellipse cx="12" cy="14" rx="5" ry="11" fill="url(#test3PaceWaveGrad)"/>' +
            '<ellipse cx="24" cy="14" rx="4" ry="8" fill="url(#test3PaceWaveGrad)"/>' +
            '<ellipse cx="36" cy="14" rx="6" ry="13" fill="url(#test3PaceWaveGrad)"/>' +
            '<ellipse cx="50" cy="14" rx="5" ry="10" fill="url(#test3PaceWaveGrad)"/>' +
            '<ellipse cx="62" cy="14" rx="4" ry="7" fill="url(#test3PaceWaveGrad)"/>' +
            '<ellipse cx="74" cy="14" rx="6" ry="12" fill="url(#test3PaceWaveGrad)"/>' +
            '<ellipse cx="86" cy="14" rx="4" ry="9" fill="url(#test3PaceWaveGrad)"/>' +
          '</svg>';
        var ppExpandedHtml =
          '<div class="dot-steps21__expanded" aria-hidden="true">' +
            '<div class="dot-steps21__pillTitle dot-steps21__pillTitle--solo">' + ppExpandTitle + '</div>' +
            ppWaveHtml +
            ppIconHtml +
          '</div>';
        return '' +
          '<div class="dot-card dot-steps21 dot-steps21--pace-pill dot-steps21--expandable" data-state="' + (st.state || 'idle') + '">' +
            ppCompactHtml +
            ppExpandedHtml +
          '</div>';
      }
      // Two render modes, switched by variant:
      var stTitle = st.title || 'TOTAL STEPS';
      var stCycle = (st.cycleLines && st.cycleLines.length) ? st.cycleLines : null;
      var contentHtml;
      if (stCycle) {
        // Two cycle modes:
        //   default 'scroll' — scroll-float vertical translate (clone at end)
        //   'fade'           — opacity cross-fade (lines stack, no translate)
        // Today Progress uses 'fade' (per user direction) so the rotation
        // feels quieter than the more pronounced vertical scroll used on
        // the Weather Advisory card.
        var stMode = (st.cycleMode === 'fade') ? 'fade' : 'scroll';
        var stModClass = (stMode === 'fade') ? ' dot-card-cycle--fade' : '';
        contentHtml = '<div class="dot-steps21__cycle dot-card-cycle' + stModClass + '" data-count="' + stCycle.length + '">' +
          '<div class="dot-card-cycle__scroller">' +
            stCycle.map(function (line, i) {
              return '<span class="dot-steps21__cycle-line dot-card-cycle__line dot-card-cycle__line--' + (i + 1) + '">' + line + '</span>';
            }).join('') +
            // Clone of line 1 only meaningful for the scroll variant; the
            // fade variant hides it via CSS so we keep markup symmetric.
            '<span class="dot-steps21__cycle-line dot-card-cycle__line dot-card-cycle__line--clone" aria-hidden="true">' + stCycle[0] + '</span>' +
          '</div>' +
        '</div>';
      } else {
        var stCount = st.count || '10,235';
        contentHtml = '<div class="dot-steps21__count">' + stCount + '</div>';
      }
      var stExpandDetail = st.expandDetail || '';
      var stBodyHtml =
        '<div class="dot-steps21__title">' + stTitle + '</div>' +
        contentHtml;
      if (stExpandDetail) {
        stBodyHtml =
          '<div class="dot-steps21__main">' + stBodyHtml + '</div>' +
          '<div class="dot-steps21__expandDetail" aria-hidden="true">' + stExpandDetail + '</div>';
      }
      return '' +
        '<div class="dot-card dot-steps21' + (stCycle ? ' dot-steps21--cycle' : '') + (stExpandDetail ? ' dot-steps21--expandable' : '') + '" data-state="' + (st.state || 'idle') + '">' +
          stBodyHtml +
        '</div>';
    }

    case 'dot-emoji-1x1': {
      var ev = (comp && comp.variant) || {};
      var emoji = ev.emoji || '🍳';
      
      var dotSize = 2.5;
      var gap = 10;
      var dotsHtml = '';
      
      // Define icon patterns as relative grid offsets from center (84, 84)
      var patterns = {
        'music': [
          [-2,-3],[-1,-3],[0,-3],[1,-3],[2,-3],
          [-2,-2],[2,-2],
          [-2,-1],[2,-1],
          [-2,0],[2,0],
          [-4,1],[-3,1],[-2,1],[0,1],[1,1],[2,1],
          [-4,2],[-3,2],[-2,2],[0,2],[1,2],[2,2]
        ],
        'cooking': [
          [0,-3],[-1,-2],[1,-2],[-2,-1],[2,-1],[-2,0],[2,0],
          [-1,1],[0,1],[1,1],[-1,2],[0,2],[1,2]
        ],
        'coffee': [
          [-1,-1],[0,-1],[1,-1],
          [-2,0],[-1,0],[0,0],[1,0],[2,0],
          [-2,1],[-1,1],[0,1],[1,1],[2,1],
          [-1,2],[0,2],[1,2]
        ],
        'shopping': [
          [-2,-2],[-1,-2],[0,-2],[1,-2],
          [-1,-1],[1,-1],
          [-1,0],[0,0],[1,0],
          [-1,1],[1,1]
        ],
        'airplane': [
          [0,-3],[0,-2],[0,-1],[0,0],[0,1],[0,2],
          [-2,-1],[-1,-1],[1,-1],[2,-1],
          [-1,1],[1,1]
        ]
      };

      var activePattern = [];
      if (emoji === '🎵' || emoji === '🎶' || emoji === 'music') activePattern = patterns.music;
      else if (emoji === '🍳' || emoji === 'cooking' || emoji === 'chef') activePattern = patterns.cooking;
      else if (emoji === '☕' || emoji === 'coffee' || emoji === 'cafe') activePattern = patterns.coffee;
      else if (emoji === '🛒' || emoji === 'shopping' || emoji === 'mart') activePattern = patterns.shopping;
      else if (emoji === '✈️' || emoji === 'airplane' || emoji === 'travel' || emoji === 'plane') activePattern = patterns.airplane;

      function isIconDot(gx, gy) {
        for (var i = 0; i < activePattern.length; i++) {
          if (activePattern[i][0] === gx && activePattern[i][1] === gy) return true;
        }
        return false;
      }

      for (var y = 14; y < 168; y += gap) {
        for (var x = 14; x < 168; x += gap) {
          var dx = x - 84;
          var dy = y - 84;
          if (dx*dx + dy*dy <= 72*72) {
            var gx = Math.round(dx / gap);
            var gy = Math.round(dy / gap);
            var isIcon = isIconDot(gx, gy);
            
            var fill = isIcon ? 'var(--p2-lavender, #FFFFFF)' : 'rgba(255,255,255,0.7)';
            // Use same dot size for both, but add opacity flow animation to active dots
            var r = dotSize;
            var cls = isIcon ? 'dot-emoji11__icon-dot' : '';
            
            dotsHtml += '<circle class="' + cls + '" cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '" />';
          }
        }
      }

      return '' +
        '<div class="dot-card dot-emoji11" data-state="' + (ev.state || 'idle') + '" style="background:transparent; border:none; box-shadow:none; position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center;">' +
          '<svg width="168" height="168" viewBox="0 0 168 168" fill="none" xmlns="http://www.w3.org/2000/svg" style="position:absolute; inset:0;">' +
            dotsHtml +
          '</svg>' +
        '</div>';
    }

    case 'dot-temperature-1x1': {
      var tv = (comp && comp.variant) || {};
      var val = tv.value != null ? String(tv.value) : '14';
      var unit = tv.unit || '℃';
      return '' +
        '<div class="dot-card dot-temp11" data-state="' + (tv.state || 'idle') + '">' +
          '<div class="dot-temp11__center">' +
            '<div class="dot-temp11__value">' + val + '</div>' +
            '<div class="dot-temp11__unit">' + unit + '</div>' +
          '</div>' +
        '</div>';
    }

    case 'dot-icon-orange-badge-1x1': {
      var iv = (comp && comp.variant) || {};
      var src = iv.src || '/assets/dot-icons/orange-badge.svg';
      return '' +
        '<div class="dot-card dot-icon11 dot-icon11--orange" data-state="' + (iv.state || 'idle') + '">' +
          '<div class="dot-icon11__grad" aria-hidden="true"></div>' +
          '<img class="dot-icon11__layer dot-icon11__layer--from" src="' + src + '" alt="" />' +
          '<div class="dot-icon11__layer dot-icon11__layer--to" aria-hidden="true">' +
            '<svg class="dot-icon11__dotsSvg" width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
              '<circle class="dot-icon11__waveDot dot-icon11__waveDot--a" cx="7.5" cy="36.5" r="2.5" fill="white"/>' +
              '<circle class="dot-icon11__waveDot dot-icon11__waveDot--b" cx="14.5" cy="36.5" r="2.5" fill="white"/>' +
              '<circle class="dot-icon11__waveDot dot-icon11__waveDot--c" cx="21.5" cy="36.5" r="2.5" fill="white"/>' +
              '<ellipse class="dot-icon11__waveDot dot-icon11__waveDot--d" cx="35.5" cy="36" rx="2.5" ry="5" fill="white"/>' +
              '<ellipse class="dot-icon11__waveDot dot-icon11__waveDot--b" cx="35.5" cy="27" rx="2.5" ry="3" fill="white"/>' +
              '<ellipse class="dot-icon11__waveDot dot-icon11__waveDot--a" cx="42.5" cy="28" rx="1.5" ry="2" fill="white"/>' +
              '<ellipse class="dot-icon11__waveDot dot-icon11__waveDot--c" cx="49.5" cy="31" rx="1.5" ry="2" fill="white"/>' +
              '<ellipse class="dot-icon11__waveDot dot-icon11__waveDot--d" cx="28.5" cy="28" rx="1.5" ry="2" fill="white"/>' +
              '<ellipse class="dot-icon11__waveDot dot-icon11__waveDot--b" cx="21.5" cy="31" rx="1.5" ry="2" fill="white"/>' +
              '<ellipse class="dot-icon11__waveDot dot-icon11__waveDot--a" cx="42.5" cy="43" rx="1.5" ry="2" fill="white"/>' +
              '<ellipse class="dot-icon11__waveDot dot-icon11__waveDot--c" cx="28.5" cy="43" rx="1.5" ry="2" fill="white"/>' +
              '<ellipse class="dot-icon11__waveDot dot-icon11__waveDot--d" cx="35.5" cy="45" rx="2.5" ry="3" fill="white"/>' +
              '<ellipse class="dot-icon11__waveDot dot-icon11__waveDot--b" cx="42.5" cy="36" rx="2.5" ry="4" fill="white"/>' +
              '<ellipse class="dot-icon11__waveDot dot-icon11__waveDot--c" cx="28.5" cy="36" rx="2.5" ry="4" fill="white"/>' +
              '<circle class="dot-icon11__waveDot dot-icon11__waveDot--a" cx="35.5" cy="20.5" r="2.5" fill="white"/>' +
              '<circle class="dot-icon11__waveDot dot-icon11__waveDot--d" cx="35.5" cy="15.5" r="1.5" fill="white"/>' +
              '<circle class="dot-icon11__waveDot dot-icon11__waveDot--c" cx="35.5" cy="56.5" r="1.5" fill="white"/>' +
              '<circle class="dot-icon11__waveDot dot-icon11__waveDot--b" cx="35.5" cy="51.5" r="2.5" fill="white"/>' +
              '<circle class="dot-icon11__waveDot dot-icon11__waveDot--a" cx="49.5" cy="36.5" r="2.5" fill="white"/>' +
              '<circle class="dot-icon11__waveDot dot-icon11__waveDot--b" cx="56.5" cy="36.5" r="2.5" fill="white"/>' +
              '<circle class="dot-icon11__waveDot dot-icon11__waveDot--c" cx="63.5" cy="36.5" r="2.5" fill="white"/>' +
            '</svg>' +
          '</div>' +
        '</div>';
    }

    case 'dot-orange-badge-card': {
      var bc = (comp && comp.variant) || {};
      var reduceMotion = false;
      try {
        reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch (_) {}
      var title = bc.title || '보고서 수정 니즈를 포착';
      var subtitle = bc.subtitle || '필요한 내용을 정리해드릴게요';
      return '' +
        '<div class="dot-card dot-orange-badge-card" data-state="' + (bc.state || 'idle') + '">' +
          '<div class="dot-orange-badge-card__inner">' +
            '<div class="dot-orange-badge-card__text">' +
              '<div class="dot-orange-badge-card__title p2-result-title' + (reduceMotion ? ' is-reduced' : '') + '">' + title + '</div>' +
              '<div class="dot-orange-badge-card__subtitle p2-result-sub' + (reduceMotion ? ' is-reduced' : '') + '">' + String(subtitle || '').replace(/\\n/g, '<br/>') + '</div>' +
            '</div>' +
            '<div class="dot-orange-badge-card__exclaim p2-dotbar" aria-hidden="true">' +
              '<span class="dot-orange-badge-card__dot d0"></span>' +
              '<span class="dot-orange-badge-card__dot d1"></span>' +
              '<span class="dot-orange-badge-card__dot d2"></span>' +
              '<span class="dot-orange-badge-card__dot d3"></span>' +
              '<span class="dot-orange-badge-card__dot d4"></span>' +
              '<span class="dot-orange-badge-card__dot d5"></span>' +
              '<span class="dot-orange-badge-card__dot d6"></span>' +
              '<span class="dot-orange-badge-card__dot d7"></span>' +
              '<span class="dot-orange-badge-card__dot d8"></span>' +
              '<span class="dot-orange-badge-card__dot d9"></span>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    case 'dot-weather-1x1': {
      var wv = (comp && comp.variant) || {};
      // Sun icon as dot-matrix inside 46.37×46.37 box, centered.
      return '' +
        '<div class="dot-card dot-w11" data-state="' + (wv.state || 'idle') + '">' +
          '<svg class="dot-w11__sun" width="46.37" height="46.37" viewBox="0 0 46.37 46.37" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            // outer ring
            '<circle cx="23.185" cy="2.32" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="38.13" cy="8.07" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="44.05" cy="23.185" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="38.13" cy="38.3" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="23.185" cy="44.05" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="8.1" cy="38.3" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="2.32" cy="23.185" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="7.55" cy="8.07" r="2.17" fill="#FFFFFF"/>' +
            // inner grid (uniform 5x5 rounded)
            '<circle cx="17.3" cy="11.5" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="23.185" cy="11.5" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="29.1" cy="11.5" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="11.5" cy="17.3" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="17.3" cy="17.3" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="23.185" cy="17.3" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="29.1" cy="17.3" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="34.9" cy="17.3" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="11.5" cy="23.185" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="17.3" cy="23.185" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="23.185" cy="23.185" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="29.1" cy="23.185" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="34.9" cy="23.185" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="11.5" cy="29.1" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="17.3" cy="29.1" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="23.185" cy="29.1" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="29.1" cy="29.1" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="34.9" cy="29.1" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="17.3" cy="34.9" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="23.185" cy="34.9" r="2.17" fill="#FFFFFF"/>' +
            '<circle cx="29.1" cy="34.9" r="2.17" fill="#FFFFFF"/>' +
          '</svg>' +
        '</div>';
    }

    case 'dot-date-1x1-v1-1': {
      var dv1 = (comp && comp.variant) || {};
      var now = new Date();
      var months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
      var month = months[now.getMonth()];
      var day = now.getDate();
      var text1 = dv1.text ? String(dv1.text).replace(/\\n/g, '<br/>') : (month + '<br/>' + day);
      return '' +
        '<div class="dot-card dot-date11 dot-date11--dark" data-state="' + (dv1.state || 'idle') + '">' +
          '<div class="dot-date11__text">' + text1 + '</div>' +
        '</div>';
    }

    case 'dot-date-1x1-v1-2': {
      var dv2 = (comp && comp.variant) || {};
      var now = new Date();
      var months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
      var month = months[now.getMonth()];
      var day = now.getDate();
      var text2 = dv2.text ? String(dv2.text).replace(/\\n/g, '<br/>') : (month + '<br/>' + day);
      return '' +
        '<div class="dot-card dot-date11 dot-date11--light" data-state="' + (dv2.state || 'idle') + '">' +
          '<div class="dot-date11__text dot-date11__text--light">' + text2 + '</div>' +
        '</div>';
    }

    case 'dot-weather-2x1-v1-1': {
      var w2 = (comp && comp.variant) || {};
      if (w2.partyPill) {
        var pl = w2.partyPill;
        var plTitle = pl.title || '러닝 파티 모드';
        var plSub = pl.subtitle || '실시간 경로 수정 중';
        var plExpandTitle = pl.expandTitle || plTitle;
        var plExpandBody = pl.expandBody || plSub;
        var plIconHtml =
          '<div class="dot-w21__pillIcon" aria-hidden="true">' +
            '<span class="dot-w21__pillIconBg"></span>' +
            '<img class="dot-w21__pillIconMark" src="/assets/test3-running-icon.svg" alt="" aria-hidden="true">' +
          '</div>';
        var plCompactHtml =
          '<div class="dot-w21__compact" aria-hidden="false">' +
            '<div class="dot-w21__pillRow">' +
              '<div class="dot-w21__pillCopy">' +
                '<div class="dot-w21__pillTitle">' + plTitle + '</div>' +
                '<div class="dot-w21__pillSub">' + plSub + '</div>' +
              '</div>' +
              plIconHtml +
            '</div>' +
          '</div>';
        var plExpandedHtml =
          '<div class="dot-w21__expanded" aria-hidden="true">' +
            '<div class="dot-w21__pillCopy">' +
              '<div class="dot-w21__pillTitle">' + plExpandTitle + '</div>' +
              '<div class="dot-w21__pillBody">' + String(plExpandBody).replace(/\n/g, '<br/>') + '</div>' +
            '</div>' +
            plIconHtml +
          '</div>';
        return '' +
          '<div class="dot-card dot-w21 dot-w21--party-pill dot-w21--expandable" data-state="' + (w2.state || 'idle') + '">' +
            plCompactHtml +
            plExpandedHtml +
          '</div>';
      }
      var loc = w2.location || 'Sydney';
      var wt = w2.weather || 'Sunny';
      var darkClass = w2.theme === 'dark' ? ' dot-w21--dark' : '';
      var pairRainG1Dots = [
        [19.2358, 2.67541, 1.75533],
        [17.3979, 6.35571, 1.75533], [21.4936, 6.35571, 1.75533],
        [19.644, 10.5318, 1.75533], [23.7397, 10.5318, 1.75533], [15.5502, 10.532, 1.75533],
        [11.4526, 14.6274, 1.75533], [15.5502, 14.6274, 1.75533],
        [19.644, 14.6275, 1.75533], [23.7397, 14.6275, 1.75533], [27.8354, 14.6275, 1.75533],
        [11.4526, 18.7238, 1.75533], [27.8354, 18.7234, 1.75533], [15.5502, 18.7238, 1.75533],
        [19.644, 18.7234, 1.75533], [23.7397, 18.7234, 1.75533],
        [11.4526, 22.8192, 1.75533], [27.8354, 22.819, 1.75533], [15.5502, 22.8192, 1.75533],
        [19.644, 22.819, 1.75533], [23.7397, 22.819, 1.75533],
        [15.5502, 26.9146, 1.75533], [19.644, 26.915, 1.75533], [23.7397, 26.915, 1.75533]
      ];
      var pairRainG2Dots = [
        [40.493, 23.9777, 2.24889],
        [38.1356, 28.6928, 2.24889], [43.3837, 28.6928, 2.24889],
        [41.0126, 34.0432, 2.24889], [35.7665, 34.0434, 2.24889], [46.2606, 34.0432, 2.24889],
        [30.5184, 39.2904, 2.24889], [35.7665, 39.2904, 2.24889],
        [41.0126, 39.2904, 2.24889], [46.2606, 39.2904, 2.24889], [51.5067, 39.2904, 2.24889],
        [30.5184, 44.5385, 2.24889], [35.7665, 44.5385, 2.24889],
        [41.0126, 44.5381, 2.24889], [46.2606, 44.5381, 2.24889], [51.5067, 44.5381, 2.24889],
        [30.5184, 49.7855, 2.24889], [35.7665, 49.7855, 2.24889],
        [41.0126, 49.7853, 2.24889], [46.2606, 49.7853, 2.24889], [51.5067, 49.7853, 2.24889],
        [35.7665, 55.0325, 2.24889], [41.0126, 55.033, 2.24889], [46.2606, 55.033, 2.24889]
      ];
      var _pairRainGroupHtml = function(dots) {
        var out = '';
        for (var pri = 0; pri < dots.length; pri++) {
          var prd = dots[pri];
          out += '<circle cx="' + prd[0] + '" cy="' + prd[1] + '" r="' + prd[2] + '" fill="#191919"/>';
        }
        return out;
      };
      var pairRainSunSvg =
        '<svg class="dot-w21__sun dot-w21__sun--pair-rain" width="41.7" height="41.7" viewBox="0 0 65 69" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
          '<g class="dot-w21__rain-g dot-w21__rain-g--1">' + _pairRainGroupHtml(pairRainG1Dots) + '</g>' +
          '<g class="dot-w21__rain-g dot-w21__rain-g--2">' + _pairRainGroupHtml(pairRainG2Dots) + '</g>' +
        '</svg>';
      
      // Helper for dot icons
      var _renderDots = function(type) {
        var dots = '';
        var t = String(type).toLowerCase();
        if (t.indexOf('cloud') >= 0 || t.indexOf('흐림') >= 0) {
          // Cloud
          [[23,15],[29,15],[17,18],[23,18],[29,18],[35,18],[11,23],[17,23],[23,23],[29,23],[35,23],[41,23],[17,28],[23,28],[29,28],[35,28]].forEach(function(d){
            dots += '<circle cx="'+d[0]+'" cy="'+d[1]+'" r="2.17" fill="currentColor"/>';
          });
        } else if (t.indexOf('rain') >= 0 || t.indexOf('비') >= 0) {
          // Rain
          [[23,12],[29,12],[17,15],[23,15],[29,15],[35,15],[11,20],[17,20],[23,20],[29,20],[35,20],[41,20],[17,30],[29,30],[41,30],[17,38],[29,38],[41,38]].forEach(function(d){
            dots += '<circle cx="'+d[0]+'" cy="'+d[1]+'" r="2.17" fill="currentColor"/>';
          });
        } else {
          // Sun
          [[23.185,2.32],[38.13,8.07],[44.05,23.185],[38.13,38.3],[23.185,44.05],[8.1,38.3],[2.32,23.185],[7.55,8.07],[17.3,11.5],[23.185,11.5],[29.1,11.5],[11.5,17.3],[17.3,17.3],[23.185,17.3],[29.1,17.3],[34.9,17.3],[11.5,23.185],[17.3,23.185],[23.185,23.185],[29.1,23.185],[34.9,23.185],[11.5,29.1],[17.3,29.1],[23.185,29.1],[29.1,29.1],[34.9,29.1],[17.3,34.9],[23.185,34.9],[29.1,34.9]].forEach(function(d){
            dots += '<circle cx="'+d[0]+'" cy="'+d[1]+'" r="2.17" fill="currentColor"/>';
          });
        }
        return dots;
      };

      var sunIconHtml = w2.sunIcon === 'pair-raindrop-dual'
        ? pairRainSunSvg
        : '<svg class="dot-w21__sun" width="41.7" height="41.7" viewBox="0 0 46.37 46.37" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            _renderDots(wt) +
          '</svg>';

      // Two render modes for the text column:
      //   default:      static "loc / weather"  (e.g. "Seoul / Rainy")
      //   cycleLines:   stacked rotating advisory lines (real-time feel)
      // Test3 passes 3 advisories like "Rain expected in 18 min" /
      // "Humidity high, lighter pace recommended" / "Good window to start
      // now" — turning the static reading into a contextual coach.
      var weatherCycle = (w2.cycleLines && w2.cycleLines.length) ? w2.cycleLines : null;
      var w2Title = w2.title || null;
      var weatherTextHtml;
      if (weatherCycle) {
        // Cycle modes:
        //   default 'scroll' — vertical scroll-float (Weather Advisory default)
        //   'fade'           — opacity cross-fade, first line only visible
        //   'stack'          — all lines visible, one slot per row (test3 home)
        var w2CycleMode = w2.cycleMode || 'scroll';
        var w2ModClass = '';
        if (w2CycleMode === 'fade') w2ModClass = ' dot-card-cycle--fade';
        else if (w2CycleMode === 'stack') w2ModClass = ' dot-card-cycle--stack';
        // Same scroll-float structure as the Today Progress card — vertical
        // scroller with a clone of line 1 at the end for seamless wrap.
        weatherTextHtml = '<div class="dot-w21__text dot-w21__text--cycle dot-card-cycle' + w2ModClass + '" data-count="' + weatherCycle.length + '">' +
          '<div class="dot-card-cycle__scroller">' +
            weatherCycle.map(function (line, i) {
              return '<span class="dot-w21__cycle-line dot-card-cycle__line dot-card-cycle__line--' + (i + 1) + '">' + line + '</span>';
            }).join('') +
            '<span class="dot-w21__cycle-line dot-card-cycle__line dot-card-cycle__line--clone" aria-hidden="true">' + weatherCycle[0] + '</span>' +
          '</div>' +
        '</div>';
      } else {
        weatherTextHtml =
          '<div class="dot-w21__text">' +
            '<div class="dot-w21__loc">' + loc + '</div>' +
            '<div class="dot-w21__weather">' + wt + '</div>' +
          '</div>';
      }
      var w2ExpandDetail = w2.expandDetail || '';
      var w2BodyHtml =
        sunIconHtml +
        (w2Title ? '<div class="dot-w21__title">' + w2Title + '</div>' : '') +
        weatherTextHtml;
      if (w2ExpandDetail) {
        w2BodyHtml =
          '<div class="dot-w21__main">' + w2BodyHtml + '</div>' +
          '<div class="dot-w21__expandDetail" aria-hidden="true">' + w2ExpandDetail + '</div>';
      }
      return '' +
        '<div class="dot-card dot-w21' + darkClass + (weatherCycle ? ' dot-w21--cycle' : '') + (w2Title ? ' dot-w21--has-title' : '') + (w2ExpandDetail ? ' dot-w21--expandable' : '') + '" data-state="' + (w2.state || 'idle') + '">' +
          w2BodyHtml +
        '</div>';
    }


    case 'dot-running': {
      // DOT dataset — Running coach pill (297×75). Markup is class-based so
      // motion/state can be applied purely via CSS.
      var drv = (comp && comp.variant) || {};
      var title = drv.title || 'Running coach';
      var subtitle = drv.subtitle || '달릴 준비 되셨나요?';

      // 4-frame runner animation using provided coordinates.
      // Frames are normalized to a 40x40 viewBox for consistency.
      var f1_dots = [[26.73,0],[30.08,0],[13.37,3.34],[16.71,3.34],[26.73,3.34],[30.08,3.34],[10.03,6.68],[16.71,6.68],[20.05,6.68],[23.39,6.68],[16.71,10.03],[20.05,10.03],[23.39,10.03],[26.73,10.03],[33.42,10.03],[13.37,13.37],[16.71,13.37],[20.05,13.37],[26.73,13.37],[30.08,13.37],[10.03,16.71],[13.37,16.71],[16.71,16.71],[10.03,20.05],[13.37,20.05],[20.05,20.05],[23.39,20.05],[10.03,23.39],[13.37,23.39],[23.39,23.39],[26.73,23.39],[3.34,26.74],[6.68,26.74],[10.03,26.74],[16.71,26.74],[20.05,26.74],[23.39,26.74],[0,30.08],[3.34,30.08],[13.37,30.08],[16.71,30.08]];
      var f2_dots = [[20.93,0],[24.42,0],[20.93,3.49],[24.42,3.49],[6.98,6.98],[10.47,6.98],[13.95,6.98],[17.44,6.98],[0,10.47],[3.49,10.47],[13.95,10.47],[17.44,10.47],[20.93,10.47],[31.4,10.47],[10.47,13.95],[13.95,13.95],[17.44,13.95],[24.42,13.95],[27.91,13.95],[6.98,17.44],[10.47,17.44],[13.95,17.44],[6.98,20.93],[10.47,20.93],[17.44,20.93],[20.93,20.93],[6.98,24.42],[10.47,24.42],[17.44,24.42],[20.93,24.42],[3.49,27.91],[6.98,27.91],[17.44,27.91],[20.93,27.91],[0,31.4],[3.49,31.4],[20.93,31.4],[24.42,31.4]];
      var f3_dots = [[20.33,0],[23.72,0],[20.33,3.39],[23.72,3.39],[33.89,3.39],[10.17,6.78],[13.56,6.78],[16.95,6.78],[20.33,6.78],[33.89,6.78],[6.78,10.17],[16.95,10.17],[20.33,10.17],[23.72,10.17],[27.11,10.17],[30.5,10.17],[6.78,13.56],[13.56,13.56],[16.95,13.56],[20.33,13.56],[13.56,16.94],[16.95,16.94],[20.33,16.94],[0,20.33],[3.39,20.33],[13.56,20.33],[16.95,20.33],[20.33,20.33],[23.72,20.33],[3.39,23.72],[6.78,23.72],[10.17,23.72],[13.56,23.72],[23.72,23.72],[27.11,23.72],[10.17,27.11],[27.11,27.11],[30.5,27.11],[30.5,30.5],[33.89,30.5]];
      var f4_dots = [[20.93,0],[24.42,0],[20.93,3.49],[24.42,3.49],[6.98,6.98],[10.47,6.98],[13.95,6.98],[17.44,6.98],[0,10.47],[3.49,10.47],[13.95,10.47],[17.44,10.47],[20.93,10.47],[31.4,10.47],[10.47,13.95],[13.95,13.95],[17.44,13.95],[24.42,13.95],[27.91,13.95],[6.98,17.44],[10.47,17.44],[13.95,17.44],[6.98,20.93],[10.47,20.93],[17.44,20.93],[20.93,20.93],[6.98,24.42],[10.47,24.42],[17.44,24.42],[20.93,24.42],[3.49,27.91],[6.98,27.91],[17.44,27.91],[20.93,27.91],[0,31.4],[3.49,31.4],[20.93,31.4],[24.42,31.4]];

      var r = 1.7;
      function _renderFrame(dots, frameClass) {
        var s = '<g class="dot-runner-frame ' + frameClass + '">';
        for (var i = 0; i < dots.length; i++) {
          s += '<circle cx="' + (dots[i][0] + r) + '" cy="' + (dots[i][1] + r) + '" r="' + r + '" fill="white"/>';
        }
        s += '</g>';
        return s;
      }

      return '' +
        '<div class="dot-card dot-running" data-state="' + (drv.state || 'idle') + '">' +
          '<div class="dot-running__icon">' +
            '<span class="dot-running__icon-bg" aria-hidden="true"></span>' +
            '<svg class="dot-running__icon-svg" width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              _renderFrame(f1_dots, 'dot-runner-frame--a') +
              _renderFrame(f2_dots, 'dot-runner-frame--b') +
              _renderFrame(f3_dots, 'dot-runner-frame--c') +
              _renderFrame(f4_dots, 'dot-runner-frame--d') +
            '</svg>' +
          '</div>' +
          '<div class="dot-running__text">' +
            '<div class="dot-running__title">' + title + '</div>' +
            '<div class="dot-running__subtitle">' + subtitle + '</div>' +
          '</div>' +
          '<div class="dot-running__dots-arrow">' +
            '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<circle class="dot-run-arrow-dot dot-run-arrow-dot--0" cx="6" cy="16" r="2.1" fill="#1B1C21" />' +
              '<circle class="dot-run-arrow-dot dot-run-arrow-dot--1" cx="10.2" cy="16" r="2.1" fill="#1B1C21" />' +
              '<circle class="dot-run-arrow-dot dot-run-arrow-dot--2" cx="14.4" cy="16" r="2.1" fill="#1B1C21" />' +
              '<circle class="dot-run-arrow-dot dot-run-arrow-dot--3" cx="18.6" cy="16" r="2.1" fill="#1B1C21" />' +
              '<circle class="dot-run-arrow-dot dot-run-arrow-dot--4" cx="22.8" cy="16" r="2.1" fill="#1B1C21" />' +
              '<circle class="dot-run-arrow-dot dot-run-arrow-dot--5" cx="27" cy="16" r="2.1" fill="#1B1C21" />' +
              '<circle class="dot-run-arrow-dot dot-run-arrow-dot--6" cx="22.8" cy="11.8" r="2.1" fill="#1B1C21" />' +
              '<circle class="dot-run-arrow-dot dot-run-arrow-dot--7" cx="18.6" cy="7.6" r="2.1" fill="#1B1C21" />' +
              '<circle class="dot-run-arrow-dot dot-run-arrow-dot--8" cx="22.8" cy="20.2" r="2.1" fill="#1B1C21" />' +
              '<circle class="dot-run-arrow-dot dot-run-arrow-dot--9" cx="18.6" cy="24.4" r="2.1" fill="#1B1C21" />' +
            '</svg>' +
          '</div>' +
        '</div>';
    }

    case 'dot-running-compact': {
      // DOT dataset — compact pill (164×82) with dotted runner icon.
      var dr2v = (comp && comp.variant) || {};
      var label2 = dr2v.label || '조깅';
      var time2 = dr2v.time || '10:35';

      // 4-frame mini runner (24×32) — animated via CSS steps, like dot-running.
      var rf1 = [[14,4],[17,4],[14,7],[17,7],[11,10],[14,10],[11,13],[14,13],[11,16],[14,16],[11,19],[14,19],[17,10],[20,13],[23,13],[8,10],[5,13],[11,22],[8,25],[5,25],[14,22],[17,25],[20,28]];
      var rf2 = [[14,4],[17,4],[14,7],[17,7],[11,10],[14,10],[11,13],[14,13],[11,16],[14,16],[11,19],[14,19],[17,10],[19,12],[21,12],[8,10],[10,12],[12,12],[11,22],[14,25],[17,28],[14,22],[16,24],[18,26]];
      var rf3 = [[14,4],[17,4],[14,7],[17,7],[11,10],[14,10],[11,13],[14,13],[11,16],[14,16],[11,19],[14,19],[17,10],[20,12],[22,12],[8,10],[6,12],[4,12],[11,22],[13,25],[15,28],[14,22],[12,25],[10,28]];
      var rf4 = [[14,4],[17,4],[14,7],[17,7],[11,10],[14,10],[11,13],[14,13],[11,16],[14,16],[11,19],[14,19],[17,10],[20,13],[23,13],[8,10],[7,12],[6,14],[11,22],[9,25],[7,27],[14,22],[17,25],[20,28]];

      function _renderMiniFrame(dots, cls) {
        var s = '<g class="dot-run2-frame ' + cls + '">';
        for (var i = 0; i < dots.length; i++) {
          s += '<circle cx="' + dots[i][0] + '" cy="' + dots[i][1] + '" r="1.8" fill="#FFB01C"/>';
        }
        s += '</g>';
        return s;
      }

      return '' +
        '<div class="dot-card dot-running2" data-state="' + (dr2v.state || 'idle') + '">' +
          '<div class="dot-running2__human">' +
            '<svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              _renderMiniFrame(rf1, 'dot-run2-frame--a') +
              _renderMiniFrame(rf2, 'dot-run2-frame--b') +
              _renderMiniFrame(rf3, 'dot-run2-frame--c') +
              _renderMiniFrame(rf4, 'dot-run2-frame--d') +
            '</svg>' +
          '</div>' +
          '<div class="dot-running2__text">' +
            '<div class="dot-running2__label">' + label2 + '</div>' +
            '<div class="dot-running2__time">' + time2 + '</div>' +
          '</div>' +
        '</div>';
    }

    case 'dot-running-prompt': {
      // Wide banner variant — initial workout-detection state. Same
      // height (82px) as the compact card, full Today's Goal width
      // (340px). No icon now: text occupies the entire pill, centered
      // across two lines.
      //
      // Each character is wrapped in <span class="prox-char" style="--i:N">
      // so a single CSS keyframe (`proxWave`) can stagger its peak
      // moment via a per-char delay. The wave runs continuously and
      // sweeps the message left-to-right, then loops — ReactBits-style
      // variable-proximity but driven by clock instead of cursor.
      // Whitespace is rendered verbatim (no animation) so word
      // boundaries stay legible.
      //
      // Special chars escaped (&, <, ", >) to keep the inline HTML safe
      // even if a caller passes a raw apostrophe-containing prompt.
      var rpv = (comp && comp.variant) || {};
      var promptText = rpv.prompt ||
        '빠른 움직임이 감지됐어요.\n운동을 시작할까요?';
      // Two visual lines. If caller passed a single-line string (legacy),
      // split on the period+space boundary as a sensible default so the
      // 340×82 banner still wraps to two lines.
      var lines = promptText.indexOf('\n') !== -1
        ? promptText.split('\n')
        : promptText.replace(/\.\s+/, '.\n').split('\n');

      function _escHtml(ch) {
        if (ch === '&') return '&amp;';
        if (ch === '<') return '&lt;';
        if (ch === '>') return '&gt;';
        if (ch === '"') return '&quot;';
        if (ch === "'") return '&#39;';
        return ch;
      }
      var charIdx = 0;
      var html = lines.map(function (line) {
        // Use Array.from so multi-byte / surrogate-pair characters
        // count as ONE character, not two — important for Hangul and
        // emoji-adjacent prompts a future caller might pass.
        var charsHtml = Array.from(line).map(function (ch) {
          if (ch === ' ') return '<span class="prox-space">&nbsp;</span>';
          var span = '<span class="prox-char" style="--i:' + charIdx + ';">' +
                     _escHtml(ch) + '</span>';
          charIdx += 1;
          return span;
        }).join('');
        return '<div class="dot-running2__prompt-line">' + charsHtml + '</div>';
      }).join('');

      // Pass total animated-char count to CSS via --prox-n so the
      // wave's per-char stagger can be normalized to one full sweep
      // per cycle no matter how long the prompt is.
      // Optional "title preview" — chars for the title of the NEXT
      // surface (e.g. the goal card the prompt will morph into). The
      // chars start hidden; the parent's transition class
      // (.test3-intro-run-exit) activates their wave with a +300ms
      // baseline delay so the wave begins right when the user expects
      // motion (300ms after they tap). After the morph swaps the prompt
      // for the goal card, the preview is destroyed but its end state
      // (settled white-on-bold title) matches the goal's plain title —
      // visually seamless.
      var titleAtEnd = rpv.titleAtEnd || null;
      var titleAtEndHtml = '';
      if (titleAtEnd) {
        var titleIdx = 0;
        titleAtEndHtml = '<div class="dot-running2__title-preview" aria-hidden="true">' +
          Array.from(String(titleAtEnd)).map(function (ch) {
            // Use a raw &nbsp; (text node) NOT a wrapper span — the
            // wrapper enforced an explicit 0.32em width, which is
            // wider than Inter's natural space (~0.27em). When the
            // canvas swapped the preview for the goal's plain-text
            // title, the inter-word gap "snapped" narrower. Raw
            // &nbsp; renders at the same width as the natural space
            // in the plain title, so the swap is invisible.
            if (ch === ' ') return '&nbsp;';
            if (ch === '\n') return '<br/>';
            var safeCh = _escHtml(ch);
            var sp = '<span class="prox-char-once" style="--i:' + titleIdx + ';">' + safeCh + '</span>';
            titleIdx += 1;
            return sp;
          }).join('') +
        '</div>';
      }

      // Goal-content preview overlays — title preview was already
      // there above (rendered via titleAtEndHtml). We also embed the
      // time, distance, and a map-placeholder circle so the morphing
      // pill BECOMES the Running Now card from the inside out, instead
      // of cross-fading with a separately-mounted goal card behind
      // (which the user perceived as "a new component suddenly
      // appearing"). Values match the goal card's initial variant
      // (00:01:42, 180m) so when the actual goal card takes over at
      // re-render time, the swap is pixel-identical.
      var goalPreviewHtml = '';
      if (titleAtEnd) {
        goalPreviewHtml = '' +
          '<div class="dot-running2__goal-preview" aria-hidden="true">' +
            '<div class="dot-running2__goal-time">00:01:42</div>' +
            '<div class="dot-running2__goal-distance">180m</div>' +
            '<div class="dot-running2__goal-map-seed" aria-hidden="true"></div>' +
            '<div class="dot-running2__goal-map"></div>' +
          '</div>';
      }
      return '' +
        '<div class="dot-card dot-running2 dot-running2--prompt" data-state="' + (rpv.state || 'idle') + '"' +
            ' style="--prox-n:' + Math.max(charIdx, 1) + ';">' +
          '<div class="dot-running2__prompt">' + html + '</div>' +
          titleAtEndHtml +
          goalPreviewHtml +
        '</div>';
    }

    case 'clock':         // canonical Scene template name
    case 'lock-clock':    // kebab alias
    case 'lock-time': {   // legacy alias
      // Huge digital time display — Samsung lock-screen signature.
      // Delegates to GalaxyAtomics.Clock when available so the render
      // matches the canned Screen/Lock scene 1:1: HH on line 1, MM on
      // line 2 (NO COLON between them), FONT_CLOCK family
      // ('SamsungNrDefault-V6'), weight 400, size 112, line-height 82,
      // gap 12. Earlier version rendered "HH:MM" on one line with the
      // Inter fallback and weight 200 — visually inconsistent with the
      // canonical Scene/Lock.
      var lcv = (comp && comp.variant) || {};
      var _now = new Date();
      var _HH = lcv.HH != null ? String(lcv.HH)
        : String(_now.getHours()).padStart(2, '0');
      var _MM = lcv.MM != null ? String(lcv.MM)
        : String(_now.getMinutes()).padStart(2, '0');
      // `A` (= window.GalaxyAtomics) is already in scope from the top
      // of renderAtomicForRole — reuse it directly.
      if (A && typeof A.Clock === 'function') {
        return A.Clock({
          time:       [_HH, _MM],
          fontSize:   lcv.fontSize || 112,
          lineHeight: lcv.lineHeight || 82,
          gap:        lcv.gap != null ? lcv.gap : 12,
          family:     lcv.family || null
        });
      }
      // Fallback (when GalaxyAtomics hasn't loaded yet) — still
      // renders 2-line no-colon using the canonical clock font stack.
      // Space Grotesk paired with Inter structural fallback, matching
      // the project-wide Inter + Space Grotesk standardization.
      var lcSize = lcv.fontSize || 112;
      var lcLh   = lcv.lineHeight || 82;
      var lcGap  = lcv.gap != null ? lcv.gap : 12;
      var lcFont = lcv.family || "'Space Grotesk', Inter, system-ui, sans-serif";
      var baseStyle = 'font-family:' + lcFont + ';font-weight:500;font-size:' + lcSize + 'px;' +
                      'line-height:' + lcLh + 'px;color:#FFFFFF;text-align:center;white-space:nowrap;';
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:' + lcGap + 'px;">' +
        '<div style="' + baseStyle + '">' + _HH + '</div>' +
        '<div style="' + baseStyle + '">' + _MM + '</div>' +
      '</div>';
    }

    case 'weatherDate':       // canonical Scene template name
    case 'weather-date': {
      // Canonical Samsung Lock weather-date row — matches
      // GalaxyAtomics.WeatherDate exactly so the agent path renders
      // identically to Scene/Lock:
      //   layout  : [date] [moon-or-condition icon 19×19] [temp°]
      //   font    : Inter, 24px / 400 / line-height 20px / #FFFFFF
      //   gap     : 10px between items
      //   width   : 192 centered (CANONICAL_ROLE_SIZES enforces this)
      // Earlier revision rendered icon-first + bullet separator + 14px
      // font-weight 500 — visually off by a mile. Now we delegate to
      // GalaxyAtomics.WeatherDate when available, with a condition-
      // aware icon override via an inline wrapper.
      //
      // variant fields accepted:
      //   condition → 'sunny' | 'cloudy' | 'rain' | 'snow' | 'moon'
      //                (default 'moon' — matches canonical night look)
      //   temp      → numeric '24' or string '24°' (degree auto-appended)
      //   date      → string 'Sat, May 3'
      var wdv = (comp && comp.variant) || {};
      var wdCond = wdv.condition || 'moon';
      // Strip trailing ° if present; canonical appends it.
      var wdTempRaw = (wdv.temp != null ? wdv.temp : 24);
      var wdTempStr = String(wdTempRaw).replace(/[°\s]+$/, '');
      var wdDate = wdv.date || 'Sat, May 3';

      // Default look = moon.svg (canonical Lock is night-themed).
      // For other conditions use inline SVGs so we don't depend on
      // missing PNG/SVG assets. Sun/cloud/rain/snow all styled to
      // match the 19×19 footprint of moon.svg.
      var WEATHER_INLINE = {
        'sunny':  '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" fill="#fff"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5l1.5-1.5M17 7l1.5-1.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/></svg>',
        'cloudy': '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M7 17a4 4 0 0 1 0-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 17H7z" fill="#fff"/></svg>',
        'rain':   '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M7 14a4 4 0 0 1 0-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 14H7z" fill="#fff"/><path d="M9 17v3M12 17v3M15 17v3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/></svg>',
        'snow':   '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M7 13a4 4 0 0 1 0-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 13H7z" fill="#fff"/><path d="M8 17v2M12 17v2M16 17v2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/></svg>'
      };
      // Canonical moon.svg lives in assets/figma/lock-screen — if it
      // loads we use that; otherwise inline moon SVG fallback.
      var moonInline =
        '<svg width="19" height="19" viewBox="0 0 24 24" fill="none">' +
          '<path d="M20 14.5A8 8 0 1 1 9.5 4c-.3 1-.5 2-.5 3a7 7 0 0 0 11 7.5z" fill="#fff"/>' +
        '</svg>';
      var iconSvg = WEATHER_INLINE[wdCond] || moonInline;

      // Canonical typography: Inter 24/400/20 line-height
      var textStyle = "font-family:'One UI Sans APP VF', Inter, system-ui, sans-serif;" +
                      'font-weight:500;font-size:24px;line-height:20px;color:#FFFFFF;' +
                      'white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,0.35);';
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:10px;">' +
        '<span style="' + textStyle + '">' + wdDate + '</span>' +
        '<div style="position:relative;width:19px;height:19px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' + iconSvg + '</div>' +
        '<span style="' + textStyle + '">' + wdTempStr + '\u00b0</span>' +
      '</div>';
    }

    case 'lockIndicator':       // canonical Scene template name
    case 'lock-indicator': {
      // Small padlock / fingerprint / face-ID glyph shown just below the
      // status bar. variant.state: 'locked' | 'unlocked' | 'fingerprint'.
      var liv = (comp && comp.variant) || {};
      var liState = liv.state || 'locked';
      var LOCK_SVGS = {
        'locked':      '<rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.8" fill="none"/>',
        'unlocked':    '<rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M8 11V7a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="1.8" fill="none"/>',
        'fingerprint': '<path d="M12 5a7 7 0 0 0-7 7v3M19 12a7 7 0 0 0-3-5.7M19 15v3M8 21a7 7 0 0 0 2-5v-4a2 2 0 0 1 4 0v5a9 9 0 0 1-1 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>'
      };
      var liSvg = LOCK_SVGS[liState] || LOCK_SVGS['locked'];
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.9);filter:drop-shadow(0 1px 4px rgba(0,0,0,0.35));">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="color:currentColor;">' + liSvg + '</svg>' +
      '</div>';
    }

    case 'shortcutLeft':
    case 'shortcutRight': {
      // Canonical Samsung lockscreen shortcut — 47×47 glass circle with
      // a single glyph (phone on the left by default, camera on the
      // right). variant.icon picks the glyph.
      var scv = (comp && comp.variant) || {};
      var scIcon = scv.icon || (comp.role === 'shortcutRight' ? 'camera' : 'phone');
      var SHORTCUT_SVGS = {
        'phone':  '<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2 17 17 0 0 1-16-16 2 2 0 0 1 2-2z" fill="currentColor"/>',
        'camera': '<path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.6" fill="none"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.6" fill="none"/>',
        'flash':  '<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="currentColor"/>',
        'qr':     '<rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.6" fill="none"/><path d="M14 14h3v3M19 14v7M14 19h3v2" stroke="currentColor" strokeWidth="1.6" fill="none"/>'
      };
      var scSvg = SHORTCUT_SVGS[scIcon] || SHORTCUT_SVGS['phone'];
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;' +
        _G('shortcutCircle') + 'border-radius:50%;color:#fff;' +
      '">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="color:currentColor;">' + scSvg + '</svg>' +
      '</div>';
    }

    case 'lock-dot-shortcuts': {
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:12px;">' +
        '<div style="width:54px;height:54px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);color:#fff;">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="1.6"/></svg>' +
        '</div>' +
        '<div style="width:54px;height:54px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);color:#fff;">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.6"/></svg>' +
        '</div>' +
        '<div style="width:54px;height:54px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(52,130,246,0.9);color:#fff;">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '</div>' +
        '<div style="width:54px;height:54px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(239,68,68,0.9);color:#fff;">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="1.6"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
        '</div>' +
      '</div>';
    }

    case 'gestureBar': {
      // Full-width bottom home-gesture indicator (Samsung's Android home
      // bar). Thin light pill, 134×5 centered in a 451×24 band.
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">' +
        '<div style="width:134px;height:5px;border-radius:3px;background:rgba(255,255,255,0.85);"></div>' +
      '</div>';
    }

    case 'unlock-hint': {
      // "Swipe up to unlock" text with optional up-chevron above. Centered
      // at the bottom of the lock screen, just above the shortcut row.
      var uhv = (comp && comp.variant) || {};
      var uhText = uhv.text != null ? uhv.text : 'Swipe up to unlock';
      var uhArrow = uhv.showArrow !== false;
      return '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:rgba(255,255,255,0.8);font-family:var(--font);font-size:var(--font-size-xs,14px);font-weight:500;text-shadow:0 1px 4px rgba(0,0,0,0.35);">' +
        (uhArrow
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="color:rgba(255,255,255,0.7);"><path d="M7 15l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>'
          : '') +
        '<span>' + uhText + '</span>' +
      '</div>';
    }

    case 'slider-panel': {
      // Figma 1109:10261 (brightness) / 1109:10246 (volume) — a vertical
      // slider PANEL that bundles a track + mode-cap toggle in one glass
      // container. Exact spec:
      //   container: 88×h, bg rgba(23,23,26,0.6) + 1px border + rounded-50
      //               padding 18, flex-col, gap 10
      //   track:      fills remaining vertical space (rotated slider-pill)
      //   cap:        56 circle at bottom, active by default (#d5d5d5 bg)
      //
      // variant:
      //   icon    → slider handle glyph ('brightness' | 'music' | …)
      //   capIcon → mode cap glyph ('moon' | 'mute' | …)
      //   capOn   → cap active state (default true — matches Figma)
      //   percent → slider fill 0..100
      var spnv = (comp && comp.variant) || {};
      var spnPct    = spnv.percent != null ? spnv.percent : 62;
      var spnIcon   = spnv.icon    || 'brightness';
      var spnCapI   = spnv.capIcon || 'moon';
      var spnCapOn  = spnv.capOn !== false; // default true per Figma
      var spnSlider = window.renderAtomicForRole(
        { role: 'slider-pill', variant: { orient: 'vertical', icon: spnIcon, percent: spnPct } },
        { w: 56, h: 200 }
      );
      var spnCap = window.renderAtomicForRole(
        { role: 'toggle-chip', variant: { icon: spnCapI, on: spnCapOn } },
        { w: 56, h: 56 }
      );
      return '<div style="width:100%;height:100%;' +
        'background:rgba(23,23,26,0.6);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
        'border:1px solid rgba(255,255,255,0.2);border-radius:var(--card-radius,' + _R('widget') + ');' +
        'padding:18px;box-sizing:border-box;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;' +
        'overflow:hidden;">' +
        '<div style="flex:1;min-height:0;width:100%;display:flex;align-items:stretch;justify-content:center;">' + spnSlider + '</div>' +
        '<div style="flex-shrink:0;width:56px;height:56px;">' + spnCap + '</div>' +
      '</div>';
    }

    case 'single-toggle': {
      // Figma "Single Toggle" component (1003:13051, 1003:13038, 1006:14473,
      // 1006:14489). Four exact variant combinations:
      //   width='single' + kind='toggle'   → 88×88  icon-only (Figma 987:17561)
      //   width='single' + kind='shortcut' → 88×88  open-arrow only (985:13445)
      //   width='half'   + kind='toggle'   → 199×88 icon + title/sub (544:1012)
      //   width='half'   + kind='shortcut' → 199×88 arrow + title/sub (544:1044)
      // Glass pill: bg rgba(23,23,26,0.6), border 1px rgba(255,255,255,0.2),
      //             rounded 50.
      var stv = (comp && comp.variant) || {};
      var stWidth = stv.width || 'half';
      var stKind  = stv.kind  || 'toggle';
      var stTitle = stv.title || 'Title';
      var stSub   = stv.sub || stv.subtitle || 'Subtitle';
      var stShowSub = stv.showSubtitle !== false;
      var stIcon  = stv.icon || 'add';
      var stOn    = stv.on === true;
      var glass   = 'background:rgba(23,23,26,0.6);border:1px solid rgba(255,255,255,0.2);border-radius:var(--card-radius,' + _R('widget') + ');box-sizing:border-box;';

      // Reusable 56-circle. Delegates to the `toggle-chip` atomic so the
      // full icon library (Wi-Fi / Mobile Data / Bluetooth / …) is picked
      // up correctly — previously this helper was hardcoded to check/plus
      // glyphs, which made every single-toggle render the wrong icon.
      function _stChip(on, iconKey) {
        return window.renderAtomicForRole(
          { role: 'toggle-chip', variant: { icon: iconKey, on: on } },
          { w: 56, h: 56 }
        );
      }
      // Shortcut left icon — 34×34 in a 32.5×35 holder (per Figma). Default
      // is the "open" arrow (navigation cue). `variant.icon` can override
      // with any key in SHORTCUT_ICONS below — e.g. 'song-search' renders
      // the Figma media_volume speaker+waves glyph (node 340:8807) for the
      // Samsung Song Search affordance.
      var SHORTCUT_ICONS = {
        'open':        '<path d="M14 5h5v5M19 5l-9 9M10 7H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>',
        // Figma 340:8807 media_volume — speaker cone + two wave arcs.
        // Proportions match the 19.69%/14.04%/24.53%/14.32% insets at 24×24.
        'song-search':'<path d="M4 10v4h3l4 3.5V6.5L7 10H4z" fill="currentColor"/>' +
                      '<path d="M14 9.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>' +
                      '<path d="M17 6.5a7 7 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>',
        'smart-view': '<rect x="3" y="5" width="18" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M10 9l5 2.5-5 2.5V9z" fill="currentColor"/>'
      };
      function _stShortcutIcon(iconKey) {
        var path = SHORTCUT_ICONS[iconKey] || SHORTCUT_ICONS['open'];
        // Holder sized to match the toggle chip's 56 circle footprint, with
        // the SVG rendered at 26px for clear visibility. Figma's raw
        // 32.5×35 + p-13 holder math would clip the glyph to ~7×9, which
        // is what caused the "icons are too small" bug in the reference.
        return '<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" style="color:#fff;">' + path + '</svg>' +
        '</div>';
      }
      // Shortcut variants get `data-shortcut` so the delegated interact-mode
      // click handler can flash a quick press animation — navigation-style
      // feedback without needing to route to a real destination.
      var shortcutAttr = (stKind === 'shortcut') ? ' data-shortcut="1"' : '';

      if (stWidth === 'single') {
        // 88×88 centered. 'toggle' = 56 circle; 'shortcut' = 34 arrow.
        var innerSingle = stKind === 'shortcut' ? _stShortcutIcon(stIcon) : _stChip(stOn, stIcon);
        return '<div' + shortcutAttr + ' style="width:88px;height:88px;max-width:88px;max-height:88px;' + glass +
          'display:flex;align-items:center;justify-content:center;transition:transform 120ms ease,background 160ms ease;' +
          (stKind === 'shortcut' ? 'padding:24px;' : 'padding:10px 0;') + '">' +
          innerSingle +
        '</div>';
      }

      // half: 199×88 — left icon (toggle or shortcut) + title/sub stacked right.
      var leftHalf = stKind === 'shortcut' ? _stShortcutIcon(stIcon) : _stChip(stOn, stIcon);
      var padX = stKind === 'shortcut' ? 'padding:24px 25px 24px 20px;' : 'padding:24px 17px;';
      return '<div' + shortcutAttr + ' style="width:199px;height:88px;max-height:88px;' + glass + padX +
        'display:flex;flex-direction:column;align-items:flex-start;justify-content:center;overflow:hidden;color:#fff;font-family:var(--font);transition:transform 120ms ease,background 160ms ease;">' +
        '<div style="display:flex;align-items:center;gap:10px;width:100%;">' +
          leftHalf +
          '<div style="flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;">' +
            '<div style="font-size:16px;font-weight:700;color:#efeef2;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + stTitle + '</div>' +
            (stShowSub ? '<div style="font-size:var(--font-size-sm,16px);font-weight:500;color:#cfcccf;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + stSub + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }

    case 'smart-things': {
      // Figma SmartThings (1006:14505 / 544:1020) — 415×88, glass pill
      // with a device icon + 2-line title/sub on the left and up to 3
      // circular action toggles on the right. Every dimension mirrors the
      // Figma component 1:1. variant.actions = array of up to 3 icon keys.
      var stmv = (comp && comp.variant) || {};
      var stmTitle = stmv.title || 'Title';
      var stmSub   = stmv.sub || stmv.subtitle || 'Subtitle';
      var stmShowSub = stmv.showSubtitle !== false;
      // actionCount: 1 (compact — single output chip on right, as in the
      //              QS compact/minimal reference) or 3 (Full — Figma default).
      // variant.actions explicit array overrides actionCount.
      var stmActionCount = (stmv.actionCount === 1) ? 1 : 3;
      var stmActions = Array.isArray(stmv.actions)
        ? stmv.actions.slice(0, 3)
        : (stmActionCount === 1
          ? ['power']
          : ['smart-view', 'remote', 'power']);
      var stmActiveIdx = (stmv.activeIndex != null) ? stmv.activeIndex : -1;

      // Device icon on the left — Figma 552:1513 "tv outline" glyph.
      //   screen: rounded rectangle (~17.5×11.5) with stroke
      //   stand: horizontal bar at the bottom
      //   stem: thin vertical line connecting screen to stand
      // Rendered at 30×30 SVG inside a 44×44 holder so the glyph reads
      // clearly alongside the title text (matches Figma visual weight even
      // though we abandoned Figma's clipped 32.5×35 p-13 container math).
      var deviceGlyph = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#efeef2;">' +
        '<rect x="3" y="4" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none"/>' +
        '<path d="M8 20h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>' +
        '<path d="M12 16v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>' +
      '</svg>';

      var ACTION_SVGS = {
        'smart-view': '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#fff;"><rect x="3" y="5" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><path d="M12 9l4 2.5-4 2.5V9z" fill="currentColor"/></svg>',
        'remote':     '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#fff;"><rect x="6" y="3" width="12" height="18" rx="2" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="7" r="1.3" fill="currentColor"/><path d="M9 11h6M9 14h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>',
        'power':      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#222;"><path d="M12 4v8M6.5 7a7 7 0 1 0 11 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>',
        'refresh':    '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#fff;"><path d="M4 12a8 8 0 0 1 14-5l2-2M20 7v4h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>',
        'play':       '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#fff;"><path d="M8 5l10 7-10 7V5z" fill="currentColor"/></svg>',
        'add':        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="color:#fff;"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>'
      };
      var actionsHtml = stmActions.map(function (key, i) {
        var active = i === stmActiveIdx;
        var bg = active ? '#d5d5d5' : 'rgba(180,180,180,0.2)';
        var glyph = ACTION_SVGS[key] || ACTION_SVGS['add'];
        // When active, swap stroke to dark so the glyph is visible on #d5d5d5
        if (active) glyph = glyph.replace("color:#fff", "color:#222");
        return '<div data-toggle-chip data-on="' + (active ? '1' : '0') + '" ' +
          'style="width:51.67px;height:51.67px;aspect-ratio:1;border-radius:63.636px;' +
            'background:' + bg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + glyph + '</div>';
      }).join('');

      return '<div style="width:415px;height:88px;max-height:88px;' +
        'background:rgba(23,23,26,0.6);border:1px solid rgba(255,255,255,0.2);' +
        'border-radius:var(--card-radius,' + _R('widget') + ');padding:24px 17px 24px 20px;gap:20px;box-sizing:border-box;' +
        'display:flex;align-items:center;overflow:hidden;color:#fff;font-family:var(--font);">' +
        // Left: icon + title/sub
        '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;">' +
          '<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + deviceGlyph + '</div>' +
          '<div style="display:flex;flex-direction:column;min-width:0;">' +
            '<div style="font-size:16px;font-weight:700;color:#efeef2;line-height:1.2;width:138px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + stmTitle + '</div>' +
            (stmShowSub ? '<div style="font-size:14px;font-weight:500;color:#cfcccf;line-height:1.3;width:138px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + stmSub + '</div>' : '') +
          '</div>' +
        '</div>' +
        // Right: action circles
        '<div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:10px;">' + actionsHtml + '</div>' +
      '</div>';
    }

    case 'control-pill': {
      // QS control row: left circular icon + 2-line text + optional right
      // icon. Used for "SmartThings / Device control" and stand-alone
      // "Modes" row in the three QS states. variant keys:
      //   icon: 'smartthings'|'modes'|'wifi' — left circle glyph
      //   title, sub: two text lines
      //   rightIcon: 'refresh'|'chevron'|null — right-side accessory
      var cpv = (comp && comp.variant) || {};
      var cpIcon = cpv.icon || 'smartthings';
      var cpTitle = cpv.title || 'SmartThings';
      var cpSub   = cpv.sub || '';
      var cpRight = cpv.rightIcon || null;
      var LEFT_SVGS = {
        'smartthings':'<circle cx="12" cy="12" r="2.2" fill="#222"/><circle cx="12" cy="5" r="1.6" fill="#222"/><circle cx="12" cy="19" r="1.6" fill="#222"/><circle cx="5" cy="12" r="1.6" fill="#222"/><circle cx="19" cy="12" r="1.6" fill="#222"/><path d="M12 7.5v3M12 13.5v3M7 12h3M14 12h3" stroke="#222" strokeWidth="1.4" strokeLinecap="round"/>',
        'modes':      '<circle cx="12" cy="12" r="7.5" stroke="#222" strokeWidth="1.6"/><path d="M12 5v7l5 2.5" stroke="#222" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>',
        'wifi':       '<path d="M5 10a12 12 0 0 1 14 0M7 13.5a8 8 0 0 1 10 0M9 17a4 4 0 0 1 6 0" stroke="#222" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="20" r="1.4" fill="#222"/>'
      };
      var RIGHT_SVGS = {
        'refresh':  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 14-5l2-2M20 7v4h-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>',
        'chevron':  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>'
      };
      var leftSvg = LEFT_SVGS[cpIcon] || LEFT_SVGS['smartthings'];
      var rightBlock = '';
      if (cpRight && RIGHT_SVGS[cpRight]) {
        rightBlock = '<div style="width:44px;height:44px;border-radius:50%;background:rgba(180,180,180,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:8px;">' + RIGHT_SVGS[cpRight] + '</div>';
      }
      return '<div style="width:100%;height:100%;min-height:64px;background:rgba(120,120,125,0.28);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-radius:' + _R('widget') + ';padding:10px 14px 10px 10px;box-sizing:border-box;display:flex;align-items:center;gap:12px;color:#fff;font-family:var(--font);">' +
        '<div style="width:44px;height:44px;border-radius:50%;background:#d5d5d5;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">' + leftSvg + '</svg>' +
        '</div>' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;overflow:hidden;">' +
          '<div style="font-size:14px;font-weight:700;line-height:1.2;">' + cpTitle + '</div>' +
          (cpSub ? '<div style="font-size:var(--font-size-xs,14px);line-height:1.3;opacity:0.75;">' + cpSub + '</div>' : '') +
        '</div>' +
        rightBlock +
      '</div>';
    }

    case 'media-output-row': {
      // "♪ Play music                     Media output"  label row
      // used in QS compact/minimal above the Smart View / Song Search tiles.
      var mor = (comp && comp.variant) || {};
      var morL = mor.left  || 'Play music';
      var morR = mor.right || 'Media output';
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 16px;box-sizing:border-box;color:#fff;font-family:var(--font);font-size:var(--font-size-sm,16px);">' +
        '<div style="display:flex;align-items:center;gap:8px;"><span style="opacity:0.85;">\u266B</span><span>' + morL + '</span></div>' +
        '<div style="opacity:0.85;">' + morR + '</div>' +
      '</div>';
    }

    case 'qs-action-tile': {
      // Pill tile used for "Smart View / Mirror screen" and "Song Search"
      // at the bottom of QS. Left circular icon badge + 2-line text.
      var qat = (comp && comp.variant) || {};
      var qatIcon = qat.icon || 'smart-view';
      var qatTitle = qat.title || 'Smart View';
      var qatSub   = qat.sub || 'Mirror screen';
      var ICON_SVGS = {
        'smart-view':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="12" rx="1.5" stroke="#222" strokeWidth="1.6"/><path d="M12 9l4 2.5-4 2.5V9z" fill="#222"/></svg>',
        'song-search':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 17V6l10-2v11" stroke="#222" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7" cy="17" r="2.4" stroke="#222" strokeWidth="1.6"/><circle cx="17" cy="15" r="2.4" stroke="#222" strokeWidth="1.6"/></svg>'
      };
      var qatSvg = ICON_SVGS[qatIcon] || ICON_SVGS['smart-view'];
      return '<div style="width:100%;height:100%;min-height:56px;background:rgba(120,120,125,0.28);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-radius:' + _R('widget') + ';padding:8px 14px 8px 8px;box-sizing:border-box;display:flex;align-items:center;gap:10px;color:#fff;font-family:var(--font);">' +
        '<div style="width:40px;height:40px;border-radius:50%;background:#d5d5d5;flex-shrink:0;display:flex;align-items:center;justify-content:center;">' + qatSvg + '</div>' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;overflow:hidden;">' +
          '<div style="font-size:var(--font-size-sm,16px);font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + qatTitle + '</div>' +
          '<div style="font-size:var(--font-size-xs,14px);line-height:1.3;opacity:0.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + qatSub + '</div>' +
        '</div>' +
      '</div>';
    }

    case 'lock-widgets':
      return '<div class="lock-widgets-container" style="display:flex;gap:14px;justify-content:center;">' +
        window.renderAtomicForRole({ role: 'lock-widget-battery' }, { w: 124, h: 56 }) +
        window.renderAtomicForRole({ role: 'lock-widget-activity' }, { w: 124, h: 56 }) +
      '</div>';

    case 'lock-widget-battery':
      return '<div class="lock-widget lock-widget--battery" style="width:124px;height:56px;background:rgba(23,23,26,0.3);backdrop-filter:blur(5.4px);border-radius:20px;display:flex;align-items:center;justify-content:center;gap:9px;">' +
        '<div class="battery-icon" style="width:45px;height:43px;position:relative;">' +
          '<svg width="45" height="43" viewBox="0 0 45 43" fill="none"><circle cx="22.5" cy="21.5" r="18" stroke="rgba(255,255,255,0.2)" stroke-width="3"/><path d="M22.5 3.5 A18 18 0 0 1 38.5 30" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>' +
          '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(255,255,255,0.8);font-weight:600;">29</div>' +
        '</div>' +
        '<div class="battery-icon" style="width:45px;height:43px;position:relative;">' +
          '<svg width="45" height="43" viewBox="0 0 45 43" fill="none"><circle cx="22.5" cy="21.5" r="18" stroke="rgba(255,255,255,0.2)" stroke-width="3"/><path d="M22.5 3.5 A18 18 0 1 1 10 35" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>' +
          '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(255,255,255,0.8);font-weight:600;">74</div>' +
        '</div>' +
      '</div>';

    case 'lock-widget-activity':
      return '<div class="lock-widget lock-widget--activity" style="width:124px;height:56px;background:rgba(23,23,26,0.3);backdrop-filter:blur(5.4px);border-radius:20px;display:flex;align-items:center;padding:0 12px;gap:9px;">' +
        '<div style="width:43px;height:43px;background:rgba(255,255,255,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="#fff"/></svg>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:2px;">' +
          '<div style="display:flex;align-items:center;gap:4px;"><div style="width:8px;height:8px;background:rgba(255,255,255,0.3);border-radius:50%;"></div><span style="font-size:9px;color:rgba(255,255,255,0.86);font-weight:600;">4,209</span></div>' +
          '<div style="display:flex;align-items:center;gap:4px;"><div style="width:8px;height:8px;background:rgba(255,255,255,0.3);border-radius:50%;"></div><span style="font-size:9px;color:rgba(255,255,255,0.86);font-weight:600;">25</span></div>' +
          '<div style="display:flex;align-items:center;gap:4px;"><div style="width:8px;height:8px;background:rgba(255,255,255,0.3);border-radius:50%;"></div><span style="font-size:9px;color:rgba(255,255,255,0.86);font-weight:600;">650</span></div>' +
        '</div>' +
      '</div>';

    case 'persona2-widgets':
      if (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test2') {
        return '<div class="p2-widgets p2-widgets--compact" style="position:relative; width:100%; height:240px;">' +
          '<div id="p2-area" class="p2-agent-shell" style="position:absolute; top:0; left:24px; right:24px; height:148px; overflow:hidden;">' +
            '<div class="p2-agent-fill" aria-hidden="true">' +
              '<canvas class="p2-agent-fill__gl"></canvas>' +
              '<div class="p2-agent-fill__edge" aria-hidden="true"></div>' +
              '<div class="p2-agent-fill__edge-inner" aria-hidden="true"></div>' +
              '<div class="p2-agent-fill__bloom"></div>' +
              '<div class="p2-agent-fill__mist"></div>' +
              '<div class="p2-agent-fill__wave"></div>' +
            '</div>' +
            '<div id="p2-default-widgets" class="p2-agent-main" style="position:relative; width:100%; flex:1; min-height:0; transition:opacity 0.4s ease;">' +
              '<div id="p2-result" class="p2-dark p2-obc-host p2-agent-card" style="position:absolute; inset:0; background:transparent; border-radius:36px; padding:0; box-sizing:border-box; overflow:hidden;">' +
                '<div class="p2-result-loading" aria-hidden="true">' +
                  '<div class="p2-result-loading__bg"></div>' +
                  '<div class="p2-result-loading__shimmer"></div>' +
                  '<div class="p2-result-loading__content">' +
                    '<div class="p2-result-loading__head">' +
                      '<div class="p2-result-loading__title">상황에 맞는 UI 생성중...</div>' +
                      '<div class="p2-result-loading__status">요청하신 내용을 정리중입니다.</div>' +
                      '<div class="p2-result-loading__sub" aria-hidden="true"></div>' +
                    '</div>' +
                    '<div class="p2-result-loading__footer">' +
                      '<div class="p2-result-loading__input">업무용 연락 정리해줘</div>' +
                      '<div class="p2-result-loading__icon" aria-hidden="true">' +
                        '<div class="p2-loading-dots">' +
                          '<span></span><span></span><span></span><span></span><span></span>' +
                        '</div>' +
                      '</div>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="p2-agent-card__body">' +
                  '<div class="p2-agent-greeting">' +
                    '<span id="p2-pill-title">휴가는 즐거우셨나요?</span>' +
                    '<span id="p2-pill-sub">업무 관련 주요 알림이 14건 있습니다.</span>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div id="p2-slot" class="p2-agent-slot" style="opacity:0; pointer-events:none; overflow:hidden;"></div>' +
            '<div class="p2-agent-footer">' +
              '<div class="p2-agent-input">업무용 연락 정리해줘</div>' +
              '<button id="p2-star" type="button" aria-label="AI Voice">' +
                window.renderAtomicForRole({ role: 'dot-icon-orange-badge-1x1' }, { w: 56, h: 56 }) +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }
      return '<div class="p2-widgets" style="position:relative; width: 100%; height: 450px;">' +
        // Pill
        '<div class="p2-pill" style="position:absolute; top:0; left: 24px; right: 24px; height: 80px; background: #FFFFFF; border-radius: 40px; display:flex; align-items:center; padding: 0 24px 0 12px; gap: 16px;">' +
          '<div class="p2-pill__icon" style="width: 56px; height: 56px; background: #FF9748; border-radius: 28px; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden;">' +
             '<div class="p2-icon-grid" aria-hidden="true">' +
               '<span></span><span></span>' +
               '<span></span><span></span>' +
             '</div>' +
          '</div>' +
          '<div style="display:flex; flex-direction:column; flex:1; margin-left:2px;">' +
            '<span id="p2-pill-title" style="font-family:\'Pretendard\',sans-serif; font-weight:800; font-size:18px; line-height:1.3; color:#1F160E;">휴가는 즐거우셨나요?</span>' +
            '<span id="p2-pill-sub" style="font-family:\'Pretendard\',sans-serif; font-weight:700; font-size:13px; color:rgba(255,151,72,0.78);">밀린 일들은 제가 정리할게요..</span>' +
          '</div>' +
        '</div>' +
        '<div id="p2-area" style="position:absolute; top: 88px; left: 24px; right: 24px; height: 168px; overflow:visible;">' +
          '<div id="p2-default-widgets" style="position:relative; width:100%; height:100%; transition: opacity 0.4s ease;">' +
            '<div id="p2-msg14" style="position:absolute; top: 0; left: 0; width: 80px; height: 80px; background: #FFFFFF; border-radius: 40px; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:2px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">' +
              '<div style="font-family:\'Pretendard\',sans-serif; font-weight:700; font-size:13px; color:#FF9748;">메세지</div>' +
              '<div style="font-family:\'Ndot 55 V2\', sans-serif; font-weight:800; font-size:36px; color:#1F160E; line-height:1;">14</div>' +
            '</div>' +
            '<button id="p2-star" type="button" aria-label="AI Voice" style="position:absolute; top: 88px; left: 0; width: 80px; height: 80px; background: transparent; border:0; padding:0; border-radius: 40px; display:flex; align-items:center; justify-content:center; cursor:pointer; -webkit-tap-highlight-color:transparent; z-index: 1001 !important; overflow:hidden;">' +
              '<div class="p2-breathing-chord" aria-hidden="true">' +
                '<span></span><span></span><span></span><span></span><span></span>' +
              '</div>' +
              window.renderAtomicForRole({ role: 'dot-icon-orange-badge-1x1' }, { w: 80, h: 80 }) +
            '</button>' +
            '<div id="p2-result" class="p2-dark p2-obc-host" style="position:absolute; top: 0; right: 0; left: auto; width: 252px; height: 168px; background: transparent; border-radius: 36px; padding: 0; display:block; box-sizing:border-box; overflow:hidden;">' +
              '<div class="p2-result-loading" aria-hidden="true">' +
                '<div class="p2-result-loading__bg"></div>' +
                '<div class="p2-result-loading__shimmer"></div>' +
                '<div class="p2-result-loading__content">' +
                  '<div class="p2-result-loading__title">상황에 맞는 UI를<br>구성하는 중…</div>' +
                  '<div class="p2-result-loading__sub"></div>' +
                '</div>' +
              '</div>' +
              window.renderAtomicForRole({ role: 'dot-orange-badge-card', variant: { title: '보고서 수정 니즈를 포착', subtitle: '필요한 내용을 정리해드릴게요' } }, { w: 252, h: 168 }) +
            '</div>' +
          '</div>' +
          '<div id="p2-slot" style="position:absolute; inset:0; opacity:0; pointer-events:none; overflow:visible;"></div>' +
        '</div>' +
      '</div>';

    case 'home-persona1-widgets':
      if (window.__p1_custom_widgets && window.__p1_custom_widgets.length > 0) {
        var sizes = {
          'dot-goal': {w: 340, h: 168},
          'dot-music-1x1': {w: 164, h: 164},
          'dot-total-steps-2x1': {w: 164, h: 80},
          'dot-running-compact': {w: 164, h: 80},
          'dot-time-matrix': {w: 340, h: 180},
          'dot-weather-2x1-v1-1': {w: 164, h: 80},
          'dot-weather-2x1-v1-2': {w: 164, h: 80},
          'dot-temperature-1x1': {w: 80, h: 80},
          'dot-date-1x1-v1-1': {w: 80, h: 80},
          'dot-date-1x1-v1-2': {w: 80, h: 80},
          'dot-schedule-4x2': {w: 340, h: 168},
          'dot-schedule-2x2': {w: 164, h: 164},
          'dot-emoji-1x1': {w: 164, h: 164},
          'dot-gallery-frame1': {w: 164, h: 164},
          'dot-gallery-img': {w: 164, h: 164},
          'dot-camera': {w: 164, h: 246},
          'composite-set': {w: 340, h: 340}
        };
        var customHtml = '<div class="home-persona1-widgets-container" style="width:100%;padding:0 24px;box-sizing:border-box;">' +
          '<div style="display:flex; flex-wrap:wrap; gap:12px; align-content:flex-start; justify-content:center;">';
        window.__p1_custom_widgets.forEach(function(c) {
          var sz = sizes[c.role] || {w: 340, h: 168};
          var cycleClass = c.role === 'dot-music-1x1'
            ? ' p1-cycle-item p1-cycle-music'
            : (c.role === 'dot-schedule-2x2' ? ' p1-cycle-item p1-cycle-schedule' : '');
          // Apply exact sizing constraints to prevent overlaps, handle composite sets specifically
          if (c.role === 'composite-set') {
              customHtml += '<div style="width:100%; position:relative;">' +
                window.renderAtomicForRole({ role: c.role, variant: c.variant || {} }, sz) +
              '</div>';
          } else {
              customHtml += '<div class="p1-widget-cell' + cycleClass + '" style="width:' + sz.w + 'px; height:' + sz.h + 'px; position:relative;">' +
                window.renderAtomicForRole({ role: c.role, variant: c.variant || {} }, sz) +
              '</div>';
          }
        });
        customHtml += '</div></div>';
        return customHtml;
      }
      // Align to persona2 padding style: fixed 24px side inset, centered grid.
      return '<div class="home-persona1-widgets-container" style="display:flex;flex-direction:column;align-items:stretch;gap:12px;width:100%;padding:0 24px;box-sizing:border-box;">' +
        // Row 1: Today's Goal
        '<div style="display:flex;justify-content:center;">' +
          '<div style="width:340px; height:168px; position:relative;">' +
            window.renderAtomicForRole({ role: 'dot-goal', variant: { title: "Today's Goal", time: '01:42:43', timeSuffix: 'Within', distance: '15km' } }, { w: 340, h: 168 }) +
          '</div>' +
        '</div>' +
        // Row 2: Music, Total Steps, Running compact
        '<div style="display:flex;gap:8px;width:100%;justify-content:center;">' +
          '<div style="width:340px; height:168px; position:relative;display:flex;gap:8px;">' +
            '<div class="p1-widget-cell p1-cycle-item p1-cycle-music" style="width:168px;height:168px;position:relative;">' +
              window.renderAtomicForRole({ role: 'dot-music-1x1' }, { w: 168, h: 168 }) +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:4px;width:168px;height:168px;">' +
              window.renderAtomicForRole({ role: 'dot-total-steps-2x1', variant: { count: '5,543' } }, { w: 168, h: 82 }) +
              window.renderAtomicForRole({ role: 'dot-running-compact', variant: { time: '10:35', label: 'Jogging' } }, { w: 168, h: 82 }) +
            '</div>' +
          '</div>' +
        '</div>' +
        // Row 3: Time matrix
        '<div style="display:flex;justify-content:center;margin-top:8px;">' +
          '<div style="width:340px; height:168px; position:relative;">' +
            window.renderAtomicForRole({ role: 'dot-time-matrix', variant: { bgColor: 'transparent', dotColor: '#FF7F24', time: '12:45', meta: 'MON', dayDigits: '  ' } }, { w: 340, h: 180 }) +
          '</div>' +
        '</div>' +
      '</div>';

    case 'home-top-widgets':
      return '<div class="home-top-widgets-container" style="display:grid;grid-template-columns:168px 168px;grid-template-rows:82px 82px;gap:6px;">' +
        '<div style="grid-column:1;grid-row:1;">' + window.renderAtomicForRole({ role: 'dot-weather-2x1-v1-1' }, { w: 168, h: 82 }) + '</div>' +
        '<div style="grid-column:1;grid-row:2;display:flex;gap:4px;">' +
          window.renderAtomicForRole({ role: 'dot-temperature-1x1' }, { w: 82, h: 82 }) +
          window.renderAtomicForRole({ role: 'dot-date-1x1-v1-1' }, { w: 82, h: 82 }) +
        '</div>' +
        '<div class="p1-widget-cell p1-cycle-item p1-cycle-schedule" style="grid-column:2;grid-row:1/span 2;position:relative;">' + window.renderAtomicForRole({ role: 'dot-schedule-2x2' }, { w: 168, h: 168 }) + '</div>' +
      '</div>';

    case 'home-mid-widgets':
      return '<div class="home-mid-widgets-container" style="display:flex;gap:8px;width:100%;height:168px;">' +
        '<div style="flex:1;height:168px;">' +
          window.renderAtomicForRole({ role: 'dot-music-1x1' }, { w: 168, h: 168 }) +
        '</div>' +
        '<div style="flex:1;height:168px;">' +
          window.renderAtomicForRole({ role: 'health-course-card' }, { w: 168, h: 168 }) +
        '</div>' +
      '</div>';

    case 'navigation-bar':
      var nbTheme = window.currentSurfaceType === window.SURFACE_TYPES.HEALTH_MLP ? 'light' : 'dark';
      var nbColor = nbTheme === 'light' ? '#000' : '#fff';
      return '<div class="navigation-bar" style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-around;padding:0 60px;">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="' + nbColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="4" stroke="' + nbColor + '" stroke-width="2"/></svg>' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M8 6h8M8 12h8M8 18h8" stroke="' + nbColor + '" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</div>';

    case 'app-dock': {
      // Samsung Home dock — real PNG app icons, label-less.
      var dc = (comp && comp.content) || {};
      var defaultApps = ['Phone', 'Messages', 'Internet', 'Camera'];
      var apps = Array.isArray(dc.apps) ? dc.apps : defaultApps;

      function dockIconHTML(appName) {
        // Map label → filename in /app-icons/. Falls back to a glyph tile.
        var map = {
          'Phone':'Phone.png', 'Messages':'Messages.png', 'Internet':'Internet.png',
          'Camera':'Camera.png', 'Gallery':'Gallery.png', 'Contacts':'Contacts.png',
          'Settings':'Settings.png', 'Clock':'Clock.png', 'Weather':'Weather.png',
          'Calculator':'Calculator.png', 'Calendar':'Clock.png', 'Notes':'Notes.png',
          'Cloud':'Cloud.png', 'Health':'Health.png', 'Reminder':'Reminder.png',
          'Store':'Store.png', 'SmartThings':'SmartThings.png',
          'Maps':'Maps.png', 'YT Music':'YTMusic.png'
        };

        // High-fidelity SVG fallbacks for common apps if PNGs are missing
        var svgFallbacks = {
          'Camera': '<div class="dock-icon" style="width:56px;height:56px;border-radius:20px;background:#1F1F1F;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.1);"><svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" stroke="white" stroke-width="2" fill="none"/><circle cx="12" cy="13" r="3" stroke="white" stroke-width="2" fill="none"/></svg></div>',
          'Gallery': '<div class="dock-icon" style="width:56px;height:56px;border-radius:20px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.1);"><svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" fill="#FF4B91"/><path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM4 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM14.83 9.17a2 2 0 1 0 2.83-2.83 2 2 0 0 0-2.83 2.83zM6.34 17.66a2 2 0 1 0 2.83-2.83 2 2 0 0 0-2.83 2.83zM14.83 14.83a2 2 0 1 0 2.83 2.83 2 2 0 0 0-2.83-2.83zM6.34 6.34a2 2 0 1 0 2.83 2.83 2 2 0 0 0-2.83-2.83z" fill="#FF4B91"/></svg></div>',
          'Maps': '<div class="dock-icon" style="width:56px;height:56px;border-radius:20px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.1);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4285F4"/><circle cx="12" cy="9" r="3" fill="white"/></svg></div>',
          'YT Music': '<div class="dock-icon" style="width:56px;height:56px;border-radius:20px;background:#FF0000;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.1);"><svg width="36" height="36" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="white"/><circle cx="12" cy="12" r="8" fill="#FF0000"/><path d="M10.5 9l5 3-5 3V9z" fill="white"/></svg></div>'
        };

        var file = map[appName] || null;
        if (file) {
          // Check if file actually exists would be ideal, but here we just try to render
          // If we know some files are missing, we can use the SVG fallbacks
          if (svgFallbacks[appName]) return svgFallbacks[appName];
          return '<img class="dock-icon" src="app-icons/' + file + '" style="width:56px;height:56px;border-radius:' + _R('widget') + ';object-fit:cover;flex-shrink:0;">';
        }
        var glyph = (appName || '·').charAt(0).toUpperCase();
        return '<div class="dock-icon" style="width:56px;height:56px;border-radius:' + _R('widget') + ';background:var(--accent-primary,#4285F4);display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;' +
          _T('heading', { weight: 'bold' }) + '">' + glyph + '</div>';
      }

      var iconsHTML = apps.slice(0, 5).map(dockIconHTML).join('');
      var isTabRoot = window.currentSurfaceType === window.SURFACE_TYPES.TAB_ROOT;
      var dockStyle = isTabRoot 
        ? 'background:transparent;border:none;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;'
        : _G('widgetPill');

      return '<div style="width:100%;height:100%;border-radius:var(--card-radius,' + _R('widget') + ');' +
        dockStyle +
        'display:flex;align-items:center;justify-content:space-around;padding:0 12px;box-sizing:border-box;">' +
        iconsHTML +
      '</div>';
    }

    case 'bottom-bar': {
      var bbc = (comp && comp.content) || {};
      var actions = Array.isArray(bbc.actions) ? bbc.actions : [{ label: 'Back' }, { label: 'Save' }, { label: 'Share' }];

      function barIconFor(label) {
        var lc = (label || '').toLowerCase();
        var c = 'currentColor';
        var s = 'width="16" height="16" viewBox="0 0 24 24" fill="none"';
        if (/back|cancel|close/.test(lc)) return '<svg ' + s + '><path d="M15 6l-6 6 6 6" stroke="' + c + '" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>';
        if (/save|bookmark/.test(lc))      return '<svg ' + s + '><path d="M6 4h12v16l-6-4-6 4V4z" stroke="' + c + '" strokeWidth="1.7" strokeLinejoin="round"/></svg>';
        if (/share/.test(lc))              return '<svg ' + s + '><circle cx="18" cy="6" r="2" stroke="' + c + '" strokeWidth="1.7"/><circle cx="6" cy="12" r="2" stroke="' + c + '" strokeWidth="1.7"/><circle cx="18" cy="18" r="2" stroke="' + c + '" strokeWidth="1.7"/><path d="M8 11l8-4M8 13l8 4" stroke="' + c + '" strokeWidth="1.5"/></svg>';
        if (/done|confirm|ok|check/.test(lc))  return '<svg ' + s + '><path d="M5 12l5 5 9-11" stroke="' + c + '" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>';
        if (/delete|trash|remove/.test(lc))    return '<svg ' + s + '><path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14" stroke="' + c + '" strokeWidth="1.6" strokeLinejoin="round"/></svg>';
        if (/edit|pencil/.test(lc))           return '<svg ' + s + '><path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" stroke="' + c + '" strokeWidth="1.6" strokeLinejoin="round"/></svg>';
        if (/cart|buy|order/.test(lc))        return '<svg ' + s + '><path d="M4 5h2l2 12h11l2-8H7" stroke="' + c + '" strokeWidth="1.7" strokeLinejoin="round"/></svg>';
        if (/like|heart|favor/.test(lc))      return '<svg ' + s + '><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" stroke="' + c + '" strokeWidth="1.7" strokeLinejoin="round"/></svg>';
        return '';
      }

      var actHTML = actions.slice(0, 4).map(function (a) {
        var lbl = (a && (a.label || a.text)) || '';
        var icon = barIconFor(lbl);
        return '<div style="display:flex;align-items:center;gap:6px;color:#fff;">' +
          (icon ? '<span style="display:flex;align-items:center;line-height:0;">' + icon + '</span>' : '') +
          '<span style="' + _T('label', { weight: 'semibold' }) + '">' + lbl + '</span>' +
        '</div>';
      }).join('');

      return '<div style="width:100%;height:100%;border-radius:var(--card-radius,' + _R('widget') + ');' +
        _G('widgetPill') +
        'display:flex;align-items:center;justify-content:space-around;padding:0 14px;box-sizing:border-box;">' +
        actHTML +
      '</div>';
    }

    case 'bottom-dialog':
      // Light surface — typography color override
      return '<div style="width:100%;height:100%;border-radius:' + _R('dialog') + ' ' + _R('dialog') + ' 0 0;background:#f1f1f4;color:#111;padding:' + _S('4xl') + ';box-sizing:border-box;">' +
        '<div style="' + _T('heading', { weight: 'bold', color: '#111' }) + '">Dialog header</div>' +
        '<div style="' + _T('label', { color: '#666' }) + 'margin-top:' + _S('md') + ';">Dialog description</div>' +
        '<div style="display:flex;justify-content:space-between;margin-top:24px;' + _T('body', { color: '#111' }) + '"><span>Action 1</span><span>Action 2</span></div>' +
      '</div>';

    case 'center-dialog':
      return '<div style="width:100%;height:100%;border-radius:' + _R('dialog') + ';background:#f1f1f4;color:#111;padding:' + _S('4xl') + ';box-sizing:border-box;">' +
        '<div style="' + _T('heading', { weight: 'bold', color: '#111' }) + '">Center dialog</div>' +
        '<div style="' + _T('label', { color: '#666' }) + 'margin-top:' + _S('md') + ';">Blocking or loading state</div>' +
      '</div>';

    case 'lock-time':
      // hero size, clock family (SamsungNrDefault-V6), bold
      return '<div style="width:100%;height:100%;display:flex;align-items:flex-start;' +
        _T('hero', { family: 'clock', weight: 'bold' }) +
      '">12:45</div>';

    case 'lock-date':
      return '<div style="width:100%;height:100%;display:flex;align-items:center;' +
        _T('heading', { color: 'translucentLabel' }) +
      '">Tue, Apr 20</div>';

    case 'lock-shortcuts':
      // shortcutCircle glass tier; radius via circle token
      return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;">' +
        '<div style="width:48px;height:48px;border-radius:50%;' + _G('shortcutCircle') + '"></div>' +
        '<div style="width:48px;height:48px;border-radius:50%;' + _G('shortcutCircle') + '"></div>' +
      '</div>';

    case 'quick-settings-panel':
      return A.QSScreen
        ? A.QSScreen()
        : '<div style="width:100%;height:100%;border-radius:' + _R('panel') + ' ' + _R('panel') + ' 0 0;' + _G('panel') + '"></div>';

    case 'background':
      return A.Background ? A.Background() : '';

    case 'scrim':
      return '<div style="width:100%;height:100%;background:rgba(0,0,0,0.42);"></div>';

    default:
      return '<div style="width:100%;height:100%;border-radius:' + _R('widget') + ';background:rgba(255,255,255,0.08);"></div>';
  }
};

// Fetch a fresh LLM-driven music recommendation for the test3 home
// stage. Stored on window.__mlpTest3MusicRec so the layout builder
// can read it when assembling the dot-music-1x1 variant. Called early
// (at intro tap) so the recommendation is ready by the time the music
// shift timer fires at ~5.6s. Silent failures — falls back to the
// curated default in the layout builder.
function _fetchTest3MusicRecommendation(ctx) {
  try {
    var body = ctx || {
      weather:   'Rainy',
      distance:  '15km',
      pace:      'easy',
      mood:      'energizing',
      timeOfDay: 'morning'
    };
    fetch('/api/p3/music', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.iconTitle) return;
        window.__mlpTest3MusicRec = {
          iconTitle:    data.iconTitle,
          iconSubtitle: data.iconSubtitle,
          artist:       data.artist || '',
          song:         data.song   || '',
          source:       data.source || 'unknown'
        };
        if (typeof _resetTest3MusicCopy === 'function') {
          _resetTest3MusicCopy(document.querySelector('#test3-music'));
        }
      })
      .catch(function () { /* silent — fallback handles it */ });
  } catch (_) {}
}

// Real-time weather fetch for the test3 home stage. Hits the
// /api/p3/weather endpoint (Open-Meteo proxy, no key needed) and caches
// the response on window.__mlpTest3Weather. The layout plan reads this
// cache when assembling the test3-weather variant; if the data arrives
// AFTER the card mounts, this function also patches the card's cycle
// lines in-place so the user sees the live values without waiting for
// another re-render. Silent failures — the layout's curated fallback
// remains visible.
function _fetchTest3Weather() {
  try {
    fetch('/api/p3/weather', { method: 'GET' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.cycleLines) return;
        window.__mlpTest3Weather = {
          location:    data.location || 'Seoul',
          weather:     data.weather  || 'Mild',
          sunIcon:     data.sunIcon  || 'pair-cloud-dual',
          cycleLines:  data.cycleLines.slice(0, 3),
          temperatureC: data.temperatureC,
          humidity:     data.humidity,
          source:      data.source  || 'unknown'
        };
        // If the card has already rendered with the fallback variant,
        // patch the visible line text in-place so the user sees fresh
        // data without waiting for another canvas re-render. The cycle
        // scroller animation continues uninterrupted; we just swap the
        // <span> textContents.
        try {
          var lines = document.querySelectorAll('#test3-weather .dot-card-cycle__line');
          if (lines && lines.length) {
            // 3 visible lines + 1 clone of line 1 at the end; map each.
            var src = window.__mlpTest3Weather.cycleLines;
            lines.forEach(function (el, i) {
              var srcIdx = (i < src.length) ? i : 0;   // clone reuses line 1
              if (src[srcIdx] != null) el.textContent = src[srcIdx];
            });
          }
        } catch (_) {}
      })
      .catch(function () { /* silent — fallback handles it */ });
  } catch (_) {}
}

// Measure the artist/song name inside the test3 music card and, if it
// would overflow the visible window, enable the marquee scroll. Calculates
// a duration proportional to the text width so longer titles don't speed
// past (target ~40 px/sec). Idempotent — safe to call after every render
// or LLM in-place patch; will toggle `.is-scrolling` off if the new text
// fits without overflow.
function _setupMusicNameMarquee(root) {
  try {
    var scope = root || document;
    var nameEls = scope.querySelectorAll('#test3-music .dot-music3__name');
    if (!nameEls || !nameEls.length) return;
    nameEls.forEach(function (nameEl) {
      var copy = nameEl.querySelector('.dot-music3__name-text');
      if (!copy) return;
      // Measure the FIRST copy only (the second is the aria-hidden clone).
      var copyW   = copy.getBoundingClientRect().width;
      var visible = nameEl.getBoundingClientRect().width;
      // Small fudge — keep marquee off when content is barely-fitting so we
      // don't scroll a 1px overflow.
      if (copyW > visible + 1) {
        // ~40 px/sec scroll speed; clamp 8–32s so very short or very long
        // titles still feel readable.
        var gap = 32;
        var dur = Math.max(8, Math.min(32, (copyW + gap) / 40));
        nameEl.style.setProperty('--music-marquee-dur', dur.toFixed(2) + 's');
        nameEl.classList.add('is-scrolling');
      } else {
        nameEl.classList.remove('is-scrolling');
        nameEl.style.removeProperty('--music-marquee-dur');
      }
    });
  } catch (_) {}
}

// test3 goal map — initialize Leaflet inside the .dot-goal__map-leaflet
// container that the dot-goal renderer creates when variant.useRealMap
// is set. Uses CartoDB DarkMatter (free, no API key) for the base
// tiles; the CSS hue-rotate/saturate filter in theme-page.css adds
// the navy-blue tint that matches the rest of the persona-3 aesthetic.
// Draws a dashed running route + start/current markers.
// Idempotent via data-map-init flag; safe to call after every mount.
// Fired when Leaflet has tiles ready — triggers the map bloom on the
// real goal card (circle grow + radar reveal). Idempotent.
function _pinTest3GoalMapPulseCenter(pulseEl) {
  if (!pulseEl) return;
  pulseEl.style.removeProperty('right');
  pulseEl.style.removeProperty('bottom');
  pulseEl.style.removeProperty('margin-top');
  pulseEl.style.removeProperty('margin');
  pulseEl.style.width = '38px';
  pulseEl.style.height = '38px';
  pulseEl.style.left = '50%';
  pulseEl.style.top = '50%';
  pulseEl.style.margin = '0';
  pulseEl.style.transform = 'translate(-50%, -50%)';
}
function _upgradeTest3GoalMapSeed(soft) {
  var goal = document.querySelector('#test3-goal');
  if (!goal) return null;
  var goalCard = goal.querySelector('.dot-goal');
  var mapParent = goal.querySelector('.dot-goal__map');
  if (!goalCard || !mapParent) return null;

  var existingPulse = mapParent.querySelector('.mlp-position-pulse.dot-goal__map-seed--from-seed') ||
    mapParent.querySelector('.mlp-position-pulse');
  if (existingPulse) {
    _pinTest3GoalMapPulseCenter(existingPulse);
    return existingPulse;
  }

  var seedEl = goalCard.querySelector('.dot-goal__map-seed') ||
    goalCard.querySelector('.dot-goal__map-seed--handoff') ||
    goalCard.querySelector('.mlp-position-pulse.dot-goal__map-seed--from-seed');
  if (!seedEl) return null;

  var isHandoff = seedEl.classList.contains('dot-goal__map-seed--handoff');
  seedEl.classList.remove('dot-goal__map-seed');
  seedEl.classList.add('mlp-position-pulse', 'dot-goal__map-seed--from-seed');
  if (isHandoff || soft) {
    seedEl.style.removeProperty('opacity');
    seedEl.style.removeProperty('visibility');
  } else {
    seedEl.style.opacity = '1';
    seedEl.style.visibility = 'visible';
  }
  seedEl.style.animation = 'none';

  if (!seedEl.querySelector('.mlp-position-pulse__core')) {
    var core = document.createElement('div');
    core.className = 'mlp-position-pulse__core';
    var halo = document.createElement('div');
    halo.className = 'mlp-position-pulse__halo';
    if (isHandoff || soft) {
      halo.style.opacity = '0';
      halo.style.transition = 'opacity 500ms cubic-bezier(0.16, 1, 0.3, 1)';
    }
    seedEl.appendChild(core);
    seedEl.appendChild(halo);
    seedEl.style.background = 'transparent';
    seedEl.style.boxShadow = 'none';
    if (isHandoff || soft) {
      requestAnimationFrame(function () {
        halo.style.opacity = '1';
      });
    }
  }

  if (!seedEl.classList.contains('dot-goal__map-seed--in-map')) {
    seedEl.classList.add('dot-goal__map-seed--in-map');
    mapParent.appendChild(seedEl);
  }
  _pinTest3GoalMapPulseCenter(seedEl);
  return seedEl;
}
function _triggerTest3GoalUnifiedEnter(goalEl) {
  if (!goalEl || !goalEl.isConnected) return;
  if (goalEl.classList.contains('test3-goal-copy-enter')) return;
  if (!goalEl.classList.contains('test3-goal-enter-ready')) return;

  goalEl.removeAttribute('data-test3-goal-map-hold');

  if (typeof _upgradeTest3GoalMapSeed === 'function') {
    _upgradeTest3GoalMapSeed(true);
  }

  var mapEl = goalEl.querySelector('.dot-goal__map');
  if (mapEl) {
    if (typeof _revealTest3GoalMapContentDuringBloom === 'function') {
      _revealTest3GoalMapContentDuringBloom(goalEl, mapEl);
    }
    mapEl.style.removeProperty('transform');
    mapEl.style.removeProperty('clip-path');
    mapEl.style.removeProperty('will-change');
  }

  var mapSlot = goalEl.querySelector('.dot-goal__map-slot');
  if (mapSlot) {
    mapSlot.style.removeProperty('opacity');
    mapSlot.style.removeProperty('visibility');
    mapSlot.style.removeProperty('transform');
    mapSlot.style.removeProperty('animation');
  }

  var copies = goalEl.querySelectorAll('.dot-goal__title, .dot-goal__time, .dot-goal__distance');
  copies.forEach(function (el) {
    el.style.removeProperty('opacity');
    el.style.removeProperty('visibility');
    el.style.removeProperty('transform');
    el.style.removeProperty('animation');
  });

  goalEl.classList.add('test3-goal-copy-enter');
  void goalEl.offsetWidth;
  copies.forEach(function (el) { void el.offsetWidth; });
  if (mapSlot) void mapSlot.offsetWidth;
}
function _finalizeTest3GoalEntrance(goalEl) {
  if (!goalEl || !goalEl.isConnected) return;
  var titleEl = goalEl.querySelector('.dot-goal__title');
  var timeEl = goalEl.querySelector('.dot-goal__time');
  var distEl = goalEl.querySelector('.dot-goal__distance');
  var mapEl = goalEl.querySelector('.dot-goal__map');
  var mapSlot = goalEl.querySelector('.dot-goal__map-slot');
  [titleEl, timeEl, distEl].forEach(function (el) {
    if (!el) return;
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.transform = 'translateY(0)';
    el.style.removeProperty('animation');
  });
  if (mapSlot) {
    mapSlot.style.opacity = '1';
    mapSlot.style.visibility = 'visible';
    mapSlot.style.transform = 'translateY(0)';
    mapSlot.style.removeProperty('animation');
  }
  if (mapEl) {
    mapEl.style.transform = 'none';
    mapEl.style.removeProperty('animation');
    mapEl.style.removeProperty('clip-path');
    mapEl.style.removeProperty('will-change');
  }
  goalEl.removeAttribute('data-test3-goal-map-hold');
  goalEl.removeAttribute('data-test3-goal-map-bloomed');
  goalEl.setAttribute('data-test3-goal-map-ready', '1');
  goalEl.classList.add('test3-goal-map-ready');
  goalEl.classList.remove('test3-goal-enter', 'test3-goal-enter-ready', 'test3-goal-copy-enter');
  goalEl.classList.add('test3-goal-entrance-settled');
  var canvas = document.getElementById('canvas');
  if (canvas) canvas.removeAttribute('data-test3-goal-fresh');
  if (typeof _upgradeTest3GoalMapSeed === 'function') _upgradeTest3GoalMapSeed(true);
  try {
    if (typeof window.generateSurfaceScenario === 'function') {
      window.generateSurfaceScenario('tab-root');
    }
  } catch (_) {}
}
function _orchestrateTest3GoalEntrance(goalEl) {
  if (!goalEl || goalEl.dataset.test3GoalEntrance === '1') return;
  goalEl.dataset.test3GoalEntrance = '1';
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      try {
        if (!goalEl.isConnected) return;
        goalEl.classList.add('test3-goal-enter');
        void goalEl.offsetWidth;
        requestAnimationFrame(function () {
          try {
            if (!goalEl.isConnected) return;
            goalEl.classList.add('test3-goal-enter-ready');
            void goalEl.offsetWidth;
            try {
              if (typeof _initTest3GoalMap === 'function') _initTest3GoalMap();
            } catch (_) {}
            setTimeout(function () {
              try {
                if (!goalEl.isConnected) return;
                if (typeof _triggerTest3GoalUnifiedEnter === 'function') {
                  _triggerTest3GoalUnifiedEnter(goalEl);
                }
                setTimeout(function () {
                  if (typeof _finalizeTest3GoalEntrance === 'function') {
                    _finalizeTest3GoalEntrance(goalEl);
                  }
                }, TEST3_GOAL_UNIFIED_RISE_MS + 80);
              } catch (_) {}
            }, 360);
          } catch (_) {}
        });
      } catch (_) {}
    });
  });
}
function _revealTest3GoalMapContentDuringBloom(goalEl, mapEl) {
  if (!mapEl) return;
  var leafletEl = mapEl.querySelector('.dot-goal__map-leaflet');
  if (leafletEl) {
    leafletEl.style.removeProperty('opacity');
    leafletEl.style.removeProperty('visibility');
    leafletEl.style.removeProperty('animation');
  }
  mapEl.style.background = '#0F1F3D';
}
function _signalTest3GoalMapReady() {
  /* Unified slide-up entrance handles map reveal in _triggerTest3GoalUnifiedEnter. */
}
function _initTest3GoalMap() {
  if (typeof window.L !== 'function' && typeof window.L !== 'object') return;
  var L = window.L;
  var el = document.querySelector('#test3-goal .dot-goal__map-leaflet');
  if (!el) return;
  if (el.dataset.mapInit === '1') return;
  el.dataset.mapInit = '1';
  try {
    // Yeouido / Han River area in Seoul — runnable promenade for the
    // "Running Now" context. Coords picked so the polyline traces a
    // recognizable bend along the south bank.
    var map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
    }).setView([37.5219, 126.9248], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
    // Per user direction the running ROUTE and START marker are no
    // longer rendered — the map only carries the runner's CURRENT
    // POSITION as a constantly blinking marker. routeCoords is still
    // kept (private) so the hover-triggered slow crawl below has a
    // path to interpolate along when the user is inspecting the phone.
    var routeCoords = [
      [37.5208, 126.9230],
      [37.5212, 126.9236],
      [37.5215, 126.9242],
      [37.5217, 126.9246],
      [37.5219, 126.9250],
      [37.5219, 126.9254],
    ];
    // Position marker is now a FIXED-CENTER overlay (not a Leaflet
    // marker bound to a lat/lng) AND is appended to .dot-goal__map
    // (the parent of the Leaflet container), not inside Leaflet
    // itself. This achieves two things:
    //   (1) the pulse sits above Leaflet's stacked panes (200–800)
    //       reliably at z-index 1000 — earlier inside-Leaflet placement
    //       could get covered by tilePane
    //   (2) when we pan the map via CSS transform on the Leaflet
    //       container (see _startTest3MapDotMotion), the pulse stays
    //       perfectly anchored at the visual center because it is OUTSIDE
    //       the transformed element.
    var mapParent = el.parentNode;
    var goalCard = mapParent && mapParent.closest('.dot-goal');
    var seedEl = goalCard && goalCard.querySelector('.dot-goal__map-seed');
    var existingPulse = mapParent && mapParent.querySelector('.mlp-position-pulse');
    if (!existingPulse && !seedEl) {
      var pulseOverlay = document.createElement('div');
      pulseOverlay.className = 'mlp-position-pulse';
      pulseOverlay.setAttribute('aria-hidden', 'true');
      pulseOverlay.innerHTML =
        '<div class="mlp-position-pulse__core"></div>' +
        '<div class="mlp-position-pulse__halo"></div>';
      if (mapParent) mapParent.appendChild(pulseOverlay);
      else el.appendChild(pulseOverlay);
      if (typeof _pinTest3GoalMapPulseCenter === 'function') {
        _pinTest3GoalMapPulseCenter(pulseOverlay);
      }
    }
    // Map state: the slow-pan loop below shifts `el` via CSS
    // translate3d (GPU-accelerated, smooth) rather than calling
    // map.setView per-frame (which would cause Leaflet to recompute
    // layout and stutter visibly). startCoord is the route's anchor
    // — the pan loop computes offsets relative to this point each
    // frame using the CURRENT map zoom (re-projected per frame so the
    // initial slow zoom-out from z=16 → z=14 doesn't break the math).
    window.__mlpTest3MapState = {
      map:         map,
      mapEl:       el,
      routeCoords: routeCoords,
      startCoord:  routeCoords[Math.floor(routeCoords.length / 2)],
      progress:    1.0,
      rafId:       null,
    };
    // Compass overlay — positioned absolutely in the map container's
    // right-center per spec. The container has overflow:hidden + a
    // 50% border-radius (it's the goal card's circular map slot), so
    // the compass sits inside the circle clipped to the same shape.
    // Built as a single SVG so it stays crisp at any pixel density.
    var compass = document.createElement('div');
    compass.className = 'mlp-map-compass';
    compass.innerHTML =
      '<svg viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<circle cx="17" cy="17" r="17" fill="#1A1D26" fill-opacity="0.78"/>' +
        // Red needle (north): triangle pointing up
        '<path d="M17 6 L21 18 L17 16 L13 18 Z" fill="#E94A4A"/>' +
        // White needle (south): triangle pointing down, slightly lower opacity
        '<path d="M17 28 L13 16 L17 18 L21 16 Z" fill="#FFFFFF" fill-opacity="0.72"/>' +
        // Center pin dot
        '<circle cx="17" cy="17" r="1.6" fill="#FFFFFF"/>' +
      '</svg>';
    // Compass also goes OUTSIDE the Leaflet container — same reason as
    // the pulse overlay: when the Leaflet container gets CSS-translated
    // during the smooth pan, the compass should stay pinned to the
    // visual right edge of the circular map frame, not drift with it.
    if (mapParent) mapParent.appendChild(compass);
    else el.appendChild(compass);

    // Slow zoom-out animation ONLY on the first init in this session.
    // On subsequent inits (e.g. after the 5.6s music-shift wipe
    // re-creates the goal element), skip the zoom — the user would
    // perceive a repeated slow GPS-settling as "the map is refreshing
    // every time". Instead, snap directly to the final zoom 14 view
    // so the map looks identical to its pre-wipe state.
    if (!window.__mlpTest3GoalMapZoomDone) {
      try {
        map.setView(map.getCenter(), 14, {
          animate: true,
          duration: 3,
          easeLinearity: 0.25
        });
        window.__mlpTest3GoalMapZoomDone = true;
      } catch (_) { /* setView failed — leave the map at z=16 */ }
    } else {
      // Re-render: jump to final state instantly.
      try { map.setView(map.getCenter(), 14, { animate: false }); } catch (_) {}
    }
    // Map panning intentionally DISABLED — per UX direction the map
    // should stay centered and static so the user can read the whole
    // circular slot without parts getting cropped by the running pan.
    // The pulse stays anchored at the visual center and the route
    // around it stays fixed. (The slow-pan loop function is still
    // defined in case we re-enable it later.)
    map.whenReady(function () {
      var goalEl = document.querySelector('#test3-goal');
      var signaled = false;
      function trySignal() {
        if (signaled) return;
        var liveGoal = document.querySelector('#test3-goal');
        if (!liveGoal) return;
        if (liveGoal.dataset.test3GoalEntrance === '1') return;
        signaled = true;
        _signalTest3GoalMapReady();
      }
      var hasHandoff = goalEl && goalEl.querySelector('.dot-goal__map-seed--handoff');
      var dotBeat = hasHandoff ? 360 : 480;
      map.once('load', function () {
        setTimeout(trySignal, dotBeat);
      });
      setTimeout(trySignal, Math.max(1600, dotBeat + 400));
    });
  } catch (e) {
    // Leaflet init failed (CDN blocked, etc.) — leave the empty div
    // and reset the flag so a retry could fire later. The CSS gives
    // the empty div the card's dark bg, so the user sees a clean
    // dark circle rather than a broken layout.
    el.dataset.mapInit = '0';
  }
}

// test3 goal time live ticker — increments the HH:MM:SS display on
// .dot-goal__time once per second so the "Running Now" card feels
// live. Idempotent: re-calling clears any previous interval first.
// Stopped when the user navigates away or returns to intro stage.
function _startTest3GoalTimeTicker() {
  if (window.__mlpTest3GoalTickerId) {
    clearInterval(window.__mlpTest3GoalTickerId);
    window.__mlpTest3GoalTickerId = null;
  }
  window.__mlpTest3GoalTickerId = setInterval(function () {
    var el = document.querySelector('#test3-goal .dot-goal__time');
    if (!el) {
      // Element gone — likely stage changed. Stop the ticker.
      clearInterval(window.__mlpTest3GoalTickerId);
      window.__mlpTest3GoalTickerId = null;
      return;
    }
    var parts = String(el.textContent).trim().split(':').map(function (p) { return parseInt(p, 10); });
    if (parts.length !== 3 || parts.some(isNaN)) return;
    var h = parts[0], m = parts[1], s = parts[2];
    s += 1;
    if (s >= 60) { s = 0; m += 1; }
    if (m >= 60) { m = 0; h += 1; }
    if (h >= 100) h = 0; // safety wrap
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    el.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
  }, 1000);
}
function _stopTest3GoalTimeTicker() {
  if (window.__mlpTest3GoalTickerId) {
    clearInterval(window.__mlpTest3GoalTickerId);
    window.__mlpTest3GoalTickerId = null;
  }
}

// test3 goal distance live ticker — increments the .dot-goal__distance
// readout once per second at a 5:00 min/km pace (= 1000m / 300s ≈ 3.333
// m/s). Format flips between "Xm" under 1000 m and "X.Y km" past it
// (one decimal, rounded). Live state is held on the element via
// data-meters so the readout is the source of truth and survives
// re-renders that preserve the same node (the diff render in test3 home
// keeps test3-goal across the music shift). Idempotent — clears any
// previous interval first.
function _startTest3GoalDistanceTicker() {
  if (window.__mlpTest3GoalDistTickerId) {
    clearInterval(window.__mlpTest3GoalDistTickerId);
    window.__mlpTest3GoalDistTickerId = null;
  }
  function fmt(meters) {
    if (meters < 1000) return Math.round(meters) + 'm';
    // 1 decimal place, rounded. 1180m → 1.2km, 1240m → 1.2km, 1250m → 1.3km.
    return (Math.round(meters / 100) / 10).toFixed(1) + 'km';
  }
  function readSeed(el) {
    // Initial seed: read data-meters if present, otherwise parse the text.
    var dm = parseFloat(el.dataset.meters);
    if (!isNaN(dm)) return dm;
    var txt = String(el.textContent).trim();
    var n = parseFloat(txt);
    if (isNaN(n)) return 180;
    // Heuristic: "180m" → 180; "1.2km" → 1200; "15km" → 15000.
    if (/km/i.test(txt)) return n * 1000;
    return n;
  }
  window.__mlpTest3GoalDistTickerId = setInterval(function () {
    var el = document.querySelector('#test3-goal .dot-goal__distance');
    if (!el) {
      clearInterval(window.__mlpTest3GoalDistTickerId);
      window.__mlpTest3GoalDistTickerId = null;
      return;
    }
    // While the cursor is on the phone, freeze the distance so the user
    // can read the number without it shifting. The map dot keeps moving
    // slowly via _startTest3MapDotMotion (started by the mouseenter
    // handler) so the scene still feels alive.
    if (window.__mlpTest3HoverPaused) return;
    var meters = readSeed(el);
    meters += 1000 / 300;   // 5:00 min/km → 3.333... m per tick
    el.dataset.meters = meters.toFixed(3);
    el.textContent = fmt(meters);
  }, 1000);
}
function _stopTest3GoalDistanceTicker() {
  if (window.__mlpTest3GoalDistTickerId) {
    clearInterval(window.__mlpTest3GoalDistTickerId);
    window.__mlpTest3GoalDistTickerId = null;
  }
}

// Music card current-time ticker. The progress bar animates from 0 to
// test3 home music — fade-in playback when #test3-music mounts.
var TEST3_MUSIC_AUDIO_TARGET_VOL = 0.8;
var TEST3_MUSIC_AUDIO_FADE_MS = 2000;
function _test3MusicAudioSrc() {
  return encodeURI('/music/Majestic-12 - Alex Jones _ Xander Jones.mp3');
}
function _stopTest3MusicAudioFade() {
  if (window.__mlpTest3MusicAudioFadeId) {
    cancelAnimationFrame(window.__mlpTest3MusicAudioFadeId);
    window.__mlpTest3MusicAudioFadeId = null;
  }
}
function _ensureTest3MusicAudio() {
  if (window.__mlpTest3MusicAudio) return window.__mlpTest3MusicAudio;
  var audio = new Audio(_test3MusicAudioSrc());
  audio.preload = 'auto';
  audio.loop = false;
  audio.volume = 0;
  window.__mlpTest3MusicAudio = audio;
  return audio;
}
function _fadeTest3MusicAudioTo(targetVol, durationMs) {
  var audio = window.__mlpTest3MusicAudio;
  if (!audio) return;
  _stopTest3MusicAudioFade();
  var startVol = audio.volume;
  var start = performance.now();
  function tick(now) {
    if (!window.__mlpTest3MusicAudio) return;
    var t = Math.min(1, (now - start) / durationMs);
    audio.volume = startVol + (targetVol - startVol) * t;
    if (t < 1) {
      window.__mlpTest3MusicAudioFadeId = requestAnimationFrame(tick);
    } else {
      window.__mlpTest3MusicAudioFadeId = null;
    }
  }
  window.__mlpTest3MusicAudioFadeId = requestAnimationFrame(tick);
}
function _startTest3MusicAudioFadeIn() {
  var stillTest3 =
    (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3') ||
    (document.body && document.body.dataset && document.body.dataset.mlpTest === 'test3');
  if (!stillTest3) return;
  var audio = _ensureTest3MusicAudio();
  _stopTest3MusicAudioFade();
  audio.volume = 0;
  window.__mlpTest3MusicAudioPending = false;
  var playPromise = audio.play();
  if (playPromise && typeof playPromise.then === 'function') {
    playPromise.then(function () {
      _fadeTest3MusicAudioTo(TEST3_MUSIC_AUDIO_TARGET_VOL, TEST3_MUSIC_AUDIO_FADE_MS);
    }).catch(function () {
      window.__mlpTest3MusicAudioPending = true;
    });
  } else {
    _fadeTest3MusicAudioTo(TEST3_MUSIC_AUDIO_TARGET_VOL, TEST3_MUSIC_AUDIO_FADE_MS);
  }
}
function _setTest3MusicAudioPlaying(playing) {
  var stillTest3 =
    (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3') ||
    (document.body && document.body.dataset && document.body.dataset.mlpTest === 'test3');
  if (!stillTest3) return;
  var audio = window.__mlpTest3MusicAudio;
  if (!audio) {
    if (playing && typeof _startTest3MusicAudioFadeIn === 'function') {
      _startTest3MusicAudioFadeIn();
    }
    return;
  }
  if (playing) {
    if (window.__mlpTest3MusicAudioPending) {
      window.__mlpTest3MusicAudioPending = false;
      _startTest3MusicAudioFadeIn();
      return;
    }
    _stopTest3MusicAudioFade();
    var resumePromise = audio.play();
    if (resumePromise && typeof resumePromise.catch === 'function') {
      resumePromise.catch(function () {
        window.__mlpTest3MusicAudioPending = true;
      });
    }
    if (audio.volume < TEST3_MUSIC_AUDIO_TARGET_VOL * 0.5) {
      _fadeTest3MusicAudioTo(TEST3_MUSIC_AUDIO_TARGET_VOL, 400);
    } else {
      audio.volume = TEST3_MUSIC_AUDIO_TARGET_VOL;
    }
  } else {
    _stopTest3MusicAudioFade();
    audio.pause();
  }
}
function _stopTest3MusicAudio() {
  _stopTest3MusicAudioFade();
  window.__mlpTest3MusicAudioPending = false;
  var audio = window.__mlpTest3MusicAudio;
  if (!audio) return;
  try {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  } catch (_) {}
  window.__mlpTest3MusicAudio = null;
}
// full width over 180s (= 3:00) via the CSS animation
// `dotMusicBarProgress`; this ticker tracks the same 180s window and
// updates the .dot-music3__time--current text once per second so the
// "0:00 / 3:00" readout stays in sync with the bar's visible fill.
// Pauses + resumes with the play/pause button: each tick checks the
// `data-music-playing` attribute on #test3-music and skips the
// increment when it's "0" (paused). Caps at 180s so the readout never
// exceeds the total. Stored elapsed time on window so the value
// persists across renders.
function _startTest3MusicTimeTicker() {
  if (window.__mlpTest3MusicTimeId) {
    clearInterval(window.__mlpTest3MusicTimeId);
    window.__mlpTest3MusicTimeId = null;
  }
  if (window.__mlpTest3MusicElapsed == null) window.__mlpTest3MusicElapsed = 0;
  function fmt(s) {
    var m  = Math.floor(s / 60);
    var ss = s % 60;
    return (m < 10 ? '0' + m : String(m)) + ':' + (ss < 10 ? '0' + ss : String(ss));
  }
  function paint() {
    var el = document.querySelector('#test3-music .dot-music3__time--current');
    if (el) el.textContent = fmt(Math.min(180, window.__mlpTest3MusicElapsed));
  }
  paint();
  window.__mlpTest3MusicTimeId = setInterval(function () {
    var card = document.querySelector('#test3-music');
    // No card / paused → freeze the readout. The CSS rule below sets
    // animation-play-state: paused on the bar when the same attribute
    // flips to "0", so the bar and the time advance/pause together.
    if (!card) return;
    if (card.getAttribute('data-music-playing') === '0') return;
    if (window.__mlpTest3MusicElapsed >= 180) return;
    window.__mlpTest3MusicElapsed += 1;
    paint();
  }, 1000);
}
function _stopTest3MusicTimeTicker() {
  if (window.__mlpTest3MusicTimeId) {
    clearInterval(window.__mlpTest3MusicTimeId);
    window.__mlpTest3MusicTimeId = null;
  }
}

// Continuous rAF-driven map PAN. The map slides slowly underneath the
// centered pulse whenever the distance ticker is advancing — i.e., the
// runner's distance number is going up — matching how every map app
// keeps the user dot pinned to the viewport center while the world
// moves under them. When the user hovers the phone, the distance
// ticker pauses (see __mlpTest3HoverPaused above) and so does this
// pan: the per-frame `dt` is still being measured but no progress is
// added to the route, so the view freezes wherever it last was.
// Interpolates a lat/lng along the route stored by
// _initTest3GoalMap and recenters the map view to that lat/lng each
// frame. Safe to call repeatedly — guards on an existing rafId so it
// doesn't stack.
function _startTest3MapDotMotion() {
  var s = window.__mlpTest3MapState;
  if (!s || !s.map || !s.routeCoords || !s.mapEl) return;
  if (s.rafId) return;
  var coords = s.routeCoords;
  var nSeg   = coords.length - 1;
  var lastT  = performance.now();
  function tick(now) {
    var dt = now - lastT;
    lastT  = now;
    // Only advance progress when distance is ticking (= NOT hover-
    // paused). Keeps the map view frozen during hover, matching the
    // distance number's frozen state.
    if (!window.__mlpTest3HoverPaused) {
      // ~5% per second → 20s for a full route loop. Slow enough to
      // read as a steady forward drift.
      s.progress += dt / 20000;
      if (s.progress >= 1) s.progress -= 1;
      var totalP = s.progress * nSeg;
      var segIdx = Math.min(Math.floor(totalP), nSeg - 1);
      var localP = totalP - segIdx;
      var a = coords[segIdx];
      var b = coords[segIdx + 1];
      var lat = a[0] + (b[0] - a[0]) * localP;
      var lng = a[1] + (b[1] - a[1]) * localP;
      try {
        // SMOOTH pan via CSS translate3d on the Leaflet container.
        // Previously called map.setView per frame which triggered
        // Leaflet's full layout recalc → visible jitter at ~60fps.
        // Now we keep Leaflet's view fixed (so tiles stay loaded and
        // the marker pane stays stable) and visually shift the ENTIRE
        // Leaflet container with a GPU-accelerated transform. The
        // pulse + compass are siblings OUTSIDE this container so they
        // stay anchored to the map frame's geometry while the tiles
        // glide underneath.
        // latLngToLayerPoint uses the map's CURRENT zoom + center, so
        // both points are projected on the same coord system — avoids
        // the catastrophic zoom mismatch we'd get from caching a pixel
        // value at one zoom and projecting later coords at another.
        var p  = s.map.latLngToLayerPoint([lat, lng]);
        var p0 = s.map.latLngToLayerPoint(s.startCoord);
        var dx = p.x - p0.x;
        var dy = p.y - p0.y;
        s.mapEl.style.transform = 'translate3d(' + (-dx).toFixed(2) + 'px, ' + (-dy).toFixed(2) + 'px, 0)';
      } catch (_) {}
    }
    s.rafId = requestAnimationFrame(tick);
  }
  s.rafId = requestAnimationFrame(tick);
}
function _stopTest3MapDotMotion() {
  var s = window.__mlpTest3MapState;
  if (!s || !s.rafId) return;
  cancelAnimationFrame(s.rafId);
  s.rafId = null;
}

// Responsive layout for the test3 home cards below the Running Now
// card. Weather and Today Progress reposition + resize based on:
//   (1) which state the music card is in (normal / lyrics / compact)
//   (2) whether either of them is in the tap-expanded state
// Called whenever any card's state changes. Uses inline style on the
// canvas-item wrappers; CSS transitions on .test3-card-flow handle
// the smooth animation between states. Returns silently if any card
// is missing or the music shift hasn't fired yet.
function _layoutTest3Cards() {
  var canvas = document.getElementById('canvas');
  if (!canvas || canvas.getAttribute('data-test-scope') !== 'test3') return;
  if (!window.__mlpTest3MusicShifted) return;
  var music   = document.querySelector('#test3-music');
  var weather = document.querySelector('#test3-weather');
  var steps   = document.querySelector('#test3-steps');
  if (!weather || !steps) return;
  var musicState   = music ? (music.getAttribute('data-music-state') || 'normal') : 'normal';
  var musicLoading = music && music.getAttribute('data-test3-music-loading') === '1';
  var musicPhase   = music ? (music.getAttribute('data-test3-music-phase') || 'spawn') : 'spawn';
  var inMusicEntrance = musicLoading || musicPhase !== 'playing';
  var inExpand = (weather && weather.classList.contains('is-motion-phase2')) ||
                 (steps && steps.classList.contains('is-motion-phase2')) ||
                 (music && music.classList.contains('is-motion-phase2'));
  // During entrance: 82 px capsule until vertical expand; 168 px once
  // phase-2 starts so weather/steps glide below the growing player.
  var musicH = inMusicEntrance
    ? (inExpand ? 168 : 82)
    : ((musicState === 'lyrics') ? 280 : 168);
  var weatherExp = weather.classList.contains('is-expanded');
  var stepsExp   = steps.classList.contains('is-expanded');
  var musicCompact = (musicState === 'compact');
  var musicBottom  = TEST3_ROW2_TOP + musicH;
  var FULL = 340, HALF = 168, ROW_H = 82, GAP = TEST3_CARD_GAP;
  var wX, wY, wW, sX, sY, sW;
  if (musicCompact) {
    // Music is 168×168 in the LEFT column at row2 (y=214). Right column
    // is open — ALWAYS stack the two cards there alongside the music
    // square, regardless of any is-expanded state on the cards. Their
    // expand class is preserved (so they re-expand when music grows
    // back to full width), but during compact they visually fold into
    // the right column. Without this override the user got the weird
    // "cards drop to the bottom even though there's empty space next
    // to the square music card" behaviour.
    wX = 196; wY = TEST3_ROW2_TOP;              wW = HALF;
    sX = 196; sY = TEST3_ROW2_TOP + ROW_H + GAP; sW = HALF;
  } else {
    // Music is 340 wide (normal or lyrics). Below-music row starts
    // right after the music card's bottom edge.
    var baseY = musicBottom + GAP;
    if (!weatherExp && !stepsExp) {
      wX = 24;  wY = baseY;                 wW = HALF;
      sX = 196; sY = baseY;                 sW = HALF;
    } else if (weatherExp && !stepsExp) {
      wX = 24;  wY = baseY;                 wW = FULL;
      sX = 24;  sY = baseY + ROW_H + GAP;   sW = HALF;
    } else if (!weatherExp && stepsExp) {
      sX = 24;  sY = baseY;                 sW = FULL;
      wX = 24;  wY = baseY + ROW_H + GAP;   wW = HALF;
    } else {
      wX = 24; wY = baseY;                  wW = FULL;
      sX = 24; sY = baseY + ROW_H + GAP;    sW = FULL;
    }
  }
  function apply(el, x, y, w, h) {
    el.classList.add('test3-card-flow');
    var initX = parseFloat(el.style.left) || 0;
    var initY = parseFloat(el.style.top)  || 0;
    // setProperty with 'important' so the inline transform/animation
    // override the music-shift CSS rules even if those gain priority
    // back via specificity tweaks down the road. Cancelling the
    // animation via 'animation: none !important' is needed because
    // CSS keyframe-set values otherwise beat inline transform.
    el.style.setProperty(
      'transform',
      'translate(' + (x - initX) + 'px, ' + (y - initY) + 'px)',
      'important'
    );
    el.style.setProperty('width', w + 'px', 'important');
    if (h != null) el.style.setProperty('height', h + 'px', 'important');
    el.style.setProperty('animation', 'none', 'important');
  }
  apply(weather, wX, wY, wW);
  apply(steps,   sX, sY, sW);
  // Resize the music wrapper to match the inner card's current state —
  // otherwise the canvas-item box stays 340×168 while the inner card
  // can be 168×168 (compact) or 340×280 (lyrics), causing clicks on
  // the inner card area to fall OUTSIDE the wrapper and miss the tap
  // handler that cycles the card state.
  if (music && !inMusicEntrance) {
    var mW = musicCompact ? TEST3_MUSIC_COMPACT : 340;
    apply(music, 24, TEST3_ROW2_TOP, mW, musicH);
    if (musicCompact) {
      music.style.setProperty('animation', 'none', 'important');
    }
    var shell = music.querySelector('.dot-music1');
    if (shell) {
      shell.style.setProperty('width', mW + 'px', 'important');
      shell.style.setProperty('height', musicH + 'px', 'important');
      shell.style.setProperty('animation', 'none', 'important');
    }
    var iconWrap = music.querySelector('.dot-music1__icon');
    if (iconWrap) {
      if (musicState === 'lyrics') {
        iconWrap.style.setProperty('width', '340px', 'important');
        iconWrap.style.setProperty('height', '280px', 'important');
      } else if (musicCompact) {
        iconWrap.style.setProperty('width', TEST3_MUSIC_COMPACT + 'px', 'important');
        iconWrap.style.setProperty('height', TEST3_MUSIC_COMPACT + 'px', 'important');
        iconWrap.style.setProperty('left', '0', 'important');
        iconWrap.style.setProperty('right', 'auto', 'important');
      } else {
        iconWrap.style.setProperty('width', '340px', 'important');
        iconWrap.style.removeProperty('height');
      }
      iconWrap.style.setProperty('animation', 'none', 'important');
    }
  }
}
// Keep weather/steps visible + pinned at their dropped row through prep
// handoff. Without this, removing data-test3-weather-prep before
// data-test3-music-shift activates lets .test3-intro-prefade snap back
// to opacity:0 — the "disappearing cards" bug.
function _freezeTest3WeatherDropState() {
  var weather = document.querySelector('#test3-weather');
  var steps   = document.querySelector('#test3-steps');
  [weather, steps].forEach(function (el) {
    if (!el) return;
    el.classList.remove('test3-intro-prefade');
    var computed = getComputedStyle(el);
    var ty = computed.transform;
    if (!ty || ty === 'none') {
      ty = 'translateY(86px)';
    }
    el.style.setProperty('transform', ty, 'important');
    el.style.setProperty('opacity', '1', 'important');
  });
}
// Reset test3 music card copy to the curated Figma strings so stale
// LLM patches (Holocene etc.) never surface in normal/lyrics/compact.
function _resetTest3MusicCopy(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  var state = music.getAttribute('data-music-state') || 'normal';
  var titleEl = music.querySelector('.dot-music1__icon .dot-music3__title');
  if (titleEl) {
    var titleCopy = state === 'lyrics' ? TEST3_MUSIC_LYRICS_TITLE : TEST3_MUSIC_TITLE;
    titleEl.innerHTML = titleCopy.replace(/\n/g, '<br/>');
  }
  var foldEl = music.querySelector('.dot-music1__icon .dot-music3__foldTitle');
  if (foldEl) {
    var foldCopy = state === 'compact' ? TEST3_MUSIC_COMPACT_FOLD : TEST3_MUSIC_FOLD_TITLE;
    foldEl.innerHTML = foldCopy.replace(/\n/g, '<br/>');
  }
  music.querySelectorAll('.dot-music1__icon .dot-music3__name-text').forEach(function (s) {
    s.textContent = 'M83 - Midnight City';
  });
  var timeCur = music.querySelector('.dot-music1__icon .dot-music3__time--current');
  var timeTot = music.querySelector('.dot-music1__icon .dot-music3__time--total');
  if (timeCur) timeCur.textContent = '01:35';
  if (timeTot) timeTot.textContent = '02:30';
  var albumEl = music.querySelector('.dot-music1__icon .dot-music3__albumCredit');
  if (albumEl) {
    albumEl.textContent = "Hurry Up, We're Dreaming.";
  }
  window.__mlpTest3MusicElapsed = 95;
  var bar = music.querySelector('.dot-music1__icon .dot-music3__bar');
  if (bar) {
    if (state === 'compact') {
      bar.style.setProperty('--bar-w', '140px');
      bar.style.setProperty('--bar-track', '107px');
    } else if (state === 'lyrics') {
      bar.style.setProperty('--bar-w', '300px');
      bar.style.setProperty('--bar-track', '228px');
    } else {
      bar.style.setProperty('--bar-w', '246px');
      bar.style.setProperty('--bar-track', '188px');
    }
  }
}
// Post-entrance settled chrome — dark-photo normal player (4423:17126).
// Applied at vertical expand end (~68 % / expand-ready), not at 14 s.
function _applyTest3MusicCompactLayout(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  var c = TEST3_MUSIC_COMPACT + 'px';
  music.style.setProperty('width', c, 'important');
  music.style.setProperty('height', c, 'important');
  music.style.setProperty('animation', 'none', 'important');
  var shell = music.querySelector('.dot-music1');
  if (shell) {
    shell.style.setProperty('width', c, 'important');
    shell.style.setProperty('height', c, 'important');
    shell.style.setProperty('background-color', 'transparent', 'important');
    shell.style.setProperty('animation', 'none', 'important');
  }
  var icon = music.querySelector('.dot-music1__icon');
  if (icon) {
    icon.style.setProperty('width', c, 'important');
    icon.style.setProperty('height', c, 'important');
    icon.style.setProperty('left', '0', 'important');
    icon.style.setProperty('right', 'auto', 'important');
    icon.style.setProperty('opacity', '1', 'important');
    icon.style.setProperty('visibility', 'visible', 'important');
    icon.style.setProperty('animation', 'none', 'important');
  }
  var player = music.querySelector('.dot-music1__icon .dot-music3');
  if (player) {
    player.style.setProperty('width', '100%', 'important');
    player.style.setProperty('height', c, 'important');
    player.style.setProperty('min-height', c, 'important');
    player.style.setProperty('animation', 'none', 'important');
  }
  music.querySelectorAll('.dot-music3__compactHeader, .dot-music3__foldTitle, .dot-music3__bottom, .dot-music3__transport, .dot-music3__albumCredit').forEach(function (el) {
    el.style.removeProperty('opacity');
    el.style.removeProperty('visibility');
    el.style.removeProperty('display');
    el.style.removeProperty('height');
    el.style.removeProperty('animation');
  });
  var titleEl = music.querySelector('.dot-music1__icon .dot-music3__title');
  var topEl = music.querySelector('.dot-music1__icon .dot-music3__top');
  if (titleEl) titleEl.style.setProperty('display', 'none', 'important');
  if (topEl) topEl.style.setProperty('display', 'none', 'important');
}
function _applyTest3MusicNormalLayout(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  music.style.setProperty('width', '340px', 'important');
  music.style.setProperty('height', '168px', 'important');
  var shell = music.querySelector('.dot-music1');
  if (shell) {
    shell.style.setProperty('width', '340px', 'important');
    shell.style.setProperty('height', '168px', 'important');
  }
  var icon = music.querySelector('.dot-music1__icon');
  if (icon) {
    icon.style.setProperty('width', '340px', 'important');
    icon.style.setProperty('height', '168px', 'important');
    icon.style.removeProperty('left');
    icon.style.removeProperty('right');
  }
  var titleEl = music.querySelector('.dot-music1__icon .dot-music3__title');
  var topEl = music.querySelector('.dot-music1__icon .dot-music3__top');
  if (titleEl) titleEl.style.removeProperty('display');
  if (topEl) topEl.style.removeProperty('display');
  var foldEl = music.querySelector('.dot-music1__icon .dot-music3__foldTitle');
  if (foldEl) foldEl.style.removeProperty('display');
  music.querySelectorAll('.dot-music3__bottom, .dot-music3__transport').forEach(function (el) {
    el.style.removeProperty('opacity');
    el.style.removeProperty('visibility');
    el.style.removeProperty('display');
    el.style.removeProperty('height');
    el.style.removeProperty('animation');
  });
}
function _applyTest3MusicLyricsLayout(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  music.style.setProperty('width', '340px', 'important');
  music.style.setProperty('height', '280px', 'important');
  var shell = music.querySelector('.dot-music1');
  if (shell) {
    shell.style.setProperty('width', '340px', 'important');
    shell.style.setProperty('height', '280px', 'important');
    shell.style.setProperty('background-color', 'transparent', 'important');
    shell.style.setProperty('animation', 'none', 'important');
  }
  var icon = music.querySelector('.dot-music1__icon');
  if (icon) {
    icon.style.setProperty('height', '280px', 'important');
    icon.style.setProperty('opacity', '1', 'important');
    icon.style.setProperty('visibility', 'visible', 'important');
    icon.style.setProperty('animation', 'none', 'important');
  }
  var player = music.querySelector('.dot-music1__icon .dot-music3');
  if (player) {
    player.style.setProperty('height', '280px', 'important');
    player.style.setProperty('min-height', '280px', 'important');
    player.style.setProperty('background', 'transparent', 'important');
    player.style.setProperty('animation', 'none', 'important');
    player.style.setProperty('display', 'flex', 'important');
    player.style.setProperty('flex-direction', 'column', 'important');
  }
  music.querySelectorAll('.dot-music3__compactHeader, .dot-music3__playlistPill, .dot-music3__playlistThumb, .dot-music3__playlistChevron, .dot-music3__bottom, .dot-music3__transport').forEach(function (el) {
    el.style.removeProperty('opacity');
    el.style.removeProperty('visibility');
    el.style.removeProperty('display');
    el.style.removeProperty('animation');
  });
  var titleEl = music.querySelector('.dot-music1__icon .dot-music3__title');
  var topEl = music.querySelector('.dot-music1__icon .dot-music3__top');
  if (titleEl) titleEl.style.removeProperty('display');
  if (topEl) topEl.style.removeProperty('display');
  var foldEl = music.querySelector('.dot-music1__icon .dot-music3__foldTitle');
  if (foldEl) foldEl.style.setProperty('display', 'none', 'important');
  var albumEl = music.querySelector('.dot-music1__icon .dot-music3__albumCredit');
  if (albumEl) albumEl.style.setProperty('display', 'none', 'important');
  var bar = music.querySelector('.dot-music1__icon .dot-music3__bar');
  if (bar) {
    bar.style.setProperty('--bar-w', '300px');
    bar.style.setProperty('--bar-track', '228px');
  }
  if (typeof _resetTest3MusicCopy === 'function') {
    _resetTest3MusicCopy(music);
  }
}
function _applyTest3MusicStateLayout(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  var state = music.getAttribute('data-music-state') || 'normal';
  if (state === 'compact') {
    if (typeof _applyTest3MusicCompactLayout === 'function') _applyTest3MusicCompactLayout(music);
  } else if (state === 'lyrics') {
    if (typeof _applyTest3MusicLyricsLayout === 'function') _applyTest3MusicLyricsLayout(music);
  } else {
    if (typeof _applyTest3MusicNormalLayout === 'function') _applyTest3MusicNormalLayout(music);
  }
}
function _applyTest3MusicSettledLayout(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  if (!music.getAttribute('data-music-state')) {
    music.setAttribute('data-music-state', 'normal');
  }
  music.setAttribute('data-test3-music-settled', '1');
  music.setAttribute('data-test3-music-phase', 'playing');
  music.setAttribute('data-test3-music-orb-handoff', '1');
  if (typeof _resetTest3MusicCopy === 'function') {
    _resetTest3MusicCopy(music);
  }
  var icon = music.querySelector('.dot-music1__icon');
  if (icon) {
    icon.style.setProperty('animation', 'none', 'important');
    icon.style.opacity = '1';
    icon.style.visibility = 'visible';
    icon.style.pointerEvents = 'auto';
  }
  music.querySelectorAll('.dot-music1__icon .dot-music3__icon, .dot-music1__icon .dot-music3__iconBg, .dot-music1__icon .dot-music3__playBtn').forEach(function (el) {
    el.style.setProperty('animation', 'none', 'important');
    el.style.display = 'none';
    el.style.opacity = '0';
    el.style.visibility = 'hidden';
  });
}
function _clearTest3MusicEntranceInlineStyles(music) {
  if (!music) return;
  var settled =
    music.getAttribute('data-test3-music-settled') === '1' ||
    music.getAttribute('data-test3-music-expand-ready') === '1';
  ['height', 'animation', 'opacity', 'visibility'].forEach(function (prop) {
    music.style.removeProperty(prop);
  });
  var shell = music.querySelector('.dot-music1');
  if (shell) {
    ['width', 'height', 'border-radius', 'clip-path', 'background-color', 'animation'].forEach(function (prop) {
      shell.style.removeProperty(prop);
    });
  }
  var icon = music.querySelector('.dot-music1__icon');
  if (icon) {
    ['opacity', 'visibility', 'pointer-events', 'animation', 'height'].forEach(function (prop) {
      icon.style.removeProperty(prop);
    });
  }
  var player = music.querySelector('.dot-music1__icon .dot-music3');
  if (player) {
    ['opacity', 'transform', 'filter', 'animation', 'will-change'].forEach(function (prop) {
      player.style.removeProperty(prop);
    });
  }
  var clearSel = settled
    ? '.dot-music1__icon .dot-music3__title, .dot-music1__icon .dot-music3__bottom, .dot-music1__compact--layout'
    : '.dot-music1__icon .dot-music3__title, .dot-music1__icon .dot-music3__bottom, .dot-music1__icon .dot-music3__iconBg, .dot-music1__icon .dot-music3__playBtn, .dot-music1__icon .dot-music3__icon, .dot-music1__compact--layout';
  music.querySelectorAll(clearSel).forEach(function (el) {
    ['opacity', 'visibility', 'pointer-events', 'animation', 'display', 'transform', 'width', 'height', 'left', 'top', 'margin', 'border-radius'].forEach(function (prop) {
      el.style.removeProperty(prop);
    });
  });
}
// Skip entrance entirely — debug / fallback only (not used on mount).
function _settleTest3MusicPlayerImmediately(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  music.setAttribute('data-music-playing', '1');
  music.setAttribute('data-test3-music-phase', 'playing');
  music.setAttribute('data-test3-music-orb-handoff', '1');
  music.setAttribute('data-test3-music-settled', '1');
  music.removeAttribute('data-test3-music-loading');
  music.removeAttribute('data-test3-music-pre-expand');
  music.removeAttribute('data-test3-music-expand-ready');
  music.classList.remove('is-motion-phase2');
  music.style.setProperty('animation', 'none', 'important');
  music.style.height = '168px';
  music.style.opacity = '1';
  music.style.visibility = 'visible';
  var shell = music.querySelector('.dot-music1');
  if (shell) {
    shell.style.width = '340px';
    shell.style.height = '168px';
    shell.style.borderRadius = '32px';
    shell.style.clipPath = 'inset(0 0 0 0 round 32px)';
    shell.style.setProperty('animation', 'none', 'important');
  }
  if (typeof _applyTest3MusicSettledLayout === 'function') {
    _applyTest3MusicSettledLayout(music);
  }
  if (typeof _layoutTest3Cards === 'function') _layoutTest3Cards();
}
// Mount the music card AFTER weather/steps have cleared row 2.
function _mountTest3MusicAfterWeatherPrep(runId) {
  try {
    var stillTest3 =
      (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3') ||
      (document.body && document.body.dataset && document.body.dataset.mlpTest === 'test3');
    if (!stillTest3) return;
    if ((window.__mlpTest3MusicShiftRunId || 0) !== runId) return;
    if (!window.__mlpTestConfig || window.__mlpTestConfig.homeStage !== 'home') return;
    var c = document.getElementById('canvas');
    if (!c || c.getAttribute('data-test-scope') !== 'test3') return;
    window.__mlpTest3MusicShiftPrep = false;
    window.__mlpTest3WeatherDropped = true;
    window.__mlpTest3MusicShifted = true;
    _freezeTest3WeatherDropState();
    c.setAttribute('data-test3-weather-dropped', '1');
    c.setAttribute('data-test3-music-shift', '1');
    if (typeof window.generateSurfaceScenario === 'function') {
      window.generateSurfaceScenario('tab-root');
    }
    c.removeAttribute('data-test3-weather-prep');
    _freezeTest3WeatherDropState();
    window.__mlpTest3MusicElapsed = 0;
    if (typeof _stopTest3MusicAudio === 'function') _stopTest3MusicAudio();
    var test3MusicEl = document.querySelector('#test3-music');
    if (test3MusicEl) {
      test3MusicEl.setAttribute('data-music-playing', '1');
      test3MusicEl.setAttribute('data-test3-music-loading', '1');
      test3MusicEl.setAttribute('data-test3-music-phase', 'spawn');
      test3MusicEl.removeAttribute('data-test3-music-pre-expand');
      test3MusicEl.removeAttribute('data-test3-music-expand-ready');
      test3MusicEl.removeAttribute('data-music-state');
      test3MusicEl.removeAttribute('data-test3-music-orb-handoff');
      test3MusicEl.removeAttribute('data-test3-music-settled');
      test3MusicEl.removeAttribute('data-test3-music-settling');
      if (typeof _clearTest3MusicEntranceInlineStyles === 'function') {
        _clearTest3MusicEntranceInlineStyles(test3MusicEl);
      }
      if (typeof _resetTest3MusicCopy === 'function') {
        _resetTest3MusicCopy(test3MusicEl);
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if ((window.__mlpTest3MusicShiftRunId || 0) !== runId) return;
          if (!document.querySelector('#test3-music')) return;
          if (typeof _restartTest3MusicEntranceAnimations === 'function') {
            _restartTest3MusicEntranceAnimations(test3MusicEl);
          }
          if (window.Test3MusicFillGL && typeof window.Test3MusicFillGL.ensureBound === 'function') {
            window.Test3MusicFillGL.ensureBound();
          }
        });
      });
    }
    if (typeof _startTest3MusicTimeTicker === 'function') {
      _startTest3MusicTimeTicker();
    }
    if (typeof _startTest3MusicAudioFadeIn === 'function') {
      _startTest3MusicAudioFadeIn();
    }
    setTimeout(function () {
      if ((window.__mlpTest3MusicShiftRunId || 0) !== runId) return;
      if (typeof _beginTest3MusicFill === 'function') {
        _beginTest3MusicFill();
      }
    }, TEST3_MUSIC_FILL_START_MS);
    setTimeout(function () {
      if (typeof _syncTest3CardsExpandDown === 'function') {
        _syncTest3CardsExpandDown();
      }
    }, TEST3_MUSIC_EXPAND_START_MS);
    setTimeout(function () {
      if ((window.__mlpTest3MusicShiftRunId || 0) !== runId) return;
      if (typeof _endTest3MusicFill === 'function') {
        _endTest3MusicFill();
      }
    }, TEST3_MUSIC_EXPAND_END_MS);
    setTimeout(function () {
      if (typeof _signalTest3MusicExpandReady === 'function') {
        _signalTest3MusicExpandReady();
      }
    }, TEST3_MUSIC_EXPAND_END_MS);
    setTimeout(function () {
      if (typeof _finalizeTest3MusicEntrance === 'function') {
        _finalizeTest3MusicEntrance();
      }
    }, TEST3_MUSIC_ENTRANCE_END_MS);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (typeof _setupMusicNameMarquee === 'function') {
          _setupMusicNameMarquee(document);
        }
      });
    });
  } catch (_) {}
}
function _beginTest3MusicFill(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  var shell = music.querySelector('.dot-music1');
  if (shell) {
    shell.classList.add('test3-music-shell--fill-active');
  }
  var fill = music.querySelector('.test3-music-fill');
  if (fill) {
    fill.classList.remove('test3-music-fill--fading');
    fill.classList.add('test3-music-fill--active');
  }
  if (window.Test3MusicFillGL) {
    window.Test3MusicFillGL.ensureBound();
    window.Test3MusicFillGL.setPhase('generating');
  }
}
function _endTest3MusicFill(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  var shell = music.querySelector('.dot-music1');
  if (shell) {
    shell.classList.remove('test3-music-shell--fill-active');
  }
  var fill = music.querySelector('.test3-music-fill');
  if (fill) {
    fill.classList.remove('test3-music-fill--active');
    fill.classList.add('test3-music-fill--fading');
  }
  if (window.Test3MusicFillGL) {
    window.Test3MusicFillGL.setPhase('fadeOut');
  }
}
// Phase-2: weather/steps glide to row below the expanding music card.
// Music shell + orb motion stay on the 14 s CSS timeline (no JS cut).
function _syncTest3CardsExpandDown() {
  var canvas = document.getElementById('canvas');
  if (!canvas || canvas.getAttribute('data-test-scope') !== 'test3') return;
  if (!window.__mlpTest3MusicShifted) return;
  var weather = document.querySelector('#test3-weather');
  var steps   = document.querySelector('#test3-steps');
  if (!weather || !steps) return;
  var music = document.querySelector('#test3-music');
  if (music) {
    music.setAttribute('data-test3-music-pre-expand', '1');
  }
  [weather, steps].forEach(function (el) {
    var computed = getComputedStyle(el).transform;
    el.classList.add('test3-card-flow', 'is-motion-phase2');
    el.style.setProperty('animation', 'none', 'important');
    if (computed && computed !== 'none') {
      el.style.setProperty('transform', computed, 'important');
    }
  });
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (typeof _layoutTest3Cards === 'function') _layoutTest3Cards();
    });
  });
}
// Expand end (~68 %) — crossfade orange orb player → dark photo normal (4423:17126).
function _finishTest3MusicSettle(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  music.removeAttribute('data-test3-music-settling');
  music.classList.remove('test3-music-settle-active', 'test3-music-content-enter');
  if (typeof _applyTest3MusicSettledLayout === 'function') {
    _applyTest3MusicSettledLayout(music);
  }
  if (typeof _clearTest3MusicEntranceInlineStyles === 'function') {
    _clearTest3MusicEntranceInlineStyles(music);
  }
}
function _signalTest3MusicExpandReady(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  if (music.getAttribute('data-test3-music-expand-ready') === '1') return;
  music.setAttribute('data-test3-music-expand-ready', '1');
  if (!music.getAttribute('data-music-state')) {
    music.setAttribute('data-music-state', 'normal');
  }
  setTimeout(function () {
    if (!music.isConnected) return;
    if (typeof _beginTest3MusicSettle === 'function') {
      _beginTest3MusicSettle(music);
    }
  }, TEST3_MUSIC_IMAGE1_HOLD_MS);
}
function _beginTest3MusicSettle(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  if (music.getAttribute('data-test3-music-settling') === '1') return;
  music.setAttribute('data-test3-music-settling', '1');
  if (typeof _resetTest3MusicCopy === 'function') {
    _resetTest3MusicCopy(music);
  }
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (!music.isConnected) return;
      music.classList.add('test3-music-settle-active', 'test3-music-content-enter');
    });
  });
  setTimeout(function () {
    if (typeof _finishTest3MusicSettle === 'function') {
      _finishTest3MusicSettle(music);
    }
  }, TEST3_MUSIC_SETTLE_MS);
}
function _revealTest3MusicPlayDisc(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  var playDisc = music.querySelector('.dot-music1__icon .dot-music3__iconBg');
  if (!playDisc) return;
  playDisc.style.opacity = '1';
  playDisc.style.visibility = 'visible';
  playDisc.style.background = 'rgba(255, 255, 255, 0.18)';
  playDisc.style.setProperty('animation', 'none', 'important');
}
function _revealTest3MusicPlayBtn(music) {
  music = music || document.querySelector('#test3-music');
  if (!music) return;
  var playBtn = music.querySelector('.dot-music1__icon .dot-music3__playBtn');
  if (!playBtn) return;
  playBtn.style.opacity = '1';
  playBtn.style.visibility = 'visible';
  playBtn.style.setProperty('animation', 'none', 'important');
}
function _restartTest3MusicEntranceAnimations(music) {
  if (!music) return;
  var fill = music.querySelector('.test3-music-fill');
  if (fill) {
    fill.classList.remove('test3-music-fill--active', 'test3-music-fill--fading', 'p2-agent-fill--gl-active', 'p2-agent-fill--gl-fading');
  }
  var shell = music.querySelector('.dot-music1');
  if (shell) {
    shell.classList.remove('test3-music-shell--fill-active');
  }
  if (window.Test3MusicFillGL) {
    window.Test3MusicFillGL.destroy();
  }
  var targets = [music].concat(Array.prototype.slice.call(music.querySelectorAll('*')));
  targets.forEach(function (el) {
    el.style.animation = 'none';
  });
  void music.offsetWidth;
  targets.forEach(function (el) {
    el.style.removeProperty('animation');
  });
  music.style.removeProperty('height');
  var shell = music.querySelector('.dot-music1');
  if (shell) {
    ['width', 'height', 'border-radius', 'clip-path', 'background-color'].forEach(function (prop) {
      shell.style.removeProperty(prop);
    });
  }
}
// Lock the music shell geometry after the 14 s entrance timeline finishes.
function _lockTest3MusicShell(music) {
  if (!music) return;
  var shell = music.querySelector('.dot-music1');
  if (!shell) return;
  var cs = window.getComputedStyle(shell);
  shell.style.width = cs.width;
  shell.style.height = cs.height;
  shell.style.borderRadius = cs.borderRadius;
  if (cs.clipPath && cs.clipPath !== 'none') {
    shell.style.clipPath = cs.clipPath;
  }
  shell.style.backgroundColor = 'transparent';
  shell.style.setProperty('animation', 'none', 'important');
}
// Seamless orb → play-disc: one element through entrance, then hand off
// to the native iconBg slot without a visible layer swap.
function _handoffTest3MusicOrb(music) {
  if (!music || music.getAttribute('data-test3-music-orb-handoff') === '1') return;
  music.setAttribute('data-test3-music-orb-handoff', '1');
}
// Lock final layout after the CSS vertical expand + orb handoff finish.
function _finalizeTest3MusicEntrance() {
  var music = document.querySelector('#test3-music');
  var weather = document.querySelector('#test3-weather');
  var steps   = document.querySelector('#test3-steps');
  if (music) {
    music.removeAttribute('data-test3-music-loading');
    music.classList.remove('is-motion-phase2');
    music.setAttribute('data-test3-music-phase', 'playing');
    if (typeof _clearTest3MusicEntranceInlineStyles === 'function') {
      _clearTest3MusicEntranceInlineStyles(music);
    }
    if (!music.getAttribute('data-test3-music-settled')) {
      if (typeof _finishTest3MusicSettle === 'function' &&
          music.getAttribute('data-test3-music-settling') === '1') {
        _finishTest3MusicSettle(music);
      } else if (typeof _applyTest3MusicSettledLayout === 'function') {
        _applyTest3MusicSettledLayout(music);
      }
    }
    if (typeof _lockTest3MusicShell === 'function') {
      _lockTest3MusicShell(music);
    }
  }
  if (weather) weather.classList.remove('is-motion-phase2');
  if (steps)   steps.classList.remove('is-motion-phase2');
  // Defer layout lock until the compact→icon crossfade finishes so we
  // don't cut the 14 s CSS timeline with animation:none mid-handoff.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (music) music.style.removeProperty('height');
      if (typeof _layoutTest3Cards === 'function') _layoutTest3Cards();
    });
  });
}
// the phone, pause the distance ticker (via the global flag the ticker
// checks each tick) AND start the slow map dot motion above. Leaving
// the phone resumes the distance ticker and freezes the dot wherever
// it happened to land. Idempotent — the data-attr flag keeps repeated
// calls from double-binding.
function _initTest3HoverPause() {
  var phone = document.getElementById('canvasFrame');
  if (!phone) return;
  if (phone.dataset.test3HoverInit === '1') return;
  phone.dataset.test3HoverInit = '1';
  phone.addEventListener('mouseenter', function () {
    if (!_test3IsHomeStage()) return;
    // Just flip the pause flag; the map's pan rAF (started inside
    // _initTest3GoalMap) reads this flag each frame and freezes
    // progress while the flag is true. The distance ticker reads the
    // same flag and skips its increment, so the map and the distance
    // number stay synchronized.
    window.__mlpTest3HoverPaused = true;
  });
  phone.addEventListener('mouseleave', function () {
    window.__mlpTest3HoverPaused = false;
  });
  // Delegated click handler for the music card's play/pause button.
  // Bound on the phone (canvasFrame) so the listener survives every
  // canvas re-render during the test3 home stage — the diff renderer
  // preserves children but rebuilds new ones from scratch, and a
  // listener on the button itself would be lost. We toggle just the
  // attribute; CSS swaps which icon is visible via the [data-music-
  // playing] selector. aria-label flips to match so screen readers
  // announce the right action.
  phone.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.dot-music3__playBtn');
    if (!btn) return;
    e.stopPropagation();
    var playing = btn.getAttribute('data-music-playing') === '1';
    var next = playing ? '0' : '1';
    btn.setAttribute('data-music-playing', next);
    btn.setAttribute('aria-label', next === '1' ? 'Pause' : 'Play');
    // Mirror the state on #test3-music so the CSS rule on the bar's
    // ::track animation-play-state can pause/resume in sync, and the
    // current-time ticker (which checks the same attribute) freezes
    // / resumes together with the bar's visible fill.
    var card = btn.closest('#test3-music');
    if (card) card.setAttribute('data-music-playing', next);
    if (typeof _setTest3MusicAudioPlaying === 'function') {
      _setTest3MusicAudioPlaying(next === '1');
    }
    // Quick white-50% flash on the disc background to give the play/
    // pause toggle a visible "click" beat. The .is-blinking class
    // runs a 320ms one-shot keyframe (in theme-page.css); strip it
    // a touch after the animation finishes so the next click can
    // re-trigger.
    var iconEl = btn.closest('.dot-music3__icon');
    if (iconEl) {
      iconEl.classList.remove('is-blinking');
      // Force reflow so the re-added class restarts the animation
      // when the user clicks twice in quick succession.
      void iconEl.offsetWidth;
      iconEl.classList.add('is-blinking');
      setTimeout(function () { iconEl.classList.remove('is-blinking'); }, 360);
    }
  });
  // Card-body tap cycle: tapping anywhere on the music card OUTSIDE
  // the play button advances the state machine:
  //   normal  → lyrics (tap 1: show lyric block, card grows taller)
  //   lyrics  → compact (tap 2: shrink to 168×168 square)
  //   compact → normal (tap 3: back to the post-shift default)
  // The play button's own handler above stops propagation so the
  // card-body listener never fires when the user is hitting play.
  phone.addEventListener('click', function (e) {
    // Skip when the click is on the play button — that handler ran
    // already (and stopped propagation, but be defensive).
    if (e.target && e.target.closest && e.target.closest('.dot-music3__playBtn')) return;
    var card = e.target && e.target.closest && e.target.closest('#test3-music');
    if (!card) return;
    // Block the cycle during the initial mount animations (first ~4s
    // after the music shift) so the tap can't fight dotMusicRevealCard's
    // width grow. After that, taps cycle freely.
    if (!window.__mlpTest3MusicShifted) return;
    if (card.getAttribute('data-test3-music-loading') === '1') return;
    if (window.__mlpTest3MusicAudioPending && typeof _setTest3MusicAudioPlaying === 'function') {
      _setTest3MusicAudioPlaying(true);
    }
    if (typeof _handoffTest3MusicOrb === 'function' &&
        card.getAttribute('data-test3-music-orb-handoff') !== '1') {
      _handoffTest3MusicOrb(card);
    }
    var cur  = card.getAttribute('data-music-state') || 'normal';
    var next = cur === 'normal' ? 'lyrics'
             : cur === 'lyrics' ? 'compact'
             : 'normal';
    card.setAttribute('data-music-state', next);
    if (typeof _resetTest3MusicCopy === 'function') {
      _resetTest3MusicCopy(card);
    }
    if (typeof _applyTest3MusicStateLayout === 'function') {
      _applyTest3MusicStateLayout(card);
    }
    // Reflow weather + steps to fill / yield to the new music footprint.
    if (typeof _layoutTest3Cards === 'function') _layoutTest3Cards();
  });
  // Weather + Today Progress tap-to-expand: toggles a full-width
  // expanded state; the layout function re-computes everyone's slot
  // so the OTHER card drops to a new row when one expands (and vice
  // versa).
  phone.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.dot-music3__playBtn')) return;
    if (e.target && e.target.closest && e.target.closest('#test3-music')) return;
    var card = e.target && e.target.closest && (
      e.target.closest('#test3-weather') || e.target.closest('#test3-steps')
    );
    if (!card) return;
    if (!window.__mlpTest3MusicShifted) return;
    card.classList.toggle('is-expanded');
    var isExp = card.classList.contains('is-expanded');
    var compact = card.querySelector('.dot-w21__compact, .dot-steps21__compact');
    var expanded = card.querySelector('.dot-w21__expanded, .dot-steps21__expanded');
    if (compact) compact.setAttribute('aria-hidden', isExp ? 'true' : 'false');
    if (expanded) expanded.setAttribute('aria-hidden', isExp ? 'false' : 'true');
    var detail = card.querySelector('.dot-w21__expandDetail, .dot-steps21__expandDetail');
    if (detail) {
      detail.setAttribute('aria-hidden', card.classList.contains('is-expanded') ? 'false' : 'true');
    }
    if (typeof _layoutTest3Cards === 'function') _layoutTest3Cards();
  });
}
function _test3IsHomeStage() {
  try {
    var c = document.getElementById('canvas');
    if (!c || c.getAttribute('data-test-scope') !== 'test3') return false;
    return !!(window.__mlpTestConfig && window.__mlpTestConfig.homeStage === 'home');
  } catch (_) { return false; }
}

// test3(헬스 홈) 전용: intro 러닝 pill 클릭 → home 위젯 구성으로 전환
window.__mlpTest3GoHome = function __mlpTest3GoHome() {
  var isTest3 =
    (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3') ||
    (document.body && document.body.dataset && document.body.dataset.mlpTest === 'test3');
  if (!isTest3) return false;
  if (!window.__mlpTestConfig) {
    window.__mlpTestConfig = { id: 'test3', surfaceType: 'tab-root', homeStage: 'intro' };
  }
  if (window.__mlpTestConfig.homeStage === 'home') return true;
  if (window.__mlpTest3Transitioning) return true;

  function finishTransition() {
    window.__mlpTestConfig.homeStage = 'home';
    window.__mlpTest3MusicShifted = false;
    window.__mlpTest3MusicShiftPrep = false;
    window.__mlpTest3WeatherDropped = false;
    window.__mlpTest3MusicShiftRunId = (window.__mlpTest3MusicShiftRunId || 0) + 1;
    window.__mlpTest3WeatherRainArmed = false;
    if (window.__mlpTest3WeatherRainTimer) {
      clearTimeout(window.__mlpTest3WeatherRainTimer);
      window.__mlpTest3WeatherRainTimer = null;
    }
    // No more home-enter slide-in/fade-in. Weather + Steps were
    // pre-rendered + faded in during the morph (see prefade code in
    // __mlpTest3GoHome above), so they're already at full opacity in
    // their final positions by the time we get here. The canvas
    // rebuild below replaces them with equivalent fresh DOM that
    // renders at full opacity by default — visually identical, no
    // perceived "layer popping on top".
    window.__mlpTest3HomeEnterArmed = false;
    // Goal entrance animations fire AFTER the innerHTML swap below —
    // the real .dot-goal__* children are inserted at morph end, then
    // test3-goal-enter + data-test3-goal-fresh gate the CSS motion.
    // SINGLE-COMPONENT TRANSFORMATION: rename the intro pill into the
    // goal card in place. The same DOM element persists from intro
    // stage through home stage — its id changes, its inner HTML is
    // replaced with the real .dot-goal markup, but it's the SAME
    // element. Per user direction: "make it into a single component."
    //
    // Sequence:
    //   1. Find #test3-intro-run (the morphed pill, now at h=168 +
    //      border-radius 32 from the just-finished test3IntroToGoal /
    //      test3IntroToGoalInner animations).
    //   2. Build the home plan and locate the goal component.
    //   3. Render the goal card's HTML via renderAtomicForRole.
    //   4. Transform the pill IN PLACE: replace innerHTML with the
    //      goal markup, change id to 'test3-goal', remove the
    //      intro-run-exit class, pin position/size/opacity to match
    //      the goal card's layout, clear the animations.
    //   5. The diff renderer (in generateSurfaceScenario below) now
    //      finds the renamed element as #test3-goal in canvas.children
    //      and preserves it — no separate goal card was ever mounted.
    var goalEnterRebuildScheduled = false;
    try {
      var introRunEl = document.getElementById('test3-intro-run');
      if (introRunEl &&
          typeof window.createOneUILayout === 'function' &&
          typeof window.composeSurfacePlan === 'function' &&
          typeof window.expandContainerComponents === 'function' &&
          typeof window.resolveComponentRect === 'function' &&
          typeof window.renderAtomicForRole === 'function') {
        var transformLayout = window.createOneUILayout({ width: 388, height: 880 }, 'tab-root');
        var transformPlan = window.composeSurfacePlan('tab-root', transformLayout);
        window.expandContainerComponents(transformPlan, transformLayout);
        var goalComp = null;
        for (var ti = 0; ti < transformPlan.components.length; ti++) {
          if (transformPlan.components[ti].id === 'test3-goal') {
            goalComp = transformPlan.components[ti];
            break;
          }
        }
        if (goalComp) {
          var goalRect = window.resolveComponentRect(goalComp, transformLayout, transformPlan);
          var canvasFresh = document.getElementById('canvas');
          // Arm the fresh gate + rename BEFORE innerHTML swap so the
          // first paint of the real .dot-goal children is already
          // covered by the CSS hold rules — prevents the one-frame
          // "everything blinks on" flash the user flagged.
          if (canvasFresh) canvasFresh.setAttribute('data-test3-goal-fresh', '1');
          window.__mlpTest3GoalFreshDone = true;
          var introSeedKeep = null;
          try {
            var introSeedEl = introRunEl.querySelector('.dot-running2__goal-map-seed');
            if (introSeedEl) {
              var introSeedOpacity = parseFloat(window.getComputedStyle(introSeedEl).opacity || '0');
              if (introSeedOpacity > 0.01 && introSeedEl.parentNode) {
                introSeedKeep = introSeedEl;
                introSeedEl.parentNode.removeChild(introSeedEl);
              }
            }
          } catch (_) {}
          introRunEl.id = 'test3-goal';
          introRunEl.classList.remove(
            'test3-intro-run-exit',
            'test3-goal-enter',
            'test3-goal-enter-ready',
            'test3-goal-copy-enter',
            'test3-goal-map-ready',
            'test3-goal-entrance-settled'
          );
          introRunEl.removeAttribute('data-test3-goal-map-ready');
          introRunEl.removeAttribute('data-test3-goal-map-hold');
          introRunEl.removeAttribute('data-test3-goal-map-bloomed');
          delete introRunEl.dataset.test3GoalEntrance;
          introRunEl.dataset.role = goalComp.role;
          introRunEl.setAttribute('data-role', goalComp.role);
          introRunEl.innerHTML = window.renderAtomicForRole(goalComp, goalRect);
          if (introSeedKeep) {
            try {
              var goalCardInner = introRunEl.querySelector('.dot-goal');
              var goalMapSlot = introRunEl.querySelector('.dot-goal__map-slot');
              var freshSeed = introRunEl.querySelector('.dot-goal__map-seed');
              if (freshSeed) freshSeed.remove();
              introSeedKeep.className = 'dot-goal__map-seed dot-goal__map-seed--handoff';
              introSeedKeep.style.removeProperty('opacity');
              introSeedKeep.style.removeProperty('visibility');
              introSeedKeep.style.animation = 'none';
              introSeedKeep.style.removeProperty('left');
              introSeedKeep.style.removeProperty('right');
              introSeedKeep.style.removeProperty('top');
              introSeedKeep.style.removeProperty('marginTop');
              introSeedKeep.style.removeProperty('transform');
              if (goalMapSlot) goalMapSlot.appendChild(introSeedKeep);
              else if (goalCardInner) goalCardInner.appendChild(introSeedKeep);
            } catch (_) {}
          }
          // Pin layout to the goal card's rect (the morph keyframes had
          // animated height to 168, but inline style still says 82;
          // clearing the animation would revert height to 82 if we
          // don't pin it inline now).
          introRunEl.style.left = goalRect.x + 'px';
          introRunEl.style.top = goalRect.y + 'px';
          introRunEl.style.width = goalRect.w + 'px';
          introRunEl.style.height = goalRect.h + 'px';
          introRunEl.style.opacity = '1';
          introRunEl.style.overflow = '';
          goalEnterRebuildScheduled = true;
          if (typeof _orchestrateTest3GoalEntrance === 'function') {
            _orchestrateTest3GoalEntrance(introRunEl);
          }
        }
      }
    } catch (_) {}
    if (!goalEnterRebuildScheduled) {
      requestAnimationFrame(function () {
        if (typeof window.generateSurfaceScenario === 'function') {
          window.generateSurfaceScenario('tab-root');
        }
      });
    }
    // Start the live clock on the goal's time display so it ticks
    // up every second — gives the "Running Now" card the live,
    // in-progress feel instead of a frozen number. Cleared if/when
    // the user leaves the home stage. The distance ticker rides
    // alongside it (5:00 min/km pace; m → km auto-flip at 1000 m).
    _startTest3GoalTimeTicker();
    _startTest3GoalDistanceTicker();
    // Bind once: hovering the phone pauses the distance ticker and
    // starts a slow map-dot crawl along the route, so the scene reads
    // as alive even when the runner's number is frozen for inspection.
    _initTest3HoverPause();
    window.__mlpTest3Transitioning = false;
    // Clear the gradient-sweep gate now that the morph is complete.
    // CSS rule that depends on this stops matching, so the gradient
    // pseudo-element animation ends + the ::after content disappears.
    try {
      var cEl = document.getElementById('canvas');
      if (cEl) cEl.removeAttribute('data-test3-intro-exiting');
    } catch (_) {}
  }

  var canvas = document.getElementById('canvas');
  var runEl = canvas && canvas.querySelector('#test3-intro-run');
  if (!runEl) {
    finishTransition();
    return true;
  }

  window.__mlpTest3Transitioning = true;
  runEl.classList.add('test3-intro-run-exit');
  // Set a canvas-level attribute that lets the GOAL card's gradient
  // sweep CSS rule match during the morph window. Previously the
  // gradient lived on .dot-running2--prompt::after (the intro pill),
  // but the prompt pill is only 82 px tall and fades out, so the
  // gradient never reached the bottom half of the 168 px Running Now
  // card — looked like the gradient was sitting "outside / above"
  // the card. With the attribute on the canvas the CSS can target
  // `.dot-goal::after` directly, clipping the gradient to the goal
  // card's full bounds. Removed in finishTransition() below.
  if (canvas) canvas.setAttribute('data-test3-intro-exiting', '1');

  // Kick off the real-time weather fetch at the same beat so the live
  // values are ready by the time the home stage mounts the weather
  // card. _fetchTest3Weather populates window.__mlpTest3Weather; the
  // layout plan below reads from that cache, with the curated fallback
  // as the default if the API hasn't returned yet.
  if (typeof _fetchTest3Weather === 'function') _fetchTest3Weather();

  // Pre-render the home-stage widgets (Weather + Steps + Goal background)
  // DURING the prompt's morph — not after. They get inserted into the
  // canvas right now and fade in over the same 420ms as the morph, so by
  // the time the morph ends and the canvas swap happens, they're ALREADY
  // at opacity 1 in place. This kills the "layer pops on top after morph"
  // perception: from the user's perspective the new cards were always
  // there, just gaining presence during the same beat as the prompt
  // grows into the Running Now card.
  //
  // We render the widgets via the same surface-layout pipeline by
  // requesting the home stage NOW (homeStage='home' temporarily set),
  // but extract only the Weather + Steps slots and append them as
  // sibling DOM nodes to the canvas. The prompt's wrapper is left
  // untouched — its morph continues unimpeded.
  try {
    var cfg = window.__mlpTestConfig;
    var prevStage = cfg && cfg.homeStage;
    if (cfg) cfg.homeStage = 'home';
    if (typeof window.createOneUILayout === 'function' &&
        typeof window.composeSurfacePlan === 'function' &&
        typeof window.expandContainerComponents === 'function' &&
        typeof window.resolveComponentRect === 'function' &&
        typeof window.renderAtomicForRole === 'function') {
      var pre = { width: 388, height: 880 };
      var preLayout = window.createOneUILayout(pre, 'tab-root');
      var prePlan = window.composeSurfacePlan('tab-root', preLayout);
      window.expandContainerComponents(prePlan, preLayout);
      // Added 'test3-goal' so the Running Now card now starts ENTERING
      // at the same beat the pill bounces UP — per user direction the
      // goal's appearance motion should kick off when the bounce starts,
      // not after the bounce completes. Weather/Steps already prefaded
      // during the morph; the goal joins them here.
      // Only weather + steps get pre-mounted as separate canvas-items.
      // The Running Now card is NO LONGER a separate pre-mounted element
      // (it was 'test3-goal' in this list); instead the intro pill
      // itself (#test3-intro-run) morphs into the goal card and is
      // renamed to #test3-goal at the morph end (see finishTransition).
      // This makes the intro → home transition a TRUE single-component
      // transformation — one DOM element, persistent identity, with
      // its content evolving from prompt text → goal preview overlay →
      // real goal card structure.
      var prerenderIds = ['test3-weather', 'test3-steps'];
      // Pre-mount in the SAME ORDER they'll occupy after the home-stage
      // re-render — i.e. inserted BEFORE the intro pill (which gets
      // removed at re-render time). Previously these were appended at
      // the END of the canvas, so the home-stage re-render had to move
      // them up the child list, which the user perceived as a "refresh"
      // (the goal card briefly disappearing/re-appearing during the
      // reorder). With this fix, when intro-run is removed at re-render
      // time, every other pre-mounted element is ALREADY in its final
      // position — zero DOM moves, zero perceived flicker.
      var insertBeforeRef = canvas.querySelector('#test3-intro-run');
      prePlan.components.forEach(function (preComp) {
        if (prerenderIds.indexOf(preComp.id) === -1) return;
        // Skip if already in canvas (defensive against double-fire).
        if (canvas.querySelector('#' + preComp.id)) return;
        var preRect = window.resolveComponentRect(preComp, preLayout, prePlan);
        var preWrap = document.createElement('div');
        preWrap.className = 'canvas-item surface-item test3-intro-prefade';
        preWrap.id = preComp.id;
        preWrap.dataset.role = preComp.role;
        preWrap.setAttribute('data-role', preComp.role);
        preWrap.style.position = 'absolute';
        preWrap.style.left = preRect.x + 'px';
        preWrap.style.top = preRect.y + 'px';
        preWrap.style.width = preRect.w + 'px';
        preWrap.style.height = preRect.h + 'px';
        preWrap.innerHTML = window.renderAtomicForRole(preComp, preRect);
        // insertBefore preserves the iteration order: each component
        // inserted before the intro pill ends up after the previous
        // pre-mounted siblings (which were also inserted at the same
        // reference). Falls back to appendChild if intro-run is
        // unexpectedly missing.
        if (insertBeforeRef && insertBeforeRef.parentNode === canvas) {
          canvas.insertBefore(preWrap, insertBeforeRef);
        } else {
          canvas.appendChild(preWrap);
        }
      });
      // Goal entrance animations are armed in finishTransition() when
      // the intro pill's innerHTML is swapped for the real goal card.
    }
    if (cfg) cfg.homeStage = prevStage;
  } catch (_) {}

  var done = false;
  function completeOnce() {
    if (done) return;
    done = true;
    finishTransition();
  }

  // Morph shape completes at 86.67% × 1500 ms ≈ 1300 ms. Swap in the
  // real goal card then so "Running Now" can fade+slide in on the
  // fresh mount (test3GoalTitleEnter) instead of popping on the
  // morphing preview pill.
  runEl.addEventListener('animationend', function onExitEnd(e) {
    if (e.target !== runEl) return;
    if (e.animationName !== 'test3IntroToGoal' && e.animationName !== 'test3IntroRunExit') return;
    runEl.removeEventListener('animationend', onExitEnd);
    /* intentionally do NOT completeOnce here — wrapper morph ends at
       1500 ms but we want the swap timed to shape completion (~1300 ms)
       via the timeout below so the title entrance runs on the real card. */
  });
  setTimeout(completeOnce, 1320);

  return true;
};

window.__mountTest3WeatherRainMotion = function __mountTest3WeatherRainMotion(delayMs) {
  var wait = typeof delayMs === 'number' ? delayMs : 0;
  if (window.__mlpTest3WeatherRainTimer) {
    clearTimeout(window.__mlpTest3WeatherRainTimer);
    window.__mlpTest3WeatherRainTimer = null;
  }
  window.__mlpTest3WeatherRainTimer = setTimeout(function () {
    try {
      var canvas = document.getElementById('canvas');
      if (!canvas || canvas.getAttribute('data-test-scope') !== 'test3') return;
      if (canvas.getAttribute('data-test3-music-shift') !== '1') return;
      var weatherHost = canvas.querySelector('#test3-weather');
      if (!weatherHost || typeof window.initDotPairRainMotion !== 'function') return;
      canvas.setAttribute('data-test3-weather-rain', '1');
      window.__mlpTest3WeatherRainArmed = true;
      window.initDotPairRainMotion(weatherHost);
    } catch (_) {}
  }, wait);
};

// test3(헬스 홈) 전용: intro 상태에서 home 위젯 렌더를 미리 실행해 콜드스타트 완화
window.__mlpTest3WarmHomeRender = function __mlpTest3WarmHomeRender(surfaceType) {
  try {
    var isTest3 =
      (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3') ||
      (document.body && document.body.dataset && document.body.dataset.mlpTest === 'test3');
    if (!isTest3) return false;
    if (!window.createOneUILayout || !window.composeSurfacePlan || !window.expandContainerComponents || !window.renderAtomicForRole || !window.resolveComponentRect) return false;
    if (!window.__mlpTestConfig) window.__mlpTestConfig = { id: 'test3', surfaceType: surfaceType || 'tab-root', homeStage: 'intro' };

    var cfg = window.__mlpTestConfig;
    var prevStage = cfg.homeStage;
    var prevSurface = cfg.surfaceType;
    cfg.surfaceType = surfaceType || prevSurface || 'tab-root';
    cfg.homeStage = 'home';

    var viewport = { width: 388, height: 880 };
    var layout = window.createOneUILayout(viewport, cfg.surfaceType);
    var plan = window.composeSurfacePlan(cfg.surfaceType, layout);
    window.expandContainerComponents(plan, layout);

    var ids = { 'test3-goal': 1, 'test3-music': 1, 'test3-weather': 1, 'test3-steps': 1 };
    for (var i = 0; i < plan.components.length; i++) {
      var comp = plan.components[i];
      if (!comp || !ids[comp.id]) continue;
      var rect = window.resolveComponentRect(comp, layout, plan);
      // Warm render paths without touching DOM.
      window.renderAtomicForRole(comp, rect);
    }

    cfg.homeStage = prevStage;
    cfg.surfaceType = prevSurface;
    return true;
  } catch (_) {
    return false;
  }
};

// Build (or update) a single canvas-item wrapper for a component.
// Returns the wrapper element. If `existing` is provided, the function
// reuses it (only updating positioning) so child state — Leaflet maps,
// scroll position, animations in progress — is preserved across renders.
function _buildCanvasItemWrapper(comp, layout, plan, existing) {
  var rect = window.resolveComponentRect(comp, layout, plan);
  var wrapper = existing || document.createElement('div');
  if (!existing) {
    wrapper.className = 'canvas-item surface-item';
    wrapper.id = comp.id;
  }
  wrapper.dataset.role = comp.role;
  wrapper.setAttribute('data-role', comp.role);
  wrapper.dataset.nodeId = comp.id;

  var isTest3Scope =
    (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3') ||
    (document.body && document.body.dataset && document.body.dataset.mlpTest === 'test3');
  if (isTest3Scope && comp && comp.variant && comp.variant.mlpAction) {
    wrapper.setAttribute('data-mlp-action', comp.variant.mlpAction);
  }

  wrapper.style.position = 'absolute';
  wrapper.style.left = rect.x + 'px';
  wrapper.style.top = rect.y + 'px';
  wrapper.style.width = rect.w + 'px';
  wrapper.style.height = rect.h + 'px';

  if (comp.role === 'background' || comp.role === 'scrim') {
    wrapper.style.pointerEvents = 'none';
  }
  if (comp.visibility === 'collapsed') {
    wrapper.classList.add('priority-collapsed');
  } else if (comp.visibility === 'hidden') {
    wrapper.style.display = 'none';
  }
  if (comp._emphasis) {
    wrapper.classList.add('emphasis-' + comp._emphasis);
  }

  // Only set innerHTML on FRESH wrappers — preserving existing innerHTML
  // keeps child state (Leaflet maps, ticker time, animations in flight)
  // alive across re-renders.
  if (!existing) {
    wrapper.innerHTML = window.renderAtomicForRole(comp, rect);
  }

  if (comp._rect && window.attachReorderHandlers) {
    window.attachReorderHandlers(wrapper, comp.id);
  }

  if (isTest3Scope && comp.id === 'test3-intro-run') {
    wrapper.setAttribute('data-mlp-action', 'mlp-intro-to-home');
    wrapper.style.cursor = 'pointer';
    if (wrapper.dataset.mlpClickBound !== '1') {
      wrapper.dataset.mlpClickBound = '1';
      wrapper.addEventListener('click', function (ev) {
        if (ev && (ev.metaKey || ev.ctrlKey)) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof window.__mlpTest3GoHome === 'function') {
          window.__mlpTest3GoHome();
        }
      });
    }
  }
  return wrapper;
}

window.renderSurfacePlan = function renderSurfacePlan(canvas, plan, layout) {
  // Decide render mode:
  //   DIFF — test3 home stage with elements already on canvas. Preserves
  //          existing elements (their DOM + Leaflet maps + animations);
  //          adds new ones (e.g. the music card on shift); removes
  //          orphaned ones. No `innerHTML=''` wipe, so no flicker.
  //   FULL — every other case. Wipes the canvas and rebuilds from scratch.
  var testScope = (window.__mlpTestConfig && window.__mlpTestConfig.id) || null;
  var isTest3Home =
    testScope === 'test3' &&
    window.__mlpTestConfig &&
    window.__mlpTestConfig.homeStage === 'home';
  var useDiff = isTest3Home && canvas.children.length > 0;

  if (useDiff) {
    // Diff-based: keep existing same-ID elements alive, add new ones,
    // remove orphans. Order of children follows the new plan exactly.
    var existingById = new Map();
    Array.from(canvas.children).forEach(function (c) {
      if (c.id) existingById.set(c.id, c);
    });
    var newIds = new Set();
    var newOrder = [];
    for (var i = 0; i < plan.components.length; i++) {
      var comp = plan.components[i];
      newIds.add(comp.id);
      var existing = existingById.get(comp.id) || null;
      var wrapper = _buildCanvasItemWrapper(comp, layout, plan, existing);
      newOrder.push(wrapper);
    }
    // Remove orphans (in DOM but not in new plan)
    existingById.forEach(function (el, id) {
      if (!newIds.has(id)) el.remove();
    });
    // Reorder ONLY elements that are out of position. Previously this
    // called canvas.appendChild on every element, which fires a
    // remove+insert mutation pair even for elements that were already
    // in the correct place. That caused the goal card (and other
    // preserved elements) to briefly "refresh" — CSS animations could
    // restart, the Leaflet map could repaint, and the user observed
    // the goal card appearing to disappear and re-appear. Now we only
    // call insertBefore when an element's current index doesn't match
    // its desired index, leaving correctly-positioned elements
    // completely untouched.
    for (var ni = 0; ni < newOrder.length; ni++) {
      var w = newOrder[ni];
      if (canvas.children[ni] !== w) {
        var ref = canvas.children[ni] || null;
        canvas.insertBefore(w, ref);
      }
    }
    return;
  }

  // FULL render — wipe + rebuild.
  canvas.innerHTML = '';
  canvas.dataset.rulesMode = '1';
  canvas.style.position = 'relative';
  canvas.style.display = 'block';
  canvas.style.width = layout.viewport.width + 'px';
  canvas.style.height = layout.viewport.height + 'px';
  canvas.style.padding = '0';
  canvas.style.gap = '0';
  canvas.style.overflow = 'hidden';

  for (var k = 0; k < plan.components.length; k++) {
    canvas.appendChild(_buildCanvasItemWrapper(plan.components[k], layout, plan, null));
  }
};

// ============================================================================
// Drag-drop reorder for grouped children (list-items, widget cells, paragraphs,
// notif cards, palette-added items in the same column).
// ============================================================================
window.attachReorderHandlers = function attachReorderHandlers(el, nodeId) {
  if (!el || el.dataset.reorderBound === '1') return;
  el.dataset.reorderBound = '1';
  el.setAttribute('draggable', 'true');

  el.addEventListener('dragstart', function (e) {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
    // Suppress hover overlay during drag
    if (typeof window.setHoveredNode === 'function') window.setHoveredNode(null);
  });

  el.addEventListener('dragend', function () {
    el.classList.remove('dragging');
    document.querySelectorAll('.drag-insert-before, .drag-insert-after')
      .forEach(function (n) { n.classList.remove('drag-insert-before', 'drag-insert-after'); });
  });

  el.addEventListener('dragover', function (e) {
    // Only accept drops from other draggable same-column items
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    var rect = el.getBoundingClientRect();
    var mid = rect.top + rect.height / 2;
    el.classList.remove('drag-insert-before', 'drag-insert-after');
    if (e.clientY < mid) el.classList.add('drag-insert-before');
    else el.classList.add('drag-insert-after');
  });

  el.addEventListener('dragleave', function () {
    el.classList.remove('drag-insert-before', 'drag-insert-after');
  });

  el.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drag-insert-before', 'drag-insert-after');
    var sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === nodeId) return;
    if (window.DesignDoc && typeof window.DesignDoc.reorderInColumn === 'function') {
      window.DesignDoc.reorderInColumn(sourceId, nodeId);
    }
  });
};

// Render the given surface type into #canvas.
// Fires EXACTLY ONE DesignDoc subscribe event ('hydrate') at the end.
// Callers (scene buttons, agent fallback, skeleton loader) rely on this
// single-event contract so scene-inspector + interaction-overlay don't
// double-refresh.
function _unlockTest2ContactListNodes(slot) {
  if (!slot) return;
  slot.style.position = 'relative';
  slot.style.top = 'auto';
  slot.style.bottom = 'auto';
  slot.style.left = '0';
  slot.style.right = '0';
  slot.style.height = 'auto';
  slot.style.overflow = 'visible';

  var stage = slot.querySelector('.p2-reveal-stage');
  if (stage) {
    stage.style.position = 'relative';
    stage.style.top = 'auto';
    stage.style.left = '0';
    stage.style.right = 'auto';
    stage.style.width = '100%';
    stage.style.height = 'auto';
    stage.style.minHeight = '0';
    stage.style.overflow = 'visible';
  }

  slot.querySelectorAll('.p2-reveal-stage > div, .composite-set-container, .composite-child').forEach(function (el) {
    el.style.position = 'relative';
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = '100%';
    el.style.height = 'auto';
    el.style.minHeight = '0';
    el.style.transform = 'none';
  });
}

function applyTest2ContactListShellHeight(slot) {
  if (!slot) return;
  var list = slot.querySelector('.p2-contact-list');
  if (!list) return;
  var count = parseInt(list.getAttribute('data-item-count') || '3', 10) || 3;
  var contentH = _computeP2ContactListHeight(count);
  var shellH = contentH + 56;
  var shellHpx = shellH + 'px';
  var contentHpx = contentH + 'px';
  var area = document.getElementById('p2-area');
  var result = document.getElementById('p2-result');
  var widgets = document.querySelector('.p2-widgets--compact');
  var widgetsWrap = document.querySelector('[data-role="persona2-widgets"]');
  var stage = slot.querySelector('.p2-reveal-stage');

  if (area) {
    area.style.height = shellHpx;
    area.style.minHeight = shellHpx;
    area.style.setProperty('--p2-shell-h', shellHpx);
  }
  if (widgets) {
    widgets.style.height = shellHpx;
    widgets.style.minHeight = shellHpx;
  }
  if (widgetsWrap) {
    widgetsWrap.style.height = shellHpx;
    widgetsWrap.style.minHeight = shellHpx;
    widgetsWrap.style.overflow = 'visible';
  }
  if (stage) {
    stage.style.removeProperty('height');
    stage.style.setProperty('--p2-reveal-h', contentHpx);
  }
  slot.style.setProperty('--p2-reveal-h', contentHpx);
  if (result) result.style.setProperty('--p2-reveal-h', contentHpx);
  slot.dataset.p2LayoutReady = count + ':' + contentH;
}

function activateTest2ContactListLayout(slot) {
  if (!_isTest2Scope() || !slot) return false;
  var list = slot.querySelector('.p2-contact-list');
  if (!list) return false;

  var shell = document.getElementById('p2-area');
  var main = document.getElementById('p2-default-widgets');
  var footer = shell && shell.querySelector('.p2-agent-footer');
  var count = parseInt(list.getAttribute('data-item-count') || '3', 10) || 3;
  var shellHpx = (_computeP2ContactListHeight(count) + 56) + 'px';
  var widgets = document.querySelector('.p2-widgets--compact');
  var widgetsWrap = document.querySelector('[data-role="persona2-widgets"]');

  if (shell) {
    shell.classList.add('p2-contact-layout-active');
    shell.style.height = shellHpx;
    shell.style.minHeight = shellHpx;
    shell.style.setProperty('--p2-shell-h', shellHpx);
  }
  if (widgets) widgets.style.minHeight = shellHpx;
  if (widgetsWrap) widgetsWrap.style.minHeight = shellHpx;
  if (main) {
    main.style.display = 'none';
    main.style.opacity = '0';
    main.style.pointerEvents = 'none';
  }
  if (footer) {
    footer.style.position = 'relative';
    footer.style.opacity = '1';
    footer.style.height = '56px';
    footer.style.pointerEvents = 'auto';
    footer.classList.add('p2-agent-footer--settled');
  }
  var agentInput = footer && footer.querySelector('.p2-agent-input');
  var star = document.getElementById('p2-star');
  if (agentInput) {
    agentInput.classList.remove('p2-seq-text-hidden', 'p2-seq-text-visible');
    agentInput.classList.add('p2-agent-input--settled');
  }
  if (star) {
    star.classList.remove('p2-seq-text-hidden', 'p2-seq-text-visible', 'p2-default-hiding');
    star.classList.add('p2-agent-star--settled');
  }
  requestAnimationFrame(function () {
    setTest2AgentInputGlow(false);
  });

  _unlockTest2ContactListNodes(slot);
  syncTest2VoiceStarState(document.getElementById('canvas'));
  return true;
}

function _isTest2ContactLayoutReady(slot) {
  if (!slot) return false;
  return (
    slot.classList.contains('p2-seq-color-active') ||
    slot.classList.contains('p2-seq-done') ||
    slot.classList.contains('p2-contact-reveal-active')
  );
}

function patchTest2ContactListLayout(slot, opts) {
  opts = opts || {};
  if (!slot) return;
  if (slot.dataset.test2ContactRevealLock === '1' && !opts.force) return;
  var list = slot.querySelector('.p2-contact-list');
  if (!list) {
    slot.dataset.p2LayoutReady = '';
    var shell = document.getElementById('p2-area');
    if (shell) shell.classList.remove('p2-contact-layout-active');
    return;
  }

  if (_isTest2ContactLayoutReady(slot)) {
    activateTest2ContactListLayout(slot);
  }

  var count = parseInt(list.getAttribute('data-item-count') || '3', 10) || 3;
  var estimate = _computeP2ContactListHeight(count);
  var layoutKey = count + ':' + estimate;
  if (slot.dataset.p2LayoutReady === layoutKey) return;

  var patchToken = ++_p2LayoutPatchToken;

  function applyLayout(contentH) {
    if (patchToken !== _p2LayoutPatchToken) return;
    var shellH = contentH + 56;
    var shellHpx = shellH + 'px';
    var area = document.getElementById('p2-area');
    var result = document.getElementById('p2-result');
    var widgets = document.querySelector('.p2-widgets--compact');
    var widgetsWrap = document.querySelector('[data-role="persona2-widgets"]');
    var stage = slot.querySelector('.p2-reveal-stage');

    _unlockTest2ContactListNodes(slot);

    if (stage) {
      stage.style.removeProperty('height');
      stage.style.setProperty('--p2-reveal-h', contentH + 'px');
    }

    if (area && area.style.height !== shellHpx) {
      area.style.height = shellHpx;
      area.style.minHeight = shellHpx;
      area.style.setProperty('--p2-shell-h', shellHpx);
    }
    if (widgets && widgets.style.height !== shellHpx) {
      widgets.style.height = shellHpx;
      widgets.style.minHeight = shellHpx;
    }
    if (widgetsWrap && widgetsWrap.style.height !== shellHpx) {
      widgetsWrap.style.height = shellHpx;
      widgetsWrap.style.minHeight = shellHpx;
      widgetsWrap.style.overflow = 'visible';
    }

    var contentHpx = contentH + 'px';
    if (slot.style.getPropertyValue('--p2-reveal-h') !== contentHpx) {
      slot.style.setProperty('--p2-reveal-h', contentHpx);
    }
    if (result && result.style.getPropertyValue('--p2-reveal-h') !== contentHpx) {
      result.style.setProperty('--p2-reveal-h', contentHpx);
    }

    slot.dataset.p2LayoutReady = layoutKey;
  }

  applyLayout(estimate);
  requestAnimationFrame(function () {
    if (patchToken !== _p2LayoutPatchToken) return;
    requestAnimationFrame(function () {
      if (patchToken !== _p2LayoutPatchToken) return;
      var measured = Math.ceil(list.scrollHeight || list.offsetHeight || 0);
      applyLayout(Math.max(measured, estimate));
    });
  });
}

function schedulePatchTest2ContactListLayout(slot) {
  if (!slot || _p2LayoutPatchScheduled) return;
  _p2LayoutPatchScheduled = true;
  requestAnimationFrame(function () {
    _p2LayoutPatchScheduled = false;
    patchTest2ContactListLayout(slot);
  });
}

function deriveTest2LoadingStatus(userText) {
  var t = String(userText || '').trim().replace(/[.…]+$/g, '');
  if (!t) return '요청하신 내용을 정리중입니다.';
  if (/업무|연락/.test(t)) return '업무 관련 연락을 정리중입니다.';
  if (/피드백|디자인/.test(t)) return '디자인 피드백 관련 연락을 정리중입니다.';
  if (/메시지|알림/.test(t)) return '메시지와 알림을 정리중입니다.';
  var core = t.replace(/\s*(해\s*줘|해줘|부탁해).*$/i, '').trim();
  if (!core) return '요청하신 내용을 정리중입니다.';
  return core + ' 관련 내용을 정리중입니다.';
}

function setTest2AgentInputGlow(active) {
  if (!_isTest2Scope()) return;
  var agentInput = document.querySelector('.p2-agent-input');
  if (!agentInput) return;
  if (active) agentInput.classList.add('p2-agent-input--glow');
  else agentInput.classList.remove('p2-agent-input--glow');
}

function syncTest2LoadingPresentation(result) {
  if (!_isTest2Scope() || !result) return;
  var loading = result.querySelector('.p2-result-loading');
  if (!loading) return;

  var sub = loading.querySelector('.p2-result-loading__sub');
  var status = loading.querySelector('.p2-result-loading__status');
  var input = loading.querySelector('.p2-result-loading__input');
  var agentInput = document.querySelector('.p2-agent-input');
  var raw = '';

  if (sub && sub.textContent) {
    raw = sub.textContent.replace(/^[\s"“]+|[\s"”]+$/g, '');
  }
  if (!raw && agentInput) raw = String(agentInput.textContent || '').trim();
  if (!raw) return;

  if (input && input.textContent !== raw) input.textContent = raw;
  if (agentInput && agentInput.textContent !== raw) agentInput.textContent = raw;
  if (status) {
    var nextStatus = deriveTest2LoadingStatus(raw);
    if (status.textContent !== nextStatus) status.textContent = nextStatus;
  }
  setTest2AgentInputGlow(true);
}

function beginTest2LoadingChromeExit(slot) {
  if (!_isTest2Scope()) return;
  var shell = document.getElementById('p2-area');
  var result = document.getElementById('p2-result');

  if (shell) shell.classList.add('p2-loading-chrome-exiting');
  if (result) result.classList.add('p2-loading-ui-exiting');
}

function prepareTest2ContactListSequence(slot) {
  if (!_isTest2Scope() || !slot) return false;
  var list = slot.querySelector('.p2-contact-list');
  if (!list) return false;

  var header = list.querySelector('.p2-contact-list__header');
  var rows = list.querySelectorAll('.p2-contact-list__item');

  if (header) {
    header.classList.add('p2-seq-text-hidden');
    header.classList.remove('p2-seq-text-visible');
  }
  rows.forEach(function (row) {
    row.classList.add('p2-seq-text-hidden');
    row.classList.remove('p2-seq-text-visible');
  });
  return true;
}

function revealTest2ContactSequenceItem(el, delayMs) {
  if (!el) return;
  setTimeout(function () {
    requestAnimationFrame(function () {
      el.classList.remove('p2-seq-text-hidden');
      el.classList.add('p2-seq-text-visible');
    });
  }, delayMs);
}

function staggerTest2ContactListRows(slot) {
  if (!_isTest2Scope() || !slot) return;
  if (slot.dataset.test2ContactStagger === '1') return;
  if (!slot.classList.contains('p2-seq-color-active')) return;
  var list = slot.querySelector('.p2-contact-list');
  if (!list) return;

  slot.dataset.test2ContactStagger = '1';
  slot.dataset.test2ContactRevealLock = '1';
  slot.classList.add('p2-contact-reveal-active');
  installTest2FillFadeOutBridge(slot);
  applyTest2ContactListShellHeight(slot);
  activateTest2ContactListLayout(slot);

  var header = list.querySelector('.p2-contact-list__header');
  var rows = list.querySelectorAll('.p2-contact-list__item');
  var baseDelay = 100;
  var stepDelay = 155;
  var seqIndex = 0;

  revealTest2ContactSequenceItem(header, baseDelay + seqIndex++ * stepDelay);
  rows.forEach(function (row) {
    revealTest2ContactSequenceItem(row, baseDelay + seqIndex++ * stepDelay);
  });

  setTimeout(function () {
    slot.dataset.test2ContactRevealLock = '';
    patchTest2ContactListLayout(slot, { force: true });
  }, baseDelay + seqIndex * stepDelay + 560);
}

function installTest2FillFadeOutBridge(slot) {
  if (!slot || slot.dataset.test2FillFadeBound === '1') return;
  slot.dataset.test2FillFadeBound = '1';
  document.addEventListener('p2-test2-fill-fadeout', function onFadeOut() {
    document.removeEventListener('p2-test2-fill-fadeout', onFadeOut);
    slot.classList.add('p2-seq-done');
    slot.style.pointerEvents = 'auto';
    var result = document.getElementById('p2-result');
    var defaults = document.getElementById('p2-default-widgets');
        if (result) {
          result.classList.remove('is-loading', 'p2-crossfade-out', 'p2-loading-ui-exiting');
          result.classList.add('has-swap', 'p2-default-hiding');
        }
    if (defaults) {
      defaults.style.opacity = '0';
      defaults.style.display = 'none';
    }
    var flowShell = document.getElementById('p2-area');
    if (flowShell) {
          setTimeout(function () {
            flowShell.classList.remove('p2-agent-shell--flow-handoff', 'p2-loading-chrome-exiting');
          }, 900);
    }
  });
}

window.patchTest2ContactListLayout = patchTest2ContactListLayout;
window.applyTest2ContactListShellHeight = applyTest2ContactListShellHeight;
window.beginTest2LoadingChromeExit = beginTest2LoadingChromeExit;
window.activateTest2ContactListLayout = activateTest2ContactListLayout;
window.syncTest2LoadingPresentation = syncTest2LoadingPresentation;
window.setTest2AgentInputGlow = setTest2AgentInputGlow;

function syncTest2VoiceStarState(canvas) {
  if (!canvas || !_isTest2Scope()) return;
  var star = document.getElementById('p2-star');
  if (!star) return;
  var active =
    canvas.classList.contains('p2-listening') ||
    canvas.classList.contains('p2-generating');
  var icon = star.querySelector('.dot-icon11');
  var grad = star.querySelector('.dot-icon11__grad');
  var from = star.querySelector('.dot-icon11__layer--from');
  var to = star.querySelector('.dot-icon11__layer--to');
  var chord = star.querySelector('.p2-breathing-chord');

  if (active) {
    star.classList.add('p2-star-voice-live');
    star.classList.remove('p2-star-voice-settled');
    star.style.background = '#FF7F24';
    star.style.borderRadius = '28px';
    star.style.overflow = 'hidden';
    if (chord) chord.style.display = 'none';
    if (icon) {
      icon.style.display = 'flex';
      icon.style.background = '#FF7F24';
      icon.style.opacity = '1';
    }
    if (grad) grad.style.opacity = '1';
    if (from) from.style.opacity = '0';
    if (to) {
      to.style.opacity = '1';
      to.style.filter = 'blur(0px)';
    }
  } else {
    star.classList.remove('p2-star-voice-live');
    star.classList.add('p2-star-voice-settled');
    star.style.removeProperty('background');
    star.style.removeProperty('border-radius');
    star.style.removeProperty('overflow');
    if (chord) chord.style.removeProperty('display');
    if (icon) {
      icon.style.removeProperty('display');
      icon.style.removeProperty('background');
      icon.style.removeProperty('opacity');
    }
    if (grad) grad.style.removeProperty('opacity');
    if (from) from.style.removeProperty('opacity');
    if (to) {
      to.style.removeProperty('opacity');
      to.style.removeProperty('filter');
    }
  }
}

function installTest2P2TransitionBridge(canvas) {
  if (!canvas || canvas.dataset.test2P2Bridge === '1') return;
  if (!(window.__mlpTestConfig && window.__mlpTestConfig.id === 'test2')) return;
  canvas.dataset.test2P2Bridge = '1';

  function softenSlotInlineStyles(slot) {
    if (!slot) return;
    var inReveal =
      slot.classList.contains('p2-reveal-waiting') ||
      slot.classList.contains('p2-reveal-swap') ||
      slot.classList.contains('p2-seq-done');
    if (!inReveal) return;
    slot.style.removeProperty('opacity');
    slot.style.removeProperty('transition');
  }

  function syncContactListLayout(slot, opts) {
    opts = opts || {};
    if (!slot || !slot.querySelector('.p2-contact-list')) return;
    softenSlotInlineStyles(slot);

    if (opts.mount) {
      slot.dataset.p2LayoutReady = '';
      prepareTest2ContactListSequence(slot);
    }

    if (slot.classList.contains('p2-seq-color-active')) {
      staggerTest2ContactListRows(slot);
    } else if (slot.classList.contains('p2-seq-done')) {
      activateTest2ContactListLayout(slot);
      if (!slot.dataset.p2LayoutReady) {
        schedulePatchTest2ContactListLayout(slot);
      }
    }
  }

  function bindSlot(slot) {
    if (!slot || slot.dataset.test2P2Bound === '1') return;
    slot.dataset.test2P2Bound = '1';
    new MutationObserver(function (mutations) {
      var shouldSync = false;
      var isMount = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'childList') {
          shouldSync = true;
          isMount = true;
          break;
        }
        if (m.type === 'attributes' && m.attributeName === 'class' && m.target === slot) {
          shouldSync = true;
        }
      }
      if (shouldSync) syncContactListLayout(slot, { mount: isMount });
    }).observe(slot, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  }

  function bindResult(result) {
    if (!result || result.dataset.test2P2ResultBound === '1') return;
    result.dataset.test2P2ResultBound = '1';
    new MutationObserver(function () {
      if (!result.classList.contains('is-loading')) return;
      syncTest2LoadingPresentation(result);
    }).observe(result, { attributes: true, attributeFilter: ['class'] });
    if (result.classList.contains('is-loading')) {
      syncTest2LoadingPresentation(result);
    }
  }

  bindSlot(document.getElementById('p2-slot'));
  bindResult(document.getElementById('p2-result'));
  syncTest2VoiceStarState(canvas);
  new MutationObserver(function () {
    bindSlot(document.getElementById('p2-slot'));
    bindResult(document.getElementById('p2-result'));
    syncTest2VoiceStarState(canvas);
  }).observe(canvas, { childList: true, subtree: true });
  new MutationObserver(function () {
    syncTest2VoiceStarState(canvas);
  }).observe(canvas, { attributes: true, attributeFilter: ['class'] });
}

window.generateSurfaceScenario = function generateSurfaceScenario(surfaceType) {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  const testScope = window.__mlpTestConfig && window.__mlpTestConfig.id;
  window.currentSurfaceType = surfaceType;

  // Add support for lockscreen-dot
  if (surfaceType === 'lockscreen-dot') {
    window.SURFACE_TYPES.LOCKSCREEN_DOT = 'lockscreen-dot';
  }

  const viewport = { width: 388, height: 880 };
  let layout = window.createOneUILayout(viewport, surfaceType);
  const plan = window.composeSurfacePlan(surfaceType, layout);
  // Expand compositional roles into individual editable nodes.
  window.expandContainerComponents(plan, layout);
  if (testScope) {
    canvas.setAttribute('data-test-scope', testScope);
    if (testScope === 'test3') {
      var homeStage = window.__mlpTestConfig && window.__mlpTestConfig.homeStage;
      var shouldEnter = (homeStage === 'home') && !!window.__mlpTest3HomeEnterArmed;
      // Performance: avoid starting enter animation on the same frame as heavy DOM creation.
      // Prep keeps widgets invisible; then we flip to "enter" on the next frame.
      canvas.removeAttribute('data-test3-home-enter');
      if (shouldEnter) canvas.setAttribute('data-test3-home-prep', '1');
      else canvas.removeAttribute('data-test3-home-prep');
      if (homeStage === 'home') {
        canvas.setAttribute('data-test3-music-shift', window.__mlpTest3MusicShifted ? '1' : '0');
        if (window.__mlpTest3WeatherDropped) {
          canvas.setAttribute('data-test3-weather-dropped', '1');
        } else {
          canvas.removeAttribute('data-test3-weather-dropped');
        }
        canvas.removeAttribute('data-test3-weather-prep');
      } else {
        window.__mlpTest3MusicShifted = false;
        window.__mlpTest3MusicShiftPrep = false;
        window.__mlpTest3WeatherDropped = false;
        window.__mlpTest3MusicShiftRunId = (window.__mlpTest3MusicShiftRunId || 0) + 1;
        window.__mlpTest3WeatherRainArmed = false;
        if (window.__mlpTest3WeatherRainTimer) {
          clearTimeout(window.__mlpTest3WeatherRainTimer);
          window.__mlpTest3WeatherRainTimer = null;
        }
        if (window.__mlpTest3MusicShiftTimer) {
          clearTimeout(window.__mlpTest3MusicShiftTimer);
          window.__mlpTest3MusicShiftTimer = null;
        }
        if (window.__mlpTest3MusicMountTimer) {
          clearTimeout(window.__mlpTest3MusicMountTimer);
          window.__mlpTest3MusicMountTimer = null;
        }
        // Stop the goal time + distance tickers when leaving the home
        // stage so they don't run forever on every page load. Also
        // freeze any map-dot crawl in progress and clear the hover-pause
        // flag so a stale flag doesn't carry over to other test scopes.
        if (typeof _stopTest3GoalTimeTicker === 'function') _stopTest3GoalTimeTicker();
        if (typeof _stopTest3GoalDistanceTicker === 'function') _stopTest3GoalDistanceTicker();
        if (typeof _stopTest3MapDotMotion === 'function') _stopTest3MapDotMotion();
        if (typeof _stopTest3MusicTimeTicker === 'function') _stopTest3MusicTimeTicker();
        if (typeof _stopTest3MusicAudio === 'function') _stopTest3MusicAudio();
        window.__mlpTest3HoverPaused = false;
        // Reset goal-related session flags so the NEXT entry from
        // intro can fire the first-mount entrance animations again.
        window.__mlpTest3GoalFreshDone = false;
        window.__mlpTest3GoalMapZoomDone = false;
        canvas.removeAttribute('data-test3-music-shift');
        canvas.removeAttribute('data-test3-weather-prep');
        canvas.removeAttribute('data-test3-weather-dropped');
        canvas.removeAttribute('data-test3-weather-rain');
      }
    } else {
      canvas.removeAttribute('data-test3-home-enter');
      canvas.removeAttribute('data-test3-home-prep');
      canvas.removeAttribute('data-test3-music-shift');
      if (typeof _stopTest3GoalTimeTicker === 'function') _stopTest3GoalTimeTicker();
      if (typeof _stopTest3GoalDistanceTicker === 'function') _stopTest3GoalDistanceTicker();
      if (typeof _stopTest3MapDotMotion === 'function') _stopTest3MapDotMotion();
      if (typeof _stopTest3MusicTimeTicker === 'function') _stopTest3MusicTimeTicker();
      if (typeof _stopTest3MusicAudio === 'function') _stopTest3MusicAudio();
      window.__mlpTest3HoverPaused = false;
    }
  } else {
    canvas.removeAttribute('data-test-scope');
    canvas.removeAttribute('data-test3-home-enter');
    canvas.removeAttribute('data-test3-home-prep');
    canvas.removeAttribute('data-test3-music-shift');
  }
  window.renderSurfacePlan(canvas, plan, layout);
  if (testScope === 'test2') {
    try {
      installTest2P2TransitionBridge(canvas);
    } catch (_) {}
  }


  // test3 home: stage attribute + first-mount-only entrance flag.
  //   data-test3-home="1"         → present whenever in home stage; CSS
  //                                  uses this to disable global
  //                                  scenarioEntrySlideDown (app dock,
  //                                  status bar, gesture bar, etc.).
  //   data-test3-goal-fresh="1"   → present ONLY on the very first home
  //                                  mount after intro→home transition.
  //                                  CSS uses this to gate the goal's
  //                                  entrance animations (map scale,
  //                                  stat slide-up, gradient sweep).
  //                                  Cleared 2s later so subsequent
  //                                  re-renders (music shift) skip them.
  if (testScope === 'test3' &&
      window.__mlpTestConfig &&
      window.__mlpTestConfig.homeStage === 'home') {
    canvas.setAttribute('data-test3-home', '1');
    if (!window.__mlpTest3GoalFreshDone) {
      canvas.setAttribute('data-test3-goal-fresh', '1');
      window.__mlpTest3GoalFreshDone = true;
      setTimeout(function () {
        try {
          var c = document.getElementById('canvas');
          if (c) c.removeAttribute('data-test3-goal-fresh');
        } catch (_) {}
      }, 1500);
    }
    // else: finishTransition already armed goal-fresh + test3-goal-enter —
    // do NOT clear them here or entrance animations never paint.
    // Leaflet map needs to be (re)initialized whenever the goal card
    // is re-rendered. The `data-map-init` check inside _initTest3GoalMap
    // makes it idempotent per element instance; the slow zoom-out only
    // runs once (gated by window.__mlpTest3GoalMapZoomDone).
    requestAnimationFrame(function () {
      if (typeof _initTest3GoalMap !== 'function') return;
      // finishTransition defers map init while goal-fresh entrance runs.
      if (canvas.getAttribute('data-test3-goal-fresh') === '1') return;
      _initTest3GoalMap();
    });
  } else if (testScope === 'test3') {
    // Left home stage — clear all home flags.
    canvas.removeAttribute('data-test3-home');
    canvas.removeAttribute('data-test3-goal-fresh');
  }

  // test3: flip prep → enter on next frame, then tear down enter after animations complete
  if (testScope === 'test3' && canvas.getAttribute('data-test3-home-prep') === '1') {
    requestAnimationFrame(function () {
      try {
        var stillTest3 =
          (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3') ||
          (document.body && document.body.dataset && document.body.dataset.mlpTest === 'test3');
        if (!stillTest3) return;
        if (!canvas || canvas.getAttribute('data-test-scope') !== 'test3') return;
        canvas.removeAttribute('data-test3-home-prep');
        canvas.setAttribute('data-test3-home-enter', '1');
        window.__mlpTest3HomeEnterArmed = false;
        setTimeout(function () {
          try {
            var stillTest3Later =
              (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3') ||
              (document.body && document.body.dataset && document.body.dataset.mlpTest === 'test3');
            if (!stillTest3Later) return;
            if (canvas && canvas.getAttribute('data-test-scope') === 'test3') {
              canvas.removeAttribute('data-test3-home-enter');
            }
            window.__mlpTest3HomeEntered = true;
          } catch (_) {}
        }, 860);
      } catch (_) {}
    });
  }
  if (typeof window.bindCanvasPointerTracking === 'function') {
    window.bindCanvasPointerTracking();
  }

  // Single hydrate — emits one 'hydrate' event to subscribers.
  if (window.DesignDoc && typeof window.DesignDoc.hydrateFromPlan === 'function') {
    window.DesignDoc.hydrateFromPlan(plan, surfaceType);
  }

  // test3 (health home): warm heavy home widget render paths during intro idle time
  // so the first click doesn't pay the cold-start cost.
  if (testScope === 'test3') {
    try {
      var stageAfter = window.__mlpTestConfig && window.__mlpTestConfig.homeStage;
      if (stageAfter !== 'home' && !window.__mlpTest3HomeWidgetsPriming) {
        window.__mlpTest3HomeWidgetsPriming = true;
        var schedule = window.requestIdleCallback
          ? function (fn) { window.requestIdleCallback(fn, { timeout: 650 }); }
          : function (fn) { setTimeout(fn, 120); };
        schedule(function () {
          try {
            if (typeof window.__mlpTest3WarmHomeRender === 'function') {
              window.__mlpTest3WarmHomeRender(surfaceType);
            }
          } catch (_) {}
        });
      }
    } catch (_) {}
  }

  // test3 (health home): after a beat on home, animate music appearance + layout shift
  if (testScope === 'test3') {
    try {
      if (window.__mlpTest3MusicShiftTimer) {
        clearTimeout(window.__mlpTest3MusicShiftTimer);
        window.__mlpTest3MusicShiftTimer = null;
      }
      if (window.__mlpTest3MusicMountTimer) {
        clearTimeout(window.__mlpTest3MusicMountTimer);
        window.__mlpTest3MusicMountTimer = null;
      }
      var stage = window.__mlpTestConfig && window.__mlpTestConfig.homeStage;
      if (stage === 'home' && !window.__mlpTest3MusicShifted && !window.__mlpTest3MusicShiftPrep) {
        var musicShiftRunId = window.__mlpTest3MusicShiftRunId || 0;
        window.__mlpTest3MusicShiftTimer = setTimeout(function () {
          try {
            var stillTest3 =
              (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3') ||
              (document.body && document.body.dataset && document.body.dataset.mlpTest === 'test3');
            if (!stillTest3) return;
            if ((window.__mlpTest3MusicShiftRunId || 0) !== musicShiftRunId) return;
            if (!window.__mlpTestConfig || window.__mlpTestConfig.homeStage !== 'home') return;
            var c = document.getElementById('canvas');
            if (!c || c.getAttribute('data-test-scope') !== 'test3') return;
            // Phase 1 — weather + progress drop alone; music mounts after.
            window.__mlpTest3MusicShiftPrep = true;
            var weatherEl = c.querySelector('#test3-weather');
            var stepsEl   = c.querySelector('#test3-steps');
            if (weatherEl) weatherEl.classList.remove('test3-intro-prefade');
            if (stepsEl)   stepsEl.classList.remove('test3-intro-prefade');
            c.setAttribute('data-test3-weather-prep', '1');
            if (typeof window.__mountTest3WeatherRainMotion === 'function') {
              window.__mountTest3WeatherRainMotion(1020);
            }
            window.__mlpTest3MusicMountTimer = setTimeout(function () {
              _mountTest3MusicAfterWeatherPrep(musicShiftRunId);
            }, TEST3_MUSIC_PRE_DELAY_MS);
          } catch (_) {}
        }, 5600);
      }
    } catch (_) {}
  }

};

// ============================================================================
// Expandable app bar — 2-state snap logic (expanded / collapsed only)
// Per One UI guide: no resting mid-state. Threshold-based snap on scroll.
// ============================================================================

window.setExpandableAppBarState = function setExpandableAppBarState(el, state) {
  if (!el) return;
  const isExpanded = state === 'expanded';

  el.dataset.appBarState = isExpanded ? 'expanded' : 'collapsed';

  const title = el.querySelector('[data-appbar-title]') || el.firstElementChild;
  if (title) {
    title.style.transition = 'font-size 220ms cubic-bezier(0.2,0,0,1), transform 220ms cubic-bezier(0.2,0,0,1), opacity 220ms cubic-bezier(0.2,0,0,1)';
  }

  el.style.transition = 'height 220ms cubic-bezier(0.2,0,0,1), top 220ms cubic-bezier(0.2,0,0,1)';
  el.style.height = isExpanded ? '215px' : '56px';

  if (title) {
    title.style.fontSize = isExpanded ? '32px' : '20px';
    title.style.transform = isExpanded ? 'translateY(0)' : 'translateY(-2px)';
  }
};

window.enableExpandableAppBarSnap = function enableExpandableAppBarSnap(canvas, surfaceType) {
  if (!canvas) return;
  if (
    surfaceType !== (window.SURFACE_TYPES?.FIRST_DEPTH_LIST || 'first-depth-list') &&
    surfaceType !== (window.SURFACE_TYPES?.SECOND_DEPTH_DETAIL || 'second-depth-detail')
  ) return;

  const appBar = canvas.querySelector('[data-role="expandable-app-bar"], .canvas-item[data-role="expandable-app-bar"]');
  const scrollBody =
    canvas.querySelector('[data-role="list"]') ||
    canvas.querySelector('[data-role="detail-content"]') ||
    canvas.querySelector('.canvas-item[data-role="list"]') ||
    canvas.querySelector('.canvas-item[data-role="detail-content"]');

  if (!appBar || !scrollBody) return;
  if (appBar.dataset.snapBound === '1') return;

  appBar.dataset.snapBound = '1';
  appBar.dataset.appBarState = appBar.dataset.appBarState || 'expanded';

  scrollBody.style.overflowY = 'auto';
  scrollBody.style.webkitOverflowScrolling = 'touch';

  let ticking = false;
  let lastScrollTop = 0;

  function applySnap() {
    ticking = false;
    const st = scrollBody.scrollTop;
    const threshold = 48;

    if (st <= 0) {
      window.setExpandableAppBarState(appBar, 'expanded');
      lastScrollTop = st;
      return;
    }

    if (st > threshold) {
      window.setExpandableAppBarState(appBar, 'collapsed');
    } else {
      window.setExpandableAppBarState(appBar, 'expanded');
    }

    lastScrollTop = st;
  }

  scrollBody.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(applySnap);
    }
  });

  scrollBody.addEventListener('touchend', () => {
    applySnap();
  });

  scrollBody.addEventListener('mouseup', () => {
    applySnap();
  });
};

// ============================================================================
//  Interact-mode delegated handlers for surface atomics
//  ---------------------------------------------------------------------------
//  Atomics (toggle-chip, slider-pill, etc.) are rendered as innerHTML strings,
//  which means per-element onclick can't easily survive re-renders from
//  composeSurfacePlan. Instead we delegate from document:
//    - Clicks only take effect when body.cmd-interact-mode is set
//    - We stopPropagation so the canvas click handler doesn't run selection
//  The handler is idempotent — bind once.
// ============================================================================
(function () {
  if (window._atomicInteractBound) return;
  window._atomicInteractBound = true;

  function _inInteractMode(e) {
    return !!(e && (e.metaKey || e.ctrlKey)) ||
           document.body.classList.contains('cmd-interact-mode');
  }

  // --- Toggle chip: click anywhere on the 56×56 circle flips on/off --------
  document.addEventListener('click', function (e) {
    if (!_inInteractMode(e)) return;
    var chip = e.target.closest('[data-toggle-chip]');
    if (!chip) return;
    e.stopPropagation();
    var on = chip.getAttribute('data-on') === '1';
    var next = !on;
    chip.setAttribute('data-on', next ? '1' : '0');
    chip.style.background = next ? '#d5d5d5' : 'rgba(180,180,180,0.2)';
    var onEl = chip.querySelector('[data-toggle-on]');
    var offEl = chip.querySelector('[data-toggle-off]');
    if (onEl) onEl.style.display = next ? 'inline-flex' : 'none';
    if (offEl) offEl.style.display = next ? 'none' : 'inline-flex';
  }, true);

  // --- Shortcut / navigation press animation -------------------------------
  // `[data-shortcut]` marks single-toggle kind='shortcut' and any other
  // Figma atomics that represent a navigation action (open another screen).
  // No state changes — just a quick press-ripple so the click feels real.
  document.addEventListener('click', function (e) {
    if (!_inInteractMode(e)) return;
    var btn = e.target.closest('[data-shortcut]');
    if (!btn) return;
    e.stopPropagation();
    btn.style.transform = 'scale(0.96)';
    btn.style.background = 'rgba(23,23,26,0.5)';
    setTimeout(function () {
      btn.style.transform = '';
      btn.style.background = '';
    }, 140);
  }, true);

  // --- Slider pill: pointer-drag updates fill in %. Works for both
  // horizontal and vertical orientations (data-orient="vertical").
  // Vertical fill grows bottom→top, so we invert the Y axis.
  var _drag = null;
  function _setPctFromPoint(pill, clientX, clientY) {
    var rect = pill.getBoundingClientRect();
    var vertical = pill.getAttribute('data-orient') === 'vertical';
    var raw;
    if (vertical) {
      // Invert: pointer near top = 100%, near bottom = 0%
      raw = 1 - (clientY - rect.top) / Math.max(1, rect.height);
    } else {
      raw = (clientX - rect.left) / Math.max(1, rect.width);
    }
    var pct = Math.round(Math.max(0, Math.min(1, raw)) * 100);
    pill.setAttribute('data-pct', String(pct));
    var fill = pill.querySelector('[data-slider-fill]');
    if (!fill) return;
    if (vertical) fill.style.height = pct + '%';
    else          fill.style.width  = pct + '%';
  }
  document.addEventListener('pointerdown', function (e) {
    if (!_inInteractMode(e)) return;
    var pill = e.target.closest('[data-slider-pill]');
    if (!pill) return;
    e.stopPropagation();
    e.preventDefault();
    _drag = pill;
    try { pill.setPointerCapture(e.pointerId); } catch (_) {}
    _setPctFromPoint(pill, e.clientX, e.clientY);
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!_drag) return;
    _setPctFromPoint(_drag, e.clientX, e.clientY);
  }, true);
  document.addEventListener('pointerup', function () { _drag = null; }, true);
  document.addEventListener('pointercancel', function () { _drag = null; }, true);
})();
