import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const services = await sql`
      SELECT * FROM services 
      ORDER BY created_at DESC
    `
    return NextResponse.json(services)
  } catch (error) {
    console.error("Error fetching services:", error)
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, duration_minutes, price } = await request.json()

    if (!name || !description || !duration_minutes || !price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const [service] = await sql`
      INSERT INTO services (name, description, duration_minutes, price)
      VALUES (${name}, ${description}, ${duration_minutes}, ${price})
      RETURNING *
    `

    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    console.error("Error creating service:", error)
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 })
  }
}
