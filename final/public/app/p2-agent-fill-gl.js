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
    'uniform float u_sweep;',
    'uniform float u_audio;',
    'uniform float u_compact;',
    'uniform float u_virtAspect;',
    'uniform float u_variant;',
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
    '  float early = (1.0 - smoothstep(0.0, 0.48, s)) * onset;',
    '  float wt = time * (1.82 + early * 1.55);',
    '  float isCompact = step(0.5, u_compact);',
    '  vec2 target = mix(vec2(0.05, 0.95), vec2(0.04, u_origin.y), isCompact);',
    '  float diagAspect = mix(u_aspect, u_virtAspect, isCompact);',
    '  vec2 diag = vec2((target.x - u_origin.x) * diagAspect, target.y - u_origin.y);',
    '  vec2 diagN = diag / max(length(diag), 0.0001);',
    '  vec2 ellRel = rel * vec2(',
    '    mix(mix(0.50, 0.72, s), mix(0.48, 0.66, s), isCompact),',
    '    mix(mix(1.10, 1.0, early), mix(0.78, 0.72, early), isCompact)',
    '  );',
    '  float dist = length(ellRel);',
    '  float horizLead = max(0.0, -rel.x);',
    '  float vertRound = abs(rel.y) * mix(1.0, 0.58, isCompact);',
    '  float roundFlow = sqrt(horizLead * horizLead * 0.94 + vertRound * vertRound);',
    '  dist = mix(dist, roundFlow, isCompact);',
    '  float align = max(0.0, dot(normalize(rel + vec2(0.001)), diagN));',
    '  dist *= 1.0 - align * mix(',
    '    mix(0.22, 0.10, smoothstep(0.0, 0.55, s)),',
    '    mix(0.04, 0.01, smoothstep(0.0, 0.55, s)),',
    '    isCompact',
    '  );',
    '  float depthIn = clamp(-sdf / max(u_radius * 2.4, 0.08), 0.0, 1.0);',
    '  float edgeProx = 1.0 - smoothstep(0.0, 0.26, depthIn);',
    '  float wobble = (fbm(uv * 2.4 + wt * 0.052) - 0.5)',
    '    * (0.10 + early * 0.15) * max(s, 0.06);',
    '  float ripple = sin(wt * 2.05 + atan(rel.y, rel.x + 0.0001) * 6.4)',
    '    * 0.072 * max(early, 0.26);',
    '  float flowWave = (sin(wt * 1.92 + uv.x * 8.2 + uv.y * 3.2)',
    '    + sin(wt * 1.62 - uv.y * 6.4 + uv.x * 2.8)) * 0.5 * early * 0.074;',
    '  float edgeShimmer = (fbm(uv * 4.2 + wt * 0.07) - 0.5) * 0.038 * max(s, 0.12);',
    '  dist += ripple + wobble * 0.54 + flowWave + edgeShimmer;',
    '  float revealAt = s * 1.44 + early * 0.08;',
    '  float edgeBoost = edgeProx * (0.36 + early * 0.18);',
    '  float centerLag = depthIn * 0.17 * (1.0 - smoothstep(0.40, 1.02, s));',
    '  float localFront = revealAt + edgeBoost - centerLag;',
    '  float softLead = mix(',
    '    max(0.26, 0.44 * s + early * 0.14 + audio * 0.02),',
    '    max(0.24, 0.34 * s + early * 0.12 + audio * 0.028),',
    '    isCompact',
    '  );',
    '  softLead *= mix(1.0, 1.42, step(1.5, u_variant));',
    '  float softTrail = softLead * mix(1.32, 1.52, isCompact);',
    '  softTrail *= mix(1.0, 1.18, step(1.5, u_variant));',
    '  float revealCore = 1.0 - smoothstep(',
    '    localFront - softLead * 0.82 + wobble,',
    '    localFront + softTrail * 0.88 + wobble,',
    '    dist',
    '  );',
    '  float revealWide = 1.0 - smoothstep(',
    '    localFront - softLead * 1.58 + wobble * 0.8,',
    '    localFront + softTrail * 1.78 + wobble * 0.8,',
    '    dist',
    '  );',
    '  float reveal = max(revealCore, revealWide * mix(0.56, 0.38, smoothstep(0.0, 0.52, s)));',
    '  vec2 pulseRel = rel + vec2(',
    '    sin(wt * 1.58 + uv.x * 5.8) * 0.034,',
    '    cos(wt * 1.32 + uv.y * 4.2) * 0.028',
    '  ) * early;',
    '  vec2 waveRel = pulseRel * mix(vec2(1.42, 0.84), vec2(0.90, 0.92), isCompact);',
    '  float rel2 = dot(waveRel, waveRel);',
    '  float pulseDist = length(pulseRel * mix(vec2(0.62, 1.08), vec2(1.02, 0.94), isCompact));',
    '  float originCore = exp(-rel2 * mix(2.1, 3.4, isCompact)) * (1.0 + early * 0.14);',
    '  float originHalo = exp(-rel2 * mix(0.82, 1.05, isCompact)) * (0.52 + early * 0.22);',
    '  float originWide = exp(-pulseDist * mix(1.05, 1.42, isCompact)) * (0.34 + early * 0.26);',
    '  float originMist = exp(-pulseDist * mix(0.58, 0.82, isCompact)) * early * mix(0.34, 0.42, isCompact);',
    '  float originPulse = (originCore + originHalo + originWide + originMist)',
    '    * (1.0 - smoothstep(0.18, 0.82, s)) * onset',
    '    * mix(1.0, 1.24, isCompact)',
    '    * mix(0.40, 1.0, smoothstep(0.18, 0.56, s));',
    '  float travelMist = exp(-max(dist - localFront * 0.35, 0.0) * 2.4) * s * 0.28 * onset;',
    '  float flowSheet = exp(-abs(dist - localFront * 0.46 - flowWave * 3.0) * 2.1)',
    '    * early * 0.44 * onset;',
    '  float flowDrift = sin(wt * 2.0 + uv.x * 7.6 + uv.y * 2.0)',
    '    * 0.5 + sin(wt * 1.48 - uv.y * 5.0) * 0.5;',
    '  flowSheet *= mix(0.68, 1.0, flowDrift);',
    '  reveal *= mix(0.12, 1.0, onset);',
    '  return clamp(max(reveal, max(max(originPulse, travelMist), flowSheet)), 0.0, 1.0);',
    '}',
    '',
    'vec3 meshWarmGradient(vec2 uv, float time, float audio) {',
    '  float mt = time * (1.34 + audio * 0.22);',
    '  float warpAmt = 0.026 + audio * 0.010;',
    '  vec2 warp = vec2(',
    '    fbm(uv * 1.8 + mt * 0.062) - 0.5,',
    '    fbm(uv * 1.8 + vec2(17.3, 9.1) + mt * 0.055) - 0.5',
    '  ) * warpAmt;',
    '  vec2 u = uv + warp;',
    '',
    '  vec2 a1 = u_origin + vec2(sin(mt * 0.36) * 0.024, cos(mt * 0.31) * 0.020);',
    '  vec2 a2 = u_origin + vec2(-0.14, 0.10) + vec2(cos(mt * 0.28) * 0.026, sin(mt * 0.26) * 0.022);',
    '  vec2 a3 = u_origin + vec2(-0.26, 0.20) + vec2(sin(mt * 0.24) * 0.028, cos(mt * 0.30) * 0.024);',
    '  vec2 a4 = u_origin + vec2(-0.38, 0.30) + vec2(cos(mt * 0.32) * 0.024, sin(mt * 0.28) * 0.021);',
    '  vec2 a5 = u_origin + vec2(-0.48, 0.38) + vec2(sin(mt * 0.27) * 0.022, cos(mt * 0.25) * 0.019);',
    '',
    '  vec3 deepPink = vec3(1.0, 0.616, 0.855);',
    '  vec3 pink = vec3(1.0, 0.722, 0.894);',
    '  vec3 lightPink = vec3(1.0, 0.831, 0.933);',
    '  vec3 palePink = vec3(1.0, 0.918, 0.973);',
    '  vec3 whitePink = vec3(1.0, 0.973, 0.988);',
    '',
    '  float falloff = 1.38;',
    '  float w1 = 1.0 / (pow(length(u - a1), falloff) + 0.078);',
    '  float w2 = 1.0 / (pow(length(u - a2), falloff) + 0.078);',
    '  float w3 = 1.0 / (pow(length(u - a3), falloff) + 0.078);',
    '  float w4 = 1.0 / (pow(length(u - a4), falloff) + 0.078);',
    '  float w5 = 1.0 / (pow(length(u - a5), falloff) + 0.078);',
    '  float wSum = w1 + w2 + w3 + w4 + w5;',
    '  vec3 col = (deepPink * w1 + whitePink * w2 + palePink * w3 + lightPink * w4 + pink * w5) / wSum;',
    '  return col * 1.06;',
    '}',
    '',
    'vec3 meshTest1GleamGradient(vec2 uv, float time, float audio) {',
    '  float mt = time * (1.36 + audio * 0.08);',
    '  float warpAmt = 0.034 + audio * 0.010;',
    '  vec2 warp = vec2(',
    '    fbm(uv * 2.0 + mt * 0.055) - 0.5,',
    '    fbm(uv * 2.0 + vec2(11.1, 7.4) + mt * 0.048) - 0.5',
    '  ) * warpAmt;',
    '  vec2 u = uv + warp;',
    '  vec3 sage = vec3(0.808, 0.867, 0.839);',
    '  vec3 gleam = vec3(0.851, 0.796, 0.914);',
    '  vec3 white = vec3(1.0, 0.992, 1.0);',
    '  vec2 a1 = u_origin + vec2(sin(mt * 0.42) * 0.028, cos(mt * 0.36) * 0.024);',
    '  vec2 a2 = u_origin + vec2(-0.10, 0.12) + vec2(cos(mt * 0.31) * 0.022, sin(mt * 0.28) * 0.020);',
    '  vec2 a3 = u_origin + vec2(-0.18, 0.20) + vec2(sin(mt * 0.26) * 0.024, cos(mt * 0.30) * 0.018);',
    '  float falloff = 1.16;',
    '  float w1 = 1.0 / (pow(length(u - a1), falloff) + 0.092);',
    '  float w2 = 1.0 / (pow(length(u - a2), falloff) + 0.098);',
    '  float w3 = 1.0 / (pow(length(u - a3), falloff) + 0.104);',
    '  float wSum = w1 + w2 + w3;',
    '  vec3 col = (gleam * w1 + white * w2 + sage * w3) / wSum;',
    '  return col * 1.08;',
    '}',
    '',
    'vec3 meshTest1PillGradient(vec2 uv, float time, float audio) {',
    '  float mt = time * (1.36 + audio * 0.08);',
    '  float warpAmt = 0.034 + audio * 0.010;',
    '  vec2 warp = vec2(',
    '    fbm(uv * 2.0 + mt * 0.055) - 0.5,',
    '    fbm(uv * 2.0 + vec2(11.1, 7.4) + mt * 0.048) - 0.5',
    '  ) * warpAmt;',
    '  vec2 u = uv + warp;',
    '  vec3 mint = vec3(0.616, 0.773, 0.718);',
    '  vec3 pink = vec3(0.933, 0.796, 1.0);',
    '  vec3 white = vec3(1.0, 0.992, 1.0);',
    '  vec2 a1 = u_origin + vec2(sin(mt * 0.42) * 0.028, cos(mt * 0.36) * 0.024);',
    '  vec2 a2 = u_origin + vec2(-0.10, 0.12) + vec2(cos(mt * 0.31) * 0.022, sin(mt * 0.28) * 0.020);',
    '  vec2 a3 = u_origin + vec2(-0.18, 0.20) + vec2(sin(mt * 0.26) * 0.024, cos(mt * 0.30) * 0.018);',
    '  float falloff = 1.16;',
    '  float w1 = 1.0 / (pow(length(u - a1), falloff) + 0.092);',
    '  float w2 = 1.0 / (pow(length(u - a2), falloff) + 0.098);',
    '  float w3 = 1.0 / (pow(length(u - a3), falloff) + 0.104);',
    '  float wSum = w1 + w2 + w3;',
    '  vec3 col = (pink * w1 + white * w2 + mint * w3) / wSum;',
    '  return col * 1.08;',
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
    'float edgePerimeterSweep(vec2 uv, vec2 p, float sdf, float aspect, float sweep, float time) {',
    '  if (sweep <= 0.001) return 0.0;',
    '  float distFromEdge = abs(sdf);',
    '  float perimeter = exp(-distFromEdge * mix(11.5, 16.5, sweep));',
    '  float depthIn = clamp(-sdf / max(u_radius * 1.55, 0.06), 0.0, 1.0);',
    '  float edgeBand = perimeter * (1.0 - smoothstep(0.0, 0.56, depthIn));',
    '  float softRing = exp(-distFromEdge * 8.2) * (1.0 - smoothstep(0.0, 0.68, depthIn));',
    '  float outerBleed = exp(-max(sdf, 0.0) * 14.5)',
    '    * (1.0 - smoothstep(0.0, 0.040, max(-sdf, 0.0))) * 0.68;',
    '  edgeBand = max(edgeBand, max(softRing * 0.78, outerBleed));',
    '  vec2 originPlane = vec2((u_origin.x - 0.5) * aspect, u_origin.y - 0.5);',
    '  float startAngle = atan(originPlane.y, originPlane.x + 0.0001);',
    '  float pointAngle = atan(p.y, p.x + 0.0001);',
    '  float posFromStart = fract((pointAngle - startAngle) / 6.28318530718 + 1.0);',
    '  float head = clamp(sweep, 0.0, 1.0);',
    '  float passed = 1.0 - smoothstep(head - 0.022, head + 0.034, posFromStart);',
    '  float trailDist = head - posFromStart;',
    '  if (trailDist < 0.0) trailDist = 0.0;',
    '  float trail = smoothstep(0.0, 0.08, trailDist)',
    '    * (1.0 - smoothstep(0.12, 0.50, trailDist));',
    '  float headDist = abs(posFromStart - head);',
    '  headDist = min(headDist, 1.0 - headDist);',
    '  float headGlow = exp(-headDist * 16.0) * smoothstep(0.02, 0.10, head);',
    '  float headWide = exp(-headDist * 7.2) * 0.52 * smoothstep(0.02, 0.10, head);',
    '  float wave = sin(time * 1.28 + posFromStart * 6.28318530718',
    '    + fbm(uv * 3.1 + time * 0.08) * 4.4) * 0.5 + 0.5;',
    '  float ripple = sin(time * 1.62 + depthIn * 7.4 - posFromStart * 11.0',
    '    + fbm(uv * 2.5 + time * 0.09) * 3.2) * 0.5 + 0.5;',
    '  float waver = 0.82 + wave * 0.12 + ripple * 0.08;',
    '  float lit = max(max(trail * 0.92, headGlow * 1.34 + headWide), passed * trail * 0.58);',
    '  lit *= waver;',
    '  float handoff = 1.0 - smoothstep(0.90, 1.0, sweep) * smoothstep(0.0, 0.18, u_spread);',
    '  lit *= mix(1.0, max(handoff, 0.42), smoothstep(0.92, 1.0, sweep));',
    '  return clamp(edgeBand * lit * 1.12, 0.0, 1.0);',
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
    '  float shapeAlpha = u_variant >= 1.5',
    '    ? (1.0 - smoothstep(-0.018, 0.042, sdf))',
    '    : mix(',
    '        1.0 - smoothstep(-0.018, 0.048, sdf),',
    '        1.0 - smoothstep(-0.042, 0.072, sdf),',
    '        morphEarly',
    '      );',
    '  if (shapeAlpha < 0.001) discard;',
    '',
    '  float depth = clamp(-sdf / 0.36, 0.0, 1.0);',
    '',
    '  vec2 rel = vec2(',
    '    (uv.x - u_origin.x) * mix(u_aspect, u_virtAspect, step(0.5, u_compact)),',
    '    (uv.y - u_origin.y) * mix(1.0, 0.72, step(0.5, u_compact))',
    '  );',
    '',
    '  float reveal = organicReveal(uv, rel, sdf, u_spread, u_time, u_audio)',
    '    * smoothstep(0.82, 0.98, u_sweep);',
    '',
    '  vec3 mesh = u_variant >= 2.5',
    '    ? meshTest1PillGradient(uv, u_time, u_audio)',
    '    : u_variant >= 1.5',
    '      ? meshTest1GleamGradient(uv, u_time, u_audio)',
    '      : meshWarmGradient(uv, u_time, u_audio);',
    '  float sweepMask = edgePerimeterSweep(uv, p, sdf, u_aspect, u_sweep, u_time);',
    '  float tightness = smoothstep(0.38, 0.98, handoffT);',
    '  float spreadShimmer = 1.0 - smoothstep(0.04, 0.78, u_spread);',
    '  float colorLift = morph > 0.04',
    '    ? (1.0 + 0.016 * sin(u_time * 0.86 + fbm(uv * 2.6 + u_time * 0.05) * 4.8))',
    '    : (1.0 + 0.072 * sin(u_time * 1.82 + uv.x * 7.2 + uv.y * 5.0)',
    '      + 0.038 * sin(u_time * 1.34 + fbm(uv * 2.2 + u_time * 0.068) * 5.6)',
    '      + spreadShimmer * 0.048 * sin(u_time * 2.55 + uv.x * 11.0 + uv.y * 3.0));',
    '  vec3 color = mesh * colorLift;',
    '  float grain = (hash(floor(uv * 520.0) + floor(u_time * 6.0)) - 0.5) * 0.018;',
    '',
    '  float fillMask = clamp(reveal * u_intensity, 0.0, 1.0);',
    '  float edgeMask = edgeRingHandoff(uv, p, sdf, u_aspect, tightness, u_time);',
    '  float edgeSweepFill = sweepMask * u_intensity * (1.0 - smoothstep(0.0, 0.24, u_spread));',
    '  float centerFill = fillMask * (1.0 - morph);',
    '  float edgeFill = edgeMask * u_intensity * morph * 0.84;',
    '  float combinedMask = max(max(centerFill, edgeFill), edgeSweepFill);',
    '  color += mesh * edgeFill * 0.28;',
    '  color += mesh * edgeSweepFill * 0.42;',
    '  color += vec3(0.10, 0.05, 0.08) * edgeSweepFill * 0.36;',
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

  function easeInOutQuint(t) {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
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

  function easeGlowRetire(t) {
    return 1 - Math.pow(1 - t, 1.75);
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

  function pickTest2FillCanvas() {
    var result = document.getElementById('p2-result');
    var shell = document.getElementById('p2-area');
    if (shell && shell.classList.contains('p2-contact-voice-renew')) {
      var renewFooter = document.querySelector(
        '.p2-agent-footer .p2-agent-input .p2-agent-fill__gl'
      );
      if (renewFooter) return renewFooter;
    }
    if (result && result.classList.contains('is-loading') && !result.classList.contains('has-swap')) {
      var chromeHandoff =
        (shell && shell.classList.contains('p2-loading-chrome-exiting')) ||
        (shell && shell.classList.contains('p2-loading-footer-handoff')) ||
        result.classList.contains('p2-loading-ui-exiting');
      if (chromeHandoff) {
        var footerCanvas = document.querySelector(
          '.p2-agent-footer .p2-agent-input .p2-agent-fill__gl'
        );
        if (footerCanvas) return footerCanvas;
      }
      var loadingCanvas = document.querySelector('.p2-result-loading__input .p2-agent-fill__gl');
      if (loadingCanvas) return loadingCanvas;
    }
    return document.querySelector('.p2-agent-input .p2-agent-fill__gl');
  }

  function isTest3Scope() {
    var canvas = document.getElementById('canvas');
    if (canvas && canvas.getAttribute('data-test-scope') === 'test3') return true;
    return !!(window.__mlpTestConfig && window.__mlpTestConfig.id === 'test3');
  }

  function isTest1Scope() {
    var canvas = document.getElementById('canvas');
    if (canvas && canvas.getAttribute('data-test-scope') === 'test1') return true;
    return !!(window.__mlpTestConfig && window.__mlpTestConfig.id === 'test1');
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

  var LISTEN_SWEEP_PORTION = 0.28;
  var INPUT_VIRT_ASPECT = 1.65;

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
    this.values = { spread: 0, intensity: 0, fill: 0, sweep: 0 };
    this.audio = 0;
    this.smoothAudio = 0;
    this.startTime = 0;
    this.layout = { aspect: 1, radius: 0.24, compact: 0, virtAspect: INPUT_VIRT_ASPECT };
    this._layoutCache = { w: 0, h: 0, aspect: 0 };
    this._resizeLock = false;
    this.resizeObserver = null;
    this.uniforms = {};
    this._onFrame = this._tick.bind(this);
  }

  AgentFillGL.prototype._fillRect = function () {
    if (!this.fillEl) return null;
    var rect = this.fillEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return rect;
  };

  AgentFillGL.prototype._updateLayout = function () {
    var rect = this._fillRect();
    if (!rect) return;
    this.layout.aspect = rect.width / rect.height;
    this.layout.radius = Math.min(22, rect.height * 0.5) / rect.height;
  };

  AgentFillGL.prototype._getOrigin = function () {
    var fill = this._fillRect();
    if (!fill) return [0.92, 0.10];
    var isLoadingInput = this.fillEl && this.fillEl.closest('.p2-result-loading__input');
    var isInput = isLoadingInput || (this.fillEl && this.fillEl.closest('.p2-agent-input'));
    var star = document.getElementById('p2-star');
    var loadIcon = isLoadingInput
      ? (this.fillEl.closest('.p2-result-loading') || document).querySelector('.p2-result-loading__icon')
      : null;
    var anchor = loadIcon || star;
    if (!anchor) return isInput ? [0.06, 0.50] : [0.92, 0.10];
    var btn = anchor.getBoundingClientRect();
    var btnX = (btn.left + btn.width * 0.5 - fill.left) / fill.width;
    var btnY = 1 - (btn.top + btn.height * 0.5 - fill.top) / fill.height;
    if (isInput) {
      return [
        clamp(btnX * 0.52 + 0.98 * 0.48, 0.88, 1.06),
        clamp(btnY * 0.62 + 0.5 * 0.38, 0.40, 0.60)
      ];
    }
    var cornerX = clamp((fill.width - 8) / fill.width, 0, 1);
    var cornerY = clamp(8 / fill.height, 0, 1);
    return [
      clamp(btnX * 0.35 + cornerX * 0.65, 0, 1),
      clamp(btnY * 0.35 + cornerY * 0.65, 0, 1)
    ];
  };

  AgentFillGL.prototype._resize = function (force) {
    if (!this.canvas || !this.gl || !this.fillEl || this._resizeLock) return;
    var rect = this._fillRect();
    if (!rect) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    var aspect = rect.width / rect.height;
    var cache = this._layoutCache;
    var sizeChanged = force || cache.w !== w || cache.h !== h;
    if (sizeChanged) {
      this._resizeLock = true;
      try {
        var cssW = Math.round(rect.width) + 'px';
        var cssH = Math.round(rect.height) + 'px';
        this.canvas.width = w;
        this.canvas.height = h;
        if (this.canvas.style.width !== cssW) this.canvas.style.width = cssW;
        if (this.canvas.style.height !== cssH) this.canvas.style.height = cssH;
        this.gl.viewport(0, 0, w, h);
        cache.w = w;
        cache.h = h;
      } finally {
        this._resizeLock = false;
      }
    }
    if (sizeChanged || Math.abs(cache.aspect - aspect) > 0.002) {
      this.layout.aspect = aspect;
      this.layout.radius = Math.min(22, rect.height * 0.5) / rect.height;
      cache.aspect = aspect;
    }
    this.layout.compact = (this.fillEl.closest('.p2-agent-input') ||
      this.fillEl.closest('.p2-result-loading__input')) ? 1 : 0;
  };

  function getPhaseConfig(phaseName) {
    var next = PHASES[phaseName] || PHASES.idle;
    if (!isTest2Scope()) return next;
    if (phaseName === 'generating') {
      return { spread: 1.42, intensity: 1.0, fill: 0.0, duration: 3200 };
    }
    if (phaseName === 'hollowReveal') {
      return { spread: 1.42, intensity: 0.86, fill: 0.74, duration: 780 };
    }
    if (phaseName === 'settling') {
      return { spread: 1.42, intensity: 0.20, fill: 1.0, duration: 380 };
    }
    if (phaseName === 'fadeOut') {
      return { spread: 1.42, intensity: 0.0, fill: 0.0, duration: 1420 };
    }
    return next;
  }

  AgentFillGL.prototype._finishFadeOutTail = function () {
    if (this._fadeTailDone || !isTest2Scope()) return;
    this._fadeTailDone = true;
    var self = this;
    var shell = this.shellEl;
    var fill = this.fillEl;
    setTimeout(function () {
      self.phase = 'idle';
      if (fill) {
        fill.classList.remove('p2-agent-fill--gl-active');
        fill.classList.remove('p2-agent-fill--gl-fading');
      }
      if (shell) shell.classList.remove('p2-agent-shell--gl-fill');
      self._stopLoop(true);
      setTimeout(function () {
        if (!shell) return;
        shell.classList.remove(
          'p2-agent-shell--glow-retire',
          'p2-agent-shell--flow-handoff',
          'p2-loading-chrome-exiting',
          'p2-loading-footer-handoff'
        );
      }, 560);
    }, 420);
  };

  AgentFillGL.prototype._setPhaseTargets = function (phaseName) {
    var next = getPhaseConfig(phaseName);
    this.phase = phaseName;
    this.phaseStart = performance.now();
    this._fadeTailDone = false;
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
    if (
      phaseName === 'generating' &&
      isTest2Scope() &&
      this.phaseFrom.spread < 0.12
    ) {
      this.phaseDuration = 5200;
    }
    if (this.fillEl) {
      if (phaseName !== 'idle') {
        this.fillEl.classList.add('p2-agent-fill--gl-active');
        this.fillEl.classList.remove('p2-agent-fill--gl-fading');
      } else {
        this.fillEl.classList.remove('p2-agent-fill--gl-active');
        this.fillEl.classList.remove('p2-agent-fill--gl-fading');
      }
      if (phaseName === 'fadeOut') {
        this.fillEl.classList.add('p2-agent-fill--gl-fading');
      }
    }
    if (this.shellEl) {
      var voiceRenew = this.shellEl.classList.contains('p2-contact-voice-renew');
      if (isTest2Scope() && (phaseName === 'fadeOut' || phaseName === 'settling')) {
        this.shellEl.classList.add('p2-agent-shell--glow-retire');
      } else if (
        isTest2Scope() &&
        (phaseName === 'idle' || phaseName === 'listening' || phaseName === 'generating')
      ) {
        this.shellEl.classList.remove('p2-agent-shell--glow-retire');
      }
      if (
        !voiceRenew &&
        (phaseName === 'listening' || phaseName === 'generating' ||
        phaseName === 'hollowReveal' || phaseName === 'handoff' ||
        phaseName === 'settling' || phaseName === 'fadeOut')
      ) {
        this.shellEl.classList.add('p2-agent-shell--gl-fill');
      } else if (phaseName === 'idle' || voiceRenew) {
        this.shellEl.classList.remove('p2-agent-shell--gl-fill');
      }
    }
    if (phaseName === 'fadeOut' && isTest2Scope()) {
      var fadeMs = next.duration;
      var layoutMs = Math.round(fadeMs * 0.94);
      setTimeout(function () {
        try {
          document.dispatchEvent(new CustomEvent('p2-test2-fill-fadeout'));
        } catch (e) { /* noop */ }
      }, layoutMs);
    }
  };

  AgentFillGL.prototype.setPhase = function (phaseName) {
    if (!this.ready || prefersReducedMotion()) return;
    if (phaseName === 'listening') {
      this.values.spread = 0;
      this.values.intensity = 0;
      this.values.fill = 0;
      this.values.sweep = 0;
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
      var sweepPortion = isTest2Scope() ? 0.14 : LISTEN_SWEEP_PORTION;
      if (t < sweepPortion) {
        var sweepT = t / sweepPortion;
        this.values.sweep = easeOutCubic(sweepT);
        this.values.spread = 0;
        this.values.intensity = easeListenIntensity(sweepT * 0.78);
        this.values.fill = 0;
      } else {
        var fillT = (t - sweepPortion) / (1 - sweepPortion);
        this.values.sweep = 1;
        this.values.spread = lerp(
          this.phaseFrom.spread,
          this.phaseTo.spread,
          easeListeningSpread(fillT)
        );
        this.values.intensity = lerp(
          this.phaseFrom.intensity,
          this.phaseTo.intensity,
          easeListenIntensity(0.62 + fillT * 0.38)
        );
        this.values.fill = 0;
      }
      this._maybeAdvancePhase(t);
      return;
    }
    if (this.phase === 'generating') {
      eased = isTest2Scope()
        ? easeListeningSpread(t)
        : easeContinueSpread(t, this.phaseFrom.spread);
    } else if (this.phase === 'hollowReveal') {
      eased = isTest2Scope() ? easeOutCubic(t) : easeOutQuint(t);
    } else if (this.phase === 'handoff') {
      eased = easeInOutCubic(t);
    } else if (this.phase === 'fadeOut') {
      eased = easeGlowRetire(t);
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
    gl.uniform1f(this.uniforms.sweep, this.values.sweep);
    gl.uniform1f(this.uniforms.audio, this.smoothAudio);
    gl.uniform1f(this.uniforms.compact, this.layout.compact || 0);
    gl.uniform1f(this.uniforms.virtAspect, this.layout.virtAspect || INPUT_VIRT_ASPECT);
    if (this.uniforms.variant) {
      gl.uniform1f(this.uniforms.variant, this._meshVariant || 0);
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (this.phase === 'idle' && this.phaseDuration > 0 && now - this.phaseStart >= this.phaseDuration) {
      this._stopLoop(true);
    }
    if (this.phase === 'fadeOut' && now - this.phaseStart >= this.phaseDuration) {
      if (isTest2Scope()) {
        this._finishFadeOutTail();
      } else {
        this.phase = 'idle';
        if (this.fillEl) {
          this.fillEl.classList.remove('p2-agent-fill--gl-active');
          this.fillEl.classList.remove('p2-agent-fill--gl-fading');
        }
        if (this.shellEl) this.shellEl.classList.remove('p2-agent-shell--gl-fill');
        this._stopLoop(true);
      }
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
    if (this.resizeObserver) {
      if (this.fillEl) this.resizeObserver.unobserve(this.fillEl);
      if (this.shellEl && this.shellEl !== this.fillEl) {
        this.resizeObserver.unobserve(this.shellEl);
      }
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
    var preserved = null;
    if (this.ready && isTest2Scope() && this.canvas && canvas && this.canvas !== canvas) {
      preserved = {
        phase: this.phase,
        values: {
          spread: this.values.spread,
          intensity: this.values.intensity,
          fill: this.values.fill,
          sweep: this.values.sweep
        },
        smoothAudio: this.smoothAudio,
        startTime: this.startTime
      };
    }
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
      sweep: gl.getUniformLocation(program, 'u_sweep'),
      audio: gl.getUniformLocation(program, 'u_audio'),
      compact: gl.getUniformLocation(program, 'u_compact'),
      virtAspect: gl.getUniformLocation(program, 'u_virtAspect'),
      variant: gl.getUniformLocation(program, 'u_variant')
    };

    this.ready = true;
    if (preserved && preserved.phase && preserved.phase !== 'idle') {
      this.values.spread = preserved.values.spread;
      this.values.intensity = preserved.values.intensity;
      this.values.fill = preserved.values.fill;
      this.values.sweep = preserved.values.sweep;
      this.smoothAudio = preserved.smoothAudio;
      this.startTime = preserved.startTime;
      this._setPhaseTargets(preserved.phase);
      this._startLoop();
    } else {
      this.startTime = performance.now();
      this._setPhaseTargets('idle');
    }
    this.fillEl.classList.add('p2-agent-fill--gl-ready');
    this._resize(true);

    var self = this;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(function () {
        if (self._resizeLock) return;
        self._resize(true);
      });
      this.resizeObserver.observe(this.fillEl);
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
    var canvas = pickTest2FillCanvas();
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

  function Test3MusicFillGL() {
    AgentFillGL.call(this);
    this._meshVariant = 1;
  }
  Test3MusicFillGL.prototype = Object.create(AgentFillGL.prototype);
  Test3MusicFillGL.prototype.constructor = Test3MusicFillGL;

  Test3MusicFillGL.prototype._getOrigin = function () {
    /* Left orb anchor — fill sweeps orange → cream left-to-right (image 1). */
    return [0.11, 0.5];
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
      audio: gl.getUniformLocation(program, 'u_audio'),
      variant: gl.getUniformLocation(program, 'u_variant')
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

  function Test1HomeWidgetFillGL() {
    AgentFillGL.call(this);
    this._meshVariant = 2;
    this._origin = [0.08, 0.11];
  }
  Test1HomeWidgetFillGL.prototype = Object.create(AgentFillGL.prototype);
  Test1HomeWidgetFillGL.prototype.constructor = Test1HomeWidgetFillGL;

  Test1HomeWidgetFillGL.prototype._getOrigin = function () {
    return this._origin.slice();
  };

  Test1HomeWidgetFillGL.prototype._maybeAdvancePhase = function () {};

  var TEST1_HOME_GL_PULSE_MS = 5200;
  var TEST1_HOME_GL_EXPAND_RATIO = 3200 / 5200;

  Test1HomeWidgetFillGL.prototype._getPhaseConfig = function (phaseName) {
    var isFood = this.shellEl && this.shellEl.classList.contains('test1-home-food');
    if (phaseName === 'generating') {
      return {
        spread: isFood ? 1.45 : 1.38,
        intensity: isFood ? 0.82 : 0.72,
        fill: 0,
        duration: TEST1_HOME_GL_PULSE_MS
      };
    }
    if (phaseName === 'fadeOut') {
      return {
        spread: isFood ? 1.45 : 1.38,
        intensity: 0,
        fill: 0,
        duration: 2000
      };
    }
    return PHASES[phaseName] || PHASES.idle;
  };

  Test1HomeWidgetFillGL.prototype._pulseWave = function (t, cycles) {
    var wave = Math.sin(t * Math.PI * 2 * cycles) * 0.5 + 0.5;
    return wave * wave * (3 - 2 * wave);
  };

  Test1HomeWidgetFillGL.prototype._updateValues = function (now) {
    if (this.phase !== 'generating') {
      AgentFillGL.prototype._updateValues.call(this, now);
      return;
    }
    var t = this.phaseDuration > 0
      ? clamp((now - this.phaseStart) / this.phaseDuration, 0, 1)
      : 1;
    var isFood = this.shellEl && this.shellEl.classList.contains('test1-home-food');
    var expandRatio = TEST1_HOME_GL_EXPAND_RATIO;
    var pulseT;
    var opacityMul = 1;
    if (t <= expandRatio) {
      var expandT = t / expandRatio;
      expandT = 1 - Math.pow(1 - expandT, 2.1);
      pulseT = expandT;
    } else {
      var contractT = (t - expandRatio) / (1 - expandRatio);
      contractT = contractT * contractT * (3 - 2 * contractT);
      pulseT = 1 - contractT;
    }
    if (this._crossfadeUntil && now <= this._crossfadeUntil) {
      var crossT = clamp((now - this._crossfadeStart) / this._crossfadeDur, 0, 1);
      opacityMul = 1 - crossT;
    }
    if (isFood) {
      this.values.spread = lerp(0.34, 1.45, pulseT);
      this.values.intensity = lerp(0.12, 0.82, pulseT) * opacityMul;
    } else {
      this.values.spread = lerp(0.28, 1.38, pulseT);
      this.values.intensity = lerp(0.1, 0.72, pulseT) * opacityMul;
    }
    this.values.fill = 0;
    this.values.sweep = 1;
  };

  Test1HomeWidgetFillGL.prototype._resize = function (force) {
    AgentFillGL.prototype._resize.call(this, force);
    var rect = this._fillRect();
    if (!rect) return;
    this.layout.radius = Math.min(42, rect.height * 0.5) / rect.height;
  };

  Test1HomeWidgetFillGL.prototype.setPhase = function (phaseName) {
    if (!this.ready || prefersReducedMotion()) return;
    if (phaseName === 'generating') {
      this.values.sweep = 1;
      this.values.spread = 0;
      this.values.intensity = 0;
      this.values.fill = 0;
      this.smoothAudio = 0;
    }
    AgentFillGL.prototype.setPhase.call(this, phaseName);
  };

  Test1HomeWidgetFillGL.prototype._setPhaseTargets = function (phaseName) {
    var next = this._getPhaseConfig(phaseName);
    this.phase = phaseName;
    this.phaseStart = performance.now();
    this._fadeTailDone = false;
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
        this.fillEl.classList.add('p2-agent-fill--gl-fading');
      }
    }
    if (this.shellEl) {
      if (phaseName === 'generating' || phaseName === 'fadeOut') {
        this.shellEl.classList.add('test1-home-widget--gl-fill');
      } else if (phaseName === 'idle') {
        this.shellEl.classList.remove('test1-home-widget--gl-fill');
      }
    }
  };

  Test1HomeWidgetFillGL.prototype.destroy = function () {
    AgentFillGL.prototype.destroy.call(this);
    if (this.shellEl) this.shellEl.classList.remove('test1-home-widget--gl-fill');
  };

  Test1HomeWidgetFillGL.prototype.bind = function (canvas) {
    this.destroy();
    if (!canvas || prefersReducedMotion() || !isTest1Scope()) return false;

    this.canvas = canvas;
    this.fillEl = canvas.closest('.test1-home-widget__veil-gl');
    this.shellEl = canvas.closest('.test1-home-widget');
    if (!this.fillEl || !this.shellEl) return false;

    if (this.shellEl.classList.contains('test1-home-food')) {
      this._origin = [0.06, 0.07];
    } else {
      this._origin = [0.08, 0.11];
    }

    var gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false
    });
    if (!gl) {
      console.warn('[Test1HomeWidgetFillGL] WebGL unavailable');
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
      sweep: gl.getUniformLocation(program, 'u_sweep'),
      audio: gl.getUniformLocation(program, 'u_audio'),
      compact: gl.getUniformLocation(program, 'u_compact'),
      virtAspect: gl.getUniformLocation(program, 'u_virtAspect'),
      variant: gl.getUniformLocation(program, 'u_variant')
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
      this.resizeObserver.observe(this.fillEl);
      if (this.shellEl && this.shellEl !== this.fillEl) {
        this.resizeObserver.observe(this.shellEl);
      }
    }

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      self.destroy();
    }, false);

    return true;
  };

  var test1Instances = [];

  function bindTest1Canvases() {
    if (!isTest1Scope() || prefersReducedMotion()) return false;
    test1Instances.forEach(function (inst) { inst.destroy(); });
    test1Instances = [];
    var canvases = document.querySelectorAll(
      '#canvas[data-test-scope="test1"] .test1-home-widget__veil-gl-canvas'
    );
    if (!canvases.length) return false;
    var ok = false;
    canvases.forEach(function (canvas) {
      var inst = new Test1HomeWidgetFillGL();
      if (inst.bind(canvas)) {
        test1Instances.push(inst);
        ok = true;
      }
    });
    return ok;
  }

  window.Test1HomeWidgetFillGL = {
    startAll: function () {
      if (!bindTest1Canvases()) return;
      test1Instances.forEach(function (inst) {
        inst.setPhase('generating');
      });
    },
    crossfadeAll: function (duration) {
      var dur = duration || 2000;
      var now = performance.now();
      test1Instances.forEach(function (inst) {
        if (!inst.ready) return;
        inst._crossfadeStart = now;
        inst._crossfadeDur = dur;
        inst._crossfadeUntil = now + dur;
      });
    },
    fadeAll: function () {
      test1Instances.forEach(function (inst) {
        if (inst.ready) inst.setPhase('fadeOut');
      });
    },
    fadeWidgets: function (which) {
      test1Instances.forEach(function (inst) {
        if (!inst.ready || !inst.shellEl) return;
        var isFood = inst.shellEl.classList.contains('test1-home-food');
        if (which === 'top' && isFood) return;
        if (which === 'food' && !isFood) return;
        inst.setPhase('fadeOut');
      });
    },
    destroyAll: function () {
      test1Instances.forEach(function (inst) { inst.destroy(); });
      test1Instances = [];
    }
  };

  /* Keep in sync with surface-layout TEST1_PILL_PINK_FLOW_MS */
  var TEST1_PILL_PINK_FLOW_MS = 1667 + (1667 - 620) * 2;
  var TEST1_PILL_FLOW_SPREAD_MID = 0.92;
  var TEST1_PILL_FLOW_SPREAD_END = 1.42;
  var TEST1_PILL_FLOW_SPREAD_SPLIT = 0.58;
  /* Keep in sync with surface-layout TEST1_PILL_FILL_HOLD_MS / TEST1_PILL_GL_FADE_MS */
  var TEST1_PILL_FILL_HOLD_MS = 350;
  var TEST1_PILL_GL_FADE_MS = 1320;
  var TEST1_PILL_BG_REVEAL_START = -4;
  var TEST1_PILL_BG_REVEAL_END = 128;

  function Test1BottomPillFillGL() {
    AgentFillGL.call(this);
    this._meshVariant = 3;
    this._origin = [0.94, 0.5];
  }
  Test1BottomPillFillGL.prototype = Object.create(AgentFillGL.prototype);
  Test1BottomPillFillGL.prototype.constructor = Test1BottomPillFillGL;

  Test1BottomPillFillGL.prototype._getOrigin = function () {
    return this._origin.slice();
  };

  Test1BottomPillFillGL.prototype._maybeAdvancePhase = function () {};

  Test1BottomPillFillGL.prototype._getPhaseConfig = function (phaseName) {
    if (phaseName === 'pillFlow') {
      return {
        spread: TEST1_PILL_FLOW_SPREAD_END,
        intensity: 1.0,
        fill: 0.0,
        duration: TEST1_PILL_PINK_FLOW_MS
      };
    }
    if (phaseName === 'pillHold') {
      return {
        spread: TEST1_PILL_FLOW_SPREAD_END,
        intensity: 1.0,
        fill: 0.0,
        duration: TEST1_PILL_FILL_HOLD_MS
      };
    }
    if (phaseName === 'pillGlFade') {
      return {
        spread: TEST1_PILL_FLOW_SPREAD_END,
        intensity: 0.0,
        fill: 0.0,
        duration: TEST1_PILL_GL_FADE_MS
      };
    }
    return PHASES[phaseName] || PHASES.idle;
  };

  Test1BottomPillFillGL.prototype._updateValues = function (now) {
    if (this.phase === 'pillHold') {
      this.values.spread = TEST1_PILL_FLOW_SPREAD_END;
      this.values.intensity = 1.0;
      this.values.fill = 0;
      return;
    }
    if (this.phase === 'pillGlFade') {
      this.values.spread = TEST1_PILL_FLOW_SPREAD_END;
      this.values.intensity = 1.0;
      this.values.fill = 0;
      return;
    }
    if (this.phase !== 'pillFlow') {
      AgentFillGL.prototype._updateValues.call(this, now);
      return;
    }
    var t = this.phaseDuration > 0
      ? clamp((now - this.phaseStart) / this.phaseDuration, 0, 1)
      : 1;
    if (t < LISTEN_SWEEP_PORTION) {
      var sweepT = t / LISTEN_SWEEP_PORTION;
      this.values.sweep = easeOutCubic(sweepT);
      this.values.spread = 0;
      this.values.intensity = easeListenIntensity(sweepT * 0.78);
      this.values.fill = 0;
      return;
    }
    var fillT = (t - LISTEN_SWEEP_PORTION) / (1 - LISTEN_SWEEP_PORTION);
    this.values.sweep = 1;
    if (fillT < TEST1_PILL_FLOW_SPREAD_SPLIT) {
      var spreadT = fillT / TEST1_PILL_FLOW_SPREAD_SPLIT;
      this.values.spread = lerp(
        0,
        TEST1_PILL_FLOW_SPREAD_MID,
        easeListeningSpread(spreadT)
      );
    } else {
      var genT = (fillT - TEST1_PILL_FLOW_SPREAD_SPLIT) / (1 - TEST1_PILL_FLOW_SPREAD_SPLIT);
      this.values.spread = lerp(
        TEST1_PILL_FLOW_SPREAD_MID,
        TEST1_PILL_FLOW_SPREAD_END,
        easeSmoothFill(genT)
      );
    }
    this.values.intensity = lerp(
      0.48,
      1.0,
      easeListenIntensity(0.62 + fillT * 0.38)
    );
    this.values.fill = 0;
  };

  Test1BottomPillFillGL.prototype._resize = function (force) {
    AgentFillGL.prototype._resize.call(this, force);
    var rect = this._fillRect();
    if (!rect) return;
    this.layout.compact = 1;
    this.layout.virtAspect = rect.width / Math.max(rect.height, 1);
    this.layout.radius = Math.min(rect.height * 0.5, rect.width * 0.12) / rect.height;
  };

  Test1BottomPillFillGL.prototype.setPhase = function (phaseName) {
    if (!this.ready || prefersReducedMotion()) return;
    if (phaseName === 'pillFlow') {
      this.values.sweep = 0;
      this.values.spread = 0;
      this.values.intensity = 0;
      this.values.fill = 0;
      this.smoothAudio = 0;
      if (this.shellEl) {
        this.shellEl.style.setProperty('--test1-pill-bg-reveal', '-4%');
        this.shellEl.classList.remove('test1-bottom-pill--grad-settled');
      }
    }
    this._setPhaseTargets(phaseName);
    if (phaseName !== 'idle') this._startLoop();
    else this._stopLoop(true);
  };

  Test1BottomPillFillGL.prototype._setPhaseTargets = function (phaseName) {
    var next = this._getPhaseConfig(phaseName);
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
      if (phaseName === 'pillFlow' || phaseName === 'pillHold') {
        this.fillEl.classList.add('p2-agent-fill--gl-active');
        this.fillEl.classList.remove('p2-agent-fill--gl-fading');
        if (phaseName === 'pillHold') {
          this.fillEl.style.opacity = '1';
        }
      } else if (phaseName === 'pillGlFade') {
        this.fillEl.classList.add('p2-agent-fill--gl-fading');
        this.fillEl.classList.remove('p2-agent-fill--gl-active');
        this.fillEl.style.setProperty('--test1-pill-gl-dissolve', '128%');
        this.fillEl.style.opacity = '1';
      } else {
        this.fillEl.classList.remove('p2-agent-fill--gl-active');
        this.fillEl.classList.remove('p2-agent-fill--gl-fading');
      }
    }
    if (this.shellEl) {
      if (phaseName === 'pillFlow') {
        this.shellEl.classList.add('test1-bottom-pill--gl-fill');
      } else if (phaseName === 'pillHold' || phaseName === 'pillGlFade') {
        this._lockPillGradSettled();
      } else if (phaseName === 'idle') {
        this.shellEl.classList.remove('test1-bottom-pill--gl-fill');
      }
    }
  };

  Test1BottomPillFillGL.prototype._pillFlowFillT = function (now) {
    if (this.phase !== 'pillFlow' || this.phaseDuration <= 0) return 1;
    var t = clamp((now - this.phaseStart) / this.phaseDuration, 0, 1);
    if (t <= LISTEN_SWEEP_PORTION) return 0;
    return (t - LISTEN_SWEEP_PORTION) / (1 - LISTEN_SWEEP_PORTION);
  };

  Test1BottomPillFillGL.prototype._syncPillBgReveal = function (now) {
    if (!this.shellEl) return;
    var fillPct = 128;
    if (this.phase === 'pillFlow') {
      var fillT = this._pillFlowFillT(now);
      var revealT = easeSmoothFill(fillT);
      fillPct = TEST1_PILL_BG_REVEAL_START
        + revealT * (TEST1_PILL_BG_REVEAL_END - TEST1_PILL_BG_REVEAL_START);
    }
    this.shellEl.style.setProperty('--test1-pill-bg-reveal', fillPct + '%');
  };

  Test1BottomPillFillGL.prototype._syncGlLayerOpacity = function (opacity) {
    if (!this.fillEl) return;
    var a = clamp(opacity, 0, 1);
    this.fillEl.style.opacity = a < 0.004 ? '0' : String(a);
  };

  Test1BottomPillFillGL.prototype._syncGlDissolve = function (dissolveEase) {
    if (!this.fillEl) return;
    var retreat = TEST1_PILL_BG_REVEAL_END
      - dissolveEase * (TEST1_PILL_BG_REVEAL_END - TEST1_PILL_BG_REVEAL_START);
    this.fillEl.style.setProperty('--test1-pill-gl-dissolve', retreat + '%');
  };

  Test1BottomPillFillGL.prototype._lockPillGradSettled = function () {
    if (!this.shellEl) return;
    this.shellEl.classList.add('test1-bottom-pill--grad-settled');
    this.shellEl.style.setProperty('--test1-pill-bg-reveal', '128%');
  };

  Test1BottomPillFillGL.prototype._finishPillSweepIdle = function () {
    this.phase = 'idle';
    if (this.fillEl) {
      this.fillEl.classList.remove('p2-agent-fill--gl-active');
      this.fillEl.classList.remove('p2-agent-fill--gl-fading');
      this.fillEl.classList.remove('p2-agent-fill--gl-ready');
      this.fillEl.style.removeProperty('opacity');
      this.fillEl.style.removeProperty('--test1-pill-gl-dissolve');
    }
    if (this.shellEl) {
      this.shellEl.classList.remove('test1-bottom-pill--gl-fill');
      this.shellEl.classList.add('test1-bottom-pill--grad-settled');
      this.shellEl.style.setProperty('--test1-pill-bg-reveal', '128%');
    }
    this._stopLoop(true);
  };

  Test1BottomPillFillGL.prototype._draw = function (now) {
    AgentFillGL.prototype._draw.call(this, now);
    if (this.phase === 'pillFlow') {
      this._syncPillBgReveal(now);
    }
    if (this.phase === 'pillHold' || this.phase === 'pillGlFade') {
      this._lockPillGradSettled();
    }
    if (this.phase === 'pillHold') {
      this._syncGlLayerOpacity(1);
    }
    if (this.phase === 'pillGlFade' && this.phaseDuration > 0) {
      var glFadeT = clamp((now - this.phaseStart) / this.phaseDuration, 0, 1);
      var dissolveEase = easeInOutQuint(glFadeT);
      this._syncGlDissolve(dissolveEase);
      var opT = glFadeT < 0.5 ? 0 : (glFadeT - 0.5) / 0.5;
      var opEase = easeInOutQuint(opT);
      this._syncGlLayerOpacity(1.0 - opEase * 0.28);
    }
    if (this.phase === 'pillFlow' && this.phaseDuration > 0 && now - this.phaseStart >= this.phaseDuration) {
      this._syncPillBgReveal(now);
      this._setPhaseTargets('pillHold');
    }
    if (this.phase === 'pillHold' && this.phaseDuration > 0 && now - this.phaseStart >= this.phaseDuration) {
      this._setPhaseTargets('pillGlFade');
    }
    if (this.phase === 'pillGlFade' && this.phaseDuration > 0 && now - this.phaseStart >= this.phaseDuration) {
      this._finishPillSweepIdle();
    }
  };

  Test1BottomPillFillGL.prototype.destroy = function () {
    if (this.fillEl) {
      this.fillEl.classList.remove('p2-agent-fill--gl-active');
      this.fillEl.classList.remove('p2-agent-fill--gl-fading');
      this.fillEl.classList.remove('p2-agent-fill--gl-ready');
    }
    AgentFillGL.prototype.destroy.call(this);
    if (this.shellEl) {
      this.shellEl.classList.remove('test1-bottom-pill--gl-fill');
      this.shellEl.classList.add('test1-bottom-pill--grad-settled');
      this.shellEl.style.setProperty('--test1-pill-bg-reveal', '128%');
    }
  };

  Test1BottomPillFillGL.prototype.bind = function (canvas) {
    this.destroy();
    if (!canvas || prefersReducedMotion() || !isTest1Scope()) return false;

    this.canvas = canvas;
    this.fillEl = canvas.closest('.test1-bottom-pill__fill-gl');
    this.shellEl = canvas.closest('.test1-bottom-pill');
    if (!this.fillEl || !this.shellEl) return false;

    var gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false
    });
    if (!gl) {
      console.warn('[Test1BottomPillFillGL] WebGL unavailable');
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
      sweep: gl.getUniformLocation(program, 'u_sweep'),
      audio: gl.getUniformLocation(program, 'u_audio'),
      compact: gl.getUniformLocation(program, 'u_compact'),
      virtAspect: gl.getUniformLocation(program, 'u_virtAspect'),
      variant: gl.getUniformLocation(program, 'u_variant')
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
      this.resizeObserver.observe(this.fillEl);
      if (this.shellEl && this.shellEl !== this.fillEl) {
        this.resizeObserver.observe(this.shellEl);
      }
    }

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      self.destroy();
    }, false);

    return true;
  };

  var test1PillInstance = null;

  function bindTest1BottomPillCanvas() {
    if (!isTest1Scope() || prefersReducedMotion()) return false;
    if (test1PillInstance) {
      test1PillInstance.destroy();
      test1PillInstance = null;
    }
    var canvas = document.querySelector(
      '#test1-bottom-pill .test1-bottom-pill__fill-gl-canvas'
    );
    if (!canvas) return false;
    test1PillInstance = new Test1BottomPillFillGL();
    return test1PillInstance.bind(canvas);
  }

  window.Test1BottomPillFillGL = {
    start: function () {
      if (!bindTest1BottomPillCanvas()) return;
      test1PillInstance.setPhase('pillFlow');
    },
    stop: function () {
      if (test1PillInstance) test1PillInstance.destroy();
      test1PillInstance = null;
    }
  };
})();
