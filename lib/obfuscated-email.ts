/**
 * Email obfuscation — keep Ankur's address usable by humans, invisible to the
 * spam bots + AI crawlers that harvest `mailto:` links and plain-text addresses
 * out of static HTML/JS.
 *
 * The literal address is NEVER written in source as one string, so a scraper
 * reading the shipped page finds no `name@domain` to grab. It's assembled from
 * parts at runtime (client-side), where a real visitor is. Polite crawlers that
 * execute no JS see nothing; dumb harvesters that regex the HTML see nothing.
 *
 * Usage:
 *   import { email, mailto } from "@/lib/obfuscated-email"
 *   <ObfuscatedEmail subject="Hello" />              // the component below
 *   onClick={() => { location.href = mailto("hi@…") }}
 */

// Each address is stored REVERSED (user and domain separately) so the full
// `name@domain` never appears in source — not greppable, not regex-harvestable.
// "primary" = the public contact (ymail); "studio" = the walkthrough/about
// address (gmail). Reverse these to read them; a scraper won't.
const ADDRESSES = {
  primary: { userRev: "ruknaahnis", domainRev: "moc.liamy" },     // sinhaankur / ymail.com
  studio: { userRev: "728ruknaahnis", domainRev: "moc.liamg" },  // sinhaankur827 / gmail.com
} as const

type AddressKey = keyof typeof ADDRESSES

const rev = (s: string) => [...s].reverse().join("")

/** The real address for a key, assembled at call time (never a source literal). */
export function email(key: AddressKey = "primary"): string {
  const a = ADDRESSES[key]
  return `${rev(a.userRev)}${String.fromCharCode(64)}${rev(a.domainRev)}` // 64 = '@'
}

/** A ready mailto: with optional subject + body, address assembled at runtime. */
export function mailto(subject?: string, body?: string, key: AddressKey = "primary"): string {
  const params: string[] = []
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
  if (body) params.push(`body=${encodeURIComponent(body)}`)
  const q = params.length ? `?${params.join("&")}` : ""
  return `mailto:${email(key)}${q}`
}

export type { AddressKey }
