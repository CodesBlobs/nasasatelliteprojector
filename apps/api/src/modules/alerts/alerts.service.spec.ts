import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { AlertStatus, AlertSeverity } from '@orbital/shared'
import { AlertsService } from './alerts.service'
import type { ConjunctionForAlert } from './alert-generator'

function makePrismaMock() {
  return {
    alert: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
    },
  }
}

const conjunctionA: ConjunctionForAlert = {
  id: 'c-1',
  closestApproachKm: 0.8,
  relativeVelocityKmS: 14.3,
  predictedTime: new Date('2026-06-11T12:00:00Z'),
  satelliteA: { noradId: 25544, name: 'ISS' },
  satelliteB: { noradId: 33591, name: 'DEB-1' },
}

describe('AlertsService', () => {
  let service: AlertsService
  let prisma: ReturnType<typeof makePrismaMock>

  beforeEach(() => {
    prisma = makePrismaMock()
    service = new AlertsService(prisma as never)
  })

  describe('findOne', () => {
    it('returns alert when found', async () => {
      const mockAlert = { id: 'a-1', status: 'OPEN' }
      prisma.alert.findUnique.mockResolvedValue(mockAlert)
      await expect(service.findOne('a-1')).resolves.toEqual(mockAlert)
    })

    it('throws NotFoundException when not found', async () => {
      prisma.alert.findUnique.mockResolvedValue(null)
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('acknowledge', () => {
    it('updates status to ACKNOWLEDGED', async () => {
      const mockAlert = { id: 'a-1', status: AlertStatus.OPEN }
      const updated = { ...mockAlert, status: AlertStatus.ACKNOWLEDGED }
      prisma.alert.findUnique.mockResolvedValue(mockAlert)
      prisma.alert.update.mockResolvedValue(updated)

      const result = await service.acknowledge('a-1')
      expect(prisma.alert.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: AlertStatus.ACKNOWLEDGED }) }),
      )
      expect(result.status).toBe(AlertStatus.ACKNOWLEDGED)
    })
  })

  describe('generateForConjunctions', () => {
    it('returns 0 for empty input', async () => {
      await expect(service.generateForConjunctions([])).resolves.toBe(0)
      expect(prisma.alert.findMany).not.toHaveBeenCalled()
    })

    it('creates alerts for new conjunctions', async () => {
      prisma.alert.findMany.mockResolvedValue([])
      prisma.alert.createMany.mockResolvedValue({ count: 1 })

      const created = await service.generateForConjunctions([conjunctionA])
      expect(created).toBe(1)
      expect(prisma.alert.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ conjunctionId: 'c-1', severity: AlertSeverity.CRITICAL }),
          ]),
        }),
      )
    })

    it('skips conjunctions that already have active alerts', async () => {
      prisma.alert.findMany.mockResolvedValue([{ conjunctionId: 'c-1' }])

      const created = await service.generateForConjunctions([conjunctionA])
      expect(created).toBe(0)
      expect(prisma.alert.createMany).not.toHaveBeenCalled()
    })
  })

  describe('getStats', () => {
    it('returns open, critical, and acknowledged counts', async () => {
      prisma.alert.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)

      const stats = await service.getStats()
      expect(stats).toEqual({ open: 5, critical: 2, acknowledged: 3 })
    })
  })
})
