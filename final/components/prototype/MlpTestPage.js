import Head from "next/head";
import Script from "next/script";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Test3PillShinyTextBridge } from "../test3/Test3PillShinyTextMount";

const PHONE_OFFSET_Y = 36;
const PHONE_W = 388;
const PHONE_H = 880;
const PHONE_RADIUS = 30;
const HOME_BG = "/assets/bg-new.png?v=2";
/** Phone canvas backdrop per test (not full-viewport workspace bg). */
const PHONE_BG_BY_TEST = {
  test1: "/assets/test1/mobile-bg.png?v=1",
  test2: "/assets/test2/test2-wallpaper.png?v=2",
  test3: "/assets/test3/test3-wallpaper.png?v=4",
};
/** Full-viewport workspace backdrop per test page (not the phone canvas). */
const WORKSPACE_BGS = {
  test1: "/assets/test1-workspace-bg.png",
  test2: "/assets/test2/test2-workspace-bg.png",
  test3: "/assets/test3/test3-workspace-bg.png",
};

/** White conic ring — shared by test1/test2/test3 persona badges. */
const PERSONA_RING_WHITE_GRADIENT =
  "conic-gradient(from 0deg, rgba(255,255,255,0.18) 0deg, rgba(255,255,255,0.55) 55deg, rgba(255,255,255,1) 110deg, rgba(255,255,255,0.72) 175deg, rgba(255,255,255,0.22) 250deg, rgba(255,255,255,0.12) 310deg, rgba(255,255,255,0.18) 360deg)";

// Persona 1 ring mirrors test2 custom gradient when the editor is open.
function syncTest1RingFromTest2() {
  if (typeof document === "undefined") return;
  var test2El = document.querySelector('.persona-circle[data-avatar-key="test2"]');
  var test1El = document.querySelector('.persona-circle[data-avatar-key="test1"]');
  if (!test2El || !test1El) return;
  ["--persona-c1", "--persona-c2", "--persona-c3", "--persona-c4"].forEach(function (prop) {
    var val = test2El.style.getPropertyValue(prop);
    if (!val || !val.trim()) val = getComputedStyle(test2El).getPropertyValue(prop);
    val = val && val.trim();
    if (val) test1El.style.setProperty(prop, val);
  });
  var custom = test2El.style.getPropertyValue("--persona-custom-gradient").trim();
  if (custom) test1El.style.setProperty("--persona-custom-gradient", custom);
  else test1El.style.removeProperty("--persona-custom-gradient");
}

/** Persona badge video — first frame at rest; hover plays once to last frame; active page freezes end. */
const PERSONA_VIDEO_END_EPS = 0.04;

function queryPersonaVideo(avatarKey) {
  if (typeof document === "undefined" || !avatarKey) return null;
  return document.querySelector(
    '.persona-circle[data-avatar-key="' + avatarKey + '"] .persona-video'
  );
}

function whenPersonaVideoReady(video, fn) {
  if (!video) return;
  if (video.readyState >= 1) fn();
  else video.addEventListener("loadedmetadata", fn, { once: true });
}

function setPersonaVideoFrame(avatarKey, frame) {
  var video = queryPersonaVideo(avatarKey);
  if (!video) return;
  whenPersonaVideoReady(video, function () {
    video.pause();
    try {
      if (frame === "end" && video.duration && isFinite(video.duration)) {
        video.currentTime = Math.max(0, video.duration - PERSONA_VIDEO_END_EPS);
      } else {
        video.currentTime = 0;
      }
    } catch (_) {}
  });
}

function playPersonaVideoToEnd(avatarKey) {
  var video = queryPersonaVideo(avatarKey);
  if (!video) return;
  whenPersonaVideoReady(video, function () {
    try { video.currentTime = 0; } catch (_) {}
    var p = video.play();
    if (p && typeof p.catch === "function") p.catch(function () {});
  });
}

function syncAllPersonaVideoFrames(activeId) {
  TESTS.forEach(function (t) {
    if (!t.video || t.disabled) return;
    setPersonaVideoFrame(t.id, t.id === activeId ? "end" : "start");
  });
}

