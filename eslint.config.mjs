import { defineConfig } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

export default defineConfig([
  {
    // Only lint the live site — parked/side projects have their own tooling.
    ignores: [
      "archive/**",
      "out/**",
      "nomi-desktop/**",
      "webos-tv/**",
      "webos-tv-720p/**",
      "webos-assets/**",
      "Xwing/**",
      "blender/**",
      "interview-prep/**",
      "public/**",
    ],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Prose-heavy site: raw apostrophes/quotes in JSX copy are fine.
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      // React Compiler-era correctness lints. The R3F scenes intentionally use
      // procedural randomness + ref mutation during render (memoized scatter
      // fields, imperative three.js updates), so these stay visible as
      // warnings instead of blocking errors. rules-of-hooks stays an error.
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
])
