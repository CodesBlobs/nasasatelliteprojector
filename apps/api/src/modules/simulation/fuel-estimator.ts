/**
 * Simplified fuel consumption estimator using the Tsiolkovsky rocket equation.
 *
 * Assumptions (documented for transparency):
 *   - Satellite wet mass: 500 kg (generic medium LEO satellite)
 *   - Propellant: Hydrazine monopropellant (N₂H₄)
 *   - Specific impulse (Isp): 220 s  (typical MR-111 or MR-103 thruster)
 *   - Exhaust velocity Vₑ = Isp × g₀ = 220 × 9.80665 ≈ 2157.5 m/s
 *   - Equation: Δm = m₀ · (1 − exp(−|ΔV| / Vₑ))
 *
 * These are not mission-grade parameters. The output is an order-of-magnitude
 * guide for simulation purposes only.
 */

const SATELLITE_MASS_KG = 500
const ISP_S = 220
const G0_MS2 = 9.80665
const EXHAUST_VELOCITY_MS = ISP_S * G0_MS2 // ≈ 2157.5 m/s

export const FUEL_MODEL = {
  satelliteMassKg: SATELLITE_MASS_KG,
  propellant: 'Hydrazine monopropellant',
  ispSeconds: ISP_S,
  exhaustVelocityMs: EXHAUST_VELOCITY_MS,
  equation: 'Tsiolkovsky rocket equation: Δm = m₀(1 − e^(−ΔV/Vₑ))',
  disclaimer: 'Approximate values for simulation only. Not for mission planning.',
} as const

export function deltaVMagnitudeMs(dv: { x: number; y: number; z: number }): number {
  return Math.sqrt(dv.x * dv.x + dv.y * dv.y + dv.z * dv.z)
}

export function estimateFuelKg(deltaVMagnitude: number): number {
  return SATELLITE_MASS_KG * (1 - Math.exp(-deltaVMagnitude / EXHAUST_VELOCITY_MS))
}
