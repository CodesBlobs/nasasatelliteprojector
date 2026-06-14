import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AiService } from './ai.service'
import { ChatDto } from './dto/chat.dto'
import { OptionalJwtAuthGuard } from '../modules/auth/jwt-auth.guard'

interface AuthRequest {
  user?: { id: string; email: string; name: string }
}

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private service: AiService) {}

  @Post('chat')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open-ended AI chat with mission control context' })
  chat(@Body() dto: ChatDto, @Request() req: AuthRequest) {
    return this.service.chat(dto.message, req.user?.id, dto.chatId)
  }

  @Get('briefing')
  @ApiOperation({ summary: 'Generate AI mission status briefing' })
  briefing() {
    return this.service.briefing()
  }

  @Get('conjunction/:id/explain')
  @ApiOperation({ summary: 'Explain a conjunction event' })
  explainConjunction(@Param('id') id: string) {
    return this.service.explainConjunction(id)
  }

  @Get('alert/:id/explain')
  @ApiOperation({ summary: 'Explain an alert' })
  explainAlert(@Param('id') id: string) {
    return this.service.explainAlert(id)
  }

  @Get('simulation/:id/analyze')
  @ApiOperation({ summary: 'Analyze a simulation result' })
  analyzeSimulation(@Param('id') id: string) {
    return this.service.analyzeSimulation(id)
  }

  @Get('conjunction/:id/recommendations')
  @ApiOperation({ summary: 'Generate maneuver recommendations for a conjunction' })
  conjunctionRecommendations(@Param('id') id: string) {
    return this.service.conjunctionRecommendations(id)
  }
}
