"use client"

/**
 * OllamaCallout — collapsible "install Ollama to run the checks yourself"
 * banner that sits near the AuditBar on /usability.
 *
 * The Usability Engine on this static site can't run script/LLM checks
 * itself (no backend). But the catalog is the spec. Anyone with Ollama
 * installed locally can paste the per-heuristic prompts into their own
 * model and actually run the checks they care about — same philosophy
 * as Unhosted: AI that lives where you do.
 *
 * Collapsed by default so it doesn't shout, with a clear toggle to
 * expand the install instructions.
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Terminal } from "lucide-react"

export function OllamaCallout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-10 md:mb-12 border border-border rounded-xl bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="
          w-full flex items-start gap-4 px-5 md:px-6 py-4 md:py-5 text-left
          hover:bg-secondary/40 transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          focus-visible:ring-offset-2 focus-visible:ring-offset-background
        "
      >
        <Terminal className="w-4 h-4 mt-1 text-accent shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent mb-1">
            Run the LLM checks yourself · Optional
          </p>
          <p className="font-sans text-sm md:text-base text-foreground/85 leading-snug">
            This site is static — it can't call an LLM. But many heuristics{" "}
            <em className="font-serif italic text-foreground">are</em> LLM-checkable.
            Install Ollama, pick a model, and paste the per-heuristic prompts.
            Your machine, your runtime, your data.
          </p>
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 mt-1.5 text-muted-foreground"
          aria-hidden="true"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="ollama-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 md:px-6 pb-6 pt-2 border-t border-border space-y-5">
              <Step
                n="1"
                title="Install Ollama"
                body={
                  <>
                    macOS:{" "}
                    <code className="font-mono text-foreground px-1.5 py-0.5 rounded bg-foreground/5 border border-border text-[12px]">
                      brew install ollama
                    </code>
                    . Other platforms:{" "}
                    <a
                      href="https://ollama.com/download"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-foreground underline decoration-accent/50 underline-offset-4 hover:decoration-accent"
                    >
                      ollama.com/download
                    </a>
                    .
                  </>
                }
              />
              <Step
                n="2"
                title="Pull a model"
                body={
                  <>
                    For text-only checks (most heuristics):{" "}
                    <code className="font-mono text-foreground px-1.5 py-0.5 rounded bg-foreground/5 border border-border text-[12px]">
                      ollama pull llama3.2
                    </code>
                    . For checks that need to see the page (visual minimalism,
                    confidence labels in UI screenshots):{" "}
                    <code className="font-mono text-foreground px-1.5 py-0.5 rounded bg-foreground/5 border border-border text-[12px]">
                      ollama pull llava
                    </code>
                    .
                  </>
                }
              />
              <Step
                n="3"
                title="Grab the prompt from any LLM-checkable heuristic below"
                body={
                  <>
                    Expand the audit row on any heuristic with a{" "}
                    <span className="font-mono text-foreground">LLM-checkable</span>{" "}
                    or <span className="font-mono text-foreground">Script + LLM</span>{" "}
                    tag. The expanded panel shows the exact{" "}
                    <code className="font-mono text-foreground px-1.5 py-0.5 rounded bg-foreground/5 border border-border text-[12px]">
                      ollama run
                    </code>{" "}
                    command for that check. Paste the rendered HTML of your
                    page into the prompt (Cmd-U → copy in most browsers, or
                    use the screenshot path with{" "}
                    <code className="font-mono text-foreground px-1.5 py-0.5 rounded bg-foreground/5 border border-border text-[12px]">
                      llava
                    </code>
                    ).
                  </>
                }
              />
              <Step
                n="4"
                title="Vote in the engine"
                body={
                  <>
                    Bring the LLM's verdict back here and tap{" "}
                    <span className="font-mono text-foreground">✓ Pass</span> or{" "}
                    <span className="font-mono text-foreground">✕ Fail</span> on the
                    matching card. The engine compiles your verdicts into the
                    report at the bottom of the page.
                  </>
                }
              />

              <div className="pt-3 border-t border-border">
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground/85 leading-relaxed">
                  Why local? Same reason this site links to{" "}
                  <a
                    href="/lab/unhosted"
                    className="text-foreground underline decoration-accent/50 underline-offset-4 hover:decoration-accent"
                  >
                    Unhosted
                  </a>
                  . Audit data is sensitive — your URLs, your screenshots, your
                  user flows. Running the model on your own machine means none
                  of it leaves your laptop.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[2rem_1fr] gap-3 items-start">
      <span className="font-mono text-xs tracking-widest text-accent pt-0.5">
        0{n}
      </span>
      <div>
        <p className="font-sans text-sm md:text-base text-foreground mb-1.5 leading-snug">
          {title}
        </p>
        <p className="font-sans text-sm text-foreground/75 leading-relaxed max-w-2xl">
          {body}
        </p>
      </div>
    </div>
  )
}
