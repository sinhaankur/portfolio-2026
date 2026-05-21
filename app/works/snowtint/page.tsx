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
  title: "Snowtint — Lead UX Designer · Ankur Sinha",
  description:
    "First role with explicit ownership of UX outcomes. Three different products across two years — iPress (Mac), Campus Select, and JCVD with Jean-Claude Van Damme.",
}

export default function SnowtintCaseStudy() {
  return (
    <CaseStudyLayout
      eyebrow="Case study · 2016 – 2018"
      title="Snowtint — first role with explicit ownership of UX outcomes."
      subtitle="Three different products in two years. Different users, different industries, same job: lead designer, end to end."
      period="Sep 2016 – Mar 2018"
      role="Lead UX Designer"
      tags={["Founding UX", "Team lead", "Web", "Mobile", "Mac"]}
      intro={
        <>
          <p>
            I joined{" "}
            <a href="https://www.snowtint.com" target="_blank" rel="noreferrer noopener">
              Murali's team
            </a>{" "}
            at Snowtint Pvt Ltd in Bangalore in 2017 as <strong>Lead UX Designer</strong>{" "}
            — my first role with explicit ownership of UX outcomes, not just
            artifacts. Snowtint was a young product studio, which meant I owned the
            full lifecycle: framing the problem with the founder, running the
            research, designing the flows, then handing off to engineering and
            watching it ship.
          </p>
          <p>
            Across two years I worked on three very different products — a Mac
            digital-catalogue tool (iPress), a campus hiring marketplace (Campus
            Select), and a celebrity fitness app (JCVD with Jean-Claude Van
            Damme). Different users, different industries, same job: lead designer,
            end to end.
          </p>
        </>
      }
    >
      <section>
        <CaseSectionHeading>Role &amp; scope</CaseSectionHeading>
        <CaseList
          items={[
            <>
              <strong>Lead designer, end to end</strong> — from contextual inquiry
              through wireframes, hi-fi, and engineer handoff on three shipping
              products.
            </>,
            <>
              <strong>Research-first</strong> — designed and ran qualitative
              studies, recruited participants, built behavioural personas, mental
              models, and journey maps before the first sketch.
            </>,
            <>
              <strong>Stakeholder facilitation</strong> — running workshops with
              founders and client stakeholders to align product vision with user
              reality.
            </>,
            <>
              <strong>Pattern-library contribution</strong> — building the studio's
              first internal pattern library so the next product didn't restart
              from zero.
            </>,
            <>
              <strong>Hiring &amp; team growth</strong> — interviewing and
              onboarding designers as Snowtint scaled.
            </>,
          ]}
        />
      </section>

      <CasePullQuote>
        Designing for e-commerce across <strong>omnichannel</strong> customer
        journeys has taught me to solve for complex systems outside just the
        digital space.
      </CasePullQuote>

      <section>
        <CaseSectionHeading>Selected projects</CaseSectionHeading>
        <CaseProse>
          <p>
            Three different products in two years — a Mac digital-catalogue tool, a
            campus hiring marketplace, a celebrity fitness app.{" "}
            <strong>
              Different users, different industries, same UX exercise: study the
              actual user, design from their job inwards, ship the simplest thing
              that works.
            </strong>
          </p>
        </CaseProse>

        <div className="mt-10 space-y-4">
          <ProjectStory
            index={0}
            headline="iPress for Macbook"
            tagline="Reimagining a digital-catalogue tool that field reps actually wanted to use."
            image={{ src: "/img/case-studies/snowtint/ipress4.png", alt: "iPress for Macbook" }}
            context={
              <>
                iPress was the studio's flagship — a Mac app that let field sales
                reps walk into a customer meeting and present a product catalogue
                without slides or PDFs. The previous version was a tool to be
                tolerated, not used.
              </>
            }
            uxAngle={
              <>
                The previous version was designed around the catalogue's data
                model — products, categories, attributes. The actual user wasn't
                browsing; they were presenting, in front of a customer, with
                about ninety seconds to make the point. Designing for that
                moment is a different problem.
              </>
            }
            approach={
              <>
                Spent time in customer meetings to see how reps actually used
                the tool. Re-designed around the moment of presenting — large
                media, fast switching, no fiddly chrome. The catalogue
                structure stayed underneath; the surface served the situation.
              </>
            }
            learned={
              <>
                Design for the situation, not just the user. Knowing the room a
                tool is used in changes the design more than knowing the
                persona who uses it.
              </>
            }
            cta={{ label: "Request the deck", href: "mailto:sinhaankur827@gmail.com?subject=Case%20study%20deck%20request", external: false }}
          />

          <ProjectStory
            index={1}
            headline="Campus Select"
            tagline="A two-sided marketplace connecting hiring companies and students on campus."
            image={{ src: "/img/case-studies/snowtint/CSlogo.png", alt: "Campus Select" }}
            context={
              <>
                Campus hiring in India was running on spreadsheets, WhatsApp
                groups, and on-campus drives that didn't scale. Companies wanted
                shortlists; students wanted offers; the campus office was the
                bottleneck.
              </>
            }
            uxAngle={
              <>
                Two-sided products usually fail because they're designed as two
                products. The interesting UX work is in the shared spine — the
                data model, the lifecycle, the moments where one side's action
                becomes the other side's input.
              </>
            }
            approach={
              <>
                Mapped the hiring cycle for all three sides (student, recruiter,
                campus office) before sketching. Designed the student app for
                high signal in short browsing windows, the recruiter side for
                shortlist quality, the campus dashboard as the system of record.
              </>
            }
            learned={
              <>
                In multi-sided products, design from the data model up, not from
                any one screen down. Otherwise you end up debugging the same UX
                problem in three places.
              </>
            }
            cta={{ label: "Request the deck", href: "mailto:sinhaankur827@gmail.com?subject=Case%20study%20deck%20request", external: false }}
          />

          <ProjectStory
            index={2}
            headline="JCVD · Train with Van Damme"
            tagline="A celebrity fitness app shipped on a tight launch window in partnership with Jean-Claude Van Damme."
            image={{ src: "/img/case-studies/snowtint/jcvdsmall.png", alt: "JCVD Train with Van Damme" }}
            context={
              <>
                A short-fuse partnership project: design and ship a fitness app
                under Jean-Claude Van Damme's brand, App Store launch in select
                regions, no second chance to get it right.
              </>
            }
            uxAngle={
              <>
                The user arriving at a celebrity fitness app probably isn't
                athletic — they're curious. So the on-ramp has to be generous,
                and the deeper workouts have to feel earned. Designing for the
                actual arrival mode, not the aspirational one, was most of the
                work.
              </>
            }
            approach={
              <>
                Tight design loops — IA, content structure, workout flows, visual
                language all decided alongside brand stakeholders so product and
                brand could agree in the same room. No second-pass reconciliation
                later.
              </>
            }
            learned={
              <>
                On brand-led products, get the brand decisions and the product
                decisions in the same room. Settling them sequentially means
                redoing both.
              </>
            }
            cta={{ label: "Request the deck", href: "mailto:sinhaankur827@gmail.com?subject=Case%20study%20deck%20request", external: false }}
          />
        </div>
      </section>

      <section>
        <CaseSectionHeading>What this role taught me</CaseSectionHeading>
        <CaseLessons
          lessons={[
            {
              title: "Lead is a verb, not a title.",
              body: "Being 'Lead' of a one-person design team forced me to learn to lead through the work — clear writing, sharp specs, and engineers who wanted to build my designs because the brief was honest.",
            },
            {
              title: "You learn the most from the user you'd never have asked for.",
              body: "The Mac field rep, the campus placement officer, the celebrity-brand manager — each pulled my mental model further from 'designer's defaults' than any course could.",
            },
            {
              title: "Patterns travel across products if you let them.",
              body: "The interaction primitives I built for iPress quietly powered the next two products. That was the first time I felt the leverage of a design system, even before the term was on my radar.",
            },
            {
              title: "Ship is a feeling, not just an event.",
              body: "A small studio ships every two weeks because it has to. That muscle — small, fast, real — is the one I still use most.",
            },
          ]}
        />
      </section>

      <CaseMoments
        intro="Studio days — IoT sessions, design discussions, team meals, and everyday office life at Snowtint."
        moments={[
          {
            src: "/img/case-studies/snowtint/Snowtint1.JPG",
            alt: "IoT project session with Sibin Santhosh and Murali",
            caption: "IoT project session with Sibin Santhosh and Murali.",
          },
          {
            src: "/img/case-studies/snowtint/snowtint3.jpg",
            alt: "Team collaboration with developer Srinivas",
            caption: "Team collaboration with our developer Srinivas.",
          },
          {
            src: "/img/case-studies/snowtint/Snowtint4.JPG",
            alt: "Team lunch and informal design discussions",
            caption: "Team lunch and informal design discussions.",
          },
          {
            src: "/img/case-studies/snowtint/Snowtint5.JPG",
            alt: "Snowtint office moment",
            caption: "Everyday moments from Snowtint office life.",
          },
          {
            src: "/img/case-studies/snowtint/IMG_5198.JPG",
            alt: "A memorable snapshot from the Snowtint journey",
            caption: "A memorable snapshot from the Snowtint journey.",
          },
        ]}
      />

      <CaseNextLinks
        prev={{ label: "Deloitte — UCD across enterprise channels", href: "/works/deloitte" }}
        next={{ label: "Rage — first UX role", href: "/works/rage" }}
      />
    </CaseStudyLayout>
  )
}
