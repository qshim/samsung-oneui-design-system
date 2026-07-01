"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.neuehaas = exports.pretendardB = exports.pxGrotesk = exports.programme = void 0;

var _local = _interopRequireDefault(require("next/font/local"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var programme = (0, _local["default"])({
  src: "../fonts/Programme-Light.woff2",
  weight: "400",
  style: "normal",
  display: "swap"
});
exports.programme = programme;
var pxGrotesk = (0, _local["default"])({
  src: '../fonts/Px-Grotesk-Regular.woff2',
  // 경로 확인 (src 내부에서 접근)
  weight: '400',
  style: 'normal',
  display: 'swap'
});
exports.pxGrotesk = pxGrotesk;
var pretendardB = (0, _local["default"])({
  src: '../fonts/Pretendard-Bold.subset.woff',
  // 경로 확인 (src 내부에서 접근)
  weight: '400',
  style: 'normal',
  display: 'swap'
});
exports.pretendardB = pretendardB;
var neuehaas = (0, _local["default"])({
  src: '../fonts/NeueHaasGrotText-55Roman-Web.woff2',
  // 경로 확인 (src 내부에서 접근)
  weight: '400',
  style: 'normal',
  display: 'swap'
});
exports.neuehaas = neuehaas;