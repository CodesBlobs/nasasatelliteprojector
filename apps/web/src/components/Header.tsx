'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'

export function Header() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="bg-slate-900 text-white border-b border-slate-700 px-6 py-3 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 text-lg">✦</span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Orbital</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest -mt-0.5">Space Traffic Control</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-slate-400">Status</p>
            <p className="text-xs text-green-400">● Connected</p>
          </div>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-1.5 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-cyan-700 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                  {user.name.charAt(0)}
                </div>
                <span className="text-xs text-slate-300 max-w-[120px] truncate">{user.name}</span>
                <span className="text-slate-500 text-[10px]">▾</span>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-slate-700">
                      <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { logout(); setMenuOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-slate-700 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="text-xs bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
