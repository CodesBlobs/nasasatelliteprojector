export interface OrbitalVector {
  x: number
  y: number
  z: number
}

export interface PropagatedPosition {
  noradId: number
  timestamp: string
  position: OrbitalVector
  velocity: OrbitalVector
}

export interface OrbitPoint {
  timestamp: string
  position: OrbitalVector
  velocity: OrbitalVector
}

export interface OrbitTrack {
  noradId: number
  generatedAt: string
  points: OrbitPoint[]
}

