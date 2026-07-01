import Image from "next/image";
import { useEffect, useState } from "react";

export default function Cover() {
  const [isVisible, setIsVisible] = useState(false);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // 컴포넌트가 마운트되면 애니메이션 트리거
    setIsVisible(true);
    // `div`의 높이를 계산
    const divHeight = document.getElementById("covertype_l").offsetHeight;
    setHeight(divHeight * 0.17); // div height의 11% 계산
  }, []);

  return (
    <div className="filter invert flex flex-col justify-center items-center h-full w-full px-6 lg:px-10">
      <div className="relative block lg:hidden w-full h-full">
        <Image
          src="/img/home_whole.svg"
          alt="Design Convergence Collective QrST"
          layout="fill"
          objectFit="contain"
        />
      </div>

      {/* 대형 좌우 이미지 2개로 */}
      <div
        id="covertype_l"
        className={`hidden lg:block relative w-full h-[10%] lg:h-[25%] max-h-[30%] transform transition-opacity duration-1000 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{ marginBottom: `${height}px` }} // 계산된 값으로 margin-bottom 설정
      >
        <Image
          src="/img/homeType1.svg"
          alt="Design Convergence"
          layout="fill"
          objectFit="contain"
          objectPosition="bottom left"
        />
      </div>

      <div
        className={`hidden lg:block relative w-full h-[10%] lg:h-[25%] max-h-[30%] transform transition-opacity duration-1000 delay-500 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <Image
          src="/img/homeType2.svg"
          alt="Collective QrST"
          layout="fill"
          objectFit="contain"
          objectPosition="top right"
        />
      </div>
    </div>
  );
}
