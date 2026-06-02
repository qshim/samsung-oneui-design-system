import { useRef, useCallback, useEffect } from 'react';
import './BorderGlow.css';

function parseHSL(hslStr) {
  var match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 40, s: 80, l: 80 };
  return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
}

function buildGlowVars(glowColor, intensity) {
  var parsed = parseHSL(glowColor);
  var base = parsed.h + 'deg ' + parsed.s + '% ' + parsed.l + '%';
  var opacities = [100, 60, 50, 40, 30, 20, 10];
  var keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
  var vars = {};
  for (var i = 0; i < opacities.length; i++) {
    vars['--glow-color' + keys[i]] =
      'hsl(' + base + ' / ' + Math.min(opacities[i] * intensity, 100) + '%)';
  }
  return vars;
}

var GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
var GRADIENT_KEYS = [
  '--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four',
  '--gradient-five', '--gradient-six', '--gradient-seven',
];
var COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function buildGradientVars(colors) {
  var vars = {};
  for (var i = 0; i < 7; i++) {
    var c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
    vars[GRADIENT_KEYS[i]] = 'radial-gradient(at ' + GRADIENT_POSITIONS[i] + ', ' + c + ' 0px, transparent 50%)';
  }
  vars['--gradient-base'] = 'linear-gradient(' + colors[0] + ' 0 100%)';
  return vars;
}

function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function easeInCubic(x) { return x * x * x; }

function animateValue(opts) {
  var start = opts.start != null ? opts.start : 0;
  var end = opts.end != null ? opts.end : 100;
  var duration = opts.duration != null ? opts.duration : 1000;
  var delay = opts.delay != null ? opts.delay : 0;
  var ease = opts.ease || easeOutCubic;
  var onUpdate = opts.onUpdate;
  var onEnd = opts.onEnd;
  var t0 = performance.now() + delay;
  function tick() {
    var elapsed = performance.now() - t0;
    var t = Math.min(elapsed / duration, 1);
    onUpdate(start + (end - start) * ease(t));
    if (t < 1) requestAnimationFrame(tick);
    else if (onEnd) onEnd();
  }
  setTimeout(function () { requestAnimationFrame(tick); }, delay);
}

/** React Bits BorderGlow — reusable wrapper. */
export default function BorderGlow({
  children,
  className = '',
  edgeSensitivity = 30,
  glowColor = '40 80 80',
  backgroundColor = '#120F17',
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1.0,
  coneSpread = 25,
  animated = false,
  colors = ['#c084fc', '#f472b6', '#38bdf8'],
  fillOpacity = 0.5,
}) {
  var cardRef = useRef(null);

  var getCenterOfElement = useCallback(function (el) {
    var rect = el.getBoundingClientRect();
    return [rect.width / 2, rect.height / 2];
  }, []);

  var getEdgeProximity = useCallback(function (el, x, y) {
    var center = getCenterOfElement(el);
    var cx = center[0];
    var cy = center[1];
    var dx = x - cx;
    var dy = y - cy;
    var kx = Infinity;
    var ky = Infinity;
    if (dx !== 0) kx = cx / Math.abs(dx);
    if (dy !== 0) ky = cy / Math.abs(dy);
    return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
  }, [getCenterOfElement]);

  var getCursorAngle = useCallback(function (el, x, y) {
    var center = getCenterOfElement(el);
    var cx = center[0];
    var cy = center[1];
    var dx = x - cx;
    var dy = y - cy;
    if (dx === 0 && dy === 0) return 0;
    var radians = Math.atan2(dy, dx);
    var degrees = radians * (180 / Math.PI) + 90;
    if (degrees < 0) degrees += 360;
    return degrees;
  }, [getCenterOfElement]);

  var handlePointerMove = useCallback(function (e) {
    var card = cardRef.current;
    if (!card) return;
    var rect = card.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var edge = getEdgeProximity(card, x, y);
    var angle = getCursorAngle(card, x, y);
    card.style.setProperty('--edge-proximity', (edge * 100).toFixed(3));
    card.style.setProperty('--cursor-angle', angle.toFixed(3) + 'deg');
  }, [getEdgeProximity, getCursorAngle]);

  useEffect(function () {
    if (!animated || !cardRef.current) return;
    var card = cardRef.current;
    var angleStart = 110;
    var angleEnd = 465;
    card.classList.add('sweep-active');
    card.style.setProperty('--cursor-angle', angleStart + 'deg');
    animateValue({ duration: 500, onUpdate: function (v) {
      card.style.setProperty('--edge-proximity', String(v));
    }});
    animateValue({ ease: easeInCubic, duration: 1500, end: 50, onUpdate: function (v) {
      card.style.setProperty('--cursor-angle', ((angleEnd - angleStart) * (v / 100) + angleStart) + 'deg');
    }});
    animateValue({ ease: easeOutCubic, delay: 1500, duration: 2250, start: 50, end: 100, onUpdate: function (v) {
      card.style.setProperty('--cursor-angle', ((angleEnd - angleStart) * (v / 100) + angleStart) + 'deg');
    }});
    animateValue({ ease: easeInCubic, delay: 2500, duration: 1500, start: 100, end: 0,
      onUpdate: function (v) { card.style.setProperty('--edge-proximity', String(v)); },
      onEnd: function () { card.classList.remove('sweep-active'); },
    });
  }, [animated]);

  var glowVars = buildGlowVars(glowColor, glowIntensity);
  var gradientVars = buildGradientVars(colors);

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      className={'border-glow-card ' + className}
      style={Object.assign({
        '--card-bg': backgroundColor,
        '--edge-sensitivity': edgeSensitivity,
        '--border-radius': borderRadius + 'px',
        '--glow-padding': glowRadius + 'px',
        '--cone-spread': coneSpread,
        '--fill-opacity': fillOpacity,
      }, glowVars, gradientVars)}
    >
      <span className="edge-light" />
      <div className="border-glow-inner">
        {children}
      </div>
    </div>
  );
}

export { buildGlowVars, buildGradientVars, animateValue, easeOutCubic, easeInCubic };
