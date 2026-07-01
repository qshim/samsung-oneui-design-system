"use client";
import Image from "next/image";

export default function Header({sectionOn}) {

  return (
    <button
      onClick={() => {
        const coverSection = document.getElementById("cover");
        if (coverSection) {
          coverSection.scrollIntoView({ behavior: "smooth" });
        }
      }}
      className={`z-[700] fixed logo-container top-6 left-6 w-[40px] h-[30px] 4xl:w-24 4xl:h-8 lg:left-10 hidden lg:top-4 m:hidden block`}
    >
      <Image
        src="/img/cidc_logo_White.svg"
        alt="CIDC Logo"
        width={80}
        height={60}
        priority
        style={{ objectFit: "contain" }}
        className={`filter ${sectionOn === 'cover' ? '' : 'invert'} transition-all duration-300 absolute top-0 left-0 hidden`}
      />
    </button>
  );
}
