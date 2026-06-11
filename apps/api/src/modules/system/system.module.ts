import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { MetricsService } from './metrics.service'
import { SystemController } from './system.controller'

@Module({
  imports: [PrismaModule],
  controllers: [SystemController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class SystemModule {}
