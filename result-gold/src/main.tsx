import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Self-hosted fonts (bundled → work offline). Subsets: latin + vietnamese only.
import "@fontsource/big-shoulders-display/latin-700";
import "@fontsource/big-shoulders-display/vietnamese-700";
import "@fontsource/big-shoulders-display/latin-800";
import "@fontsource/big-shoulders-display/vietnamese-800";
import "@fontsource/big-shoulders-display/latin-900";
import "@fontsource/big-shoulders-display/vietnamese-900";
import "@fontsource/barlow-semi-condensed/latin-400";
import "@fontsource/barlow-semi-condensed/vietnamese-400";
import "@fontsource/barlow-semi-condensed/latin-500";
import "@fontsource/barlow-semi-condensed/vietnamese-500";
import "@fontsource/barlow-semi-condensed/latin-600";
import "@fontsource/barlow-semi-condensed/vietnamese-600";
import "@fontsource/barlow-semi-condensed/latin-700";
import "@fontsource/barlow-semi-condensed/vietnamese-700";

import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
