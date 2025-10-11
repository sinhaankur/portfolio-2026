"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Palette, Save, Upload, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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

const colorPalettes = [
  {
    name: "Emerald Wellness",
    primary: "#059669",
    secondary: "#0d9488",
    description: "Calming green tones for wellness",
  },
  {
    name: "Ocean Serenity",
    primary: "#0284c7",
    secondary: "#0ea5e9",
    description: "Peaceful blue shades",
  },
  {
    name: "Lavender Calm",
    primary: "#7c3aed",
    secondary: "#8b5cf6",
    description: "Relaxing purple hues",
  },
  {
    name: "Warm Earth",
    primary: "#dc2626",
    secondary: "#ea580c",
    description: "Grounding earth tones",
  },
  {
    name: "Rose Gold",
    primary: "#e11d48",
    secondary: "#f97316",
    description: "Elegant rose and gold",
  },
  {
    name: "Forest Zen",
    primary: "#16a34a",
    secondary: "#65a30d",
    description: "Natural forest greens",
  },
  {
    name: "Sunset Warmth",
    primary: "#f59e0b",
    secondary: "#f97316",
    description: "Warm sunset colors",
  },
  {
    name: "Midnight Professional",
    primary: "#1e293b",
    secondary: "#475569",
    description: "Professional dark tones",
  },
]

export function BrandingEditor() {
  const [settings, setSettings] = useState<BrandingSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchBrandingSettings()
  }, [])

  const fetchBrandingSettings = async () => {
    try {
      const response = await fetch("/api/branding")
      const data = await response.json()
      setSettings(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load branding settings",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return

    setIsSaving(true)
    try {
      const response = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Branding settings updated successfully",
        })
      } else {
        throw new Error("Failed to save")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save branding settings",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (field: keyof BrandingSettings, value: string) => {
    if (!settings) return
    setSettings({ ...settings, [field]: value })
  }

  const applyColorPalette = (palette: (typeof colorPalettes)[0]) => {
    if (!settings) return
    setSettings({
      ...settings,
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
    })
    toast({
      title: "Palette Applied",
      description: `${palette.name} colors have been applied`,
    })
  }

  if (isLoading) {
    return <div className="p-6">Loading branding settings...</div>
  }

  if (!settings) {
    return <div className="p-6">Failed to load branding settings</div>
  }

  return (
    <div className="space-y-6">
      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Live Preview
          </CardTitle>
          <CardDescription>See how your branding changes will look</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="p-6 rounded-lg border-2"
            style={{
              backgroundColor: `${settings.primaryColor}10`,
              borderColor: settings.primaryColor,
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: settings.primaryColor }}
              >
                {settings.companyName.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold" style={{ color: settings.primaryColor }}>
                  {settings.companyName}
                </h3>
                <p className="text-sm" style={{ color: settings.secondaryColor }}>
                  {settings.tagline}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-2">{settings.aboutText}</p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>📧 {settings.email}</p>
              <p>📞 {settings.phone}</p>
              <p>📍 {settings.address}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Basic company details and contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={settings.companyName}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
                placeholder="Your Company Name"
              />
            </div>
            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={settings.tagline}
                onChange={(e) => handleInputChange("tagline", e.target.value)}
                placeholder="Your company tagline"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="aboutText">About Text</Label>
            <Textarea
              id="aboutText"
              value={settings.aboutText}
              onChange={(e) => handleInputChange("aboutText", e.target.value)}
              placeholder="Brief description of your business"
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={settings.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="info@yourcompany.com"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={settings.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
              placeholder="123 Main St, City, State 12345"
            />
          </div>

          <div>
            <Label htmlFor="hours">Business Hours</Label>
            <Input
              id="hours"
              value={settings.hours}
              onChange={(e) => handleInputChange("hours", e.target.value)}
              placeholder="Mon-Fri: 9AM-7PM, Sat: 9AM-5PM"
            />
          </div>
        </CardContent>
      </Card>

      {/* Colors & Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Colors & Branding
          </CardTitle>
          <CardDescription>Customize your brand colors and visual identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-base font-medium">Quick Color Palettes</Label>
            <p className="text-sm text-gray-600 mb-4">
              Choose from pre-designed color combinations perfect for massage therapy
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {colorPalettes.map((palette, index) => (
                <button
                  key={index}
                  onClick={() => applyColorPalette(palette)}
                  className="p-3 border rounded-lg hover:border-gray-400 transition-colors text-left group"
                >
                  <div className="flex gap-2 mb-2">
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: palette.primary }}
                    />
                    <div
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: palette.secondary }}
                    />
                  </div>
                  <h4 className="font-medium text-sm group-hover:text-gray-900">{palette.name}</h4>
                  <p className="text-xs text-gray-500">{palette.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-base font-medium mb-4 block">Custom Colors</Label>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => handleInputChange("primaryColor", e.target.value)}
                    className="w-16 h-10 p-1 border rounded"
                  />
                  <Input
                    value={settings.primaryColor}
                    onChange={(e) => handleInputChange("primaryColor", e.target.value)}
                    placeholder="#059669"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={settings.secondaryColor}
                    onChange={(e) => handleInputChange("secondaryColor", e.target.value)}
                    className="w-16 h-10 p-1 border rounded"
                  />
                  <Input
                    value={settings.secondaryColor}
                    onChange={(e) => handleInputChange("secondaryColor", e.target.value)}
                    placeholder="#0d9488"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="logo">Logo Upload</Label>
            <div className="flex items-center gap-4 mt-2">
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Upload Logo
              </Button>
              <span className="text-sm text-gray-500">{settings.logo ? "Logo uploaded" : "No logo uploaded"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="min-w-32">
          {isSaving ? (
            "Saving..."
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
