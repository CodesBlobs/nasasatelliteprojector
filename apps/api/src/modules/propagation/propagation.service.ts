import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { propagateSatellite, propagateMultiple } from '@orbital/core'
import { SatelliteNotFoundException } from './exceptions/satellite-not-found.exception'
import { PropagationFailedException } from './exceptions/propagation-failed.exception'
import type { PropagatedPosition, OrbitTrack } from './interfaces/propagated-position.interface'

const ORBIT_POINTS = 100
const ORBIT_DURATION_MINUTES = 90
const ORBIT_INTERVAL_SECONDS = (ORBIT_DURATION_MINUTES * 60) / ORBIT_POINTS
// Refresh the in-memory TLE cache every 30 minutes
const TLE_CACHE_TTL_MS = 30 * 60 * 1000

@Injectable()
export class PropagationService implements OnModuleInit {
  private readonly logger = new Logger(PropagationService.name)
  private tleCache = new Map<number, { line1: string; line2: string }>()
  private tleCacheLoadedAt = 0

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.loadTleCache().catch((err) => this.logger.error('TLE cache pre-load failed', err))
  }

  private async loadTleCache(): Promise<void> {
    const PAGE = 5000
    let skip = 0
    const next = new Map<number, { line1: string; line2: string }>()
    for (;;) {
      const rows = await this.prisma.satellite.findMany({
        skip,
        take: PAGE,
        include: { tle: { orderBy: { epoch: 'desc' }, take: 1, select: { line1: true, line2: true } } },
      })
      for (const sat of rows) {
        if (sat.tle[0]) next.set(sat.noradId, { line1: sat.tle[0].line1, line2: sat.tle[0].line2 })
      }
      skip += PAGE
      if (rows.length < PAGE) break
    }
    this.tleCache = next
    this.tleCacheLoadedAt = Date.now()
    this.logger.log(`TLE cache loaded: ${this.tleCache.size} satellites`)
  }

  private async ensureCache(): Promise<void> {
    if (Date.now() - this.tleCacheLoadedAt > TLE_CACHE_TTL_MS) {
      await this.loadTleCache()
    }
  }

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
    await this.ensureCache()
    const at = timestamp ?? new Date()
    const ts = at.toISOString()

    const results: PropagatedPosition[] = []
    for (const noradId of noradIds) {
      const tle = this.tleCache.get(noradId)
      if (!tle) continue
      try {
        const result = propagateSatellite(tle.line1, tle.line2, at)
        results.push({ noradId, timestamp: ts, position: result.position, velocity: result.velocity })
      } catch {
        // skip decayed / bad TLE
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
