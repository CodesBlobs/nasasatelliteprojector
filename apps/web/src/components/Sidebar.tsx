'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href

  return (
    <aside className="w-64 bg-slate-800 text-white border-r border-slate-700 flex flex-col">
      <nav className="flex-1 px-4 py-6 space-y-2">
        <Link
          href="/"
          className={`block px-4 py-2 rounded transition ${
            isActive('/') ? 'bg-blue-600' : 'hover:bg-slate-700'
          }`}
        >
          Dashboard
        </Link>
        <Link
          href="/satellites"
          className={`block px-4 py-2 rounded transition ${
            isActive('/satellites') ? 'bg-blue-600' : 'hover:bg-slate-700'
          }`}
        >
          Satellites
        </Link>
        <Link
          href="/alerts"
          className={`block px-4 py-2 rounded transition ${
            isActive('/alerts') ? 'bg-blue-600' : 'hover:bg-slate-700'
          }`}
        >
          Alerts
        </Link>
        <Link
          href="/globe"
          className={`block px-4 py-2 rounded transition ${
            isActive('/globe') ? 'bg-purple-600' : 'hover:bg-slate-700'
          }`}
        >
          3D Globe
        </Link>
      </nav>
      <div className="border-t border-slate-700 px-4 py-4 text-sm text-slate-400">
        <p>v0.1.0</p>
      </div>
    </aside>
  )
}
