import Script from "next/script";
import Head from "next/head";
import CameraDotTransition from "../components/prototype/CameraDotTransition";

export default function ThemePage() {
  return (
    <>
      <Head>
        <style>{`
          :root { --page-bg: #C7C7CC; --pg-bg: #C7C7CC; }
          html, body { background: #C7C7CC !important; overflow: hidden !important; height: 100% !important; }
        `}</style>
      </Head>
      <span id="active-pill" style={{ display: "none" }}></span>

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "#1A1B1E" }}>
        {/* Fixed Header area with no background bar, just floating buttons */}
        <div className="toolbar" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000 }}>
          <a href="/" className="toolbar-back" title="Go back to Home">
            Back
          </a>
          <span className="spacer"></span>
          <button type="button" id="btn-normal" className="secondary" title="Original preview data">
            normal
          </button>
          <button type="button" id="btn-dot" className="secondary" title="New input data">
            dot
          </button>
        </div>

        <main className="theme-main" style={{ flex: 1, overflow: "hidden", padding: 0, maxWidth: "none", margin: 0 }}>
          <div className="layout-row" id="theme-layout-row" style={{ height: "100%" }}>
            {/* Left Column: Detail / Animation Test (Black Background) */}
            <div className="detail-col" id="detail-col">
              <div style={{ position: "absolute", top: "24px", left: "32px", zIndex: 1100 }}>
                <CameraDotTransition
                  ensureCameraDot={async () => {
                    if (typeof document === "undefined") return;
                    // Ensure Dot dataset + Cards mode so the camera card exists in preview grid.
                    const btnDot = document.getElementById("btn-dot");
                    if (btnDot) btnDot.click();
                    const btnCards = document.querySelector('.preview-mode-btn[data-mode="cards"]');
                    if (btnCards) btnCards.click();
                    await new Promise((r) => setTimeout(r, 80));
                    const cam = document.querySelector("#preview-grid .dot-cam");
                    if (cam && cam.scrollIntoView) {
                      cam.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
                    }
                    await new Promise((r) => setTimeout(r, 50));
                  }}
                  targetSelector="#preview-grid .dot-cam"
                />
              </div>
              <div className="detail-view" id="detail-view">
                <div className="detail-stage-container">
                  <div className="detail-stage" id="detail-stage">
                    <div style={{ color: "var(--text-3)", fontSize: "14px" }}>Select a card to test animation</div>
                  </div>
                </div>
                <div className="detail-controls" id="detail-controls" style={{ display: "none" }}></div>
              </div>
            </div>

            {/* Right Column: Full Preview Grid (Mint Background) */}
            <div className="preview-col" id="preview-col" style={{ paddingTop: "80px" }}>
              <div className="preview-theme-scope" id="preview-theme-scope">
                <div className="preview-grid" id="preview-grid"></div>
                
                <div className="preview-screen-wrap" id="preview-screen-wrap" style={{ display: "none" }}>
                  <div className="preview-screen-grid" id="preview-screen-grid"></div>
                  <div className="preview-screen-hint">
                    6 scenarios · S26 aspect (19.5:9) · each phone mixes 1-col and 2-col groups so the same card type renders in both contexts. Uses your <code>--screen-padding-*</code>, <code>--gap-screen</code>, <code>--gap-cards</code>, <code>--screen-grid-columns</code> tokens.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <div className="toast" id="toast">
        Saved · theme applied
      </div>

      <Script src="/typography-rules.js" strategy="beforeInteractive" />
      <Script src="/app/atomics.js" strategy="beforeInteractive" />
      <Script src="/app/surface-layout.js?v=runpanel-dot-level-1" strategy="beforeInteractive" />
      <Script src="/datasets/normalPreviewCards.js" strategy="beforeInteractive" />
      <Script src="/datasets/dotPreviewCards.js?v=runpanel-frames-4" strategy="beforeInteractive" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" strategy="beforeInteractive" />
      <Script src="/app/dot-pair-rain.js?v=1" strategy="beforeInteractive" />
      <Script src="/theme-logic.js?v=3" strategy="lazyOnload" />
    </>
  );
}
