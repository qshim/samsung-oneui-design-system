"use client";

import { useEffect, useState } from "react";
import { ABOUT_SECTIONS } from "./aboutData";
import { pretendardR, pxGrotesk } from "@/fonts/fonts";

export default function AboutIntro({ activeId, onChange, aboutStyle = 2 }) {
  const [displayId, setDisplayId] = useState(activeId);
  const [isFade, setIsFade] = useState(true);

  useEffect(() => {
    setIsFade(false);
    const timer = setTimeout(() => {
      setDisplayId(activeId);
      setIsFade(true);
    }, 250);

    return () => clearTimeout(timer);
  }, [activeId]);

  const titleSection =
    ABOUT_SECTIONS.find((section) => section.id === activeId) ||
    ABOUT_SECTIONS[0];

  const contentSection =
    ABOUT_SECTIONS.find((section) => section.id === displayId) ||
    ABOUT_SECTIONS[0];

  const safeParagraphs = Array.isArray(contentSection.paragraphs)
    ? contentSection.paragraphs
    : [];

  const paragraphs2 = [safeParagraphs[0] || "", safeParagraphs[1] || ""].filter(Boolean);
  const leftParagraph = paragraphs2[0] || "";
  const rightParagraph = paragraphs2[1] || "";
  const showSectorsImage = displayId === "sectors";

  return (
    <div className={`w-full relative z-10 subpixel-antialiased about-text-tuning ${pretendardR.className}`}>
      {/* Keep content aligned left; keep content box sizes like before */}
      <div className="grid grid-cols-1 lg:grid-cols-[296px_1fr] gap-y-8 lg:gap-y-0 lg:gap-x-8 items-start">
        {/* Left nav column */}
        <div className="w-full lg:col-start-1 lg:col-span-1">
          {aboutStyle === 1 ? (
            <h2
              className={`text-left font-[500] leading-tight text-[22px] sm:text-[28px] tracking-[-0.03em] ${pxGrotesk.className}`}
            >
              {titleSection.title}
            </h2>
          ) : (
            <ul className="flex flex-col gap-2">
              {ABOUT_SECTIONS.map((section) => {
                const isActive = section.id === activeId;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => onChange?.(section.id)}
                      className={`text-left leading-tight text-[22px] sm:text-[28px] tracking-[-0.03em] ${pxGrotesk.className} ${isActive ? "font-[400] text-[#0f0f13]" : "font-[400] text-[#9D9C9C]"
                        }`}
                    >
                      {section.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Content area */}
        <div
          className={`w-full lg:col-start-2 lg:col-span-1 transition-opacity duration-300 ease-in-out ${isFade ? "opacity-100" : "opacity-0"
            }`}
        >
          {/* Text boxes: keep the previous 2-column sizing */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {leftParagraph ? (
              <p className="text-[14px] sm:text-[16px] leading-[1.55] sm:leading-[1.45]">
                {leftParagraph}
              </p>
            ) : null}
            {rightParagraph ? (
              <p className="hidden sm:block text-[16px] leading-[1.55] font-[450]">{rightParagraph}</p>
            ) : null}
          </div>

          {showSectorsImage ? (
            <div className="w-full lg:pb-[5vh] mt-14">
              {/* Same 2-col grid as text: left=English, right=Korean */}
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <div className="w-full md:col-span-2 flex justify-center">
                  <>
                    {/* Mobile / mid-resize: use the Figma export image */}
                    <img
                      src="/img/mobile_logo.png"
                      alt="Sectors We Serve"
                      className={[
                        "block lg:hidden",
                        // Prevent clipping within the fixed-height About section.
                        "w-auto h-auto object-contain",
                        "max-w-[92vw] max-h-[32vh] sm:max-h-[36vh] md:max-h-[40vh]",
                        "select-none pointer-events-none",
                      ].join(" ")}
                      draggable={false}
                    />
                    {/* Desktop: keep the existing logo layout image */}
                    <img
                      src="/img/logo.png"
                      alt="Sectors We Serve"
                      className={[
                        "hidden lg:block w-full h-auto",
                        // Fit within the combined (EN+KR) text width.
                        "max-w-[980px] lg:max-w-[1160px]",
                        // Slightly nudge left on desktop widths.
                        "md:-translate-x-6",
                        "select-none pointer-events-none",
                      ].join(" ")}
                      draggable={false}
                    />
                  </>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// const aboutInfo = [
//   {
//     title:"Founded in 2015 at Carnegie Mellon University, QrST is a global design convergence collective",
//     description: "QrST는 카네기멜론대학교 Computational Creativity Lab에 이어 한국예술종합학교에 설립된 디자인 콜렉티브 이니셔티브입니다. 우리는 컴퓨테이셔널 디자인 프로세스와 방법론을 통해 첨단기술과 창의성 사이에서 의미있고 실현가능한 새로운 가능성을 발굴합니다."
//   },
//   {
//     title: "Collaborating with international partners, we push the boundaries of innovation and creativity",
//     description: "QrST는 국제적인 협력 관계를 가지며 스튜디오, 리서치, 랩으로 나뉩니다. 스튜디오 팀은 다양한 뉴미디어 에이전시, 디자인 스튜디오와 협업하며 트랜스미디어 브랜딩, 미디어 아트 등 커머셜 프로젝트를 진행합니다. 리서치 팀은 인공지능 상호작용 기반의 선행적인 컨셉 디자인과 사용자 경험 디자인 및 연구, 특히 정량, 정성 데이터 수집, 분석 및 시각화에 전문성을 가지고 있습니다. 랩 팀은 디자인 이외 공학, 의학 등 연구중심대학 및 연구소와 협력을 통해 다가올 미래의 새로운 가치를 탐색합니다."
//   }
// ];
