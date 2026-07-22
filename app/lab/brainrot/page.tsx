"use client"

import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseList,
  CasePullQuote,
  CaseLessons,
} from "@/components/case-study/case-study-layout"
import { BrainRotDemo } from "@/components/brainrot/brainrot-demo"

export default function BrainRotPage() {
  return (
    <CaseStudyLayout
      eyebrow="Lab · WIP"
      title="BrainRot — see your feed's bias."
      subtitle="A browser extension that scans the sentiment of what you scroll and mirrors the algorithm's hidden bias back to you. Reverse Bias: the feed's bias is invisible by design — BrainRot makes it visible. On-device, private."
      period="2026 · WIP"
      role="Idea · engine · extension · design"
      tags={["Browser extension", "On-device", "Sentiment", "Media literacy"]}
      backTo={{ label: "Back to the Lab", href: "/lab" }}
      intro={
        <>
          <p>
            Every feed is biased — not accidentally, but by design. An algorithm
            decides what to show you, tuned to one thing: keep you scrolling. It
            learns which emotions hold your attention and feeds you more of them.
            That bias is invisible; you just feel like you&apos;re choosing.
          </p>
          <p>
            <strong>BrainRot reverses that.</strong> It reads the sentiment of
            each post you scroll and reflects the pattern back — the topics
            you&apos;re boxed into, the emotions being used to hold you, the
            manipulation techniques in play. Not to judge you; to let you{" "}
            <em>see</em> what&apos;s being done to you.
          </p>
        </>
      }
    >
      <CaseSectionHeading>Try it</CaseSectionHeading>
      <CaseProse>
        <p>
          Paste a chunk of your feed (posts one per line), or a whole news
          article. BrainRot detects which it is and applies the right lens — an
          algorithmic mirror for a feed, an editorial mirror for an article. It
          runs entirely in your browser; nothing you paste is sent anywhere.
        </p>
      </CaseProse>

      <BrainRotDemo />

      <CaseSectionHeading>Two kinds of bias</CaseSectionHeading>
      <CaseProse>
        <p>
          A social feed and a news portal are different bias problems, so
          BrainRot reads them differently:
        </p>
      </CaseProse>
      <CaseList
        items={[
          <>
            <strong>Feed mode</strong> — the bias is the <em>algorithm</em>: what
            it picks to feed <em>you</em>. BrainRot aggregates many posts into a
            profile — your dominant topics, emotional lean, echo-chamber
            tightness, and how engineered the whole feed is.
          </>,
          <>
            <strong>Article mode</strong> — the bias is the <em>editorial</em>:
            framing, loaded words, who&apos;s cast as hero vs villain, a
            sensational headline over a thinner body. BrainRot flags the
            opinion-dressed-as-news and the partisan lean (direction, not truth).
          </>,
        ]}
      />

      <CasePullQuote>
        Reverse Bias — the feed&apos;s bias is invisible by design. BrainRot makes
        it visible.
      </CasePullQuote>

      <CaseSectionHeading>How it works</CaseSectionHeading>
      <CaseList
        items={[
          <>
            <strong>Deterministic core.</strong> A lexicon engine scores each
            item&apos;s sentiment, emotion, topic, and manipulation techniques
            (rage-bait, doomscroll, FOMO, envy-bait, us-vs-them, cliffhanger,
            parasocial, outrage-farming). Fast, private, explainable — no model
            required.
          </>,
          <>
            <strong>On-device, always.</strong> Nothing leaves your browser — no
            account, no server, no tracking. The one thing an anti-manipulation
            tool can&apos;t do is become another data harvester.
          </>,
          <>
            <strong>The extension.</strong> The same engine ships as a
            cross-browser extension that reads the live feed off the page and can
            tag posts in place with the technique they&apos;re using — a literacy
            overlay on the scroll itself.
          </>,
          <>
            <strong>Optional deeper read.</strong> A tiny on-device LLM (the same
            in-browser model the Universe Assistant uses) can deepen the per-item
            analysis on top of the deterministic core — still keyless, still
            private.
          </>,
        ]}
      />

      <CaseLessons
        lessons={[
          {
            title: "The tool must not become the thing it fights.",
            body: "An app that analyses your feed for manipulation can't itself phone home with what you read. On-device is the whole ethical stance — not a feature, the premise.",
          },
          {
            title: "Deterministic first, model optional.",
            body: "A lexicon is explainable ('this scored as rage-bait because of these words') and works offline for everyone. The LLM only deepens — it never gatekeeps the core function.",
          },
          {
            title: "Feed bias and article bias are different problems.",
            body: "Treating a news article like a social post (or vice versa) gives a shallow read. Auto-detecting the mode and switching lenses is what makes the mirror honest.",
          },
        ]}
      />
    </CaseStudyLayout>
  )
}
