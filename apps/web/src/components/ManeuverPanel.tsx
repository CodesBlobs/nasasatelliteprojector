'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import type { SimulationRecord, SimulationWithResult } from '@orbital/shared'
import { SimulationStatus } from '@orbital/shared'

interface Props {
  satelliteId: string
  satelliteName: string
  onSimulationComplete: (result: SimulationWithResult) => void
  onClose: () => void
}

const POLL_INTERVAL_MS = 2000
const MAX_POLLS = 90 // 3 minutes

export default function ManeuverPanel({ satelliteId, satelliteName, onSimulationComplete, onClose }: Props) {
  const [dvX, setDvX] = useState('0')
  const [dvY, setDvY] = useState('0')
  const [dvZ, setDvZ] = useState('0')
  const [windowHours, setWindowHours] = useState('24')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'polling' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [simulationId, setSimulationId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCount = useRef(0)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  const startPolling = useCallback((id: string) => {
    pollCount.current = 0
    pollRef.current = setInterval(async () => {
      pollCount.current++
      try {
        const result = (await api.simulation.results(id)) as SimulationWithResult
        if (result.status === SimulationStatus.COMPLETED) {
          stopPolling()
          setStatus('done')
          onSimulationComplete(result)
        } else if (result.status === SimulationStatus.FAILED) {
          stopPolling()
          setStatus('error')
          setErrorMsg(result.errorMessage ?? 'Simulation failed')
        } else if (pollCount.current >= MAX_POLLS) {
          stopPolling()
          setStatus('error')
          setErrorMsg('Simulation timed out')
        }
      } catch {
        // Network error during poll — keep trying
      }
    }, POLL_INTERVAL_MS)
  }, [stopPolling, onSimulationComplete])

  const handleSubmit = useCallback(async () => {
    const x = parseFloat(dvX)
    const y = parseFloat(dvY)
    const z = parseFloat(dvZ)
    const wh = parseInt(windowHours, 10)

    if ([x, y, z].some(isNaN) || isNaN(wh)) {
      setErrorMsg('Enter valid numeric values')
      return
    }

    if (x === 0 && y === 0 && z === 0) {
      setErrorMsg('Delta-V cannot be zero')
      return
    }

    setErrorMsg(null)
    setStatus('submitting')
    try {
      const sim = (await api.simulation.create({
        satelliteId,
        deltaV: { x, y, z },
        windowHours: wh,
      })) as SimulationRecord

      setSimulationId(sim.id)
      setStatus('polling')
      startPolling(sim.id)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start simulation')
    }
  }, [dvX, dvY, dvZ, windowHours, satelliteId, startPolling])

  const handleReset = useCallback(() => {
    stopPolling()
    setStatus('idle')
    setErrorMsg(null)
    setSimulationId(null)
    pollCount.current = 0
  }, [stopPolling])

  const dvMagnitude = Math.sqrt(
    Math.pow(parseFloat(dvX) || 0, 2) +
    Math.pow(parseFloat(dvY) || 0, 2) +
    Math.pow(parseFloat(dvZ) || 0, 2),
  )

  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-4 w-72 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-slate-400 text-[10px] uppercase tracking-wider">Maneuver Simulation</div>
          <div className="text-white font-medium truncate max-w-[190px]">{satelliteName}</div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-white transition-colors text-base leading-none"
        >
          ×
        </button>
      </div>

      {status === 'idle' || status === 'error' ? (
        <>
          {/* Delta-V inputs */}
          <div className="space-y-2 mb-3">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Delta-V (m/s · ECI frame)</div>
            {[
              { label: 'ΔVx', value: dvX, set: setDvX },
              { label: 'ΔVy', value: dvY, set: setDvY },
              { label: 'ΔVz', value: dvZ, set: setDvZ },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-slate-400 w-8">{label}</span>
                <input
                  type="number"
                  step="0.1"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
                <span className="text-slate-500 text-[10px]">m/s</span>
              </div>
            ))}
          </div>

          {/* Magnitude display */}
          {dvMagnitude > 0 && (
            <div className="mb-2 text-[10px] text-slate-400">
              |ΔV| = <span className="text-cyan-400">{dvMagnitude.toFixed(2)} m/s</span>
            </div>
          )}

          {/* Window */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-slate-400 text-[10px] w-20">Window (h)</span>
            <input
              type="number"
              min={1}
              max={72}
              value={windowHours}
              onChange={(e) => setWindowHours(e.target.value)}
              className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          {errorMsg && (
            <div className="text-red-400 text-[10px] mb-2">{errorMsg}</div>
          )}

          <button
            onClick={handleSubmit}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg py-1.5 font-medium transition-colors"
          >
            Run Simulation
          </button>
        </>
      ) : status === 'submitting' ? (
        <div className="text-center py-4 text-slate-400">
          <div className="text-sm mb-1">Submitting...</div>
        </div>
      ) : status === 'polling' ? (
        <div className="text-center py-4">
          <div className="text-cyan-400 text-sm mb-1 animate-pulse">Running simulation...</div>
          <div className="text-slate-500 text-[10px]">
            Propagating orbits and scanning for conjunctions
          </div>
          {simulationId && (
            <div className="text-slate-600 text-[10px] mt-1 font-mono truncate">{simulationId}</div>
          )}
        </div>
      ) : (
        /* done */
        <div className="text-center py-3">
          <div className="text-green-400 text-sm mb-1">Simulation complete</div>
          <button
            onClick={handleReset}
            className="text-slate-400 hover:text-white text-[10px] underline transition-colors"
          >
            Run another
          </button>
        </div>
      )}
    </div>
  )
}
