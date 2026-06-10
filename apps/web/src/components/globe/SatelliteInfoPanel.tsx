'use client'

import { useEffect, useRef, useState } from 'react'
import { SEVERITY_COLORS } from '@/lib/severity'
import type { Conjunction, Satellite } from './GlobeView'
import type { SatellitePosition } from './CesiumContainer'

interface Props {
  satellite: Satellite
  position: SatellitePosition | null
  altitudeKm: number | null
  speedKms: number | null
  conjunctions: Conjunction[]
  lat: number | null
  lon: number | null
}

interface GeocodeResult {
  countryName?: string
  principalSubdivision?: string
}

export function SatelliteInfoPanel({ satellite, altitudeKm, speedKms, conjunctions, lat, lon }: Props) {
  const [geoCountry, setGeoCountry] = useState<string | null>(null)
  const [geoState, setGeoState] = useState<string | null>(null)
  const lastGridRef = useRef<string | null>(null)

  useEffect(() => {
    if (lat === null || lon === null) { setGeoCountry(null); setGeoState(null); return }
    const grid = `${Math.round(lat)},${Math.round(lon)}`
    if (grid === lastGridRef.current) return
    lastGridRef.current = grid

    fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&localityLanguage=en`,
    )
      .then((r) => r.json())
      .then((d: GeocodeResult) => {
        setGeoCountry(d.countryName ?? null)
        setGeoState(d.principalSubdivision || null)
      })
      .catch(() => { setGeoCountry(null); setGeoState(null) })
  }, [lat, lon])

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
        <StatBox label="Altitude" value={altitudeKm !== null ? `${altitudeKm.toFixed(0)} km` : '…'} />
        <StatBox label="Speed" value={speedKms !== null ? `${speedKms.toFixed(2)} km/s` : '…'} />
        {geoCountry && <StatBox label="Country" value={geoCountry} />}
        {geoState && <StatBox label="State" value={geoState} />}
        {!geoCountry && satellite.country && <StatBox label="Origin" value={satellite.country} />}
        {satellite.operator && <StatBox label="Operator" value={satellite.operator} />}
      </div>

      {conjunctions.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] text-red-400 uppercase tracking-wider font-semibold">
            ⚠ {conjunctions.length} active conjunction{conjunctions.length > 1 ? 's' : ''}
          </p>
          {conjunctions.map((c) => {
            const other = c.satelliteA.noradId === satellite.noradId ? c.satelliteB : c.satelliteA
            const color = SEVERITY_COLORS[c.riskLevel]
            return (
              <div
                key={c.id}
                className="rounded px-2 py-1.5 bg-slate-800/60 border-l-2"
                style={{ borderColor: color }}
              >
                <p className="text-[10px] text-white font-medium truncate">{other.name}</p>
                <p className="text-[9px] font-mono mt-0.5" style={{ color }}>
                  {c.closestApproachKm < 1
                    ? `${(c.closestApproachKm * 1000).toFixed(0)} m miss · `
                    : `${c.closestApproachKm.toFixed(2)} km miss · `}
                  <span className="uppercase">{c.riskLevel}</span>
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded px-2 py-1.5 bg-slate-800/60">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-xs font-mono mt-0.5 truncate text-white">{value}</p>
    </div>
  )
}
