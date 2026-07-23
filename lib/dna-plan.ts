/**
 * dna-plan — turns the raw trait genotypes into a PERSONALISED course of action:
 * which supplements/vitamins are worth considering, what the diet should lean
 * toward, and the daily habits that fit this genome — with an "over time" arc.
 *
 * Every recommendation is derived from a REAL marker + genotype rule, tagged
 * with the marker it came from so the reasoning is visible ("suggested because
 * your MTHFR is TT"). This is informational, honest, never a prescription — the
 * page repeats that. Genes are one input; the plan is a starting point for a
 * conversation with a doctor/dietitian, not a substitute for one.
 *
 * Pure functions over the decrypted `traits` map (marker id -> genotype). No
 * network, nothing leaves the device.
 */

import { normalizeGenotype } from "./dna-traits"

export type PlanTone = "consider" | "lean-in" | "watch"

export type Recommendation = {
  /** What to do — short imperative. */
  what: string
  /** Why — the mechanism, in one line. */
  why: string
  /** Which marker + genotype triggered this (for the "because" chip). */
  because: { markerId: string; gene: string; genotype: string }
  tone: PlanTone
}

export type DnaPlan = {
  supplements: Recommendation[]
  diet: Recommendation[]
  habits: Recommendation[]
  /** What your genome suggests you steer clear of — the honest avoid-list. */
  avoid: Recommendation[]
  /** The long-game arc — what compounds over years for this genome. */
  overTime: string[]
}

type Rule = {
  markerId: string
  gene: string
  /** genotypes (normalized) this rule fires for. */
  when: string[]
  bucket: "supplements" | "diet" | "habits" | "avoid"
  what: string
  why: string
  tone: PlanTone
  /** contributes a line to the long-game arc when it fires. */
  overTime?: string
}

/* Rules — each grounded in a specific marker + genotype. Kept conservative and
 * honest: general nutrition/lifestyle guidance a dietitian would recognise, not
 * dosing or medical claims. */
