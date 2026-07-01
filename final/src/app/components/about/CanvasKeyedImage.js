"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * CanvasKeyedImage
 * - Draws an image onto a canvas and makes "near-white" pixels transparent.
 * - Intended for images that were exported with a white background but should look transparent.
 */
export default function CanvasKeyedImage({
  src,
  alt = "",
  className = "",
  /**
   * Extra className applied to the rendered media (canvas + fallback img).
   * Useful for slight scaling/position tweaks in specific placements.
   */
  mediaClassName = "",
  /**
   * Pixels with all channels >= `keyMin` are candidates for removal.
   * Typical range: 220~245
   */
  keyMin = 235,
  /**
   * How much color variation is allowed while still considering it "background".
   * Typical range: 20~45
   */
  chromaTolerance = 30,
  /**
   * Controls the softness of the fade-out near pure white.
   * 1.0 = linear, >1.0 = sharper removal
   */
  gamma = 1.25,
  /**
   * If true, trims transparent margins after keying so content fits tighter.
   */
  trim = true,
  /**
   * Extra pixels to keep around the trimmed content.
   */
  trimPadding = 2,
  /**
   * Alpha threshold for considering a pixel as "content" when trimming.
   */
  trimAlphaThreshold = 10,
  /**
   * Vertical crop start ratio (0~1). 0 = top of image.
   */
  cropYStart = 0,
  /**
   * Vertical crop end ratio (0~1). 1 = bottom of image.
   */
  cropYEnd = 1,
}) {
  const canvasRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  const img = useMemo(() => {
    if (typeof window === "undefined") return null;
    const i = new Image();
    // Same-origin in this app, but keep for safety if deployed behind CDN.
    i.crossOrigin = "anonymous";
    return i;
  }, []);

  useEffect(() => {
    if (!img || !src) return;

    let cancelled = false;
    setIsReady(false);

    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const fw = img.naturalWidth || img.width;
      const fh = img.naturalHeight || img.height;
      if (!fw || !fh) return;

      // Apply vertical crop
      const startY = Math.round(fh * Math.max(0, cropYStart));
      const endY = Math.round(fh * Math.min(1, cropYEnd));
      const w = fw;
      const h = endY - startY;
      if (h <= 0) return;

      canvas.width = w;
      canvas.height = h;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, startY, w, h, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      const clamp01 = (n) => Math.max(0, Math.min(1, n));

      for (let p = 0; p < data.length; p += 4) {
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const a = data[p + 3];
        if (a === 0) continue;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);

        // Candidate "background" if it's very bright and low-chroma (near gray/white).
        if (min >= keyMin && max - min <= chromaTolerance) {
          // Fade to transparent as it approaches pure white.
          const t = clamp01((min - keyMin) / (255 - keyMin || 1));
          const fade = Math.pow(1 - t, gamma); // 1 at threshold, 0 at pure white
          data[p + 3] = Math.round(a * fade);
        }
      }

      // Optionally trim transparent margins so the visible content (logos) fits the layout tightly.
      if (trim) {
        let minX = w,
          minY = h,
          maxX = -1,
          maxY = -1;

        for (let y = 0; y < h; y++) {
          const row = y * w * 4;
          for (let x = 0; x < w; x++) {
            const a = data[row + x * 4 + 3];
            if (a > trimAlphaThreshold) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX >= 0 && maxY >= 0) {
          minX = Math.max(0, minX - trimPadding);
          minY = Math.max(0, minY - trimPadding);
          maxX = Math.min(w - 1, maxX + trimPadding);
          maxY = Math.min(h - 1, maxY + trimPadding);

          const tw = maxX - minX + 1;
          const th = maxY - minY + 1;

          const trimmed = new ImageData(tw, th);
          const tdata = trimmed.data;

          for (let y = 0; y < th; y++) {
            const srcRow = (minY + y) * w * 4;
            const dstRow = y * tw * 4;
            for (let x = 0; x < tw; x++) {
              const si = srcRow + (minX + x) * 4;
              const di = dstRow + x * 4;
              tdata[di] = data[si];
              tdata[di + 1] = data[si + 1];
              tdata[di + 2] = data[si + 2];
              tdata[di + 3] = data[si + 3];
            }
          }

          canvas.width = tw;
          canvas.height = th;
          const ctx2 = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx2) ctx2.putImageData(trimmed, 0, 0);
        } else {
          ctx.putImageData(imageData, 0, 0);
        }
      } else {
        ctx.putImageData(imageData, 0, 0);
      }
      setIsReady(true);
    };

    img.onerror = () => {
      if (cancelled) return;
      setIsReady(false);
    };

    img.src = src;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [img, src, keyMin, chromaTolerance, gamma, cropYStart, cropYEnd]);

  return (
    <div className={className}>
      {/* Canvas output */}
      <canvas
        ref={canvasRef}
        aria-label={alt}
        role={alt ? "img" : undefined}
        className={["block w-full h-auto", mediaClassName].filter(Boolean).join(" ")}
        style={{ opacity: isReady ? 1 : 0, transition: "opacity 220ms ease-in-out" }}
      />

      {/* Fallback while processing */}
      {!isReady ? (
        <img
          src={src}
          alt={alt}
          className={["block w-full h-auto", mediaClassName].filter(Boolean).join(" ")}
          style={{ opacity: 0.9 }}
        />
      ) : null}
    </div>
  );
}

