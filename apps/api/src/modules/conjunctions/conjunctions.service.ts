import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConjunctionStatus } from '@orbital/shared'
import { PrismaService } from '../../common/prisma/prisma.service'
import {
  DEFAULT_DETECTION_OPTIONS,
  classifySeverity,
  computeRiskScore,
  findCloseApproaches,
  parseTleOrbitalElements,
  type DetectionOptions,
  type TrackedObject,
} from './conjunction-detector'
import type { ScanMetrics } from './conjunction-detector'

export const CONJUNCTION_INCLUDE = {
  satelliteA: { select: { id: true, noradId: true, name: true, objectType: true } },
  satelliteB: { select: { id: true, noradId: true, name: true, objectType: true } },
} as const

export interface ScanSummary {
  scannedSatellites: number
  windowHours: number
  sampleMinutes: number
  thresholdKm: number
  eventsCreated: number
  durationMs: number
  metrics: ScanMetrics
}

@Injectable()
export class ConjunctionsService {
  private readonly logger = new Logger(ConjunctionsService.name)

  constructor(private prisma: PrismaService) {}

  async findAll(skip = 0, take = 100) {
    const [data, total] = await Promise.all([
      this.prisma.conjunctionEvent.findMany({
        skip,
        take: Math.min(take, 500),
        include: CONJUNCTION_INCLUDE,
        orderBy: { predictedTime: 'asc' },
      }),
      this.prisma.conjunctionEvent.count(),
    ])
    return { data, pagination: { total, skip, take: data.length } }
  }

  async findActive(skip = 0, take = 100) {
    const where = { status: { not: ConjunctionStatus.RESOLVED } }
    const [data, total] = await Promise.all([
      this.prisma.conjunctionEvent.findMany({
        where,
        skip,
        take: Math.min(take, 500),
        include: CONJUNCTION_INCLUDE,
        orderBy: { riskScore: 'desc' },
      }),
      this.prisma.conjunctionEvent.count({ where }),
    ])
    return { data, pagination: { total, skip, take: data.length } }
  }

  async getStats() {
    const [total, active, high, critical] = await Promise.all([
      this.prisma.conjunctionEvent.count(),
      this.prisma.conjunctionEvent.count({ where: { status: { not: ConjunctionStatus.RESOLVED } } }),
      this.prisma.conjunctionEvent.count({ where: { riskLevel: 'HIGH', status: { not: ConjunctionStatus.RESOLVED } } }),
      this.prisma.conjunctionEvent.count({ where: { riskLevel: 'CRITICAL', status: { not: ConjunctionStatus.RESOLVED } } }),
    ])
    return { total, active, high, critical }
  }

  async findManyByIds(ids: string[]) {
    return this.prisma.conjunctionEvent.findMany({
      where: { id: { in: ids } },
      include: CONJUNCTION_INCLUDE,
    })
  }

  async findOne(id: string) {
    const event = await this.prisma.conjunctionEvent.findUnique({
      where: { id },
      include: CONJUNCTION_INCLUDE,
    })
    if (!event) {
      throw new NotFoundException({
        statusCode: 404,
        message: `Conjunction event ${id} not found`,
        error: 'ConjunctionNotFound',
      })
    }
    return event
  }

  async runScan(options: DetectionOptions = DEFAULT_DETECTION_OPTIONS): Promise<ScanSummary> {
    const startedAt = Date.now()
    const startTime = new Date()

    const satellites = await this.prisma.satellite.findMany({
      include: { tle: { orderBy: { epoch: 'desc' }, take: 1 } },
    })

    const objects: TrackedObject[] = satellites
      .filter((s) => s.tle.length > 0)
      .map((s) => {
        const { perigeeKm, apogeeKm } = parseTleOrbitalElements(s.tle[0].line1, s.tle[0].line2)
        return {
          satelliteId: s.id,
          noradId: s.noradId,
          name: s.name,
          line1: s.tle[0].line1,
          line2: s.tle[0].line2,
          perigeeKm,
          apogeeKm,
        }
      })

    const { approaches, metrics } = findCloseApproaches(objects, startTime, options)

    // Delete previous predicted events and create new ones atomically.
    // Conjunctions with status CONFIRMED or MONITORED are kept (operator-reviewed).
    await this.prisma.$transaction([
      this.prisma.conjunctionEvent.deleteMany({
        where: { status: ConjunctionStatus.PREDICTED },
      }),
      this.prisma.conjunctionEvent.createMany({
        data: approaches.map((a) => ({
          satelliteAId: a.satelliteAId,
          satelliteBId: a.satelliteBId,
          closestApproachKm: a.closestApproachKm,
          relativeVelocityKmS: a.relativeVelocityKmS,
          predictedTime: a.predictedTime,
          riskScore: computeRiskScore(a.closestApproachKm, options.thresholdKm),
          riskLevel: classifySeverity(a.closestApproachKm),
          status: ConjunctionStatus.PREDICTED,
        })),
      }),
    ])

    const summary: ScanSummary = {
      scannedSatellites: objects.length,
      windowHours: options.windowHours,
      sampleMinutes: options.sampleMinutes,
      thresholdKm: options.thresholdKm,
      eventsCreated: approaches.length,
      durationMs: Date.now() - startedAt,
      metrics,
    }

    this.logger.log(
      `Conjunction scan: ${metrics.satellitesScanned} sats, ` +
        `${metrics.candidatePairs} pairs (${metrics.reductionPercent}% reduction vs naive), ` +
        `${metrics.conjunctionsFound} conjunctions in ${metrics.durationMs}ms`,
    )

    return summary
  }
}
