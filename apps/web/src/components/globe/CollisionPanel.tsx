'use client'

import { memo, useEffect, useState } from 'react'
import { SEVERITY_COLORS, formatCountdown, type Severity } from '@/lib/severity'
import type { Conjunction } from './GlobeView'

interface Props {
  conjunctions: Conjunction[]
  selectedId: string | null
  isScanning: boolean
  onSelect: (id: string) => void
  onScan: () => void
}

export const CollisionPanel = memo(function CollisionPanel({
  conjunctions,
  selectedId,
  isScanning,
  onSelect,
  onScan,
}: Props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-lg backdrop-blur-sm w-72 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/70">
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Conjunctions
          <span className="ml-1.5 text-slate-500 normal-case tracking-normal">
            {conjunctions.length}
          </span>
        </p>
        <button
          onClick={onScan}
          disabled={isScanning}
          className="text-[10px] px-2 py-0.5 rounded border border-cyan-700 text-cyan-300 hover:bg-cyan-900/40 disabled:opacity-40 transition-colors"
        >
          {isScanning ? 'Scanning…' : 'Run Scan'}
        </button>
      </div>

      {conjunctions.length === 0 ? (
        <p className="text-xs text-slate-500 px-3 py-3">
          No close approaches predicted. Run a scan to check the next 24 hours.
        </p>
      ) : (
        <ul className="overflow-y-auto max-h-[40vh] divide-y divide-slate-800">
          {conjunctions.map((c) => {
            const selected = c.id === selectedId
            return (
              <li key={c.id}>
                <button
                  onClick={() => onSelect(c.id)}
                  className={`w-full text-left px-3 py-2 transition-colors ${
                    selected ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={c.riskLevel} />
                    <span className="text-[10px] text-slate-400 font-mono ml-auto">
                      {formatCountdown(new Date(c.predictedTime), now)}
                    </span>
                  </div>
                  <p className="text-xs text-white mt-1 leading-tight truncate">
                    {c.satelliteA.name}
                    <span className="text-slate-500 mx-1">×</span>
                    {c.satelliteB.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    miss {formatKm(c.closestApproachKm)}
                  </p>

                  {selected && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <Detail label="Satellite A" value={`${c.satelliteA.name} (${c.satelliteA.noradId})`} />
                      <Detail label="Satellite B" value={`${c.satelliteB.name} (${c.satelliteB.noradId})`} />
                      <Detail label="Closest" value={formatKm(c.closestApproachKm)} />
                      <Detail label="Rel. velocity" value={`${c.relativeVelocityKmS.toFixed(2)} km/s`} />
                      <Detail label="Predicted (UTC)" value={formatUtc(c.predictedTime)} />
                      <Detail label="Risk score" value={c.riskScore.toFixed(1)} />
                    </div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
})

function SeverityBadge({ severity }: { severity: Severity }) {
  const color = SEVERITY_COLORS[severity]
  return (
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
      style={{ color, border: `1px solid ${color}`, background: `${color}1a` }}
    >
      {severity}
    </span>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/60 rounded px-1.5 py-1">
      <p className="text-[8px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-[10px] text-slate-200 font-mono mt-0.5 truncate">{value}</p>
    </div>
  )
}

function formatKm(km: number): string {
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(2)} km`
}

function formatUtc(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(5, 16)
}
