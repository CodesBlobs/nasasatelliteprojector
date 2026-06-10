'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { altitudeKm, eciToEcefMeters, speedKms } from '@/lib/cesium-utils'
import { worstSeverity, type Severity } from '@/lib/severity'
import { CesiumContainer, type ConjunctionVisual, type SatellitePosition } from './CesiumContainer'
import { SatelliteListPanel } from './SatelliteListPanel'
import { SatelliteInfoPanel } from './SatelliteInfoPanel'
import { TimeControlsBar } from './TimeControlsBar'
import { CollisionPanel } from './CollisionPanel'

export interface Satellite {
  id: string
  noradId: number
  name: string
  objectType: string
  country: string | null
  operator: string | null
}

export interface ConjunctionSatellite {
  id: string
  noradId: number
  name: string
  objectType: string
}

export interface Conjunction {
  id: string
  closestApproachKm: number
  relativeVelocityKmS: number
  predictedTime: string
  riskScore: number
  riskLevel: Severity
  status: string
  satelliteA: ConjunctionSatellite
  satelliteB: ConjunctionSatellite
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


const POSITION_POLL_INTERVAL = 5000
const CONJUNCTION_POLL_INTERVAL = 30000
const ORBIT_REFRESH_INTERVAL = 60000

const TYPE_OPTIONS = [
  { label: 'Payload', color: '#22d3ee' },
  { label: 'Rocket Body', color: '#fb923c' },
  { label: 'Debris', color: '#94a3b8' },
]
const DISPLAY_LIMITS = [
  { label: '1k', value: 1000 },
  { label: '5k', value: 5000 },
  { label: 'All', value: 0 },
]

export default function GlobeView() {
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [positions, setPositions] = useState<Map<number, SatellitePosition>>(new Map())
  const [selectedNoradId, setSelectedNoradId] = useState<number | null>(null)
  const [orbitTrack, setOrbitTrack] = useState<OrbitPoint[] | null>(null)
  const [conjunctions, setConjunctions] = useState<Conjunction[]>([])
  const [selectedConjunctionId, setSelectedConjunctionId] = useState<string | null>(null)
  const [approachPoints, setApproachPoints] = useState<Map<string, { x: number; y: number; z: number }>>(new Map())
  const [isScanning, setIsScanning] = useState(false)

  const [simulatedTime, setSimulatedTime] = useState(() => new Date())
  const [isPlaying, setIsPlaying] = useState(true)
  const [timeSpeed, setTimeSpeed] = useState<1 | 10 | 100 | 1000>(1)
  const [activeTypes, setActiveTypes] = useState<Set<string>>(() => new Set(['Payload', 'Rocket Body', 'Debris']))
  const [displayLimit, setDisplayLimit] = useState(5000)

  const visibleSatellites = useMemo(() => {
    const filtered = satellites.filter(s => activeTypes.has(s.objectType))
    return displayLimit === 0 ? filtered : filtered.slice(0, displayLimit)
  }, [satellites, activeTypes, displayLimit])

  function toggleType(type: string) {
    setActiveTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

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
    async function loadAll() {
      const PAGE = 1000
      let skip = 0
      const all: Satellite[] = []
      while (true) {
        const data = (await api.satellites.list(skip, PAGE)) as SatelliteList
        all.push(...data.data)
        if (all.length >= data.pagination.total || data.data.length < PAGE) break
        skip += PAGE
      }
      setSatellites(all)
    }
    loadAll().catch(console.error)
  }, [])

  // Immediately cull positions when filter changes — don't wait for next fetch
  useEffect(() => {
    const visibleIds = new Set(visibleSatellites.map(s => s.noradId))
    setPositions(prev => {
      const next = new Map<number, SatellitePosition>()
      prev.forEach((pos, id) => { if (visibleIds.has(id)) next.set(id, pos) })
      return next
    })
  }, [visibleSatellites])

  // Poll positions
  useEffect(() => {
    const noradIds = visibleSatellites.map((s) => s.noradId)
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
  }, [visibleSatellites])

