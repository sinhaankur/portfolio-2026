import type { Metadata } from "next"
import {
  CaseStudyLayout,
  CaseSectionHeading,
  CaseProse,
  CaseList,
  CasePullQuote,
  CaseLessons,
  CaseMoments,
  ProjectStory,
  CaseNextLinks,
} from "@/components/case-study/case-study-layout"

export const metadata: Metadata = {
  title: "Oracle — Principal UX Designer · Ankur Sinha",
  description:
    "Designing the OCI Database console for database and fleet admins, plus the human-in-the-loop layer for AI-assisted database operations.",
}

export default function OracleCaseStudy() {
  return (
    <CaseStudyLayout
      eyebrow="Case study · 2020 – Present"
      title="Oracle — designing operator-grade consoles for AI-assisted database work."
      subtitle="Principal UX Designer on OCI Database-as-a-Service. The user sitting on the other side of these screens lives in this tool."
      period="Feb 2020 – Present"
      role="Principal UX Designer"
      tags={["Enterprise", "Cloud Database", "AI orchestration", "Design system"]}
      intro={
        <>
          <p>
            I joined the OCI{" "}
            <a href="https://www.oracle.com/cloud/" target="_blank" rel="noreferrer noopener">
              Database-as-a-Service
            </a>{" "}
            org in 2020. The work is around the Database console — the surface
            database administrators and fleet operators use to run their day. The
            user sitting on the other side of these screens isn't a casual visitor;
            they're someone who lives in this tool.
          </p>
          <p>
            That changes the UX problem in interesting ways. Density beats whitespace.
            A click saved compounds across thousands of operations. The interface has
            to disappear so the work can show. Most of what I think about, day to
            day, is how to make a tool an operator already knows feel like it's
            quietly getting out of the way.
          </p>
          <p>
            Most artifacts are under NDA. Sanitized walkthroughs are available on
            request — and what follows is what I can share publicly.
          </p>
        </>
      }
    >
      {/* Role */}
      <section>
        <CaseSectionHeading>Role</CaseSectionHeading>
        <CaseProse>
          <p>
            <strong>Principal UX Designer</strong> on the DBaaS team.
          </p>
        </CaseProse>
        <div className="mt-8">
          <CaseList
            items={[
              "UX work across several DBaaS services, partnering with PMs and engineering to frame the right problem before drawing screens.",
              "Designing the human-in-the-loop layer for AI-assisted database operations — confidence-state UX, permission handshakes, and audit-trail interfaces for autonomous agents acting on production state.",
              <>
                Contributing to and reusing patterns from Oracle's HgDS and RDS
                design systems — especially where console-admin use cases (dense
                tables, long-running jobs, fleet operations) need things the
                defaults don't quite cover.
              </>,
              "Sitting in on cross-team design reviews to keep flows consistent and accessible across services.",
              "Mentoring designers and helping codify how the team goes from research → flows → handoff.",
              "Helping shape internal critique and review cadence so feedback is structured, not ad-hoc.",
              <>
                In parallel — publishing open-source code prototypes (
                <a href="https://github.com/sinhaankur/Helm" target="_blank" rel="noreferrer noopener">
                  Helm
                </a>
                ,{" "}
                <a href="https://github.com/sinhaankur/Human-in-the-Loop" target="_blank" rel="noreferrer noopener">
                  Sentinel
                </a>
                ,{" "}
                <a href="https://github.com/sinhaankur/Recourse" target="_blank" rel="noreferrer noopener">
                  Recourse
                </a>
                ) and the{" "}
                <a href="https://github.com/sinhaankur/Probabilistic-UI" target="_blank" rel="noreferrer noopener">
                  Probabilistic-UI
                </a>{" "}
                pattern library as a way to mentor the field publicly and explore
                the same agentic-UX design moves in adjacent contexts.
              </>,
            ]}
          />
        </div>
      </section>

      <CasePullQuote>
        Designing for cloud console <strong>OCI</strong> Database Admin journeys has
        taught me to solve for complex systems outside just the digital space.
      </CasePullQuote>

      {/* Selected projects */}
      <section>
        <CaseSectionHeading>Selected projects</CaseSectionHeading>
        <CaseProse>
          <p>
            A few of the DBaaS surfaces I've worked on. <strong>Each one is a
            different kind of UX problem — but the through-line is the same: study
            how the operator actually works, then design the console around their
            job, not around the database's data model.</strong>
          </p>
        </CaseProse>

        <div className="mt-10 space-y-4">
          <ProjectStory
            index={0}
            headline="AI-assisted database operations"
            tagline="Designing the human-in-the-loop layer for AI agents that act on production database state."
            image={{ src: "/img/case-studies/oracle/oci.png", alt: "Oracle Cloud Infrastructure — DBaaS" }}
            context={
              <>
                Oracle's database services have been getting AI features — query
                authoring, code generation, autonomous agents that modify state.
                The design problem isn't "add a chat box." It's how a DBA stays
                in control while the AI is acting on production systems where
                mistakes are extraordinarily expensive.
              </>
            }
            uxAngle={
              <>
                Three different problem classes hiding inside one feature ask:
                making model uncertainty legible, making permission asks honest,
                and making background-agent actions auditable. Each one needed
                its own primitive.
              </>
            }
            approach={
              <>
                Confidence-state UX with calibrated bands gating between
                auto-execute, review-and-edit, and constraint-elicitation.
                Permission handshakes that are silent for read paths and
                multi-factor with a diff view for production schema changes —
                friction-as-a-feature on irreversible writes. Audit-trail
                interfaces that sync CLI and background-agent actions to a
                visual log with undo, verify, and intervene affordances.
                Confidence-score-bound highlighting on AI-generated PL/SQL so
                reviewers verify-and-edit instead of accept-or-reject.
              </>
            }
            learned={
              <>
                For AI in operator-grade tools, the design's job is to make the
                model's uncertainty visible — not to hide it behind confidence
                theater. Reversibility (recovery cost), not safety, is the right
                policy axis. The same primitives I've documented in the
                open-source Probabilistic-UI pattern library carry across all
                three problem classes.
              </>
            }
            cta={{
              label: "Request a sanitized walkthrough",
              href: "mailto:sinhaankur827@gmail.com?subject=AI-assisted%20DB%20ops%20walkthrough",
            }}
          />

          <ProjectStory
            index={1}
            headline="GoldenGate Veridata"
            tagline="Bringing a legacy data-comparison console onto the RDS design system."
            image={{ src: "/img/case-studies/oracle/oracleveridata.png", alt: "GoldenGate Veridata" }}
            context={
              <>
                GoldenGate Veridata is the tool DBAs use to compare and reconcile
                data between source and target databases during replication. The
                console had been carrying years of accumulated IA — admins were
                doing four jobs (configure, run, monitor, repair) inside one
                undifferentiated surface.
              </>
            }
            uxAngle={
              <>
                The interesting question wasn't "how do we modernise the look" —
                it was "what is the admin actually trying to do, and is the IA
                shaped around it?" Reframing the problem as four distinct jobs
                changed everything that came after.
              </>
            }
            approach={
              <>
                Re-anchored the IA around the four jobs instead of the legacy
                menu. Pressure-tested every flow against the user under incident
                conditions, not the one running a clean demo. Cleaned the visual
                language up to RDS while keeping the dense-table affordances
                admins actually rely on.
              </>
            }
            learned={
              <>
                For an operator-grade tool, density isn't a problem to solve —
                it's a feature to design around. Stripping it for the sake of
                "clean" is a beginner move.
              </>
            }
            cta={{
              label: "Request a sanitized walkthrough",
              href: "mailto:sinhaankur827@gmail.com?subject=Veridata%20case%20study%20walkthrough",
            }}
          />

          <ProjectStory
            index={2}
            headline="Autonomous Database Services (OCI)"
            tagline="A prioritised pattern for surfacing applicable promotions across the DB admin journey."
            image={{ src: "/img/case-studies/oracle/oci.png", alt: "Autonomous Database on OCI" }}
            context={
              <>
                Autonomous Database has multiple promotional offers running at
                any time — different SKUs, regions, customer tiers. The console
                was either showing all of them (overwhelming) or none (revenue
                left on the table). Admins kept missing things they were
                eligible for.
              </>
            }
            uxAngle={
              <>
                A "promotion" isn't a UI element. It's a small system with
                eligibility, priority, dismissal state, repetition rules. Once
                you treat it that way, the design follows; treat it as a banner
                and you fight the same problem on every page.
              </>
            }
            approach={
              <>
                Designed a priority + dismissal model so a high-impact offer
                outranks a low-impact one, and the same offer doesn't shout at
                the same admin five screens in a row. Reusable pattern, not
                per-page custom work.
              </>
            }
            learned={
              <>
                The hardest UX problems hide as "just a banner." Recognising
                when a small interface element is actually a system is half the
                job.
              </>
            }
            cta={{
              label: "Request a walkthrough",
              href: "mailto:sinhaankur827@gmail.com?subject=Autonomous%20DB%20promotions%20walkthrough",
            }}
          />

          <ProjectStory
            index={3}
            headline="Spatial Studio"
            tagline="Making spatial / market analysis usable for non-spatial analysts."
            image={{ src: "/img/case-studies/oracle/Spatial.png", alt: "Spatial Studio" }}
            context={
              <>
                Spatial Studio sits between the database and analysts who want
                to ask geographic questions of their data. The catch: most users
                aren't trained spatial analysts. They're business users with a
                map and a question.
              </>
            }
            uxAngle={
              <>
                The user we were designing for wasn't the spec's user. The spec
                assumed a trained spatial analyst; the actual user was a
                business analyst with a question and a map. Designing for that
                gap is most of the work.
              </>
            }
            approach={
              <>
                Simple defaults that produce a useful map in one click. Deeper
                spatial controls hidden behind progressive disclosure for the
                moment a user is ready for them. Familiar shell so anyone moving
                between DB tools doesn't relearn the console.
              </>
            }
            learned={
              <>
                Design for the user who'd never have asked for the tool. The
                expert can find the depth; the curious user is who you lose if
                the on-ramp is wrong.
              </>
            }
            cta={{
              label: "Request a walkthrough",
              href: "mailto:sinhaankur827@gmail.com?subject=Spatial%20Studio%20walkthrough",
            }}
          />

          <ProjectStory
            index={4}
            headline="Graph Studio"
            tagline="A graph-analytics surface for users who don't speak Cypher."
            image={{ src: "/img/case-studies/oracle/graphstudio.png", alt: "Graph Studio" }}
            context={
              <>
                Graph Studio gives analysts a way to explore graph data —
                relationships, paths, communities — without writing graph query
                languages by hand. The previous version asked too much technical
                fluency from the user.
              </>
            }
            uxAngle={
              <>
                The hard part isn't the visual canvas. It's choosing the right
                abstraction layer between "click and explore" and "write your
                own Cypher" — and making sure neither user feels punished for
                landing where they did.
              </>
            }
            approach={
              <>
                Visual canvas with progressive depth. A curious analyst gets
                value in one click; an advanced user can drop into the
                underlying query whenever they want. Same shell as the rest of
                the DB tools, so the console feels like one product across
                services.
              </>
            }
            learned={
              <>
                The right abstraction is the one that gives value at the shallow
                end and never traps you at the deep end. Most failed analytics
                tools fail one of those two tests.
              </>
            }
            cta={{
              label: "Request a walkthrough",
              href: "mailto:sinhaankur827@gmail.com?subject=Graph%20Studio%20walkthrough",
            }}
          />
        </div>
      </section>

      {/* Lessons */}
      <section>
        <CaseSectionHeading>What designing for operators has taught me</CaseSectionHeading>
        <CaseLessons
          lessons={[
            {
              title: "Density beats whitespace when the user lives in the tool.",
              body: "Consumer-grade airy layouts cost operators time. Information density with clear hierarchy is the move — and the hardest sell to anyone trained on consumer UX defaults.",
            },
            {
              title: "Most console inconsistency is two teams solving the same problem in isolation.",
              body: "A lot of UX work is conversation work — making sure the same pattern shows up in two places because we agreed on it, not because we both happened to land there.",
            },
            {
              title: "A pattern earns its place by being reused.",
              body: "Adoption is a better signal than approval. If a pattern isn't being picked up by the next team, it probably wasn't the right pattern.",
            },
            {
              title: "Pressure-test against the tired user.",
              body: "Polished demos lie. The truth shows up when someone is recovering a database at the end of a long day — that user is the one to design for.",
            },
          ]}
        />
        <div className="mt-8 max-w-3xl">
          <p className="font-sans text-base md:text-lg text-foreground/85">
            Read more{" "}
            <a
              href="https://medium.com/@sinhaankur827/working-at-oracle-5a5c849e40b4"
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent border-b border-accent/40 hover:text-foreground hover:border-foreground transition-colors"
            >
              here
            </a>
            .
          </p>
        </div>
      </section>

      <CaseMoments
        intro="Snapshots from the Oracle journey — remote collaboration, product context, and team memory."
        moments={[
          {
            src: "/img/case-studies/oracle/WFH.png",
            alt: "Remote work setup while collaborating with Oracle teams",
            caption: "Remote collaboration setup while working with Oracle teams.",
          },
          {
            src: "/img/case-studies/oracle/oci.png",
            alt: "Oracle Cloud Infrastructure workstream context",
            caption: "Product context from Oracle Cloud Infrastructure workstreams.",
          },
          {
            src: "/img/case-studies/oracle/Oracle_1.png",
            alt: "A visual memory from the Oracle journey",
            caption: "A visual memory from the Oracle journey.",
          },
        ]}
      />

      <CaseNextLinks next={{ label: "Deloitte — UCD across enterprise channels", href: "/works/deloitte" }} />
    </CaseStudyLayout>
  )
}
