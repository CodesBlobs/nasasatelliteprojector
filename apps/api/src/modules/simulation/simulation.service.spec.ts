import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { NotFoundException } from '@nestjs/common'
import { SimulationService, SIMULATION_QUEUE } from './simulation.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import { SimulationStatus } from '@orbital/shared'

const mockQueue = { add: vi.fn().mockResolvedValue({ id: 'job-1' }) }

const mockPrisma = {
  satellite: {
    findUnique: vi.fn(),
  },
  simulation: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}

describe('SimulationService', () => {
  let service: SimulationService

  beforeEach(async () => {
    vi.clearAllMocks()

    const module = await Test.createTestingModule({
      providers: [
        SimulationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(SIMULATION_QUEUE), useValue: mockQueue },
      ],
    }).compile()

    service = module.get(SimulationService)
  })

  describe('create', () => {
    const dto = {
      satelliteId: 'sat-1',
      deltaV: { x: 10, y: 0, z: 0 },
      windowHours: 24,
    }

    it('throws NotFoundException when satellite does not exist', async () => {
      mockPrisma.satellite.findUnique.mockResolvedValue(null)
      await expect(service.create(dto)).rejects.toThrow(NotFoundException)
    })

    it('creates simulation record with PENDING status', async () => {
      mockPrisma.satellite.findUnique.mockResolvedValue({ id: 'sat-1', name: 'TEST' })
      const created = {
        id: 'sim-1',
        satelliteId: 'sat-1',
        status: SimulationStatus.PENDING,
      }
      mockPrisma.simulation.create.mockResolvedValue(created)

      const result = await service.create(dto)

      expect(mockPrisma.simulation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            satelliteId: 'sat-1',
            deltaVx: 10,
            deltaVy: 0,
            deltaVz: 0,
            windowHours: 24,
            status: SimulationStatus.PENDING,
          }),
        }),
      )
      expect(result).toEqual(created)
    })

    it('enqueues a job after creating simulation', async () => {
      mockPrisma.satellite.findUnique.mockResolvedValue({ id: 'sat-1' })
      mockPrisma.simulation.create.mockResolvedValue({ id: 'sim-42' })

      await service.create(dto)

      expect(mockQueue.add).toHaveBeenCalledWith('run', { simulationId: 'sim-42' })
    })

    it('defaults windowHours to 24 when not provided', async () => {
      mockPrisma.satellite.findUnique.mockResolvedValue({ id: 'sat-1' })
      mockPrisma.simulation.create.mockResolvedValue({ id: 'sim-2' })

      await service.create({ satelliteId: 'sat-1', deltaV: { x: 5, y: 0, z: 0 } })

      expect(mockPrisma.simulation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ windowHours: 24 }),
        }),
      )
    })

    it('uses provided maneuverTime when given', async () => {
      mockPrisma.satellite.findUnique.mockResolvedValue({ id: 'sat-1' })
      mockPrisma.simulation.create.mockResolvedValue({ id: 'sim-3' })

      const iso = '2026-06-15T12:00:00.000Z'
      await service.create({ satelliteId: 'sat-1', deltaV: { x: 1, y: 0, z: 0 }, maneuverTime: iso })

      expect(mockPrisma.simulation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maneuverTime: new Date(iso),
          }),
        }),
      )
    })
  })

  describe('findOne', () => {
    it('throws NotFoundException when simulation does not exist', async () => {
      mockPrisma.simulation.findUnique.mockResolvedValue(null)
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException)
    })

    it('returns simulation when found', async () => {
      const sim = { id: 'sim-1', status: SimulationStatus.COMPLETED }
      mockPrisma.simulation.findUnique.mockResolvedValue(sim)
      const result = await service.findOne('sim-1')
      expect(result).toEqual(sim)
    })
  })

  describe('findWithResult', () => {
    it('includes result in returned record', async () => {
      const sim = {
        id: 'sim-1',
        status: SimulationStatus.COMPLETED,
        result: { id: 'res-1', newRiskScore: 12 },
      }
      mockPrisma.simulation.findUnique.mockResolvedValue(sim)
      const result = await service.findWithResult('sim-1')
      expect(result.result).toBeDefined()
    })

    it('throws NotFoundException when simulation does not exist', async () => {
      mockPrisma.simulation.findUnique.mockResolvedValue(null)
      await expect(service.findWithResult('missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('findBySatellite', () => {
    it('queries by satelliteId, most recent first, limited to 20', async () => {
      mockPrisma.simulation.findMany.mockResolvedValue([])
      await service.findBySatellite('sat-99')
      expect(mockPrisma.simulation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { satelliteId: 'sat-99' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      )
    })
  })
})
