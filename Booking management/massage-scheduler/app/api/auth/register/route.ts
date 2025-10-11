import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    // In a real app, you'd save to database and hash the password
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
    }

    return NextResponse.json({ user: newUser })
  } catch (error) {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
