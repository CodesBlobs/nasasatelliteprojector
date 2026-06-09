'use client'

import type { Satellite } from './GlobeView'
import type { SatellitePosition } from './CesiumContainer'

interface Props {
  satellite: Satellite
  position: SatellitePosition
  altitudeKm: number
  speedKms: number
}

export function SatelliteInfoPanel({ satellite, altitudeKm, speedKms }: Props) {
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/60 rounded px-2 py-1.5">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-xs text-white font-mono mt-0.5 truncate">{value}</p>
    </div>
  )
}
