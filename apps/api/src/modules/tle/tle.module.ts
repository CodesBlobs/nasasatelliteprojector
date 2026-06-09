import { Module } from '@nestjs/common'
import { TleService } from './tle.service'
import { TleController } from './tle.controller'
import { TleParserService } from './services/tle-parser.service'
import { PrismaModule } from '../../common/prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  providers: [TleService, TleParserService],
  controllers: [TleController],
  exports: [TleService, TleParserService],
})
export class TleModule {}
