"use client"

/**
 * StatsDashboard — the owner's one-place view of Cloudflare Web Analytics + GA4.
 *
 * Reads from the private analytics-proxy Worker (stats-api.sinhaankur.com), which
 * holds the API tokens as Worker secrets and gates access with a shared key. The
 * key is entered once here and kept on-device (localStorage) — it never ships in
 * the bundle and the page is noindex, so this stays owner-only.
 *
 * Degrades gracefully: no key → a prompt; Worker not deployed / unreachable → a
 * clear message with the setup steps, not a broken page.
 */

import { useCallback, useEffect, useState } from "react"
import { Container } from "@/components/container"

const API_BASE = "https://stats-api.sinhaankur.com"
const KEY_STORAGE = "stats-key-v1"

type CfBlock = {
  pageviews?: number
  topPages?: { path: string; views: number }[]
  countries?: { country: string; views: number }[]
  error?: string
}
type GaRow = { path: string; views: number; users?: number; avgSessionSec?: number; engagementSec?: number }
type GaBlock = {
  topPages?: GaRow[]
  byTimeSpent?: { path: string; avgSecPerView: number; views: number }[]
  totalViews?: number
  error?: string
}
type StatsResponse = {
  range: { days: number }
  cloudflare: CfBlock
  ga4: GaBlock
  at: number
}

const RANGES = [7, 28, 90] as const

