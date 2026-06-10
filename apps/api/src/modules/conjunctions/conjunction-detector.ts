import { propagateSatellite } from '@orbital/core'
import { RiskLevel } from '@orbital/shared'
import type { Position, Velocity } from '@orbital/shared'

export interface TrackedObject {
  satelliteId: string
  noradId: number
  line1: string
  line2: string
}

export interface CloseApproach {
  satelliteAId: string
  satelliteBId: string
  closestApproachKm: number
  relativeVelocityKmS: number
  predictedTime: Date
}

export interface DetectionOptions {
  windowHours: number
  sampleMinutes: number
  thresholdKm: number
}

export const DEFAULT_DETECTION_OPTIONS: DetectionOptions = {
  windowHours: 24,
  sampleMinutes: 5,
  thresholdKm: 10,
}

interface StateVector {
  position: Position
  velocity: Velocity
}

export function distanceKm(a: Position, b: Position): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export function relativeSpeedKmS(a: Velocity, b: Velocity): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export function classifySeverity(closestApproachKm: number): RiskLevel {
  if (closestApproachKm <= 1) return RiskLevel.CRITICAL
  if (closestApproachKm <= 2) return RiskLevel.HIGH
  if (closestApproachKm <= 5) return RiskLevel.MEDIUM
  return RiskLevel.LOW
}

// Linear miss-distance score: 0 km -> 100, thresholdKm -> 0.
export function computeRiskScore(closestApproachKm: number, thresholdKm: number): number {
  const score = 100 * (1 - closestApproachKm / thresholdKm)
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10))
}

/**
 * Brute-force pairwise scan: propagate every object at every sample step,
 * then track the minimum separation per pair. O(n^2 * steps) — acceptable
 * for the MVP target of 100–500 objects (see docs/conjunction-scaling.md).
 */
export function findCloseApproaches(
  objects: TrackedObject[],
  startTime: Date,
  options: DetectionOptions = DEFAULT_DETECTION_OPTIONS,
): CloseApproach[] {
  const { windowHours, sampleMinutes, thresholdKm } = options
  const stepMs = sampleMinutes * 60 * 1000
  const stepCount = Math.floor((windowHours * 60) / sampleMinutes) + 1

  const timestamps: Date[] = []
  for (let s = 0; s < stepCount; s++) {
    timestamps.push(new Date(startTime.getTime() + s * stepMs))
  }

  // Propagate everything up front. Objects that fail SGP4 (decayed, bad TLE)
  // get null entries and are skipped in the pair loop.
  const states: Array<Array<StateVector | null>> = objects.map((obj) =>
    timestamps.map((t) => {
      try {
        const result = propagateSatellite(obj.line1, obj.line2, t)
        return { position: result.position, velocity: result.velocity }
      } catch {
        return null
      }
    }),
  )

  const approaches: CloseApproach[] = []

  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      let minDistance = Infinity
      let minStep = -1

      for (let s = 0; s < stepCount; s++) {
        const a = states[i][s]
        const b = states[j][s]
        if (!a || !b) continue

        const d = distanceKm(a.position, b.position)
        if (d < minDistance) {
          minDistance = d
          minStep = s
        }
      }

      if (minStep >= 0 && minDistance < thresholdKm) {
        const a = states[i][minStep]!
        const b = states[j][minStep]!
        approaches.push({
          satelliteAId: objects[i].satelliteId,
          satelliteBId: objects[j].satelliteId,
          closestApproachKm: minDistance,
          relativeVelocityKmS: relativeSpeedKmS(a.velocity, b.velocity),
          predictedTime: timestamps[minStep],
        })
      }
    }
  }

  return approaches.sort((a, b) => a.closestApproachKm - b.closestApproachKm)
}
