import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import {
  createSatrec,
  propagateSatrec,
  propagateSatrecMultiple,
  type Satrec,
} from '@orbital/core'
import { SatelliteNotFoundException } from './exceptions/satellite-not-found.exception'
import { PropagationFailedException } from './exceptions/propagation-failed.exception'
import type { PropagatedPosition, OrbitTrack } from './interfaces/propagated-position.interface'

const ORBIT_POINTS = 100
const ORBIT_DURATION_MINUTES = 90
const ORBIT_INTERVAL_SECONDS = (ORBIT_DURATION_MINUTES * 60) / ORBIT_POINTS
const TLE_CACHE_TTL_MS = 30 * 60 * 1000

interface TleCacheEntry {
  line1: string
  line2: string
  satrec: Satrec
}

@Injectable()
export class PropagationService implements OnModuleInit {
  private readonly logger = new Logger(PropagationService.name)
  private tleCache = new Map<number, TleCacheEntry>()
  private tleCacheLoadedAt = 0

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.loadTleCache().catch((err) => this.logger.error('TLE cache pre-load failed', err))
  }

  private async loadTleCache(): Promise<void> {
    const PAGE = 5000
    let skip = 0
    const next = new Map<number, TleCacheEntry>()
    for (;;) {
      const rows = await this.prisma.satellite.findMany({
        skip,
        take: PAGE,
        orderBy: { noradId: 'asc' },
        include: { tle: { orderBy: { epoch: 'desc' }, take: 1, select: { line1: true, line2: true } } },
      })
      for (const sat of rows) {
        const tle = sat.tle[0]
        if (!tle) continue
        try {
          const satrec = createSatrec(tle.line1, tle.line2)
          next.set(sat.noradId, { line1: tle.line1, line2: tle.line2, satrec })
        } catch {
          // skip satellites with invalid TLEs
        }
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
    await this.ensureCache()
    const entry = this.tleCache.get(noradId)
    if (!entry) throw new SatelliteNotFoundException(noradId)

    const at = timestamp ?? new Date()
    try {
      const result = propagateSatrec(entry.satrec, at)
      return { noradId, timestamp: at.toISOString(), position: result.position, velocity: result.velocity }
    } catch (err) {
      throw new PropagationFailedException(err instanceof Error ? err.message : String(err))
    }
  }

  async getOrbit(noradId: number, startTime?: Date): Promise<OrbitTrack> {
    await this.ensureCache()
    const entry = this.tleCache.get(noradId)
    if (!entry) throw new SatelliteNotFoundException(noradId)

    const now = startTime ?? new Date()
    try {
      const points = propagateSatrecMultiple(entry.satrec, now, ORBIT_INTERVAL_SECONDS, ORBIT_POINTS)
      return {
        noradId,
        generatedAt: now.toISOString(),
        points: points.map((p) => ({
          timestamp: p.timestamp.toISOString(),
          position: p.position,
          velocity: p.velocity,
        })),
      }
    } catch (err) {
      throw new PropagationFailedException(err instanceof Error ? err.message : String(err))
    }
  }

  async getPositions(noradIds: number[], timestamp?: Date): Promise<PropagatedPosition[]> {
    if (noradIds.length === 0) return []
    await this.ensureCache()
    const at = timestamp ?? new Date()
    const ts = at.toISOString()

    const results: PropagatedPosition[] = []
    for (const noradId of noradIds) {
      const entry = this.tleCache.get(noradId)
      if (!entry) continue
      try {
        const result = propagateSatrec(entry.satrec, at)
        results.push({ noradId, timestamp: ts, position: result.position, velocity: result.velocity })
      } catch {
        // skip decayed / bad TLE
      }
    }
    return results
  }
}
