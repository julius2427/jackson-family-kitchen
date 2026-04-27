"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useEffect } from "react"
import { useCart } from "@/lib/cartContext"

export default function AppHeader() {
  const { status } = useSession()
  const pathname = usePathname()
  const { cartCount, refreshCount } = useCart()

  useEffect(() => {
    if (status === "authenticated") refreshCount()
  }, [status, refreshCount])

  if (status !== "authenticated") return null
  if (pathname?.startsWith("/auth")) return null

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="app-brand">Jackson Family Kitchen</Link>
        <nav className="app-nav">
          <Link href="/" className={`app-nav-link${pathname === "/" ? " active" : ""}`}>Menu</Link>
          <Link href="/deals" className={`app-nav-link${pathname === "/deals" ? " active" : ""}`}>Deals</Link>
          <Link href="/cart" className={`app-nav-link${pathname === "/cart" ? " active" : ""}`}>
            Cart
            {cartCount > 0 && <span className="app-nav-badge">{cartCount}</span>}
          </Link>
          <Link href="/favorites" className={`app-nav-link${pathname === "/favorites" ? " active" : ""}`}>Saved</Link>
          <button className="app-nav-signout" onClick={() => signOut()}>Sign out</button>
        </nav>
      </div>
    </header>
  )
}
