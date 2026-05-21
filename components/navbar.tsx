"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ThemeToggle } from "./theme-toggle"
import { DisplayMenu } from "./display-menu"

// Anchor-based links use a leading "#" — when we're not on "/", clicking these
// needs to route to "/#anchor" instead of just looking for an in-page id.
// The Games link opens the retro webgames index (preserved as static HTML under /public/games).
const navLinks = [
  { label: "Works", href: "#works" },
  { label: "Lab", href: "#lab" },
  { label: "Skills", href: "/skills" },
  { label: "Usability", href: "/usability" },
  { label: "Games", href: "/games/Gamelist.html" },
  { label: "Contact", href: "#contact" },
]

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  const onHome = pathname === "/"

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
          {/* Logo */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: "smooth" })
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
          </a>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link, index) => {
              const resolved = resolveHref(link.href)
              const isInPageAnchor = link.href.startsWith("#") && onHome
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
                      <span className="text-accent mr-1">0{index + 1}</span>
                      {link.label.toUpperCase()}
                      <span className="absolute -bottom-1 left-0 w-0 h-px bg-foreground group-hover:w-full transition-all duration-300" />
                    </button>
                  ) : (
                    <a
                      href={resolved}
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
                      <span className="text-accent mr-1">0{index + 1}</span>
                      {link.label.toUpperCase()}
                      <span className="absolute -bottom-1 left-0 w-0 h-px bg-foreground group-hover:w-full transition-all duration-300" />
                    </a>
                  )}
                </li>
              )
            })}
          </ul>

          {/* Theme toggle + accessibility menu */}
          <div className="hidden md:flex items-center gap-2">
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
                const Tag = isInPageAnchor ? "button" : "a"
                const props = isInPageAnchor
                  ? { onClick: () => handleLinkClick(link.href) }
                  : { href: resolved, onClick: () => setIsMenuOpen(false) }
                return (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ delay: index * 0.08 }}
                  >
                    <Tag
                      {...props}
                      className="
                        group text-4xl font-sans tracking-tight text-foreground
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                        focus-visible:ring-offset-4 focus-visible:ring-offset-background
                        rounded
                      "
                    >
                      <span className="text-accent font-mono text-sm mr-2">
                        0{index + 1}
                      </span>
                      {link.label}
                    </Tag>
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
