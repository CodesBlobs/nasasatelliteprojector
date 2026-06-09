import { Test, TestingModule } from '@nestjs/testing'
import { SnapshotService } from './snapshot.service'
import { PrismaService } from '../../common/prisma/prisma.service'

const ISS_LINE1 = '1 25544U 98067A   23001.00000000  .00016717  00000-0  29770-3 0  9005'
const ISS_LINE2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.54179074380645'

describe('SnapshotService', () => {
  let service: SnapshotService
  let prisma: {
    satellite: { findMany: ReturnType<typeof vi.fn> }
    positionSnapshot: { create: ReturnType<typeof vi.fn> }
  }

  beforeEach(async () => {
    prisma = {
      satellite: { findMany: vi.fn() },
      positionSnapshot: { create: vi.fn().mockResolvedValue({}) },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    service = module.get<SnapshotService>(SnapshotService)
  })

  // Fixed timestamp near the TLE epoch so SGP4 returns valid results
  const nearEpoch = new Date('2023-01-01T12:00:00Z')

  it('writes a snapshot for each satellite with a TLE', async () => {
    prisma.satellite.findMany.mockResolvedValue([
      {
        id: 'sat-1',
        noradId: 25544,
        tle: [{ line1: ISS_LINE1, line2: ISS_LINE2, epoch: nearEpoch }],
      },
    ])

    const result = await service.generatePositionSnapshot(nearEpoch)

    expect(result.written).toBe(1)
    expect(result.errors).toBe(0)
    expect(prisma.positionSnapshot.create).toHaveBeenCalledTimes(1)

    const call = prisma.positionSnapshot.create.mock.calls[0][0]
    expect(call.data.satelliteId).toBe('sat-1')
    expect(typeof call.data.x).toBe('number')
    expect(typeof call.data.vx).toBe('number')
  })

  it('skips satellites with no TLE', async () => {
    prisma.satellite.findMany.mockResolvedValue([
      { id: 'sat-2', noradId: 99999, tle: [] },
    ])

    const result = await service.generatePositionSnapshot(nearEpoch)

    expect(result.written).toBe(0)
    expect(result.errors).toBe(0)
    expect(prisma.positionSnapshot.create).not.toHaveBeenCalled()
  })

  it('counts errors for satellites with invalid TLE', async () => {
    prisma.satellite.findMany.mockResolvedValue([
      {
        id: 'sat-3',
        noradId: 11111,
        tle: [{ line1: 'bad', line2: 'bad', epoch: nearEpoch }],
      },
    ])

    const result = await service.generatePositionSnapshot(nearEpoch)

    expect(result.written).toBe(0)
    expect(result.errors).toBe(1)
  })

  it('handles mixed satellites correctly', async () => {
    prisma.satellite.findMany.mockResolvedValue([
      {
        id: 'sat-1',
        noradId: 25544,
        tle: [{ line1: ISS_LINE1, line2: ISS_LINE2, epoch: nearEpoch }],
      },
      { id: 'sat-2', noradId: 99998, tle: [] },
      {
        id: 'sat-3',
        noradId: 11111,
        tle: [{ line1: 'bad', line2: 'bad', epoch: nearEpoch }],
      },
    ])

    const result = await service.generatePositionSnapshot(nearEpoch)

    expect(result.written).toBe(1)
    expect(result.errors).toBe(1)
  })
})
