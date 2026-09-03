"use client"

/**
 * CatalogBrowser — search the full satellite catalogue on /reference/satellites.
 * Fetches the same /data/satellites.json the engine renders (browser-cached, no
 * second copy in the HTML) and links every row into the live chase view via
 * /lab/celestial/?selectsat=<norad>. Deliberately calm: one search box, three
 * filters, first 60 matches — a reference, not a dashboard.
 */

import { useEffect, useMemo, useState } from "react"
import { Search, ExternalLink } from "lucide-react"

type Row = { id: number; name: string; owner: string; type?: string; launchMs: number }

const OWNER_LABEL: Record<string, string> = {
  US: "United States", PRC: "China", CIS: "Russia / CIS", UK: "United Kingdom",
  ESA: "ESA", JPN: "Japan", IND: "India", FR: "France", GER: "Germany",
  ISS: "International partnership",
}

type Filter = "all" | "pay" | "deb"

export function CatalogBrowser() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  useEffect(() => {
    let alive = true
    fetch("/data/satellites.json")
      .then((r) => r.json())
      .then((d: { sats: Row[] }) => { if (alive) setRows(d.sats.map(({ id, name, owner, type, launchMs }) => ({ id, name, owner, type, launchMs }))) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  const results = useMemo(() => {
    if (!rows) return []
    const isDeb = (r: Row) => r.type === "DEB" || r.type === "R/B"
    const query = q.trim().toLowerCase()
    const out: Row[] = []
    for (const r of rows) {
      if (filter === "pay" && isDeb(r)) continue
      if (filter === "deb" && !isDeb(r)) continue
      if (query && !r.name.toLowerCase().includes(query)) continue
      out.push(r)
      if (out.length >= 60) break
    }
    return out
  }, [rows, q, filter])

  return (
    <div className="rounded-xl border border-border bg-white/[0.02]">
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name — ISS, Starlink, NOAA, Fengyun…"
            aria-label="Search the satellite catalogue"
            className="w-full rounded-full border border-border bg-background/60 pl-9 pr-4 py-2 font-sans text-base md:text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <div className="flex items-center gap-1.5">
          {([["all", "All"], ["pay", "Payloads"], ["deb", "Debris + R/B"]] as [Filter, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              data-cursor-hover
              className={`rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors ${filter === key ? "border-accent/60 text-accent" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {failed && <p className="p-4 text-sm text-muted-foreground">Couldn&apos;t load the catalogue.</p>}
      {!rows && !failed && <p className="p-4 text-sm text-muted-foreground">Loading the catalogue…</p>}
      {rows && (
        <>
          <ul className="divide-y divide-border max-h-[28rem] overflow-y-auto">
            {results.map((r) => (
              <li key={r.id}>
                <a
                  href={`/lab/celestial/?selectsat=${r.id}`}
                  data-cursor-hover
                  className="group flex items-baseline justify-between gap-4 px-4 py-2.5 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="min-w-0">
                    <span className="font-sans text-sm text-foreground group-hover:text-accent transition-colors truncate block">
                      {r.name}
                      {(r.type === "DEB" || r.type === "R/B") && (
                        <span className="ml-2 font-mono text-[9px] tracking-widest uppercase text-[#ff9a6b]">
                          {r.type === "DEB" ? "debris" : "rocket body"}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
                      {OWNER_LABEL[r.owner] ?? r.owner} · {new Date(r.launchMs).getUTCFullYear()} · NORAD {r.id}
                    </span>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase text-muted-foreground group-hover:text-accent transition-colors">
                    open live <ExternalLink className="h-3 w-3" aria-hidden />
                  </span>
                </a>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-4 py-6 text-sm text-muted-foreground">No matches — try a shorter name.</li>
            )}
          </ul>
          <p className="px-4 py-2.5 border-t border-border font-mono text-[9px] tracking-wider text-muted-foreground">
            Showing {results.length === 60 ? "the first 60 matches" : `${results.length.toLocaleString()} matches`} of {rows.length.toLocaleString()} objects
          </p>
        </>
      )}
    </div>
  )
}
