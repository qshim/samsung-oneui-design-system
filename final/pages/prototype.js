import Head from "next/head";
import Script from "next/script";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import DotRunningCoach from "../components/cards/DotRunningCoach";
import CameraDotTransition from "../components/prototype/CameraDotTransition";

export default function PrototypePage() {
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState("normal"); // "normal" | "dot"
  const [activeDot, setActiveDot] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [scenario, setScenario] = useState("home"); // "lock" | "home"
  const [genInput, setGenInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [scale, setScale] = useState(1);
  const rightRef = useRef(null);

  const LOCK_BG = "/assets/bg-new.png";
  const HOME_BG = "/assets/bg-new.png?v=2";
  const PHONE_OFFSET_Y = 36; // push device slightly downward
  const PHONE_W = 388;
  const PHONE_H = 880;
  const PHONE_RADIUS = 30;

  const handleTileClick = (title) => {
    if (title === "health") {
      goHealth();
      return;
    }
    if (title === "lock") {
      goLock();
      return;
    }
    if (title === "home") {
      goHome();
      return;
    }
    if (viewMode === "normal") {
      if (typeof window !== "undefined" && window.pipelineGenerate) {
        window.pipelineGenerate(title);
      }
    } else {
      setActiveDot(title);
    }
  };

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    const handleResize = () => {
      // Compute from the real container size (no hardcoded sidebars).
      const rect = rightRef.current ? rightRef.current.getBoundingClientRect() : null;
      const availableWidth = (rect ? rect.width : window.innerWidth) - 48; // breathing room
      const availableHeight = (rect ? rect.height : window.innerHeight) - 48 - PHONE_OFFSET_Y;
      
      const phoneHeight = PHONE_H; 
      const phoneWidth = PHONE_W;

      const scaleH = availableHeight / phoneHeight;
      const scaleW = availableWidth / phoneWidth;
      
      let newScale = Math.min(scaleH, scaleW);
      if (newScale > 1) newScale = 1;
      if (newScale < 0.1) newScale = 0.1; 
      
      setScale(newScale);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // Also react to layout shifts that don't fire window resize
    // (e.g. devtools, font load, flex changes).
    let ro = null;
    if (typeof ResizeObserver !== "undefined" && rightRef.current) {
      ro = new ResizeObserver(() => handleResize());
      ro.observe(rightRef.current);
    }

    // Ensure the phone has a base screen on load.
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (typeof window.generateSurfaceScenario === "function") {
        window.generateSurfaceScenario("tab-root");
        clearInterval(t);
      }
      if (tries > 40) clearInterval(t);
    }, 80);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", handleResize);
      if (ro) {
        try { ro.disconnect(); } catch (e) {}
      }
    };
  }, []);

  const generateFromPrompt = () => {
    alert("현재 사용 불가한 기능입니다.");
    return;
  };

  const goLock = () => {
    setScenario("lock");
    if (typeof window !== "undefined" && typeof window.generateSurfaceScenario === "function") {
      window.generateSurfaceScenario("lockscreen");
      const canvas = document.getElementById("canvas");
      if (canvas) canvas.setAttribute("data-scenario", "lockscreen");
    }
  };

  const goLockDot = () => {
    setScenario("lockscreen-persona2");
    if (typeof window !== "undefined" && typeof window.generateSurfaceScenario === "function") {
      window.generateSurfaceScenario("lockscreen-persona2");
      const canvas = document.getElementById("canvas");
      if (canvas) canvas.setAttribute("data-scenario", "lockscreen-persona2");
    }
  };

  const goHome = () => {
    setScenario("home");
    if (typeof window !== "undefined" && typeof window.generateSurfaceScenario === "function") {
      window.generateSurfaceScenario("tab-root");
      const canvas = document.getElementById("canvas");
      if (canvas) canvas.setAttribute("data-scenario", "tab-root");
    }
  };

  const goHealth = () => {
    setScenario("health");
    if (typeof window !== "undefined" && typeof window.generateSurfaceScenario === "function") {
      window.generateSurfaceScenario("health-mlp");
      const canvas = document.getElementById("canvas");
      if (canvas) canvas.setAttribute("data-scenario", "health-mlp");
    }
  };

  const handleGenSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!genInput.trim() || isGenerating) return;

    setIsGenerating(true);
    
    let genInterval;
    if (typeof window !== "undefined") {
      const texts = [
        { time: "AI:  ", meta: "PLAN  ", color: "#FF7F24" },
        { time: "NEW: ", meta: "UI    ", color: "#A78BFA" },
        { time: "UP:  ", meta: "DATE  ", color: "#5CE1D6" },
        { time: "ON:  ", meta: "IT    ", color: "#FFB01C" }
      ];
      let tIdx = 0;
      
      // Preserve existing components but remove any dot-time-matrix so we can replace it at the top
      let currentWidgets = window.__p1_custom_widgets ? [...window.__p1_custom_widgets] : [];
      currentWidgets = currentWidgets.filter(w => w.role !== 'dot-time-matrix');
      
      const updateGenUI = () => {
        const textObj = texts[tIdx % texts.length];
        window.__p1_custom_widgets = [
          { role: "dot-time-matrix", variant: { time: textObj.time, meta: textObj.meta, dotColor: textObj.color } },
          ...currentWidgets
        ];
        if (typeof window.generateSurfaceScenario === "function") {
          window.generateSurfaceScenario("tab-root");
        }
        tIdx++;
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
        let hasTimeMatrix = widgets.find(w => w.role === 'dot-time-matrix');
        if (hasTimeMatrix) {
          widgets = widgets.filter(w => w.role !== 'dot-time-matrix');
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
        if (window.__p1_custom_widgets && window.__p1_custom_widgets.length > 0) {
          if (typeof window.generateSurfaceScenario === "function") {
            window.generateSurfaceScenario("tab-root");
          }
        }
      }, 100);
    }
  };

  const handleP2StarClick = () => {
    if (typeof window.startP2VoiceInput === 'function') {
      window.startP2VoiceInput();
    }
  };

  return (
    <>
      <Head>
        <title>GenUI - Samsung One UI 8.5 Design Builder</title>
        <style>{`
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
            pointer-events: auto !important;
            background: rgba(255, 255, 255, 0.08) !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            color: #fff !important;
            padding: 8px 24px !important;
            border-radius: 999px !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            backdrop-filter: blur(10px) !important;
            text-decoration: none !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .nav-btn:hover {
            background: rgba(255, 255, 255, 0.15) !important;
            transform: translateY(-2px) !important;
            border-color: rgba(255, 255, 255, 0.3) !important;
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
            overflow: hidden !important;
            border: 2px solid rgba(255,255,255,0.1) !important;
            box-shadow: 0 6px 16px rgba(0,0,0,0.4) !important;
            transition: all 0.3s ease !important;
            background: #1a1a1e !important;
            display: block !important;
          }
          .persona-circle.is-disabled {
            opacity: 0.38 !important;
            filter: grayscale(0.35) brightness(0.55) !important;
            cursor: not-allowed !important;
            pointer-events: none !important;
            border-color: rgba(255,255,255,0.06) !important;
            box-shadow: none !important;
          }
          .persona-circle:not(.is-disabled):hover {
            transform: scale(1.08) !important;
            border-color: #64e9e3 !important;
          }
          .persona-circle:not(.is-disabled):active {
            transform: scale(0.95) !important;
          }
          .persona-img {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            display: block !important;
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
          .gen-submit:hover {
            transform: scale(1.1) !important;
            background: #7ff5f0 !important;
          }
          .gen-submit:active {
            transform: scale(0.9) !important;
          }
          .gen-submit:disabled {
            background: rgba(255, 255, 255, 0.1) !important;
            cursor: not-allowed !important;
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

      <main className="app-shell">
        <nav className="page-nav">
          <a href="/" className="nav-btn">← Back</a>
          <a href="/theme" className="nav-btn">Theme →</a>
        </nav>

        <div className="mlp-workspace">
          <aside className="mlp-left">
            <span className="persona-circle is-disabled" aria-disabled="true" title="준비 중">
              <img src="/assets/persona-1.png" alt="Persona 1" className="persona-img" />
            </span>
            <Link href="/test2" className="persona-circle" style={{ cursor: 'pointer', border: scenario === 'lockscreen-persona2' ? '3px solid #fff' : 'none' }}>
              <img src="/assets/persona-2.png" alt="Persona 2" className="persona-img" />
            </Link>
            <Link href="/test3" className="persona-circle" style={{ cursor: 'pointer' }}>
              <img src="/assets/persona-3.png" alt="Persona 3" className="persona-img" />
            </Link>
          </aside>

          <section className="mlp-right" ref={rightRef}>
            {mounted && (viewMode === "normal" ? (
              <div className="canvas-wrap" id="canvasWrap" style={{ '--scale': scale, '--offsetY': `${PHONE_OFFSET_Y}px` }}>
                <div className="canvas-frame mlp-phone" id="canvasFrame">
                  <div
                    className="canvas-inner"
                    id="canvas"
                    style={{
                      backgroundColor: "transparent",
                      backgroundImage: `url(${HOME_BG})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      justifyContent: "flex-start"
                    }}
                  >
                  </div>
                </div>
                <div id="pipelineOutput" style={{ display: "none" }}></div>
              </div>
            ) : (
              <div className="canvas-wrap" style={{ '--scale': scale, '--offsetY': `${PHONE_OFFSET_Y}px` }}>
                <div className="canvas-frame mlp-phone">
                  <div className="canvas-inner" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#5974B2", backgroundImage: `url(${HOME_BG})`, backgroundSize: "cover", overflow: "hidden" }}>
                    {activeDot === "dot-running" && <DotRunningCoach />}
                    {activeDot && activeDot !== "dot-running" && (
                      <div
                        id="dot-detail-preview"
                        style={{ zoom: 0.8 }}
                        dangerouslySetInnerHTML={{
                          __html:
                            typeof window !== "undefined" && typeof window.renderAtomicForRole === "function"
                              ? window.renderAtomicForRole({ role: activeDot }, { w: 310, h: 165 })
                              : "",
                        }}
                      />
                    )}
                    {!activeDot && <div style={{ color: "#999" }}>좌측에서 컴포넌트를 선택해주세요.</div>}
                  </div>
                </div>
              </div>
            ))}

            {mounted && scenario === "home" && (
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
            {mounted && scenario === "lockscreen-persona2" && (
              <button 
                className="gen-input-container p2-agent-trigger" 
                onClick={handleP2StarClick}
                style={{ cursor: 'pointer', border: 'none', width: 'auto' }}
              >
                <div className="gen-submit" style={{ background: 'var(--p2-lavender, #B9A6FF)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                    <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" fill="#fff"/>
                  </svg>
                </div>
                <span style={{ color: '#fff', fontSize: '14px', fontWeight: '600', marginLeft: '4px' }}>AI 에이전트 실행</span>
              </button>
            )}
          </section>
        </div>
      </main>

      {/* Load all required scripts for the prototype */}
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
      <Script src="/app/surface-layout.js?v=runpanel-dot-level-87" strategy="beforeInteractive" />
      <Script src="/app/settings.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/canvas.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/rules-renderer.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/scenes.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/scene-inspector.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/cached-screens.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/ui-panels.js?v=2" strategy="beforeInteractive" />
      <Script src="/app/main.js?v=2" strategy="beforeInteractive" />
      <Script src="/prototype-logic.js?v=59" strategy="lazyOnload" />
    </>
  );
}
