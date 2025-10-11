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
              <span className="text-primary-foreground font-bold text-lg">ST</span>
            </div>
            <h1 className="text-xl font-semibold text-foreground">Serenity Touch</h1>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 text-balance">
          Professional Massage Therapy
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty px-4 leading-relaxed">
          Experience healing and relaxation with our certified massage therapists.
        </p>
        <Button size="lg" className="elevation-2 hover:elevation-3 transition-all" asChild>
          <Link href="/book">
            <Calendar className="w-5 h-5 mr-2" />
            Book Appointment
          </Link>
        </Button>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center text-foreground mb-12">Our Services</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              name: "Swedish Massage",
              duration: "60 min",
              price: "$80",
              description: "Relaxing full-body massage",
            },
            {
              name: "Deep Tissue Massage",
              duration: "90 min",
              price: "$120",
              description: "Therapeutic muscle tension relief",
            },
            {
              name: "Hot Stone Massage",
              duration: "75 min",
              price: "$100",
              description: "Soothing massage with heated stones",
            },
          ].map((service, index) => (
            <Card key={index} className="elevation-2 hover:elevation-3 transition-all border-border bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-card-foreground text-xl">{service.name}</CardTitle>
                <CardDescription className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {service.duration}
                  </span>
                  <span className="font-semibold text-primary text-lg">{service.price}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-muted-foreground mb-6 leading-relaxed">{service.description}</p>
                <Button className="w-full elevation-1 hover:elevation-2 transition-all" asChild>
                  <Link href="/book">Book Now</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">&copy; 2024 Serenity Touch Massage Therapy. All rights reserved.</p>
          <p className="text-muted-foreground text-sm mt-2">Built by SA</p>
        </div>
      </footer>
    </div>
  )
}
