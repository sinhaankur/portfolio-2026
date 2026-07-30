"use client"

/**
 * Below-the-fold home sections, lazy-loaded.
 *
 * Each section is (a) code-split into its own JS chunk via next/dynamic and
 * (b) render-deferred via <LazyMount> until it nears the viewport. Together this
 * keeps the initial home payload to the hero + about, so first paint isn't
 * blocked by Works/marquee/footer JS.
 *
 * Static export friendly: dynamic() here defaults to ssr:true, so the sections
 * still prerender into the exported HTML for SEO; the win is deferred client JS.
 */

import dynamic from "next/dynamic"
import { LazyMount } from "./lazy-mount"

const Works = dynamic(() => import("./works").then((m) => m.Works))
// The Lab now lives on its own /lab page (linked from the navbar) rather than as
// a long home-scroll section. The standalone Usability home section + its nav
// were removed once its "how I work" role moved to the /framework page (Laws of
// UX & Cognition) — the long-form /usability guide + live engine still exist.
const TechMarquee = dynamic(() =>
  import("./tech-marquee").then((m) => m.TechMarquee),
)
const Footer = dynamic(() => import("./footer").then((m) => m.Footer))

export function HomeBelowFold() {
  return (
    <>
      <LazyMount minHeight={600} anchorId="works">
        <Works />
      </LazyMount>
      <LazyMount minHeight={200}>
        <TechMarquee />
      </LazyMount>
      <LazyMount minHeight={400} anchorId="contact">
        <Footer />
      </LazyMount>
    </>
  )
}
