"use client";
import { useEffect, useState } from "react";
import { useLanguageStore } from "../../store/languageStore";
import { neuehaas, pxGrotesk } from "@/fonts/fonts";
import { sheetsStatic } from "@/app/data/sheetsStatic";

export default function About() {
  const [aboutInfo, setAboutInfo] = useState(sheetsStatic?.about || []);
  const { lang } = useLanguageStore();

  useEffect(() => {
    // keep state synced if the static module ever changes in dev HMR
    setAboutInfo(sheetsStatic?.about || []);
  }, []);

  return (
    <div className={`${pxGrotesk.className} lg:flex gap-[4vw] items-start justify-start w-full min-h-[40dvh] py-[6vh] lg:py-[14vh] leading-[1.1] text-[6vw] md:text-[5vw] lg:text-[3.5vw]`}>
      <div className={`${pxGrotesk.className} text-primaryB flex-1 pl-6 lg:pl-10`}>
        {aboutInfo.length > 0 ? (
          <pre className={`${pxGrotesk.className} ${lang === 'en' ? 'leading-[1.55] text-[3vw] md:text-[2.85vw] lg:text-[1.15vw]' : 'leading-[1.8] text-[3.1vw] lg:text-[1.1vw]'} whitespace-pre-wrap mb-[4vh]`}>{lang === 'en' ? aboutInfo[0][0] : aboutInfo[0][1]}</pre>
        ) : (
          <p className='leading-[1.55] text-[3vw] md:text-[2.85vw] lg:text-[1.15vw]'>Loading...</p>
        )}
      </div>
    </div>
  );
}