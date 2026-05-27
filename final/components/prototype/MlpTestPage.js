import Head from "next/head";
import Script from "next/script";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const PHONE_OFFSET_Y = 36;
const PHONE_W = 388;
const PHONE_H = 880;
const PHONE_RADIUS = 30;
const HOME_BG = "/assets/bg-new.png?v=2";

const TESTS = [
  {
    id: "test1", href: "/test1", label: "Persona 1", img: "/assets/persona-1.png?v=3", disabled: true,
    name: "Junseo",
    age: "32, Office Worker",
    bio: "효율적인 일상을 추구하는 직장인.\n짧은 시간 안에 최대의 효과를 얻는 운동을 선호.",
    interests: ["Quick HIIT", "Meal prep", "Sleep tracking"],
  },
  {
    id: "test2", href: "/test2", label: "Persona 2", img: "/assets/persona-2.png?v=3",
    name: "박서현",
    age: "28, Product Designer",
    bio: "6일간 휴가 후 복귀. 분석적이고 계획적인 성격, 데이터 기반 의사결정과 체계적인 업무 진행 선호",
    interests: ["Design reviews", "Dev collaboration", "Figma expert"],
  },
  {
    id: "test3", href: "/test3", label: "Persona 3", img: "/assets/persona-3.png?v=3",
    name: "유진",
    age: "31, Backend Developer",
    bio: "주 4-5회 한강 조깅, 인디 음악과 함께 혼자만의 시간을 즐김. 기록보다 꾸준함을 중시하는 데이터 기반 러너",
    interests: ["Evening runner", "Indie music lover", "Data-driven fitness"],
  },
];

function TestScripts() {
  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js" strategy="beforeInteractive" />
      <Script src="/ui-state.js" strategy="beforeInteractive" />
      <Script src="/figma-refs/icon_library.js" strategy="beforeInteractive" />
      <Script src="/typography-rules.js" strategy="beforeInteractive" />
      <Script src="/generator.js" strategy="beforeInteractive" />
      <Script src="/design_memory.js" strategy="beforeInteractive" />
      <Script src="/app/state.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/agent.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/templates.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/atomics.js?v=4" strategy="beforeInteractive" />
      <Script src="/app/design-doc.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/interaction-state.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/dot-pair-rain.js?v=1" strategy="beforeInteractive" />
      <Script src="/app/surface-layout.js?v=mlp-test2-agent-gl-1" strategy="beforeInteractive" />
      <Script src="/app/settings.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/canvas.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/rules-renderer.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/scenes.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/scene-inspector.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/cached-screens.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/ui-panels.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/main.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/p2-agent-fill-gl.js?v=22" strategy="beforeInteractive" />
      <Script src="/prototype-logic.js?v=mlp-test-split-1" strategy="lazyOnload" />
    </>
  );
}

