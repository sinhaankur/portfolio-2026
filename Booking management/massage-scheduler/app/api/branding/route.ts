import { type NextRequest, NextResponse } from "next/server"

interface BrandingSettings {
  companyName: string
  tagline: string
  primaryColor: string
  secondaryColor: string
  logo?: string
  phone: string
  email: string
  address: string
  hours: string
  aboutText: string
}

// Mock storage - in production, use a database
let brandingSettings: BrandingSettings = {
  companyName: "Serenity Touch",
  tagline: "Professional Massage Therapy",
  primaryColor: "#059669", // emerald-600
  secondaryColor: "#0d9488", // teal-600
  phone: "(555) 123-4567",
  email: "info@serenitytouch.com",
  address: "123 Wellness Ave, Spa City, SC 12345",
  hours: "Mon-Fri: 9AM-7PM, Sat: 9AM-5PM, Sun: Closed",
  aboutText: "Experience the healing power of professional massage therapy in our tranquil spa environment.",
}

export async function GET() {
  return NextResponse.json(brandingSettings)
}

export async function PUT(request: NextRequest) {
  try {
    const updates = await request.json()
    brandingSettings = { ...brandingSettings, ...updates }
    return NextResponse.json(brandingSettings)
  } catch (error) {
    return NextResponse.json({ error: "Failed to update branding" }, { status: 500 })
  }
}
