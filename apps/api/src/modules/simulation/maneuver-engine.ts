/**
 * Two-body Keplerian propagator for maneuver simulation.
 *
 * Used only for what-if trajectory generation after a delta-v. Real mission
 * planning would use a high-fidelity numerical integrator with perturbations
 * (J2, drag, SRP). For simulation purposes, Keplerian is accurate enough over
 * 24-hour windows to show qualitative conjunction avoidance.
 */

import type { Position, Velocity } from '@orbital/shared'
import type { CloseApproach } from '../conjunctions/conjunction-detector'
import {
  distanceKm,
  relativeSpeedKmS,
} from '../conjunctions/conjunction-detector'
import { propagateSatellite } from '@orbital/core'

const MU_KM3_S2 = 398600.4418 // Earth's gravitational parameter
const EARTH_RADIUS_KM = 6371
const TWO_PI = 2 * Math.PI

export interface StateVector {
  position: Position
  velocity: Velocity
}

export interface OrbitalElements {
  a: number      // semi-major axis (km)
  e: number      // eccentricity
  i: number      // inclination (rad)
  omega: number  // argument of perigee (rad)
  Omega: number  // right ascension of ascending node (rad)
  M0: number     // mean anomaly at epoch (rad)
  epochMs: number
}

export interface OrbitPoint {
  timestamp: string
  position: Position
  velocity: Velocity
}

export interface SimulatedCandidate {
  satelliteId: string
  noradId: number
  name: string
  line1: string
  line2: string
  perigeeKm: number
  apogeeKm: number
}

// ─── Vector helpers ──────────────────────────────────────────────────────────

function cross(a: number[], b: number[]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function norm(v: number[]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
}

function matVec(mat: number[][], vec: number[]): number[] {
  return [
    mat[0][0] * vec[0] + mat[0][1] * vec[1] + mat[0][2] * vec[2],
    mat[1][0] * vec[0] + mat[1][1] * vec[1] + mat[1][2] * vec[2],
    mat[2][0] * vec[0] + mat[2][1] * vec[1] + mat[2][2] * vec[2],
  ]
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Add a delta-v (m/s) to an ECI state vector.
 * Converts from m/s to km/s for internal consistency.
 */
export function applyDeltaV(
  state: StateVector,
  deltaVMs: { x: number; y: number; z: number },
): StateVector {
  return {
    position: state.position,
    velocity: {
      x: state.velocity.x + deltaVMs.x / 1000,
      y: state.velocity.y + deltaVMs.y / 1000,
      z: state.velocity.z + deltaVMs.z / 1000,
    },
  }
}

/**
 * Convert ECI state vector to Keplerian orbital elements.
 */
export function stateToElements(state: StateVector, epochMs: number): OrbitalElements {
  const r = [state.position.x, state.position.y, state.position.z]
  const v = [state.velocity.x, state.velocity.y, state.velocity.z]
  const rMag = norm(r)
  const vMag = norm(v)

  const h = cross(r, v)
  const hMag = norm(h)

  // Node vector: ẑ × h (direction of ascending node)
  const n = [-h[1], h[0], 0]
  const nMag = norm(n)

  // Eccentricity vector
  const rdotv = dot(r, v)
  const vv = vMag * vMag
  const e = r.map((ri, k) => ((vv - MU_KM3_S2 / rMag) * ri - rdotv * v[k]) / MU_KM3_S2)
  const eMag = norm(e)

  // Specific mechanical energy → semi-major axis
  const eps = vv / 2 - MU_KM3_S2 / rMag
  const a = -MU_KM3_S2 / (2 * eps)

  // Inclination
  const i = Math.acos(clamp(h[2] / hMag, -1, 1))

  // RAAN
  let Omega = nMag > 1e-10 ? Math.acos(clamp(n[0] / nMag, -1, 1)) : 0
  if (n[1] < 0) Omega = TWO_PI - Omega

  // Argument of perigee
  let omega: number
  if (nMag > 1e-10 && eMag > 1e-10) {
    omega = Math.acos(clamp(dot(n, e) / (nMag * eMag), -1, 1))
    if (e[2] < 0) omega = TWO_PI - omega
  } else if (eMag > 1e-10) {
    // Equatorial elliptical: measure ω from x-axis in xy plane
    omega = Math.atan2(e[1], e[0])
    if (omega < 0) omega += TWO_PI
  } else {
    omega = 0 // circular orbit: ω undefined, set to 0
  }

  // True anomaly
  let nu: number
  if (eMag > 1e-10) {
    nu = Math.acos(clamp(dot(e, r) / (eMag * rMag), -1, 1))
    if (rdotv < 0) nu = TWO_PI - nu
  } else if (nMag > 1e-10) {
    // Circular inclined: argument of latitude (ω=0, so u = ν)
    nu = Math.acos(clamp(dot(n, r) / (nMag * rMag), -1, 1))
    if (r[2] < 0) nu = TWO_PI - nu
  } else {
    // Circular equatorial: position angle in xy plane
    nu = Math.atan2(r[1], r[0])
    if (nu < 0) nu += TWO_PI
  }

  // Eccentric anomaly from true anomaly
  const E0 = 2 * Math.atan2(
    Math.sqrt(1 - eMag) * Math.sin(nu / 2),
    Math.sqrt(1 + eMag) * Math.cos(nu / 2),
  )
  let M0 = E0 - eMag * Math.sin(E0)
  if (M0 < 0) M0 += TWO_PI

  return { a, e: eMag, i, omega, Omega, M0, epochMs }
}

// Newton-Raphson solver for Kepler's equation: M = E - e·sin(E)
function solveKepler(M: number, e: number): number {
  let E = M
  for (let k = 0; k < 50; k++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E))
    E += dE
    if (Math.abs(dE) < 1e-12) break
  }
  return E
}

