"use client"

import { useMemo, useState } from "react"
import { familyMedia, familyPeople } from "./data"

/**
 * The family media accordion — horizontal panels that bloom open on hover
 * (desktop) or tap (touch). Adapted from the "accordion-animation-video-display"
 * prototype: swapped the runtime uploader for curated, committed media and
 * retoned the glow to the site's warmer palette.
 *
 * A name picker sits on top: pick a person and the strip narrows to every
 * moment they're in ("Everyone" shows all). Names come straight from the data
 * (`familyPeople`), so adding a person to a photo adds them to the picker.
 *
 * One panel is open at a time. On desktop, hover drives it; on touch, tapping a
 * collapsed panel opens it (tapping the open one closes it). Videos autoplay
 * muted + looped, and pause when their panel collapses.
 */

// null = "Everyone" (no filter).
type Selected = string | null

export function FamilyAccordion() {
  // Which person's moments are showing (null = everyone).
  const [selected, setSelected] = useState<Selected>(null)
  // The index (within the *filtered* list) of the open panel, or null at rest.
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const media = useMemo(
    () => (selected ? familyMedia.filter((m) => m.people?.includes(selected)) : familyMedia),
    [selected],
  )

  // Changing who we're looking at should collapse any open panel.
  function pick(name: Selected) {
    setSelected(name)
    setOpenIndex(null)
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {/* Name picker — "Everyone" plus one chip per person. */}
      {familyPeople.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 px-4">
          <NameChip label="Everyone" active={selected === null} onClick={() => pick(null)} />
          {familyPeople.map((name) => (
            <NameChip
              key={name}
              label={name}
              active={selected === name}
              onClick={() => pick(name)}
            />
          ))}
        </div>
      )}

      {/* The accordion strip. Keyed on `selected` so it re-mounts (and the
          bloom re-animates) when you switch people. */}
      <div
        key={selected ?? "everyone"}
        className="flex h-[72vh] max-h-[820px] w-full items-center justify-center gap-1.5 px-2 md:gap-2"
      >
        {media.map((item, index) => {
          const isOpen = openIndex === index
          const anotherOpen = openIndex !== null && openIndex !== index

          return (
            <div
              key={item.id}
              className={`group relative h-full transition-[width,opacity] duration-[800ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
                isOpen
                  ? "z-30 w-[min(92vw,44rem)]"
                  : anotherOpen
                    ? "w-8 opacity-45 md:w-12"
                    : "w-14 md:w-24"
              }`}
              onMouseEnter={() => setOpenIndex(index)}
              onMouseLeave={() => setOpenIndex(null)}
            >
              {/* Ambient bloom behind the open panel — warm, not neon. */}
              {isOpen && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 scale-110 rounded-[28px] bg-gradient-to-br from-amber-300/25 via-rose-300/15 to-sky-300/20 opacity-90 blur-3xl transition-all duration-[800ms]"
                />
              )}

              <button
                type="button"
                aria-label={isOpen ? "Close" : item.caption || "Open photo"}
                aria-expanded={isOpen}
                onClick={() => setOpenIndex((cur) => (cur === index ? null : index))}
                onFocus={() => setOpenIndex(index)}
                className={`relative flex h-full w-full items-end overflow-hidden rounded-[28px] border text-left backdrop-blur-2xl transition-all duration-[800ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
                  isOpen
                    ? "scale-[1.02] border-white/20 bg-white/[0.08] shadow-[0_32px_64px_rgba(0,0,0,0.45),0_16px_32px_rgba(180,140,90,0.12)]"
                    : "border-white/10 bg-white/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-white/20"
                }`}
              >
                {item.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.src}
                    alt={item.caption || "Family photo"}
                    loading="lazy"
                    decoding="async"
                    className={`absolute inset-0 h-full w-full object-cover transition-all duration-[800ms] ${
                      isOpen ? "scale-100 blur-0" : "scale-105 blur-[1px]"
                    }`}
                  />
                ) : (
                  <video
                    src={item.src}
                    className={`absolute inset-0 h-full w-full object-cover transition-all duration-[800ms] ${
                      isOpen ? "scale-100 blur-0" : "scale-105 blur-[1px]"
                    }`}
                    loop
                    muted
                    playsInline
                    autoPlay
                    // Pause the feed while collapsed so videos don't all run at once.
                    ref={(el) => {
                      if (!el) return
                      if (isOpen) el.play().catch(() => {})
                      else el.pause()
                    }}
                  />
                )}

                {/* Collapsed: a faint vertical wick so a closed panel still reads as media. */}
                {!isOpen && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-4 left-1/2 h-8 w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-t from-white/40 to-transparent"
                  />
                )}

                {/* Open: caption on a gentle scrim. */}
                {isOpen && item.caption && (
                  <div className="relative z-10 w-full bg-gradient-to-t from-black/60 to-transparent px-5 pb-5 pt-16">
                    <p className="font-serif text-lg font-light tracking-tight text-white/90">
                      {item.caption}
                    </p>
                  </div>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** A single pill in the name picker. */
function NameChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors ${
        active
          ? "border-white/40 bg-white/15 text-white"
          : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/25 hover:text-white/85"
      }`}
    >
      {label}
    </button>
  )
}
