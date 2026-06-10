import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ConjunctionsService } from './conjunctions.service'
import { PrismaService } from '../../common/prisma/prisma.service'

const ISS_LINE1 = '1 25544U 98067A   26160.50000000  .00016717  00000-0  29770-3 0  9002'
const ISS_LINE2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

function satelliteWithTle(id: string, noradId: number) {
  return {
    id,
    noradId,
    name: `SAT ${noradId}`,
    operator: null,
    country: null,
    objectType: 'Payload',
    createdAt: new Date(),
    updatedAt: new Date(),
    tle: [
      {
        id: `tle-${id}`,
        satelliteId: id,
        line1: ISS_LINE1,
        line2: ISS_LINE2,
        epoch: new Date('2026-06-09T12:00:00Z'),
        createdAt: new Date(),
      },
    ],
  }
}

describe('ConjunctionsService', () => {
  let service: ConjunctionsService
  let prisma: {
    satellite: { findMany: ReturnType<typeof vi.fn> }
    conjunctionEvent: {
      findMany: ReturnType<typeof vi.fn>
      findUnique: ReturnType<typeof vi.fn>
      deleteMany: ReturnType<typeof vi.fn>
      create: ReturnType<typeof vi.fn>
    }
    $transaction: ReturnType<typeof vi.fn>
  }

  beforeEach(async () => {
    prisma = {
      satellite: { findMany: vi.fn() },
      conjunctionEvent: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        deleteMany: vi.fn().mockReturnValue('deleteMany-op'),
        create: vi.fn((args) => args),
      },
      $transaction: vi.fn().mockResolvedValue([]),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [ConjunctionsService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<ConjunctionsService>(ConjunctionsService)
  })

  describe('runScan', () => {
    it('creates a conjunction event for satellites on identical orbits', async () => {
      prisma.satellite.findMany.mockResolvedValue([
        satelliteWithTle('sat-a', 25544),
        satelliteWithTle('sat-b', 90001),
      ])

      const summary = await service.runScan({ windowHours: 1, sampleMinutes: 5, thresholdKm: 10 })

      expect(summary.scannedSatellites).toBe(2)
      expect(summary.eventsCreated).toBe(1)

      expect(prisma.conjunctionEvent.create).toHaveBeenCalledTimes(1)
      const { data } = prisma.conjunctionEvent.create.mock.calls[0][0]
      expect(data.satelliteAId).toBe('sat-a')
      expect(data.satelliteBId).toBe('sat-b')
      expect(data.closestApproachKm).toBeLessThan(0.001)
      expect(data.riskLevel).toBe('CRITICAL')
      expect(data.riskScore).toBeGreaterThan(99)
      expect(data.status).toBe('PREDICTED')
    })

    it('replaces previously predicted events in the same transaction', async () => {
      prisma.satellite.findMany.mockResolvedValue([
        satelliteWithTle('sat-a', 25544),
        satelliteWithTle('sat-b', 90001),
      ])

      await service.runScan({ windowHours: 1, sampleMinutes: 5, thresholdKm: 10 })

      expect(prisma.conjunctionEvent.deleteMany).toHaveBeenCalledWith({
        where: { status: 'PREDICTED' },
      })
      const transactionOps = prisma.$transaction.mock.calls[0][0]
      expect(transactionOps[0]).toBe('deleteMany-op')
      expect(transactionOps).toHaveLength(2)
    })

    it('skips satellites without a TLE', async () => {
      const noTle = { ...satelliteWithTle('sat-x', 90009), tle: [] }
      prisma.satellite.findMany.mockResolvedValue([noTle])

      const summary = await service.runScan({ windowHours: 1, sampleMinutes: 5, thresholdKm: 10 })

      expect(summary.scannedSatellites).toBe(0)
      expect(summary.eventsCreated).toBe(0)
    })
  })

  describe('findOne', () => {
    it('throws NotFoundException for an unknown event', async () => {
      prisma.conjunctionEvent.findUnique.mockResolvedValue(null)
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException)
    })
  })
})
