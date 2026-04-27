"use client"

import { createContext, useContext, useState, useCallback } from "react"

interface CartContextType {
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  cartCount: number
  setCartCount: (n: number) => void
  refreshCount: () => Promise<void>
}

const CartContext = createContext<CartContextType>({
  isOpen: false,
  openCart: () => {},
  closeCart: () => {},
  cartCount: 0,
  setCartCount: () => {},
  refreshCount: async () => {},
})

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/cart")
      if (!res.ok) return
      const data = await res.json()
      setCartCount(data.count ?? 0)
    } catch {}
  }, [])

  return (
    <CartContext.Provider value={{ isOpen, openCart: () => setIsOpen(true), closeCart: () => setIsOpen(false), cartCount, setCartCount, refreshCount }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
