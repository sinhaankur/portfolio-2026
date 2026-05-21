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
  title: "Rage Communication — Junior UX Designer · Ankur Sinha",
  description:
    "First UX role on Rage Communication's DDH team — usability testing, persona-driven user interviews, and visual design across Citibank India mobile banking and Wedding & MarryGold.",
}

export default function RageCaseStudy() {
  return (
    <CaseStudyLayout
      eyebrow="Case study · 2015 – 2016"
      title="Rage Communication — first UX role, learning craft by doing."
      subtitle="Usability testing existing flows, building behavioural personas, redesigning the parts of the journey users dropped out of."
      period="Jun 2015 – Jul 2016"
      role="Junior UX Designer"
      tags={["Banking", "Consumer", "Usability testing", "Foundational"]}
      intro={
        <>
          <p>
            My first UX role. I joined{" "}
            <a href="https://www.whatarage.com/" target="_blank" rel="noreferrer noopener">
              Krishana's DDH team
            </a>{" "}
            at Rage Communications in 2015 — an independent design team focused on
            usability testing and interaction design for client products, mostly in
            retail banking.
          </p>
          <p>
            I came in from a year of technical support, where most tickets were
            people drowning in complex software. Rage was where I learned to study
            that drowning systematically — running interviews, mapping the pain,
            then designing the screen that fixed it. The bulk of my work was on
            Citibank's Indian mobile banking app: usability testing the existing
            experience, building personas across demographics, and reworking the
            sign-on, account, credit-card, and merchant flows.
          </p>
        </>
      }
    >
      <section>
        <CaseSectionHeading>Role &amp; scope</CaseSectionHeading>
        <CaseProse>
          <p>
            <strong>Junior UX Designer</strong> — apprentice on a small senior
            team, learning craft by doing.
          </p>
        </CaseProse>
        <div className="mt-8">
          <CaseList
            items={[
              "Running usability tests on existing client products and synthesising findings into design recommendations.",
              "Conducting user interviews across Indian banking demographics; building behavioural personas.",
              "Card-sorting sessions and IA analysis to restructure the flows being tested.",
              "Designing wireframes and interaction patterns under senior design review.",
              "Sitting in on stakeholder workshops with client teams (Citibank, etc.) — listening more than talking, but in the room.",
            ]}
          />
        </div>
      </section>

      <CasePullQuote>
        Designing for banking across <strong>demography</strong> user journeys
        taught me to solve for complex flow and user day-to-day task.
      </CasePullQuote>

      <section>
        <CaseSectionHeading>Selected projects</CaseSectionHeading>
        <CaseProse>
          <p>
            Most of the work was Citibank India's mobile banking app, broken into
            the flows that needed UX attention.{" "}
            <strong>
              The exercise was always the same: usability-test what exists, find
              where users get stuck, redesign that piece, validate.
            </strong>{" "}
            One e-commerce project (Wedding &amp; MarryGold) closed out the year.
          </p>
        </CaseProse>

        <div className="mt-10 space-y-4">
          <ProjectStory
            index={0}
            headline="Citibank Mobile App India · Sign-On & Account"
            tagline="Reworking the parts of the journey users were dropping out of: sign-on and account summary."
            image={{ src: "/img/case-studies/rage/Citi.png", alt: "Citibank Mobile App India" }}
            context={
              <>
                Citibank's Indian mobile banking app was losing users at sign-on
                and confusing them at the account summary. Friction at the front
                door of a banking app is the most expensive kind.
              </>
            }
            uxAngle={
              <>
                Friction at the front door of a banking app is the most
                expensive kind — the user is right there, intending to use the
                app, and the UI gets in the way. Usability-testing those exact
                moments is where the design recommendations earn their cost.
              </>
            }
            approach={
              <>
                Sat in on usability sessions with Indian banking customers under
                senior supervision. Identified the moments where the UI assumed
                too much (terminology, unfamiliar inputs, hidden state).
                Wireframed each step around what users actually did, not what
                the spec said they would.
              </>
            }
            learned={
              <>
                You can't redesign a screen well without watching someone use
                the broken version. Every change that worked traced back to a
                session; every one that didn't, skipped that step.
              </>
            }
            cta={{ label: "Request the deck", href: "mailto:sinhaankur827@gmail.com?subject=Case%20study%20deck%20request", external: false }}
          />

          <ProjectStory
            index={1}
            headline="Citibank Credit Card Loan"
            tagline="A UX-best-practice pass on the online credit-card application journey."
            image={{ src: "/img/case-studies/rage/Citi.png", alt: "Citibank Credit Card Loan" }}
            context={
              <>
                Online credit-card applications are where banks lose qualified
                applicants in the form. Citibank wanted a UX-best-practice pass
                before the next development cycle.
              </>
            }
            uxAngle={
              <>
                UX audits often end up as long lists of issues that nobody acts
                on. The interesting half of an audit is the prioritisation —
                which findings actually move the needle, and which dev cost is
                worth paying for which.
              </>
            }
            approach={
              <>
                Built a checklist of best-practice patterns (progress
                indication, smart defaults, conditional fields, low-friction
                input types). Audited every step, scored it, then prioritised
                changes by expected drop-off impact vs. dev cost.
              </>
            }
            learned={
              <>
                An audit without prioritisation is research, not design. The
                forcing function of "which of these would you do first" is what
                turns findings into decisions.
              </>
            }
            cta={{ label: "Request the deck", href: "mailto:sinhaankur827@gmail.com?subject=Case%20study%20deck%20request", external: false }}
          />

          <ProjectStory
            index={2}
            headline="Citibank Merchant Engagement Form"
            tagline="Wireframing a simpler merchant onboarding form for Citibank's commercial side."
            image={{ src: "/img/case-studies/rage/Citi.png", alt: "Citibank Merchant Engagement Form" }}
            context={
              <>
                Merchant onboarding for Citibank had grown into a long, branchy
                form that asked for everything up front. Merchants were giving
                up partway through.
              </>
            }
            uxAngle={
              <>
                Long forms aren't long because they have to be. They're long
                because every team that owns a field is afraid to defer it. The
                UX work is in deciding what's actually required to continue —
                and giving the user a sense of distance left.
              </>
            }
            approach={
              <>
                Broke the form into the smallest meaningful steps. Deferred any
                field not strictly required to continue. Added a clear progress
                indicator so merchants knew the end was in sight.
              </>
            }
            learned={
              <>
                Progress indication isn't a decoration; it's a feature. People
                will tolerate a long form if they can see it ending.
              </>
            }
            cta={{ label: "Request the deck", href: "mailto:sinhaankur827@gmail.com?subject=Case%20study%20deck%20request", external: false }}
          />

          <ProjectStory
            index={3}
            headline="Citibank · Scan Information"
            tagline="An update flow that let customers scan a card to update their info without retyping."
            image={{ src: "/img/case-studies/rage/Citi.png", alt: "Citibank Scan Information" }}
            context={
              <>
                Updating card information in the app meant retyping a 16-digit
                number on a phone keyboard. Most people didn't bother.
              </>
            }
            uxAngle={
              <>
                The biggest UX wins are sometimes choosing the right input
                method, not redesigning the screen. Asking users to retype a
                16-digit number on a phone keyboard is the design problem. Scan
                is the design solution.
              </>
            }
            approach={
              <>
                Designed scan as the default and manual as the fallback (most
                users never see manual). The verify-and-edit step lets users
                correct what OCR got wrong without restarting.
              </>
            }
            learned={
              <>
                Design for the path of least resistance, then handle errors
                gracefully on that path. A scan flow is only as good as its
                recovery from a misread.
              </>
            }
            cta={{ label: "Request the deck", href: "mailto:sinhaankur827@gmail.com?subject=Case%20study%20deck%20request", external: false }}
          />

          <ProjectStory
            index={4}
            headline="Wedding & MarryGold"
            tagline="An e-commerce redesign — a pivot away from banking work for the year."
            image={{ src: "/img/case-studies/rage/WandM.png", alt: "Wedding and MarryGold" }}
            context={
              <>
                An e-commerce site for the Indian wedding market — a category
                where shoppers research for weeks and convert in minutes. The
                existing site treated everyone like a casual browser.
              </>
            }
            uxAngle={
              <>
                E-commerce in the wedding category isn't one user mode. The same
                person spends weeks researching, then converts in minutes. A
                single surface has to serve both modes without making either
                feel second-class.
              </>
            }
            approach={
              <>
                Designed for two distinct modes: long research sessions (deep
                filters, save-for-later, comparison) and conversion sprints
                (clear price, low-friction checkout). The homepage had to serve
                both, with neither shouting over the other.
              </>
            }
            learned={
              <>
                Sometimes one surface needs to flex between user modes.
                Designing two parallel paths is often cleaner than trying to
                predict which mode a visitor is in.
              </>
            }
            cta={{ label: "Request the deck", href: "mailto:sinhaankur827@gmail.com?subject=Case%20study%20deck%20request", external: false }}
          />
        </div>
      </section>

      <section>
        <CaseSectionHeading>What this first role taught me</CaseSectionHeading>
        <CaseLessons
          lessons={[
            {
              title: "Watch a real user before drawing a real screen.",
              body: "Every redesign that worked started with someone struggling in a usability session. Every one that didn't work skipped that step.",
            },
            {
              title: "Junior is the time to be precise about craft.",
              body: "Wireframe quality, annotation discipline, file hygiene — none of it is glamorous, all of it compounds. I'm still drawing on muscle memory built here.",
            },
            {
              title: "Banking is a great UX classroom.",
              body: "The constraints (compliance, low connectivity, low literacy on first-time users) force you to design for the actual user, not the imagined one.",
            },
            {
              title: "Listen in the room before you talk in it.",
              body: "Senior people in stakeholder workshops weren't winning by speaking more — they were winning by hearing the disagreement everyone else missed. That's a skill you can practice.",
            },
          ]}
        />
        <div className="mt-8 max-w-3xl">
          <p className="font-sans text-base md:text-lg text-foreground/85">
            Read more{" "}
            <a
              href="https://medium.com/@Ankurgupta/four-things-to-do-as-a-ux-designer-bd19c3666d48"
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
        intro="First UX role, DDH team. People I learned the craft from."
        moments={[
          {
            src: "/img/case-studies/rage/R1.jpg",
            alt: "With Chella, lead UX designer at Rage",
            caption: "With Chella, lead UX designer.",
          },
          {
            src: "/img/case-studies/rage/R2.png",
            alt: "The DDH team at Rage",
            caption: "The DDH team at Rage.",
          },
          {
            src: "/img/case-studies/rage/R3.png",
            alt: "With Krishanan, UX manager at Rage",
            caption: "With Krishanan, UX manager.",
          },
          {
            src: "/img/case-studies/rage/R4.jpg",
            alt: "Rage team outing and bonding",
            caption: "Team outing and bonding.",
          },
          {
            src: "/img/case-studies/rage/R5.png",
            alt: "With Mitra, business analyst at Rage",
            caption: "With Mitra, business analyst.",
          },
        ]}
      />

      <CaseNextLinks
        prev={{ label: "Snowtint — Lead UX, end to end", href: "/works/snowtint" }}
      />
    </CaseStudyLayout>
  )
}
