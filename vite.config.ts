import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

// GitHub Pages serves this repo at /half-pipe/ (a project page, not
// angrytongan.github.io itself), so built asset URLs need that prefix — but
// only in CI, so local dev/preview stay at the root.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/half-pipe/" : "/",
  plugins: [tailwindcss()],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
