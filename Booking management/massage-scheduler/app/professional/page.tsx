"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScheduleManager } from "@/components/professional/schedule-manager"
import { ServiceOfferings } from "@/components/professional/service-offerings"
import { AppointmentCalendar } from "@/components/professional/appointment-calendar"
import { ProfessionalProfile } from "@/components/professional/professional-profile"
import { Calendar, Clock, User, DollarSign, CheckCircle } from "lucide-react"

interface ProfessionalStats {
  todayAppointments: number
  weekAppointments: number
  monthRevenue: number
  completedAppointments: number
  pendingAppointments: number
}

export default function ProfessionalPage() {
  const [stats, setStats] = useState<ProfessionalStats>({
    todayAppointments: 0,
    weekAppointments: 0,
    monthRevenue: 0,
    completedAppointments: 0,
    pendingAppointments: 0,
  })
  const [professionalName, setProfessionalName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState("overview")

  useEffect(() => {
    loadProfessionalData()
  }, [])

  const loadProfessionalData = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // Get professional profile
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()

      setProfessionalName(profile?.full_name || "Professional")

      // Get appointment stats
      const { data: appointments } = await supabase
        .from("appointments")
        .select("appointment_date, status, total_price, created_at")
        .eq("professional_id", user.id)

      if (appointments) {
        const today = new Date().toISOString().split("T")[0]
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        const weekStartStr = weekStart.toISOString().split("T")[0]

        const currentMonth = new Date().getMonth()
        const currentYear = new Date().getFullYear()

        const todayAppointments = appointments.filter((a) => a.appointment_date === today).length
        const weekAppointments = appointments.filter((a) => a.appointment_date >= weekStartStr).length
        const monthRevenue = appointments
          .filter((a) => {
            const date = new Date(a.created_at)
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear && a.status === "completed"
          })
          .reduce((sum, a) => sum + (a.total_price || 0), 0)
        const completedAppointments = appointments.filter((a) => a.status === "completed").length
        const pendingAppointments = appointments.filter((a) => a.status === "pending").length

        setStats({
          todayAppointments,
          weekAppointments,
          monthRevenue,
          completedAppointments,
          pendingAppointments,
        })
      }
    } catch (error) {
      console.error("Error loading professional data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-green-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-green-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">MT</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-green-900">Professional Dashboard</h1>
              <p className="text-sm text-green-600">Welcome back, {professionalName}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const supabase = createClient()
                supabase.auth.signOut()
                window.location.href = "/auth/login"
              }}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Today's Appointments</p>
                      <p className="text-2xl font-bold text-green-900">{stats.todayAppointments}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">This Week</p>
                      <p className="text-2xl font-bold text-green-900">{stats.weekAppointments}</p>
                    </div>
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <Clock className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Monthly Revenue</p>
                      <p className="text-2xl font-bold text-green-900">${stats.monthRevenue.toFixed(2)}</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Completed</p>
                      <p className="text-2xl font-bold text-green-900">{stats.completedAppointments}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common tasks and shortcuts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    className="w-full justify-start bg-transparent"
                    variant="outline"
                    onClick={() => setSelectedTab("calendar")}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    View Today's Schedule
                  </Button>
                  <Button
                    className="w-full justify-start bg-transparent"
                    variant="outline"
                    onClick={() => setSelectedTab("schedule")}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Update Availability
                  </Button>
                  <Button
                    className="w-full justify-start bg-transparent"
                    variant="outline"
                    onClick={() => setSelectedTab("services")}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Manage Services
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your latest appointments and updates</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Pending Appointments</span>
                    <span className="font-semibold">{stats.pendingAppointments}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Completed This Month</span>
                    <span className="font-semibold">{stats.completedAppointments}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Revenue This Month</span>
                    <span className="font-semibold">${stats.monthRevenue.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="calendar">
            <AppointmentCalendar onStatsUpdate={loadProfessionalData} />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleManager />
          </TabsContent>

          <TabsContent value="services">
            <ServiceOfferings />
          </TabsContent>

          <TabsContent value="profile">
            <ProfessionalProfile />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
