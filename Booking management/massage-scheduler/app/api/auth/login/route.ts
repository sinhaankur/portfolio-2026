import { type NextRequest, NextResponse } from "next/server"

// Simple mock authentication - replace with real auth system
const mockUsers = [
  { id: "1", email: "user@example.com", password: "password123", name: "John Doe" },
  { id: "2", email: "admin@serenitytouch.com", password: "admin123", name: "Admin User" },
]

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    const user = mockUsers.find((u) => u.email === email && u.password === password)

    if (user) {
      const { password: _, ...userWithoutPassword } = user
      return NextResponse.json({ user: userWithoutPassword })
    }

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  } catch (error) {
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
