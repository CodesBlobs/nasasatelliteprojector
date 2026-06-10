import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { ConjunctionsController } from './conjunctions.controller'
import { ConjunctionsService } from './conjunctions.service'

@Module({
  imports: [PrismaModule],
  controllers: [ConjunctionsController],
  providers: [ConjunctionsService],
  exports: [ConjunctionsService],
})
export class ConjunctionsModule {}
