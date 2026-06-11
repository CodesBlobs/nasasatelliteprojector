import { describe, it, expect } from 'vitest'
import { AlertSeverity } from '@orbital/shared'
import { severityFromApproachKm, buildAlertFromConjunction } from './alert-generator'

describe('severityFromApproachKm', () => {
  it('returns CRITICAL at or below 1 km', () => {
    expect(severityFromApproachKm(1)).toBe(AlertSeverity.CRITICAL)
    expect(severityFromApproachKm(0.5)).toBe(AlertSeverity.CRITICAL)
    expect(severityFromApproachKm(0)).toBe(AlertSeverity.CRITICAL)
  })

  it('returns HIGH between 1 and 2 km', () => {
    expect(severityFromApproachKm(1.5)).toBe(AlertSeverity.HIGH)
    expect(severityFromApproachKm(2)).toBe(AlertSeverity.HIGH)
  })

  it('returns MEDIUM between 2 and 5 km', () => {
    expect(severityFromApproachKm(3)).toBe(AlertSeverity.MEDIUM)
    expect(severityFromApproachKm(5)).toBe(AlertSeverity.MEDIUM)
  })

  it('returns LOW between 5 and 10 km', () => {
    expect(severityFromApproachKm(7)).toBe(AlertSeverity.LOW)
    expect(severityFromApproachKm(10)).toBe(AlertSeverity.LOW)
  })

  it('returns INFO above 10 km', () => {
    expect(severityFromApproachKm(10.1)).toBe(AlertSeverity.INFO)
    expect(severityFromApproachKm(100)).toBe(AlertSeverity.INFO)
  })
})

describe('buildAlertFromConjunction', () => {
  const base = {
    id: 'conj-1',
    closestApproachKm: 0.5,
    relativeVelocityKmS: 14.3,
    predictedTime: new Date('2026-06-11T12:00:00Z'),
    satelliteA: { noradId: 25544, name: 'ISS (ZARYA)' },
    satelliteB: { noradId: 33591, name: 'COSMOS 2251 DEB' },
  }

  it('sets the conjunction id', () => {
    const alert = buildAlertFromConjunction(base)
    expect(alert.conjunctionId).toBe('conj-1')
  })

  it('derives severity from approach distance', () => {
    const alert = buildAlertFromConjunction(base)
    expect(alert.severity).toBe(AlertSeverity.CRITICAL)
  })

  it('formats sub-km miss distance in metres', () => {
    const alert = buildAlertFromConjunction(base)
    expect(alert.description).toContain('500 m')
  })

  it('formats km-scale miss distance in km', () => {
    const alert = buildAlertFromConjunction({ ...base, closestApproachKm: 3.5 })
    expect(alert.description).toContain('3.50 km')
  })

  it('includes both satellite names in title', () => {
    const alert = buildAlertFromConjunction(base)
    expect(alert.title).toContain('ISS (ZARYA)')
    expect(alert.title).toContain('COSMOS 2251 DEB')
  })

  it('includes NORAD IDs and relative velocity in description', () => {
    const alert = buildAlertFromConjunction(base)
    expect(alert.description).toContain('25544')
    expect(alert.description).toContain('33591')
    expect(alert.description).toContain('14.30 km/s')
  })

  it('includes predicted time in UTC in description', () => {
    const alert = buildAlertFromConjunction(base)
    expect(alert.description).toContain('2026-06-11 12:00 UTC')
  })
})
