"use client"

/**
 * Demo for the 'Recognition over recall' heuristic.
 *
 * Two search inputs side-by-side. The left one is blank — the user has
 * to remember what they want. The right one shows recently-used items
 * + suggestions as they type, lifting working-memory cost.
 */

import { useState, useMemo } from "react"
import { DemoFrame, DemoFooter } from "./visibility-status-demo"

const RECENTS = [
  "Q3 strategy doc",
  "Brand guidelines v4",
  "Notes from Tuesday",
  "Onboarding plan",
]

const ALL_ITEMS = [
  ...RECENTS,
  "Product roadmap 2026",
  "Engineering OKRs",
  "Vendor onboarding form",
  "Customer interview notes",
  "Pricing experiment results",
  "Q4 hiring plan",
]

export function RecognitionDemo() {
  return (
    <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
      <BlankInputVersion />
      <SuggestionsVersion />
    </div>
  )
}

function BlankInputVersion() {
  const [value, setValue] = useState("")
  const [submitted, setSubmitted] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) setSubmitted(value.trim())
  }
  const reset = () => {
    setValue("")
    setSubmitted(null)
  }

  return (
    <DemoFrame label="Blank input — recall" labelTone="bad">
      <form onSubmit={submit} className="p-5 flex flex-col gap-3 min-h-[200px]">
        <label className="font-mono text-[10px] tracking-widest uppercase text-foreground/70">
          Find a document
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type the exact title…"
          className="px-3 py-2 border border-border rounded-md bg-background font-sans text-sm focus:outline-none focus:border-foreground"
        />
        <p className="font-mono text-[11px] tracking-wider text-foreground/55">
          (You have to remember what you called it.)
        </p>
        {submitted && (
          <p className="font-mono text-[11px] tracking-wider text-foreground/85">
            Searched for: <span className="text-foreground">{submitted}</span>
          </p>
        )}
      </form>
      <DemoFooter onReset={reset}>
        The input is empty. The user has to recall the title from memory.
      </DemoFooter>
    </DemoFrame>
  )
}

function SuggestionsVersion() {
  const [value, setValue] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  // Empty input → recents. Typed input → fuzzy-filtered.
  const suggestions = useMemo(() => {
    const v = value.trim().toLowerCase()
    if (!v) return RECENTS
    return ALL_ITEMS.filter((item) => item.toLowerCase().includes(v)).slice(0, 5)
  }, [value])

  const reset = () => {
    setValue("")
    setSelected(null)
    setFocused(false)
  }

  return (
    <DemoFrame label="Suggestions — recognition" labelTone="good">
      <div className="p-5 flex flex-col gap-3 min-h-[200px]">
        <label className="font-mono text-[10px] tracking-widest uppercase text-foreground/70">
          Find a document
        </label>
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setSelected(null)
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Start typing…"
            className="w-full px-3 py-2 border border-border rounded-md bg-background font-sans text-sm focus:outline-none focus:border-foreground"
          />
          {focused && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-1 z-10 border border-border rounded-md bg-card shadow-lg max-h-48 overflow-y-auto">
              {!value.trim() && (
                <li className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground px-3 pt-2 pb-1">
                  Recent
                </li>
              )}
              {suggestions.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setValue(item)
                      setSelected(item)
                      setFocused(false)
                    }}
                    className="w-full text-left px-3 py-1.5 font-sans text-sm text-foreground/85 hover:bg-secondary/60 hover:text-foreground transition-colors"
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!selected && (
          <p className="font-mono text-[11px] tracking-wider text-foreground/55">
            (Focus the input. Recents appear.)
          </p>
        )}
        {selected && (
          <p className="font-mono text-[11px] tracking-wider text-foreground/85">
            Picked: <span className="text-foreground">{selected}</span>
          </p>
        )}
      </div>
      <DemoFooter onReset={reset}>
        Focus the input — your recent items show. Start typing — the list narrows.
      </DemoFooter>
    </DemoFrame>
  )
}