const TESTS = [
  {
    id: "test1", href: "/test1", label: "Persona 1", img: "/assets/persona01.png",
    video: "/mp4/t1.mp4",
    name: "지수",
    age: "45, Teacher",
    bioLines: [
      "중학교 국어 교사, 매일 오후 6시 퇴근하며 딸과 둘이 거주.",
      "냉장고 재료 기반으로 직접 저녁 준비, 식단을 계획적으로 관리.",
    ],
    interests: ["Evening routine", "Home cooking", "SmartThings user"],
  },
  {
    id: "test2", href: "/test2", label: "Persona 2", img: "/assets/persona-2.png?v=3",
    video: "/mp4/t2.mp4",
    name: "박서현",
    age: "28, Product Designer",
    bioLines: [
      "6일간 휴가 후 복귀. 분석적이고 계획적인 성격,",
      "데이터 기반 의사결정과 체계적인 업무 진행 선호",
    ],
    interests: ["Design reviews", "Dev collaboration", "Figma expert"],
  },
  {
    id: "test3", href: "/test3", label: "Persona 3", img: "/assets/persona-3.png?v=3",
    video: "/mp4/t3.mp4",
    name: "유진",
    age: "31, Backend Developer",
    bioLines: [
      "주 4-5회 한강 조깅, 인디 음악과 함께 혼자만의 시간을 즐김.",
      "기록보다 꾸준함을 중시하는 데이터 기반 러너",
    ],
    interests: ["Evening runner", "Indie music lover", "Data-driven fitness"],
  },
];

function TestScripts({ testId }) {
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
      <Script src="/app/surface-layout.js?v=mlp-test1-lock-shortcut-57-1" strategy="beforeInteractive" />
      <Script src="/app/surface-layout.js?v=mlp-test2-shrink-flow-1" strategy="beforeInteractive" />
      <Script src="/app/settings.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/canvas.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/rules-renderer.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/scenes.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/scene-inspector.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/cached-screens.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/ui-panels.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/main.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/p2-agent-fill-gl.js?v=36" strategy="beforeInteractive" />
      <Script src="/app/p2-galaxy-star.js?v=11" strategy="beforeInteractive" />
      <Script src="/prototype-logic.js?v=mlp-test2-loading-handoff-1" strategy="lazyOnload" />
    </>
  );
}

