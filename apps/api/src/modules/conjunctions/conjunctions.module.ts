import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { ConjunctionsController } from './conjunctions.controller'
import { ConjunctionsService } from './conjunctions.service'
import { ConjunctionScheduler } from './conjunction-scheduler'
import { CONJUNCTION_QUEUE } from '../../workers/conjunction.worker'

@Module({
  imports: [
    PrismaModule,
    // Optional: register the queue here so the scheduler can inject it.
    // If Redis is unavailable, BullMQ will retry the connection silently.
    BullModule.registerQueue({ name: CONJUNCTION_QUEUE }),
  ],
  controllers: [ConjunctionsController],
  providers: [ConjunctionsService, ConjunctionScheduler],
  exports: [ConjunctionsService],
})
export class ConjunctionsModule {}
