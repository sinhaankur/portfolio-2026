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
}

export default nextConfig
