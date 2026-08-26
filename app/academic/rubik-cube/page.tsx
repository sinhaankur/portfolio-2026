import type { Metadata } from "next"
import Link from "next/link"
import { canonicalPath } from "@/lib/seo"
import { RubikCubeEmbed } from "@/components/academic/rubik-cube-embed"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseList,
  CaseNextLinks,
} from "@/components/case-study/case-study-layout"

export const metadata: Metadata = {
  ...canonicalPath("/academic/rubik-cube"),
  title: "Rubik Cube — Computer Graphics with OpenGL",
  description:
    "Undergraduate computer-graphics project at Visvesvaraya Technological University (2011): an interactive 3D Rubik's Cube in OpenGL — modelling, face rotations, and camera control from first principles.",
}

export default function RubikCubePage() {
  return (
    <CaseStudyLayout
      eyebrow="Academic · Early work"
      title="Rubik Cube in OpenGL"
      subtitle="An interactive 3D Rubik's Cube built from first principles for a computer-graphics course."
      period="Aug 2011"
      role="Student project · VTU"
      tags={["OpenGL", "C / C++", "Computer Graphics", "3D", "Linear algebra"]}
      backTo={{ label: "Back to work", href: "/#works" }}
      intro={
        <>
          A computer-graphics project at Visvesvaraya Technological University:
          model a Rubik&apos;s Cube in 3D with OpenGL and let the user rotate its
          faces interactively. No engine, no scene graph — just the fixed-function
          pipeline, transformation matrices, and the geometry worked out by hand.
        </>
      }
    >
      <section>
        <CaseSectionHeading>The cube, live</CaseSectionHeading>
        <CaseProse>
          A rebuilt version of the project, running here in your browser in WebGL —
          drag to orbit, turn any face, scramble it. The original was fixed-function
          OpenGL in C++; this is the same geometry and the same rotation maths, now
          on the web.
        </CaseProse>
        <div className="mt-6">
          <RubikCubeEmbed />
        </div>
      </section>

      <section>
        <CaseSectionHeading>The problem</CaseSectionHeading>
        <CaseProse>
          A Rubik&apos;s Cube looks simple and is deceptively fiddly to render
          correctly. It&apos;s 26 small cubies arranged in a 3×3×3 grid, each with
          coloured stickers only on outward faces. A face &ldquo;turn&rdquo; rotates
          a 3×3 slab of nine cubies about an axis — and after the turn, the cubies
          have genuinely moved, so the model&apos;s state has to update, not just the
          picture. Getting rotations to compose correctly, around the right axis,
          about the cube&apos;s centre, is the whole exercise.
        </CaseProse>
      </section>

      <section>
        <CaseSectionHeading>What I built</CaseSectionHeading>
        <CaseProse>
          An interactive cube in OpenGL, drawn from primitives and driven entirely
          by transformation matrices — the graphics fundamentals a course like this
          is meant to teach, done without a helper library doing the maths for you.
        </CaseProse>
        <CaseList
          items={[
            "The cube modelled as individual cubies, each positioned by its own translation so a face is just the nine cubies sharing a coordinate on one axis.",
            "Face rotations as matrix transforms about the correct axis and pivot, animated so a turn reads as a turn.",
            "Interactive camera control to orbit the cube and inspect it from any angle — mouse / keyboard driven.",
            "Colour and lighting on the stickers so the faces read clearly in 3D.",
          ]}
        />
      </section>

      <section>
        <CaseSectionHeading>Why it still matters to me</CaseSectionHeading>
        <CaseProse>
          This is where the 3D maths became real for me: transformation matrices,
          composing rotations, thinking about a scene as geometry plus a camera.
          Years later that&apos;s exactly the foundation the{" "}
          <Link href="/writing/universe-engine" className="text-accent hover:underline">
            Universe Engine
          </Link>{" "}
          is built on — the same primitives, now in WebGL instead of fixed-function
          OpenGL. A dated project, kept honestly, because the through-line from it
          to the work I do now is real.
        </CaseProse>
      </section>

      <CaseNextLinks
        prev={{ label: "Data-Driven P2P Streaming", href: "/academic/p2p-streaming" }}
        next={{ label: "Back to work", href: "/#works" }}
      />
    </CaseStudyLayout>
  )
}
