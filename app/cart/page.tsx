"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface CartItem {
  id: number
  item_name: string
  normalized_name: string
  quantity: number
  unit: string | null
  kroger_upc: string | null
  kroger_product_name: string | null
  kroger_price: number | null
  kroger_match_confidence: number | null
}

interface Candidate {
  name: string
  brand: string
  size: string
  upc: string
  price: number | null
  score: number
}

interface KrogerStatus { connected: boolean; token_expires_in_minutes?: number }

export default function CartPage() {
  const { status } = useSession()
  const router = useRouter()

  const [items, setItems] = useState<CartItem[]>([])
  const [kroger, setKroger] = useState<KrogerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendStatus, setSendStatus] = useState<{ text: string; ok?: boolean } | null>(null)
  const [searchOpen, setSearchOpen] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin")
  }, [status, router])

  const loadCart = useCallback(async () => {
    setLoading(true)
    try {
      const [cartRes, krogerRes] = await Promise.all([
        fetch("/api/cart"),
        fetch("/api/kroger/status"),
      ])
      const cartData = await cartRes.json()
      const krogerData = await krogerRes.json()
      setItems(cartData.items ?? [])
      setKroger(krogerData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (status === "authenticated") loadCart() }, [status, loadCart])

  if (status !== "authenticated") return null

  async function connectKroger() {
    const res = await fetch("/api/kroger/url")
    const data = await res.json()
    if (!data.url) {
      alert("Failed to get Kroger auth URL: " + (data.error ?? "unknown error"))
      return
    }
    window.location.href = data.url
  }

  async function updateQty(item: CartItem, delta: number) {
    const qty = Math.max(1, item.quantity + delta)
    await fetch(`/api/cart/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: qty }),
    })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: qty } : i))
  }

  async function removeItem(id: number) {
    await fetch(`/api/cart/${id}`, { method: "DELETE" })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function clearCart() {
    await fetch("/api/cart", { method: "DELETE" })
    setItems([])
    setClearConfirm(false)
  }

  async function sendToKroger() {
    setSendStatus({ text: "Sending to Kroger…" })
    try {
      const res = await fetch("/api/cart/send", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSendStatus({ text: `✓ ${data.sent} item${data.sent !== 1 ? "s" : ""} added to your Kroger cart!`, ok: true })
    } catch (e) {
      setSendStatus({ text: String(e) || "Failed — try again", ok: false })
    }
  }

  async function searchProducts(query: string) {
    if (query.length < 2) { setCandidates([]); return }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/preferences/candidates?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setCandidates(data.candidates ?? [])
    } finally {
      setSearchLoading(false)
    }
  }

  async function selectCandidate(item: CartItem, candidate: Candidate) {
    await Promise.all([
      fetch(`/api/cart/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kroger_upc: candidate.upc, kroger_product_name: candidate.name, kroger_price: candidate.price }),
      }),
      fetch(`/api/preferences/${encodeURIComponent(item.normalized_name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: item.item_name, upc: candidate.upc, product_name: candidate.name, price: candidate.price }),
      }),
    ])
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, kroger_upc: candidate.upc, kroger_product_name: candidate.name, kroger_price: candidate.price }
      : i))
    setSearchOpen(null)
    setCandidates([])
  }

  function openSearch(item: CartItem) {
    setSearchOpen(item.id)
    setSearchQuery(item.item_name)
    setCandidates([])
    setTimeout(() => searchProducts(item.item_name), 0)
  }

  return (
    <div className="wrap">
      <header>
        <div><Link href="/" className="back-link">← This week&apos;s menu</Link></div>
        <h1>🛒 Pending Cart</h1>
      </header>

      {/* Kroger connection + send */}
      <div className="cart-page-header">
        <div>
          {kroger === null ? null : kroger.connected ? (
            <span className="kroger-status connected">✓ Kroger connected</span>
          ) : (
            <button className="btn btn-outline-accent" onClick={connectKroger}>Connect Kroger</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {sendStatus && (
            <span className={sendStatus.ok === true ? "status-ok" : sendStatus.ok === false ? "status-err" : ""}>
              {sendStatus.text}
            </span>
          )}
          <button
            className="btn btn-solid-green"
            disabled={items.length === 0 || !kroger?.connected}
            onClick={sendToKroger}
          >
            Send to Kroger
          </button>
          {!clearConfirm ? (
            <button className="btn btn-outline-muted" onClick={() => setClearConfirm(true)} disabled={items.length === 0}>
              Clear all
            </button>
          ) : (
            <>
              <button className="btn btn-solid-accent" onClick={clearCart}>Confirm clear</button>
              <button className="btn btn-outline-muted" onClick={() => setClearConfirm(false)}>Cancel</button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading cart…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          Your cart is empty.<br /><br />
          <Link href="/">Add items from this week&apos;s menu →</Link>
        </div>
      ) : (
        <div className="cart-items">
          {items.map(item => (
            <div key={item.id} className="cart-item">
              <div className="cart-item-top">
                <div>
                  <div className="cart-item-name">{item.item_name}</div>
                  {item.kroger_product_name ? (
                    <div className="cart-item-product">{item.kroger_product_name}</div>
                  ) : (
                    <div className="cart-item-product" style={{ color: "var(--accent)" }}>No product matched — search to pick one</div>
                  )}
                  {item.kroger_price && <div className="cart-item-price">${item.kroger_price.toFixed(2)}</div>}
                </div>
                <button className="btn-remove-item" onClick={() => removeItem(item.id)}>✕</button>
              </div>

              <div className="cart-item-controls">
                <button className="qty-btn" onClick={() => updateQty(item, -1)}>−</button>
                <span className="qty-display">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</span>
                <button className="qty-btn" onClick={() => updateQty(item, 1)}>+</button>
                <button className="btn-change-product" onClick={() => searchOpen === item.id ? setSearchOpen(null) : openSearch(item)}>
                  {searchOpen === item.id ? "Cancel" : "Change product"}
                </button>
              </div>

              {searchOpen === item.id && (
                <div className="product-search">
                  <input
                    type="text"
                    placeholder="Search Kroger products…"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); searchProducts(e.target.value) }}
                    autoFocus
                  />
                  {searchLoading && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>Searching…</div>}
                  {candidates.length > 0 && (
                    <div className="candidate-list">
                      {candidates.map((c, ci) => (
                        <div key={ci} className="candidate" onClick={() => selectCandidate(item, c)}>
                          <div>
                            <div className="candidate-name">{c.name}</div>
                            <div className="candidate-meta">{[c.brand, c.size].filter(Boolean).join(" · ")}</div>
                          </div>
                          <div className="candidate-price">{c.price != null ? `$${c.price.toFixed(2)}` : "—"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
