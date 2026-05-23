import React from 'react';

const imgVector = "https://www.figma.com/api/mcp/asset/33c4e658-3e74-4bb3-819f-2bffcae4e8c6";
const imgMobileData = "https://www.figma.com/api/mcp/asset/65465a74-7583-4db8-9aef-0f1e96561fea";
const imgSubtract = "https://www.figma.com/api/mcp/asset/1aa8d66d-fcd8-4050-9970-6b053165c8ed";
const imgSubtract1 = "https://www.figma.com/api/mcp/asset/c0041c58-7795-41b3-9335-3e440fc4d76c";

export default function TopStatusBar() {
  return (
    <div 
      style={{
        width: '100%',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        boxSizing: 'border-box',
        background: 'transparent',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1000
      }}
    >
      {/* Time */}
      <div style={{
        fontFamily: "'One UI Sans APP VF', Inter, sans-serif",
        fontWeight: '700',
        fontSize: '14.126px',
        color: 'rgba(255, 255, 255, 0.8)',
        letterSpacing: '0.1413px',
        fontFeatureSettings: "'dlig' 1, 'lnum' 1, 'pnum' 1"
      }}>
        12:45
      </div>

      {/* Status Icons */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {/* WiFi */}
        <div style={{ position: 'relative', width: '18px', height: '18px', overflow: 'hidden' }}>
          <img src={imgVector} style={{ position: 'absolute', inset: '11.11% -0.11% 11.11% 0.68%', width: '100%', height: '100%' }} alt="" />
        </div>
        
        {/* Cellular */}
        <div style={{ position: 'relative', width: '18px', height: '18px', overflow: 'hidden' }}>
          <img src={imgMobileData} style={{ position: 'absolute', left: '50%', top: '50%', width: '14px', height: '14px', transform: 'translate(-50%, -50%)' }} alt="" />
        </div>

        {/* Battery */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src={imgSubtract} style={{ width: '24px', height: '16.515px' }} alt="" />
          <img src={imgSubtract1} style={{ width: '9px', height: '16.515px' }} alt="" />
        </div>
      </div>
    </div>
  );
}
