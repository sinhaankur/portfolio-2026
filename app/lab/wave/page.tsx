"use client"

import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseList,
  CasePullQuote,
  CaseLessons,
} from "@/components/case-study/case-study-layout"
import { WaveVideo } from "@/components/wave-video"

export default function WavePage() {
  return (
    <CaseStudyLayout
      eyebrow="Lab · concept"
      title="Universe & Wave — the cosmos as one motion."
      subtitle="A concept film. The Universe Engine restores the real sky from measured data; this asks a different question — what does that same cosmos look like rendered as a single continuous wave, made with AI video at its current ceiling?"
      period="2026"
      role="Concept · AI video · direction"
      tags={["AI video", "Concept", "Universe Engine", "Motion"]}
      backTo={{ label: "Back to the Lab", href: "/lab" }}
      intro={
        <>
          <p>
            The <em>Universe Engine</em> elsewhere on this site is built from
            truth — real NASA/JPL positions, real star temperatures, real orbits.
            It renders the sky as it actually is. This is deliberately the other
            pole: a <strong>concept film</strong> that treats the whole cosmos as
            one flowing wave — gas, light, and gravity as a single motion — made
            with generative AI video pushed to the level it can now reach.
          </p>
          <p>
            Two poles, one instinct: understand a thing well enough to render it,
            whether the renderer is a shader fed by measured data or a video model
            fed by a clear idea. This page is where the real-data engine ends and
            generative video begins.
          </p>
        </>
      }
    >
      {/* The film */}
      <section>
        <CaseSectionHeading>The film</CaseSectionHeading>
        <CaseProse>
          <p>
            One continuous wave — the universe as a breathing surface rather than a
            field of points. Watch it move.
          </p>
        </CaseProse>
        <div className="mt-8">
          <WaveVideo caption="Universe & Wave — an AI-generated concept film. Cosmos rendered as one continuous motion." />
        </div>
      </section>

      {/* The concept */}
      <section>
        <CaseSectionHeading>The concept</CaseSectionHeading>
        <CaseProse>
          <p>
            The universe is usually drawn as objects in a void — stars here,
            galaxies there, space between. The wave concept flips that: the void
            <em> is</em> the medium, and everything in it is a disturbance
            travelling through — light as a wave, spacetime as a wave, matter as a
            standing pattern in the same field. Rendering it as one surface makes
            that legible in a way a starfield never does.
          </p>
        </CaseProse>
        <div className="mt-8">
          <CaseList
            items={[
              <>
                <strong>One field, not many objects.</strong> Instead of
                compositing separate elements, the film holds a single evolving
                surface — the eye reads it as continuous rather than assembled.
              </>,
              <>
                <strong>Motion carries the meaning.</strong> No labels, no HUD —
                the story is entirely in how the wave builds, breaks, and reforms.
                A companion to the engine&rsquo;s &ldquo;seeing is believing.&rdquo;
              </>,
              <>
                <strong>AI video at its ceiling.</strong> The point is to test how
                far a current generative model can hold a coherent, physical-feeling
                motion over a full shot — where it convinces, and where it still
                gives itself away.
              </>,
            ]}
          />
        </div>
        <CasePullQuote>
          The engine renders the universe as it is. The wave renders the universe
          as a feeling of what it is. Same subject, opposite tools — and the
          contrast is the point.
        </CasePullQuote>
      </section>

      {/* Where it sits */}
      <section>
        <CaseSectionHeading>Real data vs. generated motion</CaseSectionHeading>
        <CaseProse>
          <p>
            It matters to be honest about which is which. The Universe Engine is{" "}
            <strong>real</strong> — every body built from known measurements. This
            film is <strong>generated</strong> — a directed AI video, an
            interpretation, not a simulation. Keeping the two clearly separate is
            the whole discipline: never pass a generated image off as measured
            truth, and never let the data engine&rsquo;s rigor stop you from making
            something purely expressive next to it.
          </p>
        </CaseProse>
      </section>

      {/* Lessons */}
      <section>
        <CaseSectionHeading>What the concept is testing</CaseSectionHeading>
        <CaseLessons
          lessons={[
            {
              title: "Can AI video hold one coherent motion?",
              body: "A full shot of a single continuous wave is a hard ask for generative video — it's where models drift, morph, or lose physical plausibility. That failure boundary is exactly what's interesting to probe.",
            },
            {
              title: "Direction beats prompting.",
              body: "Getting to 'that level' is less about a clever prompt and more about treating it like film — a clear intent, a reference for the motion, and ruthless selection across takes.",
            },
            {
              title: "Two poles sharpen each other.",
              body: "Building the truthful engine makes the expressive film feel more honest, and making the film keeps the engine from becoming only a data readout. The site needs both.",
            },
          ]}
        />
      </section>

      {/* Note */}
      <section>
        <CaseProse>
          <p className="text-sm text-muted-foreground">
            A concept piece, clearly labelled as AI-generated video — companion to,
            not part of, the real-data Universe Engine. Drop the final film at{" "}
            <code>public/video/wave.mp4</code> (+ <code>.webm</code> and a{" "}
            <code>wave-poster.webp</code>) to replace the placeholder.
          </p>
        </CaseProse>
      </section>
    </CaseStudyLayout>
  )
}
