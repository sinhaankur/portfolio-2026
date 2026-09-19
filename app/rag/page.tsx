import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"

export const metadata: Metadata = {
  ...canonicalPath("/rag"),
  title: "What is a RAG System?",
  description:
    "Retrieval-Augmented Generation, explained plainly and honestly: how you ground a language model in your own documents — chunk, embed, retrieve, then generate a cited answer — shown beside the real code of a small, fully on-device RAG engine.",
}

/**
 * A teaching page: what RAG is and how it works, each step explained beside the
 * REAL code from an on-device RAG engine (~/Documents/rag-engine — chunk / embed
 * / store / retrieve / ask). The code is copied so the page is a true
 * explanation of a working system, not a decorative diagram.
 */
type Step = {
  id: string
  title: string
  formula: string   // a compact "shape" line for the step
  what: string      // plain-English: what it does + why it matters
  code: string      // the real code that runs it
}

const SECTIONS: { heading: string; blurb: string; steps: Step[] }[] = [
  {
    heading: "The idea",
    blurb:
      "A language model only knows what it saw in training. RAG — Retrieval-Augmented Generation — lets it answer from a specific body of knowledge instead: you retrieve the relevant facts first, hand them to the model as context, and it generates an answer grounded in them. Less hallucination, real citations, and you can update the knowledge without retraining anything.",
    steps: [
      {
        id: "loop",
        title: "The whole loop",
        formula:
          "docs → chunk → embed → store\nquestion → embed → search → top-k chunks\nchunks + question → LLM → grounded, cited answer",
        what:
          "Four moves. INDEX once: split your documents into chunks and turn each into a vector (an embedding that captures meaning), stored in a searchable index. RETRIEVE per question: embed the question the same way and find the chunks whose meaning is closest. AUGMENT: put those chunks into the prompt. GENERATE: the model answers from that context, citing where each fact came from. Everything below is one honest implementation of exactly this.",
        code: `# rag/__init__.py — the public API is the loop
store = build_index("~/Documents/notes")     # ingest → chunk → embed → store
print(answer(store, "what did I decide?").with_citations())
#            └─ retrieve top-k ─┘  └─ generate grounded answer + sources ─┘`,
      },
    ],
  },
  {
    heading: "1 · Chunk",
    blurb:
      "You can't retrieve a whole 40-page document — it won't fit in the prompt, and most of it is irrelevant to any one question. So you split documents into small, self-contained passages. The art is splitting on meaning (paragraphs, headings) with a little overlap, so a fact that straddles a boundary still lands whole somewhere.",
    steps: [
      {
        id: "chunk",
        title: "Split into overlapping, citable passages",
        formula: "text → [chunk₀, chunk₁, …]   each ≤ max_chars, sharing `overlap`",
        what:
          "Split on blank lines (paragraphs / markdown blocks), then pack paragraphs into chunks up to a size cap, carrying a small tail of the previous chunk as overlap so a fact spanning a boundary survives. Every chunk remembers its source file and position — that record is what makes the final answer citable rather than a black box.",
        code: `# rag/ingest.py — chunk_text()
paras = [p.strip() for p in _PARA.split(text) if p.strip()]
for p in paras:
    if buf and len(buf) + 2 + len(p) > max_chars:
        chunks.append(buf)
        tail = buf[-overlap:] if overlap else ""     # carry context across the seam
        buf = (tail + "\\n\\n" + p).strip() if tail else p
    else:
        buf = (buf + "\\n\\n" + p).strip() if buf else p`,
      },
    ],
  },
  {
    heading: "2 · Embed",
    blurb:
      "An embedding turns a piece of text into a vector — a list of numbers — positioned so that texts with similar meaning sit close together. This is what lets you search by meaning instead of by exact keyword. Run locally, no text ever leaves your machine.",
    steps: [
      {
        id: "embed",
        title: "Text → vector, on-device",
        formula: "embed(text) → [0.021, −0.11, …]   (a point in meaning-space)",
        what:
          "Call a local embedding model (here via Ollama or any OpenAI-compatible server such as Unhosted) and get back a fixed-length vector for each chunk. The honest part: if no embedding model is available, the engine doesn't pretend — it reports so and falls back to keyword search, so it still answers from the real documents rather than failing.",
        code: `# rag/embed.py — embed_one() (Ollama path) + the honest fallback switch
out = _post(base_url() + "/api/embeddings",
            {"model": model(), "prompt": text})
return list(out.get("embedding", []))

def available() -> bool:
    """True IFF a real embedding model answers with a non-empty vector."""
    try:    return len(embed_one("probe")) > 0
    except Exception: return False`,
      },
    ],
  },
  {
    heading: "3 · Retrieve",
    blurb:
      "This is the heart of RAG — and where quality is won or lost. Bad chunks in, bad answer out. You embed the question, compare it against every stored chunk by cosine similarity, and take the closest few. A robust engine also blends in a keyword score, so exact terms and IDs aren't lost to fuzzy meaning.",
    steps: [
      {
        id: "cosine",
        title: "Cosine similarity — closeness in meaning",
        formula: "sim(q, c) = (q · c) / (‖q‖ ‖c‖)   →  rank, take top-k",
        what:
          "Two vectors point in a similar direction when their normalized dot product is near 1. Normalize every chunk vector once, then a single matrix–vector product scores the question against the whole corpus at once. The top-k highest scores are the passages most likely to hold the answer.",
        code: `# rag/store.py — _semantic_scores() (rows are pre-normalized)
q = np.array(query_vec, dtype=np.float32)
nq = np.linalg.norm(q) or 1.0
sims = self._mat @ (q / nq)          # cosine for every chunk in one product
return (sims + 1.0) / 2.0            # map -1..1 → 0..1`,
      },
      {
        id: "hybrid",
        title: "Hybrid — meaning + exact words",
        formula: "score = α · semantic + (1 − α) · keyword",
        what:
          "Pure vector search misses exact strings — a case number, a name, a Khesra plot ID. Pure keyword search misses paraphrases. Blending both (here α = 0.6, leaning semantic) gets the best of each; and when there's no embedding model at all, α collapses to keyword-only automatically — the graceful degradation that keeps the engine useful everywhere.",
        code: `# rag/store.py — search()
kw = self._keyword_scores(query)                 # TF-IDF style, always computed
if self._mat is not None and query_vec:
    sem = self._semantic_scores(query_vec)
    final = alpha * sem + (1 - alpha) * kw        # hybrid
else:
    final = kw                                    # no embeddings → keyword-only
order = np.argsort(-final)[:k]`,
      },
    ],
  },
  {
    heading: "4 · Generate",
    blurb:
      "Finally, the retrieved passages go to the language model with one instruction: answer using only this context, and cite it. That constraint is what turns a confident guesser into a grounded, checkable assistant — and it's why the answer can point back at exactly which document each fact came from.",
    steps: [
      {
        id: "prompt",
        title: "Ground the model in the retrieved context",
        formula: "answer = LLM( system: “use only this context” + context + question )",
        what:
          "Build the prompt from the top chunks (each tagged with a source marker), tell the model to answer strictly from them and to cite the [n] markers, and run it on a local LLM. The system instruction is doing real work: it's the leash that keeps the answer inside your documents.",
        code: `# rag/ask.py
_SYSTEM = ("You answer strictly from the provided context. If the answer is not "
           "in the context, say you don't know from these documents. Be concise "
           "and cite the sources you used by their [n] markers.")

payload = {"model": _llm_model(), "prompt":
           f"{_SYSTEM}\\n\\nContext:\\n{context}\\n\\nQuestion: {question}\\n\\nAnswer:"}`,
      },
      {
        id: "cite",
        title: "Answer with its sources",
        formula: "Answer(text, hits)  →  text + “[n] source#ordinal”",
        what:
          "The result carries not just the prose but the exact chunks it was built from, so every answer is auditable. And if no LLM is reachable, it returns the most relevant passage extractively — still grounded, still cited. A RAG system's honesty is this: it should always be able to show its work, and never invent a source.",
        code: `# rag/ask.py — Answer.with_citations()
lines = [self.text, "", "Sources:"]
for i, h in enumerate(self.hits, 1):
    lines.append(f"  [{i}] {h.source}#{h.ordinal}  (score {h.score:.2f})")
return "\\n".join(lines)`,
      },
    ],
  },
  {
    heading: "Where it gets hard",
    blurb:
      "The diagram is simple; the quality is not. Everything that separates a toy from a trustworthy RAG lives in these details — and being honest about them is part of the point.",
    steps: [
      {
        id: "hard",
        title: "The parts that actually decide quality",
        formula: "retrieval quality  ≈  system quality",
        what:
          "Chunking sensibly (too big = noise, too small = no context). Hybrid search, because pure vectors miss exact IDs. Re-ranking the top results with a stronger model. Fitting only what matters into a finite context window. Keeping citations truthful. And degrading gracefully — no embed model, no LLM, no internet — so the system stays useful and never fakes an answer. Get retrieval right and a small local model beats a huge one guessing.",
        code: `# The graceful-degradation contract, in one place:
#   embeddings present  → hybrid semantic + keyword     (best)
#   embeddings absent   → keyword-only                  (still grounded)
#   LLM present         → composed, cited answer
#   LLM absent          → most-relevant passage, cited  (never a hard fail)`,
      },
    ],
  },
]

