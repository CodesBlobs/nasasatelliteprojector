import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { propagateSatellite, propagateMultiple } from '@orbital/core'
import { SatelliteNotFoundException } from './exceptions/satellite-not-found.exception'
import { PropagationFailedException } from './exceptions/propagation-failed.exception'
import type { PropagatedPosition, OrbitTrack } from './interfaces/propagated-position.interface'

const ORBIT_POINTS = 100
const ORBIT_DURATION_MINUTES = 90
const ORBIT_INTERVAL_SECONDS = (ORBIT_DURATION_MINUTES * 60) / ORBIT_POINTS

@Injectable()
export class PropagationService {
  constructor(private prisma: PrismaService) {}

  async getPosition(noradId: number, timestamp?: Date): Promise<PropagatedPosition> {
    const { satellite, tle } = await this.fetchSatelliteWithTle(noradId)
    const at = timestamp ?? new Date()

    let result
    try {
      result = propagateSatellite(tle.line1, tle.line2, at)
    } catch (err) {
      throw new PropagationFailedException(err instanceof Error ? err.message : String(err))
    }

    return {
      noradId: satellite.noradId,
      timestamp: at.toISOString(),
      position: result.position,
      velocity: result.velocity,
    }
  }

  async getOrbit(noradId: number, startTime?: Date): Promise<OrbitTrack> {
    const { satellite, tle } = await this.fetchSatelliteWithTle(noradId)
    const now = startTime ?? new Date()

    let points
    try {
      points = propagateMultiple(tle.line1, tle.line2, now, ORBIT_INTERVAL_SECONDS, ORBIT_POINTS)
    } catch (err) {
      throw new PropagationFailedException(err instanceof Error ? err.message : String(err))
    }

    return {
      noradId: satellite.noradId,
      generatedAt: now.toISOString(),
      points: points.map((p) => ({
        timestamp: p.timestamp.toISOString(),
        position: p.position,
        velocity: p.velocity,
      })),
    }
  }

  async getPositions(noradIds: number[], timestamp?: Date): Promise<PropagatedPosition[]> {
    if (noradIds.length === 0) return []
    const at = timestamp ?? new Date()

    const satellites = await this.prisma.satellite.findMany({
      where: { noradId: { in: noradIds } },
      include: { tle: { orderBy: { epoch: 'desc' }, take: 1 } },
    })

    const results: PropagatedPosition[] = []
    for (const satellite of satellites) {
      const tle = satellite.tle[0]
      if (!tle) continue
      try {
        const result = propagateSatellite(tle.line1, tle.line2, at)
        results.push({
          noradId: satellite.noradId,
          timestamp: at.toISOString(),
          position: result.position,
          velocity: result.velocity,
        })
      } catch {
        // Skip satellites that fail propagation
      }
    }
    return results
  }

  private async fetchSatelliteWithTle(noradId: number) {
    const satellite = await this.prisma.satellite.findUnique({
      where: { noradId },
      include: { tle: { orderBy: { epoch: 'desc' }, take: 1 } },
    })

    if (!satellite) {
      throw new SatelliteNotFoundException(noradId)
    }

    const tle = satellite.tle[0]
    if (!tle) {
      throw new PropagationFailedException(`No TLE data available for NORAD ID ${noradId}`)
    }

    return { satellite, tle }
  }
}
