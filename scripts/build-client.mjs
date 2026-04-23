import { build } from "esbuild";

await build({
  bundle: true,
  entryPoints: ["src/client/app.ts"],
  format: "iife",
  outfile: "public/app.js",
  platform: "browser",
  sourcemap: true,
  target: ["es2022"],
});
