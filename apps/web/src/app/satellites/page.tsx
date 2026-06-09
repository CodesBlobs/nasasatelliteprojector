'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'

interface Satellite {
  id: string
  noradId: number
  name: string
  operator: string | null
  country: string | null
  objectType: string
  createdAt: string
}

interface SatelliteList {
  data: Satellite[]
  pagination: { total: number; skip: number; take: number }
}

const PAGE_SIZE = 100

const TYPE_COLORS: Record<string, string> = {
  Payload: 'bg-blue-900/40 text-blue-300',
  Debris: 'bg-red-900/40 text-red-300',
  'Rocket Body': 'bg-yellow-900/40 text-yellow-300',
}

export default function SatellitesPage() {
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<SatelliteList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    api.satellites
      .list(page * PAGE_SIZE, PAGE_SIZE)
      .then((data) => {
        setResult(data as SatelliteList)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [page])

  const satellites = result?.data ?? []
  const total = result?.pagination.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const filtered = useMemo(() => {
    if (!search.trim()) return satellites
    const q = search.toLowerCase()
    return satellites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.noradId.toString().includes(q) ||
        (s.country ?? '').toLowerCase().includes(q) ||
        (s.operator ?? '').toLowerCase().includes(q)
    )
  }, [satellites, search])

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white">Satellites</h1>
          {!loading && (
            <p className="text-slate-400 text-sm mt-1">
              {total.toLocaleString()} objects in catalog
            </p>
          )}
        </div>
        <input
          type="search"
          placeholder="Search name, NORAD ID, country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm w-64 focus:outline-none focus:border-blue-500 placeholder-slate-500"
        />
      </div>

      {loading && <div className="text-center text-slate-400 py-16">Loading…</div>}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && total === 0 && (
        <div className="bg-slate-800 rounded-lg p-12 text-center border border-slate-700">
          <p className="text-slate-300 text-lg">No satellites in catalog yet.</p>
          <p className="text-slate-500 text-sm mt-2">
            Use the Dashboard to import data from CelesTrak.
          </p>
        </div>
      )}

      {!loading && !error && total > 0 && (
        <>
          <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Name</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">NORAD ID</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Country</th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-300">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filtered.map((sat) => (
                  <tr key={sat.id} className="hover:bg-slate-700/50 transition">
                    <td className="px-6 py-3 text-white font-medium">{sat.name}</td>
                    <td className="px-6 py-3 text-slate-400 font-mono">{sat.noradId}</td>
                    <td className="px-6 py-3 text-slate-400">{sat.country || '—'}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          TYPE_COLORS[sat.objectType] ?? 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {sat.objectType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of{' '}
                {total.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 bg-slate-700 rounded disabled:opacity-40 hover:bg-slate-600 transition"
                >
                  Previous
                </button>
                <span className="px-3 py-1">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 bg-slate-700 rounded disabled:opacity-40 hover:bg-slate-600 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
