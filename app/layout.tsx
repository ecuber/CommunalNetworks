import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Communal Networks',
  description: 'Manage your network connections',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

