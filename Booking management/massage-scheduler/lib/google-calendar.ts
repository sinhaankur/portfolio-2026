// Google Calendar API integration
interface CalendarEvent {
  summary: string
  description?: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  attendees?: Array<{
    email: string
    displayName?: string
  }>
}

export class GoogleCalendarService {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async createEvent(event: CalendarEvent): Promise<string | null> {
    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      })

      if (!response.ok) {
        throw new Error(`Calendar API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.id
    } catch (error) {
      console.error("Error creating calendar event:", error)
      return null
    }
  }

  async updateEvent(eventId: string, event: CalendarEvent): Promise<boolean> {
    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      })

      return response.ok
    } catch (error) {
      console.error("Error updating calendar event:", error)
      return false
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      return response.ok
    } catch (error) {
      console.error("Error deleting calendar event:", error)
      return false
    }
  }
}

export function createCalendarEvent(appointment: {
  client_name: string
  client_email: string
  service_name: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  notes?: string
}): CalendarEvent {
  const startDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`)
  const endDateTime = new Date(startDateTime.getTime() + appointment.duration_minutes * 60000)

  return {
    summary: `${appointment.service_name} - ${appointment.client_name}`,
    description: `
Massage Therapy Appointment

Client: ${appointment.client_name}
Service: ${appointment.service_name}
Duration: ${appointment.duration_minutes} minutes
${appointment.notes ? `Notes: ${appointment.notes}` : ""}

Contact: ${appointment.client_email}
    `.trim(),
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: "America/New_York", // Adjust to your timezone
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: "America/New_York", // Adjust to your timezone
    },
    attendees: [
      {
        email: appointment.client_email,
        displayName: appointment.client_name,
      },
    ],
  }
}
