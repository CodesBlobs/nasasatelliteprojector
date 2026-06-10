import { RiskLevel } from '@orbital/shared'
import {
  classifySeverity,
  computeRiskScore,
  distanceKm,
  findCloseApproaches,
  relativeSpeedKmS,
} from './conjunction-detector'

// Real ISS TLE (epoch 2026-06-09) — matches current test runtime window
const ISS_LINE1 = '1 25544U 98067A   26160.50000000  .00016717  00000-0  29770-3 0  9002'
const ISS_LINE2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'
// Same orbit, mean anomaly shifted 180° — always on the opposite side of Earth
const ISS_LINE2_OPPOSITE = '2 25544  51.6416 247.4627 0006703 130.5360 145.0288 15.54179074380645'

const START = new Date('2026-06-09T12:00:00Z')
const SHORT_SCAN = { windowHours: 1, sampleMinutes: 5, thresholdKm: 10 }

describe('distanceKm', () => {
  it('computes Euclidean distance between two positions', () => {
    expect(distanceKm({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5)
    expect(distanceKm({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 })).toBe(0)
  })

  it('is symmetric', () => {
    const a = { x: 7000, y: -123.4, z: 42 }
    const b = { x: 6998.5, y: -120, z: 40 }
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 12)
  })
})

describe('relativeSpeedKmS', () => {
  it('computes magnitude of velocity difference', () => {
    expect(relativeSpeedKmS({ x: 7.5, y: 0, z: 0 }, { x: -7.5, y: 0, z: 0 })).toBe(15)
    expect(relativeSpeedKmS({ x: 7.5, y: 1, z: -2 }, { x: 7.5, y: 1, z: -2 })).toBe(0)
  })
})

describe('classifySeverity', () => {
  it('classifies distances above 5 km as LOW', () => {
    expect(classifySeverity(9.99)).toBe(RiskLevel.LOW)
    expect(classifySeverity(5.01)).toBe(RiskLevel.LOW)
  })

  it('classifies distances at or below 5 km as MEDIUM', () => {
    expect(classifySeverity(5)).toBe(RiskLevel.MEDIUM)
    expect(classifySeverity(2.01)).toBe(RiskLevel.MEDIUM)
  })

  it('classifies distances at or below 2 km as HIGH', () => {
    expect(classifySeverity(2)).toBe(RiskLevel.HIGH)
    expect(classifySeverity(1.01)).toBe(RiskLevel.HIGH)
  })

  it('classifies distances at or below 1 km as CRITICAL', () => {
    expect(classifySeverity(1)).toBe(RiskLevel.CRITICAL)
    expect(classifySeverity(0)).toBe(RiskLevel.CRITICAL)
  })
})

describe('computeRiskScore', () => {
  it('scores 100 at zero separation and 0 at the threshold', () => {
    expect(computeRiskScore(0, 10)).toBe(100)
    expect(computeRiskScore(10, 10)).toBe(0)
    expect(computeRiskScore(5, 10)).toBe(50)
  })

  it('clamps to the 0–100 range', () => {
    expect(computeRiskScore(25, 10)).toBe(0)
    expect(computeRiskScore(-1, 10)).toBe(100)
  })
})

describe('findCloseApproaches', () => {
  it('detects a conjunction for objects on identical orbits', () => {
    const objects = [
      { satelliteId: 'sat-a', noradId: 25544, line1: ISS_LINE1, line2: ISS_LINE2 },
      { satelliteId: 'sat-b', noradId: 90001, line1: ISS_LINE1, line2: ISS_LINE2 },
    ]

    const approaches = findCloseApproaches(objects, START, SHORT_SCAN)

    expect(approaches).toHaveLength(1)
    expect(approaches[0].satelliteAId).toBe('sat-a')
    expect(approaches[0].satelliteBId).toBe('sat-b')
    expect(approaches[0].closestApproachKm).toBeLessThan(0.001)
    expect(approaches[0].relativeVelocityKmS).toBeLessThan(0.001)
    expect(approaches[0].predictedTime.getTime()).toBeGreaterThanOrEqual(START.getTime())
  })

  it('ignores objects that never come within the threshold', () => {
    const objects = [
      { satelliteId: 'sat-a', noradId: 25544, line1: ISS_LINE1, line2: ISS_LINE2 },
      { satelliteId: 'sat-c', noradId: 90002, line1: ISS_LINE1, line2: ISS_LINE2_OPPOSITE },
    ]

    expect(findCloseApproaches(objects, START, SHORT_SCAN)).toHaveLength(0)
  })

  it('skips objects whose TLEs fail to propagate', () => {
    const objects = [
      { satelliteId: 'sat-a', noradId: 25544, line1: ISS_LINE1, line2: ISS_LINE2 },
      { satelliteId: 'sat-bad', noradId: 90003, line1: 'garbage', line2: 'garbage' },
    ]

    expect(findCloseApproaches(objects, START, SHORT_SCAN)).toHaveLength(0)
  })

  it('returns results sorted by closest approach distance', () => {
    const objects = [
      { satelliteId: 'sat-a', noradId: 25544, line1: ISS_LINE1, line2: ISS_LINE2 },
      { satelliteId: 'sat-b', noradId: 90001, line1: ISS_LINE1, line2: ISS_LINE2 },
      { satelliteId: 'sat-d', noradId: 90004, line1: ISS_LINE1, line2: ISS_LINE2 },
    ]

    const approaches = findCloseApproaches(objects, START, SHORT_SCAN)

    expect(approaches).toHaveLength(3)
    for (let i = 1; i < approaches.length; i++) {
      expect(approaches[i].closestApproachKm).toBeGreaterThanOrEqual(
        approaches[i - 1].closestApproachKm,
      )
    }
  })
})
