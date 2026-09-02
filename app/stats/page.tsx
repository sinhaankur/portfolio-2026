import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { StatsDashboard } from "@/components/stats-dashboard"

// Owner-only analytics dashboard — never indexed, no sitemap entry. It reads
// from the private analytics-proxy Worker (stats-api.sinhaankur.com), which
// merges Cloudflare Web Analytics + GA4 behind a shared key held on-device.
export const metadata: Metadata = {
  title: "Stats",
  robots: { index: false, follow: false },
}

export default function StatsPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28 pb-24">
        <StatsDashboard />
      </main>
      <Footer />
    </>
  )
}
