import { Module } from '@nestjs/common'
import { HealthModule } from './modules/health/health.module'
import { SatellitesModule } from './modules/satellites/satellites.module'
import { TleModule } from './modules/tle/tle.module'
import { IngestModule } from './modules/ingest/ingest.module'
import { PropagationModule } from './modules/propagation/propagation.module'
import { ConjunctionsModule } from './modules/conjunctions/conjunctions.module'
import { AlertsModule } from './modules/alerts/alerts.module'
import { SimulationModule } from './modules/simulation/simulation.module'
import { PrismaModule } from './common/prisma/prisma.module'

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    PropagationModule,
    SatellitesModule,
    TleModule,
    IngestModule,
    ConjunctionsModule,
    AlertsModule,
    SimulationModule,
  ],
})
export class AppModule {}
