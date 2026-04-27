import type { Metadata } from "next"
import "./globals.css"
import SessionProvider from "@/components/SessionProvider"

export const metadata: Metadata = {
  title: "Jackson Family Kitchen",
  description: "Weekly meal plan and grocery cart",
  themeColor: "#f7f3ec",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
