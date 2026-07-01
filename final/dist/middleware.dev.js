"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.middleware = middleware;

var _server = require("next/server");

function middleware(request) {
  var response = _server.NextResponse.next(); // 모든 요청에 CORS 헤더 추가


  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}