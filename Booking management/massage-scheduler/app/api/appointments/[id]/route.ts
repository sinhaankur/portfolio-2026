import { type NextRequest, NextResponse } from "next/server"
import { GoogleCalendarService } from "@/lib/google-calendar"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status } = await request.json()
    const appointmentId = params.id

    // Get Google access token
    const accessToken = request.cookies.get("google_access_token")?.value

    if (!accessToken) {
      return NextResponse.json({ error: "Google Calendar not connected" }, { status: 401 })
    }

    // In a real app, you would:
    // 1. Update appointment status in database
    // 2. Get appointment details including google_calendar_event_id
    // 3. Update or delete the calendar event based on status

    const calendarService = new GoogleCalendarService(accessToken)

    if (status === "cancelled") {
      // Delete calendar event
      // await calendarService.deleteEvent(appointment.google_calendar_event_id)
    }

    return NextResponse.json({
      success: true,
      message: `Appointment ${status} successfully`,
    })
  } catch (error) {
    console.error("Error updating appointment:", error)
    return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 })
  }
}
