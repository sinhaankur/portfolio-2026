"use client"

import Link from "next/link"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseList,
  CasePullQuote,
  CaseLessons,
} from "@/components/case-study/case-study-layout"

export default function WavePage() {
  return (
    <CaseStudyLayout
      eyebrow="Lab · exploration"
      title="The Waves — how the sea changes, under a real sky."
      subtitle="An exploration to understand how waves change — driven by the same four forces the ocean actually obeys: the Moon (tides), the Sun, the wind, and climate. Real footage as reference; a procedural ocean we render ourselves, under an astronomically real sun and moon."
      period="2026"
      role="Built from scratch · real-time WebGL · sea astronomy"
      tags={["WebGL", "Ocean simulation", "Astronomy", "Real-time", "Exploration"]}
      backTo={{ label: "Back to the Lab", href: "/lab" }}
      intro={
        <>
          <p>
            It began with a minute of real footage — a wave breaking on a
            pebble shore, water glittering with sun. Every inch of it had
            detail, and I wanted to understand <em>why</em> the sea looks and
            moves the way it does. Not enhance the clip with an AI service, but
            build the thing myself — the ocean sibling of the Universe Engine.
          </p>
          <p>
            So there are two halves. A <strong>real sky</strong>, computed
            on-device: the sun rising and setting at its true azimuth, the moon
            at its real phase and position, a day&rarr;night gradient driven by
            the sun&rsquo;s actual altitude. And a{" "}
            <strong>procedural ocean</strong> — our own Gerstner-wave sea,
            rendered in the browser, driven by wind, and lit by that same real
            sun and moon. The footage is the reference; the engine is the piece.
          </p>
          <p>
            <Link href="/waves" className="font-medium underline underline-offset-4">
              Open the full-screen Waves experience &rarr;
            </Link>{" "}
            — real footage or the procedural engine, a day-scrubber, wind
            controls, and the wave-breaking sound. Or read{" "}
            <Link href="/waves/math" className="font-medium underline underline-offset-4">
              the math behind the waves
            </Link>{" "}
            — Gerstner waves, the Phillips wind spectrum, and the sun/moon
            ephemeris, shown beside the real code.
          </p>
        </>
      }
    >
      {/* The four forces */}
      <section>
        <CaseSectionHeading>What actually changes the waves</CaseSectionHeading>
        <CaseProse>
          <p>
            The point of the exploration is legibility — to <em>see</em> how each
            force moves the water, rather than take it on faith. Four forces, in
            order of how directly you feel them.
          </p>
        </CaseProse>
        <div className="mt-8">
          <CaseList
            items={[
              <>
                <strong>🌙 The Moon &mdash; tides.</strong> The Moon&rsquo;s
                gravity raises the tide. When the Sun lines up with it (new and
                full moon) you get the biggest range &mdash; a{" "}
                <em>spring tide</em>; at the quarters, the smallest &mdash; a{" "}
                <em>neap tide</em>. The engine computes the real phase and reports
                which you&rsquo;re in, right now.
              </>,
              <>
                <strong>☀︎ The Sun.</strong> It adds to (or cancels) the
                Moon&rsquo;s tidal pull, and it sets the light &mdash; the whole
                mood of the sea shifts from dawn to golden hour to night, tracked
                from the sun&rsquo;s real altitude.
              </>,
              <>
                <strong>💨 The Wind.</strong> This is what actually{" "}
                <em>makes</em> the waves. Stronger, longer, steadier wind &mdash;
                over more open water (fetch) &mdash; builds bigger, longer swell.
                In the engine, the wind sliders feed the Gerstner wave trains
                directly: turn the wind up and the sea grows.
              </>,
              <>
                <strong>🌍 Climate.</strong> Over seasons and years, storm tracks,
                sea temperature, and sea level shift the whole regime &mdash;
                calmer or wilder, higher or lower water. The slow force you only
                see by logging it.
              </>,
            ]}
          />
        </div>
        <CasePullQuote>
          The waves aren&rsquo;t random. They&rsquo;re the sum of the wind that
          made them and the sky that pulls them &mdash; and once you render that
          honestly, the sea becomes readable.
        </CasePullQuote>
      </section>

      {/* How it's built */}
      <section>
        <CaseSectionHeading>How it&rsquo;s built &mdash; ours, end to end</CaseSectionHeading>
        <CaseProse>
          <p>
            The sky is real astronomy: low-precision but genuine sun and moon
            ephemeris (altitude, azimuth, phase, illuminated fraction) computed
            on-device, no dependency &mdash; the same discipline as the Universe
            Engine. The ocean is a real-time <strong>Gerstner-wave</strong>{" "}
            surface: several wave trains summed on the GPU, each with its own
            direction, wavelength, and speed derived from the wind, with the
            analytic normal for exact lighting, a Fresnel sky reflection, a sharp
            specular glint from the real sun or moon, and foam where the crests
            steepen. Because it&rsquo;s geometry and shaders rather than a video
            file, it renders at any resolution &mdash; it&rsquo;s 8K-native.
          </p>
          <p>
            Alongside the real-time engine there&rsquo;s an offline,{" "}
            <strong>photoreal</strong> sibling &mdash; the same sea built in
            Blender with a physically-based ocean spectrum (Phillips), real wind
            and choppiness, foam on the crests, and a craggy pebble shore,
            rendered in Cycles under a multiple-scattering sky that carries the
            light from sunrise through sunset to a star-filled night. It&rsquo;s
            where the fidelity ceiling lives.
          </p>
        </CaseProse>
        <figure className="mt-8 overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/waves-ocean-render.webp"
            alt="Photoreal ocean rendered in Blender Cycles — deep blue-green sea with foam-capped waves breaking near a craggy pebble shore, under a low sun."
            className="w-full"
            loading="lazy"
          />
          <figcaption className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            The photoreal sibling &mdash; Phillips-spectrum ocean, Cycles, our own scene.
          </figcaption>
        </figure>
      </section>

      {/* Lessons */}
      <section>
        <CaseSectionHeading>What the exploration is really about</CaseSectionHeading>
        <CaseLessons
          lessons={[
            {
              title: "Build our own, don't rent a black box.",
              body: "The instinct wasn't to feed the clip to an AI enhancer, but to understand the sea well enough to render it ourselves. That's the whole site's ethos — own the underlying thing.",
            },
            {
              title: "Real forces make it legible.",
              body: "Tie the water to the actual wind and the actual sky, and it stops being decoration and starts being an instrument for seeing how the ocean works.",
            },
            {
              title: "Footage is reference, not the product.",
              body: "The real minute of waves is priceless as ground truth to tune against — but the thing that ships is the engine, because that's the part we can keep, control, and re-render forever.",
            },
          ]}
        />
      </section>

      {/* Note */}
      <section>
        <CaseProse>
          <p className="text-sm text-muted-foreground">
            The real footage was shot by hand; the sky is computed from real
            ephemeris and the ocean is our own real-time simulation. Nothing here
            is generated by an outside AI-video service &mdash; where the real sea
            ends and our engine begins is always clear.
          </p>
        </CaseProse>
      </section>
    </CaseStudyLayout>
  )
}
