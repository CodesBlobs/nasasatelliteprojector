export const CONJUNCTION_CONFIG = {
  // Distance thresholds (km)
  warningDistanceKm: 10,
  highRiskDistanceKm: 2,
  criticalDistanceKm: 1,
  minimumThresholdKm: 0.1,   // below this = co-located structures, not a real threat

  // Prediction window
  predictionWindowHours: 72,
  sampleMinutes: 5,

  // Background scan schedule
  scanIntervalMinutes: 15,

  // Spatial partitioning
  altitudeBandKm: 200,        // group satellites into 200 km altitude slices
  perigeeApogeeBufferKm: 100, // overlap tolerance for perigee/apogee filtering
} as const

export type ConjunctionConfig = typeof CONJUNCTION_CONFIG
