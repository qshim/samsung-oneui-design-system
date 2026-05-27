(function () {
  'use strict';

  var VERT_SRC = [
    'attribute vec2 a_pos;',
    'varying vec2 v_uv;',
    'void main() {',
    '  v_uv = a_pos * 0.5 + 0.5;',
    '  gl_Position = vec4(a_pos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG_SRC = [
    'precision mediump float;',
    'varying vec2 v_uv;',
    'uniform vec2 u_origin;',
    'uniform float u_aspect;',
    'uniform float u_radius;',
    'uniform float u_time;',
    'uniform float u_spread;',
    'uniform float u_intensity;',
    'uniform float u_fill;',
    'uniform float u_audio;',
    '',
    'float hash(vec2 p) {',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
    '}',
    '',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(',
    '    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),',
    '    u.y',
    '  );',
    '}',
    '',
    'float fbm(vec2 p) {',
    '  float v = 0.0;',
    '  float a = 0.5;',
    '  for (int i = 0; i < 4; i++) {',
    '    v += a * noise(p);',
    '    p = p * 2.02 + vec2(1.7, 2.3);',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',
    '',
    'float sdRoundedBox(vec2 p, vec2 halfSize, float radius) {',
    '  vec2 q = abs(p) - halfSize + radius;',
    '  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;',
    '}',
    '',
    'vec2 toPlane(vec2 uv) {',
    '  vec2 p = uv - 0.5;',
    '  p.x *= u_aspect;',
    '  return p;',
    '}',
    '',
    'float organicReveal(vec2 uv, vec2 rel, float sdf, float spread, float time, float audio) {',
    '  float s = clamp(spread, 0.0, 1.45);',
    '  if (s < 0.001) return 0.0;',
    '  float onset = smoothstep(0.0, 0.09, s);',
    '  float early = (1.0 - smoothstep(0.0, 0.58, s)) * onset;',
    '  vec2 target = vec2(0.05, 0.95);',
    '  vec2 diag = vec2((target.x - u_origin.x) * u_aspect, target.y - u_origin.y);',
    '  vec2 diagN = diag / max(length(diag), 0.0001);',
    '  vec2 ellRel = rel * vec2(0.72, 1.0);',
    '  float dist = length(ellRel);',
    '  float align = max(0.0, dot(normalize(rel + vec2(0.001)), diagN));',
    '  dist *= 1.0 - align * 0.10;',
    '  float depthIn = clamp(-sdf / max(u_radius * 2.4, 0.08), 0.0, 1.0);',
    '  float edgeProx = 1.0 - smoothstep(0.0, 0.26, depthIn);',
    '  float wobble = (fbm(uv * 2.4 + time * 0.026) - 0.5)',
    '    * (0.092 + early * 0.11) * max(s, 0.06);',
    '  float ripple = sin(time * 1.18 + atan(rel.y, rel.x + 0.0001) * 5.0',
    '    + fbm(rel * 3.6 + time * 0.055) * 3.0) * 0.038 * max(early, 0.28);',
    '  float edgeShimmer = (fbm(uv * 4.2 + time * 0.09) - 0.5) * 0.042 * max(s, 0.12);',
    '  dist += ripple + wobble * 0.52 + edgeShimmer;',
    '  float revealAt = s * 1.24 + early * 0.14;',
    '  float edgeBoost = edgeProx * (0.38 + early * 0.20);',
    '  float centerLag = depthIn * 0.20 * (1.0 - smoothstep(0.44, 1.08, s));',
    '  float localFront = revealAt + edgeBoost - centerLag;',
    '  float softLead = max(0.34, 0.46 * s + early * 0.28 + audio * 0.024);',
    '  float softTrail = softLead * 1.55;',
    '  float revealCore = 1.0 - smoothstep(',
    '    localFront - softLead * 0.72 + wobble,',
    '    localFront + softTrail * 0.78 + wobble,',
    '    dist',
    '  );',
    '  float revealWide = 1.0 - smoothstep(',
    '    localFront - softLead * 1.45 + wobble * 0.8,',
    '    localFront + softTrail * 1.65 + wobble * 0.8,',
    '    dist',
    '  );',
    '  float reveal = max(revealCore, revealWide * 0.38);',
    '  vec2 pulseRel = rel + vec2(',
    '    sin(time * 0.78) * 0.014,',
    '    cos(time * 0.62) * 0.012',
    '  ) * early;',
    '  float rel2 = dot(pulseRel, pulseRel);',
    '  float pulseDist = length(pulseRel * vec2(0.72, 1.0));',
    '  float originCore = exp(-rel2 * 2.4) * (1.0 + early * 0.22);',
    '  float originHalo = exp(-rel2 * 1.0) * (0.68 + early * 0.34);',
    '  float originWide = exp(-pulseDist * 1.25) * (0.42 + early * 0.38);',
    '  float originMist = exp(-pulseDist * 0.72) * early * 0.52;',
    '  float originPulse = (originCore + originHalo + originWide + originMist)',
    '    * (1.0 - smoothstep(0.18, 0.82, s)) * onset;',
    '  float travelMist = exp(-max(dist - localFront * 0.35, 0.0) * 2.4) * s * 0.28 * onset;',
    '  reveal *= mix(0.12, 1.0, onset);',
    '  return clamp(max(reveal, max(originPulse, travelMist)), 0.0, 1.0);',
    '}',
    '',
    'vec3 meshWarmGradient(vec2 uv, float time, float audio) {',
    '  float warpAmt = 0.018 + audio * 0.008;',
    '  vec2 warp = vec2(',
    '    fbm(uv * 1.8 + time * 0.045) - 0.5,',
    '    fbm(uv * 1.8 + vec2(17.3, 9.1) + time * 0.04) - 0.5',
    '  ) * warpAmt;',
    '  vec2 u = uv + warp;',
    '',
    '  vec2 a1 = u_origin + vec2(sin(time * 0.22) * 0.018, cos(time * 0.19) * 0.015);',
    '  vec2 a2 = u_origin + vec2(-0.14, 0.10) + vec2(cos(time * 0.16) * 0.020, sin(time * 0.15) * 0.018);',
    '  vec2 a3 = u_origin + vec2(-0.26, 0.20) + vec2(sin(time * 0.14) * 0.022, cos(time * 0.17) * 0.020);',
    '  vec2 a4 = u_origin + vec2(-0.38, 0.30) + vec2(cos(time * 0.18) * 0.018, sin(time * 0.16) * 0.016);',
    '  vec2 a5 = u_origin + vec2(-0.48, 0.38) + vec2(sin(time * 0.15) * 0.016, cos(time * 0.14) * 0.014);',
    '',
    '  vec3 orange = vec3(1.0, 0.498, 0.12);',
    '  vec3 amber = vec3(1.0, 0.650, 0.18);',
    '  vec3 gold = vec3(1.0, 0.820, 0.32);',
    '  vec3 cream = vec3(1.0, 0.930, 0.58);',
    '  vec3 pale = vec3(1.0, 0.980, 0.780);',
    '',
    '  float falloff = 1.38;',
    '  float w1 = 1.0 / (pow(length(u - a1), falloff) + 0.078);',
    '  float w2 = 1.0 / (pow(length(u - a2), falloff) + 0.078);',
    '  float w3 = 1.0 / (pow(length(u - a3), falloff) + 0.078);',
    '  float w4 = 1.0 / (pow(length(u - a4), falloff) + 0.078);',
    '  float w5 = 1.0 / (pow(length(u - a5), falloff) + 0.078);',
    '  float wSum = w1 + w2 + w3 + w4 + w5;',
    '  vec3 col = (orange * w1 + pale * w2 + cream * w3 + gold * w4 + amber * w5) / wSum;',
    '  return col * 1.06;',
    '}',
    '',
    'float edgeRingHandoff(vec2 uv, vec2 p, float sdf, float aspect, float tightness, float time) {',
    '  float maxInward = mix(0.64, 0.28, clamp(tightness, 0.0, 1.0));',
    '  float inward = clamp(-sdf, 0.0, maxInward);',
    '  float edgeNorm = inward / maxInward;',
    '  float distFromEdge = abs(sdf);',
    '  float perimeter = exp(-distFromEdge * mix(18.0, 34.0, tightness));',
    '  float insideFalloff = 1.0 - smoothstep(mix(0.03, 0.02, tightness), mix(0.56, 0.34, tightness), edgeNorm);',
    '  float edgeBand = perimeter * insideFalloff;',
    '  float outerBleed = exp(-max(sdf, 0.0) * 42.0) * (1.0 - smoothstep(0.0, 0.022, max(-sdf, 0.0)));',
    '  edgeBand = max(edgeBand, outerBleed * mix(0.58, 0.72, tightness));',
    '  float softAura = exp(-edgeNorm * mix(1.8, 3.2, tightness)) * mix(0.22, 0.14, tightness);',
    '  float angle = atan(p.y, p.x * aspect + 0.0001);',
    '  float wave = sin(time * 0.88 + angle * 5.2 + fbm(uv * 3.2 + time * 0.07) * 4.2) * 0.5 + 0.5;',
    '  float ripple = sin(time * 1.12 + edgeNorm * 7.5 - angle * 2.8',
    '    + fbm(uv * 2.6 + time * 0.09) * 3.6) * 0.5 + 0.5;',
    '  float waver = 0.80 + wave * 0.12 + ripple * 0.08;',
    '  vec2 ap = abs(p);',
    '  vec2 hs = vec2(aspect * 0.5, 0.5);',
    '  float cornerDist = length(max(ap - hs * 0.68, 0.0));',
    '  float corner = exp(-cornerDist * mix(3.4, 5.2, tightness)) * mix(0.18, 0.12, tightness);',
    '  float interiorKill = 1.0 - smoothstep(mix(0.52, 0.38, tightness), 0.88, edgeNorm);',
    '  float ring = (edgeBand * waver * 0.76 + softAura * (0.86 + wave * 0.10)) * interiorKill;',
    '  corner *= interiorKill * (0.88 + wave * 0.12);',
    '  return clamp(ring + corner, 0.0, 1.0);',
    '}',
    '',
    'void main() {',
    '  vec2 uv = v_uv;',
    '  vec2 p = toPlane(uv);',
    '  vec2 halfSize = vec2(u_aspect * 0.5, 0.5);',
    '  float edgeBreath = (fbm(uv * 2.8 + u_time * 0.07) - 0.5)',
    '    * 0.012 * max(u_spread, 0.08);',
    '  float handoffT = clamp(u_fill, 0.0, 1.0);',
    '  float morph = 1.0 - pow(1.0 - handoffT, 2.6);',
    '  float edgeWobble = (fbm(uv * 2.5 + u_time * 0.05) - 0.5) * 0.010 * morph;',
    '  float sdf = sdRoundedBox(p, halfSize, u_radius) + edgeBreath + edgeWobble;',
    '  float morphEarly = smoothstep(0.02, 0.12, morph);',
    '  float shapeAlpha = mix(',
    '    1.0 - smoothstep(-0.012, 0.038, sdf),',
    '    1.0 - smoothstep(-0.036, 0.062, sdf),',
    '    morphEarly',
    '  );',
    '  if (shapeAlpha < 0.001) discard;',
    '',
    '  float depth = clamp(-sdf / 0.36, 0.0, 1.0);',
    '',
    '  vec2 rel = vec2((uv.x - u_origin.x) * u_aspect, uv.y - u_origin.y);',
    '',
    '  float reveal = organicReveal(uv, rel, sdf, u_spread, u_time, u_audio);',
    '',
    '  vec3 mesh = meshWarmGradient(uv, u_time, u_audio);',
    '  float tightness = smoothstep(0.38, 0.98, handoffT);',
    '  float colorLift = morph > 0.04',
    '    ? (1.0 + 0.016 * sin(u_time * 0.86 + fbm(uv * 2.6 + u_time * 0.05) * 4.8))',
    '    : (1.0 + 0.048 * sin(u_time * 1.12 + uv.x * 5.2 + uv.y * 3.8)',
    '      + 0.022 * sin(u_time * 0.72 + fbm(uv * 2.2 + u_time * 0.04) * 6.0));',
    '  vec3 color = mesh * colorLift;',
    '  float grain = (hash(floor(uv * 520.0) + floor(u_time * 6.0)) - 0.5) * 0.018;',
    '',
    '  float fillMask = clamp(reveal * u_intensity, 0.0, 1.0);',
    '  float edgeMask = edgeRingHandoff(uv, p, sdf, u_aspect, tightness, u_time);',
    '  float centerFill = fillMask * (1.0 - morph);',
    '  float edgeFill = edgeMask * u_intensity * morph * 0.84;',
    '  float combinedMask = max(centerFill, edgeFill);',
    '  color += mesh * edgeFill * 0.28;',
    '  color += grain * combinedMask;',
    '',
    '  float frontier = smoothstep(0.04, 0.42, combinedMask)',
    '    * (1.0 - smoothstep(0.42, 0.96, combinedMask));',
    '  vec3 liftedColor = color + color * frontier * 0.07;',
    '  float alpha = combinedMask * shapeAlpha;',
    '  if (alpha < 0.004) discard;',
    '  gl_FragColor = vec4(liftedColor * alpha, alpha);',
    '}'
  ].join('\n');

  var PHASES = {
    idle: { spread: 0.0, intensity: 0.0, fill: 0.0, duration: 850 },
    listening: { spread: 0.92, intensity: 1.0, fill: 0.0, duration: 7200 },
    generating: { spread: 1.42, intensity: 1.0, fill: 0.0, duration: 3200 },
    hollowReveal: { spread: 1.42, intensity: 0.86, fill: 0.74, duration: 520 },
    handoff: { spread: 1.42, intensity: 0.74, fill: 1.0, duration: 1100 },
    settling: { spread: 1.42, intensity: 0.20, fill: 1.0, duration: 240 },
    fadeOut: { spread: 1.42, intensity: 0.0, fill: 0.0, duration: 680 }
  };

  var TEST2_PHASE_CHAIN = {
    hollowReveal: 'settling',
    settling: 'fadeOut'
  };

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function easeOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutQuint(t) {
    return 1 - Math.pow(1 - t, 5);
  }

  function easeSmoothFill(t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInSoft(t) {
    return t * t * t;
  }

  function easeListenIntensity(t) {
    if (t < 0.11) return easeInSoft(t / 0.11) * 0.48;
    return 0.48 + (1.0 - 0.48) * easeOutQuint((t - 0.11) / 0.89);
  }

  function easeListeningSpread(t) {
    if (t < 0.11) return easeInSoft(t / 0.11) * 0.20;
    return 0.20 + easeSmoothFill((t - 0.11) / 0.89) * 0.80;
  }

  function easeContinueSpread(t, fromSpread) {
    if (fromSpread > 0.08) return easeSmoothFill(t);
    return easeListeningSpread(t);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function isTest2Scope() {
    var canvas = document.getElementById('canvas');
    if (canvas && canvas.getAttribute('data-test-scope') === 'test2') return true;
    return !!(window.__mlpTestConfig && window.__mlpTestConfig.id === 'test2');
  }

  function compileShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('[P2AgentFillGL] shader compile failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vertSrc, fragSrc) {
    var vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
    var fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[P2AgentFillGL] program link failed:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  function AgentFillGL() {
    this.canvas = null;
    this.fillEl = null;
    this.shellEl = null;
    this.gl = null;
    this.program = null;
    this.raf = null;
    this.running = false;
    this.ready = false;
    this.phase = 'idle';
    this.phaseStart = 0;
    this.phaseFrom = { spread: 0, intensity: 0, fill: 0 };
    this.phaseTo = { spread: 0, intensity: 0, fill: 0 };
    this.phaseDuration = 0;
    this.values = { spread: 0, intensity: 0, fill: 0 };
    this.audio = 0;
    this.smoothAudio = 0;
    this.startTime = 0;
    this.layout = { aspect: 1, radius: 0.24 };
    this._layoutCache = { w: 0, h: 0, aspect: 0 };
    this.resizeObserver = null;
    this.uniforms = {};
    this._onFrame = this._tick.bind(this);
  }

  AgentFillGL.prototype._updateLayout = function () {
    if (!this.shellEl) return;
    var rect = this.shellEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.layout.aspect = rect.width / rect.height;
    this.layout.radius = 36 / rect.height;
  };

  AgentFillGL.prototype._getOrigin = function () {
    if (!this.shellEl) return [0.92, 0.10];
    var shell = this.shellEl.getBoundingClientRect();
    if (!shell.width || !shell.height) return [0.92, 0.10];
    var star = document.getElementById('p2-star');
    if (!star) return [0.92, 0.10];
    var btn = star.getBoundingClientRect();
    var btnX = (btn.left + btn.width * 0.5 - shell.left) / shell.width;
    var btnY = 1 - (btn.top + btn.height * 0.5 - shell.top) / shell.height;
    var cornerX = clamp((shell.width - 8) / shell.width, 0, 1);
    var cornerY = clamp(8 / shell.height, 0, 1);
    return [
      clamp(btnX * 0.35 + cornerX * 0.65, 0, 1),
      clamp(btnY * 0.35 + cornerY * 0.65, 0, 1)
    ];
  };

  AgentFillGL.prototype._resize = function (force) {
    if (!this.canvas || !this.gl || !this.shellEl) return;
    var rect = this.shellEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    var aspect = rect.width / rect.height;
    var cache = this._layoutCache;
    var sizeChanged = force || cache.w !== w || cache.h !== h;
    if (sizeChanged) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.canvas.style.width = rect.width + 'px';
      this.canvas.style.height = rect.height + 'px';
      this.gl.viewport(0, 0, w, h);
      cache.w = w;
      cache.h = h;
    }
    if (sizeChanged || Math.abs(cache.aspect - aspect) > 0.002) {
      this.layout.aspect = aspect;
      this.layout.radius = 36 / rect.height;
      cache.aspect = aspect;
    }
  };

  AgentFillGL.prototype._setPhaseTargets = function (phaseName) {
    var next = PHASES[phaseName] || PHASES.idle;
    this.phase = phaseName;
    this.phaseStart = performance.now();
    this.phaseFrom = {
      spread: this.values.spread,
      intensity: this.values.intensity,
      fill: this.values.fill
    };
    this.phaseTo = {
      spread: next.spread,
      intensity: next.intensity,
      fill: next.fill
    };
    this.phaseDuration = next.duration;
    if (this.fillEl) {
      if (phaseName !== 'idle') {
        this.fillEl.classList.add('p2-agent-fill--gl-active');
        this.fillEl.classList.remove('p2-agent-fill--gl-fading');
      } else {
        this.fillEl.classList.remove('p2-agent-fill--gl-active');
        this.fillEl.classList.remove('p2-agent-fill--gl-fading');
      }
      if (phaseName === 'fadeOut') {
        this.fillEl.classList.remove('p2-agent-fill--gl-active');
        this.fillEl.classList.add('p2-agent-fill--gl-fading');
      }
    }
    if (this.shellEl) {
      if (
        phaseName === 'listening' || phaseName === 'generating' ||
        phaseName === 'hollowReveal' || phaseName === 'handoff' ||
        phaseName === 'settling' || phaseName === 'fadeOut'
      ) {
        this.shellEl.classList.add('p2-agent-shell--gl-fill');
      } else if (phaseName === 'idle') {
        this.shellEl.classList.remove('p2-agent-shell--gl-fill');
      }
    }
    if (phaseName === 'fadeOut' && isTest2Scope()) {
      try {
        document.dispatchEvent(new CustomEvent('p2-test2-fill-fadeout'));
      } catch (e) { /* noop */ }
    }
  };

  AgentFillGL.prototype.setPhase = function (phaseName) {
    if (!this.ready || prefersReducedMotion()) return;
    if (phaseName === 'listening') {
      this.values.spread = 0;
      this.values.intensity = 0;
      this.values.fill = 0;
      this.smoothAudio = 0;
    }
    this._setPhaseTargets(phaseName || 'idle');
    if (phaseName !== 'idle') this._startLoop();
    else this._stopLoop(true);
  };

  AgentFillGL.prototype.setAudio = function (value) {
    this.audio = clamp(Number(value) || 0, 0, 1);
  };

  AgentFillGL.prototype.waitForPhaseProgress = function (phaseName, minProgress, timeoutMs) {
    var self = this;
    minProgress = clamp(Number(minProgress) || 1, 0, 1);
    timeoutMs = Number(timeoutMs) || 4000;
    return new Promise(function (resolve) {
      if (!self.ready || prefersReducedMotion()) {
        resolve();
        return;
      }
      var start = performance.now();
      function tick() {
        if (performance.now() - start >= timeoutMs) {
          resolve();
          return;
        }
        if (phaseName === 'generating' && self.values.spread >= 1.22) {
          resolve();
          return;
        }
        var t = self.phaseDuration > 0
          ? clamp((performance.now() - self.phaseStart) / self.phaseDuration, 0, 1)
          : 1;
        if (self.phase === phaseName && t >= minProgress) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      }
      tick();
    });
  };

  AgentFillGL.prototype._updateValues = function (now) {
    var t = this.phaseDuration > 0
      ? clamp((now - this.phaseStart) / this.phaseDuration, 0, 1)
      : 1;
    var eased;
    if (this.phase === 'listening') {
      eased = easeListeningSpread(t);
    } else if (this.phase === 'generating') {
      eased = easeContinueSpread(t, this.phaseFrom.spread);
    } else if (this.phase === 'hollowReveal') {
      eased = easeOutQuint(t);
    } else if (this.phase === 'handoff') {
      eased = easeInOutCubic(t);
    } else if (this.phase === 'fadeOut') {
      eased = easeOutCubic(t);
    } else if (this.phase === 'settling') {
      eased = easeInOutCubic(t);
    } else {
      eased = easeOutExpo(t);
    }
    this.values.spread = lerp(this.phaseFrom.spread, this.phaseTo.spread, eased);
    this.values.intensity = lerp(
      this.phaseFrom.intensity,
      this.phaseTo.intensity,
      this.phase === 'listening' ? easeListenIntensity(t) : eased
    );
    this.values.fill = lerp(this.phaseFrom.fill, this.phaseTo.fill, eased);
    this._maybeAdvancePhase(t);
  };

  AgentFillGL.prototype._maybeAdvancePhase = function (t) {
    if (!isTest2Scope() || t < 0.999) return;
    if (this._phaseChainLock) return;
    var next = TEST2_PHASE_CHAIN[this.phase];
    if (!next) return;
    this._phaseChainLock = true;
    var self = this;
    requestAnimationFrame(function () {
      self._phaseChainLock = false;
      if (self.phase && TEST2_PHASE_CHAIN[self.phase] === next) {
        self._setPhaseTargets(next);
      }
    });
  };

  AgentFillGL.prototype._draw = function (now) {
    if (!this.gl || !this.program) return;
    var gl = this.gl;
    this._updateValues(now);
    this._resize();
    this.smoothAudio += (this.audio - this.smoothAudio) * (this.phase === 'listening' && this.values.spread < 0.18 ? 0.028 : 0.055);

    var origin = this._getOrigin();
    var elapsed = (now - this.startTime) * 0.001;

    gl.useProgram(this.program);
    gl.uniform2f(this.uniforms.origin, origin[0], origin[1]);
    gl.uniform1f(this.uniforms.aspect, this.layout.aspect);
    gl.uniform1f(this.uniforms.radius, this.layout.radius);
    gl.uniform1f(this.uniforms.time, elapsed);
    gl.uniform1f(this.uniforms.spread, this.values.spread);
    gl.uniform1f(this.uniforms.intensity, this.values.intensity);
    gl.uniform1f(this.uniforms.fill, this.values.fill);
    gl.uniform1f(this.uniforms.audio, this.smoothAudio);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (this.phase === 'idle' && this.phaseDuration > 0 && now - this.phaseStart >= this.phaseDuration) {
      this._stopLoop(true);
    }
    if (this.phase === 'fadeOut' && now - this.phaseStart >= this.phaseDuration) {
      this.phase = 'idle';
      if (this.fillEl) {
        this.fillEl.classList.remove('p2-agent-fill--gl-active');
        this.fillEl.classList.remove('p2-agent-fill--gl-fading');
      }
      if (this.shellEl) this.shellEl.classList.remove('p2-agent-shell--gl-fill');
      this._stopLoop(true);
    }
  };

  AgentFillGL.prototype._tick = function (now) {
    if (!this.running) return;
    this._draw(now);
    this.raf = requestAnimationFrame(this._onFrame);
  };

  AgentFillGL.prototype._startLoop = function () {
    if (this.running) return;
    this.running = true;
    if (!this.startTime) this.startTime = performance.now();
    this.raf = requestAnimationFrame(this._onFrame);
  };

  AgentFillGL.prototype._stopLoop = function (clearCanvas) {
    this.running = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    if (clearCanvas && this.gl && this.canvas) {
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
  };

  AgentFillGL.prototype.destroy = function () {
    this._stopLoop(true);
    if (this.resizeObserver && this.shellEl) {
      this.resizeObserver.unobserve(this.shellEl);
    }
    this.resizeObserver = null;
    if (this.fillEl) {
      this.fillEl.classList.remove('p2-agent-fill--gl-ready');
      this.fillEl.classList.remove('p2-agent-fill--gl-active');
      this.fillEl.classList.remove('p2-agent-fill--gl-fading');
    }
    if (this.shellEl) this.shellEl.classList.remove('p2-agent-shell--gl-fill');
    this.canvas = null;
    this.fillEl = null;
    this.shellEl = null;
    this.gl = null;
    this.program = null;
    this.ready = false;
  };

  AgentFillGL.prototype.bind = function (canvas) {
    this.destroy();
    if (!canvas || prefersReducedMotion() || !isTest2Scope()) return false;

    this.canvas = canvas;
    this.fillEl = canvas.closest('.p2-agent-fill');
    this.shellEl = canvas.closest('.p2-agent-shell');
    if (!this.fillEl || !this.shellEl) return false;

    var gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false
    });
    if (!gl) {
      console.warn('[P2AgentFillGL] WebGL unavailable');
      return false;
    }

    var program = createProgram(gl, VERT_SRC, FRAG_SRC);
    if (!program) return false;

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1, 1, 1
    ]), gl.STATIC_DRAW);

    var aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    this.gl = gl;
    this.program = program;
    this.uniforms = {
      origin: gl.getUniformLocation(program, 'u_origin'),
      aspect: gl.getUniformLocation(program, 'u_aspect'),
      radius: gl.getUniformLocation(program, 'u_radius'),
      time: gl.getUniformLocation(program, 'u_time'),
      spread: gl.getUniformLocation(program, 'u_spread'),
      intensity: gl.getUniformLocation(program, 'u_intensity'),
      fill: gl.getUniformLocation(program, 'u_fill'),
      audio: gl.getUniformLocation(program, 'u_audio')
    };

    this.ready = true;
    this.startTime = performance.now();
    this._setPhaseTargets('idle');
    this.fillEl.classList.add('p2-agent-fill--gl-ready');
    this._resize(true);

    var self = this;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(function () {
        self._resize(true);
      });
      this.resizeObserver.observe(this.shellEl);
    }

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      self.destroy();
    }, false);

    return true;
  };

  var instance = new AgentFillGL();

  function ensureBound() {
    if (!isTest2Scope() || prefersReducedMotion()) return false;
    var canvas = document.querySelector('.p2-agent-fill__gl');
    if (!canvas) return false;
    if (instance.canvas === canvas && instance.ready) return true;
    return instance.bind(canvas);
  }

  window.P2AgentFillGL = {
    ensureBound: ensureBound,
    setPhase: function (phase) {
      if (ensureBound()) instance.setPhase(phase);
    },
    setAudio: function (value) {
      instance.setAudio(value);
    },
    waitForPhaseProgress: function (phase, progress, timeoutMs) {
      if (!ensureBound()) return Promise.resolve();
      return instance.waitForPhaseProgress(phase, progress, timeoutMs);
    },
    destroy: function () {
      instance.destroy();
    }
  };

  function isTest3Scope() {
    var canvas = document.getElementById('canvas');
    if (canvas && canvas.getAttribute('data-test-scope') === 'test3') return true;
    return !!(window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3');
  }

  function Test3MusicFillGL() {
    AgentFillGL.call(this);
  }
  Test3MusicFillGL.prototype = Object.create(AgentFillGL.prototype);
  Test3MusicFillGL.prototype.constructor = Test3MusicFillGL;

  Test3MusicFillGL.prototype._getOrigin = function () {
    if (!this.shellEl) return [0.92, 0.88];
    var shell = this.shellEl.getBoundingClientRect();
    if (!shell.width || !shell.height) return [0.92, 0.88];
    return [0.92, 0.88];
  };

  Test3MusicFillGL.prototype._maybeAdvancePhase = function (t) {
    if (!isTest3Scope() || t < 0.999) return;
    if (this._phaseChainLock) return;
    var chain = { hollowReveal: 'settling', settling: 'fadeOut' };
    var next = chain[this.phase];
    if (!next) return;
    this._phaseChainLock = true;
    var self = this;
    requestAnimationFrame(function () {
      self._phaseChainLock = false;
      if (self.phase && chain[self.phase] === next) {
        self._setPhaseTargets(next);
      }
    });
  };

  Test3MusicFillGL.prototype.bind = function (canvas) {
    this.destroy();
    if (!canvas || prefersReducedMotion() || !isTest3Scope()) return false;

    this.canvas = canvas;
    this.fillEl = canvas.closest('.test3-music-fill');
    this.shellEl = canvas.closest('.dot-music1');
    if (!this.fillEl || !this.shellEl) return false;

    var gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false
    });
    if (!gl) {
      console.warn('[Test3MusicFillGL] WebGL unavailable');
      return false;
    }

    var program = createProgram(gl, VERT_SRC, FRAG_SRC);
    if (!program) return false;

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1, 1, 1
    ]), gl.STATIC_DRAW);

    var aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    this.gl = gl;
    this.program = program;
    this.uniforms = {
      origin: gl.getUniformLocation(program, 'u_origin'),
      aspect: gl.getUniformLocation(program, 'u_aspect'),
      radius: gl.getUniformLocation(program, 'u_radius'),
      time: gl.getUniformLocation(program, 'u_time'),
      spread: gl.getUniformLocation(program, 'u_spread'),
      intensity: gl.getUniformLocation(program, 'u_intensity'),
      fill: gl.getUniformLocation(program, 'u_fill'),
      audio: gl.getUniformLocation(program, 'u_audio')
    };

    this.ready = true;
    this.startTime = performance.now();
    this._setPhaseTargets('idle');
    this.fillEl.classList.add('p2-agent-fill--gl-ready');
    this._resize(true);

    var self = this;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(function () {
        self._resize(true);
      });
      this.resizeObserver.observe(this.shellEl);
    }

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      self.destroy();
    }, false);

    return true;
  };

  var test3Instance = new Test3MusicFillGL();

  function ensureTest3Bound() {
    if (!isTest3Scope() || prefersReducedMotion()) return false;
    var canvas = document.querySelector('#test3-music .test3-music-fill__gl');
    if (!canvas) return false;
    if (test3Instance.canvas === canvas && test3Instance.ready) return true;
    return test3Instance.bind(canvas);
  }

  window.Test3MusicFillGL = {
    ensureBound: ensureTest3Bound,
    setPhase: function (phase) {
      if (ensureTest3Bound()) test3Instance.setPhase(phase);
    },
    setAudio: function (value) {
      test3Instance.setAudio(value);
    },
    waitForPhaseProgress: function (phase, progress, timeoutMs) {
      if (!ensureTest3Bound()) return Promise.resolve();
      return test3Instance.waitForPhaseProgress(phase, progress, timeoutMs);
    },
    destroy: function () {
      test3Instance.destroy();
    }
  };
})();
