import { Test, TestingModule } from '@nestjs/testing'
import { PropagationService } from './propagation.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import { SatelliteNotFoundException } from './exceptions/satellite-not-found.exception'
import { PropagationFailedException } from './exceptions/propagation-failed.exception'

const ISS_LINE1 = '1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005'
const ISS_LINE2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

// Shape returned by loadTleCache's findMany call
const cacheSat = { noradId: 25544, tle: [{ line1: ISS_LINE1, line2: ISS_LINE2 }] }

describe('PropagationService', () => {
  let service: PropagationService
  let prisma: { satellite: { findMany: ReturnType<typeof vi.fn> } }

  const nearEpoch = new Date('2023-01-01T12:00:00Z')

  beforeEach(async () => {
    // Default: empty cache — individual tests override as needed
    prisma = { satellite: { findMany: vi.fn().mockResolvedValue([]) } }

    const module: TestingModule = await Test.createTestingModule({
      providers: [PropagationService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<PropagationService>(PropagationService)
    // Force cache expiry so ensureCache() triggers loadTleCache() on every test call
    ;(service as any).tleCacheLoadedAt = 0
  })

  describe('getPosition', () => {
    it('returns position and velocity for a valid satellite', async () => {
      prisma.satellite.findMany.mockResolvedValueOnce([cacheSat])

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
      prisma.satellite.findMany.mockResolvedValueOnce([cacheSat])

      const result = await service.getPosition(25544, nearEpoch)

      expect(result.timestamp).toBe(nearEpoch.toISOString())
    })

    it('returns non-zero position components for ISS', async () => {
      prisma.satellite.findMany.mockResolvedValueOnce([cacheSat])

      const result = await service.getPosition(25544, nearEpoch)

      // ISS orbits at ~400 km altitude — ECI magnitude should be ~6800 km
      const mag = Math.sqrt(result.position.x ** 2 + result.position.y ** 2 + result.position.z ** 2)
      expect(mag).toBeGreaterThan(6000)
      expect(mag).toBeLessThan(8000)
    })

    it('throws SatelliteNotFoundException when satellite not found', async () => {
      // findMany returns [] — noradId 99999 will not be in the cache
      await expect(service.getPosition(99999)).rejects.toThrow(SatelliteNotFoundException)
    })

    it('throws SatelliteNotFoundException when satellite has no TLE', async () => {
      prisma.satellite.findMany.mockResolvedValueOnce([{ noradId: 25544, tle: [] }])

      await expect(service.getPosition(25544)).rejects.toThrow(SatelliteNotFoundException)
    })

    it('throws PropagationFailedException for malformed TLE lines', async () => {
      prisma.satellite.findMany.mockResolvedValueOnce([
        { noradId: 25544, tle: [{ line1: 'bad', line2: 'bad' }] },
      ])

      // Bad TLE passes twoline2satrec (no error flag) but propagation returns NaN
      await expect(service.getPosition(25544)).rejects.toThrow(PropagationFailedException)
    })
  })

  describe('getOrbit', () => {
    it('returns exactly 100 orbit points', async () => {
      prisma.satellite.findMany.mockResolvedValueOnce([cacheSat])

      const result = await service.getOrbit(25544, nearEpoch)

      expect(result.points).toHaveLength(100)
    })

    it('includes noradId and generatedAt in orbit response', async () => {
      prisma.satellite.findMany.mockResolvedValueOnce([cacheSat])

      const result = await service.getOrbit(25544, nearEpoch)

      expect(result.noradId).toBe(25544)
      expect(result.generatedAt).toBeDefined()
    })

    it('each orbit point has timestamp, position, and velocity', async () => {
      prisma.satellite.findMany.mockResolvedValueOnce([cacheSat])

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
      prisma.satellite.findMany.mockResolvedValueOnce([cacheSat])

      const result = await service.getOrbit(25544, nearEpoch)

      const first = new Date(result.points[0].timestamp).getTime()
      const last = new Date(result.points[99].timestamp).getTime()
      const spanMinutes = (last - first) / 1000 / 60

      // 99 intervals of 54s = 89.1 minutes
      expect(spanMinutes).toBeGreaterThan(88)
      expect(spanMinutes).toBeLessThan(91)
    })

    it('throws SatelliteNotFoundException when satellite not found', async () => {
      await expect(service.getOrbit(99999)).rejects.toThrow(SatelliteNotFoundException)
    })

    it('throws SatelliteNotFoundException when satellite has no TLE', async () => {
      prisma.satellite.findMany.mockResolvedValueOnce([{ noradId: 25544, tle: [] }])

      await expect(service.getOrbit(25544)).rejects.toThrow(SatelliteNotFoundException)
    })
  })

  describe('getPositions', () => {
    it('returns an empty array for empty input', async () => {
      const result = await service.getPositions([])
      expect(result).toEqual([])
    })

    it('returns positions for all cached noradIds', async () => {
      prisma.satellite.findMany.mockResolvedValueOnce([cacheSat])

      const result = await service.getPositions([25544], nearEpoch)

      expect(result).toHaveLength(1)
      expect(result[0].noradId).toBe(25544)
    })

    it('silently skips noradIds not in the cache', async () => {
      prisma.satellite.findMany.mockResolvedValueOnce([cacheSat])

      const result = await service.getPositions([25544, 99999], nearEpoch)

      expect(result).toHaveLength(1)
      expect(result[0].noradId).toBe(25544)
    })
  })
})
