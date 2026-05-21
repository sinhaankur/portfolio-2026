import type { MetadataRoute } from "next"

export const dynamic = "force-static"

const SITE_URL = "https://www.sinhaankur.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The retro games index is a self-contained sub-site — let crawlers
        // see the index page but not chase every individual game asset.
        disallow: ["/games/assets/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
