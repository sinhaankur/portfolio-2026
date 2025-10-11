import { createCalendarInviteAttachment } from "./calendar-invite"
import type { BookingConfirmationData } from "./booking-confirmation-data"
import { generateEmailHTML } from "./email-html-generator"

export async function sendBookingConfirmation(data: BookingConfirmationData): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("[v0] RESEND_API_KEY not found, skipping email")
      return false
    }

    const calendarInvite = createCalendarInviteAttachment({
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      serviceName: data.serviceName,
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime,
      duration: data.duration,
      notes: data.notes,
    })

    const emailData = {
      from: "Serenity Touch Massage <appointments@serenitytouchmassage.com>",
      to: [data.clientEmail],
      subject: `Appointment Confirmation - ${data.serviceName}`,
      html: generateEmailHTML(data),
      attachments: [calendarInvite],
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailData),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[v0] Email sending failed:", error)
      return false
    }

    const result = await response.json()
    console.log("[v0] Email sent successfully:", result.id)
    return true
  } catch (error) {
    console.error("[v0] Email sending error:", error)
    return false
  }
}
