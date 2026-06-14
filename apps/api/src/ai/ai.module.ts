import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { AiContextBuilder } from './ai-context-builder'
import { PrismaModule } from '../common/prisma/prisma.module'
import { AuthModule } from '../modules/auth/auth.module'
import { ChatsModule } from '../modules/chats/chats.module'

@Module({
  imports: [PrismaModule, AuthModule, ChatsModule],
  controllers: [AiController],
  providers: [AiService, AiContextBuilder],
})
export class AiModule {}
