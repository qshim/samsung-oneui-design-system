import "./globals.css";
import "./multilingual.css";
// import { Inter } from "next/font/google";
import { pxGrotesk } from "@/fonts/fonts";


export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Center for Creative Intelligence Design",
  description: "Shaping the future through insight, innovation and impact",
  keywords: "CCID, creative, intelligence, karts, design, ai, lab, convergence",
  openGraph: {
    title: "Center for Creative Intelligence Design",
    description: "Shaping the future through insight, innovation and impact",
    images: [
      {
        url: "/img/og800.png",
        width: 800,
        height: 400,
        alt: "CCID",
      },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  minimumScale: 1.0,
  maximumScale: 1.0,
  userScalable: "no",
};

export default function RootLayout({ children }) {
  

  return (
    <html lang="ko" className={pxGrotesk.className}>
      <body className={`overflow-x-hidden w-[100%] scrollbar-hide antialiased select-none`}>
        {children}
      </body>
    </html>
  );
}
