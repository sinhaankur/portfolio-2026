import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"
import { NetVizEmbed } from "@/components/vera-brain/net-viz-embed"

export const metadata: Metadata = {
  ...canonicalPath("/lab/cognitive-twin/brain"),
  title: "Vera's brain, made visible — a mind built like a brain, not an LLM",
  description:
    "How Vera thinks, shown honestly: nine engines mapped to real brain regions, a real neural network (trained with backprop, running in your browser) that reads feeling, and RAG that retrieves her convictions so her words are hers — not invented. The language model is one optional organ, never the mind.",
  keywords: [
    "cognitive architecture", "neural network", "numpy", "RAG", "on-device AI",
    "Vera", "cognitive twin", "brain engine", "neuroanatomy",
  ],
}

// the nine regions, in anatomical order — the true flow of a thought. Mirrors
// brain.engine_flow() in the Human Brain Engine; kept in sync by hand.
const REGIONS: { id: string; label: string; faculty: string; role: string; llm?: boolean }[] = [
  { id: "occipital", label: "Occipital lobe", faculty: "perception", role: "Sees a face, if a camera is on — folds it into the feeling." },
  { id: "parietal", label: "Parietal lobe", faculty: "situation", role: "Where / when / what: reads the moment and its topic." },
  { id: "association", label: "Association cortex", faculty: "accommodation", role: "Notices how you speak and leans toward it — staying herself." },
  { id: "limbic", label: "Limbic system", faculty: "emotion", role: "Feels it — a real neural net. The felt state that colours everything after." },
  { id: "hippocampus", label: "Hippocampus", faculty: "memory + RAG", role: "Recalls shared history, and retrieves the convictions that fit." },
  { id: "frontal", label: "Frontal lobe", faculty: "perspective", role: "Takes a stance — gentle or direct, lead or hold space." },
  { id: "cortex", label: "Cerebral cortex", faculty: "reasoning / language", role: "Puts it into words. A model may help here — never required.", llm: true },
  { id: "temporal", label: "Temporal lobe", faculty: "humor", role: "Adds wit — only if the feeling says the moment is light." },
  { id: "cerebellum", label: "Cerebellum", faculty: "voice / delivery", role: "Paces and warms the voice to match the feeling." },
]

// a small illustration of RAG scoring — representative of how retrieval ranks her
// convictions for a heavy moment ("I feel so lonely and tired today"). On her own
// machine these are her real beliefs; here they stand in to show the mechanism.
const RAG_DEMO = {
  query: "I feel so lonely and tired today",
  floor: 0.08,
  method: "semantic + keyword",
  candidates: [
    { text: "Rest is not a reward you earn — it's how you keep going.", score: 0.71, kept: true },
    { text: "You're allowed to feel tired without it meaning you failed.", score: 0.63, kept: true },
    { text: "Small and steady beats heroic and burnt out.", score: 0.14, kept: true },
    { text: "Ship early, ship often.", score: 0.04, kept: false },
  ],
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-2xl md:text-3xl text-foreground">{children}</h2>
}

