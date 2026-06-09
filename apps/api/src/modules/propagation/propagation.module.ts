import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { PropagationService } from './propagation.service'
import { PropagationController } from './propagation.controller'
import { SnapshotService } from './snapshot.service'

@Module({
  imports: [PrismaModule],
  providers: [PropagationService, SnapshotService],
  controllers: [PropagationController],
  exports: [PropagationService, SnapshotService],
})
export class PropagationModule {}
