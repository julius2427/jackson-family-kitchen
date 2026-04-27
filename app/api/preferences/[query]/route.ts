import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { backendFetch } from "@/lib/backend"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ query: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { query } = await params
  try {
    const body = await req.json()
    const data = await backendFetch(`/preferences/${encodeURIComponent(query)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
