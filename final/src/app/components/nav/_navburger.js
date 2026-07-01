"use client";

// import Image from "next/image";
import { useState } from "react";
import Header from "../header/header";

export default function Nav({ textColor }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleMenu = () => {
    setIsOpen((prev) => !prev); // 메뉴 토글 열기닫기
  };
  const closeMenu = () => {
    setIsOpen(false); // 메뉴 닫기
  };

  return (
    <div className="z-[500]">

      <button
        className={`hidden sm:flex fixed z-[600] top-6 right-10 w-5 h-5 4xl:w-8 4xl:h-8 flex-col justify-between transition-all duration-300 transform ${isOpen ? "h-[1rem] right-9 4xl:w-10" : ""}`}
        onClick={toggleMenu}
      >
        <div
          className={`w-full border-t-2 4xl:border-t-[3px] transition-all duration-300 transform origin-top-left ${
            isOpen ? "rotate-45" : ""
          } ${textColor === 'text-gray-700' ? 'border-gray-700' : 'border-white'}`}
        ></div>
        <div
          className={`w-full border-t-2 4xl:border-t-[3px] transition-all duration-300 transform ${
            isOpen ? "opacity-0" : ""
          } ${textColor === 'text-gray-700' ? 'border-gray-700' : 'border-white'}`}
        ></div>
        <div
          className={`w-full border-t-2 4xl:border-t-[3px] transition-all duration-300 transform origin-bottom-left ${
            isOpen ? "-rotate-45" : ""
          } ${textColor === 'text-gray-700' ? 'border-gray-700' : 'border-white'}`}
        ></div>
      </button>

      <ul
        className={`z-[500] text-xl xl:text-2xl 4xl:text-[2rem] 4xl:gap-8 hidden font-normal sm:flex justify-center gap-4 fixed top-0 pt-4 mx-auto w-[100%] transition-all duration-300 transform ${textColor} ${
          isOpen
            ? "opacity-100 bg-[rgba(15,15,19,0.5)] backdrop-blur w-full h-full"
            : "top-[-4rem] opacity-0"
        }`}
      >
        <li className="mx-3">
          <a
            href="#cover"
            className="transition-all duration-300 hover:filter lg:hover:blur-md scroll-smooth"
            onClick={(e) => {
              e.preventDefault();
              document
                .querySelector("#cover")
                ?.scrollIntoView({ behavior: "smooth" });
                closeMenu(); // 메뉴 닫기
            }}
          >
            Intro
          </a>
        </li>
        <li className="mx-3">
          <a
            href="#about"
            className="transition-all duration-300 hover:filter lg:hover:blur-md scroll-smooth"
            onClick={(e) => {
              e.preventDefault();
              document
                .querySelector("#about")
                .scrollIntoView({ behavior: "smooth" });
                closeMenu(); // 메뉴 닫기
            }}
          >
            About
          </a>
        </li>
        <li className="mx-3">
          <a
            href="#works"
            className="transition-all duration-300 hover:filter lg:hover:blur-md scroll-smooth"
            onClick={(e) => {
              e.preventDefault();
              document
                .querySelector("#works")
                .scrollIntoView({ behavior: "smooth" });
                closeMenu(); // 메뉴 닫기
            }}
          >
            Works
          </a>
        </li>
        <li className="mx-3">
          <a
            href="#members"
            className="transition-all duration-300 hover:filter lg:hover:blur-md scroll-smooth"
            onClick={(e) => {
              e.preventDefault();
              document
                .querySelector("#members")
                .scrollIntoView({ behavior: "smooth" });
                closeMenu(); // 메뉴 닫기
            }}
          >
            People
          </a>
        </li>
        <li className="mx-3">
          <a
            href="#contact"
            className="transition-all duration-300 hover:filter lg:hover:blur-md scroll-smooth"
            onClick={(e) => {
              e.preventDefault();
              document
                .querySelector("#contact")
                .scrollIntoView({ behavior: "smooth" });
                closeMenu(); // 메뉴 닫기
            }}
          >
            Contact
          </a>
        </li>
        {/* <li>
          <Link
            href="https://www.instagram.com/q.shim/"
            className="transition-all duration-300 hover:filter lg:hover:blur-md"
          >
            News
          </Link>
        </li> */}
      </ul>

      <Header />
    </div>
  );
}
