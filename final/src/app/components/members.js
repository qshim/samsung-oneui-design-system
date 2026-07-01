"use client";

import { useEffect, useState } from "react";
import { pxGrotesk } from "@/fonts/fonts";
import { sheetsStatic } from "@/app/data/sheetsStatic";
import GreyPlaceholder from "@/app/components/common/GreyPlaceholder";

export default function Members() {
  const [membersInfo, setMembersInfo] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const data = sheetsStatic;
    const categorizedMembers = (data?.members || []).reduce((acc, member) => {
      const category = member[0];
      if (!acc[category]) acc[category] = [];
      acc[category].push(member);
      return acc;
    }, {});

    setMembersInfo(categorizedMembers);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-lg md:text-xl">Loading members...</p>
      </div>
    );
  }

  const categories = Object.entries(membersInfo);
  const allMembers = categories.flatMap(([, list]) => (Array.isArray(list) ? list : [])).filter(Boolean);

  const renderMemberCard = (member) => {
    const [, name, image, role, bio] = member;
    const imageSrc = String(image || "").trim();
    const normalizedRole = (role || "").replace(/Design\s+at\s+/i, "Design at\n");
    const normalizedBio = (bio || "")
      .replace(/\bformerly\b\s*/gi, "")
      .trim();

    return (
      <div className="min-w-0 flex items-start gap-6">
        <div className="flex-none">
          <div className="group relative w-[124px] h-[144px] overflow-hidden rounded-[3px]">
            <GreyPlaceholder className="absolute inset-0 w-full h-full" />
            {imageSrc && (
              <img
                src={imageSrc}
                alt={name || "member"}
                className="absolute inset-0 w-full h-full object-cover filter grayscale brightness-[0.95] contrast-[1.05] transition-[filter] duration-200 group-hover:blur-[1.5px]"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            {/* 소셜 아이콘(LinkedIn, Instagram)은 일단 숨김 처리 */}
            {/*
            <div className="pointer-events-none absolute left-3 bottom-3 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span aria-hidden="true">
                <svg width="39" height="40" viewBox="0 0 39 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="37" height="37" rx="9" stroke="#FFFFFF" strokeWidth="2" />
                  <path
                    d="M12.32 28V15.592H14.264V28H12.32ZM12.32 13.24V10.84H14.264V13.24H12.32ZM18.8578 15.592V17.224H18.9058C19.8658 15.944 21.1778 15.304 22.8418 15.304C24.1538 15.304 25.1778 15.648 25.9138 16.336C26.6498 17.024 27.0178 18.008 27.0178 19.288V28H25.0738V19.456C25.0738 18.656 24.8258 18.04 24.3298 17.608C23.8338 17.16 23.1458 16.936 22.2658 16.936C21.2738 16.936 20.4578 17.256 19.8178 17.896C19.1778 18.536 18.8578 19.36 18.8578 20.368V28H16.9138V15.592H18.8578Z"
                    fill="#FFFFFF"
                  />
                </svg>
              </span>
              <span aria-hidden="true">
                <svg width="39" height="39" viewBox="0 0 39 39" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="37" height="37" rx="9" stroke="#FFFFFF" strokeWidth="2" />
                  <circle cx="19" cy="22" r="6" stroke="#FFFFFF" strokeWidth="2" />
                  <circle cx="27.5" cy="11.5" r="2.5" fill="#FFFFFF" />
                </svg>
              </span>
            </div>
            */}
          </div>
        </div>

        <div className="min-w-0 flex-1 flex flex-col items-start text-left">
          <p className={`${pxGrotesk.className} text-[16px] leading-[1.45] font-semibold text-black truncate w-full`}>
            {name || ""}
          </p>
          {normalizedRole && (
            <p
              className={`${pxGrotesk.className} leading-[1.45] font-medium text-black/70 whitespace-pre w-full ${
                normalizedRole.length > 22 ? "text-[14px]" : "text-[16px]"
              }`}
            >
              {normalizedRole}
            </p>
          )}
          {normalizedBio && (
            <div className={`${pxGrotesk.className} text-[12px] leading-[1.45] font-light text-black/70 whitespace-pre w-full mt-[16px]`}>
              {normalizedBio}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full text-black">
      <div className="w-full">
        <div className="h-[3.875rem] border-b border-black flex items-end pb-4">
          <p className={`${pxGrotesk.className} text-[32px] leading-[1.45]`}>Members</p>
        </div>

        {/* Mobile: 3-column grid (photo + name only) */}
        <div className="sm:hidden pt-4">
          <div className="grid grid-cols-3 gap-x-4 gap-y-6">
            {allMembers.map((member, idx) => {
              const [, name, image] = member;
              const imageSrc = String(image || "").trim();
              return (
                <div key={`m-${idx}-${name || "n"}`} className="min-w-0">
                  <div className="w-full overflow-hidden rounded-[3px] bg-[#F6F0FF] aspect-[124/144]">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={name || "member"}
                        className="w-full h-full object-cover filter grayscale brightness-[0.95] contrast-[1.05]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <GreyPlaceholder className="w-full h-full" />
                    )}
                  </div>
                  <div
                    className={`${pxGrotesk.className} pt-2 text-[13px] leading-[1.35] font-medium text-black truncate`}
                  >
                    {name || ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden sm:block pt-[1rem]">
          {categories.map(([category, members], catIdx) => {
            const list = Array.isArray(members) ? members.filter(Boolean) : [];
            if (list.length === 0) return null;
            const isLastCategory = catIdx === categories.length - 1;
            return (
              <div
                key={category}
                className={`${isLastCategory ? "" : "border-b border-black"} pb-[32px]`}
              >
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-[48px] gap-y-[40px] pt-[16px]">
                  {list.map((m, idx) => (
                    <div key={`${category}-${idx}-${m?.[1] || "m"}`} className="min-w-0">
                      {renderMemberCard(m)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