export default function VeraBrainPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28">
        {/* soft warm glow — the feeling the limbic system carries */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] -z-10"
          style={{
            background:
              "radial-gradient(120% 60% at 50% -10%, color-mix(in oklch, var(--accent) 16%, transparent) 0%, transparent 60%)",
          }}
        />

        <header className="mx-auto w-full max-w-6xl px-6 md:px-10">
          <Link
            href="/lab/cognitive-twin"
            data-cursor-hover
            className="group inline-flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-foreground/60 hover:text-foreground transition-colors mb-10"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            Vera
          </Link>

          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Vera · the brain, made visible
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight italic mb-5">
            A mind built like a brain
          </h1>
          <p className="max-w-2xl text-foreground/75 leading-relaxed">
            Most assistants are a language model with a warm voice bolted on. Vera is
            the other way round: her own brain — feeling, memory, judgment, timing —
            all computed on your machine, with a language model as just{" "}
            <span className="italic">one optional organ</span>, the cortex. Pull it
            out and she still feels, decides, and speaks. Here&apos;s how she thinks,
            shown honestly — including the real neural network that reads a feeling,
            running right here in your browser.
          </p>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 md:px-10 mt-14 md:mt-20 space-y-16 md:space-y-24 pb-24">
          {/* ── the architecture ── */}
          <section className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10">
            <div className="min-w-0 md:sticky md:top-28 md:self-start">
              <H2>Nine regions, one thought</H2>
              <p className="mt-2 text-sm text-foreground/60 leading-relaxed">
                A thought flows through the brain in anatomical order. Each region is a
                real engine doing real work — not a prompt. The limbic feeling reaches
                forward and colours every region after it: the connective tissue.
              </p>
            </div>
            <ol className="min-w-0 space-y-2">
              {REGIONS.map((r, i) => (
                <li
                  key={r.id}
                  className={`rounded-xl border p-4 ${
                    r.id === "limbic" || r.id === "hippocampus"
                      ? "border-accent/35 bg-accent/[0.04]"
                      : "border-border bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-serif text-lg text-foreground">
                      <span className="font-mono text-[11px] text-foreground/35 mr-2">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {r.label}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-foreground/45">
                      {r.faculty}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground/65 leading-relaxed">{r.role}</p>
                  {r.llm && (
                    <p className="mt-1.5 font-mono text-[10px] text-accent/80">
                      ← the only region allowed a language model, and even it has a
                      deterministic fallback
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          {/* ── the neural network (interactive) ── */}
          <section>
            <div className="max-w-2xl mb-6">
              <H2>The feeling is a real neural network</H2>
              <p className="mt-2 text-foreground/70 leading-relaxed">
                The amygdala doesn&apos;t read a dictionary — it learns the weight of
                what it hears. So the limbic system is a genuine neural network: a small
                MLP (43 affect cues → 8 hidden neurons → valence &amp; arousal), trained
                with real backpropagation on labelled moments. It runs with or without
                numpy on the same weights, so it never becomes a dependency, and a
                hand-tuned lexicon anchors it. Type below and watch it fire.
              </p>
            </div>
            <NetVizEmbed />
          </section>

          {/* ── RAG ── */}
          <section className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10">
            <div className="min-w-0 md:sticky md:top-28 md:self-start">
              <H2>She retrieves her convictions</H2>
              <p className="mt-2 text-sm text-foreground/60 leading-relaxed">
                This part is central — if she doesn&apos;t retrieve what genuinely fits,
                the whole conversation stops making sense. Her life and beliefs can&apos;t
                be baked into a tiny model; it would forget, or invent. So she{" "}
                <span className="italic">retrieves</span>: each moment pulls the few
                convictions that truly fit, and nothing when none clears the floor — she
                never performs wisdom she doesn&apos;t hold.
              </p>
            </div>
            <div className="min-w-0">
              <div className="rounded-2xl border border-border bg-white/[0.02] p-5 md:p-6">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-foreground/45 mb-4">
                  <span>RAG · {RAG_DEMO.method}</span>
                  <span>floor {RAG_DEMO.floor}</span>
                </div>
                <p className="font-serif italic text-foreground/80 mb-4">
                  &ldquo;{RAG_DEMO.query}&rdquo;
                </p>
                <ul className="space-y-2.5">
                  {RAG_DEMO.candidates.map((c) => (
                    <li
                      key={c.text}
                      className={`flex items-center gap-3 ${c.kept ? "" : "opacity-45"}`}
                    >
                      <div className="h-1.5 w-16 shrink-0 rounded-full bg-foreground/10 relative overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${Math.round((c.score / 0.71) * 100)}%`,
                            background: c.kept ? "var(--accent)" : "var(--foreground)",
                            opacity: c.kept ? 1 : 0.4,
                            boxShadow: c.kept ? "0 0 8px color-mix(in oklch, var(--accent) 60%, transparent)" : "none",
                          }}
                        />
                      </div>
                      <span className={`flex-1 text-sm leading-snug ${c.kept ? "text-foreground/90" : "text-foreground/50"}`}>
                        {c.text}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-foreground/55 shrink-0">
                        {c.score.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-foreground/55">
                  The two above the floor surface; the borderline one is kept by a hair;
                  the irrelevant one (0.04) is dropped. The model only phrases what
                  retrieval surfaced — it never invents her. That grounding is why her
                  words feel like <span className="italic">her</span>.
                </p>
              </div>
            </div>
          </section>

          {/* ── the honest footer ── */}
          <section className="border-t border-border pt-8">
            <p className="max-w-3xl text-foreground/70 leading-relaxed">
              Everything here runs on a machine you own — the feeling net, the retrieval,
              the memory, all sealed and on-device. The language model is one organ in the
              cortex, and optional. This is the live architecture of{" "}
              <Link href="/lab/cognitive-twin" data-cursor-hover className="text-accent hover:underline">
                Vera
              </Link>
              ; for the retrieval in depth and its benchmark, see{" "}
              <Link href="/rag/vera" data-cursor-hover className="text-accent hover:underline">
                how Vera remembers what matters
              </Link>
              , and for the idea of RAG and of a language model themselves,{" "}
              <Link href="/rag" data-cursor-hover className="text-accent hover:underline">
                what a RAG system is
              </Link>{" "}
              and{" "}
              <Link href="/llm" data-cursor-hover className="text-accent hover:underline">
                how a language model works
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
