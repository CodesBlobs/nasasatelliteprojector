export interface Position {
  x: number
  y: number
  z: number
}

export interface Velocity {
  x: number
  y: number
  z: number
}

export interface PositionSnapshot {
  id: string
  satelliteId: string
  timestamp: Date
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

export interface PropagationResult {
  position: Position
  velocity: Velocity
  timestamp: Date
}
