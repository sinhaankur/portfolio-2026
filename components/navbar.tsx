"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Briefcase, FlaskConical, Layers, Gamepad2, Mail, Compass, type LucideIcon } from "lucide-react"
import { ThemeToggle } from "./theme-toggle"
import { LocaleSwitcher } from "./locale-switcher"
import { DisplayMenu } from "./display-menu"

// Anchor-based links use a leading "#" — when we're not on "/", clicking these
// needs to route to "/#anchor" instead of just looking for an in-page id.
// The Games link opens the retro webgames index (preserved as static HTML under /public/games).
// Each item carries a small lucide icon rendered before the label.
const navLinks: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Works", href: "#works", icon: Briefcase },
  { label: "Lab", href: "/lab", icon: FlaskConical },
  { label: "Framework", href: "/framework", icon: Compass },
  { label: "Skills", href: "/skills", icon: Layers },
  // The standalone "Usability" nav item is gone — its methodology now lives in
  // the Framework (Laws of UX & Cognition). The live usability engine remains at
  // /usability, reachable from /lab/usability-engine's "Open the live engine".
  { label: "Games", href: "/games/Gamelist.html", icon: Gamepad2 },
  { label: "Contact", href: "#contact", icon: Mail },
]

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  // Static export serves trailing slashes — normalize before comparing.
  const path = (pathname ?? "/").replace(/\/+$/, "") || "/"
  const onHome = path === "/"

  // "You are here": a route link is active when the visitor is on it or in
  // its section (Lab stays lit on /lab/celestial, Games on /games/dave-3d).
  // Anchor links have no active state — they're jump points, not places.
  const isActiveLink = (href: string) => {
    if (href.startsWith("#")) return false
    if (href.startsWith("/games/")) return path.startsWith("/games")
    const target = href.replace(/\/+$/, "")
    return path === target || path.startsWith(`${target}/`)
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Resolve a nav link's href:
  //  - "/skills" or "/upcoming" stay as-is
  //  - "#about" stays "#about" only on the home page; otherwise becomes "/#about"
  const resolveHref = (href: string) => {
    if (!href.startsWith("#")) return href
    return onHome ? href : `/${href}`
  }

  const handleLinkClick = (href: string) => {
    setIsMenuOpen(false)
    if (href.startsWith("#") && onHome) {
      const element = document.querySelector(href)
      if (element) {
        element.scrollIntoView({ behavior: "smooth" })
      }
    }
    // Off-home: the resolved href is "/#anchor" — the browser handles the navigation.
  }

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled ? "bg-background/80 backdrop-blur-md border-b border-border" : ""
        }`}
      >
        <nav
          aria-label="Primary"
          className="flex items-center justify-between px-6 py-4 md:px-12 md:py-5"
        >
          {/* Wordmark — site convention: this is the way HOME. On the home
              page it smooth-scrolls to the top; anywhere else it navigates
              to "/" (the old behavior scrolled the CURRENT page to top,
              which stranded visitors on case studies). */}
          <Link
            href="/"
            onClick={(e) => {
              if (onHome) {
                e.preventDefault()
                window.scrollTo({ top: 0, behavior: "smooth" })
              }
            }}
            aria-label="Home — Ankur Sinha"
            className="
              group flex items-center gap-2
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-4 focus-visible:ring-offset-background
              rounded
            "
          >
            <span className="font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground">
              Ankur Sinha
            </span>
            <span
              aria-hidden="true"
              className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-150 transition-transform duration-300"
            />
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const resolved = resolveHref(link.href)
              const isInPageAnchor = link.href.startsWith("#") && onHome
              const Icon = link.icon
              return (
                <li key={link.label}>
                  {isInPageAnchor ? (
                    <button
                      onClick={() => handleLinkClick(link.href)}
                      className="
                        group relative inline-flex items-center
                        font-mono text-xs tracking-wider
                        text-muted-foreground hover:text-foreground
                        transition-colors duration-300
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                        focus-visible:ring-offset-4 focus-visible:ring-offset-background
                        rounded
                      "
                    >
                      <Icon className="w-3.5 h-3.5 mr-1.5 opacity-70 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                      {link.label.toUpperCase()}
                      <span className="absolute -bottom-1 left-0 w-0 h-px bg-foreground group-hover:w-full transition-all duration-300" />
                    </button>
                  ) : (
                    // next/link for real Next routes (prefetch + instant client
                    // nav = seamless); plain <a> only for the static .html game
                    // index, which isn't a Next route (Link would 404 it).
                    (() => {
                      const cls = `
                        group relative inline-flex items-center
                        font-mono text-xs tracking-wider
                        transition-colors duration-300
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                        focus-visible:ring-offset-4 focus-visible:ring-offset-background
                        rounded
                        ${isActiveLink(link.href) ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
                      `
                      const inner = (
                        <>
                          <Icon className={`w-3.5 h-3.5 mr-1.5 transition-opacity ${isActiveLink(link.href) ? "opacity-100 text-accent" : "opacity-70 group-hover:opacity-100"}`} aria-hidden="true" />
                          {link.label.toUpperCase()}
                          {/* underline: persistent when active ("you are here"), sweep on hover otherwise */}
                          <span
                            className={`absolute -bottom-1 left-0 h-px transition-all duration-300 ${
                              isActiveLink(link.href) ? "w-full bg-accent" : "w-0 bg-foreground group-hover:w-full"
                            }`}
                          />
                        </>
                      )
                      return resolved.includes(".html") ? (
                        <a href={resolved} data-cursor-hover aria-current={isActiveLink(link.href) ? "page" : undefined} className={cls}>{inner}</a>
                      ) : (
                        <Link href={resolved} data-cursor-hover aria-current={isActiveLink(link.href) ? "page" : undefined} className={cls}>{inner}</Link>
                      )
                    })()
                  )}
                </li>
              )
            })}
          </ul>

          {/* Language switcher + theme toggle + accessibility menu */}
          <div className="hidden md:flex items-center gap-2">
            <LocaleSwitcher current="en" compact />
            <DisplayMenu />
            <ThemeToggle />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="
              md:hidden relative w-10 h-10 flex flex-col items-center justify-center gap-1.5
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              focus-visible:ring-offset-2 focus-visible:ring-offset-background
              rounded
            "
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
          >
            <motion.span
              animate={isMenuOpen ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }}
              className="w-6 h-px bg-foreground origin-center"
            />
            <motion.span
              animate={isMenuOpen ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
              className="w-6 h-px bg-foreground"
            />
            <motion.span
              animate={isMenuOpen ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
              className="w-6 h-px bg-foreground origin-center"
            />
          </button>
        </nav>
      </motion.header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-lg md:hidden"
          >
            <nav
              aria-label="Mobile"
              className="flex flex-col items-center justify-center h-full gap-8"
            >
              {navLinks.map((link, index) => {
                const resolved = resolveHref(link.href)
                const isInPageAnchor = link.href.startsWith("#") && onHome
                const isStaticHtml = resolved.includes(".html")
                const Icon = link.icon
                const cls = `
                  group inline-flex items-center gap-3 text-4xl font-sans tracking-tight
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  focus-visible:ring-offset-4 focus-visible:ring-offset-background
                  rounded
                  ${isActiveLink(link.href) ? "italic text-accent" : "text-foreground"}
                `
                const current = isActiveLink(link.href) ? ("page" as const) : undefined
                const inner = (
                  <>
                    <Icon className={`w-6 h-6 ${isActiveLink(link.href) ? "text-accent" : "text-muted-foreground"}`} aria-hidden="true" />
                    {link.label}
                    {isActiveLink(link.href) && (
                      <span className="ml-3 align-middle font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                        · here
                      </span>
                    )}
                  </>
                )
                return (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ delay: index * 0.08 }}
                  >
                    {/* anchor → button; static .html → <a>; real route → Link
                        (prefetch + instant client nav; menu closes into the next
                        page seamlessly instead of a full reload). */}
                    {isInPageAnchor ? (
                      <button onClick={() => handleLinkClick(link.href)} aria-current={current} className={cls}>{inner}</button>
                    ) : isStaticHtml ? (
                      <a href={resolved} onClick={() => setIsMenuOpen(false)} aria-current={current} className={cls}>{inner}</a>
                    ) : (
                      <Link href={resolved} onClick={() => setIsMenuOpen(false)} aria-current={current} className={cls}>{inner}</Link>
                    )}
                  </motion.div>
                )
              })}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-8 flex items-center gap-3"
              >
                <DisplayMenu />
                <ThemeToggle />
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
