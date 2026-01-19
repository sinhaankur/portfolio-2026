"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, ArrowLeft, CheckCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

const massageServices = [
  {
    id: 1,
    name: "UX Mentoring & Brainstorming",
    duration: 60,
    description: "Personalized UX mentoring and creative brainstorming session",
  },
]

const timeSlots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]

export default function BookingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingComplete, setBookingComplete] = useState(false)
  const [formData, setFormData] = useState({
    serviceId: "",
    date: "",
    time: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    notes: "",
  })

  const selectedService = massageServices.find((s) => s.id.toString() === formData.serviceId)

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: formData.clientName,
          client_email: formData.clientEmail,
          client_phone: formData.clientPhone,
          service_id: Number.parseInt(formData.serviceId),
          appointment_date: formData.date,
          appointment_time: formData.time,
          notes: formData.notes,
        }),
      })

      if (response.ok) {
        setBookingComplete(true)
      } else {
        alert("Failed to book appointment. Please try again.")
      }
    } catch (error) {
      console.error("Booking error:", error)
      alert("An error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (bookingComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center elevation-3 bg-card border-border">
          <CardContent className="p-8">
            <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 elevation-1">
              <CheckCircle className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Booking Confirmed!</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Your appointment has been scheduled. You'll receive a confirmation email shortly.
            </p>
            <Button onClick={() => router.push("/")} className="elevation-2 hover:elevation-3 transition-all">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card elevation-2 border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center elevation-1">
              <span className="text-primary-foreground font-bold text-lg">AS</span>
            </div>
            <h1 className="text-lg font-semibold text-foreground">Ankur Sinha Consulting</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8 text-center">Book Your UX Mentoring Session</h1>

          <div className="flex items-center justify-center mb-12">
            {[1, 2, 3].map((stepNum) => (
              <div key={stepNum} className="flex items-center">
                <div
                  className={`w-3 h-3 rounded-full transition-all ${step >= stepNum ? "bg-primary" : "bg-border"}`}
                />
                {stepNum < 3 && (
                  <div
                    className={`w-16 h-1 mx-4 rounded-full transition-all ${
                      step > stepNum ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {step === 1 && (
            <Card className="elevation-2 bg-card border-border">
              <CardHeader>
                <CardTitle className="text-xl text-foreground">Select Your Service</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Choose the massage service you'd like to book
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {massageServices.map((service) => (
                  <div
                    key={service.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      formData.serviceId === service.id.toString()
                        ? "border-primary bg-primary/5 elevation-2"
                        : "border-border hover:border-primary/50 elevation-1 hover:elevation-2"
                    }`}
                    onClick={() => handleInputChange("serviceId", service.id.toString())}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{service.name}</h3>
                        <p className="text-muted-foreground mt-2 leading-relaxed">{service.description}</p>
                        <div className="flex items-center mt-3 text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {service.duration} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  onClick={() => setStep(2)}
                  disabled={!formData.serviceId}
                  className="w-full elevation-2 hover:elevation-3 transition-all"
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="elevation-2 bg-card border-border">
              <CardHeader>
                <CardTitle className="text-xl text-foreground">Select Date & Time</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {selectedService && `${selectedService.name} - $${selectedService.price}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="date" className="text-foreground font-medium">
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="mt-2 bg-input border-border"
                  />
                </div>

                <div>
                  <Label htmlFor="time" className="text-foreground font-medium">
                    Time
                  </Label>
                  <Select value={formData.time} onValueChange={(value) => handleInputChange("time", value)}>
                    <SelectTrigger className="mt-2 bg-input border-border">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1 elevation-1 hover:elevation-2 transition-all"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!formData.date || !formData.time}
                    className="flex-1 elevation-2 hover:elevation-3 transition-all"
                  >
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="elevation-2 bg-card border-border">
              <CardHeader>
                <CardTitle className="text-xl text-foreground">Contact Information</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Please provide your details for the appointment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="name" className="text-foreground font-medium">
                    Name *
                  </Label>
                  <Input
                    id="name"
                    value={formData.clientName}
                    onChange={(e) => handleInputChange("clientName", e.target.value)}
                    placeholder="Your name"
                    className="mt-2 bg-input border-border"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-foreground font-medium">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => handleInputChange("clientEmail", e.target.value)}
                    placeholder="Your email"
                    className="mt-2 bg-input border-border"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-foreground font-medium">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.clientPhone}
                    onChange={(e) => handleInputChange("clientPhone", e.target.value)}
                    placeholder="Your phone"
                    className="mt-2 bg-input border-border"
                  />
                </div>

                <div>
                  <Label htmlFor="notes" className="text-foreground font-medium">
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="Any special requests..."
                    className="mt-2 bg-input border-border"
                    rows={3}
                  />
                </div>

                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 elevation-1">
                  <h4 className="font-semibold text-foreground mb-2">Summary</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      {selectedService?.name} - ${selectedService?.price}
                    </p>
                    <p>
                      {formData.date} at {formData.time}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1 elevation-1 hover:elevation-2 transition-all"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!formData.clientName || !formData.clientEmail || isSubmitting}
                    className="flex-1 elevation-2 hover:elevation-3 transition-all"
                  >
                    {isSubmitting ? "Booking..." : "Book Now"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
