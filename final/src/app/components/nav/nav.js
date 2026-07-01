"use client";
import LanguageToggle from "./lang";
import { programme } from "@/fonts/fonts";
import { useState, useRef, useEffect } from "react";

export default function Nav({ sectionOn, onNavigate }) {
  const [boxPosition, setBoxPosition] = useState(0);
  const [boxWidth, setBoxWidth] = useState(0);
  const [boxTop, setBoxTop] = useState(0);
  const [boxHeight, setBoxHeight] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const linkRefs = useRef([]);
  const sections = ["cover", "about", "works", "members", "contact"];

  const calculatePositionAndWidth = (index) => {
    const linkElement = linkRefs.current[index];
    if (linkElement) {
      const linkWidth = linkElement.offsetWidth;
      const linkOffsetLeft = linkElement.offsetLeft;
      const linkHeight = linkElement.offsetHeight;
      const linkOffsetTop = linkElement.offsetTop;
      const remToPx = parseFloat(
        getComputedStyle(document.documentElement).fontSize
      );
      const additionalWidth = 2 * remToPx;
      const additionalHeight = 0.8 * remToPx;

      return {
        position: linkOffsetLeft - 1 * remToPx, // Adjust position by subtracting 0.75rem
        width: linkWidth + additionalWidth,
        top: linkOffsetTop - 0.4 * remToPx,
        height: linkHeight + additionalHeight,
      };
    }
    return { position: 0, width: 0, top: 0, height: 0 }; // Default fallback
  };

  // Set initial position and width based on sectionOn
  useEffect(() => {
    const index = sections.indexOf(sectionOn); // Find the index of the section
    if (index === -1) return;
    const rafId = requestAnimationFrame(() => {
      const { position, width, top, height } = calculatePositionAndWidth(index);
      setBoxPosition(position);
      setBoxWidth(width);
      setBoxTop(top);
      setBoxHeight(height);
    });
    return () => cancelAnimationFrame(rafId);
  }, [sectionOn, sections]);

  // Re-measure on resize (font/layout changes)
  useEffect(() => {
    const onResize = () => resetToSection();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sectionOn]);

  const handleHover = (e, index) => {
    setIsHovered(true);
    const { position, width, top, height } = calculatePositionAndWidth(index);
    setBoxPosition(position);
    setBoxWidth(width);
    setBoxTop(top);
    setBoxHeight(height);
  };

  const handleClick = (index, id) => {
    const { position, width, top, height } = calculatePositionAndWidth(index);
    setIsHovered(true);
    setBoxPosition(position);
    setBoxWidth(width);
    setBoxTop(top);
    setBoxHeight(height);
    if (typeof onNavigate === "function") {
      const cleanId = String(id || "").replace("#", "");
      onNavigate(cleanId);
    }
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const resetToSection = () => {
    const index = sections.indexOf(sectionOn);
    if (index !== -1) {
      const { position, width, top, height } = calculatePositionAndWidth(index);
      setBoxPosition(position);
      setBoxWidth(width);
      setBoxTop(top);
      setBoxHeight(height);
    }
  };

  const showBox = isHovered || sections.includes(sectionOn);
  const isCover = sectionOn === "cover" || sectionOn === "contact";

  return (
    <div
      className={`${programme.className} text-white hidden lg:block z-[500]`}
    >
      <ul className=" z-[500] font-[300] leading-tight lg:text-[1.2vw] fixed top-0 pt-4 mx-auto w-[100%] transition-all duration-300 transform">
        <LanguageToggle sectionOn={sectionOn} />

        <div className="group relative z-[500] gap-12 4xl:gap-20 lg:flex justify-center w-fit mx-auto">
          <span
            className={`select-none pointer-events-none box-border z-[-1] transition-all duration-300 ease-out absolute px-2 border-[.12vw] ${
              showBox ? "opacity-100" : "opacity-0"
            } ${isCover ? "border-primaryW/80" : "border-primaryB/60"}`}
            style={{
              height: `${boxHeight}px`,
              width: `${boxWidth}px`,
              left: `${boxPosition + boxWidth / 2}px`,
              top: `${boxTop + boxHeight / 2}px`,
              transform: "translate(-50%, -50%)",
            }}
          ></span>
          {[
            { id: "#cover", label: "intro" },
            { id: "#about", label: "about" },
            { id: "#works", label: "works" },
            { id: "#members", label: "people" },
            { id: "#contact", label: "contact" },
          ].map(({ id, label }, index) => (
            <li
              key={id}
              onMouseEnter={(e) => handleHover(e, index)}
              onMouseLeave={() => {
                setIsHovered(false);
                resetToSection();
              }}
            >
              <a
                href={id}
                ref={(el) => (linkRefs.current[index] = el)}
                className={`transition-all mx-3 duration-300 ${
                  isCover
                    ? "text-primaryW/85 hover:text-primaryW opacity-90 hover:opacity-100"
                    : "text-primaryB opacity-70 hover:opacity-100"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  handleClick(index, id);
                }}
              >
                {label}
              </a>
            </li>
          ))}
        </div>
      </ul>
    </div>
  );
}