const RULES: Rule[] = [
  // ── Supplements / vitamins ──────────────────────────────────────────────
  {
    markerId: "folate", gene: "MTHFR", when: ["CT", "TT"], bucket: "supplements",
    what: "Prefer methylfolate (5-MTHF) over plain folic acid",
    why: "A reduced-function MTHFR variant converts folic acid less efficiently; the methylated form is already active.",
    tone: "consider",
    overTime: "Keeping folate status steady supports long-term cardiovascular and cognitive health with this MTHFR variant.",
  },
  {
    markerId: "vitamin-d", gene: "CYP2R1", when: ["AA", "AG"], bucket: "supplements",
    what: "Check vitamin D and supplement in low-sun months",
    why: "A CYP2R1 variant is linked to lower baseline vitamin D — worth testing rather than guessing.",
    tone: "consider",
    overTime: "Bone density and immune resilience compound over decades — a steady vitamin D level is a long-game lever here.",
  },
  {
    markerId: "vitamin-d-binding", gene: "GC", when: ["AA", "AC"], bucket: "supplements",
    what: "Aim for the higher end of vitamin D intake, with K2",
    why: "A GC (vitamin-D binding protein) variant can mean less circulating D per unit taken.",
    tone: "consider",
  },
  {
    markerId: "fatty-acids", gene: "FADS1", when: ["CC", "CT"], bucket: "supplements",
    what: "Consider a direct EPA/DHA (fish/algae) omega-3",
    why: "A FADS1 variant converts plant ALA to active omega-3 less efficiently — pre-formed EPA/DHA bypasses the bottleneck.",
    tone: "consider",
    overTime: "Efficient omega-3 status supports heart and brain aging — a small daily habit with a long payoff for this variant.",
  },
  {
    markerId: "iron", gene: "HFE (H63D)", when: ["CG", "GG"], bucket: "supplements",
    what: "Don't over-supplement iron without a blood test first",
    why: "An HFE variant can raise iron absorption; extra iron isn't automatically better and can accumulate.",
    tone: "watch",
  },

  // ── Diet ────────────────────────────────────────────────────────────────
  {
    markerId: "lactose", gene: "MCM6", when: ["GG"], bucket: "diet",
    what: "Lean on hard cheese, yogurt, and lactose-free dairy",
    why: "Without the persistence variant, lactase drops after childhood — fermented/aged dairy is far easier.",
    tone: "lean-in",
  },
  {
    markerId: "carb-weight", gene: "FTO", when: ["AA", "AT"], bucket: "diet",
    what: "Anchor meals on protein and fibre; keep refined carbs occasional",
    why: "The FTO risk allele is linked to stronger appetite/weight response — protein blunts it best.",
    tone: "lean-in",
    overTime: "This is a lifelong appetite dial, not a diet — the people it serves best make the protein-first pattern a default, not a phase.",
  },
  {
    markerId: "blood-sugar", gene: "TCF7L2", when: ["CT", "TT"], bucket: "diet",
    what: "Pair carbs with protein/fat/fibre, and walk after meals",
    why: "A TCF7L2 variant is linked to less efficient post-meal blood-sugar handling.",
    tone: "lean-in",
    overTime: "Blunting glucose spikes daily is one of the strongest long-term levers against visceral fat and type-2 diabetes for this genotype.",
  },
  {
    markerId: "fat-response", gene: "APOA2", when: ["CC"], bucket: "diet",
    what: "Watch saturated fat — you may respond to it more strongly",
    why: "An APOA2 variant is associated with greater weight response to high saturated-fat intake.",
    tone: "watch",
  },
  {
    markerId: "triglycerides", gene: "APOA5", when: ["CT", "TT", "CG", "GG"], bucket: "diet",
    what: "Favour unsaturated fats and limit added sugar/alcohol",
    why: "An APOA5 variant is linked to higher triglycerides, which respond well to these swaps.",
    tone: "lean-in",
  },
  {
    markerId: "caffeine", gene: "CYP1A2", when: ["CA", "CC"], bucket: "diet",
    what: "Cut off caffeine by early afternoon",
    why: "A slow-metaboliser CYP1A2 variant means caffeine lingers and disrupts sleep later.",
    tone: "watch",
  },
  {
    markerId: "alcohol-flush", gene: "ALDH2", when: ["AG", "GG"], bucket: "diet",
    what: "Keep alcohol low — flushing signals a real metabolic limit",
    why: "An ALDH2 variant slows clearance of acetaldehyde; the flush is a genuine warning, linked to higher risk with heavy drinking.",
    tone: "watch",
  },

  // ── Habits / movement / sleep ───────────────────────────────────────────
  {
    markerId: "endurance", gene: "PPARGC1A", when: ["GG", "GA"], bucket: "habits",
    what: "Build in steady aerobic work — your engine rewards it",
    why: "A PPARGC1A variant is associated with strong aerobic/endurance adaptation.",
    tone: "lean-in",
    overTime: "Aerobic base built over years is the single most protective habit for this endurance-leaning genome.",
  },
  {
    markerId: "fuel-type", gene: "PPARA", when: ["CC", "CG"], bucket: "habits",
    what: "Longer, lower-intensity sessions suit your fuel metabolism",
    why: "A PPARA variant tilts fuel use toward fat oxidation — better for endurance than sprint work.",
    tone: "lean-in",
  },
  {
    markerId: "strength-response", gene: "AGT", when: ["CC", "CT"], bucket: "habits",
    what: "Progressive resistance training pays off well here",
    why: "An AGT variant is associated with a stronger strength/hypertrophy response to training.",
    tone: "lean-in",
  },
  {
    markerId: "tendon-injury", gene: "COL1A1", when: ["GT", "TT"], bucket: "habits",
    what: "Warm up thoroughly and progress load slowly",
    why: "A COL1A1 variant is linked to connective-tissue/tendon injury risk — ramp, don't spike.",
    tone: "watch",
  },
  {
    markerId: "bdnf-memory", gene: "BDNF", when: ["CC", "CT"], bucket: "habits",
    what: "Use exercise as a mood + focus tool, not just fitness",
    why: "Your BDNF genotype is associated with reliable exercise-driven mood and memory benefits.",
    tone: "lean-in",
    overTime: "Movement as a mental-health habit compounds — with this genotype it's one of the highest-return daily choices.",
  },
  {
    markerId: "dopamine", gene: "COMT", when: ["AA"], bucket: "habits",
    what: "Protect sleep and manage stress load deliberately",
    why: "The 'worrier' COMT variant clears dopamine slowly — sharp under calm, more stress-sensitive under load.",
    tone: "watch",
    overTime: "Stress management isn't optional maintenance for this genotype — it's the lever that keeps the focus advantage from tipping into burnout.",
  },
  {
    markerId: "caffeine", gene: "CYP1A2", when: ["AA"], bucket: "habits",
    what: "You tolerate caffeine well — still don't let it replace sleep",
    why: "A fast-metaboliser CYP1A2 variant clears caffeine quickly; the risk is over-relying on it.",
    tone: "consider",
  },

  // ── Things to steer clear of ────────────────────────────────────────────
  {
    markerId: "alcohol-flush", gene: "ALDH2", when: ["AG", "GG"], bucket: "avoid",
    what: "Heavy or regular alcohol",
    why: "Your ALDH2 variant lets toxic acetaldehyde build up — the flush is a real warning, linked to higher cancer risk with drinking (a possibility, not a certainty).",
    tone: "watch",
  },
  {
    markerId: "lactose", gene: "MCM6", when: ["GG"], bucket: "avoid",
    what: "Large amounts of fresh milk / soft dairy",
    why: "Without the lactase-persistence variant, big doses of lactose commonly mean bloating and discomfort — though tolerance varies and fermented dairy is usually fine.",
    tone: "watch",
  },
  {
    markerId: "caffeine", gene: "CYP1A2", when: ["CA", "CC"], bucket: "avoid",
    what: "Late-afternoon caffeine (incl. strong tea)",
    why: "As a slow metaboliser, caffeine lingers for hours and can quietly wreck sleep — worth avoiding after early afternoon.",
    tone: "watch",
  },
  {
    markerId: "fat-response", gene: "APOA2", when: ["CC"], bucket: "avoid",
    what: "A consistently high saturated-fat diet",
    why: "Your APOA2 variant is associated with a stronger weight response to saturated fat — moderating it tends to help more than it does for most people.",
    tone: "watch",
  },
  {
    markerId: "blood-sugar", gene: "TCF7L2", when: ["CT", "TT"], bucket: "avoid",
    what: "Large refined-carb meals eaten alone",
    why: "A TCF7L2 variant is linked to less efficient blood-sugar handling — big sugar/white-carb hits spike then crash, and over time nudge toward belly fat.",
    tone: "watch",
  },
  {
    markerId: "iron", gene: "HFE (H63D)", when: ["CG", "GG"], bucket: "avoid",
    what: "Blind iron supplementation",
    why: "Your HFE variant can raise iron absorption; piling on more without a blood test risks accumulation rather than benefit.",
    tone: "watch",
  },
]

export function buildDnaPlan(traits: Record<string, string>): DnaPlan {
  const supplements: Recommendation[] = []
  const diet: Recommendation[] = []
  const habits: Recommendation[] = []
  const avoid: Recommendation[] = []
  const overTime: string[] = []

  for (const rule of RULES) {
    const raw = traits[rule.markerId]
    if (!raw) continue
    const g = normalizeGenotype(raw)
    if (!rule.when.map(normalizeGenotype).includes(g)) continue
    const rec: Recommendation = {
      what: rule.what,
      why: rule.why,
      because: { markerId: rule.markerId, gene: rule.gene, genotype: g },
      tone: rule.tone,
    }
    if (rule.bucket === "supplements") supplements.push(rec)
    else if (rule.bucket === "diet") diet.push(rec)
    else if (rule.bucket === "avoid") avoid.push(rec)
    else habits.push(rec)
    if (rule.overTime && !overTime.includes(rule.overTime)) overTime.push(rule.overTime)
  }

  return { supplements, diet, habits, avoid, overTime }
}
