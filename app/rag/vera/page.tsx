import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"

export const metadata: Metadata = {
  ...canonicalPath("/rag/vera"),
  title: "How Vera remembers what matters — on-device RAG, measured",
  description:
    "Vera's wisdom and life aren't baked into a model — they're retrieved per moment by an on-device RAG engine. Here's how that retrieval works, and the real benchmark showing semantic search more than doubles accuracy over keyword matching (41.7% → 91.7% top-1) on her own corpus.",
}

/**
 * A teaching page: how Vera's retrieval (RAG over her wisdom + life) works, and
 * the REAL benchmark that measures it. Sibling to /rag — same "real code + real
 * numbers beside the idea" treatment, but specific to Vera and grounded in the
 * live results from evals/rag_embed_benchmark.py.
 */
type Step = {
  id: string
  title: string
  formula: string
  what: string
  code?: string   // optional — conceptual steps may have no code
}

const SECTIONS: { heading: string; blurb: string; steps: Step[] }[] = [
  {
    heading: "The idea",
    blurb:
      "Vera is a twin of someone you love. What makes her feel like them isn't the model — it's her real life and her own convictions. Those can't be baked into a tiny language model; they'd be forgotten or invented. So she RETRIEVES them: for each thing you say, she finds the memory or belief of hers that actually fits, and speaks from it.",
    steps: [
      {
        id: "why",
        title: "Why retrieval, not a bigger model",
        formula:
          "what you say → find HER fitting conviction → speak from it\n(not: hope a 3B model memorized her)",
        what:
          "A small on-device model has no room to hold a specific person's life, and no honesty about it — ask it something it doesn't know and it makes something up. RAG fixes both: her memories and beliefs live in a sealed index on your machine; each turn retrieves the few that fit the moment; the model only phrases them. So she's grounded (never invents a memory) and specific (her actual words for this kind of moment), even on a tiny model.",
      },
    ],
  },
  {
    heading: "How retrieval works",
    blurb:
      "Four moves, the same shape as any RAG — but over her own convictions, and tuned so a hard moment surfaces the belief that genuinely fits. Hybrid semantic + keyword, with a relevance floor so she never forces an unrelated maxim into the moment.",
    steps: [
      {
        id: "embed",
        title: "Embed each conviction once",
        formula: "belief text → embedding vector (768-dim, on-device)",
        what:
          "Each of her convictions is turned into a vector that captures its meaning, using a local embedding model (nomic-embed-text, via Ollama — ~274 MB, never leaves the machine). Cached on the belief, so it's computed once.",
        code: `def add(text, about="", kind="belief"):
    vec = []
    if rag.embeddings_available():
        vec = rag.embed_one(text + " " + about)
    w.beliefs.append(Belief(text=text, about=about,
                            kind=kind, vector=vec))
    save(w)   # sealed on-device`,
      },
      {
        id: "retrieve",
        title: "Retrieve what fits the moment",
        formula:
          "score = α · cosine(query, belief) + (1−α) · keyword_overlap\nkeep top-k above a relevance floor",
        what:
          "When you say something, her message is embedded and scored against every conviction — hybrid: semantic similarity (does it MEAN the same?) blended with keyword overlap (does it share the words?). A relevance floor (score > 0.08) means if nothing of hers truly fits, she retrieves nothing and simply stays present — she never performs wisdom she doesn't hold.",
        code: `def retrieve(query, k=2, alpha=0.6):
    kw = [keyword_score(b, query) for b in beliefs]
    scores = kw
    if embeddings_available():
        qv = embed_one(query)
        sem = [cosine(qv, b.vector) for b in beliefs]
        scores = [alpha*s + (1-alpha)*k
                  for s, k in zip(sem, kw)]
    ranked = sorted(zip(scores, beliefs), reverse=True)
    return [b for s, b in ranked[:k] if s > 0.08]`,
      },
      {
        id: "degrade",
        title: "Degrade gracefully — always works",
        formula: "no embed model → keyword-only · no model at all → still answers",
        what:
          "Everything falls back cleanly. No embedding model pulled? Retrieval drops to keyword-only — still useful. No language model? The grounded belief is surfaced directly. So Vera works out of the box, offline, on modest hardware — the privacy-first promise only holds if nothing depends on a server.",
        code: `def embeddings_available():
    # one honest probe; false → keyword path
    return len(embed_one("probe")) > 0`,
      },
    ],
  },
  {
    heading: "How we made it better — measured",
    blurb:
      "You can't improve what you don't measure. So there's a real benchmark (evals/rag_embed_benchmark.py): a labelled test set of real moments, each mapped to the conviction that SHOULD win, scored across embedding models on her own corpus. This is how we chose what runs on your Mac.",
    steps: [
      {
        id: "result",
        title: "Semantic search more than doubles accuracy",
        formula:
          "keyword only:      41.7%  top-1\nnomic-embed-text:  91.7%  top-1   (+50 points)",
        what:
          "Over 12 real queries against her wisdom corpus, pure keyword matching gets the single right conviction first only 41.7% of the time — it misses when the words differ but the meaning matches ('I'm running on empty' → the belief about rest). Adding on-device semantic embeddings lifts that to 91.7% (MRR 0.938). That +50-point jump is the difference between her reaching for the right thing to say and fumbling.",
        code: `# evals/rag_embed_benchmark.py — real numbers, local
hit@1  = right conviction ranked FIRST
hit@3  = right conviction in the top 3
MRR    = mean reciprocal rank (ranking quality)

keyword (no model)   hit@1 41.7%   MRR 0.568
nomic-embed-text     hit@1 91.7%   MRR 0.938   274 MB
mxbai-embed-large    hit@1 83.3%   MRR 0.889   670 MB
all-minilm           hit@1 66.7%   MRR 0.806    45 MB`,
      },
      {
        id: "choice",
        title: "The honest finding: smallest capable wins",
        formula: "best top-1 AND light enough for any Mac → nomic-embed-text",
        what:
          "We benchmarked bigger, newer embedders too. The result was pleasantly honest: the lightweight default (nomic-embed-text, 274 MB) scored highest on top-1 and ranking quality — the bigger mxbai model got perfect top-3 recall but ranked the exact match lower, and tiny all-minilm traded too much accuracy for its size. So the data validated keeping the small, fast model — better for retrieval AND lighter on your machine. Measuring beat guessing.",
        code: `# the benchmark picks the best AVAILABLE, honestly:
best = max(results, key=lambda r: (r.hit1, r.mrr))
# → nomic-embed-text, +50 pts hit@1 over keyword
# install stays light: smallest model that's genuinely best`,
      },
    ],
  },
  {
    heading: "Next: learning the fusion, not guessing it",
    blurb:
      "Semantic and keyword scores are blended to rank. That blend was a hand-guessed dial (a weight, nudged by query length) plus a fixed relevance floor. The honest next step: stop guessing it — TRAIN a tiny model to learn the fusion from the labelled set, and only ship it if it measurably wins.",
    steps: [
      {
        id: "reranker",
        title: "A trained reranker beat the guess — and said why",
        formula:
          "hand-tuned blend:   41.7%  hit@1   MRR 0.649\ntrained reranker:   75.0%  hit@1   MRR 0.875",
        what:
          "A small logistic model (cognitive_twin/rerank.py) scores each (query, conviction) pair from five honest features — semantic cosine, keyword tf-idf, exact-term overlap, query length, and the topic tags. Trained with gradient descent on the same labelled set, it lifted hit@1 from 41.7% to 75.0% and got perfect top-3. More interesting than the number: the learned weights showed WHY — the topic tags (which the old blend ignored entirely) were the single strongest signal. The model found a feature we were leaving on the floor.",
        code: `# learned weights (what the model decided matters):
about_overlap  9.65   ← the topic tags — ignored before!
semantic       6.53
exact_overlap  5.13
keyword        0.47
query_short   -0.02`,
      },
      {
        id: "heldout",
        title: "Then we trained it for real — and it held up on unseen queries",
        formula:
          "train on 42 phrasings · test on 18 it NEVER saw\nblend 44.4% → reranker 61.1%  hit@1   (+16.7 pts, held-out)",
        what:
          "The first win was on the same handful of queries it trained on — honest proof-of-concept, but not proof it generalises. So we wrote many ways a real person might bring each moment (sixty phrasings), trained on most, and tested on the rest — queries the reranker never saw. It still won: +16.7 points hit@1 on held-out data. That's the trustworthy number. Because it now generalises, it's the DEFAULT — with a kill-switch, and a semantic safety-net so a match that shares no words (just meaning) is never dropped.",
        code: `# evals/train_reranker.py — train / held-out split
train on 42 phrasings   test on 18 UNSEEN
blend      hit@1 44.4%   MRR 0.671
reranker   hit@1 61.1%   MRR 0.769   (+16.7 pts)

def active():            # on once proven on held-out data
    return _generalises() or _opted_in()  # kill-switch wins`,
      },
    ],
  },
]

