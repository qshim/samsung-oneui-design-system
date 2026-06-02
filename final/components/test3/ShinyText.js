import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, useMotionValue, useAnimationFrame, useTransform } from 'motion/react';

function ShinyText({
  text,
  disabled = false,
  speed = 2,
  className = '',
  color = '#b5b5b5',
  shineColor = '#ffffff',
  shinePeakColor = null,
  spread = 120,
  yoyo = false,
  pauseOnHover = false,
  direction = 'left',
  delay = 0,
  shineBandStart = 35,
  shineBandEnd = 65,
  backgroundSize = '200% auto',
  passLimit = 0,
  onPassesComplete = null,
}) {
  var _a = useState(false);
  var isPaused = _a[0];
  var setIsPaused = _a[1];
  var _b = useState(false);
  var passesDone = _b[0];
  var setPassesDone = _b[1];
  var progress = useMotionValue(0);
  var elapsedRef = useRef(0);
  var lastTimeRef = useRef(null);
  var directionRef = useRef(direction === 'left' ? 1 : -1);
  var completeCalledRef = useRef(false);

  var animationDuration = speed * 1000;
  var delayDuration = delay * 1000;
  var isStopped = disabled || passesDone;

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

    if (passLimit > 0) {
      var finishedPasses = Math.floor(elapsedRef.current / animationDuration);
      if (finishedPasses >= passLimit) {
        progress.set(directionRef.current === 1 ? 100 : 0);
        if (!completeCalledRef.current) {
          completeCalledRef.current = true;
          setPassesDone(true);
          if (typeof onPassesComplete === 'function') {
            onPassesComplete();
          }
        }
        return;
      }
    }

    if (yoyo) {
      var cycleDuration = animationDuration + delayDuration;
      var fullCycle = cycleDuration * 2;
      var cycleTime = elapsedRef.current % fullCycle;

      if (cycleTime < animationDuration) {
        var pFwd = (cycleTime / animationDuration) * 100;
        progress.set(directionRef.current === 1 ? pFwd : 100 - pFwd);
      } else if (cycleTime < cycleDuration) {
        progress.set(directionRef.current === 1 ? 100 : 0);
      } else if (cycleTime < cycleDuration + animationDuration) {
        var reverseTime = cycleTime - cycleDuration;
        var pRev = 100 - (reverseTime / animationDuration) * 100;
        progress.set(directionRef.current === 1 ? pRev : 100 - pRev);
      } else {
        progress.set(directionRef.current === 1 ? 0 : 100);
      }
    } else {
      var cycleDur = animationDuration + delayDuration;
      var cTime = elapsedRef.current % cycleDur;

      if (cTime < animationDuration) {
        var pAnim = (cTime / animationDuration) * 100;
        progress.set(directionRef.current === 1 ? pAnim : 100 - pAnim);
      } else if (delayDuration <= 0) {
        progress.set(0);
        elapsedRef.current = elapsedRef.current % animationDuration;
      } else {
        progress.set(directionRef.current === 1 ? 100 : 0);
      }
    }
  });

  useEffect(function () {
    directionRef.current = direction === 'left' ? 1 : -1;
    elapsedRef.current = 0;
    completeCalledRef.current = false;
    setPassesDone(false);
    progress.set(0);
  }, [direction, progress, text, passLimit]);

  useEffect(function () {
    if (disabled) {
      setPassesDone(true);
    }
  }, [disabled]);

  var peak = shinePeakColor || shineColor;
  var backgroundPosition = useTransform(progress, function (p) {
    return (220 - p * 2.8) + '% center';
  });

  var handleMouseEnter = useCallback(function () {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);

  var handleMouseLeave = useCallback(function () {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  var gradientStyle;
  var motionStyle;
  if (disabled || passesDone) {
    gradientStyle = {
      color: color,
      WebkitTextFillColor: color,
      backgroundImage: 'none',
      backgroundClip: 'border-box',
      WebkitBackgroundClip: 'border-box',
    };
    motionStyle = gradientStyle;
  } else {
    gradientStyle = {
      backgroundImage:
        'linear-gradient(' + spread + 'deg, ' + color + ' 0%, ' + color + ' ' + shineBandStart + '%, ' +
        shineColor + ' ' + (shineBandStart + (50 - shineBandStart) * 0.42) + '%, ' +
        peak + ' 50%, ' +
        shineColor + ' ' + (shineBandEnd - (shineBandEnd - 50) * 0.42) + '%, ' +
        color + ' ' + shineBandEnd + '%, ' + color + ' 100%)',
      backgroundSize: backgroundSize,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    };
    motionStyle = Object.assign({}, gradientStyle, { backgroundPosition: backgroundPosition });
  }

  return (
    <motion.span
      className={'shiny-text ' + className}
      style={motionStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
    </motion.span>
  );
}

export default ShinyText;
