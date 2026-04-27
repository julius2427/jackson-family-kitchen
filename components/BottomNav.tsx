"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useEffect } from "react"
import { useCart } from "@/lib/cartContext"

export default function BottomNav() {
  const { status } = useSession()
  const pathname = usePathname()
  const { openCart, cartCount, refreshCount } = useCart()

  useEffect(() => {
    if (status === "authenticated") refreshCount()
  }, [status, refreshCount])

  if (status !== "authenticated") return null
  if (pathname?.startsWith("/auth")) return null

  return (
    <nav className="bottom-nav">
      <Link href="/" className={`nav-item${pathname === "/" ? " active" : ""}`}>
        <span className="nav-icon">🍽</span>
        <span className="nav-label">Menu</span>
      </Link>
      <Link href="/deals" className={`nav-item${pathname === "/deals" ? " active" : ""}`}>
        <span className="nav-icon">🏷</span>
        <span className="nav-label">Deals</span>
      </Link>
      <button className="nav-item nav-cart-btn" onClick={openCart}>
        <span className="nav-icon-wrap">
          <span className="nav-icon">🛒</span>
          {cartCount > 0 && <span className="nav-badge">{cartCount}</span>}
        </span>
        <span className="nav-label">Cart</span>
      </button>
      <Link href="/favorites" className={`nav-item${pathname === "/favorites" ? " active" : ""}`}>
        <span className="nav-icon">★</span>
        <span className="nav-label">Saved</span>
      </Link>
    </nav>
  )
}
