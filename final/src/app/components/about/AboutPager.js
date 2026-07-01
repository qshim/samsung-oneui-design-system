"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguageStore } from "@/app/store/languageStore";
import { neuehaas, pxGrotesk } from "@/fonts/fonts";
import { sheetsStatic } from "@/app/data/sheetsStatic";
import { motion, AnimatePresence } from "framer-motion";

export default function AboutPager({ scrollRootRef, sectionOn }) {
  const { lang } = useLanguageStore();
  const items = useMemo(() => {
    const rows = Array.isArray(sheetsStatic?.desc) ? sheetsStatic.desc : [];
    return rows.map((r) => ({
      title: lang === "kr" ? r?.[2] : r?.[0],
      body: lang === "kr" ? r?.[3] : r?.[1],
    }));
  }, [lang]);

  const [activeIdx, setActiveIdx] = useState(0);
  const wheelLockRef = useRef(false);
  const aboutElRef = useRef(null);
  const exitIntentRef = useRef({ dir: 0, ts: 0 });

  useEffect(() => {
    // Reset to first topic when re-entering the about section from elsewhere
    if (sectionOn === "about") setActiveIdx(0);
  }, [sectionOn]);

  const goToSectionId = useCallback(
    (id) => {
      const root = scrollRootRef?.current;
      const el = root ? root.querySelector(id) : document.querySelector(id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [scrollRootRef]
  );

  const step = useCallback(
    (dir) => {
      setActiveIdx((cur) => {
        const next = Math.max(0, Math.min(items.length - 1, cur + dir));
        return next;
      });
    },
    [items.length]
  );

  // Returns true if the wheel event was consumed (preventDefault applied).
  const handleWheel = useCallback(
    (e) => {
      if (sectionOn !== "about") return;
      if (!items || items.length === 0) return;

      // Normalize jittery wheel streams; only act on meaningful deltas.
      const dy = e.deltaY;
      if (Math.abs(dy) < 6) return;

      const dir = dy > 0 ? 1 : -1;
      const atFirst = activeIdx === 0;
      const atLast = activeIdx === items.length - 1;

      // "Sticky about": do NOT leave About until user expresses exit intent
      // by scrolling again at the boundary within a short window.
      if ((dir < 0 && atFirst) || (dir > 0 && atLast)) {
        const now = Date.now();
        const last = exitIntentRef.current;
        const isSecondAttempt = last.dir === dir && now - last.ts < 900;
        exitIntentRef.current = { dir, ts: now };

        if (!isSecondAttempt) {
          // First attempt at boundary: consume and keep the user in About.
          e.preventDefault();
          e.stopPropagation();
          return true;
        }

        // Second attempt: allow main scroll to move to previous/next section.
        // Clear lock so the container can snap naturally.
        wheelLockRef.current = false;
        return false;
      }

      // Normal paging between topics: always consume wheel and update active index.
      e.preventDefault();
      e.stopPropagation();

      if (wheelLockRef.current) return true;
      wheelLockRef.current = true;

      // Clear exit intent once we're paging inside About.
      exitIntentRef.current = { dir: 0, ts: 0 };
      step(dir);

      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 650);

      return true;
    },
    [activeIdx, items, sectionOn, step]
  );

  // Capture wheel on the actual scroll container so "scroll" always pages topics (no click needed).
  useEffect(() => {
    const root = scrollRootRef?.current;
    const aboutEl = aboutElRef.current;
    if (!root || !aboutEl) return;

    const onWheel = (e) => {
      if (sectionOn !== "about") return;
      // While About is active, treat ANY wheel on the main scroll root as About paging
      // (prevents accidental snap to Works before topics finish).
      const consumed = handleWheel(e);
      // If not consumed, we intentionally allow main scroll to proceed to next/prev section.
      if (consumed) return;
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [handleWheel, scrollRootRef, sectionOn]);

  const active = items[activeIdx] || { title: "", body: "" };

  return (
    <div
      ref={aboutElRef}
      onWheel={handleWheel}
      className="w-full h-[100dvh] overflow-hidden px-6 lg:px-[5.5vw] pt-20 lg:pt-24 pb-14"
      style={{ overscrollBehavior: "contain" }}
    >
      <div className="h-full grid grid-cols-12 gap-8 lg:gap-10">
        {/* Left column: title + topics */}
        <div className="col-span-12 lg:col-span-5 flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            <motion.h2
              key={`about-title-${activeIdx}-${active.title}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={`${neuehaas.className} text-primaryB tracking-[-0.03em] leading-[0.95] text-[10vw] md:text-[6.8vw] lg:text-[3.2vw]`}
            >
              {active.title}
            </motion.h2>
          </AnimatePresence>

          <div className="flex-1" />

          <div className="border-t border-primaryB/60 pt-3">
            <ul className={`${pxGrotesk.className} text-primaryB text-[3.2vw] md:text-[2.1vw] lg:text-[0.95vw]`}>
              {items.map((it, i) => (
                <li key={`${it.title}-${i}`} className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className="w-full text-left py-2"
                  >
                    <span
                      className={`block px-2 py-1 transition-colors ${
                        i === activeIdx
                          ? "bg-[rgba(193,184,251,0.55)]"
                          : "bg-transparent hover:bg-[rgba(193,184,251,0.22)]"
                      }`}
                    >
                      {it.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right column: content */}
        <div className="col-span-12 lg:col-span-7 min-h-0">
          <div className="h-full border-l border-primaryB/30 pl-0 lg:pl-8">
            <AnimatePresence mode="wait">
              <motion.pre
                key={`about-body-${activeIdx}`}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={`${pxGrotesk.className} whitespace-pre-wrap text-primaryB opacity-90 leading-[1.6] text-[3.2vw] md:text-[2.1vw] lg:text-[0.95vw]`}
              >
                {active.body}
              </motion.pre>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}


