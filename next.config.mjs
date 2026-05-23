/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so GitHub Pages can serve the built site directly.
  // The whole portfolio is genuinely static — no SSR, no API routes, no middleware —
  // so we don't lose anything by exporting.
  output: "export",

  // Pages serves from "/" on a custom domain (www.sinhaankur.com), so no basePath
  // or assetPrefix is needed. Add trailing slashes so /works/oracle resolves to
  // /works/oracle/index.html, which Pages serves cleanly.
  trailingSlash: true,

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    // next/image's loader needs a server. Static export has no server, so we
    // skip optimization. All <img> usage in this app is already plain <img> tags.
    unoptimized: true,
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
