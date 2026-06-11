import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AlertsModule } from '../modules/alerts/alerts.module'
import { ConjunctionsModule } from '../modules/conjunctions/conjunctions.module'
import { EventsModule } from '../modules/events/events.module'
import { SystemModule } from '../modules/system/system.module'
import { PrismaModule } from '../common/prisma/prisma.module'
import { ConjunctionWorker, CONJUNCTION_QUEUE, ALERT_QUEUE } from './conjunction.worker'
import { AlertWorker } from './alert.worker'
import { SimulationWorker } from './simulation.worker'
import { SIMULATION_QUEUE } from '../modules/simulation/simulation.service'

@Module({
  imports: [
    BullModule.registerQueue({ name: CONJUNCTION_QUEUE }),
    BullModule.registerQueue({ name: ALERT_QUEUE }),
    BullModule.registerQueue({ name: SIMULATION_QUEUE }),
    AlertsModule,
    ConjunctionsModule,
    EventsModule,
    SystemModule,
    PrismaModule,
  ],
  providers: [ConjunctionWorker, AlertWorker, SimulationWorker],
  exports: [BullModule],
})
export class WorkersModule {}
