export interface CalendarInviteData {
  clientName: string
  clientEmail: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  duration: number
  notes?: string
}

export function generateICSFile(data: CalendarInviteData): string {
  const { clientName, clientEmail, serviceName, appointmentDate, appointmentTime, duration, notes } = data

  // Create start and end times
  const startDateTime = new Date(`${appointmentDate}T${appointmentTime}:00`)
  const endDateTime = new Date(startDateTime.getTime() + duration * 60000)

  // Format dates for ICS (YYYYMMDDTHHMMSSZ)
  const formatICSDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
  }

  const startICS = formatICSDate(startDateTime)
  const endICS = formatICSDate(endDateTime)
  const nowICS = formatICSDate(new Date())

  // Generate unique UID
  const uid = `appointment-${Date.now()}@serenitytouchmassage.com`

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Serenity Touch Massage//Appointment//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowICS}`,
    `DTSTART:${startICS}`,
    `DTEND:${endICS}`,
    `SUMMARY:${serviceName} - ${clientName}`,
    `DESCRIPTION:Massage appointment for ${clientName}\\n\\nService: ${serviceName}\\nDuration: ${duration} minutes${notes ? `\\nNotes: ${notes}` : ""}\\n\\nSerenity Touch Massage Therapy`,
    `ATTENDEE;CN=${clientName};RSVP=TRUE:mailto:${clientEmail}`,
    "ORGANIZER;CN=Serenity Touch Massage:mailto:appointments@serenitytouchmassage.com",
    "LOCATION:Serenity Touch Massage Therapy",
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")

  return icsContent
}

export function createCalendarInviteAttachment(data: CalendarInviteData) {
  const icsContent = generateICSFile(data)
  const base64Content = Buffer.from(icsContent).toString("base64")

  return {
    filename: "appointment.ics",
    content: base64Content,
    contentType: "text/calendar",
    disposition: "attachment",
  }
}
