"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface DealItem {
  normalized_query: string
  display_name: string
  product_name: string
  upc: string
  category: string | null
  regular_price: number | null
  promo_price: number | null
  in_stock: boolean
  min_regular_90d: number | null
  on_sale_count_90d: number
  savings: number | null
  savings_pct: number | null
}

interface DealsData {
  on_sale: DealItem[]
  all_items: DealItem[]
  categories: string[]
  error?: string
}

export default function DealsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DealsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [cartStatus, setCartStatus] = useState<Record<string, { text: string; ok?: boolean }>>({})

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin")
  }, [status, router])

  const loadDeals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/deals")
      const d = await res.json()
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") loadDeals()
  }, [status, loadDeals])

  if (status !== "authenticated") return null

  async function addToCart(item: DealItem) {
    setCartStatus(prev => ({ ...prev, [item.upc]: { text: "Adding…" } }))
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            item_name: item.display_name,
            quantity: 1,
            kroger_upc: item.upc,
            kroger_product_name: item.product_name,
            kroger_price: item.regular_price,
            kroger_promo_price: item.promo_price,
          }],
        }),
      })
      if (!res.ok) throw new Error()
      setCartStatus(prev => ({ ...prev, [item.upc]: { text: "✓ Added", ok: true } }))
    } catch {
      setCartStatus(prev => ({ ...prev, [item.upc]: { text: "Failed", ok: false } }))
    }
  }

  function filterItems(items: DealItem[]) {
    if (activeCategory === "all") return items
    return items.filter(i => i.category === activeCategory)
  }

  const onSale = filterItems(data?.on_sale ?? [])
  const allItems = filterItems(data?.all_items ?? [])
  const notOnSale = allItems.filter(i => !i.savings)

  return (
    <div className="wrap">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-header">Deals</h1>
            <p className="page-subtext">Sale prices on your regular items at your Kroger store.</p>
          </div>
          <div className="page-actions">
            <button className="btn btn-outline-accent" onClick={loadDeals} disabled={loading}>
              {loading ? "↻ Refreshing…" : "↻ Refresh"}
            </button>
          </div>
        </div>
      </div>

      {data?.categories && data.categories.length > 0 && (
        <div className="category-filters">
          <button
            className={`filter-chip${activeCategory === "all" ? " active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            All
          </button>
          {data.categories.map(cat => (
            <button
              key={cat}
              className={`filter-chip${activeCategory === cat ? " active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="empty-state">Checking prices at your store…</div>
      ) : !data || data.error ? (
        <div className="empty-state">{data?.error ?? "Could not load deals. Try refreshing."}</div>
      ) : (
        <>
          {onSale.length > 0 && (
            <section className="deals-section">
              <h2 className="deals-section-title">🔥 Your regulars on sale</h2>
              <div className="deal-cards">
                {onSale.map(item => (
                  <DealCard key={item.upc} item={item} status={cartStatus[item.upc]} onAdd={addToCart} />
                ))}
              </div>
            </section>
          )}

          {notOnSale.length > 0 && (
            <section className="deals-section">
              <h2 className="deals-section-title">Your regular items</h2>
              <div className="deal-cards">
                {notOnSale.map(item => (
                  <DealCard key={item.upc} item={item} status={cartStatus[item.upc]} onAdd={addToCart} />
                ))}
              </div>
            </section>
          )}

          {onSale.length === 0 && notOnSale.length === 0 && (
            <div className="empty-state">
              No saved items yet.<br /><br />
              Items you pick in the cart will appear here with price tracking.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DealCard({ item, status, onAdd }: { item: DealItem; status?: { text: string; ok?: boolean }; onAdd: (i: DealItem) => void }) {
  const onSale = item.savings != null

  return (
    <div className={`deal-card${onSale ? " deal-card-sale" : ""}`}>
      <div className="deal-card-top">
        <div className="deal-card-name">{item.display_name}</div>
        {onSale && <span className="deal-badge">SALE</span>}
      </div>
      <div className="deal-card-product">{item.product_name}</div>
      {item.category && <div className="deal-card-category">{item.category}</div>}

      <div className="deal-card-price-row">
        {onSale ? (
          <>
            <span className="deal-price-sale">${item.promo_price!.toFixed(2)}</span>
            <span className="deal-price-regular">${item.regular_price!.toFixed(2)}</span>
            <span className="deal-savings">save ${item.savings!.toFixed(2)} ({item.savings_pct}%)</span>
          </>
        ) : item.regular_price != null ? (
          <span className="deal-price">${item.regular_price.toFixed(2)}</span>
        ) : (
          <span className="deal-price muted">Price unavailable</span>
        )}
      </div>

      {item.on_sale_count_90d > 0 && (
        <div className="deal-history">on sale {item.on_sale_count_90d}× in last 90 days{item.min_regular_90d != null ? ` · low: $${item.min_regular_90d.toFixed(2)}` : ""}</div>
      )}

      {!item.in_stock && <div className="deal-out-stock">Out of stock at your store</div>}

      <div className="deal-card-actions">
        <button
          className="btn btn-solid-accent"
          onClick={() => onAdd(item)}
          disabled={!item.in_stock || !!status}
        >
          {status?.text ?? "Add to Cart"}
        </button>
      </div>
    </div>
  )
}
