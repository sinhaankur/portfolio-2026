import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { webhookUrl } = await request.json()

    if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) {
      return NextResponse.json({ error: "Invalid Slack webhook URL" }, { status: 400 })
    }

    // In a real app, you would save this to your database
    // For now, we'll just validate the format
    console.log("[v0] Slack webhook URL configured:", webhookUrl.substring(0, 50) + "...")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving Slack webhook:", error)
    return NextResponse.json({ error: "Failed to save webhook URL" }, { status: 500 })
  }
}
