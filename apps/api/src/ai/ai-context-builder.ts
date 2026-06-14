import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'

@Injectable()
export class AiContextBuilder {
  constructor(private prisma: PrismaService) {}

  async buildBriefingContext(): Promise<string> {
    const [satelliteCount, activeSatellites, activeConjunctions, recentAlerts, latestTle] =
      await Promise.all([
        this.prisma.satellite.count(),
        this.prisma.satellite.count({ where: { tle: { some: {} } } }),
        this.prisma.conjunctionEvent.findMany({
          where: { status: { not: 'RESOLVED' } },
          include: {
            satelliteA: { select: { noradId: true, name: true, objectType: true } },
            satelliteB: { select: { noradId: true, name: true, objectType: true } },
          },
          orderBy: { riskScore: 'desc' },
          take: 10,
        }),
        this.prisma.alert.findMany({
          where: { status: { not: 'RESOLVED' } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        this.prisma.tLE.findFirst({
          orderBy: { epoch: 'desc' },
          select: { epoch: true },
        }),
      ])

    return JSON.stringify(
      {
        currentTime: new Date().toISOString(),
        fleet: {
          totalSatellites: satelliteCount,
          satellitesWithTle: activeSatellites,
          latestTleEpoch: latestTle?.epoch ?? null,
        },
        activeConjunctions: activeConjunctions.map((c) => ({
          id: c.id,
          satelliteA: c.satelliteA,
          satelliteB: c.satelliteB,
          closestApproachKm: c.closestApproachKm,
          relativeVelocityKmS: c.relativeVelocityKmS,
          predictedTime: c.predictedTime,
          riskScore: c.riskScore,
          riskLevel: c.riskLevel,
          status: c.status,
        })),
        recentAlerts: recentAlerts.map((a) => ({
          id: a.id,
          severity: a.severity,
          title: a.title,
          description: a.description,
          status: a.status,
          createdAt: a.createdAt,
        })),
      },
      null,
      2,
    )
  }

  async buildConjunctionContext(conjunctionId: string): Promise<string | null> {
    const conjunction = await this.prisma.conjunctionEvent.findUnique({
      where: { id: conjunctionId },
      include: {
        satelliteA: {
          include: { tle: { orderBy: { epoch: 'desc' }, take: 1, select: { epoch: true } } },
        },
        satelliteB: {
          include: { tle: { orderBy: { epoch: 'desc' }, take: 1, select: { epoch: true } } },
        },
        alerts: { select: { severity: true, title: true, status: true } },
      },
    })

    if (!conjunction) return null

    return JSON.stringify(
      {
        conjunction: {
          id: conjunction.id,
          closestApproachKm: conjunction.closestApproachKm,
          relativeVelocityKmS: conjunction.relativeVelocityKmS,
          predictedTime: conjunction.predictedTime,
          riskScore: conjunction.riskScore,
          riskLevel: conjunction.riskLevel,
          status: conjunction.status,
          createdAt: conjunction.createdAt,
        },
        satelliteA: {
          id: conjunction.satelliteA.id,
          noradId: conjunction.satelliteA.noradId,
          name: conjunction.satelliteA.name,
          objectType: conjunction.satelliteA.objectType,
          tleEpoch: conjunction.satelliteA.tle[0]?.epoch ?? null,
        },
        satelliteB: {
          id: conjunction.satelliteB.id,
          noradId: conjunction.satelliteB.noradId,
          name: conjunction.satelliteB.name,
          objectType: conjunction.satelliteB.objectType,
          tleEpoch: conjunction.satelliteB.tle[0]?.epoch ?? null,
        },
        relatedAlerts: conjunction.alerts,
      },
      null,
      2,
    )
  }

  async buildAlertContext(alertId: string): Promise<string | null> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        conjunction: {
          include: {
            satelliteA: { select: { noradId: true, name: true, objectType: true } },
            satelliteB: { select: { noradId: true, name: true, objectType: true } },
          },
        },
      },
    })

    if (!alert) return null

