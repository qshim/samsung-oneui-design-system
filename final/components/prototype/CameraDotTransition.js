import { useCallback, useEffect, useRef, useState } from "react";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForElement(selector, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 1500);
  while (Date.now() < deadline) {
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(50);
  }
  return null;
}

export default function CameraDotTransition({
  ensureCameraDot,
  targetSelector,
  auto = true,
  timeoutMs = 1600,
  highlightMs = 900,
}) {
  const [status, setStatus] = useState("idle"); // idle | working | ready
  const cleanupRef = useRef(null);

  const clearHighlight = useCallback(() => {
    if (cleanupRef.current) cleanupRef.current();
    cleanupRef.current = null;
  }, []);

  const run = useCallback(async () => {
    if (typeof document === "undefined") return;
    clearHighlight();
    setStatus("working");

    try {
      if (typeof ensureCameraDot === "function") await ensureCameraDot();
      const selector = targetSelector || "#preview-grid .dot-cam";
      const el = await waitForElement(selector, timeoutMs);

      if (!el) {
        setStatus("idle");
        return;
      }

      // Gentle visual hint without relying on global CSS.
      const prevOutline = el.style.outline;
      const prevOutlineOffset = el.style.outlineOffset;
      const prevBoxShadow = el.style.boxShadow;

      el.style.outline = "2px solid rgba(100, 233, 227, 0.95)";
      el.style.outlineOffset = "3px";
      el.style.boxShadow = "0 0 0 6px rgba(100,233,227,0.18)";

      cleanupRef.current = () => {
        el.style.outline = prevOutline;
        el.style.outlineOffset = prevOutlineOffset;
        el.style.boxShadow = prevBoxShadow;
      };

      setStatus("ready");
      window.setTimeout(() => {
        clearHighlight();
        setStatus("idle");
      }, highlightMs);
    } catch (_) {
      setStatus("idle");
    }
  }, [clearHighlight, ensureCameraDot, highlightMs, targetSelector, timeoutMs]);

  useEffect(() => {
    if (!auto) return;
    // Run after first paint so preview grid exists.
    const id = window.setTimeout(() => run(), 50);
    return () => window.clearTimeout(id);
  }, [auto, run]);

  useEffect(() => clearHighlight, [clearHighlight]);

  return null;
}

