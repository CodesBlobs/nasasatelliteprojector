export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export const SEVERITY_ORDER: Record<Severity, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  LOW: '#facc15',
  MEDIUM: '#fb923c',
  HIGH: '#ef4444',
  CRITICAL: '#ff2056',
}

export function worstSeverity(a: Severity | undefined, b: Severity): Severity {
  if (!a) return b
  return SEVERITY_ORDER[b] > SEVERITY_ORDER[a] ? b : a
}

export function formatCountdown(target: Date, now: Date): string {
  const deltaMs = target.getTime() - now.getTime()
  if (deltaMs <= 0) return 'now'
  const totalSeconds = Math.floor(deltaMs / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `T-${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `T-${m}m ${s.toString().padStart(2, '0')}s`
  return `T-${s}s`
}
