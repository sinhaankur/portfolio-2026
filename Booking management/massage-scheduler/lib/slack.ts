interface SlackMessage {
  text: string
  blocks?: any[]
}

export async function sendSlackNotification(message: SlackMessage): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    console.log("[v0] Slack webhook URL not configured, skipping notification")
    return false
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`)
    }

    console.log("[v0] Slack notification sent successfully")
    return true
  } catch (error) {
    console.error("[v0] Failed to send Slack notification:", error)
    return false
  }
}

export function createAppointmentSlackMessage(appointmentData: {
  clientName: string
  clientEmail: string
  clientPhone?: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  duration: number
  price: number
  notes?: string
}) {
  const {
    clientName,
    clientEmail,
    clientPhone,
    serviceName,
    appointmentDate,
    appointmentTime,
    duration,
    price,
    notes,
  } = appointmentData

  return {
    text: `New appointment booking: ${clientName} - ${serviceName}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🗓️ New Appointment Booking",
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Client:*\n${clientName}`,
          },
          {
            type: "mrkdwn",
            text: `*Service:*\n${serviceName}`,
          },
          {
            type: "mrkdwn",
            text: `*Date & Time:*\n${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTime}`,
          },
          {
            type: "mrkdwn",
            text: `*Duration:*\n${duration} minutes`,
          },
          {
            type: "mrkdwn",
            text: `*Price:*\n$${price}`,
          },
          {
            type: "mrkdwn",
            text: `*Email:*\n${clientEmail}`,
          },
        ],
      },
      ...(clientPhone
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Phone:* ${clientPhone}`,
              },
            },
          ]
        : []),
      ...(notes
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Notes:* ${notes}`,
              },
            },
          ]
        : []),
      {
        type: "divider",
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💆‍♀️ Serenity Touch Massage Therapy",
          },
        ],
      },
    ],
  }
}
