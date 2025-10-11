"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Calendar, Clock, User, Mail, Phone, CheckCircle, XCircle, MoreHorizontal } from "lucide-react"

interface Appointment {
  id: string
  customer_id: string
  professional_id: string
  service_id: string
  appointment_date: string
  start_time: string
  end_time: string
  status: "pending" | "confirmed" | "completed" | "cancelled"
  notes: string | null
  total_price: number
  created_at: string
  customer: {
    full_name: string
    email: string
    phone: string | null
  }
  professional: {
    full_name: string
    email: string
  }
  service: {
    name: string
    duration_minutes: number
  }
}

interface AppointmentManagerProps {
  onStatsUpdate: () => void
}

export function AppointmentManager({ onStatsUpdate }: AppointmentManagerProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    loadAppointments()
  }, [])

  useEffect(() => {
    filterAppointments()
  }, [appointments, statusFilter, searchTerm])

  const loadAppointments = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          *,
          customer:profiles!customer_id(full_name, email, phone),
          professional:profiles!professional_id(full_name, email),
          service:services(name, duration_minutes)
        `,
        )
        .order("created_at", { ascending: false })

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

    if (statusFilter !== "all") {
      filtered = filtered.filter((apt) => apt.status === statusFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (apt) =>
          apt.customer.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          apt.customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          apt.professional.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          apt.service.name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    setFilteredAppointments(filtered)
  }

  const handleStatusChange = async (appointmentId: string, newStatus: "confirmed" | "cancelled") => {
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
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Confirmed</Badge>
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Completed</Badge>
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-blue-600">Loading appointments...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const pendingAppointments = filteredAppointments.filter((apt) => apt.status === "pending")

  return (
    <div className="space-y-6">
      {/* Pending Approvals Section */}
      {pendingAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Pending Approvals ({pendingAppointments.length})
            </CardTitle>
            <CardDescription>Review and approve new appointment requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-4 border border-amber-200 bg-amber-50 rounded-lg flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h4 className="font-semibold text-blue-900">{appointment.customer.full_name}</h4>
                      {getStatusBadge(appointment.status)}
                      <span className="text-sm font-medium text-blue-600">${appointment.total_price}</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
                      <div className="space-y-1">
                        <p className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {new Date(appointment.appointment_date).toLocaleDateString()} at {appointment.start_time}
                        </p>
                        <p className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {appointment.service.name} ({appointment.service.duration_minutes} min)
                        </p>
                        <p className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Professional: {appointment.professional.full_name}
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
                    {appointment.notes && (
                      <p className="mt-2 text-sm text-blue-600 italic">Notes: {appointment.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange(appointment.id, "confirmed")}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleStatusChange(appointment.id, "cancelled")}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Appointments */}
      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
          <CardDescription>Manage all appointments in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search">Search Appointments</Label>
              <Input
                id="search"
                placeholder="Search by customer, professional, or service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <Label htmlFor="status-filter">Filter by Status</Label>
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
              <div key={appointment.id} className="p-4 border rounded-lg flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h4 className="font-semibold text-blue-900">{appointment.customer.full_name}</h4>
                    {getStatusBadge(appointment.status)}
                    <span className="text-sm font-medium text-blue-600">${appointment.total_price}</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(appointment.appointment_date).toLocaleDateString()} at {appointment.start_time}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {appointment.service.name} ({appointment.service.duration_minutes} min)
                      </p>
                      <p className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Professional: {appointment.professional.full_name}
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
                  {appointment.notes && <p className="mt-2 text-sm text-blue-600 italic">Notes: {appointment.notes}</p>}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {appointment.status === "pending" && (
                      <>
                        <DropdownMenuItem onClick={() => handleStatusChange(appointment.id, "confirmed")}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange(appointment.id, "cancelled")}>
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancel
                        </DropdownMenuItem>
                      </>
                    )}
                    {appointment.status === "confirmed" && (
                      <DropdownMenuItem onClick={() => handleStatusChange(appointment.id, "cancelled")}>
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>

          {filteredAppointments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No appointments found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
