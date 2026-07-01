"use client";

export default function GreyPlaceholder({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={[
        "bg-gradient-to-b from-[#d9d9d9] to-[#bdbdbd]",
        "border border-black/10",
        className,
      ].join(" ")}
    />
  );
}


