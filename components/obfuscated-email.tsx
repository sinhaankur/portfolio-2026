"use client"

/**
 * <ObfuscatedEmail> — a mailto link whose address is assembled in the BROWSER,
 * after mount, so the statically-exported HTML contains no `name@domain` for a
 * scraper or AI crawler to harvest. A real visitor sees a normal clickable link;
 * a bot reading the shipped HTML sees only a placeholder.
 *
 * Props:
 *   subject / body  pre-fill the mail
 *   account         "primary" (ymail) | "studio" (gmail walkthroughs)
 *   show            "address" (render the email text) | "label" (render children)
 */

import { useEffect, useState, type ReactNode } from "react"
import { email, mailto, type AddressKey } from "@/lib/obfuscated-email"

export function ObfuscatedEmail({
  subject,
  body,
  account = "primary",
  className,
  children,
}: {
  subject?: string
  body?: string
  account?: AddressKey
  className?: string
  /** When provided, this is the visible link text; otherwise the address shows. */
  children?: ReactNode
}) {
  // Assemble only after mount — static HTML ships with a harmless placeholder.
  const [href, setHref] = useState<string | undefined>(undefined)
  const [addr, setAddr] = useState("")
  useEffect(() => {
    setHref(mailto(subject, body, account))
    setAddr(email(account))
  }, [subject, body, account])

  if (!href) {
    // pre-hydration / bot view: a non-harvestable placeholder, not a mailto.
    return (
      <span className={className} aria-hidden="true">
        {children ?? "email (click to reveal)"}
      </span>
    )
  }
  return (
    <a href={href} data-cursor-hover className={className} rel="nofollow">
      {children ?? addr}
    </a>
  )
}
