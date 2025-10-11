"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, User, Phone, Mail, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Appointment {
  id: string
  appointment_date: string
  appointment_time: string
  status: "pending" | "confirmed" | "completed" | "cancelled"
  notes: string | null
  total_price: number
  created_at: string
  services: {
    name: string
    duration: number
    price: number
  }
  professionals: {
    full_name: string
    phone: string | null
  } | null
}

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: string
}

export default function CustomerDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState("appointments")
  const router = useRouter()

  useEffect(() => {
    loadCustomerData()
  }, [])

  const loadCustomerData = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      // Get user profile
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()

      setProfile(profileData)

      // Get appointments
      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select(`
          *,
          services (name, duration, price),
          professionals:profiles!appointments_professional_id_fkey (full_name, phone)
        `)
        .eq("customer_id", user.id)
        .order("appointment_date", { ascending: false })

      setAppointments(appointmentsData || [])
    } catch (error) {
      console.error("Error loading customer data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-200"
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  const upcomingAppointments = appointments.filter((apt) => apt.status === "confirmed" || apt.status === "pending")
  const pastAppointments = appointments.filter((apt) => apt.status === "completed" || apt.status === "cancelled")

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-blue-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">ST</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-blue-900">My Dashboard</h1>
              <p className="text-sm text-blue-600">Welcome back, {profile?.full_name || "Customer"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/book">
                <Plus className="w-4 h-4 mr-2" />
                Book Appointment
              </Link>
            </Button>
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    All Appointments
                  </CardTitle>
                  <CardDescription>View all your massage therapy appointments</CardDescription>
                </CardHeader>
                <CardContent>
                  {appointments.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No appointments yet</p>
                      <Button asChild>
                        <Link href="/book">Book Your First Appointment</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {appointments.map((appointment) => (
                        <div key={appointment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-lg">{appointment.services?.name || "Service"}</h3>
                                <Badge className={getStatusColor(appointment.status)}>
                                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                </Badge>
                              </div>
                              <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4" />
                                  {formatDate(appointment.appointment_date)}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  {formatTime(appointment.appointment_time)} ({appointment.services?.duration || 60}{" "}
                                  min)
                                </div>
                                {appointment.professionals && (
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    {appointment.professionals.full_name}
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-blue-600">
                                    ${appointment.total_price?.toFixed(2) || appointment.services?.price?.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              {appointment.notes && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                                  <p className="text-sm text-gray-700">{appointment.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Upcoming Appointments
                </CardTitle>
                <CardDescription>Your confirmed and pending appointments</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No upcoming appointments</p>
                    <Button asChild>
                      <Link href="/book">Schedule an Appointment</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingAppointments.map((appointment) => (
                      <div key={appointment.id} className="border-l-4 border-l-blue-500 bg-blue-50 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg">{appointment.services?.name || "Service"}</h3>
                              <Badge className={getStatusColor(appointment.status)}>
                                {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                              </Badge>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {formatDate(appointment.appointment_date)}
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {formatTime(appointment.appointment_time)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>Your account details and contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Full Name</label>
                      <p className="text-lg">{profile?.full_name || "Not provided"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Email</label>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <p>{profile?.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Phone</label>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <p>{profile?.phone || "Not provided"}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Account Type</label>
                      <p className="capitalize">{profile?.role}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-4">Quick Stats</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{appointments.length}</p>
                      <p className="text-sm text-gray-600">Total Appointments</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {appointments.filter((a) => a.status === "completed").length}
                      </p>
                      <p className="text-sm text-gray-600">Completed</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{upcomingAppointments.length}</p>
                      <p className="text-sm text-gray-600">Upcoming</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">
                        $
                        {appointments
                          .filter((a) => a.status === "completed")
                          .reduce((sum, a) => sum + (a.total_price || 0), 0)
                          .toFixed(0)}
                      </p>
                      <p className="text-sm text-gray-600">Total Spent</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
