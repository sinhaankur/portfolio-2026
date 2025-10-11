export interface BookingConfirmationData {
  clientName: string
  clientEmail: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  duration: number
  price: number
  notes?: string
}
