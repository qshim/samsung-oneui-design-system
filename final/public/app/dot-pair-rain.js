(function () {
  var _dotPairRainTimerIds = [];

  function groupPairRainCirclesByRow(circleEls, tolerance) {
    var tol = tolerance || 2.8;
    var rows = [];
    circleEls.forEach(function (c) {
      var cy = parseFloat(c.getAttribute('cy'));
      var row = null;
      for (var i = 0; i < rows.length; i++) {
        if (Math.abs(rows[i].cy - cy) < tol) {
          row = rows[i];
          break;
        }
      }
      if (row) row.circles.push(c);
      else rows.push({ cy: cy, circles: [c] });
    });
    rows.sort(function (a, b) { return a.cy - b.cy; });
    return rows;
  }

  function pairRainDismissOrder(circleEls) {
    return circleEls.slice().sort(function (a, b) {
      var cyA = parseFloat(a.getAttribute('cy'));
      var cyB = parseFloat(b.getAttribute('cy'));
      if (cyB !== cyA) return cyB - cyA;
      return parseFloat(a.getAttribute('cx')) - parseFloat(b.getAttribute('cx'));
    });
  }

  function initDotPairRainMotion(pairRoot) {
    if (!pairRoot) return;
    var svg = pairRoot.querySelector('.dot-w21__sun--pair-rain');
    if (!svg) return;

    if (svg.__pairRainTimers) {
      svg.__pairRainTimers.forEach(function (id) { clearTimeout(id); });
    }
    svg.__pairRainTimers = [];
    svg.__pairRainRunId = (svg.__pairRainRunId || 0) + 1;
    var runId = svg.__pairRainRunId;

    var g1 = svg.querySelector('.dot-w21__rain-g--1');
    var g2 = svg.querySelector('.dot-w21__rain-g--2');
    var g1Circles = g1 ? Array.prototype.slice.call(g1.querySelectorAll('circle')) : [];
    var g2Circles = g2 ? Array.prototype.slice.call(g2.querySelectorAll('circle')) : [];
    if (!g1Circles.length && !g2Circles.length) return;

    var rowStepMs = 90;
    var rowPopMs = 200;
    var g2GapMs = 120;
    var holdMs = 5000;
    var fallStepMs = 60;
    var fallMs = 240;
    var loopGapMs = 280;

    function schedule(fn, ms) {
      var id = setTimeout(fn, ms);
      svg.__pairRainTimers.push(id);
      _dotPairRainTimerIds.push(id);
      return id;
    }

    function prepCircle(c) {
      c.style.transformBox = 'fill-box';
      c.style.transformOrigin = 'center';
    }

    function resetCircles(list) {
      list.forEach(function (c) {
        prepCircle(c);
        c.style.transition = 'none';
        c.style.opacity = '0';
        c.style.transform = 'scale(0.35) translate(0, 0)';
      });
    }

    function showRow(circlesInRow) {
      circlesInRow.forEach(function (c) {
        prepCircle(c);
        c.style.transition = 'opacity ' + rowPopMs + 'ms ease, transform ' + rowPopMs + 'ms cubic-bezier(0.16, 1, 0.3, 1)';
        c.style.opacity = '1';
        c.style.transform = 'scale(1) translate(0, 0)';
      });
    }

    function fallCircle(c) {
      prepCircle(c);
      c.style.transition = 'opacity ' + fallMs + 'ms ease, transform ' + fallMs + 'ms cubic-bezier(0.45, 0, 0.9, 0.55)';
      c.style.opacity = '0';
      c.style.transform = 'scale(1) translate(0, 16px)';
    }

    function runCycle() {
      if (svg.__pairRainRunId !== runId) return;

      var all = g1Circles.concat(g2Circles);
      resetCircles(all);

      var g1Rows = groupPairRainCirclesByRow(g1Circles, 2.5);
      var g2Rows = groupPairRainCirclesByRow(g2Circles, 3);
      var delay = 0;

      g1Rows.forEach(function (row) {
        (function (circlesInRow, at) {
          schedule(function () {
            if (svg.__pairRainRunId !== runId) return;
            showRow(circlesInRow);
          }, at);
        })(row.circles, delay);
        delay += rowStepMs;
      });

      delay += g2GapMs;

      g2Rows.forEach(function (row) {
        (function (circlesInRow, at) {
          schedule(function () {
            if (svg.__pairRainRunId !== runId) return;
            showRow(circlesInRow);
          }, at);
        })(row.circles, delay);
        delay += rowStepMs;
      });

      delay += rowPopMs + holdMs;

      pairRainDismissOrder(g2Circles).forEach(function (c) {
        (function (circle, at) {
          schedule(function () {
            if (svg.__pairRainRunId !== runId) return;
            fallCircle(circle);
          }, at);
        })(c, delay);
        delay += fallStepMs;
      });

      delay += fallMs;

      pairRainDismissOrder(g1Circles).forEach(function (c) {
        (function (circle, at) {
          schedule(function () {
            if (svg.__pairRainRunId !== runId) return;
            fallCircle(circle);
          }, at);
        })(c, delay);
        delay += fallStepMs;
      });

      delay += fallMs + loopGapMs;
      schedule(runCycle, delay);
    }

    runCycle();
  }

  window.initDotPairRainMotion = initDotPairRainMotion;
  window.clearDotPairRainMotionTimers = function clearDotPairRainMotionTimers() {
    _dotPairRainTimerIds.forEach(function (id) { clearTimeout(id); });
    _dotPairRainTimerIds = [];
  };
})();
