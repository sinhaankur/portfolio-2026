"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserManagement } from "@/components/admin/user-management"
import { ServiceManager } from "@/components/admin/service-manager"
import { AppointmentManager } from "@/components/admin/appointment-manager"
import { SystemSettings } from "@/components/admin/system-settings"
import { Calendar, Clock, User, Users, DollarSign } from "lucide-react"

interface DashboardStats {
  totalUsers: number
  totalProfessionals: number
  totalCustomers: number
  pendingAppointments: number
  upcomingAppointments: number
  totalRevenue: number
  monthlyRevenue: number
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalProfessionals: 0,
    totalCustomers: 0,
    pendingAppointments: 0,
    upcomingAppointments: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState("overview")

  useEffect(() => {
    loadDashboardStats()
  }, [])

  const loadDashboardStats = async () => {
    try {
      const supabase = createClient()

      // Get user counts
      const { data: users } = await supabase.from("profiles").select("role")
      const totalUsers = users?.length || 0
      const totalProfessionals = users?.filter((u) => u.role === "professional").length || 0
      const totalCustomers = users?.filter((u) => u.role === "customer").length || 0

      // Get appointment stats
      const { data: appointments } = await supabase
        .from("appointments")
        .select("status, total_price, created_at, appointment_date")

      const pendingAppointments = appointments?.filter((a) => a.status === "pending").length || 0
      const upcomingAppointments =
        appointments?.filter((a) => a.status === "confirmed" && new Date(a.appointment_date) >= new Date()).length || 0

      // Calculate revenue
      const totalRevenue = appointments?.reduce((sum, a) => sum + (a.total_price || 0), 0) || 0
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      const monthlyRevenue =
        appointments
          ?.filter((a) => {
            const date = new Date(a.created_at)
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear
          })
          .reduce((sum, a) => sum + (a.total_price || 0), 0) || 0

      setStats({
        totalUsers,
        totalProfessionals,
        totalCustomers,
        pendingAppointments,
        upcomingAppointments,
        totalRevenue,
        monthlyRevenue,
      })
    } catch (error) {
      console.error("Error loading dashboard stats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-blue-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">MT</span>
            </div>
            <h1 className="text-xl font-semibold text-blue-900">Admin Dashboard</h1>
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
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Total Users</p>
                      <p className="text-2xl font-bold text-blue-900">{stats.totalUsers}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Professionals</p>
                      <p className="text-2xl font-bold text-blue-900">{stats.totalProfessionals}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Pending Approvals</p>
                      <p className="text-2xl font-bold text-blue-900">{stats.pendingAppointments}</p>
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
                      <p className="text-sm text-blue-600 font-medium">Monthly Revenue</p>
                      <p className="text-2xl font-bold text-blue-900">${stats.monthlyRevenue.toFixed(2)}</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-emerald-600" />
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
                  <CardDescription>Common administrative tasks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    className="w-full justify-start bg-transparent"
                    variant="outline"
                    onClick={() => setSelectedTab("appointments")}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Review Pending Appointments ({stats.pendingAppointments})
                  </Button>
                  <Button
                    className="w-full justify-start bg-transparent"
                    variant="outline"
                    onClick={() => setSelectedTab("users")}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Manage Users
                  </Button>
                  <Button
                    className="w-full justify-start bg-transparent"
                    variant="outline"
                    onClick={() => setSelectedTab("services")}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Manage Services
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Overview</CardTitle>
                  <CardDescription>Platform statistics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Revenue</span>
                    <span className="font-semibold">${stats.totalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Upcoming Appointments</span>
                    <span className="font-semibold">{stats.upcomingAppointments}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Customer Accounts</span>
                    <span className="font-semibold">{stats.totalCustomers}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <UserManagement onStatsUpdate={loadDashboardStats} />
          </TabsContent>

          <TabsContent value="appointments">
            <AppointmentManager onStatsUpdate={loadDashboardStats} />
          </TabsContent>

          <TabsContent value="services">
            <ServiceManager />
          </TabsContent>

          <TabsContent value="settings">
            <SystemSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
