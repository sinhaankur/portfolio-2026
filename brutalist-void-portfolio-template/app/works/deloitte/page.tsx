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
  title: "Deloitte — Assistant Manager UX · Ankur Sinha",
  description:
    "Two years at Deloitte Design Studio Bangalore — UX consulting for Unilever, FAB, Vodafone, CEAT, and Deloitte Digital across supply chain, retail banking, telecom, and CRM.",
}

export default function DeloitteCaseStudy() {
  return (
    <CaseStudyLayout
      eyebrow="Case study · 2018 – 2020"
      title="Deloitte — applying a user-centered approach across four industries."
      subtitle="Two years moving between supply chain, retail banking, telecom, and CRM. The work was rarely 'make a screen prettier.'"
      period="Apr 2018 – Feb 2020"
      role="UX Consultant → Assistant Manager UX"
      tags={["Service design", "Enterprise", "Salesforce", "Banking", "Supply Chain"]}
      intro={
        <>
          <p>
            I joined Deloitte Design Studio in Bangalore in 2018 as a UX Consultant
            in Technology Consulting, then moved to Assistant Manager in mid-2019.
            Over two years I worked on engagements with Unilever, FAB (First Abu
            Dhabi Bank), Vodafone, CEAT, and Deloitte Digital itself — moving
            between supply chain, retail banking, telecom, and CRM as the work
            changed.
          </p>
          <p>
            The work was rarely "make a screen prettier." It was usually: sit with
            stakeholders, figure out what the product should actually do, then
            design the version that lets the team build something true to that.
            Consulting time is short, so the UX process has to be honest — research
            that informs decisions, IA that survives delivery, design that can be
            argued for in a room full of people with different agendas.
          </p>
          <p>
            Most artifacts are under client NDA. Sanitized versions are linked from
            each project; reach out for full case studies.
          </p>
        </>
      }
    >
      <section>
        <CaseSectionHeading>Role</CaseSectionHeading>
        <CaseList
          items={[
            "UX work across multi-month client engagements — Unilever, FAB, Vodafone, CEAT, Deloitte Digital — moving between industries as the engagements changed.",
            "Running requirement workshops with mixed stakeholder groups (executive sponsors, business owners, end users) and turning competing asks into one shared direction.",
            "Qualitative contextual inquiry, behavioural personas, mental models, journey maps, and multi-channel information architecture — used to set the brief before a screen got drawn.",
            "Partnering with visual designers to evolve per-product pattern libraries handed to clients at the end of the engagement.",
            "Helping with the studio's design hiring — reviewing portfolios, sitting in on interviews.",
          ]}
        />
      </section>

      <CasePullQuote>
        Designing for e-commerce across <strong>omnichannel</strong> customer journeys
        has taught me to solve for complex systems outside just the digital space.
      </CasePullQuote>

      <section>
        <CaseSectionHeading>Selected projects</CaseSectionHeading>
        <CaseProse>
          <p>
            Four projects across four industries — supply chain, automotive,
            banking, retail. <strong>The thing that links them isn't the screens.
            It's the same UX move: clients arrive with what feels like a software
            problem, and most of the time the real problem is how the people
            around the software work together.</strong>
          </p>
        </CaseProse>

        <div className="mt-10 space-y-4">
          <ProjectStory
            index={0}
            headline="Unilever Buyers Console"
            tagline="A PowerBI-backed KPI tool for supply-chain buyers, built around the decisions they actually make."
            image={{ src: "/img/case-studies/deloitte/Uniliver.png", alt: "Unilever Buyers Console" }}
            context={
              <>
                Unilever's buyers were sitting on a wall of dashboards, but the
                dashboards weren't laid out around their decisions — they were
                laid out around the database. Buyers were exporting to Excel and
                rebuilding the same views every week.
              </>
            }
            uxAngle={
              <>
                The dashboards weren't broken; they just weren't designed around
                the buyer's job. They were designed around the data model.
                That's the difference between an analytics tool that gets used
                and one that gets exported to Excel.
              </>
            }
            approach={
              <>
                Spent time with actual buyers before drawing anything.
                Re-architected the IA around their weekly cadence — what to
                negotiate, what to expedite, what to defer. Cleaner visual
                language, fewer screens, the decision surfaced first.
              </>
            }
            learned={
              <>
                For analytics tools, the IA is the design. Visual polish on a
                wrong-shape information architecture is wasted work.
              </>
            }
            cta={{ label: "Request the deck", href: "mailto:sinhaankur827@gmail.com?subject=Case%20study%20deck%20request", external: false }}
          />

          <ProjectStory
            index={1}
            headline="CEAT Salesforce"
            tagline="Redesigning the Salesforce app Territory Leads use to balance tyre supply and demand across western India."
            image={{ src: "/img/case-studies/deloitte/CEAT.png", alt: "CEAT Salesforce" }}
            context={
              <>
                Territory Leads were using a stock Salesforce build to track
                tyre demand, dealer orders, and stock-outs across western India.
                The fields were generic; the work wasn't. Reps were keeping
                their real worksheet on paper.
              </>
            }
            uxAngle={
              <>
                Customising a platform like Salesforce isn't a clean-sheet UX
                exercise — most of the work is finding the few places where a
                small change has outsized effect, then designing those well
                within the platform's constraints.
              </>
            }
            approach={
              <>
                Discovery with Territory Leads and Regional Sales Managers
                first — what does their day actually look like, where does the
                platform fail them. Re-modelled the screens around the rep's
                day: territory snapshot first, supply-vs-demand second, action
                queues third. Picked the customisation levers that mattered
                most and let the rest stay default.
              </>
            }
            learned={
              <>
                Even fixed platforms have UX latitude — but only if you know
                where to look. The skill is choosing the few changes that earn
                their cost.
              </>
            }
            cta={{ label: "Request the deck", href: "mailto:sinhaankur827@gmail.com?subject=Case%20study%20deck%20request", external: false }}
          />

          <ProjectStory
            index={2}
            headline="FAB · Letter of Credit"
            tagline="Digitalising a paper-based Letter of Credit flow for First Abu Dhabi Bank, end to end."
            image={{ src: "/img/case-studies/deloitte/FAB.png", alt: "First Abu Dhabi Bank — Letter of Credit" }}
            context={
              <>
                Letter of Credit is one of the most stakeholder-heavy flows in
                trade banking — applicant, beneficiary, issuing bank, advising
                bank, all working off paper that travels physically between
                parties. FAB wanted the whole thing digital without losing the
                audit trail every party needed.
              </>
            }
            uxAngle={
              <>
                In a multi-party flow, the journey map isn't a research artifact
                — it's the design tool. Each party's screen is a slice of one
                shared system, and any decision that doesn't hold for all four
                parties isn't really a decision yet.
              </>
            }
            approach={
              <>
                Built one shared journey map across all parties before drawing a
                single screen. Designed each role's view as a slice of that
                shared system — same data, different lens. Treated the audit
                trail as a UI primitive, not a buried log.
              </>
            }
            learned={
              <>
                In stakeholder-heavy systems, the journey map earns more design
                decisions than the wireframes do. Spending the extra week on
                the map saves the extra month on revisions.
              </>
            }
            cta={{ label: "Request the deck", href: "mailto:sinhaankur827@gmail.com?subject=Case%20study%20deck%20request", external: false }}
          />

          <ProjectStory
            index={3}
            headline="Unilever Supply Chain E2E"
            tagline="A cohesive KPI dashboard tying together internal Unilever supply-chain products."
            image={{ src: "/img/case-studies/deloitte/Uniliver.png", alt: "Unilever Supply Chain E2E" }}
            context={
              <>
                Internal Unilever supply-chain teams were running multiple
                specialised tools (Buyers, Portfolio, E2E) — each useful, none
                speaking to the others. Leadership wanted one window on the
                whole chain.
              </>
            }
            uxAngle={
              <>
                Three useful tools can still add up to a confusing experience if
                they don't share a language. The interesting UX problem here
                wasn't another dashboard — it was the connective tissue.
              </>
            }
            approach={
              <>
                Established a shared KPI grammar across the three tools first.
                Designed the E2E view as a navigable layer on top — drill down
                anywhere and land in the underlying tool, in context. Avoided
                rebuilding what already worked.
              </>
            }
            learned={
              <>
                Consistency at the language layer compounds across products.
                Most "we need a unified dashboard" requests are really "we need
                to agree on what these words mean."
              </>
            }
            cta={{ label: "Request the deck", href: "mailto:sinhaankur827@gmail.com?subject=Case%20study%20deck%20request", external: false }}
          />
        </div>
      </section>

      <section>
        <CaseSectionHeading>What two years of consulting taught me about UX</CaseSectionHeading>
        <CaseLessons
          lessons={[
            {
              title: "The brief is a hypothesis, not a contract.",
              body: "Clients hire designers for an outcome, not the spec they wrote in the SOW. The first job is reframing the brief before the first sketch — and it's the most expensive thing to skip.",
            },
            {
              title: "The workshop is a design tool.",
              body: "Stakeholder workshops, done well, do more architectural work than weeks of solo wireframing. A lot of 'alignment problems' are facilitation problems in disguise.",
            },
            {
              title: "Patterns travel across industries.",
              body: "A pattern that works for territory leads in one industry often works for buyers in another. Domain depth matters; cross-domain transfer matters more.",
            },
            {
              title: "The clock changes the craft.",
              body: "Consulting forces UX decisions on imperfect data. The instinct it builds — knowing when more research is rigour vs. avoidance — is one of the most useful things I picked up.",
            },
          ]}
        />
        <div className="mt-8 max-w-3xl">
          <p className="font-sans text-base md:text-lg text-foreground/85">
            Read more{" "}
            <a
              href="https://medium.com/@sinhaankur27"
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
        intro="Two years across four industries — team moments and client workshops from the Deloitte Design Studio years."
        moments={[
          {
            src: "/img/case-studies/deloitte/D1.JPG",
            alt: "Team moment from Deloitte Design Studio",
            caption: "Team moment from Deloitte Design Studio.",
          },
          {
            src: "/img/case-studies/deloitte/D6.jpg",
            alt: "Office celebration and cross-team collaboration",
            caption: "Office celebration and cross-team collaboration.",
          },
          {
            src: "/img/case-studies/deloitte/FABworkshop1.JPG",
            alt: "Client workshop session with FAB stakeholders",
            caption: "Client workshop session with FAB stakeholders.",
          },
          {
            src: "/img/case-studies/deloitte/image.jpg",
            alt: "A snapshot from the Deloitte journey",
            caption: "A snapshot from the Deloitte journey.",
          },
        ]}
      />

      <CaseNextLinks
        prev={{ label: "Oracle — Principal UX", href: "/works/oracle" }}
        next={{ label: "Snowtint — Lead UX, end to end", href: "/works/snowtint" }}
      />
    </CaseStudyLayout>
  )
}
