/**
 * PaneHop browser entrypoint.
 *
 * Purpose: mount the React application into the static `app.html` shell.
 *
 * Boundary: client-only. This file should stay thin and avoid business logic.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App.js";

const mount = document.getElementById("app");

if (!(mount instanceof HTMLElement)) {
  throw new Error("Missing app root");
}

createRoot(mount).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