export default function RagPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28">
        <header className="mx-auto w-full max-w-6xl px-6 md:px-10">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Retrieval-Augmented Generation · Explained
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight italic mb-5">
            What is a RAG system?
          </h1>
          <p className="max-w-2xl text-foreground/75 leading-relaxed">
            A language model only knows what it saw in training. A{" "}
            <span className="italic">RAG</span> system — Retrieval-Augmented
            Generation — lets it answer from <span className="italic">your</span>{" "}
            documents instead: retrieve the relevant facts, hand them to the model,
            and generate a grounded, cited answer. Below is the whole idea, step by
            step, shown beside the real code of a small, fully on-device RAG engine
            — chunk, embed, retrieve, generate — that works even with no embedding
            model and no internet.
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

                    <p className="text-sm text-foreground/70 leading-relaxed mb-4">{step.what}</p>

                    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-black/40 p-4 text-[12px] leading-relaxed">
                      <code className="font-mono text-foreground/85">{step.code}</code>
                    </pre>
                  </article>
                ))}
              </div>
            </section>
          ))}

          <p className="text-sm text-foreground/55 leading-relaxed border-t border-border pt-8">
            This is a real, working engine — chunk / embed / retrieve / generate,
            fully on-device, degrading gracefully when a model isn&apos;t there. See
            the companion{" "}
            <a href="/universe-engine/math" data-cursor-hover className="text-accent hover:underline">
              Universe Engine math
            </a>{" "}
            and{" "}
            <a href="/waves/math" data-cursor-hover className="text-accent hover:underline">
              the math behind the waves
            </a>{" "}
            for the same &ldquo;real code beside the idea&rdquo; treatment.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
