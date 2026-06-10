import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConjunctionStatus } from '@orbital/shared'
import { PrismaService } from '../../common/prisma/prisma.service'
import {
  DEFAULT_DETECTION_OPTIONS,
  classifySeverity,
  computeRiskScore,
  findCloseApproaches,
  type TrackedObject,
} from './conjunction-detector'

const SATELLITE_SUMMARY = {
  select: { id: true, noradId: true, name: true, objectType: true },
} as const

const CONJUNCTION_INCLUDE = {
  satelliteA: SATELLITE_SUMMARY,
  satelliteB: SATELLITE_SUMMARY,
} as const

export interface ScanSummary {
  scannedSatellites: number
  windowHours: number
  sampleMinutes: number
  thresholdKm: number
  eventsCreated: number
  durationMs: number
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

  /**
   * Scans all satellites with a TLE for close approaches over the detection
   * window and replaces previously predicted (still unconfirmed) events.
   */
  async runScan(options = DEFAULT_DETECTION_OPTIONS): Promise<ScanSummary> {
    const startedAt = Date.now()
    const startTime = new Date()

    const satellites = await this.prisma.satellite.findMany({
      include: { tle: { orderBy: { epoch: 'desc' }, take: 1 } },
    })

    const objects: TrackedObject[] = satellites
      .filter((s) => s.tle.length > 0)
      .map((s) => ({
        satelliteId: s.id,
        noradId: s.noradId,
        name: s.name,
        line1: s.tle[0].line1,
        line2: s.tle[0].line2,
      }))

    const approaches = findCloseApproaches(objects, startTime, options)

    await this.prisma.$transaction([
      this.prisma.conjunctionEvent.deleteMany({
        where: { status: ConjunctionStatus.PREDICTED },
      }),
      ...approaches.map((a) =>
        this.prisma.conjunctionEvent.create({
          data: {
            satelliteAId: a.satelliteAId,
            satelliteBId: a.satelliteBId,
            closestApproachKm: a.closestApproachKm,
            relativeVelocityKmS: a.relativeVelocityKmS,
            predictedTime: a.predictedTime,
            riskScore: computeRiskScore(a.closestApproachKm, options.thresholdKm),
            riskLevel: classifySeverity(a.closestApproachKm),
            status: ConjunctionStatus.PREDICTED,
          },
        }),
      ),
    ])

    const summary: ScanSummary = {
      scannedSatellites: objects.length,
      windowHours: options.windowHours,
      sampleMinutes: options.sampleMinutes,
      thresholdKm: options.thresholdKm,
      eventsCreated: approaches.length,
      durationMs: Date.now() - startedAt,
    }

    this.logger.log(
      `Conjunction scan: ${summary.scannedSatellites} satellites, ` +
        `${summary.eventsCreated} events in ${summary.durationMs}ms`,
    )

    return summary
  }
}
