import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { Container } from "@/components/container"
import { MirofishView } from "@/components/mirofish/mirofish-content"
import { MirofishDashboard } from "@/components/mirofish/dashboard"
import type { MirofishContent, MirofishDashboard as DashboardData } from "@/lib/mirofish"
import mirofishContent from "@/content/mirofish.json"
import mirofishDashboard from "@/content/mirofish-dashboard.json"

// Unlisted project page — shared by direct link, kept out of nav, the sitemap,
// and search indexes. (It's public, just not surfaced.)
export const metadata: Metadata = {
  title: "Mirofish · Claude → TradingView MCP bridge",
  robots: { index: false, follow: false },
}

export default function MirofishPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-28 pb-24">
        <Container>
          <MirofishDashboard data={mirofishDashboard as DashboardData} />
          <MirofishView content={mirofishContent as MirofishContent} />
        </Container>
      </main>
      <Footer />
    </>
  )
}
