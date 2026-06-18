'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { SEVERITY_COLORS, formatCountdown, type Severity } from '@/lib/severity'

interface ConjSat {
  id: string
  noradId: number
  name: string
  objectType: string
}

interface Conjunction {
  id: string
  closestApproachKm: number
  relativeVelocityKmS: number
  predictedTime: string
  riskScore: number
  riskLevel: Severity
  status: string
  satelliteA: ConjSat
  satelliteB: ConjSat
}

interface SatPos {
  noradId: number
  position: { x: number; y: number; z: number }
  velocity: { x: number; y: number; z: number }
  timestamp: string
}

type SortKey = 'time' | 'risk' | 'miss'

function altKm(p: { x: number; y: number; z: number }) {
  return Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2) - 6371
}

function speedKms(v: { x: number; y: number; z: number }) {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2)
}

function separationKm(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function formatKm(km: number) {
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(2)} km`
}

function formatUtc(iso: string) {
  return new Date(iso).toUTCString().slice(0, 25)
}

export default function CollisionsPage() {
  const [conjunctions, setConjunctions] = useState<Conjunction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [livePositions, setLivePositions] = useState<Map<number, SatPos>>(new Map())
  const [approachPositions, setApproachPositions] = useState<Map<number, SatPos>>(new Map())
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [sortKey, setSortKey] = useState<SortKey>('risk')
  const [filterRisk, setFilterRisk] = useState<Severity | 'ALL'>('ALL')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])

  const fetchConjunctions = useCallback(async () => {
    try {
      const res = (await api.conjunctions.list(0, 200)) as { data: Conjunction[] }
      setConjunctions(res.data)
    } catch (err) {
      console.error('Failed to load conjunctions:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConjunctions()
    const id = setInterval(fetchConjunctions, 30_000)
    return () => clearInterval(id)
  }, [fetchConjunctions])

  const selected = conjunctions.find((c) => c.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) return
    setLoadingDetail(true)
    const noradIds = [selected.satelliteA.noradId, selected.satelliteB.noradId]
    const predictedAt = new Date(selected.predictedTime)

    Promise.all([
      api.propagation.getPositions(noradIds) as Promise<SatPos[]>,
      api.propagation.getPositions(noradIds, predictedAt) as Promise<SatPos[]>,
    ])
      .then(([live, approach]) => {
        setLivePositions(new Map(live.map((p) => [p.noradId, p])))
        setApproachPositions(new Map(approach.map((p) => [p.noradId, p])))
      })
      .catch(console.error)
      .finally(() => setLoadingDetail(false))
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const RISK_ORDER: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }

  const sorted = [...conjunctions]
    .filter((c) => filterRisk === 'ALL' || c.riskLevel === filterRisk)
    .sort((a, b) => {
      if (sortKey === 'risk') return RISK_ORDER[b.riskLevel] - RISK_ORDER[a.riskLevel]
      if (sortKey === 'time') return new Date(a.predictedTime).getTime() - new Date(b.predictedTime).getTime()
      return a.closestApproachKm - b.closestApproachKm
    })

  return (
    <div className="flex h-full overflow-hidden bg-slate-950 text-white">
      {/* Left: list */}
      <div className="w-96 flex-shrink-0 flex flex-col border-r border-slate-800">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
          <h1 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Conjunctions
            <span className="ml-2 text-slate-500 normal-case tracking-normal font-normal">
              {conjunctions.length}
            </span>
          </h1>
          <button
            onClick={fetchConjunctions}
            className="text-[10px] px-2 py-0.5 rounded border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Sort + filter */}
        <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-500">Sort</span>
          {(['risk', 'time', 'miss'] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${sortKey === k ? 'bg-cyan-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {k === 'risk' ? 'Risk' : k === 'time' ? 'Time' : 'Miss Dist'}
            </button>
          ))}
          <span className="text-[10px] text-slate-600">|</span>
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as (Severity | 'ALL')[]).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRisk(r)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${filterRisk === r ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-slate-500 text-sm px-4 py-6">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-slate-500 text-sm px-4 py-6">No conjunction events found.</p>
          ) : (
            sorted.map((c) => {
              const color = SEVERITY_COLORS[c.riskLevel]
              const isSelected = c.id === selectedId
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId((prev) => (prev === c.id ? null : c.id))}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800/60 transition-colors ${isSelected ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color, border: `1px solid ${color}`, background: `${color}1a` }}
                    >
                      {c.riskLevel}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatCountdown(new Date(c.predictedTime), now)}
                    </span>
                  </div>
                  <p className="text-xs text-white font-medium truncate">
                    {c.satelliteA.name}
                    <span className="text-slate-500 mx-1">×</span>
                    {c.satelliteB.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-slate-400 font-mono">miss {formatKm(c.closestApproachKm)}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{c.relativeVelocityKmS.toFixed(2)} km/s rel.</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right: detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-600 text-sm">Select a conjunction to see details</p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <RiskBadge level={selected.riskLevel} />
                <span className="text-xs text-slate-400 font-mono">Score {selected.riskScore.toFixed(1)}</span>
                <span className="text-xs text-slate-500">{selected.status}</span>
              </div>
              <h2 className="text-base font-semibold text-white">
                {selected.satelliteA.name}
                <span className="text-slate-500 mx-2">×</span>
                {selected.satelliteB.name}
              </h2>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
              <InfoBox label="Miss Distance" value={formatKm(selected.closestApproachKm)} highlight />
              <InfoBox label="Relative Velocity" value={`${selected.relativeVelocityKmS.toFixed(3)} km/s`} />
              <InfoBox label="Closest Approach (UTC)" value={formatUtc(selected.predictedTime)} />
            </div>

            {loadingDetail ? (
              <p className="text-slate-500 text-sm">Loading positions…</p>
            ) : (
              <>
                {/* Current separation */}
                {livePositions.has(selected.satelliteA.noradId) && livePositions.has(selected.satelliteB.noradId) && (() => {
                  const posA = livePositions.get(selected.satelliteA.noradId)!
                  const posB = livePositions.get(selected.satelliteB.noradId)!
                  const sep = separationKm(posA.position, posB.position)
                  return (
                    <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Current separation</span>
                      <span className="text-sm font-mono text-cyan-300 font-semibold">{formatKm(sep)}</span>
                    </div>
                  )
                })()}

                {/* At closest approach */}
                {approachPositions.size > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">At Closest Approach</p>
                    <div className="grid grid-cols-2 gap-4">
                      <SatDetail
                        label="Satellite A"
                        sat={selected.satelliteA}
                        pos={approachPositions.get(selected.satelliteA.noradId)}
                      />
                      <SatDetail
                        label="Satellite B"
                        sat={selected.satelliteB}
                        pos={approachPositions.get(selected.satelliteB.noradId)}
                      />
                    </div>
                  </div>
                )}

                {/* Live positions */}
                {livePositions.size > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Current Position</p>
                    <div className="grid grid-cols-2 gap-4">
                      <SatDetail
                        label="Satellite A"
                        sat={selected.satelliteA}
                        pos={livePositions.get(selected.satelliteA.noradId)}
                      />
                      <SatDetail
                        label="Satellite B"
                        sat={selected.satelliteB}
                        pos={livePositions.get(selected.satelliteB.noradId)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function RiskBadge({ level }: { level: Severity }) {
  const color = SEVERITY_COLORS[level]
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
      style={{ color, border: `1px solid ${color}`, background: `${color}1a` }}
    >
      {level}
    </span>
  )
}

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-mono ${highlight ? 'text-amber-300 font-semibold' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function SatDetail({ label, sat, pos }: { label: string; sat: ConjSat; pos: SatPos | undefined }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
      <div>
        <p className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xs font-semibold text-cyan-300 mt-0.5 truncate">{sat.name}</p>
        <p className="text-[10px] text-slate-500 font-mono">NORAD {sat.noradId}</p>
      </div>
      {pos ? (
        <div className="grid grid-cols-2 gap-1.5">
          <MiniStat label="Altitude" value={`${altKm(pos.position).toFixed(0)} km`} />
          <MiniStat label="Speed" value={`${speedKms(pos.velocity).toFixed(2)} km/s`} />
          <MiniStat label="X (ECI)" value={`${pos.position.x.toFixed(0)} km`} />
          <MiniStat label="Y (ECI)" value={`${pos.position.y.toFixed(0)} km`} />
          <MiniStat label="Z (ECI)" value={`${pos.position.z.toFixed(0)} km`} />
          <MiniStat label="Type" value={sat.objectType} />
        </div>
      ) : (
        <p className="text-[10px] text-slate-600">No position data</p>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/50 rounded px-2 py-1">
      <p className="text-[8px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-[10px] text-slate-200 font-mono mt-0.5 truncate">{value}</p>
    </div>
  )
}
