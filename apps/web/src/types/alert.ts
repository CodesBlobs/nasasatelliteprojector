export interface AlertConjunction {
  id: string
  closestApproachKm: number
  relativeVelocityKmS: number
  predictedTime: string
  riskLevel: string
  satelliteA: { noradId: number; name: string; objectType: string }
  satelliteB: { noradId: number; name: string; objectType: string }
}

export interface Alert {
  id: string
  severity: string
  title: string
  description: string
  status: string
  createdAt: string
  updatedAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
  conjunction: AlertConjunction
}