function fmtSec(s: number) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${r}s`
}

export function StatsDashboard() {
  const [key, setKey] = useState<string>("")
  const [keyInput, setKeyInput] = useState("")
  const [days, setDays] = useState<number>(7)
  const [data, setData] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE)
    if (saved) setKey(saved)
  }, [])

  const load = useCallback(
    async (k: string, d: number) => {
      if (!k) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/?key=${encodeURIComponent(k)}&days=${d}`)
        if (res.status === 401) {
          setError("That key was rejected. Check STATS_TOKEN on the Worker.")
          setData(null)
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setData((await res.json()) as StatsResponse)
      } catch (e) {
        setError(
          `Couldn't reach the analytics proxy (${String(e instanceof Error ? e.message : e)}). ` +
            "The Worker may not be deployed yet — see the setup note below.",
        )
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (key) load(key, days)
  }, [key, days, load])

  const saveKey = () => {
    const k = keyInput.trim()
    if (!k) return
    localStorage.setItem(KEY_STORAGE, k)
    setKey(k)
  }
  const forget = () => {
    localStorage.removeItem(KEY_STORAGE)
    setKey("")
    setData(null)
    setError(null)
  }

  return (
    <Container>
      <header className="mb-10 max-w-3xl">
        <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-accent mb-4">Owner only · not indexed</p>
        <h1 className="font-display text-4xl md:text-5xl font-light tracking-[-0.02em]">Stats.</h1>
        <p className="mt-4 font-sans text-base text-foreground/70 leading-relaxed">
          Cloudflare Web Analytics and Google Analytics 4 in one place — top pages,
          visitors, countries, and where people spend the most time. Fetched live
          from a private Worker that holds the API tokens; the access key stays on
          this device.
        </p>
      </header>

      {/* Key gate */}
      {!key ? (
        <div className="max-w-md rounded-2xl border border-border bg-card/40 p-5">
          <label htmlFor="stats-key" className="block font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
            Access key (STATS_TOKEN)
          </label>
          <div className="flex gap-2">
            <input
              id="stats-key"
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveKey()}
              placeholder="paste the shared key"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <button
              type="button"
              onClick={saveKey}
              data-cursor-hover
              className="rounded-lg bg-foreground px-4 py-2 font-mono text-[11px] tracking-widest uppercase text-background transition-opacity hover:opacity-90"
            >
              Unlock
            </button>
          </div>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground/80">
            The same random string set as the Worker&apos;s <code>STATS_TOKEN</code> secret.
          </p>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-border bg-secondary/30 p-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDays(r)}
                  data-cursor-hover
                  className={`rounded-full px-3.5 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors ${
                    days === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => load(key, days)}
              data-cursor-hover
              className="rounded-full border border-border px-4 py-1.5 font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={forget}
              data-cursor-hover
              className="ml-auto rounded-full px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-muted-foreground/70 hover:text-foreground transition-colors"
            >
              Forget key
            </button>
          </div>

          {error && (
            <div className="mb-8 rounded-2xl border border-red-400/40 bg-red-400/5 p-5">
              <p className="font-sans text-sm text-red-300">{error}</p>
            </div>
          )}

          {data && (
            <div className="space-y-10">
              {/* Headline numbers */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Pageviews · Cloudflare" value={data.cloudflare?.pageviews?.toLocaleString() ?? "—"} />
                <Stat label="Pageviews · GA4" value={data.ga4?.totalViews?.toLocaleString() ?? "—"} />
                <Stat label="Range" value={`${data.range.days} days`} />
              </div>

              {/* Top pages — GA4 (with engagement) */}
              <Panel title="Top pages" source="GA4">
                {data.ga4?.error ? (
                  <Empty note={data.ga4.error} />
                ) : (
                  <RankList
                    rows={(data.ga4.topPages || []).map((r) => ({
                      label: r.path,
                      value: `${r.views.toLocaleString()} views`,
                      sub: r.users != null ? `${r.users.toLocaleString()} users` : undefined,
                    }))}
                  />
                )}
              </Panel>

              {/* Where users spend the most time — GA4 */}
              <Panel title="Where people spend the most time" source="GA4 · engagement / view">
                {data.ga4?.byTimeSpent?.length ? (
                  <RankList
                    rows={data.ga4.byTimeSpent.map((r) => ({
                      label: r.path,
                      value: fmtSec(r.avgSecPerView),
                      sub: `${r.views.toLocaleString()} views`,
                    }))}
                  />
                ) : (
                  <Empty note="No engagement data yet." />
                )}
              </Panel>

              {/* Countries — Cloudflare */}
              <Panel title="Countries" source="Cloudflare">
                {data.cloudflare?.countries?.length ? (
                  <RankList
                    rows={data.cloudflare.countries.map((c) => ({ label: c.country, value: c.views.toLocaleString() }))}
                  />
                ) : (
                  <Empty note={data.cloudflare?.error || "No country data yet."} />
                )}
              </Panel>

              <p className="font-mono text-[10px] text-muted-foreground/70">
                Updated {new Date(data.at).toLocaleString()}.
              </p>
            </div>
          )}
        </>
      )}

      {/* Setup note — shown until data flows, so a fresh deploy is self-documenting. */}
      {(!key || error) && (
        <div className="mt-10 max-w-2xl rounded-2xl border border-border bg-card/30 p-5">
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-3">One-time setup</p>
          <ol className="space-y-2 font-sans text-[13px] text-foreground/70 leading-relaxed list-decimal pl-5">
            <li>
              In <code className="text-foreground/85">sinhaankur-assets/analytics-proxy</code>: set{" "}
              <code>CF_SITE_TAG</code> in <code>wrangler.toml</code> (from the Cloudflare Web Analytics dashboard).
            </li>
            <li>
              Add the three secrets:{" "}
              <code className="text-foreground/85">wrangler secret put CF_API_TOKEN</code>,{" "}
              <code>GA_SA_JSON</code>, and <code>STATS_TOKEN</code> (a random string).
            </li>
            <li>
              Deploy: <code className="text-foreground/85">wrangler deploy</code> — it creates{" "}
              <code>stats-api.sinhaankur.com</code>.
            </li>
            <li>Paste the same <code>STATS_TOKEN</code> above to unlock this page.</li>
          </ol>
        </div>
      )}
    </Container>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-light tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function Panel({ title, source, children }: { title: string; source: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-sans text-lg font-medium text-foreground">{title}</h2>
        <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground/70">{source}</span>
      </div>
      <div className="rounded-2xl border border-border bg-card/40 p-2">{children}</div>
    </section>
  )
}

function RankList({ rows }: { rows: { label: string; value: string; sub?: string }[] }) {
  const max = rows.length
  return (
    <ul className="divide-y divide-border/50">
      {rows.map((r, i) => (
        <li key={r.label + i} className="flex items-center gap-3 px-3 py-2.5">
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60 w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
          <span className="min-w-0 flex-1 truncate font-sans text-[13px] text-foreground/85" title={r.label}>{r.label}</span>
          {r.sub && <span className="font-mono text-[10px] text-muted-foreground shrink-0">{r.sub}</span>}
          <span className="font-mono text-[12px] tabular-nums text-foreground shrink-0">{r.value}</span>
        </li>
      ))}
      {max === 0 && <Empty note="Nothing here yet." />}
    </ul>
  )
}

function Empty({ note }: { note: string }) {
  return <p className="px-3 py-4 font-mono text-[11px] text-muted-foreground/70">{note}</p>
}
