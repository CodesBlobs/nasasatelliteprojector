import { describe, it, expect } from 'vitest'
import {
  applyDeltaV,
  stateToElements,
  propagateKeplerian,
  generateKeplerianTrajectory,
  getAltitudesFromElements,
} from './maneuver-engine'

const MU = 398600.4418
const EARTH_RADIUS = 6371

// ISS-like circular LEO state at epoch
// Altitude ~415 km, inclination ~51.6°, circular orbit
const ISS_A = EARTH_RADIUS + 415 // km
const ISS_V = Math.sqrt(MU / ISS_A) // km/s ≈ 7.67

// Simple equatorial circular orbit state (easy to validate analytically)
const CIRCULAR_EQUATORIAL_STATE = {
  position: { x: ISS_A, y: 0, z: 0 },
  velocity: { x: 0, y: ISS_V, z: 0 },
}

describe('applyDeltaV', () => {
  it('adds delta-v converting m/s to km/s', () => {
    const result = applyDeltaV(CIRCULAR_EQUATORIAL_STATE, { x: 100, y: 0, z: 0 })
    expect(result.position).toEqual(CIRCULAR_EQUATORIAL_STATE.position)
    expect(result.velocity.x).toBeCloseTo(0.1, 5)
    expect(result.velocity.y).toBeCloseTo(ISS_V, 5)
    expect(result.velocity.z).toBeCloseTo(0, 5)
  })

  it('does not mutate the input state', () => {
    const original = { ...CIRCULAR_EQUATORIAL_STATE }
    applyDeltaV(CIRCULAR_EQUATORIAL_STATE, { x: 50, y: 50, z: 50 })
    expect(CIRCULAR_EQUATORIAL_STATE.velocity).toEqual(original.velocity)
  })

  it('handles zero delta-v', () => {
    const result = applyDeltaV(CIRCULAR_EQUATORIAL_STATE, { x: 0, y: 0, z: 0 })
    expect(result.velocity).toEqual(CIRCULAR_EQUATORIAL_STATE.velocity)
  })
})

describe('stateToElements', () => {
  it('recovers semi-major axis from circular equatorial orbit', () => {
    const elements = stateToElements(CIRCULAR_EQUATORIAL_STATE, 0)
    expect(elements.a).toBeCloseTo(ISS_A, 0)
  })

  it('recovers near-zero eccentricity for circular orbit', () => {
    const elements = stateToElements(CIRCULAR_EQUATORIAL_STATE, 0)
    expect(elements.e).toBeLessThan(1e-6)
  })

  it('recovers near-zero inclination for equatorial orbit', () => {
    const elements = stateToElements(CIRCULAR_EQUATORIAL_STATE, 0)
    expect(elements.i).toBeCloseTo(0, 6)
  })

  it('stores the epoch correctly', () => {
    const t = 1700000000000
    const elements = stateToElements(CIRCULAR_EQUATORIAL_STATE, t)
    expect(elements.epochMs).toBe(t)
  })
})

describe('propagateKeplerian', () => {
  it('returns near-original position at t=0 offset', () => {
    const elements = stateToElements(CIRCULAR_EQUATORIAL_STATE, 1000)
    const result = propagateKeplerian(elements, 1000)
    expect(result.position.x).toBeCloseTo(CIRCULAR_EQUATORIAL_STATE.position.x, 0)
    expect(result.position.y).toBeCloseTo(CIRCULAR_EQUATORIAL_STATE.position.y, 0)
  })

  it('keeps constant orbital radius for circular orbit', () => {
    const elements = stateToElements(CIRCULAR_EQUATORIAL_STATE, 0)
    const period = 2 * Math.PI * Math.sqrt((ISS_A ** 3) / MU) * 1000 // ms
    // Check at quarter periods
    for (const frac of [0.25, 0.5, 0.75, 1.0]) {
      const state = propagateKeplerian(elements, frac * period)
      const r = Math.sqrt(
        state.position.x ** 2 + state.position.y ** 2 + state.position.z ** 2,
      )
      expect(r).toBeCloseTo(ISS_A, 1) // within 1 km
    }
  })

  it('completes a full orbit back to origin after one period', () => {
    const elements = stateToElements(CIRCULAR_EQUATORIAL_STATE, 0)
    const period = 2 * Math.PI * Math.sqrt((ISS_A ** 3) / MU) * 1000
    const result = propagateKeplerian(elements, period)
    expect(result.position.x).toBeCloseTo(CIRCULAR_EQUATORIAL_STATE.position.x, 0)
    expect(result.position.y).toBeCloseTo(CIRCULAR_EQUATORIAL_STATE.position.y, 0)
  })
})

