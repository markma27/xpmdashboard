import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'XPM Dashboard',
  description: 'Multi-tenant SaaS platform for Xero Practice Manager analytics',
  icons: {
    icon: '/Logo_favicon.svg',
    shortcut: '/Logo_favicon.svg',
    apple: '/Logo_favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}

