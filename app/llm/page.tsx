import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { CustomCursor } from "@/components/custom-cursor"

export const metadata: Metadata = {
  ...canonicalPath("/llm"),
  title: "How a Language Model Works",
  description:
    "What an LLM actually does, step by step and honestly: text → tokens → embeddings → attention → layers → next-token. The real machinery every chat model shares, shown beside the real code of a small local model you can crack open and watch — the LLM Internals Lab.",
}

/**
 * A teaching page: how an LLM works, each step beside the REAL code from an
 * on-device "LLM Internals Lab" (unhosted-core/models/llm-lab — it loads a small
 * open model and prints tokens/embeddings/attention/logit-lens/next-token for any
 * prompt). Same pattern as /rag and /universe-engine/math: real code, honest math,
 * nothing decorative. You can't crack open Claude/GPT (weights are hidden), but a
 * small open model uses the exact same machinery — so this is a true explanation.
 */
type Step = {
  id: string
  title: string
  formula: string
  what: string
  code: string
}

const SECTIONS: { heading: string; blurb: string; steps: Step[] }[] = [
  {
    heading: "The idea",
    blurb:
      "A language model does one thing, over and over: predict the next token. That's it. Everything that looks like understanding — answering, coding, reasoning — falls out of a model that got very good at 'what word comes next', run in a loop. This page opens a small open model and watches each step of that prediction happen, because the machinery is identical to the big hosted ones (whose weights you can't see).",
    steps: [
      {
        id: "loop",
        title: "The whole pipeline",
        formula:
          "text → tokens → embeddings → [attention → feed-forward] × N layers → next-token probabilities",
        what:
          "Five stages. TOKENIZE: split text into tokens (word-pieces) and map each to a number. EMBED: turn each token-number into a vector. LAYERS: repeat — attention (each token looks at the others) then a feed-forward step — dozens of times, refining a running 'meaning' at each position. UNEMBED: project the final vector back to a probability over every possible next token. Pick one, append it, repeat. The rest of this page is each stage, with the real code that prints it.",
        code:
`# llm-lab: load a small open model and run one forward pass
model, tok = load("TinyLlama-1.1B-Chat")   # same architecture as big chat models
ids  = tok(text)                            # text  → tokens
out  = model(ids, output_attentions=True)   # tokens → all the internals
# out.logits[-1] holds the scores for the NEXT token — the whole point`,
      },
    ],
  },
  {
    heading: "1 · Tokens",
    blurb:
      "A model never sees letters or words — it sees tokens: integer IDs for common chunks of text, often word-pieces rather than whole words. This is why models miscount letters or split odd words strangely: they reason in tokens, not characters.",
    steps: [
      {
        id: "tokenize",
        title: "Text → a list of integers",
        formula: "\"understanding\" → [under, stand, ing] → [1234, 5678, 91]",
        what:
          "The tokenizer breaks text into known pieces and returns their IDs. A short common word is one token; a rare or long one is several. The model only ever operates on these numbers — the words are just how we read them.",
        code:
`# llm-lab — show_tokenization()
ids = tok(prompt)["input_ids"][0]
for i in ids:
    print(f"{i:>6}  {tok.decode([i])!r}")   # each id and the text piece it means
# "a 'token' is often a word-piece, not a whole word."`,
      },
    ],
  },
  {
    heading: "2 · Embeddings",
    blurb:
      "Each token ID is looked up in a big table and becomes a vector — a long list of numbers. That vector is the model's starting 'meaning' for the token. Similar tokens start near each other; the layers then reshape these vectors using context.",
    steps: [
      {
        id: "embed",
        title: "Token ID → a vector",
        formula: "embed(token_id) → [0.02, −0.11, 0.4, …]   (d dimensions)",
        what:
          "The embedding matrix is one row per possible token. Looking up a token's row gives its vector. This is the same idea as the embeddings in a RAG system — meaning as a point in space — except here it's the model's own internal representation, which every layer will refine.",
        code:
`# the first thing the model does with the token ids
hidden = model.get_input_embeddings()(ids)   # ids → vectors, shape [seq, d]
# 'd' is the model width (e.g. 2048 for TinyLlama). Every later stage
# transforms this [seq, d] tensor and hands it to the next.`,
      },
    ],
  },
  {
    heading: "3 · Attention",
    blurb:
      "This is the engine. At each layer, every token looks at every earlier token and decides how much to borrow from each — that's attention. It's how 'it' finds its noun, how a question connects to its subject, how context flows. You can literally read these weights out and see what attends to what.",
    steps: [
      {
        id: "attention",
        title: "Every token weighs every other",
        formula: "attention(Q, K, V) = softmax( Q·Kᵀ / √d ) · V",
        what:
          "Each token produces a Query, and every token a Key and Value. The dot product Q·Kᵀ scores how relevant each other token is; softmax turns those scores into weights that sum to 1; the weighted sum of Values is what the token takes away. Scaling by √d keeps the scores stable. Stack many such 'heads' and many layers, and this simple operation composes into language understanding.",
        code:
`# llm-lab — attention weights come straight out of the model
out = model(ids, output_attentions=True)
attn = out.attentions[layer][0, head]   # [seq, seq]: row i = what token i attends to
# each row is a softmax over earlier tokens — read it to see what looks at what.
# (eager attention is required so the weights are exposed.)`,
      },
    ],
  },
  {
    heading: "4 · Layers (the logit lens)",
    blurb:
      "The attention-then-feed-forward block repeats dozens of times, each layer refining the vectors. A beautiful trick — the 'logit lens' — projects the half-finished vector at EACH layer through the output head, so you can watch the model's guess sharpen from noise into the answer as it goes deeper.",
    steps: [
      {
        id: "logit-lens",
        title: "Watch the answer form, layer by layer",
        formula: "guessₗ = unembed( norm( hiddenₗ ) )   for each layer ℓ",
        what:
          "Normally you only see the model's final answer. The logit lens reads every layer's intermediate state as if it were final — so you see early layers guessing vaguely and later layers locking onto the real next token. It's the closest thing to watching a model 'decide', and it's only possible because this model is open.",
        code:
`# llm-lab — show_logit_lens(): project every layer through the output head
final_norm, head = final_norm_and_head(model)
for L, hidden in enumerate(out.hidden_states):
    logits_L = head(final_norm(hidden[0, -1]))     # this layer's 'best guess'
    top = tok.decode(logits_L.argmax())
    print(f"layer {L:>2}: {top!r}")                # watch it converge`,
      },
    ],
  },
  {
    heading: "5 · The next token",
    blurb:
      "At the end, the final vector for the last position is projected to a score (a logit) for every token in the vocabulary. Softmax turns those into probabilities. The model samples or picks the top one — that's the next token. Append it and run the whole thing again.",
    steps: [
      {
        id: "next-token",
        title: "Scores → probabilities → a choice",
        formula: "P(next) = softmax(logits)      logits = unembed(final_hidden)",
        what:
          "The output head turns the last position's final vector into one number per possible token. Softmax normalizes them into a probability distribution. 'Temperature' scales the logits before softmax — low = confident/repetitive, high = varied/creative. This single choice, repeated, is the entire act of writing.",
        code:
`# llm-lab — show_next_token()
logits = out.logits[0, -1]              # scores for the position after the last token
probs  = F.softmax(logits, dim=-1)      # → a probability for every token
top = probs.topk(k)
for p, i in zip(top.values, top.indices):
    print(f"{tok.decode([i])!r:<16}{p.item():>8.1%}")   # the model's ranked guesses`,
      },
      {
        id: "why-hallucinate",
        title: "Why this explains hallucination — and RAG",
        formula: "no fact in the weights → it still predicts *a* next token (a guess)",
        what:
          "Because the model always outputs a next-token distribution, it never says 'I don't have this' on its own — it produces the most plausible-sounding continuation, true or not. That's hallucination, and it's why Retrieval-Augmented Generation exists: put the real facts in the context first, so the next-token guess is grounded in truth instead of vibes. Understanding this stage is understanding both the power and the failure of every LLM.",
        code:
`# The fix, in one line of intent (see the RAG page):
#   retrieve real passages → put them in the prompt →
#   now the next-token prediction is anchored to your documents, with citations.`,
      },
    ],
  },
]

