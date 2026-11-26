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

export function SystemsStatus() {
  const [copilot, setCopilot] = useState<Probe>("checking")
  const [feeds, setFeeds] = useState<FeedAge[] | null>(null)

  useEffect(() => {
    // Live liveness ping on the free-GPU copilot Worker.
    const ac = new AbortController()
    fetch(COPILOT_HEALTH, { signal: ac.signal })
      .then((r) => setCopilot(r.ok ? "up" : "down"))
      .catch(() => setCopilot("down"))

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
