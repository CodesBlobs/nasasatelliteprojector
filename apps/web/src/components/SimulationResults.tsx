'use client'

import type { SimulationWithResult, ConjunctionImpact } from '@orbital/shared'
import { FUEL_MODEL_DISCLAIMER } from './simulation-constants'

interface Props {
  simulation: SimulationWithResult
  onClose: () => void
}

function RiskBar({ score, label }: { score: number; label: string }) {
  const color =
    score >= 60 ? 'bg-red-500' : score >= 30 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-slate-400 text-[10px]">{label}</span>
        <span className="text-white text-[10px] font-mono">{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function ImpactRow({ impact }: { impact: ConjunctionImpact }) {
  const statusColor: Record<string, string> = {
    REMOVED: 'text-green-400',
    REDUCED: 'text-cyan-400',
    CREATED: 'text-red-400',
    WORSENED: 'text-amber-400',
    UNCHANGED: 'text-slate-500',
  }
  const color = statusColor[impact.status] ?? 'text-slate-400'

  const before = impact.beforeApproachKm != null ? `${impact.beforeApproachKm.toFixed(2)} km` : '—'
  const after = impact.afterApproachKm != null ? `${impact.afterApproachKm.toFixed(2)} km` : '—'

  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-800 last:border-0">
      <div className="flex-1 min-w-0 pr-2">
        <div className="text-white text-[10px] truncate">{impact.satelliteName}</div>
        <div className="text-slate-500 text-[10px]">
          {before} → {after}
        </div>
      </div>
      <span className={`text-[10px] font-medium shrink-0 ${color}`}>{impact.status}</span>
    </div>
  )
}

export default function SimulationResults({ simulation, onClose }: Props) {
  const r = simulation.result
  if (!r) return null

  const improvement =
    r.closestApproachAfter > r.closestApproachBefore
      ? r.closestApproachAfter - r.closestApproachBefore
      : 0

  const dvMag = r.deltaVMagnitudeMs

  const notableImpacts = r.conjunctionImpacts.filter(
    (c: ConjunctionImpact) => c.status !== 'UNCHANGED',
  )

  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-4 w-72 text-xs max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-slate-400 text-[10px] uppercase tracking-wider">Simulation Results</div>
          <div className="text-white font-medium">Maneuver Analysis</div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-base leading-none">×</button>
      </div>

      {/* Risk comparison */}
      <div className="space-y-2 mb-4">
        <div className="text-slate-400 text-[10px] uppercase tracking-wider">Risk Score</div>
        <RiskBar score={r.oldRiskScore} label="Before" />
        <RiskBar score={r.newRiskScore} label="After" />
        {r.riskReductionPercent > 0 && (
          <div className="text-green-400 text-[10px] text-right">
            −{r.riskReductionPercent.toFixed(1)}% risk
          </div>
        )}
        {r.riskReductionPercent < 0 && (
          <div className="text-red-400 text-[10px] text-right">
            +{Math.abs(r.riskReductionPercent).toFixed(1)}% risk increase
          </div>
        )}
      </div>

      {/* Closest approach comparison */}
      <div className="bg-slate-800/60 rounded-lg p-3 mb-4 space-y-1">
        <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Closest Approach</div>
        <div className="flex justify-between">
          <span className="text-slate-400">Before</span>
          <span className="text-amber-400 font-mono">{r.closestApproachBefore.toFixed(2)} km</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">After</span>
          <span className={r.closestApproachAfter >= r.closestApproachBefore ? 'text-green-400' : 'text-red-400'} >
            {r.closestApproachAfter.toFixed(2)} km
          </span>
        </div>
        {improvement > 0 && (
          <div className="flex justify-between pt-1 border-t border-slate-700">
            <span className="text-slate-400">Improvement</span>
            <span className="text-green-400 font-mono">+{improvement.toFixed(2)} km</span>
          </div>
        )}
      </div>

      {/* Conjunction changes */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-slate-800/60 rounded-lg p-2 text-center">
          <div className="text-green-400 text-lg font-bold">{r.conjunctionsRemoved}</div>
          <div className="text-slate-400 text-[10px]">Removed</div>
        </div>
        <div className="flex-1 bg-slate-800/60 rounded-lg p-2 text-center">
          <div className="text-red-400 text-lg font-bold">{r.conjunctionsCreated}</div>
          <div className="text-slate-400 text-[10px]">Created</div>
        </div>
      </div>

      {/* Fuel estimate */}
      <div className="bg-slate-800/60 rounded-lg p-3 mb-4">
        <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Fuel Estimate</div>
        <div className="flex justify-between mb-1">
          <span className="text-slate-400">|ΔV|</span>
          <span className="text-cyan-400 font-mono">{dvMag.toFixed(2)} m/s</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Propellant</span>
          <span className="text-white font-mono">{r.fuelEstimateKg.toFixed(3)} kg</span>
        </div>
        <div className="text-slate-600 text-[10px] mt-2 leading-tight">{FUEL_MODEL_DISCLAIMER}</div>
      </div>

      {/* Per-conjunction breakdown */}
      {notableImpacts.length > 0 && (
        <div>
          <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">
            Conjunction Changes ({notableImpacts.length})
          </div>
          <div>
            {notableImpacts.map((impact: ConjunctionImpact) => (
              <ImpactRow key={impact.satelliteId} impact={impact} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
