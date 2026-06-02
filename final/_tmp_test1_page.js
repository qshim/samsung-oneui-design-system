import { useEffect } from "react";
import MlpTestPage from "../components/prototype/MlpTestPage";

export default function Test1Page() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    if (window.__mlpTestConfig) {
      window.__mlpTestConfig.test1RevealAll = false;
      window.__mlpTestConfig.test1GreenRun = false;
      window.__mlpTestConfig.test1StackRun = false;
      window.__mlpTestConfig.test1ShortcutsOut = false;
      window.__mlpTestConfig.test1PillOut = false;
      window.__mlpTestConfig.test1GradientRun = false;
      window.__mlpTestConfig.test1GradientOut = false;
      window.__mlpTestConfig.test1GradientDone = false;
      window.__mlpTestConfig.test1CodaRun = false;
      window.__mlpTestConfig.test1CodaDone = false;
      window.__mlpTestConfig.test1HomeRun = false;
      window.__mlpTestConfig.test1HomePrep = false;
    }

    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      var canvas = document.getElementById("canvas");
      if (canvas && canvas.getAttribute("data-test-scope") === "test1") {
        canvas.removeAttribute("data-test1-reveal-all");
        canvas.removeAttribute("data-test1-intro-run");
        canvas.removeAttribute("data-test1-pill-prep");
        canvas.removeAttribute("data-test1-pill-run");
        canvas.removeAttribute("data-test1-green-run");
        canvas.removeAttribute("data-test1-stack-run");
        canvas.removeAttribute("data-test1-stack-animate");
        canvas.removeAttribute("data-test1-shortcuts-out");
        canvas.removeAttribute("data-test1-shortcuts-animate");
        canvas.removeAttribute("data-test1-pill-out");
        canvas.removeAttribute("data-test1-pill-out-animate");
        canvas.removeAttribute("data-test1-gradient-run");
        canvas.removeAttribute("data-test1-gradient-animate");
        canvas.removeAttribute("data-test1-gradient-out");
        canvas.removeAttribute("data-test1-gradient-out-animate");
        canvas.removeAttribute("data-test1-coda-run");
        canvas.removeAttribute("data-test1-coda-animate");
        canvas.removeAttribute("data-test1-coda-inner-rise");
        canvas.removeAttribute("data-test1-coda-done");
        canvas.removeAttribute("data-test1-home-prep");
        canvas.removeAttribute("data-test1-home-exit");
        canvas.removeAttribute("data-test1-home-run");
        canvas.removeAttribute("data-test1-home-animate");
        canvas.removeAttribute("data-test1-home-inner-rise");
        if (typeof window.__armTest1IntroDelay === "function") {
          window.__armTest1IntroDelay(canvas);
        }
        clearInterval(timer);
      }
      if (tries > 60) clearInterval(timer);
    }, 100);

    return function () {
      clearInterval(timer);
      if (typeof window.__clearTest1IntroTimer === "function") {
        window.__clearTest1IntroTimer();
      } else if (window.__mlpTest1IntroTimer) {
        clearTimeout(window.__mlpTest1IntroTimer);
        window.__mlpTest1IntroTimer = null;
      }
    };
  }, []);

  return (
    <MlpTestPage
      testId="test1"
      title="MLP Test 1 - Persona 1"
      initialSurfaceType="tab-root"
    />
  );
}
