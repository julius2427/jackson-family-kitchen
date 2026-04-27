"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useCart } from "@/lib/cartContext"

interface CartItem {
  id: number
  item_name: string
  quantity: number
  unit: string | null
  kroger_upc: string | null
  kroger_product_name: string | null
  kroger_price: number | null
  kroger_promo_price: number | null
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
}

export default function CartDrawer() {
  const { status } = useSession()
  const { isOpen, closeCart, setCartCount, refreshCount } = useCart()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)
  const [addStatus, setAddStatus] = useState<Record<string, string>>({})
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadCart = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/cart")
      const data = await res.json()
      setItems(data.items ?? [])
      setCartCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [setCartCount])

  useEffect(() => {
    if (isOpen && status === "authenticated") {
      loadCart()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, status, loadCart])

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    if (query.length < 2) { setCandidates([]); return }
    searchRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/preferences/candidates?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setCandidates(data.candidates ?? [])
      } finally {
        setSearching(false)
      }
    }, 350)
  }, [query])

  async function addCandidate(c: Candidate) {
    const key = c.upc
    setAddStatus(prev => ({ ...prev, [key]: "adding" }))
    try {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            item_name: c.name,
            quantity: 1,
            kroger_upc: c.upc,
            kroger_product_name: c.name,
            kroger_price: c.regular_price ?? c.price,
            kroger_promo_price: c.promo_price ?? null,
          }],
        }),
      })
      setAddStatus(prev => ({ ...prev, [key]: "added" }))
      setQuery("")
      setCandidates([])
      await loadCart()
    } catch {
      setAddStatus(prev => ({ ...prev, [key]: "error" }))
    }
  }

  async function removeItem(id: number) {
    await fetch(`/api/cart/${id}`, { method: "DELETE" })
    setItems(prev => prev.filter(i => i.id !== id))
    setCartCount(items.length - 1)
  }

  if (status !== "authenticated") return null

  const onSale = (item: CartItem) => item.kroger_promo_price != null && item.kroger_price != null && item.kroger_promo_price < item.kroger_price

  return (
    <>
      {isOpen && <div className="drawer-backdrop" onClick={closeCart} />}
      <div className={`cart-drawer${isOpen ? " open" : ""}`}>
        <div className="drawer-header">
          <h2>Cart</h2>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/cart" className="drawer-full-link" onClick={closeCart}>Full cart →</Link>
            <button className="drawer-close" onClick={closeCart}>✕</button>
          </div>
        </div>

        <div className="drawer-search">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search to add an item…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {searching && <div className="drawer-search-hint">Searching…</div>}
        </div>

        {candidates.length > 0 && (
          <div className="drawer-candidates">
            {candidates.map((c, i) => {
              const onSaleC = c.promo_price != null && c.regular_price != null && c.promo_price < c.regular_price
              const st = addStatus[c.upc]
              return (
                <div key={i} className={`drawer-candidate${onSaleC ? " on-sale" : ""}`}>
                  <div className="drawer-candidate-info">
                    <div className="drawer-candidate-name">
                      {c.name}
                      {onSaleC && <span className="sale-badge-sm">SALE</span>}
                    </div>
                    <div className="drawer-candidate-meta">
                      {[c.brand, c.size].filter(Boolean).join(" · ")}
                    </div>
                    <div className="drawer-candidate-price">
                      {onSaleC
                        ? <><span style={{ color: "#d94f00", fontWeight: 700 }}>${c.promo_price!.toFixed(2)}</span> <span style={{ textDecoration: "line-through", color: "var(--muted)", fontSize: 12 }}>${c.regular_price!.toFixed(2)}</span></>
                        : c.price != null ? `$${c.price.toFixed(2)}` : "—"
                      }
                    </div>
                  </div>
                  <button
                    className={`drawer-add-btn${st === "added" ? " added" : ""}`}
                    onClick={() => addCandidate(c)}
                    disabled={!!st}
                  >
                    {st === "adding" ? "…" : st === "added" ? "✓" : "+"}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="drawer-items">
          {loading ? (
            <div className="drawer-empty">Loading…</div>
          ) : items.length === 0 ? (
            <div className="drawer-empty">Cart is empty — search above to add items</div>
          ) : (
            items.map(item => (
              <div key={item.id} className="drawer-item">
                <div className="drawer-item-info">
                  <div className="drawer-item-name">{item.item_name}</div>
                  {item.kroger_product_name && <div className="drawer-item-product">{item.kroger_product_name}</div>}
                  <div className="drawer-item-price">
                    {onSale(item) ? (
                      <><span style={{ color: "#d94f00", fontWeight: 600 }}>${item.kroger_promo_price!.toFixed(2)}</span> <span style={{ textDecoration: "line-through", color: "var(--muted)", fontSize: 11 }}>${item.kroger_price!.toFixed(2)}</span> <span className="sale-badge-sm">SALE</span></>
                    ) : item.kroger_price != null ? (
                      `$${item.kroger_price.toFixed(2)}`
                    ) : null}
                  </div>
                </div>
                <div className="drawer-item-right">
                  <span className="drawer-item-qty">×{item.quantity}{item.unit ? ` ${item.unit}` : ""}</span>
                  <button className="drawer-item-remove" onClick={() => removeItem(item.id)}>✕</button>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="drawer-footer">
            <Link href="/cart" className="btn btn-solid-green" style={{ width: "100%", textAlign: "center" }} onClick={closeCart}>
              Manage &amp; Send to Kroger →
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
