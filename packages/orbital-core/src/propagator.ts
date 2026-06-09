import { twoline2satrec, propagate } from 'satellite.js'
import { PropagationResult } from '@orbital/shared'

export function propagateSatellite(
  line1: string,
  line2: string,
  timestamp: Date
): PropagationResult {
  const satrec = twoline2satrec(line1, line2)

  if (satrec.error) {
    throw new Error(`Satellite.js error: ${satrec.error}`)
  }

  const positionAndVelocity = propagate(satrec, timestamp)

  if (positionAndVelocity.error) {
    throw new Error('Propagation error: satellite may have decayed')
  }

  const { position, velocity } = positionAndVelocity

  if (
    typeof position === 'boolean' ||
    typeof velocity === 'boolean' ||
    !position ||
    !velocity
  ) {
    throw new Error('Invalid propagation result')
  }

  return {
    position: {
      x: position.x,
      y: position.y,
      z: position.z,
    },
    velocity: {
      x: velocity.x,
      y: velocity.y,
      z: velocity.z,
    },
    timestamp,
  }
}

export function propagateMultiple(
  line1: string,
  line2: string,
  startTime: Date,
  intervalSeconds: number,
  count: number
): PropagationResult[] {
  const results: PropagationResult[] = []

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startTime.getTime() + i * intervalSeconds * 1000)
    results.push(propagateSatellite(line1, line2, timestamp))
  }

  return results
}
