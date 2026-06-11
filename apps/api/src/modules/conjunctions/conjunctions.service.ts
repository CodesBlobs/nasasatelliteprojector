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

  async findAll() {
    return this.prisma.conjunctionEvent.findMany({
      include: CONJUNCTION_INCLUDE,
      orderBy: { predictedTime: 'asc' },
    })
  }

  async findActive() {
    return this.prisma.conjunctionEvent.findMany({
      where: { status: { not: ConjunctionStatus.RESOLVED } },
      include: CONJUNCTION_INCLUDE,
      orderBy: { predictedTime: 'asc' },
    })
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
