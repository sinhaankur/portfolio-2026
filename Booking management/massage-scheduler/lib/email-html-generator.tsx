import type { BookingConfirmationData } from "./booking-confirmation-data"

export function generateEmailHTML(data: BookingConfirmationData): string {
  const { clientName, serviceName, appointmentDate, appointmentTime, duration, price, notes } = data

  const formattedDate = new Date(appointmentDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Confirmation</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .appointment-card { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; margin: 24px 0; }
        .appointment-card h3 { margin: 0 0 16px 0; color: #059669; font-size: 20px; }
        .detail-row { display: flex; justify-content: space-between; margin: 12px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: 600; color: #374151; }
        .detail-value { color: #059669; font-weight: 500; }
        .notes-section { background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .footer { background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer p { margin: 8px 0; color: #6b7280; font-size: 14px; }
        .calendar-note { background-color: #dbeafe; border: 1px solid #93c5fd; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
        @media (max-width: 600px) {
          .container { margin: 0; }
          .header, .content, .footer { padding: 20px; }
          .detail-row { flex-direction: column; }
          .detail-value { margin-top: 4px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌿 Serenity Touch Massage</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Your appointment is confirmed</p>
        </div>
        
        <div class="content">
          <h2 style="color: #059669; margin: 0 0 20px 0;">Hello ${clientName}!</h2>
          <p>Thank you for booking with Serenity Touch Massage. Your appointment has been confirmed and we're looking forward to providing you with a relaxing and rejuvenating experience.</p>
          
          <div class="appointment-card">
            <h3>📅 Appointment Details</h3>
            <div class="detail-row">
              <span class="detail-label">Service:</span>
              <span class="detail-value">${serviceName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${appointmentTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Duration:</span>
              <span class="detail-value">${duration} minutes</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Price:</span>
              <span class="detail-value">$${price}</span>
            </div>
          </div>
          
          ${
            notes
              ? `
            <div class="notes-section">
              <h4 style="margin: 0 0 8px 0; color: #92400e;">📝 Special Notes:</h4>
              <p style="margin: 0; color: #92400e;">${notes}</p>
            </div>
          `
              : ""
          }
          
          <div class="calendar-note">
            <h4 style="margin: 0 0 8px 0; color: #1e40af;">📱 Add to Your Calendar</h4>
            <p style="margin: 0; color: #1e40af;">A calendar invite is attached to this email. Click on the attachment to add this appointment to your calendar app.</p>
          </div>
          
          <h3 style="color: #059669; margin: 30px 0 15px 0;">What to Expect:</h3>
          <ul style="color: #374151; padding-left: 20px;">
            <li>Please arrive 10 minutes early for check-in</li>
            <li>Wear comfortable, loose-fitting clothing</li>
            <li>Let us know about any health conditions or preferences</li>
            <li>Bring a valid ID for your first visit</li>
          </ul>
          
          <h3 style="color: #059669; margin: 30px 0 15px 0;">Need to Make Changes?</h3>
          <p style="color: #374151;">If you need to reschedule or cancel your appointment, please contact us at least 24 hours in advance.</p>
        </div>
        
        <div class="footer">
          <p><strong>Serenity Touch Massage Therapy</strong></p>
          <p>📍 123 Wellness Street, Relaxation City, RC 12345</p>
          <p>📞 (555) 123-MASSAGE | ✉️ appointments@serenitytouchmassage.com</p>
          <p>🌐 www.serenitytouchmassage.com</p>
        </div>
      </div>
    </body>
    </html>
  `
}
