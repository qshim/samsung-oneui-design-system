 "use client";
 
 import { useEffect, useRef } from "react";
 import { createLiquidGradient } from "./liquidGradient";
 
 export default function LiquidBackground({ colorPalette = 1 }) {
   const containerRef = useRef(null);
   const appInstanceRef = useRef(null);
 
   useEffect(() => {
     if (!containerRef.current || appInstanceRef.current) return;
 
     const app = createLiquidGradient(containerRef.current, colorPalette);
     appInstanceRef.current = app;
 
     return () => {
       if (appInstanceRef.current && appInstanceRef.current.dispose) {
         appInstanceRef.current.dispose();
         appInstanceRef.current = null;
       }
     };
   }, []);
 
   useEffect(() => {
     if (appInstanceRef.current && appInstanceRef.current.updatePalette) {
       appInstanceRef.current.updatePalette(colorPalette);
     }
   }, [colorPalette]);
 
   return <div ref={containerRef} className="w-full h-full" />;
 }
