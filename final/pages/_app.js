import "../styles/globals.css";
import "../styles/theme-page.css";
import "../styles/genui.css";
import { useEffect } from "react";import { mountDotStepsDecryptedText } from "../components/DotDecryptedMount";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    mountDotStepsDecryptedText({
      // Defaults (used if per-component overrides are not provided)
      animateOn: "view",
      clickMode: "once",
      encryptedClassName: "dot-decrypted-encrypted",
      useOriginalCharsOnly: true,

      // Per component tuning (tempo)
      steps: {
        speed: 70,
        sequential: true,
        revealDirection: "start",
        loopIntervalMs: 5000,
      },
      temp: {
        // very short text ("14") ends too fast in sequential mode
        speed: 55,
        maxIterations: 14,
        sequential: false,
        loopIntervalMs: 5000,
      },
      date: {
        speed: 70,
        sequential: true,
        revealDirection: "start",
        loopIntervalMs: 5000,
      },
    });
  }, []);

  return <Component {...pageProps} />;
}
