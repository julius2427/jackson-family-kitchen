import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

export async function GET() {
  try {
    const file = path.join(process.cwd(), "data", "current_week.json")
    const text = await readFile(file, "utf-8")
    return NextResponse.json(JSON.parse(text))
  } catch {
    return NextResponse.json({ error: "No meal plan available yet" }, { status: 404 })
  }
}
