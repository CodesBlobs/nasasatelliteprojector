import { twoline2satrec, propagate } from 'satellite.js'
import { PropagationResult } from '@orbital/shared'

// SatRec is the parsed, validated form of a TLE — expensive to compute, safe to reuse.
type Satrec = ReturnType<typeof twoline2satrec>
export type { Satrec }

export function createSatrec(line1: string, line2: string): Satrec {
  const satrec = twoline2satrec(line1, line2)
  if (satrec.error) throw new Error(`TLE parse error: ${satrec.error}`)
  return satrec
}

function propagateSatrecInternal(satrec: Satrec, timestamp: Date): PropagationResult {
  const positionAndVelocity = propagate(satrec, timestamp)
  const { position, velocity } = positionAndVelocity

  if (
    typeof position === 'boolean' ||
    typeof velocity === 'boolean' ||
    !position ||
    !velocity ||
    isNaN(position.x) ||
    isNaN(position.y) ||
    isNaN(position.z) ||
    isNaN(velocity.x) ||
    isNaN(velocity.y) ||
    isNaN(velocity.z)
  ) {
    throw new Error('Invalid propagation result')
  }

  return {
    position: { x: position.x, y: position.y, z: position.z },
    velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
    timestamp,
  }
}

export function propagateSatrec(satrec: Satrec, timestamp: Date): PropagationResult {
  return propagateSatrecInternal(satrec, timestamp)
}

export function propagateSatrecMultiple(
  satrec: Satrec,
  startTime: Date,
  intervalSeconds: number,
  count: number,
): PropagationResult[] {
  const results: PropagationResult[] = []
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startTime.getTime() + i * intervalSeconds * 1000)
    results.push(propagateSatrecInternal(satrec, timestamp))
  }
  return results
}

export function propagateSatellite(line1: string, line2: string, timestamp: Date): PropagationResult {
  return propagateSatrecInternal(createSatrec(line1, line2), timestamp)
}

export function propagateMultiple(
  line1: string,
  line2: string,
  startTime: Date,
  intervalSeconds: number,
  count: number,
): PropagationResult[] {
  const satrec = createSatrec(line1, line2)
  return propagateSatrecMultiple(satrec, startTime, intervalSeconds, count)
}