/**
 * Propagate orbital elements forward to a target time, returning ECI state.
 */
export function propagateKeplerian(elements: OrbitalElements, targetMs: number): StateVector {
  const { a, e, i, omega, Omega, M0, epochMs } = elements

  const dt = (targetMs - epochMs) / 1000 // seconds
  const n = Math.sqrt(MU_KM3_S2 / (a * a * a)) // mean motion (rad/s)

  let M = M0 + n * dt
  M = ((M % TWO_PI) + TWO_PI) % TWO_PI

  const E = solveKepler(M, e)
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  )

  const r = a * (1 - e * Math.cos(E))
  const cosNu = Math.cos(nu)
  const sinNu = Math.sin(nu)
  const p = a * (1 - e * e)
  const sqrtMuP = Math.sqrt(MU_KM3_S2 / p)

  // Perifocal frame
  const rPeri = [r * cosNu, r * sinNu, 0]
  const vPeri = [sqrtMuP * (-sinNu), sqrtMuP * (e + cosNu), 0]

  // Rotation from perifocal to ECI: Rz(-Ω) · Rx(-i) · Rz(-ω)
  const cosO = Math.cos(Omega), sinO = Math.sin(Omega)
  const coso = Math.cos(omega), sino = Math.sin(omega)
  const cosI = Math.cos(i), sinI = Math.sin(i)

  const R = [
    [cosO * coso - sinO * sino * cosI, -cosO * sino - sinO * coso * cosI,  sinO * sinI],
    [sinO * coso + cosO * sino * cosI, -sinO * sino + cosO * coso * cosI, -cosO * sinI],
    [sino * sinI,                       coso * sinI,                        cosI],
  ]

  const pos = matVec(R, rPeri)
  const vel = matVec(R, vPeri)

  return {
    position: { x: pos[0], y: pos[1], z: pos[2] },
    velocity: { x: vel[0], y: vel[1], z: vel[2] },
  }
}

/**
 * Generate a trajectory from a Keplerian state forward in time.
 */
