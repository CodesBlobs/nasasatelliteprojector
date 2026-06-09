'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

interface Stats {
  total: number
  byType: Record<string, number>
  lastIngestAt: string | null
}

interface Health {
  status: string
  database: string
  timestamp: string
}

interface IngestResult {
  group: string
  total: number
  satellitesCreated: number
  tlesInserted: number
  errors: number
  durationMs: number
}

const GROUPS = [
  { id: 'stations', label: 'Space Stations (~3)' },
  { id: 'active', label: 'All Active (~9,000)' },
  { id: 'last-30-days', label: 'Last 30 Days' },
  { id: 'starlink', label: 'Starlink (~8,300)' },
  { id: 'visual', label: 'Visually Tracked' },
  { id: 'fengyun-1c-debris', label: 'Fengyun-1C Debris (~3,500)' },
  { id: 'iridium-33-debris', label: 'Iridium-33 Debris' },
  { id: 'cosmos-2251-debris', label: 'Cosmos-2251 Debris' },
]

export default function DashboardPage() {
  const [health, setHealth] = useState<Health | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [selectedGroup, setSelectedGroup] = useState('stations')
  const [ingesting, setIngesting] = useState(false)
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null)
  const [ingestError, setIngestError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [healthData, statsData] = await Promise.all([
        api.health() as Promise<Health>,
        api.satellites.stats() as Promise<Stats>,
      ])
      setHealth(healthData)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleIngest() {
    setIngesting(true)
    setIngestResult(null)
    setIngestError(null)
    try {
      const result = (await api.ingest.celestrak(selectedGroup)) as IngestResult
      setIngestResult(result)
      await loadData()
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : 'Ingest failed')
    } finally {
      setIngesting(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <h1 className="text-4xl font-bold text-white">Mission Control</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Tracked Objects"
          value={loading ? '—' : (stats?.total ?? 0).toLocaleString()}
          color="blue"
        />
        <StatCard
          label="Payloads"
          value={loading ? '—' : (stats?.byType['Payload'] ?? 0).toLocaleString()}
          color="green"
        />
        <StatCard
          label="Debris"
          value={loading ? '—' : (stats?.byType['Debris'] ?? 0).toLocaleString()}
          color="red"
        />
        <StatCard
          label="API"
          value={health?.status === 'ok' ? 'Online' : loading ? '—' : 'Offline'}
          color={health?.status === 'ok' ? 'green' : 'red'}
        />
      </div>

      {/* System status + CelesTrak ingest */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-3">
          <h2 className="text-lg font-semibold text-white">System Status</h2>
          <StatusRow label="API" value={health?.status ?? '…'} ok={health?.status === 'ok'} />
          <StatusRow
            label="Database"
            value={health?.database ?? '…'}
            ok={health?.database === 'connected'}
          />
          <StatusRow
            label="Last ingest"
            value={
              stats?.lastIngestAt
                ? new Date(stats.lastIngestAt).toLocaleString()
                : 'Never'
            }
            ok={stats?.lastIngestAt != null}
          />
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
          <h2 className="text-lg font-semibold text-white">Import from CelesTrak</h2>
          <p className="text-sm text-slate-400">
            Fetch live TLE data from the NORAD catalog and import it into the database.
          </p>

          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            disabled={ingesting}
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            {GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleIngest}
            disabled={ingesting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded transition"
          >
            {ingesting ? 'Importing…' : 'Import'}
          </button>

          {ingestError && <p className="text-sm text-red-400">{ingestError}</p>}

          {ingestResult && (
            <div className="bg-slate-900 rounded p-3 text-sm space-y-1">
              <p className="text-green-400 font-medium">Import complete</p>
              <p className="text-slate-300">
                {ingestResult.total.toLocaleString()} objects ·{' '}
                {ingestResult.satellitesCreated.toLocaleString()} new satellites ·{' '}
                {ingestResult.tlesInserted.toLocaleString()} TLEs inserted
              </p>
              {ingestResult.errors > 0 && (
                <p className="text-yellow-400">{ingestResult.errors} parse errors skipped</p>
              )}
              <p className="text-slate-500">{(ingestResult.durationMs / 1000).toFixed(1)}s</p>
            </div>
          )}
        </div>
      </div>

      {/* Phase cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard title="Satellites" color="blue">
          Track active payloads, rocket bodies, and debris from the NORAD catalog.
        </InfoCard>
        <InfoCard title="Conjunction Detection" color="yellow">
          Hoots three-filter algorithm. Pc ≥ 1×10⁻⁴ triggers maneuver advisories.
        </InfoCard>
        <InfoCard title="3D Visualization" color="purple">
          CesiumJS globe with NASA GIBS imagery layers. Coming in Phase 4.
        </InfoCard>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: 'blue' | 'green' | 'red'
}) {
  const colors: Record<string, string> = {
    blue: 'border-blue-700 bg-blue-900/20',
    green: 'border-green-700 bg-green-900/20',
    red: 'border-red-700 bg-red-900/20',
  }
  return (
    <div className={`rounded-lg p-4 border ${colors[color]}`}>
      <p className="text-slate-400 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  )
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={ok ? 'text-green-400' : 'text-slate-400'}>{value}</span>
    </div>
  )
}

function InfoCard({
  title,
  color,
  children,
}: {
  title: string
  color: 'blue' | 'yellow' | 'purple'
  children: React.ReactNode
}) {
  const border: Record<string, string> = {
    blue: 'border-blue-700 bg-blue-900/20',
    yellow: 'border-yellow-700 bg-yellow-900/20',
    purple: 'border-purple-700 bg-purple-900/20',
  }
  const titleColor: Record<string, string> = {
    blue: 'text-blue-300',
    yellow: 'text-yellow-300',
    purple: 'text-purple-300',
  }
  return (
    <div className={`rounded-lg p-4 border ${border[color]}`}>
      <h3 className={`font-semibold mb-1 ${titleColor[color]}`}>{title}</h3>
      <p className="text-slate-300 text-sm">{children}</p>
    </div>
  )
}
