import { defineConfig } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

export default defineConfig([
  {
    // Only lint the live site — parked/side projects have their own tooling.
    ignores: [
      "archive/**",
      "out/**",
      ".next/**",
      // Python virtualenv — bundled vendor JS (tensorboard/matplotlib/torch)
      // is NOT our source and produces dozens of false errors when crawled.
      ".venv/**",
      "webos-tv/**",
      "webos-tv-720p/**",
      "webos-assets/**",
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
      // Unused vars are real dead code — but a leading underscore marks a
      // deliberately-kept parameter (documents a callback signature).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // React Compiler-era lints, OFF: this codebase doesn't use the compiler,
      // and every hit was a deliberate idiom, not a bug — the R3F scenes mutate
      // three.js objects and read module refs by design (frame-loop code, see
      // ENGINE-ARCHITECTURE.md), and the DOM components use the standard
      // Next.js SSR mount-gate (setMounted(true) in an effect). At ~440
      // permanent warnings they buried real signal. The rules that catch
      // actual bugs stay on: rules-of-hooks (error), exhaustive-deps, and
      // set-state-in-render.
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/globals": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/static-components": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // Static export (`output: "export"`) serves images as-is — next/image
      // adds no optimization there, so plain <img> is the deliberate choice.
      "@next/next/no-img-element": "off",
    },
  },
])
