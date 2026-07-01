"use strict";
"use client";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useLanguageStore = void 0;

var _zustand = require("zustand");

var useLanguageStore = (0, _zustand.create)(function (set) {
  return {
    lang: "en",
    toggleLang: function toggleLang() {
      return set(function (state) {
        return {
          lang: state.lang === "ko" ? "en" : "ko"
        };
      });
    }
  };
});
exports.useLanguageStore = useLanguageStore;