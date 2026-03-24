import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Elecon Timberyard - Quality Timber in Nairobi',
    template: '%s | Elecon Timberyard',
  },
  description: 'Premium timber products in Nairobi. Structural timber, hardwoods, softwoods and custom sizes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