    return JSON.stringify(
      {
        alert: {
          id: alert.id,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          status: alert.status,
          createdAt: alert.createdAt,
          acknowledgedAt: alert.acknowledgedAt,
        },
        conjunction: alert.conjunction
          ? {
              id: alert.conjunction.id,
              closestApproachKm: alert.conjunction.closestApproachKm,
              relativeVelocityKmS: alert.conjunction.relativeVelocityKmS,
              predictedTime: alert.conjunction.predictedTime,
              riskScore: alert.conjunction.riskScore,
              riskLevel: alert.conjunction.riskLevel,
              satelliteA: alert.conjunction.satelliteA,
              satelliteB: alert.conjunction.satelliteB,
            }
          : null,
      },
      null,
      2,
    )
  }

  async buildSimulationContext(simulationId: string): Promise<string | null> {
    const simulation = await this.prisma.simulation.findUnique({
      where: { id: simulationId },
      include: {
        satellite: {
          include: { tle: { orderBy: { epoch: 'desc' }, take: 1, select: { epoch: true } } },
        },
        result: true,
      },
    })

    if (!simulation) return null

    const dvMag = Math.sqrt(
      simulation.deltaVx ** 2 + simulation.deltaVy ** 2 + simulation.deltaVz ** 2,
    )

    return JSON.stringify(
      {
        simulation: {
          id: simulation.id,
          status: simulation.status,
          deltaV: {
            x: simulation.deltaVx,
            y: simulation.deltaVy,
            z: simulation.deltaVz,
            magnitudeKmS: dvMag,
          },
          maneuverTime: simulation.maneuverTime,
          windowHours: simulation.windowHours,
          createdAt: simulation.createdAt,
        },
        satellite: {
          id: simulation.satellite.id,
          noradId: simulation.satellite.noradId,
          name: simulation.satellite.name,
          objectType: simulation.satellite.objectType,
          tleEpoch: simulation.satellite.tle[0]?.epoch ?? null,
        },
        result: simulation.result
          ? {
              conjunctionsRemoved: simulation.result.conjunctionsRemoved,
              conjunctionsCreated: simulation.result.conjunctionsCreated,
              closestApproachBefore: simulation.result.closestApproachBefore,
              closestApproachAfter: simulation.result.closestApproachAfter,
              riskReductionPercent: simulation.result.riskReductionPercent,
              oldRiskScore: simulation.result.oldRiskScore,
              newRiskScore: simulation.result.newRiskScore,
              fuelEstimateKg: simulation.result.fuelEstimateKg,
              deltaVMagnitudeMs: simulation.result.deltaVMagnitudeMs,
              createdAt: simulation.result.createdAt,
            }
          : null,
      },
      null,
      2,
    )
  }

  async buildChatContext(): Promise<string> {
    const [satelliteCount, activeConjunctionCount, openAlertCount, topConjunctions, recentAlerts] =
      await Promise.all([
        this.prisma.satellite.count(),
        this.prisma.conjunctionEvent.count({ where: { status: { not: 'RESOLVED' } } }),
        this.prisma.alert.count({ where: { status: 'OPEN' } }),
        this.prisma.conjunctionEvent.findMany({
          where: { status: { not: 'RESOLVED' } },
          include: {
            satelliteA: { select: { noradId: true, name: true, objectType: true } },
            satelliteB: { select: { noradId: true, name: true, objectType: true } },
          },
          orderBy: { riskScore: 'desc' },
          take: 20,
        }),
        this.prisma.alert.findMany({
          where: { status: { not: 'RESOLVED' } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ])

    return JSON.stringify(
      {
        currentTime: new Date().toISOString(),
        systemState: {
          totalSatellites: satelliteCount,
          activeConjunctions: activeConjunctionCount,
          openAlerts: openAlertCount,
        },
        highestRiskConjunctions: topConjunctions.map((c) => ({
          id: c.id,
          satelliteA: c.satelliteA,
          satelliteB: c.satelliteB,
          closestApproachKm: c.closestApproachKm,
          relativeVelocityKmS: c.relativeVelocityKmS,
          predictedTime: c.predictedTime,
          riskScore: c.riskScore,
          riskLevel: c.riskLevel,
          status: c.status,
        })),
        recentAlerts: recentAlerts.map((a) => ({
          id: a.id,
          severity: a.severity,
          title: a.title,
          description: a.description,
          status: a.status,
          createdAt: a.createdAt,
        })),
      },
      null,
      2,
    )
  }
}
