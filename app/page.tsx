"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

const FAVES_KEY = "kitchen_favorites"

interface Ingredient {
  name: string
  amount: string
  in_pantry: boolean
  kroger_upc: string
  kroger_product_name: string
  kroger_price: number | null
}

interface Meal {
  day: string
  date: string
  name: string
  description: string
  ingredients: Ingredient[]
  instructions: string[]
}

interface WeekData {
  week_start: string
  week_end: string
  generated_at: string
  meals: Meal[]
  shopping_list: { name: string; amount: string; for_meals: string[] }[]
}

function fmtDate(iso: string) {
  if (!iso) return ""
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function fmtUpdated(iso: string) {
  if (!iso) return ""
  const d = new Date(iso)
  return "updated " + d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " at " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

function getFaves(): Record<string, Meal & { savedAt: number }> {
  try { return JSON.parse(localStorage.getItem(FAVES_KEY) || "{}") } catch { return {} }
}
function saveFaves(f: Record<string, Meal & { savedAt: number }>) {
  localStorage.setItem(FAVES_KEY, JSON.stringify(f))
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<WeekData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cartStatus, setCartStatus] = useState<Record<number, { text: string; ok?: boolean }>>({})
  const [openInstructions, setOpenInstructions] = useState<Record<number, boolean>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [faves, setFaves] = useState<Record<string, Meal & { savedAt: number }>>({})

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin")
  }, [status, router])

  useEffect(() => {
    setFaves(getFaves())
  }, [])

  const loadWeek = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/week")
      if (!res.ok) throw new Error()
      const d: WeekData = await res.json()
      setData(d)
      const defaults: Record<string, boolean> = {}
      d.meals.forEach((m, mi) => {
        m.ingredients.forEach((ing, ii) => {
          defaults[`${mi}-${ii}`] = !ing.in_pantry
        })
      })
      setChecked(defaults)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadWeek() }, [loadWeek])

  if (status === "loading" || (status === "authenticated" && loading)) {
    return <div className="wrap"><div className="empty-state">Loading…</div></div>
  }
  if (status === "unauthenticated") return null

  function toggleCheck(key: string) {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function resetChecks(mealIdx: number, meal: Meal) {
    const updates: Record<string, boolean> = {}
    meal.ingredients.forEach((ing, ii) => { updates[`${mealIdx}-${ii}`] = !ing.in_pantry })
    setChecked(prev => ({ ...prev, ...updates }))
    setCartStatus(prev => ({ ...prev, [mealIdx]: { text: "" } }))
  }

  async function addToCart(mealIdx: number, meal: Meal) {
    const items = meal.ingredients
      .filter((_, ii) => checked[`${mealIdx}-${ii}`])
      .map(ing => ({
        item_name: ing.name,
        quantity: 1,
        kroger_upc: ing.kroger_upc || null,
        kroger_product_name: ing.kroger_product_name || null,
        kroger_price: ing.kroger_price,
      }))

    if (!items.length) return

    setCartStatus(prev => ({ ...prev, [mealIdx]: { text: "Adding…" } }))

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error()
      setCartStatus(prev => ({ ...prev, [mealIdx]: { text: `✓ ${items.length} item${items.length !== 1 ? "s" : ""} added to cart`, ok: true } }))
    } catch {
      setCartStatus(prev => ({ ...prev, [mealIdx]: { text: "Failed — try again", ok: false } }))
    }
  }

  function toggleFave(meal: Meal) {
    const f = getFaves()
    if (f[meal.name]) { delete f[meal.name] } else { f[meal.name] = { ...meal, savedAt: Date.now() } }
    saveFaves(f)
    setFaves({ ...f })
  }

  return (
    <div className="wrap">
      <header>
        <h1>This Week&apos;s Kitchen</h1>
        {data && <div className="dates">{fmtDate(data.week_start)} — {fmtDate(data.week_end)}</div>}
        {data && <div className="updated">{fmtUpdated(data.generated_at)}</div>}
        <div className="header-actions">
          <button className="btn btn-outline-accent" onClick={loadWeek} disabled={loading}>
            {loading ? "↻ Refreshing…" : "↻ Refresh"}
          </button>
          <Link href="/favorites" className="btn btn-outline-gold">★ Saved Recipes</Link>
          <Link href="/cart" className="btn btn-outline-muted">🛒 Cart</Link>
          <button className="btn btn-outline-muted" onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      {!data ? (
        <div className="empty-state">No menu available yet. Check back after the next kitchen scan.</div>
      ) : (
        <>
          <div className="meals">
            {data.meals.map((meal, mi) => {
              const needCount = meal.ingredients.filter((_, ii) => checked[`${mi}-${ii}`]).length
              const isFaved = !!faves[meal.name]
              const cs = cartStatus[mi]

              return (
                <div key={mi} className="meal">
                  <div className="day">
                    <span className="day-name">{meal.day}</span>
                    <span className="day-date">{fmtDate(meal.date)}</span>
                  </div>
                  <div className="meal-header">
                    <div className="meal-header-left">
                      <h2>{meal.name}</h2>
                      {meal.description && <p className="desc">{meal.description}</p>}
                    </div>
                    <button className={`btn-fav${isFaved ? " active" : ""}`} onClick={() => toggleFave(meal)}>
                      {isFaved ? "★" : "☆"}
                    </button>
                  </div>

                  <ul className="ingredients">
                    {meal.ingredients.map((ing, ii) => (
                      <li key={ii} className={ing.in_pantry ? "have" : "need"}>
                        <input
                          type="checkbox"
                          checked={!!checked[`${mi}-${ii}`]}
                          onChange={() => toggleCheck(`${mi}-${ii}`)}
                        />
                        <span className="name">
                          <span className={`dot ${ing.in_pantry ? "have" : "need"}`} />
                          {ing.name}
                        </span>
                        <span className="amount">{ing.amount}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="cart-row">
                    <button
                      className="btn btn-solid-accent"
                      disabled={needCount === 0}
                      onClick={() => addToCart(mi, meal)}
                    >
                      Add {needCount} to Cart
                    </button>
                    <button className="btn-ghost" onClick={() => resetChecks(mi, meal)}>reset</button>
                    {cs?.text && (
                      <span className={`cart-status${cs.ok === true ? " ok" : cs.ok === false ? " err" : ""}`}>
                        {cs.text}
                      </span>
                    )}
                  </div>

                  {meal.instructions?.length > 0 && (
                    <>
                      <button
                        className={`instructions-toggle${openInstructions[mi] ? " open" : ""}`}
                        onClick={() => setOpenInstructions(prev => ({ ...prev, [mi]: !prev[mi] }))}
                      >
                        <span className="arrow">▶</span> Instructions
                      </button>
                      <ol className={`instructions-list${openInstructions[mi] ? " open" : ""}`}>
                        {meal.instructions.map((step, si) => (
                          <li key={si} data-step={si + 1}>
                            {step.replace(/^Step\s*\d+:\s*/i, "")}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {data.shopping_list?.length > 0 && (
            <div className="shopping">
              <h3>Need from the store</h3>
              <ul>
                {data.shopping_list.map((item, i) => (
                  <li key={i}>
                    <span>{item.name}{item.amount ? ` — ${item.amount}` : ""}</span>
                    <span className="for">{item.for_meals?.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
