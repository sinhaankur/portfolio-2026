import { type NextRequest, NextResponse } from "next/server"
import { sendBookingConfirmation } from "@/lib/email"
import { sendSlackNotification, createAppointmentSlackMessage } from "@/lib/slack"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { client_name, client_email, client_phone, service_id, appointment_date, appointment_time, notes } = body

    // Mock service data (replace with database query)
    const mockServices = {
      1: { name: "UX Mentoring & Brainstorming", duration_minutes: 60, price: 0 },
    }

    const selectedService = mockServices[service_id as keyof typeof mockServices] || mockServices[1]

    const accessToken = request.cookies.get("google_access_token")?.value
    let eventId = null

    if (accessToken) {
      try {
        const { GoogleCalendarService, createCalendarEvent } = await import("@/lib/google-calendar")
        const calendarService = new GoogleCalendarService(accessToken)
        const calendarEvent = createCalendarEvent({
          client_name,
          client_email,
          service_name: selectedService.name,
          appointment_date,
          appointment_time,
          duration_minutes: selectedService.duration_minutes,
          notes,
        })

        eventId = await calendarService.createEvent(calendarEvent)
        console.log("[v0] Created Google Calendar event:", eventId)
      } catch (calendarError) {
        console.error("[v0] Failed to create calendar event:", calendarError)
        // Don't fail the booking if calendar creation fails
      }
    }

    const appointment = {
      id: Date.now(),
      client_name,
      client_email,
      client_phone,
      service_id,
      appointment_date,
      appointment_time,
      status: "pending",
      google_calendar_event_id: eventId,
      notes,
      created_at: new Date().toISOString(),
    }

    try {
      const emailResult = await sendBookingConfirmation({
        clientName: client_name,
        clientEmail: client_email,
        serviceName: selectedService.name,
        appointmentDate: appointment_date,
        appointmentTime: appointment_time,
        duration: selectedService.duration_minutes,
        price: selectedService.price,
        notes: notes || undefined,
      })

      console.log("[v0] Email confirmation with calendar invite sent:", emailResult)
    } catch (emailError) {
      console.error("[v0] Failed to send confirmation email:", emailError)
      // Don't fail the appointment creation if email fails
    }

    try {
      const slackMessage = createAppointmentSlackMessage({
        clientName: client_name,
        clientEmail: client_email,
        clientPhone: client_phone,
        serviceName: selectedService.name,
        appointmentDate: appointment_date,
        appointmentTime: appointment_time,
        duration: selectedService.duration_minutes,
        price: selectedService.price,
        notes: notes || undefined,
      })

      await sendSlackNotification(slackMessage)
      console.log("[v0] Slack notification sent for new appointment")
    } catch (slackError) {
      console.error("[v0] Failed to send Slack notification:", slackError)
      // Don't fail the appointment creation if Slack notification fails
    }

    return NextResponse.json({
      success: true,
      appointment,
      message: eventId
        ? "Appointment created, added to Google Calendar, and confirmation email with calendar invite sent!"
        : "Appointment created and confirmation email with calendar invite sent!",
    })
  } catch (error) {
    console.error("Error creating appointment:", error)
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 })
  }
}
