import { type NextRequest, NextResponse } from "next/server"
import { sendSlackNotification } from "@/lib/slack"

export async function POST(request: NextRequest) {
  try {
    const testMessage = {
      text: "🧪 Test notification from Serenity Touch Massage Therapy",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🧪 Test Notification",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "This is a test message to verify your Slack integration is working correctly!",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "💆‍♀️ Serenity Touch Massage Therapy - Admin Dashboard",
            },
          ],
        },
      ],
    }

    const success = await sendSlackNotification(testMessage)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: "Failed to send test message" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error sending test Slack message:", error)
    return NextResponse.json({ error: "Failed to send test message" }, { status: 500 })
  }
}
