import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { Github, ExternalLink, Apple } from "lucide-react"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseList,
  CasePullQuote,
  CaseLessons,
  CaseNextLinks,
} from "@/components/case-study/case-study-layout"

export const metadata: Metadata = {
  ...canonicalPath("/lab/firmament"),
  title: "Firmament — the Universe Engine in your pocket",
  description:
    "A native iOS app that identifies the real sky and captures it. Point your iPhone up to name stars, planets and satellites, then shoot the night sky with a pro camera and an AI editor that recovers the real sky from a dark frame. On-device, offline, all-custom Swift. The field companion to the web Universe Engine.",
  keywords: [
    "night sky app",
    "astrophotography iPhone app",
    "AR star map",
    "satellite tracker app",
    "stargazing app",
    "iPhone astrophotography",
    "on-device AI camera",
    "Celestron telescope app",
  ],
}

type Feature = { name: string; body: string }

const modes: Feature[] = [
  {
    name: "Explore",
    body: "Hold the phone up: ~8,900 naked-eye stars, the planets, the Moon (with phase) and constellations label themselves, anchored to their true direction from your exact place and time. Aim the reticle at anything to identify it.",
  },
  {
    name: "Spot",
    body: "Real-time satellite tracking with a from-scratch SGP4 engine. It finds the closest satellite overhead and gives turn-by-turn direction — “turn right, look higher” — plus a countdown to the next visible ISS pass.",
  },
  {
    name: "Capture",
    body: "A pro night camera: manual or auto exposure to the sensor's real limits, manual focus with focus-peaking, a live histogram, guided zoom, ProRAW hero frames, long exposure via frame-stacking, and one-tap subject presets. A Pure Photography mode strips the star map for a clean frame.",
  },
  {
    name: "Edit",
    body: "Every capture — and any photo or time-lapse you import — opens in an editor that auto-develops it: it measures the exposure the shot was taken at and recovers the real night sky from what looks like a black frame, then explains it on-device via Apple Intelligence.",
  },
  {
    name: "Telescope",
    body: "Connect a Celestron computerized mount over its SkyPortal WiFi module and tap any object to point the telescope at it — a from-scratch Swift implementation of the NexStar protocol. Firmament is independent and unaffiliated with Celestron.",
  },
]

const platforms: { platform: string; state: string; body: string }[] = [
  {
    platform: "iOS",
    state: "Building",
    body: "iPhone 17 Pro is the reference device (LiDAR foreground + Pro cameras); runs on any iPhone on iOS 17+. Open source — clone and run it on your own device with a free Apple ID, or install via TestFlight (coming).",
  },
  {
    platform: "Android",
    state: "Planned",
    body: "A separate native app built against the same spec — ARCore + CameraX + platform depth. It shares Firmament's DESIGN.md and lives in the repo's android/ slot. Cross-platform is a roadmap commitment, tracked honestly, not a shipped claim.",
  },
]

export default function FirmamentPage() {
  return (
    <CaseStudyLayout
      eyebrow="The Lab · Field app"
      title="Firmament"
      subtitle="Point your iPhone at the real sky and understand it. Then capture it."
      period="2026 — ongoing"
      role="Designer + engineer · Ankur Sinha"
      tags={["Swift", "AVFoundation", "Apple Intelligence", "SGP4", "Celestron", "On-device"]}
      backTo={{ label: "Back to the Lab", href: "/lab" }}
      intro="Firmament is the native iOS companion to the web Universe Engine — a planetarium and a professional night camera in one. Everything runs on-device and offline; it's 100% custom Swift with no third-party libraries. Same north star as the engine: restore access to the real sky, faithfully and understandably — real over invented, reverence over spectacle."
    >
      <div className="flex flex-wrap gap-3 mb-12">
        <a
          href="https://github.com/sinhaankur/Firmament"
          data-cursor-hover
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:border-accent/60 transition-colors"
        >
          <Github className="h-4 w-4" /> Source on GitHub
        </a>
        <a
          href="https://sinhaankur.github.io/Firmament/"
          data-cursor-hover
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:border-accent/60 transition-colors"
        >
          <Apple className="h-4 w-4" /> Install page <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <CaseSectionHeading>What it does</CaseSectionHeading>
      <div className="grid gap-6 sm:grid-cols-2 mb-14">
        {modes.map((m) => (
          <div key={m.name} className="border border-border rounded-2xl p-6 bg-card">
            <h3 className="font-display text-xl mb-2 text-foreground">{m.name}</h3>
            <p className="font-sans text-sm text-foreground/75 leading-relaxed">{m.body}</p>
          </div>
        ))}
      </div>

      <CasePullQuote>
        The gap no other app fills: every stargazing app is “best for planning, not
        capturing,” and every astro-planner makes you shoot on a separate camera.
        Firmament does identify → capture → auto-develop in one place.
      </CasePullQuote>

      <CaseSectionHeading>How the sky is computed</CaseSectionHeading>
      <CaseProse>
        Positions ride on Apple's built-in frameworks for the observer frame —
        CoreLocation for place and true heading, CoreMotion for where the phone
        points — plus standard Meeus / JPL math for the bodies and a from-scratch
        SGP4 propagator for satellites, verified numerically against the ISS's real
        altitude and speed. Stars come from the HYG database (CC BY-SA). Accuracy is
        naked-eye pointing grade; where a value is inferred, the app says so.
      </CaseProse>

      <CaseSectionHeading>Built to a standard</CaseSectionHeading>
      <CaseList
        items={[
          "100% custom Swift — no third-party libraries; only Apple frameworks.",
          "On-device and private: no account, no analytics, no tracking. The one network call is an optional weather lookup.",
          "Two named engines — NightSkyEngine (astronomy) and CameraEngine (capture) — with pure, testable cores.",
          "Honest data: only reference sources are credited (HYG, Meeus, JPL, Celestron's public NexStar spec).",
        ]}
      />

      <CaseSectionHeading>Platforms</CaseSectionHeading>
      <div className="grid gap-6 sm:grid-cols-2 mb-14">
        {platforms.map((p) => (
          <div key={p.platform} className="border border-border rounded-2xl p-6 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-display text-xl text-foreground">{p.platform}</h3>
              <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 border border-border rounded-full text-foreground/70">
                {p.state}
              </span>
            </div>
            <p className="font-sans text-sm text-foreground/75 leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>

      <CaseSectionHeading>Why it matters</CaseSectionHeading>
      <CaseLessons
        lessons={[
          {
            title: "The field instrument",
            body: "It's the counterpart to the web engine's observatory — the same reverence, out under the actual sky.",
          },
          {
            title: "An unoccupied lane",
            body: "The capture-and-develop loop is genuinely unclaimed territory in the app market.",
          },
          {
            title: "On-device, end to end",
            body: "It proves you don't need the cloud to make something this capable — or this private.",
          },
        ]}
      />

      <CaseNextLinks
        prev={{ label: "The Lab", href: "/lab" }}
        next={{ label: "Universe Engine", href: "/lab/celestial" }}
      />
    </CaseStudyLayout>
  )
}
