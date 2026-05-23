// ============================================================================
//  app/main.js — bootstrap: init defaults after all modules load
//  ---------------------------------------------------------------------------
//  All other modules are pure declarations (functions, data). This file wires
//  up the one-time init calls that must run after DOM is ready AND after all
//  other module globals are defined.
// ============================================================================

// Paint One UI "ai-colour" star (Figma 449:385) into every <span class="ai-star-slot">
// Each slot can override size via data-size and force monochrome via data-mono.
function paintAiStars() {
  if (!window.IconLibrary || typeof window.IconLibrary.aiStar !== 'function') return;
  document.querySelectorAll('.ai-star-slot').forEach(slot => {
    if (slot.dataset.aiStarPainted === '1') return;
    const size = parseInt(slot.dataset.size || '16', 10);
    const monochrome = slot.dataset.mono === '1';
    slot.innerHTML = window.IconLibrary.aiStar({ size, monochrome });
    slot.dataset.aiStarPainted = '1';
  });
}

function bootMain() {
  // Motion duration slider default
  if (typeof onDurSlider === 'function') onDurSlider(300);
  // Paint AI star icons into all reserved slots
  paintAiStars();

  // Phase 2: prefer the AI Agent server as the default generation mode.
  // On page load we probe /api/agent/health — if the Node server is up
  // and OPENAI_API_KEY is configured, flip the session to 'agent' so
  // the chat Send button routes through the real LLM pipeline instead
  // of the old keyword-matching local mode. If the server isn't
  // reachable (dev without `yarn dev`), stay in 'local' and the
  // existing `promptMap` fallback keeps the UI usable.
  if (typeof AgentAPI !== 'undefined' && AgentAPI && typeof AgentAPI.health === 'function') {
    AgentAPI.health()
      .then(function (data) {
        if (data && (data.ok || data.model)) {
          if (typeof setAgentMode === 'function') setAgentMode('agent');
          console.log('[boot] AI agent detected (%s) — default mode = agent',
            (data.model || 'unknown'));
        }
      })
      .catch(function () {
        // Silent: user can still toggle manually later if they start the server.
        console.log('[boot] AI agent unreachable — staying in local mode');
      });
  }
}
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bootMain); } else { bootMain(); }
