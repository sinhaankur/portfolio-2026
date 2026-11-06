"use client"

/**
 * AllObjectsPanel — the full, browsable inventory of every tracked object.
 *
 * Ankur: "inventory needs all of them." The census panel counts the ~18,900
 * objects by regime; this lets you actually BROWSE and reach every single one —
 * a searchable, filterable, scrollable list of the whole real catalogue, each
 * row clickable to fly the camera to that object and open its detail card.
 *
 * 18,900 rows can't all be in the DOM, so this is a tiny hand-rolled VIRTUAL
 * list (no dependency): it measures the scroll position and renders only the
 * ~visible window of rows plus a small overscan, with spacer divs holding the
 * true scroll height. Smooth at any size, light on the machine.
 *
 * Selection reuses the engine's existing channel — set selectedSatRef and the
 * SatelliteField flies to it + the detail card opens — the same path the search
 * uses, so clicking a row here behaves exactly like picking a craft in search.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { List, X, Search } from "lucide-react"
import { loadSatelliteCatalog, type SatMeta } from "@/components/universe-engine/satellite-data"
import { selectedSatRef } from "@/components/universe-engine/satellite-refs"

const ROW_H = 46          // px per row (must match the row markup height)
const OVERSCAN = 8        // extra rows above/below the window

type Filter = "all" | "active" | "debris"

// A debris / rocket-body object vs a working payload — the one honest split.
const isDebris = (s: SatMeta) => s.type === "DEB" || s.type === "R/B"

function typeLabel(s: SatMeta): string {
  if (s.type === "DEB") return "debris"
  if (s.type === "R/B") return "rocket body"
  if (s.type === "PAY") return "payload"
  return "object"
}

export function AllObjectsPanel({ onClose }: { onClose: () => void }) {
  const [catalog, setCatalog] = useState<SatMeta[] | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(420)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    loadSatelliteCatalog().then((c) => { if (alive) setCatalog(c) })
    return () => { alive = false }
  }, [])

  // measure the scroll viewport height so the window math is exact
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewportH(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [catalog])

  // Filter + sort once per query/filter change. Name sort so the browse is
  // orderly; a query narrows it (substring, case-insensitive) across the whole
  // catalogue — so every one of the ~18,900 is reachable.
  const rows = useMemo(() => {
    if (!catalog) return []
    const q = query.trim().toLowerCase()
    let out = catalog
    if (filter === "active") out = out.filter((s) => !isDebris(s))
    else if (filter === "debris") out = out.filter(isDebris)
    if (q) out = out.filter((s) => s.name.toLowerCase().includes(q) || String(s.id).includes(q) || s.owner.toLowerCase().includes(q))
    // name A→Z; already-small debris names (just numbers) fall to the end
    return [...out].sort((a, b) => a.name.localeCompare(b.name))
  }, [catalog, query, filter])

  const total = rows.length
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const endIdx = Math.min(total, Math.ceil((scrollTop + viewportH) / ROW_H) + OVERSCAN)
  const visible = rows.slice(startIdx, endIdx)

  function pick(s: SatMeta) {
    selectedSatRef.current = s.id
    // bring the object into view — the field fires its own focus when selected.
    window.dispatchEvent(new CustomEvent("celestial:sat-selected", { detail: s.id }))
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
      className="flex max-h-[80vh] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#9fe0ff]/40 bg-background/90 backdrop-blur-md shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9fe0ff]">
          <List className="h-3.5 w-3.5" /> Every object
        </p>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* search + filter */}
      <div className="border-b border-border px-3 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (scrollRef.current) scrollRef.current.scrollTop = 0 }}
            placeholder="Search the whole catalogue…"
            className="w-full rounded-lg border border-border bg-background/60 py-1.5 pl-8 pr-3 font-sans text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:border-[#9fe0ff]/60 focus:outline-none"
          />
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          {(["all", "active", "debris"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setFilter(f); if (scrollRef.current) scrollRef.current.scrollTop = 0 }}
              data-cursor-hover
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                filter === f ? "border-[#9fe0ff]/60 bg-[#9fe0ff]/10 text-[#9fe0ff]" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/70">
            {total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* the virtual list */}
      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {catalog == null ? (
          <p className="px-4 py-6 font-sans text-sm text-muted-foreground">Loading the catalogue…</p>
        ) : total === 0 ? (
          <p className="px-4 py-6 font-sans text-sm text-muted-foreground">Nothing matches that.</p>
        ) : (
          <div style={{ height: total * ROW_H, position: "relative" }}>
            <div style={{ transform: `translateY(${startIdx * ROW_H}px)` }}>
              {visible.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s)}
                  data-cursor-hover
                  style={{ height: ROW_H }}
                  className="flex w-full items-center gap-3 px-4 text-left transition-colors hover:bg-secondary/40"
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isDebris(s) ? "bg-[#ff7a6b]" : "bg-[#9fe0ff]"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-[13px] text-foreground">{s.name}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground/70">
                      #{s.id} · {typeLabel(s)}{s.owner ? ` · ${s.owner}` : ""}
                    </span>
                  </span>
                  <span aria-hidden className="font-mono text-[11px] text-[#9fe0ff]/0 transition-colors group-hover:text-[#9fe0ff]">→</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="border-t border-border px-4 py-2 font-mono text-[9px] tracking-wider text-muted-foreground/70">
        {total.toLocaleString()} objects · tap one to fly to it · CelesTrak catalogue
      </p>
    </motion.div>
  )
}
