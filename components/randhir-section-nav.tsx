"use client"

// A quiet section navigation for Dr. Sinha's page. L1 = the major sections; the
// Archive expands to L2 = its four publication lists. It highlights the section you
// are in as you scroll (scrollspy), and clicking smooth-scrolls there. On desktop it
// sits as a slim sticky rail to the left of the content; on mobile it becomes a slim
// sticky bar at the top. Built to make a long tribute page effortless to move through.

import { useEffect, useState } from "react"

type Item = { id: string; label: string; children?: { id: string; label: string }[] }

const SECTIONS: Item[] = [
  { id: "work", label: "His work" },
  { id: "journey", label: "The journey" },
  {
    id: "archive",
    label: "The archive",
    children: [
      { id: "research", label: "Research papers" },
      { id: "conference", label: "Conference papers" },
      { id: "popular", label: "Popular articles" },
      { id: "books", label: "Books & catalogues" },
    ],
  },
  { id: "after", label: "After the lab" },
]

// flat list of every id we track, in document order
const ALL_IDS = SECTIONS.flatMap((s) => [s.id, ...(s.children?.map((c) => c.id) ?? [])])

export function RandhirSectionNav() {
  const [active, setActive] = useState<string>("work")

  useEffect(() => {
    // scrollspy: the topmost section whose heading has passed a comfortable line
    const onScroll = () => {
      const marker = window.innerHeight * 0.32
      let current = ALL_IDS[0]
      for (const id of ALL_IDS) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= marker) current = id
      }
      setActive(current)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // is this L1 section (or one of its L2 children) the active one?
  const isSectionActive = (s: Item) =>
    active === s.id || (s.children?.some((c) => c.id === active) ?? false)

  return (
    <>
      {/* DESKTOP: a slim sticky rail, left of the content */}
      <nav
        aria-label="Sections of this page"
        className="hidden xl:block fixed left-[max(1.5rem,calc(50%-42rem))] top-1/2 -translate-y-1/2 z-30 w-44"
      >
        <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-foreground/35 mb-3 pl-4">On this page</p>
        <ul className="space-y-1 border-l border-border">
          {SECTIONS.map((s) => {
            const secActive = isSectionActive(s)
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={go(s.id)}
                  className={`block -ml-px border-l-2 pl-4 py-1 font-sans text-[13px] transition-colors ${
                    active === s.id
                      ? "border-accent text-foreground"
                      : secActive
                        ? "border-accent/50 text-foreground/85"
                        : "border-transparent text-foreground/50 hover:text-foreground/80"
                  }`}
                >
                  {s.label}
                </a>
                {/* L2 — only expands while its section is active */}
                {s.children && secActive && (
                  <ul className="mt-0.5 mb-1 space-y-0.5">
                    {s.children.map((c) => (
                      <li key={c.id}>
                        <a
                          href={`#${c.id}`}
                          onClick={go(c.id)}
                          className={`block -ml-px border-l-2 pl-7 py-0.5 font-sans text-[12px] transition-colors ${
                            active === c.id
                              ? "border-accent text-foreground/90"
                              : "border-transparent text-foreground/40 hover:text-foreground/70"
                          }`}
                        >
                          {c.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* MOBILE / TABLET: a slim sticky bar of L1 chips at the top */}
      <nav
        aria-label="Sections of this page"
        className="xl:hidden sticky top-0 z-30 -mx-6 md:-mx-12 mb-8 border-b border-border bg-background/85 backdrop-blur-md"
      >
        <ul className="flex gap-1 overflow-x-auto px-6 md:px-12 py-2.5 no-scrollbar">
          {SECTIONS.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                onClick={go(s.id)}
                className={`block rounded-full px-3.5 py-1.5 font-sans text-[13px] whitespace-nowrap transition-colors ${
                  isSectionActive(s)
                    ? "bg-accent/15 text-foreground"
                    : "text-foreground/55 hover:bg-secondary/40"
                }`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
