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
  // Known EMAIL-HARVESTERS, scrapers, SEO-spy + aggressive data-mining bots that
  // add nothing for a human visitor. Polite ones honour this Disallow; it won't
  // stop the truly malicious (the runtime email obfuscation handles those), but
  // it keeps the well-behaved harvesters and bandwidth-wasters off the site.
  const blockedBots = [
    "EmailCollector", "EmailSiphon", "EmailWolf", "ExtractorPro", "Harvest",
    "WebEMailExtrac", "EmailMiner", "ChinaClaw", "SiteSnagger", "WebZIP",
    "WebCopier", "WebStripper", "Teleport", "TeleportPro", "WebReaper",
    "SemrushBot", "AhrefsBot", "MJ12bot", "DotBot", "DataForSeoBot",
    "Bytespider", "PetalBot", "SeekportBot", "Scrapy", "python-requests",
    "magpie-crawler", "serpstatbot", "BLEXBot", "ZoominfoBot", "LinkpadBot",
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
      // the same allowance, named explicitly for each GOOD AI crawler (keeps the
      // portfolio surfaced in AI answers + search — discoverability we want).
      ...aiBots.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/games/assets/"],
      })),
      // known harvesters / scrapers / SEO-spy bots → blocked entirely.
      ...blockedBots.map((userAgent) => ({
        userAgent,
        disallow: ["/"],
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
