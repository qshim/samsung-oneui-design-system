import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inter with the FULL weight range (100..900) — uses the variable
            font slice so per-char weight animations interpolate smoothly
            instead of snapping between 300→400→500 etc. Required for the
            ReactBits-style proximity sweep on the Jogging prompt banner. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
        {/* Leaflet — drives the navigation circle on the test3 Running
            Now goal card. Tile source is CartoDB DarkMatter (free, no
            API key); CSS filter in theme-page.css adds the navy-blue
            tint to match the rest of the persona-3 aesthetic. */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <script
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
          crossOrigin=""
          defer
        ></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
