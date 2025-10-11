import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Check if Google access token exists in cookies
  const accessToken = request.cookies.get("google_access_token")?.value

  return NextResponse.json({
    connected: !!accessToken,
    hasToken: !!accessToken,
  })
}
