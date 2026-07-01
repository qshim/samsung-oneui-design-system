"use client";

import { create } from "zustand";

export const useLanguageStore = create((set) => ({
  lang: "en",
  toggleLang: () =>
    set((state) => ({ lang: state.lang === "ko" ? "en" : "ko" })),
}));
