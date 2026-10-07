import type { MetadataRoute } from "next"

export const dynamic = "force-static"

const SITE_URL = "https://www.sinhaankur.com"

export default function robots(): MetadataRoute.Robots {
  // AI-SEO: explicitly WELCOME the AI search + answer crawlers so the tools get
  // surfaced in ChatGPT / Claude / Perplexity / Gemini / Apple Intelligence
  // answers (many respect robots and skip sites that don't name them). This is a
  // public portfolio meant to be found and used — nothing to hide from AI readers.
  const aiBots = [
    "GPTBot", "OAI-SearchBot", "ChatGPT-User",     // OpenAI
    "ClaudeBot", "Claude-Web", "anthropic-ai",     // Anthropic
    "PerplexityBot", "Perplexity-User",            // Perplexity
    "Google-Extended",                              // Gemini / Google AI
    "Applebot-Extended",                            // Apple Intelligence
    "Amazonbot", "cohere-ai", "YouBot", "Meta-ExternalAgent",
  ]
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The retro games index is a self-contained sub-site — let crawlers
        // see the index page but not chase every individual game asset.
        disallow: ["/games/assets/"],
      },
      // the same allowance, named explicitly for each AI crawler
      ...aiBots.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/games/assets/"],
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
