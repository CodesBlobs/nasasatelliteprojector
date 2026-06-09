'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { altitudeKm, speedKms } from '@/lib/cesium-utils'
import { CesiumContainer, type SatellitePosition } from './CesiumContainer'
import { SatelliteListPanel } from './SatelliteListPanel'
import { SatelliteInfoPanel } from './SatelliteInfoPanel'
import { TimeControlsBar } from './TimeControlsBar'

export interface Satellite {
  id: string
  noradId: number
  name: string
  objectType: string
  country: string | null
  operator: string | null
}

interface SatelliteList {
  data: Satellite[]
  pagination: { total: number; skip: number; take: number }
}

interface OrbitPoint {
  timestamp: string
  position: { x: number; y: number; z: number }
  velocity: { x: number; y: number; z: number }
}

interface OrbitTrack {
  noradId: number
  points: OrbitPoint[]
}

const MAX_SATELLITES = 500
const POSITION_POLL_INTERVAL = 5000

export default function GlobeView() {
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [positions, setPositions] = useState<Map<number, SatellitePosition>>(new Map())
  const [selectedNoradId, setSelectedNoradId] = useState<number | null>(null)
  const [orbitTrack, setOrbitTrack] = useState<OrbitPoint[] | null>(null)

  const [simulatedTime, setSimulatedTime] = useState(() => new Date())
  const [isPlaying, setIsPlaying] = useState(true)
  const [timeSpeed, setTimeSpeed] = useState<1 | 10 | 100 | 1000>(1)

  const simulatedTimeRef = useRef(simulatedTime)
  simulatedTimeRef.current = simulatedTime

  // Advance simulated time
  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(() => {
      setSimulatedTime((t) => new Date(t.getTime() + 1000 * timeSpeed))
    }, 1000)
    return () => clearInterval(id)
  }, [isPlaying, timeSpeed])

  // Load satellite list once
  useEffect(() => {
    api.satellites
      .list(0, MAX_SATELLITES)
      .then((data) => setSatellites((data as SatelliteList).data))
      .catch(console.error)
  }, [])

  // Poll positions
  useEffect(() => {
    const noradIds = satellites.map((s) => s.noradId)
    if (noradIds.length === 0) return

    let cancelled = false

    async function fetchPositions() {
      if (cancelled) return
      try {
        const results = (await api.propagation.getPositions(
          noradIds,
          simulatedTimeRef.current,
        )) as SatellitePosition[]
        if (!cancelled) {
          setPositions(new Map(results.map((p) => [p.noradId, p])))
        }
      } catch (err) {
        console.error('Position fetch failed:', err)
      }
    }

    fetchPositions()
    const id = setInterval(fetchPositions, POSITION_POLL_INTERVAL)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [satellites])

  // Fetch orbit track for selected satellite
  useEffect(() => {
    if (selectedNoradId === null) {
      setOrbitTrack(null)
      return
    }
    let cancelled = false
    api.propagation
      .getOrbit(selectedNoradId)
      .then((track) => {
        if (!cancelled) setOrbitTrack((track as OrbitTrack).points)
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [selectedNoradId])

  const handleSelectSatellite = useCallback((noradId: number) => {
    setSelectedNoradId((prev) => (prev === noradId ? null : noradId))
  }, [])

  const handleTimeShift = useCallback((deltaMs: number) => {
    setSimulatedTime((t) => new Date(t.getTime() + deltaMs))
  }, [])

  const selectedSat = satellites.find((s) => s.noradId === selectedNoradId) ?? null
  const selectedPos = selectedNoradId !== null ? positions.get(selectedNoradId) ?? null : null

  return (
    <div className="absolute inset-0 bg-black">
      <CesiumContainer
        satellites={satellites}
        positions={positions}
        orbitPoints={orbitTrack}
        selectedNoradId={selectedNoradId}
        onSelectSatellite={handleSelectSatellite}
      />

      {/* Satellite list — top-left overlay */}
      <div className="absolute top-3 left-3 z-10 w-64 max-h-[60vh] flex flex-col">
        <SatelliteListPanel
          satellites={satellites}
          positions={positions}
          selectedNoradId={selectedNoradId}
          onSelect={handleSelectSatellite}
        />
      </div>

      {/* Selected satellite info — bottom-left overlay */}
      {selectedSat && selectedPos && (
        <div className="absolute bottom-16 left-3 z-10 w-64">
          <SatelliteInfoPanel
            satellite={selectedSat}
            position={selectedPos}
            altitudeKm={altitudeKm(selectedPos.position)}
            speedKms={speedKms(selectedPos.velocity)}
          />
        </div>
      )}

      {/* Time controls — bottom center overlay */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
        <TimeControlsBar
          simulatedTime={simulatedTime}
          isPlaying={isPlaying}
          timeSpeed={timeSpeed}
          onPlayPause={() => setIsPlaying((p) => !p)}
          onSpeedChange={setTimeSpeed}
          onTimeShift={handleTimeShift}
        />
      </div>

      {/* Satellite count badge */}
      <div className="absolute top-3 right-3 z-10 bg-slate-900/80 border border-slate-700 rounded px-3 py-1 text-xs text-slate-400">
        {positions.size} / {satellites.length} objects tracked
      </div>
    </div>
  )
}
