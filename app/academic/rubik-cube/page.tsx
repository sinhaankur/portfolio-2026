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

/** An equation block: a styled formula + a plain-English 'what' + the real code.
 *  Matches the /universe-engine/math pattern — no math library, static-export safe. */
function Eq({ title, formula, what, code }: { title: string; formula: string; what: string; code: string }) {
  return (
    <div className="rounded-xl border border-border bg-white/[0.02] p-5 md:p-6 my-6">
      <h3 className="font-medium text-foreground mb-3">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-border/60 bg-background/60 px-4 py-3 mb-4">
        <p className="font-serif text-base md:text-lg italic text-accent whitespace-nowrap">{formula}</p>
      </div>
      <p className="font-sans text-sm text-foreground/70 leading-relaxed mb-4">{what}</p>
      <pre className="overflow-x-auto rounded-lg border border-border/60 bg-black/40 p-4 text-[12px] leading-relaxed">
        <code className="font-mono text-foreground/85">{code}</code>
      </pre>
    </div>
  )
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
        <CaseSectionHeading>The math</CaseSectionHeading>
        <CaseProse>
          The whole exercise is rotation, done honestly with matrices. Every cubie has
          a position in a 3×3×3 grid centred on the origin — each coordinate is −1, 0,
          or +1. A face turn is three steps: <em>select</em> the layer, <em>rotate</em>
          it 90° about the right axis, then <em>re-snap</em> so the model&apos;s state
          genuinely updates. Here it is, with the equations beside the code that runs.
        </CaseProse>

        <Eq
          title="1 · Select the layer"
          formula="layer(axis) = { cubie : round(pos·ê_axis) = ±1 }"
          what="A face is just the nine cubies that share a coordinate on one axis. For the R (right) face that's every cubie whose x-coordinate is +1; for L it's x = −1, and so on for y (U/D) and z (F/B)."
          code={`// the nine cubies of the turning layer
const ids = new Set<number>()
cubies.forEach(c => {
  const coord = c.pos[axis === "x" ? 0 : axis === "y" ? 1 : 2]
  if (Math.round(coord) === layer) ids.add(c.id)   // layer = ±1
})`}
        />

        <Eq
          title="2 · The rotation matrix"
          formula="Rₓ(θ) = [1 0 0; 0 cosθ −sinθ; 0 sinθ cosθ]   (θ = ±90°)"
          what="A quarter-turn about an axis. Rₓ rotates in the y–z plane, R_y in x–z, R_z in x–y. A clockwise face turn is θ = −π/2, counter-clockwise is +π/2. In the WebGL version this is a quaternion q = (axis, θ), which is the same rotation without gimbal issues."
          code={`const AXIS = { x: [1,0,0], y: [0,1,0], z: [0,0,1] }
// a quarter-turn as a quaternion about the layer's axis
const rot = new THREE.Quaternion()
  .setFromAxisAngle(AXIS[axis], (Math.PI / 2) * dir)  // dir = ±1`}
        />

        <Eq
          title="3 · Apply, then re-snap the state"
          formula="pos′ = round( R · pos )      q′ = q_turn · q"
          what="After turning, each moved cubie has a new grid position — R·pos lands on a lattice point, and rounding cancels floating-point drift so the state stays exact. Its orientation accumulates too: the new quaternion is the turn composed with the old one. This is the crux — the cubies have genuinely moved, not just the picture."
          code={`const next = cubies.map(c => {
  if (!ids.has(c.id)) return c
  const v = new THREE.Vector3(...c.pos).applyQuaternion(rot)
  const q = rot.clone().multiply(c.quat)          // compose orientation
  return { ...c,
    pos: [Math.round(v.x), Math.round(v.y), Math.round(v.z)],
    quat: q }
})`}
        />

        <Eq
          title="4 · Animate the turn (ease)"
          formula="angle(t) = θ · (1 − (1 − t)³),   t ∈ [0, 1]"
          what="So a turn reads as a turn, the pivot group rotates from 0 to θ over ~0.3 s with an ease-out-cubic curve — fast, then settling. When t reaches 1, step 3 bakes the result and the pivot resets. The original OpenGL version did the same with glRotate on a matrix stack."
          code={`const ease = (t: number) => 1 - Math.pow(1 - t, 3)  // easeOutCubic
pivot.rotation[axis] = targetAngle * ease(progress)
if (progress >= 1) { /* bake pos + quat, reset pivot */ }`}
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
