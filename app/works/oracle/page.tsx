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
    "Six years of UX across OCI Database-as-a-Service and the Database Tools portfolio — provisioning, encryption, disaster recovery, developer experience, and the human-in-the-loop layer for AI-assisted database work.",
}

export default function OracleCaseStudy() {
  return (
    <CaseStudyLayout
      eyebrow="Case study · 2020 – Present"
      title="Oracle — designing the console for the people who run the database."
      subtitle="Principal UX Designer on OCI Database-as-a-Service & Database Tools. Six years across the surfaces DBAs and fleet operators live in all day."
      period="Feb 2020 – Present"
      role="Principal UX Designer"
      tags={["Enterprise", "Cloud Database", "Design systems", "Developer experience"]}
      intro={
        <>
          <p>
            I joined OCI&rsquo;s{" "}
            <a href="https://www.oracle.com/cloud/" target="_blank" rel="noreferrer noopener">
              Database-as-a-Service
            </a>{" "}
            org in 2020 and have spent six years across two worlds: the DBaaS
            services themselves — provisioning, security, high availability,
            recovery — and Database Tools, the portfolio of products people use to
            build, query, migrate, and operate those databases. Cloud-database UX is
            one of the most specialized surfaces in enterprise software; only a
            handful of companies even do it.
          </p>
          <p>
            The user on the other side of these screens isn&rsquo;t a casual visitor —
            they&rsquo;re a DBA or fleet operator who lives in the tool. That changes
            the problem. Density beats whitespace. A click saved compounds across
            thousands of operations. The interface has to disappear so the work can
            show.
          </p>
          <p>
            Most artifacts are under NDA. What follows is named only as far as I can
            name it publicly — products and initiatives, not metrics, customers, or
            screens. Sanitized walkthroughs are available on request.
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
              "UX across both the DBaaS services and the Database Tools portfolio — partnering with PMs and engineering to frame the right problem before drawing screens.",
              <>
                Creating and owning new design patterns and processes for
                console-admin work — dense tables, long-running jobs, fleet
                operations — the cases generic defaults don&rsquo;t cover.
              </>,
              "Leading the DBaaS “Fit & Finish” initiative — UX consistency and quality across DBaaS, sustained over multiple years.",
              "Serving as a trained reviewer on the OCI UX Review Board, enforcing company-wide consistency across the OCI platform.",
              "Mentoring ~5 designers and PMs in UX best practice; helping codify how the team goes from research → flows → handoff.",
              "Adopting AI-assisted prototyping (vibe coding, Figma Make) for faster ideation — alongside shipping working code prototypes in React/TypeScript.",
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
            A cross-section of the work, spanning both buckets — the DBaaS services
            and the Database Tools portfolio. <strong>Each one is a different kind of
            UX problem, but the through-line is the same: study how the operator
            actually works, then design the console around their job, not around the
            database&rsquo;s data model.</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Publicly-documented products are named; everything else is described in
            shape only. Expand any card for the story.
          </p>
        </CaseProse>

        <div className="mt-10 space-y-4">
          <ProjectStory
            index={0}
            icon="bot"
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
            icon="git-compare"
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
              label: "View GoldenGate Veridata on Oracle",
              href: "https://www.oracle.com/integration/goldengate/veridata/",
              external: true,
            }}
          />

          <ProjectStory
            index={2}
            icon="sparkles"
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
            icon="map"
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
              label: "View Spatial Studio on Oracle",
              href: "https://www.oracle.com/database/technologies/spatial-studio/get-started.html",
              external: true,
            }}
          />

          <ProjectStory
            index={4}
            icon="workflow"
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
              label: "View Graph on Oracle",
              href: "https://www.oracle.com/database/integrated-graph-database/",
              external: true,
            }}
          />

          <ProjectStory
            index={5}
            icon="key"
            headline="Encryption & key management — KMS / TDE, OKV"
            tagline="Bringing customer-managed encryption to VM and Bare Metal databases through OCI Vault."
            context={
              <>
                Customer-managed encryption for VM and Bare Metal databases via OCI
                Vault, plus the dedicated key-vault surface, OKV (Oracle Key Vault).
                The full lifecycle: provisioning, switching from the host wallet to
                KMS, key rotation, migration, backup and restore, and Data Guard.
              </>
            }
            uxAngle={
              <>
                Encryption-key work is unforgiving — a wrong move can lock a customer
                out of their own data. The design job is making an irreversible,
                high-stakes operation legible and safe at every step.
              </>
            }
            approach={
              <>
                Sequenced the lifecycle so each state — host-wallet, migrating,
                KMS-managed — is unambiguous. Made destructive steps explicit rather
                than incidental, and kept the dense operational detail operators rely
                on instead of stripping it for the sake of &ldquo;clean.&rdquo;
              </>
            }
            learned={
              <>
                On irreversible surfaces, clarity about <em>what state you&rsquo;re
                in</em> matters more than visual polish.
              </>
            }
            cta={{
              label: "Request a walkthrough",
              href: "mailto:sinhaankur827@gmail.com?subject=KMS%2FTDE%20encryption%20walkthrough",
            }}
          />

          <ProjectStory
            index={6}
            icon="shield"
            headline="Cross-Region Autonomous Data Guard"
            tagline="Disaster recovery for Autonomous Database — the surface an operator only touches on their worst day."
            context={
              <>
                Standby databases in a different region, with mandatory same-region
                automatic failover plus operator-controlled cross-region failover,
                and seamless reconnect afterward.
              </>
            }
            uxAngle={
              <>
                Disaster recovery is the definition of high-stakes and irreversible.
                The interface has to be unambiguous when someone is stressed and the
                clock is running — and it has to separate &ldquo;the system has this
                covered&rdquo; from &ldquo;I have to act now.&rdquo;
              </>
            }
            approach={
              <>
                Made the protection topology and failover state readable at a glance.
                Kept the automatic guarantees visually distinct from the
                operator-initiated controls, so nobody confuses a system-owned
                failover with one they must trigger.
              </>
            }
            learned={
              <>
                Design for the tired operator mid-incident, not the one running a
                clean demo.
              </>
            }
            cta={{
              label: "Request a walkthrough",
              href: "mailto:sinhaankur827@gmail.com?subject=Cross-Region%20Data%20Guard%20walkthrough",
            }}
          />

          <ProjectStory
            index={7}
            icon="database-zap"
            headline="PDB lifecycle & Refreshable Clone"
            tagline="One coherent lifecycle across Console, SDK, and Terraform."
            context={
              <>
                Letting customers create and manage pluggable databases (DBCS /
                ExaCS / ExaCC) from the OCI Console, SDK, and Terraform instead of by
                hand on the host — plus Refreshable Clone (ADB) with automatic,
                manual, and continuous refresh schedules.
              </>
            }
            uxAngle={
              <>
                The same operation has to feel coherent across three very different
                entry points. Consistency <em>is</em> the feature — a Console user
                and a Terraform user should be reasoning about the same model.
              </>
            }
            approach={
              <>
                One mental model for the lifecycle, expressed natively in each
                surface. Made refresh schedules explicit so a clone&rsquo;s freshness
                is never a guess.
              </>
            }
            learned={
              <>
                When a workflow spans Console and code, the design&rsquo;s job is one
                model, three faithful expressions.
              </>
            }
            cta={{
              label: "Request a walkthrough",
              href: "mailto:sinhaankur827@gmail.com?subject=PDB%20lifecycle%20walkthrough",
            }}
          />

          <ProjectStory
            index={8}
            icon="archive"
            headline="Reliability — Backup & Recovery, snapshot archival"
            tagline="Designing the restore, not the backup — because the restore is the moment that matters."
            context={
              <>
                Recovery workflows with the Siteguard team, and VM snapshot archival
                to Object Storage for ExaDB-XS — archival, storage management, and
                recovery. (This year.)
              </>
            }
            uxAngle={
              <>
                Backup is invisible until the day it isn&rsquo;t. The recovery path is
                the real product, and it has to work for someone who&rsquo;s panicking.
              </>
            }
            approach={
              <>
                Designed the recovery journey first and let the archival and storage
                configuration serve it. Surfaced what&rsquo;s recoverable, and from
                when, plainly.
              </>
            }
            learned={
              <>
                Design the restore, not the backup. The backup is housekeeping; the
                restore is the moment everything depends on.
              </>
            }
            cta={{
              label: "Request a walkthrough",
              href: "mailto:sinhaankur827@gmail.com?subject=Backup%20%26%20Recovery%20walkthrough",
            }}
          />

          <ProjectStory
            index={9}
            icon="code"
            headline="Developer experience — Database Developer Portal + VS Code"
            tagline="Bringing database workflows into the tools developers already live in."
            context={
              <>
                A Database Developer Portal, deep VS Code integration, SQL Worksheet,
                and a VS Code plugin for MongoDB migration — meeting developers in
                their editor instead of asking them to leave it. (This year.)
              </>
            }
            uxAngle={
              <>
                Developers don&rsquo;t want another console; they want the database to
                meet them where they already work. The win is removing the
                context-switch, not building a prettier portal.
              </>
            }
            approach={
              <>
                Mapped the developer&rsquo;s existing loop and inserted DB workflows
                into it — migration, querying, worksheet — so the tooling comes to
                them rather than the other way around.
              </>
            }
            learned={
              <>
                The best enterprise tool is sometimes the one that disappears into the
                IDE the user already has open.
              </>
            }
            cta={{
              label: "Request a walkthrough",
              href: "mailto:sinhaankur827@gmail.com?subject=Developer%20experience%20walkthrough",
            }}
          />

          <ProjectStory
            index={10}
            icon="boxes"
            headline="Database Tools MCP Toolsets"
            tagline="Designing how AI agents are scoped to call real database tools — agent tooling, not agent theater."
            context={
              <>
                Design mocks for Model-Context-Protocol (MCP) toolsets — the layer
                that defines how AI agents call Database Tools. (This year.) My deeper
                agentic-UX work is independent of Oracle — see the open-source pattern
                library below — but this is real agent-tooling exposure inside the
                product.
              </>
            }
            uxAngle={
              <>
                The question isn&rsquo;t &ldquo;add a chat box.&rdquo; It&rsquo;s how an
                agent&rsquo;s access to real database tools is scoped, surfaced, and
                made reviewable before the agent acts.
              </>
            }
            approach={
              <>
                Designed how toolsets are presented and bounded, so an operator can
                see what an agent is able to do before it does it — capability and
                scope legible up front.
              </>
            }
            learned={
              <>
                For agent tooling, the design&rsquo;s job is to make capability and
                scope legible <em>before</em> anything runs — the same instinct behind
                my open-source{" "}
                <a
                  href="https://github.com/sinhaankur/Probabilistic-UI"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Probabilistic-UI
                </a>{" "}
                pattern library.
              </>
            }
            cta={{
              label: "Request a walkthrough",
              href: "mailto:sinhaankur827@gmail.com?subject=MCP%20Toolsets%20walkthrough",
            }}
          />

          <ProjectStory
            index={11}
            icon="package-check"
            headline="DMS — taking over and shipping"
            tagline="Inheriting in-flight work, understanding someone else's decisions, and bringing it live."
            context={
              <>
                Took over DMS from another team member, updated it, and brought it
                live — the &ldquo;understand the existing work, take ownership, ship
                it&rdquo; story.
              </>
            }
            uxAngle={
              <>
                Inheriting in-flight work is its own skill: read someone else&rsquo;s
                decisions charitably, find what&rsquo;s still unsolved, and avoid the
                temptation to restart from scratch.
              </>
            }
            approach={
              <>
                Mapped what was already decided versus still open, kept what worked,
                and pushed the remaining gaps to a shippable state rather than
                relitigating the whole design.
              </>
            }
            learned={
              <>
                Follow-through is a design skill. Shipping someone else&rsquo;s
                half-built idea well is harder — and often more valuable — than
                starting your own.
              </>
            }
            cta={{
              label: "Request a walkthrough",
              href: "mailto:sinhaankur827@gmail.com?subject=DMS%20walkthrough",
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
