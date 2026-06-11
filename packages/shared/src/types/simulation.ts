export enum SimulationStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface OrbitPoint {
  timestamp: string
  position: { x: number; y: number; z: number }
  velocity: { x: number; y: number; z: number }
}

export type ConjunctionImpactStatus =
  | 'REMOVED'
  | 'REDUCED'
  | 'CREATED'
  | 'WORSENED'
  | 'UNCHANGED'

export interface ConjunctionImpact {
  satelliteId: string
  satelliteName: string
  noradId: number
  beforeApproachKm: number | null
  afterApproachKm: number | null
  beforeRiskScore: number
  afterRiskScore: number
  status: ConjunctionImpactStatus
}

export interface SimulationRecord {
  id: string
  satelliteId: string
  deltaVx: number
  deltaVy: number
  deltaVz: number
  maneuverTime: string
  windowHours: number
  status: SimulationStatus
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
}

export interface SimulationResultData {
  id: string
  simulationId: string
  oldRiskScore: number
  newRiskScore: number
  fuelEstimateKg: number
  deltaVMagnitudeMs: number
  conjunctionsRemoved: number
  conjunctionsCreated: number
  closestApproachBefore: number
  closestApproachAfter: number
  riskReductionPercent: number
  originalTrajectory: OrbitPoint[]
  simulatedTrajectory: OrbitPoint[]
  conjunctionImpacts: ConjunctionImpact[]
  createdAt: string
}

export interface SimulationWithResult extends SimulationRecord {
  result: SimulationResultData | null
}

export interface CreateSimulationRequest {
  satelliteId: string
  deltaV: { x: number; y: number; z: number }
  windowHours?: number
  maneuverTime?: string
}
