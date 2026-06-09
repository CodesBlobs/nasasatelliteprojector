import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { TleModule } from '../tle/tle.module'
import { CelestrakService } from './celestrak.service'
import { IngestController } from './ingest.controller'
import { IngestService } from './ingest.service'

@Module({
  imports: [PrismaModule, TleModule],
  controllers: [IngestController],
  providers: [IngestService, CelestrakService],
})
export class IngestModule {}
