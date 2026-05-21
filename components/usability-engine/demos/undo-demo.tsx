"use client"

/**
 * Demo for the 'User control & freedom' heuristic.
 *
 * Two delete buttons. The left one shows a confirmation modal — friction
 * without recovery. The right one soft-deletes with a 5-second Undo
 * snackbar (the Gmail pattern) — no friction, full recovery.
 */

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { DemoFrame, DemoFooter } from "./visibility-status-demo"

const SEED_ITEMS = [
  "Q3 strategy doc",
  "Vendor onboarding form",
  "Notes from Tuesday",
]

export function UndoDemo() {
  return (
    <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
      <ConfirmModalVersion />
      <UndoSnackbarVersion />
    </div>
  )
}

function ConfirmModalVersion() {
  const [items, setItems] = useState<string[]>(SEED_ITEMS)
  const [pending, setPending] = useState<number | null>(null)

  const reset = () => {
    setItems(SEED_ITEMS)
    setPending(null)
  }
  const startDelete = (i: number) => setPending(i)
  const confirmDelete = () => {
    if (pending !== null) {
      setItems((prev) => prev.filter((_, idx) => idx !== pending))
      setPending(null)
    }
  }
  const cancel = () => setPending(null)

  return (
    <DemoFrame label="Confirmation modal" labelTone="bad">
      <div className="p-5 flex flex-col gap-2 min-h-[180px] relative">
        {items.length === 0 ? (
          <p className="font-mono text-[11px] tracking-wider text-foreground/55 m-auto">
            Empty. (No way back.)
          </p>
        ) : (
          items.map((item, i) => (
            <Row key={item} label={item} onDelete={() => startDelete(i)} />
          ))
        )}

        <AnimatePresence>
          {pending !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center p-5"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="border border-border bg-card p-4 rounded-md w-full max-w-xs"
              >
                <p className="font-sans text-sm text-foreground mb-3">
                  Permanently delete this item?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={cancel}
                    className="px-3 py-1.5 border border-border rounded font-mono text-[10px] tracking-widest uppercase hover:border-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="px-3 py-1.5 rounded font-mono text-[10px] tracking-widest uppercase bg-red-500/90 text-white hover:bg-red-500 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <DemoFooter onReset={reset}>
        Tap delete. A modal interrupts to confirm — and once you commit, there's no way back.
      </DemoFooter>
    </DemoFrame>
  )
}

function UndoSnackbarVersion() {
  const [items, setItems] = useState<string[]>(SEED_ITEMS)
  const [removed, setRemoved] = useState<{ index: number; item: string } | null>(null)
  const [countdown, setCountdown] = useState(5)

  // 5-second countdown on the undo snackbar. If the user does nothing, the
  // delete is finalised. If they tap Undo, the item slides back into place.
  useEffect(() => {
    if (!removed) return
    setCountdown(5)
    const interval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1))
    }, 1000)
    const timeout = setTimeout(() => {
      setRemoved(null)
    }, 5000)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [removed])

  const reset = () => {
    setItems(SEED_ITEMS)
    setRemoved(null)
  }
  const startDelete = (i: number) => {
    const item = items[i]
    setItems((prev) => prev.filter((_, idx) => idx !== i))
    setRemoved({ index: i, item })
  }
  const undo = () => {
    if (!removed) return
    setItems((prev) => {
      const next = [...prev]
      next.splice(removed.index, 0, removed.item)
      return next
    })
    setRemoved(null)
  }

  return (
    <DemoFrame label="Undo snackbar" labelTone="good">
      <div className="p-5 flex flex-col gap-2 min-h-[180px] relative">
        {items.length === 0 && !removed ? (
          <p className="font-mono text-[11px] tracking-wider text-foreground/55 m-auto">
            Empty.
          </p>
        ) : (
          items.map((item, i) => (
            <Row key={item} label={item} onDelete={() => startDelete(i)} />
          ))
        )}

        <AnimatePresence>
          {removed && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="absolute left-3 right-3 bottom-3 flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-foreground text-background"
            >
              <p className="font-sans text-xs">
                Deleted · <span className="opacity-80">{removed.item}</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-widest text-background/60">
                  {countdown}s
                </span>
                <button
                  type="button"
                  onClick={undo}
                  className="font-mono text-[10px] tracking-widest uppercase text-background hover:text-accent transition-colors"
                >
                  Undo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <DemoFooter onReset={reset}>
        Tap delete. The item slides out — but you've got 5 seconds to bring it back.
      </DemoFooter>
    </DemoFrame>
  )
}

function Row({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 border border-border rounded-md bg-background">
      <span className="font-sans text-sm text-foreground/85 truncate">{label}</span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${label}`}
        className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground hover:text-red-500 transition-colors"
      >
        Delete
      </button>
    </div>
  )
}
