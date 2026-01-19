"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card elevation-2 border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center elevation-1">
              <span className="text-primary-foreground font-bold text-lg">AS</span>
            </div>
            <h1 className="text-xl font-semibold text-foreground">Ankur Sinha Consulting</h1>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 text-balance">
          UX Mentoring & Brainstorming
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty px-4 leading-relaxed">
          Book a session with Ankur Sinha for personalized UX mentoring and creative brainstorming.
        </p>
        <Button size="lg" className="elevation-2 hover:elevation-3 transition-all" asChild>
          <Link href="/book">
            <Calendar className="w-5 h-5 mr-2" />
            Book Session
          </Link>
        </Button>
      </section>

      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">&copy; 2024 Ankur Sinha UX Mentoring. All rights reserved.</p>
          <p className="text-muted-foreground text-sm mt-2">Built by AS</p>
        </div>
      </footer>
    </div>
  )
}
