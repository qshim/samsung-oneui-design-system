const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cssPath = path.join(__dirname, '..', 'styles/theme-page.css');
let css = fs.readFileSync(cssPath, 'utf8');

if (css.includes('@keyframes test1PillIconIn')) {
  console.log('test1 coda pill animation CSS already present');
  process.exit(0);
}

const restoreCss = execSync('git show c6192c1:styles/theme-page.css', {
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024
});

const startMark = '  #canvas[data-test-scope="test1"][data-test1-coda-animate][data-test1-coda-run]:not([data-test1-reveal-all]) .test1-lock-shortcut-l,';
const endMark = '  @keyframes test1PillTextBIn {';

const start = restoreCss.indexOf(startMark);
const endKeyframesStart = restoreCss.indexOf(endMark, start);
const endKeyframesClose = restoreCss.indexOf('\n  }\n', endKeyframesStart);
if (start === -1 || endKeyframesStart === -1 || endKeyframesClose === -1) {
  console.error('Could not extract coda pill block from c6192c1');
  process.exit(1);
}
let block = restoreCss.slice(start, endKeyframesClose + 4);

// z-index + coda-run initial opacity states (before animate block)
const zStart = restoreCss.indexOf('  #canvas[data-test-scope="test1"][data-test1-coda-run] #test1-bottom-pill,');
const zEnd = restoreCss.indexOf(startMark, zStart);
const prefix = zStart !== -1 && zEnd !== -1 ? restoreCss.slice(zStart, zEnd) : '';

// coda-done settle states after animate block
const doneStart = restoreCss.indexOf('  #canvas[data-test-scope="test1"][data-test1-coda-run][data-test1-coda-done]:not([data-test1-reveal-all]) .test1-bottom-pill__bg-base,');
const doneEnd = restoreCss.indexOf('  @keyframes test1CodaFadeIn {', doneStart);
const doneBlock = doneStart !== -1 && doneEnd !== -1 ? restoreCss.slice(doneStart, doneEnd) : '';

const insertBlock = prefix + block + doneBlock;

const anchor = '  /* pillar — shell + left circle together, then star motion */';
const anchorIdx = css.indexOf(anchor);
if (anchorIdx === -1) {
  console.error('Insert anchor not found');
  process.exit(1);
}

css = css.slice(0, anchorIdx) + insertBlock + '\n\n' + css.slice(anchorIdx);
fs.writeFileSync(cssPath, css, 'utf8');
console.log('Inserted test1 coda pill CSS', insertBlock.length, 'chars');
