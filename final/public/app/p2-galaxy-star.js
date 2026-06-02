(function () {
  'use strict';

  var CANVAS_PX = 112;
  var CENTER = CANVAS_PX / 2;
  var POS_SCALE = 0.32;
  var IDLE_FRAMES = 240;
  var MERGE_START = 240;
  var MERGE_END = 460;
  var ACTIVE_CYCLE = 220;
  var CLUSTER_FRAME = 320;
  var LOADING_N = 5;
  var LOADING_TRAIL_LEN = 16;
  var LOADING_ENTER_FRAMES = 68;
  var LOADING_BLEND = 0.38;
  var LOADING_TEMPO = 2.1;
  var LOADING_PAD = 20;
  var LOADING_DOT_FRAC = 0.18;

  var LOADING_VOICES = [
    { noiseSeed: 12.4 },
    { noiseSeed: 48.9 },
    { noiseSeed: 91.2 },
    { noiseSeed: 133.7 },
    { noiseSeed: 176.1 }
  ];

  function vec(x, y) { return { x: x, y: y }; }
  function copyV(v) { return vec(v.x, v.y); }
  function addV(a, b) { return vec(a.x + b.x, a.y + b.y); }
  function subV(a, b) { return vec(a.x - b.x, a.y - b.y); }
  function multV(v, s) { return vec(v.x * s, v.y * s); }
  function lerpV(a, b, t) { return vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }
  function magV(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
  function normV(v) {
    var m = magV(v);
    return m < 0.0001 ? vec(0, 0) : vec(v.x / m, v.y / m);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function easeInOutQuint(x) {
    return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
  }
  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
  function colorMorphFactor(x) {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }
  function lerpColor(c1, c2, t) {
    return [
      Math.round(lerp(c1[0], c2[0], t)),
      Math.round(lerp(c1[1], c2[1], t)),
      Math.round(lerp(c1[2], c2[2], t))
    ];
  }
  function toCss(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function toCssA(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function hashNoise(n) {
    var s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function valueNoise(x) {
    var i = Math.floor(x);
    var f = x - i;
    var u = f * f * (3 - 2 * f);
    return lerp(hashNoise(i), hashNoise(i + 1), u);
  }

  var BL_HOME = vec(-5, 5);
  var TR_HOME = vec(65, -55);
  var TL_HOME = vec(-55, -45);
  var BR_HOME = vec(60, 40);
  var TR_TEMP_OFFSET = subV(BL_HOME, TR_HOME);

  var COLOR_BIG_HOME = [255, 255, 255];
  var COLOR_BIG_TARGET = [255, 157, 218];
  var COLOR_SIZE32 = [255, 200, 230];
  var COLOR_SIZE22 = [255, 232, 245];
  var COLOR_SIZE18 = [255, 255, 255];

  function scalePos(v) {
    return multV(v, POS_SCALE);
  }

  function drawDenseMorphSparkle(ctx, size, morph) {
    var s = size * POS_SCALE;
    var steps = 20;
    ctx.beginPath();
    for (var q = 0; q < 4; q++) {
      for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var starX; var starY; var angle; var circX; var circY;
        if (q === 0) {
          starX = s * (t * t); starY = -s * ((1 - t) * (1 - t));
          angle = t * Math.PI / 2; circX = s * Math.sin(angle); circY = -s * Math.cos(angle);
        } else if (q === 1) {
          starX = s * ((1 - t) * (1 - t)); starY = s * (t * t);
          angle = Math.PI / 2 + t * Math.PI / 2; circX = s * Math.sin(angle); circY = -s * Math.cos(angle);
        } else if (q === 2) {
          starX = -s * (t * t); starY = s * ((1 - t) * (1 - t));
          angle = Math.PI + t * Math.PI / 2; circX = s * Math.sin(angle); circY = -s * Math.cos(angle);
        } else {
          starX = -s * ((1 - t) * (1 - t)); starY = -s * (t * t);
          angle = Math.PI * 1.5 + t * Math.PI / 2; circX = s * Math.sin(angle); circY = -s * Math.cos(angle);
        }
        var x = lerp(starX, circX, morph);
        var y = lerp(starY, circY, morph);
        if (q === 0 && i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
  }

  function computeFrame(frameInLoop, reactiveBlast) {
    reactiveBlast = reactiveBlast || { TL: 0, BR: 0 };
    var blHome = scalePos(BL_HOME);
    var trHome = scalePos(TR_HOME);
    var tlHome = scalePos(TL_HOME);
    var brHome = scalePos(BR_HOME);
    var trTempOffset = scalePos(TR_TEMP_OFFSET);

    var bigPos = copyV(blHome);
    var bigAngle = 0;
    var groupAngle = 0;
    var followOffset = vec(0, 0);
    var tlRhythmScale = 1;
    var colorMorphAmt = 0;
    var tlPos = copyV(tlHome);
    var brPos = copyV(brHome);
    var trPos = copyV(trHome);
    var trActiveScale = 1;
    var morphTL = 0; var morphBR = 0; var morphTR = 0; var morphBL = 0;
    var mergeScaleTL = 1; var mergeScaleBR = 1; var mergeScaleTR = 1;

    if (frameInLoop < IDLE_FRAMES) {
      var progress = frameInLoop / IDLE_FRAMES;
      if (progress < 0.25) {
        var t1 = progress / 0.25;
        var eased1 = easeInOutQuint(t1);
        bigPos = lerpV(blHome, trHome, eased1);
        bigAngle = eased1 * Math.PI;
        followOffset = subV(bigPos, blHome);
        var trTarget = addV(trHome, trTempOffset);
        trPos = lerpV(trHome, trTarget, eased1);
        trActiveScale = lerp(0, 1, (Math.cos(eased1 * Math.PI * 2) + 1) / 2);
        colorMorphAmt = eased1;
      } else if (progress < 0.5) {
        var t2 = (progress - 0.25) / 0.25;
        bigPos = copyV(trHome);
        bigAngle = Math.PI;
        followOffset = subV(trHome, blHome);
        trPos = addV(trHome, trTempOffset);
        trActiveScale = 1;
        if (t2 < 0.5) tlRhythmScale = lerp(1, 0.25, easeInOutCubic(t2 * 2));
        else tlRhythmScale = lerp(0.25, 1, easeInOutCubic((t2 - 0.5) * 2));
        colorMorphAmt = 1;
      } else if (progress < 0.75) {
        var t3 = (progress - 0.5) / 0.25;
        var eased3 = easeInOutCubic(t3);
        bigPos = lerpV(trHome, blHome, eased3);
        bigAngle = Math.PI + eased3 * Math.PI;
        followOffset = subV(bigPos, blHome);
        var trStart = addV(trHome, trTempOffset);
        trPos = lerpV(trStart, trHome, eased3);
        trActiveScale = lerp(0, 1, (Math.cos(eased3 * Math.PI * 2) + 1) / 2);
        colorMorphAmt = lerp(1, 0, eased3);
      }
      tlPos = addV(tlHome, followOffset);
      brPos = addV(brHome, followOffset);
    } else {
      var tTL = clamp((frameInLoop - 240) / 30, 0, 1); morphTL = easeInOutQuint(tTL);
      var tBR = clamp((frameInLoop - 256) / 30, 0, 1); morphBR = easeInOutQuint(tBR);
      var tTR = clamp((frameInLoop - 272) / 30, 0, 1); morphTR = easeInOutQuint(tTR);
      var tBL = clamp((frameInLoop - 288) / 30, 0, 1); morphBL = easeInOutQuint(tBL);
      if (frameInLoop >= 320) { morphTL = 1; morphBR = 1; morphTR = 1; morphBL = 1; }

      var tRot = clamp((frameInLoop - 240) / 80, 0, 1);
      groupAngle = easeInOutQuint(tRot) * (Math.PI * 1.5);

      var tlStart = 325;
      var brStart = 343;
      var trStart = 355;
      var tlDur = 18; var brDur = 12; var trDur = 6;

      tlPos = copyV(tlHome);
      brPos = copyV(brHome);
      trPos = copyV(trHome);

      if (frameInLoop >= tlStart) {
        var tMoveTL = clamp((frameInLoop - tlStart) / tlDur, 0, 1);
        tlPos = lerpV(tlHome, blHome, easeInOutQuint(tMoveTL));
        var tScaleTL = clamp((frameInLoop - tlStart - tlDur) / tlDur, 0, 1);
        mergeScaleTL = lerp(1, (75 / 18), easeInOutQuint(tScaleTL));
      }
      if (frameInLoop >= brStart) {
        var tMoveBR = clamp((frameInLoop - brStart) / brDur, 0, 1);
        brPos = lerpV(brHome, blHome, easeInOutQuint(tMoveBR));
        var tScaleBR = clamp((frameInLoop - brStart - brDur) / brDur, 0, 1);
        mergeScaleBR = lerp(1, (75 / 22), easeInOutQuint(tScaleBR));
      }
      if (frameInLoop >= trStart) {
        var tMoveTR = clamp((frameInLoop - trStart) / trDur, 0, 1);
        trPos = lerpV(trHome, blHome, easeInOutQuint(tMoveTR));
        var tScaleTR = clamp((frameInLoop - trStart - trDur) / trDur, 0, 1);
        mergeScaleTR = lerp(1, (75 / 32), easeInOutQuint(tScaleTR));
      }
    }

    if (frameInLoop < IDLE_FRAMES) {
      var toSmallTL = subV(tlPos, bigPos);
      var toSmallBR = subV(brPos, bigPos);
      [
        { id: 'TL', toSmall: toSmallTL, basePos: tlPos },
        { id: 'BR', toSmall: toSmallBR, basePos: brPos }
      ].forEach(function (s) {
        var angleToSmall = Math.atan2(s.toSmall.y, s.toSmall.x);
        if (angleToSmall < 0) angleToSmall += Math.PI * 2;
        var currentBigAngleNorm = ((bigAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        var angleDiff = Math.abs((angleToSmall - currentBigAngleNorm) % (Math.PI / 2));
        if (angleDiff > Math.PI / 4) angleDiff = Math.PI / 2 - angleDiff;
        var targetBlast = clamp(lerp(1, 0, angleDiff / (32 * POS_SCALE)), 0, 1);
        reactiveBlast[s.id] = lerp(reactiveBlast[s.id] || 0, targetBlast, 0.08);
      });
    }

    return {
      bigPos: bigPos,
      bigAngle: bigAngle,
      groupAngle: groupAngle,
      colorMorphAmt: colorMorphAmt,
      tlPos: tlPos,
      brPos: brPos,
      trPos: trPos,
      trActiveScale: trActiveScale,
      tlRhythmScale: tlRhythmScale,
      morphTL: morphTL,
      morphBR: morphBR,
      morphTR: morphTR,
      morphBL: morphBL,
      mergeScaleTL: mergeScaleTL,
      mergeScaleBR: mergeScaleBR,
      mergeScaleTR: mergeScaleTR,
      reactiveBlast: reactiveBlast
    };
  }

  function getClusterState() {
    var f = computeFrame(CLUSTER_FRAME, { TL: 0, BR: 0 });
    f.colorMorphAmt = 0;
    f.mergeScaleTL = 1;
    f.mergeScaleBR = 1;
    f.mergeScaleTR = 1;
    return f;
  }

  function getMergedState() {
    var blHome = scalePos(BL_HOME);
    return {
      bigPos: copyV(blHome),
      bigAngle: 0,
      groupAngle: 0,
      colorMorphAmt: 1,
      tlPos: copyV(blHome),
      brPos: copyV(blHome),
      trPos: copyV(blHome),
      trActiveScale: 1,
      tlRhythmScale: 1,
      morphTL: 1,
      morphBR: 1,
      morphTR: 1,
      morphBL: 1,
      mergeScaleTL: 75 / 18,
      mergeScaleBR: 75 / 22,
      mergeScaleTR: 75 / 32,
      reactiveBlast: { TL: 0, BR: 0 }
    };
  }

  function interpolateFrameState(from, to, t) {
    return {
      bigPos: lerpV(from.bigPos, to.bigPos, t),
      bigAngle: lerp(from.bigAngle, to.bigAngle, t),
      groupAngle: lerp(from.groupAngle, to.groupAngle, t),
      colorMorphAmt: lerp(from.colorMorphAmt, to.colorMorphAmt, t),
      tlPos: lerpV(from.tlPos, to.tlPos, t),
      brPos: lerpV(from.brPos, to.brPos, t),
      trPos: lerpV(from.trPos, to.trPos, t),
      trActiveScale: lerp(from.trActiveScale, to.trActiveScale, t),
      tlRhythmScale: lerp(from.tlRhythmScale, to.tlRhythmScale, t),
      morphTL: 1,
      morphBR: 1,
      morphTR: 1,
      morphBL: 1,
      mergeScaleTL: lerp(from.mergeScaleTL, to.mergeScaleTL, t),
      mergeScaleBR: lerp(from.mergeScaleBR, to.mergeScaleBR, t),
      mergeScaleTR: lerp(from.mergeScaleTR, to.mergeScaleTR, t),
      pulseBlend: t,
      reactiveBlast: { TL: 0, BR: 0 }
    };
  }

  function renderStarFrame(ctx, frameCount, f, frameInLoop) {
    ctx.save();
    ctx.translate(CENTER, CENTER);
    ctx.rotate(Math.sin(frameCount * 0.5 * Math.PI / 180) * (1.5 * Math.PI / 180));
    ctx.rotate(f.groupAngle);

    var pulseBlend = typeof f.pulseBlend === 'number' ? f.pulseBlend : 0;
    var pulseBigAmt = lerp(0.05, 0.12, pulseBlend);
    var pulseBig = 1 + Math.sin(frameCount * 4 * Math.PI / 180) * pulseBigAmt;
    var pulseTR = 1 + Math.sin(frameCount * 5 * Math.PI / 180 + 135 * Math.PI / 180) * lerp(0.1, 0.15, pulseBlend);

    ctx.save();
    ctx.translate(f.bigPos.x, f.bigPos.y);
    ctx.rotate(f.bigAngle);
    ctx.scale(pulseBig, pulseBig);
    var bigColor = lerpColor(COLOR_BIG_HOME, COLOR_BIG_TARGET, colorMorphFactor(f.colorMorphAmt));
    ctx.fillStyle = toCss(bigColor);
    drawDenseMorphSparkle(ctx, 75, f.morphBL);
    ctx.restore();

    var reactiveStars = [
      { id: 'TL', home: f.tlPos, size: 18, pulsePhase: 45, pulseSpeed: 4.5, col: COLOR_SIZE18, morph: f.morphTL, mergeScale: f.mergeScaleTL, rhythm: f.tlRhythmScale },
      { id: 'BR', home: f.brPos, size: 22, pulsePhase: 90, pulseSpeed: 3.5, col: COLOR_SIZE22, morph: f.morphBR, mergeScale: f.mergeScaleBR, rhythm: 1 }
    ];

    reactiveStars.forEach(function (s) {
      ctx.save();
      var finalPos = copyV(s.home);
      var dynamicScale = 1;
      if (frameInLoop < IDLE_FRAMES) {
        var blast = f.reactiveBlast[s.id] || 0;
        dynamicScale = lerp(1, 0.3, blast);
        var toSmall = subV(s.home, f.bigPos);
        var pushAmount = blast * 28 * POS_SCALE;
        finalPos = addV(s.home, multV(normV(toSmall), pushAmount));
      }
      ctx.translate(finalPos.x, finalPos.y);
      var smallPulse = 1 + Math.sin(frameCount * s.pulseSpeed * Math.PI / 180 + s.pulsePhase * Math.PI / 180) * 0.14;
      ctx.scale(smallPulse * dynamicScale * s.rhythm * s.mergeScale, smallPulse * dynamicScale * s.rhythm * s.mergeScale);
      ctx.fillStyle = toCss(s.col);
      drawDenseMorphSparkle(ctx, s.size, s.morph);
      ctx.restore();
    });

    ctx.save();
    ctx.fillStyle = toCss(COLOR_SIZE32);
    ctx.translate(f.trPos.x, f.trPos.y);
    var finalTRScale = frameInLoop < IDLE_FRAMES ? pulseTR * f.trActiveScale : pulseTR * f.mergeScaleTR;
    ctx.scale(finalTRScale, finalTRScale);
    drawDenseMorphSparkle(ctx, 32, f.morphTR);
    ctx.restore();

    ctx.restore();
  }

  function drawStarScene(ctx, frameCount, frameInLoop, reactiveBlast) {
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    var f = computeFrame(frameInLoop, reactiveBlast);
    renderStarFrame(ctx, frameCount, f, frameInLoop);
  }

  function drawActiveMerged(ctx, frameCount, activeFrame, skipClear) {
    if (!skipClear) ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    var cycleT = (activeFrame % ACTIVE_CYCLE) / ACTIVE_CYCLE;
    var blend = cycleT < 0.5 ? easeInOutQuint(cycleT * 2) : easeInOutQuint(2 - cycleT * 2);
    var f = interpolateFrameState(getClusterState(), getMergedState(), blend);
    f.groupAngle = activeFrame * 1.6 * Math.PI / 180;
    renderStarFrame(ctx, frameCount, f, MERGE_END);
  }

  function drawBreathingChord(ctx, frameCount, musicTime, introT, trails, skipClear) {
    if (!skipClear) ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    var cx = CENTER;
    var cy = CENTER;
    var spreadT = easeInOutQuint(introT);
    var inner = CANVAS_PX - LOADING_PAD * 2;
    var baseDiameter = inner * LOADING_DOT_FRAC;
    var baseR = baseDiameter / 2;
    var minGap = baseDiameter * 1.18;
    var spread = Math.max(0, inner - baseDiameter);
    var spacing = LOADING_N > 1 ? Math.max(minGap, spread / (LOADING_N - 1)) : 0;
    var totalW = spacing * (LOADING_N - 1);
    var startX = cx - totalW / 2;
    var maxAmp = Math.max(0, inner / 2 - baseR - 2);
    var ampPx = maxAmp * 0.9;
    var t = musicTime;
    var phaseStep = (Math.PI * 2) / LOADING_N;
    var phaseStep2 = phaseStep * 0.45;
    var positions = [];

    for (var i = 0; i < LOADING_N; i++) {
      var v = LOADING_VOICES[i];
      var targetX = startX + i * spacing;
      var x = lerp(cx, targetX, spreadT);
      var off = i * phaseStep;
      var off2 = i * phaseStep2;
      var sinY = Math.sin(t * 1.6 - off) * 0.65 + Math.sin(t * 0.7 - off2) * 0.45;
      var noiseY =
        (valueNoise(v.noiseSeed + t * 0.9 - i * 0.55) - 0.5) * 2 * 0.65 +
        (valueNoise(v.noiseSeed + 50 + t * 0.45 - i * 0.3) - 0.5) * 2 * 0.45;
      var yMix = lerp(sinY, noiseY, LOADING_BLEND);
      var y = cy + ampPx * yMix;
      var swell = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.3 - i * phaseStep * 0.85));
      var dotR = baseR * swell;
      positions.push({ x: x, y: y, r: dotR });
    }

    if (spreadT > 0.08) {
      for (var ti = 0; ti < LOADING_N; ti++) {
        var p = positions[ti];
        trails[ti].push({ x: p.x, y: p.y, r: p.r });
        if (trails[ti].length > LOADING_TRAIL_LEN) trails[ti].shift();
      }
    }

    for (var hi = 0; hi < LOADING_N; hi++) {
      var hist = trails[hi];
      var last = hist.length - 1;
      for (var h = 0; h < last; h++) {
        var sample = hist[h];
        var ageT = last <= 0 ? 0 : h / last;
        var trailAlpha = lerp(0.18, 0.95, ageT) * Math.min(1, spreadT + 0.15);
        var trailCol = lerpColor(COLOR_SIZE32, COLOR_BIG_HOME, ageT);
        ctx.strokeStyle = toCssA(trailCol, trailAlpha * 0.88);
        ctx.lineWidth = 1.05;
        ctx.beginPath();
        ctx.arc(sample.x, sample.y, sample.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (var di = 0; di < LOADING_N; di++) {
      var p = positions[di];
      var yellowAmt = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(t * 1.6 - di * phaseStep));
      var col = lerpColor(COLOR_BIG_HOME, COLOR_SIZE32, yellowAmt);
      ctx.fillStyle = toCssA(col, 0.97);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLoadingPhase(ctx, frameCount, activeFrame, musicTime, enterT, trails) {
    var easedEnter = easeInOutQuint(enterT);
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    if (easedEnter < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - easedEnter;
      drawActiveMerged(ctx, frameCount, activeFrame, true);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = easedEnter;
      drawBreathingChord(ctx, frameCount, musicTime, easedEnter, trails, true);
      ctx.restore();
      return;
    }
    drawBreathingChord(ctx, frameCount, musicTime, 1, trails, false);
  }

  function GalaxyStarController(starEl) {
    this.starEl = starEl;
    this.canvas = null;
    this.ctx = null;
    this.raf = 0;
    this.frameCount = 0;
    this.phase = 'idle';
    this.mergeFrame = 0;
    this.idleFrame = 0;
    this.activeFrame = 0;
    this.loadingTime = 0;
    this.loadingEnterT = 0;
    this.loadingTrails = [[], [], [], [], []];
    this.reactiveBlast = { TL: 0, BR: 0 };
    this.loadingCanvas = null;
    this.loadingCtx = null;
    this.lastTickMs = 0;
    this.reducedMotion = false;
    this._onPointerDown = this._onPointerDown.bind(this);
  }

  GalaxyStarController.prototype._ensureLayers = function () {
    if (!this.starEl) return;
    var grad = this.starEl.querySelector('.p2-galaxy-star__grad');
    if (!grad) {
      grad = document.createElement('span');
      grad.className = 'p2-galaxy-star__grad';
      grad.setAttribute('aria-hidden', 'true');
      this.starEl.insertBefore(grad, this.starEl.firstChild);
    }
    var canvas = this.starEl.querySelector('.p2-galaxy-star__canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'p2-galaxy-star__canvas';
      canvas.width = CANVAS_PX;
      canvas.height = CANVAS_PX;
      canvas.setAttribute('aria-hidden', 'true');
      this.starEl.appendChild(canvas);
    }
    this.canvas = canvas;
  };

  GalaxyStarController.prototype._bindLoadingCanvas = function () {
    var icon = document.querySelector('#canvas[data-test-scope="test2"] .p2-result-loading__icon');
    if (!icon) {
      this.loadingCanvas = null;
      this.loadingCtx = null;
      return;
    }
    var canvas = icon.querySelector('.p2-galaxy-star__canvas--loading');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'p2-galaxy-star__canvas p2-galaxy-star__canvas--loading';
      canvas.width = CANVAS_PX;
      canvas.height = CANVAS_PX;
      canvas.setAttribute('aria-hidden', 'true');
      icon.textContent = '';
      icon.appendChild(canvas);
    }
    this.loadingCanvas = canvas;
    this.loadingCtx = canvas.getContext('2d');
  };

  GalaxyStarController.prototype._syncVoiceGrad = function () {
    if (!this.starEl) return;
    var on = this.phase === 'merge' || this.phase === 'active' || this.phase === 'loading';
    this.starEl.classList.toggle('p2-galaxy-star--voice', on);
  };

  GalaxyStarController.prototype.mount = function () {
    if (!this.starEl) return false;
    this.destroy(false);

    this.reducedMotion = false;
    try {
      this.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) {}

    this._ensureLayers();
    this._bindLoadingCanvas();
    this.ctx = this.canvas.getContext('2d');
    this.starEl.classList.add('p2-galaxy-star-btn');
    this.starEl.addEventListener('pointerdown', this._onPointerDown, { passive: true });
    this.phase = 'idle';
    this.mergeFrame = 0;
    this.idleFrame = 0;
    this.activeFrame = 0;
    this.loadingTime = 0;
    this.loadingEnterT = 0;
    this.loadingTrails = [[], [], [], [], []];
    this.lastTickMs = 0;
    this.frameCount = 0;
    this._syncVoiceGrad();
    this._draw();
    if (!this.reducedMotion) this._loop();
    return true;
  };

  GalaxyStarController.prototype._onPointerDown = function () {
    if (this.phase === 'idle') this.setPhase('merge');
  };

  GalaxyStarController.prototype.setPhase = function (next) {
    if (!this.ctx) return;
    if (next === 'loading') {
      if (this.phase !== 'loading') {
        this.loadingEnterT = 0;
        this.loadingTime = 0;
        this.loadingTrails = [[], [], [], [], []];
      }
      this.phase = 'loading';
      this._syncVoiceGrad();
      return;
    }
    if (next === 'active') {
      if (this.phase === 'idle') {
        this.phase = 'merge';
        this.mergeFrame = MERGE_START;
      } else if (this.phase !== 'merge') {
        this.phase = 'active';
      }
      this._syncVoiceGrad();
      return;
    }
    if (next === 'merge') {
      if (this.phase === 'idle') {
        this.phase = 'merge';
        this.mergeFrame = MERGE_START;
      }
      this._syncVoiceGrad();
      return;
    }
    if (next === 'idle') {
      this.phase = 'idle';
      this.mergeFrame = 0;
      this.idleFrame = 0;
      this.activeFrame = 0;
      this.loadingEnterT = 0;
      this.loadingTime = 0;
      this.loadingTrails = [[], [], [], [], []];
      this.reactiveBlast = { TL: 0, BR: 0 };
    }
    this._syncVoiceGrad();
  };

  GalaxyStarController.prototype._renderTo = function (ctx) {
    if (!ctx) return;
    if (this.phase === 'loading') {
      drawLoadingPhase(ctx, this.frameCount, this.activeFrame, this.loadingTime, this.loadingEnterT, this.loadingTrails);
      return;
    }
    if (this.phase === 'active') {
      drawActiveMerged(ctx, this.frameCount, this.activeFrame);
      return;
    }
    if (this.phase === 'merge') {
      drawStarScene(ctx, this.frameCount, this.mergeFrame, this.reactiveBlast);
      return;
    }
    drawStarScene(ctx, this.frameCount, this.idleFrame, this.reactiveBlast);
  };

  GalaxyStarController.prototype._draw = function () {
    this._renderTo(this.ctx);
    if (!this.loadingCtx) return;
    if (this.phase === 'loading') {
      this._renderTo(this.loadingCtx);
      return;
    }
    this.loadingCtx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
  };

  GalaxyStarController.prototype._loop = function () {
    var self = this;
    self.raf = requestAnimationFrame(function tick() {
      self.frameCount += 1;
      if (self.phase === 'idle') {
        self.idleFrame = (self.idleFrame + 1) % IDLE_FRAMES;
      } else if (self.phase === 'merge') {
        self.mergeFrame += 1;
        if (self.mergeFrame >= MERGE_END) {
          self.phase = 'active';
          self.mergeFrame = 0;
          self.activeFrame = 0;
        }
      } else if (self.phase === 'active') {
        self.activeFrame += 1;
      } else if (self.phase === 'loading') {
        var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        var delta = self.lastTickMs ? Math.min(80, now - self.lastTickMs) : 16.67;
        self.lastTickMs = now;
        self.loadingTime += (delta / 1000) * LOADING_TEMPO;
        if (self.loadingEnterT < 1) {
          self.loadingEnterT = Math.min(1, self.loadingEnterT + 1 / LOADING_ENTER_FRAMES);
        }
      } else {
        self.lastTickMs = 0;
      }
      if (self.phase === 'loading' && !self.loadingCtx) self._bindLoadingCanvas();
      self._draw();
      self.raf = requestAnimationFrame(tick);
    });
  };

  GalaxyStarController.prototype.destroy = function (removeCanvas) {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.starEl) {
      this.starEl.removeEventListener('pointerdown', this._onPointerDown);
      if (removeCanvas !== false && this.canvas && this.canvas.parentNode === this.starEl) {
        this.starEl.removeChild(this.canvas);
      }
    }
    this.canvas = null;
    this.ctx = null;
  };

  var current = null;

  function isTest2Scope() {
    if (window.__mlpTestConfig && window.__mlpTestConfig.id === 'test2') return true;
    var canvas = document.getElementById('canvas');
    return !!(canvas && canvas.getAttribute('data-test-scope') === 'test2');
  }

  window.P2GalaxyStar = {
    mount: function (starEl) {
      if (!isTest2Scope()) return false;
      if (!starEl) starEl = document.getElementById('p2-star');
      if (!starEl) return false;
      if (current) current.destroy(false);
      current = new GalaxyStarController(starEl);
      return current.mount();
    },
    setPhase: function (phase) {
      if (current) current.setPhase(phase);
    },
    unmount: function () {
      if (current) {
        current.destroy(true);
        current = null;
      }
    },
    syncFromCanvas: function (canvasEl) {
      if (!current) return;
      var canvas = canvasEl || document.getElementById('canvas');
      if (!canvas) return;
      var result = document.getElementById('p2-result');
      var isLoading = !!(result && result.classList.contains('is-loading'));
      var revealStarted =
        typeof window.isTest2P2RevealStarted === 'function' && window.isTest2P2RevealStarted();
      var listening = canvas.classList.contains('p2-listening');
      var generating = canvas.classList.contains('p2-generating');

      if (isLoading && !revealStarted) {
        current.setPhase('loading');
      } else if (listening || generating) {
        current.setPhase('active');
      } else {
        current.setPhase('idle');
      }
      current._bindLoadingCanvas();
    }
  };
})();
