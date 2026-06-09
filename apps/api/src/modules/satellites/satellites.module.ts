import { Module } from '@nestjs/common'
import { SatellitesService } from './satellites.service'
import { SatellitesController } from './satellites.controller'
import { PrismaModule } from '../../common/prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  providers: [SatellitesService],
  controllers: [SatellitesController],
  exports: [SatellitesService],
})
export class SatellitesModule {}