describe('getAltitudesFromElements', () => {
  it('returns correct perigee/apogee for circular orbit', () => {
    const elements = stateToElements(CIRCULAR_EQUATORIAL_STATE, 0)
    const { perigeeKm, apogeeKm } = getAltitudesFromElements(elements)
    // For circular orbit perigee ≈ apogee ≈ altitude
    const altitude = ISS_A - EARTH_RADIUS
    expect(perigeeKm).toBeCloseTo(altitude, 0)
    expect(apogeeKm).toBeCloseTo(altitude, 0)
  })

  it('returns different perigee and apogee for elliptical orbit', () => {
    // Hohmann transfer — apogee boost
    const ellipticalState = applyDeltaV(CIRCULAR_EQUATORIAL_STATE, { x: 0, y: 500, z: 0 })
    const elements = stateToElements(ellipticalState, 0)
    const { perigeeKm, apogeeKm } = getAltitudesFromElements(elements)
    expect(apogeeKm).toBeGreaterThan(perigeeKm + 50)
  })
})

describe('generateKeplerianTrajectory', () => {
  it('generates correct number of points', () => {
    const points = generateKeplerianTrajectory(CIRCULAR_EQUATORIAL_STATE, 0, 1, 5)
    // 1 hour / 5 minutes = 12 intervals + 1 = 13 points
    expect(points).toHaveLength(13)
  })

  it('produces points with valid ECI positions', () => {
    const points = generateKeplerianTrajectory(CIRCULAR_EQUATORIAL_STATE, 0, 1, 5)
    for (const p of points) {
      const r = Math.sqrt(p.position.x ** 2 + p.position.y ** 2 + p.position.z ** 2)
      expect(r).toBeGreaterThan(EARTH_RADIUS) // above Earth surface
      expect(r).toBeCloseTo(ISS_A, 1)
    }
  })

  it('timestamps increment by sample interval', () => {
    const epochMs = 1700000000000
    const sampleMinutes = 5
    const points = generateKeplerianTrajectory(CIRCULAR_EQUATORIAL_STATE, epochMs, 1, sampleMinutes)
    for (let i = 1; i < points.length; i++) {
      const dt = new Date(points[i].timestamp).getTime() - new Date(points[i - 1].timestamp).getTime()
      expect(dt).toBe(sampleMinutes * 60 * 1000)
    }
  })
})

describe('maneuver impact on orbit shape', () => {
  it('prograde burn raises apogee', () => {
    const state = CIRCULAR_EQUATORIAL_STATE
    const elements0 = stateToElements(state, 0)
    const raised = applyDeltaV(state, { x: 0, y: 200, z: 0 }) // prograde
    const elements1 = stateToElements(raised, 0)
    expect(elements1.a).toBeGreaterThan(elements0.a)
  })

  it('retrograde burn lowers orbit', () => {
    const state = CIRCULAR_EQUATORIAL_STATE
    const elements0 = stateToElements(state, 0)
    const lowered = applyDeltaV(state, { x: 0, y: -200, z: 0 }) // retrograde
    const elements1 = stateToElements(lowered, 0)
    expect(elements1.a).toBeLessThan(elements0.a)
  })

  it('out-of-plane burn changes inclination', () => {
    const state = CIRCULAR_EQUATORIAL_STATE
    const elements0 = stateToElements(state, 0)
    const inclined = applyDeltaV(state, { x: 0, y: 0, z: 200 })
    const elements1 = stateToElements(inclined, 0)
    expect(elements1.i).toBeGreaterThan(elements0.i)
  })
})
