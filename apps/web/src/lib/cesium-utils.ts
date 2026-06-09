// ECI (TEME) to ECEF conversion using Greenwich Mean Sidereal Time.
// Satellite.js returns positions in TEME frame (km). Cesium expects ECEF (meters).
// Accuracy is sufficient for display purposes (~arcsecond level).

export interface Vec3 {
  x: number
  y: number
  z: number
}

function julianDayNumber(date: Date): number {
  return date.getTime() / 86400000.0 + 2440587.5
}

function greenwichMeanSiderealTime(date: Date): number {
  const jd = julianDayNumber(date)
  const T = (jd - 2451545.0) / 36525.0
  const deg =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0
  return (((deg % 360) + 360) % 360) * (Math.PI / 180)
}

// Returns ECEF position in meters
export function eciToEcefMeters(position: Vec3, date: Date): [number, number, number] {
  const gmst = greenwichMeanSiderealTime(date)
  const c = Math.cos(gmst)
  const s = Math.sin(gmst)
  return [
    (position.x * c + position.y * s) * 1000,
    (-position.x * s + position.y * c) * 1000,
    position.z * 1000,
  ]
}

export function altitudeKm(position: Vec3): number {
  return Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2) - 6371
}

export function speedKms(velocity: Vec3): number {
  return Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)
}