export default function MlpTestPage({
  testId = "test1",
  title = "MLP Test",
  initialSurfaceType = "tab-root",
}) {
  const [mounted, setMounted] = useState(false);
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
    { c: "rgba(255,255,255,0.18)", p: 0 },
    { c: "rgba(255,255,255,0.55)", p: 55 },
    { c: "rgba(255,255,255,1)", p: 110 },
    { c: "rgba(255,255,255,0.72)", p: 175 },
    { c: "rgba(255,255,255,0.18)", p: 360 },
  ];
  const DEFAULT_STOPS_TEST3 = [
    { c: "rgba(255,255,255,0.18)", p: 0 },
    { c: "rgba(255,255,255,0.55)", p: 55 },
    { c: "rgba(255,255,255,1)", p: 110 },
    { c: "rgba(255,255,255,0.72)", p: 175 },
    { c: "rgba(255,255,255,0.18)", p: 360 },
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
      syncTest1RingFromTest2();
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
    syncTest1RingFromTest2();
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

  // ─── Entry Sequence ───
  // When switching tests, the mobile frame slides up from below with opacity.
  // Delay entry by 2 seconds per user request.
  const [isEntering, setIsEntering] = useState(false);

  useEffect(() => {
    setIsEntering(false);
    const timer = setTimeout(() => setIsEntering(true), 1000);
    return () => clearTimeout(timer);
  }, [testId]);

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
  // Badge stack spacing stays on flex gap: 24px — never shift on hover.
  const shouldOffsetStack = false;
  const workspaceBg = WORKSPACE_BGS[testId] || WORKSPACE_BGS.test1;

  const renderPersonaAvatar = (test) => {
    var videoEl = test.video ? (
      <video
        className="persona-video"
        src={test.video}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
    ) : null;
    /* Hidden — palette ring extraction only; visible media is .persona-video */
    var paletteImg = test.img ? (
      <img
        src={test.img}
        alt=""
        className={"persona-img persona-img--palette" + (test.id === "test1" ? " persona-img--test1" : "")}
        aria-hidden="true"
      />
    ) : null;
    if (test.id === "test1") {
      return (
        <span className="persona-avatar-fill" aria-hidden="true">
          <span className="persona-avatar-fill__ellipse" />
          {paletteImg}
          {videoEl}
        </span>
      );
    }
    return (
      <span className="persona-avatar-media" aria-hidden="true">
        {paletteImg}
        {videoEl}
      </span>
    );
  };

  useEffect(() => {
    if (!mounted) return undefined;
    syncAllPersonaVideoFrames(testId);
    var cleanups = [];
    TESTS.forEach(function (t) {
      if (!t.video) return;
      var video = queryPersonaVideo(t.id);
      if (!video) return;
      var onEnded = function () {
        video.pause();
        try {
          if (video.duration && isFinite(video.duration)) {
            video.currentTime = Math.max(0, video.duration - PERSONA_VIDEO_END_EPS);
          }
        } catch (_) {}
      };
      video.addEventListener("ended", onEnded);
      cleanups.push(function () {
        video.removeEventListener("ended", onEnded);
      });
    });
    return function () {
      cleanups.forEach(function (fn) { fn(); });
    };
  }, [mounted, testId]);

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
      var key = badge.getAttribute("data-avatar-key");
      // test1 ring palette is mirrored from test2 — skip image extraction.
      if (key === "test1") return;
      var img = badge.querySelector("img.persona-img");
      if (!img) return;
      function go() {
        var colors = extract(img);
        if (!colors || colors.length < 4) return;
        badge.style.setProperty("--persona-c1", colors[0]);
        badge.style.setProperty("--persona-c2", colors[1]);
        badge.style.setProperty("--persona-c3", colors[2]);
        badge.style.setProperty("--persona-c4", colors[3]);
        if (key === "test2") syncTest1RingFromTest2();
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

    const onPageShow = (ev) => {
      if (testId !== "test2" || !ev.persisted) return;
      if (typeof window.resetTest2P2Runtime === "function") {
        window.resetTest2P2Runtime(document.getElementById("canvas"));
      }
      if (typeof window.generateSurfaceScenario === "function") {
        window.generateSurfaceScenario(initialSurfaceType);
      }
    };
    if (testId === "test2") {
      window.addEventListener("pageshow", onPageShow);
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
      if (testId === "test2") {
        window.removeEventListener("pageshow", onPageShow);
        if (typeof window.resetTest2P2Runtime === "function") {
          window.resetTest2P2Runtime(document.getElementById("canvas"));
        }
      }
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
            background-color: #0b0b0e !important;
            background-image: url(${workspaceBg}) !important;
            background-size: cover !important;
            background-position: center center !important;
            background-repeat: no-repeat !important;
            background-attachment: fixed !important;
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
            background-color: transparent !important;
            background-image: url(${workspaceBg}) !important;
            background-size: cover !important;
            background-position: center center !important;
            background-repeat: no-repeat !important;
            transition: background-image 0.8s ease-in-out !important;
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
            background-color: transparent !important;
            background-image: url(${workspaceBg}) !important;
            background-size: cover !important;
            background-position: center center !important;
            background-repeat: no-repeat !important;
            position: relative !important;
            transition: background-image 0.8s ease-in-out !important;
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
            z-index: 6000 !important;
          }
          /* Flex slot grows with the 1.8× badge so gap: 24px is kept
             between slots and neighbours never overlap. */
          .persona-slot {
            --persona-badge-size: 76px;
            --persona-hover-scale: 1.8;
            width: var(--persona-badge-size) !important;
            height: var(--persona-badge-size) !important;
            flex: 0 0 auto !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            position: relative !important;
          }
          .persona-slot:has(.persona-circle:not(.is-disabled):hover),
          .persona-slot:has(.persona-circle:not(.is-disabled).is-hovered) {
            z-index: 4 !important;
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
            box-shadow: none !important;
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
            /* White swirl ring (test1/2/3); editor may override via
               --persona-custom-gradient. */
            background: var(--persona-custom-gradient, ${PERSONA_RING_WHITE_GRADIENT});
            -webkit-mask:
              linear-gradient(#000 0 0) content-box,
              linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
                    mask-composite: exclude;
            opacity: 0;
            transition: opacity 220ms cubic-bezier(0.2, 0, 0, 1);
            pointer-events: none;
            will-change: --persona-ring-angle, padding, opacity, filter;
            /* Above avatar fill/img so the stroke ring stays visible on test1. */
            z-index: 1;
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
          .persona-circle[data-avatar-key="test1"] {
            background: #E0F2C4 !important;
          }
          .persona-circle[data-avatar-key="test1"]::before,
          .persona-circle[data-avatar-key="test2"]::before,
          .persona-circle[data-avatar-key="test3"]::before {
            background: var(--persona-custom-gradient, ${PERSONA_RING_WHITE_GRADIENT});
          }
          .persona-circle[data-avatar-key="test1"] .persona-avatar-fill {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            overflow: hidden;
            z-index: 0;
            pointer-events: none;
          }
          .persona-circle[data-avatar-key="test1"] .persona-avatar-fill__ellipse {
            display: none;
          }
          .persona-circle .persona-avatar-media {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            overflow: hidden;
            z-index: 0;
            pointer-events: none;
          }
          .persona-circle .persona-img,
          .persona-circle .persona-img--palette {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
          .persona-circle .persona-video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center center;
            border-radius: 50%;
            opacity: 1;
            z-index: 1;
            pointer-events: none;
          }
          .persona-circle[data-avatar-key="test1"] .persona-video {
            transform: scale(1.04);
          }
          .persona-circle[data-avatar-key="test1"]:not(:hover):not(.is-hovered)::before {
            animation: none !important;
            opacity: 0 !important;
            padding: 2px !important;
            filter: none !important;
            transform: none !important;
          }
          .persona-circle[data-avatar-key="test1"]:not(:hover):not(.is-hovered) {
            transform: none !important;
          }
          .persona-circle:not(.is-disabled):hover,
          .persona-circle:not(.is-disabled).is-hovered {
            /* Enlarged state — 1.8× scale; the parent .persona-slot grows
               in flex layout by the same factor so gap: 24px between
               slots is preserved and neighbours never overlap. */
            transform: scale(1.8) !important;
          }
          .persona-circle:not(.is-disabled):hover::before,
          .persona-circle:not(.is-disabled).is-hovered::before {
            /* Hover preview — one-shot per hover. Per user direction:
               "avatar gradient wheel motion should not repeat. once
               when mouse is hovered. it should play back if the mouse
               cursor moves out of the region and hovered again."
                 personaCircleHoverSpin: 2 s forwards (one lifecycle —
                   grow-in / hold / shrink-out, hold end state).
                 personaCircleHoverRotate: 1 iteration × 2 s = 2 s
                   (FINITE — matches the spin lifetime exactly, so
                   rotation also stops when the lifecycle completes).
               When the user un-hovers, the rules stop matching and
               the animations are reset. Re-hovering restarts both
               from frame 0 — fresh playback every time. */
            animation:
              personaCircleHoverSpin 2s linear 1 forwards,
              personaCircleHoverRotate 2s linear 1 forwards;
          }
          .persona-circle:not(.is-disabled).is-active:not([data-avatar-key="test1"])::before {
            /* INITIAL state of active badge — no stroke per user direction. */
            animation: none;
            opacity: 0;
          }
          .mlp-left.has-interacted .persona-circle:not(.is-disabled).is-active:not([data-avatar-key="test1"])::before {
            /* AFTER the user has hovered any badge at least once, the
               active badge stays invisible when un-hovered. */
            animation: none;
            opacity: 0;
          }
          /* When the user explicitly HOVERS the active badge, restore
             rotation — per user direction "when hovered, it should
             rotate". Higher specificity than .has-interacted .is-active
             alone, so this wins the cascade for the active+hover case. */
          .persona-circle:not(.is-disabled).is-active:hover::before,
          .persona-circle:not(.is-disabled).is-active.is-hovered::before,
          .mlp-left.has-interacted .persona-circle:not(.is-disabled).is-active:hover::before,
          .mlp-left.has-interacted .persona-circle:not(.is-disabled).is-active.is-hovered::before {
            /* Same one-shot 2s lifecycle as the non-active hover rule —
               rotation runs 1 iteration then stops. Re-hover restarts. */
            animation:
              personaCircleHoverSpin 2s linear 1 forwards,
              personaCircleHoverRotate 2s linear 1 forwards;
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
          .persona-circle[data-avatar-key="test2"],
          .persona-circle[data-avatar-key="test3"] {
            overflow: hidden !important;
          }
          /* test2/test3 — match portrait fill (test1 uses #E0F2C4 + video scale).
             Dark default #1a1a1e + unscaled video leaves a grey/black baked-in
             rim visible at the clip edge; scale crops it like test1. */
          .persona-circle[data-avatar-key="test2"] {
            background: #c8d1ff !important;
          }
          .persona-circle[data-avatar-key="test3"] {
            background: #ebffa4 !important;
          }
          .persona-circle[data-avatar-key="test2"] .persona-video,
          .persona-circle[data-avatar-key="test3"] .persona-video {
            transform: scale(1.08);
            border: none !important;
            outline: none !important;
          }
          /* test2/test3 — white ring uses same hover/active spin as other badges */
          .persona-circle[data-avatar-key="test2"]::after,
          .persona-circle[data-avatar-key="test3"]::after {
            display: none !important;
            opacity: 0 !important;
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
          /* Other badges (not the hovered one) stay in place. */
          .mlp-left.is-hovering .persona-circle[data-hover-offset="-1"] {
            transform: none !important;
          }
          .mlp-left.is-hovering .persona-circle[data-hover-offset="1"] {
            transform: none !important;
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
            /* Hidden rest position is 1px BELOW the hovered badge's
               row. When the .is-visible class is added below, top
               retargets to the badge's actual posY and the top
               transition slides the card UP through that 1px gap.
               Travel is bounded to exactly 1px — an extremely slight,
               refined nudge up. DIRECTION: BOTTOM -> TOP. */
            top: calc(50% - 138px + var(--hover-idx, 0) * 100px - 8px);
            /* Pushed 30px farther right per UX direction (was 100%+8px).
               The card now sits 38px off the badge column rather than
               hugging it — gives the rotating glow on the hovered badge
               room to breathe without bumping the card edge. */
            left: calc(100% + 38px);
            width: 276px;
            padding: 16px 18px 18px;
            border-radius: 16px;
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
            /* translateY removed — the 1px vertical travel is handled
               entirely by the top property now (see the rest-position
               above and the .is-visible override below). Avoids
               stacking two simultaneous vertical motions.
               
               Both states transition top over 220ms so hover-IN slides
               1px up and hover-OUT slides 1px down (symmetric). The
               cross-badge row swap is silenced by .is-snapping which
               is briefly applied while --hover-idx jumps from row A to
               row B — without it, top would animate the full 100px
               column-slide. See React effect above for sequencing. */
            transition:
              opacity 220ms cubic-bezier(0.2, 0, 0, 1);
            z-index: 30;
          }
          .persona-profile-card.is-visible {
            /* Card opacity at 1 so the TEXT (name, age, bio, tags) is
               fully opaque and readable. The half-transparent feel
               comes from the low-alpha rgba background defined above,
               not from card-level opacity. */
            opacity: 1;
            /* Visible position is the badge row's actual top — same calc
               as the hidden state but WITHOUT the +1px offset. The
               top transition above handles the 1px slide up. */
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
            margin-bottom: 10px;
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
            font-size: 14px;
            line-height: 1.2;
            color: #ffffff;
          }
          .persona-profile-card__age {
            font-family: 'Inter', var(--font), sans-serif;
            font-weight: 400;
            font-size: 11px;
            line-height: 1.3;
            color: rgba(255, 255, 255, 0.55);
          }
          .persona-profile-card__bio {
            font-family: 'Inter', var(--font), sans-serif;
            font-weight: 400;
            font-size: 12px;
            line-height: 1.55;
            color: rgba(255, 255, 255, 0.78);
            margin: 0 0 12px;
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
            font-size: 9px;
            letter-spacing: 0.1px;
            line-height: 1.3;
            color: #64e9e3;
            background: rgba(100, 233, 227, 0.08);
            border: 1px solid rgba(100, 233, 227, 0.18);
            padding: 2px 6px;
            border-radius: 99px;
          }
          /* Persona hover cards — slightly smaller than Figma (≈92%). */
          .persona-profile-card--test1,
          .persona-profile-card--test2,
          .persona-profile-card--test3 {
            --persona-card-scale: 0.92;
            transform: scale(var(--persona-card-scale));
            transform-origin: left center;
          }
          /* test2 (박서현) — Figma 5502:16910 */
          .persona-profile-card--test2 {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 371px;
            padding: 21.733px 29.635px;
            gap: 0;
            border-radius: 24.58px;
            background: rgba(40, 42, 44, 0.8);
            -webkit-backdrop-filter: blur(12px);
                    backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.45);
          }
          .persona-profile-card--test2 .persona-profile-card__head {
            margin-bottom: 25.684px;
          }
          .persona-profile-card--test2 .persona-profile-card__heading {
            gap: 0;
            line-height: 1.8;
          }
          .persona-profile-card--test2 .persona-profile-card__name {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 700;
            font-size: 23.76px;
            line-height: 1.8;
            letter-spacing: -0.4752px;
            color: #ffffff;
          }
          .persona-profile-card--test2 .persona-profile-card__age {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 600;
            font-size: 14.748px;
            line-height: 1.8;
            letter-spacing: -0.295px;
            color: #c8d1ff;
            opacity: 0.6;
          }
          .persona-profile-card--test2 .persona-profile-card__interests {
            gap: 5px;
            margin: 0 0 7px;
          }
          .persona-profile-card--test2 .persona-profile-card__tag {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 500;
            font-size: 9.5px;
            letter-spacing: -0.19px;
            line-height: 1.32;
            color: #282a2c;
            background: #c8d1ff;
            border: none;
            padding: 1.5px 7px 2px;
            border-radius: 99px;
          }
          .persona-profile-card--test2 .persona-profile-card__bio {
            display: flex;
            flex-direction: column;
            gap: 0;
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 400;
            font-size: 14.748px;
            line-height: 1.5;
            letter-spacing: -0.295px;
            color: #ebe8df;
            margin: 0;
            white-space: normal;
            word-break: keep-all;
          }
          .persona-profile-card--test2 .persona-profile-card__bio-line {
            display: block;
          }
          .persona-profile-card--test2.is-visible .persona-profile-card__bio {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          /* test1 (지수) — Figma 5502:17167 */
          .persona-profile-card--test1 {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 406px;
            padding: 21.74px 34.587px 21.74px 29.646px;
            gap: 0;
            border-radius: 24.588px;
            background: rgba(40, 42, 44, 0.8);
            -webkit-backdrop-filter: blur(12px);
                    backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.45);
          }
          .persona-profile-card--test1 .persona-profile-card__head {
            margin-bottom: 25.693px;
          }
          .persona-profile-card--test1 .persona-profile-card__heading {
            gap: 0;
            line-height: 1.8;
          }
          .persona-profile-card--test1 .persona-profile-card__name {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 700;
            font-size: 23.769px;
            line-height: 1.8;
            letter-spacing: -0.4754px;
            color: #ffffff;
          }
          .persona-profile-card--test1 .persona-profile-card__age {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 600;
            font-size: 14.753px;
            line-height: 1.8;
            letter-spacing: -0.2951px;
            color: #bde5ec;
            opacity: 0.6;
          }
          .persona-profile-card--test1 .persona-profile-card__interests {
            gap: 5px;
            margin: 0 0 7px;
          }
          .persona-profile-card--test1 .persona-profile-card__tag {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 500;
            font-size: 9.5px;
            letter-spacing: -0.19px;
            line-height: 1.32;
            color: #282a2c;
            background: #bde5ec;
            border: none;
            padding: 1.5px 7px 2px;
            border-radius: 99px;
          }
          .persona-profile-card--test1 .persona-profile-card__bio {
            display: flex;
            flex-direction: column;
            gap: 0;
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 400;
            font-size: 14.753px;
            line-height: 1.5;
            letter-spacing: -0.2951px;
            color: #ebe8df;
            margin: 0;
            white-space: normal;
            word-break: keep-all;
          }
          .persona-profile-card--test1 .persona-profile-card__bio-line {
            display: block;
          }
          .persona-profile-card--test1.is-visible .persona-profile-card__bio {
            animation: personaCardTextRise 220ms cubic-bezier(0.2, 0, 0.05, 1) 200ms both;
          }
          /* test3 (유진) — Figma 5502:16328 */
          .persona-profile-card--test3 {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 406px;
            padding: 21.733px 34.574px 21.733px 29.635px;
            gap: 0;
            border-radius: 24.58px;
            background: rgba(40, 42, 44, 0.8);
            -webkit-backdrop-filter: blur(12px);
                    backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.45);
          }
          .persona-profile-card--test3 .persona-profile-card__head {
            margin-bottom: 25.684px;
          }
          .persona-profile-card--test3 .persona-profile-card__heading {
            gap: 0;
            line-height: 1.8;
          }
          .persona-profile-card--test3 .persona-profile-card__name {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 700;
            font-size: 23.76px;
            line-height: 1.8;
            letter-spacing: -0.4752px;
            color: #ffffff;
          }
          .persona-profile-card--test3 .persona-profile-card__age {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 600;
            font-size: 14.748px;
            line-height: 1.8;
            letter-spacing: -0.295px;
            color: #ebffa4;
            opacity: 0.6;
          }
          .persona-profile-card--test3 .persona-profile-card__interests {
            gap: 5px;
            margin: 0 0 7px;
          }
          .persona-profile-card--test3 .persona-profile-card__tag {
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 500;
            font-size: 9.5px;
            letter-spacing: -0.19px;
            line-height: 1.32;
            color: #282a2c;
            background: #ebffa4;
            border: none;
            padding: 1.5px 7px 2px;
            border-radius: 99px;
          }
          .persona-profile-card--test3 .persona-profile-card__bio {
            display: flex;
            flex-direction: column;
            gap: 0;
            font-family: 'Pretendard', var(--font), sans-serif;
            font-weight: 400;
            font-size: 14.748px;
            line-height: 1.5;
            letter-spacing: -0.295px;
            color: #ebe8df;
            margin: 0;
            white-space: normal;
            word-break: keep-all;
          }
          .persona-profile-card--test3 .persona-profile-card__bio-line {
            display: block;
          }
          .persona-profile-card--test3.is-visible .persona-profile-card__bio {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          /* Staggered text reveal removed to ensure "fixed" appearance. */
          .persona-profile-card.is-visible .persona-profile-card__name,
          .persona-profile-card.is-visible .persona-profile-card__age,
          .persona-profile-card.is-visible .persona-profile-card__bio,
          .persona-profile-card.is-visible .persona-profile-card__tag:nth-child(1),
          .persona-profile-card.is-visible .persona-profile-card__tag:nth-child(2),
          .persona-profile-card.is-visible .persona-profile-card__tag:nth-child(3),
          .persona-profile-card--test2.is-visible .persona-profile-card__bio {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          @keyframes personaCardTextRise {
            0%   { opacity: 0; transform: translateY(0); }
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
          /* Test pages: no phone bezel frame — only clipped canvas content. */
          .mlp-test-page .canvas-wrap {
            width: calc(${PHONE_W}px * var(--scale, 1)) !important;
            height: calc(${PHONE_H}px * var(--scale, 1)) !important;
            flex-shrink: 0 !important;
            position: relative !important;
            overflow: hidden !important;
            border-radius: ${PHONE_RADIUS}px !important;
            background: transparent !important;
            background-image: none !important;
            padding: 0 !important;
            transition: width 0.2s ease-out, height 0.2s ease-out !important;
            margin: 0 auto !important;
            transform: translateY(var(--offsetY, 0px));
            opacity: 0;
            pointer-events: none;
          }
          .mlp-test-page .canvas-wrap.is-entering {
            opacity: 1;
            pointer-events: auto;
            animation: mobileEntryUp 0.8s cubic-bezier(0.2, 0, 0, 1) forwards;
          }
          @keyframes mobileEntryUp {
            from {
              opacity: 0;
              transform: translateY(calc(var(--offsetY, 0px) + 80px));
            }
            to {
              opacity: 1;
              transform: translateY(var(--offsetY, 0px));
            }
          }
          .mlp-test-page .canvas-frame.mlp-phone {
            width: ${PHONE_W}px !important;
            height: ${PHONE_H}px !important;
            transform: scale(var(--scale, 1)) !important;
            transform-origin: top left !important;
            border-radius: ${PHONE_RADIUS}px !important;
            overflow: hidden !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            border: none !important;
            box-shadow: none !important;
            outline: none !important;
            background: transparent !important;
            background-image: none !important;
            transition: transform 0.2s ease-out !important;
          }
          .mlp-test-page .canvas-frame.mlp-phone .canvas-inner {
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
        `}</style>
      </Head>

      <main className="app-shell mlp-test-page" data-mlp-test={testId}>
        <div className="mlp-workspace">
          <aside className={`mlp-left${shouldOffsetStack ? " is-hovering" : ""}${hasInteracted ? " has-interacted" : ""}`}>
            {TESTS.map((test, idx) => {
              const offset = focusIdx < 0 || idx === focusIdx
                ? 0
                : (idx < focusIdx ? -1 : 1);
              const hoveredClass = test.id === hoveredId ? " is-hovered" : "";
              const className = `persona-circle${test.id === testId ? " is-active" : ""}${test.disabled ? " is-disabled" : ""}${hoveredClass}`;
              const onMouseEnter = test.disabled ? undefined : () => {
                setHoveredId(test.id);
                setHasInteracted(true);
                if (test.id !== testId) {
                  playPersonaVideoToEnd(test.id);
                }
              };
              const onMouseLeave = test.disabled ? undefined : () => {
                setPersonaVideoFrame(
                  test.id,
                  test.id === testId ? "end" : "start"
                );
                setHoveredId(prev => prev === test.id ? null : prev);
              };
              if (test.disabled) {
                return (
                  <div key={test.id} className="persona-slot">
                    <span
                      className={className}
                      aria-disabled="true"
                      title="준비 중"
                      data-hover-offset={offset}
                      data-avatar-key={test.id}
                    >
                      {renderPersonaAvatar(test)}
                    </span>
                  </div>
                );
              }
              return (
                <div key={test.id} className="persona-slot">
                  <Link
                    href={test.href}
                    className={className}
                    data-hover-offset={offset}
                    data-avatar-key={test.id}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                  >
                    {renderPersonaAvatar(test)}
                  </Link>
                </div>
              );
            })}
            {/* Profile card — slides in from the right of the hovered
                badge with the persona's bio + interests. CSS positions
                it via --hover-idx so its top tracks whichever badge is
                currently hovered. */}
            <div
              ref={profileCardRef}
              className={`persona-profile-card${cardVisible ? " is-visible" : ""}${hoveredTest?.id === "test1" ? " persona-profile-card--test1" : ""}${hoveredTest?.id === "test2" ? " persona-profile-card--test2" : ""}${hoveredTest?.id === "test3" ? " persona-profile-card--test3" : ""}`}
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
                  {hoveredTest.id === "test2" || hoveredTest.id === "test3" || hoveredTest.id === "test1" ? (
                    <>
                      {hoveredTest.interests && hoveredTest.interests.length > 0 && (
                        <ul className="persona-profile-card__interests">
                          {hoveredTest.interests.map((it) => (
                            <li key={it} className="persona-profile-card__tag">{it}</li>
                          ))}
                        </ul>
                      )}
                      {hoveredTest.bioLines && hoveredTest.bioLines.length > 0 ? (
                        <p className="persona-profile-card__bio">
                          {hoveredTest.bioLines.map((line) => (
                            <span key={line} className="persona-profile-card__bio-line">{line}</span>
                          ))}
                        </p>
                      ) : (
                        <p className="persona-profile-card__bio">{hoveredTest.bio}</p>
                      )}
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
              <div
                className={`canvas-wrap${isEntering ? " is-entering" : ""}`}
                id="canvasWrap"
                style={{ "--scale": scale, "--offsetY": `${PHONE_OFFSET_Y}px` }}
              >
                <div className="canvas-frame mlp-phone" id="canvasFrame">
                  <div
                    className="canvas-inner"
                    id="canvas"
                    data-test-scope={testId}
                    style={{
                      backgroundColor: testId === "test3" ? "#e8a06a" : "transparent",
                      backgroundImage: `url(${PHONE_BG_BY_TEST[testId] || HOME_BG})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                      display: "block",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  />
                </div>
                <div id="pipelineOutput" style={{ display: "none" }} />
              </div>
            )}

          </section>
        </div>

        {/* ─── Gradient Editor (temporary dev tool, toggle hidden) ─── */}
        {(
          <>
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

      <TestScripts testId={testId} />
      {testId === "test3" ? <Test3PillShinyTextBridge /> : null}
    </>
  );
}
