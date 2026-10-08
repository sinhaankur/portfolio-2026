/**
 * Site semantic search — on-device embeddings so the guide understands INTENT,
 * not just keywords. "the thing that tracks space junk" → the Satellite Engine,
 * even though none of those words are in the entry.
 *
 * It reuses the same in-browser WebLLM runtime the opt-in model already loads,
 * so there's no extra download beyond the model the visitor chose. It's layered
 * ON TOP of the deterministic keyword ranking in site-knowledge.ts:
 *
 *   - keyword score is always computed (instant, reliable, works with no model)
 *   - when embeddings are available, a semantic score blends in (hybrid), so a
 *     paraphrase still finds the right project
 *   - everything degrades cleanly: no WebGPU / no model → pure keyword, identical
 *     to before. Semantic is a bonus, never a dependency.
 *
 * The entry index is embedded once (lazily) and cached in memory for the tab.
 */

import { allEntries, entryEmbedText, type Entry } from "@/lib/site-knowledge"

type Embedded = { entry: Entry; vec: number[] }

let indexPromise: Promise<Embedded[]> | null = null

/** Cosine similarity of two equal-length vectors. */
function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

/**
 * Embed a batch of strings via the loaded WebLLM engine. MLC exposes an
 * embeddings endpoint on some models; where it isn't present we return [] and
 * the caller falls back to keyword-only. Import is dynamic so nothing here
 * touches the initial bundle.
 */
async function embedAll(texts: string[]): Promise<number[][]> {
  try {
    const { getWebLLMEngine, isWebGPUAvailable, DEFAULT_WEBLLM_MODEL } = await import(
      "@/lib/webllm-engine"
    )
    if (!isWebGPUAvailable()) return []
    const engine = (await getWebLLMEngine(DEFAULT_WEBLLM_MODEL)) as unknown as {
      embeddings?: { create: (req: { input: string[] }) => Promise<{ data: { embedding: number[] }[] }> }
    }
    if (!engine.embeddings?.create) return [] // this model has no embedding head
    const out = await engine.embeddings.create({ input: texts })
    return out.data.map((d) => d.embedding)
  } catch {
    return []
  }
}

/** Build (once) the embedded index of all knowledge entries. */
async function getIndex(): Promise<Embedded[]> {
  if (indexPromise) return indexPromise
  indexPromise = (async () => {
    const entries = allEntries()
    const vecs = await embedAll(entries.map(entryEmbedText))
    if (vecs.length !== entries.length) return [] // no embeddings → empty index
    return entries.map((entry, i) => ({ entry, vec: vecs[i] }))
  })()
  return indexPromise
}

/** True when a usable embedding index exists (model has an embedding head). */
export async function semanticAvailable(): Promise<boolean> {
  return (await getIndex()).length > 0
}

/**
 * The top-k entries for a query by SEMANTIC similarity. Returns [] when
 * embeddings aren't available — the caller keeps its keyword ranking. Each hit
 * carries its similarity so the caller can blend it with the keyword score.
 */
export async function semanticTop(
  query: string,
  k = 3,
): Promise<{ entry: Entry; score: number }[]> {
  const index = await getIndex()
  if (!index.length) return []
  const [qv] = await embedAll([query])
  if (!qv) return []
  return index
    .map(({ entry, vec }) => ({ entry, score: cosine(qv, vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .filter((h) => h.score > 0.25) // relevance floor so a paraphrase must actually fit
}
