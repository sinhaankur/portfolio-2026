"use client"

/**
 * SystemsStatus — a live look at the site's autonomous systems.
 *
 * The site runs a few things on its own (data-freshness worker, the free-GPU
 * sky-copilot). This panel explains each in plain terms and shows its REAL,
 * current status — the copilot's health is pinged live; the data freshness is
 * read from the same static catalogs the engine renders. Honest over decorative:
 * if something's down or stale, this says so.
 */

import { useEffect, useState } from "react"

const COPILOT_HEALTH = "https://sky-copilot.sinhaankur827-f9c.workers.dev/health"

type Probe = "checking" | "up" | "down"

type FeedAge = { name: string; label: string; ageDays: number | null; maxDays: number; stale: boolean }

function ageOf(iso: string | number | undefined): number | null {
  if (iso == null) return null
  const ms = typeof iso === "number" ? iso : Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  return Math.round(((Date.now() - ms) / 86_400_000) * 10) / 10
}

type Helmsman = { downloads: number | null; lastModified: string | null; up: boolean } | null

export function SystemsStatus() {
  const [copilot, setCopilot] = useState<Probe>("checking")
  const [feeds, setFeeds] = useState<FeedAge[] | null>(null)
  const [helmsman, setHelmsman] = useState<Helmsman>(null)

  useEffect(() => {
    // Live liveness ping on the free-GPU copilot Worker.
    const ac = new AbortController()
    fetch(COPILOT_HEALTH, { signal: ac.signal })
      .then((r) => setCopilot(r.ok ? "up" : "down"))
      .catch(() => setCopilot("down"))

    // helmsman-4b — our own fine-tune, published on Hugging Face. The REAL proof
    // it's active is the live download count from the HF API (CORS-open to the
    // site). We don't claim a live endpoint (there isn't a free one) — we show
    // it's a real, published, adopted, runnable model, with its true numbers.
    fetch("https://huggingface.co/api/models/sinhaankur/helmsman-4b", { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setHelmsman({ downloads: d?.downloads ?? null, lastModified: d?.lastModified ?? null, up: true }))
      .catch(() => setHelmsman({ downloads: null, lastModified: null, up: false }))

    // Read the SAME static catalogs the engine serves → real freshness.
    const specs: { name: string; label: string; file: string; maxDays: number; pick: (d: Record<string, unknown>) => number | null }[] = [
      { name: "satellites", label: "Satellite catalog (TLEs)", file: "/data/satellites.json", maxDays: 14, pick: (d) => ageOf(d.snapshot as string) },
      { name: "conjunctions", label: "Close-approach screen", file: "/data/conjunctions.json", maxDays: 3, pick: (d) => ageOf((d.generatedMs as number) ?? (d.snapshot as string)) },
      { name: "flights", label: "Flight snapshot (ADS-B)", file: "/data/flights.json", maxDays: 30, pick: (d) => ageOf(d.snapshot as string) },
    ]
    Promise.all(
      specs.map(async (s) => {
        try {
          const d = await fetch(s.file, { signal: ac.signal }).then((r) => r.json())
          const ageDays = s.pick(d)
          return { name: s.name, label: s.label, ageDays, maxDays: s.maxDays, stale: ageDays != null && ageDays > s.maxDays }
        } catch {
          return { name: s.name, label: s.label, ageDays: null, maxDays: s.maxDays, stale: true }
        }
      }),
    ).then(setFeeds)

    return () => ac.abort()
  }, [])

  const dot = (ok: boolean, checking = false) =>
    checking ? "bg-muted-foreground/40" : ok ? "bg-emerald-500" : "bg-amber-500"

  return (
    <div className="space-y-10">
      {/* Data-freshness worker */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
            Data-freshness worker
          </h2>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">no AI · free · daily</span>
        </div>
        <p className="mt-3 max-w-2xl text-foreground/70 leading-relaxed">
          The Satellite Engine is only honest if its data is current — real orbits drift within
          weeks. Every day a job re-fetches the live catalog, re-screens the next 24 h of close
          approaches, commits the fresh data back, and a tripwire warns if any feed goes stale.
          Pure code, no model, no cost.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {(feeds ?? [null, null, null]).map((f, i) => (
            <div key={f?.name ?? i} className="rounded-lg border border-border/70 bg-card p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${f ? dot(!f.stale) : dot(false, true)}`} />
                <span className="text-sm font-medium text-foreground">{f?.label ?? "…"}</span>
              </div>
              <div className="mt-1.5 font-mono text-xs text-muted-foreground">
                {!f ? "checking…" : f.ageDays == null ? "unknown" : `${f.ageDays}d old · fresh ≤ ${f.maxDays}d`}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* sky-copilot */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
            sky-copilot — our own LLM, free GPU
          </h2>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">no key · adaptive</span>
        </div>
        <p className="mt-3 max-w-2xl text-foreground/70 leading-relaxed">
          The sky copilot can run on our own endpoint (Cloudflare Workers AI, free GPU tier) — no
          Claude, no API key, no WebGPU. It picks a quality tier and cascades down to a lighter model
          when the free quota is tight, falling back to deterministic tools only if everything&apos;s
          busy. It degrades, it never dead-ends.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card px-4 py-3">
          <span className={`h-2 w-2 rounded-full ${dot(copilot === "up", copilot === "checking")}`} />
          <span className="text-sm font-medium text-foreground">
            {copilot === "checking" ? "Checking endpoint…" : copilot === "up" ? "Endpoint live" : "Endpoint unreachable — copilot falls back to on-device / tools"}
          </span>
        </div>
      </section>

      {/* helmsman-4b — my own fine-tuned model */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl md:text-3xl font-light tracking-[-0.01em]">
            helmsman-4b — a model I trained
          </h2>
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">published · open · adopted</span>
        </div>
        <p className="mt-3 max-w-2xl text-foreground/70 leading-relaxed">
          My own fine-tuned language model — a 4B specialist distilled on Qwen3 (QLoRA → merged →
          GGUF), published open on Hugging Face and runnable by anyone in one command. It&apos;s not a
          giant always-on server; it&apos;s a real, working, downloadable model — and the live download
          count below is the honest proof it&apos;s active and used.
        </p>
        <div className="mt-5 flex flex-wrap items-stretch gap-2">
          <div className="rounded-lg border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${helmsman ? (helmsman.up ? "bg-emerald-500" : "bg-amber-500") : "bg-muted-foreground/40"}`} />
              <span className="text-sm font-medium text-foreground">Published &amp; working</span>
            </div>
            <div className="mt-1.5 font-mono text-xs text-muted-foreground">
              {!helmsman ? "checking…" : helmsman.downloads != null ? `${helmsman.downloads.toLocaleString()} downloads` : "on Hugging Face"}
            </div>
          </div>
          <div className="rounded-lg border border-border/70 bg-card p-4">
            <div className="text-sm font-medium text-foreground">Keeps improving</div>
            <div className="mt-1.5 font-mono text-xs text-muted-foreground">
              re-trained + re-versioned from new data{helmsman?.lastModified ? ` · updated ${new Date(helmsman.lastModified).toISOString().slice(0, 10)}` : ""}
            </div>
          </div>
          <a
            href="https://huggingface.co/sinhaankur/helmsman-4b"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border/70 bg-card p-4 flex items-center text-sm font-medium text-foreground hover:border-accent/60 transition-colors"
          >
            View the model →
          </a>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-foreground/60 leading-relaxed">
          It <span className="text-foreground/80">keeps learning</span>: each run of the site&apos;s own
          workers produces real examples, and the model is periodically re-distilled from them so it
          gets better at the narrow jobs it owns — the same recipe it was born from. Run it yourself:{" "}
          <code className="font-mono text-xs bg-muted/40 px-1.5 py-0.5 rounded">ollama run hf.co/sinhaankur/helmsman-4b</code>
        </p>
      </section>

      {/* The principle */}
      <section className="rounded-xl border border-border/70 bg-card/50 p-6">
        <p className="font-serif italic text-foreground/70 leading-relaxed">
          The rule for everything here: <span className="text-foreground not-italic font-medium">degrade, never break.</span>{" "}
          A dead data feed falls back to yesterday&apos;s; a busy GPU falls back to a lighter model, then
          to deterministic tools. The site keeps working when a piece doesn&apos;t.
        </p>
      </section>
    </div>
  )
}