export function generateKeplerianTrajectory(
  state: StateVector,
  epochMs: number,
  windowHours: number,
  sampleMinutes: number,
): OrbitPoint[] {
  const elements = stateToElements(state, epochMs)
  const stepMs = sampleMinutes * 60 * 1000
  const count = Math.floor((windowHours * 60) / sampleMinutes) + 1

  const points: OrbitPoint[] = []
  for (let i = 0; i < count; i++) {
    const t = epochMs + i * stepMs
    const sv = propagateKeplerian(elements, t)
    points.push({
      timestamp: new Date(t).toISOString(),
      position: sv.position,
      velocity: sv.velocity,
    })
  }
  return points
}

/**
 * Generate a trajectory for the original TLE orbit (SGP4).
 */
export function generateSgp4Trajectory(
  line1: string,
  line2: string,
  startMs: number,
  windowHours: number,
  sampleMinutes: number,
): OrbitPoint[] {
  const stepMs = sampleMinutes * 60 * 1000
  const count = Math.floor((windowHours * 60) / sampleMinutes) + 1

  const points: OrbitPoint[] = []
  for (let i = 0; i < count; i++) {
    const t = new Date(startMs + i * stepMs)
    try {
      const result = propagateSatellite(line1, line2, t)
      points.push({
        timestamp: t.toISOString(),
        position: result.position,
        velocity: result.velocity,
      })
    } catch {
      // Skip steps where SGP4 fails (decayed orbit etc.)
    }
  }
  return points
}

/**
 * Perigee and apogee altitudes from orbital elements.
 */
export function getAltitudesFromElements(elements: OrbitalElements): {
  perigeeKm: number
  apogeeKm: number
} {
  return {
    perigeeKm: elements.a * (1 - elements.e) - EARTH_RADIUS_KM,
    apogeeKm: elements.a * (1 + elements.e) - EARTH_RADIUS_KM,
  }
}

/**
 * Find close approaches between a pre-computed set of positions (simulated
 * satellite) and a list of TLE-backed objects (propagated on-the-fly).
 *
 * Uses the same altitude-range filter as the conjunction detector to avoid
 * propagating irrelevant satellites.
 */
export function findApproachesFromPositions(
  targetPositions: OrbitPoint[],
  targetSatelliteId: string,
  targetPerigeeKm: number,
  targetApogeeKm: number,
  candidates: SimulatedCandidate[],
  thresholdKm: number,
  minimumThresholdKm: number,
  bufferKm: number,
): CloseApproach[] {
  const timestamps = targetPositions.map((p) => new Date(p.timestamp))

  // Altitude filter: only propagate satellites whose range overlaps target
  const filtered = candidates.filter(
    (c) =>
      Math.max(c.perigeeKm, targetPerigeeKm) <=
      Math.min(c.apogeeKm, targetApogeeKm) + bufferKm,
  )

  const approaches: CloseApproach[] = []

  for (const candidate of filtered) {
    let minDist = Infinity
    let minStep = -1
    let minVel = 0

    for (let s = 0; s < timestamps.length; s++) {
      const targetState = targetPositions[s]
      let candidatePos: Position
      let candidateVel: Velocity

      try {
        const r = propagateSatellite(candidate.line1, candidate.line2, timestamps[s])
        candidatePos = r.position
        candidateVel = r.velocity
      } catch {
        continue
      }

      const d = distanceKm(targetState.position, candidatePos)
      if (d < minDist) {
        minDist = d
        minStep = s
        minVel = relativeSpeedKmS(targetState.velocity, candidateVel)
      }
    }

    if (minStep >= 0 && minDist >= minimumThresholdKm && minDist < thresholdKm) {
      approaches.push({
        satelliteAId: targetSatelliteId,
        satelliteBId: candidate.satelliteId,
        closestApproachKm: minDist,
        relativeVelocityKmS: minVel,
        predictedTime: timestamps[minStep],
      })
    }
  }

  return approaches.sort((a, b) => a.closestApproachKm - b.closestApproachKm)
}
