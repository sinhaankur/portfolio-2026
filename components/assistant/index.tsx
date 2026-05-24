"use client"

/**
 * AssistantPanel — the natural-language astronomy assistant UI.
 *
 * Composition:
 *   <AssistantPanel />
 *     ├─ header (title + settings gear)
 *     ├─ chat scroll area (UIMessage[] rendered as bubbles)
 *     ├─ composer (textarea + send)
 *     └─ <SettingsDrawer /> (BYO-key + model + cost)
 *
 * State flow:
 *   - apiKey + model loaded from localStorage on mount
 *   - User types in composer → submit pushes a user UIMessage + an
 *     in-progress assistant UIMessage
 *   - runAssistantTurn streams text deltas → mutate the assistant
 *     UIMessage's `blocks` in place via setState
 *   - Tool starts/ends append/update tool blocks for visibility
 *   - Each iteration's usage accumulates into a sessionUsage ref
 *   - When the run completes, assistant pending → false
 *
 * The component is self-contained: pass nothing, get a working panel.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages"
import { motion, useReducedMotion } from "framer-motion"
import { Send, Settings, Sparkles, Loader2, AlertTriangle } from "lucide-react"
import {
  ZERO_USAGE,
  type AssistantUsage,
  addUsage,
  estimateCostUSD,
  readActiveConfig,
  runAssistantConversationTurn,
} from "@/lib/assistant-runtime"
import type { ProviderConfig } from "@/lib/llm-provider"
import { SUGGESTED_PROMPTS, getDatasetCounts } from "@/lib/assistant-context"
import { TOOL_LABELS } from "@/lib/assistant-tools"
import { SettingsDrawer } from "./settings-drawer"
import { type UIMessage, type AssistantUIBlock, newId } from "./types"

export function AssistantPanel() {
  const prefersReducedMotion = useReducedMotion()

  /** Resolved provider config (Anthropic key + model, or local
   *  baseUrl + model). Null = no provider configured yet, chat is
   *  locked. Re-read from localStorage on mount and after the
   *  settings drawer saves. */
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [messages, setMessages] = useState<UIMessage[]>([])
  const [composerValue, setComposerValue] = useState("")
  const [isThinking, setIsThinking] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Conversation history in API format. Kept in a ref so we don't
  // re-fire effects when it changes.
  const apiHistoryRef = useRef<MessageParam[]>([])
  // Session-wide usage for the settings drawer.
  const [sessionUsage, setSessionUsage] = useState<AssistantUsage>(ZERO_USAGE)
  const abortRef = useRef<AbortController | null>(null)

  // Re-read provider config from localStorage. Called on mount and
  // any time the settings drawer reports a save — keeps the UI lock
  // state in sync with localStorage without prop-drilling.
  const refreshProviderConfig = useCallback(() => {
    setProviderConfig(readActiveConfig())
  }, [])

  useEffect(() => {
    refreshProviderConfig()
  }, [refreshProviderConfig])

  // Auto-open settings on first load if nothing is configured.
  useEffect(() => {
    if (providerConfig === null) {
      // No-op if drawer is already open; otherwise prompt the visitor.
      setSettingsOpen((cur) => (cur ? cur : true))
    }
    // Intentional: only react to "is config present" transitions, not
    // every field change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerConfig === null])

  // Mutate one assistant message's blocks in place.
  const updateAssistantBlocks = useCallback(
    (
      assistantId: string,
      updater: (prev: AssistantUIBlock[]) => AssistantUIBlock[],
    ) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.role === "assistant"
            ? { ...m, blocks: updater(m.blocks) }
            : m,
        ),
      )
    },
    [],
  )

  const setAssistantPending = useCallback(
    (assistantId: string, pending: boolean) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.role === "assistant" ? { ...m, pending } : m,
        ),
      )
    },
    [],
  )

  // Submit a user message → run the agent loop → stream into the
  // assistant message in real time.
  const handleSubmit = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || isThinking) return
      if (!providerConfig) {
        setSettingsOpen(true)
        return
      }
      setErrorMsg(null)

      const userId = newId()
      const assistantId = newId()
      const userMsg: UIMessage = { id: userId, role: "user", text }
      const assistantMsg: UIMessage = {
        id: assistantId,
        role: "assistant",
        blocks: [],
        pending: true,
      }
      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setComposerValue("")
      setIsThinking(true)

      // Append to API history.
      const updatedHistory: MessageParam[] = [
        ...apiHistoryRef.current,
        { role: "user", content: text },
      ]

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const result = await runAssistantConversationTurn({
          config: providerConfig,
          history: updatedHistory,
          signal: controller.signal,
          onTextDelta: (delta) => {
            updateAssistantBlocks(assistantId, (blocks) => {
              const last = blocks[blocks.length - 1]
              if (last && last.type === "text") {
                return [
                  ...blocks.slice(0, -1),
                  { type: "text", text: last.text + delta },
                ]
              }
              return [...blocks, { type: "text", text: delta }]
            })
          },
          onToolStart: (info) => {
            updateAssistantBlocks(assistantId, (blocks) => [
              ...blocks,
              { type: "tool", name: info.name, status: "running" },
            ])
          },
          onToolEnd: (info) => {
            updateAssistantBlocks(assistantId, (blocks) => {
              // Mark the last running tool with this name as done.
              for (let i = blocks.length - 1; i >= 0; i--) {
                const b = blocks[i]
                if (b.type === "tool" && b.name === info.name && b.status === "running") {
                  const next = [...blocks]
                  next[i] = {
                    type: "tool",
                    name: info.name,
                    status: info.isError ? "error" : "done",
                  }
                  return next
                }
              }
              return blocks
            })
          },
          onIterationUsage: (usage) => {
            setSessionUsage((prev) => addUsage(prev, usage))
          },
        })

        // Persist the assistant turn's content + any tool results into
        // the API history so the next user message has full context.
        apiHistoryRef.current = [
          ...updatedHistory,
          { role: "assistant", content: result.finalAssistantContent },
          ...(result.toolResultsForHistory.length
            ? ([
                { role: "user", content: result.toolResultsForHistory },
              ] as MessageParam[])
            : []),
        ]
        setAssistantPending(assistantId, false)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setErrorMsg(msg)
        // Show the error inline in the assistant message too.
        updateAssistantBlocks(assistantId, (blocks) => [
          ...blocks,
          { type: "text", text: `\n\n(Error: ${msg})` },
        ])
        setAssistantPending(assistantId, false)
      } finally {
        setIsThinking(false)
        abortRef.current = null
      }
    },
    [providerConfig, isThinking, updateAssistantBlocks, setAssistantPending],
  )

  const handleAbort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const counts = useMemo(() => getDatasetCounts(), [])
  // Cost is only meaningful for Anthropic — local providers cost
  // nothing per token (electricity + GPU only). Default to 0 for
  // local; estimate from usage + model rate when on Anthropic.
  const sessionCost = useMemo(() => {
    if (providerConfig?.provider !== "anthropic") return 0
    return estimateCostUSD(sessionUsage, providerConfig.model)
  }, [sessionUsage, providerConfig])
  const sessionTokens = useMemo(
    () => ({
      input: sessionUsage.input_tokens,
      output: sessionUsage.output_tokens,
      cached: sessionUsage.cache_read_input_tokens,
    }),
    [sessionUsage],
  )

  // Scroll to bottom on new messages.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div className="flex flex-col h-full rounded-lg border border-border bg-card/40 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
          <h2 className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground truncate">
            Universe Engine · Assistant
          </h2>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Open assistant settings"
          className="
            inline-flex items-center justify-center
            w-9 h-9 rounded-full
            text-muted-foreground hover:text-foreground hover:bg-secondary
            transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          "
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* Chat scroll */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-70"
      >
        {messages.length === 0 && (
          <EmptyState
            datasetCounts={counts}
            hasConfig={!!providerConfig}
            onSuggestionClick={(prompt) => handleSubmit(prompt)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <UserBubble key={m.id} text={m.text} />
          ) : (
            <AssistantBubble
              key={m.id}
              blocks={m.blocks}
              pending={m.pending}
              prefersReducedMotion={!!prefersReducedMotion}
            />
          ),
        )}
        {errorMsg && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive leading-relaxed">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Composer */}
      <Composer
        value={composerValue}
        onChange={setComposerValue}
        onSubmit={handleSubmit}
        onAbort={handleAbort}
        disabled={!providerConfig}
        thinking={isThinking}
        onConfigureKey={() => setSettingsOpen(true)}
      />

      <SettingsDrawer
        heading="Assistant · settings"
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false)
          // Drawer might have edited config in localStorage without
          // calling onConfigChange (e.g. backed-out provider switch);
          // re-read once on close to stay consistent.
          refreshProviderConfig()
        }}
        onConfigChange={() => {
          refreshProviderConfig()
          // Successful config save → close the drawer so the visitor
          // returns to the chat. The drawer's own "Saved" toast already
          // gave the confirmation feedback.
          setSettingsOpen(false)
        }}
        sessionCostUSD={sessionCost}
        sessionTokens={sessionTokens}
      />
    </div>
  )
}

