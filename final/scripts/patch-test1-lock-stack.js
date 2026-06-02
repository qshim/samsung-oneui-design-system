const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'styles/theme-page.css');
const restorePath = path.join(__dirname, '..', '_t1_css.js');

let css = fs.readFileSync(cssPath, 'utf8');
const restore = fs.readFileSync(restorePath, 'utf8');

if (css.includes('.test1-lock-stack__clock')) {
  console.log('test1-lock-stack CSS already present');
  process.exit(0);
}

const start = restore.indexOf('#canvas[data-test-scope="test1"]:not([data-test1-home-run]):not([data-test1-home-prep]):not([data-test1-reveal-all]) .canvas-item[data-role="test1-lock-stack"]');
const end = restore.indexOf('/* test1', restore.indexOf('Android nav', start));
const blockEnd = restore.indexOf('Android nav', start);
let lockCss = restore.slice(start, blockEnd);

// Also grab home-run hide rule for lock-stack if not in slice
const homeHideStart = restore.indexOf('#canvas[data-test-scope="test1"][data-test1-home-run]:not([data-test1-home-exit]) .canvas-item[data-role="test1-lock-stack"]');
if (homeHideStart > 0 && !lockCss.includes('data-test1-home-run')) {
  const homeHideEnd = restore.indexOf('\n\n', restore.indexOf('#test1-assist-pill', homeHideStart));
  lockCss += '\n' + restore.slice(homeHideStart, homeHideEnd > homeHideStart ? homeHideEnd : homeHideStart + 1200);
}

const extraCss = `
  #canvas[data-test-scope="test1"] .canvas-item[data-role="lockIndicator"],
  #canvas[data-test-scope="test1"] #test1-lock-indicator {
    display: block !important;
    pointer-events: none !important;
    z-index: 2;
  }
  #canvas[data-test-scope="test1"]:not([data-test1-home-run]):not([data-test1-home-prep]):not([data-test1-reveal-all]) .canvas-item[data-role="lockIndicator"],
  #canvas[data-test-scope="test1"]:not([data-test1-home-run]):not([data-test1-home-prep]):not([data-test1-reveal-all]) #test1-lock-indicator {
    display: block !important;
    pointer-events: none !important;
  }
  #canvas[data-test-scope="test1"] .canvas-item[data-role="lockIndicator"] svg,
  #canvas[data-test-scope="test1"] #test1-lock-indicator svg {
    color: rgba(0, 0, 0, 0.85);
    filter: none;
  }
  #canvas[data-test-scope="test1"][data-test1-home-run] .canvas-item[data-role="lockIndicator"],
  #canvas[data-test-scope="test1"][data-test1-home-run] #test1-lock-indicator,
  #canvas[data-test-scope="test1"][data-test1-home-prep] .canvas-item[data-role="lockIndicator"],
  #canvas[data-test-scope="test1"][data-test1-home-prep] #test1-lock-indicator {
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
`;

// Insert after test1 visible components block (after bottom-pill display rule)
const anchor = '  #canvas[data-test-scope="test1"] #test1-bottom-pill {\n    display: block !important;\n    pointer-events: auto !important;\n  }';
const anchorIdx = css.indexOf(anchor);
if (anchorIdx === -1) {
  console.error('CSS anchor not found');
  process.exit(1);
}

const insertAt = anchorIdx + anchor.length;
const lockStackVisible = `
  #canvas[data-test-scope="test1"] .canvas-item[data-role="test1-lock-stack"],
  #canvas[data-test-scope="test1"] #test1-lock-stack,
  #canvas[data-test-scope="test1"] .canvas-item[data-role="lockIndicator"],
  #canvas[data-test-scope="test1"] #test1-lock-indicator,`;

css = css.slice(0, insertAt) + '\n' +
  css.slice(insertAt).replace(
    '  #canvas[data-test-scope="test1"] .canvas-item[data-role="test1-bottom-pill"],',
    '  #canvas[data-test-scope="test1"] .canvas-item[data-role="test1-lock-stack"],\n' +
    '  #canvas[data-test-scope="test1"] .canvas-item[data-role="lockIndicator"],\n' +
    '  #canvas[data-test-scope="test1"] .canvas-item[data-role="test1-bottom-pill"],'
  ).replace(
    '  #canvas[data-test-scope="test1"] #test1-bottom-pill {',
    '  #canvas[data-test-scope="test1"] #test1-lock-stack,\n' +
    '  #canvas[data-test-scope="test1"] #test1-lock-indicator,\n' +
    '  #canvas[data-test-scope="test1"] #test1-bottom-pill {'
  );

// Insert lock-stack CSS before test1 intro hide rules
const introAnchor = '  /* test1 intro — hide 우리딸 until stack-run */';
const introIdx = css.indexOf(introAnchor);
if (introIdx === -1) {
  console.error('Intro anchor not found');
  process.exit(1);
}

css = css.slice(0, introIdx) + lockCss + extraCss + '\n\n' + css.slice(introIdx);
fs.writeFileSync(cssPath, css, 'utf8');
console.log('Inserted test1 lock-stack CSS', lockCss.length, 'chars');
