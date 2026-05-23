/**
 * TypographyRules — 디자인 토큰 기반 폰트 스타일 단일 진입점
 * -----------------------------------------------------------------------------
 * 모든 UI 컴포넌트는 이 모듈의 buildTypographyStyle()으로 인라인 font-* 를
 * 만들도록 정렬합니다. 새 정책은 이 파일의 상수·registerPostTypographyRule 에만 추가합니다.
 *
 * 브라우저: TypographyRules 글로벌 (genui.html 에 generator.js 보다 위에 로드)
 * Node: require('./typography-rules')
 */

(function (global) {
  'use strict';

  /** UI 일반 카피·라벨 최소 글자 크기(px). 시계 숫자(hero)·스테이터스바는 별도. */
  var MIN_UI_FONT_PX = 14;

  /**
   * design_rules typography._sizeTierMap 과 병합되는 기본 티어.
   * JSON에 키가 있으면 JSON이 우선.
   */
  var DEFAULT_SIZE_TIER_MAP = {
    micro: 'meta',
    caption: 'meta',
    label: 'label',
    body: 'body',
    title: 'title',
    heading: 'title',
    large: 'display',
    date: 'display',
    headline: 'display',
    'display-md': 'display',
    'display-lg': 'display',
    'display-xl': 'display',
    hero: 'hero'
  };

  /** design_rules typography 슬라이스가 비었을 때 (첫 페인트·테스트용) */
  var MINIMAL_FALLBACK_TYPOGRAPHY = {
    family: { system: "'One UI Sans APP VF', Inter, system-ui, sans-serif",
      clock: "'Space Grotesk', Inter, system-ui, sans-serif" },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    size: {
      micro: 14, caption: 14, label: 16, body: 18, title: 20, heading: 22,
      large: 24, date: 24, headline: 26, hero: 112
    },
    color: {
      primary: '#FFFFFF',
      secondary: '#CFCCCF',
      statusBar: 'rgba(255,255,255,0.8)',
      heading: '#EFEEF2',
      widgetLabel: 'rgba(255,255,255,0.86)',
      sectionLabel: 'rgba(255,255,255,0.5)',
      translucentLabel: 'rgba(255,255,255,0.75)'
    },
    lineHeight: { hero: 82, body: 24, title: 28, display: 32 },
    letterSpacing: {
      none: 0, statusCarrier: 0.15, sectionUppercase: 0.4, micro: 0.1, small: 0.15
    },
    typeScale: {
      display: { lineHeightPx: 32, letterSpacingPx: 0 },
      title:   { lineHeightPx: 28, letterSpacingPx: 0 },
      body:    { lineHeightPx: 24, letterSpacingPx: 0 },
      label:   { lineHeightPx: 22, letterSpacingPx: 0 },
      meta:    { lineHeightPx: 18, letterSpacingPx: 0.1 }
    },
    _sizeTierMap: {}
  };

  /** buildTypographyStyle() 직후 문자열 패치 용 후처리 (여기에만 새 룰 추가) */
  var _POST_TYPOGRAPHY_RULES = [];

  function registerPostTypographyRule(fn) {
    if (typeof fn === 'function') _POST_TYPOGRAPHY_RULES.push(fn);
  }

  function _mergeTierMap(slice) {
    var fromJson = slice && slice._sizeTierMap && typeof slice._sizeTierMap === 'object'
      ? slice._sizeTierMap
      : {};
    var merged = {};
    var k;
    for (k in DEFAULT_SIZE_TIER_MAP) merged[k] = DEFAULT_SIZE_TIER_MAP[k];
    for (k in fromJson) {
      if (/^_/.test(k)) continue;
      if (typeof fromJson[k] === 'string') merged[k] = fromJson[k];
    }
    return merged;
  }

  /**
   * @param {object} typographySlice — design_rules.typography 또는 MINIMAL_FALLBACK_TYPOGRAPHY
   * @param {string} sizeKey — micro·body·heading·hero …
   * @param {{ weight?: string, family?: string, color?: string, lineHeight?: string|number,
   *           letterSpacing?: string|number, letterSpacingToken?: string,
   *           typeTier?: string, allowBelowMin?: boolean }} options
   */
  function buildTypographyStyle(typographySlice, sizeKey, options) {
    var r = typographySlice || MINIMAL_FALLBACK_TYPOGRAPHY;
    var o = options || {};

    var family = o.family === 'clock'
      ? (r.family && r.family.clock) || MINIMAL_FALLBACK_TYPOGRAPHY.family.clock
      : (r.family && r.family.system) || MINIMAL_FALLBACK_TYPOGRAPHY.family.system;

    var weightKey = o.weight || 'regular';
    var weight = r.weight && r.weight[weightKey];
    if (weight == null) weight = MINIMAL_FALLBACK_TYPOGRAPHY.weight.regular;

    var sizeTable = r.size || {};
    var pxRaw = sizeTable[sizeKey];
    var fallbackBody = typeof sizeTable.body === 'number' ? sizeTable.body : 18;
    var px = typeof pxRaw === 'number' ? pxRaw : fallbackBody;

    if (sizeKey !== 'hero' && !o.allowBelowMin && px < MIN_UI_FONT_PX) {
      px = MIN_UI_FONT_PX;
    }

    var tierMap = _mergeTierMap(r);
    var tier = o.typeTier || tierMap[sizeKey];

    if (!tier || tier === 'hero') {
      tier = (sizeKey === 'hero') ? 'hero' : 'body';
    }
    if (tier === 'hero' && sizeKey !== 'hero') {
      tier = 'body';
    }

    var ts = r.typeScale || {};
    var tsRow = (tier === 'hero') ? null : ts[tier];

    var lh;
    if (o.lineHeight != null) {
      lh = typeof o.lineHeight === 'number' ? o.lineHeight + 'px' : o.lineHeight;
    } else if (sizeKey === 'hero' && r.lineHeight != null && r.lineHeight.hero != null) {
      lh = r.lineHeight.hero + 'px';
    } else if (tsRow != null && typeof tsRow.lineHeightPx === 'number') {
      lh = tsRow.lineHeightPx + 'px';
    } else {
      lh = 'normal';
    }

    var ls;
    if (o.letterSpacing != null) {
      ls = typeof o.letterSpacing === 'number' ? o.letterSpacing + 'px' : o.letterSpacing;
    } else if (o.letterSpacingToken && r.letterSpacing && typeof r.letterSpacing === 'object') {
      var tok = r.letterSpacing[o.letterSpacingToken];
      ls = typeof tok === 'number' ? tok + 'px' : (tok != null ? String(tok) : '0px');
    } else if (sizeKey === 'hero') {
      var nHero = r.letterSpacing && r.letterSpacing.none != null ? r.letterSpacing.none : 0;
      ls = nHero + 'px';
    } else if (tsRow != null && tsRow.letterSpacingPx != null) {
      ls = tsRow.letterSpacingPx + 'px';
    } else {
      var nNone = r.letterSpacing && r.letterSpacing.none != null ? r.letterSpacing.none : 0;
      ls = nNone + 'px';
    }

    var color = o.color ? ((r.color && r.color[o.color]) || o.color) : (r.color && r.color.primary) || '#FFFFFF';

    var style = 'font-family:' + family + ';font-weight:' + weight + ';font-size:' + px +
      'px;line-height:' + lh + ';letter-spacing:' + ls + ';color:' + color + ';';

    for (var i = 0; i < _POST_TYPOGRAPHY_RULES.length; i++) {
      style = (_POST_TYPOGRAPHY_RULES[i])(style, r, sizeKey, o) || style;
    }
    return style;
  }

  /** layoutRhythm 카드키 → spacing 토큰 px 문자열 (예: '6px'). */
  function layoutRhythmPx(fullDesignRules, rhythmKey) {
    if (!fullDesignRules) return null;
    var lr = fullDesignRules.layoutRhythm;
    if (!lr) return null;
    var sp = lr[rhythmKey];
    var map = fullDesignRules.spacing || {};
    if (!sp || map[sp] == null) return null;
    return map[sp] + 'px';
  }

  var TypographyRules = {
    MIN_UI_FONT_PX: MIN_UI_FONT_PX,
    DEFAULT_SIZE_TIER_MAP: DEFAULT_SIZE_TIER_MAP,
    MINIMAL_FALLBACK_TYPOGRAPHY: MINIMAL_FALLBACK_TYPOGRAPHY,
    buildTypographyStyle: buildTypographyStyle,
    registerPostTypographyRule: registerPostTypographyRule,
    layoutRhythmPx: layoutRhythmPx
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TypographyRules;
  }
  global.TypographyRules = TypographyRules;
})(typeof self !== 'undefined' ? self : this);
