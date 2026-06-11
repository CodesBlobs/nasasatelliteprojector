'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Alert } from '@/types/alert'
import { AlertList } from './AlertList'
import { AlertDetails } from './AlertDetails'
import { AlertBadge } from './AlertBadge'

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/${path}`, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export function AlertPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [liveIndicator, setLiveIndicator] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const loadAlerts = useCallback(async () => {
    try {
      const data = await apiFetch('alerts')
      setAlerts(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  useEffect(() => {
    const es = new EventSource('/api/events/stream')
    eventSourceRef.current = es

    es.addEventListener('alert:created', () => {
      setLiveIndicator(true)
      loadAlerts()
      setTimeout(() => setLiveIndicator(false), 2000)
    })

    es.addEventListener('conjunction:scan:complete', () => {
      loadAlerts()
    })

    return () => {
      es.close()
    }
  }, [loadAlerts])

  const handleAcknowledge = async (id: string) => {
    await apiFetch(`alerts/${id}/acknowledge`, { method: 'PATCH' })
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: 'ACKNOWLEDGED', acknowledgedAt: new Date().toISOString() } : a))
  }

  const handleResolve = async (id: string) => {
    await apiFetch(`alerts/${id}/resolve`, { method: 'PATCH' })
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: 'RESOLVED', resolvedAt: new Date().toISOString() } : a))
  }

  const handleDismiss = async (id: string) => {
    await apiFetch(`alerts/${id}/dismiss`, { method: 'PATCH' })
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: 'DISMISSED' } : a))
  }

  const selectedAlert = alerts.find((a) => a.id === selectedId) ?? null
  const openCount = alerts.filter((a) => a.status === 'OPEN').length
  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL' && a.status === 'OPEN').length

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white">Alerts</h1>
          {openCount > 0 && <AlertBadge severity="HIGH" count={openCount} />}
          {criticalCount > 0 && <AlertBadge severity="CRITICAL" count={criticalCount} />}
        </div>
        <div className="flex items-center gap-2">
          {liveIndicator && (
            <span className="text-[9px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              Live
            </span>
          )}
          <button onClick={loadAlerts}
            className="text-[10px] text-slate-400 hover:text-white transition-colors px-2 py-0.5 rounded border border-slate-700 hover:border-slate-500">
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 text-sm">Loading alerts…</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-2">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={loadAlerts} className="text-xs text-slate-400 hover:text-white underline">Retry</button>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* List pane */}
          <div className="w-72 border-r border-slate-800 flex flex-col min-h-0 flex-shrink-0">
            <AlertList alerts={alerts} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          {/* Detail pane */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {selectedAlert ? (
              <AlertDetails
                alert={selectedAlert}
                onAcknowledge={handleAcknowledge}
                onResolve={handleResolve}
                onDismiss={handleDismiss}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-500 text-sm">Select an alert to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
