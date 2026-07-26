import type { MetadataRoute } from "next"
import { SHORT_POSTS } from "@/lib/writing-posts"

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
    { path: "/lab",               priority: 0.9, changeFrequency: "weekly"  },
    { path: "/lab/unhosted",      priority: 0.9, changeFrequency: "weekly"  },
    { path: "/lab/cognitive-twin",priority: 0.8, changeFrequency: "weekly"  },
    { path: "/works/oracle",      priority: 0.8, changeFrequency: "monthly" },
    { path: "/works/deloitte",    priority: 0.8, changeFrequency: "monthly" },
    { path: "/works/snowtint",    priority: 0.8, changeFrequency: "monthly" },
    { path: "/works/rage",        priority: 0.8, changeFrequency: "monthly" },
    { path: "/lab/celestial",     priority: 0.7, changeFrequency: "monthly" },
    { path: "/lab/big-bang",      priority: 0.7, changeFrequency: "monthly" },
    { path: "/lab/brainrot",      priority: 0.6, changeFrequency: "monthly" },
    { path: "/lab/usability-engine", priority: 0.7, changeFrequency: "monthly" },
    { path: "/lab/optical-flow",  priority: 0.7, changeFrequency: "monthly" },
    { path: "/lab/helion-drift",  priority: 0.6, changeFrequency: "monthly" },
    { path: "/skills",            priority: 0.7, changeFrequency: "monthly" },
    { path: "/writing",           priority: 0.7, changeFrequency: "weekly"  },
    { path: "/writing/universe-engine", priority: 0.7, changeFrequency: "monthly" },
    { path: "/usability",         priority: 0.6, changeFrequency: "monthly" },
    { path: "/upcoming",          priority: 0.5, changeFrequency: "weekly"  },
    { path: "/ar",                priority: 0.6, changeFrequency: "monthly" },
    { path: "/ja",                priority: 0.6, changeFrequency: "monthly" },
    { path: "/games/dave-3d",     priority: 0.5, changeFrequency: "monthly" },
    { path: "/universe-engine/math", priority: 0.6, changeFrequency: "monthly" },
    { path: "/academic/p2p-streaming", priority: 0.4, changeFrequency: "monthly" },
    { path: "/academic/rubik-cube", priority: 0.4, changeFrequency: "monthly" },
    { path: "/references",        priority: 0.5, changeFrequency: "monthly" },
    { path: "/dna",               priority: 0.6, changeFrequency: "monthly" },
    { path: "/dna/databases",     priority: 0.4, changeFrequency: "monthly" },
    { path: "/dna/tools",         priority: 0.4, changeFrequency: "monthly" },
    { path: "/dna/how-it-works",  priority: 0.5, changeFrequency: "monthly" },
    // Short posts are generated from lib/writing-posts.ts — kept in sync here.
    ...SHORT_POSTS.map((p) => ({
      path: `/writing/${p.slug}`,
      priority: 0.6,
      changeFrequency: "monthly" as const,
    })),
  ]

  // Emit trailing slashes to match `trailingSlash: true` (and the per-page
  // canonicals). Without this, Google requests the slash-less sitemap URL, hits
  // a 301 → trailing-slash URL, and excludes it as "Page with redirect" — which
  // is exactly what kept these pages out of the index.
  const withSlash = (p: string) => (p === "/" || p.endsWith("/") ? p : `${p}/`)

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${withSlash(path)}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
