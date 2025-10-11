import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { email, code, type } = await request.json()

    const subject = type === "signup" ? "Verify Your Account" : "Login Verification Code"
    const message =
      type === "signup"
        ? `Your verification code is: ${code}. This code will expire in 10 minutes.`
        : `Your login verification code is: ${code}. This code will expire in 10 minutes.`

    await resend.emails.send({
      from: "noreply@yourdomain.com", // Replace with your domain
      to: email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${subject}</h2>
          <p>${message}</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="font-size: 32px; letter-spacing: 8px; margin: 0;">${code}</h1>
          </div>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to send 2FA email:", error)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