/* ------------------------------------------------------------------
 * Subcomponents
 * ------------------------------------------------------------------ */

function EmptyState({
  datasetCounts,
  hasConfig,
  onSuggestionClick,
  onOpenSettings,
}: {
  datasetCounts: { namedBodies: number; skyPoints: number; constellations: number }
  hasConfig: boolean
  onSuggestionClick: (prompt: string) => void
  onOpenSettings: () => void
}) {
  return (
    <div className="py-6">
      <p className="font-display text-2xl md:text-3xl font-light text-foreground mb-3 leading-tight">
        Ask the engine.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        I know about {datasetCounts.namedBodies} named small bodies, 8 planets,{" "}
        {datasetCounts.skyPoints} deep-sky objects, and {datasetCounts.constellations}{" "}
        constellations — all from real astronomical data. Ask a question or
        tell me where to fly the camera.
      </p>

      {hasConfig ? (
        <div className="space-y-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSuggestionClick(prompt)}
              className="
                w-full text-left px-3.5 py-3 rounded-md
                border border-border/70 hover:border-accent hover:bg-accent/5
                text-sm text-foreground/85 hover:text-foreground
                transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                min-h-11
              "
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-border/70 bg-secondary/30 p-4">
          <p className="text-sm text-foreground mb-3">
            Pick a provider to chat with the assistant. <strong className="font-medium text-foreground">Cloud:</strong> bring your own Anthropic API key.{" "}
            <strong className="font-medium text-foreground">Local:</strong> point at LM Studio or Ollama running on your machine — no key, no cloud cost.
          </p>
          <button
            onClick={onOpenSettings}
            className="
              inline-flex items-center gap-2
              px-4 py-2.5 rounded-full
              font-mono text-[11px] tracking-[0.2em] uppercase
              bg-foreground text-background hover:bg-accent hover:text-accent-foreground
              transition-colors min-h-11
            "
          >
            Set up assistant
          </button>
        </div>
      )}
    </div>
  )
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="
        max-w-[85%]
        px-3.5 py-2.5 rounded-2xl rounded-br-md
        bg-foreground text-background
        text-sm leading-relaxed whitespace-pre-wrap
      ">
        {text}
      </div>
    </div>
  )
}

