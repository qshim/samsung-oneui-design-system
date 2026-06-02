import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, useMotionValue, useAnimationFrame, useTransform } from 'motion/react';
import styles from './GradientText.module.css';

export default function GradientText({
  children,
  className = '',
  colors = ['#5227FF', '#FF9FFC', '#B497CF'],
  animationSpeed = 8,
  showBorder = false,
  direction = 'horizontal',
  reverse = false,
  pauseOnHover = false,
  yoyo = true,
  settled = false,
  solidColor = '#4C5B17',
  inline = false,
  cycleLimit = 0,
  onCyclesComplete = null,
}) {
  var _a = useState(false);
  var isPaused = _a[0];
  var setIsPaused = _a[1];
  var _b = useState(false);
  var cyclesDone = _b[0];
  var setCyclesDone = _b[1];
  var progress = useMotionValue(0);
  var elapsedRef = useRef(0);
  var lastTimeRef = useRef(null);
  var completeCalledRef = useRef(false);

  var animationDuration = animationSpeed * 1000;
  var isStopped = settled || cyclesDone;

  useAnimationFrame(function (time) {
    if (isStopped || isPaused) {
      lastTimeRef.current = null;
      return;
    }

    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }

    var deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += deltaTime;

    if (cycleLimit > 0) {
      var fullCycle = animationDuration * (yoyo ? 2 : 1);
      var finishedCycles = Math.floor(elapsedRef.current / fullCycle);
      if (finishedCycles >= cycleLimit) {
        progress.set(100);
        if (!completeCalledRef.current) {
          completeCalledRef.current = true;
          setCyclesDone(true);
          if (typeof onCyclesComplete === 'function') {
            onCyclesComplete();
          }
        }
        return;
      }
    }

    if (yoyo) {
      var yoyoFull = animationDuration * 2;
      var cycleTime = elapsedRef.current % yoyoFull;

      if (cycleTime < animationDuration) {
        progress.set((cycleTime / animationDuration) * 100);
      } else {
        progress.set(100 - ((cycleTime - animationDuration) / animationDuration) * 100);
      }
    } else {
      progress.set((elapsedRef.current / animationDuration) * 100);
    }
  });

  useEffect(function () {
    elapsedRef.current = 0;
    completeCalledRef.current = false;
    setCyclesDone(false);
    progress.set(0);
  }, [animationSpeed, progress, yoyo, children, cycleLimit]);

  useEffect(function () {
    if (settled) {
      setCyclesDone(true);
    }
  }, [settled]);

  var backgroundPosition = useTransform(progress, function (p) {
    var pos = reverse ? 100 - p : p;
    if (direction === 'vertical') {
      return '50% ' + pos + '%';
    }
    return pos + '% 50%';
  });

  var handleMouseEnter = useCallback(function () {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);

  var handleMouseLeave = useCallback(function () {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  var gradientAngle =
    direction === 'horizontal'
      ? (reverse ? 'to left' : 'to right')
      : direction === 'vertical'
        ? (reverse ? 'to top' : 'to bottom')
        : (reverse ? 'to top left' : 'to bottom right');
  var gradientColors = colors.concat([colors[0]]).join(', ');

  var gradientStyle = {
    backgroundImage: 'linear-gradient(' + gradientAngle + ', ' + gradientColors + ')',
    backgroundSize:
      direction === 'horizontal' ? '300% 100%' : direction === 'vertical' ? '100% 300%' : '300% 300%',
    backgroundRepeat: 'repeat',
  };

  var rootClass = [
    styles.root,
    inline ? styles.rootInline : '',
    showBorder ? styles.withBorder : '',
    settled || cyclesDone ? styles.settled : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (settled || cyclesDone) {
    return (
      <span
        className={rootClass}
        style={{ color: solidColor, WebkitTextFillColor: solidColor }}
      >
        {children}
      </span>
    );
  }

  return (
    <motion.div
      className={rootClass}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showBorder && (
        <motion.div className={styles.overlay} style={Object.assign({}, gradientStyle, { backgroundPosition })} />
      )}
      <motion.span className="text-content" style={Object.assign({}, gradientStyle, { backgroundPosition })}>
        {children}
      </motion.span>
    </motion.div>
  );
}
