import { Test, TestingModule } from '@nestjs/testing'
import { PropagationService } from './propagation.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import { SatelliteNotFoundException } from './exceptions/satellite-not-found.exception'
import { PropagationFailedException } from './exceptions/propagation-failed.exception'

// Real ISS TLE (epoch 2023 day 1)
const ISS_LINE1 = '1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005'
const ISS_LINE2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

const mockSatelliteWithTle = {
  id: 'sat-1',
  noradId: 25544,
  name: 'ISS (ZARYA)',
  operator: 'NASA',
  country: 'USA',
  objectType: 'Payload',
  createdAt: new Date(),
  updatedAt: new Date(),
  tle: [
    {
      id: 'tle-1',
      satelliteId: 'sat-1',
      line1: ISS_LINE1,
      line2: ISS_LINE2,
      epoch: new Date('2023-01-01T00:00:00Z'),
      createdAt: new Date(),
    },
  ],
}

describe('PropagationService', () => {
  let service: PropagationService
  let prisma: { satellite: { findUnique: ReturnType<typeof vi.fn> } }

  beforeEach(async () => {
    prisma = {
      satellite: { findUnique: vi.fn() },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropagationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    service = module.get<PropagationService>(PropagationService)
  })

  // Fixed timestamp near the TLE epoch (2023-01-01) so SGP4 produces valid results
  const nearEpoch = new Date('2023-01-01T12:00:00Z')

  describe('getPosition', () => {
    it('returns position and velocity for a valid satellite', async () => {
      prisma.satellite.findUnique.mockResolvedValue(mockSatelliteWithTle)

      const result = await service.getPosition(25544, nearEpoch)

      expect(result.noradId).toBe(25544)
      expect(result.timestamp).toBeDefined()
      expect(typeof result.position.x).toBe('number')
      expect(typeof result.position.y).toBe('number')
      expect(typeof result.position.z).toBe('number')
      expect(typeof result.velocity.x).toBe('number')
      expect(typeof result.velocity.y).toBe('number')
      expect(typeof result.velocity.z).toBe('number')
    })

    it('propagates to a specific timestamp', async () => {
      prisma.satellite.findUnique.mockResolvedValue(mockSatelliteWithTle)
      const at = new Date('2023-01-01T12:00:00Z')

      const result = await service.getPosition(25544, at)

      expect(result.timestamp).toBe(at.toISOString())
    })

    it('returns non-zero position components for ISS', async () => {
      prisma.satellite.findUnique.mockResolvedValue(mockSatelliteWithTle)

      const result = await service.getPosition(25544, nearEpoch)

      // ISS orbits at ~400 km altitude, so ECI position magnitude should be ~6800 km
      const mag = Math.sqrt(result.position.x ** 2 + result.position.y ** 2 + result.position.z ** 2)
      expect(mag).toBeGreaterThan(6000)
      expect(mag).toBeLessThan(8000)
    })

    it('throws SatelliteNotFoundException when satellite not found', async () => {
      prisma.satellite.findUnique.mockResolvedValue(null)

      await expect(service.getPosition(99999)).rejects.toThrow(SatelliteNotFoundException)
    })

    it('throws PropagationFailedException when no TLE exists', async () => {
      prisma.satellite.findUnique.mockResolvedValue({ ...mockSatelliteWithTle, tle: [] })

      await expect(service.getPosition(25544)).rejects.toThrow(PropagationFailedException)
    })

    it('throws PropagationFailedException for malformed TLE lines', async () => {
      const badTle = { ...mockSatelliteWithTle, tle: [{ ...mockSatelliteWithTle.tle[0], line1: 'bad', line2: 'bad' }] }
      prisma.satellite.findUnique.mockResolvedValue(badTle)

      await expect(service.getPosition(25544)).rejects.toThrow(PropagationFailedException)
    })
  })

  describe('getOrbit', () => {
    it('returns exactly 100 orbit points', async () => {
      prisma.satellite.findUnique.mockResolvedValue(mockSatelliteWithTle)

      const result = await service.getOrbit(25544, nearEpoch)

      expect(result.points).toHaveLength(100)
    })

    it('includes noradId and generatedAt in orbit response', async () => {
      prisma.satellite.findUnique.mockResolvedValue(mockSatelliteWithTle)

      const result = await service.getOrbit(25544, nearEpoch)

      expect(result.noradId).toBe(25544)
      expect(result.generatedAt).toBeDefined()
    })

    it('each orbit point has timestamp, position, and velocity', async () => {
      prisma.satellite.findUnique.mockResolvedValue(mockSatelliteWithTle)

      const result = await service.getOrbit(25544, nearEpoch)
      const point = result.points[0]

      expect(point.timestamp).toBeDefined()
      expect(typeof point.position.x).toBe('number')
      expect(typeof point.position.y).toBe('number')
      expect(typeof point.position.z).toBe('number')
      expect(typeof point.velocity.x).toBe('number')
      expect(typeof point.velocity.y).toBe('number')
      expect(typeof point.velocity.z).toBe('number')
    })

    it('orbit points span approximately 90 minutes', async () => {
      prisma.satellite.findUnique.mockResolvedValue(mockSatelliteWithTle)

      const result = await service.getOrbit(25544, nearEpoch)

      const first = new Date(result.points[0].timestamp).getTime()
      const last = new Date(result.points[99].timestamp).getTime()
      const spanMinutes = (last - first) / 1000 / 60

      // 99 intervals of 54s = 89.1 minutes (close to 90)
      expect(spanMinutes).toBeGreaterThan(88)
      expect(spanMinutes).toBeLessThan(91)
    })

    it('throws SatelliteNotFoundException when satellite not found', async () => {
      prisma.satellite.findUnique.mockResolvedValue(null)

      await expect(service.getOrbit(99999)).rejects.toThrow(SatelliteNotFoundException)
    })

    it('throws PropagationFailedException when no TLE exists', async () => {
      prisma.satellite.findUnique.mockResolvedValue({ ...mockSatelliteWithTle, tle: [] })

      await expect(service.getOrbit(25544)).rejects.toThrow(PropagationFailedException)
    })
  })
})