export default function LlmPage() {
  return (
    <>
      <CustomCursor />
      <Navbar />
      <main id="main" className="relative min-h-screen bg-background text-foreground pt-24 md:pt-28">
        <header className="mx-auto w-full max-w-6xl px-6 md:px-10">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Language Models · Explained
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight italic mb-5">
            How a language model works.
          </h1>
          <p className="max-w-2xl text-foreground/75 leading-relaxed">
            An LLM does one thing, in a loop: <span className="italic">predict the
            next token</span>. Below is the whole machinery behind that — text →
            tokens → embeddings → attention → layers → next-token — each step shown
            beside the real code of a small open model you can crack open and watch.
            You can&apos;t open Claude or GPT (their weights are hidden), but a small
            model uses the <span className="italic">exact same</span> parts, so this
            is a true explanation, not a metaphor. Companion to{" "}
            <a href="/rag" data-cursor-hover className="text-accent hover:underline">what is RAG</a>{" "}
            and{" "}
            <a href="/universe-engine/math" data-cursor-hover className="text-accent hover:underline">the engine math</a>.
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
            This is a real, runnable lab — the <span className="italic">LLM Internals
            Lab</span> loads a small open model and prints exactly these steps for any
            prompt. The point: an LLM isn&apos;t magic, it&apos;s five stages you can
            watch. See also{" "}
            <a href="/rag" data-cursor-hover className="text-accent hover:underline">
              how RAG grounds it in real documents
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
