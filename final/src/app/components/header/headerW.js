"use client";
import Image from "next/image";

export default function HeaderW({ isOpen }) {

  return (
    <button
      onClick={() => {
        const coverSection = document.getElementById("cover");
        if (coverSection) {
          coverSection.scrollIntoView({ behavior: "smooth" });
        }
      }}
      className={`z-[700] fixed logo-container transition-opacity duration-[1000ms] ease-in-out top-6 left-6 w-[40px] h-[30px] 4xl:w-24 4xl:h-8 lg:left-10 lg:top-4 md:hidden block `}
    >
      <Image
        src="/img/cidc_logo_White.svg"
        alt="CIDC Logo"
        width={80}
        height={60}
        priority
        style={{ objectFit: "contain" }}
        className={`${isOpen ? "opacity-100" : "opacity-0"} transition-opacity duration-500 ease-in-out absolute top-0 left-0`}
      />
    </button>
  );
}
