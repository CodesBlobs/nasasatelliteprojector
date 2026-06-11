import { AlertSeverity } from '@orbital/shared'

export function severityFromApproachKm(km: number): AlertSeverity {
  if (km <= 1) return AlertSeverity.CRITICAL
  if (km <= 2) return AlertSeverity.HIGH
  if (km <= 5) return AlertSeverity.MEDIUM
  if (km <= 10) return AlertSeverity.LOW
  return AlertSeverity.INFO
}

export interface ConjunctionForAlert {
  id: string
  closestApproachKm: number
  relativeVelocityKmS: number
  predictedTime: Date
  satelliteA: { noradId: number; name: string }
  satelliteB: { noradId: number; name: string }
}

export interface GeneratedAlert {
  conjunctionId: string
  severity: AlertSeverity
  title: string
  description: string
}

export function buildAlertFromConjunction(c: ConjunctionForAlert): GeneratedAlert {
  const severity = severityFromApproachKm(c.closestApproachKm)
  const missText =
    c.closestApproachKm < 1
      ? `${(c.closestApproachKm * 1000).toFixed(0)} m`
      : `${c.closestApproachKm.toFixed(2)} km`

  return {
    conjunctionId: c.id,
    severity,
    title: `Close approach: ${c.satelliteA.name} × ${c.satelliteB.name}`,
    description:
      `${c.satelliteA.name} (NORAD ${c.satelliteA.noradId}) and ` +
      `${c.satelliteB.name} (NORAD ${c.satelliteB.noradId}) ` +
      `predicted closest approach of ${missText} at ` +
      `${c.predictedTime.toISOString().replace('T', ' ').slice(0, 16)} UTC. ` +
      `Relative velocity: ${c.relativeVelocityKmS.toFixed(2)} km/s.`,
  }
}
