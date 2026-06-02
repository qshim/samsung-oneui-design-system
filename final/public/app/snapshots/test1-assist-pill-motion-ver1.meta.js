/**
 * test1 작은 pillar UI (test1-assist-pill) intro motion — VER1 snapshot
 * Frozen: 2026-05-27 (git js @ fb5e325 era)
 *
 * Restore trigger phrases (user may say):
 * - "assist pill ver1 적용"
 * - "작은 pillar ver1 모션"
 * - "test1-assist-pill ver1 복원"
 */
window.__TEST1_ASSIST_PILL_MOTION_VER1 = {
  id: 'ver1',
  component: 'test1-assist-pill',
  scope: 'test1',

  layout: {
    rect: { x: 130, w: 127, h: 36 },
    gapBelowLottePx: 6,
    formula: 'test1PillY = test1LotteY + 72 + 6',
  },

  timingMs: {
    TEST1_INTRO_DELAY_MS: 3000,
    TEST1_LOTTE_INTRO_MS: 720,
    TEST1_PILL_AFTER_LOTTE_MS: 1300,
    TEST1_PILL_ANIM_MS: 3800,
    pillDelayFromCodaStart: 720 + 1300,
  },

  dataAttributes: {
    prep: 'data-test1-pill-prep',
    run: 'data-test1-pill-run',
    out: 'data-test1-pill-out',
    stackRun: 'data-test1-stack-run',
  },

  motionSummary: [
    '롯데마트(test1-now-bar) rise-in 0.72s 후 1.3s → pill-prep → pill-run',
    '36px 원 fade-in 0.532s → slide-left 1.14s → expand width 2.128s (1.672s부터)',
    'shell 회색→다크 2.128s, 아이콘 4개 순차 fade 3.8s',
    'stack 시 88px 아래 이동, pill-out blur fade 0.8s',
  ],

  restore: {
    cssIntroMarker: ['test1-assist-pill-motion-ver1:start', 'test1-assist-pill-motion-ver1:intro-end'],
    cssLifecycleMarker: ['test1-assist-pill-motion-ver1:lifecycle-start', 'test1-assist-pill-motion-ver1:end'],
    cssSnapshotFile: 'public/app/snapshots/test1-assist-pill-motion-ver1.snapshot.css',
    renderSnippetFile: 'public/app/snapshots/test1-assist-pill-motion-ver1.render.js.snippet',
    surfaceLayoutCase: "case 'test1-assist-pill'",
    jsFunctions: ['_runTest1PillIntro', '_armTest1PillDelay'],
    jsConstants: ['TEST1_PILL_AFTER_LOTTE_MS', 'TEST1_PILL_ANIM_MS', 'TEST1_LOTTE_INTRO_MS'],
  },
};
