import type { MetadataRoute } from "next"

// Required for `output: "export"` — tells Next.js to render this at build time.
export const dynamic = "force-static"

const SITE_URL = "https://www.sinhaankur.com"

/**
 * Static sitemap.
 *
 * Routes are hand-listed because the site uses Next.js's static export
 * (`output: "export"`); dynamic discovery via filesystem walking is unnecessary
 * for a portfolio of this size and would only add a moving part.
 *
 * Update this list when you add a new top-level route.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  const routes: { path: string; priority: number; changeFrequency: "monthly" | "weekly" }[] = [
    { path: "/",                  priority: 1.0, changeFrequency: "monthly" },
    { path: "/lab/unhosted",      priority: 0.9, changeFrequency: "weekly"  },
    { path: "/works/oracle",      priority: 0.8, changeFrequency: "monthly" },
    { path: "/works/deloitte",    priority: 0.8, changeFrequency: "monthly" },
    { path: "/works/snowtint",    priority: 0.8, changeFrequency: "monthly" },
    { path: "/works/rage",        priority: 0.8, changeFrequency: "monthly" },
    { path: "/skills",            priority: 0.7, changeFrequency: "monthly" },
    { path: "/usability",         priority: 0.6, changeFrequency: "monthly" },
    { path: "/upcoming",          priority: 0.5, changeFrequency: "weekly"  },
  ]

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
