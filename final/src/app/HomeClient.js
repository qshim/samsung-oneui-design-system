"use client";

import { useEffect, useRef, useState } from "react";
// import "./multilingual.css";
import Header from "./components/header/header";
import Nav from "./components/nav/nav";
import Navmobile from "./components/nav/navmobile";

import Cover from "./components/landing/cover";
import LiquidBackground from "./components/landing/liquidBackground";
import AboutIntro from "./components/about/_about";
import Works from "./components/works/works";
import Members from "./components/members";
import Contact from "./components/contact/contact";
import { sheetsStatic } from "./data/sheetsStatic";
import GradualBlurTop from "./components/common/GradualBlurTop";

export default function HomeClient() {
  const mainRef = useRef(null);
  const currentSectionRef = useRef("cover");
  const lastStepTimeRef = useRef(0);
  const aboutLockTimeRef = useRef(0);
  const BASE_BG = "#f0f0ec"; // 기본 라이트(전체)
  const BASE_TEXT = "#0f0f13"; // 기본 블랙(전체)
  const BASE_BG_RGB = { r: 240, g: 240, b: 236 };
  const PEOPLE_PURPLE_RGB = { r: 224, g: 207, b: 239 };
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const peopleTintRgb = {
    r: lerp(BASE_BG_RGB.r, PEOPLE_PURPLE_RGB.r, 0.7),
    g: lerp(BASE_BG_RGB.g, PEOPLE_PURPLE_RGB.g, 0.7),
    b: lerp(BASE_BG_RGB.b, PEOPLE_PURPLE_RGB.b, 0.7),
  };
  const [worksBlend, setWorksBlend] = useState(0); // 0..1 (Works 섹션만)
  const [membersBlend, setMembersBlend] = useState(0); // 0..1 (People 섹션만)
  const [borderRadius, setBorderRadius] = useState(9999); // 초기값: rounded-full
  const [sectionOn, setSectionOn] = useState("cover");
  const [activeAboutId, setActiveAboutId] = useState("who");
  const [isAboutLocked, setIsAboutLocked] = useState(false);
  const [colorPalette] = useState(2);
  const [aboutStyle] = useState(2);
  const [aboutInfo, setAboutInfo] = useState(sheetsStatic?.about || []);
  const [coverBottomFade, setCoverBottomFade] = useState(0); // 0..1
  const [contactReveal, setContactReveal] = useState(0); // 0..1 (used to fade members->contact overlay)
  const [contactTopFade, setContactTopFade] = useState(1); // contact 상단 그라데이션 투명도
  const ABOUT_ORDER = ["who", "sectors", "methodology"];
  const ABOUT_INITIAL_LOCK_MS = 900; // 최소 이 시간 동안은 항상 "Who We Are"를 먼저 보여줌
  const ABOUT_STEP_COOLDOWN_MS = 420;

  // 뷰포트 높이에 가까운 섹션만: 긴 스크롤(Works/Members)에 쓰면 마스크가 문서 전체 높이 기준이라 상단 제목까지 페이드됨
  const SCROLL_CONTENT_EDGE_MASK = {
    WebkitMaskImage:
      "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 3.5%, rgba(0,0,0,0.5) 7%, rgba(0,0,0,1) 11%, rgba(0,0,0,1) 100%)",
    maskImage:
      "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 3.5%, rgba(0,0,0,0.5) 7%, rgba(0,0,0,1) 11%, rgba(0,0,0,1) 100%)",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
  };

  // OS-specific layout vars (mac desktop: fixed 80px gutters like Figma).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const isAppleDesktop = /Mac/i.test(platform) || /Mac OS X/i.test(ua);

    const applyLayoutVars = () => {
      const isMobile = window.matchMedia("(max-width: 639px)").matches;
      const useMacFixedGutter = isAppleDesktop && !isMobile;

      document.documentElement.style.setProperty("--siteGutter", useMacFixedGutter ? "80px" : "1rem");
      // On mac desktop, force fixed 80px gutters by allowing container to expand with viewport.
      document.documentElement.style.setProperty("--siteMax", useMacFixedGutter ? "calc(100vw - 160px)" : "80rem");
      document.documentElement.style.setProperty(
        "--siteMaxWide",
        useMacFixedGutter ? "calc(100vw - 160px)" : "calc(80rem + 60px)"
      );
    };

    applyLayoutVars();
    window.addEventListener("resize", applyLayoutVars);
    return () => window.removeEventListener("resize", applyLayoutVars);
  }, []);

  useEffect(() => {
    setAboutInfo(sheetsStatic?.about || []);
  }, []);

  // Cover: bottom white gradient should appear only after the first scroll.
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    let raf = 0;
    const clamp01 = (n) => Math.max(0, Math.min(1, n));
    const smoothstep01 = (t) => {
      const x = clamp01(t);
      return x * x * (3 - 2 * x);
    };
    const update = () => {
      raf = 0;
      const st = mainEl.scrollTop || 0;
      // Dissolve should:
      // - be invisible at the very top
      // - kick in quickly on first scroll
      // Note: the overlay is positioned inside the cover section, so it naturally disappears
      // once the cover scrolls out of view (no separate fade-out needed).
      const t = smoothstep01(st <= 0 ? 0 : st / 120);
      setCoverBottomFade(t);

      // Contact 섹션: 스크롤이 맨 아래에 가까워지면 상단 흰 그라데이션을 서서히 숨김
      const scrollMax = (mainEl.scrollHeight || 0) - (mainEl.clientHeight || 0);
      if (scrollMax <= 0) {
        setContactTopFade(1);
      } else {
        const bottomRatio = clamp01(st / scrollMax); // 0=맨 위, 1=맨 아래
        // 마지막 10% 구간에서만 서서히 사라지도록 매핑
        const hideT = clamp01((bottomRatio - 0.9) / 0.1);
        setContactTopFade(1 - hideT);
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    onScroll();
    mainEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      mainEl.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const sections = mainEl.querySelectorAll("section");
    const ratioById = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        // Track intersection ratio per section and choose the most visible one.
        entries.forEach((entry) => {
          const id = entry?.target?.id;
          if (!id) return;
          ratioById.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let bestId = currentSectionRef.current;
        let bestRatio = ratioById.get(bestId) ?? 0;
        ratioById.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });

        // Ignore tiny intersections (prevents jitter at boundaries)
        if (!bestId || bestRatio < 0.15) return;
        if (bestId === currentSectionRef.current) return;

        currentSectionRef.current = bestId;
        setSectionOn(bestId);

        if (bestId === "about") {
          setActiveAboutId("who");
          setIsAboutLocked(true);
          aboutLockTimeRef.current = Date.now();
          lastStepTimeRef.current = Date.now();
        } else {
          setIsAboutLocked(false);
        }
      },
      {
        threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.75],
        root: mainEl,
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => {
      observer.disconnect();
      ratioById.clear();
    };
  }, []);

  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const handleWheel = (e) => {
      if (sectionOn !== "about") return;
      if (!isAboutLocked) return;

      const delta = e.deltaY;
      if (delta === 0) return;

      const now = Date.now();
      // About 섹션으로 막 진입했을 때는 섹션이 완전히 자리 잡을 때까지
      // 휠 입력으로 탭이 바뀌지 않도록 더 여유를 둔다.
      if (now - aboutLockTimeRef.current < ABOUT_INITIAL_LOCK_MS) {
        e.preventDefault();
        return;
      }
      if (now - lastStepTimeRef.current < ABOUT_STEP_COOLDOWN_MS) {
        e.preventDefault();
        return;
      }

      const currentIndex = ABOUT_ORDER.indexOf(activeAboutId);
      const lastIndex = ABOUT_ORDER.length - 1;

      if (delta > 0) {
        if (currentIndex < lastIndex) {
          e.preventDefault();
          lastStepTimeRef.current = now;
          setActiveAboutId(ABOUT_ORDER[currentIndex + 1]);
        } else {
          lastStepTimeRef.current = now;
          setIsAboutLocked(false);
        }
        return;
      }

      if (delta < 0) {
        if (currentIndex > 0) {
          e.preventDefault();
          lastStepTimeRef.current = now;
          setActiveAboutId(ABOUT_ORDER[currentIndex - 1]);
        } else {
          lastStepTimeRef.current = now;
          setIsAboutLocked(false);
        }
      }
    };

    mainEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => mainEl.removeEventListener("wheel", handleWheel);
  }, [ABOUT_ORDER, activeAboutId, isAboutLocked, sectionOn]);

  // Smooth background transition when entering/leaving the People section (no hard cut, no flicker).
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const membersSection = mainEl.querySelector("#members");
    if (!membersSection) return;

    const clamp01 = (n) => Math.max(0, Math.min(1, n));

    const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Use intersection ratio to blend colors smoothly.
        // We start blending after a small entry to avoid jitter at the boundary.
        const raw = entry?.intersectionRatio ?? 0;
        // Spread the transition a bit more so it feels more gradual.
        const t = clamp01((raw - 0.03) / 0.55);
        setMembersBlend(t);
      },
      { threshold: thresholds, root: mainEl } // main 스크롤 기준
    );

    observer.observe(membersSection);
    return () => observer.disconnect();
  }, []);

  // Smooth background transition when entering/leaving the Works section (match People behavior).
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const worksSection = mainEl.querySelector("#works");
    if (!worksSection) return;

    const clamp01 = (n) => Math.max(0, Math.min(1, n));
    const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);

    const observer = new IntersectionObserver(
      ([entry]) => {
        const raw = entry?.intersectionRatio ?? 0;
        const t = clamp01((raw - 0.03) / 0.55);
        setWorksBlend(t);
      },
      { threshold: thresholds, root: mainEl } // main 스크롤 기준
    );

    observer.observe(worksSection);
    return () => observer.disconnect();
  }, []);

  // Contact reveal ratio within the main scroll container (used for members->contact dissolve).
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const contactSection = mainEl.querySelector("#contact");
    if (!contactSection) return;

    const clamp01 = (n) => Math.max(0, Math.min(1, n));
    const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);
    const observer = new IntersectionObserver(
      ([entry]) => {
        const raw = entry?.intersectionRatio ?? 0;
        // Make it react early, but reach 1 only when contact is mostly visible.
        const t = clamp01((raw - 0.02) / 0.55);
        setContactReveal(t);
      },
      { threshold: thresholds, root: mainEl }
    );

    observer.observe(contactSection);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const contactSection = document.querySelector("#contact");

    if (!contactSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        window.requestAnimationFrame(() => {
          const ratio = Math.min(entry.intersectionRatio, 0.8);
          const maxRadius = 9999; // rounded-full (최대)
          const mappedRadius = Math.round(maxRadius * (1 - ratio / 0.8));

          setBorderRadius(mappedRadius); // 상태 업데이트
        });
      },
      { threshold: Array.from({ length: 9 }, (_, i) => i * 0.1) }
    );

    observer.observe(contactSection);

    return () => observer.unobserve(contactSection);
  }, []);

  return (
    <div className="w-[100%] absolute scrollbar-hide bg-white z-[-2] overflow-x-hidden">
      <GradualBlurTop />
      <Header sectionOn={sectionOn} />
      <Nav
        sectionOn={sectionOn}
        onNavigate={(nextSection) => {
          const target = nextSection || "cover";
          currentSectionRef.current = target;
          setSectionOn(target);
          if (target === "about") {
            setActiveAboutId("who");
            setIsAboutLocked(true);
            aboutLockTimeRef.current = Date.now();
            lastStepTimeRef.current = Date.now();
          } else {
            setIsAboutLocked(false);
          }
        }}
      />

      <Navmobile sectionOn={sectionOn} />

      <div
        style={{
          transition: "opacity 1.5s ease-in-out",
          opacity: sectionOn === "cover" ? "1" : "0",
          top: 0,
          visibility: sectionOn === "cover" || sectionOn === "about" ? "visible" : "hidden",
        }}
        className="left-0 fixed z-[-5] bg-[url('/img/bgt.png')] bg-repeat bg-contain bg-center w-full h-[118dvh]"
      />
      <div
        style={{
          transition: "opacity 1.5s ease-in-out",
          opacity: sectionOn === "cover" ? 1 : 0,
          top: 0,
          visibility: sectionOn === "cover" ? "visible" : "hidden",
        }}
        className="left-0 fixed z-[-4] w-full h-[118dvh] pointer-events-none"
      >
        <LiquidBackground colorPalette={colorPalette} />
      </div>
      {/* Base background layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[-10]"
        style={{ background: BASE_BG }}
      />
      <main
        ref={mainRef}
        style={{
          background: "transparent",
          color: BASE_TEXT,
          borderColor: BASE_TEXT,
        }}
        className="relative scrollbar-hide z-10 h-[100dvh] w-[100%] overflow-y-scroll snap-y snap-mandatory"
      >
        {/* Members -> Contact dissolve overlay (visible only while in Members) */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-0 right-0 bottom-0 z-[12] h-[7vh] md:h-[9vh]"
          style={{
            opacity: Math.max(0, Math.min(1, membersBlend)) * (1 - contactReveal),
            transition: "opacity 420ms cubic-bezier(0.16, 1, 0.3, 1)",
            maskImage:
              "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 28%, rgba(0,0,0,0.12) 62%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage:
              "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 28%, rgba(0,0,0,0.12) 62%, rgba(0,0,0,0) 100%)",
            background:
              "linear-gradient(to top, rgba(240,240,236,0) 0%, rgba(240,240,236,0.06) 40%, rgba(240,240,236,0.18) 100%)",
          }}
        />
        <section
          id="cover"
          className="relative z-10 w-[100%] h-[100%] snap-start flex items-start justify-start"
        >
          {/* Mask stays off text wrapper — same-node mask can clip descenders (g, j, p, y) in WebKit. */}
          <div className="relative z-10 w-full max-w-[var(--siteMax)] mx-auto pr-[var(--siteGutter)] pl-[calc(var(--siteGutter)*1.25)] md:pl-[calc(var(--siteGutter)*1.1)] lg:pl-[calc(var(--siteGutter)*0.4)]">
            <Cover textColor={BASE_TEXT} />
          </div>
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 w-full h-[12vh] md:h-[16vh] pointer-events-none z-0"
            style={{
              opacity: coverBottomFade,
              transform: `translateY(${(1 - coverBottomFade) * 16}px)`,
              transition:
                "opacity 420ms cubic-bezier(0.16, 1, 0.3, 1), transform 520ms cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 520ms cubic-bezier(0.16, 1, 0.3, 1)",
              backdropFilter: `blur(${4 + coverBottomFade * 10}px) saturate(1.02)`,
              WebkitBackdropFilter: `blur(${4 + coverBottomFade * 10}px) saturate(1.02)`,
              maskImage:
                "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.9) 44%, rgba(0,0,0,0.24) 74%, rgba(0,0,0,0) 100%)",
              WebkitMaskImage:
                "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.9) 44%, rgba(0,0,0,0.24) 74%, rgba(0,0,0,0) 100%)",
              backgroundColor: BASE_BG,
              background:
                "linear-gradient(to top, rgba(240, 240, 236, 1) 0%, rgba(240, 240, 236, 1) 26%, rgba(240, 240, 236, 0.46) 54%, rgba(240, 240, 236, 0.14) 76%, rgba(240, 240, 236, 0) 100%)",
            }}
          />
        </section>
        <section
          id="about"
          data-section="about"
          className="relative z-10 w-[100%] h-[100dvh] snap-start overflow-hidden pb-[26vh] lg:pb-[30vh] flex justify-center items-start"
        >
          <div
            className="hidden lg:block absolute left-0 top-0 bottom-0 right-0 z-0"
            style={{
              background: "linear-gradient(180deg, #F0F0ED 54.58%, #E0E0FF 100%)",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 w-full h-[10vh] pointer-events-none z-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(240, 240, 237, 0.12) 0%, rgba(226, 226, 255, 0.4) 55%, rgba(226, 226, 255, 0.75) 100%)",
            }}
          />
          <div
            className="relative z-10 w-full max-w-[var(--siteMax)] px-[var(--siteGutter)] mx-auto h-full flex flex-col justify-start"
            style={SCROLL_CONTENT_EDGE_MASK}
          >
            <div className="w-full pt-[7vh] md:pt-[8vh] lg:pt-[9vh] pb-[34vh] lg:pb-[38vh]">
              <AboutIntro activeId={activeAboutId} onChange={setActiveAboutId} aboutStyle={aboutStyle} />
            </div>
          </div>
        </section>
        <section
          id="works"
          style={{
            backgroundColor: "#E0E0FF",
          }}
          className="transition-all duration-1000 lg:content-center w-full relative z-10 min-h-[100dvh] [@media(max-height:760px)]:min-h-0 snap-start flex justify-center items-start pt-8 pb-4 sm:pt-12 sm:pb-6 lg:pb-8 overflow-visible"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-0 h-[12vh] z-10"
            style={{
              background:
                "linear-gradient(to bottom, rgba(224,224,255,0.82) 0%, rgba(224,224,255,0.55) 45%, rgba(224,224,255,0.12) 80%, rgba(224,224,255,0) 100%)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 bottom-0 h-[10vh] z-10"
            style={{
              background:
                "linear-gradient(to bottom, rgba(224,224,255,0.85) 0%, rgba(224,224,255,0.7) 55%, rgba(224,224,255,0.98) 100%)",
            }}
          />
          <div className="relative z-10 w-full max-w-[var(--siteMaxWide)] px-[var(--siteGutter)] mx-auto">
            {/* Works 섹션: 상단으로 올라갈수록 컨텐츠 자체가 투명해지도록 마스크 적용 */}
            <div style={SCROLL_CONTENT_EDGE_MASK}>
              <Works textColor={BASE_TEXT} sectionOn={sectionOn} />
            </div>
          </div>
        </section>
        <section
          id="members"
          style={{
            backgroundColor: "#F0F0EC",
            color: BASE_TEXT,
          }}
          className="relative z-10 w-[100%] min-h-[100dvh] [@media(max-height:760px)]:min-h-0 snap-start flex justify-center items-start pt-[5.5rem] pb-8 sm:pb-10 lg:pb-12 overflow-visible"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(220,220,255,0.78) 0%, rgba(220,220,255,0.48) 40%, rgba(220,220,255,0.2) 70%, rgba(240,240,236,0) 100%)",
            }}
          />
          <div className="relative z-10 w-full max-w-[var(--siteMaxWide)] px-[var(--siteGutter)] mx-auto">
            <Members />
          </div>
        </section>
        <section
          id="contact"
          className="relative z-10 w-[100%] h-[100dvh] snap-end overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 right-0 h-[4vh] z-20"
            style={{
              background:
                "linear-gradient(to bottom, rgba(240,240,236,0.72) 0%, rgba(240,240,236,0.36) 55%, rgba(240,240,236,0.10) 80%, transparent 100%)",
              opacity: contactTopFade,
            }}
          />
          <div className="relative z-10 h-full">
            <Contact borderRadius={borderRadius} sectionOn={sectionOn} colorPalette={colorPalette} />
          </div>
          <footer className="transition duration-500 text-white absolute bottom-0 left-0 w-full h-auto text-center p-4 md:p-8 font-[400] leading-[1.5] text-[2.6vw] md:text-[1.8vw] lg:text-[0.9vw] xl:text-[0.75vw]">
            {aboutInfo?.[0]?.[3] || "© 2025. All rights reserved."}
          </footer>
        </section>
      </main>
    </div>
  );
}




