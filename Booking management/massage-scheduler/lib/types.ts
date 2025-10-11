export interface MassageService {
  id: number
  name: string
  description: string
  duration_minutes: number
  price: number
  created_at: string
}

export interface Appointment {
  id: number
  client_name: string
  client_email: string
  client_phone?: string
  service_id: number
  appointment_date: string
  appointment_time: string
  status: "pending" | "approved" | "cancelled"
  google_calendar_event_id?: string
  notes?: string
  created_at: string
}
