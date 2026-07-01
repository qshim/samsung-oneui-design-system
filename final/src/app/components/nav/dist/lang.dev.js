"use strict";
"use client";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = LanguageToggle;

var _languageStore = require("@/app/store/languageStore");

function LanguageToggle() {
  var _useLanguageStore = (0, _languageStore.useLanguageStore)(),
      lang = _useLanguageStore.lang,
      toggleLanguage = _useLanguageStore.toggleLanguage;
}