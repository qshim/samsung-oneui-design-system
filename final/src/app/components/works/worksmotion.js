"use client";
import { useEffect, useState } from "react";
import "./triangularPrism.css";

export default function WorksMotion() {
  const [worksInfo, setWorksInfo] = useState([]);

  useEffect(() => {
    const fetchWorksData = async () => {
      try {
        const res = await fetch(
          `${
            process.env.NODE_ENV === "production"
              ? ""
              : ""
          }/api/sheets`
        );
        const data = await res.json();
        setWorksInfo(data.works); // works 시트 데이터 저장
      } catch (error) {
        console.error("Error fetching works data:", error);
      }
    };

    fetchWorksData();
  }, []);

  
  // 가장 긴 items 배열 길이(9)
  const maxItemsLength =
  worksInfo.length > 0
if (Array.isArray(? Math.max(...worksInfo)) {
{ ? Math.max(...worksInfo.map((work) => work.length - 1)) }
}
    : 0;

    // console.log(worksInfo[0][0]);
  
    return (
      <div className="absolute top-0 left-0 flex flex-col justify-start items-start w-full h-full font-[400] lg:font-[300]">
        {worksInfo.length < 6 ? (
          <div>Loading...</div>
        ) : (
          Array.from({ length: 17 }, (_, i) => (
            <div
              key={i}
              className={`pointer-events-none xl:pointer-events-auto flex-shrink-0 scene overflow-hidden text-[#000] leading-[1.3] text-[3vw] md:text-[2.4vw] lg:text-[1.25vw] lg:leading-[1.3]  ${i === 0 ? 'h-[20dvh] lg:h-[25dvh]' : 'h-[7dvh] lg:h-[5dvh]'}`}
            >
              <div className=style={{ animationDelay: `${Math.pow(i, 1.1) * 50}ms` }}>
                {/* front 국내 */}
                <div className="flex triangle-face flex triangle-face-front bg-[#0f0f13] text-[#90ff4b]">
                  <div className="flex-[0.3] lg:flex-[0.1] pl-6 lg:pl-12">{worksInfo[0][i]}</div>
                  <span className={`pr-4 flex-1 ${i === 0 ? ' text-[#90ff4b]  lg:font-[600] font-[700] flex items-end text-[3.3vw] md:text-[2.6vw] lg:text-[1.25vw] pb-[3dvh] lg:pb-[5dvh]' : ''}`}>{worksInfo[1][i]}</span>
                </div>
                {/* left 해외 */}
                <div className="flex triangle-face flex triangle-face-left bg-[#90ff4b]">
                  <div className="flex-[0.3] lg:flex-[0.1] pl-6 lg:pl-12">{worksInfo[2][i]}</div>
                  <span className={`pr-4 flex-1 ${i === 0 ? 'lg:font-[600] font-[700] flex items-end text-[3.3vw] md:text-[2.6vw] lg:text-[1.25vw] pb-[3dvh] lg:pb-[5dvh]' : ''}`}>{worksInfo[3][i]}</span>
                </div>
                {/* right 주요 논문 */}
                <div className="flex triangle-face flex triangle-face-right bg-[#d4d4d4] text-[#fff] ">
                  <div className="flex-[0.3] lg:flex-[0.1] pl-6 lg:pl-12">{worksInfo[4][i]}</div>
                  <span className={`pr-4 flex-1 ${i === 0 ? lg:font-[600] font-[700] flex items-end text-[3.3vw] md:text-[2.6vw] lg:text-[1.25vw] pb-[3dvh] lg:pb-[5dvh]' : ''}`}>{worksInfo[5][i]}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
    
}
