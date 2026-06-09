import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CreateSatelliteDto } from './dto/create-satellite.dto'

@Injectable()
export class SatellitesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSatelliteDto) {
    try {
      return await this.prisma.satellite.create({
        data: {
          noradId: dto.noradId,
          name: dto.name,
          operator: dto.operator,
          country: dto.country,
          objectType: dto.objectType,
        },
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new ConflictException('Satellite with this NORAD ID already exists')
      }
      throw error
    }
  }

  async findAll(skip = 0, take = 100) {
    const satellites = await this.prisma.satellite.findMany({
      skip,
      take: Math.min(take, 1000),
      orderBy: { createdAt: 'desc' },
    })

    const total = await this.prisma.satellite.count()

    return {
      data: satellites,
      pagination: { total, skip, take: satellites.length },
    }
  }

  async findById(id: string) {
    const satellite = await this.prisma.satellite.findUnique({
      where: { id },
      include: {
        tle: { orderBy: { epoch: 'desc' }, take: 1 },
      },
    })

    if (!satellite) {
      throw new NotFoundException('Satellite not found')
    }

    return satellite
  }

  async getStats() {
    const [total, payload, debris, rocketBody, latestTle] = await Promise.all([
      this.prisma.satellite.count(),
      this.prisma.satellite.count({ where: { objectType: 'Payload' } }),
      this.prisma.satellite.count({ where: { objectType: 'Debris' } }),
      this.prisma.satellite.count({ where: { objectType: 'Rocket Body' } }),
      this.prisma.tLE.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])

    return {
      total,
      byType: { Payload: payload, Debris: debris, 'Rocket Body': rocketBody },
      lastIngestAt: latestTle?.createdAt ?? null,
    }
  }

  async findByNoradId(noradId: number) {
    const satellite = await this.prisma.satellite.findUnique({
      where: { noradId },
      include: {
        tle: { orderBy: { epoch: 'desc' }, take: 1 },
      },
    })

    if (!satellite) {
      throw new NotFoundException('Satellite not found')
    }

    return satellite
  }
}
