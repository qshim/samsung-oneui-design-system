// ============================================================================
//  app/atomics.js — Galaxy component vocabulary (Figma ground truth)
//  ---------------------------------------------------------------------------
//  SOURCE OF TRUTH: assets/figma/lock-screen/manifest.json
//    Frame: Figma node 3010:2143 "Lock Screen", 451×978, radius 40
//    All measurements copied verbatim from the Figma design context.
//    All image assets live in assets/figma/lock-screen/ (SVG + PNG), downloaded
//    locally so the URLs never expire.
//
//  Each atomic returns HTML that fills its 100%/100% positioned container.
//  Positions are decided by the caller (renderer + spatial rules). Atomics
//  only care about WHAT is inside the box.
// ============================================================================

(function (root) {
  'use strict';

  var ASSET = 'assets/figma/lock-screen/';

  // Shared shards ------------------------------------------------------------
  var FILL = 'width:100%;height:100%;';
  var FONT_BOLD    = "'One UI Sans APP VF', Inter, system-ui, sans-serif";
  var FONT_SEMI    = "'One UI Sans APP VF', Inter, system-ui, sans-serif";
  var FONT_REGULAR = "'One UI Sans APP VF', Inter, system-ui, sans-serif";
  // FONT_CLOCK — Space Grotesk (display-geometric sans) paired with Inter
  // as structural fallback. Matches the Inter + Space Grotesk pair the
  // project standardizes on for Lock-screen clock display. Loaded via
  // genui.html Google Fonts link.
  var FONT_CLOCK   = "'Space Grotesk', Inter, system-ui, sans-serif";

  // Renders an absolutely-positioned DIV at the given inset, with an <img>
  // filling it 100%. Mirrors Figma's structure:
  //   <div inset=X%><img size-full /></div>
  // Using a direct <img inset=X%> doesn't work reliably because SVGs with
  // width="100%" have no intrinsic size, and browsers fail to compute the
  // img's box from inset alone — the icon escapes its slot.
  function absImg(src, inset, extra) {
    return '<div style="position:absolute;inset:' + inset + ';' + (extra || '') + '">' +
             '<img src="' + ASSET + src + '" style="width:100%;height:100%;display:block;" alt="" />' +
           '</div>';
  }

  // Builds a Figma-style icon wrapper: relative-positioned sized box with
  // an absolutely-positioned image inside using the declared vectorInset.
  function iconBox(size, src, vectorInset) {
    return '<div style="position:relative;width:' + size + 'px;height:' + size + 'px;flex-shrink:0;">' +
             absImg(src, vectorInset) +
           '</div>';
  }

  // ==========================================================================
  //  STATUS BAR — Figma node I989:22979;744:4992
  //  ---------------------------------------------------------------------------
  //  position: x=0 y=0 w=451 h=51  padding: 24x 16y
  //  Left "K-Arts" bold 15/12 · health + account + google (19px each) · flex-spacer
  //    · wifi + cellular + battery (18px + 24.222x16.515 split pill)
  //  All icons are LOCAL SVG from assets/figma/lock-screen/
  // ==========================================================================
  function GalaxyStatusBar(props) {
    var p = props || {};
    // Unified carrier label: K-Arts across QS, Notif, AND Lock.
    var carrier = p.carrier || 'K-Arts';
    var theme = p.theme || 'dark';
    var color = theme === 'light' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';
    var filter = theme === 'light' ? 'invert(1)' : 'none';

    // Wi-Fi (18×18)
    var wifi =
      '<div style="position:relative;width:18px;height:18px;flex-shrink:0;overflow:hidden;filter:' + filter + ';">' +
        absImg('wifi.svg', '11.11% -0.11% 11.11% 0.68%') +
      '</div>';

    // Cellular (18×18 with 14×14 centered inside)
    var cellular =
      '<div style="position:relative;width:18px;height:18px;flex-shrink:0;overflow:hidden;filter:' + filter + ';">' +
        '<img src="' + ASSET + 'cellular.svg" style="position:absolute;left:50%;top:50%;width:14px;height:14px;transform:translate(-50%,-50%);" alt="" />' +
      '</div>';

    // Battery (two subtract SVGs side by side: 15.414×16.515 + 8.808×16.515)
    var battery =
      '<div style="display:flex;align-items:center;flex-shrink:0;filter:' + filter + ';">' +
        '<img src="' + ASSET + 'battery-left.svg"  style="width:15.414px;height:16.515px;display:block;" alt="" />' +
        '<img src="' + ASSET + 'battery-right.svg" style="width:8.808px;height:16.515px;display:block;" alt="" />' +
      '</div>';

    // Identical structure to QS/Notif status bar: carrier on left, flex spacer,
    // wifi/cell/battery on right. No account icons (health/samsung/google)
    // per user request — Lock should match QS & Notif exactly.
    // Padding tuned to 28px shared topSystem zone (not the legacy 44px lock
    // variant). 6px vertical leaves room for the 15–18px glyphs with
    // align-items:center doing the final vertical positioning.
    return '<div style="' + FILL +
             'display:flex;align-items:center;justify-content:flex-end;gap:6px;' +
             'padding:6px 10px;box-sizing:border-box;">' +
             '<span style="font-family:' + FONT_BOLD + ';font-weight:700;font-size:15px;line-height:12px;' +
               'letter-spacing:0.15px;color:' + color + ';white-space:nowrap;flex-shrink:0;">' + carrier + '</span>' +
             '<div style="flex:1 0 0;align-self:stretch;"></div>' +
             '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
               wifi + cellular + battery +
             '</div>' +
           '</div>';
  }

  // ==========================================================================
  //  LOCK ICON — Figma node 750:6608 (24×24, vector inset 11.87%/22.07%)
  // ==========================================================================
  function GalaxyLockIcon() {
    return '<div style="' + FILL + 'display:flex;align-items:center;justify-content:center;">' +
             '<div style="position:relative;width:24px;height:24px;">' +
               absImg('lock-icon.svg', '11.87% 22.07% 11.88% 22.07%') +
             '</div>' +
           '</div>';
  }

  // ==========================================================================
  //  WEATHER + DATE LINE — Figma "Date" row (192×? inside clock group)
  //  [Sat, May 3 (24/20 reg)] [moon 19×19] [24° (24/20 reg)]  gap 10
  // ==========================================================================
  function GalaxyWeatherDate(props) {
    var p = props || {};
    var date = p.date || 'Sat, May 3';
    var temp = p.temp != null ? p.temp : 24;
    var textStyle = 'font-family:' + FONT_REGULAR + ';font-weight:400;font-size:24px;line-height:20px;color:#FFFFFF;white-space:nowrap;';
    var moonBox =
      '<div style="position:relative;width:19px;height:19px;flex-shrink:0;">' +
        '<img src="' + ASSET + 'moon.svg" style="position:absolute;width:18.73px;height:17.52px;left:calc(50% + 0.36px);top:calc(50% - 0.24px);transform:translate(-50%,-50%);" alt="" />' +
      '</div>';
    return '<div style="' + FILL + 'display:flex;align-items:center;justify-content:center;gap:10px;">' +
             '<span style="' + textStyle + '">' + date + '</span>' +
             moonBox +
             '<span style="' + textStyle + '">' + temp + '&deg;</span>' +
           '</div>';
  }

  // ==========================================================================
  //  CLOCK — Figma 750:4335
  //  font: SamsungNrDefault-V6 Regular 112px, leading 82px, gap 12, two lines
  // ==========================================================================
  function GalaxyClock(props) {
    var p = props || {};
    var lines = p.time || ['09', '41'];
    var size = p.fontSize || 112;
    var leading = p.lineHeight || 82;
    var gap = p.gap != null ? p.gap : 12;
    // Caller-provided family (e.g. randomized Modak / Bitcount / Poiret One
    // from lock-screen rule) wins over the default Samsung clock font.
    var fontFamily = p.family || FONT_CLOCK;
    var base = 'font-family:' + fontFamily + ';font-weight:400;font-size:' + size + 'px;' +
               'line-height:' + leading + 'px;color:#FFFFFF;text-align:center;white-space:nowrap;';
    return '<div style="' + FILL + 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:' + gap + 'px;">' +
             '<div style="' + base + '">' + lines[0] + '</div>' +
             '<div style="' + base + '">' + lines[1] + '</div>' +
           '</div>';
  }

  // ==========================================================================
  //  WIDGET ROW — battery pair pill + activity pill (138×62 each, gap 16)
  //  radius 20, bg rgba(23,23,26,0.3), blur 6
  // ==========================================================================
  function GalaxyWidgetRow() {
    var pillStyle =
      'width:138px;height:62px;background:rgba(23,23,26,0.60);' +
      '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);' +
      'border-radius:20px;display:flex;align-items:center;justify-content:center;gap:10px;' +
      'flex-shrink:0;box-sizing:border-box;';

    // Battery-widget-icon slot — 50×48 with:
    //   - top half: CSS-drawn battery arc (gray bg + colored fill portion)
    //   - middle: watch/ring icon centered
    //   - bottom: % label
    // We draw the arc inline rather than using Figma's rotate-154+hypot PNG
    // composition (which requires complex CSS variables).
    function batteryArcIcon(iconAsset, iconInset, label, pct, arcColor) {
      // Half-circle arc (top-half only). radius 18, stroke 3.
      // circumference-half = PI * r = ~56.55. dasharray lets us show `pct` amount.
      var r = 18;
      var halfC = Math.PI * r;
      var filled = (halfC * pct) / 100;
      var arcSvg =
        '<svg viewBox="0 0 50 28" style="position:absolute;top:4px;left:0;width:50px;height:28px;overflow:visible;">' +
          // Background half-circle
          '<path d="M 7 22 A 18 18 0 0 1 43 22" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="3" stroke-linecap="round" />' +
          // Active arc
          '<path d="M 7 22 A 18 18 0 0 1 43 22" fill="none" stroke="' + arcColor + '" stroke-width="3" stroke-linecap="round" ' +
                'stroke-dasharray="' + filled.toFixed(2) + ' ' + halfC.toFixed(2) + '" />' +
        '</svg>';

      // Icon bounding box — 20×20 centered horizontally, y=22.92%→35.42% of 48 ≈ 11→31 → 20×20
      var iconBox =
        '<div style="position:absolute;left:50%;top:' + Math.round(48 * 0.2292) + 'px;' +
          'width:20px;height:20px;transform:translateX(-50%);">' +
          '<div style="position:relative;width:100%;height:100%;">' +
            absImg(iconAsset, iconInset) +
          '</div>' +
        '</div>';

      // Label (12px semi, centered, below icon)
      var labelBox =
        '<div style="position:absolute;left:0;right:0;bottom:0;top:' + Math.round(48 * 0.75) + 'px;' +
          'display:flex;align-items:center;justify-content:center;' +
          'font-family:' + FONT_SEMI + ';font-weight:600;font-size:12px;line-height:12px;' +
          'color:rgba(255,255,255,0.85);">' + label + '</div>';

      return '<div style="position:relative;width:50px;height:48px;flex-shrink:0;">' +
               arcSvg + iconBox + labelBox +
             '</div>';
    }

    // Watch (29%, cyan-ish arc per Figma) + Ring (74%, green arc per Figma)
    var batteryPair =
      '<div style="' + pillStyle + '">' +
        batteryArcIcon('watch.svg', '11.88% 21.04%', '29', 29, '#B8DEE6') +
        batteryArcIcon('ring.svg',  '18.12% 17.19% 16.62% 17.55%', '74', 74, '#B8E6B8') +
      '</div>';

    // Activity pill: 48×48 daily-activity icon + column of 3 stat rows
    function statRow(glyphAsset, text) {
      return '<div style="display:flex;align-items:center;gap:4px;width:100%;">' +
               '<div style="background:rgba(255,255,255,0.3);border-radius:12px;padding:2px;display:flex;align-items:center;flex-shrink:0;">' +
                 '<div style="position:relative;width:10px;height:10px;">' +
                   absImg(glyphAsset, '15.1%') +
                 '</div>' +
               '</div>' +
               '<span style="font-family:' + FONT_SEMI + ';font-weight:600;font-size:10px;color:rgba(255,255,255,0.86);text-align:center;white-space:nowrap;">' + text + '</span>' +
             '</div>';
    }

    var activityPill =
      '<div style="' + pillStyle.replace('justify-content:center;', 'justify-content:flex-start;') +
        'padding:0 14px 0 10px;">' +
        '<div style="position:relative;width:48px;height:48px;flex-shrink:0;">' +
          '<div style="position:absolute;left:50%;top:12.5%;bottom:12.5%;aspect-ratio:38.74/34.21;transform:translateX(-50%);">' +
            '<img src="' + ASSET + 'daily-activity.svg" style="position:absolute;inset:0;width:100%;height:100%;display:block;" alt="" />' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:2px;flex:1 0 0;min-width:0;">' +
          statRow('steps.svg',     '4,209') +
          statRow('time-icon.svg', '25') +
          statRow('exercise.svg',  '650') +
        '</div>' +
      '</div>';

    return '<div style="' + FILL + 'display:flex;gap:16px;align-items:center;justify-content:center;">' +
             batteryPair + activityPill +
           '</div>';
  }

  // ==========================================================================
  //  SHORTCUT CIRCLE — 47×47 radius 61 (pill), bg rgba(55,55,55,0.3) blur 6
  //  border 0.25px rgba(55,55,55,0.3). Icon 24×24 centered (bottom 18.09%/top 18.09%, cx).
  // ==========================================================================
  function GalaxyShortcutCircle(props) {
    var p = props || {};
    var iconAsset = p.icon === 'camera' ? 'camera-icon.svg' : 'phone-icon.svg';
    var iconInset = p.icon === 'camera' ? '21.21% 12.5% 17.42% 12.5%' : '8.33% 36.15% 7.65% 33.33%';
    return '<div style="' + FILL + 'position:relative;' +
             'background:rgba(55,55,55,0.3);' +
             '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);' +
             'border:0.25px solid rgba(55,55,55,0.3);' +
             'border-radius:61px;overflow:hidden;box-sizing:border-box;">' +
             '<div style="position:absolute;left:calc(50% + 0.5px);top:18.09%;bottom:18.09%;aspect-ratio:1/1;transform:translateX(-50%);">' +
               '<div style="position:relative;width:100%;height:100%;">' +
                 absImg(iconAsset, iconInset) +
               '</div>' +
             '</div>' +
           '</div>';
  }

  // ==========================================================================
  //  NOW BAR — 64h, radius 53, bg rgba(23,23,26,0.3), blur 12
  //  border 0.25px, gap 14, padding L12 R18 T12 B12
  //  Icon slot 40×40 radius 20 (with nowbar-image.png), text 2 lines 16/12
  //  Trailing 24×24 (car-dim composed of car-dim-1 + car-dim-2)
  // ==========================================================================
  function GalaxyNowBar(props) {
    var p = props || {};
    var primary = p.primary || '8min away';
    var secondary = p.secondary || 'Arrives 9:45 - 9:50';
    var iconImage = p.iconImage || 'nowbar-image.png';

    // 40×40 rounded icon with optional image bg
    var iconSlot =
      '<div style="position:relative;width:40px;height:40px;flex-shrink:0;">' +
        '<div style="position:absolute;left:calc(50% + 0.5px);top:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:20px;overflow:hidden;">' +
          '<img src="' + ASSET + iconImage + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;" alt="" />' +
        '</div>' +
      '</div>';

    // Trailing 24×24 car-dim composite (2 vector layers)
    var trailing =
      '<div style="position:relative;width:24px;height:24px;flex-shrink:0;overflow:hidden;">' +
        absImg('car-dim-1.svg', '45% 17.5% 22.5% 20%') +
        absImg('car-dim-2.svg', '27.5% 21.31% 45% 24.87%') +
      '</div>';

    return '<div style="' + FILL +
             'display:flex;align-items:center;gap:14px;padding:12px 18px 12px 12px;' +
             'background:rgba(23,23,26,0.60);' +
             '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);' +
             'border:0.25px solid rgba(55,55,55,0.3);' +
             'border-radius:53px;box-sizing:border-box;min-width:0;">' +
             iconSlot +
             '<div style="flex:1 0 0;min-width:0;display:flex;flex-direction:column;gap:6px;color:#FFFFFF;">' +
               '<div style="font-family:' + FONT_SEMI + ';font-weight:600;font-size:16px;line-height:14px;">' + primary + '</div>' +
               '<div style="font-family:' + FONT_REGULAR + ';font-weight:500;font-size:12px;line-height:14px;">' + secondary + '</div>' +
             '</div>' +
             trailing +
           '</div>';
  }

  // ==========================================================================
  //  UNLOCK HINT — "Swipe to unlock" OUSAPP-regular 16 white
  // ==========================================================================
  function GalaxyUnlockHint(props) {
    var p = props || {};
    var text = p.text || 'Swipe to unlock';
    return '<div style="' + FILL + 'display:flex;align-items:center;justify-content:center;">' +
             '<span style="font-family:' + FONT_REGULAR + ';font-weight:400;font-size:16px;line-height:normal;color:#FFFFFF;">' + text + '</span>' +
           '</div>';
  }

  // ==========================================================================
  //  GESTURE BAR (home indicator) — visual 4×120 capsule centered
  // ==========================================================================
  function GalaxyGestureBar() {
    return '<div style="' + FILL + 'display:flex;align-items:center;justify-content:center;">' +
             '<div style="width:120px;height:4px;border-radius:2px;background:rgba(255,255,255,0.3);"></div>' +
           '</div>';
  }

  // ==========================================================================
  //  BACKGROUND — the Figma wallpaper PNG, cover-fit inside 451×978 radius 40
  // ==========================================================================
  function GalaxyBackground() {
    return '<img src="' + ASSET + 'background.png" style="' + FILL + 'object-fit:cover;display:block;border-radius:40px;" alt="" />';
  }

  // ==========================================================================
  //  QUICK SETTINGS FULL SCREEN — Figma node 3010:2142
  //  ---------------------------------------------------------------------------
  //  QS layout is flex-wrap grid. Instead of absolute positioning each tile,
  //  we emit the entire QS screen as ONE block. Rules only provide the outer
  //  canvas position (0,0,451,978). Inner layout exactly mirrors Figma.
  // ==========================================================================
  var QS_ASSET = 'assets/figma/quick-settings/';

  function qsAbsImg(src, inset, extra) {
    return '<div style="position:absolute;inset:' + inset + ';' + (extra || '') + '">' +
             '<img src="' + QS_ASSET + src + '" style="width:100%;height:100%;display:block;" alt="" />' +
           '</div>';
  }

  // Small 56×56 rounded icon container (with 30×30 icon inside)
  // activeBg=true → Samsung Blue-ish off-white bg, false → dim glass bg
  function qsToggleIcon(iconAsset, iconInset, activeBg) {
    // Some legacy QS assets were removed during refactors; avoid 404 spam.
    // If the SVG isn't present, render no icon (layout still works).
    if (iconAsset === 'wifi3-a.svg' || iconAsset === 'wifi3-b.svg' || iconAsset === 'wifi3-c.svg' ||
        iconAsset === 'wifi3-d.svg' || iconAsset === 'mobile-data-qs.svg' || iconAsset === 'bluetooth.svg') {
      return '<div style="width:56px;height:56px;flex-shrink:0;"></div>';
    }
    var bg = activeBg ? 'var(--qs-fallback-toggle-on-bg, #D5D5D5)' : 'var(--qs-fallback-toggle-off-bg, rgba(180,180,180,0.2))';
    return '<div style="position:relative;width:56px;height:56px;border-radius:63.636px;background:' + bg + ';' +
             'display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
             '<div style="position:relative;width:30px;height:30px;flex-shrink:0;overflow:hidden;">' +
               qsAbsImg(iconAsset, iconInset) +
             '</div>' +
           '</div>';
  }

  // Multi-layer 56×56 icon (for wifi3, tv-color composites)
  function qsToggleIconMulti(layers, activeBg) {
    // Avoid 404 spam if wifi3 layers are missing; return a blank container.
    if (Array.isArray(layers) && layers.some(function (L) {
      return L && (L.src === 'wifi3-a.svg' || L.src === 'wifi3-b.svg' || L.src === 'wifi3-c.svg' || L.src === 'wifi3-d.svg');
    })) {
      return '<div style="width:56px;height:56px;flex-shrink:0;"></div>';
    }
    var bg = activeBg ? 'var(--qs-fallback-toggle-on-bg, #D5D5D5)' : 'var(--qs-fallback-toggle-off-bg, rgba(180,180,180,0.2))';
    var inner = layers.map(function (L) {
      return qsAbsImg(L.src, L.inset, L.extra || '');
    }).join('');
    return '<div style="position:relative;width:56px;height:56px;border-radius:63.636px;background:' + bg + ';' +
             'display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
             '<div style="position:relative;width:30px;height:30px;flex-shrink:0;overflow:hidden;">' +
               inner +
             '</div>' +
           '</div>';
  }

  // Small 32.5×35 shortcut icon (for shortcut-type tiles)
  function qsShortcutIcon(iconAsset, iconInset) {
    return '<div style="position:relative;width:32.5px;height:35px;border-radius:63.636px;' +
             'display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
             '<div style="position:relative;width:34px;height:34px;flex-shrink:0;overflow:hidden;">' +
               qsAbsImg(iconAsset, iconInset) +
             '</div>' +
           '</div>';
  }

  var QS_TILE_BG = 'background:var(--qs-tile-bg, rgba(23,23,26,0.3));border:var(--surface-border, 1px solid rgba(255,255,255,0.2));box-shadow:var(--surface-shadow, none);-webkit-backdrop-filter:var(--surface-filter, blur(48px));backdrop-filter:var(--surface-filter, blur(48px));';
  var QS_TILE_RADIUS = 'border-radius:50px;';

  // 88×88 circular quick toggle tile (plus-icon by default)
  function qsSingleToggle(iconHTML) {
    iconHTML = iconHTML || qsToggleIcon('add.svg', '11.98%', false);
    return '<div style="width:88px;height:88px;max-width:88px;max-height:88px;aspect-ratio:1/1;' +
             QS_TILE_BG + QS_TILE_RADIUS +
             'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;overflow:hidden;flex:0 0 88px;min-width:88px;box-sizing:border-box;">' +
             iconHTML +
           '</div>';
  }

  // 195×88 extended quick toggle capsule with title + subtitle
  function qsHalfToggle(iconHTML, title, subtitle) {
    return '<div style="width:195px;height:88px;max-width:195px;max-height:88px;' +
             QS_TILE_BG + QS_TILE_RADIUS +
             'display:flex;flex-direction:column;justify-content:center;padding:16px 17px;overflow:hidden;flex:0 0 195px;min-width:195px;box-sizing:border-box;">' +
             '<div style="display:flex;gap:10px;align-items:center;width:100%;min-width:0;">' +
               iconHTML +
               '<div style="flex:1 0 0;min-width:0;display:flex;flex-direction:column;overflow:hidden;">' +
                 '<p style="font-family:var(--font);font-weight:600;font-size:16px;line-height:normal;color:#efeef2;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + title + '</p>' +
                 (subtitle ? '<p style="font-family:var(--font);font-weight:400;font-size:14px;line-height:normal;color:#cfcccf;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + subtitle + '</p>' : '') +
               '</div>' +
             '</div>' +
           '</div>';
  }

  // 415×? full-width icon tile with 4 plus-icons + expand handle
  function qsIconsRow() {
    var row = '<div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;">' +
                qsSingleToggle() + qsSingleToggle() + qsSingleToggle() + qsSingleToggle() +
              '</div>';
    return '<div style="width:408px;' + QS_TILE_BG + QS_TILE_RADIUS +
             'display:flex;flex-direction:column;gap:20px;align-items:center;justify-content:center;padding:24px 25px;overflow:hidden;flex-shrink:0;position:relative;box-sizing:border-box;">' +
             row +
             // Expand handle at bottom
             '<div style="position:absolute;bottom:-1px;left:181.5px;width:50px;height:4px;background:rgba(255,255,255,0.6);border-radius:2px;"></div>' +
           '</div>';
  }

  // Compact QS strip for previews/customizer. Uses the same Figma-extracted
  // 88×88 and 199×88 tile atoms as the full Quick Settings frame.
  // Width is fluid: fixed 408px caused clipping when the preview card is
  // narrower than the design spec (e.g. full-screen phone frame).
  function GalaxyQSToggleStrip(props) {
    var p = props || {};
    var toggles = Array.isArray(p.toggles) ? p.toggles : [];
    var wifiIcon = qsToggleIconMulti([
      { src: 'wifi3-a.svg', inset: '54.01% 33.21% 33.97% 32.66%' },
      { src: 'wifi3-b.svg', inset: '35.84% 20.37% 46.82% 19.82%' },
      { src: 'wifi3-c.svg', inset: '71.5% 45.41% 18.78% 44.86%' },
      { src: 'wifi3-d.svg', inset: '18.75% 8.27% 58.92% 7.71%' }
    ], true);
    var mobileDataIcon = qsToggleIcon('mobile-data-qs.svg', '8.33% 8.72%', false);
    var bluetoothIcon = qsToggleIcon('bluetooth.svg', '13.54% 25.09% 13.54% 21.34%', true);

    var bluetooth = toggles.find(function (t) {
      return /bluetooth/i.test((t && (t.name || t.label || t.icon)) || '');
    }) || { name: 'Bluetooth', sub: "Josh's Watch7" };

    function qsStripSingleToggle(iconHTML) {
      iconHTML = iconHTML || qsToggleIcon('add.svg', '11.98%', false);
      return '<div style="flex:0 1 88px;min-width:44px;max-width:88px;aspect-ratio:1/1;min-height:0;align-self:center;' +
               QS_TILE_BG + QS_TILE_RADIUS +
               'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;overflow:hidden;box-sizing:border-box;">' +
               iconHTML +
             '</div>';
    }
    function qsStripHalfToggle(iconHTML, title, subtitle) {
      return '<div style="flex:1 1 0;min-width:0;max-width:195px;height:88px;min-height:88px;max-height:88px;align-self:center;' +
               QS_TILE_BG + QS_TILE_RADIUS +
               'display:flex;flex-direction:column;justify-content:center;padding:16px 17px;overflow:hidden;box-sizing:border-box;">' +
               '<div style="display:flex;gap:10px;align-items:center;width:100%;min-width:0;">' +
                 iconHTML +
                 '<div style="flex:1 0 0;min-width:0;display:flex;flex-direction:column;overflow:hidden;">' +
                   '<p style="font-family:var(--font);font-weight:600;font-size:16px;line-height:normal;color:#efeef2;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + title + '</p>' +
                   (subtitle ? '<p style="font-family:var(--font);font-weight:400;font-size:14px;line-height:normal;color:#cfcccf;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + subtitle + '</p>' : '') +
                 '</div>' +
               '</div>' +
             '</div>';
    }

    var row = qsStripSingleToggle(wifiIcon) + qsStripSingleToggle(mobileDataIcon) +
      qsStripHalfToggle(bluetoothIcon, bluetooth.name || 'Bluetooth', bluetooth.sub || bluetooth.subtitle || "Josh's Watch7");

    return '<div style="width:100%;height:100%;min-height:88px;min-width:0;display:flex;align-items:center;justify-content:center;padding:0;box-sizing:border-box;overflow:hidden;">' +
      '<div style="width:100%;max-width:408px;min-width:0;display:flex;gap:clamp(6px,2vw,15px);align-items:center;justify-content:center;box-sizing:border-box;">' + row + '</div>' +
    '</div>';
  }

  // 88×300 vertical slider tile (brightness/music).
  // Figma structure (per 3010:2142):
  //   outer: 88×300 glass pill, padding 18, gap 10, flex-col
  //   track: flex-1, bg rgba(185,185,185,0.2), radius 56, relative
  //     active-fill: 74h from BOTTOM, gradient, radius 56.818
  //     top-icon: sits INSIDE the active-fill (centered on the fill)
  //       — 34×34 icon, dark color so it's readable on light fill
  //   bottom-toggle: aspect-1 circle, bg #D5D5D5, 30×30 icon inset
  function qsSlider(iconTopHTML, iconBottomHTML) {
    return '<div style="width:88px;height:300px;min-height:275px;max-width:88px;' +
             QS_TILE_BG + QS_TILE_RADIUS +
             'display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;padding:18px;overflow:hidden;flex-shrink:0;box-sizing:border-box;">' +
             // Vertical slider track
             '<div style="flex:1 0 0;width:100%;background:rgba(185,185,185,0.2);border-radius:56px;position:relative;overflow:hidden;min-height:0;">' +
               // Active gradient fill (74px pill at the BOTTOM of the track)
               '<div style="position:absolute;bottom:0;left:0;right:0;height:74px;background:linear-gradient(180deg,#E4E4E4,#C6C4C3);border-radius:56.818px;">' +
                 // Top icon is CENTERED INSIDE the active fill
                 '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">' +
                   '<div style="position:relative;width:34px;height:34px;overflow:visible;">' +
                     iconTopHTML +
                   '</div>' +
                 '</div>' +
               '</div>' +
             '</div>' +
             // Bottom toggle circle (dark-mode / sound-vibrate)
             '<div style="width:100%;aspect-ratio:1/1;background:#D5D5D5;border-radius:63.636px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
               '<div style="position:relative;width:30px;height:30px;overflow:hidden;">' +
                 iconBottomHTML +
               '</div>' +
             '</div>' +
           '</div>';
  }

  // 408×86 SmartThings "Neo QLED" row with device icon + 3 control buttons
  function qsSmartThingsRow() {
    var deviceIcon =
      '<div style="position:relative;width:32.5px;height:35px;border-radius:63.636px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<div style="position:relative;width:34px;height:34px;overflow:hidden;">' +
          qsAbsImg('tv-color-1.svg', '55% 30% 22.5% 30%') +
          qsAbsImg('tv-color-2.svg', '22.5% 17.5% 37.5% 17.5%') +
        '</div>' +
      '</div>';

    function ctrlBtn(iconHTML, activeBg) {
      var bg = activeBg ? '#D5D5D5' : 'rgba(180,180,180,0.2)';
      return '<div style="aspect-ratio:1/1;flex:1 0 0;min-width:0;background:' + bg + ';border-radius:63.636px;display:flex;align-items:center;justify-content:center;padding:13px;">' +
               '<div style="position:relative;width:30px;height:30px;flex-shrink:0;overflow:hidden;">' +
                 iconHTML +
               '</div>' +
             '</div>';
    }

    return '<div style="width:408px;height:86px;max-height:88px;' + QS_TILE_BG + QS_TILE_RADIUS +
             'display:flex;gap:20px;align-items:center;padding:24px 17px 24px 20px;overflow:hidden;flex-shrink:0;box-sizing:border-box;">' +
             // Left: device label
             '<div style="flex:1 0 0;min-width:0;display:flex;gap:10px;align-items:center;">' +
               deviceIcon +
               '<div style="display:flex;flex-direction:column;">' +
                 '<p style="font-family:' + FONT_SEMI + ';font-weight:600;font-size:16px;line-height:normal;color:#EFEEF2;margin:0;width:138px;">55&quot; Neo QLED</p>' +
                 '<p style="font-family:' + FONT_REGULAR + ';font-weight:400;font-size:14px;line-height:normal;color:#CFCCCF;margin:0;width:138px;">Living Room</p>' +
               '</div>' +
             '</div>' +
             // Right: 3 control buttons
             '<div style="flex:1 0 0;min-width:0;display:flex;gap:10px;align-items:center;justify-content:flex-end;">' +
               ctrlBtn(qsAbsImg('smart-view.svg', '12.29%'), false) +
               ctrlBtn(
                 qsAbsImg('remote-1.svg', '15% 28.33% 15% 25%', 'inset:-3.27% -4.91%;') +
                 qsAbsImg('remote-2.svg', '26.5% 41.5% 53.5% 38.5%', 'inset:-9.17%;') +
                 qsAbsImg('remote-3.svg', '53.5% 40% 24.96% 36.67%'),
                 false) +
               ctrlBtn(qsAbsImg('power-small.svg', '14.58% 16.67%'), true) +
             '</div>' +
           '</div>';
  }

  function GalaxyQSScreen() {
    // Status bar — identical shape to Notifications (44h, padding 16y 10x)
    var statusBar =
      '<div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:16px 10px;height:44px;width:100%;box-sizing:border-box;overflow:hidden;">' +
        '<span style="font-family:' + FONT_BOLD + ';font-weight:700;font-size:15px;line-height:12px;letter-spacing:0.15px;color:rgba(255,255,255,0.8);white-space:nowrap;flex-shrink:0;">K-Arts</span>' +
        '<div style="flex:1 0 0;align-self:stretch;"></div>' +
        '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
          '<div style="position:relative;width:18px;height:18px;flex-shrink:0;overflow:hidden;">' + qsAbsImg('wifi.svg', '11.11% -0.11% 11.11% 0.68%') + '</div>' +
          '<div style="position:relative;width:18px;height:18px;flex-shrink:0;overflow:hidden;"><img src="' + QS_ASSET + 'cellular.svg" style="position:absolute;left:50%;top:50%;width:14px;height:14px;transform:translate(-50%,-50%);" alt=""></div>' +
          '<div style="display:flex;align-items:center;flex-shrink:0;">' +
            '<img src="' + QS_ASSET + 'battery-left.svg" style="width:15.414px;height:16.515px;display:block;" alt="">' +
            '<img src="' + QS_ASSET + 'battery-right.svg" style="width:8.808px;height:16.515px;display:block;" alt="">' +
          '</div>' +
        '</div>' +
      '</div>';

    // Top utility icons row (edit / power / settings — 25×25 each, gap 28, px 10)
    // Mirrors Notif's timeRow layout: 415 wide, 25 tall, flex right-aligned.
    var topIcons =
      '<div style="display:flex;align-items:center;justify-content:flex-end;height:25px;width:415px;padding:0 10px;box-sizing:border-box;">' +
        '<div style="display:flex;gap:28px;align-items:center;">' +
          '<div style="position:relative;width:25px;height:25px;overflow:hidden;">' + qsAbsImg('edit.svg', '15.1% 15.18%') + '</div>' +
          '<div style="position:relative;width:25px;height:25px;overflow:hidden;">' + qsAbsImg('power.svg', '14.58% 16.67%') + '</div>' +
          '<div style="position:relative;width:25px;height:25px;overflow:hidden;">' + qsAbsImg('settings.svg', '12.92% 15.05%') + '</div>' +
        '</div>' +
      '</div>';

    // Sticky header — matches Notif exactly: gap:12px between statusBar and topIcons
    var stickyHeader =
      '<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start;width:415px;">' +
        statusBar +
        topIcons +
      '</div>';

    // Primary 3 toggles row: [wifi 88] [mobile-data 88] [bluetooth 199]
    var wifiIcon = qsToggleIconMulti([
      { src: 'wifi3-a.svg', inset: '54.01% 33.21% 33.97% 32.66%' },
      { src: 'wifi3-b.svg', inset: '35.84% 20.37% 46.82% 19.82%' },
      { src: 'wifi3-c.svg', inset: '71.5% 45.41% 18.78% 44.86%' },
      { src: 'wifi3-d.svg', inset: '18.75% 8.27% 58.92% 7.71%' }
    ], true);
    var mobileDataIcon = qsToggleIcon('mobile-data-qs.svg', '8.33% 8.72%', false);
    var bluetoothIcon = qsToggleIcon('bluetooth.svg', '13.54% 25.09% 13.54% 21.34%', true);

    var primaryRow = qsSingleToggle(wifiIcon) + qsSingleToggle(mobileDataIcon) +
                     qsHalfToggle(bluetoothIcon, 'Bluetooth', "Josh's Watch7");

    // Four-plus row with expand handle
    var plusRow = qsIconsRow();

    // Sliders: brightness + music
    // Brightness top icon: rays (outer) + bulb (inner), both layered in same 34×34 box
    // Figma: bulb inset 33.85%, rays inset 14.06% (with inner -3.07% inset)
    var brightnessTopIcon =
      qsAbsImg('brightness-rays.svg', '14.06%', 'overflow:visible;') +
      qsAbsImg('brightness-bulb.svg', '33.85%');
    var brightnessBottomIcon = qsAbsImg('dark-mode.svg', '14.08%');

    // Music top icon: single vector, centered in 34×34 with Figma's aspect-ratio math.
    // Figma uses aspect-ratio 10.61/11.83 at left 20.1% right 20.1% top 50% translateY(-50%).
    // Simpler: center it at 50%/50% with intrinsic aspect.
    var musicTopIcon =
      '<div style="position:absolute;left:20.1%;right:20.1%;top:50%;transform:translateY(-50%);aspect-ratio:10.61/11.83;">' +
        '<img src="' + QS_ASSET + 'music.svg" style="width:100%;height:100%;display:block;" alt="">' +
      '</div>';
    var musicBottomIcon = qsAbsImg('sound-vibrate.svg', '16.67% 17.53% 17.16% 16.67%');

    var brightnessSlider = qsSlider(brightnessTopIcon, brightnessBottomIcon);
    var musicSlider      = qsSlider(musicTopIcon,      musicBottomIcon);

    // Right-side 2-col 2x2 tile grid (width 194)
    var halfTileGroup =
      '<div style="display:flex;flex-wrap:wrap;gap:18px;width:194px;align-items:flex-start;">' +
        qsHalfToggle(qsShortcutIcon('open.svg', '15.1%'), 'Title', 'Subtitle') +
        qsSingleToggle() +
        qsSingleToggle() +
        qsHalfToggle(qsShortcutIcon('open.svg', '15.1%'), 'Title', 'Subtitle') +
      '</div>';

    // Four bottom toggles row (88×88 each)
    var bottomToggles = qsSingleToggle() + qsSingleToggle() + qsSingleToggle() + qsSingleToggle();

    // SmartThings tile
    var smartThings1 = qsSmartThingsRow();

    // Four more bottom toggles (fade out — will be clipped by bottom mask)
    var lastToggles = qsSingleToggle() + qsSingleToggle() + qsSingleToggle() + qsSingleToggle();

    // SmartThings (fade)
    var smartThings2 = qsSmartThingsRow();

    // Grid: flex-wrap gap 18, tight top padding (reduced from 18 → 4 so the
    // whole surface sits higher in the device frame — no wasted space above
    // the status bar). Wallpaper removed per user request.
    var grid =
      '<div style="width:451px;height:978px;background:rgba(23,23,26,0.85);' +
        '-webkit-backdrop-filter:blur(25px);backdrop-filter:blur(25px);' +
        'display:flex;flex-wrap:wrap;gap:18px;padding:4px 18px 0;box-sizing:border-box;overflow:hidden;position:absolute;inset:0;">' +
        stickyHeader +
        primaryRow +
        plusRow +
        brightnessSlider + musicSlider + halfTileGroup +
        bottomToggles +
        smartThings1 +
        lastToggles +
        smartThings2 +
      '</div>';

    // Solid dark surface (no wallpaper) — matches One UI QS pull-down over an
    // obscured wallpaper. Keeps the 40px frame radius for visual consistency.
    return '<div style="' + FILL + 'position:relative;border-radius:40px;overflow:hidden;background:#17171A;">' +
             grid +
           '</div>';
  }

  // ==========================================================================
  //  NOTIFICATIONS FULL SCREEN — Figma node 989:22754
  //  ---------------------------------------------------------------------------
  //  Layout: flex column, gap 10, padding 18/18. Same background + blur grid.
  // ==========================================================================
  var NF_ASSET = 'assets/figma/notifications/';
  function nfAbsImg(src, inset, extra) {
    return '<div style="position:absolute;inset:' + inset + ';' + (extra || '') + '">' +
             '<img src="' + NF_ASSET + src + '" style="width:100%;height:100%;display:block;" alt="" />' +
           '</div>';
  }

  // 56×56 notification avatar: gray circle with plus-icon
  function nfAvatar() {
    return '<div style="position:relative;width:56px;height:56px;border-radius:63.636px;flex-shrink:0;">' +
             // Gray circle background
             '<div style="position:absolute;left:50%;top:calc(50% + 0.5px);transform:translate(-50%,-50%);width:56px;height:56px;">' +
               '<img src="' + NF_ASSET + 'shape-circle.svg" style="width:100%;height:100%;display:block;" alt="">' +
             '</div>' +
             // Plus icon
             '<div style="position:absolute;left:50%;top:calc(50% + 0.5px);transform:translate(-50%,-50%);width:30px;height:30px;overflow:hidden;">' +
               nfAbsImg('add-icon.svg', '11.98%') +
             '</div>' +
           '</div>';
  }

  function GalaxyNotifScreen() {
    var statusBar =
      '<div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:16px 10px;height:44px;width:100%;box-sizing:border-box;overflow:hidden;">' +
        '<span style="font-family:' + FONT_BOLD + ';font-weight:700;font-size:15px;line-height:12px;letter-spacing:0.15px;color:rgba(255,255,255,0.8);white-space:nowrap;flex-shrink:0;">K-Arts</span>' +
        '<div style="flex:1 0 0;align-self:stretch;"></div>' +
        '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
          '<div style="position:relative;width:18px;height:18px;flex-shrink:0;overflow:hidden;">' + nfAbsImg('wifi.svg', '11.11% -0.11% 11.11% 0.68%') + '</div>' +
          '<div style="position:relative;width:18px;height:18px;flex-shrink:0;overflow:hidden;"><img src="' + NF_ASSET + 'cellular.svg" style="position:absolute;left:50%;top:50%;width:14px;height:14px;transform:translate(-50%,-50%);" alt=""></div>' +
          '<div style="display:flex;align-items:center;flex-shrink:0;">' +
            '<img src="' + NF_ASSET + 'battery-left.svg" style="width:15.414px;height:16.515px;display:block;" alt="">' +
            '<img src="' + NF_ASSET + 'battery-right.svg" style="width:8.808px;height:16.515px;display:block;" alt="">' +
          '</div>' +
        '</div>' +
      '</div>';

    // Top time + date row (415×25)
    var timeRow =
      '<div style="display:flex;align-items:center;justify-content:space-between;height:25px;width:415px;padding:0 10px;box-sizing:border-box;">' +
        '<div style="display:inline-flex;align-items:end;color:#FFFFFF;">' +
          '<span style="font-family:' + FONT_BOLD + ';font-weight:700;font-size:26px;line-height:12px;letter-spacing:0.26px;">8:21</span>' +
          '<span style="margin-left:12px;font-family:' + FONT_REGULAR + ';font-weight:500;font-size:18px;line-height:12px;letter-spacing:0.18px;">Thu 28 Aug</span>' +
        '</div>' +
      '</div>';

    // "Live notifications" label
    function sectionLabel(text, padding) {
      return '<div style="display:flex;align-items:center;padding:' + (padding || '10px') + ';width:100%;box-sizing:border-box;">' +
               '<span style="font-family:' + FONT_REGULAR + ';font-weight:400;font-size:14px;line-height:normal;color:#FFFFFF;white-space:pre;">' + text + '</span>' +
             '</div>';
    }

    // Full-width media card (408×180) — art bg + info + progress + transport
    var mediaCard =
      '<div style="position:relative;width:408px;height:180px;border-radius:36px;padding:14px 29px;overflow:hidden;flex-shrink:0;box-sizing:border-box;display:flex;flex-direction:column;">' +
        // Art background
        '<img src="' + NF_ASSET + 'media-bg.png" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:36px;" alt="">' +
        // Content wrapper (above art)
        '<div style="position:relative;height:152px;display:flex;flex-direction:column;justify-content:space-between;width:100%;">' +
          // Top row: source | phone speaker pill
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<div style="display:flex;gap:6px;align-items:center;">' +
              '<div style="position:relative;width:14px;height:14px;overflow:hidden;">' + nfAbsImg('music-note.svg', '50% 20.1%') + '</div>' +
              '<span style="font-family:' + FONT_REGULAR + ';font-weight:400;font-size:12px;line-height:normal;color:#FFFFFF;letter-spacing:0.24px;">Samsung Music</span>' +
            '</div>' +
            '<div style="display:flex;gap:4px;align-items:center;justify-content:center;padding:4px 6px;background:rgba(0,0,0,0.2);border-radius:30.72px;">' +
              '<div style="position:relative;width:14px;height:14px;overflow:hidden;">' + nfAbsImg('device-icon.svg', '13.02% 24.48%') + '</div>' +
              '<span style="font-family:' + FONT_REGULAR + ';font-weight:400;font-size:10px;line-height:normal;color:#FFFFFF;">Phone speaker</span>' +
            '</div>' +
          '</div>' +
          // Title / artist
          '<div style="display:flex;flex-direction:column;gap:2px;">' +
            '<p style="font-family:' + FONT_REGULAR + ';font-weight:500;font-size:14px;line-height:normal;color:#FFFFFF;letter-spacing:0.28px;margin:0;">Title</p>' +
            '<p style="font-family:' + FONT_REGULAR + ';font-weight:400;font-size:12px;line-height:normal;color:rgba(255,255,255,0.75);letter-spacing:0.24px;margin:0;">Artist</p>' +
          '</div>' +
          // Progress bar + timestamps
          '<div style="display:flex;flex-direction:column;gap:3px;align-items:center;width:100%;">' +
            '<div style="position:relative;width:347px;height:19.5px;">' +
              '<img src="' + NF_ASSET + 'media-progress.svg" style="position:absolute;inset:0 -1.3%;width:102.6%;height:100%;display:block;" alt="">' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;width:100%;font-family:' + FONT_REGULAR + ';font-weight:400;font-size:10px;line-height:normal;color:rgba(255,255,255,0.75);letter-spacing:0.2px;">' +
              '<span>02:41</span>' +
              '<span>03:24</span>' +
            '</div>' +
          '</div>' +
          // Transport controls
          '<div style="display:flex;gap:30px;align-items:center;justify-content:center;">' +
            '<div style="position:relative;width:24px;height:24px;overflow:hidden;">' + nfAbsImg('shuffle.svg', '17.71% 13.67%') + '</div>' +
            '<div style="position:relative;width:24px;height:24px;overflow:hidden;transform:scaleX(-1);">' +
              '<img src="' + NF_ASSET + 'prev-next.svg" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:13.795px;height:16px;" alt="">' +
            '</div>' +
            '<div style="position:relative;width:24px;height:24px;overflow:hidden;">' + nfAbsImg('pause.svg', '18.92% 26.04%') + '</div>' +
            '<div style="position:relative;width:24px;height:24px;overflow:hidden;">' +
              '<img src="' + NF_ASSET + 'prev-next.svg" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:13.795px;height:16px;" alt="">' +
            '</div>' +
            '<div style="position:relative;width:24px;height:24px;overflow:hidden;">' + nfAbsImg('heart.svg', '19.27% 14.02%') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Live notification (full width, 86h): gradient bg + avatar + title + 3 dot icons
    var liveNotif =
      '<div style="width:100%;height:86px;display:flex;gap:15px;align-items:center;padding:0 16px;border-radius:var(--card-radius,20px);overflow:hidden;flex-shrink:0;box-sizing:border-box;' +
        'background:linear-gradient(-89.72deg,rgba(23,23,26,0.3) 30%,rgb(0,0,0) 118%);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);">' +
        '<div style="flex:1 0 0;min-width:0;display:flex;flex-direction:column;height:46px;justify-content:space-between;overflow:hidden;">' +
          '<p style="font-family:' + FONT_SEMI + ';font-weight:600;font-size:20px;line-height:normal;color:#EFEEF2;margin:0;white-space:nowrap;">Title</p>' +
          '<p style="font-family:' + FONT_REGULAR + ';font-weight:400;font-size:14px;line-height:normal;color:#CFCCCF;margin:0;white-space:nowrap;">Subtitle</p>' +
        '</div>' +
        nfAvatar() +
      '</div>';

    // AI regular notification (415×86) — gradient blue-green bg
    var aiRegular =
      '<div style="width:415px;height:86px;display:flex;gap:10px;align-items:center;padding:15px 20px 15px 16px;border-radius:var(--card-radius,20px);overflow:hidden;flex-shrink:0;box-sizing:border-box;' +
        'background:linear-gradient(90deg,rgba(102,161,243,0.4),rgba(34,201,166,0.4));">' +
        nfAvatar() +
        '<div style="flex:1 0 0;min-width:0;display:flex;flex-direction:column;overflow:hidden;">' +
          '<div style="display:flex;gap:8px;align-items:flex-end;white-space:nowrap;overflow:hidden;">' +
            '<p style="font-family:' + FONT_SEMI + ';font-weight:600;font-size:15px;line-height:normal;color:#EFEEF2;margin:0;">Title</p>' +
            '<p style="font-family:' + FONT_REGULAR + ';font-weight:400;font-size:12px;line-height:normal;color:#D5D5D5;margin:0;">8:21 AM</p>' +
          '</div>' +
          '<p style="font-family:' + FONT_REGULAR + ';font-weight:400;font-size:14px;line-height:normal;color:#CFCCCF;margin:0;">Subtitle</p>' +
        '</div>' +
        '<div style="position:relative;width:16px;height:16px;flex-shrink:0;opacity:0.8;overflow:hidden;">' +
          nfAbsImg('arrow-down.svg', '33.17% 15.08%') +
        '</div>' +
      '</div>';

    // Stack notification (415×91) — inner stacked visual
    var stackNotif =
      '<div style="width:415px;height:91px;display:flex;align-items:center;padding:15px 0;border-radius:var(--card-radius,20px);overflow:hidden;flex-shrink:0;box-sizing:border-box;">' +
        '<div style="flex:1 0 0;display:flex;flex-direction:column;align-items:center;border-radius:30px;overflow:hidden;">' +
          '<div style="width:100%;height:86px;display:flex;gap:10px;align-items:center;padding:15px 20px 15px 16px;background:rgba(23,23,26,0.3);border-radius:var(--card-radius,20px);overflow:hidden;box-sizing:border-box;">' +
            nfAvatar() +
            '<div style="flex:1 0 0;min-width:0;display:flex;flex-direction:column;overflow:hidden;">' +
              '<div style="display:flex;gap:8px;align-items:flex-end;width:189px;white-space:nowrap;overflow:hidden;">' +
                '<p style="font-family:' + FONT_SEMI + ';font-weight:600;font-size:15px;line-height:normal;color:#EFEEF2;margin:0;">Title</p>' +
                '<p style="font-family:' + FONT_REGULAR + ';font-weight:400;font-size:12px;line-height:normal;color:#D5D5D5;margin:0;">8:21 AM</p>' +
              '</div>' +
              '<p style="font-family:' + FONT_REGULAR + ';font-weight:400;font-size:14px;line-height:normal;color:#CFCCCF;margin:0;white-space:nowrap;">Subtitle</p>' +
            '</div>' +
            '<p style="font-family:' + FONT_REGULAR + ';font-weight:400;font-size:15px;line-height:normal;color:#D5D5D5;margin:0;white-space:nowrap;">28</p>' +
          '</div>' +
          '<div style="position:relative;width:332.963px;height:3.659px;">' +
            '<img src="' + NF_ASSET + 'stack-line.svg" style="position:absolute;inset:0;width:100%;height:100%;display:block;" alt="">' +
          '</div>' +
        '</div>' +
      '</div>';

    // Grid: flex-column gap 10, tight top padding (4 instead of 18 — moves
    // the whole surface up so it reads like a shade pulled to the very top).
    // Wallpaper removed per user request — flat dark glass surface.
    var grid =
      '<div style="position:absolute;inset:0;background:rgba(23,23,26,0.85);-webkit-backdrop-filter:blur(25px);backdrop-filter:blur(25px);' +
        'display:flex;flex-direction:column;gap:10px;padding:4px 18px 0;border-radius:40px;overflow:hidden;box-sizing:border-box;">' +
        // Status bar + time row wrapper (gap 12)
        '<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start;width:415px;">' +
          statusBar +
          timeRow +
        '</div>' +
        sectionLabel('   Live notifications') +
        mediaCard +
        liveNotif +
        sectionLabel('Other notifications ', '10px') +
        aiRegular +
        stackNotif +
      '</div>';

    return '<div style="' + FILL + 'position:relative;border-radius:40px;overflow:hidden;background:#17171A;">' +
             grid +
           '</div>';
  }

  // --- Legacy atomics (kept for notification shade / QS which haven't been
  //     ground-truth-extracted yet; will be replaced when those Figma frames
  //     are captured). Stubs so renderers don't crash. ---
  function notYetExtracted(role) {
    return '<div style="' + FILL + 'display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-size:10px;border:1px dashed rgba(255,255,255,0.15);border-radius:8px;">' + role + ' (pending Figma extraction)</div>';
  }

  root.GalaxyAtomics = {
    // Lock-screen — Figma-verified (3010:2143)
    StatusBar:      GalaxyStatusBar,
    LockIcon:       GalaxyLockIcon,
    WeatherDate:    GalaxyWeatherDate,
    Clock:          GalaxyClock,
    WidgetRow:      GalaxyWidgetRow,
    ShortcutCircle: GalaxyShortcutCircle,
    NowBar:         GalaxyNowBar,
    UnlockHint:     GalaxyUnlockHint,
    GestureBar:     GalaxyGestureBar,
    Background:     GalaxyBackground,
    // Full-screen Figma-verified surfaces (treated as single atomic block)
    QSScreen:       GalaxyQSScreen,
    QSToggleStrip:  GalaxyQSToggleStrip,
    NotifScreen:    GalaxyNotifScreen
  };

})(typeof window !== 'undefined' ? window : this);