export default function MlpTestPage({
  testId = "test1",
  title = "MLP Test",
  initialSurfaceType = "tab-root",
}) {
  const [mounted, setMounted] = useState(false);
  const [genInput, setGenInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [scale, setScale] = useState(1);
  // `hoveredId` drives the persona profile card: when a non-disabled
  // badge is being pointed at, the card slides in to its right and
  // other badges shift away (above-hover badges nudge up, below-hover
  // badges nudge down). Cleared on mouseleave.
  const [hoveredId, setHoveredId] = useState(null);
  // Tracks whether the user has hovered ANY non-disabled badge at
  // least once. Per UX direction: the active (selected) badge rotates
  // on initial page load as a "look here, this scenario is yours"
  // signal; once the user has acknowledged the badge stack by hovering
  // something, the active badge stops rotating when un-hovered so it
  // doesn't compete with the phone UI for attention.
  const [hasInteracted, setHasInteracted] = useState(false);

  // ─────────────────────────────────────────────────────────────────
  // GRADIENT EDITOR (temporary tool per user direction). Lets the user
  // tweak the conic-gradient stops for the mid + 3rd persona badges
  // live, with a keyframe-timeline scaffold (0/2/4/6/8s) for future
  // animated keyframes. v1 = static gradient editing (the gradient
  // configured at the SELECTED timeline point is applied as the
  // badge's static ring); v2 (later) = generate dynamic @keyframes
  // and animate between the timeline keyframes.
  //
  // configs: { [avatarId]: { [timeSeconds]: stops[] } }
  //   stops[] = [{ c: '#hex', p: degrees 0-360 }, ...]
  //
  // Tool is opt-in (closed by default). When closed it doesn't touch
  // the badge gradient — the existing image-derived palette renders
  // as designed. When open + edits are made, the editor writes
  // `--persona-custom-gradient` inline on the target badge, which the
  // CSS reads in preference to the default gradient.
  // ─────────────────────────────────────────────────────────────────
  const TIMELINE_SECONDS = [0, 2, 4, 6, 8];
  const DEFAULT_STOPS_TEST2 = [
    { c: "#FF66FF", p: 0 },
    { c: "#FF6666", p: 90 },
    { c: "#FFFFFF", p: 180 },
    { c: "#F1F158", p: 270 },
    { c: "#FF66FF", p: 360 },
  ];
  const DEFAULT_STOPS_TEST3 = [
    { c: "#66FFFF", p: 0 },
    { c: "#EE2B2B", p: 90 },
    { c: "#FFFFFF", p: 180 },
    { c: "#4A77FF", p: 270 },
    { c: "#66FFFF", p: 360 },
  ];
  function buildDefaultConfig(stops) {
    const o = {};
    TIMELINE_SECONDS.forEach((t) => {
      // Each timeline point starts with the same default stops; user
      // edits diverge them per-time later.
      o[t] = stops.map((s) => ({ ...s }));
    });
    return o;
  }
  const [gradEditorOpen, setGradEditorOpen] = useState(false);
  const [gradEditorAvatar, setGradEditorAvatar] = useState("test2");
  const [gradEditorTime, setGradEditorTime] = useState(0);
  const [gradConfigs, setGradConfigs] = useState({
    test2: buildDefaultConfig(DEFAULT_STOPS_TEST2),
    test3: buildDefaultConfig(DEFAULT_STOPS_TEST3),
  });

  // Apply the currently-selected keyframe's stops as the badge's
  // static gradient (writes --persona-custom-gradient on the badge).
  // Only runs while the editor is open so closing the tool reverts
  // each badge to its default (image-derived) palette.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!gradEditorOpen) {
      // Clear any previously-applied custom gradients.
      ["test2", "test3"].forEach((aid) => {
        const el = document.querySelector(`.persona-circle[data-avatar-key="${aid}"]`);
        if (el) el.style.removeProperty("--persona-custom-gradient");
      });
      return undefined;
    }
    ["test2", "test3"].forEach((aid) => {
      const cfg = gradConfigs[aid];
      if (!cfg) return;
      const stops = cfg[gradEditorTime] || cfg[0];
      const stopsCss = stops.map((s) => `${s.c} ${s.p}deg`).join(", ");
      const gradient = `conic-gradient(from 0deg, ${stopsCss})`;
      const el = document.querySelector(`.persona-circle[data-avatar-key="${aid}"]`);
      if (el) el.style.setProperty("--persona-custom-gradient", gradient);
    });
    return undefined;
  }, [gradEditorOpen, gradEditorAvatar, gradEditorTime, gradConfigs]);

  function updateStop(stopIdx, field, value) {
    setGradConfigs((prev) => {
      const next = { ...prev };
      const avatarCfg = { ...next[gradEditorAvatar] };
      const stops = avatarCfg[gradEditorTime].map((s, i) =>
        i === stopIdx ? { ...s, [field]: value } : s
      );
      avatarCfg[gradEditorTime] = stops;
      next[gradEditorAvatar] = avatarCfg;
      return next;
    });
  }
  function copyStopsToAllTimes() {
    setGradConfigs((prev) => {
      const next = { ...prev };
      const avatarCfg = { ...next[gradEditorAvatar] };
      const currentStops = avatarCfg[gradEditorTime];
      TIMELINE_SECONDS.forEach((t) => {
        avatarCfg[t] = currentStops.map((s) => ({ ...s }));
      });
      next[gradEditorAvatar] = avatarCfg;
      return next;
    });
  }
  // Two-stage visibility so the 18px top-slide is constrained per
  // appearance regardless of which badge the user moves to:
  //   - `cardRowId` drives --hover-idx (which badge row the card is
  //      anchored to). It updates BEFORE the visible class flips so
  //      the rest-state top (= row_posY - 18) is at the new row's
  //      vicinity before the slide animation kicks in.
  //   - `cardVisible` drives the .is-visible class. Set on the next
  //      frame after cardRowId updates, so the top transition only
  //      ever spans the 18px gap between rest and visible.
  //   - `cardSnapping` is set true for one frame during a cross-badge
  //      row swap. It adds .is-snapping which kills the top transition
  //      so the row-jump (e.g. row1 hidden 486 → row2 hidden 586) is
  //      instant rather than a visible 100px column-slide.
  const [cardRowId, setCardRowId] = useState(null);
  const [cardVisible, setCardVisible] = useState(false);
  // Stash cardRowId in a ref so the effect below can read the latest
  // value without listing it as a dependency. If it WERE a dependency,
  // calling setCardRowId inside the effect would re-fire it and the
  // cleanup would cancel our queued rAFs before they fire.
  const cardRowIdRef = useRef(null);
  useEffect(() => { cardRowIdRef.current = cardRowId; }, [cardRowId]);
  // Ref to the card DOM node — we toggle .is-snapping imperatively to
  // avoid React batching it with the state-driven .is-visible flip.
  // .is-snapping suppresses the top transition for ONE frame so the
  // row-jump (when --hover-idx changes) snaps instead of animating
  // as a full 100px column-slide.
  const profileCardRef = useRef(null);
  const rightRef = useRef(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let rafA, rafB, timer;
    // Helper: park the card at the target row's hidden position with no
    // transition (DOM class .is-snapping), then on next frame remove
    // .is-snapping and flip .is-visible so the 18px settle slide
    // animates from row-hidden → row-visible. Used by both the initial
    // appearance and the cross-badge swap paths.
    const parkAndShow = (id) => {
      // Add the snapping class imperatively. React's render cycle is
      // batched, but classList.add takes effect on the next style
      // recalculation — which we force by reading offsetTop below.
      if (profileCardRef.current) {
        profileCardRef.current.classList.add("is-snapping");
        // Force the browser to commit the .is-snapping class (which
        // disables the top transition) BEFORE the --hover-idx change
        // takes effect. Reading offsetTop forces a synchronous layout.
        void profileCardRef.current.offsetTop;
      }
      setCardRowId(id);
      rafA = requestAnimationFrame(() => {
        // Remove .is-snapping so the top transition is re-armed for
        // the upcoming 18px settle slide.
        if (profileCardRef.current) {
          profileCardRef.current.classList.remove("is-snapping");
          void profileCardRef.current.offsetTop;
        }
        rafB = requestAnimationFrame(() => setCardVisible(true));
      });
    };
    const currentRow = cardRowIdRef.current;
    if (hoveredId) {
      if (currentRow && currentRow !== hoveredId) {
        // Cross-badge: fade out at old row first, then park + show at
        // the new row.
        setCardVisible(false);
        timer = setTimeout(() => parkAndShow(hoveredId), 220);
      } else if (currentRow === hoveredId) {
        // Same badge — just re-show. Row anchor already correct.
        rafA = requestAnimationFrame(() => {
          rafB = requestAnimationFrame(() => setCardVisible(true));
        });
      } else {
        // Initial appearance.
        parkAndShow(hoveredId);
      }
    } else {
      setCardVisible(false);
    }
    return () => {
      if (rafA) cancelAnimationFrame(rafA);
      if (rafB) cancelAnimationFrame(rafB);
      if (timer) clearTimeout(timer);
    };
  }, [hoveredId]);
  const hoveredTest = cardRowId ? TESTS.find(t => t.id === cardRowId) : null;
  const hoveredIdx  = cardRowId ? TESTS.findIndex(t => t.id === cardRowId) : -1;
  // Active badge = the one whose scenario matches the current page's
  // testId. Per UX direction, this is the "you are here" indicator and
  // should be enlarged + the gradient ring running by default. focusIdx
  // is what drives the badge stack's offsets — hover takes precedence
  // (so previewing a different persona shifts the layout), otherwise
  // falls back to the active badge.
  const activeIdx   = TESTS.findIndex(t => t.id === testId && !t.disabled);
  const focusIdx    = hoveredIdx >= 0 ? hoveredIdx : activeIdx;

  // Per-badge palette extracted from each avatar image. Colors stay
  // close to the portrait (background, skin, clothing) — no forced
  // rainbow/neon hue rotation. The conic-gradient ring uses c1→c2→
  // c3→c4 sorted by hue so the spin reads as the avatar's own palette.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    function rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var h, s, l = (max + min) / 2;
      if (max === min) { h = 0; s = 0; }
      else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h /= 6;
      }
      return [h, s, l];
    }
    function hslToRgb(h, s, l) {
      var r, g, b;
      if (s === 0) { r = g = b = l; }
      else {
        function hue2rgb(p, q, t) {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        }
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }
    function refineRingColor(rgb) {
      var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
      var newS = Math.max(0.28, Math.min(0.88, hsl[1] * 1.08 + 0.04));
      var newL = Math.max(0.38, Math.min(0.76, hsl[2] * 0.94 + 0.04));
      return hslToRgb(hsl[0], newS, newL);
    }
    function rgbToCss(rgb) {
      return "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")";
    }
    function extract(img) {
      try {
        var size = 32;
        var c = document.createElement("canvas");
        c.width = size; c.height = size;
        var ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        var pixels = ctx.getImageData(0, 0, size, size).data;
        var buckets = new Map();
        for (var i = 0; i < pixels.length; i += 4) {
          var r = pixels[i], g = pixels[i+1], b = pixels[i+2], a = pixels[i+3];
          if (a < 180) continue;
          var hslPx = rgbToHsl(r, g, b);
          if (hslPx[2] < 0.1 || hslPx[2] > 0.96) continue;
          if (hslPx[1] < 0.06 && hslPx[2] > 0.82) continue;
          var q = 24;
          var key = (Math.round(r/q)*q) + "_" + (Math.round(g/q)*q) + "_" + (Math.round(b/q)*q);
          buckets.set(key, (buckets.get(key) || 0) + 1);
        }
        var sorted = Array.from(buckets.entries()).sort(function(a,b){return b[1]-a[1];});
        function distSq(k1, k2) {
          var p1 = k1.split("_").map(Number);
          var p2 = k2.split("_").map(Number);
          return Math.pow(p1[0]-p2[0],2) + Math.pow(p1[1]-p2[1],2) + Math.pow(p1[2]-p2[2],2);
        }
        var picked = [];
        for (var j = 0; j < sorted.length && picked.length < 4; j++) {
          var k = sorted[j][0];
          var tooClose = picked.some(function(p) { return distSq(k, p) < 2800; });
          if (!tooClose) picked.push(k);
        }
        while (picked.length < 4 && sorted.length) {
          picked.push(sorted[picked.length % sorted.length][0]);
        }
        var rgbs = picked.map(function (k) { return k.split("_").map(Number); });
        rgbs.sort(function (a, b) {
          return rgbToHsl(a[0], a[1], a[2])[0] - rgbToHsl(b[0], b[1], b[2])[0];
        });
        return rgbs.map(refineRingColor).map(rgbToCss);
      } catch (_) { return null; }
    }
    function apply(badge) {
      var img = badge.querySelector("img.persona-img");
      if (!img) return;
      function go() {
        var colors = extract(img);
        if (!colors || colors.length < 4) return;
        badge.style.setProperty("--persona-c1", colors[0]);
        badge.style.setProperty("--persona-c2", colors[1]);
        badge.style.setProperty("--persona-c3", colors[2]);
        badge.style.setProperty("--persona-c4", colors[3]);
      }
      if (img.complete && img.naturalWidth > 0) go();
      else img.addEventListener("load", go, { once: true });
    }
    var raf = requestAnimationFrame(function () {
      var badges = document.querySelectorAll(".persona-circle:not(.is-disabled)");
      badges.forEach(apply);
    });
    return function () { cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return undefined;

    document.body.dataset.mlpTest = testId;
    window.__mlpTestConfig = {
      id: testId,
      surfaceType: initialSurfaceType,
      // test3(헬스 홈)만: 인트로(러닝 pill) → 클릭 시 홈 위젯으로 전환
      homeStage: testId === "test3" && initialSurfaceType === "tab-root" ? "intro" : undefined,
    };
    delete window.__p1_custom_widgets;

    const handleResize = () => {
      const rect = rightRef.current ? rightRef.current.getBoundingClientRect() : null;
      const availableWidth = (rect ? rect.width : window.innerWidth) - 48;
      const availableHeight = (rect ? rect.height : window.innerHeight) - 48 - PHONE_OFFSET_Y;
      const nextScale = Math.max(0.1, Math.min(1, availableWidth / PHONE_W, availableHeight / PHONE_H));
      setScale(nextScale);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    let ro = null;
    if (typeof ResizeObserver !== "undefined" && rightRef.current) {
      ro = new ResizeObserver(() => handleResize());
      ro.observe(rightRef.current);
    }

    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (typeof window.generateSurfaceScenario === "function") {
        window.generateSurfaceScenario(initialSurfaceType);
        const canvas = document.getElementById("canvas");
        if (canvas) {
          canvas.setAttribute("data-scenario", initialSurfaceType);
          canvas.setAttribute("data-test-scope", testId);
        }
        clearInterval(timer);
      }
      if (tries > 40) clearInterval(timer);
    }, 80);

    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", handleResize);
      if (ro) {
        try { ro.disconnect(); } catch (e) {}
      }
      if (document.body.dataset.mlpTest === testId) {
        delete document.body.dataset.mlpTest;
      }
      if (window.__mlpTestConfig && window.__mlpTestConfig.id === testId) {
        delete window.__mlpTestConfig;
      }
      delete window.__p1_custom_widgets;
    };
  }, [initialSurfaceType, testId]);

  const handleGenSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!genInput.trim() || isGenerating || testId !== "test1") return;
    setIsGenerating(true);

    let genInterval;
    if (typeof window !== "undefined") {
      const texts = [
        { time: "AI:  ", meta: "PLAN  ", color: "#FF7F24" },
        { time: "NEW: ", meta: "UI    ", color: "#A78BFA" },
        { time: "UP:  ", meta: "DATE  ", color: "#5CE1D6" },
        { time: "ON:  ", meta: "IT    ", color: "#FFB01C" },
      ];
      let tIdx = 0;
      let currentWidgets = window.__p1_custom_widgets ? [...window.__p1_custom_widgets] : [];
      currentWidgets = currentWidgets.filter((w) => w.role !== "dot-time-matrix");

      const updateGenUI = () => {
        const textObj = texts[tIdx % texts.length];
        window.__p1_custom_widgets = [
          { role: "dot-time-matrix", variant: { time: textObj.time, meta: textObj.meta, dotColor: textObj.color } },
          ...currentWidgets,
        ];
        if (typeof window.generateSurfaceScenario === "function") {
          window.generateSurfaceScenario("tab-root");
        }
        tIdx += 1;
      };

      updateGenUI();
      genInterval = setInterval(updateGenUI, 500);
    }

    try {
      const res = await fetch("/api/p1/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: genInput }),
      });
      if (!res.ok) throw new Error("Failed to resolve");
      const data = await res.json();

      if (data.components && data.components.length > 0) {
        let widgets = data.components;
        let hasTimeMatrix = widgets.find((w) => w.role === "dot-time-matrix");
        if (hasTimeMatrix) {
          widgets = widgets.filter((w) => w.role !== "dot-time-matrix");
          hasTimeMatrix.variant = { ...hasTimeMatrix.variant };
          delete hasTimeMatrix.variant.time;
          delete hasTimeMatrix.variant.meta;
          delete hasTimeMatrix.variant.dotColor;
          widgets.unshift(hasTimeMatrix);
        } else {
          widgets.unshift({ role: "dot-time-matrix", variant: {} });
        }
        window.__p1_custom_widgets = widgets;
      }
    } catch (err) {
      console.error(err);
      alert("생성 중 오류가 발생했습니다.");
    } finally {
      if (genInterval) clearInterval(genInterval);
      setIsGenerating(false);
      setGenInput("");
      setTimeout(() => {
        if (window.__p1_custom_widgets && typeof window.generateSurfaceScenario === "function") {
          window.generateSurfaceScenario("tab-root");
        }
      }, 100);
    }
  };

  const handleP2StarClick = () => {
    if (typeof window.startP2VoiceInput === "function") {
      window.startP2VoiceInput();
    }
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <style>{`
          /* Registered custom property for the persona ring's gradient
             angle. Browsers need this declared via @property so the
             angle interpolates through keyframes — otherwise conic-
             gradient's \`from\` would treat the variable as a string
             and jump straight to the end value instead of rotating. */
          @property --persona-ring-angle {
            syntax: '<angle>';
            initial-value: 0deg;
            inherits: false;
          }
          /* Second registered angle — drives the border-glow highlight
             (the bright focused arc that sweeps over the colorful ring).
             Animated independently of --persona-ring-angle so the glow
             reads as a distinct "spotlight" rotating around the badge,
             clearly communicating motion even when the underlying
             gradient is smooth enough to look near-static. */
          @property --persona-glow-angle {
            syntax: '<angle>';
            initial-value: 0deg;
            inherits: false;
          }

          body {
            background: #0b0b0e !important;
            overflow: hidden !important;
            margin: 0 !important;
          }
          .app-shell {
            padding: 0 !important;
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            position: relative !important;
            height: 100vh !important;
            background: #0b0b0e !important;
          }
          .page-nav {
            position: absolute !important;
            top: 24px !important;
            left: 0 !important;
            right: 0 !important;
            padding: 0 40px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            z-index: 2000 !important;
            pointer-events: none !important;
          }
          .nav-btn {
            /* Container-less style per user direction: just text, no
               background pill, no border. Hover bumps the opacity for
               a subtle feedback signal. */
            pointer-events: auto !important;
            background: transparent !important;
            border: none !important;
            color: rgba(255, 255, 255, 0.65) !important;
            padding: 4px 0 !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            letter-spacing: 0.2px !important;
            cursor: pointer !important;
            transition: color 0.2s ease !important;
            backdrop-filter: none !important;
            text-decoration: none !important;
            display: inline-flex !important;
            align-items: center !important;
          }
          .nav-btn:hover {
            color: #ffffff !important;
          }
          /* Hide Next.js dev mode indicator (the floating "N" badge
             that appears at the bottom-left in development) — per
             user direction. Multiple selectors cover known IDs the
             Next.js team has used across versions. */
          #__next-build-watcher,
          nextjs-portal,
          [data-nextjs-toast],
          [data-nextjs-dev-tools-button],
          [data-nextjs-dialog-overlay],
          .__nextjs-dev-tools-button,
          #nextjs__container_build_error_label,
          [aria-label="Open Next.js Dev Tools"] {
            display: none !important;
          }
          .mlp-workspace {
            display: flex !important;
            flex-direction: row !important;
            justify-content: center !important;
            align-items: center !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100vh !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: #0b0b0e !important;
            position: relative !important;
          }
          .mlp-left {
            width: 120px !important;
            flex-shrink: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 24px !important;
            align-items: center !important;
            justify-content: center !important;
            position: absolute !important;
            left: 80px !important;
            top: 0 !important;
            bottom: 0 !important;
            z-index: 10 !important;
          }
          .persona-circle {
            width: 76px !important;
            height: 76px !important;
            border-radius: 50% !important;
            /* overflow: visible so the ::before conic-gradient ring can
               sit OUTSIDE the circle (inset: -3px). The img inside keeps
               its circular shape via its own border-radius: 50% below,
               so we don't need parent clipping. */
            overflow: visible !important;
            /* No solid border — the gradient ::before below IS the
               outline. Earlier we drew a 2px white-ish border AND the
               gradient on hover only; the user wanted the gradient to
               REPLACE that stroke, not stack outside it. */
            border: none !important;
            box-shadow: 0 6px 16px rgba(0,0,0,0.4) !important;
            /* Transform now uses a back-easeOut curve with slight
               overshoot so the 1× → 1.8× hover jump has visible spring
               — the badge surges past its target, then settles back.
               Duration also bumped to 0.52s so the ease has more time
               to read on screen. */
            transition: transform 0.52s cubic-bezier(0.34, 1.56, 0.64, 1),
                        opacity 0.3s ease,
                        filter 0.3s ease !important;
            background: #1a1a1e !important;
            display: block !important;
            position: relative !important;
          }
          /* Angular gradient outline — HIDDEN at rest. Only activates
             on hover: opacity 0 → 1 (220ms fade), then the gradient
             angle spins 1.8 turns (648°) via @property and the padding
             eases 2px → 0px so the ring winds down into nothing. Mask
             trick (content-box xor full) carves the visible ring out
             of an otherwise solid disc. */
          .persona-circle::before {
            content: '';
            position: absolute;
            /* Gradient stroke sits ON the badge (inset 0). The persona
               images have a thin grey outline baked into them; placing
               the ::before flush with the badge's edge and using the
               mask-xor trick to make the OUTERMOST padding-px the
               visible ring lets the gradient cover that baked-in
               line cleanly. border-radius: 50% (not 48%) so the ring
               traces a PERFECT CIRCLE. With 48% the shape was a
               slightly rounded square — visually fine when static,
               but the transform: rotate() animation made the
               imperfection obvious as the shape wobbled while
               spinning. */
            inset: 0;
            border-radius: 50%;
            padding: 2px;
            /* Image-picked palette (--persona-c1..c4 set per badge in
               the mount effect above). Four stops sorted by hue from
               the avatar — no forced white/rainbow peak. */
            background: var(
              --persona-custom-gradient,
              conic-gradient(
                from 0deg,
                var(--persona-c1, #8a8a92)   0deg,
                var(--persona-c2, #a8a8b0)  90deg,
                var(--persona-c3, #c0c0c8) 180deg,
                var(--persona-c4, #b0b0b8) 270deg,
                var(--persona-c1, #8a8a92) 360deg
              )
            );
            -webkit-mask:
              linear-gradient(#000 0 0) content-box,
              linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
                    mask-composite: exclude;
            opacity: 0;
            transition: opacity 220ms cubic-bezier(0.2, 0, 0, 1);
            pointer-events: none;
            will-change: --persona-ring-angle, padding, opacity, filter;
          }
          /* Border-glow cone — a focused spotlight that races around
             the ring on top of the colorful gradient. Previously the
             drop-shadows here were so wide (6px pink + 14px blue) that
             they spread color across the ENTIRE perimeter, drowning
             out the underlying rotating ::before gradient — every
             frame looked the same washed-out pink/blue halo. Now the
             cone is tight: just a narrow white arc with a small,
             warmly-tinted soft edge, no big colored drop-shadows. The
             colorful rotation lives in ::before; ::after is just an
             extra "lit highlight" sweeping over it. */
          .persona-circle::after {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 50%;
            /* Base padding matches the ::before ring width. The fade
               keyframes override this with 0 → 5px → 5px → 0 so the
               cone highlight tracks the ring's grow-in / shrink-out. */
            padding: 5px;
            background: conic-gradient(
              from var(--persona-glow-angle, 0deg),
              rgba(255, 255, 255, 0)     0deg,
              rgba(255, 255, 255, 0)   330deg,
              rgba(255, 255, 255, 0.4) 345deg,
              rgba(255, 255, 255, 1)   355deg,
              rgba(255, 255, 255, 0.4) 360deg,
              rgba(255, 255, 255, 0)   360deg
            );
            -webkit-mask:
              linear-gradient(#000 0 0) content-box,
              linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
                    mask-composite: exclude;
            opacity: 0;
            /* Tight 1px blur only — no colored drop-shadows. Keeps the
               highlight as a crisp moving spot instead of a permanent
               colored aura that hides the rotating ::before. */
            filter: blur(1px);
            pointer-events: none;
            mix-blend-mode: screen;
            will-change: --persona-glow-angle, opacity;
            z-index: 2;
          }
          .persona-circle.is-disabled {
            opacity: 0.38 !important;
            filter: grayscale(0.35) brightness(0.55) !important;
            cursor: not-allowed !important;
            pointer-events: none !important;
            box-shadow: none !important;
          }
          .persona-circle:not(.is-disabled):hover,
          .persona-circle:not(.is-disabled).is-hovered,
          .persona-circle:not(.is-disabled).is-active {
            /* Enlarged state — applied for:
                 :hover / .is-hovered → user pointing at a non-active badge
                                        (preview state)
                 .is-active           → the badge whose scenario is the
                                        CURRENT page (the "you are here"
                                        indicator per user direction
                                        "enlarged when that scenario is
                                        appeared on mobile screen").
               Same 1.8× scale for both so they share the same focal
               weight; the 22 px sibling-offset (set elsewhere) gives
               the enlarged badge room to grow without overlapping its
               neighbours regardless of trigger. */
            transform: scale(1.8) !important;
          }
          .persona-circle:not(.is-disabled):hover::before,
          .persona-circle:not(.is-disabled).is-hovered::before {
            /* Hover preview — one-shot per hover. Per user direction:
               "avatar gradient wheel motion should not repeat. once
               when mouse is hovered. it should play back if the mouse
               cursor moves out of the region and hovered again."
                 personaCircleHoverSpin: 8 s forwards (one lifecycle —
                   grow-in / hold / shrink-out, hold end state).
                 personaCircleHoverRotate: 5 iterations × 1.6 s = 8 s
                   (FINITE — matches the spin lifetime exactly, so
                   rotation also stops when the lifecycle completes).
               When the user un-hovers, the rules stop matching and
               the animations are reset. Re-hovering restarts both
               from frame 0 — fresh playback every time. */
            animation:
              personaCircleHoverSpin 8s linear 1 forwards,
              personaCircleHoverRotate 1.6s linear 5 forwards;
          }
          .persona-circle:not(.is-disabled).is-active::before {
            /* INITIAL state of active badge — rotates on page load as
               a "look here, this scenario is yours" signal. Same
               animation as hover (infinite spin + rotate). The
               animation continues UNTIL the user has acknowledged the
               badge stack by hovering at least one badge (see the
               .has-interacted override below), after which the active
               badge becomes static when un-hovered.

               Per user direction: "when the scenario is played... when
               mouse is not hovered, the enlarged batch should not
               display the rotation movement AFTER the first hover
               interaction." */
            animation:
              personaCircleHoverSpin 8s linear infinite,
              personaCircleHoverRotate 1.6s linear infinite;
          }
          .mlp-left.has-interacted .persona-circle:not(.is-disabled).is-active::before {
            /* AFTER the user has hovered any badge at least once, the
               active badge falls back to a quiet STATIC state when
               un-hovered. User has demonstrated awareness of the badge
               stack; the rotation stops competing with the phone UI
               for attention. Hover on the active badge (rule below)
               still re-engages rotation. */
            animation: none;
            opacity: 1;
            padding: 3.8px;
            filter: saturate(1.3) brightness(1) contrast(1.1);
            transform: rotate(0deg);
          }
          /* When the user explicitly HOVERS the active badge, restore
             rotation — per user direction "when hovered, it should
             rotate". Higher specificity than .has-interacted .is-active
             alone, so this wins the cascade for the active+hover case. */
          .persona-circle:not(.is-disabled).is-active:hover::before,
          .persona-circle:not(.is-disabled).is-active.is-hovered::before,
          .mlp-left.has-interacted .persona-circle:not(.is-disabled).is-active:hover::before,
          .mlp-left.has-interacted .persona-circle:not(.is-disabled).is-active.is-hovered::before {
            /* Same one-shot 8 s lifecycle as the non-active hover rule —
               rotation runs 5 iterations then stops, matching the spin
               window so no infinite repeat. Re-hover restarts. */
            animation:
              personaCircleHoverSpin 8s linear 1 forwards,
              personaCircleHoverRotate 1.6s linear 5 forwards;
          }
          /* Glow highlight runs alongside the base spin.
               • personaCircleHoverGlowSpin — 1.6s/turn linear loop
                 so the cone keeps sweeping at a different (faster)
                 cadence than the base ring's 2.33s/turn pace.
               • personaCircleHoverGlowFade — opacity envelope synced
                 to the 8s base lifecycle: comes in fast, holds bright
                 through the spin phase, fades out in the final 1s. */
          /* ::after cone glow disabled — the ::before gradient now
             carries its own bright WHITE highlight at the 50% stop
             (matching the music card's BPM gradient wheel pattern).
             A second rotating spotlight on top was redundant and
             chaotic with the gradient's built-in highlight rotating
             at a different speed. */
          .persona-circle:not(.is-disabled):hover::after,
          .persona-circle:not(.is-disabled).is-hovered::after {
            animation: none;
            opacity: 0;
          }
          @keyframes personaCircleHoverSpin {
            /* Ring lifecycle while hovered, 8s total. Behaviour broken
               into three phases per user direction
               (0:0s → 3.8px:2s → 3.8px:6s → 0:8s):
                 0.0s → 2.0s  (0% → 25%)  — GROW-IN: padding 0 → 3.8px
                              Ring thickens from the outer edge inward
                              over 2 seconds (slower, more deliberate
                              than the previous 0.3s grow).
                 2.0s → 6.0s  (25% → 75%) — HOLD: padding stays 3.8px
                              The ring rotates at full thickness for
                              4 seconds, dominant brand moment.
                 6.0s → 8.0s  (75% → 100%) — SHRINK-OUT: padding
                              3.8px → 0px. Ring thins back to nothing
                              over 2 seconds.
               Rotation (driven by the parallel personaCircleHoverRotate
               animation) runs through the entire 8s window. Opacity
               holds at 1 throughout — thickness IS the visibility
               cue, no separate opacity fade. */
            0%    {
              opacity: 1;
              padding: 0;
              filter: saturate(1.3) brightness(1) contrast(1.1);
            }
            25%   {
              opacity: 1;
              padding: 3.8px;
              filter: saturate(1.3) brightness(1) contrast(1.1);
            }
            75%   {
              opacity: 1;
              padding: 1.8px;
              filter: saturate(1.3) brightness(1.05) contrast(1.1);
            }
            100%  {
              opacity: 1;
              padding: 0;
              filter: saturate(1.3) brightness(1) contrast(1.1);
            }
          }
          /* Pure rotation — transform rotate on the ::before
             pseudo-element. Since the ::before is circular (border-
             radius 48-50%), rotating it visually only spins the
             conic-gradient content inside it; the ring's outer
             shape stays the same. 1.6s per turn = 225 deg/sec,
             matching the music card's outline rotation pace.
             infinite so the rotation continues through the entire
             8s lifecycle. */
          @keyframes personaCircleHoverRotate {
            0%   { transform: rotate(0deg);   }
            100% { transform: rotate(360deg); }
          }
          @keyframes personaCircleHoverGlowSpin {
            /* Independent angle so the cone glow rotates at its own
               cadence (1.6s/turn = 5 turns in 8s) while the base ring
               sweeps at 2.33s/turn (3 turns in 7s). Two different
               rotation rates layered together make the motion obvious. */
            0%   { --persona-glow-angle:   0deg; }
            100% { --persona-glow-angle: 360deg; }
          }
          @keyframes personaCircleHoverGlowFade {
            /* Mirrors the ring's grow-in / hold / shrink-out lifecycle
               so the cone highlight tracks the same thickness curve.
                 0%     → 3.75% (0 → 0.3s): padding 0 → 5px,
                                            opacity already 1.
                 3.75%  → 87.5% (0.3 → 7s): hold padding 5px.
                 87.5%  → 100%  (7 → 8s):  padding 5px → 0, opacity
                                            1 → 0 (dissolve). Glow's
                                            own 1.6s spin keeps
                                            running through this. */
            0%     { opacity: 1; padding: 0; }
            3.75%  { opacity: 1; padding: 5px; }
            87.5%  { opacity: 1; padding: 5px; }
            100%   { opacity: 0; padding: 0; }
          }
          /* Other badges (not the hovered one) shift away on the Y axis
             to give the profile card room to slide in. Badges above the
             hovered one nudge UP (-1), badges below nudge DOWN (+1). */
          .mlp-left.is-hovering .persona-circle[data-hover-offset="-1"] {
            transform: translateY(-22px) !important;
          }
          .mlp-left.is-hovering .persona-circle[data-hover-offset="1"] {
            transform: translateY(22px) !important;
          }
          /* Persona profile card — slides in to the right of the
             hovered badge with a tinted backdrop, bio, and interest
             tags. Positioned absolutely inside .mlp-left so it can
             overlap (visually) onto .mlp-right without breaking the
             column layout. The badge stack is vertically centered in
             .mlp-left (justify-content: center, ~100px rhythm per
             slot = 76px badge + 24px gap, 3 badges = 276px total).
             So the FIRST badge top is (50% - 138px), half of the
             stack height, and subsequent badges are +100px each.
             --hover-idx (0/1/2) picks which row to align to. */
          .persona-profile-card {
            position: absolute;
            /* Hidden rest position is 18px ABOVE the hovered badge's
               row. When the .is-visible class is added below, top
               retargets to the badge's actual posY and the top
               transition slides the card down through that 18px gap.
               Travel is bounded to exactly 18px regardless of which
               badge is hovered or whether the card was just visible
               on another badge — each appear/move is a constrained
               18px slide rather than the previous full 100px
               column-slide. */
            top: calc(50% - 138px + var(--hover-idx, 0) * 100px - 8px - 18px);
            /* Pushed 30px farther right per UX direction (was 100%+8px).
               The card now sits 38px off the badge column rather than
               hugging it — gives the rotating glow on the hovered badge
               room to breathe without bumping the card edge. */
            left: calc(100% + 38px);
            width: 308px;
            padding: 18px 20px 20px;
            border-radius: 18px;
            /* Container background uses LOW-alpha rgba so the panel itself
               reads as half-transparent, while the text/tags inside stay
               at full opacity (per user direction "the container can be
               half transparent... but the description text should be
               opaque"). Earlier we set opacity:0.5 on the whole card
               which dimmed the text along with the container — that's
               what this rewrite avoids. */
            background: linear-gradient(180deg, rgba(28, 28, 32, 0.45), rgba(20, 20, 24, 0.40));
            -webkit-backdrop-filter: blur(22px) saturate(140%);
                    backdrop-filter: blur(22px) saturate(140%);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow:
              0 20px 60px -20px rgba(0, 0, 0, 0.6),
              0 0 0 1px rgba(100, 233, 227, 0.06) inset;
            color: #f3f3f5;
            opacity: 0;
            pointer-events: none;
            /* translateY removed — the 18px vertical travel is handled
               entirely by the top property now (see the rest-position
               above and the .is-visible override below). Avoids
               stacking two simultaneous vertical motions.

               Both states transition top over 360ms so hover-IN slides
               18px down and hover-OUT slides 18px up (symmetric). The
               cross-badge row swap is silenced by .is-snapping which
               is briefly applied while --hover-idx jumps from row A to
               row B — without it, top would animate the full 100px
               column-slide. See React effect above for sequencing. */
            transition:
              opacity 220ms cubic-bezier(0.2, 0, 0, 1),
              top 360ms cubic-bezier(0.2, 0, 0, 1);
            z-index: 30;
          }
          .persona-profile-card.is-visible {
            /* Card opacity at 1 so the TEXT (name, age, bio, tags) is
               fully opaque and readable. The half-transparent feel
               comes from the low-alpha rgba background defined above,
               not from card-level opacity. */
            opacity: 1;
            /* Visible position is the badge row's actual top — same calc
               as the hidden state but WITHOUT the -18px offset. The
               top transition above handles the 18px slide down. */
            top: calc(50% - 138px + var(--hover-idx, 0) * 100px - 8px);
            pointer-events: auto;
          }
          /* Applied for a single frame between cross-badge fade-out and
             fade-in, while --hover-idx updates to point at the new badge.
             Suppresses the top transition so the row-jump (which is up to
             200px) snaps instantly instead of animating as a column-slide.
             The transition is re-armed on the next frame so the .is-visible
             flip drives the normal 18px settle slide. */
          .persona-profile-card.is-snapping {
            transition: none !important;
          }
          /* Head area no longer holds the avatar img — per UX direction
             the badge to its left already shows the avatar, so a duplicate
             inside the card was redundant. Layout collapses to just the
             name+age heading block flowing left-aligned. */
          .persona-profile-card__head {
            margin-bottom: 12px;
          }
          .persona-profile-card__heading {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
          }
          .persona-profile-card__name {
            font-family: 'Inter', var(--font), sans-serif;
            font-weight: 600;
            font-size: 16px;
            line-height: 1.2;
            color: #ffffff;
          }
          .persona-profile-card__age {
            font-family: 'Inter', var(--font), sans-serif;
            font-weight: 400;
            font-size: 12px;
            line-height: 1.3;
            color: rgba(255, 255, 255, 0.55);
          }
          .persona-profile-card__bio {
            font-family: 'Inter', var(--font), sans-serif;
            font-weight: 400;
            font-size: 13px;
            line-height: 1.55;
            color: rgba(255, 255, 255, 0.78);
            margin: 0 0 14px;
            white-space: pre-line;
          }
          .persona-profile-card__interests {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .persona-profile-card__tag {
            font-family: 'Inter', var(--font), sans-serif;
            font-weight: 500;
            font-size: 11px;
            letter-spacing: 0.2px;
            line-height: 1.4;
            color: #64e9e3;
            background: rgba(100, 233, 227, 0.08);
            border: 1px solid rgba(100, 233, 227, 0.18);
            padding: 4px 9px;
            border-radius: 99px;
          }
          /* test2 (박서현) — solid card, cream tags, bio below tags */
          .persona-profile-card--test2 {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 409px;
            padding: 22px 30px;
            gap: 0;
            border-radius: 24.882px;
            background: rgba(40, 42, 44, 0.7);
            -webkit-backdrop-filter: blur(16px) saturate(120%);
                    backdrop-filter: blur(16px) saturate(120%);
            border: none;
            box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.45);
          }
          .persona-profile-card--test2 .persona-profile-card__head {
            margin-bottom: 26px;
          }
          .persona-profile-card--test2 .persona-profile-card__heading {
            gap: 0;
          }
          .persona-profile-card--test2 .persona-profile-card__name {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 700;
            font-size: 24.0526px;
            line-height: 1.8;
            letter-spacing: -0.02em;
            color: #FFFFFF;
          }
          .persona-profile-card--test2 .persona-profile-card__age {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 600;
            font-size: 14.9292px;
            line-height: 1.8;
            letter-spacing: -0.02em;
            color: #FFEDBB;
            opacity: 0.6;
          }
          .persona-profile-card--test2 .persona-profile-card__interests {
            gap: 8.29px;
            margin: 0 0 9px;
          }
          .persona-profile-card--test2 .persona-profile-card__tag {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 500;
            font-size: 11.6116px;
            letter-spacing: -0.02em;
            line-height: 1.8;
            color: #282A2C;
            background: #FFEDBB;
            border: none;
            padding: 2.4882px 10.7822px 3.3176px;
            border-radius: 828.572px;
          }
          .persona-profile-card--test2 .persona-profile-card__bio {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 400;
            font-size: 14.9292px;
            line-height: 1.5;
            letter-spacing: -0.02em;
            color: #EBE8DF;
            margin: 0;
            white-space: normal;
          }
          .persona-profile-card--test2.is-visible .persona-profile-card__bio {
            animation: personaCardTextRise 320ms cubic-bezier(0.2, 0, 0.05, 1) 540ms both;
          }
          /* test3 (유진) — solid card, mint tags, bio below tags */
          .persona-profile-card--test3 {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 409px;
            padding: 22px 35px 22px 30px;
            gap: 0;
            border-radius: 24.882px;
            background: rgba(40, 42, 44, 0.7);
            -webkit-backdrop-filter: blur(16px) saturate(120%);
                    backdrop-filter: blur(16px) saturate(120%);
            border: none;
            box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.45);
          }
          .persona-profile-card--test3 .persona-profile-card__head {
            margin-bottom: 26px;
          }
          .persona-profile-card--test3 .persona-profile-card__heading {
            gap: 0;
          }
          .persona-profile-card--test3 .persona-profile-card__name {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 700;
            font-size: 24.0526px;
            line-height: 1.8;
            letter-spacing: -0.02em;
            color: #FFFFFF;
          }
          .persona-profile-card--test3 .persona-profile-card__age {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 600;
            font-size: 14.9292px;
            line-height: 1.8;
            letter-spacing: -0.02em;
            color: #BDE5EC;
            opacity: 0.6;
          }
          .persona-profile-card--test3 .persona-profile-card__interests {
            gap: 8.29px;
            margin: 0 0 9px;
          }
          .persona-profile-card--test3 .persona-profile-card__tag {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 500;
            font-size: 11.6116px;
            letter-spacing: -0.02em;
            line-height: 1.8;
            color: #282A2C;
            background: #BDE5EC;
            border: none;
            padding: 2.4882px 10.7822px 3.3176px;
            border-radius: 828.572px;
          }
          .persona-profile-card--test3 .persona-profile-card__bio {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 400;
            font-size: 14.9292px;
            line-height: 1.5;
            letter-spacing: -0.02em;
            color: #EBE8DF;
            margin: 0;
            white-space: normal;
          }
          .persona-profile-card--test3.is-visible .persona-profile-card__bio {
            animation: personaCardTextRise 320ms cubic-bezier(0.2, 0, 0.05, 1) 540ms both;
          }
          /* Staggered text reveal with COUNTER-MOTION per user
             direction "카드들은 위에서 아래로 내려오니 역방향으로
             아래에서 위로 올라가게": the card itself slides DOWN (18px
             top-property slide from -18 above its target), but each
             text line INSIDE the card starts 10 px BELOW its resting
             position and rises UP into place. The opposite vertical
             motion between the container and its contents produces
             the "묘한 모션감/공간감" the user asked for — the panel
             falls in from above while the content floats up to fill it.
             Cascade: ~0.1s interval between elements (name → age →
             bio → each interest tag). The fill-mode "both" holds each
             element at the 0% keyframe (opacity 0 + translateY(10px))
             DURING its delay, so the card does not render with text
             snapping into existence mid-fade. */
          .persona-profile-card.is-visible .persona-profile-card__name {
            animation: personaCardTextRise 320ms cubic-bezier(0.2, 0, 0.05, 1) 0ms both;
          }
          .persona-profile-card.is-visible .persona-profile-card__age {
            animation: personaCardTextRise 320ms cubic-bezier(0.2, 0, 0.05, 1) 100ms both;
          }
          .persona-profile-card.is-visible .persona-profile-card__bio {
            animation: personaCardTextRise 320ms cubic-bezier(0.2, 0, 0.05, 1) 200ms both;
          }
          .persona-profile-card.is-visible .persona-profile-card__tag:nth-child(1) {
            animation: personaCardTextRise 320ms cubic-bezier(0.2, 0, 0.05, 1) 300ms both;
          }
          .persona-profile-card.is-visible .persona-profile-card__tag:nth-child(2) {
            animation: personaCardTextRise 320ms cubic-bezier(0.2, 0, 0.05, 1) 380ms both;
          }
          .persona-profile-card.is-visible .persona-profile-card__tag:nth-child(3) {
            animation: personaCardTextRise 320ms cubic-bezier(0.2, 0, 0.05, 1) 460ms both;
          }
          @keyframes personaCardTextRise {
            0%   { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0);   }
          }
          /* Respect reduced-motion: show a static ring (no spin) and
             hide the rotating glow highlight (since its whole purpose
             is to communicate rotation). Static color gradient is kept
             so the hover affordance is still visible. */
          @media (prefers-reduced-motion: reduce) {
            .persona-circle:not(.is-disabled):hover::before,
            .persona-circle:not(.is-disabled).is-hovered::before {
              animation: none;
            }
            .persona-circle:not(.is-disabled):hover::after,
            .persona-circle:not(.is-disabled).is-hovered::after {
              animation: none;
              opacity: 0;
            }
          }
          .persona-img {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            display: block !important;
            /* border-radius on the img itself keeps it circular even
               though the parent .persona-circle now has overflow:visible
               (so the ring above can extend outside). */
            border-radius: 50% !important;
          }
          .mlp-right {
            flex-grow: 1 !important;
            height: 100% !important;
            min-width: 0 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            padding-right: 0 !important;
          }
          .canvas-wrap {
            width: calc(${PHONE_W}px * var(--scale, 1)) !important;
            height: calc(${PHONE_H}px * var(--scale, 1)) !important;
            flex-shrink: 0 !important;
            position: relative !important;
            transition: width 0.2s ease-out, height 0.2s ease-out !important;
            margin: 0 auto !important;
            transform: translateY(var(--offsetY, 0px)) !important;
          }
          .canvas-frame.mlp-phone {
            width: ${PHONE_W}px !important;
            height: ${PHONE_H}px !important;
            transform: scale(var(--scale, 1)) !important;
            transform-origin: top left !important;
            border-radius: ${PHONE_RADIUS}px !important;
            overflow: hidden !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            box-shadow: 0 30px 80px rgba(0,0,0,0.9) !important;
            background: #000 !important;
            transition: transform 0.2s ease-out !important;
          }
          .canvas-frame.mlp-phone .canvas-inner {
            border-radius: ${PHONE_RADIUS}px !important;
          }
          .canvas-inner {
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            overflow: hidden !important;
            zoom: 1 !important;
            transform: none !important;
          }
          .gen-input-container {
            position: absolute !important;
            bottom: 40px !important;
            right: 40px !important;
            z-index: 100 !important;
            width: 320px !important;
            background: rgba(255, 255, 255, 0.08) !important;
            backdrop-filter: blur(20px) !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            border-radius: 20px !important;
            padding: 8px 16px !important;
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3) !important;
            transition: all 0.3s ease !important;
          }
          .gen-input-container:focus-within {
            border-color: #64e9e3 !important;
            box-shadow: 0 10px 40px rgba(100, 233, 227, 0.2) !important;
            width: 400px !important;
          }
          .gen-input {
            background: transparent !important;
            border: none !important;
            color: #fff !important;
            font-size: 14px !important;
            font-family: 'Pretendard', sans-serif !important;
            flex: 1 !important;
            outline: none !important;
            padding: 8px 0 !important;
          }
          .gen-input::placeholder {
            color: rgba(255, 255, 255, 0.4) !important;
          }
          .gen-submit {
            background: #64e9e3 !important;
            border: none !important;
            width: 32px !important;
            height: 32px !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            flex-shrink: 0 !important;
          }
          .gen-submit svg {
            width: 16px !important;
            height: 16px !important;
            color: #000 !important;
          }
          .gen-loading {
            width: 16px !important;
            height: 16px !important;
            border: 2px solid rgba(0,0,0,0.2) !important;
            border-top-color: #000 !important;
            border-radius: 50% !important;
            animation: gen-spin 0.8s linear infinite !important;
          }
          @keyframes gen-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Head>

      <main className="app-shell mlp-test-page" data-mlp-test={testId}>
        <nav className="page-nav">
          <Link href="/" className="nav-btn">Back</Link>
          <Link href="/theme" className="nav-btn">Theme</Link>
        </nav>

        <div className="mlp-workspace">
          <aside className={`mlp-left${(hoveredId || activeIdx >= 0) ? " is-hovering" : ""}${hasInteracted ? " has-interacted" : ""}`}>
            {TESTS.map((test, idx) => {
              // Each badge's `data-hover-offset` is one of: -1 (above the
              // hovered badge — nudge up), 0 (the hovered badge or no
              // hover — stay still), 1 (below the hovered badge — nudge
              // down). The CSS rules below translate those positions
              // into translateY values, so the badges visually push out
              // of the way of the hovered one's profile card.
              // focusIdx = the badge currently driving the enlarged state.
              // Falls back to the ACTIVE badge (= current page's scenario)
              // when nothing is hovered — so on /test3 the persona-3 badge
              // is the "focus" by default and neighbouring badges offset
              // around it just as they would under a hover. Hover takes
              // precedence so previewing a different persona still moves
              // the focus.
              const offset = focusIdx < 0 || idx === focusIdx
                ? 0
                : (idx < focusIdx ? -1 : 1);
              const hoveredClass = test.id === hoveredId ? " is-hovered" : "";
              const className = `persona-circle${test.id === testId ? " is-active" : ""}${test.disabled ? " is-disabled" : ""}${hoveredClass}`;
              const onMouseEnter = test.disabled ? undefined : () => {
                setHoveredId(test.id);
                setHasInteracted(true);
              };
              const onMouseLeave = test.disabled ? undefined : () => setHoveredId(prev => prev === test.id ? null : prev);
              if (test.disabled) {
                return (
                  <span
                    key={test.id}
                    className={className}
                    aria-disabled="true"
                    title="준비 중"
                    data-hover-offset={offset}
                    data-avatar-key={test.id}
                  >
                    <img src={test.img} alt={test.label} className="persona-img" />
                  </span>
                );
              }
              return (
                <Link
                  key={test.id}
                  href={test.href}
                  className={className}
                  data-hover-offset={offset}
                  data-avatar-key={test.id}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                >
                  <img src={test.img} alt={test.label} className="persona-img" />
                </Link>
              );
            })}
            {/* Profile card — slides in from the right of the hovered
                badge with the persona's bio + interests. CSS positions
                it via --hover-idx so its top tracks whichever badge is
                currently hovered. */}
            <div
              ref={profileCardRef}
              className={`persona-profile-card${cardVisible ? " is-visible" : ""}${hoveredTest?.id === "test2" ? " persona-profile-card--test2" : ""}${hoveredTest?.id === "test3" ? " persona-profile-card--test3" : ""}`}
              style={{ "--hover-idx": Math.max(0, hoveredIdx) }}
              aria-hidden={cardVisible ? "false" : "true"}
            >
              {hoveredTest && (
                <>
                  <div className="persona-profile-card__head">
                    <div className="persona-profile-card__heading">
                      <div className="persona-profile-card__name">{hoveredTest.name}</div>
                      <div className="persona-profile-card__age">{hoveredTest.age}</div>
                    </div>
                  </div>
                  {hoveredTest.id === "test2" || hoveredTest.id === "test3" ? (
                    <>
                      {hoveredTest.interests && hoveredTest.interests.length > 0 && (
                        <ul className="persona-profile-card__interests">
                          {hoveredTest.interests.map((it) => (
                            <li key={it} className="persona-profile-card__tag">{it}</li>
                          ))}
                        </ul>
                      )}
                      <p className="persona-profile-card__bio">{hoveredTest.bio}</p>
                    </>
                  ) : (
                    <>
                      <p className="persona-profile-card__bio">{hoveredTest.bio}</p>
                      {hoveredTest.interests && hoveredTest.interests.length > 0 && (
                        <ul className="persona-profile-card__interests">
                          {hoveredTest.interests.map((it) => (
                            <li key={it} className="persona-profile-card__tag">{it}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </aside>

          <section className="mlp-right" ref={rightRef}>
            {mounted && (
              <div className="canvas-wrap" id="canvasWrap" style={{ "--scale": scale, "--offsetY": `${PHONE_OFFSET_Y}px` }}>
                <div className="canvas-frame mlp-phone" id="canvasFrame">
                  <div
                    className="canvas-inner"
                    id="canvas"
                    data-test-scope={testId}
                    style={{
                      backgroundColor: "transparent",
                      backgroundImage: `url(${HOME_BG})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      justifyContent: "flex-start",
                    }}
                  />
                </div>
                <div id="pipelineOutput" style={{ display: "none" }} />
              </div>
            )}

            {mounted && testId === "test1" && (
              <form className="gen-input-container" onSubmit={handleGenSubmit}>
                <input
                  type="text"
                  className="gen-input"
                  placeholder="필요한 기능을 입력하세요 (예: 운동과 음악)"
                  value={genInput}
                  onChange={(e) => setGenInput(e.target.value)}
                  disabled={isGenerating}
                />
                <button type="submit" className="gen-submit" disabled={isGenerating}>
                  {isGenerating ? (
                    <div className="gen-loading" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  )}
                </button>
              </form>
            )}

            {mounted && testId === "test2" && (
              <button
                className="gen-input-container p2-agent-trigger"
                onClick={handleP2StarClick}
                style={{ cursor: "pointer", border: "none", width: "auto" }}
              >
                <div className="gen-submit" style={{ background: "var(--p2-lavender, #FF9748)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" fill="#fff" />
                  </svg>
                </div>
                <span style={{ color: "#fff", fontSize: "14px", fontWeight: "600", marginLeft: "4px" }}>AI 에이전트 실행</span>
              </button>
            )}
          </section>
        </div>

        {/* ─── Gradient Editor (temporary tool) ─────────────────────
            Floating panel for tweaking each persona badge's conic
            gradient live. Closed by default — toggle via the 🎨 button.
            Doesn't touch the badge gradient until opened. Available on
            ALL test pages (test1, test2, test3) per user direction. */}
        {(
          <>
            <button
              type="button"
              className="grad-editor-toggle"
              onClick={() => setGradEditorOpen((v) => !v)}
              aria-label={gradEditorOpen ? "Close gradient editor" : "Open gradient editor"}
              title={gradEditorOpen ? "Close gradient editor" : "Open gradient editor"}
            >
              🎨
            </button>
            {gradEditorOpen && (
              <div className="grad-editor" role="dialog" aria-label="Gradient editor">
                <div className="grad-editor__head">
                  <strong>Gradient Editor</strong>
                  <button
                    type="button"
                    className="grad-editor__close"
                    onClick={() => setGradEditorOpen(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="grad-editor__avatars">
                  {[
                    { id: "test2", label: "Mid avatar (서현)" },
                    { id: "test3", label: "3rd avatar (유진)" },
                  ].map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`grad-editor__tab${gradEditorAvatar === a.id ? " is-active" : ""}`}
                      onClick={() => setGradEditorAvatar(a.id)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <div className="grad-editor__timeline">
                  <div className="grad-editor__timeline-label">Timeline (seconds)</div>
                  <div className="grad-editor__timeline-points">
                    {TIMELINE_SECONDS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`grad-editor__time${gradEditorTime === t ? " is-active" : ""}`}
                        onClick={() => setGradEditorTime(t)}
                      >
                        {t}s
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grad-editor__stops">
                  <div className="grad-editor__stops-label">
                    Color stops at t={gradEditorTime}s
                  </div>
                  {(gradConfigs[gradEditorAvatar][gradEditorTime] || []).map((stop, i) => (
                    <div key={i} className="grad-editor__stop">
                      <span className="grad-editor__stop-idx">#{i + 1}</span>
                      <input
                        type="color"
                        value={stop.c}
                        onChange={(e) => updateStop(i, "c", e.target.value)}
                        className="grad-editor__color"
                        aria-label={`Stop ${i + 1} color`}
                      />
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="1"
                        value={stop.p}
                        onChange={(e) => updateStop(i, "p", Number(e.target.value))}
                        className="grad-editor__angle"
                        aria-label={`Stop ${i + 1} angle`}
                      />
                      <input
                        type="number"
                        min="0"
                        max="360"
                        value={stop.p}
                        onChange={(e) => updateStop(i, "p", Number(e.target.value))}
                        className="grad-editor__angle-num"
                        aria-label={`Stop ${i + 1} angle value`}
                      />
                      <span className="grad-editor__deg">°</span>
                    </div>
                  ))}
                </div>
                <div className="grad-editor__actions">
                  <button
                    type="button"
                    className="grad-editor__btn"
                    onClick={copyStopsToAllTimes}
                    title="Copy current stops to every timeline point"
                  >
                    Copy → all times
                  </button>
                </div>
                <div className="grad-editor__hint">
                  Static preview: the stops at t={gradEditorTime}s render as
                  the badge's ring color. Animated keyframes across the
                  timeline can be wired in next.
                </div>
              </div>
            )}
            <style>{`
              .grad-editor-toggle {
                position: fixed;
                right: 16px;
                bottom: 16px;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: 1px solid rgba(255,255,255,0.15);
                background: rgba(28,28,32,0.85);
                color: #fff;
                font-size: 18px;
                cursor: pointer;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                -webkit-backdrop-filter: blur(10px);
                        backdrop-filter: blur(10px);
              }
              .grad-editor-toggle:hover {
                background: rgba(40,40,44,0.92);
              }
              .grad-editor {
                position: fixed;
                right: 16px;
                bottom: 72px;
                width: 360px;
                max-height: 80vh;
                overflow-y: auto;
                background: rgba(20,20,24,0.94);
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 14px;
                padding: 14px;
                color: #f3f3f5;
                font-family: 'Inter', system-ui, sans-serif;
                font-size: 12px;
                z-index: 10000;
                box-shadow: 0 16px 48px rgba(0,0,0,0.5);
                -webkit-backdrop-filter: blur(18px);
                        backdrop-filter: blur(18px);
              }
              .grad-editor__head {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
              }
              .grad-editor__close {
                background: none;
                border: none;
                color: rgba(255,255,255,0.6);
                font-size: 20px;
                line-height: 1;
                cursor: pointer;
                padding: 0 4px;
              }
              .grad-editor__avatars {
                display: flex;
                gap: 6px;
                margin-bottom: 12px;
              }
              .grad-editor__tab {
                flex: 1;
                padding: 6px 8px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.10);
                background: rgba(255,255,255,0.04);
                color: rgba(255,255,255,0.78);
                font-size: 11px;
                cursor: pointer;
              }
              .grad-editor__tab.is-active {
                background: rgba(100,233,227,0.15);
                border-color: rgba(100,233,227,0.5);
                color: #64e9e3;
              }
              .grad-editor__timeline-label,
              .grad-editor__stops-label {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: rgba(255,255,255,0.45);
                margin-bottom: 6px;
              }
              .grad-editor__timeline {
                margin-bottom: 12px;
              }
              .grad-editor__timeline-points {
                display: flex;
                gap: 6px;
              }
              .grad-editor__time {
                flex: 1;
                padding: 4px;
                border-radius: 6px;
                border: 1px solid rgba(255,255,255,0.10);
                background: rgba(255,255,255,0.04);
                color: rgba(255,255,255,0.7);
                font-size: 11px;
                cursor: pointer;
              }
              .grad-editor__time.is-active {
                background: rgba(180,124,255,0.18);
                border-color: rgba(180,124,255,0.55);
                color: #c084fc;
              }
              .grad-editor__stops {
                margin-bottom: 10px;
              }
              .grad-editor__stop {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
              }
              .grad-editor__stop-idx {
                width: 22px;
                font-size: 10px;
                color: rgba(255,255,255,0.5);
              }
              .grad-editor__color {
                width: 28px;
                height: 28px;
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 6px;
                padding: 0;
                background: transparent;
                cursor: pointer;
              }
              .grad-editor__angle {
                flex: 1;
                accent-color: #c084fc;
              }
              .grad-editor__angle-num {
                width: 48px;
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 6px;
                padding: 4px 6px;
                color: #fff;
                font-size: 11px;
                font-family: 'JetBrains Mono', monospace;
              }
              .grad-editor__deg {
                color: rgba(255,255,255,0.45);
                font-size: 11px;
              }
              .grad-editor__actions {
                display: flex;
                gap: 6px;
                margin-bottom: 10px;
              }
              .grad-editor__btn {
                padding: 6px 10px;
                border-radius: 6px;
                border: 1px solid rgba(255,255,255,0.10);
                background: rgba(255,255,255,0.04);
                color: rgba(255,255,255,0.85);
                font-size: 11px;
                cursor: pointer;
              }
              .grad-editor__btn:hover {
                background: rgba(255,255,255,0.10);
              }
              .grad-editor__hint {
                font-size: 10px;
                color: rgba(255,255,255,0.45);
                line-height: 1.5;
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid rgba(255,255,255,0.06);
              }
            `}</style>
          </>
        )}
      </main>

      <TestScripts />
    </>
  );
}
