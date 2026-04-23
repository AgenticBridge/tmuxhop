/**
 * tmuxhop test runner configuration.
 *
 * Purpose: keep Vitest rooted at the repository so server and shared tests are
 * discovered even though the Vite client build uses `src/client` as its root.
 *
 * Boundary: test tooling only.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
