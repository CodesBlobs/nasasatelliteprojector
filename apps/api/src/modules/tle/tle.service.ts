import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { TleParserService } from './services/tle-parser.service'
import { InvalidTleException } from './exceptions/invalid-tle.exception'
import { ImportTleDto } from './dto/import-tle.dto'

export interface ImportTleResult {
  id: string
  name: string
  noradId: number
  epoch: Date
  created: boolean
}

@Injectable()
export class TleService {
  constructor(
    private prisma: PrismaService,
    private parser: TleParserService
  ) {}

  async import(dto: ImportTleDto): Promise<ImportTleResult> {
    const parsed = this.parser.parse(dto.line1, dto.line2)
    const epochDate = this.calculateEpochDate(parsed.epochYear, parsed.epochDayOfYear)

    let satellite = await this.prisma.satellite.findUnique({
      where: { noradId: parsed.noradId },
    })

    let created = false

    if (!satellite) {
      satellite = await this.prisma.satellite.create({
        data: {
          noradId: parsed.noradId,
          name: dto.name,
          operator: dto.operator || null,
          country: dto.country || null,
          objectType: 'Payload',
        },
      })
      created = true
    }

    await this.prisma.tLE.upsert({
      where: {
        satelliteId_epoch: {
          satelliteId: satellite.id,
          epoch: epochDate,
        },
      },
      update: {
        line1: dto.line1,
        line2: dto.line2,
      },
      create: {
        satelliteId: satellite.id,
        line1: dto.line1,
        line2: dto.line2,
        epoch: epochDate,
      },
    })

    return {
      id: satellite.id,
      name: satellite.name,
      noradId: satellite.noradId,
      epoch: epochDate,
      created,
    }
  }

  async getLatestByNoradId(noradId: number) {
    const satellite = await this.prisma.satellite.findUnique({
      where: { noradId },
      include: {
        tle: {
          orderBy: { epoch: 'desc' },
          take: 1,
        },
      },
    })

    if (!satellite) {
      throw new NotFoundException(`Satellite with NORAD ID ${noradId} not found`)
    }

    const tle = satellite.tle[0]
    if (!tle) {
      throw new NotFoundException(`No TLE found for NORAD ID ${noradId}`)
    }

    return {
      satellite,
      tle,
    }
  }

  async listLatestTles(limit = 100) {
    const satellites = await this.prisma.satellite.findMany({
      include: {
        tle: {
          orderBy: { epoch: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return satellites
      .filter((sat) => sat.tle.length > 0)
      .map((sat) => ({
        satellite: sat,
        tle: sat.tle[0],
      }))
  }

  async getTleHistory(noradId: number, limit = 10) {
    const satellite = await this.prisma.satellite.findUnique({
      where: { noradId },
      include: {
        tle: {
          orderBy: { epoch: 'desc' },
          take: limit,
        },
      },
    })

    if (!satellite) {
      throw new NotFoundException(`Satellite with NORAD ID ${noradId} not found`)
    }

    if (satellite.tle.length === 0) {
      throw new NotFoundException(`No TLE history found for NORAD ID ${noradId}`)
    }

    return {
      satellite,
      tles: satellite.tle,
    }
  }

  private calculateEpochDate(year: number, dayOfYear: number): Date {
    const isLeapYear = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
    const daysInMonth = [
      31,
      isLeapYear ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ]

    let month = 0
    let day = Math.floor(dayOfYear)

    for (let i = 0; i < daysInMonth.length; i++) {
      if (day <= daysInMonth[i]) {
        month = i
        break
      }
      day -= daysInMonth[i]
    }

    const fracDay = dayOfYear - Math.floor(dayOfYear)
    const date = new Date(year, month, day)
    date.setHours(fracDay * 24)

    return date
  }
}
