"use client";

import { neuehaas } from "@/fonts/fonts";
import { useState, useEffect } from "react";
import { sheetsStatic } from "@/app/data/sheetsStatic";

export default function Cover() {
  const [mainText, setMainText] = useState(null);
  const [typedWords, setTypedWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [startWaveAnim, setStartWaveAnim] = useState(false);
  const [activeLine, setActiveLine] = useState(0); // 0: top line, 1: bottom line

  // Matches `.wave-text` animation duration in globals.css (18s)
  const WAVE_ANIMATION_DURATION = 18000;

  useEffect(() => {
    const flatText = (sheetsStatic?.main || [])
      .map((row) => row?.[0])
      .filter(Boolean);
    setMainText(flatText);
    setTypedWords(flatText.map(() => ""));
  }, []);

  useEffect(() => {
    if (!mainText || currentWordIndex >= mainText.length) {
      setTimeout(() => {
        setStartWaveAnim(true);
      }, 1000);
      return;
    }

    const word = mainText[currentWordIndex];
    let charIndex = 0;

    const typeNextChar = () => {
      setTypedWords((prev) => {
        const newWords = [...prev];
        newWords[currentWordIndex] = word.slice(0, charIndex + 1);
        return newWords;
      });

      charIndex++;

      if (charIndex < word.length) {
        const progress = charIndex / word.length;
        const nextDelay = Math.max(5, 50 * (1 - progress * 0.8));
        setTimeout(typeNextChar, nextDelay);
      } else {
        setTimeout(() => setCurrentWordIndex((prev) => prev + 1), 80);
      }
    };

    typeNextChar();
  }, [currentWordIndex, mainText]);

  useEffect(() => {
    if (!startWaveAnim || !mainText) return;

    setActiveLine(0);
    const id = window.setInterval(() => {
      setActiveLine((prev) => (prev === 0 ? 1 : 0));
    }, WAVE_ANIMATION_DURATION);

    return () => window.clearInterval(id);
  }, [startWaveAnim, mainText]);

  const [startAnim, setStartAnim] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setStartAnim(true);
    }, 800);

    return () => clearTimeout(timeout);
  }, []);

  const scaleStyle = startAnim
    ? {
        scale: 0.97,
        transformOrigin: "left center",
        transition: "scale 18s ease-out",
      }
    : { transformOrigin: "left center" };

  return (
    <div className="relative flex flex-col w-full h-full lg:pt-[38dvh] pt-[29vh] px-0 translate-x-0 md:-translate-x-1 lg:-translate-x-6 gap-[clamp(0.5rem,2vw,1rem)] md:gap-[clamp(0.5rem,1.6vw,0.875rem)] lg:gap-[clamp(0.5rem,1.2vw,0.75rem)]">
      <div className="text-left relative inline-block w-full h-auto min-h-[1.15em] md:min-h-0 text-[7.5vw] md:text-[3vw] lg:text-[3vw] text-[#0f0f13]">
        <pre
          className={`${neuehaas.className} tracking-[1px] md:hidden whitespace-pre-wrap overflow-visible relative leading-[1.15] ${
            currentWordIndex === 0 ? "blinking-cursor" : ""
          }`}
          style={{ ...scaleStyle }}
        >
          {startWaveAnim && mainText && mainText[0] ? (
            <span className={`wave-text ${activeLine === 0 ? "active" : ""}`}>
              {typedWords[0]}
            </span>
          ) : (
            <span className="first-part" style={{ opacity: 1, color: "#0f0f13" }}>
              {typedWords[0]}
            </span>
          )}
        </pre>
        <p
          className={`${neuehaas.className} tracking-[-1px] hidden md:block overflow-visible relative leading-[1.15] whitespace-nowrap ${
            currentWordIndex === 0 ? "blinking-cursor" : ""
          }`}
          style={{ ...scaleStyle }}
        >
          {startWaveAnim && mainText && mainText[0] ? (
            <span className={`wave-text ${activeLine === 0 ? "active" : ""}`}>
              {typedWords[0]}
            </span>
          ) : (
            <span className="first-part" style={{ opacity: 1, color: "#0f0f13" }}>
              {typedWords[0]}
            </span>
          )}
        </p>
      </div>

      <div className="text-left relative inline-block w-full h-auto min-h-[1.15em] md:min-h-0 text-[7.5vw] md:text-[3vw] lg:text-[3vw] text-white">
        <pre
          className={`${neuehaas.className} tracking-[1px] md:hidden whitespace-pre-wrap overflow-visible relative leading-[1.15] ${
            currentWordIndex === 1 ? "blinking-cursor" : ""
          }`}
          style={{ ...scaleStyle }}
        >
          {startWaveAnim && mainText && mainText[1] ? (
            <span className={`wave-text ${activeLine === 1 ? "active" : ""}`}>
              {typedWords[1]}
            </span>
          ) : (
            <span className="first-part" style={{ opacity: 1 }}>
              {typedWords[1]}
            </span>
          )}
        </pre>
        <p
          className={`${neuehaas.className} tracking-[-1px] hidden md:block overflow-visible relative leading-[1.15] whitespace-nowrap ${
            currentWordIndex === 1 ? "blinking-cursor" : ""
          }`}
          style={{ ...scaleStyle }}
        >
          {startWaveAnim && mainText && mainText[1] ? (
            <span className={`wave-text ${activeLine === 1 ? "active" : ""}`}>
              {typedWords[1]}
            </span>
          ) : (
            <span className="first-part" style={{ opacity: 1 }}>
              {typedWords[1]}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
