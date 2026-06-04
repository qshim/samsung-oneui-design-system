(function (global) {
  'use strict';

  var DEG = Math.PI / 180;
  var INSTANCES = new WeakMap();
  var LOOP_FRAMES = 240;
  var FIT_PADDING = 1.20;
  var PULSE_BIG = 1.12;
  var PULSE_TR = 1.15;
  var PULSE_SMALL = 1.14;
  var WOBBLE_DEG = 0.9;
  var SIZE_SCALE = 1.12;
  var SCREEN_OFFSET_X = 0;
  var SCREEN_OFFSET_Y = 0;
  var REST_FRAME = 0;
  var REST_PLATEAU_START = Math.floor(LOOP_FRAMES * 0.75);
  var SETTLE_SCALE_MS = 720;
  var PAUSE_SLOT_BASE_X = 1;
  var PAUSE_SLOT_BASE_Y = 1.2;
  var PAUSE_SLOT_FINAL_X = 3;
  var PAUSE_SLOT_FINAL_Y = 2;
  var PAUSE_SLOT_BASE_SCALE = 0.99;
  var PAUSE_SLOT_FINAL_SCALE = 1.07;
  var PAUSE_SLOT_EASING = 'cubic-bezier(0.33, 1, 0.68, 1)';

  function vec(x, y) { return { x: x, y: y }; }
  function vecCopy(v) { return vec(v.x, v.y); }
  function vecLerp(a, b, t) { return vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }
  function vecAdd(a, b) { return vec(a.x + b.x, a.y + b.y); }
  function vecSub(a, b) { return vec(a.x - b.x, a.y - b.y); }
  function vecMult(v, s) { return vec(v.x * s, v.y * s); }
  function vecMag(v) { return Math.hypot(v.x, v.y); }
  function vecNormalize(v) {
    var m = vecMag(v);
    if (!m) return vec(0, 0);
    return vec(v.x / m, v.y / m);
  }

  var BL_HOME_RAW = vec(-5, 5);
  var TR_HOME_RAW = vec(65, -55);
  var STAR_SPACING = 0.84;
  var STAR_MOTION_CX = (BL_HOME_RAW.x + TR_HOME_RAW.x) / 2;
  var STAR_MOTION_CY = (BL_HOME_RAW.y + TR_HOME_RAW.y) / 2;

  function scaleStarHome(v) {
    return vec(
      STAR_MOTION_CX + (v.x - STAR_MOTION_CX) * STAR_SPACING,
      STAR_MOTION_CY + (v.y - STAR_MOTION_CY) * STAR_SPACING
    );
  }

  var BL_HOME = scaleStarHome(BL_HOME_RAW);
  var TR_HOME = scaleStarHome(TR_HOME_RAW);
  var TL_HOME = vec(-55, -45);
  var BR_HOME = vec(60, 40);
  var TR_TEMP_OFFSET = vecSub(BL_HOME, TR_HOME);

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function mapRange(v, a, b, c, d) { return c + ((v - a) / (b - a)) * (d - c); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOutQuint(x) { return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2; }
  function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function colorMorphFactor(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function sinDeg(d) { return Math.sin(d * DEG); }
  function cosDeg(d) { return Math.cos(d * DEG); }

  function lerpColor(c1, c2, t) {
    return 'rgb(' +
      Math.round(lerp(c1.r, c2.r, t)) + ',' +
      Math.round(lerp(c1.g, c2.g, t)) + ',' +
      Math.round(lerp(c1.b, c2.b, t)) + ')';
  }

  function computeFrameState(frameInLoop) {
    var progress = frameInLoop / LOOP_FRAMES;
    var bigPos = vecCopy(BL_HOME);
    var bigAngle = 0;
    var followOffset = vec(0, 0);
    var tlRhythmScale = 1;
    var colorMorphAmt = 0;
    var tlPos = vecCopy(TL_HOME);
    var brPos = vecCopy(BR_HOME);
    var trPos = vecCopy(TR_HOME);
    var trActiveScale = 1;
    var t;
    var eased;
    var trTarget;
    var trStart;

    if (progress < 0.25) {
      t = mapRange(progress, 0, 0.25, 0, 1);
      eased = easeInOutQuint(t);
      bigPos = vecLerp(BL_HOME, TR_HOME, eased);
      bigAngle = eased * 180;
      followOffset = vecSub(bigPos, BL_HOME);
      trTarget = vecAdd(TR_HOME, TR_TEMP_OFFSET);
      trPos = vecLerp(TR_HOME, trTarget, eased);
      trActiveScale = mapRange(cosDeg(eased * 360), -1, 1, 0, 1);
      colorMorphAmt = eased;
    } else if (progress < 0.5) {
      t = mapRange(progress, 0.25, 0.5, 0, 1);
      bigPos = vecCopy(TR_HOME);
      bigAngle = 180;
      followOffset = vecSub(TR_HOME, BL_HOME);
      trPos = vecAdd(TR_HOME, TR_TEMP_OFFSET);
      trActiveScale = 1;
      if (t < 0.5) tlRhythmScale = mapRange(easeInOutCubic(t * 2), 0, 1, 1, 0.25);
      else tlRhythmScale = mapRange(easeInOutCubic((t - 0.5) * 2), 0, 1, 0.25, 1);
      colorMorphAmt = 1;
    } else if (progress < 0.75) {
      t = mapRange(progress, 0.5, 0.75, 0, 1);
      eased = easeInOutCubic(t);
      bigPos = vecLerp(TR_HOME, BL_HOME, eased);
      bigAngle = 180 + eased * 180;
      followOffset = vecSub(bigPos, BL_HOME);
      trStart = vecAdd(TR_HOME, TR_TEMP_OFFSET);
      trPos = vecLerp(trStart, TR_HOME, eased);
      trActiveScale = mapRange(cosDeg(eased * 360), -1, 1, 0, 1);
      colorMorphAmt = mapRange(eased, 0, 1, 1, 0);
    }

    tlPos = vecAdd(TL_HOME, followOffset);
    brPos = vecAdd(BR_HOME, followOffset);

    return {
      bigPos: bigPos,
      bigAngle: bigAngle,
      tlPos: tlPos,
      brPos: brPos,
      trPos: trPos,
      trActiveScale: trActiveScale,
      tlRhythmScale: tlRhythmScale,
      colorMorphAmt: colorMorphAmt
    };
  }

  function expandBounds(minX, minY, maxX, maxY, x, y, radius) {
    if (x - radius < minX) minX = x - radius;
    if (y - radius < minY) minY = y - radius;
    if (x + radius > maxX) maxX = x + radius;
    if (y + radius > maxY) maxY = y + radius;
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function computeMotionEnvelope() {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    var frame;
    var state;
    var bounds;
    var toSmall;
    var pushAmount;
    var tlFinal;
    var brFinal;
    var tlRadius;
    var brRadius;

    for (frame = 0; frame < LOOP_FRAMES; frame += 1) {
      state = computeFrameState(frame);
      bounds = expandBounds(minX, minY, maxX, maxY, state.bigPos.x, state.bigPos.y, 75 * PULSE_BIG);
      minX = bounds.minX;
      minY = bounds.minY;
      maxX = bounds.maxX;
      maxY = bounds.maxY;

      bounds = expandBounds(minX, minY, maxX, maxY, state.trPos.x, state.trPos.y, 32 * PULSE_TR * state.trActiveScale);
      minX = bounds.minX;
      minY = bounds.minY;
      maxX = bounds.maxX;
      maxY = bounds.maxY;

      toSmall = vecSub(state.tlPos, state.bigPos);
      pushAmount = 28;
      tlFinal = vecAdd(state.tlPos, vecMult(vecNormalize(toSmall), pushAmount));
      tlRadius = 18 * PULSE_SMALL * 0.3 * state.tlRhythmScale;
      bounds = expandBounds(minX, minY, maxX, maxY, tlFinal.x, tlFinal.y, tlRadius);
      minX = bounds.minX;
      minY = bounds.minY;
      maxX = bounds.maxX;
      maxY = bounds.maxY;

      toSmall = vecSub(state.brPos, state.bigPos);
      brFinal = vecAdd(state.brPos, vecMult(vecNormalize(toSmall), pushAmount));
      brRadius = 22 * PULSE_SMALL * 0.3;
      bounds = expandBounds(minX, minY, maxX, maxY, brFinal.x, brFinal.y, brRadius);
      minX = bounds.minX;
      minY = bounds.minY;
      maxX = bounds.maxX;
      maxY = bounds.maxY;
    }

    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      radius: Math.max(maxX - minX, maxY - minY) / 2 * FIT_PADDING
    };
  }

  var MOTION_ENVELOPE = computeMotionEnvelope();

  function computeViewportLayout(canvasSize) {
    var clipRadius = Math.max(1, canvasSize / 2);
    return {
      fitScale: (clipRadius / MOTION_ENVELOPE.radius) * SIZE_SCALE,
      offsetX: -MOTION_ENVELOPE.centerX,
      offsetY: -MOTION_ENVELOPE.centerY
    };
  }

  function drawDenseMorphSparkle(ctx, size, morph) {
    var steps = 20;
    var i;
    var t;
    var starX;
    var starY;
    var angle;
    var circX;
    var circY;

    ctx.beginPath();
    for (i = 0; i <= steps; i += 1) {
      t = i / steps;
      starX = size * (t * t);
      starY = -size * ((1 - t) * (1 - t));
      angle = t * 90;
      circX = size * sinDeg(angle);
      circY = -size * cosDeg(angle);
      if (i === 0) ctx.moveTo(lerp(starX, circX, morph), lerp(starY, circY, morph));
      else ctx.lineTo(lerp(starX, circX, morph), lerp(starY, circY, morph));
    }
    for (i = 0; i <= steps; i += 1) {
      t = i / steps;
      starX = size * ((1 - t) * (1 - t));
      starY = size * (t * t);
      angle = 90 + t * 90;
      circX = size * sinDeg(angle);
      circY = -size * cosDeg(angle);
      ctx.lineTo(lerp(starX, circX, morph), lerp(starY, circY, morph));
    }
    for (i = 0; i <= steps; i += 1) {
      t = i / steps;
      starX = -size * (t * t);
      starY = size * ((1 - t) * (1 - t));
      angle = 180 + t * 90;
      circX = size * sinDeg(angle);
      circY = -size * cosDeg(angle);
      ctx.lineTo(lerp(starX, circX, morph), lerp(starY, circY, morph));
    }
    for (i = 0; i <= steps; i += 1) {
      t = i / steps;
      starX = -size * ((1 - t) * (1 - t));
      starY = -size * (t * t);
      angle = 270 + t * 90;
      circX = size * sinDeg(angle);
      circY = -size * cosDeg(angle);
      ctx.lineTo(lerp(starX, circX, morph), lerp(starY, circY, morph));
    }
    ctx.closePath();
    ctx.fill();
  }

  function Test1GalaxyAiLogo(canvasEl, options) {
    options = options || {};
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.frame = 0;
    this.raf = null;
    this.fitScale = 0.1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.whiteOnly = options.whiteOnly === true;
    this.fixedLayout = options.fixedLayout === true;
    this.colorBiggestHome = { r: 255, g: 255, b: 255 };
    this.colorBiggestTarget = this.whiteOnly
      ? { r: 255, g: 255, b: 255 }
      : { r: 0, g: 114, b: 245 };
    this.paused = false;
    this.coastingToRest = false;
    this.coastUntilFrame = 0;
    this.settling = false;
    this.settlePhase = '';
    this._pauseAnim = null;
    this._restDrawOnly = false;
  }

  Test1GalaxyAiLogo.prototype._loopFrame = function () {
    return ((this.frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  };

  Test1GalaxyAiLogo.prototype._isRestLoopFrame = function (loopFrame) {
    return loopFrame === REST_FRAME || loopFrame >= REST_PLATEAU_START;
  };

  Test1GalaxyAiLogo.prototype._framesUntilRest = function () {
    var loopFrame = this._loopFrame();
    if (this._isRestLoopFrame(loopFrame)) return 0;
    var toPlateau = REST_PLATEAU_START - loopFrame;
    var toZero = LOOP_FRAMES - loopFrame;
    return toPlateau <= toZero ? toPlateau : toZero;
  };

  Test1GalaxyAiLogo.prototype._snapToRestLoopFrame = function () {
    var loopFrame = this._loopFrame();
    if (this._isRestLoopFrame(loopFrame)) {
      if (loopFrame !== REST_FRAME) {
        this.frame = this.frame - loopFrame + REST_PLATEAU_START;
      }
      return;
    }
    this.frame = this.frame - loopFrame + REST_PLATEAU_START;
  };

  Test1GalaxyAiLogo.prototype._haltLoop = function () {
    if (this.raf) {
      global.cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  };

  Test1GalaxyAiLogo.prototype._applySlotBaseTransform = function (slot) {
    if (!slot) return;
    slot.style.transformOrigin = '20% center';
    slot.style.transform =
      'translate3d(' + PAUSE_SLOT_BASE_X + 'px, ' + PAUSE_SLOT_BASE_Y + 'px, 0) scale(' + PAUSE_SLOT_BASE_SCALE + ')';
  };

  Test1GalaxyAiLogo.prototype._applySlotFinalTransform = function (slot) {
    if (!slot) return;
    slot.style.transformOrigin = '20% center';
    slot.style.transform =
      'translate3d(' + PAUSE_SLOT_FINAL_X + 'px, ' + PAUSE_SLOT_FINAL_Y + 'px, 0) scale(' + PAUSE_SLOT_FINAL_SCALE + ')';
  };

  Test1GalaxyAiLogo.prototype._clearPauseDomScale = function () {
    var canvas = this.canvas;
    if (!canvas) return;
    var slot = canvas.closest('.test1-bottom-pill__ai-logo-slot');
    if (this._pauseAnim) {
      this._pauseAnim.cancel();
      this._pauseAnim = null;
    }
    canvas.removeAttribute('data-test1-ai-logo-paused');
    canvas.style.removeProperty('transform');
    if (slot) {
      slot.removeAttribute('data-test1-ai-logo-paused');
      slot.style.removeProperty('will-change');
      slot.style.removeProperty('transform-origin');
      slot.style.removeProperty('transform');
      slot.style.removeProperty('overflow');
    }
  };

  Test1GalaxyAiLogo.prototype._freezeRestFrame = function () {
    this.coastingToRest = false;
    this.frame = REST_PLATEAU_START;
    this.draw();
  };

  Test1GalaxyAiLogo.prototype._runScaleWaapi = function () {
    var self = this;
    var canvas = this.canvas;
    var slot = canvas && canvas.closest('.test1-bottom-pill__ai-logo-slot');

    this._haltLoop();
    this.settling = true;
    this.settlePhase = 'waapi';
    this._freezeRestFrame();

    if (!slot || typeof slot.animate !== 'function') {
      this._finishPause();
      return;
    }

    if (this._pauseAnim) {
      this._pauseAnim.cancel();
      this._pauseAnim = null;
    }

    slot.setAttribute('data-test1-ai-logo-paused', '1');
    canvas.setAttribute('data-test1-ai-logo-paused', '1');
    slot.style.overflow = 'visible';
    slot.style.willChange = 'transform';
    this._applySlotBaseTransform(slot);

    this._pauseAnim = slot.animate([
      {
        transform: 'translate3d(' + PAUSE_SLOT_BASE_X + 'px, ' + PAUSE_SLOT_BASE_Y + 'px, 0) scale(' + PAUSE_SLOT_BASE_SCALE + ')'
      },
      {
        transform: 'translate3d(' + PAUSE_SLOT_FINAL_X + 'px, ' + PAUSE_SLOT_FINAL_Y + 'px, 0) scale(' + PAUSE_SLOT_FINAL_SCALE + ')'
      }
    ], {
      duration: SETTLE_SCALE_MS,
      easing: PAUSE_SLOT_EASING,
      fill: 'forwards'
    });

    this._pauseAnim.onfinish = function () {
      try { self._pauseAnim.commitStyles(); } catch (_) {}
      self._pauseAnim = null;
      self._finishPause();
    };
  };

  Test1GalaxyAiLogo.prototype._finishPause = function () {
    this.coastingToRest = false;
    this.settling = false;
    this.settlePhase = '';
    this.paused = true;
    this.frame = REST_PLATEAU_START;
    this.draw();
    if (this.canvas) this.canvas.setAttribute('data-test1-ai-logo-paused', 'done');
    var slot = this.canvas && this.canvas.closest('.test1-bottom-pill__ai-logo-slot');
    if (slot) {
      slot.style.willChange = '';
      this._applySlotFinalTransform(slot);
    }
    this._haltLoop();
  };

  Test1GalaxyAiLogo.prototype.beginPauseToRest = function () {
    if (this.paused || this.settling) return;
    this._runScaleWaapi();
  };

  Test1GalaxyAiLogo.prototype.draw = function () {
    var ctx = this.ctx;
    var w = this.canvas.width / (this.dpr || 1);
    var h = this.canvas.height / (this.dpr || 1);
    var cx = w / 2;
    var cy = h / 2;
    var clipR = Math.min(w, h) / 2;
    var frameInLoop = this.frame % LOOP_FRAMES;
    var state;
    var bigPos;
    var bigAngle;
    var trPos;
    var trActiveScale;
    var colorMorphAmt;
    var pulseBig;
    var pulseTR;
    var finalTRScale;
    var currentBigColor;
    var wobbleAngle = this.whiteOnly ? 0 : sinDeg(this.frame * 0.5) * WOBBLE_DEG;

    if (this.paused || this._restDrawOnly) {
      state = computeFrameState(REST_FRAME);
      wobbleAngle = 0;
      pulseBig = 1;
      pulseTR = 1;
    } else if (this.coastingToRest) {
      state = computeFrameState(this._loopFrame());
      pulseBig = this.whiteOnly ? 1 : 1 + sinDeg(this.frame * 4) * 0.12;
      pulseTR = this.whiteOnly ? 1 : 1 + sinDeg(this.frame * 5 + 135) * 0.15;
    } else {
      state = computeFrameState(frameInLoop);
      pulseBig = this.whiteOnly ? 1 : 1 + sinDeg(this.frame * 4) * 0.12;
      pulseTR = this.whiteOnly ? 1 : 1 + sinDeg(this.frame * 5 + 135) * 0.15;
    }

    bigPos = state.bigPos;
    bigAngle = state.bigAngle;
    trPos = state.trPos;
    trActiveScale = state.trActiveScale;
    colorMorphAmt = state.colorMorphAmt;

    ctx.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, clipR, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx + SCREEN_OFFSET_X, cy + SCREEN_OFFSET_Y);
    ctx.scale(this.fitScale, this.fitScale);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.rotate(wobbleAngle * DEG);

    ctx.save();
    ctx.translate(bigPos.x, bigPos.y);
    ctx.rotate(bigAngle * DEG);
    ctx.scale(pulseBig, pulseBig);
    currentBigColor = this.whiteOnly
      ? 'rgb(255,255,255)'
      : lerpColor(this.colorBiggestHome, this.colorBiggestTarget, colorMorphFactor(colorMorphAmt));
    ctx.fillStyle = currentBigColor;
    drawDenseMorphSparkle(ctx, 75, 0);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = this.whiteOnly ? 'rgb(255,255,255)' : 'rgb(100,190,255)';
    ctx.translate(trPos.x, trPos.y);
    finalTRScale = pulseTR * trActiveScale;
    ctx.scale(finalTRScale, finalTRScale);
    drawDenseMorphSparkle(ctx, 32, 0);
    ctx.restore();

    ctx.restore();
  };

  Test1GalaxyAiLogo.prototype.start = function () {
    if (this.raf) return;
    var self = this;
    function loop() {
      self.raf = null;
      if (!self.paused && !self.settling) {
        self.frame += 1;
        self.draw();
        self.raf = global.requestAnimationFrame(loop);
      }
    }
    self.raf = global.requestAnimationFrame(loop);
  };

  Test1GalaxyAiLogo.prototype.relayout = function () {
    if (this.fixedLayout) return;
    var canvas = this.canvas;
    var slot = canvas.closest('.test1-bottom-pill__ai-logo-slot') || canvas.parentElement;
    var slotRect = slot ? slot.getBoundingClientRect() : canvas.getBoundingClientRect();
    var size = Math.max(slotRect.width, slotRect.height, 1);
    size = Math.max(1, Math.round(size));
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var layout = computeViewportLayout(size);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    this.dpr = dpr;
    this.fitScale = layout.fitScale;
    this.offsetX = layout.offsetX;
    this.offsetY = layout.offsetY;
    this.draw();
  };

  Test1GalaxyAiLogo.prototype.stop = function () {
    if (this._resizeObs) {
      this._resizeObs.disconnect();
      this._resizeObs = null;
    }
    if (this.raf) {
      global.cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  };

  function _stopInstance(canvas) {
    if (!canvas) return;
    var inst = INSTANCES.get(canvas);
    if (!inst) return;
    inst._clearPauseDomScale();
    inst.stop();
    INSTANCES.delete(canvas);
  }

  function _setupCanvasInstance(canvas, options) {
    if (!canvas) return null;
    _stopInstance(canvas);
    var slot = canvas.parentElement;
    var slotRect = slot ? slot.getBoundingClientRect() : canvas.getBoundingClientRect();
    var size = Math.max(slotRect.width, slotRect.height, 1);
    size = Math.max(1, Math.round(size));
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var layout = computeViewportLayout(size);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    canvas.style.removeProperty('transform');
    var inst = new Test1GalaxyAiLogo(canvas, options);
    inst.dpr = dpr;
    inst.fitScale = layout.fitScale;
    inst.offsetX = layout.offsetX;
    inst.offsetY = layout.offsetY;
    inst._clearPauseDomScale();
    if (slot && slot.closest('.test1-bottom-pill')) {
      inst._applySlotBaseTransform(slot);
    }
    inst.start();
    if (global.ResizeObserver && slot && !inst.fixedLayout) {
      inst._resizeObs = new global.ResizeObserver(function () {
        if (!inst.paused && !inst.coastingToRest && !inst.settling) inst.relayout();
      });
      inst._resizeObs.observe(slot);
    }
    INSTANCES.set(canvas, inst);
    return inst;
  }

  function mountCanvas(canvasEl, options) {
    if (!canvasEl) return null;
    return _setupCanvasInstance(canvasEl, options);
  }

  function unmountCanvas(canvasEl) {
    _stopInstance(canvasEl);
  }

  function mount(root) {
    if (!root) return null;
    var pillEl = root.querySelector('.test1-bottom-pill') || root;
    var canvas = pillEl.querySelector('.test1-bottom-pill__ai-logo');
    if (!canvas) return null;

    function setup() {
      return _setupCanvasInstance(canvas, null);
    }

    if (root.querySelector('.test1-bottom-pill__icon')) {
      return setup();
    }

    var instRef = null;
    global.requestAnimationFrame(function () {
      global.requestAnimationFrame(function () {
        instRef = setup();
      });
    });
    return instRef;
  }

  function unmount(root) {
    if (!root) return;
    var canvas = root.querySelector('.test1-bottom-pill__ai-logo');
    unmountCanvas(canvas);
  }

  function pause(root) {
    if (!root) return;
    var pillEl = root.querySelector('.test1-bottom-pill') || root;
    var canvas = pillEl.querySelector('.test1-bottom-pill__ai-logo');
    if (!canvas) return;
    var inst = INSTANCES.get(canvas);
    if (inst && typeof inst.beginPauseToRest === 'function') {
      inst.beginPauseToRest();
    }
  }

  global.__test1GalaxyAiLogo = {
    mount: mount,
    unmount: unmount,
    pause: pause,
    mountCanvas: mountCanvas,
    unmountCanvas: unmountCanvas
  };
})(typeof window !== 'undefined' ? window : this);
