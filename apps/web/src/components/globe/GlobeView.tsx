'use client'

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { altitudeKm, eciToEcefMeters, eciToLatLon, speedKms } from '@/lib/cesium-utils'
import { worstSeverity, type Severity } from '@/lib/severity'
import { CesiumContainer, type ConjunctionVisual, type SatellitePosition } from './CesiumContainer'
import { SatelliteListPanel } from './SatelliteListPanel'
import { SatelliteInfoPanel } from './SatelliteInfoPanel'
import { TimeControlsBar } from './TimeControlsBar'
import { CollisionPanel } from './CollisionPanel'
import ManeuverPanel from '@/components/ManeuverPanel'
import SimulationResults from '@/components/SimulationResults'
import OrbitComparison from '@/components/OrbitComparison'
import type { SimulationWithResult } from '@orbital/shared'

export interface Satellite {
  id: string
  noradId: number
  name: string
  objectType: string
  country: string | null
  operator: string | null
  meanMotion: number | null
}

type CategoryFilter = 'all' | 'starlink' | 'stations' | 'debris' | 'rocket' | 'other'
type OrbitFilter = 'all' | 'leo' | 'meo' | 'geo' | 'heo'

function getCategory(name: string, objectType: string): Exclude<CategoryFilter, 'all'> {
  const n = name.toUpperCase()
  const t = (objectType ?? '').toUpperCase()
  if (n.includes('STARLINK')) return 'starlink'
  if (
    /^ISS[\s(]|^ISS$/.test(n) ||
    n.includes('TIANGONG') ||
    n.includes('TIANHE') ||
    n.includes('SHENZHOU') ||
    /^CSS[\s(]/.test(n) ||
    /\bZARYA\b|\bZVEZDA\b|\bNAUKA\b|\bPIRS\b|\bRASSVET\b|\bPRICHAL\b/.test(n) ||
    /\bUNITY\b|\bHARMONY\b|\bTRANQUILITY\b|\bSERENITY\b|\bDESTINY\b|\bCUPOLA\b/.test(n)
  ) return 'stations'
  if (t === 'DEBRIS') return 'debris'
  if (t === 'ROCKET BODY') return 'rocket'
  return 'other'
}

function getOrbitRegime(meanMotion: number | null | undefined): Exclude<OrbitFilter, 'all'> | 'unknown' {
  if (meanMotion == null || isNaN(meanMotion)) return 'unknown'
  if (meanMotion > 11.25) return 'leo'
  if (meanMotion >= 1.1) return 'meo'
  if (meanMotion >= 0.9) return 'geo'
  return 'heo'
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

const POSITION_POLL_INTERVAL = 8000
const CONJUNCTION_POLL_INTERVAL = 30000
const ORBIT_REFRESH_INTERVAL = 60000
const MAX_SEARCH_ON_GLOBE = 20
const CLUSTER_RADIUS_KM = 2000
const RENDER_PRESETS = [100, 500, 1000, 2500, 5000, 10000, 15000]

export default function GlobeView() {
  const [satellites, setSatellites] = useState<Satellite[]>([])
  const [catalogueLoaded, setCatalogueLoaded] = useState(false)
  const [positions, setPositions] = useState<Map<number, SatellitePosition>>(new Map())
  const [selectedNoradId, setSelectedNoradId] = useState<number | null>(null)
  const [orbitTrack, setOrbitTrack] = useState<OrbitPoint[] | null>(null)
  const [conjunctions, setConjunctions] = useState<Conjunction[]>([])
  const [selectedConjunctionId, setSelectedConjunctionId] = useState<string | null>(null)
  const [approachPoints, setApproachPoints] = useState<Map<string, { x: number; y: number; z: number }>>(new Map())
  const [isScanning, setIsScanning] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [search, setSearch] = useState('')
  const [backgroundCount, setBackgroundCount] = useState(500)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [orbitFilter, setOrbitFilter] = useState<OrbitFilter>('all')
  const resetViewRef = useRef<(() => void) | null>(null)

  const [resolutionScale, setResolutionScale] = useState(1.0)

  // Maneuver simulation state
  const [showManeuverPanel, setShowManeuverPanel] = useState(false)
  const [simulationResult, setSimulationResult] = useState<SimulationWithResult | null>(null)
  const [simulatedOrbitTrack, setSimulatedOrbitTrack] = useState<OrbitPoint[] | null>(null)
  const [showOriginalOrbit, setShowOriginalOrbit] = useState(true)
  const [showSimulatedOrbit, setShowSimulatedOrbit] = useState(true)

  const handleSimulationComplete = useCallback((result: SimulationWithResult) => {
    setSimulationResult(result)
    if (result.result?.simulatedTrajectory) {
      setSimulatedOrbitTrack(result.result.simulatedTrajectory as unknown as OrbitPoint[])
    }
    setShowManeuverPanel(false)
    setShowOriginalOrbit(true)
    setShowSimulatedOrbit(true)
  }, [])

  const handleClearSimulation = useCallback(() => {
    setSimulationResult(null)
    setSimulatedOrbitTrack(null)
  }, [])

  // Reset simulation when satellite selection changes
  const handleSelectSatelliteWithReset = useCallback((noradId: number) => {
    setSelectedNoradId((prev) => (prev === noradId ? null : noradId))
    setShowManeuverPanel(false)
    setSimulationResult(null)
    setSimulatedOrbitTrack(null)
  }, [])

  const [simulatedTime, setSimulatedTime] = useState(() => new Date())
  const [isPlaying, setIsPlaying] = useState(true)
  const [timeSpeed, setTimeSpeed] = useState<1 | 10 | 100 | 1000>(1)

  const simulatedTimeRef = useRef(simulatedTime)
  simulatedTimeRef.current = simulatedTime

  // Fast lookup map for satellite metadata
  const satelliteMap = useMemo(() => {
    const m = new Map<number, Satellite>()
    for (const s of satellites) m.set(s.noradId, s)
    return m
  }, [satellites])

  // noradIds of satellites involved in any active conjunction
  const conjunctionNoradIds = useMemo(() => {
    const ids = new Set<number>()
    for (const c of conjunctions) {
      ids.add(c.satelliteA.noradId)
      ids.add(c.satelliteB.noradId)
    }
    return ids
  }, [conjunctions])

  // Returns true if a satellite passes the active category + orbit filters.
  // Satellites with unknown orbit (no TLE) always pass the orbit filter.
  const passesFilter = useCallback(
    (s: Satellite): boolean => {
      if (categoryFilter !== 'all' && getCategory(s.name, s.objectType) !== categoryFilter) return false
      if (orbitFilter !== 'all') {
        const regime = getOrbitRegime(s.meanMotion)
        if (regime !== 'unknown' && regime !== orbitFilter) return false
      }
      return true
    },
    [categoryFilter, orbitFilter],
  )

  // Pre-filtered catalogue for the background slot
  const filteredCatalogue = useMemo(
    () => satellites.filter(passesFilter),
    [satellites, passesFilter],
  )

  // What gets propagated and rendered:
  // filtered background + filtered conjunction sats + selected + search matches
  const activeSatellites = useMemo(() => {
    const ids = new Set<number>()

    // Background: first N from filtered catalogue
    for (let i = 0; i < Math.min(backgroundCount, filteredCatalogue.length); i++) {
      ids.add(filteredCatalogue[i].noradId)
    }

    // Conjunction sats: apply same filter so toggling actually changes what you see
    for (const id of conjunctionNoradIds) {
      const sat = satelliteMap.get(id)
      if (!sat || passesFilter(sat)) ids.add(id)
    }

    // Selected always shows
    if (selectedNoradId !== null) ids.add(selectedNoradId)

    // Search: bypass filter (user explicitly searched)
    if (search.trim()) {
      const q = search.toLowerCase()
      let count = 0
      for (const s of satellites) {
        if (count >= MAX_SEARCH_ON_GLOBE) break
        if (s.name.toLowerCase().includes(q) || s.noradId.toString().includes(q)) {
          ids.add(s.noradId)
          count++
        }
      }
    }

    return satellites.filter((s) => ids.has(s.noradId))
  }, [filteredCatalogue, satellites, satelliteMap, conjunctionNoradIds, selectedNoradId, search, backgroundCount, passesFilter])

  // Satellites within CLUSTER_RADIUS_KM of the selected satellite (in ECI space)
  const nearbyNoradIds = useMemo(() => {
    if (selectedNoradId === null) return new Set<number>()
    const selPos = positions.get(selectedNoradId)
    if (!selPos) return new Set<number>()
    const ids = new Set<number>()
    positions.forEach((pos, noradId) => {
      if (noradId === selectedNoradId) return
      const dx = pos.position.x - selPos.position.x
      const dy = pos.position.y - selPos.position.y
      const dz = pos.position.z - selPos.position.z
      if (dx * dx + dy * dy + dz * dz < CLUSTER_RADIUS_KM * CLUSTER_RADIUS_KM) {
        ids.add(noradId)
      }
    })
    return ids
  }, [selectedNoradId, positions])

  // Conjunction events involving the selected satellite
  const selectedSatConjunctions = useMemo(
    () =>
      selectedNoradId === null
        ? []
        : conjunctions.filter(
            (c) =>
              c.satelliteA.noradId === selectedNoradId ||
              c.satelliteB.noradId === selectedNoradId,
          ),
    [conjunctions, selectedNoradId],
  )

  // Advance simulated time — low-priority so it doesn't block Cesium's rAF
  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(() => {
      startTransition(() => {
        setSimulatedTime((t) => new Date(t.getTime() + 1000 * timeSpeed))
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isPlaying, timeSpeed])

  // Load satellite catalogue — show first page immediately, stream the rest.
  // Retries with backoff to handle the API not being ready on first render.
  useEffect(() => {
    let cancelled = false

    async function fetchWithRetry(skip: number, take: number): Promise<SatelliteList> {
      let delay = 1500
      for (let attempt = 0; ; attempt++) {
        try {
          return (await api.satellites.list(skip, take)) as SatelliteList
        } catch (err) {
          if (cancelled) throw err
          if (attempt >= 8) throw err
          await new Promise((r) => setTimeout(r, delay))
          delay = Math.min(delay * 1.5, 6000)
        }
      }
    }

    async function loadAll() {
      const PAGE = 1000

      const first = await fetchWithRetry(0, PAGE)
      if (cancelled) return
      const total = first.pagination.total
      const all: Satellite[] = [...first.data]
      setSatellites([...all])

      const remainingPages = Math.ceil((total - first.data.length) / PAGE)
      if (remainingPages > 0) {
        const pages = await Promise.all(
          Array.from({ length: remainingPages }, (_, i) =>
            fetchWithRetry((i + 1) * PAGE, PAGE),
          ),
        )
        if (cancelled) return
        for (const page of pages) all.push(...page.data)
        setSatellites([...all])
      }

      if (!cancelled) setCatalogueLoaded(true)
    }

    loadAll().catch((err) => {
      if (!cancelled) {
        console.error('Failed to load satellite catalogue:', err)
        setCatalogueLoaded(true)
      }
    })
    return () => { cancelled = true }
  }, [])

  // Cull positions when active set shrinks
  useEffect(() => {
    const activeIds = new Set(activeSatellites.map((s) => s.noradId))
    startTransition(() => {
      setPositions((prev) => {
        const next = new Map<number, SatellitePosition>()
        prev.forEach((pos, id) => { if (activeIds.has(id)) next.set(id, pos) })
        return next
      })
    })
  }, [activeSatellites])

  // Poll positions — only for the active (small) set
  useEffect(() => {
    const noradIds = activeSatellites.map((s) => s.noradId)
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
          startTransition(() => {
            setPositions(new Map(results.map((p) => [p.noradId, p])))
          })
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
  }, [activeSatellites])

  // Fetch orbit track for selected satellite
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

  // Place approach markers at predicted closest-approach positions
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
    return () => { cancelled = true }
  }, [conjunctions])

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

  const handleIngest = useCallback(async () => {
    setIsIngesting(true)
    try {
      await api.ingest.celestrak('active')
      // Reload catalogue after ingest
      const first = (await api.satellites.list(0, 1000)) as SatelliteList
      setSatellites(first.data)
    } catch (err) {
      console.error('Ingest failed:', err)
    } finally {
      setIsIngesting(false)
    }
  }, [])

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

  // handleSelectSatelliteWithReset defined above; keep a plain alias for panels that don't need reset
  const handleSelectSatellite = handleSelectSatelliteWithReset

  const handleSelectConjunction = useCallback((id: string) => {
    setSelectedConjunctionId((prev) => (prev === id ? null : id))
  }, [])

  const handleTimeShift = useCallback((deltaMs: number) => {
    setSimulatedTime((t) => new Date(t.getTime() + deltaMs))
  }, [])

  const selectedSat = satellites.find((s) => s.noradId === selectedNoradId) ?? null
  const selectedPos = selectedNoradId !== null ? positions.get(selectedNoradId) ?? null : null
  const selectedLatLon = selectedPos
    ? eciToLatLon(selectedPos.position, new Date(selectedPos.timestamp))
    : null

  return (
    <div className="absolute inset-0 bg-black">
      <CesiumContainer
        satellites={activeSatellites}
        positions={positions}
        orbitPoints={orbitTrack}
        simulatedOrbitPoints={simulatedOrbitTrack}
        showOriginalOrbit={showOriginalOrbit}
        showSimulatedOrbit={showSimulatedOrbit}
        selectedNoradId={selectedNoradId}
        nearbyNoradIds={nearbyNoradIds}
        conjunctions={conjunctionVisuals}
        severityBySat={severityBySat}
        selectedConjunctionId={selectedConjunctionId}
        resolutionScale={resolutionScale}
        onSelectSatellite={handleSelectSatellite}
        onSelectConjunction={handleSelectConjunction}
        onReady={(controls) => { resetViewRef.current = controls.resetView }}
      />

      {/* Satellite list — top-left: shows filtered catalogue */}
      <div className="absolute top-3 left-3 z-10 w-64 max-h-[60vh] flex flex-col">
        <SatelliteListPanel
          satellites={filteredCatalogue}
          positions={positions}
          selectedNoradId={selectedNoradId}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelectSatellite}
        />
      </div>

      {/* Selected satellite info + maneuver button */}
      {selectedSat && (
        <div className="absolute bottom-16 left-3 z-10 w-64 flex flex-col gap-2">
          <SatelliteInfoPanel
            satellite={selectedSat}
            position={selectedPos}
            altitudeKm={selectedPos ? altitudeKm(selectedPos.position) : null}
            speedKms={selectedPos ? speedKms(selectedPos.velocity) : null}
            conjunctions={selectedSatConjunctions}
            lat={selectedLatLon?.lat ?? null}
            lon={selectedLatLon?.lon ?? null}
          />
          {!showManeuverPanel && !simulationResult && (
            <button
              onClick={() => setShowManeuverPanel(true)}
              className="w-full bg-slate-900/80 border border-cyan-700 hover:border-cyan-400 text-cyan-400 hover:text-cyan-200 rounded-lg py-1.5 text-xs font-medium transition-colors"
            >
              Simulate Maneuver
            </button>
          )}
        </div>
      )}

      {/* Maneuver input panel */}
      {showManeuverPanel && selectedSat && (
        <div className="absolute bottom-16 left-3 z-20">
          <ManeuverPanel
            satelliteId={selectedSat.id}
            satelliteName={selectedSat.name}
            onSimulationComplete={handleSimulationComplete}
            onClose={() => setShowManeuverPanel(false)}
          />
        </div>
      )}

      {/* Simulation results panel */}
      {simulationResult?.result && (
        <div className="absolute bottom-16 left-3 z-20">
          <SimulationResults
            simulation={simulationResult}
            onClose={handleClearSimulation}
          />
        </div>
      )}

      {/* Orbit comparison legend — shown when simulated orbit is loaded */}
      {simulatedOrbitTrack && (
        <div className="absolute bottom-3 right-3 z-10">
          <OrbitComparison
            showOriginal={showOriginalOrbit}
            showSimulated={showSimulatedOrbit}
            onToggleOriginal={() => setShowOriginalOrbit((v) => !v)}
            onToggleSimulated={() => setShowSimulatedOrbit((v) => !v)}
            onClear={handleClearSimulation}
          />
        </div>
      )}

      {/* Time controls — bottom center */}
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

      {/* Camera controls — bottom right */}
      <div className="absolute bottom-16 right-3 z-10 flex flex-col gap-1.5">
        <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-2 py-1.5 flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 text-center">Resolution</span>
          <div className="flex gap-1">
            {([0.25, 0.5, 0.75, 1.0] as const).map((scale) => (
              <button
                key={scale}
                onClick={() => setResolutionScale(scale)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  resolutionScale === scale
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={`Render at ${scale * 100}% resolution`}
              >
                {scale === 1.0 ? '1x' : `${scale * 100 | 0}%`}
              </button>
            ))}
            <button
              onClick={() => setResolutionScale(window.devicePixelRatio)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                resolutionScale === window.devicePixelRatio
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Full device pixel ratio (sharpest)"
            >
              HiDPI
            </button>
          </div>
        </div>
        <button
          onClick={() => resetViewRef.current?.()}
          className="bg-slate-900/80 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white rounded-lg px-3 py-1.5 text-xs transition-colors"
          title="Reset camera"
        >
          ⊕ Reset View
        </button>
      </div>

      {/* Status + render count picker + filters */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900/80 border border-slate-700 rounded-full px-3 py-1 text-xs text-slate-400 whitespace-nowrap">
            {activeSatellites.length > 0 && catalogueLoaded ? (
              <span>
                <span className="text-cyan-400 font-medium">{activeSatellites.length.toLocaleString()}</span> tracking
                {positions.size > 0 && positions.size < activeSatellites.length && (
                  <span className="text-slate-500 ml-1">· {positions.size} live</span>
                )}
                {conjunctionNoradIds.size > 0 && (
                  <span className="text-amber-400 ml-2">· {conjunctionNoradIds.size} at risk</span>
                )}
              </span>
            ) : catalogueLoaded ? (
              <span className="text-slate-500">
                {satellites.length === 0 ? (
                  <button
                    onClick={handleIngest}
                    disabled={isIngesting}
                    className="text-cyan-400 hover:text-cyan-200 disabled:text-slate-500 transition-colors"
                  >
                    {isIngesting ? 'Ingesting satellites…' : '↓ Ingest satellites from CelesTrak'}
                  </button>
                ) : (
                  `${satellites.length.toLocaleString()} loaded — select a render count`
                )}
              </span>
            ) : (
              <span className="text-slate-500">Loading catalogue ({satellites.length.toLocaleString()} loaded)…</span>
            )}
          </div>
          <div className="bg-slate-900/80 border border-slate-700 rounded-full flex items-center gap-1 px-2 py-1">
            <span className="text-[10px] text-slate-500 mr-1">Render</span>
            {RENDER_PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => setBackgroundCount(n)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${backgroundCount === n ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {n >= 1000 ? `${n / 1000}k` : String(n)}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={satellites.length || 15000}
              value={backgroundCount}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v > 0) setBackgroundCount(v)
              }}
              className="w-14 bg-slate-800 border border-slate-600 rounded-full px-2 py-0.5 text-[10px] text-white text-center focus:outline-none focus:border-cyan-500 ml-1"
            />
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-slate-900/80 border border-slate-700 rounded-full flex items-center gap-0.5 px-2 py-1">
          <span className="text-[10px] text-slate-500 mr-1">Type</span>
          {([
            ['all', 'All'],
            ['starlink', 'Starlink'],
            ['stations', 'Stations'],
            ['debris', 'Debris'],
            ['rocket', 'Rocket Body'],
            ['other', 'Other'],
          ] as [CategoryFilter, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setCategoryFilter(val)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${categoryFilter === val ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
          <span className="text-[10px] text-slate-600 mx-1">|</span>
          <span className="text-[10px] text-slate-500 mr-1">Orbit</span>
          {([
            ['all', 'All'],
            ['leo', 'LEO'],
            ['meo', 'MEO'],
            ['geo', 'GEO'],
            ['heo', 'HEO'],
          ] as [OrbitFilter, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setOrbitFilter(val)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${orbitFilter === val ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Collision panel — top-right */}
      <div className="absolute top-3 right-3 z-10">
        <CollisionPanel
          conjunctions={conjunctions}
          selectedId={selectedConjunctionId}
          isScanning={isScanning}
          onSelect={handleSelectConjunction}
          onScan={handleScan}
        />
      </div>
    </div>
  )
}
