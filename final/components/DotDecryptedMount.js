import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import React from "react";
import DecryptedText from "./DecryptedText";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("DecryptedText Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <span style={{color: 'red', fontSize: '10px'}}>{this.state.error.message}</span>;
    }
    return this.props.children;
  }
}

function safeText(node) {
  return node ? String(node.textContent || "") : "";
}

function LoopDecryptedText({ loopIntervalMs, componentKeyPrefix, ...props }) {
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (!loopIntervalMs || loopIntervalMs <= 0) return;
    const id = setInterval(() => setRunId((v) => v + 1), loopIntervalMs);
    return () => clearInterval(id);
  }, [loopIntervalMs]);

  // Re-mounting is the simplest way to reliably restart the "view" animation
  // even when the element is already visible.
  return (
    <DecryptedText
      key={(componentKeyPrefix || "loop") + "-" + runId}
      {...props}
    />
  );
}

function safeTextFromHtmlWithBreaks(el) {
  if (!el) return "";
  const html = String(el.innerHTML || "");
  // Preserve <br> line breaks as \n for pre-wrap rendering.
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n");
  // Strip remaining tags.
  return withBreaks.replace(/<[^>]*>/g, "");
}

function getRawText(el, options) {
  const mode = (options && options.extractText) || "text";
  if (mode === "htmlWithBreaks") return safeTextFromHtmlWithBreaks(el).trim();
  return safeText(el).trim();
}

function mountInto(el, options) {
  if (!el) return null;
  if (el.__decryptedRoot) return el.__decryptedRoot;

  const raw = getRawText(el, options);
  if (!raw) return null;

  // Stop CSS mask-based animation from affecting the React-rendered content.
  el.classList.add("dot-decrypted-mounted");
  if (options && typeof options.markLegacyMaskTarget === "function") {
    const target = options.markLegacyMaskTarget(el);
    if (target && target.classList) target.classList.add("dot-decrypted-mounted");
  }

  // Debug: log to console to ensure this is being called
  console.log("Mounting DecryptedText into", el, "with text:", raw);

  const root = createRoot(el);
  el.__decryptedRoot = root;

  const loopIntervalMs =
    options && typeof options.loopIntervalMs === "number"
      ? options.loopIntervalMs
      : 0;

  root.render(
    <ErrorBoundary>
      {loopIntervalMs > 0 ? (
        <LoopDecryptedText
          loopIntervalMs={loopIntervalMs}
          componentKeyPrefix={(options && options.componentKeyPrefix) || "dot"}
          text={raw}
          animateOn={(options && options.animateOn) || "view"}
          clickMode={(options && options.clickMode) || "once"}
          speed={(options && options.speed) || 50}
          maxIterations={(options && options.maxIterations) || 10}
          sequential={(options && options.sequential) || false}
          revealDirection={(options && options.revealDirection) || "start"}
          useOriginalCharsOnly={(options && options.useOriginalCharsOnly) || false}
          className={(options && options.className) || ""}
          encryptedClassName={
            (options && options.encryptedClassName) || "dot-decrypted-encrypted"
          }
          parentClassName={(options && options.parentClassName) || ""}
        />
      ) : (
        <DecryptedText
          text={raw}
          animateOn={(options && options.animateOn) || "view"}
          clickMode={(options && options.clickMode) || "once"}
          speed={(options && options.speed) || 50}
          maxIterations={(options && options.maxIterations) || 10}
          sequential={(options && options.sequential) || false}
          revealDirection={(options && options.revealDirection) || "start"}
          useOriginalCharsOnly={(options && options.useOriginalCharsOnly) || false}
          className={(options && options.className) || ""}
          encryptedClassName={
            (options && options.encryptedClassName) || "dot-decrypted-encrypted"
          }
          parentClassName={(options && options.parentClassName) || ""}
        />
      )}
    </ErrorBoundary>
  );

  return root;
}

export function mountDotStepsDecryptedText(options) {
  if (typeof document === "undefined") return;
  if (typeof window !== "undefined" && window.__dotDecryptedInstalled) return;

  const stepsOptions = (options && options.steps) || options;
  const tempOptions = (options && options.temp) || options;
  const dateOptions = (options && options.date) || options;

  const mountAll = (rootNode) => {
    const scope = rootNode || document;
    // Steps (2×1)
    const stepNodes = scope.querySelectorAll(".dot-steps21__count");
    for (let i = 0; i < stepNodes.length; i++) {
      // Prototype surface renderer swaps `#canvas` via innerHTML frequently and
      // also runs imperative DOM updates (e.g. live counters). Mounting React
      // roots into those nodes can cause DOM ownership conflicts and
      // NotFoundError(removeChild) during reconciliation.
      if (stepNodes[i] && stepNodes[i].closest && stepNodes[i].closest("#canvas")) continue;
      mountInto(stepNodes[i], { ...(stepsOptions || {}), componentKeyPrefix: "steps" });
    }

    // Temperature (1×1): decrypt numbers only, keep ℃ static.
    const tempValueNodes = scope.querySelectorAll(".dot-temp11__value");
    for (let i = 0; i < tempValueNodes.length; i++) {
      if (tempValueNodes[i] && tempValueNodes[i].closest && tempValueNodes[i].closest("#canvas")) continue;
      mountInto(tempValueNodes[i], {
        ...(tempOptions || {}),
        componentKeyPrefix: "temp",
        // Legacy mask animation is on the parent center container.
        markLegacyMaskTarget: (el) => el && el.closest ? el.closest(".dot-temp11__center") : null,
      });
    }

    // Date (1×1): keep <br/> as line breaks.
    const dateNodes = scope.querySelectorAll(".dot-date11__text");
    for (let i = 0; i < dateNodes.length; i++) {
      if (dateNodes[i] && dateNodes[i].closest && dateNodes[i].closest("#canvas")) continue;
      mountInto(dateNodes[i], {
        ...(dateOptions || {}),
        componentKeyPrefix: "date",
        extractText: "htmlWithBreaks",
      });
    }
  };

  mountAll(document);

  // Preview/detail screens re-render HTML frequently; observe and re-mount.
  const observer = new MutationObserver((mutations) => {
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      if (m.type !== "childList") continue;
      for (let j = 0; j < m.addedNodes.length; j++) {
        const n = m.addedNodes[j];
        if (n && n.nodeType === 1) mountAll(n);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Expose for legacy scripts / debugging.
  if (typeof window !== "undefined") {
    window.__dotDecryptedInstalled = true;
    // Backward compatibility for previous name.
    window.__dotStepsDecryptedInstalled = true;
    window.__mountDotStepsDecryptedText = () => mountAll(document);
  }
}

