import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, description, duration_minutes, price } = await request.json()
    const serviceId = Number.parseInt(params.id)

    if (!name || !description || !duration_minutes || !price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const [service] = await sql`
      UPDATE services 
      SET name = ${name}, description = ${description}, 
          duration_minutes = ${duration_minutes}, price = ${price}
      WHERE id = ${serviceId}
      RETURNING *
    `

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    return NextResponse.json(service)
  } catch (error) {
    console.error("Error updating service:", error)
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const serviceId = Number.parseInt(params.id)

    // Check if service has any appointments
    const appointments = await sql`
      SELECT COUNT(*) as count FROM appointments WHERE service_id = ${serviceId}
    `

    if (appointments[0].count > 0) {
      return NextResponse.json({ error: "Cannot delete service with existing appointments" }, { status: 400 })
    }

    await sql`DELETE FROM services WHERE id = ${serviceId}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting service:", error)
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 })
  }
}
