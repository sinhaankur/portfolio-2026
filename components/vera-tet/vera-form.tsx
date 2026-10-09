"use client"

// VeraForm — Vera's appearance, user-switchable.
//
// Vera can wear more than one form. This renders whichever the user has chosen
// (the warm orb, or the HUD-prism "Tet"), remembers the choice in localStorage,
// and exposes a small switcher so the user can change it. The 3D prism is lazy-
// loaded so the orb-only path never pays for Three.js.
//
// Usage:
//   <VeraForm size={120} phase="idle" />          // renders the chosen form
//   <VeraFormSwitcher />                           // the control to change it
//
// Both read/write the same persisted key, and the switcher broadcasts changes so
// every <VeraForm /> on the page updates live.

import dynamic from "next/dynamic"
import { useEffect, useState, useCallback } from "react"
import { VeraMark } from "@/components/vera-mark"
import type { TetPhase } from "./tet-mesh"

export type VeraFormKind = "orb" | "tet"

export const VERA_FORMS: { id: VeraFormKind; label: string; blurb: string }[] = [
  { id: "orb", label: "Orb", blurb: "Her warm, iridescent sphere — soft, living, present." },
  { id: "tet", label: "Prism", blurb: "A faceted HUD prism — her colour, sharper geometry." },
]

const KEY = "vera:form"
const EVT = "vera:form-change"

function readForm(): VeraFormKind {
  if (typeof window === "undefined") return "orb"
  const v = window.localStorage.getItem(KEY)
  return v === "tet" ? "tet" : "orb"
}

export function setVeraForm(kind: VeraFormKind) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEY, kind)
  window.dispatchEvent(new CustomEvent(EVT, { detail: kind }))
}

/** Subscribe to the current form, reacting to switches anywhere on the page. */
export function useVeraForm(): VeraFormKind {
  const [form, setForm] = useState<VeraFormKind>("orb")
  useEffect(() => {
    setForm(readForm())
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as VeraFormKind | undefined
      setForm(detail ?? readForm())
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setForm(readForm())
    }
    window.addEventListener(EVT, onChange)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(EVT, onChange)
      window.removeEventListener("storage", onStorage)
    }
  }, [])
  return form
}

// lazy: the Tet drags in Three.js, so only load it when actually shown.
const VeraTet = dynamic(() => import("./vera-tet").then((m) => ({ default: m.VeraTet })), {
  ssr: false,
  loading: () => null,
})

export function VeraForm({
  size = 96,
  className = "",
  phase = "idle",
}: {
  size?: number
  className?: string
  phase?: TetPhase
}) {
  const form = useVeraForm()
  if (form === "tet") return <VeraTet size={size} className={className} phase={phase} />
  return <VeraMark size={size} className={className} phase={phase} />
}

/** The user's control to change Vera's form. Small segmented toggle. */
export function VeraFormSwitcher({ className = "" }: { className?: string }) {
  const current = useVeraForm()
  const pick = useCallback((id: VeraFormKind) => setVeraForm(id), [])
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-background/60 p-1 ${className}`}
      role="radiogroup"
      aria-label="Vera's form"
    >
      {VERA_FORMS.map((f) => {
        const active = f.id === current
        return (
          <button
            key={f.id}
            role="radio"
            aria-checked={active}
            data-cursor-hover
            onClick={() => pick(f.id)}
            title={f.blurb}
            className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.15em] uppercase transition-colors ${
              active ? "bg-accent/15 text-foreground" : "text-foreground/55 hover:text-foreground/85"
            }`}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
