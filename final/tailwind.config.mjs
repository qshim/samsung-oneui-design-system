export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      screens: {
        "3xl": "1920px",
        "4xl": "2560px",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primaryC: "rgba(93,0,156,1)",
        primaryB: "#0f0f13",
        primaryW: "#f0f0ec",
      },
      fontSize: {
        "xs-": "0.625rem", // 11px (xs보다 작음)
        "sm+": "0.875rem", // 14px (sm와 base 사이)
        "base+": "0.9375rem", // 15px (sm와 base 사이)
      },
      fontFamily: {
        founders: ["FoundersGroteskMono", "monospace"],
        vtfvictorianna: ["VTFvictoriannaThin", "sans-serif"],
        tinygothic: ["TinyGothic", "sans-serif"],
        pretendard: ["Pretendard", "sans-serif"],
        dmmono: ['"DM Mono"', 'monospace'], 
      },
    },
  },
  plugins: [
    require("tailwind-scrollbar-hide"),
    function ({ addUtilities }) {
      addUtilities({
        ".font-salt": {
          fontFeatureSettings: '"salt" 1',
        },
      });
    },
  ],
};
