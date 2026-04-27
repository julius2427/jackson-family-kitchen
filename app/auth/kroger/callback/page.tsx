"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"

function KrogerCallbackInner() {
  const params = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const code = params.get("code")
    const state = params.get("state")
    const error = params.get("error")

    if (error) {
      setStatus("error")
      setMessage(`Kroger authorization failed: ${error}`)
      return
    }

    if (!code || !state) {
      setStatus("error")
      setMessage("Missing authorization code. Please try connecting again.")
      return
    }

    fetch("/api/kroger/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.connected) {
          setStatus("success")
          setMessage("Kroger account connected!")
          setTimeout(() => router.push("/cart"), 1500)
        } else {
          setStatus("error")
          setMessage(data.error ?? "Connection failed. Please try again.")
        }
      })
      .catch(() => {
        setStatus("error")
        setMessage("Network error. Please try again.")
      })
  }, [params, router])

  return (
    <div className="signin-wrap">
      {status === "loading" && <p>Connecting your Kroger account…</p>}
      {status === "success" && <p className="status-ok">✓ {message} Redirecting…</p>}
      {status === "error" && (
        <>
          <p className="status-err">{message}</p>
          <a href="/cart" className="btn btn-outline-accent" style={{ marginTop: 16 }}>Back to Cart</a>
        </>
      )}
    </div>
  )
}

export default function KrogerCallbackPage() {
  return (
    <Suspense>
      <KrogerCallbackInner />
    </Suspense>
  )
}
