/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bake the build timestamp so the footer can show "last updated" per deploy.
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },

  // Static export so GitHub Pages can serve the built site directly.
  // The whole portfolio is genuinely static — no SSR, no API routes, no middleware —
  // so we don't lose anything by exporting.
  output: "export",

  // Pages serves from "/" on a custom domain (www.sinhaankur.com), so no basePath
  // or assetPrefix is needed. Add trailing slashes so /works/oracle resolves to
  // /works/oracle/index.html, which Pages serves cleanly.
  trailingSlash: true,

  images: {
    // next/image's loader needs a server. Static export has no server, so we
    // skip optimization. All <img> usage in this app is already plain <img> tags.
    unoptimized: true,
  },

  // Allow dev resources (HMR/assets) when opening the site from a phone on LAN.
  allowedDevOrigins: ["192.168.1.79", "localhost", "127.0.0.1"],

  // Tree-shake barrel-file libraries so a page only ships the icons/components it
  // actually uses, not the whole package. lucide-react especially is a large barrel
  // (1000+ icons) imported on nearly every page — this trims the shared bundle.
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@react-three/drei"],
  },

  // Turbopack alias map — stubs the Node-only `node:fs/promises` and
  // `node:path` imports that the Anthropic SDK pulls in transitively via
  // its managed-agents environment-worker namespace. The browser never
  // executes that code path (it's for self-hosted agent workers), but
  // the static import chain reaches it through the SDK's `Anthropic`
  // class constructor, and Turbopack's client bundle can't resolve a
  // bare `node:` scheme. Aliasing both to an empty module keeps the
  // bundle happy without losing any feature we actually use.
  turbopack: {
    resolveAlias: {
      "node:fs/promises": "./lib/empty.ts",
      "node:fs": "./lib/empty.ts",
      "node:path": "./lib/empty.ts",
      "node:os": "./lib/empty.ts",
      "node:child_process": "./lib/empty.ts",
      "node:stream": "./lib/empty.ts",
      "node:stream/promises": "./lib/empty.ts",
      "node:crypto": "./lib/empty.ts",
      "node:util": "./lib/empty.ts",
      "node:readline": "./lib/empty.ts",
    },
  },
}

export default nextConfig
