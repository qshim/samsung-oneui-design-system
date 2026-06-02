const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'styles/theme-page.css');
const restorePath = path.join(__dirname, '..', '_restore_test1_css_utf8.css');

let themeCss = fs.readFileSync(cssPath, 'utf8');
const restoreLines = fs.readFileSync(restorePath, 'utf8').split(/\r?\n/);
let homeCss = restoreLines.slice(17400 - 1, 18008).join('\n');

homeCss = homeCss
  .replace(/transform: translate3d\(0, -28px, 0\);/g, 'transform: translate3d(-72px, 0, 0);')
  .replace(/#test1-home-header__title/g, '#test1-home-header .test1-home-header__title')
  .replace(/#test1-home-header__sub/g, '#test1-home-header .test1-home-header__sub')
  .replace(/color: #0b0b0b;/g, 'color: #0a3d58;')
  .replace(/color: rgba\(11, 11, 11, 0\.72\);/g, 'color: rgba(10, 61, 88, 0.72);')
  .replace(
    `#canvas[data-test-scope="test1"] .test1-home-food__icon--tofu {
    background: linear-gradient(145deg, #fff8ef 0%, #f2dfc8 100%);
  }`,
    `#canvas[data-test-scope="test1"] .test1-home-food__icon--tofu {
    background-image: url('/assets/test1/home/food-tofu.png');
    background-size: cover;
    background-position: center;
  }`
  )
  .replace(
    `#canvas[data-test-scope="test1"] .test1-home-food__icon--zucchini {
    background: linear-gradient(145deg, #dff3a8 0%, #8fbf4d 100%);
  }`,
    `#canvas[data-test-scope="test1"] .test1-home-food__icon--zucchini {
    background-image: url('/assets/test1/home/food-zucchini.png');
    background-size: cover;
    background-position: center;
  }`
  )
  .replace(
    `#canvas[data-test-scope="test1"] .test1-home-food__icon--onion {
    background: linear-gradient(145deg, #e8ffd0 0%, #b8e86a 100%);
  }`,
    `#canvas[data-test-scope="test1"] .test1-home-food__icon--onion {
    background-image: url('/assets/test1/home/food-onion.png');
    background-size: cover;
    background-position: center;
  }`
  );

const extraCss = `
  /* test1 home — pill swipe affordance after coda */
  #canvas[data-test-scope="test1"][data-test1-coda-done]:not([data-test1-home-run]):not([data-test1-home-exit]) .canvas-item[data-role="test1-bottom-pill"],
  #canvas[data-test-scope="test1"][data-test1-coda-done]:not([data-test1-home-run]):not([data-test1-home-exit]) #test1-bottom-pill {
    pointer-events: auto !important;
    cursor: grab;
    touch-action: pan-y;
  }
  #canvas[data-test-scope="test1"] .test1-home-food__btn--alt {
    background: rgba(255, 255, 255, 0.4);
    color: #0a3d58;
  }
  #canvas[data-test-scope="test1"][data-test1-home-run] .canvas-item[data-role="gestureBar"] {
    display: block !important;
    pointer-events: none !important;
  }
`;

if (!homeCss.includes('test1HomeBottomExit')) {
  console.error('Extracted home CSS missing keyframes');
  process.exit(1);
}

// Remove partial insert if present
const partialStart = themeCss.indexOf('/* test1 home — pill swipe affordance after coda */');
if (partialStart !== -1) {
  const partialEnd = themeCss.indexOf('@media (prefers-reduced-motion: reduce)', partialStart);
  if (partialEnd !== -1) {
    themeCss = themeCss.slice(0, partialStart) + themeCss.slice(partialEnd);
    console.log('Removed partial home CSS insert');
  }
}

if (themeCss.includes('test1HomeBottomExit')) {
  console.log('Full home CSS already present');
  process.exit(0);
}

const marker = '  @media (prefers-reduced-motion: reduce) {\n    #canvas[data-test-scope="test1"][data-test1-coda-animate]';
const markerIdx = themeCss.indexOf(marker);
if (markerIdx === -1) {
  console.error('Could not find insertion marker');
  process.exit(1);
}

themeCss = themeCss.slice(0, markerIdx) + homeCss + extraCss + '\n\n' + themeCss.slice(markerIdx);
fs.writeFileSync(cssPath, themeCss, 'utf8');
console.log('Inserted full home CSS, total added', homeCss.length + extraCss.length, 'chars');
