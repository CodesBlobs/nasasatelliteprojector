import type { Metadata } from 'next'
import { Providers } from './providers'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'Orbital - Space Traffic Control',
  description: 'Real-time satellite tracking and conjunction detection',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
