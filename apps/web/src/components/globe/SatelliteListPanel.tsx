'use client'

import { memo, useMemo } from 'react'
import type { Satellite } from './GlobeView'
import type { SatellitePosition } from './CesiumContainer'
import { altitudeKm } from '@/lib/cesium-utils'

interface Props {
  satellites: Satellite[]
  positions: Map<number, SatellitePosition>
  selectedNoradId: number | null
  search: string
  onSearchChange: (value: string) => void
  onSelect: (noradId: number) => void
}

const TYPE_DOT: Record<string, string> = {
  PAYLOAD: 'bg-cyan-400',
  DEBRIS: 'bg-red-400',
  'ROCKET BODY': 'bg-yellow-400',
}

export const SatelliteListPanel = memo(function SatelliteListPanel({ satellites, positions, selectedNoradId, search, onSearchChange, onSelect }: Props) {
  const filtered = useMemo(() => {
    if (!search.trim()) return satellites
    const q = search.toLowerCase()
    return satellites.filter(
      (s) => s.name.toLowerCase().includes(q) || s.noradId.toString().includes(q),
    )
  }, [satellites, search])

  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-lg backdrop-blur-sm flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700">
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Satellites ({satellites.length})
        </p>
        <input
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-cyan-500 placeholder-slate-500"
        />
      </div>

      <div className="overflow-y-auto flex-1" style={{ maxHeight: '45vh' }}>
        {filtered.length === 0 && (
          <p className="text-slate-500 text-xs text-center py-4">No satellites loaded</p>
        )}
        {filtered.map((sat) => {
          const pos = positions.get(sat.noradId)
          const alt = pos ? altitudeKm(pos.position).toFixed(0) : null
          const isSelected = sat.noradId === selectedNoradId

          return (
            <button
              key={sat.noradId}
              onClick={() => onSelect(sat.noradId)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                isSelected
                  ? 'bg-cyan-900/40 border-l-2 border-cyan-400'
                  : 'hover:bg-slate-800/60 border-l-2 border-transparent'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  TYPE_DOT[(sat.objectType ?? '').toUpperCase()] ?? 'bg-slate-400'
                }`}
              />
              <span className="flex-1 min-w-0">
                <span
                  className={`block text-xs font-medium truncate ${
                    isSelected ? 'text-cyan-300' : 'text-slate-200'
                  }`}
                >
                  {sat.name}
                </span>
                <span className="block text-[10px] text-slate-500">
                  {sat.noradId}
                  {alt && ` · ${alt} km`}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
})
