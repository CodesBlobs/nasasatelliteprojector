'use client'

import { useMemo, useState } from 'react'
import type { Alert } from '@/types/alert'
import { AlertBadge } from './AlertBadge'

interface Props {
  alerts: Alert[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4,
}

type SortKey = 'severity' | 'time' | 'miss'
type SeverityFilter = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
type StatusFilter = 'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'

export function AlertList({ alerts, selectedId, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('severity')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN')

  const filtered = useMemo(() => {
    return [...alerts]
      .filter((a) => severityFilter === 'ALL' || a.severity === severityFilter)
      .filter((a) => statusFilter === 'ALL' || a.status === statusFilter)
      .sort((a, b) => {
        if (sortKey === 'severity')
          return (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
        if (sortKey === 'time')
          return new Date(a.conjunction.predictedTime).getTime() - new Date(b.conjunction.predictedTime).getTime()
        return a.conjunction.closestApproachKm - b.conjunction.closestApproachKm
      })
  }, [alerts, sortKey, severityFilter, statusFilter])

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="px-4 py-2 border-b border-slate-800 space-y-1.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-500">Sort</span>
          {(['severity', 'time', 'miss'] as SortKey[]).map((k) => (
            <button key={k} onClick={() => setSortKey(k)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${sortKey === k ? 'bg-cyan-700 text-white' : 'text-slate-400 hover:text-white'}`}>
              {k === 'severity' ? 'Risk' : k === 'time' ? 'Time' : 'Distance'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-500">Status</span>
          {(['ALL', 'OPEN', 'ACKNOWLEDGED'] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${statusFilter === s ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-500">Severity</span>
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as SeverityFilter[]).map((s) => (
            <button key={s} onClick={() => setSeverityFilter(s)}
              className={`text-[10px] px-2 py-0.5 rounded transition-colors ${severityFilter === s ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">No alerts match the current filters.</p>
        )}
        {filtered.map((alert) => {
          const isSelected = alert.id === selectedId
          const km = alert.conjunction.closestApproachKm
          const missText = km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(2)} km`
          return (
            <button
              key={alert.id}
              onClick={() => onSelect(alert.id)}
              className={`w-full text-left px-4 py-3 border-b border-slate-800/60 transition-colors ${isSelected ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <AlertBadge severity={alert.severity} />
                <span className={`text-[9px] rounded px-1.5 py-0.5 ${alert.status === 'OPEN' ? 'bg-slate-700 text-slate-300' : 'bg-slate-800 text-slate-500'}`}>
                  {alert.status}
                </span>
              </div>
              <p className="text-xs text-white font-medium leading-tight truncate">{alert.title}</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">miss {missText}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
