"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

const FAVES_KEY = "kitchen_favorites"

interface Ingredient { name: string; amount: string; in_pantry: boolean; kroger_upc: string; kroger_product_name: string; kroger_price: number | null }
interface FaveEntry { name: string; description: string; ingredients: Ingredient[]; instructions: string[]; savedAt: number }

function getFaves(): Record<string, FaveEntry> {
  try { return JSON.parse(localStorage.getItem(FAVES_KEY) || "{}") } catch { return {} }
}
function saveFaves(f: Record<string, FaveEntry>) { localStorage.setItem(FAVES_KEY, JSON.stringify(f)) }
function fmtSaved(ts: number) {
  return "Saved " + new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export default function FavoritesPage() {
  const { status } = useSession()
  const router = useRouter()
  const [faves, setFaves] = useState<Record<string, FaveEntry>>({})
  const [cartStatus, setCartStatus] = useState<Record<string, { text: string; ok?: boolean }>>({})
  const [openInst, setOpenInst] = useState<Record<string, boolean>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin")
  }, [status, router])

  useEffect(() => {
    const f = getFaves()
    setFaves(f)
    const defaults: Record<string, boolean> = {}
    Object.values(f).forEach(e => {
      e.ingredients.filter(i => !i.in_pantry).forEach((_, ii) => { defaults[`${e.name}-${ii}`] = true })
    })
    setChecked(defaults)
  }, [])

  if (status !== "authenticated") return null

  const entries = Object.values(faves).sort((a, b) => b.savedAt - a.savedAt)

  function remove(name: string) {
    const f = getFaves(); delete f[name]; saveFaves(f); setFaves({ ...f })
  }

  function clearAll() {
    if (confirm("Remove all saved recipes?")) { saveFaves({}); setFaves({}) }
  }

  async function addToCart(entry: FaveEntry) {
    const needItems = entry.ingredients.filter(i => !i.in_pantry)
    const items = needItems
      .filter((_, ii) => checked[`${entry.name}-${ii}`] !== false)
      .map(ing => ({ item_name: ing.name, quantity: 1, kroger_upc: ing.kroger_upc || null, kroger_product_name: ing.kroger_product_name || null, kroger_price: ing.kroger_price }))

    if (!items.length) return
    setCartStatus(prev => ({ ...prev, [entry.name]: { text: "Adding…" } }))
    try {
      const res = await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) })
      if (!res.ok) throw new Error()
      setCartStatus(prev => ({ ...prev, [entry.name]: { text: `✓ ${items.length} item${items.length !== 1 ? "s" : ""} added`, ok: true } }))
    } catch {
      setCartStatus(prev => ({ ...prev, [entry.name]: { text: "Failed — try again", ok: false } }))
    }
  }

  return (
    <div className="wrap">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-header">Saved Recipes</h1>
            <p className="page-subtext">Meals you&apos;ve starred from your weekly menu.</p>
          </div>
          {entries.length > 0 && (
            <div className="page-actions">
              <button className="btn btn-outline-muted" onClick={clearAll}>Clear all</button>
            </div>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-card">
          <div className="empty-card-icon">★</div>
          <h3>No saved recipes yet</h3>
          <p>Star meals from this week&apos;s menu to save them here for quick access and re-ordering.</p>
          <Link href="/" className="btn btn-solid-accent">Go to this week&apos;s menu</Link>
        </div>
      ) : (
        <div className="recipes">
          {entries.map((entry) => {
            const needItems = entry.ingredients.filter(i => !i.in_pantry)
            const haveItems = entry.ingredients.filter(i => i.in_pantry)
            const cs = cartStatus[entry.name]
            const isOpen = openInst[entry.name]

            return (
              <div key={entry.name} className="recipe-card">
                <div className="recipe-card-header">
                  <h2>{entry.name}</h2>
                  <button className="btn-remove-item" onClick={() => remove(entry.name)}>✕</button>
                </div>
                <div className="saved-date">{fmtSaved(entry.savedAt)}</div>
                {entry.description && <p className="desc">{entry.description}</p>}

                {entry.ingredients.length > 0 && (
                  <>
                    <p className="section-label">Ingredients</p>
                    <ul className="ingredients">
                      {needItems.map((ing, ii) => (
                        <li key={ii}>
                          <input type="checkbox" checked={checked[`${entry.name}-${ii}`] !== false}
                            onChange={() => setChecked(prev => ({ ...prev, [`${entry.name}-${ii}`]: !prev[`${entry.name}-${ii}`] }))} />
                          <span className="name"><span className="dot need" />{ing.name}</span>
                          <span className="amount">{ing.amount}</span>
                        </li>
                      ))}
                      {haveItems.map((ing, ii) => (
                        <li key={`h${ii}`} className="have">
                          <span className="name"><span className="dot have" />{ing.name}</span>
                          <span className="amount">{ing.amount}</span>
                        </li>
                      ))}
                    </ul>
                    {needItems.length > 0 && (
                      <div className="cart-row">
                        <button className="btn btn-solid-accent" onClick={() => addToCart(entry)}>Add to Cart</button>
                        {cs?.text && <span className={`cart-status${cs.ok === true ? " ok" : cs.ok === false ? " err" : ""}`}>{cs.text}</span>}
                      </div>
                    )}
                  </>
                )}

                {entry.instructions?.length > 0 && (
                  <>
                    <button className={`instructions-toggle${isOpen ? " open" : ""}`}
                      onClick={() => setOpenInst(prev => ({ ...prev, [entry.name]: !prev[entry.name] }))}>
                      <span className="arrow">▶</span> Instructions
                    </button>
                    <ol className={`instructions-list${isOpen ? " open" : ""}`}>
                      {entry.instructions.map((step, si) => (
                        <li key={si} data-step={si + 1}>{step.replace(/^Step\s*\d+:\s*/i, "")}</li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
