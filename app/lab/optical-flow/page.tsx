"use client"

import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseList,
  CasePullQuote,
  CaseLessons,
} from "@/components/case-study/case-study-layout"
import { RevealCanvas } from "@/components/optical-flow/reveal-canvas"

export default function OpticalFlowPage() {
  return (
    <CaseStudyLayout
      eyebrow="Lab · experiment"
      title="Optical Flow — watching yourself become data."
      subtitle="Two classic computer-vision algorithms — Shi-Tomasi feature detection and Lucas-Kanade optical flow — ported by hand to TypeScript and run live on your camera. No OpenCV, no WASM, no server."
      period="2026"
      role="Built from scratch · client-side CV"
      tags={["Computer vision", "TypeScript", "Canvas", "Real-time"]}
      backTo={{ label: "Back to the Lab", href: "/lab" }}
      intro={
        <>
          <p>
            I saw the effect on a video — a person dissolving into a cloud of
            tracked dots that flow with their motion — and wanted to understand
            it by rebuilding it. The original was done offline in Python with
            OpenCV, frames handled as NumPy arrays. This is the same two
            algorithms, but ported to plain TypeScript so the whole pipeline
            runs in your browser, in real time, on the frame coming off your
            camera.
          </p>
          <p>
            First, how it works. Then — if you want to see it run on your own
            motion — a button drops you into the live camera version.
          </p>
        </>
      }
    >
      {/* How it works — explained FIRST, before asking for any camera access */}
      <section>
        <CaseSectionHeading>How it actually works</CaseSectionHeading>
        <CaseProse>
          <p>
            Two well-established algorithms, composed. Search either name and
            you&rsquo;ll find decades of literature — they&rsquo;re textbook
            computer vision, which is exactly why they were fun to implement from
            the math rather than call as a library. The original ran offline in
            Python with OpenCV, frames handled as NumPy arrays; I ported the same
            two algorithms to TypeScript so they run live in the browser.
          </p>
        </CaseProse>

        <div className="mt-8">
          <CaseList
            items={[
              <>
                <strong>1 · Shi-Tomasi, &ldquo;Good Features to Track.&rdquo;</strong>{" "}
                For every pixel I build the 2×2 structure tensor of the local
                image gradients, and score the spot by the{" "}
                <em>smaller of its two eigenvalues</em>. A high minimum
                eigenvalue means the patch changes in <em>both</em> directions —
                a corner, something trackable. The strongest scores, spaced out
                by a minimum distance, become the dots.
              </>,
              <>
                <strong>2 · Lucas-Kanade optical flow.</strong> To move each dot
                to the next frame I assume its little window shifts by a single
                motion vector, and solve the 2×2 normal equations for that
                vector from the spatial and temporal gradients. I run it{" "}
                <em>pyramidally</em> — coarse-to-fine over a downsampled image
                stack — so it catches large, fast motion as well as small drift.
              </>,
              <>
                <strong>3 · Replenish + render.</strong> Points that drift
                off-frame or fail the solve get dropped; Shi-Tomasi re-seeds the
                field so it stays alive. Everything runs on a downscaled
                grayscale copy of the frame for speed, then the surviving points
                are drawn — aged by how long they&rsquo;ve been tracked — onto
                the display canvas.
              </>,
            ]}
          />
        </div>

        <CasePullQuote>
          The dots aren&rsquo;t a particle effect chasing your silhouette.
          They&rsquo;re real corners the algorithm chose, moved by real measured
          flow. The aesthetic is a side effect of the math being correct.
        </CasePullQuote>

        <CaseProse>
          <p>
            One thing I haven&rsquo;t tried, but suspect would get a related
            look by a completely different route, is{" "}
            <strong>Gaussian splatting</strong> — methodologically a different
            world (it reconstructs a scene as a field of 3D Gaussians rather than
            tracking sparse 2D features). Noted as a future experiment.
          </p>
        </CaseProse>
      </section>

      {/* Try it live — opt-in, button-gated; nothing touches the camera until clicked */}
      <section>
        <CaseSectionHeading>Try it live</CaseSectionHeading>
        <CaseProse>
          <p>
            Now the payoff. The dots below will be real feature points the
            algorithm chooses, moved by real optical flow — not a particle
            effect chasing your silhouette. Move around; adjust the density and
            palette (I took the same liberties with both that the original
            author did). There&rsquo;s no canned clip — it&rsquo;s your own
            motion becoming tracked data.
          </p>
        </CaseProse>
        <div className="mt-8">
          <RevealCanvas />
        </div>
      </section>

      {/* What I took from it */}
      <section>
        <CaseSectionHeading>What rebuilding it taught me</CaseSectionHeading>
        <CaseLessons
          lessons={[
            {
              title: "Porting forces understanding the library hides.",
              body: "Calling cv2.goodFeaturesToTrack teaches you nothing. Writing the structure tensor and the min-eigenvalue test by hand is where it actually clicks.",
            },
            {
              title: "Real-time changes every decision.",
              body: "Offline in Python you can be lavish. In a browser RAF loop you fight for every millisecond — downscaled frames, a shallow pyramid, capped point counts. The constraint is the design.",
            },
            {
              title: "The beauty was never the goal — it's a byproduct.",
              body: "The effect looks good because the tracking is honest. The same instinct runs through the rest of this site: get the underlying thing right and let the surface follow.",
            },
          ]}
        />
      </section>

      {/* Credit */}
      <section>
        <CaseProse>
          <p className="text-sm text-muted-foreground">
            Inspired by an effect I saw demonstrated on Instagram, where the
            author described their offline Python/OpenCV approach (Shi-Tomasi +
            Lucas-Kanade, frames as NumPy arrays). This is my own from-scratch,
            real-time, in-browser reimplementation of those same two classic
            algorithms.
          </p>
        </CaseProse>
      </section>
    </CaseStudyLayout>
  )
}
