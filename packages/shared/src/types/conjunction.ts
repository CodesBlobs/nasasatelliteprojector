export enum ConjunctionStatus {
  PREDICTED = 'PREDICTED',
  CONFIRMED = 'CONFIRMED',
  MONITORED = 'MONITORED',
  RESOLVED = 'RESOLVED',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ConjunctionEvent {
  id: string
  satelliteAId: string
  satelliteBId: string
  closestApproachKm: number
  relativeVelocityKmS: number
  predictedTime: Date
  riskScore: number
  riskLevel: RiskLevel
  status: ConjunctionStatus
  createdAt: Date
  updatedAt: Date
}
