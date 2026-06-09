import type { Metadata } from 'next'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'Orbital - Space Traffic Control',
  description: 'Real-time satellite tracking and conjunction detection',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto bg-slate-950">{children}</main>
        </div>
      </body>
    </html>
  )
}
