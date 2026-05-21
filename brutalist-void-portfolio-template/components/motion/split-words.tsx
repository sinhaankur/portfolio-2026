"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

type SplitWordsProps = {
  text: string
  className?: string
  as?: "h1" | "h2" | "h3" | "p" | "span"
  delay?: number
  stagger?: number
  /**
   * Mark a word with an asterisk wrapper for italic emphasis.
   * Example: `text="Keeping humans in *command*"` will italicize "command".
   */
  italicMarker?: boolean
  id?: string
  /** Inline children rendered after the split words. Useful for trailing punctuation. */
  children?: ReactNode
}

/**
 * Reveals a headline word by word: each word fades up + clips into view.
 * Honors reduced-motion by rendering the text statically with no animation.
 */
export function SplitWords({
  text,
  className = "",
  as: Tag = "h2",
  delay = 0,
  stagger = 0.06,
  italicMarker = true,
  id,
  children,
}: SplitWordsProps) {
  const prefersReducedMotion = useReducedMotion()
  const words = text.split(/\s+/)

  // For SR — the wrapper itself reads cleanly as the text
  const Wrapper = motion[Tag as keyof typeof motion] as typeof motion.h2

  if (prefersReducedMotion) {
    // Static render — also italicizes *marked* words but no motion
    return (
      <Tag id={id} className={className} aria-label={text}>
        {words.map((w, i) => {
          const isItalic = italicMarker && w.startsWith("*") && w.endsWith("*")
          const display = isItalic ? w.slice(1, -1) : w
          return (
            <span key={i} className={isItalic ? "italic font-serif" : undefined}>
              {display}
              {i < words.length - 1 ? " " : ""}
            </span>
          )
        })}
        {children}
      </Tag>
    )
  }

  return (
    <Wrapper
      id={id}
      className={className}
      aria-label={text}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-15%" }}
      transition={{ staggerChildren: stagger, delayChildren: delay }}
    >
      {words.map((w, i) => {
        const isItalic = italicMarker && w.startsWith("*") && w.endsWith("*")
        const display = isItalic ? w.slice(1, -1) : w
        return (
          <span
            key={i}
            aria-hidden="true"
            className="inline-block overflow-hidden align-bottom"
          >
            <motion.span
              className={`inline-block ${isItalic ? "italic font-serif" : ""}`}
              variants={{
                hidden: { y: "110%", opacity: 0 },
                visible: {
                  y: 0,
                  opacity: 1,
                  transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
                },
              }}
            >
              {display}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        )
      })}
      {children}
    </Wrapper>
  )
}
