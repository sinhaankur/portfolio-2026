"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Calendar, Shield, Palette } from "lucide-react"

export function SystemSettings() {
  const [settings, setSettings] = useState({
    companyName: "Massage Therapy Center",
    companyEmail: "info@massagetherapy.com",
    companyPhone: "(555) 123-4567",
    companyAddress: "123 Wellness St, Health City, HC 12345",
    businessHours: "Monday - Friday: 9:00 AM - 7:00 PM\nSaturday: 9:00 AM - 5:00 PM\nSunday: Closed",
    autoApproveAppointments: false,
    requireEmailVerification: true,
    enable2FA: true,
    allowOnlinePayments: true,
    sendReminderEmails: true,
    reminderHours: 24,
    primaryColor: "#3b82f6",
    secondaryColor: "#10b981",
  })

  const handleSave = async () => {
    try {
      // In a real app, save settings to database
      console.log("Saving settings:", settings)
      alert("Settings saved successfully!")
    } catch (error) {
      console.error("Error saving settings:", error)
      alert("Failed to save settings")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            System Settings
          </CardTitle>
          <CardDescription>Configure your massage therapy platform</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="appointments">Appointments</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Company Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={settings.companyName}
                        onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="companyEmail">Company Email</Label>
                      <Input
                        id="companyEmail"
                        type="email"
                        value={settings.companyEmail}
                        onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="companyPhone">Company Phone</Label>
                      <Input
                        id="companyPhone"
                        value={settings.companyPhone}
                        onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="companyAddress">Company Address</Label>
                      <Input
                        id="companyAddress"
                        value={settings.companyAddress}
                        onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="businessHours">Business Hours</Label>
                    <Textarea
                      id="businessHours"
                      value={settings.businessHours}
                      onChange={(e) => setSettings({ ...settings, businessHours: e.target.value })}
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appointments" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Appointment Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-approve appointments</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically approve new appointments without manual review
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoApproveAppointments}
                      onCheckedChange={(checked) => setSettings({ ...settings, autoApproveAppointments: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Send reminder emails</Label>
                      <p className="text-sm text-muted-foreground">Send appointment reminders to customers</p>
                    </div>
                    <Switch
                      checked={settings.sendReminderEmails}
                      onCheckedChange={(checked) => setSettings({ ...settings, sendReminderEmails: checked })}
                    />
                  </div>
                  {settings.sendReminderEmails && (
                    <div className="grid gap-2">
                      <Label htmlFor="reminderHours">Reminder timing (hours before appointment)</Label>
                      <Input
                        id="reminderHours"
                        type="number"
                        min="1"
                        max="168"
                        value={settings.reminderHours}
                        onChange={(e) => setSettings({ ...settings, reminderHours: Number.parseInt(e.target.value) })}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow online payments</Label>
                      <p className="text-sm text-muted-foreground">Enable customers to pay online when booking</p>
                    </div>
                    <Switch
                      checked={settings.allowOnlinePayments}
                      onCheckedChange={(checked) => setSettings({ ...settings, allowOnlinePayments: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require email verification</Label>
                      <p className="text-sm text-muted-foreground">
                        Users must verify their email before accessing the platform
                      </p>
                    </div>
                    <Switch
                      checked={settings.requireEmailVerification}
                      onCheckedChange={(checked) => setSettings({ ...settings, requireEmailVerification: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">Require 2FA for all user logins</p>
                    </div>
                    <Switch
                      checked={settings.enable2FA}
                      onCheckedChange={(checked) => setSettings({ ...settings, enable2FA: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branding" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Branding & Appearance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="primaryColor">Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primaryColor"
                          type="color"
                          value={settings.primaryColor}
                          onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                          className="w-16 h-10"
                        />
                        <Input
                          value={settings.primaryColor}
                          onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="secondaryColor">Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="secondaryColor"
                          type="color"
                          value={settings.secondaryColor}
                          onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                          className="w-16 h-10"
                        />
                        <Input
                          value={settings.secondaryColor}
                          onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-6">
            <Button onClick={handleSave} className="px-8">
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
