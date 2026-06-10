'use client'

import type { Satellite } from './GlobeView'
import type { SatellitePosition } from './CesiumContainer'

interface Props {
  satellite: Satellite
  position: SatellitePosition
  altitudeKm: number
  speedKms: number
  conjunctionCount: number
}

export function SatelliteInfoPanel({ satellite, altitudeKm, speedKms, conjunctionCount }: Props) {
  return (
    <div className="bg-slate-900/90 border border-cyan-800 rounded-lg backdrop-blur-sm p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-cyan-300 leading-tight">{satellite.name}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">NORAD {satellite.noradId}</p>
        </div>
        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded flex-shrink-0">
          {satellite.objectType}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Altitude" value={`${altitudeKm.toFixed(0)} km`} />
        <StatBox label="Speed" value={`${speedKms.toFixed(2)} km/s`} />
        <StatBox
          label="Conjunctions"
          value={conjunctionCount === 0 ? 'None' : `${conjunctionCount} active`}
          highlight={conjunctionCount > 0}
        />
        {satellite.country && (
          <StatBox label="Country" value={satellite.country} />
        )}
        {satellite.operator && (
          <StatBox label="Operator" value={satellite.operator} />
        )}
      </div>
    </div>
  )
}

function StatBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded px-2 py-1.5 ${highlight ? 'bg-red-950/60 border border-red-800' : 'bg-slate-800/60'}`}>
      <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xs font-mono mt-0.5 truncate ${highlight ? 'text-red-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}
