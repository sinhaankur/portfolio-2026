import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Instrument_Serif, JetBrains_Mono, Fraunces } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { DisplayPrefsProvider } from "@/components/display-prefs"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

// Editorial display font with real optical character at large sizes.
// Used on case-study headlines and section h2s — anywhere Inter Light
// was feeling generic at display size.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  // Variable axes — keeps the file count down while giving us weight + opsz.
  axes: ["opsz", "SOFT", "WONK"],
  style: ["normal", "italic"],
  display: "swap",
})

// Instrument Serif still appears for short inline italic moments
// (single-word emphasis like "collaborate"). Fraunces handles the big stuff.
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
})

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Ankur Sinha · Principal UX Designer · Human–AI Interaction",
  description:
    "Principal UX Designer working on human-in-the-loop interfaces for agentic AI. Helm, Sentinel, Recourse — code prototypes for keeping humans in command.",
  authors: [{ name: "Ankur Sinha" }],
  openGraph: {
    title: "Ankur Sinha · Principal UX Designer",
    description:
      "Human–AI interaction. Helm, Sentinel, Recourse — code prototypes for keeping humans in command of agentic AI.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#050505",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${instrument.variable} ${jetbrains.variable}`}
    >
      <body className="font-sans antialiased overflow-x-hidden bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          <DisplayPrefsProvider>
            <a href="#main" className="skip-link">
              Skip to main content
            </a>
            <div className="noise-overlay" aria-hidden="true" />
            {children}
          </DisplayPrefsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
