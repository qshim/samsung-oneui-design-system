"use client";

/** 네비 아래 얇은 상단 스트립.
  *  - 콘텐츠에만 살짝 블러를 주는 얇은 상단 스트립.
  *  - 색을 입히지 않고, 배경색은 그대로 두고 흐림만 적용한다.
 */
export default function GradualBlurTop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 right-0 h-[72px] z-[450]"
      style={{
        // 색 오버레이 없이, 콘텐츠만 살짝 흐려지도록
        background: "transparent",
        backdropFilter: "blur(6px) saturate(118%)",
        WebkitBackdropFilter: "blur(6px) saturate(118%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 42%, rgba(0,0,0,0) 100%)",
        maskImage:
          "linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 42%, rgba(0,0,0,0) 100%)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
      }}
    />
  );
}