  // Fetch orbit track for selected satellite, refreshed every minute
  useEffect(() => {
    if (selectedNoradId === null) {
      setOrbitTrack(null)
      return
    }
    let cancelled = false

    async function fetchOrbit() {
      try {
        const track = (await api.propagation.getOrbit(selectedNoradId!)) as OrbitTrack
        if (!cancelled) setOrbitTrack(track.points)
      } catch (err) {
        console.error('Orbit fetch failed:', err)
      }
    }

    fetchOrbit()
    const id = setInterval(fetchOrbit, ORBIT_REFRESH_INTERVAL)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [selectedNoradId])

  // Poll active conjunctions. Keep previous array identity when nothing changed
  // so downstream effects (markers, approach-point fetches) don't re-run.
  const fetchConjunctions = useCallback(async () => {
    try {
      const events = (await api.conjunctions.active()) as Conjunction[]
      setConjunctions((prev) => {
        const signature = (list: Conjunction[]) =>
          list.map((c) => `${c.id}:${c.predictedTime}:${c.status}`).join('|')
        return signature(prev) === signature(events) ? prev : events
      })
    } catch (err) {
      console.error('Conjunction fetch failed:', err)
    }
  }, [])

  useEffect(() => {
    fetchConjunctions()
    const id = setInterval(fetchConjunctions, CONJUNCTION_POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchConjunctions])

  // Propagate each conjunction pair at its predicted time to place the
  // closest-approach marker (ECEF midpoint between the two satellites)
  useEffect(() => {
    if (conjunctions.length === 0) {
      setApproachPoints(new Map())
      return
    }
    let cancelled = false

    async function loadApproachPoints() {
      const entries = await Promise.all(
        conjunctions.map(async (c) => {
          try {
            const when = new Date(c.predictedTime)
            const pair = (await api.propagation.getPositions(
              [c.satelliteA.noradId, c.satelliteB.noradId],
              when,
            )) as SatellitePosition[]
            if (pair.length < 2) return null
            const mid = {
              x: (pair[0].position.x + pair[1].position.x) / 2,
              y: (pair[0].position.y + pair[1].position.y) / 2,
              z: (pair[0].position.z + pair[1].position.z) / 2,
            }
            const [x, y, z] = eciToEcefMeters(mid, when)
            return [c.id, { x, y, z }] as const
          } catch {
            return null
          }
        }),
      )
      if (!cancelled) {
        setApproachPoints(new Map(entries.filter((e): e is NonNullable<typeof e> => e !== null)))
      }
    }

    loadApproachPoints()
    return () => {
      cancelled = true
    }
  }, [conjunctions])

  // Worst active severity per satellite, used to color points on the globe
  const severityBySat = useMemo(() => {
    const map = new Map<number, Severity>()
    for (const c of conjunctions) {
      map.set(c.satelliteA.noradId, worstSeverity(map.get(c.satelliteA.noradId), c.riskLevel))
      map.set(c.satelliteB.noradId, worstSeverity(map.get(c.satelliteB.noradId), c.riskLevel))
    }
    return map
  }, [conjunctions])

  const conjunctionVisuals = useMemo<ConjunctionVisual[]>(
    () =>
      conjunctions.map((c) => ({
        id: c.id,
        riskLevel: c.riskLevel,
        aNoradId: c.satelliteA.noradId,
        bNoradId: c.satelliteB.noradId,
        closestApproachKm: c.closestApproachKm,
        approachPoint: approachPoints.get(c.id) ?? null,
      })),
    [conjunctions, approachPoints],
  )

  const handleScan = useCallback(async () => {
    setIsScanning(true)
    try {
      await api.conjunctions.scan()
      await fetchConjunctions()
    } catch (err) {
      console.error('Conjunction scan failed:', err)
    } finally {
      setIsScanning(false)
    }
  }, [fetchConjunctions])

  const handleSelectSatellite = useCallback((noradId: number) => {
    setSelectedNoradId((prev) => (prev === noradId ? null : noradId))
  }, [])

  const handleSelectConjunction = useCallback((id: string) => {
    setSelectedConjunctionId((prev) => (prev === id ? null : id))
  }, [])

  const handleTimeShift = useCallback((deltaMs: number) => {
    setSimulatedTime((t) => new Date(t.getTime() + deltaMs))
  }, [])

  const selectedSat = satellites.find((s) => s.noradId === selectedNoradId) ?? null
  const selectedPos = selectedNoradId !== null ? positions.get(selectedNoradId) ?? null : null
  const selectedSatConjunctionCount =
    selectedNoradId === null
      ? 0
      : conjunctions.filter(
          (c) =>
            c.satelliteA.noradId === selectedNoradId || c.satelliteB.noradId === selectedNoradId,
        ).length

  return (
    <div className="absolute inset-0 bg-black">
      <CesiumContainer
        satellites={satellites}
        positions={positions}
        orbitPoints={orbitTrack}
        selectedNoradId={selectedNoradId}
        conjunctions={conjunctionVisuals}
        severityBySat={severityBySat}
        selectedConjunctionId={selectedConjunctionId}
        onSelectSatellite={handleSelectSatellite}
        onSelectConjunction={handleSelectConjunction}
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
            conjunctionCount={selectedSatConjunctionCount}
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

      {/* Filter panel */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 items-end">
        <div className="bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            {TYPE_OPTIONS.map(({ label, color }) => (
              <button
                key={label}
                onClick={() => toggleType(label)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border transition-opacity ${activeTypes.has(label) ? 'opacity-100' : 'opacity-30'}`}
                style={{ borderColor: color, color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 items-center justify-between">
            <span className="text-xs text-slate-500">Show</span>
            <div className="flex gap-1">
              {DISPLAY_LIMITS.map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => setDisplayLimit(value)}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${displayLimit === value ? 'bg-slate-600 border-slate-500 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500 ml-1">{positions.size} tracked</span>
          </div>
        </div>

        <CollisionPanel
          conjunctions={conjunctions}
          selectedId={selectedConjunctionId}
          now={simulatedTime}
          isScanning={isScanning}
          onSelect={handleSelectConjunction}
          onScan={handleScan}
        />
      </div>
    </div>
  )
}
