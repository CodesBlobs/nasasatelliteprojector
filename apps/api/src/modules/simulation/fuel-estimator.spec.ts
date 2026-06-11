import { describe, it, expect } from 'vitest'
import { estimateFuelKg, deltaVMagnitudeMs, FUEL_MODEL } from './fuel-estimator'

describe('deltaVMagnitudeMs', () => {
  it('computes vector magnitude correctly', () => {
    expect(deltaVMagnitudeMs({ x: 3, y: 4, z: 0 })).toBeCloseTo(5, 5)
    expect(deltaVMagnitudeMs({ x: 0, y: 0, z: 0 })).toBe(0)
    expect(deltaVMagnitudeMs({ x: 10, y: 0, z: 0 })).toBeCloseTo(10, 5)
  })
})

describe('estimateFuelKg', () => {
  it('returns zero fuel for zero delta-v', () => {
    expect(estimateFuelKg(0)).toBe(0)
  })

  it('returns positive fuel for positive delta-v', () => {
    expect(estimateFuelKg(10)).toBeGreaterThan(0)
  })

  it('fuel increases monotonically with delta-v', () => {
    const f1 = estimateFuelKg(10)
    const f2 = estimateFuelKg(50)
    const f3 = estimateFuelKg(200)
    expect(f2).toBeGreaterThan(f1)
    expect(f3).toBeGreaterThan(f2)
  })

  it('1 m/s maneuver uses a small amount of fuel', () => {
    // 1 m/s on 500 kg satellite with Isp=220s
    // Δm = 500 * (1 - exp(-1/2157.5)) ≈ 500 * 0.000464 ≈ 0.232 kg
    expect(estimateFuelKg(1)).toBeCloseTo(0.232, 1)
  })

  it('10 m/s maneuver matches Tsiolkovsky equation', () => {
    const expected =
      FUEL_MODEL.satelliteMassKg * (1 - Math.exp(-10 / FUEL_MODEL.exhaustVelocityMs))
    expect(estimateFuelKg(10)).toBeCloseTo(expected, 5)
  })

  it('never exceeds satellite mass (conservation)', () => {
    // Even for an extremely large dV, can't use more than total mass
    expect(estimateFuelKg(10000)).toBeLessThan(FUEL_MODEL.satelliteMassKg)
  })
})
