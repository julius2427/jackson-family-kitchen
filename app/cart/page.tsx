"use client"

import { useEffect, useState, useCallback, useRef } from "react"
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
  kroger_promo_price: number | null
  kroger_match_confidence: number | null
}

interface Candidate {
  name: string
  brand: string
  size: string
  upc: string
  price: number | null
  regular_price: number | null
  promo_price: number | null
  category: string | null
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
  const [sendConfirm, setSendConfirm] = useState(false)
  const [addQuery, setAddQuery] = useState("")
  const [addLoading, setAddLoading] = useState(false)
  const [addCandidates, setAddCandidates] = useState<Candidate[]>([])
  const [addSearchLoading, setAddSearchLoading] = useState(false)
  const addDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const unmatchedItems = items.filter(i => !i.kroger_upc)

  function handleSendClick() {
    if (unmatchedItems.length > 0) {
      setSendConfirm(true)
    } else {
      doSendToKroger()
    }
  }

  async function doSendToKroger() {
    setSendConfirm(false)
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
    const effectivePrice = candidate.promo_price ?? candidate.regular_price ?? candidate.price
    const regularPrice = candidate.regular_price ?? candidate.price
    await Promise.all([
      fetch(`/api/cart/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kroger_upc: candidate.upc,
          kroger_product_name: candidate.name,
          kroger_price: regularPrice,
          kroger_promo_price: candidate.promo_price ?? null,
        }),
      }),
      fetch(`/api/preferences/${encodeURIComponent(item.normalized_name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: item.item_name,
          upc: candidate.upc,
          product_name: candidate.name,
          price: regularPrice,
          promo_price: candidate.promo_price ?? null,
          category: candidate.category ?? null,
        }),
      }),
    ])
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, kroger_upc: candidate.upc, kroger_product_name: candidate.name, kroger_price: regularPrice, kroger_promo_price: candidate.promo_price ?? null }
      : i))
    setSearchOpen(null)
    setCandidates([])
  }

  function handleAddQueryChange(value: string) {
    setAddQuery(value)
    if (addDebounceRef.current) clearTimeout(addDebounceRef.current)
    if (value.length < 2) { setAddCandidates([]); return }
    addDebounceRef.current = setTimeout(async () => {
      setAddSearchLoading(true)
      try {
        const res = await fetch(`/api/preferences/candidates?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setAddCandidates(data.candidates ?? [])
      } finally {
        setAddSearchLoading(false)
      }
    }, 300)
  }

  async function selectAddCandidate(candidate: Candidate) {
    setAddCandidates([])
    setAddQuery("")
    setAddLoading(true)
    const regularPrice = candidate.regular_price ?? candidate.price
    try {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            item_name: candidate.name,
            quantity: 1,
            kroger_upc: candidate.upc,
            kroger_product_name: candidate.name,
            kroger_price: regularPrice,
            kroger_promo_price: candidate.promo_price ?? null,
          }],
        }),
      })
      await loadCart()
    } finally {
      setAddLoading(false)
    }
  }

  async function addCustomItem(e: React.FormEvent) {
    e.preventDefault()
    const name = addQuery.trim()
    if (!name) return
    setAddCandidates([])
    setAddLoading(true)
    try {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ item_name: name, quantity: 1 }] }),
      })
      setAddQuery("")
      await loadCart()
    } finally {
      setAddLoading(false)
    }
  }

  function openSearch(item: CartItem) {
    setSearchOpen(item.id)
    setSearchQuery(item.item_name)
    setCandidates([])
    setTimeout(() => searchProducts(item.item_name), 0)
  }

  return (
    <div className="wrap">
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-header">Pending Cart</h1>
            <p className="page-subtext">Review items before sending to Kroger.</p>
          </div>
          <div className="page-actions">
            {kroger?.connected
              ? <span className="kroger-status connected">✓ Kroger connected</span>
              : kroger !== null && <button className="btn btn-outline-accent" onClick={connectKroger}>Connect Kroger</button>
            }
            {sendStatus && (
              <span className={sendStatus.ok === true ? "status-ok" : sendStatus.ok === false ? "status-err" : ""}>
                {sendStatus.text}
              </span>
            )}
            <button className="btn btn-solid-green" disabled={items.length === 0 || !kroger?.connected} onClick={handleSendClick}>
              Send to Kroger{unmatchedItems.length > 0 && ` (${items.length - unmatchedItems.length}/${items.length})`}
            </button>
            {!clearConfirm
              ? <button className="btn btn-outline-muted" onClick={() => setClearConfirm(true)} disabled={items.length === 0}>Clear all</button>
              : <>
                  <button className="btn btn-solid-accent" onClick={clearCart}>Confirm clear</button>
                  <button className="btn btn-outline-muted" onClick={() => setClearConfirm(false)}>Cancel</button>
                </>
            }
          </div>
        </div>
      </div>

      {/* Send confirmation */}
      {sendConfirm && (
        <div className="send-confirm">
          <p><strong>{unmatchedItems.length} item{unmatchedItems.length !== 1 ? "s" : ""} won&apos;t be sent</strong> — no Kroger product matched:</p>
          <ul>
            {unmatchedItems.map(i => (
              <li key={i.id}>
                {i.item_name}
                <button className="btn-inline-link" onClick={() => { setSendConfirm(false); openSearch(i) }}>fix →</button>
              </li>
            ))}
          </ul>
          <div className="send-confirm-actions">
            <button className="btn btn-outline-muted" onClick={() => setSendConfirm(false)}>Go back &amp; fix</button>
            <button className="btn btn-solid-green" onClick={doSendToKroger}>Send {items.length - unmatchedItems.length} matched items anyway</button>
          </div>
        </div>
      )}

      {/* Add item — always visible at top */}
      <div className="add-item-card">
        <form className="add-item-row" onSubmit={addCustomItem}>
          <input
            type="text"
            placeholder="Add milk, bananas, paper towels…"
            value={addQuery}
            onChange={e => handleAddQueryChange(e.target.value)}
            disabled={addLoading}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-solid-accent" disabled={addLoading || !addQuery.trim()}>
            {addLoading ? "Adding…" : "Add"}
          </button>
        </form>
        {(addCandidates.length > 0 || addSearchLoading) && (
          <div className="add-candidates">
            {addSearchLoading && <div className="add-candidates-loading">Searching…</div>}
            {addCandidates.map((c, i) => {
              const onSale = c.promo_price != null && c.regular_price != null && c.promo_price < c.regular_price
              return (
                <button key={i} className="add-candidate" onClick={() => selectAddCandidate(c)}>
                  <div className="add-candidate-name">
                    {c.name}
                    {onSale && <span className="sale-badge-sm">SALE</span>}
                  </div>
                  <div className="add-candidate-meta">{[c.brand, c.size].filter(Boolean).join(" · ")}</div>
                  <div className="add-candidate-price">
                    {onSale
                      ? <><span className="sale">${c.promo_price!.toFixed(2)}</span> <span className="regular">${c.regular_price!.toFixed(2)}</span></>
                      : c.price != null ? `$${c.price.toFixed(2)}` : ""}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Cart items */}
      {loading ? (
        <div className="empty-state">Loading cart…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          Cart is empty — add items above or from <Link href="/">this week&apos;s menu</Link>.
        </div>
      ) : (
        <div className="cart-items">
          {items.map(item => (
            <div key={item.id} className={`cart-item${!item.kroger_upc ? " cart-item-unmatched" : ""}`}>
              <div className="cart-item-header">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cart-item-name">{item.item_name}</div>
                  {item.kroger_product_name
                    ? <div className="cart-item-product">{item.kroger_product_name}</div>
                    : <div className="cart-item-no-match">⚠ No Kroger product — pick one before sending</div>
                  }
                  <div className="cart-item-price-row">
                    {item.kroger_promo_price != null ? (
                      <>
                        <span className="cart-item-price sale">${item.kroger_promo_price.toFixed(2)}</span>
                        {item.kroger_price != null && <span className="cart-item-price-regular">${item.kroger_price.toFixed(2)}</span>}
                        <span className="sale-badge">ON SALE</span>
                      </>
                    ) : item.kroger_price != null ? (
                      <span className="cart-item-price">${item.kroger_price.toFixed(2)}</span>
                    ) : null}
                  </div>
                </div>
                <button className="btn-remove-item" onClick={() => removeItem(item.id)}>✕</button>
              </div>

              <div className="cart-item-controls">
                <button className="qty-btn" onClick={() => updateQty(item, -1)}>−</button>
                <span className="qty-display">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</span>
                <button className="qty-btn" onClick={() => updateQty(item, 1)}>+</button>
                <button
                  className={`btn-change-product${!item.kroger_upc ? " btn-change-product-urgent" : ""}`}
                  onClick={() => searchOpen === item.id ? setSearchOpen(null) : openSearch(item)}
                >
                  {searchOpen === item.id ? "Cancel" : item.kroger_upc ? "Change product" : "Select product"}
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
                      {candidates.map((c, ci) => {
                        const onSale = c.promo_price != null && c.regular_price != null && c.promo_price < c.regular_price
                        const savings = onSale ? (c.regular_price! - c.promo_price!).toFixed(2) : null
                        return (
                          <div key={ci} className={`candidate${onSale ? " candidate-on-sale" : ""}`} onClick={() => selectCandidate(item, c)}>
                            <div>
                              <div className="candidate-name">
                                {c.name}
                                {onSale && <span className="sale-badge-sm">SALE</span>}
                              </div>
                              <div className="candidate-meta">{[c.brand, c.size].filter(Boolean).join(" · ")}</div>
                            </div>
                            <div className="candidate-price-col">
                              {onSale ? (
                                <>
                                  <span className="candidate-price sale">${c.promo_price!.toFixed(2)}</span>
                                  <span className="candidate-price-regular">${c.regular_price!.toFixed(2)}</span>
                                  <span className="candidate-savings">save ${savings}</span>
                                </>
                              ) : (
                                <span className="candidate-price">{c.price != null ? `$${c.price.toFixed(2)}` : "—"}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
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
