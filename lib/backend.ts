const API_URL = process.env.API_URL!
const API_SECRET_KEY = process.env.API_SECRET_KEY!

export async function backendFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_SECRET_KEY}`,
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { detail?: string }).detail ?? `API error ${res.status}`)
  }

  if (res.status === 204) return null
  return res.json()
}
