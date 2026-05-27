
  // Theme system ·boot apply + Generate-panel picker + cross-window
  // sync. The customize page (/customize) is the editor; this block
  // handles the active-theme apply + the small Generate-panel dropdown
  // that lets the user fast-switch presets without leaving the page.
  // BroadcastChannel keeps the two windows in sync ·saving a theme
  // on /customize broadcasts a 'theme-saved' message that this window
  // listens for to refresh its dropdown options.
  (function _themeBoot() {
    const STYLE_EL_ID = 'theme-vars';
    const SELECT_ID   = 'themePickerSelect';
    let CACHED_THEMES = null;

    function applyVarsToRoot(vars) {
      var raw = vars || {};
      // Document globals: surface renderer reads `--oneui-theme-style` /
      // chroma from :root (`getComputedStyle(document.documentElement)`).
      // Palette tokens (`--text-primary`, surfaces, QS chips, · live on the
      // device frames only so Neon black ink does not recolor sidebar/topbar.
      var DOC_KEYS = new Set(['--oneui-theme-style', '--oneui-chroma']);
      var rootLines = [];
      var frameLines = [];
      Object.keys(raw).forEach(function (key) {
        var v = raw[key];
        var line = '  ' + key + ': ' + v + ';';
        if (DOC_KEYS.has(key)) rootLines.push(line);
        else frameLines.push(line);
      });
      var css = '';
      if (rootLines.length) {
        css += ':root {\n' + rootLines.join('\n') + '\n}\n';
      }
      if (frameLines.length) {
        css += '#canvasFrame, #canvasFrameB {\n' + frameLines.join('\n') + '\n}\n';
      }
      const style = document.getElementById(STYLE_EL_ID);
      if (style) style.textContent = css;
    }

    function populatePicker(themes, activeId) {
      const sel = document.getElementById(SELECT_ID);
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = themes.map(t =>
        '<option value="' + t.id + '"' + (t.id === activeId ? ' selected' : '') + '>' + t.name + '</option>'
      ).join('');
      // Restore prior selection if the active id changed but the
      // previously-selected theme is still in the list.
      if (prev && themes.find(t => t.id === prev)) sel.value = prev;
    }

    function loadAndApply(opts) {
      return fetch('/api/themes', { cache: 'no-store' })
        .then(r => r.json())
        .then(data => {
          if (!data || !data.themes) return;
          CACHED_THEMES = data.themes;
          const activeId = (opts && opts.forceId) || data._active;
          const active = data.themes.find(t => t.id === activeId) || data.themes[0];
          if (active && active.vars) applyVarsToRoot(active.vars);
          window.__activeTheme = active && active.id;
          // Wait one tick ·the picker element may not exist yet at
          // boot time (it's later in the DOM than this <head> script).
          setTimeout(function () {
            populatePicker(data.themes, active && active.id);
            if (typeof window.refreshCanvasForTheme === 'function') {
              window.refreshCanvasForTheme();
            }
          }, 0);
        })
        .catch(() => {});
    }

    // Called by the dropdown's onchange. Applies vars locally + POSTs
    // active id so the change persists across reloads.
    window.applyThemeFromPicker = function applyThemeFromPicker(id) {
      if (!id || !CACHED_THEMES) return;
      const theme = CACHED_THEMES.find(t => t.id === id);
      if (!theme) return;
      applyVarsToRoot(theme.vars || {});
      window.__activeTheme = id;
      fetch('/api/themes/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      }).catch(() => {});
      requestAnimationFrame(function () {
        if (typeof window.refreshCanvasForTheme === 'function') {
          window.refreshCanvasForTheme();
        }
      });
    };

    // Cross-window sync ·listens for 'theme-saved' broadcasts from
    // the /customize editor (which posts whenever a theme is created
    // or the active theme changes). On receive, we re-fetch the list
    // and update the dropdown so newly-saved custom themes show up
    // immediately without a manual refresh.
    if (typeof BroadcastChannel === 'function') {
      const ch = new BroadcastChannel('oneui-themes');
      ch.addEventListener('message', (ev) => {
        if (!ev || !ev.data) return;
        if (ev.data.type === 'theme-saved' || ev.data.type === 'theme-active-changed') {
          loadAndApply({ forceId: ev.data.activeId });
        }
      });
      window.__themeChannel = ch;
    }

    loadAndApply();
  })();

  // Mock pipelineGenerate for prototype page
  window.pipelineGenerate = function(title) {
    console.log('Mock pipelineGenerate called with:', title);
    if (typeof window.generateSurfaceScenario === 'function') {
      let surfaceType = 'first-depth-list'; // default
      
      const titleLower = title.toLowerCase();
      if (titleLower.includes('lock')) surfaceType = 'lockscreen';
      else if (titleLower.includes('quick')) surfaceType = 'quick-settings';
      else if (titleLower.includes('notif')) surfaceType = 'notification-shade';
      else if (titleLower.includes('list')) surfaceType = 'first-depth-list';
      else if (titleLower.includes('detail')) surfaceType = 'second-depth-detail';
      else if (titleLower.includes('tab')) surfaceType = 'tab-root';
      else if (titleLower.includes('dialog') && titleLower.includes('bottom')) surfaceType = 'dialog-bottom';
      else if (titleLower.includes('dialog')) surfaceType = 'dialog-center';
      
      window.generateSurfaceScenario(surfaceType);
    } else {
      console.warn('generateSurfaceScenario not found');
    }
  };

  // -------------------------------------------------------------------------
  // Persona 1 interaction: tap Music → expand to the right, temporarily
  // hide the right widgets (steps/jogging) with a press-like collapse.
  // -------------------------------------------------------------------------
  (function _persona1MusicExpand() {
    function onReady(fn) {
      if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
      else document.addEventListener('DOMContentLoaded', fn, { once: true });
    }

    onReady(function () {
      var canvas = document.getElementById('canvas');
      if (!canvas) return;

      var isAnimating = false;

      function toggle() {
        if (isAnimating) return;
        isAnimating = true;
        canvas.classList.toggle('p1-music-expanded');
        // release lock after transition window
        setTimeout(function () { isAnimating = false; }, 520);
      }

      // Delegated: the surface items exist after generateSurfaceScenario()
      document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t) return;
        var el = t.closest && t.closest('#p1-music');
        if (!el) return;
        toggle();
      }, true);
    });
  })();

  // -------------------------------------------------------------------------
  // Persona 2 interaction: tap left STAR → start voice input →
  // update the dark result card text (Image2 style).
  // Uses Web Speech API when available; falls back to prompt() for dev.
  // -------------------------------------------------------------------------
  (function _persona2VoiceStar() {
    var listening = false;
    var generating = false;
    var chordRaf = null;
    var chordTime = 0;
    var formationLerp = 0; // 0 = breathing, 1 = circular

    // --- Audio Analysis Variables ---
    var audioContext = null;
    var analyser = null;
    var dataArray = null;
    var micStream = null;
    var currentVolume = 0;
    var audioInitId = 0;

    function cleanupAudioAnalysis() {
      if (micStream) {
        micStream.getTracks().forEach(function (track) { track.stop(); });
        micStream = null;
      }
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      analyser = null;
      dataArray = null;
    }

    async function initAudioAnalysis() {
      if (audioContext) return;

      var initId = audioInitId;
      var ctx = null;
      var stream = null;
      try {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

        ctx = new AudioContextClass();
        audioContext = ctx;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // stopListening() may run while awaiting mic permission/stream
        if (initId !== audioInitId || !listening || audioContext !== ctx) {
          stream.getTracks().forEach(function (track) { track.stop(); });
          if (audioContext === ctx) cleanupAudioAnalysis();
          return;
        }

        micStream = stream;
        var source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        var bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        source.connect(analyser);
      } catch (e) {
        console.error('Audio analysis init failed:', e);
        if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
        if (audioContext === ctx) cleanupAudioAnalysis();
      }
    }

    function updateVolume() {
      if (!analyser || !dataArray) return 0;
      analyser.getByteFrequencyData(dataArray);
      var sum = 0;
      for (var i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      var average = sum / dataArray.length;
      // Normalize and smooth
      var targetVolume = Math.min(1, average / 128);
      currentVolume += (targetVolume - currentVolume) * 0.2;
      return currentVolume;
    }

    function updateChordAnimation() {
      if (!listening && !generating) {
        if (chordRaf) cancelAnimationFrame(chordRaf);
        chordRaf = null;
        return;
      }

      var container = document.querySelector('.p2-breathing-chord');
      if (!container) {
        chordRaf = requestAnimationFrame(updateChordAnimation);
        return;
      }

      var dots = container.querySelectorAll('span');
      if (!dots || dots.length === 0) {
        chordRaf = requestAnimationFrame(updateChordAnimation);
        return;
      }

        chordTime += 0.04;
        var t = chordTime;
        var N = dots.length;

        var vol = updateVolume();
        if (window.P2AgentFillGL) window.P2AgentFillGL.setAudio(vol);
        // Voice-reactive amplitude: base breathing (14) + voice boost (up to 26 more)
        var dynamicAmp = 14 + (vol * 26);

        // Smoothly transition between breathing and circular formation
        if (generating) {
          formationLerp += (1 - formationLerp) * 0.1;
        } else {
          formationLerp += (0 - formationLerp) * 0.1;
        }

        for (var i = 0; i < N; i++) {
          var dot = dots[i];
          
          // --- Breathing State Calculation ---
          var off = i * ((Math.PI * 2) / N);
          var off2 = i * ((Math.PI * 2) / N) * 0.45;
          var sin1 = Math.sin(t * 1.6 - off);
          var sin2 = Math.sin(t * 0.7 - off2);
          var sin3 = Math.sin(t * 0.3 + i * 0.8);
          var yMix = (sin1 * 0.5 + sin2 * 0.3 + sin3 * 0.2);
          var spacing = 11;
          var startX = (80 - (N - 1) * spacing) / 2;
          var bx = startX + i * spacing;
          var bxDrift = Math.sin(t * 0.5 + i) * 2;
          var by = 40 + yMix * dynamicAmp; // Use dynamicAmp here

        // --- Circular Generating State Calculation ---
        var rotSpeed = t * 0.8; // Slow rotation
        var angle = rotSpeed + (i * (Math.PI * 2) / N);
        var radius = 22; // Circle radius
        var cx = 40 + Math.cos(angle) * radius;
        var cy = 40 + Math.sin(angle) * radius;

        // --- Lerp between states ---
        var finalX = bx + bxDrift + (cx - (bx + bxDrift)) * formationLerp;
        var finalY = by + (cy - by) * formationLerp;

        dot.style.position = 'absolute';
        dot.style.left = '0';
        dot.style.top = '0';
        dot.style.transform = 'translate(' + (finalX - 3.5) + 'px, ' + (finalY - 3.5) + 'px)';
        
        // Subtle opacity pulse
        dot.style.opacity = 0.6 + (yMix + 1) * 0.2;
      }

      chordRaf = requestAnimationFrame(updateChordAnimation);
    }

    function onReady(fn) {
      if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
      else document.addEventListener('DOMContentLoaded', fn, { once: true });
    }

    // Server resolver: sends the user's request and returns theme + component
    // selection. Falls back to a local default on failure.
    async function resolveFromApi(text) {
      // Try to get current location coordinates if available
      var locationInfo = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
          });
          locationInfo = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        } catch (e) {}
      }

      try {
        var res = await fetch('/api/p2/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text, location: locationInfo })
        });
        if (!res.ok) throw new Error('bad status');
        return await res.json();
      } catch (e) {
        return {
          themeKey: 'lavender',
          component: {
            role: 'dot-schedule-2x2',
            variant: {
              date: 'Today',
              items: [
                { text: '준비된 일정이 없습니다', tone: 'muted' },
                { text: '새로운 하루를 시작해보세요', tone: 'accent' }
              ],
            }
          }
        };
      }
    }

    function applyTheme(themeKey) {
      var root = document.documentElement;
      if (!root) return;
      var THEMES = {
        lavender: { lav: '#B9A6FF', soft: '#E7E0FF', black: 'rgba(16,16,18,0.90)' },
        purple:   { lav: '#A78BFA', soft: '#E9D5FF', black: 'rgba(16,16,18,0.90)' },
        blue:     { lav: '#7AA7FF', soft: '#D6E4FF', black: 'rgba(16,16,18,0.90)' },
        mint:     { lav: '#5CE1D6', soft: '#CFF7F2', black: 'rgba(16,16,18,0.90)' },
        amber:    { lav: '#FFB01C', soft: '#FFE7B0', black: 'rgba(16,16,18,0.90)' }
      };
      var t = THEMES[themeKey] || THEMES.lavender;
      root.style.setProperty('--p2-lavender', t.lav);
      root.style.setProperty('--p2-lavender-soft', t.soft);
      root.style.setProperty('--p2-black', t.black);
    }

    function applyBackgroundMood(canvas, key) {
      if (!canvas) return;
      var cls = ['p2-bg-clear','p2-bg-cloudy','p2-bg-rain','p2-bg-snow','p2-bg-night'];
      cls.forEach(function (c) { canvas.classList.remove(c); });
      if (!key) return;
      var map = {
        clear: 'p2-bg-clear',
        cloudy: 'p2-bg-cloudy',
        rain: 'p2-bg-rain',
        snow: 'p2-bg-snow',
        night: 'p2-bg-night'
      };
      var c = map[key];
      if (c) canvas.classList.add(c);
    }

    var P2_AREA_DEFAULT_H = 168;
    var P2_AREA_MAX_H = 362; // p2-widgets (450) - p2-area top offset (88)

    function computeP2ContentHeight(role, variant, sizes) {
      var sz = sizes[role] || { w: 340, h: P2_AREA_DEFAULT_H };
      if (role === 'composite-set') {
        var children = (variant && variant.children) || [];
        var maxBottom = 0;
        children.forEach(function (c) {
          maxBottom = Math.max(maxBottom, (c.y || 0) + (c.h || 0));
        });
        return Math.max(P2_AREA_DEFAULT_H, Math.min(maxBottom || sz.h, P2_AREA_MAX_H));
      }
      return Math.min(Math.max(sz.h, P2_AREA_DEFAULT_H), P2_AREA_MAX_H);
    }

    function setP2AreaHeight(h) {
      var area = document.getElementById('p2-area');
      if (!area) return;
      area.style.height = Math.round(h) + 'px';
    }

    function resetP2AreaHeight() {
      setP2AreaHeight(P2_AREA_DEFAULT_H);
    }

    function clearP2DefaultRevealState() {
      ['p2-msg14', 'p2-star', 'p2-result'].forEach(function (id) {
        var node = document.getElementById(id);
        if (node) {
          node.classList.remove(
            'p2-default-hiding',
            'p2-result-expanded',
            'p2-crossfade-out'
          );
          node.style.removeProperty('--p2-reveal-h');
        }
      });
      var slot = document.getElementById('p2-slot');
      if (slot) {
        slot.classList.remove(
          'p2-reveal-waiting', 'p2-reveal-swap', 'p2-reveal-visible',
          'p2-seq-color', 'p2-seq-color-active', 'p2-seq-title', 'p2-seq-done'
        );
        slot.style.removeProperty('--p2-reveal-h');
        slot.querySelectorAll('.p2-seq-text-hidden, .p2-seq-text-visible').forEach(function (el) {
          el.classList.remove('p2-seq-text-hidden', 'p2-seq-text-visible');
        });
      }
    }

    var P2_REVEAL_TIMING = {
      phase1: 580,
      phase2: 920,
      phase2Pause: 320,
      seqColor: 1100,
      seqAfterTitle: 380,
      seqRowStagger: 100
    };
    var P2_TEST2_REVEAL_TIMING = {
      phase1: 280,
      phase2Pause: 120,
      seqColor: 0,
      seqAfterTitle: 180,
      seqRowStagger: 72
    };

    function wrapP2RevealStage(innerHtml, contentH) {
      return '<div class="p2-reveal-stage" style="--p2-reveal-h:' + Math.round(contentH) + 'px">' + innerHtml + '</div>';
    }

    function prepareP2ContentSequence(slot) {
      var textSelectors = [
        '.dot-sch__date',
        '.dot-sch__row',
        '.dot-goal__title',
        '.dot-goal__distance',
        '.dot-goal__time',
        '.dot-w11__location',
        '.dot-w11__weather',
        '.dot-temp11__value',
        '.dot-date11__text'
      ].join(',');
      slot.querySelectorAll(textSelectors).forEach(function (el) {
        el.classList.add('p2-seq-text-hidden');
        el.classList.remove('p2-seq-text-visible');
      });
    }

    function revealP2Titles(slot) {
      slot.querySelectorAll(
        '.dot-sch__date, .dot-goal__title, .dot-w11__location, .dot-w11__weather'
      ).forEach(function (el) {
        el.classList.remove('p2-seq-text-hidden');
        el.classList.add('p2-seq-text-visible');
      });
    }

    function revealP2Rows(slot, onDone) {
      var rows = slot.querySelectorAll('.dot-sch__row');
      if (!rows.length) {
        if (onDone) onDone();
        return;
      }
      rows.forEach(function (row, i) {
        setTimeout(function () {
          row.classList.remove('p2-seq-text-hidden');
          row.classList.add('p2-seq-text-visible');
          if (i === rows.length - 1 && onDone) {
            setTimeout(onDone, 280);
          }
        }, i * P2_REVEAL_TIMING.seqRowStagger);
      });
    }

    function finishP2ContentSequence(slot, defaults, result) {
      slot.classList.add('p2-seq-done');
      slot.style.pointerEvents = 'auto';
      if (result) {
        result.classList.remove('is-loading', 'p2-crossfade-out');
        result.classList.add('has-swap', 'p2-default-hiding');
      }
      defaults.style.opacity = '0';
      defaults.style.display = 'none';
      var isTest2 = window.__mlpTestConfig && window.__mlpTestConfig.id === 'test2';
      if (window.P2AgentFillGL) {
        if (isTest2 && !slot.querySelector('.p2-contact-list')) {
          window.P2AgentFillGL.setPhase('settling');
          setTimeout(function () {
            if (window.P2AgentFillGL) window.P2AgentFillGL.setPhase('fadeOut');
          }, 900);
        } else if (!isTest2) {
          window.P2AgentFillGL.setPhase('fadeOut');
        }
      }
    }

    function runP2ContentSequence(slot, defaults, result, contentH) {
      var isTest2 = window.__mlpTestConfig && window.__mlpTestConfig.id === 'test2';
      var t = isTest2 ? P2_TEST2_REVEAL_TIMING : P2_REVEAL_TIMING;
      var hasContactList = !!(slot.querySelector && slot.querySelector('.p2-contact-list'));

      if (contentH > P2_AREA_DEFAULT_H) {
        if (isTest2 && hasContactList && typeof window.applyTest2ContactListShellHeight === 'function') {
          window.applyTest2ContactListShellHeight(slot);
        } else {
          setP2AreaHeight(contentH);
        }
      }

      slot.classList.remove('p2-reveal-waiting');
      slot.classList.add('p2-reveal-swap', 'p2-seq-color', 'p2-seq-color-active');
      if (result) result.classList.add('p2-crossfade-out');
      if (isTest2 && window.P2AgentFillGL) {
        var flowShell = document.getElementById('p2-area');
        if (flowShell) flowShell.classList.add('p2-agent-shell--flow-handoff');
        window.P2AgentFillGL.setPhase('hollowReveal');
      }
      void slot.offsetWidth;

      if (isTest2 && hasContactList) {
        slot.classList.add('p2-seq-title');
        if (typeof window.beginTest2LoadingChromeExit === 'function') {
          window.beginTest2LoadingChromeExit(slot);
        }
        setTimeout(function () {
          if (window.P2AgentFillGL && window.P2AgentFillGL.setPhase) {
            window.P2AgentFillGL.setPhase('settling');
          }
        }, 80);
        return;
      }

      setTimeout(function () {
        slot.classList.add('p2-seq-title');
        revealP2Titles(slot);

        setTimeout(function () {
          revealP2Rows(slot, function () {
            finishP2ContentSequence(slot, defaults, result);
          });
        }, t.seqAfterTitle);
      }, t.seqColor);
    }

    function runP2RevealAnimation(slot, defaults, resultEl, contentH) {
      var msg14 = document.getElementById('p2-msg14');
      var star = document.getElementById('p2-star');
      var result = resultEl || document.getElementById('p2-result');
      var isTest2 = window.__mlpTestConfig && window.__mlpTestConfig.id === 'test2';
      var t = isTest2 ? P2_TEST2_REVEAL_TIMING : P2_REVEAL_TIMING;

      slot.style.setProperty('--p2-reveal-h', Math.round(contentH) + 'px');
      if (result) result.style.setProperty('--p2-reveal-h', Math.round(contentH) + 'px');
      setP2AreaHeight(P2_AREA_DEFAULT_H);

      slot.classList.remove('p2-reveal-swap', 'p2-reveal-visible', 'p2-seq-color', 'p2-seq-color-active', 'p2-seq-title', 'p2-seq-done');
      slot.classList.add('p2-reveal-waiting');
      slot.style.display = 'block';
      slot.style.opacity = '1';
      slot.style.pointerEvents = 'none';
      slot.style.clipPath = 'none';

      requestAnimationFrame(function () {
        if (msg14) msg14.classList.add('p2-default-hiding');
        if (star) star.classList.add('p2-default-hiding');
        defaults.style.pointerEvents = 'none';
      });

      if (isTest2) {
        setTimeout(function () {
          if (result) {
            result.classList.add('p2-result-expanded');
            void result.offsetWidth;
          }
          requestAnimationFrame(function () {
            runP2ContentSequence(slot, defaults, result, contentH);
          });
        }, t.phase1);
        return;
      }

      setTimeout(function () {
        if (result) {
          result.classList.add('p2-result-expanded');
          void result.offsetWidth;
        }

        setTimeout(function () {
          runP2ContentSequence(slot, defaults, result, contentH);
        }, t.phase2Pause);
      }, t.phase1);
    }

    function mountResolvedComponent(component, attempt) {
      var slot = document.getElementById('p2-slot');
      var defaults = document.getElementById('p2-default-widgets');
      var el = document.getElementById('p2-result');
      if (!slot || !defaults) return;

      // If atomics haven't loaded yet (first render race), retry briefly.
      attempt = attempt || 0;
      if (typeof window.renderAtomicForRole !== 'function') {
        if (attempt < 30) {
          setTimeout(function () { mountResolvedComponent(component, attempt + 1); }, 50);
        }
        return;
      }

      var role = component && component.role;
      var variant = (component && component.variant) || {};
      
      // Persistent Interaction: Check if same component role is already mounted
      var prevRole = slot.getAttribute('data-current-role');
      var isSameRole = (prevRole === role);
      
      // Look up dimensions based on role, falling back to 340x168
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
      var sz = sizes[role] || { w: 340, h: 168 };
      var contentH = computeP2ContentHeight(role, variant, sizes);

      var html = '';
      try {
        if (role !== 'composite-set') {
           html = wrapP2RevealStage(
             '<div style="width:' + sz.w + 'px; height:' + sz.h + 'px; position:relative; transform-origin:top left;">' +
               window.renderAtomicForRole({ role: role, variant: variant }, { w: sz.w, h: sz.h }) +
             '</div>',
             contentH
           );
        } else {
           html = wrapP2RevealStage(
             window.renderAtomicForRole({ role: role, variant: variant }, { w: sz.w, h: contentH }) || '',
             contentH
           );
        }
      } catch (e) {
        console.error('renderAtomicForRole failed:', e);
        html = '';
      }

      if (!html && role) {
        html = '<div class="dot-card" style="width:340px;height:168px;background:rgba(255,255,255,0.05);border-radius:32px;display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--font);font-weight:600;">' + role + '</div>';
      }

      if (html) {
        slot.setAttribute('data-current-role', role);

        if (isSameRole) {
          setP2AreaHeight(contentH);
          // INTERACTION: Same component stays, only content updates with a cross-fade
          var oldCard = slot.querySelector('.dot-card');
          if (oldCard) {
            oldCard.style.transition = 'opacity 0.25s ease';
            oldCard.style.opacity = '0.3';
            setTimeout(function() {
              slot.innerHTML = html;
              var newCard = slot.querySelector('.dot-card');
              if (newCard) {
                newCard.style.opacity = '0';
                void newCard.offsetWidth;
                newCard.style.transition = 'opacity 0.4s ease';
                newCard.style.opacity = '1';
              }
            }, 250);
          } else {
            slot.innerHTML = html;
          }
        } else {
          slot.innerHTML = html;
          prepareP2ContentSequence(slot);
          runP2RevealAnimation(slot, defaults, el, contentH);
        }
      } else {
        resetP2AreaHeight();
        slot.removeAttribute('data-current-role');
        if (el) el.classList.remove('has-swap');
        slot.innerHTML = '';
        slot.style.opacity = '0';
        slot.style.display = 'none';
        defaults.style.display = 'block';
        void defaults.offsetWidth;
        defaults.style.opacity = '1';
        defaults.style.pointerEvents = 'auto';
      }
    }

    async function setResultFromUtterance(utt) {
      var el = document.getElementById('p2-result');
      if (!el) return;
      var slot = document.getElementById('p2-slot');
      var defaults = document.getElementById('p2-default-widgets');
      var canvas = document.getElementById('canvas');
      var userText = String(utt || '').trim();
      if (!userText) return;
      var isTest2 = window.__mlpTestConfig && window.__mlpTestConfig.id === 'test2';

      if (isTest2) {
        var agentInput = document.querySelector('.p2-agent-input');
        if (agentInput) {
          agentInput.textContent = userText;
          agentInput.classList.add('p2-agent-input--glow');
        }
        var loadingSubEarly = el.querySelector('.p2-result-loading__sub');
        if (loadingSubEarly) loadingSubEarly.textContent = userText;
        if (canvas) canvas.classList.add('p2-generating');
        el.classList.add('is-loading');
        if (window.P2AgentFillGL) window.P2AgentFillGL.setPhase('generating');
        if (typeof window.syncTest2LoadingPresentation === 'function') {
          window.syncTest2LoadingPresentation(el);
        }
      }

      resetP2AreaHeight();
      clearP2DefaultRevealState();

      // Restore default widgets if a previous swap hid them
      if (defaults) {
        defaults.style.display = 'block';
        defaults.style.opacity = '1';
        defaults.style.pointerEvents = 'auto';
      }

      // Reset visual state so we never end up with an empty black card.
      el.classList.remove('has-swap', 'is-resolving');
      if (slot) {
        slot.style.transition = 'opacity 0.3s ease';
        slot.style.opacity = '0';
        slot.style.pointerEvents = 'none';
        slot.style.display = 'none';
        slot.style.clipPath = 'none';
        slot.classList.remove('p2-reveal-waiting', 'p2-reveal-swap', 'p2-reveal-visible', 'p2-seq-color', 'p2-seq-color-active', 'p2-seq-title', 'p2-seq-done');
        slot.style.removeProperty('--p2-reveal-h');
        setTimeout(function () { slot.innerHTML = ''; }, 300);
      }

      // Ensure loading overlay exists (handles hot-reload / older DOM)
      var loadingLayer = el.querySelector('.p2-result-loading');
      if (!loadingLayer) {
        loadingLayer = document.createElement('div');
        loadingLayer.className = 'p2-result-loading';
        loadingLayer.setAttribute('aria-hidden', 'true');
        loadingLayer.innerHTML =
          '<div class="p2-result-loading__bg"></div>' +
          '<div class="p2-result-loading__shimmer"></div>' +
          '<div class="p2-result-loading__content">' +
            '<div class="p2-result-loading__title">상황에 맞는 UI를<br>구성하는 중…</div>' +
            '<div class="p2-result-loading__sub"></div>' +
          '</div>';
        el.insertBefore(loadingLayer, el.firstChild);
      }

      // optimistic UI: show "thinking" state (crossfade overlay, keep base card intact)
      var loadingSub = el.querySelector('.p2-result-loading__sub');
      if (loadingSub) loadingSub.textContent = isTest2 ? userText : ('“' + userText.slice(0, 20) + '”');
      if (!isTest2) {
        el.classList.remove('is-loading');
        void el.offsetWidth;
        requestAnimationFrame(function () {
          el.classList.add('is-loading');
        });
        if (canvas) canvas.classList.add('p2-generating');
        if (window.P2AgentFillGL) window.P2AgentFillGL.setPhase('generating');
      } else if (typeof window.syncTest2LoadingPresentation === 'function') {
        window.syncTest2LoadingPresentation(el);
      }
      
      // Start generating animation for chord
      generating = true;
      if (!chordRaf) updateChordAnimation();

      try {
        var resolved = await resolveFromApi(userText);
        
        // Brief pause for dramatic "UI Reconstruction" effect
        await new Promise(function (resolve) {
          setTimeout(resolve, isTest2 ? 520 : 1500);
        });

        applyTheme(resolved && resolved.themeKey);
        // Weather-like requests can also shift the wallpaper mood.
        applyBackgroundMood(canvas, resolved && resolved.backgroundKey);
        
        if (resolved && resolved.component) {
          if (canvas) canvas.classList.remove('p2-generating');
          generating = false;
          if (window.P2AgentFillGL && !isTest2) {
            window.P2AgentFillGL.setPhase('settling');
          }

          // Staged reveal: keep loading card through expand, morph at phase 3
          mountResolvedComponent(resolved.component);
        }
      } catch (e) {
        console.error('setResultFromUtterance failed:', e);
        el.classList.remove('is-loading');
        if (canvas) canvas.classList.remove('p2-generating');
        generating = false;
        if (window.P2AgentFillGL) window.P2AgentFillGL.setPhase('idle');
      } finally {
        // No-op, handled above
      }
    }

    onReady(function () {
      var canvas = document.getElementById('canvas');
      if (!canvas) return;

      function bindP2FillGl() {
        if (window.P2AgentFillGL) window.P2AgentFillGL.ensureBound();
      }

      bindP2FillGl();
      if (typeof MutationObserver !== 'undefined') {
        var mo = new MutationObserver(function () {
          bindP2FillGl();
        });
        mo.observe(canvas, { childList: true, subtree: true });
      } else {
        var bindAttempts = 0;
        var bindTimer = setInterval(function () {
          bindP2FillGl();
          bindAttempts += 1;
          if (bindAttempts > 40) clearInterval(bindTimer);
        }, 250);
      }

      var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      var rec = null;

      function stopListening() {
        listening = false;
        audioInitId++;
        canvas.classList.remove('p2-listening');
        try { rec && rec.stop && rec.stop(); } catch (e) {}
        
        // Clean up audio analysis (also cancels in-flight init after getUserMedia resolves)
        cleanupAudioAnalysis();
      }

      function startListening() {
        console.log('startListening called');
        if (listening) return;
        listening = true;
        canvas.classList.add('p2-listening');
        chordTime = 0;
        formationLerp = 0;
        currentVolume = 0;

        if (window.P2AgentFillGL) {
          window.P2AgentFillGL.ensureBound();
          window.P2AgentFillGL.setPhase('listening');
        }
        
        initAudioAnalysis(); // Start tracking volume
        updateChordAnimation();

        if (Recognition) {
          console.log('Using SpeechRecognition');
          try {
            rec = new Recognition();
            rec.lang = 'ko-KR';
            rec.interimResults = true;
            rec.maxAlternatives = 1;
            rec.continuous = false;

            var finalText = '';

            rec.onstart = function() { console.log('SpeechRecognition started'); };
            rec.onresult = function (ev) {
              var txt = '';
              for (var i = ev.resultIndex; i < ev.results.length; i++) {
                var r = ev.results[i];
                if (r && r[0] && r[0].transcript) txt += r[0].transcript;
                if (r.isFinal) finalText = txt;
              }
              console.log('SpeechRecognition result:', txt);
            };

            rec.onerror = function (ev) {
              console.error('SpeechRecognition error:', ev.error);
              stopListening();
              // fallback: prompt for demo on blocked mic permission
              var p = window.prompt('음성 대신 텍스트로 입력해 주세요');
              setResultFromUtterance(p);
            };

            rec.onend = function () {
              console.log('SpeechRecognition ended');
              // If end happens without any final result, prompt fallback.
              var utt = finalText;
              stopListening();
              if (!utt) {
                utt = window.prompt('말씀하실 내용을 입력해 주세요');
              }
              setResultFromUtterance(utt);
            };

            rec.start();
          } catch (e) {
            console.error('SpeechRecognition start failed:', e);
            stopListening();
            var p2 = window.prompt('음성 대신 텍스트로 입력해 주세요');
            setResultFromUtterance(p2);
          }
        } else {
          console.log('SpeechRecognition not supported, using prompt');
          // No SpeechRecognition (or unsupported browser) — demo via prompt.
          var p3 = window.prompt('음성 인식 미지원: 텍스트로 입력해 주세요');
          stopListening();
          setResultFromUtterance(p3);
        }
      }

      // Delegated: these nodes mount after generateSurfaceScenario()
      document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t) return;
        var star = t.closest && t.closest('#p2-star');
        var arrow = t.closest && t.closest('#p2-arrow');
        if (!star && !arrow) return;
        startListening();
      }, true);

      // ESC to cancel listening quickly
      document.addEventListener('keydown', function (e) {
        if (e && e.key === 'Escape') stopListening();
      }, true);

      // Expose globally for React access
      window.startP2VoiceInput = startListening;
    });
  })();

  // -------------------------------------------------------------------------
  // Persona 1: live-ish micro updates until reload
  //  1) Total steps slowly increases
  //  2) Music progress bar advances like playing
  //  3) Time-matrix occasionally swaps to an orange running-dot motion
  //  4) Jogging time increases
  // Scope: prototype-only DOM updates (no data persistence).
  // -------------------------------------------------------------------------
  (function _persona1LiveTicks() {
    function onReady(fn) {
      if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
      else document.addEventListener('DOMContentLoaded', fn, { once: true });
    }

    function qs(sel, root) { return (root || document).querySelector(sel); }
    function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function parseIntLoose(s) {
      var n = parseInt(String(s || '').replace(/[^\d]/g, ''), 10);
      return isNaN(n) ? 0 : n;
    }
    function formatComma(n) {
      try { return Number(n).toLocaleString('en-US'); } catch (e) { return String(n); }
    }
    function parseTimeToSec(str) {
      var s = String(str || '').trim();
      var neg = false;
      if (s[0] === '-') { neg = true; s = s.slice(1); }
      var parts = s.split(':').map(function (p) { return parseInt(p, 10); });
      if (!parts.length || parts.some(function (x) { return isNaN(x); })) return null;
      var sec = 0;
      if (parts.length === 2) sec = parts[0] * 60 + parts[1];
      else if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else return null;
      return neg ? -sec : sec;
    }
    function formatSecToMSS(sec) {
      sec = Math.max(0, Math.floor(sec));
      var m = Math.floor(sec / 60);
      var s = sec % 60;
      return m + ':' + (s < 10 ? '0' + s : String(s));
    }

    function ensureRunOverlay(timematEl) {
      if (!timematEl) return null;
      var existing = qs('.p1-timemat-run-overlay', timematEl);
      if (existing) return existing;

      // Build a lightweight runner+trail overlay. Uses existing .dot-run2-frame
      // keyframes from theme-page.css.
      var overlay = document.createElement('div');
      overlay.className = 'p1-timemat-run-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML =
        '<div class="p1-timemat-run-row">' +
          '<svg class="p1-runner" width="28" height="36" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<g class="dot-run2-frame dot-run2-frame--a">' +
              '<circle cx="14" cy="4" r="1.8" fill="#FF7F24"/><circle cx="17" cy="4" r="1.8" fill="#FF7F24"/><circle cx="14" cy="7" r="1.8" fill="#FF7F24"/><circle cx="17" cy="7" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="11" cy="10" r="1.8" fill="#FF7F24"/><circle cx="14" cy="10" r="1.8" fill="#FF7F24"/><circle cx="11" cy="13" r="1.8" fill="#FF7F24"/><circle cx="14" cy="13" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="11" cy="16" r="1.8" fill="#FF7F24"/><circle cx="14" cy="16" r="1.8" fill="#FF7F24"/><circle cx="11" cy="19" r="1.8" fill="#FF7F24"/><circle cx="14" cy="19" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="17" cy="10" r="1.8" fill="#FF7F24"/><circle cx="20" cy="13" r="1.8" fill="#FF7F24"/><circle cx="23" cy="13" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="8" cy="10" r="1.8" fill="#FF7F24"/><circle cx="5" cy="13" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="11" cy="22" r="1.8" fill="#FF7F24"/><circle cx="8" cy="25" r="1.8" fill="#FF7F24"/><circle cx="5" cy="25" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="14" cy="22" r="1.8" fill="#FF7F24"/><circle cx="17" cy="25" r="1.8" fill="#FF7F24"/><circle cx="20" cy="28" r="1.8" fill="#FF7F24"/>' +
            '</g>' +
            '<g class="dot-run2-frame dot-run2-frame--b">' +
              '<circle cx="14" cy="4" r="1.8" fill="#FF7F24"/><circle cx="17" cy="4" r="1.8" fill="#FF7F24"/><circle cx="14" cy="7" r="1.8" fill="#FF7F24"/><circle cx="17" cy="7" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="11" cy="10" r="1.8" fill="#FF7F24"/><circle cx="14" cy="10" r="1.8" fill="#FF7F24"/><circle cx="11" cy="13" r="1.8" fill="#FF7F24"/><circle cx="14" cy="13" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="11" cy="16" r="1.8" fill="#FF7F24"/><circle cx="14" cy="16" r="1.8" fill="#FF7F24"/><circle cx="11" cy="19" r="1.8" fill="#FF7F24"/><circle cx="14" cy="19" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="17" cy="10" r="1.8" fill="#FF7F24"/><circle cx="19" cy="12" r="1.8" fill="#FF7F24"/><circle cx="21" cy="12" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="8" cy="10" r="1.8" fill="#FF7F24"/><circle cx="10" cy="12" r="1.8" fill="#FF7F24"/><circle cx="12" cy="12" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="11" cy="22" r="1.8" fill="#FF7F24"/><circle cx="14" cy="25" r="1.8" fill="#FF7F24"/><circle cx="17" cy="28" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="14" cy="22" r="1.8" fill="#FF7F24"/><circle cx="16" cy="24" r="1.8" fill="#FF7F24"/><circle cx="18" cy="26" r="1.8" fill="#FF7F24"/>' +
            '</g>' +
            '<g class="dot-run2-frame dot-run2-frame--c">' +
              '<circle cx="14" cy="4" r="1.8" fill="#FF7F24"/><circle cx="17" cy="4" r="1.8" fill="#FF7F24"/><circle cx="14" cy="7" r="1.8" fill="#FF7F24"/><circle cx="17" cy="7" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="11" cy="10" r="1.8" fill="#FF7F24"/><circle cx="14" cy="10" r="1.8" fill="#FF7F24"/><circle cx="11" cy="13" r="1.8" fill="#FF7F24"/><circle cx="14" cy="13" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="11" cy="16" r="1.8" fill="#FF7F24"/><circle cx="14" cy="16" r="1.8" fill="#FF7F24"/><circle cx="11" cy="19" r="1.8" fill="#FF7F24"/><circle cx="14" cy="19" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="17" cy="10" r="1.8" fill="#FF7F24"/><circle cx="20" cy="12" r="1.8" fill="#FF7F24"/><circle cx="22" cy="12" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="8" cy="10" r="1.8" fill="#FF7F24"/><circle cx="6" cy="12" r="1.8" fill="#FF7F24"/><circle cx="4" cy="12" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="11" cy="22" r="1.8" fill="#FF7F24"/><circle cx="13" cy="25" r="1.8" fill="#FF7F24"/><circle cx="15" cy="28" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="14" cy="22" r="1.8" fill="#FF7F24"/><circle cx="12" cy="25" r="1.8" fill="#FF7F24"/><circle cx="10" cy="28" r="1.8" fill="#FF7F24"/>' +
            '</g>' +
            '<g class="dot-run2-frame dot-run2-frame--d">' +
              '<circle cx="14" cy="4" r="1.8" fill="#FF7F24"/><circle cx="17" cy="4" r="1.8" fill="#FF7F24"/><circle cx="14" cy="7" r="1.8" fill="#FF7F24"/><circle cx="17" cy="7" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="11" cy="10" r="1.8" fill="#FF7F24"/><circle cx="14" cy="10" r="1.8" fill="#FF7F24"/><circle cx="11" cy="13" r="1.8" fill="#FF7F24"/><circle cx="14" cy="13" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="11" cy="16" r="1.8" fill="#FF7F24"/><circle cx="14" cy="16" r="1.8" fill="#FF7F24"/><circle cx="11" cy="19" r="1.8" fill="#FF7F24"/><circle cx="14" cy="19" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="17" cy="10" r="1.8" fill="#FF7F24"/><circle cx="20" cy="13" r="1.8" fill="#FF7F24"/><circle cx="23" cy="13" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="8" cy="10" r="1.8" fill="#FF7F24"/><circle cx="7" cy="12" r="1.8" fill="#FF7F24"/><circle cx="6" cy="14" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="11" cy="22" r="1.8" fill="#FF7F24"/><circle cx="9" cy="25" r="1.8" fill="#FF7F24"/><circle cx="7" cy="27" r="1.8" fill="#FF7F24"/>' +
              '<circle cx="14" cy="22" r="1.8" fill="#FF7F24"/><circle cx="17" cy="25" r="1.8" fill="#FF7F24"/><circle cx="20" cy="28" r="1.8" fill="#FF7F24"/>' +
            '</g>' +
          '</svg>' +
          '<div class="p1-runtrail" aria-hidden="true">' +
            '<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>' +
          '</div>' +
        '</div>';

      timematEl.appendChild(overlay);
      return overlay;
    }

    function ensureWeatherOverlay(timematEl) {
      if (!timematEl) return null;
      var existing = qs('.p1-timemat-weather-overlay', timematEl);
      if (existing) return existing;
      var overlay = document.createElement('div');
      overlay.className = 'p1-timemat-weather-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      // Weather card (existing atomic) — sized as 2x1 pill for readability.
      overlay.innerHTML =
        (window.renderAtomicForRole
          ? window.renderAtomicForRole(
              { role: 'dot-weather-2x1-v1-1', variant: { location: 'Seoul', weather: 'Sunny', theme: 'light' } },
              { w: 168, h: 82 }
            )
          : '');
      timematEl.appendChild(overlay);
      return overlay;
    }

    function sparkSomeDots(timematEl) {
      if (!timematEl) return;
      var svg = qs('svg', timematEl);
      if (!svg) return;
      var dots = qsa('.dot-timemat__dot', svg);
      if (!dots.length) return;
      // Pick a small handful per burst.
      var count = 8;
      for (var i = 0; i < count; i++) {
        var d = dots[Math.floor(Math.random() * dots.length)];
        if (!d) continue;
        d.classList.remove('p1-spark-dot');
        // restart animation
        // eslint-disable-next-line no-unused-expressions
        d.offsetWidth;
        d.classList.add('p1-spark-dot');
        (function (el) {
          setTimeout(function () { try { el.classList.remove('p1-spark-dot'); } catch (e) {} }, 620);
        })(d);
      }
    }

    onReady(function () {
      var canvas = document.getElementById('canvas');
      if (!canvas) return;

      var running = false;
      var timers = { steps: null, jog: null, music: null, runFlip: null, runFlipDelay: null, modeLoop: null, retry: null };

      function clearTimers() {
        Object.keys(timers).forEach(function (k) {
          if (timers[k]) { clearInterval(timers[k]); clearTimeout(timers[k]); }
          timers[k] = null;
        });
      }

      function startIfReady() {
        var stepsWrap = document.getElementById('p1-steps');
        var jogWrap   = document.getElementById('p1-run');
        var musicWrap = document.getElementById('p1-music');
        var timeWrap  = document.getElementById('p1-timemat');

        if (!stepsWrap || !jogWrap || !musicWrap || !timeWrap) return false;
        if (running) return true;

        running = true;

        // 1) Total steps
        var stepsEl = qs('.dot-steps21__count', stepsWrap) || qs('.dot-steps21__count', document);
        var steps = parseIntLoose(stepsEl && stepsEl.textContent);
        timers.steps = setInterval(function () {
          // small random walk upward
          steps += 1 + Math.floor(Math.random() * 3);
          if (stepsEl) stepsEl.textContent = formatComma(steps);
        }, 1100);

        // 4) Jogging time
        var jogTimeEl = qs('.dot-running2__time', jogWrap);
        var jogSec = parseTimeToSec(jogTimeEl && jogTimeEl.textContent);
        if (jogSec == null) jogSec = 10 * 60 + 35;
        timers.jog = setInterval(function () {
          jogSec += 1;
          if (jogTimeEl) jogTimeEl.textContent = formatSecToMSS(jogSec);
        }, 1000);

        // 2) Music progress
        var bar = qs('.dot-music__bar', musicWrap);
        var curEl = qs('.dot-music__time--current', musicWrap);
        var remEl = qs('.dot-music__time--remaining', musicWrap);
        var curSec = parseTimeToSec(curEl && curEl.textContent);
        var remSec = parseTimeToSec(remEl && remEl.textContent);
        if (curSec == null) curSec = 40;
        if (remSec == null) remSec = -70;
        var dur = Math.max(20, curSec + Math.abs(remSec));
        var barW = 120;
        try {
          var cs = window.getComputedStyle(bar);
          var bw = cs && cs.getPropertyValue('--bar-w');
          if (bw) barW = parseFloat(String(bw).replace('px','')) || barW;
        } catch (e) {}
        var tickMs = 500;
        timers.music = setInterval(function () {
          curSec += tickMs / 1000;
          if (curSec > dur) curSec = 0;
          var progress = Math.max(0, Math.min(1, curSec / dur));
          var px = Math.max(0, Math.min(barW, progress * barW));
          if (bar) bar.style.setProperty('--bar-track', px.toFixed(2) + 'px');
          if (curEl) curEl.textContent = formatSecToMSS(curSec);
          if (remEl) remEl.textContent = '-' + formatSecToMSS(Math.max(0, dur - curSec));
        }, tickMs);

        // 3) Time-matrix occasional running overlay
        var overlay = ensureRunOverlay(timeWrap);
        var wOverlay = ensureWeatherOverlay(timeWrap);

        function showRun() {
          if (!overlay) return;
          timeWrap.classList.add('p1-run-mode');
          overlay.classList.add('is-on');
          setTimeout(function () {
            overlay.classList.remove('is-on');
            timeWrap.classList.remove('p1-run-mode');
          }, 1600);
        }

        function showWeather() {
          if (!wOverlay) return;
          timeWrap.classList.add('p1-weather-mode');
          wOverlay.classList.add('is-on');
          setTimeout(function () {
            wOverlay.classList.remove('is-on');
            timeWrap.classList.remove('p1-weather-mode');
          }, 1800);
        }

        function showSparkBurst() {
          sparkSomeDots(timeWrap);
        }

        // Mode loop: TIME → SPARK → WEATHER → SPARK → RUN (repeat)
        var phase = 0;
        function step() {
          // 0 time (idle), 1 spark, 2 weather, 3 spark, 4 run
          if (phase === 1 || phase === 3) showSparkBurst();
          if (phase === 2) showWeather();
          if (phase === 4) showRun();
          phase = (phase + 1) % 5;
        }

        // initial kick + loop
        timers.runFlipDelay = setTimeout(function () {
          step();
          timers.modeLoop = setInterval(step, 4500);
        }, 2200);

        return true;
      }

      function stopIfGone() {
        var stepsWrap = document.getElementById('p1-steps');
        if (stepsWrap) return;
        if (!running) return;
        running = false;
        clearTimers();
      }

      // Observe canvas updates when switching personas/scenarios.
      var mo = new MutationObserver(function () {
        if (!running) startIfReady();
        else stopIfGone();
      });
      try { mo.observe(canvas, { childList: true, subtree: true }); } catch (e) {}

      // also try once at boot
      startIfReady();
    });
  })();

  // -------------------------------------------------------------------------
  // Persona 3 interactions: press feedback + simple state toggles
  // - Tap ingredient rows to toggle "done" look (local only)
  // - Tap CTA to show a short "connecting…" state
  // -------------------------------------------------------------------------
  (function _persona3CookingInteractions() {
    function onReady(fn) {
      if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
      else document.addEventListener('DOMContentLoaded', fn, { once: true });
    }

    onReady(function () {
      var canvas = document.getElementById('canvas');
      if (!canvas) return;

      var ctaLock = false;
      var agentTimer = null;

      function showAgentCard() {
        var card = document.querySelector('[data-role="cooking-agent-card"]');
        if (card) {
          card.style.top = '600px'; // Move up to visible area (higher to avoid bottom clipping)
          card.classList.add('p3-agent-card-active');
        }
      }

      function checkScenario() {
        if (canvas.getAttribute('data-scenario') === 'health-mlp') {
          // Initial state: hide recipe, send btn, ingredients. Show yes/no
          var recipe = document.getElementById('p3-recipe');
          var sendBtn = document.getElementById('p3-send');
          var yesNoBtn = document.getElementById('p3-yes-no');
          var ingredients = document.getElementById('p3-ingredients-wrapper');
          var card1 = document.querySelector('[data-role="cooking-agent-card"]');
          var card2 = document.querySelector('[data-role="cooking-agent-card-2"]');
          
          if (recipe) recipe.style.display = 'none';
          if (sendBtn) sendBtn.style.display = 'none';
          if (yesNoBtn) {
            yesNoBtn.style.display = 'block';
            yesNoBtn.style.opacity = '1';
            yesNoBtn.style.pointerEvents = 'auto';
          }
          if (ingredients) ingredients.style.display = 'none';
          if (card1) {
            card1.classList.remove('p3-agent-card-active', 'is-stacked');
            card1.style.top = '880px';
          }
          if (card2) {
            card2.classList.remove('p3-agent-card-active-2');
            card2.style.top = '880px';
          }
          
          // Reset ingredient rows
          var rows = document.querySelectorAll('.p3-ing-row');
          rows.forEach(function(r) { 
            r.classList.remove('is-done'); 
            if (r.dataset.title === '생연어 필렛' || r.dataset.title === '아스파라거스') {
              r.classList.add('will-be-checked');
            } else {
              r.classList.remove('will-be-checked');
            }
          });
        } else {
          var card1 = document.querySelector('[data-role="cooking-agent-card"]');
          var card2 = document.querySelector('[data-role="cooking-agent-card-2"]');
          if (card1) card1.classList.remove('p3-agent-card-active', 'is-stacked');
          if (card2) card2.classList.remove('p3-agent-card-active-2');
        }
      }

      // Observe scenario changes and child additions
      var mo = new MutationObserver(checkScenario);
      mo.observe(canvas, { attributes: true, attributeFilter: ['data-scenario'], childList: true });
      checkScenario();

      document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t) return;

        // Yes/No Buttons
        var yesNoBtn = t.closest && t.closest('.p3-yes-no-action');
        if (yesNoBtn && canvas.contains(yesNoBtn)) {
          var action = yesNoBtn.getAttribute('data-action');
          if (action === 'yes') {
            // visual feedback
            yesNoBtn.style.opacity = '0.5';
            setTimeout(function() {
              var container = document.getElementById('p3-yes-no');
              if (container) {
                container.style.opacity = '0';
                container.style.pointerEvents = 'none';
                setTimeout(function() {
                  container.style.display = 'none';
                }, 300);
              }
              
              var recipe = document.getElementById('p3-recipe');
              var sendBtn = document.getElementById('p3-send');
              
              if (recipe) {
                recipe.style.display = 'block';
                recipe.style.animation = 'none';
                void recipe.offsetWidth; // trigger reflow
                recipe.style.animation = 'p3CardSlideDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards';
              }
              if (sendBtn) {
                sendBtn.style.display = 'block';
                sendBtn.style.animation = 'none';
                void sendBtn.offsetWidth; // trigger reflow
                sendBtn.style.animation = 'p3CardSlideDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards';
              }
            }, 200);
          }
        }

        // Ingredient row toggle
        var row = t.closest && t.closest('.p3-ing-row');
        if (row && canvas.contains(row)) {
          row.classList.toggle('is-done');
          return;
        }

        // CTA loading state
        var send = t.closest && t.closest('#p3-send');
        if (send && canvas.contains(send)) {
          if (ctaLock) return;
          ctaLock = true;
          send.classList.add('is-loading');
          var label = send.querySelector('div');
          var prev = label ? label.textContent : '';
          if (label) label.textContent = '연동 중…';
          
          // Trigger ingredients appearance
          var ingredients = document.getElementById('p3-ingredients-wrapper');
          if (ingredients) {
            ingredients.style.display = 'flex';
            var rows = ingredients.querySelectorAll('.p3-ing-row');
            
            // Set initial state for rows
            rows.forEach(function(r) {
              r.style.opacity = '0';
              r.style.transform = 'translateY(15px)';
              r.classList.remove('is-done');
            });
            
            // Trigger staggered animation
            var delay = 100; // wait a bit before starting
            rows.forEach(function(r, i) {
              setTimeout(function() {
                r.style.opacity = '1';
                r.style.transform = 'translateY(0)';
                
                // Add checked class if it should be checked
                if (r.classList.contains('will-be-checked')) {
                  setTimeout(function() {
                    r.classList.add('is-done');
                  }, 250); // Check shortly after appearing
                }
              }, delay + i * 200); // staggered by 200ms
            });
            
            // Show secondary agent card for un-checked items shortly after list appears
            setTimeout(function() {
              var card1 = document.querySelector('[data-role="cooking-agent-card"]');
              var card2 = document.querySelector('[data-role="cooking-agent-card-2"]');
              if (card1 && card2) {
                card1.style.top = '660px'; // Existing card
                card1.classList.add('p3-agent-card-active'); // Show first card
                
                // Delay then show second card stacked
                setTimeout(function() {
                  card1.style.animation = 'none'; // stop original pop
                  card1.classList.add('is-stacked'); // push up and blur
                  card2.style.top = '600px';
                  card2.classList.add('p3-agent-card-active-2');
                }, 1000);
              }
            }, delay + (rows.length * 200) + 400); // Wait until all rows appeared
          }

          setTimeout(function () {
            if (label) label.textContent = prev || '인덕션 연동 및 조리 시작';
            send.classList.remove('is-loading');
            ctaLock = false;
          }, 2400);
        }
        
        // Agent Action Button (e.g. Yes to buy ingredients)
        var actionBtn = t.closest && t.closest('.p3-agent-action-btn-yes');
        if (actionBtn && canvas.contains(actionBtn)) {
          var originalText = actionBtn.textContent;
          actionBtn.textContent = '장바구니에 담았어요';
          actionBtn.style.background = '#B7E46A';
          actionBtn.style.color = '#1A1D1C';
          actionBtn.style.pointerEvents = 'none';
          
          // Now mark the un-checked ingredients as done to simulate purchase/prep
          setTimeout(function() {
            var rows = document.querySelectorAll('.p3-ing-row:not(.will-be-checked)');
            rows.forEach(function(r) {
              r.classList.add('is-done');
            });
            
            // Dismiss agent cards after action
            setTimeout(function() {
              var card1 = document.querySelector('[data-role="cooking-agent-card"]');
              var card2 = document.querySelector('[data-role="cooking-agent-card-2"]');
              if (card1) {
                card1.classList.remove('p3-agent-card-active', 'is-stacked');
              }
              if (card2) {
                card2.classList.remove('p3-agent-card-active-2');
              }
            }, 1200);
          }, 400);
        }
      }, true);
    });
  })();
