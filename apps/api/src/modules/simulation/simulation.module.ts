import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { SimulationController } from './simulation.controller'
import { SimulationService, SIMULATION_QUEUE } from './simulation.service'

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: SIMULATION_QUEUE }),
  ],
  controllers: [SimulationController],
  providers: [SimulationService],
  exports: [SimulationService],
})
export class SimulationModule {}
