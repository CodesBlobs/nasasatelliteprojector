import { Controller, Delete, Get, Param, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { ChatsService } from './chats.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

interface AuthRequest {
  user: { id: string; email: string; name: string }
}

@ApiTags('chats')
@Controller('chats')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatsController {
  constructor(private service: ChatsService) {}

  @Get()
  @ApiOperation({ summary: 'List all chats for the current user' })
  list(@Request() req: AuthRequest) {
    return this.service.listChats(req.user.id)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a chat with all messages' })
  get(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.service.getChat(req.user.id, id)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a chat' })
  delete(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.service.deleteChat(req.user.id, id)
  }
}