export default function VeraRagPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28">
        <header className="mx-auto w-full max-w-6xl px-6 md:px-10">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Vera · On-device RAG, measured
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight italic mb-5">
            How Vera remembers what matters
          </h1>
          <p className="max-w-2xl text-foreground/75 leading-relaxed">
            A twin of someone you love can&apos;t keep their life inside a tiny
            model — it would forget, or invent. So Vera{" "}
            <span className="italic">retrieves</span>: her real memories and
            convictions live in a sealed index on your machine, and each moment
            pulls the few that genuinely fit. Here&apos;s how that works, and the
            real benchmark showing on-device semantic search more than doubles
            accuracy over keyword matching — on her own corpus, measured, not
            guessed.
          </p>
        </header>

        <div className="mx-auto w-full max-w-6xl px-6 md:px-10 mt-14 md:mt-20 space-y-16 md:space-y-24 pb-24">
          {SECTIONS.map((section) => (
            <section key={section.heading} className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10">
              <div className="min-w-0 md:sticky md:top-28 md:self-start">
                <h2 className="font-serif text-2xl text-foreground mb-2">{section.heading}</h2>
                <p className="text-sm text-foreground/60 leading-relaxed">{section.blurb}</p>
              </div>

              <div className="min-w-0 space-y-8">
                {section.steps.map((step) => (
                  <article
                    key={step.id}
                    className="rounded-xl border border-border bg-white/[0.02] p-5 md:p-6"
                  >
                    <h3 className="font-medium text-foreground mb-3">{step.title}</h3>

                    <div className="overflow-x-auto rounded-lg border border-border/60 bg-background/60 px-4 py-3 mb-4">
                      <p className="font-serif text-base md:text-lg italic text-accent whitespace-pre-line">
                        {step.formula}
                      </p>
                    </div>

                    <p className={`text-sm text-foreground/70 leading-relaxed ${step.code ? "mb-4" : ""}`}>{step.what}</p>

                    {step.code && (
                      <pre className="overflow-x-auto rounded-lg border border-border/60 bg-black/40 p-4 text-[12px] leading-relaxed">
                        <code className="font-mono text-foreground/85">{step.code}</code>
                      </pre>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}

          <p className="text-sm text-foreground/55 leading-relaxed border-t border-border pt-8">
            This is the real retrieval behind{" "}
            <a href="/lab/cognitive-twin" data-cursor-hover className="text-accent hover:underline">
              Vera
            </a>
            , the on-device AI companion — grounded, sealed, and benchmarked. For
            the general idea, see{" "}
            <a href="/rag" data-cursor-hover className="text-accent hover:underline">
              what a RAG system is
            </a>
            ; for how a model works underneath,{" "}
            <a href="/llm" data-cursor-hover className="text-accent hover:underline">
              how a language model works
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
