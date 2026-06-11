import { Controller, Get, Req, Res } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { EventsService } from './events.service'

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private events: EventsService) {}

  @Get('stream')
  @ApiOperation({ summary: 'Server-Sent Events stream for real-time updates' })
  stream(@Req() req: Request, @Res() res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    // Disable Nginx/proxy buffering so events arrive immediately
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    // Send an initial connection-established event
    res.write('event: connected\ndata: {}\n\n')

    const cleanup = this.events.subscribe(res)

    req.on('close', cleanup)
    req.on('error', cleanup)
  }
}
