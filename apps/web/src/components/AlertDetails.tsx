'use client'

import type { Alert } from '@/types/alert'
import { AlertBadge } from './AlertBadge'

interface Props {
  alert: Alert
  onAcknowledge: (id: string) => void
  onResolve: (id: string) => void
  onDismiss: (id: string) => void
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-xs text-slate-200 text-right font-mono">{value}</span>
    </div>
  )
}

export function AlertDetails({ alert, onAcknowledge, onResolve, onDismiss }: Props) {
  const { conjunction: c } = alert
  const km = c.closestApproachKm
  const missText = km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(3)} km`
  const canAck = alert.status === 'OPEN'
  const canResolve = alert.status === 'OPEN' || alert.status === 'ACKNOWLEDGED'
  const canDismiss = alert.status !== 'DISMISSED'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <AlertBadge severity={alert.severity} size="md" />
          <span className={`text-[9px] rounded px-1.5 py-0.5 ${alert.status === 'OPEN' ? 'bg-slate-700 text-slate-300' : 'bg-slate-800 text-slate-500'}`}>
            {alert.status}
          </span>
        </div>
        <h3 className="text-sm text-white font-semibold leading-snug mb-1">{alert.title}</h3>
        <p className="text-[11px] text-slate-400 leading-relaxed">{alert.description}</p>
      </div>

      <div className="p-4 border-b border-slate-800 flex-shrink-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Conjunction</p>
        <Row label="Miss distance" value={missText} />
        <Row label="Rel. velocity" value={`${c.relativeVelocityKmS.toFixed(2)} km/s`} />
        <Row label="Risk level" value={c.riskLevel} />
        <Row label="Predicted time" value={fmt(c.predictedTime)} />
      </div>

      <div className="p-4 border-b border-slate-800 flex-shrink-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Object A</p>
        <Row label="Name" value={c.satelliteA.name} />
        <Row label="NORAD ID" value={String(c.satelliteA.noradId)} />
        <Row label="Type" value={c.satelliteA.objectType} />
      </div>

      <div className="p-4 border-b border-slate-800 flex-shrink-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Object B</p>
        <Row label="Name" value={c.satelliteB.name} />
        <Row label="NORAD ID" value={String(c.satelliteB.noradId)} />
        <Row label="Type" value={c.satelliteB.objectType} />
      </div>

      <div className="p-4 border-b border-slate-800 flex-shrink-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Timeline</p>
        <Row label="Detected" value={fmt(alert.createdAt)} />
        {alert.acknowledgedAt && <Row label="Acknowledged" value={fmt(alert.acknowledgedAt)} />}
        {alert.resolvedAt && <Row label="Resolved" value={fmt(alert.resolvedAt)} />}
      </div>

      <div className="p-4 flex gap-2 flex-shrink-0">
        {canAck && (
          <button onClick={() => onAcknowledge(alert.id)}
            className="flex-1 text-xs py-1.5 rounded bg-cyan-800 hover:bg-cyan-700 text-white transition-colors">
            Acknowledge
          </button>
        )}
        {canResolve && (
          <button onClick={() => onResolve(alert.id)}
            className="flex-1 text-xs py-1.5 rounded bg-green-800 hover:bg-green-700 text-white transition-colors">
            Resolve
          </button>
        )}
        {canDismiss && (
          <button onClick={() => onDismiss(alert.id)}
            className="flex-1 text-xs py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors">
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
