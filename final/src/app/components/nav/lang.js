"use client"
import { useLanguageStore } from "@/app/store/languageStore"
import { programme } from "@/fonts/fonts";
export default function LanguageToggle({ sectionOn, textColor }){
    const {lang, toggleLang} = useLanguageStore();
    return(
        <button onClick={toggleLang} style={{color:textColor}} className={`${sectionOn === 'cover' ? 'text-primaryW' : 'text-primaryB'} ${programme.className} lg:font-[300] leading-relaxed text-xl font-normal lg:text-[0.9vw] z-[300] w-fit fixed bottom-0 left-0 pl-6 pb-10 lg:pb-0 lg:top-0 lg:left-auto lg:right-0 lg:pt-2 lg:pr-10`}>
   
        </button>
    );
}
