import { Injectable, NotFoundException } from '@nestjs/common'
import { AlertStatus } from '@orbital/shared'
import { PrismaService } from '../../common/prisma/prisma.service'
import { buildAlertFromConjunction, type ConjunctionForAlert } from './alert-generator'

const ALERT_INCLUDE = {
  conjunction: {
    include: {
      satelliteA: { select: { id: true, noradId: true, name: true, objectType: true } },
      satelliteB: { select: { id: true, noradId: true, name: true, objectType: true } },
    },
  },
} as const

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.alert.findMany({
      include: ALERT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  findOpen() {
    return this.prisma.alert.findMany({
      where: { status: AlertStatus.OPEN },
      include: ALERT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  findCritical() {
    return this.prisma.alert.findMany({
      where: { severity: 'CRITICAL' },
      include: ALERT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id }, include: ALERT_INCLUDE })
    if (!alert) throw new NotFoundException(`Alert ${id} not found`)
    return alert
  }

  async acknowledge(id: string) {
    await this.findOne(id)
    return this.prisma.alert.update({
      where: { id },
      data: { status: AlertStatus.ACKNOWLEDGED, acknowledgedAt: new Date() },
      include: ALERT_INCLUDE,
    })
  }

  async resolve(id: string) {
    await this.findOne(id)
    return this.prisma.alert.update({
      where: { id },
      data: { status: AlertStatus.RESOLVED, resolvedAt: new Date() },
      include: ALERT_INCLUDE,
    })
  }

  async dismiss(id: string) {
    await this.findOne(id)
    return this.prisma.alert.update({
      where: { id },
      data: { status: AlertStatus.DISMISSED },
      include: ALERT_INCLUDE,
    })
  }

  /**
   * Generate alerts for the given conjunction events.
   * Skips conjunctions that already have an open or acknowledged alert to
   * avoid duplicates across consecutive scans.
   */
  async generateForConjunctions(conjunctions: ConjunctionForAlert[]): Promise<number> {
    if (conjunctions.length === 0) return 0

    // Find which conjunctionIds already have an active alert
    const existing = await this.prisma.alert.findMany({
      where: {
        conjunctionId: { in: conjunctions.map((c) => c.id) },
        status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
      },
      select: { conjunctionId: true },
    })
    const alreadyAlerted = new Set(existing.map((e) => e.conjunctionId))

    const toCreate = conjunctions
      .filter((c) => !alreadyAlerted.has(c.id))
      .map((c) => buildAlertFromConjunction(c))

    if (toCreate.length === 0) return 0

    await this.prisma.alert.createMany({ data: toCreate })
    return toCreate.length
  }

  async getStats() {
    const [open, critical, acknowledged] = await Promise.all([
      this.prisma.alert.count({ where: { status: AlertStatus.OPEN } }),
      this.prisma.alert.count({ where: { severity: 'CRITICAL' } }),
      this.prisma.alert.count({ where: { status: AlertStatus.ACKNOWLEDGED } }),
    ])
    return { open, critical, acknowledged }
  }
}
