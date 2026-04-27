import type { Metadata } from "next"
import "./globals.css"
import SessionProvider from "@/components/SessionProvider"
import { CartProvider } from "@/lib/cartContext"
import AppHeader from "@/components/AppHeader"
import CartDrawer from "@/components/CartDrawer"

export const metadata: Metadata = {
  title: "Jackson Family Kitchen",
  description: "Weekly meal plan and grocery cart",
  themeColor: "#f7f3ec",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <CartProvider>
            <AppHeader />
            <main>{children}</main>
            <CartDrawer />
          </CartProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