function AssistantBubble({
  blocks,
  pending,
  prefersReducedMotion,
}: {
  blocks: AssistantUIBlock[]
  pending: boolean
  prefersReducedMotion: boolean
}) {
  return (
    <div className="flex justify-start">
      <div className="
        max-w-[92%] w-full
        space-y-2
      ">
        {blocks.map((block, idx) => {
          if (block.type === "text") {
            return (
              <div
                key={idx}
                className="
                  px-3.5 py-2.5 rounded-2xl rounded-bl-md
                  bg-secondary/60 text-foreground
                  text-sm leading-relaxed whitespace-pre-wrap
                "
              >
                {block.text}
              </div>
            )
          }
          // tool block
          const label = TOOL_LABELS[block.name] ?? block.name
          return (
            <div
              key={idx}
              className="
                inline-flex items-center gap-2
                px-2.5 py-1 rounded-full border border-border/70
                font-mono text-[10px] tracking-[0.18em] uppercase
                text-muted-foreground
              "
            >
              {block.status === "running" && (
                <motion.span
                  aria-hidden="true"
                  animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                  className="inline-flex"
                >
                  <Loader2 className="w-3 h-3" />
                </motion.span>
              )}
              {block.status === "done" && (
                <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
              )}
              {block.status === "error" && (
                <AlertTriangle className="w-3 h-3 text-destructive" />
              )}
              <span>{label}</span>
            </div>
          )
        })}
        {pending && blocks.length === 0 && (
          <div className="
            inline-flex items-center gap-2 px-3.5 py-2.5
            font-mono text-[10px] tracking-[0.2em] uppercase
            text-muted-foreground
          ">
            <motion.span
              aria-hidden="true"
              animate={prefersReducedMotion ? undefined : { rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
              className="inline-flex"
            >
              <Loader2 className="w-3 h-3" />
            </motion.span>
            Thinking
          </div>
        )}
      </div>
    </div>
  )
}

function Composer({
  value,
  onChange,
  onSubmit,
  onAbort,
  disabled,
  thinking,
  onConfigureKey,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: (v: string) => void
  onAbort: () => void
  disabled: boolean
  thinking: boolean
  onConfigureKey: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit(value)
    }
  }

  // Auto-resize textarea.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    // 140px max — matches the textarea's max-h-35 (35 × 4 = 140px)
    // so the auto-resize never overshoots the CSS-imposed ceiling.
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`
  }, [value])

  return (
    <div className="border-t border-border/70 px-3 py-2.5 bg-card/60">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "Pick a provider in settings to chat…"
              : thinking
              ? "Assistant is responding…"
              : "Ask about a body, fly the camera, jump in time…"
          }
          rows={1}
          disabled={disabled || thinking}
          /* font-size: 16px (text-base) on mobile is the iOS Safari
             threshold below which focusing an input triggers an
             auto-zoom. Stay at 16px+ on mobile, drop to text-sm on
             ≥md where the form-factor doesn't have that quirk. */
          className="
            flex-1 resize-none bg-transparent border-0
            px-2 py-2 font-sans text-base md:text-sm text-foreground
            placeholder:text-muted-foreground/60
            focus:outline-none
            disabled:cursor-not-allowed
            min-h-11 max-h-35
          "
        />
        {disabled ? (
          <button
            onClick={onConfigureKey}
            className="
              shrink-0 inline-flex items-center justify-center gap-2
              px-4 py-2.5 rounded-full
              font-mono text-[11px] tracking-[0.2em] uppercase
              bg-foreground text-background hover:bg-accent hover:text-accent-foreground
              transition-colors min-h-11
            "
          >
            Set up
          </button>
        ) : thinking ? (
          <button
            onClick={onAbort}
            aria-label="Abort response"
            className="
              shrink-0 inline-flex items-center justify-center
              w-11 h-11 rounded-full
              bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80
              transition-colors
            "
          >
            <span className="inline-block w-3 h-3 bg-current rounded-sm" aria-hidden="true" />
          </button>
        ) : (
          <button
            onClick={() => onSubmit(value)}
            disabled={!value.trim()}
            aria-label="Send message"
            className="
              shrink-0 inline-flex items-center justify-center
              w-11 h-11 rounded-full
              bg-foreground text-background
              disabled:opacity-30 disabled:cursor-not-allowed
              hover:bg-accent hover:text-accent-foreground
              transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            "
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
