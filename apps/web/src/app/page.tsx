'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

interface Stats {
  total: number
  byType: Record<string, number>
}

interface ConjunctionStat {
  active: number
}

export default function LandingPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [conjunctions, setConjunctions] = useState<ConjunctionStat | null>(null)

  useEffect(() => {
    api.satellites
      .stats()
      .then((s) => setStats(s as Stats))
      .catch(() => null)
    api.conjunctions
      .active()
      .then((c) => setConjunctions({ active: (c as unknown[]).length }))
      .catch(() => null)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Star field */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />
        {STARS.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: s.x + '%',
              top: s.y + '%',
              width: s.r + 'px',
              height: s.r + 'px',
              opacity: s.o,
              animation: `twinkle ${s.d}s ease-in-out ${s.delay}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-slate-800/60 backdrop-blur-sm bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <span className="text-cyan-400 text-xl">✦</span>
          <span className="text-lg font-bold tracking-tight">Orbital</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest ml-1 hidden sm:block">
            Space Traffic Control
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5"
          >
            Sign in
          </Link>
          <Link
            href="/globe"
            className="text-sm bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            Launch →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-28 pb-24">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-800/60 bg-cyan-900/20 text-cyan-400 text-xs font-medium mb-8 tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Live · {stats ? stats.total.toLocaleString() : '—'} objects tracked
        </div>

        <h1 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tighter mb-6 leading-none">
          <span className="text-white">The</span>{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
            sky
          </span>
          <br />
          <span className="text-white">is not</span>{' '}
          <span className="bg-gradient-to-r from-orange-400 via-red-400 to-orange-300 bg-clip-text text-transparent">
            empty
          </span>
        </h1>

        <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mb-10 leading-relaxed">
          Orbital tracks every satellite, rocket body, and debris fragment in Earth orbit —
          predicts conjunction events, assesses collision risk, and gives your mission control
          team an AI-powered edge.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/globe"
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-7 py-3.5 rounded-xl transition-all hover:scale-105 shadow-lg shadow-cyan-900/40 text-sm"
          >
            <span>Open Mission Control</span>
            <span>→</span>
          </Link>
          <Link
            href="/collisions"
            className="flex items-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium px-7 py-3.5 rounded-xl transition-all text-sm"
          >
            View Conjunction Events
          </Link>
        </div>
      </section>

      {/* Live counters */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Tracked Objects',
              value: stats ? stats.total.toLocaleString() : '—',
              sub: 'from NORAD catalog',
              color: 'cyan',
            },
            {
              label: 'Active Payloads',
              value: stats ? (stats.byType['Payload'] ?? 0).toLocaleString() : '—',
              sub: 'operational spacecraft',
              color: 'green',
            },
            {
              label: 'Debris Fragments',
              value: stats ? (stats.byType['Debris'] ?? 0).toLocaleString() : '—',
              sub: 'tracked hazards',
              color: 'orange',
            },
            {
              label: 'Active Conjunctions',
              value: conjunctions ? conjunctions.active.toLocaleString() : '—',
              sub: 'close approach events',
              color: 'red',
            },
          ].map((c) => (
            <div
              key={c.label}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 backdrop-blur-sm"
            >
              <p
                className={`text-3xl font-black tabular-nums ${
                  c.color === 'cyan'
                    ? 'text-cyan-400'
                    : c.color === 'green'
                      ? 'text-green-400'
                      : c.color === 'orange'
                        ? 'text-orange-400'
                        : 'text-red-400'
                }`}
              >
                {c.value}
              </p>
              <p className="text-sm font-semibold text-slate-300 mt-1">{c.label}</p>
              <p className="text-[11px] text-slate-600 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-28">
        <p className="text-center text-xs text-slate-600 uppercase tracking-[0.2em] font-medium mb-12">
          Platform Capabilities
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-slate-900/60 border border-slate-800 hover:border-slate-600 rounded-xl p-6 transition-colors group"
            >
              <div className={`text-2xl mb-4 ${f.iconColor}`}>{f.icon}</div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              {f.href && (
                <Link
                  href={f.href}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-400 mt-4 transition-colors group-hover:text-slate-400"
                >
                  Open →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-32 text-center">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-600 text-slate-400 text-[11px] font-medium mb-5 uppercase tracking-widest">
            ✦ Built for NASA × Hack Club
          </div>
          <h2 className="text-3xl font-bold mb-4 text-white">
            Ready to take command?
          </h2>
          <p className="text-slate-400 text-sm mb-8 max-w-md mx-auto">
            The 3D globe is live with 14,000+ satellites. Open it and ask the AI copilot what's
            at risk right now.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/register"
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
            >
              Create account
            </Link>
            <Link
              href="/globe"
              className="border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-medium px-6 py-2.5 rounded-lg transition-colors text-sm"
            >
              Try the globe
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 px-8 py-6 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">✦</span>
          <span>Orbital — Space Traffic Control</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/globe" className="hover:text-slate-400 transition-colors">Globe</Link>
          <Link href="/collisions" className="hover:text-slate-400 transition-colors">Conjunctions</Link>
          <Link href="/satellites" className="hover:text-slate-400 transition-colors">Satellites</Link>
          <Link href="/dashboard" className="hover:text-slate-400 transition-colors">Dashboard</Link>
        </div>
      </footer>

      <style>{`
        @keyframes twinkle {
          from { opacity: var(--o-from); }
          to { opacity: var(--o-to); }
        }
      `}</style>
    </div>
  )
}

const FEATURES = [
  {
    icon: '🌍',
    iconColor: 'text-blue-400',
    title: '3D Globe Visualization',
    desc: 'CesiumJS globe with NASA GIBS imagery. Every satellite rendered in real-time orbital position using SGP4 propagation.',
    href: '/globe',
  },
  {
    icon: '⚠️',
    iconColor: 'text-orange-400',
    title: 'Conjunction Detection',
    desc: "Hoots three-filter algorithm scans all object pairs. Pc ≥ 1×10⁻⁴ triggers maneuver advisories automatically.",
    href: '/collisions',
  },
  {
    icon: '✦',
    iconColor: 'text-cyan-400',
    title: 'AI Mission Copilot',
    desc: 'Ask anything — the AI has full context on your conjunctions, alerts, and satellite fleet. Responses include clickable orbital links.',
    href: '/globe',
  },
  {
    icon: '📡',
    iconColor: 'text-green-400',
    title: 'Real TLE Data',
    desc: 'Live ingest from CelesTrak. 14,000+ objects from the NORAD catalog, updated continuously with two-line element sets.',
    href: '/satellites',
  },
  {
    icon: '🔔',
    iconColor: 'text-yellow-400',
    title: 'Alert System',
    desc: 'Risk-scored alerts for CRITICAL, HIGH, and MEDIUM conjunction events. Assign, resolve, and track response status.',
    href: '/alerts',
  },
  {
    icon: '🛸',
    iconColor: 'text-purple-400',
    title: 'Maneuver Simulation',
    desc: 'Simulate delta-V burns and see the resulting orbit. Compare pre- and post-maneuver conjunction risk in the AI analysis panel.',
    href: null,
  },
]

// Pre-seeded star positions so SSR and client render the same thing
const STARS = [
  { x: 5.2, y: 8.1, r: 1.5, o: 0.6, d: 3.1, delay: 0 },
  { x: 12.7, y: 22.4, r: 1, o: 0.4, d: 4.2, delay: 0.5 },
  { x: 88.3, y: 5.6, r: 2, o: 0.7, d: 2.8, delay: 1 },
  { x: 73.1, y: 18.9, r: 1, o: 0.5, d: 5.1, delay: 0.3 },
  { x: 45.6, y: 3.2, r: 1.5, o: 0.8, d: 3.7, delay: 0.8 },
  { x: 92.4, y: 42.7, r: 1, o: 0.4, d: 4.5, delay: 1.2 },
  { x: 28.9, y: 67.3, r: 2, o: 0.6, d: 2.9, delay: 0.1 },
  { x: 61.2, y: 55.8, r: 1, o: 0.3, d: 6.1, delay: 0.7 },
  { x: 18.5, y: 81.4, r: 1.5, o: 0.7, d: 3.4, delay: 0.4 },
  { x: 83.7, y: 73.2, r: 1, o: 0.5, d: 4.8, delay: 1.5 },
  { x: 37.3, y: 91.6, r: 2, o: 0.6, d: 3.2, delay: 0.9 },
  { x: 56.8, y: 34.1, r: 1, o: 0.4, d: 5.5, delay: 0.2 },
  { x: 7.4, y: 48.3, r: 1.5, o: 0.8, d: 2.7, delay: 1.1 },
  { x: 96.1, y: 61.5, r: 1, o: 0.3, d: 4.1, delay: 0.6 },
  { x: 42.9, y: 14.7, r: 2, o: 0.7, d: 3.9, delay: 0.3 },
  { x: 67.5, y: 88.2, r: 1, o: 0.5, d: 5.3, delay: 1.4 },
  { x: 24.1, y: 44.6, r: 1.5, o: 0.6, d: 3.6, delay: 0.7 },
  { x: 79.8, y: 29.3, r: 1, o: 0.4, d: 4.7, delay: 0.1 },
  { x: 51.4, y: 77.8, r: 2, o: 0.7, d: 2.6, delay: 1.3 },
  { x: 14.6, y: 95.1, r: 1, o: 0.3, d: 5.8, delay: 0.5 },
  { x: 33.7, y: 58.4, r: 1.5, o: 0.8, d: 3.3, delay: 0.8 },
  { x: 86.2, y: 11.7, r: 1, o: 0.5, d: 4.4, delay: 1.6 },
  { x: 48.5, y: 26.9, r: 2, o: 0.6, d: 3.8, delay: 0.2 },
  { x: 71.9, y: 48.5, r: 1, o: 0.4, d: 5.2, delay: 0.9 },
  { x: 2.8, y: 35.7, r: 1.5, o: 0.7, d: 2.8, delay: 0.4 },
  { x: 59.3, y: 7.4, r: 1, o: 0.3, d: 6.3, delay: 1.7 },
  { x: 76.6, y: 82.6, r: 2, o: 0.8, d: 3.1, delay: 0 },
  { x: 21.2, y: 63.8, r: 1, o: 0.5, d: 4.6, delay: 0.6 },
  { x: 94.8, y: 24.1, r: 1.5, o: 0.6, d: 3.5, delay: 1 },
  { x: 39.7, y: 72.5, r: 1, o: 0.4, d: 5.0, delay: 0.3 },
  { x: 64.3, y: 39.8, r: 2, o: 0.7, d: 2.7, delay: 1.2 },
  { x: 10.9, y: 16.3, r: 1, o: 0.3, d: 4.9, delay: 0.8 },
  { x: 55.1, y: 97.2, r: 1.5, o: 0.8, d: 3.6, delay: 0.1 },
  { x: 81.4, y: 54.9, r: 1, o: 0.5, d: 5.7, delay: 1.5 },
  { x: 30.6, y: 84.7, r: 2, o: 0.6, d: 3.0, delay: 0.5 },
]
