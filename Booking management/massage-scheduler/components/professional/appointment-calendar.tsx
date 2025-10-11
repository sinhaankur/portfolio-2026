"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, User, Mail, Phone, CheckCircle, XCircle } from "lucide-react"

interface Appointment {
  id: string
  customer_id: string
  service_id: string
  appointment_date: string
  start_time: string
  end_time: string
  status: "pending" | "confirmed" | "completed" | "cancelled"
  notes: string | null
  total_price: number
  customer: {
    full_name: string
    email: string
    phone: string | null
  }
  service: {
    name: string
    duration_minutes: number
  }
}

interface AppointmentCalendarProps {
  onStatsUpdate: () => void
}

export function AppointmentCalendar({ onStatsUpdate }: AppointmentCalendarProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    loadAppointments()
  }, [])

  useEffect(() => {
    filterAppointments()
  }, [appointments, selectedDate, statusFilter])

  const loadAppointments = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          *,
          customer:profiles!customer_id(full_name, email, phone),
          service:services(name, duration_minutes)
        `,
        )
        .eq("professional_id", user.id)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true })

      if (error) throw error
      setAppointments(data || [])
    } catch (error) {
      console.error("Error loading appointments:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterAppointments = () => {
    let filtered = appointments

    // Filter by date
    filtered = filtered.filter((apt) => apt.appointment_date === selectedDate)

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((apt) => apt.status === statusFilter)
    }

    setFilteredAppointments(filtered)
  }

  const handleStatusChange = async (appointmentId: string, newStatus: "confirmed" | "completed" | "cancelled") => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("appointments").update({ status: newStatus }).eq("id", appointmentId)

      if (error) throw error

      setAppointments((prev) => prev.map((apt) => (apt.id === appointmentId ? { ...apt, status: newStatus } : apt)))
      onStatsUpdate()
    } catch (error) {
      console.error("Error updating appointment:", error)
      alert("Failed to update appointment")
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "confirmed":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Confirmed</Badge>
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getNextSevenDays = () => {
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      days.push({
        value: date.toISOString().split("T")[0],
        label: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      })
    }
    return days
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-green-600">Loading your appointments...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Appointment Calendar
          </CardTitle>
          <CardDescription>View and manage your appointments</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getNextSevenDays().map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Appointments List */}
          <div className="space-y-4">
            {filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <h4 className="font-semibold text-green-900">{appointment.customer.full_name}</h4>
                    {getStatusBadge(appointment.status)}
                    <span className="text-sm font-medium text-green-600">${appointment.total_price}</span>
                  </div>
                  <div className="flex gap-2">
                    {appointment.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(appointment.id, "confirmed")}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Confirm
                      </Button>
                    )}
                    {appointment.status === "confirmed" && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(appointment.id, "completed")}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Complete
                      </Button>
                    )}
                    {(appointment.status === "pending" || appointment.status === "confirmed") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleStatusChange(appointment.id, "cancelled")}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-sm text-green-700">
                  <div className="space-y-1">
                    <p className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {appointment.start_time} - {appointment.end_time}
                    </p>
                    <p className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {appointment.service.name} ({appointment.service.duration_minutes} min)
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {appointment.customer.email}
                    </p>
                    {appointment.customer.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {appointment.customer.phone}
                      </p>
                    )}
                  </div>
                </div>
                {appointment.notes && <p className="mt-2 text-sm text-green-600 italic">Notes: {appointment.notes}</p>}
              </div>
            ))}
          </div>

          {filteredAppointments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No appointments found for {new Date(selectedDate).toLocaleDateString()}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
