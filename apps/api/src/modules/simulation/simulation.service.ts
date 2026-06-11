import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PrismaService } from '../../common/prisma/prisma.service'
import { SimulationStatus } from '@orbital/shared'
import type { CreateSimulationDto } from './dto/create-simulation.dto'

export const SIMULATION_QUEUE = 'simulation'

export interface SimulationJobData {
  simulationId: string
}

@Injectable()
export class SimulationService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(SIMULATION_QUEUE) private queue: Queue,
  ) {}

  async create(dto: CreateSimulationDto) {
    const satellite = await this.prisma.satellite.findUnique({
      where: { id: dto.satelliteId },
    })
    if (!satellite) {
      throw new NotFoundException(`Satellite ${dto.satelliteId} not found`)
    }

    const simulation = await this.prisma.simulation.create({
      data: {
        satelliteId: dto.satelliteId,
        deltaVx: dto.deltaV.x,
        deltaVy: dto.deltaV.y,
        deltaVz: dto.deltaV.z,
        maneuverTime: dto.maneuverTime ? new Date(dto.maneuverTime) : new Date(),
        windowHours: dto.windowHours ?? 24,
        status: SimulationStatus.PENDING,
      },
    })

    await this.queue.add('run', { simulationId: simulation.id } satisfies SimulationJobData)

    return simulation
  }

  async findOne(id: string) {
    const simulation = await this.prisma.simulation.findUnique({ where: { id } })
    if (!simulation) throw new NotFoundException(`Simulation ${id} not found`)
    return simulation
  }

  async findWithResult(id: string) {
    const simulation = await this.prisma.simulation.findUnique({
      where: { id },
      include: { result: true },
    })
    if (!simulation) throw new NotFoundException(`Simulation ${id} not found`)
    return simulation
  }

  async findBySatellite(satelliteId: string) {
    return this.prisma.simulation.findMany({
      where: { satelliteId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  }
}
