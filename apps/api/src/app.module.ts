import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ScheduleModule } from '@nestjs/schedule'
import { HealthModule } from './modules/health/health.module'
import { SatellitesModule } from './modules/satellites/satellites.module'
import { TleModule } from './modules/tle/tle.module'
import { IngestModule } from './modules/ingest/ingest.module'
import { PropagationModule } from './modules/propagation/propagation.module'
import { ConjunctionsModule } from './modules/conjunctions/conjunctions.module'
import { AlertsModule } from './modules/alerts/alerts.module'
import { EventsModule } from './modules/events/events.module'
import { SystemModule } from './modules/system/system.module'
import { WorkersModule } from './workers/workers.module'
import { SimulationModule } from './modules/simulation/simulation.module'
import { PrismaModule } from './common/prisma/prisma.module'
import { AiModule } from './ai/ai.module'
import { AuthModule } from './modules/auth/auth.module'
import { ChatsModule } from './modules/chats/chats.module'

@Module({
  imports: [
    // Infrastructure
    PrismaModule,
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        // ioredis accepts a URL string or options object.
        // Gracefully degrades — if Redis is unreachable, queue ops fail silently.
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      },
    }),

    // Feature modules
    HealthModule,
    PropagationModule,
    SatellitesModule,
    TleModule,
    IngestModule,
    ConjunctionsModule,
    AlertsModule,
    EventsModule,
    SystemModule,
    WorkersModule,
    SimulationModule,
    AiModule,
    AuthModule,
    ChatsModule,
  ],
})
export class AppModule {}
